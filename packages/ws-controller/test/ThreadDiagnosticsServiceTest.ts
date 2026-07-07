/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Observable } from "@matter/main";
import {
    type BorderRouterEntry,
    type BorderRouterRegistry,
    CommissionerRejectedError,
    CommissionerTimeoutError,
    type DiagnosticResponse,
    type DiagnosticSource,
    OtbrRestError,
    type OtbrRestCapability,
    type QueryMulticastHandle,
    type ThreadCredentialsRegistry,
    type ThreadNetworkCredentials,
} from "@matter/thread-br-client";
import {
    type MeshcopSourceHandle,
    ThreadDiagnosticsBatch,
    ThreadDiagnosticsService,
} from "../src/controller/ThreadDiagnosticsService.js";

const EXT_PAN_BYTES = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
const EXT_PAN_HEX_LOWER = "1122334455667788";
const EXT_PAN_HEX_UPPER = "1122334455667788".toUpperCase();
const OTHER_EXT_PAN_BYTES = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11]);
const OTHER_EXT_PAN_HEX_LOWER = "aabbccddeeff0011";

const FAST_TIMING = {
    windowMs: 20,
    firstBatchMs: 5,
    debounceMs: 5,
};

function makeBr(overrides: Partial<BorderRouterEntry> = {}): BorderRouterEntry {
    return {
        extAddressHex: "AAAAAAAAAAAAAAAA",
        extendedPanIdHex: EXT_PAN_HEX_UPPER,
        networkName: "OpenThread",
        addresses: ["fd00::1"],
        sources: ["meshcop"],
        lastSeen: 0,
        ...overrides,
    };
}

function makeCreds(extPanId: Uint8Array = EXT_PAN_BYTES): ThreadNetworkCredentials {
    return {
        extPanId: extPanId.slice(),
        networkName: "OpenThread",
        pskc: new Uint8Array(16),
        activeTimestamp: 0n,
    };
}

function makeCap(): OtbrRestCapability {
    return {
        baseUrl: "http://example.test",
        keyFormat: "camel",
        probedAt: 0,
        networkName: "OpenThread",
        extPanId: EXT_PAN_BYTES.slice(),
        diagnosticsApi: "collection",
    };
}

interface BrEvents {
    added: Observable<[BorderRouterEntry]>;
    updated: Observable<[BorderRouterEntry]>;
    removed: Observable<[BorderRouterEntry]>;
}

interface BorderRoutersStub {
    list: () => BorderRouterEntry[];
    events: BrEvents;
}

function makeBrEvents(): BrEvents {
    return {
        added: new Observable<[BorderRouterEntry]>(),
        updated: new Observable<[BorderRouterEntry]>(),
        removed: new Observable<[BorderRouterEntry]>(),
    };
}

interface CredentialsStub {
    getCredentials: (extPanId: Uint8Array) => ThreadNetworkCredentials | undefined;
}

function brsListing(brs: BorderRouterEntry[]): BorderRoutersStub {
    return {
        list: () => brs.map(b => ({ ...b, sources: [...b.sources], addresses: [...b.addresses] })),
        events: makeBrEvents(),
    };
}

function credsLookup(byHex: Map<string, ThreadNetworkCredentials>): CredentialsStub {
    return {
        getCredentials: extPanId => {
            const key = Array.from(extPanId, b => b.toString(16).padStart(2, "0")).join("");
            return byHex.get(key);
        },
    };
}

const SAMPLE_NODE: DiagnosticResponse = {
    extMacAddress: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    rloc16: 0x0400,
    unknown: [],
};

interface ScriptedHandleOpts {
    /** Pre-canned nodes emitted immediately on subscription. */
    nodes?: DiagnosticResponse[];
    /** If true, do not auto-resolve `done`; the caller controls it via `close()` or windowMs. */
    keepOpen?: boolean;
    /** Resolution delay in ms before emitting nodes + done. Defaults to 0. */
    delayMs?: number;
    /** If set, reject `done` with this error after emitting nodes. */
    rejectWith?: Error;
    onClose?: () => void;
}

