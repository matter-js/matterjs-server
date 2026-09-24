/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { nextConnectionLogTag, nextConnectionOwnerId } from "../src/server/connectionIdentity.js";

/** One past the log tag's 16-bit range, so the run covers a full wrap of it. */
const PAST_LOG_TAG_WRAP = 0x10000 + 1;

describe("connection identity", () => {
    it("wraps the log tag, so it names two different connections", () => {
        const tags = new Array<string>();
        for (let i = 0; i < PAST_LOG_TAG_WRAP; i++) tags.push(nextConnectionLogTag());
        expect(tags[PAST_LOG_TAG_WRAP - 1]).to.equal(tags[PAST_LOG_TAG_WRAP - 1 - 0x10000]);
        expect(new Set(tags).size).to.equal(0x10000);
    });

    it("keeps every owner id distinct across the same span", () => {
        const owners = new Set<string>();
        for (let i = 0; i < PAST_LOG_TAG_WRAP; i++) owners.add(nextConnectionOwnerId());
        expect(owners.size).to.equal(PAST_LOG_TAG_WRAP);
    });
});
