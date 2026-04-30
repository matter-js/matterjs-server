/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, Observable } from "@matter/main";
import type { OperationalDataset } from "../dataset/OperationalDataset.js";
import type { ThreadNetworkCredentials } from "./ThreadNetworkCredentials.js";

/**
 * In-memory registry of {@link ThreadNetworkCredentials} keyed by extended PAN ID.
 *
 * Source of truth for "what credentials do we have to talk to which Thread network".
 * Diagnostic flows look up entries by extPanId; the network key is dropped on
 * registration so the registry never holds it.
 */
export class ThreadCredentialsRegistry {
    readonly #byExtPanId = new Map<string, ThreadNetworkCredentials>();
    readonly events = {
        registered: new Observable<[creds: ThreadNetworkCredentials]>(),
        unregistered: new Observable<[extPanId: Uint8Array]>(),
    };

    /**
     * Register credentials extracted from a parsed Operational Dataset.
     * Throws if the dataset lacks `extPanId`, `networkName`, or `pskc`.
     * Replaces any existing entry for the same extPanId.
     */
    register(dataset: OperationalDataset): void {
        if (dataset.extPanId === undefined) {
            throw new Error("Cannot register credentials: dataset is missing extPanId");
        }
        if (dataset.networkName === undefined) {
            throw new Error("Cannot register credentials: dataset is missing networkName");
        }
        if (dataset.pskc === undefined) {
            throw new Error("Cannot register credentials: dataset is missing pskc");
        }
        const creds: ThreadNetworkCredentials = {
            extPanId: dataset.extPanId.slice(),
            networkName: dataset.networkName,
            pskc: dataset.pskc.slice(),
            activeTimestamp: dataset.activeTimestamp === undefined ? undefined : bytesToBigint(dataset.activeTimestamp),
        };
        this.registerCredentials(creds);
    }

    /**
     * Register credentials directly. Intended for tests and external sources
     * that don't carry a full dataset. Same replacement semantics as {@link register}.
     *
     * Replacement always fires `registered` once with the new entry; the old entry
     * is silently overwritten because consumers care about "what is current", not
     * about churn. Intentional even when the new dataset's `activeTimestamp` is
     * older — losing an update is worse than a noisy log line.
     */
    registerCredentials(creds: ThreadNetworkCredentials): void {
        const key = keyOf(creds.extPanId);
        this.#byExtPanId.set(key, creds);
        this.events.registered.emit(creds);
    }

    /** Remove an entry. No-op if absent. */
    unregister(extPanId: Uint8Array): void {
        const key = keyOf(extPanId);
        if (!this.#byExtPanId.has(key)) return;
        this.#byExtPanId.delete(key);
        this.events.unregistered.emit(extPanId.slice());
    }

    /** Lookup by extPanId. Comparison is by Uint8Array equality, not reference. */
    getCredentials(extPanId: Uint8Array): ThreadNetworkCredentials | undefined {
        return this.#byExtPanId.get(keyOf(extPanId));
    }

    /** Defensive snapshot — caller cannot mutate the registry through it. */
    list(): ReadonlyArray<ThreadNetworkCredentials> {
        return Array.from(this.#byExtPanId.values());
    }
}

function keyOf(extPanId: Uint8Array): string {
    return Bytes.toHex(extPanId);
}

function bytesToBigint(bytes: Uint8Array): bigint {
    let result = 0n;
    for (const b of bytes) {
        result = (result << 8n) | BigInt(b);
    }
    return result;
}
