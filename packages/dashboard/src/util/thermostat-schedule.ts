/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { clusters } from "../client/models/descriptions.js";
import { asObject, pickArray, pickBoolean, pickNumber, pickString } from "./attribute-shapes.js";
import { computeActiveClusterFeatures } from "./cluster-features.js";

/** Thermostat cluster (Matter spec §4.3). */
export const THERMOSTAT_CLUSTER_ID = 513; // 0x0201

const ATTR_ACTIVE_PRESET_HANDLE = 0x4e;
const ATTR_ACTIVE_SCHEDULE_HANDLE = 0x4f;
const ATTR_PRESETS = 0x50;
const ATTR_SCHEDULES = 0x51;
const ATTR_FEATURE_MAP = 0xfffc;

/** Days in display order (Mon..Sun) mapped to their ScheduleDayOfWeekBitmap bit (Sunday=0 .. Saturday=6). */
const DAY_BIT = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SYSTEM_MODE_LABELS: Record<number, string> = {
    0: "Off",
    1: "Auto",
    3: "Cool",
    4: "Heat",
    5: "Emergency Heat",
    6: "Precooling",
    7: "Fan Only",
    8: "Dry",
    9: "Sleep",
};

export interface ThermostatScheduleTransition {
    dayOfWeek: number;
    transitionTimeMin: number;
    presetHandle: string | null;
    systemMode: number | null;
    coolingSetpoint: number | null;
    heatingSetpoint: number | null;
}

export interface ThermostatSchedule {
    handle: string;
    systemMode: number;
    name: string | null;
    presetHandle: string | null;
    transitions: ThermostatScheduleTransition[];
    builtIn: boolean | null;
}

export interface ThermostatPreset {
    handle: string;
    scenario: number | null;
    name: string | null;
    coolingSetpoint: number | null;
    heatingSetpoint: number | null;
    builtIn: boolean | null;
}

export interface DaySegment {
    startMin: number;
    endMin: number;
    heatingSetpoint: number | null;
    coolingSetpoint: number | null;
    presetHandle: string | null;
    systemMode: number | null;
}

