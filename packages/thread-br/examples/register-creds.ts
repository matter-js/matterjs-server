/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import process from "node:process";
// `node --experimental-strip-types` doesn't transform TS namespaces, so the example
// imports from the built artifacts. Run `npm run build -w @matter-server/thread-br` first.
import { ThreadCredentialsRegistry } from "../dist/esm/credentials/ThreadCredentialsRegistry.js";
import { OperationalDataset } from "../dist/esm/dataset/OperationalDataset.js";

function summarize(registry: ThreadCredentialsRegistry): unknown {
    return registry.list().map(c => ({
        extPanIdHex: Bytes.toHex(c.extPanId).toUpperCase(),
        networkName: c.networkName,
        pskcLength: c.pskc.length,
        activeTimestamp: c.activeTimestamp === undefined ? undefined : c.activeTimestamp.toString(),
    }));
}

function main(): void {
    const arg = process.argv[2];
    if (arg === undefined) {
        console.error("Usage: register-creds.ts <hexDataset>");
        process.exit(2);
    }
    const blob = Bytes.of(Bytes.fromHex(arg.trim()));
    const ds = OperationalDataset.decode(blob);
    const registry = new ThreadCredentialsRegistry();
    registry.register(ds);
    console.log(JSON.stringify(summarize(registry), null, 2));
}

main();
