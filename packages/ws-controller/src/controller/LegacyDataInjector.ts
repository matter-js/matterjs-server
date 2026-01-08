/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImplementationError, MaybePromise, SupportedStorageTypes } from "@matter/general";
import {
    Bytes,
    Crypto,
    FabricId,
    FabricIndex,
    isDeepEqual,
    isObject,
    Logger,
    NodeId,
    StorageContext,
    StorageManager,
} from "@matter/main";
import { CertificateAuthority, Fabric, FabricBuilder, Noc } from "@matter/main/protocol";
import { VendorId } from "@matter/main/types";
import { ClusterMap } from "../model/ModelMapper.js";
import { convertWebSocketTagBasedToMatter } from "../server/Converters.js";

const logger = Logger.get("LegacyDataInjector");

/* eslint-disable regexp/no-unused-capturing-group */
const BASE64_REGEX = /^([0-9a-z+/]{4})*(([0-9a-z+/]{2}==)|([0-9a-z+/]{3}=))?$/i;

/**
 * Fabric configuration data extracted from chip.json.
 * This is a partial representation of Fabric.SyncConfig from @matter/protocol.
 *
 * IMPORTANT: The controller's operational keypair is NOT available in chip.json.
 *
 * The Python CHIP SDK intentionally does not persist the operational private key to chip.json.
 * When pychip_OpCreds_AllocateController is called without a keypair parameter, it generates
 * an ephemeral P256 keypair, creates a NOC for it, but only stores the keypair in memory
 * (see FabricTable.cpp:190 - "Operational Key is never saved to storage here").
 *
 * This means when migrating from Python Matter Server to matter.js:
 * - The RCAC and ICAC can be reused (they define the fabric's CA chain)
 * - The NOC must be REPLACED with a new one signed for a new keypair
 * - A new operational keypair must be generated for the matter.js controller
 * - The IPK and other fabric data can be preserved
 *
 * The ExampleOpCredsCAKey1/ICAKey1 in chip.json are the CA/ICA signing keys (for issuing
 * certificates to devices), NOT the controller's operational identity key.
 *
 * Fields that need to be computed or provided when creating the Fabric:
 * - keyPair: Must generate a new keypair and issue a new NOC
 * - globalId: Computed from fabricId + rootPublicKey
 * - operationalIdentityProtectionKey: Computed from identityProtectionKey + globalId
 */
export interface LegacyFabricConfigData {
    /** Fabric index (1, 2, etc.) */
    fabricIndex: number;
    /** Fabric ID from NOC certificate (can be number for small values, bigint for large) */
    fabricId: number | bigint;
    /** Node ID from NOC certificate (can be number for small values, bigint for large) */
    nodeId: number | bigint;
    /** Root node ID from RCAC certificate (can be number for small values, bigint for large) */
    rootNodeId: number | bigint;
    /** Root vendor ID from fabric metadata */
    rootVendorId: number;
    /** Root CA certificate (RCAC) as TLV bytes */
    rootCert: Bytes;
    /** Root CA public key extracted from RCAC */
    rootPublicKey: Bytes;
    /** Identity Protection Key from group key set 0 */
    identityProtectionKey: Bytes;
    /** Intermediate CA certificate (ICAC) as TLV bytes, if present */
    intermediateCACert?: Bytes;
    /** Node Operational Certificate (NOC) as TLV bytes */
    operationalCert: Bytes;
    /** Fabric label */
    label: string;
}

/** Vendor info from Python Matter Server */
export interface LegacyVendorInfo {
    vendor_id: number;
    vendor_name: string;
    company_legal_name: string;
    company_preferred_name: string;
    vendor_landing_page_url: string;
    creator: string;
}

/** Node data from Python Matter Server nodes map */
export interface LegacyNodeData {
    node_id: number;
    date_commissioned: string;
    last_interview: string;
    interview_version: number;
    available: boolean;
    is_bridge: boolean;
    attributes: Record<string, unknown>;
    attribute_subscriptions: unknown[];
}

/** Structure of the <compressedFabricId>.json file */
export interface LegacyServerFile {
    vendor_info: Record<string, LegacyVendorInfo>;
    last_node_id: number;
    nodes: Record<string, LegacyNodeData>;
}

export type CertificateAuthorityConfiguration = CertificateAuthority.Configuration;

export interface LegacyServerData {
    credentials?: CertificateAuthority.Configuration;
    fabric?: LegacyFabricConfigData;
    nodeData?: LegacyServerFile;
    vendorId: number;
    fabricId?: number | bigint;
}

export namespace LegacyDataInjector {
    function isPrimitiveType(value: unknown) {
        return (
            typeof value === "number" ||
            value === null ||
            typeof value == "boolean" ||
            (typeof value == "string" && !BASE64_REGEX.test(value))
        );
    }

