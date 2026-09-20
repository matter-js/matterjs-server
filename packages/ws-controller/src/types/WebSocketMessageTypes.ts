/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebSocket protocol types.
 *
 * Canonical type definitions live in @matter-server/ws-client.
 * This module re-exports them for backward compatibility and adds server-only types.
 */

// Re-export all shared protocol types from ws-client
export {
    type AccessControlEntry,
    type AccessControlTarget,
    type AllCredentialsSummary,
    type APICommands,
    type APIEvents,
    type ArgsOf,
    type AttributesData,
    type AttributeWriteResult,
    type BindingTarget,
    type CommandMessage,
    type CommissionableNodeData,
    type CommissioningParameters,
    type ErrorResultMessage,
    type EventMessage,
    type EventTypes,
    type IcdStateData,
    type LogLevelResponse,
    type LogLevelString,
    type SettableLogLevelString,
    type MatterFabricData,
    type MatterNodeEvent,
    type NodePingResult,
    type NotificationType,
    type OtaUploadTicket,
    type ResponseOf,
    type ResultMessageBase,
    type ServerInfoMessage,
    type SuccessResultMessage,
    type MatterSoftwareVersion,
    type WebSocketConfig,
    TEST_NODE_START,
    UpdateSource,
} from "@matter-server/ws-client";

// Re-export MatterNodeData as MatterNode for backward compatibility within ws-controller
export type { MatterNodeData as MatterNode } from "@matter-server/ws-client";

/**
 * Error codes matching Python Matter Server for API compatibility.
 * @see https://github.com/home-assistant-libs/python-matter-server/blob/main/matter_server/common/errors.py
 */
export enum ServerErrorCode {
    /** Generic/unknown error */
    UnknownError = 0,
    /** Node commissioning failed */
    NodeCommissionFailed = 1,
    /** Node interview failed */
    NodeInterviewFailed = 2,
    /** Node is not ready (offline or not yet interviewed) */
    NodeNotReady = 3,
    /** Node not resolving (CASE session establishment failed) */
    NodeNotResolving = 4,
    /** Node does not exist */
    NodeNotExists = 5,
    /** SDK version mismatch */
    VersionMismatch = 6,
    /** SDK/Stack error */
    SDKStackError = 7,
    /** Invalid command arguments */
    InvalidArguments = 8,
    /** Invalid/unknown command */
    InvalidCommand = 9,
    /** OTA update check failed */
    UpdateCheckError = 10,
    /** OTA update failed */
    UpdateError = 11,
    /** OHF extension (not python-matter-server): value must equal ICD_MULTI_ADMIN_ERROR_CODE in ws-client model.ts. */
    IcdMultiAdmin = 100,
    /** OHF extension (not python-matter-server): OTA firmware image upload failed (corrupt file / store failure). */
    OtaUploadError = 101,
    /** OHF extension: no codec or range both sides can serve, or the camera states no such capability. */
    CameraStreamIncompatible = 102,
    /** OHF extension: the camera has no encoder capacity left for the requested stream. */
    CameraResourceExhausted = 103,
    /** OHF extension: stream release refused because the device still references the stream. */
    CameraStreamInUse = 104,
    /** OHF extension: stream release refused because the server did not allocate the stream. */
    CameraStreamNotOwned = 105,
    /** OHF extension: endpoint does not expose the clusters camera streaming needs. */
    CameraNotSupported = 106,
}

export interface CameraStreamIncompatibleDetail {
    /**
     * Which dimension could not be met, so a client knows what to change: `codec` a codec list,
     * `bounds` a resolution / frame-rate / bit-rate bound, `capability` nothing — the device states
     * no capability of the kind the command needs and no different request can succeed.
     */
    reason: "codec" | "bounds" | "capability";
    device: string[];
    requested: string[];
    /**
     * The single caller bound that could not be met, when the server decided that before asking the
     * device. `limit` is the ceiling in force after every narrowing, whoever stated it.
     */
    bound?: { field: string; requested: string; limit: string };
    /** Matter status code the device answered with, when a device rejection produced this. */
    deviceStatus?: number;
}

const INCOMPATIBLE_MESSAGES: Record<CameraStreamIncompatibleDetail["reason"], string> = {
    codec: "No codec supported by both the camera and the caller",
    bounds: "Camera cannot serve the requested stream parameters",
    capability: "Camera states no capability for this request",
};

