/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing, type TemplateResult } from "lit";
import { describeSemanticTagListEntry, type SemanticTagListEntry } from "../util/semantic-tags.js";

/**
 * Chip list for a Descriptor TagList. Every renderer must keep the decoder's `erroneous` flag
 * visible, so malformed entries cannot pass for valid tags in one view and not another.
 *
 * @param entries - decoded TagList entries; an empty list renders nothing
 * @param listClass - extra classes for the `<ul>`, e.g. `endpoint-tags chip-compact`
 */
export function renderSemanticTagChips(
    entries: SemanticTagListEntry[],
    listClass = "",
): TemplateResult | typeof nothing {
    if (entries.length === 0) return nothing;
    return html`
        <ul class="chip-list ${listClass}" role="list">
            ${entries.map(entry => {
                const { text, title, erroneous } = describeSemanticTagListEntry(entry);
                return html`<li class=${erroneous ? "chip chip-error" : "chip"} title=${title}>${text}</li>`;
            })}
        </ul>
    `;
}
