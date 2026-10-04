/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { asObject, pickNumber, tagField, toNumber, toText } from "./attribute-shapes.js";

export const RVC_OPERATIONAL_STATE_CLUSTER_ID = 97; // 0x0061

export const OPERATIONAL_STATE_LIST_ATTR = 3;
export const OPERATIONAL_STATE_ATTR = 4;
export const OPERATIONAL_ERROR_ATTR = 5;
export const ACCEPTED_COMMAND_LIST_ATTR = 0xfff9; // 65529

/** ErrorStateStruct field tags. */
const ERROR_STATE_ID_FIELD = 0;
const ERROR_STATE_LABEL_FIELD = 1;
const ERROR_STATE_DETAILS_FIELD = 2;

/** OperationalStateStruct field tags. */
const OPERATIONAL_STATE_ID_FIELD = 0;
const OPERATIONAL_STATE_LABEL_FIELD = 1;

export enum OperationalState {
    Stopped = 0,
    Running = 1,
    Paused = 2,
    Error = 3,
    SeekingCharger = 64,
    Charging = 65,
    Docked = 66,
    EmptyingDustBin = 67,
    CleaningMop = 68,
    FillingWaterTank = 69,
    UpdatingMaps = 70,
}

const OPERATIONAL_STATE_NAMES: Record<number, string> = {
    [OperationalState.Stopped]: "Stopped",
    [OperationalState.Running]: "Running",
    [OperationalState.Paused]: "Paused",
    [OperationalState.Error]: "Error",
    [OperationalState.SeekingCharger]: "Seeking Charger",
    [OperationalState.Charging]: "Charging",
    [OperationalState.Docked]: "Docked",
    [OperationalState.EmptyingDustBin]: "Emptying Dust Bin",
    [OperationalState.CleaningMop]: "Cleaning Mop",
    [OperationalState.FillingWaterTank]: "Filling Water Tank",
    [OperationalState.UpdatingMaps]: "Updating Maps",
};

export enum ErrorState {
    NoError = 0,
    UnableToStartOrResume = 1,
    UnableToCompleteOperation = 2,
    CommandInvalidInState = 3,
    FailedToFindChargingDock = 64,
    Stuck = 65,
    DustBinMissing = 66,
    DustBinFull = 67,
    WaterTankEmpty = 68,
    WaterTankMissing = 69,
    WaterTankLidOpen = 70,
    MopCleaningPadMissing = 71,
    LowBattery = 72,
    CannotReachTargetArea = 73,
    DirtyWaterTankFull = 74,
    DirtyWaterTankMissing = 75,
    WheelsJammed = 76,
    BrushJammed = 77,
    NavigationSensorObscured = 78,
}

const ERROR_STATE_NAMES: Record<number, string> = {
    [ErrorState.NoError]: "No Error",
    [ErrorState.UnableToStartOrResume]: "Unable to Start or Resume",
    [ErrorState.UnableToCompleteOperation]: "Unable to Complete Operation",
    [ErrorState.CommandInvalidInState]: "Command Invalid in Current State",
    [ErrorState.FailedToFindChargingDock]: "Failed to Find Charging Dock",
    [ErrorState.Stuck]: "Stuck",
    [ErrorState.DustBinMissing]: "Dust Bin Missing",
    [ErrorState.DustBinFull]: "Dust Bin Full",
    [ErrorState.WaterTankEmpty]: "Water Tank Empty",
    [ErrorState.WaterTankMissing]: "Water Tank Missing",
    [ErrorState.WaterTankLidOpen]: "Water Tank Lid Open",
    [ErrorState.MopCleaningPadMissing]: "Mop Cleaning Pad Missing",
    [ErrorState.LowBattery]: "Low Battery",
    [ErrorState.CannotReachTargetArea]: "Cannot Reach Target Area",
    [ErrorState.DirtyWaterTankFull]: "Dirty Water Tank Full",
    [ErrorState.DirtyWaterTankMissing]: "Dirty Water Tank Missing",
    [ErrorState.WheelsJammed]: "Wheels Jammed",
    [ErrorState.BrushJammed]: "Brush Jammed",
    [ErrorState.NavigationSensorObscured]: "Navigation Sensor Obscured",
};

