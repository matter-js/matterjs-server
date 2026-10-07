/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { asObject, pickNumber, tagField, toNumber, toText } from "./attribute-shapes.js";

export const OPERATIONAL_STATE_CLUSTER_ID = 0x0060;
export const RVC_OPERATIONAL_STATE_CLUSTER_ID = 0x0061;
export const OVEN_CAVITY_OPERATIONAL_STATE_CLUSTER_ID = 0x0048;

export const OPERATIONAL_STATE_LIST_ATTR = 3;
export const OPERATIONAL_STATE_ATTR = 4;
export const OPERATIONAL_ERROR_ATTR = 5;
export const ACCEPTED_COMMAND_LIST_ATTR = 0xfff9;

const ERROR_STATE_ID_FIELD = 0;
const ERROR_STATE_LABEL_FIELD = 1;
const ERROR_STATE_DETAILS_FIELD = 2;

const OPERATIONAL_STATE_ID_FIELD = 0;
const OPERATIONAL_STATE_LABEL_FIELD = 1;

export enum OperationalState {
    Stopped = 0,
    Running = 1,
    Paused = 2,
    Error = 3,
}

export enum RvcOperationalState {
    SeekingCharger = 64,
    Charging = 65,
    Docked = 66,
    EmptyingDustBin = 67,
    CleaningMop = 68,
    FillingWaterTank = 69,
    UpdatingMaps = 70,
}

export enum ErrorState {
    NoError = 0,
    UnableToStartOrResume = 1,
    UnableToCompleteOperation = 2,
    CommandInvalidInState = 3,
}

