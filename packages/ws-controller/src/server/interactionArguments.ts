/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId, UINT64_MAX } from "@matter/main";
import { isRecord } from "../camera/wireArgumentChecks.js";
import { InteractionReadRequest, InteractionSubscribeRequest } from "../types/CommandHandler.js";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { isWellFormedPath, splitAttributePath, splitEventPath } from "./Converters.js";

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

function pathOf(value: unknown, field: string, segments: 2 | 3): string {
    if (typeof value !== "string" || !isWellFormedPath(value, segments)) {
        throw ServerError.invalidArguments(
            `Malformed ${field} path ${JSON.stringify(value)}: expected ${segments} parts separated by "/", each a number or "*"`,
        );
    }
    return value;
}

function attributePathOf(value: unknown): string {
    const path = pathOf(value, "attribute_paths", 3);
    splitAttributePath(path);
    return path;
}

function eventPathOf(value: unknown): string {
    const path = pathOf(value, "event_paths", 3);
    splitEventPath(path);
    return path;
}

function dataVersionFilterOf(value: unknown): { path: string; dataVersion: number } {
    const entry = entryOf(value, "data_version_filters");
    const path = pathOf(entry.path, "data_version_filters", 2);
    const { endpointId, clusterId } = splitAttributePath(path);
    if (endpointId === undefined || clusterId === undefined) {
        throw ServerError.invalidArguments(`Data version filter path "${path}" must name an endpoint and a cluster`);
    }
    if (!isUnsignedInteger(entry.data_version, UINT32_MAX)) {
        throw ServerError.invalidArguments(`data_version must be an integer from 0 to 2^32-1`);
    }
    return { path, dataVersion: entry.data_version };
}

function eventMinOf(value: unknown): number | bigint | undefined {
    if (isAbsent(value)) {
        return undefined;
    }
    if (typeof value === "bigint" && value >= 0n && value <= UINT64_MAX) {
        return value;
    }
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
        return value;
    }
    throw ServerError.invalidArguments("event_min must be an event number, an integer from 0 to 2^64-1");
}

/** Refuses intervals outside the Matter range of a uint16 or with the ceiling below the floor. */
export function subscribeIntervalsOf(
    minInterval: unknown,
    maxInterval: unknown,
): { minInterval: number; maxInterval: number } {
    if (!isUnsignedInteger(minInterval, UINT16_MAX) || !isUnsignedInteger(maxInterval, UINT16_MAX)) {
        throw ServerError.invalidArguments("min_interval and max_interval must be integers from 0 to 65535 seconds");
    }
    if (maxInterval < minInterval) {
        throw ServerError.invalidArguments("max_interval must not be less than min_interval");
    }
    return { minInterval, maxInterval };
}

function readFieldsOf(args: Record<string, unknown>, urgentFlags: boolean) {
    const attributePaths = optionalList(args.attribute_paths, "attribute_paths")?.map(attributePathOf);
    const eventPaths = optionalList(args.event_paths, "event_paths")?.map(value => {
        const entry = entryOf(value, "event_paths");
        const path = eventPathOf(entry.path);
        return urgentFlags ? { path, isUrgent: optionalBoolean(entry.is_urgent, "is_urgent") } : { path };
    });
    const eventMin = eventMinOf(args.event_min);
    const fabricFiltered = optionalBoolean(args.fabric_filtered, "fabric_filtered");
    const dataVersionFilters = optionalList(args.data_version_filters, "data_version_filters")?.map(
        dataVersionFilterOf,
    );

    if (!attributePaths?.length && !eventPaths?.length) {
        throw ServerError.invalidArguments("At least one attribute or event path is required");
    }
    // Matter Core spec 8.4.2.1: EventFilters has the conformance EventRequests, DataVersionFilters AttributeRequests.
    if (eventMin !== undefined && !eventPaths?.length) {
        throw ServerError.invalidArguments("event_min requires event_paths");
    }
    if (dataVersionFilters?.length && !attributePaths?.length) {
        throw ServerError.invalidArguments("data_version_filters requires attribute_paths");
    }
    return { attributePaths, eventPaths, eventMin, fabricFiltered, dataVersionFilters };
}

/** The `read` request of the WebSocket arguments, or an InvalidArguments error for the first malformed one. */
export function readRequestOf(nodeId: NodeId, args: Record<string, unknown>): InteractionReadRequest {
    return { nodeId, ...readFieldsOf(args, false) };
}

/** The `subscribe` request of the WebSocket arguments, or an InvalidArguments error for the first malformed one. */
export function subscribeRequestOf(nodeId: NodeId, args: Record<string, unknown>): InteractionSubscribeRequest {
    const fields = readFieldsOf(args, true);
    return {
        nodeId,
        ...fields,
        ...subscribeIntervalsOf(args.min_interval, args.max_interval),
        keepSubscriptions: optionalBoolean(args.keep_subscriptions, "keep_subscriptions"),
    };
}

/** The SubscriptionId of an `unsubscribe` request, a uint32. */
export function subscriptionIdOf(value: unknown): number {
    if (!isUnsignedInteger(value, UINT32_MAX)) {
        throw ServerError.invalidArguments("subscription_id must be an integer from 0 to 2^32-1");
    }
    return value;
}