export enum RvcOperationalCommand {
    Pause = 0,
    Resume = 3,
    GoHome = 128,
}

/**
 * Manufacturer-specific states/errors (IDs 128-191) carry no base name, so the device supplies a
 * display label alongside the id; it is used only when the enum does not recognise the id.
 */
export function operationalStateLabel(id: number, deviceLabel?: string): string {
    return OPERATIONAL_STATE_NAMES[id] ?? deviceLabel ?? `Unknown (${id})`;
}

export function errorStateLabel(id: number, deviceLabel?: string): string {
    return ERROR_STATE_NAMES[id] ?? deviceLabel ?? `Unknown (${id})`;
}

/** Decoded ErrorStateStruct, used for both the attribute and command responses. */
export interface ErrorStateInfo {
    errorStateId: number;
    /** NoError (0) is a healthy status, not a fault, so callers must not style it as an error. */
    isError: boolean;
    label: string;
    details?: string;
}

/**
 * OperationalStateList (attribute 3) is an array of OperationalStateStruct carrying the
 * OperationalStateLabel for manufacturer-specific ids. Entries reach the dashboard field-tag keyed.
 */
function operationalStateLabelFromList(stateList: unknown, id: number): string | undefined {
    if (!Array.isArray(stateList)) return undefined;
    for (const entry of stateList) {
        const obj = asObject(entry);
        if (obj !== null && toNumber(tagField(obj, OPERATIONAL_STATE_ID_FIELD)) === id) {
            return toText(tagField(obj, OPERATIONAL_STATE_LABEL_FIELD));
        }
    }
    return undefined;
}

/**
 * OperationalState attribute is a plain enum. Returns null when the attribute is absent or
 * not a number, so the UI shows nothing rather than a fabricated state. For manufacturer-specific
 * ids it resolves the label from OperationalStateList when that attribute is supplied.
 */
export function describeOperationalState(value: unknown, stateList?: unknown): string | null {
    const id = toNumber(value);
    if (id === undefined) return null;
    return operationalStateLabel(id, operationalStateLabelFromList(stateList, id));
}

/** OperationalError attribute: an ErrorStateStruct, delivered field-tag keyed. */
export function decodeOperationalError(value: unknown): ErrorStateInfo | null {
    const obj = asObject(value);
    if (obj === null) return null;
    const id = toNumber(tagField(obj, ERROR_STATE_ID_FIELD));
    if (id === undefined) return null;
    return {
        errorStateId: id,
        isError: id !== ErrorState.NoError,
        label: errorStateLabel(id, toText(tagField(obj, ERROR_STATE_LABEL_FIELD))),
        details: toText(tagField(obj, ERROR_STATE_DETAILS_FIELD)),
    };
}

/**
 * OperationalCommandResponse carries a commandResponseState (ErrorStateStruct) whose errorStateId
 * reports rejection even when the invoke itself succeeds, so a successful transport does not mean the
 * device accepted the command. Unlike the attribute, the response reaches the client name keyed, with
 * the wire spelling `errorStateID` (legacy `errorStateId` as fallback).
 */
export function decodeOperationalCommandResponse(response: unknown): ErrorStateInfo {
    const state = asObject(asObject(response)?.["commandResponseState"]);
    const id = state === null ? null : pickNumber(state, "errorStateID", "errorStateId");
    if (state === null || id === null) {
        throw new Error("The device answer carries no command response state");
    }
    return {
        errorStateId: id,
        isError: id !== ErrorState.NoError,
        label: errorStateLabel(id, toText(state["errorStateLabel"])),
        details: toText(state["errorStateDetails"]),
    };
}

/** The accepted command ids, or undefined while AcceptedCommandList has not been reported. */
export function decodeAcceptedCommands(value: unknown): ReadonlySet<number> | undefined {
    const ids = new Set<number>();
    if (!Array.isArray(value)) return undefined;
    for (const entry of value) {
        const id = toNumber(entry);
        if (id !== undefined) ids.add(id);
    }
    return ids;
}
