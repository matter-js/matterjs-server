/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type BorderRouterEntry,
    type BorderRouterRegistry,
    CommissionerRejectedError,
    CommissionerTimeoutError,
    DefaultTlvSet,
    type DiagnosticResponse,
    type DiagnosticSource,
    ExtPanIdLockManager,
    OtbrRestError,
    type OtbrRestCapability,
    type ThreadCredentialsRegistry,
    type ThreadNetworkCredentials,
    selectBr,
} from "@matter-server/thread-br";
import { Bytes, Logger, Observable } from "@matter/main";

const logger = Logger.get("ThreadDiagnosticsService");

export type ThreadDiagnosticsPartialReason =
    | "petition_rejected"
    | "dtls_failed"
    | "border_router_unreachable"
    | "no_credentials"
    | "no_source"
    | "rest_unreachable"
    | "rest_protocol"
    | "timeout";

export interface ThreadDiagnosticsBatch {
    /** 16-char lowercase hex of the extPanId. Internal cache key; serializeBatch uppercases for wire. */
    extPanIdHex: string;
    networkName: string;
    /** Epoch ms when the batch was assembled. */
    collectedAt: number;
    source: "meshcop" | "otbr-rest";
    nodes: ReadonlyArray<DiagnosticResponse>;
    partialReason?: ThreadDiagnosticsPartialReason;
}

export interface MeshcopSourceHandle {
    source: DiagnosticSource;
    close: () => Promise<void>;
}

export interface ThreadDiagnosticsServiceOpts {
    borderRouters: Pick<BorderRouterRegistry, "list">;
    credentials: Pick<ThreadCredentialsRegistry, "getCredentials">;
    /**
     * Async factory that orchestrates DTLS + CoAP + Commissioner setup for a MeshCoP query.
     * The handle's `close` is invoked unconditionally after each fetch, including on error.
     */
    makeMeshcopSource: (creds: ThreadNetworkCredentials, br: BorderRouterEntry) => Promise<MeshcopSourceHandle>;
    /** Sync factory — REST source has no resource lifecycle. */
    makeRestSource: (cap: OtbrRestCapability) => DiagnosticSource;
    /** Cache TTL in ms; defaults to {@link ThreadDiagnosticsService.DEFAULT_TTL_MS}. */
    cacheTtlMs?: number;
    /** Multicast collection window in ms; defaults to {@link ThreadDiagnosticsService.DEFAULT_COLLECT_MS}. */
    collectMs?: number;
}

// Aggregation across networks lives in the dashboard (Phase 10) — clients merge by
// extMacAddress against their own state. The server emits raw per-network batches.
const MULTICAST_SCOPE_REALM_LOCAL = "ff03::2" as const;

/**
 * Per-Thread-network diagnostic cache + fetch coordinator.
 *
 * Source priority (matches `selectSource` but expressed inline so async MeshCoP
 * setup can stay inside the per-network mutex):
 *   1. REST capability registered (auto-detected via OtbrRestProbe) → REST.
 *   2. Credentials registered for the BR's extPanId → MeshCoP.
 *   3. Neither → partial batch with `no_credentials`.
 */
export class ThreadDiagnosticsService {
    static readonly DEFAULT_TTL_MS = 3_600_000;
    static readonly DEFAULT_COLLECT_MS = 3_000;

    readonly events = {
        batchUpdated: new Observable<[ThreadDiagnosticsBatch]>(),
    };

    readonly #opts: ThreadDiagnosticsServiceOpts;
    readonly #cache = new Map<string, ThreadDiagnosticsBatch>();
    readonly #restCaps = new Map<string, OtbrRestCapability>();
    readonly #lockManager = new ExtPanIdLockManager();
    readonly #cacheTtlMs: number;
    readonly #collectMs: number;

    constructor(opts: ThreadDiagnosticsServiceOpts) {
        this.#opts = opts;
        this.#cacheTtlMs = opts.cacheTtlMs ?? ThreadDiagnosticsService.DEFAULT_TTL_MS;
        this.#collectMs = opts.collectMs ?? ThreadDiagnosticsService.DEFAULT_COLLECT_MS;
    }

