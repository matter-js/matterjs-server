/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @matter-server/ws-controller - Matter controller Websocket library
 */

export {
    establishesWebRtcSession,
    isProviderCommandName,
    PROVIDER_COMMAND_NAMES,
    toProviderCommandFields,
} from "./camera/webRtcProviderArguments.js";
export type {
    ProviderCommandName,
    SessionEstablishingCommandName,
    SignallingCommandName,
} from "./camera/webRtcProviderArguments.js";

export type { CameraSessionEnded, CameraStreamEvicted } from "./camera/cameraTypes.js";

// Export controller components
export { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
export * from "./controller/ControllerCommandHandler.js";
export * from "./controller/ControllerNode.js";
export * from "./controller/LegacyDataInjector.js";
export * from "./controller/MatterController.js";
export * from "./controller/OtaUploadRegistry.js";
export * from "./controller/ServerIdResolver.js";

// Export model
export * from "./model/ModelMapper.js";

// Export server handlers and types
export * from "./server/ConfigStorage.js";
export * from "./server/Converters.js";
export * from "./server/WebSocketControllerHandler.js";
export * from "./types/WebServer.js";

// Export message types
export * from "./types/CommandHandler.js";
export * from "./types/WebSocketMessageTypes.js";

// Export utilities
export { formatNodeId } from "./util/formatNodeId.js";
export * from "./util/matterVersion.js";

// Re-Export classes from matter.js
export { Crypto, Environment, LogDestination, LogFormat, LogLevel, Logger, StorageService } from "@matter/main";
