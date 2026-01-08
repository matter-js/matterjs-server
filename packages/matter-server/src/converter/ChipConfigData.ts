/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { LegacyFabricConfigData } from "@matter-server/ws-controller";
import { Bytes, Key, StandardCrypto, type BinaryKeyPair } from "@matter/main";
import { CertificateAuthority, Icac, Noc, Rcac } from "@matter/main/protocol";
import { readFile, writeFile } from "node:fs/promises";
import {
    TlvFabricIndexList,
    TlvFabricMetadata,
    TlvGroupKeySet,
    TlvLastKnownGoodTime,
    TlvSessionResumptionDetails,
    TlvSessionResumptionEntry,
    TlvSessionResumptionIndex,
} from "./TlvSchemas.js";
import type {
    ChipConfigFile,
    DecodedEntry,
    FabricData,
    GlobalData,
    OperationalCredentials,
    SessionData,
} from "./types.js";

/** Result of certificate chain verification */
export interface CertificateVerificationResult {
    valid: boolean;
    rcacValid?: boolean;
    icacValid?: boolean;
    nocValid?: boolean;
    error?: string;
}

const CHIP_DEFAULT_IPK = Bytes.fromHex("74656d706f726172792069706b203031"); // "temporary ipk 01"

/**
 * Manages chip.json configuration data with categorized access to fabrics,
 * sessions, globals, and generic entries.
 *
 * Decodes base64 TLV data for access while preserving original encoding
 * for round-trip serialization.
 */
export class ChipConfigData {
    /** Fabric-specific data keyed by fabric index */
    readonly fabrics = new Map<number, FabricData>();

    /** Global session resumption index */
    readonly sessions: SessionData = {};

    /** Global configuration data */
    readonly globals: GlobalData = {};

    /** Ignored keys (failsafe markers, counters, ICD) - stored as original base64 */
    readonly ignored = new Map<string, string>();

    /** Generic/unknown keys - stored as original base64 */
    readonly generic = new Map<string, string>();

    /** Operational credentials (CA/ICA certs and keys) indexed by credential set number */
    readonly operationalCredentials = new Map<number, OperationalCredentials>();

    /** The repl-config section preserved as-is */
    replConfig: Record<string, unknown> = {};

    /** Keys that should be ignored (stored but not parsed) */
    private static readonly IGNORED_KEY_PATTERNS = [
        /^g\/fs\/[cn]$/, // Failsafe markers: g/fs/c, g/fs/n
        /^g\/gdc$/, // Global group counter (not TLV)
        /^g\/gcc$/, // Global group counter (not TLV)
        /^g\/gfl$/, // Group to endpoint mapping
        /^g\/icdfl$/, // ICD stuff
    ];

    /**
     * Decode a base64 string to a DecodedEntry with both raw bytes and original base64.
     */
    private static decodeEntry(base64: string): DecodedEntry {
        const buffer = Buffer.from(base64, "base64");
        return {
            raw: new Uint8Array(buffer),
            base64,
        };
    }

    /**
     * Check if a key should be ignored (stored but not parsed).
     */
    private static isIgnoredKey(key: string): boolean {
        return this.IGNORED_KEY_PATTERNS.some(pattern => pattern.test(key));
    }

    /** Patterns for operational credentials keys */
    private static readonly OP_CREDS_PATTERNS = {
        rootCaKey: /^ExampleOpCredsCAKey(\d+)$/,
        rootCaCert: /^ExampleCARootCert(\d+)$/,
        icaKey: /^ExampleOpCredsICAKey(\d+)$/,
        icaCert: /^ExampleCAIntermediateCert(\d+)$/,
    };

    /**
     * Get or create an OperationalCredentials entry for the given index.
     */
    private getOrCreateOpCreds(index: number): OperationalCredentials {
        let creds = this.operationalCredentials.get(index);
        if (!creds) {
            creds = {};
            this.operationalCredentials.set(index, creds);
        }
        return creds;
    }

