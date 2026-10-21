/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Bytes,
    Crypto,
    FabricId,
    FabricIndex,
    ImplementationError,
    isObject,
    Logger,
    MaybePromise,
    NodeId,
    StorageContext,
    StorageManager,
    SupportedStorageTypes,
    Time,
} from "@matter/main";
import { CertificateAuthority, Fabric, FabricBuilder, Noc, PeerAddress } from "@matter/main/protocol";
import { Global, VendorId } from "@matter/main/types";
import { ClusterMap } from "../model/ModelMapper.js";
import { convertWebSocketTagBasedToMatter } from "../server/Converters.js";

const logger = Logger.get("LegacyDataInjector");

/**/
const BASE64_REGEX = /^([0-9a-z+/]{4})*(([0-9a-z+/]{2}==)|([0-9a-z+/]{3}=))?$/i;

const FEATUREMAP_ID = Global.attributes.featureMap.id.toString();

/** Storage context in the server storage that `CertificateAuthority` (`@matter/protocol`) loads the controller CA from. */
const CERTIFICATES_CONTEXT = "certificates";
const ROOT_CERT_KEY = "rootCertBytes";
const FABRICS_CONTEXT = "fabrics";
const NODES_CONTEXT = "nodes";
/** Where matter.js before 0.16, and LegacyDataInjector up to 1.5.0, kept the controller CA. */
const PRE_0_16_CREDENTIALS_CONTEXT = "credentials";
/** Prefix matter.js `ClientNodeStores` gives peer IDs; it continues numbering after the highest one in storage. */
const PEER_ID_PREFIX = "peer";

const SKIPPED_MIGRATION =
    "The Python Matter Server data is not migrated. To migrate it, restore the backup from before the first migration attempt, or start with a storage directory that holds only the Python Matter Server data files.";

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
    node_id: number | bigint;
    date_commissioned: string;
    last_interview: string;
    interview_version: number;
    available: boolean;
    is_bridge: boolean;
    attributes: Record<string, unknown>;
    attribute_subscriptions: readonly [];
}

/** Structure of the <compressedFabricId>.json file */
export interface LegacyServerFile {
    vendor_info: Record<string, LegacyVendorInfo>;
    last_node_id: number | bigint;
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

    /**
     * Install the legacy CA where the controller node loads it and add the legacy fabric to the fabric table.
     *
     * Nothing is written when the legacy CA does not issue the legacy fabric, or when storage already holds a different
     * CA or a different fabric at the legacy fabric index. Nodes may depend on that data, and the legacy nodes cannot
     * be reached through it.
     *
     * @returns true when storage holds the legacy CA and fabric afterwards, false when it was left unchanged
     */
    export async function injectCredentials(
        storage: StorageManager,
        crypto: Crypto,
        credentialData: CertificateAuthority.Configuration,
        fabricData: LegacyFabricConfigData,
    ) {
        if (!Bytes.areEqual(credentialData.rootCertBytes, fabricData.rootCert)) {
            logger.warn(
                "The controller CA in the Python Matter Server data does not issue its fabric, so the data is not migrated.",
            );
            return false;
        }

        const pre016Credentials = storage.createContext(PRE_0_16_CREDENTIALS_CONTEXT);
        if (
            (await pre016Credentials.has(ROOT_CERT_KEY)) &&
            !Bytes.areEqual(await pre016Credentials.get<Bytes>(ROOT_CERT_KEY), credentialData.rootCertBytes)
        ) {
            logger.warn(`Storage holds controller data of matter.js before 0.16. ${SKIPPED_MIGRATION}`);
            return false;
        }

        const certificates = storage.createContext(CERTIFICATES_CONTEXT);
        const hasCertificateAuthority = await certificates.has(ROOT_CERT_KEY);
        if (
            hasCertificateAuthority &&
            !Bytes.areEqual(await certificates.get<Bytes>(ROOT_CERT_KEY), credentialData.rootCertBytes)
        ) {
            logger.warn(`Storage already holds a controller CA other than the legacy one. ${SKIPPED_MIGRATION}`);
            return false;
        }

        const fabricsStorage = storage.createContext(FABRICS_CONTEXT);
        const fabrics = await fabricsStorage.get<Fabric.Config[]>("fabrics", []);
        const storedFabric = fabrics.find(({ fabricIndex }) => fabricIndex === fabricData.fabricIndex);
        if (
            storedFabric !== undefined &&
            !(
                Bytes.areEqual(storedFabric.rootCert, fabricData.rootCert) &&
                storedFabric.fabricId === FabricId(fabricData.fabricId)
            )
        ) {
            logger.warn(
                `Storage already holds a different fabric at the legacy fabric index ${fabricData.fabricIndex}. ${SKIPPED_MIGRATION}`,
            );
            return false;
        }

        const legacyFabric =
            storedFabric === undefined ? await buildLegacyFabric(crypto, credentialData, fabricData) : undefined;

        if (!hasCertificateAuthority) {
            await certificates.set(credentialData);
            logger.info("Installed the legacy CA");
        }

        if (legacyFabric !== undefined) {
            await fabricsStorage.set("fabrics", [...fabrics, legacyFabric.config]);
            logger.info(`Added legacy fabric ${legacyFabric.fabricIndex} to the fabric table`);
        }
        return true;
    }

