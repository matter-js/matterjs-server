/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient } from "../../../client/client.js";
import { MatterNode } from "../../../client/models/node.js";

export const showNodeBindingDialog = async (client: MatterClient, node: MatterNode, endpoint: number) => {
    await import("./node-binding-dialog.js");
    const dialog = document.createElement("node-binding-dialog");
    dialog.client = client;
    dialog.node = node;
    dialog.endpoint = endpoint;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
