/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ControllerBehavior,
    DclBehavior,
    Endpoint,
    Environment,
    FabricId,
    FabricIndex,
    Logger,
    MatterAggregateError,
    NodeId,
    ServerNode,
    VendorId,
} from "@matter/main";
import { Ble, Fabric, FabricAuthority, FabricManager } from "@matter/main/protocol";
import { OtaProviderEndpoint } from "@matter/node/endpoints/ota-provider";
import { applyCertContext, loadCertContext } from "./certContext.js";
import { CameraControllerEndpoint } from "./ControllerCommandHandler.js";
import {
    cleanupLegacyStorage,
    migrateLegacyCommissionedNodes,
    migrateLegacyControllerCredentials,
} from "./legacyStorageMigration.js";
import { applyAutoSubscribe, PeerSettingsRepairMarker, repairRestoredPeers } from "./restoredPeers.js";
import { ServerSoftwareUpdateManager } from "./ServerSoftwareUpdateManager.js";

// A controller joins fabrics, it does not serve groupcast, and the Groupcast listener would pull in the
// Auxiliary ACL feature with it.
const ControllerRootEndpoint = ServerNode.RootEndpointWithoutGroupcast.with(ControllerBehavior, DclBehavior);
type ControllerRootEndpoint = typeof ControllerRootEndpoint;

/**
 * Parse a version string into a numeric version in MMmmpp format.
 * For alpha/beta versions, only the base version (major.minor.patch) is used.
 * @param version Version string like "0.2.10" or "0.2.10-alpha.0"
 * @returns Numeric version like 210 for "0.2.10"
 */
function parseVersionToNumber(version: string): number {
    const baseVersion = version.split("-")[0];
    const parts = baseVersion.split(".");
    const major = parseInt(parts[0] ?? "0", 10);
    const minor = parseInt(parts[1] ?? "0", 10);
    const patch = parseInt(parts[2] ?? "0", 10);
    return major * 10000 + minor * 100 + patch;
}
const logger = Logger.get("ControllerNode");

export interface ControllerNodeOptions {
    environment: Environment;
    id: string;
    adminVendorId?: VendorId;
    adminFabricId?: FabricId;
    adminFabricLabel: string;
    serverVersion: string;
    enableOtaProvider: boolean;

    /**
     * Where the one-shot repair of peers commissioned by an earlier version records that it has run.
     * Omit to skip the repair.
     */
    peerSettingsRepair?: PeerSettingsRepairMarker;

    /**
     * Migrate a controller storage that a matter.js controller before 0.16 wrote. Leave it off when Python Matter
     * Server data is present, because its migration writes the current layout itself.
     */
    migrateLegacyStorage?: boolean;

    /** Set when this start migrated the Python Matter Server data, so the legacy node data is removed entirely. */
    legacyNodeDataObsolete?: boolean;

    /** Applied to every stored peer on each build, in both directions. Defaults to false. */
    disableAutoSubscription?: boolean;

    /**
     * DCL settings, in place before any endpoint is added: the OTA provider creates its DCL service while it is added,
     * and matter.js reads `offline` only when a service is created.
     */
    dcl?: { acceptTestCertificates: boolean; offline: boolean };
}

export interface ControllerResources {
    readonly node: ServerNode;
    readonly fabricIndex: FabricIndex;
    readonly otaProvider?: Endpoint<typeof OtaProviderEndpoint>;
    readonly webRtcRequestor: Endpoint<CameraControllerEndpoint>;
}

/**
 * The controller node with the fabric and endpoints built alongside it, owned as one resource.
 *
 * `ServerNode.create` takes the storage lock, so everything built after it belongs to the same lifetime
 * and a single {@link ControllerNode.close} is what releases the lock.
 */
export interface ControllerNode extends ControllerResources {
    readonly node: ServerNode<ControllerRootEndpoint>;

    /** matter.js replaces the Fabric object whenever it rotates the NOC, so resolve this on use instead of keeping it. */
    readonly fabric: Fabric;

