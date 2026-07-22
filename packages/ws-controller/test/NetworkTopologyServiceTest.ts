/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NetworkTopology, TopologySourceNode } from "@matter-server/ws-client";
import { Observable } from "@matter/main";
import type { BorderRouterEntry, BorderRouterRegistry } from "@matter/thread-br-client";
import { NetworkTopologyService } from "../src/controller/NetworkTopologyService.js";

/** A commissioned node as the controller surfaces it to the topology service. */
type Node = TopologySourceNode & { available?: boolean; is_bridge?: boolean };

/** base64 of a byte array — mirrors what the wire delivers for EUI-64 / BSSID attributes. */
function b64(bytes: number[]): string {
    return Buffer.from(bytes).toString("base64");
}

const EXT_PAN_HEX = "1122334455667788";
const EXT_PAN_BIGINT = 0x1122334455667788n;
const NODE1_EXT_BYTES = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x01];
const NODE1_EXT_HEX = "AABBCCDDEEFF0001";
const NODE2_EXT_BYTES = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x02];
const BR_EXT_BYTES = [0x11, 0x22, 0xaa, 0xbb, 0xcc, 0x33, 0x44, 0x55];
const BR_EXT_HEX = "1122AABBCC334455";
const BR_NODE_ID = `br_${BR_EXT_HEX}`;
const BSSID_BYTES = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
const BSSID_STR = "11:22:33:44:55:66";
const AP_NODE_ID = "ap_112233445566";

const THREAD_REFRESH_PATHS = ["0/53/7", "0/53/8", "0/51/0"];
const WIFI_REFRESH_PATHS = ["0/54/0", "0/54/3", "0/54/4"];

/** One entry of a Thread NeighborTable (0/53/7), numeric-keyed per the Matter spec. */
function neighbor(
    ext: number | string,
    rloc16: number,
    lqi: number,
    rssi: number | null,
    rxOnWhenIdle = false,
): Record<string, unknown> {
    return { "0": ext, "2": rloc16, "5": lqi, "6": rssi, "10": rxOnWhenIdle };
}

interface ThreadNodeOpts {
    role?: number;
    rloc16?: number;
    extBytes?: number[];
    neighbors?: Record<string, unknown>[];
    available?: boolean;
    isBridge?: boolean;
}

function mkThread(nodeId: number, opts: ThreadNodeOpts = {}): Node {
    const attributes: Record<string, unknown> = {
        "0/49/65532": 1 << 1, // NetworkCommissioning FeatureMap: Thread
        "0/53/4": EXT_PAN_BIGINT,
    };
    if (opts.role !== undefined) attributes["0/53/1"] = opts.role;
    if (opts.rloc16 !== undefined) attributes["0/53/64"] = opts.rloc16;
    if (opts.extBytes !== undefined) attributes["0/51/0"] = [{ "4": b64(opts.extBytes), "7": 4 }];
    if (opts.neighbors !== undefined) attributes["0/53/7"] = opts.neighbors;
    return { node_id: nodeId, available: opts.available ?? true, attributes, is_bridge: opts.isBridge };
}

function mkWifi(nodeId: number, opts: { rssi?: number | null; available?: boolean } = {}): Node {
    return {
        node_id: nodeId,
        available: opts.available ?? true,
        attributes: {
            "0/49/65532": 1 << 0, // NetworkCommissioning FeatureMap: WiFi
            "0/54/0": b64(BSSID_BYTES),
            "0/54/4": opts.rssi ?? -55,
        },
    };
}

function mkEthernet(nodeId: number): Node {
    return { node_id: nodeId, available: true, attributes: { "0/49/65532": 1 << 2 } };
}

function makeBr(overrides: Partial<BorderRouterEntry> = {}): BorderRouterEntry {
    return {
        extAddressHex: BR_EXT_HEX,
        extendedPanIdHex: EXT_PAN_HEX,
        networkName: "OpenThread",
        vendorName: "Apple",
        modelName: "eero",
        addresses: ["fd00::1"],
        sources: ["meshcop"],
        lastSeen: 1000,
        ...overrides,
    };
}

