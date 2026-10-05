/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Starts the real server process with `--listen-address <unix socket path>` and talks to it over
 * the socket only.
 */

import { ServerErrorCode } from "@matter-server/ws-controller";
import type { ChildProcess } from "node:child_process";
import { lstat } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import {
    cleanupTempStorage,
    createTempStoragePaths,
    killProcess,
    MatterTestClient,
    startServer,
    waitForWebSocket,
} from "./helpers/index.js";

function requestOverSocket(socketPath: string, path: string, body?: Buffer): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = httpRequest(
            { socketPath, path, method: body === undefined ? "GET" : "POST", agent: false },
            res => {
                let text = "";
                res.setEncoding("utf8");
                res.on("data", chunk => (text += chunk));
                res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text }));
            },
        );
        req.on("error", reject);
        req.end(body);
    });
}

function waitForExit(proc: ChildProcess): Promise<void> {
    if (proc.exitCode !== null || proc.signalCode !== null) {
        return Promise.resolve();
    }
    return new Promise(resolve => proc.once("exit", () => resolve()));
}

describe("Unix socket server", function () {
    this.timeout(60_000);

    let serverStoragePath: string;
    let deviceStoragePath: string;
    let socketPath: string;
    let wsUrl: string;
    let serverProcess: ChildProcess | undefined;
    let client: MatterTestClient | undefined;

    async function start() {
        const proc = startServer(serverStoragePath, undefined, undefined, false, [`--listen-address=${socketPath}`]);
        serverProcess = proc;
        await Promise.race([
            waitForWebSocket(wsUrl),
            waitForExit(proc).then(() => {
                throw new Error(`Server exited during startup (code ${proc.exitCode}, signal ${proc.signalCode})`);
            }),
        ]);
    }

    before(async function () {
        ({ serverStoragePath, deviceStoragePath } = await createTempStoragePaths());
        socketPath = join(serverStoragePath, "ws.sock");
        wsUrl = `ws+unix://${socketPath}:/ws`;
        await start();
        client = new MatterTestClient(wsUrl);
        await client.connectAndGetServerInfo();
    });

    after(async function () {
        await client?.close();
        await killProcess(serverProcess);
        await cleanupTempStorage(serverStoragePath, deviceStoragePath);
    });

    it("answers WebSocket commands and /health over the socket", async function () {
        const info = await client!.fetchServerInfo();
        expect(info.schema_version).to.be.a("number");

        const health = await requestOverSocket(socketPath, "/health");
        expect(health.status).to.equal(200);
        expect(JSON.parse(health.body)).to.have.property("node_count", 0);
    });

    it("accepts an OTA upload POST for an id issued over the same socket", async function () {
        const ticket = await client!.sendCommand("initiate_ota_upload", 13, {});

        const response = await requestOverSocket(
            socketPath,
            `/ota-upload/${ticket.upload_id}`,
            Buffer.from("not a real ota file"),
        );

        // Reaching the image parser proves the id was claimed; a rejected claim answers before it.
        expect(response.status).to.equal(400);
        const body = JSON.parse(response.body);
        expect(body.error_code).to.equal(ServerErrorCode.OtaUploadError);
        expect(body.message).to.include("Failed to store OTA image");
    });

    it("starts again after being killed and leaving the socket file behind", async function () {
        await client!.close();
        client = undefined;
        const killed = serverProcess!;
        const exited = waitForExit(killed);
        process.kill(-killed.pid!, "SIGKILL");
        await exited;
        expect((await lstat(socketPath)).isSocket()).to.be.true;

        await start();

        const health = await requestOverSocket(socketPath, "/health");
        expect(health.status).to.equal(200);
    });
});
