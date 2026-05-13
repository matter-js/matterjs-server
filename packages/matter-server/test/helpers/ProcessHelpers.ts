/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Helper functions for process and server management in tests.
 */

import { ChildProcess, spawn } from "child_process";
import { mkdir, rm } from "fs/promises";
import nodeProcess from "node:process";
import { tmpdir } from "os";
import { join } from "path";
import WebSocket from "ws";

// Constants - use non-default ports to avoid conflicts with any real Matter
// server/device that may already be bound to the production defaults on the
// host (ws server 5580, Matter protocol 5540).
export const SERVER_PORT = 5590;
export const SERVER_WS_URL = `ws://localhost:${SERVER_PORT}/ws`;
export const DEVICE_PORT = 5550;
export const MANUAL_PAIRING_CODE = "34970112332";
export const DEVICE_PASSCODE = 20202021;
export const DEVICE_DISCRIMINATOR = 3840;

/**
 * Creates temporary storage directories for server and device, plus a log file path.
 * Returns paths that should be cleaned up after tests.
 */
export async function createTempStoragePaths(): Promise<{
    serverStoragePath: string;
    deviceStoragePath: string;
    logFilePath: string;
}> {
    const timestamp = Date.now();
    const serverStoragePath = join(tmpdir(), `matter-test-server-${timestamp}`);
    const deviceStoragePath = join(tmpdir(), `matter-test-device-${timestamp}`);

    await mkdir(serverStoragePath, { recursive: true });
    await mkdir(deviceStoragePath, { recursive: true });

    // Log file lives inside server storage dir so it is cleaned up automatically.
    const logFilePath = join(serverStoragePath, "server.log");

    return { serverStoragePath, deviceStoragePath, logFilePath };
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
 * Starts the Matter server process, optionally writing logs to a file.
 */
export function startServer(
    storagePath: string,
    logFilePath?: string,
    logLevel = process.env.MATTER_LOG_LEVEL ?? "info",
    enableTestNetDcl = true,
): ChildProcess {
    const args = [
        "--enable-source-maps",
        "../../packages/matter-server/dist/esm/MatterServer.js",
        `--storage-path=${storagePath}`,
        `--log-level=${logLevel}`,
        `--port=${SERVER_PORT}`,
    ];
    if (enableTestNetDcl) {
        args.push("--enable-test-net-dcl");
    }
    if (logFilePath !== undefined) {
        args.push(`--log-file=${logFilePath}`);
    }
    const serverProcess = spawn("node", args, {
        cwd: process.cwd(),
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
    });

    serverProcess.stdout?.on("data", (data: Buffer) => {
        console.log("[server]", data.toString().trim());
    });
    serverProcess.stderr?.on("data", (data: Buffer) => {
        console.log("[server:err]", data.toString().trim());
    });

    return serverProcess;
}

/**
 * Starts the test device process with persistent stdout/stderr logging.
 */
export function startTestDevice(storagePath: string): ChildProcess {
    const proc = spawn(
        "npx",
        ["tsx", "test/fixtures/TestLightDevice.ts", `--storage-path=${storagePath}`, `--port=${DEVICE_PORT}`],
        {
            cwd: process.cwd(),
            detached: true, // own process group so all npx/tsx/node children are killed together
            stdio: ["pipe", "pipe", "pipe"],
        },
    );

    // Keep logging throughout the entire test run (not just during startup)
    proc.stdout?.on("data", (data: Buffer) => {
        console.log("[device]", data.toString().trim());
    });
    proc.stderr?.on("data", (data: Buffer) => {
        console.log("[device:err]", data.toString().trim());
    });

    return proc;
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
 * Logging is handled by startTestDevice; this only resolves on the readiness signal.
 */
export function waitForDeviceReady(process: ChildProcess, timeoutMs = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            process.stdout?.off("data", onData);
            reject(new Error("Timeout waiting for device to be ready"));
        }, timeoutMs);

        const onData = (data: Buffer) => {
            const output = data.toString();
            // Device is ready when it shows the pairing codes
            if (output.includes("Manual pairing code:") || output.includes("commissioned")) {
                clearTimeout(timeout);
                process.stdout?.off("data", onData);
                // Give it a moment to fully initialize network
                setTimeout(resolve, 2000);
            }
        };

        process.stdout?.on("data", onData);
    });
}

/**
 * Gracefully kills a process (and its process group if detached) and waits for exit.
 */
export async function killProcess(childProcess: ChildProcess | undefined, timeoutMs = 2_000): Promise<void> {
    if (!childProcess || childProcess.exitCode !== null) {
        if (childProcess) {
            childProcess.stdout?.removeAllListeners();
            childProcess.stderr?.removeAllListeners();
            childProcess.removeAllListeners();
        }
        return;
    }

    await new Promise<void>(resolve => {
        // Kill the whole process group so npx/tsx children don't outlive the parent.
        const sendSignal = (signal: "SIGINT" | "SIGKILL") => {
            if (childProcess.pid) {
                try {
                    nodeProcess.kill(-childProcess.pid, signal);
                } catch {
                    childProcess.kill(signal);
                }
            } else {
                childProcess.kill(signal);
            }
        };

        const cleanup = async () => {
            clearTimeout(timeout);
            childProcess.stdout?.removeAllListeners();
            childProcess.stderr?.removeAllListeners();
            childProcess.removeAllListeners();
            // Brief settle so the OS reclaims port bindings before the caller proceeds.
            await new Promise(r => setTimeout(r, 200));
            resolve();
        };

        const timeout = setTimeout(() => {
            if (childProcess.exitCode === null) {
                sendSignal("SIGKILL");
            }
            void cleanup();
        }, timeoutMs);

        childProcess.once("exit", () => void cleanup());
        sendSignal("SIGINT");
    });
}