interface BrEvents {
    added: Observable<[BorderRouterEntry]>;
    updated: Observable<[BorderRouterEntry]>;
    removed: Observable<[BorderRouterEntry]>;
}

function makeBrEvents(): BrEvents {
    return {
        added: new Observable<[BorderRouterEntry]>(),
        updated: new Observable<[BorderRouterEntry]>(),
        removed: new Observable<[BorderRouterEntry]>(),
    };
}

interface ControllerEventsStub {
    attributeChanged: Observable<any[]>;
    nodeAvailabilityChanged: Observable<any[]>;
    nodeAdded: Observable<any[]>;
    nodeDecommissioned: Observable<any[]>;
}

function makeControllerEvents(): ControllerEventsStub {
    return {
        attributeChanged: new Observable<any[]>(),
        nodeAvailabilityChanged: new Observable<any[]>(),
        nodeAdded: new Observable<any[]>(),
        nodeDecommissioned: new Observable<any[]>(),
    };
}

function brRegistryFrom(
    list: () => BorderRouterEntry[],
    events: BrEvents,
): Pick<BorderRouterRegistry, "list" | "events"> {
    return { list, events };
}

interface HarnessConfig {
    nodes: () => Node[];
    brs?: () => BorderRouterEntry[];
    readAttributes?: (nodeId: number | bigint, paths: string[]) => Promise<void>;
    debounceMs?: number;
    periodicMs?: number;
    refreshTimeoutMs?: number;
    refreshConcurrency?: number;
}

interface Harness {
    service: NetworkTopologyService;
    emitted: NetworkTopology[];
    controller: ControllerEventsStub;
    brEvents: BrEvents;
    readCalls: Array<{ nodeId: number | bigint; paths: string[] }>;
    fireAttr: (clusterId: number) => void;
}

const activeHarnesses: Harness[] = [];

