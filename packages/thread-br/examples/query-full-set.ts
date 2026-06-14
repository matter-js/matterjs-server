/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: npm run example -- examples/query-full-set.ts <host> <port> <pskHex> [windowMs]
// Example: npm run example -- examples/query-full-set.ts fd11::1 49191 74687265616400000000000000000000 20000
//
// Requires: npm run build -w @matter-server/thread-br

import { Bytes, Logger } from "@matter/main";
import process from "node:process";
import { CoapClient } from "../dist/esm/coap/CoapClient.js";
import { Commissioner } from "../dist/esm/commissioner/Commissioner.js";
import { DefaultTlvSet } from "../dist/esm/diagnostic/DefaultTlvSet.js";
import { MeshCopDiagnosticSource } from "../dist/esm/diagnostic/MeshCopDiagnosticSource.js";
import { createDtlsBackend } from "../dist/esm/dtls/socket/index.js";

const logger = Logger.get("query-full-set");

const [host, portStr, pskHex, windowMsStr] = process.argv.slice(2);
if (host === undefined || portStr === undefined || pskHex === undefined) {
    console.error("usage: query-full-set.ts <host> <port> <pskHex> [windowMs]");
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

const windowMs = windowMsStr !== undefined ? parseInt(windowMsStr, 10) : 20000;
if (!Number.isInteger(windowMs) || windowMs < 100) {
    console.error(`Invalid windowMs: ${windowMsStr}`);
    process.exit(1);
}

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
const source = new MeshCopDiagnosticSource(commissioner, coap);

logger.info(`Sending multicast diagnostic query (window: ${windowMs}ms)`);
const handle = source.queryMulticast("ff03::2", { tlvTypes: [...DefaultTlvSet], windowMs });
let count = 0;
handle.onNode.on(r => {
    count++;
    const rloc = r.rloc16 !== undefined ? `0x${r.rloc16.toString(16).padStart(4, "0")}` : "?";
    const mac = r.extMacAddress !== undefined ? Bytes.toHex(r.extMacAddress) : "?";
    const vendor = r.vendorName ?? "?";
    const model = r.vendorModel ?? "?";
    const sw = r.vendorSwVersion ?? "?";
    logger.info(`  rloc16=${rloc} mac=${mac} vendor=${vendor} model=${model} sw=${sw}`);
});
await handle.done;

await coap.close();
logger.info(`Done. Received ${count} response(s).`);
process.exit(0);
