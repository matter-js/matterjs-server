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
    findDiagnosticRecordByExtAddress,
    findUnknownDevices,
    getEdgeSignalScore,
    getNetworkType,
    getRouteBidirectionalLqi,
    getSignalLevel,
    getSignalLevelFromLqi,
    getWiFiDiagnostics,
    getWiFiSsid,
    isObserverOnline,
    makeDiagnosticRloc16Resolver,
    makePairKey,
    mergeDiagnosticEdges,
    parseNeighborTable,
    parseRouteTable,
    shouldHideExternalDevice,
    stripMdnsHostname,
} from "../src/index.js";

function mkNode(nodeId: number, attributes: Record<string, unknown>): TopologySourceNode {
    return { node_id: nodeId, attributes };
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
            expect(getRouteBidirectionalLqi({ lqiIn: 3, lqiOut: 1 })).to.equal(2);
            expect(getRouteBidirectionalLqi({ lqiIn: 3, lqiOut: 0 })).to.equal(3);
            expect(getRouteBidirectionalLqi({ lqiIn: 0, lqiOut: 0 })).to.equal(undefined);
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

    describe("isObserverOnline", () => {
        const nodes: Record<string, TopologySourceNode> = {
            "1": { node_id: 1, available: true, attributes: {} },
            "2": { node_id: 2, available: false, attributes: {} },
            "3": { node_id: 3, attributes: {} },
        };

        it("treats a node with no availability flag as online", () => {
            expect(isObserverOnline(nodes, "3")).to.equal(true);
        });

        it("treats an unavailable node as offline", () => {
            expect(isObserverOnline(nodes, "2")).to.equal(false);
        });

        it("treats an id with no node behind it as offline", () => {
            expect(isObserverOnline(nodes, "9")).to.equal(false);
        });
    });

    describe("shouldHideExternalDevice", () => {
        const XP_HEX = "1122334455667788";
        const observer = (available: boolean, neighborCount: number): TopologySourceNode => ({
            node_id: 1,
            available,
            attributes: {
                "0/51/0": [{ "0": "", "1": true, "5": b64(EXT_BYTES), "8": 2 }],
                "0/53/4": BigInt(`0x${XP_HEX}`),
                "0/53/7": Array.from({ length: neighborCount }, (_, i) => ({
                    "0": i === 0 ? EXT_BIGINT : BigInt(i + 1),
                    "2": 1024 + i,
                })),
            },
        });
        const mkExternal = (seenBy: string[], kind: "unknown" | "br" = "unknown") => {
            const registry =
                kind === "br"
                    ? new Map([
                          [
                              EXT_HEX,
                              {
                                  extAddressHex: EXT_HEX,
                                  extendedPanIdHex: XP_HEX,
                                  addresses: [],
                                  sources: ["meshcop"],
                                  lastSeen: 0,
                              } satisfies BorderRouterEntry,
                          ],
                      ])
                    : undefined;
            const device = findUnknownDevices({ "1": observer(true, 3) }, new Map(), new Map(), registry)[0];
            return { ...device, seenBy };
        };
        const mkBatch = (over: Partial<ThreadDiagnosticsBatch> = {}): ThreadDiagnosticsBatch => ({
            extPanIdHex: XP_HEX,
            networkName: "TestNet",
            collectedAt: 0,
            source: "meshcop",
            nodes: [{ extMacAddress: EXT_HEX, rloc16: 52224 }],
            ...over,
        });
        const diagnostics = (...batches: ThreadDiagnosticsBatch[]): ReadonlyMap<string, ThreadDiagnosticsBatch> =>
            new Map((batches.length > 0 ? batches : [mkBatch()]).map(batch => [batch.extPanIdHex, batch]));

        it("hides a single-observer unknown that no other source reports", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(true);
        });

        it("shows a single-observer unknown that Thread diagnostics also report", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(),
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(false);
        });

        it("keeps a corroborated device visible while an observer is online and the toggle is set", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(),
                    hideOfflineNodes: true,
                },
            );
            expect(hidden).to.equal(false);
        });

        it("hides a corroborated device whose observers are offline only when the toggle is set", () => {
            const nodes = { "1": observer(false, 3) };
            const device = mkExternal(["1"]);
            expect(
                shouldHideExternalDevice(device, nodes, { diagnostics: diagnostics(), hideOfflineNodes: false }),
            ).to.equal(false);
            expect(
                shouldHideExternalDevice(device, nodes, { diagnostics: diagnostics(), hideOfflineNodes: true }),
            ).to.equal(true);
        });

        it("applies the same toggle-only rule to a border router with no diagnostics", () => {
            const br = mkExternal(["1"], "br");
            expect(br.kind).to.equal("br");
            expect(shouldHideExternalDevice(br, { "1": observer(true, 3) }, { hideOfflineNodes: false })).to.equal(
                false,
            );
            expect(shouldHideExternalDevice(br, { "1": observer(false, 3) }, { hideOfflineNodes: true })).to.equal(
                true,
            );
        });

        it("rejects a partial diagnostics batch as corroboration", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(mkBatch({ partialReason: "border_router_unreachable" })),
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(true);
        });

        it("rejects a diagnostics batch from another Thread network as corroboration", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(mkBatch({ extPanIdHex: "8877665544332211" })),
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(true);
        });

        it("matches the network of a corroborating batch case-insensitively", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(mkBatch({ extPanIdHex: XP_HEX.toLowerCase() })),
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(false);
        });

        it("corroborates from a later batch when an earlier one reports the device on another network", () => {
            const stale = mkBatch({ extPanIdHex: "8877665544332211" });
            const current = mkBatch();
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(stale, current),
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(false);
        });

        it("refuses to corroborate a device whose own Thread network is unknown", () => {
            const device = { ...mkExternal(["1"]), extendedPanIdHex: undefined };
            const hidden = shouldHideExternalDevice(
                device,
                { "1": observer(true, 3) },
                {
                    diagnostics: diagnostics(),
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(true);
        });

        it("hides an uncorroborated unknown whose observers are all offline", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(false, 3) },
                {
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(true);
        });

        it("hides an unknown whose sole offline observer has no other neighbor", () => {
            const hidden = shouldHideExternalDevice(
                mkExternal(["1"]),
                { "1": observer(false, 1) },
                {
                    hideOfflineNodes: false,
                },
            );
            expect(hidden).to.equal(true);
        });

        it("hides an unknown whose sole observer is no longer a known node", () => {
            const hidden = shouldHideExternalDevice(mkExternal(["1"]), {}, { hideOfflineNodes: false });
            expect(hidden).to.equal(true);
        });

        it("keeps an uncorroborated unknown reported by more than one observer", () => {
            const nodes = { "1": observer(true, 3), "2": { ...observer(true, 3), node_id: 2 } };
            expect(shouldHideExternalDevice(mkExternal(["1", "2"]), nodes, { hideOfflineNodes: false })).to.equal(
                false,
            );
        });

        it("keeps an uncorroborated unknown whose only observer has no other neighbor", () => {
            expect(
                shouldHideExternalDevice(mkExternal(["1"]), { "1": observer(true, 1) }, { hideOfflineNodes: false }),
            ).to.equal(false);
        });
    });

    describe("findDiagnosticRecordByExtAddress", () => {
        const batch: ThreadDiagnosticsBatch = {
            extPanIdHex: "1122334455667788",
            networkName: "TestNet",
            collectedAt: 0,
            source: "meshcop",
            nodes: [{ extMacAddress: EXT_HEX.toLowerCase(), rloc16: 52224 }],
        };

        it("matches an extended address regardless of hex casing", () => {
            const record = findDiagnosticRecordByExtAddress(new Map([[batch.extPanIdHex, batch]]), EXT_HEX);
            expect(record?.node.rloc16).to.equal(52224);
            expect(record?.batch).to.equal(batch);
        });

        it("returns undefined when no batch reports the address", () => {
            const record = findDiagnosticRecordByExtAddress(new Map([[batch.extPanIdHex, batch]]), "0000000000000001");
            expect(record).to.equal(undefined);
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

    describe("getWiFiSsid", () => {
        const utf8 = (text: string) => b64([...new TextEncoder().encode(text)]);

        it("decodes the SSID from the NetworkCommissioning network list", () => {
            expect(getWiFiSsid(mkNode(1, { "0/49/1": [{ "0": utf8("we@home"), "1": true }] }))).to.equal("we@home");
        });

        it("accepts the named field spelling as well as the tag number", () => {
            expect(getWiFiSsid(mkNode(1, { "0/49/1": [{ networkID: utf8("MyWiFi"), connected: true }] }))).to.equal(
                "MyWiFi",
            );
        });

        it("prefers the connected network when a device lists several", () => {
            expect(
                getWiFiSsid(
                    mkNode(1, {
                        "0/49/1": [
                            { "0": utf8("Guest"), "1": false },
                            { "0": utf8("Home"), "1": true },
                        ],
                    }),
                ),
            ).to.equal("Home");
        });

        it("rejects a low-byte networkID, which decodes as valid UTF-8 control characters", () => {
            // an ext PAN id of low bytes survives the UTF-8 decode, so the control-character
            // check is the only thing standing between it and being rendered as an SSID
            expect(
                getWiFiSsid(mkNode(1, { "0/49/1": [{ "0": b64([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]) }] })),
            ).to.equal(null);
        });

        it("rejects a binary networkID so a Thread ext PAN id is never shown as an SSID", () => {
            // NetworkCommissioning.networkID is the ext PAN id on Thread and the interface
            // name on Ethernet, so only text that could be an SSID may be returned
            expect(
                getWiFiSsid(mkNode(1, { "0/49/1": [{ "0": b64([0xa7, 0x48, 0xdb, 0xb0, 0xec, 0xc9, 0x44, 0xdc]) }] })),
            ).to.equal(null);
        });

        it("ignores saved networks the device is not joined to", () => {
            // labelling a radio with a network the device is not on is worse than
            // leaving it to the BSSID fallback
            expect(
                getWiFiSsid(
                    mkNode(1, {
                        "0/49/1": [
                            { "0": utf8("Old"), "1": false },
                            { "0": utf8("Older"), "1": false },
                        ],
                    }),
                ),
            ).to.equal(null);
        });

        it("returns null when the device reports no network", () => {
            expect(getWiFiSsid(mkNode(1, { "0/49/1": [] }))).to.equal(null);
            expect(getWiFiSsid(mkNode(1, {}))).to.equal(null);
        });
    });

    describe("stripMdnsHostname", () => {
        it("reduces an mDNS FQDN to a display label", () => {
            expect(stripMdnsHostname("Cuisine.local.")).to.equal("Cuisine");
            expect(stripMdnsHostname("Cuisine")).to.equal("Cuisine");
        });

        it("yields undefined when nothing is left to show, so callers fall back", () => {
            expect(stripMdnsHostname(".local.")).to.equal(undefined);
            expect(stripMdnsHostname("")).to.equal(undefined);
            expect(stripMdnsHostname(undefined)).to.equal(undefined);
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
