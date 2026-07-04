/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, Logger, Observable } from "@matter/main";
import {
    type BorderRouterEntry,
    type BorderRouterRegistry,
    CommissionerRejectedError,
    CommissionerTimeoutError,
    DefaultTlvSet,
    type DiagnosticResponse,
    type DiagnosticSource,
    OtbrRestError,
    type OtbrRestCapability,
    OtbrRestProbe,
    type QueryMulticastHandle,
    type ThreadCredentialsRegistry,
    type ThreadNetworkCredentials,
    rankBrs,
} from "@matter/thread-br-client";

const logger = Logger.get("ThreadDiagnosticsService");

export type ThreadDiagnosticsPartialReason =
    | "petition_rejected"
    | "dtls_failed"
    | "border_router_unreachable"
    | "no_credentials"
    | "no_source"
    | "rest_unreachable"
    | "rest_protocol"
    | "timeout"
    | "in_progress"
    | "meshcop_no_responses_yet";

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
     * The handle's `close` is invoked unconditionally after the stream window closes.
     */
    makeMeshcopSource: (creds: ThreadNetworkCredentials, br: BorderRouterEntry) => Promise<MeshcopSourceHandle>;
    /** Sync factory — REST source has no resource lifecycle. */
    makeRestSource: (cap: OtbrRestCapability) => DiagnosticSource;
    /** Cache TTL in ms; defaults to {@link ThreadDiagnosticsService.DEFAULT_TTL_MS}. */
    cacheTtlMs?: number;
    /** Multicast collection window in ms; defaults to {@link ThreadDiagnosticsService.DEFAULT_WINDOW_MS}. */
    windowMs?: number;
    /** First-batch resolve delay in ms; defaults to {@link ThreadDiagnosticsService.DEFAULT_FIRST_BATCH_MS}. */
    firstBatchMs?: number;
    /** Debounce coalesce window for in-progress publishes in ms; defaults to {@link ThreadDiagnosticsService.DEFAULT_DEBOUNCE_MS}. */
    debounceMs?: number;
    /** OTBR REST probe port. Defaults to 8081. */
    restProbePort?: number;
    /** OTBR REST probe timeout in ms. Defaults to 1500. */
    restProbeTimeoutMs?: number;
    /** @internal — for testing. Override the probe factory. */
    probeRest?: (host: string, port: number, timeoutMs: number) => Promise<OtbrRestCapability | null>;
    /**
     * When false, the service performs no Thread BR interaction: it never probes
     * on discovery and every `getOrFetch` returns undefined. Defaults to true.
     */
    enabled?: boolean;
}

// Aggregation across networks lives in the dashboard (Phase 10) — clients merge by
// extMacAddress against their own state. The server emits raw per-network batches.
const MULTICAST_SCOPE_REALM_LOCAL = "ff03::2" as const;

interface InFlightStream {
    /** Resolves with the snapshot available at `firstBatchMs` (or earlier if `done` fires first). */
    readonly firstBatch: Promise<ThreadDiagnosticsBatch>;
    /** Resolves when the underlying handle/DTLS session has fully torn down. */
    readonly settled: Promise<void>;
    /** Aborts the stream early; `settled` resolves once teardown finishes. */
    cancel(): Promise<void>;
}

/**
 * Per-Thread-network diagnostic cache + streaming fetch coordinator.
 *
 * Source priority:
 *   1. REST capability registered → REST (fast, single-burst).
 *   2. Credentials registered for the BR's extPanId → MeshCoP (streaming).
 *   3. Neither → partial batch with `no_credentials`.
 *
 * MeshCoP queries stream: responses arrive over a `windowMs` window, the
 * service accumulates by extMacAddress, and emits debounced `batchUpdated`
 * events. The first-batch promise resolves at `firstBatchMs` (default 5s).
 *
 * Concurrent fetches for the same xp share one stream.
 */
export class ThreadDiagnosticsService {
    static readonly DEFAULT_TTL_MS = 3_600_000;
    static readonly DEFAULT_WINDOW_MS = 20_000;
    static readonly DEFAULT_FIRST_BATCH_MS = 5_000;
    static readonly DEFAULT_DEBOUNCE_MS = 5_000;
    static readonly DEFAULT_REST_PROBE_PORT = 8081;
    static readonly DEFAULT_REST_PROBE_TIMEOUT_MS = 1_500;

