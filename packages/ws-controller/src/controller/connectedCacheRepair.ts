/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Orchestrates the attribute-cache rebuild that runs when a node (re-)enters Connected.
 *
 * Shared by ControllerCommandHandler's Connected handler and its regression test so the
 * rebuild-before-broadcast ordering and the repair/fastReconnect gating cannot silently drift.
 *
 * Gating: a fast reconnect with cached attributes skips the (multi-second) rebuild — data is
 * unchanged and repaired via its own events — unless a watchdog trip forced a repair or the
 * cache is missing.
 *
 * A watchdog recovery means clients may hold stale data sent before the rebuild (availability
 * recovers before the cache update) — so push a full node update built from the repaired cache.
 * The broadcast MUST run after the cache update so it reflects the repaired data.
 */
export async function runConnectedCacheRepair(deps: {
    fastReconnect: boolean;
    watchdogRepair: boolean;
    hasCachedAttributes: boolean;
    updateCache: () => Promise<void>;
    emitNodeStructureChanged: () => void;
}): Promise<void> {
    const { fastReconnect, watchdogRepair, hasCachedAttributes, updateCache, emitNodeStructureChanged } = deps;
    if (!fastReconnect || watchdogRepair || !hasCachedAttributes) {
        await updateCache();
        if (watchdogRepair) {
            emitNodeStructureChanged();
        }
    }
}
