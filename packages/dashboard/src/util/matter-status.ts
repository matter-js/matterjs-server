/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Matter.js Status codes mapped to readable names.
 * @see MatterSpecification.v142.Core § 8.10.1
 */
export const MatterStatusNames: Record<number, string> = {
    0: "Success",
    1: "Failure",
    125: "InvalidSubscription",
    126: "UnsupportedAccess",
    127: "UnsupportedEndpoint",
    128: "InvalidAction",
    129: "UnsupportedCommand",
    133: "InvalidCommand",
    134: "UnsupportedAttribute",
    135: "ConstraintError",
    136: "UnsupportedWrite",
    137: "ResourceExhausted",
    139: "NotFound",
    140: "UnreportableAttribute",
    141: "InvalidDataType",
    143: "UnsupportedRead",
    146: "DataVersionMismatch",
    148: "Timeout",
    155: "UnsupportedNode",
    156: "Busy",
    157: "AccessRestricted",
    195: "UnsupportedCluster",
    197: "NoUpstreamSubscription",
    198: "NeedsTimedInteraction",
    199: "UnsupportedEvent",
    200: "PathsExhausted",
    201: "TimedRequestMismatch",
    202: "FailsafeRequired",
    203: "InvalidInState",
    204: "NoCommandResponse",
    205: "TermsAndConditionsChanged",
    206: "MaintenanceRequired",
    207: "DynamicConstraintError",
    208: "AlreadyExists",
    209: "InvalidTransportType",
};

/** Get readable name for a Matter status code */
export function getMatterStatusName(status: number): string {
    return MatterStatusNames[status] ?? `Unknown(${status})`;
}

/** Result type for Matter operations with status details */
export interface MatterOperationResult {
    success: boolean;
    status: number;
    statusName: string;
}

/** Outcome type for batch operations */
export type BatchOutcome = "all_success" | "all_failed" | "partial";

/** Result type for batch Matter operations (multiple entries) */
export interface MatterBatchResult {
    /** Overall outcome: all succeeded, all failed, or partial */
    outcome: BatchOutcome;
    /** Number of successful operations (status === 0) */
    successCount: number;
    /** Number of failed operations (status !== 0) */
    failureCount: number;
    /** Count of failures per status code, e.g. { 126: 2, 135: 1 } */
    errorCounts: Record<number, number>;
    /** Human-readable summary message for display */
    message: string;
}

/** Create a successful operation result */
export function successResult(): MatterOperationResult {
    return { success: true, status: 0, statusName: "Success" };
}

/** Create a failed operation result from a status code */
export function failureResult(status: number): MatterOperationResult {
    return { success: false, status, statusName: getMatterStatusName(status) };
}

/** Create an operation result from a status code (success if 0) */
export function resultFromStatus(status: number): MatterOperationResult {
    const statusName = getMatterStatusName(status);
    return { success: status === 0, status, statusName };
}

/**
 * Analyze multiple operation results and produce a batch result summary.
 * @param results Array of objects with a `status` property (0 = success)
 * @returns MatterBatchResult with outcome, counts, and human-readable message
 */
export function analyzeBatchResults(results: Array<{ status: number }>): MatterBatchResult {
    if (results.length === 0) {
        return {
            outcome: "all_success",
            successCount: 0,
            failureCount: 0,
            errorCounts: {},
            message: "No results",
        };
    }

    let successCount = 0;
    let failureCount = 0;
    const errorCounts: Record<number, number> = {};

    for (const result of results) {
        if (result.status === 0) {
            successCount++;
        } else {
            failureCount++;
            errorCounts[result.status] = (errorCounts[result.status] ?? 0) + 1;
        }
    }

    let outcome: BatchOutcome;
    if (failureCount === 0) {
        outcome = "all_success";
    } else if (successCount === 0) {
        outcome = "all_failed";
    } else {
        outcome = "partial";
    }

    const message = formatBatchMessage(outcome, successCount, failureCount, errorCounts);

    return { outcome, successCount, failureCount, errorCounts, message };
}

/** Format a human-readable message for batch results */
function formatBatchMessage(
    outcome: BatchOutcome,
    successCount: number,
    failureCount: number,
    errorCounts: Record<number, number>,
): string {
    const chunkWord = (count: number) => (count === 1 ? "chunk" : "chunks");

    if (outcome === "all_success") {
        return "Write successful";
    }

    // Format error breakdown: "2x UnsupportedAccess (126), 1x ConstraintError (135)"
    const errorParts = Object.entries(errorCounts)
        .map(([code, count]) => {
            const statusCode = parseInt(code, 10);
            return `${count}x ${getMatterStatusName(statusCode)} (${code})`;
        })
        .join(", ");

    if (outcome === "all_failed") {
        return `All ${failureCount} write list ${chunkWord(failureCount)} failed: ${errorParts}`;
    }

    // partial
    return `Partial failure: ${successCount} ${chunkWord(successCount)} succeeded, ${failureCount} failed (${errorParts}). Please verify the entries.`;
}
