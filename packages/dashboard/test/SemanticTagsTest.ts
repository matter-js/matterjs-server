/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    decodeSemanticTagList,
    describeSemanticTag,
    describeSemanticTagListEntry,
    getEndpointSemanticTags,
} from "../src/util/semantic-tags.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

// SemanticTagStruct wire entries are field-tag keyed ("0" MfgCode, "1" NamespaceID, "2" Tag, "3" Label),
// matching how packages/ws-controller serializes attribute-read struct values (Converters.ts tagBased path).

describe("decodeSemanticTagList", () => {
    it("decodes tag-keyed SemanticTagStruct entries", () => {
        // Real device fixture: Closure Panel endpoint exposing namespace 69 (ClosurePanel), tag 0 (Lift)
        const decoded = decodeSemanticTagList([{ "0": null, "1": 69, "2": 0, "3": "ClosurePanel.Lift" }]);
        expect(decoded).to.deep.equal([
            { kind: "tag", semtag: { mfgCode: null, namespaceId: 69, tag: 0, label: "ClosurePanel.Lift" } },
        ]);
    });

    it("treats an absent MfgCode/Label key as null, not undefined", () => {
        const decoded = decodeSemanticTagList([{ "1": 8, "2": 2 }]);
        expect(decoded).to.deep.equal([
            { kind: "tag", semtag: { mfgCode: null, namespaceId: 8, tag: 2, label: null } },
        ]);
    });

    it("accepts an empty array", () => {
        expect(decodeSemanticTagList([])).to.deep.equal([]);
    });

    it("returns undefined when the attribute hasn't been read yet", () => {
        expect(decodeSemanticTagList(undefined)).to.be.undefined;
    });

    it("keeps entries that aren't SemanticTagStruct-shaped as raw", () => {
        expect(decodeSemanticTagList([1, { foo: "bar" }])).to.deep.equal([
            { kind: "raw", raw: 1 },
            { kind: "raw", raw: { foo: "bar" } },
        ]);
    });

    it("keeps decodable entries alongside undecodable ones", () => {
        expect(decodeSemanticTagList([{ "1": 8, "2": 2 }, "nonsense"])).to.deep.equal([
            { kind: "tag", semtag: { mfgCode: null, namespaceId: 8, tag: 2, label: null } },
            { kind: "raw", raw: "nonsense" },
        ]);
    });

    it("reports a whole attribute value that isn't a list as one raw entry", () => {
        expect(decodeSemanticTagList(42)).to.deep.equal([{ kind: "raw", raw: 42 }]);
    });
});

describe("describeSemanticTag", () => {
    it("resolves a standard namespace and tag", () => {
        // CommonPosition (8) -> Top (2)
        const { text } = describeSemanticTag({ mfgCode: null, namespaceId: 8, tag: 2, label: null });
        expect(text).to.equal("Common Position → Top");
    });

    it("appends the label as a qualifier when present on a standard tag", () => {
        // CommonPosition (8) -> Row (5), qualified per spec by a numeric label
        const { text } = describeSemanticTag({ mfgCode: null, namespaceId: 8, tag: 5, label: "3" });
        expect(text).to.equal('Common Position → Row ("3")');
    });

    it("resolves a real device fixture (Closure Panel -> Lift)", () => {
        const { text } = describeSemanticTag({ mfgCode: null, namespaceId: 69, tag: 0, label: "ClosurePanel.Lift" });
        expect(text).to.equal('Closure Panel → Lift ("ClosurePanel.Lift")');
    });

    it("falls back to raw ids for an unrecognized standard namespace", () => {
        const { text } = describeSemanticTag({ mfgCode: null, namespaceId: 9999, tag: 1, label: null });
        expect(text).to.equal("Namespace 9999 → Tag 1");
    });

    it("falls back to raw ids for a tag id not defined within a known namespace", () => {
        // CommonPosition (8) only defines tags 0-6
        const { text } = describeSemanticTag({ mfgCode: null, namespaceId: 8, tag: 99, label: null });
        expect(text).to.equal("Common Position → Tag 99");
    });

    it("renders manufacturer-specific tags using their label, not the standard registry", () => {
        const { text } = describeSemanticTag({ mfgCode: 4874, namespaceId: 1, tag: 3, label: "CustomZone" });
        expect(text).to.equal("Mfg 0x130A: CustomZone");
    });

    it("renders manufacturer-specific tags without a label using the raw tag id", () => {
        const { text } = describeSemanticTag({ mfgCode: 4874, namespaceId: 1, tag: 3, label: null });
        expect(text).to.equal("Mfg 0x130A tag 3");
    });
});

describe("describeSemanticTagListEntry", () => {
    it("describes a decoded tag without marking it erroneous", () => {
        const { text, erroneous } = describeSemanticTagListEntry({
            kind: "tag",
            semtag: { mfgCode: null, namespaceId: 8, tag: 2, label: null },
        });
        expect(text).to.equal("Common Position → Top");
        expect(erroneous).to.be.false;
    });

    it("marks a raw entry erroneous and shows its JSON", () => {
        const { text, title, erroneous } = describeSemanticTagListEntry({ kind: "raw", raw: { foo: "bar" } });
        expect(text).to.equal('{"foo":"bar"}');
        expect(title).to.equal('Not a SemanticTagStruct: {"foo":"bar"}');
        expect(erroneous).to.be.true;
    });

    it("truncates the chip text of an oversized raw entry but keeps the full JSON in the tooltip", () => {
        const raw = { note: "x".repeat(120) };
        const json = JSON.stringify(raw);
        const { text, title } = describeSemanticTagListEntry({ kind: "raw", raw });
        expect(text).to.equal(`${json.slice(0, 59)}…`);
        expect(title).to.equal(`Not a SemanticTagStruct: ${json}`);
    });

    it("renders an undefined raw entry without crashing", () => {
        const { text } = describeSemanticTagListEntry({ kind: "raw", raw: undefined });
        expect(text).to.equal("undefined");
    });
});

describe("getEndpointSemanticTags", () => {
    it("returns an empty array when the endpoint has no TagList attribute", () => {
        const n = node({});
        expect(getEndpointSemanticTags(n, 1)).to.deep.equal([]);
    });

    it("decodes the Descriptor TagList for the given endpoint", () => {
        const n = node({ "1/29/4": [{ "1": 8, "2": 2 }] });
        expect(getEndpointSemanticTags(n, 1)).to.deep.equal([
            { kind: "tag", semtag: { mfgCode: null, namespaceId: 8, tag: 2, label: null } },
        ]);
    });

    it("is scoped per endpoint", () => {
        const n = node({ "1/29/4": [{ "1": 8, "2": 2 }] });
        expect(getEndpointSemanticTags(n, 2)).to.deep.equal([]);
    });
});
