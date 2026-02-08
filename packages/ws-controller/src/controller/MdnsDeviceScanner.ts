/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Proactive mDNS scanner for devices in WaitingForDeviceDiscovery state.
 *
 * When a device goes offline and comes back on a different IP, there is a timing
 * gap where the device's mDNS announcement can be missed because the matter.js
 * FullDiscovery waiter has not yet been registered. This scanner bridges that gap
 * by periodically doing short mDNS queries for nodes that are waiting for discovery.
 * When a device is found, triggerReconnect() is called on the PairedNode to
 * immediately attempt connection.
 */

import { CancelablePromise, Logger, Millis, NodeId, Time, Timer } from "@matter/main";
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";

const logger = Logger.get("MdnsDeviceScanner");

/** Interval between scan cycles for all waiting nodes. */
const SCAN_INTERVAL_MS = 30_000;

/** Result of an mDNS device discovery. */
export interface DiscoveredDevice {
    addresses: { ip: string }[];
}

export interface MdnsDeviceScannerDeps {
    /** Get all node IDs managed by the controller. */
    getNodeIds(): NodeId[];
    /** Get a PairedNode by its ID. */
    getNode(nodeId: NodeId): PairedNode;
    /** Discover a node's operational addresses via mDNS with a short timeout. */
    findDevice(nodeId: NodeId): Promise<DiscoveredDevice | undefined>;
    /** Delay in ms between scanning individual nodes. Defaults to 1000. */
    interNodeDelayMs?: number;
}

/**
 * Periodically scans mDNS for devices in WaitingForDeviceDiscovery state.
 *
 * When the matter.js reconnection flow transitions a node to WaitingForDeviceDiscovery,
 * it means the node could not be reached on its known addresses. Normally, matter.js
 * registers an mDNS waiter and also polls the old IP every 10 minutes. However, if
 * the device announced itself via mDNS before the waiter was registered, the
 * announcement is missed and the device is not found until the next 10-minute poll.
 *
 * This scanner runs every 30 seconds and does a short mDNS query for each
 * node in WaitingForDeviceDiscovery state. If the device is found (because it
 * recently announced or responds to the query), triggerReconnect() is called to
 * immediately attempt connection.
 */
export class MdnsDeviceScanner {
    #deps: MdnsDeviceScannerDeps;
    #scanTimer: Timer;
    #isScanning = false;
    #closed = false;
    #currentDelayPromise?: CancelablePromise;

    constructor(deps: MdnsDeviceScannerDeps) {
        this.#deps = deps;
        this.#scanTimer = Time.getTimer("mdns-device-scanner", Millis(SCAN_INTERVAL_MS), () => this.scanNow());
    }

    /**
     * Start the periodic mDNS scanner.
     */
    start(): void {
        if (this.#closed) return;
        logger.info("Starting mDNS device scanner for offline node recovery");
        this.#scanTimer.start();
    }

    /**
     * Stop the scanner and clean up resources.
     */
    stop(): void {
        this.#closed = true;
        this.#currentDelayPromise?.cancel(new Error("Close"));
        this.#scanTimer.stop();
        logger.info("mDNS device scanner stopped");
    }

    /**
     * Run an immediate scan of all nodes in WaitingForDeviceDiscovery state.
     * Can be called directly for on-demand scanning, or is invoked automatically
     * by the periodic timer.
     */
    async scanNow(): Promise<void> {
        if (this.#isScanning || this.#closed) return;
        this.#isScanning = true;

        try {
            const nodeIds = this.#deps.getNodeIds();
            const waitingNodes = nodeIds.filter(nodeId => {
                try {
                    const node = this.#deps.getNode(nodeId);
                    return node.connectionState === NodeStates.WaitingForDeviceDiscovery;
                } catch {
                    return false;
                }
            });

            if (waitingNodes.length === 0) {
                return;
            }

            logger.info(
                `Scanning mDNS for ${waitingNodes.length} node(s) waiting for discovery: ${waitingNodes.map(id => id.toString()).join(", ")}`,
            );

            for (let i = 0; i < waitingNodes.length; i++) {
                if (this.#closed) break;
                await this.#scanNode(waitingNodes[i]);

                // Small delay between nodes to avoid overwhelming the network
                const delayMs = this.#deps.interNodeDelayMs ?? 1_000;
                if (delayMs > 0 && i < waitingNodes.length - 1) {
                    this.#currentDelayPromise = Time.sleep("mdns-scan-delay", Millis(delayMs)).finally(() => {
                        this.#currentDelayPromise = undefined;
                    });
                    await this.#currentDelayPromise;
                }
            }
        } catch (error) {
            logger.warn("Error during mDNS device scan:", error);
        } finally {
            this.#isScanning = false;
            // Schedule the next scan
            if (!this.#closed) {
                this.#scanTimer.start();
            }
        }
    }

    /**
     * Do a short mDNS discovery for a single node. If found, trigger reconnection.
     */
    async #scanNode(nodeId: NodeId): Promise<void> {
        try {
            const node = this.#deps.getNode(nodeId);
            // Re-check state in case it changed while we were scanning other nodes
            if (node.connectionState !== NodeStates.WaitingForDeviceDiscovery) {
                return;
            }

            const device = await this.#deps.findDevice(nodeId);

            if (!device || device.addresses.length === 0) {
                return;
            }

            // Re-check state — it may have changed during the mDNS query
            if (node.connectionState !== NodeStates.WaitingForDeviceDiscovery) {
                return;
            }

            const addresses = device.addresses.map(addr => addr.ip);
            logger.info(
                `Node ${nodeId}: mDNS discovered device at ${addresses.join(", ")} while in WaitingForDeviceDiscovery — triggering reconnect`,
            );
            node.triggerReconnect();
        } catch (error) {
            logger.debug(`Node ${nodeId}: mDNS scan failed:`, error);
        }
    }
}
