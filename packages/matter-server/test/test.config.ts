/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Custom clusters must register before ws-controller builds its ClusterMap, as in MatterServer.ts.
import "@matter-server/custom-clusters";
