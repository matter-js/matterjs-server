/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient } from "@matter-server/ws-client";

export const showSettingsDialog = async (client: MatterClient) => {
    await import("./settings-dialog.js");
    const dialog = document.createElement("settings-dialog");
    dialog.client = client;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