function scriptedHandle(opts: ScriptedHandleOpts = {}): QueryMulticastHandle {
    const onNode = new Observable<[DiagnosticResponse]>();
    const onError = new Observable<[Error]>();
    let resolveDone!: () => void;
    let rejectDone!: (err: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
    });
    let closed = false;
    setTimeout(() => {
        if (closed) return;
        for (const node of opts.nodes ?? []) {
            onNode.emit(node);
        }
        if (!opts.keepOpen) {
            if (opts.rejectWith !== undefined) {
                rejectDone(opts.rejectWith);
            } else {
                resolveDone();
            }
        }
    }, opts.delayMs ?? 0);
    return {
        onNode,
        onError,
        done,
        close: async () => {
            if (closed) return;
            closed = true;
            opts.onClose?.();
            resolveDone();
        },
    };
}

function syncRestSource(nodes: DiagnosticResponse[]): DiagnosticSource {
    return {
        kind: "otbr-rest",
        canQuery: () => true,
        queryUnicast: async () => nodes[0] ?? { unknown: [] },
        queryMulticast: () => scriptedHandle({ nodes }),
        resetCounters: async () => {},
    };
}

function syncMeshcopSource(nodes: DiagnosticResponse[]): DiagnosticSource {
    return {
        kind: "meshcop",
        canQuery: () => true,
        queryUnicast: async () => nodes[0] ?? { unknown: [] },
        queryMulticast: () => scriptedHandle({ nodes }),
        resetCounters: async () => {},
    };
}

function failingMeshcopSource(err: Error): DiagnosticSource {
    return {
        kind: "meshcop",
        canQuery: () => true,
        queryUnicast: async () => ({ unknown: [] }),
        queryMulticast: () => {
            throw err;
        },
        resetCounters: async () => {},
    };
}

function failingRestSource(err: OtbrRestError): DiagnosticSource {
    return {
        kind: "otbr-rest",
        canQuery: () => true,
        queryUnicast: async () => ({ unknown: [] }),
        queryMulticast: () => {
            throw err;
        },
        resetCounters: async () => {},
    };
}

function meshcopHandle(source: DiagnosticSource, onClose?: () => void): MeshcopSourceHandle {
    return {
        source,
        close: async () => {
            onClose?.();
        },
    };
}

function brRegistryFrom(stub: BorderRoutersStub): Pick<BorderRouterRegistry, "list" | "events"> {
    return stub;
}

function credsRegistryFrom(stub: CredentialsStub): Pick<ThreadCredentialsRegistry, "getCredentials"> {
    return stub;
}

