/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export const showCommissionNodeDialog = async () => {
    await import("./commission-node-dialog.js");
    const dialog = document.createElement("commission-node-dialog");
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
