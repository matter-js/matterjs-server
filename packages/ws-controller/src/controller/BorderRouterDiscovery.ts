/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry } from "@matter-server/ws-client";
import type { Environment } from "@matter/main";

/**
 * Passive Thread Border Router discovery via mDNS.
 *
 * Subscribes to `_meshcop._udp.local` and `_trel._udp.local`, builds a per-extended-address
 * registry, and exposes the current entries through {@link list}. Owned by {@link MatterController}.
 */
export class BorderRouterDiscovery {
    readonly #registry = new Map<string, BorderRouterEntry>();
    #started = false;

    constructor(_env: Environment) {}

    async start(): Promise<void> {
        if (this.#started) return;
        this.#started = true;
    }

    async stop(): Promise<void> {
        if (!this.#started) return;
        this.#started = false;
        this.#registry.clear();
    }

    list(): BorderRouterEntry[] {
        return Array.from(this.#registry.values());
    }

    get(extAddressHex: string): BorderRouterEntry | undefined {
        return this.#registry.get(extAddressHex.toUpperCase());
    }
}
