/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, FabricIndex, GroupId, NodeId } from "@matter/main/types";
import { ClusterId } from "@matter/main/types";
import { convertAclEntries, convertBindingTargets } from "../src/controller/ControllerCommandHandler.js";

describe("ControllerCommandHandler helpers", () => {
    // =========================================================================
    // convertAclEntries
    // =========================================================================

    describe("convertAclEntries", () => {
        it("converts privilege, auth_mode, and fabricIndex", () => {
            const result = convertAclEntries([{ privilege: 5, auth_mode: 2, subjects: null, targets: null }]);

            expect(result).to.have.length(1);
            expect(result[0].privilege).to.equal(5);
            expect(result[0].authMode).to.equal(2);
            expect(result[0].fabricIndex).to.equal(FabricIndex.OMIT_FABRIC);
        });

        it("converts subjects from number array to NodeId array", () => {
            const result = convertAclEntries([{ privilege: 5, auth_mode: 2, subjects: [1, 2], targets: null }]);

            expect(result[0].subjects).to.deep.equal([NodeId(1n), NodeId(2n)]);
        });

        it("converts bigint subjects to NodeId", () => {
            const result = convertAclEntries([
                { privilege: 5, auth_mode: 2, subjects: [BigInt("123456789012345")], targets: null },
            ]);

            expect(result[0].subjects).to.deep.equal([NodeId(123456789012345n)]);
        });

        it("sets subjects to null when input subjects is null", () => {
            const result = convertAclEntries([{ privilege: 5, auth_mode: 2, subjects: null, targets: null }]);
            expect(result[0].subjects).to.be.null;
        });

        it("converts targets with all fields set", () => {
            const result = convertAclEntries([
                {
                    privilege: 5,
                    auth_mode: 2,
                    subjects: null,
                    targets: [{ cluster: 6, endpoint: 1, device_type: 256 }],
                },
            ]);

            expect(result[0].targets).to.have.length(1);
            expect(result[0].targets![0].cluster).to.equal(ClusterId(6));
            expect(result[0].targets![0].endpoint).to.equal(EndpointNumber(1));
            expect(result[0].targets![0].deviceType).to.equal(256);
        });

        it("sets target cluster/endpoint/deviceType to null when input fields are null", () => {
            const result = convertAclEntries([
                {
                    privilege: 5,
                    auth_mode: 2,
                    subjects: null,
                    targets: [{ cluster: null, endpoint: null, device_type: null }],
                },
            ]);

            expect(result[0].targets![0].cluster).to.be.null;
            expect(result[0].targets![0].endpoint).to.be.null;
            expect(result[0].targets![0].deviceType).to.be.null;
        });

        it("sets targets to null when input targets is null", () => {
            const result = convertAclEntries([{ privilege: 5, auth_mode: 2, subjects: null, targets: null }]);
            expect(result[0].targets).to.be.null;
        });

        it("converts multiple entries", () => {
            const result = convertAclEntries([
                { privilege: 3, auth_mode: 2, subjects: [1], targets: null },
                { privilege: 5, auth_mode: 2, subjects: [2], targets: null },
            ]);

            expect(result).to.have.length(2);
            expect(result[0].privilege).to.equal(3);
            expect(result[1].privilege).to.equal(5);
        });

        it("returns empty array for empty input", () => {
            expect(convertAclEntries([])).to.deep.equal([]);
        });
    });

    // =========================================================================
    // convertBindingTargets
    // =========================================================================

    describe("convertBindingTargets", () => {
        it("converts all fields when set", () => {
            const result = convertBindingTargets([{ node: 1, group: 2, endpoint: 3, cluster: 6 }]);

            expect(result).to.have.length(1);
            expect(result[0].node).to.equal(NodeId(1n));
            expect(result[0].group).to.equal(GroupId(2));
            expect(result[0].endpoint).to.equal(EndpointNumber(3));
            expect(result[0].cluster).to.equal(ClusterId(6));
            expect(result[0].fabricIndex).to.equal(FabricIndex.OMIT_FABRIC);
        });

        it("sets node/group/endpoint/cluster to undefined when input fields are null", () => {
            const result = convertBindingTargets([{ node: null, group: null, endpoint: null, cluster: null }]);

            expect(result[0].node).to.be.undefined;
            expect(result[0].group).to.be.undefined;
            expect(result[0].endpoint).to.be.undefined;
            expect(result[0].cluster).to.be.undefined;
        });

        it("converts bigint node to NodeId", () => {
            const result = convertBindingTargets([
                { node: BigInt("12345678901234"), group: null, endpoint: null, cluster: null },
            ]);
            expect(result[0].node).to.equal(NodeId(12345678901234n));
        });

        it("sets fabricIndex to OMIT_FABRIC on every entry", () => {
            const result = convertBindingTargets([
                { node: 1, group: null, endpoint: null, cluster: null },
                { node: null, group: 2, endpoint: null, cluster: null },
            ]);

            for (const entry of result) {
                expect(entry.fabricIndex).to.equal(FabricIndex.OMIT_FABRIC);
            }
        });

        it("converts multiple bindings", () => {
            const result = convertBindingTargets([
                { node: 1, group: null, endpoint: 1, cluster: 6 },
                { node: 2, group: null, endpoint: 1, cluster: 6 },
            ]);
            expect(result).to.have.length(2);
        });

        it("returns empty array for empty input", () => {
            expect(convertBindingTargets([])).to.deep.equal([]);
        });
    });
});
