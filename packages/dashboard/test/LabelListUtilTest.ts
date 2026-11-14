/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { decodeLabelList, describeLabelListEntry } from "../src/util/label-list.js";

// LabelStruct wire entries are field-tag keyed ("0" Label, "1" Value), matching how
// packages/ws-controller serializes attribute-read struct values (Converters.ts tagBased path).

describe("decodeLabelList", () => {
    it("decodes tag-keyed LabelStruct entries", () => {
        const decoded = decodeLabelList([{ "0": "room", "1": "Kitchen" }]);
        expect(decoded).to.deep.equal([{ kind: "label", item: { label: "room", value: "Kitchen" } }]);
    });

    it("accepts an empty array", () => {
        expect(decodeLabelList([])).to.deep.equal([]);
    });

    it("returns undefined when the attribute hasn't been read yet", () => {
        expect(decodeLabelList(undefined)).to.be.undefined;
    });

    it("returns undefined when the attribute was removed", () => {
        expect(decodeLabelList(null)).to.be.undefined;
    });

    it("accepts empty and blank strings, which the spec allows for both fields", () => {
        expect(decodeLabelList([{ "0": "", "1": "" }])).to.deep.equal([
            { kind: "label", item: { label: "", value: "" } },
        ]);
        expect(decodeLabelList([{ "0": "room", "1": "   " }])).to.deep.equal([
            { kind: "label", item: { label: "room", value: "   " } },
        ]);
    });

    it("keeps an entry with a missing Label or Value as raw, since both fields are mandatory", () => {
        expect(decodeLabelList([{ "1": "Kitchen" }, { "0": "room" }])).to.deep.equal([
            { kind: "raw", raw: { "1": "Kitchen" } },
            { kind: "raw", raw: { "0": "room" } },
        ]);
    });

    it("keeps an entry with a non-string Label or Value as raw", () => {
        expect(
            decodeLabelList([
                { "0": "count", "1": 3 },
                { "0": null, "1": "Kitchen" },
            ]),
        ).to.deep.equal([
            { kind: "raw", raw: { "0": "count", "1": 3 } },
            { kind: "raw", raw: { "0": null, "1": "Kitchen" } },
        ]);
    });

    it("keeps an entry with NUL characters as raw, so the corrupted text stays visible", () => {
        expect(
            decodeLabelList([
                { "0": "room", "1": "Kitchen\u0000" },
                { "0": "ro\u0000om", "1": "Kitchen" },
            ]),
        ).to.deep.equal([
            { kind: "raw", raw: { "0": "room", "1": "Kitchen\u0000" } },
            { kind: "raw", raw: { "0": "ro\u0000om", "1": "Kitchen" } },
        ]);
    });

    it("keeps decodable entries alongside undecodable ones", () => {
        expect(decodeLabelList([{ "0": "room", "1": "Kitchen" }, "nonsense"])).to.deep.equal([
            { kind: "label", item: { label: "room", value: "Kitchen" } },
            { kind: "raw", raw: "nonsense" },
        ]);
    });

    it("reports a whole attribute value that isn't a list as one raw entry", () => {
        expect(decodeLabelList(42)).to.deep.equal([{ kind: "raw", raw: 42 }]);
    });

    it("reads a LabelList that arrives index-keyed instead of as an array", () => {
        expect(decodeLabelList({ "0": { "0": "room", "1": "Kitchen" } })).to.deep.equal([
            { kind: "label", item: { label: "room", value: "Kitchen" } },
        ]);
    });
});

describe("describeLabelListEntry", () => {
    it("describes a decoded label as 'Label: Value' without marking it erroneous", () => {
        const { text, title, erroneous } = describeLabelListEntry({
            kind: "label",
            item: { label: "room", value: "Kitchen" },
        });
        expect(text).to.equal("room: Kitchen");
        expect(title).to.equal('Label "room" = "Kitchen"');
        expect(erroneous).to.be.false;
    });

    it("shows only the non-empty field when the other one is empty", () => {
        expect(describeLabelListEntry({ kind: "label", item: { label: "room", value: "" } }).text).to.equal("room");
        expect(describeLabelListEntry({ kind: "label", item: { label: "", value: "Kitchen" } }).text).to.equal(
            "Kitchen",
        );
    });

    it("trims the chip text but shows the reported strings in the tooltip", () => {
        const { text, title } = describeLabelListEntry({ kind: "label", item: { label: " room ", value: "   " } });
        expect(text).to.equal("room");
        expect(title).to.equal('Label " room " = "   "');
    });

    it("shows a placeholder for a label with both fields empty", () => {
        const { text, erroneous } = describeLabelListEntry({ kind: "label", item: { label: "", value: "" } });
        expect(text).to.equal("(empty label)");
        expect(erroneous).to.be.false;
    });

    it("marks a raw entry erroneous and shows its JSON", () => {
        const { text, title, erroneous } = describeLabelListEntry({ kind: "raw", raw: { foo: "bar" } });
        expect(text).to.equal('{"foo":"bar"}');
        expect(title).to.equal('Invalid LabelStruct: {"foo":"bar"}');
        expect(erroneous).to.be.true;
    });

    it("truncates the chip text of an oversized raw entry but keeps the full JSON in the tooltip", () => {
        const raw = { note: "x".repeat(120) };
        const json = JSON.stringify(raw);
        const { text, title } = describeLabelListEntry({ kind: "raw", raw });
        expect(text).to.equal(`${json.slice(0, 59)}…`);
        expect(title).to.equal(`Invalid LabelStruct: ${json}`);
    });

    it("keeps a raw entry of exactly the chip limit uncut", () => {
        const raw = "x".repeat(58);
        const { text } = describeLabelListEntry({ kind: "raw", raw });
        expect(text).to.equal(JSON.stringify(raw));
        expect(text).to.have.length(60);
    });

    it("renders an undefined raw entry without crashing", () => {
        const { text } = describeLabelListEntry({ kind: "raw", raw: undefined });
        expect(text).to.equal("undefined");
    });
});
