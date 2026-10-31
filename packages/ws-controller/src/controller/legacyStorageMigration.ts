/**
 * @license
 * Copyright 2022-2026 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Copy of matter.js `packages/nodejs-shell/src/util/legacyStorageMigration.ts`, which is not published.
 * It migrates a controller storage that a matter.js controller before 0.16 wrote, for example one copied in
 * from another matter.js application. The legacy CommissioningController performed this migration itself
 * during construction; the ClientNode API has no equivalent hook, so without it the fabric and peers of such
 * a store would become unreachable.
 *
 * Copied from an older upstream state; the places that diverge from it are marked DIVERGES FROM UPSTREAM at the
 * code they apply to.
 */

import {
    Bytes,
    Environment,
    isObject,
    Logger,
    StorageManager,
    StorageService,
    SupportedStorageTypes,
    Time,
} from "@matter/general";
import { ClientNode, RemoteDescriptor, ServerNode, ServerNodeStore } from "@matter/node";
import { DiscoveryData, OperationalAddress, PeerAddress } from "@matter/protocol";
import { EventNumber, FabricIndex, NodeId } from "@matter/types";

const logger = Logger.get("LegacyStorageMigration");

/** A pre-0.16 `credentials` entry (fabric config or CA key material); relocated verbatim, never decoded. */
type LegacyCredentialRecord = Record<string, SupportedStorageTypes>;

/**
 * A pre-0.16 `fabrics` entry; only `fabricIndex` is read here, the rest was relocated verbatim in step 1.
 * Intersected with `Record<string, SupportedStorageTypes>` (rather than a plain interface) so the type still
 * satisfies `StorageContext.get`'s `SupportedStorageTypes` constraint.
 */
type LegacyFabricRecord = Record<string, SupportedStorageTypes> & { fabricIndex: number };

/** The fields of a stored fabric record that identify the fabric. */
type StoredFabricRecord = LegacyFabricRecord & { fabricId: bigint; rootCert: Bytes };

/** Per-node metadata carried in a `commissionedNodes` list entry. `deviceData` is intentionally not migrated. */
type LegacyCommissionedEntry = Record<string, SupportedStorageTypes> & {
    operationalServerAddress?: OperationalAddress;
    discoveryData?: DiscoveryData;
};

/** One `commissionedNodes` list entry: the peer's raw stored node id paired with its metadata. */
type LegacyCommissionedNode = [bigint, LegacyCommissionedEntry];

/** True for a pre-0.16 cached attribute record (current storage keeps the bare value instead). */
function isLegacyAttributeRecord(value: SupportedStorageTypes): value is Record<string, SupportedStorageTypes> {
    return isObject(value) && "value" in value;
}

/**
 * Certificate authority material is relocated when `credentials` holds some and `certificates` holds no
 * authority, independently of whether the fabric still needs moving.
 *
 * DIVERGES FROM UPSTREAM.
 * - Upstream gates the relocation on `fabrics` being empty. Older LegacyDataInjector versions wrote the
 *   authority into `credentials` but the fabric straight into `fabrics`, so upstream would leave that
 *   authority where nothing reads it, and matter.js would mint a root that does not control the fabric.
 * - Upstream copies key by key. Storage where a failed python-matter-server migration left one authority
 *   in `certificates` and another in `credentials` would end up with keys of both, for example the root of
 *   one and the intermediate of the other.
 */
async function certificateRelocationNeeded(mgr: StorageManager): Promise<boolean> {
    if (await mgr.createContext("certificates").has("rootCertBytes")) {
        return false;
    }
    return (await mgr.createContext("credentials").keys()).some(key => key !== "fabric");
}

async function fabricRelocationNeeded(mgr: StorageManager): Promise<boolean> {
    const credentials = mgr.createContext("credentials");
    if (!(await credentials.has("fabric"))) {
        return false;
    }
    const fabrics = await mgr.createContext("fabrics").get<LegacyCredentialRecord[]>("fabrics", []);
    return fabrics.length === 0;
}

