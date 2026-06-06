/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server lifecycle behind a stable interface so the integration suite can run
 * the matter-server either as a local child process (default) or inside the
 * CI-built Docker image (MATTER_TEST_SERVER_MODE=docker), without changing any
 * test assertions.
 */

import { ChildProcess, execFile } from "child_process";
import { basename } from "path";
import { promisify } from "util";
import { SERVER_PORT, killProcess, startServer, waitForPort } from "./ProcessHelpers.js";

export interface ServerControllerOptions {
    storagePath: string;
    logFilePath: string;
    logLevel?: string;
    enableTestNetDcl?: boolean;
}

export interface ServerController {
    start(): Promise<void>;
    stop(timeoutMs?: number): Promise<void>;
    cleanup(): Promise<void>;
}

export class LocalProcessServerController implements ServerController {
    readonly #options: ServerControllerOptions;
    #process: ChildProcess | undefined;

    constructor(options: ServerControllerOptions) {
        this.#options = options;
    }

    async start(): Promise<void> {
        if (this.#process !== undefined) {
            throw new Error("LocalProcessServerController.start() called while a process is already running");
        }
        this.#process = startServer(
            this.#options.storagePath,
            this.#options.logFilePath,
            this.#options.logLevel,
            this.#options.enableTestNetDcl ?? true,
        );
        await waitForPort(SERVER_PORT);
    }

    async stop(timeoutMs = 2_000): Promise<void> {
        await killProcess(this.#process, timeoutMs);
        this.#process = undefined;
    }

    async cleanup(): Promise<void> {
        await killProcess(this.#process);
        this.#process = undefined;
    }
}

const execFileAsync = promisify(execFile);

// Per-process name avoids clobbering an unrelated container and lets concurrent runs coexist.
const CONTAINER_NAME = `matter-test-server-${process.pid}`;
const DEFAULT_IMAGE = "matterjs-server:ci";

async function runDocker(args: string[], { ignoreErrors = false } = {}): Promise<void> {
    try {
        await execFileAsync("docker", args);
    } catch (error) {
        if (!ignoreErrors) {
            throw error;
        }
        console.error(`[docker] ignored error for \`docker ${args.join(" ")}\`:`, (error as Error).message);
    }
}

export class DockerServerController implements ServerController {
    readonly #options: ServerControllerOptions;
    readonly #image: string;
    readonly #containerLogPath: string;
    #created = false;

    constructor(options: ServerControllerOptions) {
        this.#options = options;
        this.#image = process.env.MATTER_TEST_DOCKER_IMAGE ?? DEFAULT_IMAGE;
        // logFilePath lives inside storagePath, which is bind-mounted at /data.
        this.#containerLogPath = `/data/${basename(options.logFilePath)}`;
    }

    async start(): Promise<void> {
        if (this.#created) {
            await runDocker(["start", CONTAINER_NAME]);
        } else {
            await runDocker(["rm", "-f", CONTAINER_NAME], { ignoreErrors: true });
            await runDocker(["run", "-d", ...this.#runArgs()]);
            this.#created = true;
        }
        try {
            await waitForPort(SERVER_PORT);
        } catch (error) {
            await this.#dumpContainerLogs();
            throw error;
        }
    }

    async stop(timeoutMs = 2_000): Promise<void> {
        // #created stays true on purpose: the next start() must `docker start` the
        // same container so storage + log rotation survive the restart-persistence test.
        const stopTimeoutSec = Math.max(1, Math.ceil(timeoutMs / 1_000));
        await runDocker(["stop", "-t", `${stopTimeoutSec}`, CONTAINER_NAME], { ignoreErrors: true });
    }

    async cleanup(): Promise<void> {
        await runDocker(["rm", "-f", CONTAINER_NAME], { ignoreErrors: true });
        this.#created = false;
    }

    #runArgs(): string[] {
        const { storagePath, logLevel, enableTestNetDcl } = this.#options;

        // NET_RAW lets the non-root container run ICMP ping (ping_node): with
        // --network host it inherits the host's ping_group_range, which may forbid
        // unprivileged ICMP, so the raw-socket capability is required instead.
        const args = ["--name", CONTAINER_NAME, "--network", "host", "--cap-add", "NET_RAW"];

        // Match file owner to the host runner so the bind-mounted /data is writable by the server.
        const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
        const gid = typeof process.getgid === "function" ? process.getgid() : undefined;
        if (uid !== undefined && gid !== undefined) {
            args.push("--user", `${uid}:${gid}`);
        }

        args.push("-v", `${storagePath}:/data`, this.#image);

        args.push(
            "--storage-path=/data",
            `--port=${SERVER_PORT}`,
            `--log-level=${logLevel ?? process.env.MATTER_LOG_LEVEL ?? "info"}`,
            `--log-file=${this.#containerLogPath}`,
        );
        if (enableTestNetDcl ?? true) {
            args.push("--enable-test-net-dcl");
        }
        return args;
    }

    async #dumpContainerLogs(): Promise<void> {
        try {
            const { stdout, stderr } = await execFileAsync("docker", ["logs", CONTAINER_NAME]);
            console.error(`[docker logs ${CONTAINER_NAME}] stdout:\n${stdout}`);
            if (stderr) {
                console.error(`[docker logs ${CONTAINER_NAME}] stderr:\n${stderr}`);
            }
        } catch (error) {
            console.error(`[docker logs ${CONTAINER_NAME}] failed to fetch logs:`, (error as Error).message);
        }
    }
}

export function createServerController(options: ServerControllerOptions): ServerController {
    const mode = process.env.MATTER_TEST_SERVER_MODE ?? "local";
    switch (mode) {
        case "local":
            return new LocalProcessServerController(options);
        case "docker":
            return new DockerServerController(options);
        default:
            throw new Error(`Unknown MATTER_TEST_SERVER_MODE "${mode}" (expected "local" or "docker")`);
    }
}
