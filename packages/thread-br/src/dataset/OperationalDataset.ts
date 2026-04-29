/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type BasicTlvEntry, BasicTlv } from "../tlv/BasicTlvCodec.js";
import { MeshCopTlvType } from "./meshcopTlvTypes.js";
import { SecurityPolicy } from "./SecurityPolicy.js";

/**
 * Decoded Thread Operational Dataset.
 *
 * Each named accessor mirrors a MeshCoP TLV defined in {@link MeshCopTlvType}.
 * Unknown TLVs survive a decode/encode round-trip via {@link unknownTlvs}.
 *
 * `_originalTlvs` lets {@link OperationalDataset.encode} reproduce the source
 * bytes verbatim when no field has been mutated — preserving non-canonical
 * encodings (legacy 1-byte CHANNEL forms, vendor-specific orderings) emitted
 * by real Border Routers.
 */
export interface OperationalDataset {
    channel?: number;
    panId?: number;
    extPanId?: Uint8Array;
    networkName?: string;
    pskc?: Uint8Array;
    networkKey?: Uint8Array;
    meshLocalPrefix?: Uint8Array;
    securityPolicy?: SecurityPolicy;
    activeTimestamp?: Uint8Array;
    pendingTimestamp?: Uint8Array;
    delayTimer?: number;
    channelMask?: Uint8Array;
    unknownTlvs: Array<{ type: number; value: Uint8Array }>;
    raw: Uint8Array;
    /** @internal */
    _originalTlvs?: ReadonlyArray<BasicTlvEntry>;
}

export namespace OperationalDataset {
    export function decode(blob: Uint8Array): OperationalDataset {
        const entries = BasicTlv.walk(blob);
        const unknownTlvs = new Array<{ type: number; value: Uint8Array }>();
        const ds: OperationalDataset = {
            unknownTlvs,
            raw: blob.slice(),
            _originalTlvs: entries.map(e => ({ type: e.type, value: e.value.slice() })),
        };

        for (const entry of entries) {
            switch (entry.type) {
                case MeshCopTlvType.CHANNEL:
                    ds.channel = decodeChannel(entry.value);
                    break;
                case MeshCopTlvType.PANID:
                    if (entry.value.length !== 2) {
                        throw new Error(`PANID TLV must be 2 bytes, got ${entry.value.length}`);
                    }
                    ds.panId = (entry.value[0] << 8) | entry.value[1];
                    break;
                case MeshCopTlvType.EXTPANID:
                    if (entry.value.length !== 8) {
                        throw new Error(`EXTPANID TLV must be 8 bytes, got ${entry.value.length}`);
                    }
                    ds.extPanId = entry.value.slice();
                    break;
                case MeshCopTlvType.NETWORK_NAME:
                    ds.networkName = new TextDecoder("utf-8").decode(entry.value);
                    break;
                case MeshCopTlvType.PSKC:
                    ds.pskc = entry.value.slice();
                    break;
                case MeshCopTlvType.NETWORK_KEY:
                    if (entry.value.length !== 16) {
                        throw new Error(`NETWORK_KEY TLV must be 16 bytes, got ${entry.value.length}`);
                    }
                    ds.networkKey = entry.value.slice();
                    break;
                case MeshCopTlvType.MESH_LOCAL_PREFIX:
                    if (entry.value.length !== 8) {
                        throw new Error(`MESH_LOCAL_PREFIX TLV must be 8 bytes, got ${entry.value.length}`);
                    }
                    ds.meshLocalPrefix = entry.value.slice();
                    break;
                case MeshCopTlvType.SECURITY_POLICY:
                    ds.securityPolicy = SecurityPolicy.decode(entry.value);
                    break;
                case MeshCopTlvType.ACTIVE_TIMESTAMP:
                    if (entry.value.length !== 8) {
                        throw new Error(`ACTIVE_TIMESTAMP TLV must be 8 bytes, got ${entry.value.length}`);
                    }
                    ds.activeTimestamp = entry.value.slice();
                    break;
                case MeshCopTlvType.PENDING_TIMESTAMP:
                    if (entry.value.length !== 8) {
                        throw new Error(`PENDING_TIMESTAMP TLV must be 8 bytes, got ${entry.value.length}`);
                    }
                    ds.pendingTimestamp = entry.value.slice();
                    break;
                case MeshCopTlvType.DELAY_TIMER:
                    if (entry.value.length !== 4) {
                        throw new Error(`DELAY_TIMER TLV must be 4 bytes, got ${entry.value.length}`);
                    }
                    ds.delayTimer =
                        (entry.value[0] << 24) | (entry.value[1] << 16) | (entry.value[2] << 8) | entry.value[3];
                    break;
                case MeshCopTlvType.CHANNEL_MASK:
                    ds.channelMask = entry.value.slice();
                    break;
                default:
                    unknownTlvs.push({ type: entry.type, value: entry.value.slice() });
                    break;
            }
        }

        return ds;
    }

    export function redact(ds: OperationalDataset): OperationalDataset {
        return { ...ds, pskc: undefined, networkKey: undefined };
    }
}

/**
 * Real-world OpenThread datasets sometimes encode CHANNEL as a single byte
 * (the channel number directly) instead of the spec-conformant 3-byte form
 * (channel-page:1 + channel:2). Both forms are accepted on decode.
 */
function decodeChannel(value: Uint8Array): number {
    if (value.length === 1) {
        return value[0];
    }
    if (value.length === 3) {
        return (value[1] << 8) | value[2];
    }
    throw new Error(`CHANNEL TLV must be 1 or 3 bytes, got ${value.length}`);
}
