/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId, UINT64_MAX } from "@matter/main";
import { isRecord } from "../camera/wireArgumentChecks.js";
import { InteractionReadRequest, InteractionSubscribeRequest } from "../types/CommandHandler.js";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { isWellFormedPath, splitAttributePath, splitEventPath, toBigIntAwareJson } from "./Converters.js";

const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffff_ffff;

/** A client may send `null` for an argument it leaves out. */
function isAbsent(value: unknown): value is undefined | null {
    return value === undefined || value === null;
}

function isUnsignedInteger(value: unknown, max: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
    if (isAbsent(value)) {
        return undefined;
    }
    if (typeof value !== "boolean") {
        throw ServerError.invalidArguments(`${field} must be true or false`);
    }
    return value;
}

function optionalList(value: unknown, field: string): unknown[] | undefined {
    if (isAbsent(value)) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw ServerError.invalidArguments(`${field} must be a list`);
    }
    return value;
}

function entryOf(value: unknown, field: string): Record<string, unknown> {
    if (!isRecord(value)) {
        throw ServerError.invalidArguments(`Each entry of ${field} must be an object with a path`);
    }
    return value;
}

function malformedPath(value: unknown, field: string, segments: 2 | 3) {
    return ServerError.invalidArguments(
        `Malformed ${field} path ${toBigIntAwareJson(value)}: expected ${segments} parts separated by "/", each a number or "*"`,
    );
}

function wirePathOf(value: unknown, field: string, segments: 2 | 3): string {
    if (typeof value !== "string") {
        throw malformedPath(value, field, segments);
    }
    return value;
}

function checkPath(path: string, field: string, segments: 2 | 3) {
    if (!isWellFormedPath(path, segments)) {
        throw malformedPath(path, field, segments);
    }
}

const DATA_VERSION_RANGE = "data_version must be an integer from 0 to 2^32-1";
const EVENT_MIN_RANGE = "event_min must be an event number, an integer from 0 to 2^64-1";
const INTERVAL_RANGE = "min_interval and max_interval must be integers from 0 to 65535 seconds";

function wireDataVersionFilterOf(value: unknown): { path: string; dataVersion: number } {
    const entry = entryOf(value, "data_version_filters");
    const path = wirePathOf(entry.path, "data_version_filters", 2);
    if (typeof entry.data_version !== "number") {
        throw ServerError.invalidArguments(DATA_VERSION_RANGE);
    }
    return { path, dataVersion: entry.data_version };
}

function wireEventMinOf(value: unknown): number | bigint | undefined {
    if (isAbsent(value)) {
        return undefined;
    }
    if (typeof value !== "number" && typeof value !== "bigint") {
        throw ServerError.invalidArguments(EVENT_MIN_RANGE);
    }
    return value;
}

function wireIntervalOf(value: unknown): number {
    if (typeof value !== "number") {
        throw ServerError.invalidArguments(INTERVAL_RANGE);
    }
    return value;
}

function wireReadFieldsOf(args: Record<string, unknown>, urgentFlags: boolean) {
    const attributePaths = optionalList(args.attribute_paths, "attribute_paths")?.map(value =>
        wirePathOf(value, "attribute_paths", 3),
    );
    const eventPaths = optionalList(args.event_paths, "event_paths")?.map(value => {
        const entry = entryOf(value, "event_paths");
        const path = wirePathOf(entry.path, "event_paths", 3);
        return urgentFlags ? { path, isUrgent: optionalBoolean(entry.is_urgent, "is_urgent") } : { path };
    });
    const eventMin = wireEventMinOf(args.event_min);
    const fabricFiltered = optionalBoolean(args.fabric_filtered, "fabric_filtered");
    const dataVersionFilters = optionalList(args.data_version_filters, "data_version_filters")?.map(
        wireDataVersionFilterOf,
    );
    return { attributePaths, eventPaths, eventMin, fabricFiltered, dataVersionFilters };
}

