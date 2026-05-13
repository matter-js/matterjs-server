/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient } from "@matter-server/ws-client";

export interface ShowAttributeWriteDialogOptions {
    client: MatterClient;
    nodeId: number | bigint;
    endpointId: number;
    clusterId: number;
    attributeId: number;
    label: string;
    currentValue: unknown;
}

export const showAttributeWriteDialog = async (options: ShowAttributeWriteDialogOptions) => {
    await import("./attribute-write-dialog.js");
    const dialog = document.createElement("attribute-write-dialog");
    dialog.client = options.client;
    dialog.nodeId = options.nodeId;
    dialog.endpointId = options.endpointId;
    dialog.clusterId = options.clusterId;
    dialog.attributeId = options.attributeId;
    dialog.label = options.label;
    dialog.currentValue = options.currentValue;
    document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(dialog);
};
