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
    type DiagnosticResponse,
    type DiagnosticSource,
    OtbrRestError,
    type OtbrRestCapability,
    type QueryMulticastHandle,
    type ThreadCredentialsRegistry,
    type ThreadNetworkCredentials,
} from "@matter-server/thread-br";
import { Observable } from "@matter/main";
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
        addresses: [],
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
    };
}

function syncMeshcopSource(nodes: DiagnosticResponse[]): DiagnosticSource {
    return {
        kind: "meshcop",
        canQuery: () => true,
        queryUnicast: async () => nodes[0] ?? { unknown: [] },
        queryMulticast: () => scriptedHandle({ nodes }),
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

    it("force=true bypasses the cache", async () => {
        let calls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
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

    it("uses REST when enabled and a capability is registered", async () => {
        let restCalls = 0;
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
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
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([SAMPLE_NODE])),
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        await service.getOrFetch(OTHER_EXT_PAN_HEX_LOWER);

        const cached = service.listCached();
        expect(cached).to.have.lengthOf(2);
    });

    it("registerRestCapability and unregisterRestCapability toggle REST routing", async () => {
        let restCalls = 0;
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([]);
            },
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([]));
            },
            probeRest: async () => null,
        });

        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());
        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(restCalls).to.equal(1);
        expect(meshcopCalls).to.equal(0);

        service.unregisterRestCapability(EXT_PAN_HEX_LOWER);
        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        expect(meshcopCalls).to.equal(1);
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

    it("probe on `added` lets the next fetch hit the REST source without probing again", async () => {
        let probeCalls = 0;
        let restCalls = 0;
        let meshcopCalls = 0;
        const stub = brsListing([makeBr({ addresses: ["fd00::1"] })]);
        const service = new ThreadDiagnosticsService({
            ...FAST_TIMING,
            borderRouters: brRegistryFrom(stub),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
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
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
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
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
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
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
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