/**
 * Refuses a request whose paths are malformed or name invalid ids, that has no path, whose `eventMin`, data versions
 * or intervals are out of range, or that has filters without the paths they apply to.
 * @throws {ServerError} with code InvalidArguments for the first refused value.
 */
export function checkInteractionRequest(request: InteractionReadRequest | InteractionSubscribeRequest) {
    const { attributePaths, eventPaths, eventMin, dataVersionFilters } = request;
    for (const path of attributePaths ?? []) {
        checkPath(path, "attribute_paths", 3);
        splitAttributePath(path);
    }
    for (const { path } of eventPaths ?? []) {
        checkPath(path, "event_paths", 3);
        splitEventPath(path);
    }
    for (const { path, dataVersion } of dataVersionFilters ?? []) {
        checkPath(path, "data_version_filters", 2);
        const { endpointId, clusterId } = splitAttributePath(path);
        if (endpointId === undefined || clusterId === undefined) {
            throw ServerError.invalidArguments(
                `Data version filter path "${path}" must name an endpoint and a cluster`,
            );
        }
        if (!isUnsignedInteger(dataVersion, UINT32_MAX)) {
            throw ServerError.invalidArguments(DATA_VERSION_RANGE);
        }
    }
    if (
        eventMin !== undefined &&
        !(typeof eventMin === "bigint"
            ? eventMin >= 0n && eventMin <= UINT64_MAX
            : Number.isSafeInteger(eventMin) && eventMin >= 0)
    ) {
        throw ServerError.invalidArguments(EVENT_MIN_RANGE);
    }

    if (!attributePaths?.length && !eventPaths?.length) {
        throw ServerError.invalidArguments("At least one attribute or event path is required");
    }
    // Matter Core spec 8.4.2.1 and 8.5.2.1: EventFilters has the conformance EventRequests, DataVersionFilters
    // AttributeRequests.
    if (eventMin !== undefined && !eventPaths?.length) {
        throw ServerError.invalidArguments("event_min requires event_paths");
    }
    if (dataVersionFilters?.length && !attributePaths?.length) {
        throw ServerError.invalidArguments("data_version_filters requires attribute_paths");
    }

    if ("minInterval" in request) {
        const { minInterval, maxInterval } = request;
        if (!isUnsignedInteger(minInterval, UINT16_MAX) || !isUnsignedInteger(maxInterval, UINT16_MAX)) {
            throw ServerError.invalidArguments(INTERVAL_RANGE);
        }
        if (maxInterval < minInterval) {
            throw ServerError.invalidArguments("max_interval must not be less than min_interval");
        }
    }
}

/** The `read` request of the WebSocket arguments, or an InvalidArguments error for the first malformed one. */
export function readRequestOf(nodeId: NodeId, args: Record<string, unknown>): InteractionReadRequest {
    const request = { nodeId, ...wireReadFieldsOf(args, false) };
    checkInteractionRequest(request);
    return request;
}

/** The `subscribe` request of the WebSocket arguments, or an InvalidArguments error for the first malformed one. */
export function subscribeRequestOf(nodeId: NodeId, args: Record<string, unknown>): InteractionSubscribeRequest {
    const request = {
        nodeId,
        ...wireReadFieldsOf(args, true),
        minInterval: wireIntervalOf(args.min_interval),
        maxInterval: wireIntervalOf(args.max_interval),
        keepSubscriptions: optionalBoolean(args.keep_subscriptions, "keep_subscriptions"),
    };
    checkInteractionRequest(request);
    return request;
}

/** The SubscriptionId of an `unsubscribe` request, a uint32. */
export function subscriptionIdOf(value: unknown): number {
    if (!isUnsignedInteger(value, UINT32_MAX)) {
        throw ServerError.invalidArguments("subscription_id must be an integer from 0 to 2^32-1");
    }
    return value;
}
