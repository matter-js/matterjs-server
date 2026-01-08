/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test helpers for Matter.js server integration tests.
 */

export * from "./MatterWebSocketClient.js";
export * from "./ProcessHelpers.js";

// Re-export types from controller for convenience
export type { MatterNode, ServerInfoMessage } from "@matter-server/controller";