describe("ThreadDiagnosticsService", () => {
    it("returns the cached batch within TTL without invoking factories", async () => {
        const restCalls = new Array<number>();
        const meshcopCalls = new Array<number>();
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => {
                restCalls.push(1);
                return syncRestSource([]);
            },
            makeMeshcopSource: async () => {
                meshcopCalls.push(1);
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
        });

        const first = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(first?.nodes).to.have.lengthOf(1);
        expect(meshcopCalls).to.have.lengthOf(1);

        const second = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(second).to.equal(first);
        expect(meshcopCalls).to.have.lengthOf(1);
        expect(restCalls).to.deep.equal([]);
    });

    it("re-fetches after a terminal partial instead of serving it stale", async () => {
        // A cached partial (e.g. no_credentials) must not stick for the TTL: a
        // non-force fetch after credentials are registered must re-run, not HIT.
        const credsMap = new Map<string, ThreadNetworkCredentials>();
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(credsMap)),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => null,
        });

        const first = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(first?.partialReason).to.equal("no_credentials");
        expect(meshcopCalls).to.equal(0);

        credsMap.set(EXT_PAN_HEX_LOWER, makeCreds());
        const second = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(second?.partialReason).to.equal(undefined);
        expect(second?.nodes).to.have.lengthOf(1);
        expect(meshcopCalls).to.equal(1);
    });

    it("force=true bypasses the cache", async () => {
        let calls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            probeRest: async () => null,
            makeMeshcopSource: async () => {
                calls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });

        expect(calls).to.equal(2);
    });

    it("emits batchUpdated for every fresh fetch", async () => {
        const events = new Array<ThreadDiagnosticsBatch>();
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            probeRest: async () => null,
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([SAMPLE_NODE])),
        });
        service.events.batchUpdated.on(b => {
            events.push(b);
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });

        // First batch is published when firstBatch resolves and the final batch
        // is published when the window closes — at least one event per fetch.
        expect(events.length).to.be.greaterThanOrEqual(2);
        expect(events[0].nodes.length).to.be.greaterThan(0);
    });

    it("yields border_router_unreachable when no BRs match the extPanId", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("border_router_unreachable");
        expect(batch?.nodes).to.deep.equal([]);
    });

    it("yields no_credentials when BRs match but neither creds nor REST cap exist", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("no_credentials");
        expect(batch?.source).to.equal("meshcop");
    });

    it("uses REST for a capability-only network (no credentials)", async () => {
        let restCalls = 0;
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([]));
            },
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("otbr-rest");
        expect(batch?.nodes).to.have.lengthOf(1);
        expect(restCalls).to.equal(1);
        expect(meshcopCalls).to.equal(0);
    });

    it("prefers CoAP (hybrid) when a network has both credentials and a REST capability", async () => {
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("meshcop");
        expect(batch?.nodes).to.have.lengthOf(1);
        expect(meshcopCalls).to.equal(1);
    });

    it("detailTransport 'rest' forces the REST path even when credentials exist", async () => {
        let restCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            detailTransport: "rest",
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("otbr-rest");
        expect(batch?.nodes).to.have.lengthOf(1);
        expect(restCalls).to.equal(1);
    });

    it("treats a diagnosticsApi='none' cap as no source when no credentials exist", async () => {
        let restCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, { ...makeCap(), diagnosticsApi: "none" });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("no_credentials");
        expect(restCalls).to.equal(0);
    });

    it("concurrent fetches for the same extPanId share a single stream", async () => {
        let acquireCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            windowMs: 50,
            firstBatchMs: 10,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                acquireCalls += 1;
                const source: DiagnosticSource = {
                    kind: "meshcop",
                    canQuery: () => true,
                    queryUnicast: async () => ({ unknown: [] }),
                    queryMulticast: () => scriptedHandle({ nodes: [SAMPLE_NODE], delayMs: 5 }),
                    resetCounters: async () => {},
                };
                return meshcopHandle(source);
            },
        });

        const [a, b] = await Promise.all([
            service.getOrFetch(EXT_PAN_HEX_LOWER),
            service.getOrFetch(EXT_PAN_HEX_LOWER),
        ]);
        expect(acquireCalls).to.equal(1);
        expect(a).to.equal(b);
    });

    it("concurrent fetches still share one stream when the REST probe must resolve first", async () => {
        // Regression: the query-time REST probe inserts an await between the
        // in-flight dedup check and stream registration. With no cached capability,
        // every concurrent non-force fetch takes that await; they must still join a
        // single stream via the post-probe re-check, not each start their own.
        let acquireCalls = 0;
        let probeCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            windowMs: 50,
            firstBatchMs: 10,
            // A non-link-local address so the probe has a candidate and actually
            // invokes #probeRest (address-less BRs skip it before the network call).
            borderRouters: brRegistryFrom(brsListing([makeBr({ addresses: ["fd00::1"] })])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                acquireCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            // Miss, but only after a microtask — the yield the dedup must tolerate.
            probeRest: async () => {
                probeCalls += 1;
                await Promise.resolve();
                return null;
            },
        });

        const [a, b, c] = await Promise.all([
            service.getOrFetch(EXT_PAN_HEX_LOWER),
            service.getOrFetch(EXT_PAN_HEX_LOWER),
            service.getOrFetch(EXT_PAN_HEX_LOWER),
        ]);
        expect(probeCalls).to.be.greaterThan(0);
        expect(acquireCalls).to.equal(1);
        expect(a).to.equal(b);
        expect(b).to.equal(c);
    });

    it("runs fetches for distinct extPanIds in parallel", async () => {
        let active = 0;
        let maxActive = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            windowMs: 30,
            firstBatchMs: 10,
            borderRouters: brRegistryFrom(
                brsListing([
                    makeBr(),
                    makeBr({
                        extAddressHex: "BBBBBBBBBBBBBBBB",
                        extendedPanIdHex: OTHER_EXT_PAN_HEX_LOWER.toUpperCase(),
                    }),
                ]),
            ),
            credentials: credsRegistryFrom(
                credsLookup(
                    new Map([
                        [EXT_PAN_HEX_LOWER, makeCreds()],
                        [OTHER_EXT_PAN_HEX_LOWER, makeCreds(OTHER_EXT_PAN_BYTES)],
                    ]),
                ),
            ),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                active += 1;
                maxActive = Math.max(maxActive, active);
                const source: DiagnosticSource = {
                    kind: "meshcop",
                    canQuery: () => true,
                    queryUnicast: async () => ({ unknown: [] }),
                    queryMulticast: () => scriptedHandle({ delayMs: 20 }),
                    resetCounters: async () => {},
                };
                return meshcopHandle(source, () => {
                    active -= 1;
                });
            },
        });

        await Promise.all([
            service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true }),
            service.getOrFetch(OTHER_EXT_PAN_HEX_LOWER, { force: true }),
        ]);

        expect(maxActive).to.equal(2);
    });

    it("maps a CommissionerRejectedError to petition_rejected and still closes the handle", async () => {
        let closed = false;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () =>
                meshcopHandle(failingMeshcopSource(new CommissionerRejectedError()), () => {
                    closed = true;
                }),
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("petition_rejected");
        expect(closed).to.equal(true);
    });

    it("maps a CommissionerTimeoutError to timeout", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(failingMeshcopSource(new CommissionerTimeoutError())),
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("timeout");
    });

    it("maps an OtbrRestError(rest_unreachable) to rest_unreachable", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => failingRestSource(new OtbrRestError("rest_unreachable", "boom")),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("rest_unreachable");
        expect(batch?.source).to.equal("otbr-rest");
    });

    it("maps an OtbrRestError(rest_protocol) to rest_protocol", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => failingRestSource(new OtbrRestError("rest_protocol", "garbled")),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("rest_protocol");
    });

    it("listCached returns a snapshot of every cached batch", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(
                brsListing([
                    makeBr(),
                    makeBr({
                        extAddressHex: "BBBBBBBBBBBBBBBB",
                        extendedPanIdHex: OTHER_EXT_PAN_HEX_LOWER.toUpperCase(),
                    }),
                ]),
            ),
            credentials: credsRegistryFrom(
                credsLookup(
                    new Map([
                        [EXT_PAN_HEX_LOWER, makeCreds()],
                        [OTHER_EXT_PAN_HEX_LOWER, makeCreds(OTHER_EXT_PAN_BYTES)],
                    ]),
                ),
            ),
            makeRestSource: () => syncRestSource([]),
            probeRest: async () => null,
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([SAMPLE_NODE])),
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        await service.getOrFetch(OTHER_EXT_PAN_HEX_LOWER);

        const cached = service.listCached();
        expect(cached).to.have.lengthOf(2);
    });

    it("registerRestCapability and unregisterRestCapability toggle REST availability", async () => {
        let restCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([]);
            },
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async () => null,
        });

        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());
        const withCap = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(withCap?.source).to.equal("otbr-rest");
        expect(restCalls).to.equal(1);

        // No credentials → dropping the cap leaves no source at all.
        service.unregisterRestCapability(EXT_PAN_HEX_LOWER);
        const withoutCap = await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        expect(withoutCap?.partialReason).to.equal("no_credentials");
        expect(restCalls).to.equal(1);
    });

    it("probes REST and registers capability when a BR is added", async () => {
        const probeCalls = new Array<{ host: string; port: number }>();
        const stub = brsListing([]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([SAMPLE_NODE]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async (host, port) => {
                probeCalls.push({ host, port });
                return makeCap();
            },
        });

        const br = makeBr({ addresses: ["fd00::1", "192.0.2.1"] });
        stub.events.added.emit(br);
        await new Promise(r => setTimeout(r, 5));

        expect(probeCalls).to.have.lengthOf(2);
        expect(probeCalls.map(c => c.host).sort()).to.deep.equal(["192.0.2.1", "fd00::1"]);
        void service;
    });

    it("when disabled: no probe on add, getOrFetch returns undefined, no source built", async () => {
        let probeCalls = 0;
        let restCalls = 0;
        let meshcopCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            enabled: false,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => {
                probeCalls += 1;
                return makeCap();
            },
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1", "192.0.2.1"] }));
        await new Promise(r => setTimeout(r, 5));

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        service.refreshAllKnown();
        await new Promise(r => setTimeout(r, 5));
        expect(batch).to.equal(undefined);
        expect(service.listCached()).to.have.lengthOf(0);
        expect(probeCalls).to.equal(0);
        expect(restCalls).to.equal(0);
        expect(meshcopCalls).to.equal(0);
    });

    it("refreshAllKnown fetches each distinct Thread network once", async () => {
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            windowMs: 30,
            firstBatchMs: 10,
            borderRouters: brRegistryFrom(
                brsListing([
                    makeBr(),
                    // Duplicate extPanId (second BR for the same network) — must not double-fetch.
                    makeBr({ extAddressHex: "BBBBBBBBBBBBBBBB", extendedPanIdHex: EXT_PAN_HEX_UPPER }),
                    makeBr({
                        extAddressHex: "CCCCCCCCCCCCCCCC",
                        extendedPanIdHex: OTHER_EXT_PAN_HEX_LOWER.toUpperCase(),
                    }),
                ]),
            ),
            credentials: credsRegistryFrom(
                credsLookup(
                    new Map([
                        [EXT_PAN_HEX_LOWER, makeCreds()],
                        [OTHER_EXT_PAN_HEX_LOWER, makeCreds(OTHER_EXT_PAN_BYTES)],
                    ]),
                ),
            ),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => null,
        });

        service.refreshAllKnown();
        await new Promise(r => setTimeout(r, 60));

        expect(meshcopCalls).to.equal(2);
        expect(service.listCached()).to.have.lengthOf(2);
    });

    it("refreshAllKnown forwards force to re-fetch a cached network", async () => {
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => null,
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(meshcopCalls).to.equal(1);

        // Without force a complete cached batch is reused; with force it re-fetches.
        service.refreshAllKnown();
        await new Promise(r => setTimeout(r, 40));
        expect(meshcopCalls).to.equal(1);

        service.refreshAllKnown({ force: true });
        await new Promise(r => setTimeout(r, 40));
        expect(meshcopCalls).to.equal(2);
    });

    it("probe on `added` lets the next fetch hit the REST source without probing again", async () => {
        let probeCalls = 0;
        let restCalls = 0;
        let meshcopCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([]));
            },
            probeRest: async () => {
                probeCalls += 1;
                return makeCap();
            },
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("otbr-rest");
        expect(probeCalls).to.equal(1);
        expect(restCalls).to.equal(1);
        expect(meshcopCalls).to.equal(0);
    });

    it("probe skips link-local addresses", async () => {
        const probeCalls = new Array<string>();
        const stub = brsListing([]);
        new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async host => {
                probeCalls.push(host);
                return null;
            },
        });

        stub.events.added.emit(makeBr({ addresses: ["fe80::1", "fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));

        expect(probeCalls).to.deep.equal(["fd00::1"]);
    });

    it("fetch falls back to MeshCoP when no REST cap is registered (eager probe missed or returned null)", async () => {
        let meshcopCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => null,
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("meshcop");
        expect(meshcopCalls).to.equal(1);
    });

    it("force=true re-fetches REST diagnostics but reuses the registered cap (no re-probe)", async () => {
        let probeCalls = 0;
        let restCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async () => {
                probeCalls += 1;
                return makeCap();
            },
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));

        const first = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(first?.source).to.equal("otbr-rest");
        expect(restCalls).to.equal(1);
        expect(probeCalls).to.equal(1);

        // A manual refresh re-pulls diagnostics (restCalls++) but trusts the cap the
        // first-seen probe already registered — no second probe burst.
        const second = await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        expect(second?.source).to.equal("otbr-rest");
        expect(restCalls).to.equal(2);
        expect(probeCalls).to.equal(1);
    });

    it("force=true re-probes a known REST-less BR (recovers a transient miss)", async () => {
        let probeCalls = 0;
        let meshcopCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => {
                probeCalls += 1;
                return null;
            },
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));
        expect(probeCalls).to.equal(1);

        // Passive fetch trusts the sticky first-seen miss (no re-probe).
        const first = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(first?.source).to.equal("meshcop");
        expect(probeCalls).to.equal(1);

        // Force refresh re-probes REST, so a transient miss can recover.
        const second = await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        expect(second?.source).to.equal("meshcop");
        expect(meshcopCalls).to.equal(2);
        expect(probeCalls).to.equal(2);
    });

    it("does not re-probe on `updated` events; only `added` triggers eager probes", async () => {
        let probeCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async () => {
                probeCalls += 1;
                return null;
            },
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));
        expect(probeCalls).to.equal(1);

        for (let i = 0; i < 5; i++) {
            stub.events.updated.emit(makeBr({ addresses: ["fd00::1"] }));
        }
        await new Promise(r => setTimeout(r, 5));
        expect(probeCalls).to.equal(1);
    });

    it("removed event drops the REST capability when no other BR carries the same xp", async () => {
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([SAMPLE_NODE]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([SAMPLE_NODE])),
            probeRest: async () => makeCap(),
            cacheTtlMs: 0,
        });

        stub.events.added.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));
        const beforeRemove = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(beforeRemove?.source).to.equal("otbr-rest");

        stub.list = () => [];
        stub.events.removed.emit(makeBr({ addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));

        const afterRemove = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(afterRemove?.partialReason).to.equal("border_router_unreachable");
    });

    it("removed event keeps the REST cap when another BR still carries the same xp", async () => {
        let probeCalls = 0;
        const stub = brsListing([
            makeBr({ extAddressHex: "AAAAAAAAAAAAAAAA", addresses: ["fd00::1"] }),
            makeBr({ extAddressHex: "BBBBBBBBBBBBBBBB", addresses: ["fd00::2"] }),
        ]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([SAMPLE_NODE]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async () => {
                probeCalls += 1;
                return makeCap();
            },
        });

        stub.events.added.emit(makeBr({ extAddressHex: "AAAAAAAAAAAAAAAA", addresses: ["fd00::1"] }));
        await new Promise(r => setTimeout(r, 5));

        stub.list = () => [makeBr({ extAddressHex: "BBBBBBBBBBBBBBBB", addresses: ["fd00::2"] })];
        stub.events.removed.emit(makeBr({ extAddressHex: "AAAAAAAAAAAAAAAA", addresses: ["fd00::1"] }));

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("otbr-rest");
        expect(probeCalls).to.equal(1);
    });

    it("rejects invalid extPanId hex input", async () => {
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });

        let caught: Error | undefined;
        try {
            await service.getOrFetch("not-hex");
        } catch (err) {
            caught = err as Error;
        }
        expect(caught?.message).to.contain("Invalid extPanId hex");
    });

    it("first-batch resolves at firstBatchMs with in_progress partial reason; final batch follows on window close", async () => {
        const events = new Array<ThreadDiagnosticsBatch>();
        let onNodeEmit: ((n: DiagnosticResponse) => void) | undefined;
        const stub = brsListing([makeBr()]);
        const service = new ThreadDiagnosticsService({
            windowMs: 80,
            firstBatchMs: 20,
            debounceMs: 10,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            probeRest: async () => null,
            makeMeshcopSource: async () => {
                let resolveDone!: () => void;
                const handle: QueryMulticastHandle = {
                    onNode: new Observable<[DiagnosticResponse]>(),
                    onError: new Observable<[Error]>(),
                    done: new Promise<void>(r => {
                        resolveDone = r;
                    }),
                    close: async () => resolveDone(),
                };
                onNodeEmit = (n: DiagnosticResponse) => handle.onNode.emit(n);
                // Resolve `done` after the test's windowMs deadline.
                setTimeout(() => resolveDone(), 80);
                return {
                    source: {
                        kind: "meshcop",
                        canQuery: () => true,
                        queryUnicast: async () => ({ unknown: [] }),
                        queryMulticast: () => handle,
                        resetCounters: async () => {},
                    },
                    close: async () => {},
                };
            },
        });
        service.events.batchUpdated.on(b => {
            events.push(b);
        });

        // Emit a node BEFORE firstBatchMs hits so it's part of the first batch.
        const fetchPromise = service.getOrFetch(EXT_PAN_HEX_LOWER);
        await new Promise(r => setTimeout(r, 5));
        expect(onNodeEmit).to.not.be.undefined;
        onNodeEmit!(SAMPLE_NODE);

        const first = await fetchPromise;
        expect(first?.partialReason).to.equal("in_progress");
        expect(first?.nodes).to.have.lengthOf(1);

        // After window closes the final non-partial batch is published.
        await new Promise(r => setTimeout(r, 120));
        const final = events[events.length - 1];
        expect(final.partialReason).to.equal(undefined);
        expect(final.nodes).to.have.lengthOf(1);
    });

    it("first-batch resolves with meshcop_no_responses_yet when no arrivals before firstBatchMs", async () => {
        const stub = brsListing([makeBr()]);
        const service = new ThreadDiagnosticsService({
            windowMs: 30,
            firstBatchMs: 10,
            debounceMs: 5,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () =>
                meshcopHandle({
                    kind: "meshcop",
                    canQuery: () => true,
                    queryUnicast: async () => ({ unknown: [] }),
                    queryMulticast: () => scriptedHandle({ keepOpen: true }),
                    resetCounters: async () => {},
                }),
        });

        const first = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(first?.partialReason).to.equal("meshcop_no_responses_yet");
        expect(first?.nodes).to.have.lengthOf(0);
    });

    it("debounced in-progress flush publishes follow-up batches between firstBatch and window close", async () => {
        const events = new Array<ThreadDiagnosticsBatch>();
        let onNodeEmit: ((n: DiagnosticResponse) => void) | undefined;
        const stub = brsListing([makeBr()]);
        const service = new ThreadDiagnosticsService({
            windowMs: 80,
            firstBatchMs: 10,
            debounceMs: 10,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            probeRest: async () => null,
            makeMeshcopSource: async () => {
                let resolveDone!: () => void;
                const handle: QueryMulticastHandle = {
                    onNode: new Observable<[DiagnosticResponse]>(),
                    onError: new Observable<[Error]>(),
                    done: new Promise<void>(r => {
                        resolveDone = r;
                    }),
                    close: async () => resolveDone(),
                };
                onNodeEmit = (n: DiagnosticResponse) => handle.onNode.emit(n);
                setTimeout(() => resolveDone(), 80);
                return {
                    source: {
                        kind: "meshcop",
                        canQuery: () => true,
                        queryUnicast: async () => ({ unknown: [] }),
                        queryMulticast: () => handle,
                        resetCounters: async () => {},
                    },
                    close: async () => {},
                };
            },
        });
        service.events.batchUpdated.on(b => {
            events.push(b);
        });

        const fetchPromise = service.getOrFetch(EXT_PAN_HEX_LOWER);
        // No node before firstBatch.
        const first = await fetchPromise;
        expect(first?.partialReason).to.equal("meshcop_no_responses_yet");
        const firstBatchCount = events.length;

        // Now emit a node — should land in a debounced in_progress publish.
        onNodeEmit!(SAMPLE_NODE);
        await new Promise(r => setTimeout(r, 30));
        const inProgress = events.find(e => e.partialReason === "in_progress" && e.nodes.length === 1);
        expect(inProgress).to.not.be.undefined;
        expect(events.length).to.be.greaterThan(firstBatchCount);

        // Final batch after window close.
        await new Promise(r => setTimeout(r, 80));
        const final = events[events.length - 1];
        expect(final.partialReason).to.equal(undefined);
        expect(final.nodes).to.have.lengthOf(1);
    });
});
