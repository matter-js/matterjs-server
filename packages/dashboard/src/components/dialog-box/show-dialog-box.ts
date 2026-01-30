/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TemplateResult } from "lit";

interface BaseDialogBoxParams {
    confirmText?: string;
    text: string | TemplateResult;
    title: string;
}

export interface PromptDialogBoxParams extends BaseDialogBoxParams {
    cancelText?: string;
}

const showDialogBox = async (type: "alert" | "prompt", dialogParams: PromptDialogBoxParams) => {
    await import("./dialog-box.js");
    return new Promise<boolean>(resolve => {
        const dialog = document.createElement("dialog-box");
        dialog.params = dialogParams;
        dialog.dialogResult = resolve;
        dialog.type = type;
        document.body.appendChild(dialog);
    });
};

export const showAlertDialog = (dialogParams: BaseDialogBoxParams) => showDialogBox("alert", dialogParams);

export const showPromptDialog = (dialogParams: BaseDialogBoxParams) => showDialogBox("prompt", dialogParams);
