/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is a manual usage helper to initially sniff WebSocket Messages from a normal chip-tool
 * test run in order to know request-response relations.
 *
 * It will generate a test_sniffer.log file in the directory it was executed from with the details.
 *
 * You need to manually set the path to the chip-tool to execute.
 */

import express from "express";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

function log(...args: unknown[]) {
    const m = new Date();
    console.log(
        `${m.getUTCFullYear()}/${m.getUTCMonth() + 1}/${m.getUTCDate()} ${m.getUTCHours()}:${m.getUTCMinutes()}:${m.getUTCSeconds()}:${m.getMilliseconds()}`,
        ...args,
    );
}

log("\n\n\nStart Controller App");
log(process.pid);
log(process.argv);

const extPort = 5580;
const ourPort = 100 + extPort;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", ws => {
    const client = new WebSocket(`ws://127.0.0.1:${extPort}/ws`);

    client.on("error", (...error) => {
        log("HAPMS-WebSocket error", error);
    });
    client.on("open", () => {
        log(`HAPMS-WebSocket connected on port ${extPort}`);
    });
    client.on("close", () => {
        log("HAPMS-WebSocket closed");
    });
    client.on("message", data => {
        const str = data.toString();
        log("HAPMS-received", str);
        ws.send(str);
    });

    ws.on("error", (...error) => {
        log("WS-Proxy error", error);
    });

    ws.on("message", data => {
        if (data) {
            const str = data.toString();
            log("WS-Proxy-received", str);
            client.send(str);
        } else {
            log("TEST-received-EMPTY", data);
        }
    });
});

server.listen({ host: "127.0.0.1", port: ourPort }, () => {
    console.log(`Listening on http://localhost:${ourPort}`);
});
