/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Bytes } from "@matter/general";
import type {
    FabricIndexList,
    FabricMetadata,
    GroupKeySet,
    LastKnownGoodTime,
    SessionResumptionDetails,
    SessionResumptionEntry,
    SessionResumptionIndex,
} from "./TlvSchemas.js";

/**
 * Base interface for decoded TLV data entries.
 * Contains both raw bytes and original base64 for round-trip preservation.
 */
export interface DecodedEntry {
    /** Decoded binary data from base64 */
    raw: Bytes;
    /** Original base64 string for re-serialization */
    base64: string;
}

/**
 * Decoded entry with typed TLV data.
 */
export interface DecodedEntryWithTlv<T> extends DecodedEntry {
    /** Decoded TLV structure */
    decoded?: T;
}

/**
 * Fabric-specific certificate and key data.
 * Keys: f/<fabricIndex>/n, f/<fabricIndex>/i, f/<fabricIndex>/r, f/<fabricIndex>/m, f/<fabricIndex>/k/<keyIndex>
 */
export interface FabricData {
    /** Fabric index (1, 2, etc.) */
    index: number;
    /** NOC - Node Operational Certificate (f/<idx>/n) */
    noc?: DecodedEntry;
    /** ICAC - Intermediate CA Certificate (f/<idx>/i) */
    icac?: DecodedEntry;
    /** RCAC - Root CA Certificate (f/<idx>/r) */
    rcac?: DecodedEntry;
    /** Fabric metadata raw entry (f/<idx>/m) */
    metadata?: DecodedEntry;
    /** Decoded fabric metadata with vendorId and label */
    metadataDecoded?: FabricMetadata;
    /** Group key sets indexed by key index (f/<idx>/k/<keyIdx>) - includes IPK at index 0 */
    keys: Map<number, DecodedEntry>;
    /** Decoded group key sets indexed by key index */
    keysDecoded: Map<number, GroupKeySet>;
    /** Fabric-specific session data (f/<idx>/s/<nodeHex>) - session resumption details */
    sessions: Map<string, DecodedEntry>;
    /** Decoded fabric session details */
    sessionsDecoded: Map<string, SessionResumptionDetails>;
    /** Global session resumption entries for this fabric (g/s/<resumptionId>) - keyed by resumptionId */
    resumptions: Map<string, DecodedEntry>;
    /** Decoded global session resumption entries for this fabric */
    resumptionsDecoded: Map<string, SessionResumptionEntry>;
    /** Other fabric-specific data not explicitly categorized (f/<idx>/g, etc.) */
    other: Map<string, DecodedEntry>;
}

/**
 * Global session resumption index data.
 * Note: Individual session entries (g/s/*) are stored in their respective FabricData.resumptions
 */
export interface SessionData {
    /** Session resumption index raw (g/sri) - array of {fabricIndex, peerNodeId} entries */
    resumptionIndex?: DecodedEntry;
    /** Decoded session resumption index */
    resumptionIndexDecoded?: SessionResumptionIndex;
}

/**
 * Global configuration data.
 */
export interface GlobalData {
    /** Fabric index list raw (g/fidx) */
    fabricIndexList?: DecodedEntry;
    /** Decoded fabric index list */
    fabricIndexListDecoded?: FabricIndexList;
    /** Last known good time raw (g/lkgt) */
    lastKnownGoodTime?: DecodedEntry;
    /** Decoded last known good time */
    lastKnownGoodTimeDecoded?: LastKnownGoodTime;
}

/**
 * Operational credentials data from ExampleOpCreds* keys.
 * These are the CA/ICA certificates and private keys used for signing NOCs.
 *
 * Keys in chip.json:
 * - ExampleOpCredsCAKey<N>: Root CA private key (DER format)
 * - ExampleCARootCert<N>: Root CA certificate (Matter TLV format)
 * - ExampleOpCredsICAKey<N>: Intermediate CA private key (DER format)
 * - ExampleICACert<N>: Intermediate CA certificate (Matter TLV format)
 *
 * Where N is an index (1, 2, etc.) corresponding to a credential set.
 */
export interface OperationalCredentials {
    /** Root CA private key (ExampleOpCredsCAKey<N>) - DER encoded */
    rootCaKey?: DecodedEntry;
    /** Root CA certificate (ExampleCARootCert<N>) - Matter TLV format */
    rootCaCert?: DecodedEntry;
    /** Intermediate CA private key (ExampleOpCredsICAKey<N>) - DER encoded */
    icaKey?: DecodedEntry;
    /** Intermediate CA certificate (ExampleICACert<N>) - Matter TLV format */
    icaCert?: DecodedEntry;
}

/**
 * Raw chip.json file structure.
 */
export interface ChipConfigFile {
    "sdk-config": Record<string, string>;
    "repl-config"?: Record<string, unknown>;
}
