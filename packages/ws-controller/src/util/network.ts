/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from "node:child_process";
import { platform } from "node:os";

const PLATFORM_MAC = platform() === "darwin";

/**
 * Ping an IP address using the system ping command.
 * @param ipAddress The IP address to ping (IPv4 or IPv6)
 * @param timeout Timeout in seconds (default: 2)
 * @param attempts Number of ping attempts (default: 1)
 * @returns Promise resolving to true if ping succeeded, false otherwise
 */
export async function pingIp(ipAddress: string, timeout = 2, attempts = 1): Promise<boolean> {
    const isIpv6 = ipAddress.includes(":");

    // Build the ping command based on platform and IP version
    let command: string;
    let args: string[];

    if (isIpv6 && PLATFORM_MAC) {
        // macOS doesn't support -W (timeout) on ping6
        command = "ping6";
        args = ["-c", "1", ipAddress];
    } else if (isIpv6) {
        // Linux IPv6
        command = "ping";
        args = ["-6", "-c", "1", "-W", timeout.toString(), ipAddress];
    } else {
        // IPv4 (works on both macOS and Linux)
        command = "ping";
        args = ["-c", "1", "-W", timeout.toString(), ipAddress];
    }

    while (attempts > 0) {
        attempts--;
        try {
            const success = await runPingCommand(command, args, timeout + 2);
            if (success || attempts === 0) {
                return success;
            }
        } catch {
            // Timeout or error, try again if attempts remaining
            if (attempts === 0) {
                return false;
            }
        }
        // Sleep 10 seconds between attempts (like Python implementation)
        if (attempts > 0) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    return false;
}

/**
 * Run the ping command and return whether it succeeded.
 */
function runPingCommand(command: string, args: string[], timeoutSeconds: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });

        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error("Ping timeout"));
        }, timeoutSeconds * 1000);

        proc.on("close", code => {
            clearTimeout(timer);
            resolve(code === 0);
        });

        proc.on("error", err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