    /**
     * Check if a key is an operational credentials key and parse it if so.
     * Returns true if the key was handled.
     */
    private parseOperationalCredentialsKey(key: string, value: string): boolean {
        for (const [field, pattern] of Object.entries(ChipConfigData.OP_CREDS_PATTERNS)) {
            const match = key.match(pattern);
            if (match) {
                const index = parseInt(match[1], 10);
                const creds = this.getOrCreateOpCreds(index);
                const entry = ChipConfigData.decodeEntry(value);
                creds[field as keyof OperationalCredentials] = entry;
                return true;
            }
        }
        return false;
    }

    /**
     * Get or create a FabricData entry for the given fabric index.
     */
    private getOrCreateFabric(index: number): FabricData {
        let fabric = this.fabrics.get(index);
        if (!fabric) {
            fabric = {
                index,
                keys: new Map(),
                keysDecoded: new Map(),
                sessions: new Map(),
                sessionsDecoded: new Map(),
                resumptions: new Map(),
                resumptionsDecoded: new Map(),
                other: new Map(),
            };
            this.fabrics.set(index, fabric);
        }
        return fabric;
    }

    /**
     * Parse a fabric-specific key and store the data.
     * Format: f/<fabricIndex>/<subkey>[/<subsubkey>]
     */
    private parseFabricKey(key: string, value: string): void {
        const match = key.match(/^f\/([0-9a-fA-F]+)\/(.+)$/);
        if (!match) return;

        const fabricIndex = parseInt(match[1], 16);
        const subKey = match[2];
        const fabric = this.getOrCreateFabric(fabricIndex);
        const entry = ChipConfigData.decodeEntry(value);

        if (subKey === "n") {
            fabric.noc = entry;
        } else if (subKey === "i") {
            fabric.icac = entry;
        } else if (subKey === "r") {
            fabric.rcac = entry;
        } else if (subKey === "m") {
            fabric.metadata = entry;
            // Decode the TLV metadata structure
            try {
                fabric.metadataDecoded = TlvFabricMetadata.decode(entry.raw);
            } catch {
                // Keep metadataDecoded undefined if decoding fails
            }
        } else if (subKey.startsWith("k/")) {
            const keyIndex = parseInt(subKey.slice(2), 10);
            fabric.keys.set(keyIndex, entry);
            // Decode the TLV group key set structure
            try {
                fabric.keysDecoded.set(keyIndex, TlvGroupKeySet.decode(entry.raw));
            } catch {
                // Keep decoded undefined if decoding fails
            }
        } else if (subKey.startsWith("s/")) {
            const nodeHex = subKey.slice(2);
            fabric.sessions.set(nodeHex, entry);
            // Decode the TLV session resumption details structure
            try {
                fabric.sessionsDecoded.set(nodeHex, TlvSessionResumptionDetails.decode(entry.raw));
            } catch {
                // Keep decoded undefined if decoding fails
            }
        } else {
            fabric.other.set(subKey, entry);
        }
    }

    /**
     * Parse a global key and store the data.
     */
    private parseGlobalKey(key: string, value: string): void {
        const entry = ChipConfigData.decodeEntry(value);

        if (key === "g/fidx") {
            this.globals.fabricIndexList = entry;
            // Decode the TLV fabric index list structure
            try {
                this.globals.fabricIndexListDecoded = TlvFabricIndexList.decode(entry.raw);
            } catch {
                // Keep decoded undefined if decoding fails
            }
        } else if (key === "g/lkgt") {
            this.globals.lastKnownGoodTime = entry;
            // Decode the TLV last known good time structure
            try {
                this.globals.lastKnownGoodTimeDecoded = TlvLastKnownGoodTime.decode(entry.raw);
            } catch {
                // Keep decoded undefined if decoding fails
            }
        } else if (key === "g/sri") {
            this.sessions.resumptionIndex = entry;
            // Decode the TLV session resumption index array
            try {
                this.sessions.resumptionIndexDecoded = TlvSessionResumptionIndex.decode(entry.raw);
            } catch {
                // Keep decoded undefined if decoding fails
            }
        } else if (key.startsWith("g/s/")) {
            // Session resumption entries (g/s/<resumptionId>) are stored in the fabric they belong to
            const resumptionId = key.slice(4);
            try {
                const decoded = TlvSessionResumptionEntry.decode(entry.raw);
                const fabric = this.getOrCreateFabric(decoded.fabricIndex);
                fabric.resumptions.set(resumptionId, entry);
                fabric.resumptionsDecoded.set(resumptionId, decoded);
            } catch {
                // If decoding fails, we can't determine the fabric - store in generic
                this.generic.set(key, value);
            }
        }
    }

