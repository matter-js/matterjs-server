/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple CLI script to send a command via WebSocket and log responses.
 *
 * Usage: npx ts-node send-command.ts <url> <command> [args-json]
 *
 * Example:
 *   npx ts-node send-command.ts ws://localhost:5580/ws server_info
 *   npx ts-node send-command.ts ws://localhost:5580/ws get_node '{"node_id": 1}'
 */

import WebSocket from "ws";

const [, , url, command, argsJson] = process.argv;

if (!url || !command) {
    console.error("Usage: send-command <url> <command> [args-json]");
    console.error("");
    console.error("Examples:");
    console.error("  npx ts-node send-command.ts ws://localhost:5580/ws server_info");
    console.error("  npx ts-node send-command.ts ws://localhost:5580/ws get_node '{\"node_id\": 1}'");
    console.error("  npx ts-node send-command.ts ws://localhost:5580/ws start_listening");
    process.exit(1);
}

let args: unknown = undefined;
if (argsJson) {
    try {
        args = JSON.parse(argsJson);
    } catch (e) {
        console.error("Error parsing args JSON:", (e as Error).message);
        process.exit(1);
    }
}

console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.on("open", () => {
    console.log("Connected!");

    const message = {
        message_id: `cmd-${Date.now()}`,
        command,
        ...(args !== undefined && { args }),
    };

    console.log("Sending:", JSON.stringify(message, null, 2));
    ws.send(JSON.stringify(message));
});

ws.on("message", (data: WebSocket.Data) => {
    try {
        const parsed = JSON.parse(data.toString());
        console.log("\n--- Received ---");
        console.log(JSON.stringify(parsed, null, 2));
    } catch {
        console.log("\n--- Received (raw) ---");
        console.log(data.toString());
    }
});

ws.on("error", (error: Error) => {
    console.error("WebSocket error:", error.message);
});

ws.on("close", (code: number, reason: Buffer) => {
    const reasonStr = reason.toString();
    console.log(`\nDisconnected (code: ${code}, reason: ${reasonStr === "" ? "none" : reasonStr})`);
    process.exit(0);
});

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
    console.log("\nClosing connection...");
    ws.close();
});