    export async function injectCredentials(
        credentialsStorage: StorageContext,
        crypto: Crypto,
        credentialData: CertificateAuthority.Configuration,
        fabricData?: LegacyFabricConfigData,
    ) {
        const rootCertificateAuthority = new CertificateAuthority(crypto, credentialData);

        for (const [key, value] of Object.entries(credentialData)) {
            if (await credentialsStorage.has(key)) {
                if (!isDeepEqual(await credentialsStorage.get(key), value)) {
                    continue;
                }
                logger.warn(`Overriding credential ${key} with new value!`);
            }
            await credentialsStorage.set(key, value);
        }

        if (fabricData === undefined) {
            logger.warn("Credentials injected, but no fabric data provided. Skipping fabric initialization.");
            return;
        }

        const {
            fabricIndex,
            fabricId,
            nodeId,
            rootNodeId,
            rootCert,
            intermediateCACert,
            operationalCert,
            rootVendorId,
            rootPublicKey,
            identityProtectionKey,
            label,
        } = fabricData;

        const tempFabric = await Fabric.create(crypto, {
            fabricIndex: FabricIndex(fabricIndex),
            fabricId: FabricId(fabricId),
            nodeId: NodeId(nodeId),
            rootNodeId: NodeId(rootNodeId),
            rootCert,
            intermediateCACert,
            operationalCert,
            rootVendorId: VendorId(rootVendorId),
            rootPublicKey: rootPublicKey,
            identityProtectionKey: identityProtectionKey,
            label: label,
            keyPair: await crypto.createKeyPair(), // Just use a new keypair temporarily because chip data does not have it
        });

        if (await credentialsStorage.has("fabric")) {
            const storedFabric = await credentialsStorage.get<Fabric.Config>("fabric");
            if (!Bytes.areEqual(storedFabric.rootPublicKey!, tempFabric.rootPublicKey)) {
                logger.warn("Existing fabric root public key changed. Rewriting from legacy data");
            } else {
                logger.info("Fabric root public key unchanged. Skipping rewrite.");
                return;
            }
        }

        const builder = await FabricBuilder.create(crypto);
        builder.initializeFromFabricForUpdate(tempFabric);
        const {
            subject: { nodeId: certNodeId, fabricId: certFabricId },
        } = Noc.fromTlv(tempFabric.operationalCert).cert;
        if (certNodeId !== nodeId || certFabricId !== fabricId) {
            throw new ImplementationError(`Cannot rotate NOC for fabric because root node ID changed`);
        }
        await builder.setOperationalCert(
            await rootCertificateAuthority.generateNoc(builder.publicKey, certFabricId, certNodeId),
            tempFabric.intermediateCACert,
        );
        const rootFabric = await builder.build(tempFabric.fabricIndex);

        await credentialsStorage.set("fabric", rootFabric.config);
    }

    export async function injectNodeData(baseStorage: StorageManager, nodeData?: LegacyServerFile) {
        const nodesListStorage = baseStorage.createContext("nodes");

        if (nodeData === undefined) {
            if (!(await nodesListStorage.has("commissionedNodes"))) {
                await nodesListStorage.set("commissionedNodes", []);
            }
            return false;
        }

        const commissionedNodes = new Array<[NodeId, any]>();
        let injectedNodes = 0;

        for (const [nodeId, nodeDetails] of Object.entries(nodeData.nodes)) {
            const nodeStorage = baseStorage.createContext(`node-${nodeId}`);
            if (nodeId !== nodeDetails.node_id.toString()) {
                logger.warn(`Node ID mismatch in node data: ${nodeId} != ${nodeDetails.node_id}`);
            }
            commissionedNodes.push([NodeId(BigInt(nodeId)), {}]);
            let newNode = true;
            logger.info(`Injecting node ${nodeId} into storage`);
            const nodeWrites = new Array<MaybePromise<void>>();
            for (const [attributeKey, value] of Object.entries(nodeDetails.attributes)) {
                let currentEndpointId: string | undefined;
                let currentClusterId: string | undefined;
                let endpointStorage: StorageContext | undefined;
                let clusterStorage: StorageContext | undefined;
                const [endpointId, clusterId, attributeId] = attributeKey.split("/");
                if (currentEndpointId !== endpointId) {
                    endpointStorage = nodeStorage.createContext(endpointId);
                    currentEndpointId = endpointId;
                    currentClusterId = undefined;
                }
                if (currentClusterId !== clusterId) {
                    clusterStorage = endpointStorage!.createContext(clusterId);
                    currentClusterId = clusterId;
                    if (newNode) {
                        if (await clusterStorage.has("__version__")) {
                            logger.info(`Node ${nodeId} already exists. Skipping injection.`);
                            break;
                        }
                        newNode = false;
                        injectedNodes++;
                    }
                    nodeWrites.push(clusterStorage.set("__version__", 1));
                }

                const clusterModel = ClusterMap[clusterId];
                const model = clusterModel?.attributes?.[attributeId];
                if (clusterModel === undefined || model === undefined) {
                    if (isPrimitiveType(value) || (Array.isArray(value) && value.every(isPrimitiveType))) {
                        nodeWrites.push(clusterStorage!.set(attributeId, { value } as SupportedStorageTypes));
                    } else {
                        logger.info(
                            `Attribute ${attributeKey} not found in and unclear value. Skipping injection.`,
                            value,
                        );
                    }
                } else {
                    const convertedValue =
                        isObject(value) && ("TLVValue" in value || "Reason" in value)
                            ? undefined
                            : convertWebSocketTagBasedToMatter(value, model, clusterModel.model);
                    if (convertedValue !== undefined) {
                        logger.debug(`Converted value for attribute ${attributeKey}:`, value, "->", convertedValue);
                        nodeWrites.push(
                            clusterStorage!.set(attributeId, { value: convertedValue } as SupportedStorageTypes),
                        );
                    } else {
                        logger.info(`Attribute ${attributeKey} could not be converted. Skipping injection.`);
                    }
                }
            }
            await Promise.allSettled(nodeWrites);
            nodeWrites.length = 0;
        }

        if (injectedNodes > 0) {
            const knownNodes = await nodesListStorage.get<[bigint | number, any][]>("commissionedNodes", []);
            for (const [nodeId] of commissionedNodes) {
                if (!knownNodes.find(([knownNodeId]) => knownNodeId === nodeId)) {
                    knownNodes.push([nodeId, {}]);
                }
            }
            await nodesListStorage.set("commissionedNodes", knownNodes);
        }

        return injectedNodes > 0;
    }
}
