/**
 * Helper functions for process and server management in tests.
 */

import { ChildProcess, spawn } from "child_process";
import { mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import WebSocket from "ws";

// Constants
export const SERVER_PORT = 5580;
export const SERVER_WS_URL = `ws://localhost:${SERVER_PORT}/ws`;
export const DEVICE_PORT = 5540;
export const MANUAL_PAIRING_CODE = "34970112332";

/**
 * Creates temporary storage directories for server and device.
 * Returns paths that should be cleaned up after tests.
 */
export async function createTempStoragePaths(): Promise<{ serverStoragePath: string; deviceStoragePath: string }> {
    const timestamp = Date.now();
    const serverStoragePath = join(tmpdir(), `matter-test-server-${timestamp}`);
    const deviceStoragePath = join(tmpdir(), `matter-test-device-${timestamp}`);

    await mkdir(serverStoragePath, { recursive: true });
    await mkdir(deviceStoragePath, { recursive: true });

    return { serverStoragePath, deviceStoragePath };
}

/**
 * Cleans up temporary storage directories.
 */
export async function cleanupTempStorage(serverStoragePath: string, deviceStoragePath: string): Promise<void> {
    try {
        await rm(serverStoragePath, { recursive: true, force: true });
        await rm(deviceStoragePath, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

/**
 * Starts the Matter server process.
 */
export function startServer(storagePath: string): ChildProcess {
    const serverProcess = spawn(
        "node",
        ["--enable-source-maps", "packages/matter-server/dist/esm/MatterServer.js", `--storage-path=${storagePath}`],
        {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
        },
    );

    serverProcess.stdout?.on("data", (data: Buffer) => {
        console.log("[server]", data.toString().trim());
    });
    serverProcess.stderr?.on("data", (data: Buffer) => {
        console.log("[server:err]", data.toString().trim());
    });

    return serverProcess;
}

/**
 * Starts the test device process.
 */
export function startTestDevice(storagePath: string): ChildProcess {
    return spawn("npx", ["tsx", "test/fixtures/TestLightDevice.ts", `--storage-path=${storagePath}`], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
    });
}

/**
 * Waits for a port to be ready by attempting WebSocket connections.
 */
export async function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const ws = new WebSocket(`ws://localhost:${port}/ws`);
            await new Promise<void>((resolve, reject) => {
                ws.on("open", () => {
                    ws.close();
                    resolve();
                });
                ws.on("error", reject);
            });
            return;
        } catch {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    throw new Error(`Timeout waiting for port ${port}`);
}

/**
 * Waits for the device process to output readiness indicators.
 */
export function waitForDeviceReady(process: ChildProcess, timeoutMs = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for device to be ready"));
        }, timeoutMs);

        const onData = (data: Buffer) => {
            const output = data.toString();
            console.log("[device]", output.trim());
            // Device is ready when it shows the pairing codes
            if (output.includes("Manual pairing code:") || output.includes("commissioned")) {
                clearTimeout(timeout);
                process.stdout?.off("data", onData);
                // Give it a moment to fully initialize network
                setTimeout(resolve, 2000);
            }
        };

        process.stdout?.on("data", onData);
        process.stderr?.on("data", (data: Buffer) => {
            console.log("[device:err]", data.toString().trim());
        });
    });
}

/**
 * Gracefully kills a process.
 */
export async function killProcess(process: ChildProcess | undefined): Promise<void> {
    if (process) {
        process.kill("SIGTERM");
        await new Promise(r => setTimeout(r, 1000));
    }
}
