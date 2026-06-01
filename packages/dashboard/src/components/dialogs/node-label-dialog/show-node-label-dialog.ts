/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient, MatterNode } from "@matter-server/ws-client";

export const showNodeLabelDialog = async (client: MatterClient, node: MatterNode) => {
    await import("./node-label-dialog.js");
    const dialog = document.createElement("node-label-dialog");
    dialog.client = client;
    dialog.node = node;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
