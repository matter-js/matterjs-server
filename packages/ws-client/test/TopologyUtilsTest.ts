/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, ThreadDiagnosticsBatch, ThreadEdgePair, TopologySourceNode } from "../src/index.js";
import {
    buildExtAddrMap,
    buildMatterRloc16ByXp,
    buildRloc16Map,
    buildThreadEdgePairs,
    categorizeDevices,
    findUnknownDevices,
    getEdgeSignalScore,
    getNetworkType,
    getRouteBidirectionalLqi,
    getSignalLevel,
    getSignalLevelFromLqi,
    getWiFiDiagnostics,
    makeDiagnosticRloc16Resolver,
    makePairKey,
    mergeDiagnosticEdges,
    parseNeighborTable,
    parseRouteTable,
} from "../src/index.js";

function mkNode(nodeId: number, attributes: Record<string, unknown>, available = true): TopologySourceNode {
    return { node_id: nodeId, available, attributes };
}

/** base64 of a byte array (server-side Node helper — mirrors what the wire delivers). */
function b64(bytes: number[]): string {
    return Buffer.from(bytes).toString("base64");
}

// 0xAABBCCDDEEFF0011 as its constituent bytes + expected values.
const EXT_BYTES = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11];
const EXT_HEX = "AABBCCDDEEFF0011";
const EXT_BIGINT = 0xaabbccddeeff0011n;

