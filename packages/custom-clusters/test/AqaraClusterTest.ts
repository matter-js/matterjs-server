/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterModel, Matter } from "@matter/main/model";
import "../src/register.js";

function cluster(id: number) {
    const model = Matter.children.find(child => child.tag === "cluster" && child.id === id);
    expect(model, `cluster 0x${id.toString(16)} is registered`).to.exist;
    return model as ClusterModel;
}

describe("Aqara FP400 clusters", () => {
    it("registers the ambient sensing configuration cluster with its zone commands", () => {
        const config = cluster(0x115ffc0a);

        expect([...config.attributes].map(attribute => [attribute.id, attribute.name])).to.deep.include.members([
            [0x0000, "installMode"],
            [0x0007, "installStatus"],
            [0x0010, "zones"],
            [0x002f, "proximityDistanceLevel"],
        ]);

        expect(
            [...config.commands].map(command => [command.id, command.name, command.isResponse]),
        ).to.deep.include.members([
            [0x04, "appendZone", false],
            [0x05, "appendZoneResponse", true],
            [0x0a, "setZones", false],
            [0x0b, "setZonesResponse", true],
        ]);
    });

    it("types the zone list as a list of zone structs", () => {
        const zones = [...cluster(0x115ffc0a).attributes].find(attribute => attribute.name === "zones");

        expect(zones?.effectiveMetatype).to.equal("array");
        const entry = zones?.operationalBase?.children[0];
        expect(entry?.operationalBase?.name).to.equal("AqaraZoneStruct");
        expect(entry?.operationalBase?.children.map(field => field.name)).to.deep.equal([
            "zoneId",
            "zoneType",
            "cells",
            "enabled",
        ]);
    });

    it("registers the location cluster with its event", () => {
        const location = cluster(0x115ffc0c);

        expect([...location.events].map(event => [event.id, event.name])).to.deep.equal([[0x00, "locationInfo"]]);
        expect([...location.commands].map(command => [command.id, command.name])).to.deep.equal([
            [0x00, "subscribeLocationData"],
            [0x01, "removeDetectionTarget"],
        ]);
    });
});
