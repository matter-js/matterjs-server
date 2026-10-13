/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CaseAuthenticatedTag, NodeId, UINT32_MAX } from "@matter/main";
import { nodeIdTarget } from "../src/util/nodeIdClasses.js";

describe("nodeIdTarget", () => {
    const CASES: ReadonlyArray<readonly [string, NodeId, "node" | "group" | "unusable", string | undefined]> = [
        ["the unspecified node id", NodeId.UNSPECIFIED_NODE_ID, "unusable", "the Unspecified Node ID"],
        ["the first operational node id", NodeId(1n), "node", undefined],
        ["the last operational node id", NodeId(0xffff_ffef_ffff_ffffn), "node", undefined],
        ["the first reserved span", NodeId(0xffff_fff0_0000_0000n), "unusable", "a reserved Node ID"],
        ["a PAKE key identifier", NodeId.getFromPakeKeyIdentifier(0), "unusable", "a PAKE key identifier"],
        [
            "the last PAKE key identifier",
            NodeId.getFromPakeKeyIdentifier(UINT32_MAX),
            "unusable",
            "a PAKE key identifier",
        ],
        ["the reserved span after PAKE", NodeId(0xffff_fffc_0000_0000n), "unusable", "a reserved Node ID"],
        [
            "a CASE authenticated tag",
            NodeId.fromCaseAuthenticatedTag(CaseAuthenticatedTag(1)),
            "unusable",
            "a CASE Authenticated Tag",
        ],
        ["the first temporary local id", NodeId.fromTemporaryLocalNodeId(0), "node", undefined],
        ["the last temporary local id", NodeId.fromTemporaryLocalNodeId(UINT32_MAX), "node", undefined],
        ["the reserved span above temporary local", NodeId(0xffff_ffff_0000_0000n), "unusable", "a reserved Node ID"],
        ["the last reserved id below the groups", NodeId(0xffff_ffff_fffe_ffffn), "unusable", "a reserved Node ID"],
        ["the null group id", NodeId.fromGroupId(0), "unusable", "the Null Group ID"],
        ["the first usable group node id", NodeId.fromGroupId(1), "group", "a Group Node ID"],
        ["the last group node id", NodeId(0xffff_ffff_ffff_ffffn), "group", "a Group Node ID"],
    ];

    for (const [label, nodeId, kind, className] of CASES) {
        it(`classifies ${label} as ${kind}`, () => {
            const target = nodeIdTarget(nodeId);
            expect(target.kind).to.equal(kind);
            if (className !== undefined) {
                expect(target.kind === "node" ? undefined : target.className).to.equal(className);
            }
        });
    }
});