/** Whether `credentials` holds a CA other than the one in `certificates`, so its nodes belong to another fabric. */
async function holdsForeignAuthority(mgr: StorageManager): Promise<boolean> {
    const credentials = mgr.createContext("credentials");
    const certificates = mgr.createContext("certificates");
    return (
        (await credentials.has("rootCertBytes")) &&
        (await certificates.has("rootCertBytes")) &&
        !Bytes.areEqual(await credentials.get<Bytes>("rootCertBytes"), await certificates.get<Bytes>("rootCertBytes"))
    );
}

async function stepOneNeeded(mgr: StorageManager): Promise<boolean> {
    return (await certificateRelocationNeeded(mgr)) || (await fabricRelocationNeeded(mgr));
}

async function stepTwoNeeded(mgr: StorageManager): Promise<boolean> {
    const nodes = mgr.createContext("nodes");
    const commissioned = await nodes.get<SupportedStorageTypes[]>("commissionedNodes", []);
    if (commissioned.length === 0) {
        // DIVERGES FROM UPSTREAM. Older LegacyDataInjector versions wrote an empty list on a fresh install to
        // mark the store as initialised, so the key alone does not mean there is anything to migrate.
        return false;
    }
    // Current-format storage keys each peer under its own subcontext of "nodes".
    return (await nodes.contexts()).length === 0;
}

/**
 * Step 1: relayout fabric + certificate authority data from the legacy `credentials` context into the
 * `fabrics`/`certificates` contexts the current controller reads. Must run before the controller ServerNode is
 * constructed. Idempotent.
 */
export async function migrateLegacyControllerCredentials(env: Environment, id: string): Promise<void> {
    const mgr = await env.get(StorageService).open(id);
    try {
        if (!(await stepOneNeeded(mgr))) {
            logger.debug(`No legacy controller credentials to migrate for store ${id}`);
            return;
        }

        const credentials = mgr.createContext("credentials");
        const fabricStore = mgr.createContext("fabrics");
        const certificates = mgr.createContext("certificates");
        const moveFabric = await fabricRelocationNeeded(mgr);
        const moveCertificates = await certificateRelocationNeeded(mgr);

        let fabric: LegacyCredentialRecord | undefined;
        const authority: Record<string, SupportedStorageTypes> = {};
        for (const key of await credentials.keys()) {
            if (key === "fabric") {
                fabric = await credentials.get<LegacyCredentialRecord>("fabric");
            } else {
                authority[key] = await credentials.get<SupportedStorageTypes>(key);
            }
        }
        if (moveCertificates) {
            await certificates.set(authority);
        }

        // Certificate authority keys must land in `certificates` before `fabrics.fabrics` is written: a crash
        // between the two would otherwise strand the CA under the old layout while the guard reports "migrated".
        if (fabric !== undefined && moveFabric) {
            await fabricStore.set("fabrics", [fabric]);
        }
        logger.info(`Migrated legacy controller credentials for store ${id}`);
    } finally {
        await closeStorage(mgr, id);
    }
}

/**
 * Step 2: migrate cached per-node data (`node-<id>` attribute trees + the `commissionedNodes` list) into the
 * current per-peer store layout, and register each peer. Must run after the controller ServerNode is constructed
 * (so its fabric is loaded) but before it goes online. Non-destructive — old data is left in place for
 * {@link cleanupLegacyStorage}. A peer that fails to migrate is skipped without aborting the rest and its
 * partially-written store is cleared.
 *
 * DIVERGES FROM UPSTREAM: runs only while the store holds no peer in the current layout, because next to existing
 * peers the list is stale and a node removed since would come back. A run that stopped part-way is therefore not
 * resumed; the data of the nodes it did not reach stays in storage. It also skips nodes of a CA other than the one
 * in use.
 */
