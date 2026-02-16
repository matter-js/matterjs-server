/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Noble-based BLE proxy client CLI.
 *
 * Connects to a matter-server's /ble WebSocket endpoint and proxies BLE
 * operations using a local Bluetooth adapter via Noble.
 *
 * Usage:
 *   npm run noble-ble-proxy -- --server ws://localhost:5580/ble --hci-id 0
 */

import { NobleBleProxyClient } from "./NobleBleProxyClient.js";

const args = process.argv.slice(2);

let serverUrl = "ws://localhost:5580/ble";
let hciId: number | undefined;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "--server" && args[i + 1]) {
        serverUrl = args[++i];
    } else if (args[i] === "--hci-id" && args[i + 1]) {
        hciId = parseInt(args[++i]);
    } else if (args[i] === "--help" || args[i] === "-h") {
        console.log("Noble BLE Proxy Client - Reference implementation");
        console.log("");
        console.log("Usage: noble-ble-proxy [options]");
        console.log("");
        console.log("Options:");
        console.log("  --server <url>   Matter server BLE proxy URL (default: ws://localhost:5580/ble)");
        console.log("  --hci-id <id>    Bluetooth adapter HCI ID (e.g., 0 for hci0)");
        console.log("  --help, -h       Show this help");
        process.exit(0);
    }
}

const client = new NobleBleProxyClient(serverUrl, hciId);

console.log(`Connecting to ${serverUrl}...`);
try {
    await client.connect();
    console.log("Connected. BLE proxy active. Press Ctrl+C to stop.");
} catch (err) {
    console.error(`Failed to connect: ${(err as Error).message}`);
    process.exit(1);
}

process.on("SIGINT", () => {
    console.log("\nShutting down...");
    client.close();
    process.exit(0);
});

process.on("SIGTERM", () => {
    client.close();
    process.exit(0);
});
