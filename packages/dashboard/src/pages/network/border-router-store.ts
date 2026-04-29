/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, MatterClient } from "@matter-server/ws-client";

/**
 * Snapshot of mDNS-discovered Thread Border Routers.
 *
 * Refreshed on Thread-graph mount and on the reload-button click. The map is keyed by the
 * uppercase 16-char xa hex so callers can join against neighbor-table extended addresses
 * normalized to the same casing.
 */
export class BorderRouterStore {
    // Replaced (not mutated) on every refresh so Lit consumers passing this map as a
    // @property() detect the snapshot change via the default `===` identity compare and
    // re-render. Mutating in place would keep the same reference and silently skip updates.
    #entries: ReadonlyMap<string, BorderRouterEntry> = new Map();

    get entries(): ReadonlyMap<string, BorderRouterEntry> {
        return this.#entries;
    }

    async refresh(client: MatterClient): Promise<void> {
        const list = await client.sendCommand("get_thread_border_routers", 0, {});
        const next = new Map<string, BorderRouterEntry>();
        for (const entry of list) {
            next.set(entry.extAddressHex.toUpperCase(), entry);
        }
        this.#entries = next;
    }

    reset(): void {
        this.#entries = new Map();
    }
}