    readonly events = {
        batchUpdated: new Observable<[ThreadDiagnosticsBatch]>(),
    };

    readonly #opts: ThreadDiagnosticsServiceOpts;
    readonly #cache = new Map<string, ThreadDiagnosticsBatch>();
    readonly #restCaps = new Map<string, OtbrRestCapability>();
    readonly #streamsInFlight = new Map<string, InFlightStream>();
    readonly #probesInFlight = new Map<string, Promise<void>>();
    readonly #probeAttempted = new Set<string>();
    readonly #cacheTtlMs: number;
    readonly #windowMs: number;
    readonly #firstBatchMs: number;
    readonly #debounceMs: number;
    readonly #restProbePort: number;
    readonly #restProbeTimeoutMs: number;
    readonly #probeRest: (host: string, port: number, timeoutMs: number) => Promise<OtbrRestCapability | null>;
    readonly #enabled: boolean;

    constructor(opts: ThreadDiagnosticsServiceOpts) {
        this.#opts = opts;
        this.#enabled = opts.enabled ?? true;
        this.#cacheTtlMs = opts.cacheTtlMs ?? ThreadDiagnosticsService.DEFAULT_TTL_MS;
        this.#windowMs = opts.windowMs ?? ThreadDiagnosticsService.DEFAULT_WINDOW_MS;
        this.#firstBatchMs = opts.firstBatchMs ?? ThreadDiagnosticsService.DEFAULT_FIRST_BATCH_MS;
        this.#debounceMs = opts.debounceMs ?? ThreadDiagnosticsService.DEFAULT_DEBOUNCE_MS;
        this.#restProbePort = opts.restProbePort ?? ThreadDiagnosticsService.DEFAULT_REST_PROBE_PORT;
        this.#restProbeTimeoutMs = opts.restProbeTimeoutMs ?? ThreadDiagnosticsService.DEFAULT_REST_PROBE_TIMEOUT_MS;
        this.#probeRest = opts.probeRest ?? ((host, port, timeoutMs) => OtbrRestProbe.probe(host, port, timeoutMs));

        if (this.#enabled) {
            opts.borderRouters.events.added.on(br => {
                void this.#probeBrForRest(br);
            });
            opts.borderRouters.events.removed.on(br => {
                this.#handleBrRemoved(br);
            });
        }
    }

