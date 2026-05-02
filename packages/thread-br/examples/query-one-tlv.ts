/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: npm run example -- examples/query-one-tlv.ts <host> <port> <pskHex> <rloc16>
// Example: npm run example -- examples/query-one-tlv.ts fd11::1 49191 74687265616400000000000000000000 0x0400
//
// Requires: npm run build -w @matter-server/thread-br

import { Bytes, Logger } from "@matter/main";
import process from "node:process";
import { CoapClient } from "../dist/esm/coap/CoapClient.js";
import { Commissioner } from "../dist/esm/commissioner/Commissioner.js";
import { MeshCopDiagnosticSource } from "../dist/esm/diagnostic/MeshCopDiagnosticSource.js";
import { createDtlsBackend } from "../dist/esm/dtls/socket/index.js";

const logger = Logger.get("query-one-tlv");

const [host, portStr, pskHex, rloc16Str] = process.argv.slice(2);
if (host === undefined || portStr === undefined || pskHex === undefined || rloc16Str === undefined) {
    console.error("usage: query-one-tlv.ts <host> <port> <pskHex> <rloc16>");
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

const rloc16 = rloc16Str.startsWith("0x") ? parseInt(rloc16Str, 16) : parseInt(rloc16Str, 10);
if (!Number.isInteger(rloc16) || rloc16 < 0 || rloc16 > 0xffff) {
    console.error(`Invalid rloc16: ${rloc16Str}`);
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

const response = await source.queryUnicast({ rloc16 }, [0]);

if (response.extMacAddress !== undefined) {
    logger.info(`EXT_MAC_ADDRESS: ${Bytes.toHex(response.extMacAddress)}`);
} else {
    logger.info("EXT_MAC_ADDRESS: (not returned)");
}

await coap.close();
logger.info("Done.");
process.exit(0);
