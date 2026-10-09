/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ControllerBehavior,
    Endpoint,
    Environment,
    FabricId,
    MatterAggregateError,
    NodeId,
    ServerNode,
    VendorId,
} from "@matter/main";
import { Ble, Fabric, FabricAuthority, FabricManager } from "@matter/main/protocol";
import { OtaProviderEndpoint } from "@matter/node/endpoints/ota-provider";
import { CameraControllerEndpoint } from "./ControllerCommandHandler.js";
import { PeerSettingsRepairMarker, repairRestoredPeers } from "./restoredPeers.js";

const ControllerRootEndpoint = ServerNode.RootEndpoint.with(ControllerBehavior);
type ControllerRootEndpoint = typeof ControllerRootEndpoint;

/**
 * Parse a version string into a numeric version in MMmmpp format.
 * For alpha/beta versions, only the base version (major.minor.patch) is used.
 * @param version Version string like "0.2.10" or "0.2.10-alpha.0"
 * @returns Numeric version like 210 for "0.2.10"
 */
function parseVersionToNumber(version: string): number {
    // Extract base version (before any -alpha, -beta, etc.)
    const baseVersion = version.split("-")[0];
    const parts = baseVersion.split(".");
    const major = parseInt(parts[0] ?? "0", 10);
    const minor = parseInt(parts[1] ?? "0", 10);
    const patch = parseInt(parts[2] ?? "0", 10);
    // Format: MMmmpp (2 digits each)
    return major * 10000 + minor * 100 + patch;
}
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
}

/** What a consumer of the controller node needs, without the right to close it. */
export interface ControllerResources {
    readonly node: ServerNode;
    readonly fabric: Fabric;
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

    close(): Promise<void>;
}

/** Build the controller node with its fabric, the WebRTC requestor and the optional OTA provider. */
export async function createControllerNode(options: ControllerNodeOptions): Promise<ControllerNode> {
    const { environment, id, adminVendorId, adminFabricId, adminFabricLabel, serverVersion } = options;
    const adminNodeId = NodeId(112233); // TODO Remove when we switch to random IDs

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
    });

    try {
        const otaProvider = options.enableOtaProvider
            ? await node.add(new Endpoint(OtaProviderEndpoint, { id: "ota-provider" }))
            : undefined;
        const webRtcRequestor = await node.add(new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }));

        await node.env.load(FabricManager);
        const fabricAuthority = await node.env.load(FabricAuthority);
        // Rotates the operational keypair on every start where a fabric already exists, so no long-lived
        // operational key is kept on disk. Peers still trust us: the NOC is reissued under the same CA and
        // fabric identifiers.
        const fabric = await fabricAuthority.defaultFabric({
            adminFabricLabel,
            adminVendorId,
            adminNodeId,
            adminFabricId,
        });

        if (options.peerSettingsRepair !== undefined) {
            await repairRestoredPeers(node, id, options.peerSettingsRepair);
        }

        return { node, fabric, otaProvider, webRtcRequestor, close: () => node.close() };
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
