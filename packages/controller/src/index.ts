/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @matter-server/controller - Matter controller library
 */

// Export controller components
export * from "./controller/ControllerCommandHandler.js";
export * from "./controller/LegacyDataInjector.js";
export * from "./controller/MatterController.js";

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
export * from "./util/matterVersion.js";

// Re-Export classes from matter.js
export { Crypto, Environment, LogDestination, LogFormat, LogLevel, Logger } from "@matter/main";
