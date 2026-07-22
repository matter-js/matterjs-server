/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    buildExtAddrMap,
    buildRloc16Map,
    buildThreadEdgePairs,
    findUnknownDevices,
    getNetworkType,
    getThreadExtendedAddressHex,
    getThreadExtendedPanId,
    getThreadRloc16,
    getThreadRole,
    getWiFiDiagnostics,
    type NetworkTopology,
    type NetworkTopologyConnection,
    type NetworkTopologyNode,
    type ThreadConnection,
    type ThreadEdgePair,
    type ThreadExternalDevice,
    type TopologyDirectionInfo,
    type TopologyRole,
    type TopologySourceNode,
    type TopologyStrength,
} from "@matter-server/ws-client";
import { Logger, Observable, ObserverGroup } from "@matter/main";
import type { BorderRouterEntry, BorderRouterRegistry } from "@matter/thread-br-client";

const logger = Logger.get("NetworkTopologyService");

/**
 * Clusters whose attribute updates can change the derived topology:
 *   0x31/49  NetworkCommissioning   (FeatureMap → network type)
 *   0x33/51  GeneralDiagnostics     (NetworkInterfaces → extended address / MAC)
 *   0x35/53  ThreadNetworkDiagnostics (role, neighbor/route tables, rloc16, extPanId)
 *   0x36/54  WiFiNetworkDiagnostics (BSSID, RSSI, channel)
 * An attribute change outside this set can't affect the graph, so it doesn't schedule a rebuild.
 */
const TOPOLOGY_CLUSTERS = new Set<number>([49, 51, 53, 54]);

/** Thread neighbor + route tables + interface list — the inputs to Thread edge derivation. */
const THREAD_REFRESH_PATHS = ["0/53/7", "0/53/8", "0/51/0"];
/** WiFi BSSID + channel + RSSI — the inputs to the WiFi star. */
const WIFI_REFRESH_PATHS = ["0/54/0", "0/54/3", "0/54/4"];

/** An Observable this service only needs to subscribe to; payloads are inspected structurally. */
type AnyObservable = Observable<any[]>;

/**
 * A source node plus the availability + bridge flags surfaced on the wire. Neither is part of
 * the pure derivation ({@link TopologySourceNode}, which reads only `node_id`/`attributes`);
 * both ride along from the controller's node details ({@link MatterNodeData}).
 */
type TopologyNode = TopologySourceNode & { available?: boolean; is_bridge?: boolean };

export interface NetworkTopologyServiceOptions {
    /** Snapshot of the currently commissioned nodes (node id, availability, bridge flag, attribute cache). */
    listNodes: () => TopologyNode[];
    /** Read the given attribute paths from a node, refreshing the server's attribute cache. */
    readAttributes: (nodeId: number | bigint, paths: string[]) => Promise<void>;
    /** Passively-discovered Thread Border Router registry (used to classify neighbors + label networks). */
    borderRouters: Pick<BorderRouterRegistry, "list" | "events">;
    /** Controller lifecycle/attribute events that can change the topology. */
    controllerEvents: {
        attributeChanged: AnyObservable;
        nodeAvailabilityChanged: AnyObservable;
        nodeAdded: AnyObservable;
        nodeDecommissioned: AnyObservable;
    };
    /** Trailing debounce for change-driven rebuilds. Defaults to {@link NetworkTopologyService.DEFAULT_DEBOUNCE_MS}. */
    debounceMs?: number;
    /** Periodic rebuild interval (catches sleepy-device drift). Defaults to {@link NetworkTopologyService.DEFAULT_PERIODIC_MS}. */
    periodicMs?: number;
    /** Overall deadline for a {@link NetworkTopologyService.refresh}. Defaults to {@link NetworkTopologyService.DEFAULT_REFRESH_TIMEOUT_MS}. */
    refreshTimeoutMs?: number;
    /** Max concurrent per-node reads during {@link NetworkTopologyService.refresh}. Defaults to {@link NetworkTopologyService.DEFAULT_REFRESH_CONCURRENCY}. */
    refreshConcurrency?: number;
}

