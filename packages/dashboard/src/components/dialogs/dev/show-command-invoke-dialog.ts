/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient } from "@matter-server/ws-client";

export interface ShowCommandInvokeDialogOptions {
    client: MatterClient;
    nodeId: number | bigint;
    endpointId: number;
    clusterId: number;
    commandId: number;
    commandName: string;
}

export const showCommandInvokeDialog = async (options: ShowCommandInvokeDialogOptions) => {
    await import("./command-invoke-dialog.js");
    const dialog = document.createElement("command-invoke-dialog");
    dialog.client = options.client;
    dialog.nodeId = options.nodeId;
    dialog.endpointId = options.endpointId;
    dialog.clusterId = options.clusterId;
    dialog.commandId = options.commandId;
    dialog.commandName = options.commandName;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
