/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, MatterClient, ThreadDiagnosticsBatch } from "@matter-server/ws-client";

/**
 * Snapshot of mDNS-discovered Thread Border Routers and the most recent Thread diagnostic
 * batch per network.
 *
 * Refreshed on Thread-graph mount and on the reload-button click. The BR map is keyed by the
 * uppercase 16-char xa hex so callers can join against neighbor-table extended addresses
 * normalized to the same casing. The diagnostic map is keyed by the uppercase 16-char
 * extPanId hex so callers can join against {@link BorderRouterEntry.extendedPanIdHex}.
 */
export class BorderRouterStore {
    // Replaced (not mutated) on every refresh so Lit consumers passing this map as a
    // @property() detect the snapshot change via the default `===` identity compare and
    // re-render. Mutating in place would keep the same reference and silently skip updates.
    #entries: ReadonlyMap<string, BorderRouterEntry> = new Map();
    #diagnostics: ReadonlyMap<string, ThreadDiagnosticsBatch> = new Map();

    get entries(): ReadonlyMap<string, BorderRouterEntry> {
        return this.#entries;
    }

    get diagnostics(): ReadonlyMap<string, ThreadDiagnosticsBatch> {
        return this.#diagnostics;
    }

    async refresh(client: MatterClient): Promise<void> {
        const list = await client.sendCommand("get_thread_border_routers", 0, {});
        const next = new Map<string, BorderRouterEntry>();
        for (const entry of list) {
            next.set(entry.extAddressHex.toUpperCase(), entry);
        }
        this.#entries = next;

        const result = await client.sendCommand("get_thread_diagnostics", 0, {});
        const batches = Array.isArray(result) ? result : result === undefined ? [] : [result];
        const nextDiag = new Map<string, ThreadDiagnosticsBatch>();
        for (const batch of batches) {
            nextDiag.set(batch.extPanIdHex.toUpperCase(), batch);
        }
        this.#diagnostics = nextDiag;
    }

    /** Apply a single batch update from a thread_diagnostics_updated event. */
    applyBatch(batch: ThreadDiagnosticsBatch): void {
        const next = new Map(this.#diagnostics);
        next.set(batch.extPanIdHex.toUpperCase(), batch);
        this.#diagnostics = next;
    }

    /** Force-refresh diagnostics for a single network. */
    async refreshDiagnosticsFor(client: MatterClient, extPanIdHex: string): Promise<void> {
        const result = await client.sendCommand("get_thread_diagnostics", 0, {
            extPanId: extPanIdHex.toLowerCase(),
            force: true,
        });
        if (result === undefined) return;
        if (Array.isArray(result)) {
            for (const batch of result) this.applyBatch(batch);
        } else {
            this.applyBatch(result);
        }
    }

    reset(): void {
        this.#entries = new Map();
        this.#diagnostics = new Map();
    }
}