    /**
     * Load and parse a chip.json file.
     */
    async load(filePath: string): Promise<void> {
        const content = await readFile(filePath, "utf-8");
        const data: ChipConfigFile = JSON.parse(content);

        // Clear existing data
        this.fabrics.clear();
        this.sessions.resumptionIndex = undefined;
        this.sessions.resumptionIndexDecoded = undefined;
        this.globals.fabricIndexList = undefined;
        this.globals.fabricIndexListDecoded = undefined;
        this.globals.lastKnownGoodTime = undefined;
        this.globals.lastKnownGoodTimeDecoded = undefined;
        this.ignored.clear();
        this.generic.clear();
        this.operationalCredentials.clear();

        // Store repl-config as-is
        this.replConfig = data["repl-config"] ?? {};

        // Parse sdk-config entries
        const sdkConfig = data["sdk-config"] ?? {};
        for (const [key, value] of Object.entries(sdkConfig)) {
            if (ChipConfigData.isIgnoredKey(key)) {
                this.ignored.set(key, value);
            } else if (key.startsWith("f/")) {
                this.parseFabricKey(key, value);
            } else if (key.startsWith("g/")) {
                this.parseGlobalKey(key, value);
            } else if (this.parseOperationalCredentialsKey(key, value)) {
                // Handled by parseOperationalCredentialsKey
            } else {
                // Generic/unknown key - store as-is
                this.generic.set(key, value);
            }
        }
    }

    /**
     * Serialize and save the data back to a chip.json file.
     */
    async save(filePath: string): Promise<void> {
        const sdkConfig: Record<string, string> = {};

        // Add global data
        if (this.globals.fabricIndexList) {
            sdkConfig["g/fidx"] = this.globals.fabricIndexList.base64;
        }
        if (this.globals.lastKnownGoodTime) {
            sdkConfig["g/lkgt"] = this.globals.lastKnownGoodTime.base64;
        }

        // Add session resumption index
        if (this.sessions.resumptionIndex) {
            sdkConfig["g/sri"] = this.sessions.resumptionIndex.base64;
        }

        // Add fabric data
        for (const [fabricIndex, fabric] of this.fabrics) {
            const prefix = `f/${fabricIndex}`;

            if (fabric.noc) {
                sdkConfig[`${prefix}/n`] = fabric.noc.base64;
            }
            if (fabric.icac) {
                sdkConfig[`${prefix}/i`] = fabric.icac.base64;
            }
            if (fabric.rcac) {
                sdkConfig[`${prefix}/r`] = fabric.rcac.base64;
            }
            if (fabric.metadata) {
                sdkConfig[`${prefix}/m`] = fabric.metadata.base64;
            }

            for (const [keyIndex, entry] of fabric.keys) {
                sdkConfig[`${prefix}/k/${keyIndex}`] = entry.base64;
            }

            for (const [nodeHex, entry] of fabric.sessions) {
                sdkConfig[`${prefix}/s/${nodeHex}`] = entry.base64;
            }

            // Add global session resumption entries for this fabric (g/s/<resumptionId>)
            for (const [resumptionId, entry] of fabric.resumptions) {
                sdkConfig[`g/s/${resumptionId}`] = entry.base64;
            }

            for (const [subKey, entry] of fabric.other) {
                sdkConfig[`${prefix}/${subKey}`] = entry.base64;
            }
        }

        // Add ignored keys
        for (const [key, value] of this.ignored) {
            sdkConfig[key] = value;
        }

        // Add operational credentials
        for (const [index, creds] of this.operationalCredentials) {
            if (creds.rootCaKey) {
                sdkConfig[`ExampleOpCredsCAKey${index}`] = creds.rootCaKey.base64;
            }
            if (creds.rootCaCert) {
                sdkConfig[`ExampleCARootCert${index}`] = creds.rootCaCert.base64;
            }
            if (creds.icaKey) {
                sdkConfig[`ExampleOpCredsICAKey${index}`] = creds.icaKey.base64;
            }
            if (creds.icaCert) {
                sdkConfig[`ExampleCAIntermediateCert${index}`] = creds.icaCert.base64;
            }
        }

        // Add generic keys
        for (const [key, value] of this.generic) {
            sdkConfig[key] = value;
        }

        const output: ChipConfigFile = {
            "sdk-config": sdkConfig,
        };

        if (Object.keys(this.replConfig).length > 0) {
            output["repl-config"] = this.replConfig;
        }

        await writeFile(filePath, JSON.stringify(output, null, 4), "utf-8");
    }