export enum RvcErrorState {
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

export enum OperationalCommand {
    Pause = 0,
    Stop = 1,
    Start = 2,
    Resume = 3,
    GoHome = 128,
}

const BASE_STATE_NAMES: Record<number, string> = {
    [OperationalState.Stopped]: "Stopped",
    [OperationalState.Running]: "Running",
    [OperationalState.Paused]: "Paused",
    [OperationalState.Error]: "Error",
};

const BASE_ERROR_NAMES: Record<number, string> = {
    [ErrorState.NoError]: "No Error",
    [ErrorState.UnableToStartOrResume]: "Unable to Start or Resume",
    [ErrorState.UnableToCompleteOperation]: "Unable to Complete Operation",
    [ErrorState.CommandInvalidInState]: "Command Invalid in Current State",
};

export interface OperationalCommandInfo {
    name: string;
    label: string;
    id: OperationalCommand;
}

const PAUSE: OperationalCommandInfo = { name: "Pause", label: "Pause", id: OperationalCommand.Pause };
const STOP: OperationalCommandInfo = { name: "Stop", label: "Stop", id: OperationalCommand.Stop };
const START: OperationalCommandInfo = { name: "Start", label: "Start", id: OperationalCommand.Start };
const RESUME: OperationalCommandInfo = { name: "Resume", label: "Resume", id: OperationalCommand.Resume };
const GO_HOME: OperationalCommandInfo = { name: "GoHome", label: "Go Home", id: OperationalCommand.GoHome };

/**
 * A cluster derived from OperationalState: the base enums extended by its own states and errors,
 * and the commands its derivation allows.
 */
export interface OperationalStateVariant {
    clusterId: number;
    title: string;
    stateNames: Readonly<Record<number, string>>;
    errorNames: Readonly<Record<number, string>>;
    commands: readonly OperationalCommandInfo[];
}

export const OPERATIONAL_STATE_VARIANTS: Readonly<Partial<Record<number, OperationalStateVariant>>> = {
    [OPERATIONAL_STATE_CLUSTER_ID]: {
        clusterId: OPERATIONAL_STATE_CLUSTER_ID,
        title: "Operational State",
        stateNames: BASE_STATE_NAMES,
        errorNames: BASE_ERROR_NAMES,
        commands: [START, STOP, PAUSE, RESUME],
    },
    [RVC_OPERATIONAL_STATE_CLUSTER_ID]: {
        clusterId: RVC_OPERATIONAL_STATE_CLUSTER_ID,
        title: "RVC Operational State",
        stateNames: {
            ...BASE_STATE_NAMES,
            [RvcOperationalState.SeekingCharger]: "Seeking Charger",
            [RvcOperationalState.Charging]: "Charging",
            [RvcOperationalState.Docked]: "Docked",
            [RvcOperationalState.EmptyingDustBin]: "Emptying Dust Bin",
            [RvcOperationalState.CleaningMop]: "Cleaning Mop",
            [RvcOperationalState.FillingWaterTank]: "Filling Water Tank",
            [RvcOperationalState.UpdatingMaps]: "Updating Maps",
        },
        errorNames: {
            ...BASE_ERROR_NAMES,
            [RvcErrorState.FailedToFindChargingDock]: "Failed to Find Charging Dock",
            [RvcErrorState.Stuck]: "Stuck",
            [RvcErrorState.DustBinMissing]: "Dust Bin Missing",
            [RvcErrorState.DustBinFull]: "Dust Bin Full",
            [RvcErrorState.WaterTankEmpty]: "Water Tank Empty",
            [RvcErrorState.WaterTankMissing]: "Water Tank Missing",
            [RvcErrorState.WaterTankLidOpen]: "Water Tank Lid Open",
            [RvcErrorState.MopCleaningPadMissing]: "Mop Cleaning Pad Missing",
            [RvcErrorState.LowBattery]: "Low Battery",
            [RvcErrorState.CannotReachTargetArea]: "Cannot Reach Target Area",
            [RvcErrorState.DirtyWaterTankFull]: "Dirty Water Tank Full",
            [RvcErrorState.DirtyWaterTankMissing]: "Dirty Water Tank Missing",
            [RvcErrorState.WheelsJammed]: "Wheels Jammed",
            [RvcErrorState.BrushJammed]: "Brush Jammed",
            [RvcErrorState.NavigationSensorObscured]: "Navigation Sensor Obscured",
        },
        commands: [PAUSE, RESUME, GO_HOME],
    },
    [OVEN_CAVITY_OPERATIONAL_STATE_CLUSTER_ID]: {
        clusterId: OVEN_CAVITY_OPERATIONAL_STATE_CLUSTER_ID,
        title: "Oven Cavity Operational State",
        stateNames: BASE_STATE_NAMES,
        errorNames: BASE_ERROR_NAMES,
        commands: [START, STOP],
    },
};

/**
 * Ids the variant does not name (manufacturer-specific 128-191, or a newer spec value) fall back to the
 * label the device supplies with the id.
 */
export function operationalStateLabel(variant: OperationalStateVariant, id: number, deviceLabel?: string): string {
    return variant.stateNames[id] ?? deviceLabel ?? `Unknown (${id})`;
}

export function errorStateLabel(variant: OperationalStateVariant, id: number, deviceLabel?: string): string {
    return variant.errorNames[id] ?? deviceLabel ?? `Unknown (${id})`;
}

/** Decoded ErrorStateStruct, used for both the attribute and command responses. */
export interface ErrorStateInfo {
    errorStateId: number;
    /** NoError (0) is a healthy status, not a fault, so callers must not style it as an error. */
    isError: boolean;
    label: string;
    details?: string;
}

/** Label of a manufacturer-specific state from OperationalStateList, delivered field-tag keyed. */
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

/** The OperationalState attribute as a label, or null when it is absent or not a number. */
export function describeOperationalState(
    variant: OperationalStateVariant,
    value: unknown,
    stateList?: unknown,
): string | null {
    const id = toNumber(value);
    if (id === undefined) return null;
    return operationalStateLabel(variant, id, operationalStateLabelFromList(stateList, id));
}

/** OperationalError attribute: an ErrorStateStruct, delivered field-tag keyed. */
export function decodeOperationalError(variant: OperationalStateVariant, value: unknown): ErrorStateInfo | null {
    const obj = asObject(value);
    if (obj === null) return null;
    const id = toNumber(tagField(obj, ERROR_STATE_ID_FIELD));
    if (id === undefined) return null;
    return {
        errorStateId: id,
        isError: id !== ErrorState.NoError,
        label: errorStateLabel(variant, id, toText(tagField(obj, ERROR_STATE_LABEL_FIELD))),
        details: toText(tagField(obj, ERROR_STATE_DETAILS_FIELD)),
    };
}

/**
 * OperationalCommandResponse carries a commandResponseState (ErrorStateStruct) whose errorStateId
 * reports rejection even when the invoke itself succeeds, so a successful transport does not mean the
 * device accepted the command. Unlike the attribute, the response reaches the client name keyed, with
 * the wire spelling `errorStateID` (legacy `errorStateId` as fallback).
 */
export function decodeOperationalCommandResponse(variant: OperationalStateVariant, response: unknown): ErrorStateInfo {
    const state = asObject(asObject(response)?.["commandResponseState"]);
    const id = state === null ? null : pickNumber(state, "errorStateID", "errorStateId");
    if (state === null || id === null) {
        throw new Error("The device answer carries no command response state");
    }
    return {
        errorStateId: id,
        isError: id !== ErrorState.NoError,
        label: errorStateLabel(variant, id, toText(state["errorStateLabel"])),
        details: toText(state["errorStateDetails"]),
    };
}

/** The accepted command ids, or undefined while AcceptedCommandList has not been reported. */
export function decodeAcceptedCommands(value: unknown): ReadonlySet<number> | undefined {
    if (!Array.isArray(value)) return undefined;
    const ids = new Set<number>();
    for (const entry of value) {
        const id = toNumber(entry);
        if (id !== undefined) ids.add(id);
    }
    return ids;
}
