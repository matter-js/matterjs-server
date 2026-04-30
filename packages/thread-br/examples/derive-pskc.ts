/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import process from "node:process";
// `node --experimental-strip-types` doesn't transform TS namespaces, so the example
// imports from the built artifacts. Run `npm run build -w @matter-server/thread-br` first.
import { Pskc } from "../dist/esm/crypto/Pskc.js";

function main(): void {
    const [, , passphrase, extPanIdHex, networkName] = process.argv;
    if (passphrase === undefined || extPanIdHex === undefined || networkName === undefined) {
        console.error("Usage: derive-pskc.ts <passphrase> <extPanIdHex> <networkName>");
        process.exit(2);
    }
    const extPanId = Bytes.of(Bytes.fromHex(extPanIdHex.trim()));
    const pskc = Pskc.derive({ passphrase, extPanId, networkName });
    console.log(Bytes.toHex(pskc));
}

main();
