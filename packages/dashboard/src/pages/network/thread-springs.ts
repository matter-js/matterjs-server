/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** Spring length per LQI stage, index = LQI 0..3 (OpenThread reports 0-3). */
const LQI_EDGE_LENGTHS = [340, 270, 190, 100];

/** Extra spring length for an edge on a node with a single spring, pushing leaves outward. */
export const LEAF_EDGE_LENGTH_PENALTY = 70;

/** Map an averaged LQI to a physics spring length, interpolating between stages. */
export function lqiToEdgeLength(avgLqi: number): number {
    const clamped = Math.min(LQI_EDGE_LENGTHS.length - 1, Math.max(0, avgLqi));
    const lower = Math.floor(clamped);
    const upper = Math.ceil(clamped);
    if (lower === upper) return LQI_EDGE_LENGTHS[lower];
    return LQI_EDGE_LENGTHS[lower] + (LQI_EDGE_LENGTHS[upper] - LQI_EDGE_LENGTHS[lower]) * (clamped - lower);
}

/** vis.js mass of a node without enough mesh links to need more. */
export const DEFAULT_NODE_MASS = 1;

/** Mesh links a node may have before it gets more than {@link DEFAULT_NODE_MASS}. */
const MESH_LINKS_AT_DEFAULT_MASS = 4;

/**
 * vis.js node mass for a node with the given number of mesh links, i.e. live springs between two non-leaf nodes.
 * barnesHut repulsion scales with the product of both masses, so a densely meshed router core spreads out instead of
 * collapsing under its many springs. Links to leaves do not count, and a node with up to 4 mesh links keeps
 * {@link DEFAULT_NODE_MASS}: every extra unit of mass also pushes leaves and separate networks further apart.
 */
export function meshLinkCountToMass(meshLinkCount: number): number {
    return DEFAULT_NODE_MASS + Math.max(0, meshLinkCount - MESH_LINKS_AT_DEFAULT_MASS) / 2;
}

/** The vis.js edge options {@link applyThreadSprings} sets. */
export interface ThreadSpringEdge {
    physics?: boolean;
    length?: number;
}

/** One node pair of the Thread graph with its directional edges, hidden or not. */
export interface ThreadSpringPair {
    nodeA: string;
    nodeB: string;
    edges: ThreadSpringEdge[];
    /** Average LQI over the directions that report a live link; undefined for a dead pair (all directions LQI 0) */
    avgLqi?: number;
}

/**
 * Sets `physics` and `length` on every edge and returns the vis.js mass per node id. Nodes without a live spring are
 * absent from the returned map.
 *
 * Each live pair gets exactly one spring, also when the pair is hidden, so filters and dedup never change the layout
 * and hidden nodes stay beside their neighbours. Dead pairs get none. Leaf detection counts these springs, mass counts
 * only the springs between two non-leaf nodes. vis.js ignores `hidden` for physics, so every edge must get an explicit
 * `physics` value.
 */
export function applyThreadSprings(pairs: readonly ThreadSpringPair[]): Map<string, number> {
    const springCounts = new Map<string, number>();
    for (const { nodeA, nodeB, avgLqi } of pairs) {
        if (avgLqi === undefined) continue;
        springCounts.set(nodeA, (springCounts.get(nodeA) ?? 0) + 1);
        springCounts.set(nodeB, (springCounts.get(nodeB) ?? 0) + 1);
    }

    const meshLinkCounts = new Map<string, number>();
    for (const { nodeA, nodeB, edges, avgLqi } of pairs) {
        const isLeafLink = springCounts.get(nodeA) === 1 || springCounts.get(nodeB) === 1;
        if (avgLqi !== undefined && !isLeafLink) {
            meshLinkCounts.set(nodeA, (meshLinkCounts.get(nodeA) ?? 0) + 1);
            meshLinkCounts.set(nodeB, (meshLinkCounts.get(nodeB) ?? 0) + 1);
        }
        const length =
            avgLqi === undefined ? undefined : lqiToEdgeLength(avgLqi) + (isLeafLink ? LEAF_EDGE_LENGTH_PENALTY : 0);
        edges.forEach((edge, index) => {
            edge.physics = length !== undefined && index === 0;
            if (length !== undefined) edge.length = length;
        });
    }

    const masses = new Map<string, number>();
    for (const nodeId of springCounts.keys()) {
        masses.set(nodeId, meshLinkCountToMass(meshLinkCounts.get(nodeId) ?? 0));
    }
    return masses;
}
