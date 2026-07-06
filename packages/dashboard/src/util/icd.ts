/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatDuration } from "./duration.js";

export const ICD_CLUSTER_ID = 70;

export interface IcdFeatures {
    checkInProtocolSupport: boolean;
    userActiveModeTrigger: boolean;
    longIdleTimeSupport: boolean;
    dynamicSitLitSupport: boolean;
}

export interface IcdRegisteredClient {
    checkInNodeId: number | bigint;
    monitoredSubject: number | bigint;
    fabricIndex: number;
}

export interface IcdInfo {
    supported: boolean;
    features: IcdFeatures;
    operatingMode: "SIT" | "LIT" | undefined;
    idleModeDuration: number | undefined;
    userActiveModeTriggerHint: number | undefined;
    userActiveModeTriggerInstruction: string | undefined;
    registeredClients: IcdRegisteredClient[];
}

/** IcdManagement FeatureMap bits per Matter 1.6 §9.17.4. */
export function parseIcdFeatures(featureMap: number): IcdFeatures {
    return {
        checkInProtocolSupport: (featureMap & 0b0001) !== 0,
        userActiveModeTrigger: (featureMap & 0b0010) !== 0,
        longIdleTimeSupport: (featureMap & 0b0100) !== 0,
        dynamicSitLitSupport: (featureMap & 0b1000) !== 0,
    };
}

function attr(attributes: Record<string, unknown>, attributeId: number): unknown {
    return attributes[`0/${ICD_CLUSTER_ID}/${attributeId}`];
}

function numberAttr(attributes: Record<string, unknown>, attributeId: number): number | undefined {
    const value = attr(attributes, attributeId);
    return typeof value === "number" ? value : undefined;
}

export function icdInfo(attributes: Record<string, unknown>): IcdInfo {
    const featureMap = numberAttr(attributes, 65532);
    const operatingModeRaw = numberAttr(attributes, 8);
    const clientsRaw = attr(attributes, 3);
    const instruction = attr(attributes, 7);
    return {
        supported: featureMap !== undefined,
        features: parseIcdFeatures(featureMap ?? 0),
        operatingMode: operatingModeRaw === undefined ? undefined : operatingModeRaw === 1 ? "LIT" : "SIT",
        idleModeDuration: numberAttr(attributes, 0),
        userActiveModeTriggerHint: numberAttr(attributes, 6),
        userActiveModeTriggerInstruction: typeof instruction === "string" ? instruction : undefined,
        registeredClients: Array.isArray(clientsRaw)
            ? (clientsRaw as IcdRegisteredClient[])
            : new Array<IcdRegisteredClient>(),
    };
}

/** Badge predicate: the node is an ICD currently operating in LIT mode. */
export function isLitIcd(attributes: Record<string, unknown>): boolean {
    const info = icdInfo(attributes);
    return info.supported && info.operatingMode === "LIT";
}

export function isRegisteredByUs(
    clients: IcdRegisteredClient[],
    controllerNodeId: number | bigint | undefined,
): boolean {
    if (controllerNodeId === undefined) return false;
    return clients.some(client => String(client.checkInNodeId) === String(controllerNodeId));
}

export function otherFabricClientCount(clients: IcdRegisteredClient[], ourFabricIndex: number | undefined): number {
    if (ourFabricIndex === undefined) return clients.length;
    return clients.filter(client => client.fabricIndex !== ourFabricIndex).length;
}

/** UserActiveModeTriggerBitmap per Matter 1.6 §9.17.5.2, mapped to short user instructions. */
const WAKE_HINTS: [mask: number, text: string][] = [
    [1 << 0, "power-cycle the device"],
    [1 << 1, "use the device settings menu"],
    [1 << 4, "actuate the sensor"],
    [1 << 8, "press the reset button"],
    [1 << 12, "press the setup button"],
    [1 << 16, "press the app-defined button"],
];
const CUSTOM_INSTRUCTION = 1 << 2;

export function wakeInstruction(hint: number | undefined, instruction: string | undefined): string {
    if (hint !== undefined && (hint & CUSTOM_INSTRUCTION) !== 0 && instruction !== undefined && instruction !== "") {
        return instruction;
    }
    if (hint !== undefined) {
        for (const [mask, text] of WAKE_HINTS) {
            if ((hint & mask) !== 0) return text;
        }
    }
    return "see the device manual";
}

/** Tooltip for the OFFLINE "ICD" badge. */
export function litOfflineHint(attributes: Record<string, unknown>): string {
    const info = icdInfo(attributes);
    const interval =
        info.idleModeDuration !== undefined ? formatDuration(info.idleModeDuration) : "its check-in interval";
    return `Battery Saver device: it sleeps between check-ins and may come back on its own (check-in interval up to ${interval}). Click for options.`;
}

/** Extracts admin vendor ids from a multi-admin error `details` payload; undefined if not that shape. */
export function parseMultiAdminDetails(message: string): number[] | undefined {
    try {
        const parsed: unknown = JSON.parse(message);
        if (parsed !== null && typeof parsed === "object" && "admin_vendor_ids" in parsed) {
            const ids = (parsed as Record<string, unknown>).admin_vendor_ids;
            if (Array.isArray(ids) && ids.every(id => typeof id === "number")) return ids;
        }
    } catch {
        // not JSON — plain error text
    }
    return undefined;
}
