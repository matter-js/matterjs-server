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
    readonly #entries = new Map<string, BorderRouterEntry>();

    get entries(): ReadonlyMap<string, BorderRouterEntry> {
        return this.#entries;
    }

    async refresh(client: MatterClient): Promise<void> {
        const list = await client.sendCommand("get_thread_border_routers", 0, {});
        this.#entries.clear();
        for (const entry of list) {
            this.#entries.set(entry.extAddressHex.toUpperCase(), entry);
        }
        console.info(
            `[BorderRouterStore] snapshot received: ${list.length} entries`,
            Array.from(this.#entries.entries()),
        );
    }

    reset(): void {
        this.#entries.clear();
    }
}
