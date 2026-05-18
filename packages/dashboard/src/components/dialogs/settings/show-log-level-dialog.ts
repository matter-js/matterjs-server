/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export const showLogLevelDialog = async () => {
    await import("./log-level-dialog.js");
    const dialog = document.createElement("log-level-dialog");
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
