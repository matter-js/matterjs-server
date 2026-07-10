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
    type DiagnosticDetailTransport,
    type DiagnosticResponse,
    type DiagnosticSource,
    OtbrRestError,
    type OtbrRestCapability,
    OtbrRestProbe,
    type QueryMulticastHandle,
    type ThreadCredentialsRegistry,
    type ThreadNetworkCredentials,
    rankBrs,
    selectSource,
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
    /** Transport that produced the batch; `"none"` when no transport was attempted (terminal partials). */
    source: "meshcop" | "otbr-rest" | "none";
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
    /**
     * Preferred transport when a network has BOTH a REST capability and Thread credentials.
     * Defaults to `"coap"` — the REST collection API drives one BR-managed action per node and is
     * markedly slower than direct CoAP. `"rest"` forces the REST action path (REST-only BRs / debug).
     */
    detailTransport?: DiagnosticDetailTransport;
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
 * Transport selection is delegated to the library's `selectSource`:
 *   - Credentials + a REST capability → a hybrid that prefers CoAP (`detailTransport`, default).
 *   - Only one available → that transport (a `"none"` REST capability is treated as absent).
 *   - Neither → partial batch with `no_credentials`.
 * The emitted batch's `source` reflects the transport that actually served it, not what was configured.
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
    readonly #keyLocks = new Map<string, Promise<void>>();
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
    readonly #detailTransport?: DiagnosticDetailTransport;
    #stopped = false;

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
        this.#detailTransport = opts.detailTransport;

        if (this.#enabled) {
            opts.borderRouters.events.added.on(br => {
                this.#probeBrForRest(br).catch(err =>
                    logger.warn(`REST probe failed xp=${br.extendedPanIdHex ?? "?"}: ${err}`),
                );
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
    refreshAllKnown(opts?: { force?: boolean }): void {
        if (!this.#enabled) return;
        const seen = new Set<string>();
        for (const br of this.#opts.borderRouters.list()) {
            const xp = br.extendedPanIdHex;
            if (xp === undefined) continue;
            const key = xp.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            this.getOrFetch(key, { force: opts?.force }).catch(err => {
                logger.warn(`background fetch xp=${xp.toUpperCase()} failed: ${err}`);
            });
        }
    }

    /**
     * Cancel every in-flight diagnostic stream, aborting its MeshCoP/CoAP session and timers. Called
     * on controller shutdown so streams don't outlive the environment being torn down. Idempotent.
     */
    async stop(): Promise<void> {
        // Set first so any getOrFetch still awaiting a probe aborts before launching a fresh stream.
        this.#stopped = true;
        const inFlight = Array.from(this.#streamsInFlight.values());
        await Promise.all(
            inFlight.map(stream => stream.cancel().catch(err => logger.warn(`stream cancel failed: ${err}`))),
        );
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

        if (!this.#enabled || this.#stopped) return undefined;

        logger.debug(`getOrFetch xp=${xp} force=${force}`);

        if (!force) {
            const cached = this.#cache.get(key);
            // Only a completed fetch (no partialReason) is a cache hit. Terminal partials
            // (no_credentials, *_unreachable, dtls_failed, …) must not stick for the full
            // TTL — re-fetch so a later credential registration or a recovered BR is picked
            // up. A mid-stream snapshot falls through to the in-flight join below.
            if (
                cached !== undefined &&
                cached.partialReason === undefined &&
                Date.now() - cached.collectedAt < this.#cacheTtlMs
            ) {
                logger.debug(
                    `cache HIT xp=${xp} age=${Date.now() - cached.collectedAt}ms source=${cached.source} nodes=${cached.nodes.length}`,
                );
                return cached;
            }
            const inFlight = this.#streamsInFlight.get(key);
            if (inFlight !== undefined) {
                logger.debug(`join in-flight stream xp=${xp}`);
                return inFlight.firstBatch;
            }
        }

        const extPanIdBytes = decodeExtPanIdHex(key);

        const matchingBrs = this.#opts.borderRouters
            .list()
            .filter(br => br.extendedPanIdHex !== undefined && br.extendedPanIdHex.toLowerCase() === key);

        if (matchingBrs.length === 0) {
            logger.info(`no BR matches xp=${xp} -> partial(border_router_unreachable)`);
            const networkName = this.#cache.get(key)?.networkName ?? "";
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        const ranked = rankBrs(matchingBrs);
        const br = ranked[0];
        if (br === undefined) {
            logger.info(`rankBrs returned none (no dialable BR addresses) xp=${xp} candidates=${matchingBrs.length}`);
            const networkName = matchingBrs[0].networkName ?? this.#cache.get(key)?.networkName ?? "";
            return this.#fetchRestOnly(key, networkName, matchingBrs, extPanIdBytes, force);
        }

        const networkName = br.networkName ?? this.#cache.get(key)?.networkName ?? "";
        logger.debug(
            `BR picked xp=${xp} network="${networkName}" host="${br.hostname ?? "?"}" candidates=${matchingBrs.length}`,
        );

        // Ensure a REST-capability probe has settled before transport selection: if
        // no capability is cached for this network, probe the chosen BR now. The
        // #probeAttempted guard keeps this a no-op once a BR has been probed (so a
        // known REST-less network is not re-checked on every passive query) — but a
        // force refresh re-probes, so a transient earlier miss can recover instead of
        // pinning the network to MeshCoP until the next mDNS re-announce.
        if (this.#restCaps.get(key) === undefined) {
            await this.#probeBrForRest(br, { force });
            // The probe's await yields; a concurrent non-force fetch may have
            // registered the shared stream meanwhile. Join it, don't start a second.
            if (!force) {
                const joined = this.#streamsInFlight.get(key);
                if (joined !== undefined) {
                    logger.debug(`join in-flight stream (post-probe) xp=${xp}`);
                    return joined.firstBatch;
                }
            }
        }

        // The probe above awaits; if shutdown began meanwhile, don't launch a fresh stream that
        // stop()'s snapshot has already passed over (it would outlive teardown).
        if (this.#stopped) return undefined;

        return this.#cancelAndStart(key, networkName, ranked, extPanIdBytes, force);
    }

    /**
     * Diagnostics path for a network whose every BR is undialable (`rankBrs` returned none). MeshCoP
     * is impossible without a dialable address, but the OTBR REST API needs only the extPanId + a
     * registered `baseUrl`. Probe for a REST capability (a no-op for an address-less BR, but a cap
     * cached from an earlier `added`-event probe still counts) and, if one can serve diagnostics,
     * stream REST-only. Only when no usable cap exists is the network truly `border_router_unreachable`.
     */
    async #fetchRestOnly(
        key: string,
        networkName: string,
        matchingBrs: BorderRouterEntry[],
        extPanIdBytes: Uint8Array,
        force: boolean,
    ): Promise<ThreadDiagnosticsBatch | undefined> {
        const xp = key.toUpperCase();

        if (this.#restCaps.get(key) === undefined) {
            await this.#probeBrForRest(matchingBrs[0], { force });
            if (!force) {
                const joined = this.#streamsInFlight.get(key);
                if (joined !== undefined) {
                    logger.debug(`join in-flight stream (rest-only post-probe) xp=${xp}`);
                    return joined.firstBatch;
                }
            }
        }

        if (this.#stopped) return undefined;

        const cap = this.#restCaps.get(key);
        if (cap === undefined || cap.diagnosticsApi === "none") {
            return this.#publish(this.#partial(key, networkName, "border_router_unreachable"));
        }

        logger.info(`BRs undialable, using REST-only diagnostics xp=${xp} baseUrl=${cap.baseUrl}`);
        return this.#cancelAndStart(key, networkName, matchingBrs, extPanIdBytes, force, { restOnly: true });
    }

    /**
     * Serialize the cancel-old-then-start-new critical section per network. `#launchStream` registers
     * the stream synchronously, but a `force` refresh must `await existing.cancel()` first — two
     * concurrent callers would otherwise each read the same in-flight stream, cancel it, and register a
     * replacement, leaving two live streams and a `#streamsInFlight` entry that the first stream's
     * teardown later deletes out from under the second. The per-key lock makes the section atomic;
     * `firstBatch` is awaited by the caller outside the lock so joiners are not blocked for a window.
     */
    async #cancelAndStart(
        key: string,
        networkName: string,
        brs: BorderRouterEntry[],
        extPanIdBytes: Uint8Array,
        force: boolean,
        opts?: { restOnly?: boolean },
    ): Promise<ThreadDiagnosticsBatch | undefined> {
        const xp = key.toUpperCase();
        const stream = await this.#serialize(key, async () => {
            // A concurrent caller may have registered a stream while we waited on the lock. A
            // non-force fetch joins it; a force fetch cancels it and starts fresh.
            const existing = this.#streamsInFlight.get(key);
            if (existing !== undefined) {
                if (!force) {
                    logger.debug(`join in-flight stream (serialized) xp=${xp}`);
                    return existing;
                }
                logger.debug(`force=true canceling in-flight stream xp=${xp}`);
                await existing.cancel();
            }
            if (this.#stopped) return undefined;
            return this.#startStream(key, networkName, brs, extPanIdBytes, opts);
        });
        return stream?.firstBatch;
    }

    /**
     * Run `fn` after any previously queued work for `key` has settled, so per-key critical sections
     * never overlap. The lock entry is dropped once no further work is chained behind it.
     */
    async #serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.#keyLocks.get(key) ?? Promise.resolve();
        const run = prev.then(fn, fn);
        const tail = run.then(
            () => {},
            () => {},
        );
        this.#keyLocks.set(key, tail);
        try {
            return await run;
        } finally {
            if (this.#keyLocks.get(key) === tail) this.#keyLocks.delete(key);
        }
    }

    #startStream(
        extPanIdHex: string,
        networkName: string,
        brs: BorderRouterEntry[],
        extPanIdBytes: Uint8Array,
        opts?: { restOnly?: boolean },
    ): InFlightStream {
        const xp = extPanIdHex.toUpperCase();
        const restOnly = opts?.restOnly === true;
        const restCap = this.#restCaps.get(extPanIdHex);
        const creds = this.#opts.credentials.getCredentials(extPanIdBytes);

        // A "none" cap can't serve diagnostics (selectSource ignores it), so it doesn't count as a source.
        const restUsable = restCap !== undefined && restCap.diagnosticsApi !== "none";
        if (!restUsable && creds === undefined) {
            logger.info(`no source xp=${xp} -> partial(no_credentials)`);
            const partial = this.#partial(extPanIdHex, networkName, "no_credentials");
            this.#publish(partial);
            const settled = Promise.resolve();
            return {
                firstBatch: Promise.resolve(partial),
                settled,
                cancel: () => settled,
            };
        }

        return this.#launchStream(extPanIdHex, networkName, () =>
            this.#acquireHybrid(xp, brs, restCap, creds, restOnly),
        );
    }

    /**
     * Build the diagnostic source for a network via the library's `selectSource`. When credentials
     * exist the MeshCoP transport is connected up front (DTLS handshake, BR-fallback) so the sync
     * `selectSource` factory can hand back the ready source; REST is stateless. If the MeshCoP
     * connect fails but a REST capability exists, degrade to REST-only by hiding the credentials from
     * `selectSource` rather than failing the whole fetch. When `restOnly` is set the credentials are
     * hidden up front — every BR is undialable, so a MeshCoP connect would only fail before the same
     * REST degrade; skip it entirely.
     */
    async #acquireHybrid(
        xp: string,
        brs: BorderRouterEntry[],
        restCap: OtbrRestCapability | undefined,
        creds: ThreadNetworkCredentials | undefined,
        restOnly = false,
    ): Promise<MeshcopSourceHandle> {
        // A "none" cap can't serve diagnostics, so it is not a viable REST fallback for a DTLS failure.
        const restUsable = restCap !== undefined && restCap.diagnosticsApi !== "none";
        let meshHandle: MeshcopSourceHandle | undefined;
        let credentials: Pick<ThreadCredentialsRegistry, "getCredentials"> = this.#opts.credentials;
        if (restOnly) {
            credentials = { getCredentials: () => undefined };
        } else if (creds !== undefined) {
            try {
                meshHandle = await this.#acquireMeshcopWithFallback(xp, creds, brs);
            } catch (err) {
                if (!restUsable) throw err;
                logger.warn(`meshcop unavailable, falling back to REST xp=${xp}: ${err}`);
                credentials = { getCredentials: () => undefined };
            }
        }

        // Any throw past this point must not strand the open DTLS session — close it before rethrowing.
        try {
            const source = selectSource({
                br: brs[0],
                credentials,
                restCapabilities: this.#restCaps,
                otbrRestEnabled: true,
                makeRestSource: cap => this.#opts.makeRestSource(cap),
                makeMeshcopSource: () => {
                    if (meshHandle === undefined) {
                        throw new Error(`meshcop source requested but not connected xp=${xp}`);
                    }
                    return meshHandle.source;
                },
                detailTransport: this.#detailTransport,
            });

            if (source === undefined) {
                throw new Error(`no diagnostic source available xp=${xp}`);
            }

            logger.debug(
                `source=${source.kind} xp=${xp}${restCap !== undefined ? ` rest=${restCap.diagnosticsApi}` : ""}${meshHandle !== undefined ? " coap=connected" : ""}`,
            );
            return { source, close: () => meshHandle?.close() ?? Promise.resolve() };
        } catch (err) {
            await meshHandle?.close().catch(() => {});
            throw err;
        }
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
                    `meshcop connect FAIL xp=${xp} host="${br.hostname ?? "?"}" candidate=${i + 1}/${brs.length}: ${err}`,
                );
            }
        }
        if (lastErr instanceof Error) throw lastErr;
        throw new Error(
            lastErr === undefined ? "no reachable Border Router candidates" : `meshcop connect failed: ${lastErr}`,
        );
    }

    /**
     * Acquire a source via the supplied factory, then drive a streaming multicast query against it.
     * The transport kind (for labeling + error mapping) is read from the acquired source; a failure
     * before acquire completes is attributed to MeshCoP, since only its connect runs at that point.
     */
    #launchStream(
        extPanIdHex: string,
        networkName: string,
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
        let sourceKind: "meshcop" | "otbr-rest" = "meshcop";
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
                sourceKind = activeSourceHandle.source.kind;
                if (cancelled) {
                    resolveFirstBatchOnce(this.#partial(extPanIdHex, networkName, "timeout"));
                    return;
                }
                activeHandle = activeSourceHandle.source.queryMulticast(MULTICAST_SCOPE_REALM_LOCAL, {
                    tlvTypes: [...DefaultTlvSet],
                    windowMs: this.#windowMs,
                });
                await this.#driveStream(extPanIdHex, networkName, sourceKind, activeHandle, resolveFirstBatchOnce);
                logger.debug(`${sourceKind} DONE xp=${xp} duration=${Date.now() - start}ms`);
            } catch (err) {
                logger.warn(`${sourceKind} FAIL xp=${xp} duration=${Date.now() - start}ms: ${err}`);
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
                        logger.warn(`${sourceKind} close FAIL xp=${xp}: ${closeErr}`);
                    }
                }
                // Safe to clear unconditionally: force-refresh awaits this stream's teardown (via
                // cancel → settled) before registering a replacement, so no other stream owns the key here.
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
                logger.debug(`stream debounced flush xp=${xp} acc=${acc.size}`);
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
                `stream arrival xp=${xp} source=${sourceKind} mac=${key} rloc16=${rloc} new=${isNew} acc=${acc.size} t+${Date.now() - streamStart}ms`,
            );
            if (firstBatchFired) {
                scheduleDebouncedFlush();
            }
        });
        let lastError: Error | undefined;
        handle.onError.on((err: Error) => {
            lastError = err;
            logger.warn(`stream error xp=${xp}: ${err.message}`);
        });

        const firstBatchTimer = setTimeout(() => {
            firstBatchFired = true;
            const reason = acc.size === 0 ? "meshcop_no_responses_yet" : "in_progress";
            logger.debug(
                `stream firstBatch xp=${xp} acc=${acc.size} partial=${reason} t+${Date.now() - streamStart}ms`,
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

        // The library reports a fatal query failure (e.g. petition rejected) via `onError` and still
        // resolves `done` (matter.js: thread-br-client `queryMulticast().done` never rejects). If the
        // query ended errored with nothing collected, publish a partial with the mapped reason so it is
        // not cached as a complete empty result for the full TTL.
        if (acc.size === 0 && lastError !== undefined) {
            const reason = sourceKind === "otbr-rest" ? mapRestError(lastError) : mapMeshcopError(lastError);
            logger.info(`${sourceKind} FAIL xp=${xp} (stream error, no nodes) -> partial(${reason})`);
            const partial = this.#publish(this.#partialOf(extPanIdHex, networkName, sourceKind, reason));
            resolveFirstBatch(partial);
            return;
        }

        logger.info(`${sourceKind} OK xp=${xp} nodes=${acc.size} t+${Date.now() - streamStart}ms`);
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
                logger.info(`REST auto-registered xp=${xp.toUpperCase()} baseUrl=${cap.baseUrl}`);
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
            logger.info(`REST capability unregistered xp=${xp.toUpperCase()} (last BR for network removed)`);
        }
        this.#probeAttempted.delete(key);
    }

    #partial(
        extPanIdHex: string,
        networkName: string,
        partialReason: ThreadDiagnosticsPartialReason,
    ): ThreadDiagnosticsBatch {
        return this.#partialOf(extPanIdHex, networkName, "none", partialReason);
    }

    #partialOf(
        extPanIdHex: string,
        networkName: string,
        source: "meshcop" | "otbr-rest" | "none",
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
            `publish xp=${batch.extPanIdHex.toUpperCase()} source=${batch.source} nodes=${batch.nodes.length}${batch.partialReason ? ` partial=${batch.partialReason}` : ""}`,
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
                `batch contents xp=${batch.extPanIdHex.toUpperCase()} connectivity=${withConnectivity}/${batch.nodes.length} route64=${withRoute64}/${batch.nodes.length} (${totalRoute64Entries} entries) childTable=${withChildTable}/${batch.nodes.length} (${totalChildTableEntries} entries)`,
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
        // rest_protocol/disabled/unsupported/not_allowed/conflict: the BR answered but cannot serve
        // diagnostics over REST. Collapse to rest_protocol — the wire contract has no finer reason.
        return "rest_protocol";
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
