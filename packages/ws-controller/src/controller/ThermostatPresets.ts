/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Millis, NodeId } from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber, Status } from "@matter/main/types";
import type {
    AttributeResponseStatus,
    AttributesData,
    InvokeRequest,
    WriteAttributeRequest,
} from "../types/CommandHandler.js";
import { ServerError } from "../types/WebSocketMessageTypes.js";

const logger = Logger.get("ThermostatPresets");

/**
 * The slice of {@link ControllerCommandHandler} this module needs: a node's generic attribute read/write and
 * command-invoke primitives, kept narrow so the write handshake and validation can be unit-tested against a fake
 * device without standing up a real matter.js node.
 */
export interface ThermostatPresetHandler {
    handleInvoke(data: InvokeRequest): Promise<unknown>;
    handleReadAttributes(nodeId: NodeId, attributePaths: string[], fabricFiltered?: boolean): Promise<AttributesData>;
    handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus[]>;
}

/** Thermostat cluster (Matter spec §4.3). */
const THERMOSTAT_CLUSTER_ID = ClusterId(513); // 0x0201

const ATTR_ACTIVE_PRESET_HANDLE = 0x4e;
const ATTR_PRESET_TYPES = 0x48;
const ATTR_PRESETS = 0x50;
const ATTR_SCHEDULES = 0x51;

/** PresetTypeFeaturesBitmap (Matter spec §4.3.10.3): bit 1 says a preset of this scenario may carry a Name. */
const PRESET_TYPE_SUPPORTS_NAMES = 0x2;

/** PresetScenarioEnum UserDefined (§4.3.10.17): a preset of this scenario must carry a Name. */
const PRESET_SCENARIO_USER_DEFINED = 254;

/** How long the device holds our pending Presets write before discarding it (AtomicRequest Timeout, ms). */
const ATOMIC_WRITE_TIMEOUT_MS = 5_000;

/** Shortest window the device may grant that still fits the read, the timed write and the commit (ms). */
const MIN_ATOMIC_WRITE_TIMEOUT_MS = 2_000;

/** Timed-interaction window for the Presets write itself (TimedRequest to WriteRequest, ms). */
const TIMED_WRITE_TIMEOUT_MS = 3_000;

enum AtomicRequestType {
    BeginWrite = 0,
    CommitWrite = 1,
    RollbackWrite = 2,
}

// Struct attributes reach this handler tag-keyed (ControllerCommandHandler#handleReadAttributes /
// #handleWriteAttribute convert to and from that wire shape), unlike invoke fields and responses, which are
// name-keyed. These small accessors mirror the dashboard's `attribute-shapes.ts`.

function asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function pickNumber(obj: Record<string, unknown>, key: string): number | null {
    const v = obj[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
    const v = obj[key];
    return typeof v === "string" ? v : null;
}

function pickBoolean(obj: Record<string, unknown>, key: string): boolean | null {
    const v = obj[key];
    return typeof v === "boolean" ? v : null;
}

function pickArray(obj: Record<string, unknown>, key: string): unknown[] {
    const v = obj[key];
    return Array.isArray(v) ? v : [];
}

interface ThermostatPreset {
    handle: string;
    scenario: number | null;
    name: string | null;
    coolingSetpoint: number | null;
    heatingSetpoint: number | null;
    builtIn: boolean | null;
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

function decodePresets(raw: unknown): ThermostatPreset[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(decodePreset).filter((p): p is ThermostatPreset => p !== null);
}

interface ThermostatPresetType {
    scenario: number;
    numberOfPresets: number;
    supportsNames: boolean;
}

function decodePresetType(raw: unknown): ThermostatPresetType | null {
    const obj = asObject(raw);
    if (!obj) return null;
    const scenario = pickNumber(obj, "0");
    const numberOfPresets = pickNumber(obj, "1");
    if (scenario === null || numberOfPresets === null) return null;
    const features = pickNumber(obj, "2") ?? 0;
    return { scenario, numberOfPresets, supportsNames: (features & PRESET_TYPE_SUPPORTS_NAMES) !== 0 };
}

function decodePresetTypes(raw: unknown): ThermostatPresetType[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(decodePresetType).filter((t): t is ThermostatPresetType => t !== null);
}

interface ThermostatScheduleTransition {
    presetHandle: string | null;
}

interface ThermostatSchedule {
    presetHandle: string | null;
    transitions: ThermostatScheduleTransition[];
}

function decodeTransition(raw: unknown): ThermostatScheduleTransition | null {
    const obj = asObject(raw);
    if (!obj) return null;
    return { presetHandle: pickString(obj, "2") };
}

function decodeSchedule(raw: unknown): ThermostatSchedule | null {
    const obj = asObject(raw);
    if (!obj) return null;
    return {
        presetHandle: pickString(obj, "3"),
        transitions: pickArray(obj, "4")
            .map(decodeTransition)
            .filter((t): t is ThermostatScheduleTransition => t !== null),
    };
}

function decodeSchedules(raw: unknown): ThermostatSchedule[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(decodeSchedule).filter((s): s is ThermostatSchedule => s !== null);
}

/** Whether a schedule transition refers to the preset; the device refuses to remove such a preset (§4.3.11.50). */
function isPresetUsedBySchedule(schedules: ThermostatSchedule[], presetHandle: string): boolean {
    return schedules.some(
        s => s.presetHandle === presetHandle || s.transitions.some(t => t.presetHandle === presetHandle),
    );
}

function presetTypeSupportsNames(presetTypes: ThermostatPresetType[], scenario: number | null): boolean {
    return presetTypes.some(t => t.scenario === scenario && t.supportsNames);
}

/** The device's limit on how many presets of `scenario` may exist at once, or null if `scenario` is unknown. */
function presetTypeLimit(presetTypes: ThermostatPresetType[], scenario: number): number | null {
    return presetTypes.find(t => t.scenario === scenario)?.numberOfPresets ?? null;
}

/**
 * Why `name` cannot be used for a preset of `scenario`, or null if it can. Names must be unique per scenario, a
 * missing name included (§4.3.10.23.3), and a UserDefined preset needs one. `exceptHandle` is the preset being edited.
 */
function presetNameConflict(
    presets: ThermostatPreset[],
    scenario: number,
    name: string | null,
    exceptHandle: string | null,
): string | null {
    if (scenario === PRESET_SCENARIO_USER_DEFINED && name === null) return "A user-defined preset needs a name";
    const taken = presets.some(p => p.handle !== exceptHandle && p.scenario === scenario && p.name === name);
    if (!taken) return null;
    return name === null
        ? "Another preset of this scenario already has no name"
        : `Another preset of this scenario is already named "${name}"`;
}

/**
 * The name to write for a preset of `scenario`: dropped (not an explicit null) for a scenario that does not
 * support names, since the CHIP SDK treats an explicit null Name as set and rejects it there. `undefined` keeps
 * `currentName` (there is no current name on a create, so that case has none to pass).
 */
function resolveName(
    presetTypes: ThermostatPresetType[],
    scenario: number,
    name: string | null | undefined,
    currentName: string | null = null,
): string | null {
    if (!presetTypeSupportsNames(presetTypes, scenario)) return null;
    if (name === undefined) return currentName;
    if (name === null) return null;
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** A preset as the write handshake builds it, before it is placed into the full Presets array the device expects. */
interface ThermostatPresetEdit {
    presetHandle: string | null;
    presetScenario: number;
    name: string | null;
    coolingSetpoint: number | null;
    heatingSetpoint: number | null;
    builtIn: boolean;
}

function toPresetEdit(preset: ThermostatPreset): ThermostatPresetEdit {
    return {
        presetHandle: preset.handle,
        presetScenario: preset.scenario ?? 0,
        name: preset.name,
        coolingSetpoint: preset.coolingSetpoint,
        heatingSetpoint: preset.heatingSetpoint,
        builtIn: preset.builtIn === true,
    };
}

/**
 * Tag-keyed PresetStruct as `handleWriteAttribute` expects it. A null setpoint is omitted (the field isn't
 * nullable), and so is a null Name: the CHIP SDK treats an explicit null Name as set and rejects it for a
 * scenario without names.
 */
function toPresetStruct(preset: ThermostatPresetEdit): Record<string, unknown> {
    const struct: Record<string, unknown> = {
        "0": preset.presetHandle,
        "1": preset.presetScenario,
        "5": preset.builtIn,
    };
    if (preset.name !== null) struct["2"] = preset.name;
    if (preset.coolingSetpoint !== null) struct["3"] = preset.coolingSetpoint;
    if (preset.heatingSetpoint !== null) struct["4"] = preset.heatingSetpoint;
    return struct;
}

interface AtomicAttributeStatus {
    attributeId: number;
    statusCode: number;
}

interface AtomicResponse {
    statusCode: number;
    attributeStatus: AtomicAttributeStatus[];
    /** Effective timeout in ms; present only on a BeginWrite response (§7.15.7.3). */
    timeout: number | null;
}

/** AtomicRequest's response is name-keyed, matching matter.js's own command result fields one for one. */
function decodeAtomicResponse(raw: unknown): AtomicResponse {
    const obj = asObject(raw);
    const statusCode = obj ? pickNumber(obj, "statusCode") : null;
    if (!obj || statusCode === null) {
        throw ServerError.sdkStackError("The device answered AtomicRequest without a status");
    }
    const attributeStatus = pickArray(obj, "attributeStatus")
        .map(entry => {
            const status = asObject(entry);
            const attributeId = status ? pickNumber(status, "attributeId") : null;
            const code = status ? pickNumber(status, "statusCode") : null;
            return attributeId === null || code === null ? null : { attributeId, statusCode: code };
        })
        .filter((s): s is AtomicAttributeStatus => s !== null);
    return { statusCode, attributeStatus, timeout: pickNumber(obj, "timeout") };
}

function describeAtomicFailure(response: AtomicResponse): string {
    const code = response.attributeStatus.find(s => s.statusCode !== 0)?.statusCode ?? response.statusCode;
    return `status ${code}`;
}

async function atomicRequest(
    handler: ThermostatPresetHandler,
    nodeId: NodeId,
    endpointId: EndpointNumber,
    requestType: AtomicRequestType,
    attributeRequests: number[],
    timeout?: number,
): Promise<AtomicResponse> {
    return decodeAtomicResponse(
        await handler.handleInvoke({
            nodeId,
            endpointId,
            clusterId: THERMOSTAT_CLUSTER_ID,
            commandName: "AtomicRequest",
            data: { requestType, attributeRequests, timeout },
        }),
    );
}

function presetsPath(endpointId: EndpointNumber): string {
    return `${endpointId}/${THERMOSTAT_CLUSTER_ID}/${ATTR_PRESETS}`;
}

async function readFreshPresets(
    handler: ThermostatPresetHandler,
    nodeId: NodeId,
    endpointId: EndpointNumber,
): Promise<ThermostatPreset[] | undefined> {
    const path = presetsPath(endpointId);
    const result = await handler.handleReadAttributes(nodeId, [path], true);
    return path in result ? decodePresets(result[path]) : undefined;
}

async function writeFreshPresets(
    handler: ThermostatPresetHandler,
    nodeId: NodeId,
    endpointId: EndpointNumber,
    presets: ThermostatPresetEdit[],
): Promise<void> {
    const results = await handler.handleWriteAttribute({
        nodeId,
        endpointId,
        clusterId: THERMOSTAT_CLUSTER_ID,
        attributeId: AttributeId(ATTR_PRESETS),
        value: presets.map(toPresetStruct),
        timedInteractionTimeoutMs: Millis(TIMED_WRITE_TIMEOUT_MS),
    });
    const failed = results.find(r => r.status !== undefined && r.status !== Status.Success);
    if (failed !== undefined) {
        throw ServerError.sdkStackError(`Writing presets failed: status ${failed.status}`);
    }
}

/**
 * Replaces the device's Presets list with the list `buildNext` derives from the device's current one. The result is
 * the full intended list, not a diff: per §4.3.11.50 a handle missing from it is a removal (rejected if that preset is
 * built-in, active or used by a schedule transition) and `presetHandle: null` is an addition.
 *
 * Presets may only be written inside the cluster's atomic-write handshake (§7.15.3). The current list is read from the
 * device inside that window, as the §7.15.1 flow describes: another client's BeginWrite gets BUSY while we hold the
 * window (§7.15.6.4.1), and a change by command after our read may fail our commit (§7.15.3) instead of being
 * overwritten. The write is sent timed so the controller does not put the pending list into its cache; the committed
 * list arrives with the next report.
 *
 * A window shorter than {@link MIN_ATOMIC_WRITE_TIMEOUT_MS} is rolled back without writing (§7.15.1 step 1.2). A
 * failed CommitWrite response already discards the pending write on the device (§7.15.6.4.2); any other failure after
 * BeginWrite, including one thrown by `buildNext`, is followed by a RollbackWrite.
 *
 * This is the server-side counterpart of the dashboard's `writeThermostatPresets` (packages/dashboard/src/util/
 * thermostat-preset-edit.ts), so any WebSocket client can reuse the handshake and the write-rule validation instead
 * of reimplementing them.
 */
async function writeThermostatPresets(
    handler: ThermostatPresetHandler,
    nodeId: NodeId,
    endpointId: EndpointNumber,
    buildNext: (current: ThermostatPreset[]) => ThermostatPresetEdit[],
): Promise<void> {
    const begin = await atomicRequest(
        handler,
        nodeId,
        endpointId,
        AtomicRequestType.BeginWrite,
        [ATTR_PRESETS],
        ATOMIC_WRITE_TIMEOUT_MS,
    );
    if (begin.statusCode !== 0) {
        throw ServerError.sdkStackError(`Could not start editing presets: ${describeAtomicFailure(begin)}`);
    }
    // §7.15.6.4.1: the device may add attributes that share a resource with Presets; commit and rollback name them all.
    const atomicAttributes =
        begin.attributeStatus.length > 0 ? begin.attributeStatus.map(s => s.attributeId) : [ATTR_PRESETS];

    let commit: AtomicResponse;
    try {
        if (begin.timeout !== null && begin.timeout < MIN_ATOMIC_WRITE_TIMEOUT_MS) {
            throw ServerError.sdkStackError(
                `The device allows only ${begin.timeout} ms to edit presets, too short to write them`,
            );
        }
        const current = await readFreshPresets(handler, nodeId, endpointId);
        if (current === undefined) {
            throw ServerError.sdkStackError("The device did not report its presets");
        }
        await writeFreshPresets(handler, nodeId, endpointId, buildNext(current));
        commit = await atomicRequest(handler, nodeId, endpointId, AtomicRequestType.CommitWrite, atomicAttributes);
    } catch (error) {
        await atomicRequest(handler, nodeId, endpointId, AtomicRequestType.RollbackWrite, atomicAttributes).catch(
            (rollbackError: unknown) => logger.warn("Could not roll back a failed preset write", rollbackError),
        );
        throw error;
    }
    if (commit.statusCode !== 0) {
        throw ServerError.sdkStackError(`Could not commit preset changes: ${describeAtomicFailure(commit)}`);
    }
}

export interface SetThermostatPresetArgs {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    /** Null to add a preset; otherwise the handle of the preset to edit, whose scenario cannot be changed. */
    presetHandle: string | null;
    /** Required when adding a preset; refused together with an edit's `presetHandle`. */
    presetScenario?: number;
    /** Omit to keep the preset's current name (new presets start with none); null clears it where supported. */
    name?: string | null;
    /** Centidegrees. Omit to keep the preset's current value (new presets start with none). */
    heatingSetpoint?: number | null;
    coolingSetpoint?: number | null;
}

/** Creates a new Thermostat preset (`presetHandle: null`) or edits an existing one. */
export async function setThermostatPreset(handler: ThermostatPresetHandler, args: SetThermostatPresetArgs) {
    const { nodeId, endpointId, presetHandle, presetScenario, name, heatingSetpoint, coolingSetpoint } = args;
    if (presetHandle !== null && presetScenario !== undefined) {
        throw ServerError.invalidArguments("preset_scenario cannot be changed on an existing preset");
    }

    const typesPath = `${endpointId}/${THERMOSTAT_CLUSTER_ID}/${ATTR_PRESET_TYPES}`;
    const typesResult = await handler.handleReadAttributes(nodeId, [typesPath], true);
    const presetTypes = decodePresetTypes(typesResult[typesPath]);

    await writeThermostatPresets(handler, nodeId, endpointId, current => {
        if (presetHandle === null) {
            if (presetScenario === undefined) {
                throw ServerError.invalidArguments("preset_scenario is required when adding a new preset");
            }
            const limit = presetTypeLimit(presetTypes, presetScenario);
            const existingForScenario = current.filter(p => p.scenario === presetScenario).length;
            if (limit !== null && existingForScenario >= limit) {
                throw ServerError.invalidArguments("This device does not allow more presets of this scenario");
            }
            const resolvedName = resolveName(presetTypes, presetScenario, name);
            const conflict = presetNameConflict(current, presetScenario, resolvedName, null);
            if (conflict !== null) {
                throw ServerError.invalidArguments(conflict);
            }
            const created: ThermostatPresetEdit = {
                presetHandle: null,
                presetScenario,
                name: resolvedName,
                coolingSetpoint: coolingSetpoint ?? null,
                heatingSetpoint: heatingSetpoint ?? null,
                builtIn: false,
            };
            return [...current.map(toPresetEdit), created];
        }

        const existing = current.find(p => p.handle === presetHandle);
        if (existing === undefined) {
            throw ServerError.invalidArguments("The preset no longer exists on the device");
        }
        const scenario = existing.scenario ?? 0;
        const resolvedName = resolveName(presetTypes, scenario, name, existing.name);
        const conflict = presetNameConflict(current, scenario, resolvedName, presetHandle);
        if (conflict !== null) {
            throw ServerError.invalidArguments(conflict);
        }
        const edited: ThermostatPresetEdit = {
            presetHandle,
            presetScenario: scenario,
            name: resolvedName,
            coolingSetpoint: coolingSetpoint !== undefined ? coolingSetpoint : existing.coolingSetpoint,
            heatingSetpoint: heatingSetpoint !== undefined ? heatingSetpoint : existing.heatingSetpoint,
            builtIn: existing.builtIn === true,
        };
        return current.map(p => (p.handle === presetHandle ? edited : toPresetEdit(p)));
    });
}

export interface ClearThermostatPresetArgs {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    presetHandle: string;
}

/** Removes a preset; refused if it is built-in, active, or referenced by a schedule (§4.3.11.50). */
export async function clearThermostatPreset(handler: ThermostatPresetHandler, args: ClearThermostatPresetArgs) {
    const { nodeId, endpointId, presetHandle } = args;

    const activeHandlePath = `${endpointId}/${THERMOSTAT_CLUSTER_ID}/${ATTR_ACTIVE_PRESET_HANDLE}`;
    const schedulesPath = `${endpointId}/${THERMOSTAT_CLUSTER_ID}/${ATTR_SCHEDULES}`;
    const context = await handler.handleReadAttributes(nodeId, [activeHandlePath, schedulesPath], true);
    const activePresetHandle = pickString(context, activeHandlePath) ?? null;
    const schedules = decodeSchedules(context[schedulesPath]);

    await writeThermostatPresets(handler, nodeId, endpointId, current => {
        const target = current.find(p => p.handle === presetHandle);
        if (target === undefined) {
            throw ServerError.invalidArguments("The preset no longer exists on the device");
        }
        if (target.builtIn === true) {
            throw ServerError.invalidArguments("Built-in presets cannot be removed");
        }
        if (activePresetHandle === presetHandle) {
            throw ServerError.invalidArguments("The active preset cannot be removed");
        }
        if (isPresetUsedBySchedule(schedules, presetHandle)) {
            throw ServerError.invalidArguments("A schedule uses this preset");
        }
        return current.filter(p => p.handle !== presetHandle).map(toPresetEdit);
    });
}

/** Sets the thermostat's active preset (SetActivePresetRequest, §4.3.12.3); `presetHandle: null` clears it. */
export async function setActivePreset(
    handler: ThermostatPresetHandler,
    nodeId: NodeId,
    endpointId: EndpointNumber,
    presetHandle: string | null,
): Promise<void> {
    await handler.handleInvoke({
        nodeId,
        endpointId,
        clusterId: THERMOSTAT_CLUSTER_ID,
        commandName: "SetActivePresetRequest",
        data: { presetHandle },
    });
}