    /** The legacy fabric with a NOC for a new operational key, since chip.json does not hold the old one. */
    async function buildLegacyFabric(
        crypto: Crypto,
        credentialData: CertificateAuthority.Configuration,
        fabricData: LegacyFabricConfigData,
    ) {
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

        const builder = await FabricBuilder.create(crypto);
        const {
            subject: { nodeId: certNodeId, fabricId: certFabricId },
        } = Noc.fromTlv(tempFabric.operationalCert).cert;
        if (certNodeId !== nodeId || certFabricId !== fabricId) {
            throw new ImplementationError(`Cannot rotate NOC for fabric because root node ID changed`);
        }
        await builder.updateOperationalCert(
            tempFabric,
            await new CertificateAuthority(crypto, credentialData).generateNoc(
                builder.publicKey,
                certFabricId,
                certNodeId,
            ),
            tempFabric.intermediateCACert,
        );
        return builder.build(tempFabric.fabricIndex);
    }

    /**
     * Write every legacy node that has no peer on the legacy fabric yet into the peer storage of the controller
     * node, in the layout matter.js restores peers from. Must run before the controller node is created, so
     * matter.js allocates later peer IDs after the ones written here.
     *
     * A node counts as a peer once its peer address is stored. The address is written after all attribute data of
     * the node, so a node whose writes failed is written again on the next start.
     *
     * @returns the IDs of the nodes written by this call, and of the nodes that could not be written
     */
    export async function injectNodeData(
        storage: StorageManager,
        nodeData: LegacyServerFile,
        fabricIndex: FabricIndex,
    ) {
        const nodesStorage = storage.createContext(NODES_CONTEXT);
        const knownNodeIds = new Set<NodeId>();
        let lastPeerNumber = 0;
        for (const peerId of await nodesStorage.contexts()) {
            if (peerId.startsWith(PEER_ID_PREFIX)) {
                const peerNumber = Number.parseInt(peerId.slice(PEER_ID_PREFIX.length));
                if (Number.isFinite(peerNumber) && peerNumber > lastPeerNumber) {
                    lastPeerNumber = peerNumber;
                }
            }
            const commissioning = commissioningContextOf(nodesStorage.createContext(peerId));
            if (await commissioning.has("peerAddress")) {
                const address = PeerAddress(await commissioning.get<PeerAddress>("peerAddress"));
                if (address.fabricIndex === fabricIndex) {
                    knownNodeIds.add(address.nodeId);
                }
            }
        }

        const injected = new Array<NodeId>();
        const failed = new Array<NodeId>();
        for (const [nodeIdText, nodeDetails] of Object.entries(nodeData.nodes)) {
            const nodeId = NodeId(BigInt(nodeIdText));
            if (knownNodeIds.has(nodeId)) {
                continue;
            }
            const peerId = `${PEER_ID_PREFIX}${++lastPeerNumber}`;
            if (await injectNode(nodesStorage.createContext(peerId), nodeId, nodeDetails, fabricIndex)) {
                logger.info(`Injected legacy node ${nodeId} into peer storage as ${peerId}`);
                injected.push(nodeId);
            } else {
                failed.push(nodeId);
            }
        }
        return { injected, failed };
    }