    /**
     * Get a list of all fabric indices.
     */
    getFabricIndices(): number[] {
        return Array.from(this.fabrics.keys()).sort((a, b) => a - b);
    }

    /**
     * Get fabric data by index.
     */
    getFabric(index: number): FabricData | undefined {
        return this.fabrics.get(index);
    }

    /**
     * Get operational credentials by index.
     */
    getOperationalCredentials(index: number): OperationalCredentials | undefined {
        return this.operationalCredentials.get(index);
    }

    /**
     * Get a list of all operational credentials indices.
     */
    getOperationalCredentialsIndices(): number[] {
        return Array.from(this.operationalCredentials.keys()).sort((a, b) => a - b);
    }

    /**
     * Convert OperationalCredentials to CertificateAuthority.Configuration.
     *
     * This parses the DER-encoded private keys and Matter TLV certificates to produce
     * a configuration that can be used to create a CertificateAuthority instance.
     *
     * The private keys in chip.json are stored in SEC1 DER format.
     * The certificates are stored in Matter TLV format.
     *
     * @param index The operational credentials index (typically 1)
     * @param nextCertificateId Optional starting certificate ID (defaults to 2)
     * @returns CertificateAuthority.Configuration or undefined if credentials are incomplete
     */
    async getCertificateAuthorityConfig(
        index: number,
        nextCertificateId?: bigint,
    ): Promise<CertificateAuthority.Configuration | undefined> {
        const creds = this.operationalCredentials.get(index);
        if (!creds) {
            return undefined;
        }

        // Need at least root CA key and cert
        if (!creds.rootCaKey || !creds.rootCaCert) {
            return undefined;
        }

        try {
            // Parse root CA certificate - detect format by first byte
            // 0x30 = ASN.1/DER sequence tag, 0x15 = Matter TLV structure tag
            const certBytes = Bytes.of(creds.rootCaCert.raw);
            const rcac = certBytes[0] === 0x30 ? Rcac.fromAsn1(certBytes) : Rcac.fromTlv(certBytes);
            const rootCertId = rcac.cert.subject.rcacId;
            if (rootCertId === undefined) {
                return undefined;
            }

            // Parse root CA private key
            // The key can be in different formats:
            // - SEC1 DER encoded (starts with 0x30)
            // - Raw format: uncompressed public key (65 bytes starting with 0x04) + private key (32 bytes) = 97 bytes
            const keyBytes = Bytes.of(creds.rootCaKey.raw);
            let rootKeyPair: BinaryKeyPair;

            if (keyBytes[0] === 0x30) {
                // SEC1 DER format
                const rootKey = Key({ sec1: keyBytes });
                rootKeyPair = {
                    publicKey: Bytes.of(rootKey.publicBits!),
                    privateKey: Bytes.of(rootKey.privateBits!),
                };
            } else if (keyBytes.length === 97 && keyBytes[0] === 0x04) {
                // Raw format: 65-byte uncompressed public key + 32-byte private key
                rootKeyPair = {
                    publicKey: keyBytes.slice(0, 65),
                    privateKey: keyBytes.slice(65),
                };
            } else {
                // Unknown format
                return undefined;
            }

            // Compute root key identifier (first 20 bytes of public key hash)
            const rootKeyIdentifier = rcac.cert.extensions.subjectKeyIdentifier;

            // Get the certificate bytes in TLV format for storage
            const rootCertTlvBytes = Bytes.of(rcac.asSignedTlv());

            // Build base configuration
            let config: CertificateAuthority.Configuration = {
                rootCertId: BigInt(rootCertId),
                rootKeyPair,
                rootKeyIdentifier,
                rootCertBytes: rootCertTlvBytes,
                nextCertificateId: nextCertificateId ?? BigInt(rootCertId) + BigInt(1),
            };

            // If we have ICAC credentials, add them
            if (creds.icaKey && creds.icaCert) {
                // Parse ICAC certificate - detect format by first byte
                const icacCertBytes = Bytes.of(creds.icaCert.raw);
                const icac = icacCertBytes[0] === 0x30 ? Icac.fromAsn1(icacCertBytes) : Icac.fromTlv(icacCertBytes);
                const icacCertId = icac.cert.subject.icacId;
                if (icacCertId === undefined) {
                    return undefined;
                }

                // Parse ICAC private key
                const icaKeyBytes = Bytes.of(creds.icaKey.raw);
                let icacKeyPair: BinaryKeyPair;

                if (icaKeyBytes[0] === 0x30) {
                    // SEC1 DER format
                    const icaKey = Key({ sec1: icaKeyBytes });
                    icacKeyPair = {
                        publicKey: Bytes.of(icaKey.publicBits!),
                        privateKey: Bytes.of(icaKey.privateBits!),
                    };
                } else if (icaKeyBytes.length === 97 && icaKeyBytes[0] === 0x04) {
                    // Raw format
                    icacKeyPair = {
                        publicKey: icaKeyBytes.slice(0, 65),
                        privateKey: icaKeyBytes.slice(65),
                    };
                } else {
                    return undefined;
                }

                // Compute ICAC key identifier
                const icacKeyIdentifier = icac.cert.extensions.subjectKeyIdentifier;

                // Get the ICAC certificate bytes in TLV format
                const icacCertTlvBytes = Bytes.of(icac.asSignedTlv());

                config = {
                    ...config,
                    icacCertId: BigInt(icacCertId),
                    icacKeyPair: icacKeyPair,
                    icacKeyIdentifier: icacKeyIdentifier,
                    icacCertBytes: icacCertTlvBytes,
                };

                if (icacCertId >= config.nextCertificateId) {
                    config.nextCertificateId = BigInt(icacCertId) + BigInt(1);
                }
            }

            return config;
        } catch {
            return undefined;
        }
    }

