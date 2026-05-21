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
    OtbrRestProbe,
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
    borderRouters: Pick<BorderRouterRegistry, "list" | "events">;
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
    /** OTBR REST probe port. Defaults to 8081. */
    restProbePort?: number;
    /** OTBR REST probe timeout in ms. Defaults to 1500. */
    restProbeTimeoutMs?: number;
    /** @internal — for testing. Override the probe factory. */
    probeRest?: (host: string, port: number, timeoutMs: number) => Promise<OtbrRestCapability | null>;
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
    static readonly DEFAULT_REST_PROBE_PORT = 8081;
    static readonly DEFAULT_REST_PROBE_TIMEOUT_MS = 1_500;

    readonly events = {
        batchUpdated: new Observable<[ThreadDiagnosticsBatch]>(),
    };

    readonly #opts: ThreadDiagnosticsServiceOpts;
    readonly #cache = new Map<string, ThreadDiagnosticsBatch>();
    readonly #restCaps = new Map<string, OtbrRestCapability>();
    /** In-flight probe promises keyed by extPanIdHex (lowercase). Coalesces
     *  concurrent triggers that fire for the same xp within one event batch. */
    readonly #probesInFlight = new Map<string, Promise<void>>();
    /** xps we've already attempted to probe at least once (success or failure).
     *  Gates `updated`-event probes — mDNS refreshes TXT/A records frequently,
     *  but a BR that didn't expose REST on first sight will not start exposing
     *  it via a TXT update; spamming probes on every refresh is pure waste.
     *  Cleared on `force=true` fetches and on `removed` events so re-discovery
     *  can happen when the user explicitly asks. */
    readonly #probeAttempted = new Set<string>();
    readonly #lockManager = new ExtPanIdLockManager();
    readonly #cacheTtlMs: number;
    readonly #collectMs: number;
    readonly #restProbePort: number;
    readonly #restProbeTimeoutMs: number;
    readonly #probeRest: (host: string, port: number, timeoutMs: number) => Promise<OtbrRestCapability | null>;

    constructor(opts: ThreadDiagnosticsServiceOpts) {
        this.#opts = opts;
        this.#cacheTtlMs = opts.cacheTtlMs ?? ThreadDiagnosticsService.DEFAULT_TTL_MS;
        this.#collectMs = opts.collectMs ?? ThreadDiagnosticsService.DEFAULT_COLLECT_MS;
        this.#restProbePort = opts.restProbePort ?? ThreadDiagnosticsService.DEFAULT_REST_PROBE_PORT;
        this.#restProbeTimeoutMs = opts.restProbeTimeoutMs ?? ThreadDiagnosticsService.DEFAULT_REST_PROBE_TIMEOUT_MS;
        this.#probeRest = opts.probeRest ?? ((host, port, timeoutMs) => OtbrRestProbe.probe(host, port, timeoutMs));

        // Probe REST when a BR is first discovered. Deliberately not wired to
        // `updated` — mDNS refreshes fire continuously and a BR that doesn't
        // expose REST on first sight won't start exposing it via a TXT refresh.
        // `force=true` on `getOrFetch` is the explicit re-probe path.
        opts.borderRouters.events.added.on(br => {
            void this.#probeBrForRest(br);
        });
        opts.borderRouters.events.removed.on(br => {
            this.#handleBrRemoved(br);
        });
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
        const xp = key.toUpperCase();
        const force = opts?.force === true;

        logger.info(`[ThreadDiag] getOrFetch xp=${xp} force=${force}`);

        if (!force) {
            const cached = this.#cache.get(key);
            if (cached !== undefined && Date.now() - cached.collectedAt < this.#cacheTtlMs) {
                logger.info(
                    `[ThreadDiag] cache HIT xp=${xp} age=${Date.now() - cached.collectedAt}ms source=${cached.source} nodes=${cached.nodes.length}`,
                );
                return cached;
            }
        }

        const extPanIdBytes = decodeExtPanIdHex(key);

        const matchingBrs = this.#opts.borderRouters
            .list()
            .filter(br => br.extendedPanIdHex !== undefined && br.extendedPanIdHex.toLowerCase() === key);

        if (matchingBrs.length === 0) {
            logger.info(`[ThreadDiag] no BR matches xp=${xp} -> partial(border_router_unreachable)`);
            const networkName = this.#cache.get(key)?.networkName ?? "";
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        const br = selectBr(matchingBrs);
        if (br === undefined) {
            logger.info(`[ThreadDiag] selectBr returned none xp=${xp} candidates=${matchingBrs.length}`);
            const networkName = matchingBrs[0].networkName ?? this.#cache.get(key)?.networkName ?? "";
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        const networkName = br.networkName ?? this.#cache.get(key)?.networkName ?? "";
        logger.info(
            `[ThreadDiag] BR picked xp=${xp} network="${networkName}" host="${br.hostname ?? "?"}" candidates=${matchingBrs.length}`,
        );

        // force=true is the dashboard "reload" path. Re-probe REST so a BR that came
        // online after first discovery (or whose REST cap was lost) gets rechecked.
        if (force) {
            this.#probeAttempted.delete(key);
            this.#restCaps.delete(key);
            await this.#probeBrForRest(br, { force: true });
        }

        const batch = await this.#fetch(key, networkName, br, extPanIdBytes);
        return this.#publish(batch);
    }

    #fetch(
        extPanIdHex: string,
        networkName: string,
        br: BorderRouterEntry,
        extPanIdBytes: Uint8Array,
    ): Promise<ThreadDiagnosticsBatch> {
        const xp = extPanIdHex.toUpperCase();
        return this.#lockManager.withLock(extPanIdBytes, async () => {
            const restCap = this.#restCaps.get(extPanIdHex);
            if (restCap !== undefined) {
                logger.info(`[ThreadDiag] source=REST xp=${xp} baseUrl=${restCap.baseUrl}`);
                return this.#runRest(extPanIdHex, networkName, restCap);
            }
            const creds = this.#opts.credentials.getCredentials(extPanIdBytes);
            if (creds !== undefined) {
                logger.info(`[ThreadDiag] source=MeshCoP xp=${xp} pskc-registered=true`);
                return this.#runMeshcop(extPanIdHex, networkName, creds, br);
            }
            logger.info(`[ThreadDiag] no source xp=${xp} -> partial(no_credentials)`);
            return this.#partial(extPanIdHex, networkName, "no_credentials");
        });
    }

    /**
     * Probe every routable BR address in parallel and register the first
     * successful REST capability against the BR's extPanId. Triggered eagerly
     * from `BorderRouterRegistry` `added`/`updated` events, plus on `force=true`
     * fetches. Idempotent — replaces any existing capability for the xp.
     *
     * Link-local addresses are skipped — Node `fetch` has no scope-id support.
     * Probes run concurrently so the worst-case wait per BR is the per-probe
     * timeout, not (timeout × address count). Losing probes finish in the
     * background but their results are ignored.
     */
    async #probeBrForRest(br: BorderRouterEntry, opts?: { force?: boolean }): Promise<void> {
        const xp = br.extendedPanIdHex;
        if (xp === undefined) return;
        const key = xp.toLowerCase();
        const force = opts?.force === true;

        // Coalesce concurrent triggers. Peer BRs sharing the same xp emit
        // separate `added` events; share one probe.
        const existing = this.#probesInFlight.get(key);
        if (existing !== undefined) {
            await existing;
            return;
        }

        // Skip if we've already tried this xp. force=true bypasses (reload button).
        if (!force && this.#probeAttempted.has(key)) return;

        const candidates = br.addresses.filter(addr => !isLinkLocal(addr));
        if (candidates.length === 0) return;

        const run = (async () => {
            const probes = candidates.map(async addr => {
                const cap = await this.#probeRest(addr, this.#restProbePort, this.#restProbeTimeoutMs);
                if (cap === null) {
                    throw new Error(`probe-miss for ${addr}`);
                }
                return cap;
            });

            try {
                const cap = await Promise.any(probes);
                this.#restCaps.set(key, cap);
                logger.info(`[ThreadDiag] REST auto-registered xp=${xp.toUpperCase()} baseUrl=${cap.baseUrl}`);
            } catch {
                // AggregateError — every probe rejected. Normal when BR has no REST endpoint.
            }
            this.#probeAttempted.add(key);
        })();

        this.#probesInFlight.set(key, run);
        try {
            await run;
        } finally {
            this.#probesInFlight.delete(key);
        }
    }

    /**
     * Cleanup hook for `BorderRouterRegistry.events.removed`. Drops the REST
     * capability for an xp only when no other BR currently advertises the same
     * network — otherwise a peer BR for the same Thread network is still
     * available via REST.
     */
    #handleBrRemoved(removed: BorderRouterEntry): void {
        const xp = removed.extendedPanIdHex;
        if (xp === undefined) return;
        const key = xp.toLowerCase();
        const stillPresent = this.#opts.borderRouters
            .list()
            .some(br => br.extendedPanIdHex !== undefined && br.extendedPanIdHex.toLowerCase() === key);
        if (stillPresent) return;
        if (this.#restCaps.delete(key)) {
            logger.info(
                `[ThreadDiag] REST capability unregistered xp=${xp.toUpperCase()} (last BR for network removed)`,
            );
        }
        // Clear probe-attempted marker so a future re-discovery (same xp coming back)
        // will re-probe instead of relying on stale state.
        this.#probeAttempted.delete(key);
    }

    async #runRest(extPanIdHex: string, networkName: string, cap: OtbrRestCapability): Promise<ThreadDiagnosticsBatch> {
        const xp = extPanIdHex.toUpperCase();
        const start = Date.now();
        try {
            const source = this.#opts.makeRestSource(cap);
            const nodes = await source.queryMulticast(MULTICAST_SCOPE_REALM_LOCAL, [...DefaultTlvSet], this.#collectMs);
            logger.info(`[ThreadDiag] REST OK xp=${xp} nodes=${nodes.length} duration=${Date.now() - start}ms`);
            return {
                extPanIdHex,
                networkName,
                collectedAt: Date.now(),
                source: "otbr-rest",
                nodes,
            };
        } catch (err) {
            logger.warn(`[ThreadDiag] REST FAIL xp=${xp} duration=${Date.now() - start}ms: ${err}`);
            return this.#partialOf(extPanIdHex, networkName, "otbr-rest", mapRestError(err));
        }
    }

    async #runMeshcop(
        extPanIdHex: string,
        networkName: string,
        creds: ThreadNetworkCredentials,
        br: BorderRouterEntry,
    ): Promise<ThreadDiagnosticsBatch> {
        const xp = extPanIdHex.toUpperCase();
        const start = Date.now();
        let handle: MeshcopSourceHandle | undefined;
        try {
            handle = await this.#opts.makeMeshcopSource(creds, br);
            const nodes = await handle.source.queryMulticast(
                MULTICAST_SCOPE_REALM_LOCAL,
                [...DefaultTlvSet],
                this.#collectMs,
            );
            logger.info(`[ThreadDiag] MeshCoP OK xp=${xp} nodes=${nodes.length} duration=${Date.now() - start}ms`);
            return {
                extPanIdHex,
                networkName,
                collectedAt: Date.now(),
                source: "meshcop",
                nodes,
            };
        } catch (err) {
            logger.warn(`[ThreadDiag] MeshCoP FAIL xp=${xp} duration=${Date.now() - start}ms: ${err}`);
            return this.#partial(extPanIdHex, networkName, mapMeshcopError(err));
        } finally {
            if (handle !== undefined) {
                try {
                    await handle.close();
                } catch (closeErr) {
                    logger.warn(`[ThreadDiag] MeshCoP close FAIL xp=${xp}: ${closeErr}`);
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
        logger.info(
            `[ThreadDiag] publish xp=${batch.extPanIdHex.toUpperCase()} source=${batch.source} nodes=${batch.nodes.length}${batch.partialReason ? ` partial=${batch.partialReason}` : ""}`,
        );
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

function isLinkLocal(addr: string): boolean {
    const lower = addr.toLowerCase();
    return lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb");
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
