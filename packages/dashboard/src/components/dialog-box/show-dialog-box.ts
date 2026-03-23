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
    asCodeBlock?: boolean;
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

export interface InputDialogBoxParams {
    title: string;
    text?: string;
    label?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
}

export const showAlertDialog = (dialogParams: BaseDialogBoxParams) => showDialogBox("alert", dialogParams);

export const showPromptDialog = (dialogParams: BaseDialogBoxParams) => showDialogBox("prompt", dialogParams);

export const showInputDialog = async (dialogParams: InputDialogBoxParams): Promise<string | null> => {
    await import("./input-dialog-box.js");
    return new Promise<string | null>(resolve => {
        const dialog = document.createElement("input-dialog-box");
        dialog.params = dialogParams;
        dialog.dialogResult = resolve;
        document.body.appendChild(dialog);
    });
};