    /**
     * Decode the RCAC (Root CA Certificate) for a fabric.
     * Returns undefined if the fabric or RCAC doesn't exist.
     */
    getRcac(fabricIndex: number): Rcac | undefined {
        const fabric = this.fabrics.get(fabricIndex);
        if (!fabric?.rcac) {
            return undefined;
        }
        try {
            return Rcac.fromTlv(fabric.rcac.raw);
        } catch {
            return undefined;
        }
    }

    /**
     * Decode the ICAC (Intermediate CA Certificate) for a fabric.
     * Returns undefined if the fabric or ICAC doesn't exist.
     * Note: ICAC is optional - some fabrics may not have an intermediate certificate.
     */
    getIcac(fabricIndex: number): Icac | undefined {
        const fabric = this.fabrics.get(fabricIndex);
        if (!fabric?.icac) {
            return undefined;
        }
        try {
            return Icac.fromTlv(fabric.icac.raw);
        } catch {
            return undefined;
        }
    }

    /**
     * Decode the NOC (Node Operational Certificate) for a fabric.
     * Returns undefined if the fabric or NOC doesn't exist.
     */
    getNoc(fabricIndex: number): Noc | undefined {
        const fabric = this.fabrics.get(fabricIndex);
        if (!fabric?.noc) {
            return undefined;
        }
        try {
            return Noc.fromTlv(fabric.noc.raw);
        } catch {
            return undefined;
        }
    }