/**
 * Derives the Matter network topology (Thread mesh + Wi-Fi star) from the controller's
 * attribute cache + the passively-discovered Border Router registry, and streams a fresh
 * snapshot whenever the derived graph changes.
 *
 * The heavy derivation (neighbor/route-table parsing, edge-pair building, unknown/BR
 * classification) is the shared, DOM-free pipeline in `@matter-server/ws-client`, so the
 * server and the dashboard compute the same graph.
 *
 * Update model (hybrid): change-driven rebuilds are debounced (a burst of attribute
 * reports collapses to one), emitted only when the graph actually changed (hash compare,
 * excluding the timestamp), plus a slow periodic rebuild so sleepy-device table drift that
 * arrives via routers' subscriptions is eventually reflected without an explicit request.
 *
 * NOTE: this v1 derives from the nodes' own ThreadNetworkDiagnostics (neighbor/route tables)
 * plus mDNS-discovered Border Routers. The richer MeshCoP diagnostic enrichment (route64 /
 * childTable → router-router links and diagnostic-only mesh nodes) is a planned follow-up;
 * the wire model already accommodates it.
 */
export class NetworkTopologyService {
    static readonly DEFAULT_DEBOUNCE_MS = 2_000;
    static readonly DEFAULT_PERIODIC_MS = 60_000;
    static readonly DEFAULT_REFRESH_TIMEOUT_MS = 30_000;
    static readonly DEFAULT_REFRESH_CONCURRENCY = 4;

    readonly events = {
        topologyUpdated: new Observable<[NetworkTopology]>(),
    };

    readonly #opts: NetworkTopologyServiceOptions;
    readonly #observers = new ObserverGroup();
    readonly #debounceMs: number;
    readonly #refreshTimeoutMs: number;
    readonly #refreshConcurrency: number;
    #debounceTimer?: NodeJS.Timeout;
    #periodicTimer?: NodeJS.Timeout;
    #lastHash?: string;
    #stopped = false;

