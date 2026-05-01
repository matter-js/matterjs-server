/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import process from "node:process";
// `node --experimental-strip-types` doesn't transform TS namespaces, so the example
// imports from the built artifacts. Run `npm run build -w @matter-server/thread-br` first.
import { createDtlsBackend } from "../dist/esm/dtls/socket/index.js";

async function main(): Promise<void> {
    const [addr, portStr, pskcHex] = process.argv.slice(2);
    if (addr === undefined || portStr === undefined || pskcHex === undefined) {
        console.error("Usage: handshake-dtls.ts <addr> <port> <pskc-hex>");
        process.exit(2);
    }

    const port = Number(portStr);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: ${portStr}`);
        process.exit(2);
    }

    const trimmed = pskcHex.trim();
    if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
        console.error(`PSKc must be hex, got: ${pskcHex}`);
        process.exit(2);
    }
    const password = Bytes.of(Bytes.fromHex(trimmed));
    if (password.length !== 16) {
        console.error(`PSKc must be 16 bytes (32 hex chars), got ${password.length} bytes`);
        process.exit(2);
    }

    const backend = createDtlsBackend();
    const t0 = Date.now();
    try {
        const socket = await backend.connect({
            address: addr,
            port,
            password,
            type: addr.includes(":") ? "udp6" : "udp4",
            connectTimeoutMs: 30_000,
        });
        const dt = Date.now() - t0;
        console.log(`DTLS handshake established in ${dt}ms.`);
        await socket.close();
        process.exit(0);
    } catch (e) {
        const dt = Date.now() - t0;
        const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        console.error(`DTLS handshake failed after ${dt}ms — ${err}`);
        process.exit(1);
    }
}

void main();
