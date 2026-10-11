/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from "node:child_process";
import {
    cleanupTempStorage,
    createTempStoragePaths,
    killProcess,
    SERVER_PORT,
    startServer,
    waitForPort,
} from "./helpers/index.js";

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

describe("DCL offline mode", function () {
    this.timeout(60_000);

    let serverStoragePath: string;
    let deviceStoragePath: string;
    let serverProcess: ChildProcess | undefined;

    before(async function () {
        ({ serverStoragePath, deviceStoragePath } = await createTempStoragePaths());
    });

    after(async function () {
        await killProcess(serverProcess);
        await cleanupTempStorage(serverStoragePath, deviceStoragePath);
    });

    it("fetches no certificates and exits right away when stopped just after the start", async function () {
        serverProcess = startServer(serverStoragePath, undefined, "debug", true, ["--dcl-offline"]);
        let output = "";
        serverProcess.stdout?.on("data", (data: Buffer) => (output += data.toString()));
        serverProcess.stderr?.on("data", (data: Buffer) => (output += data.toString()));

        await waitForPort(SERVER_PORT);
        serverProcess.kill("SIGINT");

        expect(await waitForExit(serverProcess, 20_000)).to.equal(0);
        expect(output).to.not.include("Fetching PAA certificates from DCL");
    });
});
