/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { WindowCovering } from "@matter/main/clusters/window-covering";
import { Matter, SchemaImplementationError } from "@matter/main/model";
import { clusterExtension } from "../src/extensions/extension.js";
import "../src/register.js";

const windowCovering = Matter.clusters(WindowCovering.id);

describe("clusterExtension", () => {
    describe("registered extensions", () => {
        it("adds the WAGO attributes to the Window Covering cluster as optional writable attributes", () => {
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

    describe("validation", () => {
        it("rejects an unknown cluster", () => {
            expect(() => clusterExtension("NoSuchCluster", [])).to.throw(`Required member "NoSuchCluster" not found`);
        });

        it("rejects an attribute ID without vendor prefix", () => {
            expect(() =>
                clusterExtension(WindowCovering.id, [{ id: 0x0042, name: "VendorNoPrefix", type: "uint32" }]),
            ).to.throw(SchemaImplementationError, "must use a vendor prefixed ID");
        });

        it("rejects an attribute ID that is already defined", () => {
            expect(() =>
                clusterExtension(WindowCovering.id, [{ id: 0x15340001, name: "VendorOtherName", type: "uint32" }]),
            ).to.throw(SchemaImplementationError, `conflicts with attribute "WagoTravelTimeUp"`);
        });

        it("rejects an attribute name that is already defined", () => {
            expect(() =>
                clusterExtension(WindowCovering.id, [{ id: 0x1534ffff, name: "WagoTravelTimeUp", type: "uint32" }]),
            ).to.throw(SchemaImplementationError, `conflicts with attribute "WagoTravelTimeUp"`);
        });
    });
});