export async function migrateLegacyCommissionedNodes(
    node: ServerNode,
): Promise<{ nodes: number; endpoints: number; failed: number }> {
    const serverStore = node.env.get(ServerNodeStore);
    const baseStorage = serverStore.storage;
    const nodesCtx = baseStorage.createContext("nodes");

    if (!(await stepTwoNeeded(baseStorage))) {
        logger.debug("No former commissioned nodes to migrate.");
        return { nodes: 0, endpoints: 0, failed: 0 };
    }
    const commissioned = await nodesCtx.get<LegacyCommissionedNode[]>("commissionedNodes", []);
    // A store migrated by step 1 carries exactly one fabric. Anything else cannot be addressed here; skip rather
    // than abort the start, and report the peers as failed.
    const fabrics = await baseStorage.createContext("fabrics").get<LegacyFabricRecord[]>("fabrics", []);
    if (fabrics.length !== 1) {
        logger.warn(`Skipping legacy node migration: expected exactly one migrated fabric, found ${fabrics.length}`);
        return { nodes: 0, endpoints: 0, failed: commissioned.length };
    }
    if (await holdsForeignAuthority(baseStorage)) {
        logger.warn(
            "Skipping legacy node migration: the legacy nodes belong to another controller CA than the one in use",
        );
        return { nodes: 0, endpoints: 0, failed: commissioned.length };
    }
    const fabricIndex = FabricIndex(fabrics[0].fabricIndex);

    let migratedNodes = 0;
    let migratedEndpoints = 0;
    let failedNodes = 0;

    for (const [rawNodeId, { operationalServerAddress, discoveryData }] of commissioned) {
        const nodeId = NodeId(rawNodeId);
        const peerAddress = PeerAddress({ fabricIndex, nodeId });

        if (node.peers.get(peerAddress) !== undefined) {
            logger.debug(`Node ${nodeId} already migrated, skipping`);
            continue;
        }

        const id = serverStore.clientStores.allocateId();
        let peerNode: ClientNode | undefined;
        try {
            const oldNode = baseStorage.createContext(`node-${nodeId}`);

            const maxEventNumber = await oldNode.get<EventNumber>("__maxEventNumber__", EventNumber(0));

            // Written before forAddress() below allocates the peer's store for the same id, which loads rather
            // than overwrites whatever is already on disk under that context.
            const peerStorage = nodesCtx.createContext(id).createContext("endpoints");
            let endpointsForNode = 0;
            for (const ep of await oldNode.contexts()) {
                const oldEndpoint = oldNode.createContext(ep);
                const newEndpoint = peerStorage.createContext(ep);
                for (const cluster of await oldEndpoint.contexts()) {
                    const oldCluster = oldEndpoint.createContext(cluster);
                    const newCluster = newEndpoint.createContext(cluster);
                    for (const key of await oldCluster.keys()) {
                        const value = await oldCluster.get(key);
                        if (key === "__version__") {
                            await newCluster.set(key, value);
                        } else if (isLegacyAttributeRecord(value)) {
                            await newCluster.set(key, value.value);
                        }
                    }
                }
                endpointsForNode++;
            }

            const commissioning = RemoteDescriptor.toLongForm({
                // Fallback only — a peer with its own discoveredAt keeps it.
                discoveredAt: Time.nowMs,
                ...discoveryData,
                addresses: operationalServerAddress ? [operationalServerAddress] : [],
            });

            // DIVERGES FROM UPSTREAM. Upstream turns autoSubscribe off, because the shell connects its peers by
            // hand. This server lets matter.js bring peers up, so a migrated peer keeps the default.
            peerNode = await node.peers.forAddress(peerAddress, { id });
            await peerNode.set({ commissioning, network: { maxEventNumber } });
            migratedNodes++;
            migratedEndpoints += endpointsForNode;
            logger.info(`Migrated commissioned node ${nodeId} as ${id}`);
        } catch (error) {
            failedNodes++;
            logger.error(`Failed to migrate commissioned node ${nodeId} as ${id}, skipping:`, error);
            if (peerNode !== undefined) {
                await peerNode.delete();
            }
            await nodesCtx.createContext(id).clearAll();
        }
    }

    return { nodes: migratedNodes, endpoints: migratedEndpoints, failed: failedNodes };
}

