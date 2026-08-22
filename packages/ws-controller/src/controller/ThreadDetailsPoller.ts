/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Polls the Thread topology attributes of Thread nodes.
 *
 * NeighborTable and RouteTable are reported by most devices only when their subscription is
 * (re)established, so a long-running server shows increasingly stale link and route data. A read
 * makes the node produce current values, which flow into the attribute cache and out as
 * attribute_updated exactly like a subscription report.
 */

import {
    getNetworkTypeFromAttributes,
    isLongIdleTimeDevice,
    THREAD_TOPOLOGY_ATTRIBUTE_PATHS,
} from "@matter-server/ws-client";
import { asError, Diagnostic, Hours, Logger, Millis } from "@matter/main";
import { PeerAddress, PeerAddressMap } from "@matter/main/protocol";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { NodeAttributeReader, NodeProcessor } from "./NodeProcessor.js";
import { STARTUP_BASE_DELAY as TIME_SYNC_STARTUP_BASE_DELAY } from "./TimeSyncManager.js";

const logger = Logger.get("ThreadDetailsPoller");

const POLL_INTERVAL = Hours(24);

// Twice the time sync startup base delay: nodes initialize at roughly 10 per minute, so this clears
// initialization on all but the largest installations before the first sweep.
const INITIAL_DELAY = Millis(2 * TIME_SYNC_STARTUP_BASE_DELAY);

/** Topology attribute paths worth polling for this node, empty for a node that is not on Thread. */
export function threadDetailPaths(attributes: AttributesData): string[] {
    if (getNetworkTypeFromAttributes(attributes) !== "thread") {
        return [];
    }
    return THREAD_TOPOLOGY_ATTRIBUTE_PATHS.filter(path => attributes[path] !== undefined);
}

export class ThreadDetailsPoller extends NodeProcessor {
    #polledPaths = new PeerAddressMap<string[]>();
    readonly #attributeReader: NodeAttributeReader;

    constructor(attributeReader: NodeAttributeReader) {
        super("thread-details-poller", INITIAL_DELAY, POLL_INTERVAL);
        this.#attributeReader = attributeReader;
    }

    /**
     * Register a node for topology polling if it is a Thread node. Call this once a node is connected
     * and its attributes are available.
     */
    registerNode(peer: PeerAddress, attributes: AttributesData): void {
        if (this.closed) return;
        const paths = threadDetailPaths(attributes);
        if (paths.length === 0) {
            this.unregisterNode(peer);
            return;
        }

        this.#polledPaths.set(peer, paths);
        if (this.registerPeer(peer, isLongIdleTimeDevice(attributes))) {
            logger.info(`Registered node ${formatNodeId(peer)} for Thread topology polling`);
        }

        this.scheduleIfNeeded();
    }

    unregisterNode(peer: PeerAddress): void {
        this.#polledPaths.delete(peer);
        if (this.unregisterPeer(peer)) {
            logger.info(`Unregistered node ${formatNodeId(peer)} from Thread topology polling`);
        }
    }

    override async stop(): Promise<void> {
        await super.stop();
        // A long idle time batch outlives stop(), but its reads captured their paths before the first
        // await, so clearing here cannot strand one mid-flight.
        this.#polledPaths.clear();
        logger.info("Thread topology poller stopped");
    }

    protected override shouldProcess(peer: PeerAddress): boolean {
        return this.#attributeReader.nodeConnected(peer);
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        const paths = this.#polledPaths.get(peer);
        if (!paths) return;

        try {
            // fabricFiltered must match the node subscription's filter, else matter.js discards the
            // read and no attributeChanged fires, leaving the cache stale.
            await this.#attributeReader.handleReadAttributes(peer, paths, true);
        } catch (error) {
            logger.warn(
                `Failed to poll Thread topology for node ${formatNodeId(peer)}: `,
                Diagnostic.errorMessage(asError(error)),
            );
        }
    }

    protected override onCycleComplete(processedCount: number, intervalFormatted: string): void {
        if (processedCount > 0) {
            const next = intervalFormatted === "" ? "" : ` Next poll in ${intervalFormatted}.`;
            logger.info(`Polled Thread topology of ${processedCount} nodes.${next}`);
        }
    }
}
