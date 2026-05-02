/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: npm run example -- examples/petition.ts <host> <port> <pskHex>
// Example: npm run example -- examples/petition.ts fd11::1 49191 74687265616400000000000000000000
//
// Requires: npm run build -w @matter-server/thread-br

import { Bytes } from "@matter/main";
import { Logger } from "@matter/main";
import process from "node:process";
import { CoapClient } from "../dist/esm/coap/CoapClient.js";
import { Commissioner } from "../dist/esm/commissioner/Commissioner.js";
import { createDtlsBackend } from "../dist/esm/dtls/socket/index.js";

const logger = Logger.get("petition");

const [host, portStr, pskHex] = process.argv.slice(2);
if (host === undefined || portStr === undefined || pskHex === undefined) {
    console.error("usage: petition.ts <host> <port> <pskHex>");
    process.exit(1);
}

const port = parseInt(portStr, 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${portStr}`);
    process.exit(1);
}

const trimmed = pskHex.trim();
if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    console.error(`PSK must be hex, got: ${pskHex}`);
    process.exit(1);
}
const password = Bytes.of(Bytes.fromHex(trimmed));

logger.info(`Connecting to ${host}:${port}`);
const backend = createDtlsBackend();
const socket = await backend.connect({
    address: host,
    port,
    password,
    type: host.includes(":") ? "udp6" : "udp4",
});
logger.info("DTLS handshake complete");

const coap = new CoapClient(socket);
const commissioner = new Commissioner(coap);

await commissioner.withSession(async sessionId => {
    logger.info(`Commissioner session ${sessionId} active. Waiting 5s for one KA tick...`);
    await new Promise<void>(r => setTimeout(r, 5_000));
    logger.info("Done.");
});

logger.info("Session released. Exiting.");
process.exit(0);
