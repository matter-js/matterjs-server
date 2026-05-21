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
    type ThreadCredentialsRegistry,
    type ThreadNetworkCredentials,
} from "@matter-server/thread-br";
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

interface BorderRoutersStub {
    list: () => BorderRouterEntry[];
}

interface CredentialsStub {
    getCredentials: (extPanId: Uint8Array) => ThreadNetworkCredentials | undefined;
}

function brsListing(brs: BorderRouterEntry[]): BorderRoutersStub {
    return {
        list: () => brs.map(b => ({ ...b, sources: [...b.sources], addresses: [...b.addresses] })),
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

function syncRestSource(nodes: DiagnosticResponse[]): DiagnosticSource {
    return {
        kind: "otbr-rest",
        canQuery: () => true,
        queryUnicast: async () => nodes[0] ?? { unknown: [] },
        queryMulticast: async () => nodes,
    };
}

function syncMeshcopSource(nodes: DiagnosticResponse[]): DiagnosticSource {
    return {
        kind: "meshcop",
        canQuery: () => true,
        queryUnicast: async () => nodes[0] ?? { unknown: [] },
        queryMulticast: async () => nodes,
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

// Type-check that the structural stubs satisfy the Pick<> types the service expects.
function brRegistryFrom(stub: BorderRoutersStub): Pick<BorderRouterRegistry, "list"> {
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

        expect(events).to.have.lengthOf(2);
        expect(events[0].nodes).to.have.lengthOf(1);
    });

    it("yields border_router_unreachable when no BRs match the extPanId", async () => {
        const service = new ThreadDiagnosticsService({
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

    it("serialises concurrent fetches for the same extPanId", async () => {
        const order = new Array<string>();
        let active = 0;
        let maxActive = 0;
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                active += 1;
                maxActive = Math.max(maxActive, active);
                order.push("acquire");
                const slowSource: DiagnosticSource = {
                    kind: "meshcop",
                    canQuery: () => true,
                    queryUnicast: async () => ({ unknown: [] }),
                    queryMulticast: async () => {
                        await new Promise(r => setTimeout(r, 10));
                        return [SAMPLE_NODE];
                    },
                };
                return meshcopHandle(slowSource, () => {
                    active -= 1;
                    order.push("release");
                });
            },
        });

        await Promise.all([
            service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true }),
            service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true }),
        ]);

        expect(maxActive).to.equal(1);
        expect(order).to.deep.equal(["acquire", "release", "acquire", "release"]);
    });

    it("runs fetches for distinct extPanIds in parallel", async () => {
        let active = 0;
        let maxActive = 0;
        const service = new ThreadDiagnosticsService({
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
                const slowSource: DiagnosticSource = {
                    kind: "meshcop",
                    canQuery: () => true,
                    queryUnicast: async () => ({ unknown: [] }),
                    queryMulticast: async () => {
                        await new Promise(r => setTimeout(r, 20));
                        return [];
                    },
                };
                return meshcopHandle(slowSource, () => {
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
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () =>
                meshcopHandle(
                    {
                        kind: "meshcop",
                        canQuery: () => true,
                        queryUnicast: async () => ({ unknown: [] }),
                        queryMulticast: async () => {
                            throw new CommissionerRejectedError();
                        },
                    },
                    () => {
                        closed = true;
                    },
                ),
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("petition_rejected");
        expect(closed).to.equal(true);
    });

    it("maps a CommissionerTimeoutError to timeout", async () => {
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () =>
                meshcopHandle({
                    kind: "meshcop",
                    canQuery: () => true,
                    queryUnicast: async () => ({ unknown: [] }),
                    queryMulticast: async () => {
                        throw new CommissionerTimeoutError();
                    },
                }),
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("timeout");
    });

    it("maps an OtbrRestError(rest_unreachable) to rest_unreachable", async () => {
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => ({
                kind: "otbr-rest",
                canQuery: () => true,
                queryUnicast: async () => ({ unknown: [] }),
                queryMulticast: async () => {
                    throw new OtbrRestError("rest_unreachable", "boom");
                },
            }),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("rest_unreachable");
        expect(batch?.source).to.equal("otbr-rest");
    });

    it("maps an OtbrRestError(rest_protocol) to rest_protocol", async () => {
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr()])),
            credentials: credsRegistryFrom(credsLookup(new Map())),
            makeRestSource: () => ({
                kind: "otbr-rest",
                canQuery: () => true,
                queryUnicast: async () => ({ unknown: [] }),
                queryMulticast: async () => {
                    throw new OtbrRestError("rest_protocol", "garbled");
                },
            }),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
        });
        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.partialReason).to.equal("rest_protocol");
    });

    it("listCached returns a snapshot of every cached batch", async () => {
        const service = new ThreadDiagnosticsService({
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
        });

        service.registerRestCapability(EXT_PAN_HEX_LOWER, makeCap());
        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        expect(restCalls).to.equal(1);
        expect(meshcopCalls).to.equal(0);

        service.unregisterRestCapability(EXT_PAN_HEX_LOWER);
        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        expect(meshcopCalls).to.equal(1);
    });

    it("auto-probes REST when no capability is registered and BR has routable addresses", async () => {
        const probeCalls = new Array<{ host: string; port: number }>();
        let restCalls = 0;
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr({ addresses: ["fd00::1", "192.0.2.1"] })])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => {
                restCalls += 1;
                return syncRestSource([SAMPLE_NODE]);
            },
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([]));
            },
            probeRest: async (host, port) => {
                probeCalls.push({ host, port });
                return makeCap();
            },
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        // Probes run in parallel; both candidates are dialled even though the first to succeed wins.
        expect(probeCalls).to.have.lengthOf(2);
        expect(probeCalls.map(c => c.host).sort()).to.deep.equal(["192.0.2.1", "fd00::1"]);
        expect(probeCalls.every(c => c.port === 8081)).to.equal(true);
        expect(batch?.source).to.equal("otbr-rest");
        expect(restCalls).to.equal(1);
        expect(meshcopCalls).to.equal(0);
    });

    it("auto-probe skips link-local addresses", async () => {
        const probeCalls = new Array<string>();
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr({ addresses: ["fe80::1", "fd00::1"] })])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            probeRest: async host => {
                probeCalls.push(host);
                return null;
            },
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(probeCalls).to.deep.equal(["fd00::1"]);
    });

    it("auto-probe falls back to MeshCoP when all probes return null", async () => {
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr({ addresses: ["fd00::1"] })])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([SAMPLE_NODE]));
            },
            probeRest: async () => null,
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("meshcop");
        expect(meshcopCalls).to.equal(1);
    });

    it("auto-probe is skipped within the cooldown window after a failed attempt", async () => {
        let probeCalls = 0;
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr({ addresses: ["fd00::1"] })])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => meshcopHandle(syncMeshcopSource([])),
            restProbeCooldownMs: 60_000,
            probeRest: async () => {
                probeCalls += 1;
                return null;
            },
        });

        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });
        await service.getOrFetch(EXT_PAN_HEX_LOWER, { force: true });

        expect(probeCalls).to.equal(1);
    });

    it("auto-probe error from probeRest does not abort the fetch", async () => {
        let meshcopCalls = 0;
        const service = new ThreadDiagnosticsService({
            borderRouters: brRegistryFrom(brsListing([makeBr({ addresses: ["fd00::1"] })])),
            credentials: credsRegistryFrom(credsLookup(new Map([[EXT_PAN_HEX_LOWER, makeCreds()]]))),
            makeRestSource: () => syncRestSource([]),
            makeMeshcopSource: async () => {
                meshcopCalls += 1;
                return meshcopHandle(syncMeshcopSource([]));
            },
            probeRest: async () => {
                throw new Error("simulated probe failure");
            },
        });

        const batch = await service.getOrFetch(EXT_PAN_HEX_LOWER);
        expect(batch?.source).to.equal("meshcop");
        expect(meshcopCalls).to.equal(1);
    });

    it("rejects invalid extPanId hex input", async () => {
        const service = new ThreadDiagnosticsService({
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
});
