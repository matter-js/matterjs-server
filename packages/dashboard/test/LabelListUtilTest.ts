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

    it("defaults a missing Label or Value field to an empty string", () => {
        expect(decodeLabelList([{ "1": "Kitchen" }])).to.deep.equal([
            { kind: "label", item: { label: "", value: "Kitchen" } },
        ]);
        expect(decodeLabelList([{ "0": "room" }])).to.deep.equal([
            { kind: "label", item: { label: "room", value: "" } },
        ]);
    });

    it("keeps entries that aren't LabelStruct-shaped as raw", () => {
        expect(decodeLabelList([1, { foo: "bar" }])).to.deep.equal([
            { kind: "raw", raw: 1 },
            { kind: "raw", raw: { foo: "bar" } },
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

    it("rejects a NUL-padded Label or Value the way MatterNode.nodeLabel does", () => {
        expect(decodeLabelList([{ "0": "room\u0000", "1": "Kitchen" }])).to.deep.equal([
            { kind: "label", item: { label: "", value: "Kitchen" } },
        ]);
        expect(decodeLabelList([{ "0": "room", "1": "Kitchen\u0000" }])).to.deep.equal([
            { kind: "label", item: { label: "room", value: "" } },
        ]);
    });

    it("treats a blank Value as absent, not an empty string carrying meaning", () => {
        expect(decodeLabelList([{ "0": "room", "1": "   " }])).to.deep.equal([
            { kind: "label", item: { label: "room", value: "" } },
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

    it("omits the value suffix when the Value is blank", () => {
        const { text } = describeLabelListEntry({ kind: "label", item: { label: "room", value: "" } });
        expect(text).to.equal("room");
    });

    it("marks a raw entry erroneous and shows its JSON", () => {
        const { text, title, erroneous } = describeLabelListEntry({ kind: "raw", raw: { foo: "bar" } });
        expect(text).to.equal('{"foo":"bar"}');
        expect(title).to.equal('Not a LabelStruct: {"foo":"bar"}');
        expect(erroneous).to.be.true;
    });

    it("truncates the chip text of an oversized raw entry but keeps the full JSON in the tooltip", () => {
        const raw = { note: "x".repeat(120) };
        const json = JSON.stringify(raw);
        const { text, title } = describeLabelListEntry({ kind: "raw", raw });
        expect(text).to.equal(`${json.slice(0, 59)}…`);
        expect(title).to.equal(`Not a LabelStruct: ${json}`);
    });

    it("renders an undefined raw entry without crashing", () => {
        const { text } = describeLabelListEntry({ kind: "raw", raw: undefined });
        expect(text).to.equal("undefined");
    });
});