    listCached(): ReadonlyArray<ThreadDiagnosticsBatch> {
        return Array.from(this.#cache.values());
    }

    registerRestCapability(extPanIdHex: string, cap: OtbrRestCapability): void {
        this.#restCaps.set(extPanIdHex.toLowerCase(), cap);
    }

    unregisterRestCapability(extPanIdHex: string): void {
        this.#restCaps.delete(extPanIdHex.toLowerCase());
    }

    async getOrFetch(extPanIdHex: string, opts?: { force?: boolean }): Promise<ThreadDiagnosticsBatch | undefined> {
        const key = extPanIdHex.toLowerCase();
        const force = opts?.force === true;

        if (!force) {
            const cached = this.#cache.get(key);
            if (cached !== undefined && Date.now() - cached.collectedAt < this.#cacheTtlMs) {
                return cached;
            }
        }

        const extPanIdBytes = decodeExtPanIdHex(key);

        const matchingBrs = this.#opts.borderRouters
            .list()
            .filter(br => br.extendedPanIdHex !== undefined && br.extendedPanIdHex.toLowerCase() === key);

        if (matchingBrs.length === 0) {
            const networkName = this.#cache.get(key)?.networkName ?? "";
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        const br = selectBr(matchingBrs);
        if (br === undefined) {
            const networkName = matchingBrs[0].networkName ?? this.#cache.get(key)?.networkName ?? "";
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        const networkName = br.networkName ?? this.#cache.get(key)?.networkName ?? "";
        const batch = await this.#fetch(key, networkName, br, extPanIdBytes);
        return this.#publish(batch);
    }

    #fetch(
        extPanIdHex: string,
        networkName: string,
        br: BorderRouterEntry,
        extPanIdBytes: Uint8Array,
    ): Promise<ThreadDiagnosticsBatch> {
        return this.#lockManager.withLock(extPanIdBytes, async () => {
            const restCap = this.#restCaps.get(extPanIdHex);
            if (restCap !== undefined) {
                return this.#runRest(extPanIdHex, networkName, restCap);
            }
            const creds = this.#opts.credentials.getCredentials(extPanIdBytes);
            if (creds !== undefined) {
                return this.#runMeshcop(extPanIdHex, networkName, creds, br);
            }
            return this.#partial(extPanIdHex, networkName, "no_credentials");
        });
    }

    async #runRest(extPanIdHex: string, networkName: string, cap: OtbrRestCapability): Promise<ThreadDiagnosticsBatch> {
        try {
            const source = this.#opts.makeRestSource(cap);
            const nodes = await source.queryMulticast(MULTICAST_SCOPE_REALM_LOCAL, [...DefaultTlvSet], this.#collectMs);
            return {
                extPanIdHex,
                networkName,
                collectedAt: Date.now(),
                source: "otbr-rest",
                nodes,
            };
        } catch (err) {
            logger.warn(`REST diagnostic fetch for xp=${extPanIdHex.toUpperCase()} failed: ${err}`);
            return this.#partialOf(extPanIdHex, networkName, "otbr-rest", mapRestError(err));
        }
    }

    async #runMeshcop(
        extPanIdHex: string,
        networkName: string,
        creds: ThreadNetworkCredentials,
        br: BorderRouterEntry,
    ): Promise<ThreadDiagnosticsBatch> {
        let handle: MeshcopSourceHandle | undefined;
        try {
            handle = await this.#opts.makeMeshcopSource(creds, br);
            const nodes = await handle.source.queryMulticast(
                MULTICAST_SCOPE_REALM_LOCAL,
                [...DefaultTlvSet],
                this.#collectMs,
            );
            return {
                extPanIdHex,
                networkName,
                collectedAt: Date.now(),
                source: "meshcop",
                nodes,
            };
        } catch (err) {
            logger.warn(`MeshCoP diagnostic fetch for xp=${extPanIdHex.toUpperCase()} failed: ${err}`);
            return this.#partial(extPanIdHex, networkName, mapMeshcopError(err));
        } finally {
            if (handle !== undefined) {
                try {
                    await handle.close();
                } catch (closeErr) {
                    logger.warn(`MeshCoP source close for xp=${extPanIdHex.toUpperCase()} failed: ${closeErr}`);
                }
            }
        }
    }

    #partial(
        extPanIdHex: string,
        networkName: string,
        partialReason: ThreadDiagnosticsPartialReason,
    ): ThreadDiagnosticsBatch {
        return this.#partialOf(extPanIdHex, networkName, "meshcop", partialReason);
    }

    #partialOf(
        extPanIdHex: string,
        networkName: string,
        source: "meshcop" | "otbr-rest",
        partialReason: ThreadDiagnosticsPartialReason,
    ): ThreadDiagnosticsBatch {
        return {
            extPanIdHex,
            networkName,
            collectedAt: Date.now(),
            source,
            nodes: [],
            partialReason,
        };
    }

    #publish(batch: ThreadDiagnosticsBatch): ThreadDiagnosticsBatch {
        this.#cache.set(batch.extPanIdHex, batch);
        this.events.batchUpdated.emit(batch);
        return batch;
    }
}

function decodeExtPanIdHex(hex: string): Uint8Array {
    if (!/^[0-9a-fA-F]{16}$/.test(hex)) {
        throw new Error(`Invalid extPanId hex: must be 16 hex characters, got ${JSON.stringify(hex)}`);
    }
    return Bytes.of(Bytes.fromHex(hex));
}

function mapRestError(err: unknown): ThreadDiagnosticsPartialReason {
    if (err instanceof OtbrRestError) {
        if (err.code === "rest_unreachable") return "rest_unreachable";
        if (err.code === "rest_protocol") return "rest_protocol";
    }
    return "timeout";
}

function mapMeshcopError(err: unknown): ThreadDiagnosticsPartialReason {
    if (err instanceof CommissionerRejectedError) return "petition_rejected";
    if (err instanceof CommissionerTimeoutError) return "timeout";
    if (err instanceof Error) {
        const name = err.name;
        if (name === "DtlsHandshakeError" || name.startsWith("Dtls")) return "dtls_failed";
        if (name === "CoapTimeoutError") return "timeout";
    }
    return "border_router_unreachable";
}