function makeHarness(config: HarnessConfig): Harness {
    const controller = makeControllerEvents();
    const brEvents = makeBrEvents();
    const readCalls: Array<{ nodeId: number | bigint; paths: string[] }> = [];
    const readAttributes =
        config.readAttributes ??
        (async (nodeId: number | bigint, paths: string[]) => {
            readCalls.push({ nodeId, paths });
        });

    const service = new NetworkTopologyService({
        listNodes: config.nodes,
        readAttributes,
        borderRouters: brRegistryFrom(config.brs ?? (() => []), brEvents),
        controllerEvents: controller,
        debounceMs: config.debounceMs ?? 5,
        // Default the periodic rebuild far out so it can't race the change-driven assertions.
        periodicMs: config.periodicMs ?? 600_000,
        refreshTimeoutMs: config.refreshTimeoutMs,
        refreshConcurrency: config.refreshConcurrency,
    });

    const emitted: NetworkTopology[] = [];
    service.events.topologyUpdated.on(t => {
        emitted.push(t);
    });

    const harness: Harness = {
        service,
        emitted,
        controller,
        brEvents,
        readCalls,
        fireAttr: clusterId => controller.attributeChanged.emit(1, { path: { clusterId } }),
    };
    activeHarnesses.push(harness);
    return harness;
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

describe("NetworkTopologyService", () => {
    afterEach(() => {
        while (activeHarnesses.length > 0) {
            activeHarnesses.pop()!.service.stop();
        }
    });

    describe("getTopology", () => {
        function fullMeshHarness(): Harness {
            const node1 = mkThread(1, {
                role: 6, // leader
                rloc16: 1024,
                extBytes: NODE1_EXT_BYTES,
                neighbors: [
                    neighbor(0, 1025, 3, -40), // → node 2 (matched by rloc16)
                    neighbor(b64(BR_EXT_BYTES), 61440, 2, -70, true), // → external Border Router
                ],
            });
            const node2 = mkThread(2, {
                role: 5, // router
                rloc16: 1025,
                extBytes: NODE2_EXT_BYTES,
                neighbors: [neighbor(0, 1024, 2, -60)], // → node 1
            });
            const node5 = mkWifi(5, { rssi: -55 });
            return makeHarness({ nodes: () => [node1, node2, node5], brs: () => [makeBr()] });
        }

        it("maps a synthetic mesh to matter / border_router / wifi_ap wire nodes", () => {
            const { service } = fullMeshHarness();
            const topology = service.getTopology();
            const byId = new Map(topology.nodes.map(n => [n.id, n]));

            expect(topology.nodes).to.have.lengthOf(5);

            const n1 = byId.get("1")!;
            expect(n1.kind).to.equal("matter");
            expect(n1.network_type).to.equal("thread");
            expect(n1.node_id).to.equal(1);
            expect(n1.role).to.equal("leader");
            expect(n1.available).to.equal(true);
            expect(n1.rloc16).to.equal(1024);
            expect(n1.ext_address).to.equal(NODE1_EXT_HEX);
            expect(n1.ext_pan_id).to.equal(EXT_PAN_HEX);
            expect(n1.network_name).to.equal("OpenThread");

            expect(byId.get("2")!.role).to.equal("router");

            const wifi = byId.get("5")!;
            expect(wifi.kind).to.equal("matter");
            expect(wifi.network_type).to.equal("wifi");
            expect(wifi.role).to.equal("station");

            const br = byId.get(BR_NODE_ID)!;
            expect(br.kind).to.equal("border_router");
            expect(br.network_type).to.equal("thread");
            expect(br.role).to.equal("router");
            expect(br.ext_address).to.equal(BR_EXT_HEX);
            expect(br.vendor_name).to.equal("Apple");
            expect(br.model_name).to.equal("eero");
            expect(br.network_name).to.equal("OpenThread");

            const ap = byId.get(AP_NODE_ID)!;
            expect(ap.kind).to.equal("wifi_ap");
            expect(ap.network_type).to.equal("wifi");
            expect(ap.role).to.equal("ap");
            expect(ap.network_name).to.equal(BSSID_STR);
        });

        it("folds both directions of a Thread link and summarises the strongest", () => {
            const { service } = fullMeshHarness();
            const topology = service.getTopology();

            const link = topology.connections.find(c => c.source === "1" && c.target === "2")!;
            expect(link.network).to.equal("thread");
            expect(link.strength).to.equal("strong");
            expect(link.source_to_target).to.deep.equal({ strength: "strong", lqi: 3, rssi: -40 });
            expect(link.target_to_source).to.deep.equal({ strength: "medium", lqi: 2, rssi: -60 });
        });

        it("links a Matter node to the external Border Router it neighbours", () => {
            const { service } = fullMeshHarness();
            const topology = service.getTopology();

            const brLink = topology.connections.find(c => c.target === BR_NODE_ID)!;
            expect(brLink.source).to.equal("1");
            expect(brLink.network).to.equal("thread");
            expect(brLink.strength).to.equal("medium");
            expect(brLink.source_to_target).to.deep.equal({ strength: "medium", lqi: 2, rssi: -70 });
            expect(brLink.target_to_source).to.equal(undefined);
        });

        it("builds a Wi-Fi star: one AP pseudo-node per BSSID with a station→AP edge", () => {
            const { service } = fullMeshHarness();
            const topology = service.getTopology();

            const wifiLink = topology.connections.find(c => c.network === "wifi")!;
            expect(wifiLink.source).to.equal("5");
            expect(wifiLink.target).to.equal(AP_NODE_ID);
            expect(wifiLink.strength).to.equal("strong");
            expect(wifiLink.source_to_target).to.deep.equal({ strength: "strong", rssi: -55 });
        });

        it("classifies an unmatched neighbour as thread_unknown when no BR matches", () => {
            const node1 = mkThread(1, {
                role: 5,
                rloc16: 1024,
                neighbors: [neighbor(b64(BR_EXT_BYTES), 61440, 1, -90, true)],
            });
            const { service } = makeHarness({ nodes: () => [node1], brs: () => [] });
            const topology = service.getTopology();

            const unknown = topology.nodes.find(n => n.kind === "thread_unknown");
            expect(unknown).to.not.equal(undefined);
            expect(unknown!.network_type).to.equal("thread");
            expect(topology.nodes.some(n => n.kind === "border_router")).to.equal(false);
        });

        it("marks an offline node unavailable and passes the bridge flag through", () => {
            const online = mkThread(1, { role: 5, rloc16: 1024, isBridge: true });
            const offline = mkThread(2, { role: 5, rloc16: 1025, available: false });
            const { service } = makeHarness({ nodes: () => [online, offline] });
            const topology = service.getTopology();
            const byId = new Map(topology.nodes.map(n => [n.id, n]));

            expect(byId.get("1")!.is_bridge).to.equal(true);
            expect(byId.get("2")!.available).to.equal(false);
        });

        it("emits an unlinked node for an ethernet device", () => {
            const eth = mkEthernet(1);
            const { service } = makeHarness({ nodes: () => [eth] });
            const topology = service.getTopology();

            expect(topology.nodes).to.have.lengthOf(1);
            expect(topology.nodes[0].network_type).to.equal("ethernet");
            expect(topology.connections).to.have.lengthOf(0);
        });
    });

    describe("change-driven emission", () => {
        it("ignores attribute changes on clusters that can't affect the graph", async () => {
            const { emitted, fireAttr } = makeHarness({
                nodes: () => [mkThread(1, { role: 5, rloc16: 1024 })],
            });

            fireAttr(6); // OnOff — irrelevant
            await delay(25);
            expect(emitted).to.have.lengthOf(0);

            fireAttr(53); // ThreadNetworkDiagnostics — relevant
            await delay(25);
            expect(emitted).to.have.lengthOf(1);
        });

        it("collapses a burst of attribute reports into a single debounced emit", async () => {
            const { emitted, fireAttr } = makeHarness({
                nodes: () => [mkThread(1, { role: 5, rloc16: 1024 })],
                debounceMs: 10,
            });

            fireAttr(53);
            fireAttr(53);
            fireAttr(53);
            await delay(30);

            expect(emitted).to.have.lengthOf(1);
        });

        it("does not re-emit when a rebuild produces an identical graph", async () => {
            const { emitted, fireAttr } = makeHarness({
                nodes: () => [mkThread(1, { role: 5, rloc16: 1024 })],
            });

            fireAttr(53);
            await delay(20);
            expect(emitted).to.have.lengthOf(1);

            fireAttr(53); // same underlying data → same hash
            await delay(20);
            expect(emitted).to.have.lengthOf(1);
        });

        it("does not re-emit when only node/connection ordering changes", async () => {
            const node1 = mkThread(1, { role: 5, rloc16: 1024, neighbors: [neighbor(0, 1025, 3, -40)] });
            const node2 = mkThread(2, { role: 5, rloc16: 1025, neighbors: [neighbor(0, 1024, 2, -60)] });
            let order: Node[] = [node1, node2];
            const { emitted, controller } = makeHarness({ nodes: () => order });

            controller.nodeAdded.emit(1);
            await delay(20);
            expect(emitted).to.have.lengthOf(1);

            // Same graph, reversed iteration order → the set is unchanged → no re-emit.
            order = [node2, node1];
            controller.nodeAdded.emit(2);
            await delay(20);
            expect(emitted).to.have.lengthOf(1);
        });

        it("re-emits when node lifecycle events change the graph", async () => {
            let nodeList: Node[] = [mkThread(1, { role: 5, rloc16: 1024 })];
            const { emitted, controller } = makeHarness({ nodes: () => nodeList });

            controller.nodeAdded.emit(2);
            await delay(20);
            expect(emitted).to.have.lengthOf(1);

            // No change → no new emit.
            controller.nodeAvailabilityChanged.emit(1, true);
            await delay(20);
            expect(emitted).to.have.lengthOf(1);

            // A node goes offline → the graph changes → a fresh emit.
            nodeList = [mkThread(1, { role: 5, rloc16: 1024, available: false })];
            controller.nodeAvailabilityChanged.emit(1, false);
            await delay(20);
            expect(emitted).to.have.lengthOf(2);
            expect(emitted[1].nodes[0].available).to.equal(false);

            // A node is removed → the graph changes again.
            nodeList = [];
            controller.nodeDecommissioned.emit(1);
            await delay(20);
            expect(emitted).to.have.lengthOf(3);
            expect(emitted[2].nodes).to.have.lengthOf(0);
        });

        it("rebuilds against the current Border Router registry when a BR is discovered", async () => {
            let brList: BorderRouterEntry[] = [];
            const node1 = mkThread(1, {
                role: 5,
                rloc16: 1024,
                neighbors: [neighbor(b64(BR_EXT_BYTES), 61440, 2, -70, true)],
            });
            const { emitted, brEvents } = makeHarness({ nodes: () => [node1], brs: () => brList });

            brList = [makeBr()];
            brEvents.added.emit(makeBr());
            await delay(20);

            expect(emitted.length).to.be.greaterThanOrEqual(1);
            const latest = emitted[emitted.length - 1];
            expect(latest.nodes.find(n => n.id === BR_NODE_ID)?.kind).to.equal("border_router");
            expect(latest.nodes.some(n => n.kind === "thread_unknown")).to.equal(false);
        });

        it("rebuilds when a Border Router entry is updated (e.g. its network name resolves)", async () => {
            let brList: BorderRouterEntry[] = [makeBr({ networkName: undefined })];
            const node1 = mkThread(1, {
                role: 5,
                rloc16: 1024,
                neighbors: [neighbor(b64(BR_EXT_BYTES), 61440, 2, -70, true)],
            });
            const { emitted, brEvents } = makeHarness({ nodes: () => [node1], brs: () => brList });

            brList = [makeBr({ networkName: "ResolvedNet" })];
            brEvents.updated.emit(brList[0]);
            await delay(20);

            expect(emitted.length).to.be.greaterThanOrEqual(1);
            const latest = emitted[emitted.length - 1];
            expect(latest.nodes.find(n => n.id === BR_NODE_ID)?.network_name).to.equal("ResolvedNet");
        });

        it("emits once from the periodic rebuild and stays quiet while the graph is stable", async () => {
            const { emitted } = makeHarness({
                nodes: () => [mkThread(1, { role: 5, rloc16: 1024 })],
                periodicMs: 15,
            });

            await delay(60); // several periodic ticks
            expect(emitted).to.have.lengthOf(1);
        });
    });

    describe("refresh", () => {
        it("fans out reads to online Thread/Wi-Fi nodes and skips offline/other nodes", async () => {
            const nodes = [
                mkThread(1, { role: 5, rloc16: 1024 }),
                mkWifi(2, { rssi: -50 }),
                mkThread(3, { role: 5, rloc16: 1026, available: false }),
                mkEthernet(4),
            ];
            const { service, readCalls } = makeHarness({ nodes: () => nodes });

            const topology = await service.refresh();

            expect(topology.nodes.length).to.be.greaterThan(0);
            const byNode = new Map(readCalls.map(c => [c.nodeId, c.paths]));
            expect(byNode.get(1)).to.deep.equal(THREAD_REFRESH_PATHS);
            expect(byNode.get(2)).to.deep.equal(WIFI_REFRESH_PATHS);
            expect(byNode.has(3)).to.equal(false); // offline
            expect(byNode.has(4)).to.equal(false); // ethernet
            expect(readCalls).to.have.lengthOf(2);
        });

        it("caps the number of concurrent reads at refreshConcurrency", async () => {
            const nodes = Array.from({ length: 5 }, (_unused, i) => mkThread(i + 1, { role: 5, rloc16: 1024 + i }));
            let active = 0;
            let maxActive = 0;
            const { service } = makeHarness({
                nodes: () => nodes,
                refreshConcurrency: 2,
                readAttributes: async () => {
                    active += 1;
                    maxActive = Math.max(maxActive, active);
                    await delay(10);
                    active -= 1;
                },
            });

            await service.refresh();

            expect(maxActive).to.equal(2);
        });

        it("stops starting reads once the refresh deadline expires", async () => {
            const nodes = Array.from({ length: 3 }, (_unused, i) => mkThread(i + 1, { role: 5, rloc16: 1024 + i }));
            const started: number[] = [];
            let releaseFirst!: () => void;
            const firstBlocked = new Promise<void>(resolve => {
                releaseFirst = resolve;
            });
            const { service } = makeHarness({
                nodes: () => nodes,
                refreshConcurrency: 1,
                refreshTimeoutMs: 20,
                readAttributes: async nodeId => {
                    started.push(Number(nodeId));
                    await firstBlocked;
                },
            });

            await service.refresh(); // the deadline beats the blocked first read
            expect(started).to.deep.equal([1]);

            // Releasing the in-flight read must not let the worker pick up the queued ones.
            releaseFirst();
            await delay(20);
            expect(started).to.deep.equal([1]);
        });

        it("emits after a refresh that changes the graph", async () => {
            let nodeList: Node[] = [mkThread(1, { role: 5, rloc16: 1024 })];
            const { service, emitted } = makeHarness({
                nodes: () => nodeList,
                readAttributes: async () => {
                    // Model a read that surfaces a second node the cache didn't have yet.
                    nodeList = [mkThread(1, { role: 5, rloc16: 1024 }), mkThread(2, { role: 5, rloc16: 1025 })];
                },
            });

            await service.refresh();
            expect(emitted).to.have.lengthOf(1);
            expect(emitted[0].nodes).to.have.lengthOf(2);
        });
    });

    describe("stop", () => {
        it("stops emitting and refresh() returns a snapshot without emitting", async () => {
            const { service, emitted, fireAttr } = makeHarness({
                nodes: () => [mkThread(1, { role: 5, rloc16: 1024 })],
            });

            fireAttr(53);
            await delay(20);
            expect(emitted).to.have.lengthOf(1);

            service.stop();

            fireAttr(53);
            await delay(20);
            expect(emitted).to.have.lengthOf(1); // no further emits after stop

            const topology = await service.refresh();
            expect(topology.nodes).to.have.lengthOf(1);
            expect(emitted).to.have.lengthOf(1);
        });

        it("does not emit when stop() lands mid-refresh", async () => {
            let releaseRead!: () => void;
            const readBlocked = new Promise<void>(resolve => {
                releaseRead = resolve;
            });
            let nodeList: Node[] = [mkThread(1, { role: 5, rloc16: 1024 })];
            const { service, emitted } = makeHarness({
                nodes: () => nodeList,
                refreshTimeoutMs: 10_000, // long enough that only releaseRead settles the read
                readAttributes: async () => {
                    // A read whose result would change the graph (so a build would otherwise emit).
                    nodeList = [mkThread(1, { role: 5, rloc16: 1024 }), mkThread(2, { role: 5, rloc16: 1025 })];
                    await readBlocked;
                },
            });

            const refreshDone = service.refresh();
            await delay(10); // enter the blocked read
            service.stop(); // stop lands while the refresh awaits
            releaseRead();
            const topology = await refreshDone;

            expect(topology.nodes).to.have.lengthOf(2); // caller still gets the fresh snapshot
            expect(emitted).to.have.lengthOf(0); // but a stopped service does not broadcast it
        });
    });
});
