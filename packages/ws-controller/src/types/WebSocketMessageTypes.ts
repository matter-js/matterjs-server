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
    type CameraBoundField,
    type CameraPrivacyMode,
    type CameraStreamIncompatibleBound,
    type CameraStreamIncompatibleReason,
    type CameraStreamKind,
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

import type {
    CameraPrivacyMode,
    CameraStreamIncompatibleBound,
    CameraStreamIncompatibleReason,
    CameraStreamKind,
} from "@matter-server/ws-client";

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
    /** OHF extension: the camera, the offer or the request rules the stream out; `details.reason` says which. */
    CameraStreamIncompatible = 102,
    /** OHF extension: the camera refused the allocation for lack of capacity. */
    CameraResourceExhausted = 103,
    /** OHF extension: stream release refused because the device still references the stream. */
    CameraStreamInUse = 104,
    /** OHF extension: endpoint does not expose the clusters camera streaming needs. */
    CameraNotSupported = 105,
    /** OHF extension: the camera's privacy switch forbids the session or the snapshot. */
    CameraPrivacyMode = 106,
}

/** The facts every {@link CameraStreamIncompatibleDetail} carries, whatever its reason. */
interface CameraStreamIncompatibleFacts {
    /** The camera's codec names; empty when the camera did not refuse (e.g. the offer did), not "supports nothing". */
    device: string[];
    requested: string[];
    /** Matter status code the device answered with, when a device rejection produced this. */
    deviceStatus?: number;
}

/** The facts a failure about one of `camera_start_stream`'s two tracks can name. */
interface CameraStreamIncompatibleTrackFacts extends CameraStreamIncompatibleFacts {
    /** Which `camera_start_stream` track failed. Absent for commands without tracks, such as `camera_snapshot`. */
    track?: "video" | "audio";
}

/**
 * What a client learns about a request the camera or the offer cannot serve. Reason-specific fields
 * exist only on their reason's arm; `no_media` names no track because it concerns the whole request.
 */
export type CameraStreamIncompatibleDetail =
    | (CameraStreamIncompatibleTrackFacts & {
          reason: "feature";
          /** The AVSM feature the camera does not advertise, named as `camera_get_capabilities` reports the advertised ones. */
          feature: string;
      })
    | (CameraStreamIncompatibleTrackFacts & {
          reason: "bounds";
          /** The caller bound that could not be met, when the server decided it before asking the device. */
          bound?: CameraStreamIncompatibleBound;
      })
    | (CameraStreamIncompatibleTrackFacts & { reason: "codec" | "capability" | "offer" | "level" })
    | (CameraStreamIncompatibleFacts & { reason: "no_media" });

const INCOMPATIBLE_MESSAGES: Record<CameraStreamIncompatibleReason, string> = {
    codec: "No codec supported by both the camera and the caller",
    bounds: "Camera cannot serve the requested stream parameters",
    feature: "Camera does not advertise the feature this request needs",
    capability: "Camera states no capability this request can use",
    offer: "The offer does not carry this track's media to the peer",
    no_media: "The request leaves no media for the session to carry",
    level: "Offer states a codec level this server cannot bound a stream by",
};

export interface CameraAllocatedStreamDetail {
    streamId: number;
    referenceCount: number;
}

/**
 * What a client learns about a release the camera refused with `INVALID_IN_STATE`. `referenceCount`
 * is the count the server last read; absent when that cached count is zero.
 */
export interface CameraStreamInUseDetail {
    streamId: number;
    referenceCount?: number;
}

/**
 * A stream that holds capacity the refused request needed. Its `kind` can differ from the request's:
 * a refused snapshot allocation reports the video streams, which hold the encoders.
 */
export interface CameraOccupyingStreamDetail extends CameraAllocatedStreamDetail {
    kind: CameraStreamKind;
}

/**
 * What a client learns about a call the camera's privacy switches refused. `modes` names every switch
 * that forbids the call, since the device answers one status for all of them. `deviceStatus` is that status.
 */
export interface CameraPrivacyModeDetail {
    modes: CameraPrivacyMode[];
    deviceStatus: number;
}

export interface CameraResourceExhaustedDetail {
    allocated: CameraOccupyingStreamDetail[];
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
                ...("track" in detail && detail.track !== undefined ? { track: detail.track } : {}),
                ...(detail.reason === "feature" ? { feature: detail.feature } : {}),
                device: detail.device,
                requested: detail.requested,
                ...(detail.reason === "bounds" && detail.bound !== undefined ? { bound: detail.bound } : {}),
                ...(detail.deviceStatus === undefined ? {} : { device_status: detail.deviceStatus }),
            }),
        );
    }

    static cameraResourceExhausted(detail: CameraResourceExhaustedDetail): ServerError {
        return new ServerError(
            ServerErrorCode.CameraResourceExhausted,
            JSON.stringify({
                message: "Camera has no capacity for this stream",
                allocated: detail.allocated.map(entry => ({
                    kind: entry.kind,
                    stream_id: entry.streamId,
                    reference_count: entry.referenceCount,
                })),
                max_concurrent_encoders: detail.maxConcurrentEncoders,
                max_encoded_pixel_rate: detail.maxEncodedPixelRate,
            }),
        );
    }

    static cameraStreamInUse(detail: CameraStreamInUseDetail, cause?: Error): ServerError {
        return new ServerError(
            ServerErrorCode.CameraStreamInUse,
            JSON.stringify({
                message: "Stream is in use and cannot be released",
                stream_id: detail.streamId,
                ...(detail.referenceCount === undefined ? {} : { reference_count: detail.referenceCount }),
            }),
            cause,
        );
    }

    static cameraPrivacyMode(detail: CameraPrivacyModeDetail, cause?: Error): ServerError {
        return new ServerError(
            ServerErrorCode.CameraPrivacyMode,
            JSON.stringify({
                message: "Camera privacy mode is enabled",
                modes: detail.modes,
                device_status: detail.deviceStatus,
            }),
            cause,
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