    constructor(opts: NetworkTopologyServiceOptions) {
        this.#opts = opts;
        this.#debounceMs = opts.debounceMs ?? NetworkTopologyService.DEFAULT_DEBOUNCE_MS;
        this.#refreshTimeoutMs = opts.refreshTimeoutMs ?? NetworkTopologyService.DEFAULT_REFRESH_TIMEOUT_MS;
        this.#refreshConcurrency = opts.refreshConcurrency ?? NetworkTopologyService.DEFAULT_REFRESH_CONCURRENCY;
        const periodicMs = opts.periodicMs ?? NetworkTopologyService.DEFAULT_PERIODIC_MS;

        this.#observers.on(opts.controllerEvents.attributeChanged, (...args: any[]) => {
            const clusterId = args[1]?.path?.clusterId;
            if (typeof clusterId === "number" && TOPOLOGY_CLUSTERS.has(clusterId)) {
                this.#scheduleRebuild();
            }
        });
        this.#observers.on(opts.controllerEvents.nodeAvailabilityChanged, () => this.#scheduleRebuild());
        this.#observers.on(opts.controllerEvents.nodeAdded, () => this.#scheduleRebuild());
        this.#observers.on(opts.controllerEvents.nodeDecommissioned, () => this.#scheduleRebuild());
        this.#observers.on(opts.borderRouters.events.added, () => this.#scheduleRebuild());
        this.#observers.on(opts.borderRouters.events.updated, () => this.#scheduleRebuild());
        this.#observers.on(opts.borderRouters.events.removed, () => this.#scheduleRebuild());

        this.#periodicTimer = setInterval(() => this.#rebuildAndEmit(), periodicMs);
        // Don't let the periodic rebuild keep the process alive on shutdown.
        this.#periodicTimer.unref?.();
    }

    /** Build a fresh snapshot from the current caches. Pure read — does not emit. */
    getTopology(): NetworkTopology {
        return this.#build();
    }

    /**
     * Re-read the Thread neighbor/route tables (and WiFi diagnostics) from every online node,
     * then rebuild. Reads are concurrency-capped and best-effort (a failing/slow node is
     * skipped), mirroring the dashboard's "update connections" action. Once the overall
     * deadline expires no further reads start; reads already in flight run to completion
     * (their results land in the cache and surface via the next rebuild).
     */
    async refresh(): Promise<NetworkTopology> {
        if (this.#stopped) return this.#build();

        const tasks: Array<() => Promise<void>> = [];
        for (const node of this.#opts.listNodes()) {
            if (node.available === false) continue;
            const networkType = getNetworkType(node);
            const paths =
                networkType === "thread"
                    ? THREAD_REFRESH_PATHS
                    : networkType === "wifi"
                      ? WIFI_REFRESH_PATHS
                      : undefined;
            if (paths === undefined) continue;
            const nodeId = node.node_id;
            tasks.push(() =>
                this.#opts
                    .readAttributes(nodeId, paths)
                    .catch(err => logger.debug(`refresh read failed node=${nodeId}: ${err}`)),
            );
        }

        await this.#runWithDeadline(tasks);

        // stop() may have landed while awaiting the reads; a stopped service must not emit.
        const topology = this.#build();
        if (!this.#stopped) this.#emitIfChanged(topology);
        return topology;
    }

    /** Cancel timers and unsubscribe. Idempotent. */
    stop(): void {
        this.#stopped = true;
        this.#observers.close();
        if (this.#debounceTimer !== undefined) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = undefined;
        }
        if (this.#periodicTimer !== undefined) {
            clearInterval(this.#periodicTimer);
            this.#periodicTimer = undefined;
        }
    }

    #scheduleRebuild(): void {
        if (this.#stopped) return;
        if (this.#debounceTimer !== undefined) clearTimeout(this.#debounceTimer);
        this.#debounceTimer = setTimeout(() => {
            this.#debounceTimer = undefined;
            this.#rebuildAndEmit();
        }, this.#debounceMs);
        this.#debounceTimer.unref?.();
    }

    #rebuildAndEmit(): void {
        if (this.#stopped) return;
        try {
            this.#emitIfChanged(this.#build());
        } catch (err) {
            logger.warn(`topology rebuild failed: ${err}`);
        }
    }

    #emitIfChanged(topology: NetworkTopology): void {
        const hash = hashTopology(topology);
        if (hash === this.#lastHash) return;
        this.#lastHash = hash;
        logger.debug(`topology changed: ${topology.nodes.length} nodes, ${topology.connections.length} connections`);
        this.events.topologyUpdated.emit(topology);
    }

    async #runWithDeadline(tasks: Array<() => Promise<void>>): Promise<void> {
        if (tasks.length === 0) return;
        let expired = false;
        let timer: NodeJS.Timeout | undefined;
        const deadline = new Promise<void>(resolve => {
            timer = setTimeout(() => {
                expired = true;
                resolve();
            }, this.#refreshTimeoutMs);
            timer.unref?.();
        });
        try {
            await Promise.race([runWithConcurrency(tasks, this.#refreshConcurrency, () => expired), deadline]);
        } finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    }

    #build(): NetworkTopology {
        const collectedAt = Date.now();
        const allNodes = this.#opts.listNodes();

        const brList = this.#opts.borderRouters.list();
        const brByExt = new Map<string, BorderRouterEntry>();
        const networkNameByXp = new Map<string, string>();
        for (const br of brList) {
            brByExt.set(br.extAddressHex.toUpperCase(), br);
            if (br.extendedPanIdHex !== undefined && br.networkName !== undefined) {
                networkNameByXp.set(br.extendedPanIdHex.toUpperCase(), br.networkName);
            }
        }

        const nodes: NetworkTopologyNode[] = [];
        const connections: NetworkTopologyConnection[] = [];
        const threadNodes: Record<string, TopologyNode> = {};

        // --- Commissioned Matter nodes ---
        for (const node of allNodes) {
            const id = String(node.node_id);
            const networkType = getNetworkType(node);
            const available = node.available !== false;
            const isBridge = node.is_bridge === true ? true : undefined;

            if (networkType === "thread") {
                threadNodes[id] = node;
                const xp = getThreadExtendedPanId(node);
                const extPanIdHex = xp !== undefined ? xp.toString(16).padStart(16, "0").toUpperCase() : undefined;
                nodes.push({
                    id,
                    kind: "matter",
                    network_type: "thread",
                    node_id: node.node_id,
                    role: mapThreadRole(getThreadRole(node)),
                    available,
                    is_bridge: isBridge,
                    ext_address: getThreadExtendedAddressHex(node),
                    rloc16: getThreadRloc16(node),
                    ext_pan_id: extPanIdHex,
                    network_name: extPanIdHex !== undefined ? networkNameByXp.get(extPanIdHex) : undefined,
                });
            } else if (networkType === "wifi") {
                nodes.push({
                    id,
                    kind: "matter",
                    network_type: "wifi",
                    node_id: node.node_id,
                    role: "station",
                    available,
                    is_bridge: isBridge,
                });
            } else {
                nodes.push({
                    id,
                    kind: "matter",
                    network_type: networkType,
                    node_id: node.node_id,
                    available,
                    is_bridge: isBridge,
                });
            }
        }

        // --- Thread externals (neighbors not commissioned here) + edges ---
        const extAddrMap = buildExtAddrMap(threadNodes);
        const rloc16Map = buildRloc16Map(threadNodes);
        const externals = findUnknownDevices(threadNodes, extAddrMap, rloc16Map, brByExt);
        for (const ext of externals) {
            nodes.push(mapExternal(ext));
        }
        const edgePairs = buildThreadEdgePairs(threadNodes, extAddrMap, rloc16Map, externals);
        for (const pair of edgePairs.values()) {
            const connection = mapThreadPair(pair);
            if (connection !== undefined) connections.push(connection);
        }

        // --- WiFi star: one AP pseudo-node per BSSID, station → AP edges ---
        const seenAps = new Set<string>();
        for (const node of allNodes) {
            if (getNetworkType(node) !== "wifi") continue;
            const { bssid, rssi } = getWiFiDiagnostics(node);
            if (bssid === null) continue;
            const apId = `ap_${bssid.replace(/:/g, "")}`;
            if (!seenAps.has(apId)) {
                seenAps.add(apId);
                nodes.push({ id: apId, kind: "wifi_ap", network_type: "wifi", role: "ap", network_name: bssid });
            }
            const strength = rssiToStrength(rssi);
            connections.push({
                source: String(node.node_id),
                target: apId,
                network: "wifi",
                strength,
                source_to_target: { strength, rssi: rssi ?? undefined },
            });
        }

        return { collected_at: collectedAt, nodes, connections };
    }
}

/** Map ThreadNetworkDiagnostics RoutingRole (0/53/1) to a wire role. */
function mapThreadRole(role: number | undefined): TopologyRole | undefined {
    switch (role) {
        case 6:
            return "leader";
        case 5:
            return "router";
        case 4:
            return "reed";
        case 3:
            return "end_device";
        case 2:
            return "sleepy_end_device";
        case 1:
            return "unassigned";
        default:
            return undefined;
    }
}

function mapExternal(ext: ThreadExternalDevice): NetworkTopologyNode {
    if (ext.kind === "br") {
        return {
            id: ext.id,
            kind: "border_router",
            network_type: "thread",
            role: "router",
            ext_address: ext.extAddressHex,
            ext_pan_id: ext.extendedPanIdHex?.toUpperCase(),
            network_name: ext.networkName,
            vendor_name: ext.vendorName,
            model_name: ext.modelName,
            last_seen: ext.lastSeen,
        };
    }
    return {
        id: ext.id,
        kind: "thread_unknown",
        network_type: "thread",
        role: ext.isRouter ? "router" : undefined,
        ext_address: ext.extAddressHex,
        ext_pan_id: ext.extendedPanIdHex?.toUpperCase(),
        network_name: ext.networkName,
    };
}

/**
 * Fold the 0-2 directional edges of a Thread pair into one wire connection. Both directions are
 * preserved (asymmetry stays legible); the summary `strength` is the strongest observed direction.
 * Pairs where every observed direction is dead (LQI 0 → "none") are dropped.
 */
function mapThreadPair(pair: ThreadEdgePair): NetworkTopologyConnection | undefined {
    const { edgeAB, edgeBA } = pair; // edgeAB: nodeA→nodeB (source→target), edgeBA: nodeB→nodeA
    const levels = [edgeAB?.signalLevel, edgeBA?.signalLevel].filter((l): l is TopologyStrength => l !== undefined);
    if (levels.length === 0 || !levels.some(level => level !== "none")) return undefined;

    return {
        source: pair.nodeA,
        target: pair.nodeB,
        network: "thread",
        strength: strongestLevel(levels),
        source_to_target: edgeAB !== undefined ? directionInfo(edgeAB) : undefined,
        target_to_source: edgeBA !== undefined ? directionInfo(edgeBA) : undefined,
        via_route_table: edgeAB?.fromRouteTable === true || edgeBA?.fromRouteTable === true ? true : undefined,
        path_cost: edgeAB?.pathCost ?? edgeBA?.pathCost,
    };
}

function directionInfo(conn: ThreadConnection): TopologyDirectionInfo {
    return { strength: conn.signalLevel, lqi: conn.lqi, rssi: conn.rssi ?? undefined };
}

const LEVEL_RANK: Record<TopologyStrength, number> = { none: 0, weak: 1, medium: 2, strong: 3 };

function strongestLevel(levels: TopologyStrength[]): TopologyStrength {
    return levels.reduce((best, level) => (LEVEL_RANK[level] > LEVEL_RANK[best] ? level : best), "none");
}

/** WiFi RSSI → strength (ports the dashboard's -70/-85 dBm thresholds). Unknown RSSI is treated as medium. */
function rssiToStrength(rssi: number | null): TopologyStrength {
    if (rssi === null) return "medium";
    if (rssi > -70) return "strong";
    if (rssi > -85) return "medium";
    return "weak";
}

/**
 * Stable hash of the graph, excluding `collected_at`, so a rebuild that produced an identical
 * graph does not re-emit. Nodes/connections are sorted by identity first: their build order isn't
 * guaranteed stable (listNodes iteration, neighbor-table arrival order), and the graph is a set —
 * a reordering is not a change. Node ids (bigint) are stringified for JSON.
 */
function hashTopology(topology: NetworkTopology): string {
    const nodes = [...topology.nodes].sort((a, b) => compareStrings(a.id, b.id));
    const connections = [...topology.connections].sort(
        (a, b) =>
            compareStrings(a.source, b.source) ||
            compareStrings(a.target, b.target) ||
            compareStrings(a.network, b.network),
    );
    return JSON.stringify({ nodes, connections }, (_key, value) => (typeof value === "bigint" ? `${value}n` : value));
}

function compareStrings(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Run thunks with a bounded number in flight. Each thunk owns its own error handling.
 * `cancelled` stops workers from STARTING further tasks; in-flight tasks still run to
 * completion (attribute reads offer no cancellation).
 */
async function runWithConcurrency(
    tasks: Array<() => Promise<void>>,
    concurrency: number,
    cancelled: () => boolean = () => false,
): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < tasks.length && !cancelled()) {
            const task = tasks[next++];
            await task();
        }
    };
    const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
