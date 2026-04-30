/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import process from "node:process";
// `node --experimental-strip-types` doesn't transform TS namespaces, so the example
// imports from the built artifacts. Run `npm run build -w @matter-server/thread-br` first.
import { OperationalDataset } from "../dist/esm/dataset/OperationalDataset.js";

function summarize(ds: OperationalDataset): Record<string, unknown> {
    const redacted = OperationalDataset.redact(ds);
    return {
        channel: redacted.channel,
        panId: redacted.panId === undefined ? undefined : `0x${redacted.panId.toString(16).padStart(4, "0")}`,
        extPanId: redacted.extPanId === undefined ? undefined : Bytes.toHex(redacted.extPanId),
        networkName: redacted.networkName,
        meshLocalPrefix: redacted.meshLocalPrefix === undefined ? undefined : Bytes.toHex(redacted.meshLocalPrefix),
        securityPolicy: redacted.securityPolicy,
        activeTimestamp: redacted.activeTimestamp === undefined ? undefined : Bytes.toHex(redacted.activeTimestamp),
        pendingTimestamp: redacted.pendingTimestamp === undefined ? undefined : Bytes.toHex(redacted.pendingTimestamp),
        delayTimer: redacted.delayTimer,
        channelMask: redacted.channelMask === undefined ? undefined : Bytes.toHex(redacted.channelMask),
        unknownTlvs: redacted.unknownTlvs.map(u => ({ type: u.type, valueHex: Bytes.toHex(u.value) })),
        pskc: redacted.pskc === undefined ? "<redacted>" : "<unexpected: not redacted>",
        networkKey: redacted.networkKey === undefined ? "<redacted>" : "<unexpected: not redacted>",
    };
}

function main(): void {
    const arg = process.argv[2];
    if (arg === undefined) {
        console.error("Usage: parse-dataset.ts <hex>");
        process.exit(2);
    }
    const blob = Bytes.of(Bytes.fromHex(arg.trim()));
    const ds = OperationalDataset.decode(blob);
    console.log(JSON.stringify(summarize(ds), null, 2));

    const reEncoded = OperationalDataset.encode(ds);
    const ok = reEncoded.length === blob.length && reEncoded.every((b, i) => b === blob[i]);
    console.log(`Round-trip identity: ${ok ? "ok" : "MISMATCH"}`);
    if (!ok) {
        console.error(`Original:   ${Bytes.toHex(blob)}`);
        console.error(`Re-encoded: ${Bytes.toHex(reEncoded)}`);
        process.exit(1);
    }
}

main();
