/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { isObject, Logger } from "@matter/main";
import type { StorageContext, StorageService, SupportedStorageTypes } from "@matter/main";

const logger = Logger.get("StoredDiscoveryTtl");

/** A stored address TTL is a uint32 in milliseconds; matter.js rejects anything outside. */
const MAX_ADDRESS_TTL_MS = 0xffff_ffff;

/**
 * Repair the discovery TTLs in the stored commissioning state of every node.
 *
 * matter.js 0.15.4 to 0.16.10 multiplied the state TTL, and 0.15.4 to 0.16.1 also each address TTL, by 1000 each
 * time the value was loaded and written back, until it overflowed to `Infinity`, which storage writes as `null`.
 * matter.js 0.18 validates both, so a node holding `null` or an address TTL above the uint32 range fails to load, and
 * address lookups then fail for the nodes stored after it.
 *
 * The state TTL is removed unconditionally: it is stale after a restart and matter.js uses it only to expire nodes
 * that are not commissioned.  An address TTL is removed only when it is `null` or outside the uint32 range, because
 * it decides which of several stored addresses survives.
 *
 * Call before the `ServerNode` with this id is created; it opens and closes the node's storage itself.
 *
 * TODO Remove once matter.js repairs the stored TTLs on load.
 */
export async function removeStoredDiscoveryTtl(storageService: StorageService, nodeId: string): Promise<void> {
    const storage = await storageService.open(nodeId);
    try {
        const nodes = storage.createContext("nodes");
        let repaired = 0;
        for (const peerId of await nodes.contexts()) {
            try {
                if (await repairNode(nodes.createContext(peerId))) {
                    repaired++;
                }
            } catch (error) {
                logger.warn(`Could not repair the stored discovery TTL of node ${peerId}:`, error);
            }
        }
        if (repaired > 0) {
            logger.info(`Repaired the stored discovery TTL of ${repaired} node(s)`);
        }
    } finally {
        await storage.close();
    }
}

async function repairNode(node: StorageContext) {
    const commissioning = node.createContext("endpoints").createContext("0").createContext("commissioning");
    let changed = false;
    if (await commissioning.has("ttl")) {
        await commissioning.delete("ttl");
        changed = true;
    }
    if (await commissioning.has("addresses")) {
        const addresses = await commissioning.get<SupportedStorageTypes>("addresses");
        if (Array.isArray(addresses) && addresses.some(hasInvalidTtl)) {
            await commissioning.set("addresses", addresses.map(withoutInvalidTtl));
            changed = true;
        }
    }
    return changed;
}

function hasInvalidTtl(address: SupportedStorageTypes) {
    if (!isObject(address)) {
        return false;
    }
    const { ttl } = address;
    if (ttl === null) {
        return true;
    }
    if (typeof ttl !== "number" && typeof ttl !== "bigint") {
        return false;
    }
    const ms = Number(ttl);
    return !Number.isFinite(ms) || ms < 0 || ms > MAX_ADDRESS_TTL_MS;
}

function withoutInvalidTtl(address: SupportedStorageTypes) {
    if (!hasInvalidTtl(address) || !isObject(address)) {
        return address;
    }
    const { ttl: _ttl, ...rest } = address;
    return rest;
}
