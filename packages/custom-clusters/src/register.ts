/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matter, Schema } from "@matter/main/model";
import * as Clusters from "./clusters/index.js";
// Extends standard cluster models, which freeze on first use, so this package must be imported before any matter.js
// cluster behavior (`@matter/main/behaviors/*`, transitively e.g. @matter-server/ws-controller)
import "./extensions/index.js";

for (const ClusterDefinition of Object.values(Clusters)) {
    const ClusterSchema = Schema.Required(ClusterDefinition);
    Matter.children.push(ClusterSchema);
}
