/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { cleanupTempStorage, createTempStoragePaths, killProcess, SERVER_PORT, startServer } from "./helpers/index.js";

function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<number | null> {
    return new Promise((resolve, reject) => {
        if (proc.exitCode !== null) {
            resolve(proc.exitCode);
            return;
        }
        const timer = setTimeout(() => reject(new Error(`Server still running after ${timeoutMs} ms`)), timeoutMs);
        proc.once("exit", code => {
            clearTimeout(timer);
            resolve(code);
        });
    });
}

describe("Server startup failure", function () {
    this.timeout(60_000);

    let serverStoragePath: string;
    let deviceStoragePath: string;
    let logFilePath: string;
    let blocker: Server;
    let serverProcess: ChildProcess | undefined;

    before(async function () {
        ({ serverStoragePath, deviceStoragePath, logFilePath } = await createTempStoragePaths());
        blocker = createServer();
        await new Promise<void>((resolve, reject) => {
            blocker.once("error", reject);
            blocker.listen(SERVER_PORT, resolve);
        });
    });

    after(async function () {
        await killProcess(serverProcess);
        await new Promise<void>(resolve => blocker.close(() => resolve()));
        await cleanupTempStorage(serverStoragePath, deviceStoragePath);
    });

    it("exits with code 1 and logs the reason to the log file when the WebSocket port is in use", async function () {
        serverProcess = startServer(serverStoragePath, logFilePath, undefined, false);
        let output = "";
        serverProcess.stdout?.on("data", (data: Buffer) => (output += data.toString()));
        serverProcess.stderr?.on("data", (data: Buffer) => (output += data.toString()));

        const exitCode = await waitForExit(serverProcess, 45_000);

        expect(exitCode).to.equal(1);
        expect(output).to.include("Server failed to start");
        expect(output).to.include("EADDRINUSE");
        expect(await readFile(logFilePath, "utf8")).to.include("Server failed to start");
    });
});
