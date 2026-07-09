/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient } from "@matter-server/ws-client";

export const showFabricLabelDialog = async (client: MatterClient, currentLabel: string, onSaved?: () => void) => {
    await import("./fabric-label-dialog.js");
    const dialog = document.createElement("fabric-label-dialog");
    dialog.client = client;
    dialog.currentLabel = currentLabel;
    dialog.onSaved = onSaved;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
