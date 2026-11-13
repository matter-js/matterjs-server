/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing, type TemplateResult } from "lit";
import { describeLabelListEntry, type LabelListEntry } from "../util/label-list.js";

/**
 * Chip list for a FixedLabel/UserLabel LabelList. Every renderer must keep the decoder's
 * `erroneous` flag visible, so malformed entries cannot pass for valid labels in one view and
 * not another.
 *
 * @param entries - decoded LabelList entries; an empty list renders nothing
 * @param listClass - extra classes for the `<ul>`, e.g. `endpoint-labels chip-compact`
 */
export function renderLabelListChips(entries: LabelListEntry[], listClass = ""): TemplateResult | typeof nothing {
    if (entries.length === 0) return nothing;
    return html`
        <ul class="chip-list ${listClass}" role="list">
            ${entries.map(entry => {
                const { text, title, erroneous } = describeLabelListEntry(entry);
                return html`<li class=${erroneous ? "chip chip-error" : "chip"} title=${title}>${text}</li>`;
            })}
        </ul>
    `;
}
