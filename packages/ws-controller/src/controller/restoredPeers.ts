/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, Logger, NetworkClient, ServerNode } from "@matter/main";

const logger = Logger.get("RestoredPeers");

/**
 * One-shot record of the peer network settings repair, scoped to the storage the peers live in.
 */
export interface PeerSettingsRepairMarker {
    /** Storage scope the repair has already run for, or undefined while it is outstanding. */
    readonly peerSettingsRepairedFor: string | undefined;

    markPeerSettingsRepaired(scope: string): Promise<void>;
}

/**
 * Repair the stored network settings of peers commissioned before the controller handed peer startup to
 * matter.js. Those versions connected each peer by hand and persisted `isDisabled: true` and
 * `autoSubscribe: false` to keep matter.js out of it, so a peer left as stored is skipped by the
 * controller's own start-up connect, or started without a subscription: no reports, no connection state,
 * and nothing for consumers to observe.
 *
 * Runs once per storage scope. Repeating it on every start would fight any later feature that disables a
 * peer on purpose, because `isDisabled` is exactly where such a decision is persisted.
 *
 * Call before the controller node goes online, so the corrected settings are what matter.js acts on.
 *
 * @returns the number of peers whose settings were rewritten
 */
export async function repairRestoredPeers(
    node: ServerNode,
    scope: string,
    marker: PeerSettingsRepairMarker,
): Promise<number> {
    if (marker.peerSettingsRepairedFor === scope) {
        return 0;
    }

    let repaired = 0;
    let failed = 0;
    for (const peer of node.peers) {
        try {
            if (await repairRestoredPeer(peer)) {
                repaired++;
            }
        } catch (error) {
            failed++;
            logger.warn(`Could not repair the stored network settings of ${peer}:`, error);
        }
    }

    if (repaired > 0) {
        logger.info(`Repaired the stored network settings of ${repaired} peer(s) from an earlier version`);
    }
    if (failed > 0) {
        // Recording the scope as done would strand those peers disabled forever, so the next start
        // repeats the pass. Repairing an already-repaired peer writes nothing.
        logger.warn(`${failed} peer(s) still need repairing; the next start tries again`);
        return repaired;
    }

    await marker.markPeerSettingsRepaired(scope);
    return repaired;
}

/** @returns true when the peer's stored settings needed a rewrite */
export async function repairRestoredPeer(peer: ClientNode): Promise<boolean> {
    const network = peer.maybeStateOf(NetworkClient);
    if (network === undefined) {
        return false;
    }

    const patch: { autoSubscribe?: boolean; isDisabled?: boolean; defaultSubscription?: undefined } = {};
    if (network.isDisabled === true) {
        patch.isDisabled = false;
    }
    if (!network.autoSubscribe) {
        patch.autoSubscribe = true;
    }
    if (network.defaultSubscription !== undefined) {
        // Subscription parameters are matter.js's to choose now; a stored set from the hand-driven era
        // would pin this peer to those intervals forever.
        patch.defaultSubscription = undefined;
    }

    if (Object.keys(patch).length === 0) {
        return false;
    }
    await peer.set({ network: patch });
    return true;
}
