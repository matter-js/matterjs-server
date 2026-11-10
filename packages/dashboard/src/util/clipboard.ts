/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** The part of the async Clipboard API that {@link copyText} uses. */
export type TextClipboard = Pick<Clipboard, "writeText">;

/**
 * Copies `text` to the clipboard.
 *
 * Browsers expose `navigator.clipboard` only in secure contexts, so a dashboard opened over plain
 * HTTP from another host has none. Then `fallback` runs synchronously within this call, so it
 * still counts as part of the user's click. When `writeText` rejects, `fallback` runs after that
 * rejection, where some browsers no longer allow copying.
 *
 * @param fallback - Copies `text` another way and returns whether that worked.
 * @param clipboard - The async clipboard, or `null` when the browser offers none.
 * @returns A promise that rejects with an Error, with the `writeText` error as `cause` if there was
 *   one, when neither the clipboard nor the fallback copied the text.
 */
export async function copyText(
    text: string,
    fallback: (text: string) => boolean,
    clipboard: TextClipboard | null = globalThis.navigator?.clipboard ?? null,
): Promise<void> {
    let clipboardError: unknown;
    if (clipboard !== null) {
        try {
            await clipboard.writeText(text);
            return;
        } catch (error) {
            clipboardError = error;
        }
    }
    if (!fallback(text)) {
        throw new Error("Copying to the clipboard failed", { cause: clipboardError });
    }
}

/**
 * Copies `text` with the legacy `execCommand("copy")` through a temporary text area added to
 * `root`, then gives the focus back to the element in `root` that had it.
 *
 * `root` must be inside any open modal dialog: the rest of the page is inert then, and a selection
 * there may not copy.
 */
export function copyTextWithSelection(text: string, root: ShadowRoot): boolean {
    const previousFocus = root.activeElement;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    // A font size below 16px makes iOS Safari zoom the page when the text area gets the focus.
    Object.assign(textArea.style, { position: "fixed", top: "0", left: "0", opacity: "0", fontSize: "16px" });
    root.appendChild(textArea);
    try {
        textArea.focus({ preventScroll: true });
        textArea.select();
        textArea.setSelectionRange(0, text.length);
        return document.execCommand("copy");
    } finally {
        textArea.remove();
        if (previousFocus instanceof HTMLElement) {
            previousFocus.focus({ preventScroll: true });
        }
    }
}
