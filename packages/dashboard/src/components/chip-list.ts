/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing, type TemplateResult } from "lit";
import type { ChipText } from "../util/chip-text.js";

/**
 * Chip list for a decoded list attribute; erroneous chips get the error style.
 *
 * @param chips - an empty list renders nothing
 * @param listClass - extra classes for the `<ul>`, e.g. `endpoint-tags chip-compact`
 */
export function renderChipList(chips: ChipText[], listClass = ""): TemplateResult | typeof nothing {
    if (chips.length === 0) return nothing;
    return html`
        <ul class="chip-list ${listClass}" role="list">
            ${chips.map(
                ({ text, title, erroneous }) =>
                    html`<li class=${erroneous ? "chip chip-error" : "chip"} title=${title}>${text}</li>`,
            )}
        </ul>
    `;
}
