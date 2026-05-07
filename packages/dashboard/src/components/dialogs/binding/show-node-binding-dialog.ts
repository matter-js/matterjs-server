/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode } from "@matter-server/ws-client";

export const showNodeBindingDialog = async (node: MatterNode, endpoint: number) => {
    await import("./node-binding-dialog.js");
    const dialog = document.createElement("node-binding-dialog");
    dialog.node = node;
    dialog.endpoint = endpoint;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
