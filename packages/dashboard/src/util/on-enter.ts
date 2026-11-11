/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** The parts of a `KeyboardEvent` that {@link onEnter} reads. */
export type EnterKeyEvent = Pick<KeyboardEvent, "key" | "keyCode" | "isComposing" | "repeat" | "preventDefault">;

/**
 * Returns a `keydown` handler that runs `action` when the user presses Enter, so a text field
 * submits like the form's primary button. Enter in a Material text field does not submit, even
 * inside a `<form>`.
 *
 * Ignored: Enter that confirms an IME composition, and auto-repeat from a held key. The submit
 * method must still guard against a second call while the first one runs.
 *
 * Usage:
 * ```
 * <md-outlined-text-field @keydown=${onEnter(handleAsync(() => this._save()))}></md-outlined-text-field>
 * ```
 */
export function onEnter(action: () => void): (event: EnterKeyEvent) => void {
    return event => {
        // Safari reports the Enter that ends an IME composition with isComposing=false and keyCode 229.
        if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.repeat) {
            return;
        }
        event.preventDefault();
        action();
    };
}
