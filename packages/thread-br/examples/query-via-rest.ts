/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Usage: npm run example -- examples/query-via-rest.ts <host> [port]
// Requires: npm run build -w @matter-server/thread-br

import { Bytes, Logger } from "@matter/main";
import process from "node:process";
import { OtbrRestClient, OtbrRestDiagnosticSource, OtbrRestProbe } from "../dist/esm/otbr-rest/index.js";

const logger = Logger.get("query-via-rest");

const [host, portStr] = process.argv.slice(2);
if (host === undefined) {
    console.error("usage: query-via-rest.ts <host> [port]");
    process.exit(1);
}

const port = portStr !== undefined ? parseInt(portStr, 10) : 8081;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${portStr}`);
    process.exit(1);
}

logger.info(`Probing ${host}:${port}...`);
const capability = await OtbrRestProbe.probe(host, port, 3000);
if (capability === null) {
    logger.warn("Not an OTBR REST endpoint (or unreachable).");
    process.exit(2);
}
logger.info(`Probed: keyFormat=${capability.keyFormat} network=${capability.networkName}`);

const client = new OtbrRestClient({ host, port });
const source = new OtbrRestDiagnosticSource(client, capability);
const responses = await source.queryMulticast("ff03::2", [], 0);

logger.info(`Received ${responses.length} response(s):`);
for (const r of responses) {
    const rloc = r.rloc16 !== undefined ? `0x${r.rloc16.toString(16).padStart(4, "0")}` : "?";
    const mac = r.extMacAddress !== undefined ? Bytes.toHex(r.extMacAddress) : "?";
    const childCount = r.childTable !== undefined ? r.childTable.length : 0;
    const ipv6Count = r.ipv6Addresses !== undefined ? r.ipv6Addresses.length : 0;
    logger.info(`  rloc16=${rloc} mac=${mac} children=${childCount} ipv6=${ipv6Count}`);
}
process.exit(0);
