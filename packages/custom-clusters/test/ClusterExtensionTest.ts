/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { WindowCovering } from "@matter/main/clusters/window-covering";
import { ClusterModel, Matter, SchemaImplementationError } from "@matter/main/model";
import { clusterExtension, extendCluster, ExtensionAttribute } from "../src/extensions/extension.js";
import "../src/register.js";

const VALID: ExtensionAttribute = { id: 0x15340101, name: "VendorValid", type: "uint32" };

// Extensions of the global model leak into every other test file of the run, so validation works on a local cluster
function testCluster() {
    return new ClusterModel({ id: 0xfff41234, name: "ExtensionTestCluster" });
}

function extensionAttributesOf(cluster: ClusterModel) {
    return cluster.attributes.filter(attribute => attribute.id > 0xffff).map(attribute => attribute.name);
}

describe("clusterExtension", () => {
    describe("registered extensions", () => {
        it("adds the WAGO attributes to the Window Covering cluster as optional writable attributes", () => {
            const windowCovering = Matter.clusters(WindowCovering.id);

            const attributes = windowCovering?.attributes.filter(attribute => attribute.name.startsWith("Wago"));

            expect(
                attributes?.map(attribute => [
                    attribute.id,
                    attribute.name,
                    attribute.type,
                    `${attribute.conformance}`,
                    attribute.writable,
                ]),
            ).to.deep.equal([
                [0x15340001, "WagoTravelTimeUp", "uint32", "O", true],
                [0x15340002, "WagoTravelTimeDown", "uint32", "O", true],
                [0x15340003, "WagoSlatRotationTime", "uint32", "O", true],
            ]);
        });
    });

    describe("cluster lookup", () => {
        it("adds the attributes of an extension", () => {
            const cluster = testCluster();

            extendCluster(cluster, [VALID]);

            expect(extensionAttributesOf(cluster)).to.deep.equal(["VendorValid"]);
        });

        it("rejects an unknown cluster", () => {
            expect(() => clusterExtension("NoSuchCluster", [VALID])).to.throw(
                SchemaImplementationError,
                "Cannot extend unknown cluster",
            );
        });
    });

    describe("validation", () => {
        it("rejects a cluster that is already in use", () => {
            const cluster = testCluster();
            Object.freeze(cluster.children);

            expect(() => extendCluster(cluster, [VALID])).to.throw(
                SchemaImplementationError,
                "Cluster is already in use",
            );
        });

        it("rejects an attribute ID without vendor prefix", () => {
            expect(() => extendCluster(testCluster(), [{ ...VALID, id: 0x0042 }])).to.throw(
                SchemaImplementationError,
                "must use a vendor prefixed ID",
            );
        });

        it("rejects an attribute ID with a reserved vendor prefix", () => {
            expect(() => extendCluster(testCluster(), [{ ...VALID, id: 0xfff50001 }])).to.throw(
                SchemaImplementationError,
                "must use a vendor prefixed ID",
            );
        });

        it("rejects an attribute ID with a reserved suffix", () => {
            expect(() => extendCluster(testCluster(), [{ ...VALID, id: 0x1534ffff }])).to.throw(
                SchemaImplementationError,
                "must use a vendor prefixed ID",
            );
        });

        it("rejects an attribute ID that is already defined", () => {
            expect(() =>
                clusterExtension(WindowCovering.id, [{ ...VALID, id: 0x15340001, name: "VendorOtherName" }]),
            ).to.throw(SchemaImplementationError, `conflicts with "WagoTravelTimeUp"`);
        });

        it("rejects an attribute name that only differs in case", () => {
            expect(() =>
                clusterExtension(WindowCovering.id, [{ ...VALID, id: 0x15340101, name: "wagoTravelTimeUp" }]),
            ).to.throw(SchemaImplementationError, `conflicts with "WagoTravelTimeUp"`);
        });

        it("rejects attributes that conflict within one extension", () => {
            expect(() => extendCluster(testCluster(), [VALID, { ...VALID, id: 0x15340102 }])).to.throw(
                SchemaImplementationError,
                `conflicts with "VendorValid"`,
            );
        });

        it("adds no attribute at all when one of them is invalid", () => {
            const cluster = testCluster();

            expect(() => extendCluster(cluster, [VALID, { ...VALID, id: 0x0042, name: "VendorInvalid" }])).to.throw(
                SchemaImplementationError,
            );

            expect(extensionAttributesOf(cluster)).to.deep.equal([]);
        });
    });
});