export function readThermostatAttribute(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${THERMOSTAT_CLUSTER_ID}/${attrId}`];
}

// Struct attributes reach the dashboard through convertMatterToWebSocketTagBased, so fields are keyed
// by numeric field tag only — never by name, unlike the invoke/event converters.
function decodeTransition(raw: unknown): ThermostatScheduleTransition | null {
    const obj = asObject(raw);
    if (!obj) return null;
    const dayOfWeek = pickNumber(obj, "0");
    const transitionTimeMin = pickNumber(obj, "1");
    if (
        dayOfWeek === null ||
        transitionTimeMin === null ||
        !Number.isInteger(dayOfWeek) ||
        dayOfWeek < 0 ||
        dayOfWeek > 0x7f ||
        !Number.isInteger(transitionTimeMin) ||
        transitionTimeMin < 0 ||
        transitionTimeMin >= 1440
    ) {
        return null;
    }
    return {
        dayOfWeek,
        transitionTimeMin,
        presetHandle: pickString(obj, "2"),
        systemMode: pickNumber(obj, "3"),
        coolingSetpoint: pickNumber(obj, "4"),
        heatingSetpoint: pickNumber(obj, "5"),
    };
}

function decodeSchedule(raw: unknown): ThermostatSchedule | null {
    const obj = asObject(raw);
    if (!obj) return null;
    const handle = pickString(obj, "0");
    const systemMode = pickNumber(obj, "1");
    if (handle === null || systemMode === null) return null;
    const transitions = pickArray(obj, "4")
        .map(decodeTransition)
        .filter((t): t is ThermostatScheduleTransition => t !== null);
    return {
        handle,
        systemMode,
        name: pickString(obj, "2"),
        presetHandle: pickString(obj, "3"),
        transitions,
        builtIn: pickBoolean(obj, "5"),
    };
}

function decodePreset(raw: unknown): ThermostatPreset | null {
    const obj = asObject(raw);
    if (!obj) return null;
    const handle = pickString(obj, "0");
    if (handle === null) return null;
    return {
        handle,
        scenario: pickNumber(obj, "1"),
        name: pickString(obj, "2"),
        coolingSetpoint: pickNumber(obj, "3"),
        heatingSetpoint: pickNumber(obj, "4"),
        builtIn: pickBoolean(obj, "5"),
    };
}

/** PresetScenarioEnum labels (Matter spec §4.3.10.17). */
const PRESET_SCENARIO_LABELS: Record<number, string> = {
    1: "Occupied",
    2: "Unoccupied",
    3: "Sleep",
    4: "Wake",
    5: "Vacation",
    6: "Going to Sleep",
    254: "User Defined",
};

/** A preset's display name: its own Name when set, else its PresetScenario label. */
export function formatPresetLabel(preset: ThermostatPreset): string {
    if (preset.name) return preset.name;
    if (preset.scenario !== null) return PRESET_SCENARIO_LABELS[preset.scenario] ?? `Scenario ${preset.scenario}`;
    return formatHandleShort(preset.handle);
}

/** Whether the Thermostat cluster's FeatureMap includes the feature with the given code (e.g. "MSCH", "PRES"). */
export function isFeatureActive(node: MatterNode, endpoint: number, code: string): boolean {
    const knownFeatures = Object.values(clusters[THERMOSTAT_CLUSTER_ID]?.features ?? {});
    const featureMapValue = node.attributes[`${endpoint}/${THERMOSTAT_CLUSTER_ID}/${ATTR_FEATURE_MAP}`];
    if (featureMapValue === undefined) return false;
    return computeActiveClusterFeatures(featureMapValue, knownFeatures).some(feature => feature.code === code);
}

export function readActiveScheduleHandle(node: MatterNode, endpoint: number): string | null {
    const v = readThermostatAttribute(node, endpoint, ATTR_ACTIVE_SCHEDULE_HANDLE);
    return typeof v === "string" ? v : null;
}

export function readActivePresetHandle(node: MatterNode, endpoint: number): string | null {
    const v = readThermostatAttribute(node, endpoint, ATTR_ACTIVE_PRESET_HANDLE);
    return typeof v === "string" ? v : null;
}

/** Decoded Schedules, or undefined when the attribute is not in the node's attribute cache. */
export function readSchedules(node: MatterNode, endpoint: number): ThermostatSchedule[] | undefined {
    const raw = readThermostatAttribute(node, endpoint, ATTR_SCHEDULES);
    if (!Array.isArray(raw)) return undefined;
    return raw.map(decodeSchedule).filter((s): s is ThermostatSchedule => s !== null);
}

/** Decoded Presets, or undefined when the attribute is not in the node's attribute cache. */
export function readPresets(node: MatterNode, endpoint: number): ThermostatPreset[] | undefined {
    const raw = readThermostatAttribute(node, endpoint, ATTR_PRESETS);
    if (!Array.isArray(raw)) return undefined;
    return raw.map(decodePreset).filter((p): p is ThermostatPreset => p !== null);
}

interface ModeLabelSource {
    presetHandle: string | null;
    systemMode: number | null;
}

/** Resolves a transition's (or day segment's) human label: matching preset name, else SystemMode, else a generic fallback. */
export function resolveTransitionLabel(transition: ModeLabelSource, presets: ThermostatPreset[]): string {
    if (transition.presetHandle) {
        const preset = presets.find(p => p.handle === transition.presetHandle);
        if (preset?.name) return preset.name;
    }
    if (transition.systemMode !== null) {
        return SYSTEM_MODE_LABELS[transition.systemMode] ?? `Mode ${transition.systemMode}`;
    }
    return "Setpoint";
}

/**
 * Resolves each transition's effective preset and setpoints by the §4.3.10.27 order of precedence: an own
 * PresetHandle wins, else the transition's own setpoints, and only a transition providing neither falls
 * through to the schedule's default PresetHandle. SystemMode always defaults to the schedule's (§4.3.10.26.2).
 */
export function resolveScheduleDefaults(schedule: ThermostatSchedule, presets: ThermostatPreset[]): ThermostatSchedule {
    return {
        ...schedule,
        transitions: schedule.transitions.map(t => {
            const reportsSetpoint = t.heatingSetpoint !== null || t.coolingSetpoint !== null;
            const presetHandle = t.presetHandle ?? (reportsSetpoint ? null : schedule.presetHandle);
            const preset = presetHandle !== null ? presets.find(p => p.handle === presetHandle) : undefined;
            return {
                ...t,
                presetHandle,
                systemMode: t.systemMode ?? schedule.systemMode,
                coolingSetpoint: preset?.coolingSetpoint ?? t.coolingSetpoint,
                heatingSetpoint: preset?.heatingSetpoint ?? t.heatingSetpoint,
            };
        }),
    };
}

/** Display-order (Mon..Sun) day indices a ScheduleDayOfWeekBitmap claims. */
function claimedDays(dayOfWeek: number): number[] {
    return DAY_BIT.map((bit, day) => ((dayOfWeek & (1 << bit)) !== 0 ? day : -1)).filter(day => day >= 0);
}

/** First claimed day in Mon..Sun display order; 7 when the bitmap claims none, so unclaimed rows sort last. */
export function firstClaimedDay(dayOfWeek: number): number {
    return claimedDays(dayOfWeek)[0] ?? 7;
}

/** Mon..Sun day labels for a ScheduleDayOfWeekBitmap, consecutive runs compressed (e.g. "Mon–Wed, Fri"). */
export function formatDayOfWeek(dayOfWeek: number): string {
    const days = claimedDays(dayOfWeek);
    if (days.length === 0) return "—";
    if (days.length === DAY_LABELS.length) return "Every day";
    const parts = new Array<string>();
    for (let start = 0; start < days.length;) {
        let end = start;
        while (end + 1 < days.length && days[end + 1] === days[end] + 1) end++;
        if (end - start >= 2) {
            parts.push(`${DAY_LABELS[days[start]]}–${DAY_LABELS[days[end]]}`);
        } else {
            for (let i = start; i <= end; i++) parts.push(DAY_LABELS[days[i]]);
        }
        start = end + 1;
    }
    return parts.join(", ");
}

/** Row order for the transitions list: by first claimed day in Mon..Sun display order, then by time. */
export function compareTransitionsForDisplay(a: ThermostatScheduleTransition, b: ThermostatScheduleTransition): number {
    return firstClaimedDay(a.dayOfWeek) - firstClaimedDay(b.dayOfWeek) || a.transitionTimeMin - b.transitionTimeMin;
}

function transitionsForDay(schedule: ThermostatSchedule, day: number): ThermostatScheduleTransition[] {
    const bit = DAY_BIT[day];
    return schedule.transitions
        .filter(t => (t.dayOfWeek & (1 << bit)) !== 0)
        .sort((a, b) => a.transitionTimeMin - b.transitionTimeMin);
}

function segmentOf(t: ThermostatScheduleTransition, startMin: number, endMin: number): DaySegment {
    return {
        startMin,
        endMin,
        heatingSetpoint: t.heatingSetpoint,
        coolingSetpoint: t.coolingSetpoint,
        presetHandle: t.presetHandle,
        systemMode: t.systemMode,
    };
}

function findCarryOverTransition(schedule: ThermostatSchedule, day: number): ThermostatScheduleTransition | undefined {
    for (let back = 1; back < DAY_LABELS.length; back++) {
        const previous = transitionsForDay(schedule, (day + DAY_LABELS.length - back) % DAY_LABELS.length);
        if (previous.length > 0) return previous[previous.length - 1];
    }
    return undefined;
}

/**
 * Ordered, gap-free setpoint segments covering one day (0-1440 min) of a schedule. Per cluster
 * §4.3.10.26.5 the band before the day's first transition carries the last transition of the most
 * recent earlier day the schedule covers.
 */
export function buildDaySegments(schedule: ThermostatSchedule, day: number): DaySegment[] {
    const dayTransitions = transitionsForDay(schedule, day);
    const segments = new Array<DaySegment>();
    if (dayTransitions.length === 0) return segments;

    const first = dayTransitions[0];
    if (first.transitionTimeMin > 0) {
        const carried = findCarryOverTransition(schedule, day) ?? dayTransitions[dayTransitions.length - 1];
        segments.push(segmentOf(carried, 0, first.transitionTimeMin));
    }
    for (let i = 0; i < dayTransitions.length; i++) {
        const t = dayTransitions[i];
        segments.push(
            segmentOf(
                t,
                t.transitionTimeMin,
                i + 1 < dayTransitions.length ? dayTransitions[i + 1].transitionTimeMin : 1440,
            ),
        );
    }
    return segments;
}

/** Matter "temperature" values are int16 hundredths of a degree Celsius. */
export function formatSetpoint(centidegrees: number | undefined | null): string | undefined {
    if (centidegrees === undefined || centidegrees === null) return undefined;
    return `${(centidegrees / 100).toFixed(1)}°C`;
}

export function formatMinutes(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Hover text for a grid segment: its time span, label, and any setpoints — for a native `title` tooltip. */
export function formatSegmentTooltip(seg: DaySegment, presets: ThermostatPreset[]): string {
    const lines = [
        `${formatMinutes(seg.startMin)}–${formatMinutes(seg.endMin)} · ${resolveTransitionLabel(seg, presets)}`,
    ];
    if (seg.heatingSetpoint !== null) lines.push(`Heat ${formatSetpoint(seg.heatingSetpoint)}`);
    if (seg.coolingSetpoint !== null) lines.push(`Cool ${formatSetpoint(seg.coolingSetpoint)}`);
    return lines.join("\n");
}

export type ScheduleColorMode = "heat" | "cool";

interface SetpointPair {
    heatingSetpoint: number | null;
    coolingSetpoint: number | null;
}

/** The setpoint driving a segment's color, falling back to the other mode's when the selected one is absent. */
export function pickSetpointForMode(seg: SetpointPair, mode: ScheduleColorMode): number | null {
    return mode === "heat"
        ? (seg.heatingSetpoint ?? seg.coolingSetpoint)
        : (seg.coolingSetpoint ?? seg.heatingSetpoint);
}

/** Heat and cool setpoints occupy disjoint value bands, so the range covers only the selected mode's setpoints. */
export function computeSetpointRange(
    schedule: ThermostatSchedule,
    mode: ScheduleColorMode,
): { min: number; max: number } | undefined {
    const values = schedule.transitions.map(t => pickSetpointForMode(t, mode)).filter((v): v is number => v !== null);
    if (values.length === 0) return undefined;
    return { min: Math.min(...values), max: Math.max(...values) };
}

/** Clamped 0-100 position of `value` within [min, max], for driving a cold->hot color-mix gradient. */
export function setpointColorMixPercent(value: number, min: number, max: number): number {
    if (max <= min) return 50;
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function decodeHandleBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Short hex label for a base64-encoded schedule/preset handle (e.g. a single-byte handle -> "0x01"). */
export function formatHandleShort(handle: string | null): string {
    if (!handle) return "";
    try {
        const bytes = decodeHandleBytes(handle);
        return `0x${Array.from(bytes)
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase()}`;
    } catch {
        return handle.slice(0, 8);
    }
}