export interface CameraAllocatedStreamDetail {
    streamId: number;
    referenceCount: number;
}

export interface CameraResourceExhaustedDetail {
    allocated: CameraAllocatedStreamDetail[];
    maxConcurrentEncoders?: number;
    maxEncodedPixelRate?: number;
}

/**
 * Custom error class for server errors with typed error codes.
 * Use this to throw errors that will be properly mapped to Python-compatible error codes.
 */
export class ServerError extends Error {
    constructor(
        public readonly code: ServerErrorCode,
        message: string,
        cause?: Error,
    ) {
        super(message, { cause });
        this.name = "ServerError";
    }

    static unknownError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.UnknownError, message, cause);
    }

    static nodeCommissionFailed(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeCommissionFailed, message, cause);
    }

    static nodeInterviewFailed(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeInterviewFailed, message, cause);
    }

    static nodeNotReady(nodeId: number | bigint, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeNotReady, `Node ${nodeId} is not ready`, cause);
    }

    static nodeNotResolving(nodeId: number | bigint, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeNotResolving, `Node ${nodeId} is not resolving`, cause);
    }

    static nodeNotExists(nodeId: number | bigint): ServerError {
        return new ServerError(ServerErrorCode.NodeNotExists, `Node ${nodeId} does not exist`);
    }

    static versionMismatch(message: string): ServerError {
        return new ServerError(ServerErrorCode.VersionMismatch, message);
    }

    static sdkStackError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.SDKStackError, message, cause);
    }

    static invalidArguments(message: string): ServerError {
        return new ServerError(ServerErrorCode.InvalidArguments, message);
    }

    static invalidCommand(command: string): ServerError {
        return new ServerError(ServerErrorCode.InvalidCommand, `Unknown command: ${command}`);
    }

    static updateCheckError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.UpdateCheckError, message, cause);
    }

    static updateError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.UpdateError, message, cause);
    }

    static otaUploadError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.OtaUploadError, message, cause);
    }

    static icdMultiAdmin(adminVendorIds: number[]): ServerError {
        return new ServerError(
            ServerErrorCode.IcdMultiAdmin,
            JSON.stringify({
                message: "Peer has administrators from other vendors that may not support LIT",
                admin_vendor_ids: adminVendorIds,
            }),
        );
    }

    static cameraStreamIncompatible(detail: CameraStreamIncompatibleDetail): ServerError {
        return new ServerError(
            ServerErrorCode.CameraStreamIncompatible,
            JSON.stringify({
                message: INCOMPATIBLE_MESSAGES[detail.reason],
                reason: detail.reason,
                device: detail.device,
                requested: detail.requested,
                ...(detail.bound === undefined ? {} : { bound: detail.bound }),
                ...(detail.deviceStatus === undefined ? {} : { device_status: detail.deviceStatus }),
            }),
        );
    }

    static cameraResourceExhausted(detail: CameraResourceExhaustedDetail): ServerError {
        return new ServerError(
            ServerErrorCode.CameraResourceExhausted,
            JSON.stringify({
                message: "Camera has no encoder capacity for this stream",
                allocated: detail.allocated.map(entry => ({
                    stream_id: entry.streamId,
                    reference_count: entry.referenceCount,
                })),
                max_concurrent_encoders: detail.maxConcurrentEncoders,
                max_encoded_pixel_rate: detail.maxEncodedPixelRate,
            }),
        );
    }

    static cameraStreamInUse(detail: CameraAllocatedStreamDetail): ServerError {
        return new ServerError(
            ServerErrorCode.CameraStreamInUse,
            JSON.stringify({
                message: "Stream is in use and cannot be released",
                stream_id: detail.streamId,
                reference_count: detail.referenceCount,
            }),
        );
    }

    static cameraStreamNotOwned(detail: { streamId: number }): ServerError {
        return new ServerError(
            ServerErrorCode.CameraStreamNotOwned,
            JSON.stringify({
                message: "Stream was not allocated by this server and cannot be released",
                stream_id: detail.streamId,
            }),
        );
    }

    static cameraNotSupported(detail: { missingClusters: number[] }): ServerError {
        return new ServerError(
            ServerErrorCode.CameraNotSupported,
            JSON.stringify({
                message: "Endpoint does not support camera streaming",
                missing_clusters: detail.missingClusters,
            }),
        );
    }
}
