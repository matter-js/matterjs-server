/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export const showSettingsDialog = async (section?: string) => {
    await import("./settings-dialog.js");
    const dialog = document.createElement("settings-dialog");
    if (section) dialog.scrollToSection = section;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
