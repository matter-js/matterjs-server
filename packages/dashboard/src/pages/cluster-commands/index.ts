/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cluster-specific command panels.
 * Import this file to register all cluster command components.
 */

// Registry exports
export { getClusterCommandsTag, hasClusterCommands, registerClusterCommands } from "./registry.js";

// Base class for creating new cluster commands
export { BaseClusterCommands } from "./base-cluster-commands.js";

// Cluster command components (auto-register on import)
import "./clusters/basic-information-commands.js";
import "./clusters/level-control-commands.js";
import "./clusters/on-off-commands.js";