    listCached(): ReadonlyArray<ThreadDiagnosticsBatch> {
        return Array.from(this.#cache.values());
    }

    /**
     * Fire-and-forget `getOrFetch` for every distinct Thread network currently
     * advertised by a discovered Border Router. Used to populate diagnostics for
     * all known networks (e.g. when the Thread panel opens) without the caller
     * waiting on each; batches arrive via `events.batchUpdated`. No-op when disabled.
     */
    refreshAllKnown(): void {
        if (!this.#enabled) return;
        const seen = new Set<string>();
        for (const br of this.#opts.borderRouters.list()) {
            const xp = br.extendedPanIdHex;
            if (xp === undefined) continue;
            const key = xp.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            this.getOrFetch(key).catch(err => {
                logger.warn(`[ThreadDiag] background fetch xp=${xp.toUpperCase()} failed: ${err}`);
            });
        }
    }

    /** @internal — test seam: seed a REST capability without a live probe. */
    registerRestCapability(extPanIdHex: string, cap: OtbrRestCapability): void {
        this.#restCaps.set(extPanIdHex.toLowerCase(), cap);
    }

    /** @internal — test seam: clear a seeded REST capability. */
    unregisterRestCapability(extPanIdHex: string): void {
        this.#restCaps.delete(extPanIdHex.toLowerCase());
    }

    async getOrFetch(extPanIdHex: string, opts?: { force?: boolean }): Promise<ThreadDiagnosticsBatch | undefined> {
        const key = extPanIdHex.toLowerCase();
        const xp = key.toUpperCase();
        const force = opts?.force === true;

        if (!this.#enabled) return undefined;

        logger.debug(`[ThreadDiag] getOrFetch xp=${xp} force=${force}`);

        if (!force) {
            const cached = this.#cache.get(key);
            if (cached !== undefined && Date.now() - cached.collectedAt < this.#cacheTtlMs) {
                logger.debug(
                    `[ThreadDiag] cache HIT xp=${xp} age=${Date.now() - cached.collectedAt}ms source=${cached.source} nodes=${cached.nodes.length}`,
                );
                return cached;
            }
            const inFlight = this.#streamsInFlight.get(key);
            if (inFlight !== undefined) {
                logger.debug(`[ThreadDiag] join in-flight stream xp=${xp}`);
                return inFlight.firstBatch;
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

        const ranked = rankBrs(matchingBrs);
        const br = ranked[0];
        if (br === undefined) {
            logger.info(`[ThreadDiag] selectBr returned none xp=${xp} candidates=${matchingBrs.length}`);
            const networkName = matchingBrs[0].networkName ?? this.#cache.get(key)?.networkName ?? "";
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        const networkName = br.networkName ?? this.#cache.get(key)?.networkName ?? "";
        logger.debug(
            `[ThreadDiag] BR picked xp=${xp} network="${networkName}" host="${br.hostname ?? "?"}" candidates=${matchingBrs.length}`,
        );

        // Ensure a REST-capability probe has settled before transport selection: if
        // no capability is cached for this network, probe the chosen BR now (the
        // #probeAttempted guard keeps this a no-op once a BR has been probed, so a
        // known REST-less network is not re-checked on every query).
        if (this.#restCaps.get(key) === undefined) {
            await this.#probeBrForRest(br);
            // The probe's await yields; a concurrent non-force fetch may have
            // registered the shared stream meanwhile. Join it, don't start a second.
            if (!force) {
                const joined = this.#streamsInFlight.get(key);
                if (joined !== undefined) {
                    logger.debug(`[ThreadDiag] join in-flight stream (post-probe) xp=${xp}`);
                    return joined.firstBatch;
                }
            }
        }

        if (force) {
            const existing = this.#streamsInFlight.get(key);
            if (existing !== undefined) {
                logger.debug(`[ThreadDiag] force=true canceling in-flight stream xp=${xp}`);
                await existing.cancel();
            }
        }

        return this.#startStream(key, networkName, ranked, extPanIdBytes).firstBatch;
    }

    #startStream(
        extPanIdHex: string,
        networkName: string,
        brs: BorderRouterEntry[],
        extPanIdBytes: Uint8Array,
    ): InFlightStream {
        const xp = extPanIdHex.toUpperCase();
        const restCap = this.#restCaps.get(extPanIdHex);

        if (restCap !== undefined) {
            logger.debug(`[ThreadDiag] source=REST xp=${xp} baseUrl=${restCap.baseUrl}`);
            return this.#launchStream(extPanIdHex, networkName, "otbr-rest", async () => ({
                source: this.#opts.makeRestSource(restCap),
                close: async () => {},
            }));
        }

        const creds = this.#opts.credentials.getCredentials(extPanIdBytes);
        if (creds === undefined) {
            logger.info(`[ThreadDiag] no source xp=${xp} -> partial(no_credentials)`);
            const partial = this.#partial(extPanIdHex, networkName, "no_credentials");
            this.#publish(partial);
            const settled = Promise.resolve();
            return {
                firstBatch: Promise.resolve(partial),
                settled,
                cancel: () => settled,
            };
        }

        logger.debug(`[ThreadDiag] source=MeshCoP xp=${xp} pskc-registered=true candidates=${brs.length}`);
        return this.#launchStream(extPanIdHex, networkName, "meshcop", () =>
            this.#acquireMeshcopWithFallback(xp, creds, brs),
        );
    }

    /**
     * Acquire a MeshCoP source, trying ranked BR candidates in order until one
     * accepts the DTLS/petition handshake. A single unreachable BR (e.g. a stale
     * mDNS address) no longer fails the whole network when another BR serves it.
     */
    async #acquireMeshcopWithFallback(
        xp: string,
        creds: ThreadNetworkCredentials,
        brs: BorderRouterEntry[],
    ): Promise<MeshcopSourceHandle> {
        let lastErr: unknown;
        for (let i = 0; i < brs.length; i++) {
            const br = brs[i];
            try {
                return await this.#opts.makeMeshcopSource(creds, br);
            } catch (err) {
                lastErr = err;
                logger.warn(
                    `[ThreadDiag] meshcop connect FAIL xp=${xp} host="${br.hostname ?? "?"}" candidate=${i + 1}/${brs.length}: ${err}`,
                );
            }
        }
        if (lastErr instanceof Error) throw lastErr;
        throw new Error(
            lastErr === undefined ? "no reachable Border Router candidates" : `meshcop connect failed: ${lastErr}`,
        );
    }

