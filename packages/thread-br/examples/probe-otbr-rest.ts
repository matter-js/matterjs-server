/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: npm run example -- examples/probe-otbr-rest.ts <host> [port]
// Requires: npm run build -w @matter-server/thread-br

import { Bytes, Logger } from "@matter/main";
import process from "node:process";
import { OtbrRestProbe } from "../dist/esm/otbr-rest/index.js";

const logger = Logger.get("probe-otbr-rest");

const [host, portStr] = process.argv.slice(2);
if (host === undefined) {
    console.error("usage: probe-otbr-rest.ts <host> [port]");
    process.exit(1);
}

const port = portStr !== undefined ? parseInt(portStr, 10) : 8081;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${portStr}`);
    process.exit(1);
}

logger.info(`Probing ${host}:${port} for OTBR REST...`);
const capability = await OtbrRestProbe.probe(host, port, 3000);

if (capability === null) {
    logger.warn("Not an OTBR REST endpoint (or unreachable).");
    process.exit(2);
}

logger.info(`OTBR REST detected:`);
logger.info(`  baseUrl    : ${capability.baseUrl}`);
logger.info(`  keyFormat  : ${capability.keyFormat}`);
logger.info(`  networkName: ${capability.networkName}`);
logger.info(`  extPanId   : ${Bytes.toHex(capability.extPanId)}`);
logger.info(`  probedAt   : ${new Date(capability.probedAt).toISOString()}`);
process.exit(0);
