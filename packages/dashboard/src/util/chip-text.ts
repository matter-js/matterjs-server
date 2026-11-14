/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toBigIntAwareJson } from "@matter-server/ws-client";

/** One chip of a decoded list attribute; an `erroneous` chip renders with the error style. */
export interface ChipText {
    text: string;
    title: string;
    erroneous: boolean;
}

const RAW_ENTRY_TEXT_MAX = 60;

/** Error chip for a list entry that did not decode as a valid `structName`; the tooltip keeps the full JSON. */
export function describeRawEntry(raw: unknown, structName: string): ChipText {
    const json = raw === undefined ? "undefined" : toBigIntAwareJson(raw);
    const text = json.length > RAW_ENTRY_TEXT_MAX ? `${json.slice(0, RAW_ENTRY_TEXT_MAX - 1)}…` : json;
    return { text, title: `Invalid ${structName}: ${json}`, erroneous: true };
}
