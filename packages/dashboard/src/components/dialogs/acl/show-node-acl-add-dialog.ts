/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode } from "@matter-server/ws-client";

export const showNodeAclAddDialog = async (node: MatterNode) => {
    await import("./node-acl-add-dialog.js");
    const dialog = document.createElement("node-acl-add-dialog");
    dialog.node = node;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
