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
    type LogLevelResponse,
    type LogLevelString,
    type MatterFabricData,
    type MatterNodeEvent,
    type NodePingResult,
    type NotificationType,
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
}
