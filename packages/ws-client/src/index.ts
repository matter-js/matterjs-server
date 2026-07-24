/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @matter-server/ws-client - WebSocket client library for Matter server
 */

// Export client
export * from "./client.js";

// Export connection
export * from "./connection.js";

// Export exceptions
export * from "./exceptions.js";

// Export JSON utilities
export * from "./json-utils.js";

// Export models
export * from "./models/model.js";
export * from "./models/node.js";

// Export network topology derivation (shared by dashboard + server)
export * from "./topology/topology-types.js";
export * from "./topology/topology-utils.js";

// Export wire field-name transform (shared with the Python client generator)
export * from "./wire-naming.js";