describe("topology-utils", () => {
    describe("getNetworkType", () => {
        it("returns unknown when the feature map is absent", () => {
            expect(getNetworkType(mkNode(1, {}))).to.equal("unknown");
        });

        it("classifies thread / wifi / ethernet from the feature map bits", () => {
            expect(getNetworkType(mkNode(1, { "0/49/65532": 1 << 1 }))).to.equal("thread");
            expect(getNetworkType(mkNode(1, { "0/49/65532": 1 << 0 }))).to.equal("wifi");
            expect(getNetworkType(mkNode(1, { "0/49/65532": 1 << 2 }))).to.equal("ethernet");
        });

        it("prefers thread when multiple interface bits are set", () => {
            expect(getNetworkType(mkNode(1, { "0/49/65532": (1 << 0) | (1 << 1) }))).to.equal("thread");
        });
    });

    describe("getSignalLevelFromLqi", () => {
        it("maps the OpenThread 0-3 LQI scale to signal levels", () => {
            expect(getSignalLevelFromLqi(0)).to.equal("none");
            expect(getSignalLevelFromLqi(1)).to.equal("weak");
            expect(getSignalLevelFromLqi(2)).to.equal("medium");
            expect(getSignalLevelFromLqi(3)).to.equal("strong");
        });

        it("treats any value above the strong threshold as strong", () => {
            expect(getSignalLevelFromLqi(255)).to.equal("strong");
        });

        it("getSignalLevel reads the neighbor's lqi", () => {
            expect(
                getSignalLevel({
                    extAddress: 0n,
                    age: 0,
                    rloc16: 0,
                    linkFrameCounter: 0,
                    mleFrameCounter: 0,
                    lqi: 2,
                    avgRssi: null,
                    lastRssi: null,
                    frameErrorRate: 0,
                    messageErrorRate: 0,
                    rxOnWhenIdle: false,
                    fullThreadDevice: false,
                    fullNetworkData: false,
                    isChild: false,
                }),
            ).to.equal("medium");
        });
    });

    describe("getEdgeSignalScore", () => {
        it("orders none < weak < medium < strong (weakest lowest)", () => {
            const base = { fromNodeId: "1", toNodeId: "2", rssi: null } as const;
            const none = getEdgeSignalScore({ ...base, signalLevel: "none", lqi: 0 });
            const weak = getEdgeSignalScore({ ...base, signalLevel: "weak", lqi: 1 });
            const medium = getEdgeSignalScore({ ...base, signalLevel: "medium", lqi: 2 });
            const strong = getEdgeSignalScore({ ...base, signalLevel: "strong", lqi: 3 });
            expect(none).to.be.lessThan(weak);
            expect(weak).to.be.lessThan(medium);
            expect(medium).to.be.lessThan(strong);
        });
    });

    describe("parseNeighborTable", () => {
        it("parses numeric-keyed TLV fields incl. base64 extended address", () => {
            const neighbors = parseNeighborTable(
                mkNode(1, {
                    "0/53/7": [
                        {
                            "0": b64(EXT_BYTES),
                            "1": 10,
                            "2": 1024,
                            "5": 3,
                            "6": -50,
                            "7": -48,
                            "10": true,
                            "13": false,
                        },
                    ],
                }),
            );
            expect(neighbors).to.have.length(1);
            const n = neighbors[0];
            expect(n.extAddress).to.equal(EXT_BIGINT);
            expect(n.age).to.equal(10);
            expect(n.rloc16).to.equal(1024);
            expect(n.lqi).to.equal(3);
            expect(n.avgRssi).to.equal(-50);
            expect(n.lastRssi).to.equal(-48);
            expect(n.rxOnWhenIdle).to.equal(true);
            expect(n.isChild).to.equal(false);
        });

        it("falls back to camelCase keys and applies defaults", () => {
            const neighbors = parseNeighborTable(mkNode(1, { "0/53/7": [{ extAddress: 5n, lqi: 2 }] }));
            expect(neighbors[0].extAddress).to.equal(5n);
            expect(neighbors[0].lqi).to.equal(2);
            expect(neighbors[0].rloc16).to.equal(0);
            expect(neighbors[0].avgRssi).to.equal(null);
        });

        it("returns an empty array when the attribute is missing", () => {
            expect(parseNeighborTable(mkNode(1, {}))).to.have.length(0);
        });
    });

    describe("parseRouteTable / getRouteBidirectionalLqi", () => {
        it("parses route table entries", () => {
            const routes = parseRouteTable(
                mkNode(1, {
                    "0/53/8": [{ "0": 7n, "1": 2048, "2": 3, "3": 15, "4": 1, "5": 3, "6": 2, "8": true, "9": true }],
                }),
            );
            expect(routes).to.have.length(1);
            const r = routes[0];
            expect(r.extAddress).to.equal(7n);
            expect(r.rloc16).to.equal(2048);
            expect(r.routerId).to.equal(3);
            expect(r.pathCost).to.equal(1);
            expect(r.lqiIn).to.equal(3);
            expect(r.lqiOut).to.equal(2);
            expect(r.linkEstablished).to.equal(true);
        });

        it("averages bidirectional LQI, falling back to the live direction", () => {
            expect(getRouteBidirectionalLqi({ lqiIn: 3, lqiOut: 1 } as never)).to.equal(2);
            expect(getRouteBidirectionalLqi({ lqiIn: 3, lqiOut: 0 } as never)).to.equal(3);
            expect(getRouteBidirectionalLqi({ lqiIn: 0, lqiOut: 0 } as never)).to.equal(undefined);
        });
    });

    describe("buildExtAddrMap / buildRloc16Map", () => {
        it("maps extended address (from NetworkInterfaces) and rloc16 to node id", () => {
            const nodes: Record<string, TopologySourceNode> = {
                "1": mkNode(1, { "0/51/0": [{ "4": b64(EXT_BYTES), "7": 4 }], "0/53/64": 1024 }),
            };
            expect(buildExtAddrMap(nodes).get(EXT_BIGINT)).to.equal("1");
            expect(buildRloc16Map(nodes).get(1024)).to.equal("1");
        });
    });

    describe("buildThreadEdgePairs", () => {
        it("merges the two directions of a link into one pair", () => {
            const nodes: Record<string, TopologySourceNode> = {
                "1": mkNode(1, { "0/53/64": 1024, "0/53/7": [{ "0": 0, "2": 1025, "5": 3, "6": -40 }] }),
                "2": mkNode(2, { "0/53/64": 1025, "0/53/7": [{ "0": 0, "2": 1024, "5": 2, "6": -60 }] }),
            };
            const rloc16Map = buildRloc16Map(nodes);
            const pairs = buildThreadEdgePairs(nodes, new Map(), rloc16Map, []);

            expect(pairs.size).to.equal(1);
            const pair = pairs.get("1|2")!;
            expect(pair.edgeAB?.signalLevel).to.equal("strong");
            expect(pair.edgeBA?.signalLevel).to.equal("medium");
        });

        it("prefers the neighbor-table entry over the route-table entry per direction", () => {
            const nodes: Record<string, TopologySourceNode> = {
                "1": mkNode(1, {
                    "0/53/64": 1024,
                    "0/53/7": [{ "0": 0, "2": 1025, "5": 3, "6": -40 }],
                    "0/53/8": [{ "0": 0, "1": 1025, "4": 5, "5": 1, "6": 1, "8": true, "9": true }],
                }),
                "2": mkNode(2, { "0/53/64": 1025 }),
            };
            const pairs = buildThreadEdgePairs(nodes, new Map(), buildRloc16Map(nodes), []);
            const pair = pairs.get("1|2")!;
            // Neighbor edge (lqi 3) wins; the route-table supplement (which would set
            // fromRouteTable) must not overwrite it.
            expect(pair.edgeAB?.signalLevel).to.equal("strong");
            expect(pair.edgeAB?.fromRouteTable).to.equal(undefined);
        });

        it("does not create self-edges", () => {
            const nodes: Record<string, TopologySourceNode> = {
                "1": mkNode(1, { "0/53/64": 1024, "0/53/7": [{ "0": 0, "2": 1024, "5": 3 }] }),
            };
            const pairs = buildThreadEdgePairs(nodes, new Map(), buildRloc16Map(nodes), []);
            expect(pairs.size).to.equal(0);
        });
    });

    describe("findUnknownDevices", () => {
        const nodes: Record<string, TopologySourceNode> = {
            "1": mkNode(1, {
                "0/53/4": 0x1122334455667788n,
                "0/53/7": [{ "0": EXT_BIGINT, "2": 61440, "5": 2, "6": -70, "10": true }],
            }),
        };

        it("classifies an unmatched neighbor as an unknown device", () => {
            const unknown = findUnknownDevices(nodes, new Map(), new Map(), undefined);
            expect(unknown).to.have.length(1);
            expect(unknown[0].kind).to.equal("unknown");
            expect(unknown[0].id).to.equal(`unknown_${EXT_HEX}`);
            expect(unknown[0].isRouter).to.equal(true);
            expect(unknown[0].bestRssi).to.equal(-70);
            expect(unknown[0].seenBy).to.deep.equal(["1"]);
        });

        it("promotes a neighbor that matches the border-router registry", () => {
            const br: BorderRouterEntry = {
                extAddressHex: EXT_HEX,
                extendedPanIdHex: "1122334455667788",
                networkName: "TestNet",
                addresses: [],
                sources: ["meshcop"],
                lastSeen: 0,
            };
            const found = findUnknownDevices(nodes, new Map(), new Map(), new Map([[EXT_HEX, br]]));
            expect(found).to.have.length(1);
            expect(found[0].kind).to.equal("br");
            expect(found[0].id).to.equal(`br_${EXT_HEX}`);
            expect((found[0] as { networkName?: string }).networkName).to.equal("TestNet");
        });
    });

    describe("mergeDiagnosticEdges", () => {
        const batch: ThreadDiagnosticsBatch = {
            extPanIdHex: "1122334455667788",
            networkName: "TestNet",
            collectedAt: 0,
            source: "meshcop",
            nodes: [
                {
                    rloc16: 1024, // routerId 1
                    route64: {
                        idSequence: 0,
                        entries: [{ routerId: 2, linkQualityIn: 3, linkQualityOut: 3, routeCost: 1 }],
                    },
                },
            ],
        };
        const batches = new Map([[batch.extPanIdHex, batch]]);
        const resolve = (rloc16: number): string | undefined =>
            rloc16 === 1024 ? "1" : rloc16 === 2048 ? "2" : undefined;

        it("adds a route64 router-to-router edge", () => {
            const pairs = new Map<string, ThreadEdgePair>();
            mergeDiagnosticEdges(pairs, batches, resolve);
            expect(pairs.size).to.equal(1);
            const pair = pairs.get("1|2")!;
            expect(pair.edgeAB?.signalLevel).to.equal("strong");
            expect(pair.edgeAB?.fromRouteTable).to.equal(true);
            expect(pair.edgeAB?.pathCost).to.equal(1);
        });

        it("does not overwrite an existing (Matter-sourced) edge", () => {
            const pairs = new Map<string, ThreadEdgePair>([
                [
                    "1|2",
                    {
                        pairKey: "1|2",
                        nodeA: "1",
                        nodeB: "2",
                        edgeAB: { fromNodeId: "1", toNodeId: "2", signalLevel: "weak", lqi: 1, rssi: null },
                    },
                ],
            ]);
            mergeDiagnosticEdges(pairs, batches, resolve);
            const pair = pairs.get("1|2")!;
            expect(pair.edgeAB?.signalLevel).to.equal("weak");
            expect(pair.edgeAB?.fromRouteTable).to.equal(undefined);
        });

        it("drops references that resolve to nothing (no phantom nodes)", () => {
            const pairs = new Map<string, ThreadEdgePair>();
            mergeDiagnosticEdges(pairs, batches, (rloc16: number) => (rloc16 === 1024 ? "1" : undefined));
            expect(pairs.size).to.equal(0);
        });
    });

    describe("makeDiagnosticRloc16Resolver", () => {
        it("resolves a Matter device by its per-network rloc16", () => {
            const nodes: Record<string, TopologySourceNode> = {
                "1": mkNode(1, { "0/53/64": 1024, "0/53/4": 0x1122334455667788n }),
            };
            const resolver = makeDiagnosticRloc16Resolver(buildMatterRloc16ByXp(nodes), new Map());
            expect(resolver(1024, "1122334455667788")).to.equal("1");
            expect(resolver(9999, "1122334455667788")).to.equal(undefined);
        });
    });

    describe("getWiFiDiagnostics", () => {
        it("decodes BSSID from base64 and reads rssi / channel", () => {
            const diag = getWiFiDiagnostics(
                mkNode(1, {
                    "0/54/0": b64([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]),
                    "0/54/1": 4,
                    "0/54/2": 3,
                    "0/54/3": 6,
                    "0/54/4": -55,
                }),
            );
            expect(diag.bssid).to.equal("11:22:33:44:55:66");
            expect(diag.rssi).to.equal(-55);
            expect(diag.channel).to.equal(6);
        });
    });

    describe("categorizeDevices", () => {
        it("buckets node ids by network type", () => {
            const result = categorizeDevices({
                "1": mkNode(1, { "0/49/65532": 1 << 1 }),
                "2": mkNode(2, { "0/49/65532": 1 << 0 }),
                "3": mkNode(3, {}),
            });
            expect(result.thread).to.deep.equal(["1"]);
            expect(result.wifi).to.deep.equal(["2"]);
            expect(result.unknown).to.deep.equal(["3"]);
        });
    });

    describe("makePairKey", () => {
        it("produces a direction-independent canonical key", () => {
            expect(makePairKey("2", "1")).to.equal("1|2");
            expect(makePairKey("1", "2")).to.equal("1|2");
        });
    });
});
