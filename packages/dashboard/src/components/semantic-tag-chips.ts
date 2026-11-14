/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { nothing, type TemplateResult } from "lit";
import { describeSemanticTagListEntry, type SemanticTagListEntry } from "../util/semantic-tags.js";
import { renderChipList } from "./chip-list.js";

/**
 * Chip list for a list of semantic tags, such as the Descriptor TagList.
 *
 * @param entries - decoded TagList entries; an empty list renders nothing
 * @param listClass - extra classes for the `<ul>`, e.g. `endpoint-tags chip-compact`
 */
export function renderSemanticTagChips(
    entries: SemanticTagListEntry[],
    listClass = "",
): TemplateResult | typeof nothing {
    return renderChipList(entries.map(describeSemanticTagListEntry), listClass);
}
