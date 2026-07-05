/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber, pickString } from "./attribute-shapes.js";

/** Chime cluster (Matter spec). */
export const CHIME_CLUSTER_ID = 1366; // 0x0556

const ATTR_INSTALLED_SOUNDS = 0;
const ATTR_SELECTED_CHIME = 1;
const ATTR_ENABLED = 2;
const ATTR_CLUSTER_REVISION = 0xfffd;

export interface ChimeSound {
    chimeId: number;
    name: string;
}

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${CHIME_CLUSTER_ID}/${attrId}`];
}

export function readSounds(node: MatterNode, endpoint: number): ChimeSound[] {
    const raw = readAttr(node, endpoint, ATTR_INSTALLED_SOUNDS);
    if (!Array.isArray(raw)) return [];
    const out = new Array<ChimeSound>();
    for (const item of raw) {
        const obj = asObject(item);
        if (!obj) continue;
        const id = pickNumber(obj, "chimeId") ?? pickNumber(obj, "0");
        const name = pickString(obj, "name") ?? pickString(obj, "1");
        if (id !== null && name !== null) out.push({ chimeId: id, name });
    }
    return out;
}

export function readSelected(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_SELECTED_CHIME);
    return typeof v === "number" ? v : null;
}

export function readEnabled(node: MatterNode, endpoint: number): boolean {
    const v = readAttr(node, endpoint, ATTR_ENABLED);
    return v === true;
}

export function readRevision(node: MatterNode, endpoint: number): number {
    const v = readAttr(node, endpoint, ATTR_CLUSTER_REVISION);
    return typeof v === "number" ? v : 1;
}

export async function setEnabled(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    enabled: boolean,
): Promise<void> {
    await client.writeAttribute(nodeId, `${endpoint}/${CHIME_CLUSTER_ID}/${ATTR_ENABLED}`, enabled);
}

export async function setSelected(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    chimeId: number,
): Promise<void> {
    await client.writeAttribute(nodeId, `${endpoint}/${CHIME_CLUSTER_ID}/${ATTR_SELECTED_CHIME}`, chimeId);
}

export async function play(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    chimeId?: number,
): Promise<void> {
    const payload = chimeId !== undefined ? { chimeID: chimeId } : {};
    await client.deviceCommand(nodeId, endpoint, CHIME_CLUSTER_ID, "PlayChimeSound", payload);
}