/**
 * DIVERGES FROM UPSTREAM: upstream removes all legacy data on request of the user. Here it runs on every start and
 * removes only legacy data whose replacement is in the current layout: `node-<id>` data and `commissionedNodes`
 * entries of nodes that have a peer, the `credentials` CA keys once `certificates` holds the same root certificate,
 * and the `credentials` fabric once `fabrics` holds the same fabric. Node data next to a CA other than the one in
 * use is kept.
 *
 * With `nodeDataObsolete`, all `node-<id>` data and the whole `commissionedNodes` list go, for a start that
 * migrated the Python Matter Server data: its node file, not the list, says which nodes exist. Everything else stays, so data that was not migrated is never lost. Covers what matter.js before
 * 0.16 and LegacyDataInjector up to 1.5.0 wrote. Call before the node goes online; safe on every start.
 */
export async function cleanupLegacyStorage(node: ServerNode, nodeDataObsolete = false): Promise<void> {
    const storage = node.env.get(ServerNodeStore).storage;
    const foreignAuthority = await holdsForeignAuthority(storage);
    const peerNodeIds = new Set<NodeId>();
    for (const peer of node.peers) {
        const address = peer.peerAddress;
        if (address !== undefined) {
            peerNodeIds.add(address.nodeId);
        }
    }

    let removed = 0;
    for (const context of await storage.driver.contexts([])) {
        const nodeId = nodeIdOfLegacyContext(context);
        if (nodeId !== undefined && !foreignAuthority && (nodeDataObsolete || peerNodeIds.has(nodeId))) {
            await storage.createContext(context).clearAll();
            removed++;
        }
    }

    const nodesCtx = storage.createContext("nodes");
    if (!foreignAuthority && (await nodesCtx.has("commissionedNodes"))) {
        const commissioned = await nodesCtx.get<LegacyCommissionedNode[]>("commissionedNodes", []);
        const remaining = nodeDataObsolete ? [] : commissioned.filter(([nodeId]) => !peerNodeIds.has(NodeId(nodeId)));
        if (remaining.length === 0) {
            await nodesCtx.delete("commissionedNodes");
            removed++;
        } else if (remaining.length < commissioned.length) {
            await nodesCtx.set("commissionedNodes", remaining);
            removed++;
        }
    }

    const credentials = storage.createContext("credentials");
    const certificates = storage.createContext("certificates");
    if (
        (await credentials.has("rootCertBytes")) &&
        (await certificates.has("rootCertBytes")) &&
        Bytes.areEqual(await credentials.get<Bytes>("rootCertBytes"), await certificates.get<Bytes>("rootCertBytes"))
    ) {
        for (const key of await credentials.keys()) {
            if (key !== "fabric") {
                await credentials.delete(key);
            }
        }
        removed++;
    }
    if (await credentials.has("fabric")) {
        const legacyFabric = await credentials.get<StoredFabricRecord>("fabric");
        const fabrics = await storage.createContext("fabrics").get<StoredFabricRecord[]>("fabrics", []);
        if (
            fabrics.some(
                ({ fabricIndex, fabricId, rootCert }) =>
                    fabricIndex === legacyFabric.fabricIndex &&
                    fabricId === legacyFabric.fabricId &&
                    Bytes.areEqual(rootCert, legacyFabric.rootCert),
            )
        ) {
            await credentials.delete("fabric");
            removed++;
        }
    }

    if (removed > 0) {
        logger.info(`Removed migrated legacy storage data of ${node}`);
    }
}

function nodeIdOfLegacyContext(context: string) {
    if (!context.startsWith("node-")) {
        return undefined;
    }
    try {
        return NodeId(BigInt(context.slice("node-".length)));
    } catch {
        return undefined;
    }
}

async function closeStorage(mgr: StorageManager, id: string): Promise<void> {
    try {
        await mgr.close();
    } catch (closeError) {
        logger.warn(`Error closing storage for store ${id}:`, closeError);
    }
}