    /**
     * Verify the certificate chain for a fabric.
     * Validates RCAC (self-signed), ICAC (if present, against RCAC), and NOC (against chain).
     */
    async verifyCertificateChain(fabricIndex: number): Promise<CertificateVerificationResult> {
        const crypto = new StandardCrypto();
        const result: CertificateVerificationResult = { valid: false };

        // Get certificates
        const rcac = this.getRcac(fabricIndex);
        if (!rcac) {
            return { ...result, error: "RCAC not found or invalid" };
        }

        const icac = this.getIcac(fabricIndex);
        const noc = this.getNoc(fabricIndex);
        if (!noc) {
            return { ...result, error: "NOC not found or invalid" };
        }

        // Verify RCAC (self-signed)
        try {
            await rcac.verify(crypto);
            result.rcacValid = true;
        } catch (e) {
            result.rcacValid = false;
            return { ...result, error: `RCAC verification failed: ${e instanceof Error ? e.message : String(e)}` };
        }

        // Verify ICAC (if present)
        if (icac) {
            try {
                await icac.verify(crypto, rcac);
                result.icacValid = true;
            } catch (e) {
                result.icacValid = false;
                return { ...result, error: `ICAC verification failed: ${e instanceof Error ? e.message : String(e)}` };
            }
        }

        // Verify NOC
        try {
            await noc.verify(crypto, rcac, icac);
            result.nocValid = true;
        } catch (e) {
            result.nocValid = false;
            return { ...result, error: `NOC verification failed: ${e instanceof Error ? e.message : String(e)}` };
        }

        result.valid = true;
        return result;
    }

    /**
     * Extract fabric configuration data in a format similar to Fabric.SyncConfig.
     *
     * This extracts all available data from chip.json for creating a matter.js Fabric.
     *
     * IMPORTANT: The returned data does NOT include the operational keypair because
     * the Python CHIP SDK does not persist it to chip.json (it generates an ephemeral
     * keypair on each run). To use this fabric data with matter.js:
     *
     * 1. Generate a new P256 keypair for the controller
     * 2. Use the CA keys (ExampleOpCredsICAKey1 or ExampleOpCredsCAKey1 from generic storage)
     *    to sign a new NOC for the new keypair
     * 3. The RCAC, ICAC, IPK, vendorId, fabricId, and label can all be preserved
     *
     * The identityProtectionKey is extracted from group key set 0 (IPK).
     *
     * @param fabricIndex The fabric index to extract
     * @returns FabricConfigData or undefined if fabric doesn't exist or data is incomplete
     */
    getFabricConfig(fabricIndex: number): LegacyFabricConfigData | undefined {
        const fabric = this.fabrics.get(fabricIndex);
        if (!fabric) return undefined;

        // Get decoded certificates
        const rcac = this.getRcac(fabricIndex);
        const noc = this.getNoc(fabricIndex);

        if (!rcac || !noc) return undefined;
        if (!fabric.rcac || !fabric.noc) return undefined;

        // Extract NOC subject data
        const { nodeId, fabricId } = noc.cert.subject;
        if (nodeId === undefined || fabricId === undefined) return undefined;

        // Extract RCAC subject data (rcacId is used as rootNodeId)
        const { rcacId } = rcac.cert.subject;
        if (rcacId === undefined) return undefined;

        // Get vendor ID and label from metadata
        if (!fabric.metadataDecoded) return undefined;
        const { vendorId, label } = fabric.metadataDecoded;

        // Get IPK from group key set 0
        const ipkKeySet = fabric.keysDecoded.get(0);
        if (!ipkKeySet || ipkKeySet.keys.length === 0) return undefined;

        // Verify there's a 16-byte IPK key entry (the operational IPK is a derived value,
        // but the plain IPK we return is always the same constant)
        const ipkEntry = ipkKeySet.keys.find(k => k.key.byteLength === 16);
        if (!ipkEntry) return undefined;

        return {
            fabricIndex,
            fabricId,
            nodeId,
            rootNodeId: nodeId,
            rootVendorId: vendorId,
            rootCert: fabric.rcac.raw,
            rootPublicKey: rcac.cert.ellipticCurvePublicKey,
            identityProtectionKey: CHIP_DEFAULT_IPK,
            intermediateCACert: fabric.icac?.raw,
            operationalCert: fabric.noc.raw,
            label,
        };
    }
}