    /**
     * Acquire a source via the supplied factory, then drive a streaming
     * multicast query against it. Single shared implementation for REST and
     * MeshCoP — they only differ in how the source handle is obtained.
     */
    #launchStream(
        extPanIdHex: string,
        networkName: string,
        sourceKind: "meshcop" | "otbr-rest",
        acquire: () => Promise<MeshcopSourceHandle>,
    ): InFlightStream {
        const xp = extPanIdHex.toUpperCase();
        const start = Date.now();

        let firstBatchResolve!: (batch: ThreadDiagnosticsBatch) => void;
        const firstBatch = new Promise<ThreadDiagnosticsBatch>(r => {
            firstBatchResolve = r;
        });
        const firstBatchSettled = { resolved: false };

        let cancelled = false;
        let activeHandle: QueryMulticastHandle | undefined;
        let activeSourceHandle: MeshcopSourceHandle | undefined;

        const resolveFirstBatchOnce = (batch: ThreadDiagnosticsBatch) => {
            if (firstBatchSettled.resolved) return;
            firstBatchSettled.resolved = true;
            firstBatchResolve(batch);
        };

        const settled = (async (): Promise<void> => {
            try {
                activeSourceHandle = await acquire();
                if (cancelled) {
                    resolveFirstBatchOnce(this.#partial(extPanIdHex, networkName, "timeout"));
                    return;
                }
                activeHandle = activeSourceHandle.source.queryMulticast(MULTICAST_SCOPE_REALM_LOCAL, {
                    tlvTypes: [...DefaultTlvSet],
                    windowMs: this.#windowMs,
                });
                await this.#driveStream(extPanIdHex, networkName, sourceKind, activeHandle, resolveFirstBatchOnce);
                logger.debug(`[ThreadDiag] ${sourceKind} DONE xp=${xp} duration=${Date.now() - start}ms`);
            } catch (err) {
                logger.warn(`[ThreadDiag] ${sourceKind} FAIL xp=${xp} duration=${Date.now() - start}ms: ${err}`);
                const reason = sourceKind === "otbr-rest" ? mapRestError(err) : mapMeshcopError(err);
                const partial = this.#partialOf(extPanIdHex, networkName, sourceKind, reason);
                this.#publish(partial);
                resolveFirstBatchOnce(partial);
            } finally {
                if (activeHandle !== undefined) {
                    await activeHandle.close().catch(() => {});
                }
                if (activeSourceHandle !== undefined) {
                    try {
                        await activeSourceHandle.close();
                    } catch (closeErr) {
                        logger.warn(`[ThreadDiag] ${sourceKind} close FAIL xp=${xp}: ${closeErr}`);
                    }
                }
                this.#streamsInFlight.delete(extPanIdHex);
            }
        })();

        const stream: InFlightStream = {
            firstBatch,
            settled,
            cancel: async () => {
                cancelled = true;
                if (activeHandle !== undefined) {
                    await activeHandle.close().catch(() => {});
                }
                await settled.catch(() => {});
            },
        };
        this.#streamsInFlight.set(extPanIdHex, stream);
        return stream;
    }

    async #driveStream(
        extPanIdHex: string,
        networkName: string,
        sourceKind: "meshcop" | "otbr-rest",
        handle: QueryMulticastHandle,
        resolveFirstBatch: (batch: ThreadDiagnosticsBatch) => void,
    ): Promise<void> {
        const xp = extPanIdHex.toUpperCase();
        const acc = new Map<string, DiagnosticResponse>();
        let fallbackKeyCounter = 0;
        let firstBatchFired = false;

        const snapshot = (partialReason: ThreadDiagnosticsPartialReason | undefined): ThreadDiagnosticsBatch => ({
            extPanIdHex,
            networkName,
            collectedAt: Date.now(),
            source: sourceKind,
            nodes: Array.from(acc.values()),
            partialReason,
        });

        const streamStart = Date.now();
        let debounceTimer: NodeJS.Timeout | undefined;

        const scheduleDebouncedFlush = () => {
            if (debounceTimer !== undefined) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                debounceTimer = undefined;
                logger.debug(`[ThreadDiag] stream debounced flush xp=${xp} acc=${acc.size}`);
                this.#publish(snapshot("in_progress"));
            }, this.#debounceMs);
        };

        handle.onNode.on((node: DiagnosticResponse) => {
            const key =
                node.extMacAddress !== undefined
                    ? Bytes.toHex(node.extMacAddress).toLowerCase()
                    : node.rloc16 !== undefined
                      ? `rloc16:${node.rloc16}`
                      : `idx:${fallbackKeyCounter++}`;
            const isNew = !acc.has(key);
            acc.set(key, node);
            const rloc = node.rloc16 !== undefined ? `0x${node.rloc16.toString(16).padStart(4, "0")}` : "?";
            logger.debug(
                `[ThreadDiag] stream arrival xp=${xp} source=${sourceKind} mac=${key} rloc16=${rloc} new=${isNew} acc=${acc.size} t+${Date.now() - streamStart}ms`,
            );
            if (firstBatchFired) {
                scheduleDebouncedFlush();
            }
        });
        handle.onError.on((err: Error) => {
            logger.warn(`[ThreadDiag] stream error xp=${xp}: ${err.message}`);
        });

        const firstBatchTimer = setTimeout(() => {
            firstBatchFired = true;
            const reason = acc.size === 0 ? "meshcop_no_responses_yet" : "in_progress";
            logger.debug(
                `[ThreadDiag] stream firstBatch xp=${xp} acc=${acc.size} partial=${reason} t+${Date.now() - streamStart}ms`,
            );
            resolveFirstBatch(this.#publish(snapshot(reason)));
        }, this.#firstBatchMs);

        try {
            await handle.done;
        } finally {
            clearTimeout(firstBatchTimer);
            if (debounceTimer !== undefined) {
                clearTimeout(debounceTimer);
                debounceTimer = undefined;
            }
        }

        firstBatchFired = true;
        logger.info(`[ThreadDiag] ${sourceKind} OK xp=${xp} nodes=${acc.size} t+${Date.now() - streamStart}ms`);
        const finalBatch = this.#publish(snapshot(undefined));
        resolveFirstBatch(finalBatch);
    }

    async #probeBrForRest(br: BorderRouterEntry, opts?: { force?: boolean }): Promise<void> {
        const xp = br.extendedPanIdHex;
        if (xp === undefined) return;
        const key = xp.toLowerCase();
        const force = opts?.force === true;

        const existing = this.#probesInFlight.get(key);
        if (existing !== undefined) {
            await existing;
            return;
        }

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
        this.#probeAttempted.delete(key);
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
        logger.debug(
            `[ThreadDiag] publish xp=${batch.extPanIdHex.toUpperCase()} source=${batch.source} nodes=${batch.nodes.length}${batch.partialReason ? ` partial=${batch.partialReason}` : ""}`,
        );
        if (batch.nodes.length > 0) {
            let withConnectivity = 0;
            let withRoute64 = 0;
            let withChildTable = 0;
            let totalRoute64Entries = 0;
            let totalChildTableEntries = 0;
            for (const n of batch.nodes) {
                if (n.connectivity !== undefined) withConnectivity++;
                if (n.route64 !== undefined) {
                    withRoute64++;
                    totalRoute64Entries += n.route64.entries.length;
                }
                if (n.childTable !== undefined) {
                    withChildTable++;
                    totalChildTableEntries += n.childTable.length;
                }
            }
            logger.debug(
                `[ThreadDiag] batch contents xp=${batch.extPanIdHex.toUpperCase()} connectivity=${withConnectivity}/${batch.nodes.length} route64=${withRoute64}/${batch.nodes.length} (${totalRoute64Entries} entries) childTable=${withChildTable}/${batch.nodes.length} (${totalChildTableEntries} entries)`,
            );
        }
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
