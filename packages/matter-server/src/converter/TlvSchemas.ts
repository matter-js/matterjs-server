/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    TlvArray,
    TlvByteString,
    TlvField,
    TlvObject,
    TlvString,
    TlvUInt16,
    TlvUInt32,
    TlvUInt64,
    TlvUInt8,
    TypeFromSchema,
} from "@matter/main/types";

/**
 * TLV Schema definitions for chip.json data structures.
 *
 * These schemas define the binary TLV format used by Matter.js for storing
 * fabric configuration, session data, and another persistent state.
 */

// =============================================================================
// Global Keys (g/)
// =============================================================================

/**
 * Fabric Index List structure.
 *
 * Key: g/fidx
 *
 * Example hex: 15240002360104011818
 * Structure {
 *   0/0x0 => UnsignedInt( nextFabricIndex )
 *   1/0x1 => Array { UnsignedInt( fabricIndex )... }
 * }
 */
export const TlvFabricIndexList = TlvObject({
    nextFabricIndex: TlvField(0, TlvUInt8),
    fabricIndices: TlvField(1, TlvArray(TlvUInt8)),
});

export type FabricIndexList = TypeFromSchema<typeof TlvFabricIndexList>;

/**
 * Last Known Good Time structure.
 *
 * Key: g/lkgt
 *
 * Example hex: 15260080a8bc2c18
 * Structure {
 *   0/0x0 => UnsignedInt( epochSeconds )
 * }
 */
export const TlvLastKnownGoodTime = TlvObject({
    epochSeconds: TlvField(0, TlvUInt32),
});

export type LastKnownGoodTime = TypeFromSchema<typeof TlvLastKnownGoodTime>;

/**
 * Session Resumption Entry structure.
 *
 * Used within the session resumption index array.
 *
 * Structure {
 *   1/0x1 => UnsignedInt( fabricIndex )
 *   2/0x2 => UnsignedInt( peerNodeId )
 * }
 */
export const TlvSessionResumptionEntry = TlvObject({
    fabricIndex: TlvField(1, TlvUInt8),
    peerNodeId: TlvField(2, TlvUInt64),
});

export type SessionResumptionEntry = TypeFromSchema<typeof TlvSessionResumptionEntry>;

/**
 * Session Resumption Index - Array of session entries.
 *
 * Key: g/sri
 *
 * Array of TlvSessionResumptionEntry structures.
 */
export const TlvSessionResumptionIndex = TlvArray(TlvSessionResumptionEntry);

export type SessionResumptionIndex = TypeFromSchema<typeof TlvSessionResumptionIndex>;

/**
 * Session Resumption Details structure.
 *
 * Key: g/s/<base64NodeId>
 *
 * Structure {
 *   3/0x3 => ByteString( resumptionId ) - 16 bytes
 *   4/0x4 => ByteString( sharedSecret ) - 32 bytes
 *   5/0x5 => ByteString( cat ) - 12 bytes (always zeros when no CATs used)
 * }
 */
export const TlvSessionResumptionDetails = TlvObject({
    resumptionId: TlvField(3, TlvByteString.bound({ length: 16 })),
    sharedSecret: TlvField(4, TlvByteString.bound({ length: 32 })),
    cat: TlvField(5, TlvByteString.bound({ length: 12 })),
});

export type SessionResumptionDetails = TypeFromSchema<typeof TlvSessionResumptionDetails>;

// =============================================================================
// Fabric Keys (f/<fabricIndex>/)
// =============================================================================

/**
 * Fabric metadata structure.
 *
 * Key: f/<fabricIndex>/m
 *
 * Example hex: 1525004b132c010018
 * Structure {
 *   0/0x0 => UnsignedInt( vendorId )
 *   1/0x1 => Utf8String( label )
 * }
 */
export const TlvFabricMetadata = TlvObject({
    vendorId: TlvField(0, TlvUInt16),
    label: TlvField(1, TlvString),
});

export type FabricMetadata = TypeFromSchema<typeof TlvFabricMetadata>;

/**
 * Group Key Entry structure.
 *
 * Used within the group key set array.
 *
 * Structure {
 *   4/0x4 => UnsignedInt( startTime )
 *   5/0x5 => UnsignedInt( keyHash )
 *   6/0x6 => ByteString( key ) - 16 bytes
 * }
 */
export const TlvGroupKeyEntry = TlvObject({
    startTime: TlvField(4, TlvUInt64),
    keyHash: TlvField(5, TlvUInt16),
    key: TlvField(6, TlvByteString.bound({ length: 16 })),
});

export type GroupKeyEntry = TypeFromSchema<typeof TlvGroupKeyEntry>;

/**
 * Group Key Set structure (includes IPK at index 0).
 *
 * Key: f/<fabricIndex>/k/<keySetIndex>
 *
 * Structure {
 *   1/0x1 => UnsignedInt( policy )
 *   2/0x2 => UnsignedInt( keyCount )
 *   3/0x3 => Array { GroupKeyEntry... }
 *   7/0x7 => UnsignedInt( groupKeySetId )
 * }
 */
export const TlvGroupKeySet = TlvObject({
    policy: TlvField(1, TlvUInt8),
    keyCount: TlvField(2, TlvUInt8),
    keys: TlvField(3, TlvArray(TlvGroupKeyEntry)),
    groupKeySetId: TlvField(7, TlvUInt16),
});

export type GroupKeySet = TypeFromSchema<typeof TlvGroupKeySet>;
