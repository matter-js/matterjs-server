/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import process from "node:process";
// `node --experimental-strip-types` doesn't transform TS namespaces, so the example
// imports from the built artifacts. Run `npm run build -w @matter-server/thread-br` first.
import { OperationalDataset } from "../dist/esm/dataset/index.js";

function main(): void {
    const arg = process.argv[2];
    if (arg === undefined) {
        console.error("Usage: extract-pskc.ts <dataset-hex>");
        process.exit(2);
    }
    const blob = Bytes.of(Bytes.fromHex(arg.trim()));
    const ds = OperationalDataset.decode(blob);
    if (ds.pskc === undefined) {
        console.error("Dataset does not contain a PSKc TLV.");
        process.exit(1);
    }
    console.error("WARNING: PSKc is sensitive — do not commit / log / share.");
    console.log(Bytes.toHex(ds.pskc));
}

main();