    close(): Promise<void>;
}

export async function createControllerNode(options: ControllerNodeOptions): Promise<ControllerNode> {
    const { environment, id, adminVendorId, adminFabricId, adminFabricLabel, serverVersion } = options;
    const adminNodeId = NodeId(112233); // TODO Remove when we switch to random IDs
    const certContext = await loadCertContext(environment, options.disableAutoSubscription ?? false);
    if (options.migrateLegacyStorage) {
        await migrateLegacyControllerCredentials(environment, id);
    }

    const node = await ServerNode.create(ControllerRootEndpoint, {
        environment,
        id,
        network: {
            ble: false,
            tcp: true,
            transportPreference: "tcp",
        },
        basicInformation: {
            vendorName: "Open Home Foundation",
            productName: "OHF Matter Server",
            productId: 1,
            hardwareVersion: 1,
            hardwareVersionString: "1.0",
            softwareVersion: parseVersionToNumber(serverVersion) || 1,
            softwareVersionString: serverVersion.split("-")[0], // Base version without alpha/beta suffix
            vendorId: adminVendorId,
        },
        controller: {
            adminFabricLabel,
            adminFabricId,
            adminNodeId,
            ble: (environment.maybeGet(Ble) ?? Environment.default.maybeGet(Ble)) !== undefined,
        },
        // A controller is never itself commissionable, and subscription persistence is a device feature.
        commissioning: { enabled: false },
        subscriptions: { persistenceEnabled: false },
        dcl: { fetchTestCertificates: true, ...options.dcl },
    });

    try {
        const otaProvider = options.enableOtaProvider
            ? await node.add(
                  new Endpoint(OtaProviderEndpoint.with(ServerSoftwareUpdateManager), {
                      id: "ota-provider",
                      softwareupdates: { checkOnRequestOnly: options.disableAutoSubscription ?? false },
                  }),
              )
            : undefined;
        const webRtcRequestor = await node.add(new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }));

        const fabrics = await node.env.load(FabricManager);
        const fabricAuthority = await node.env.load(FabricAuthority);
        // Rotates the operational keypair on every start where a fabric already exists, so no long-lived
        // operational key is kept on disk. Peers still trust us: the NOC is reissued under the same CA and
        // fabric identifiers.
        const { fabricIndex } = await fabricAuthority.defaultFabric({
            adminFabricLabel,
            adminVendorId,
            adminNodeId,
            adminFabricId,
        });

        if (certContext !== undefined) {
            await applyCertContext(node, fabricIndex, certContext);
        }

        if (options.migrateLegacyStorage) {
            const { nodes, endpoints, failed } = await migrateLegacyCommissionedNodes(node);
            if (nodes > 0) {
                logger.info(`Legacy storage migration: ${nodes} node(s), ${endpoints} endpoint(s) migrated`);
            }
            if (failed > 0) {
                logger.warn(`${failed} legacy node(s) failed to migrate; their data stays in the storage`);
            }
        }
        await cleanupLegacyStorage(node, options.legacyNodeDataObsolete);

        if (options.peerSettingsRepair !== undefined) {
            await repairRestoredPeers(node, id, options.peerSettingsRepair);
        }
        await applyAutoSubscribe(node, !options.disableAutoSubscription);

        return {
            node,
            fabricIndex,
            get fabric() {
                return fabrics.for(fabricIndex);
            },
            otaProvider,
            webRtcRequestor,
            close: () => node.close(),
        };
    } catch (error) {
        // The node already holds the storage lock and the caller has no handle to it yet, so a close that
        // fails has to travel with the original error rather than be logged away.
        try {
            await node.close();
        } catch (closeError) {
            throw new MatterAggregateError(
                [error, closeError].map(e => (e instanceof Error ? e : new Error(String(e)))),
                "Controller node build failed and the node could not be closed",
            );
        }
        throw error;
    }
}