    function commissioningContextOf(peerStorage: StorageContext) {
        return peerStorage.createContext("endpoints").createContext("0").createContext("commissioning");
    }

    /** @returns false when a write failed; the peer storage is then cleared again */
    async function injectNode(
        peerStorage: StorageContext,
        nodeId: NodeId,
        nodeDetails: LegacyNodeData,
        fabricIndex: FabricIndex,
    ) {
        if (nodeId !== NodeId(BigInt(nodeDetails.node_id))) {
            logger.warn(`Node ID mismatch in node data: ${nodeId} != ${nodeDetails.node_id}`);
        }
        const endpointsStorage = peerStorage.createContext("endpoints");
        const writes = new Array<MaybePromise<void>>();
        let currentEndpointId: string | undefined;
        let currentClusterId: string | undefined;
        let endpointStorage: StorageContext | undefined;
        let clusterStorage: StorageContext | undefined;
        for (const [attributeKey, value] of Object.entries(nodeDetails.attributes)) {
            const [endpointId, clusterId, attributeId] = attributeKey.split("/");
            if (currentEndpointId !== endpointId) {
                endpointStorage = endpointsStorage.createContext(endpointId);
                currentEndpointId = endpointId;
                currentClusterId = undefined;
            }
            if (currentClusterId !== clusterId) {
                clusterStorage = endpointStorage!.createContext(clusterId);
                currentClusterId = clusterId;
                writes.push(clusterStorage.set("__version__", 1));
            }

            const clusterModel = ClusterMap[clusterId];
            const model = clusterModel?.attributes?.[attributeId];
            if (clusterModel === undefined || model === undefined) {
                if (attributeId === FEATUREMAP_ID) {
                    logger.debug(
                        `Node ${nodeId}: Attribute ${attributeKey}, unknown featuremap converted to empty featuremap`,
                    );
                    writes.push(clusterStorage!.set(attributeId, {} as SupportedStorageTypes));
                } else if (isPrimitiveType(value) || (Array.isArray(value) && value.every(isPrimitiveType))) {
                    logger.debug(
                        `Node ${nodeId}: Attribute ${attributeKey}, unknown primary type converted generically`,
                        value,
                    );
                    writes.push(clusterStorage!.set(attributeId, value as SupportedStorageTypes));
                } else {
                    logger.debug(
                        `Node ${nodeId}: Attribute ${attributeKey}, not found in and unclear value. Skipping injection.`,
                        value,
                    );
                }
            } else {
                const convertedValue =
                    isObject(value) && ("TLVValue" in value || "Reason" in value)
                        ? undefined
                        : convertWebSocketTagBasedToMatter(value, model, clusterModel.model);
                if (convertedValue !== undefined) {
                    writes.push(clusterStorage!.set(attributeId, convertedValue as SupportedStorageTypes));
                } else {
                    logger.debug(`Attribute ${attributeKey} could not be converted. Skipping injection.`);
                }
            }
        }

        const failure = (await Promise.allSettled(writes)).find(result => result.status === "rejected");
        if (failure !== undefined) {
            logger.warn(`Could not write legacy node ${nodeId}; the next start tries again:`, failure.reason);
            await peerStorage.clearAll();
            return false;
        }

        const commissionedAt = new Date(nodeDetails.date_commissioned).getTime();
        try {
            await commissioningContextOf(peerStorage).set({
                discoveredAt: Time.nowMs,
                ...(Number.isFinite(commissionedAt) ? { commissionedAt } : {}),
                peerAddress: PeerAddress({ fabricIndex, nodeId }),
            });
        } catch (error) {
            logger.warn(`Could not write legacy node ${nodeId}; the next start tries again:`, error);
            await peerStorage.clearAll();
            return false;
        }
        return true;
    }
}
