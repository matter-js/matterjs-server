/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { GeneralDiagnostics, OccupancySensing, Thermostat, TimeSynchronization } from "@matter/main/clusters";
import { MATTER_EPOCH_OFFSET_US } from "@matter/main/types";
import { ClusterMap } from "../src/model/ModelMapper.js";
import { convertWebsocketDataToMatter, convertWebSocketTagBasedToMatter } from "../src/server/Converters.js";

describe("convertWebSocketTagBasedToMatter", () => {
    const clusterEntry = ClusterMap[Thermostat.Cluster.id];
    if (clusterEntry === undefined) {
        throw new Error("Thermostat cluster missing from ClusterMap");
    }
    const presetsAttribute = clusterEntry.attributes.presets;
    if (presetsAttribute === undefined) {
        throw new Error("Thermostat Presets attribute missing from ClusterMap");
    }
    const presetStructModel = presetsAttribute.members.at(0);
    if (presetStructModel === undefined) {
        throw new Error("Thermostat Presets member model missing");
    }

    const handleBase64 = Bytes.toBase64(Bytes.fromHex("aabbcc"));

    it("resolves struct members by numeric TLV tag (matter-server >=1.3.0 python client)", () => {
        const result = convertWebSocketTagBasedToMatter(
            { "0": handleBase64, "1": 1, "5": true },
            presetStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        expect(Bytes.toHex(result.presetHandle as Uint8Array)).to.equal("aabbcc");
        expect(result.presetScenario).to.equal(1);
        expect(result.builtIn).to.equal(true);
    });

    it("falls back to wire field names for pre-1.3.0 python clients that serialized by name", () => {
        const result = convertWebSocketTagBasedToMatter(
            { presetHandle: handleBase64, presetScenario: 1, builtIn: true },
            presetStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        expect(Bytes.toHex(result.presetHandle as Uint8Array)).to.equal("aabbcc");
        expect(result.presetScenario).to.equal(1);
        expect(result.builtIn).to.equal(true);
    });

    it("keeps genuinely unknown keys as-is", () => {
        const result = convertWebSocketTagBasedToMatter(
            { notARealField: "value" },
            presetStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        expect(result.notARealField).to.equal("value");
    });

    const presetMember = (id: number) => {
        const member = presetStructModel.members.find(m => m.id === id);
        if (member === undefined) {
            throw new Error(`PresetStruct member with id ${id} missing`);
        }
        return member;
    };

    it("treats null for an optional non-nullable member as absent (tag path)", () => {
        const coolingSetpoint = presetMember(3);
        expect(coolingSetpoint.mandatory).to.equal(false);
        expect(coolingSetpoint.nullable).to.equal(false);

        const result = convertWebSocketTagBasedToMatter({ "3": null }, presetStructModel, clusterEntry.model) as Record<
            string,
            unknown
        >;

        expect(Object.hasOwn(result, "coolingSetpoint")).to.equal(false);
    });

    it("treats null for an optional non-nullable member as absent (wire-name path)", () => {
        const result = convertWebSocketTagBasedToMatter(
            { coolingSetpoint: null },
            presetStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        expect(Object.hasOwn(result, "coolingSetpoint")).to.equal(false);
    });

    // Characterization test: documents pre-existing null passthrough, does not prove the null-skip guard
    it("passes null through for a nullable member", () => {
        const name = presetMember(2);
        expect(name.nullable).to.equal(true);

        const result = convertWebSocketTagBasedToMatter({ "2": null }, presetStructModel, clusterEntry.model) as Record<
            string,
            unknown
        >;

        expect(result.name).to.equal(null);
    });

    // Characterization test: documents that mandatory members are never skipped by the null-skip guard
    it("passes null through for a mandatory non-nullable member", () => {
        const presetScenario = presetMember(1);
        expect(presetScenario.mandatory).to.equal(true);
        expect(presetScenario.nullable).to.equal(false);

        const result = convertWebSocketTagBasedToMatter({ "1": null }, presetStructModel, clusterEntry.model) as Record<
            string,
            unknown
        >;

        expect(result.presetScenario).to.equal(null);
    });

    it("only treats purely-numeric keys as TLV tags, not prefixed digits", () => {
        const result = convertWebSocketTagBasedToMatter(
            { "5x": "boom" },
            presetStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        expect(result["5x"]).to.equal("boom");
        expect(result.builtIn).to.equal(undefined);
    });
});

describe("convertWebSocketTagBasedToMatter - legacy propertyName wire-name fallback", () => {
    const clusterEntry = ClusterMap[GeneralDiagnostics.Cluster.id];
    if (clusterEntry === undefined) {
        throw new Error("GeneralDiagnostics cluster missing from ClusterMap");
    }
    const networkInterfacesAttribute = clusterEntry.attributes.networkinterfaces;
    if (networkInterfacesAttribute === undefined) {
        throw new Error("GeneralDiagnostics NetworkInterfaces attribute missing from ClusterMap");
    }
    const networkInterfaceStructModel = networkInterfacesAttribute.members.at(0);
    if (networkInterfaceStructModel === undefined) {
        throw new Error("GeneralDiagnostics NetworkInterface member model missing");
    }

    const ipv4AddressesMember = networkInterfaceStructModel.members.find(m => m.name === "IPv4Addresses");
    if (ipv4AddressesMember === undefined) {
        throw new Error("NetworkInterface IPv4Addresses member missing");
    }
    // The suite is only meaningful while wire name and propertyName genuinely differ here
    if (ipv4AddressesMember.propertyName === "IPv4Addresses") {
        throw new Error("Expected IPv4Addresses propertyName to differ from its wire name");
    }

    it("resolves the legacy matter.js propertyName key, not just the wire name", () => {
        // The Uint8Array conversion proves resolution: unresolved keys copy the base64 string untouched
        const addressBase64 = Bytes.toBase64(Bytes.fromHex("0a000001"));
        const result = convertWebSocketTagBasedToMatter(
            { [ipv4AddressesMember.propertyName]: [addressBase64] },
            networkInterfaceStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        const addresses = result[ipv4AddressesMember.propertyName] as Uint8Array[];
        expect(Bytes.toHex(addresses[0])).to.equal("0a000001");
    });

    it("resolves the chip SDK wire name where it differs from propertyName", () => {
        const addressBase64 = Bytes.toBase64(Bytes.fromHex("0a000001"));
        const result = convertWebSocketTagBasedToMatter(
            { IPv4Addresses: [addressBase64] },
            networkInterfaceStructModel,
            clusterEntry.model,
        ) as Record<string, unknown>;

        const addresses = result[ipv4AddressesMember.propertyName] as Uint8Array[];
        expect(Bytes.toHex(addresses[0])).to.equal("0a000001");
    });
});

describe("convertWebsocketDataToMatter", () => {
    function attributeModel(clusterId: number, attributeName: string) {
        const clusterEntry = ClusterMap[clusterId];
        if (clusterEntry === undefined) {
            throw new Error(`Cluster ${clusterId} missing from ClusterMap`);
        }
        const attribute = clusterEntry.attributes[attributeName];
        if (attribute === undefined) {
            throw new Error(`Attribute ${attributeName} missing from cluster ${clusterId}`);
        }
        return attribute;
    }

    it("keeps full precision for epoch-us values sent as a decimal string", () => {
        const utcTime = attributeModel(TimeSynchronization.Cluster.id, "utctime");
        const unixMicroseconds = 9007199254740993n; // Number.MAX_SAFE_INTEGER + 2

        const result = convertWebsocketDataToMatter(unixMicroseconds.toString(), utcTime);

        expect(result).to.equal(unixMicroseconds + MATTER_EPOCH_OFFSET_US);
    });

    it("decodes single-bit bitmap members from a numeric string", () => {
        const occupancy = attributeModel(OccupancySensing.Cluster.id, "occupancy");

        const result = convertWebsocketDataToMatter("1", occupancy) as Record<string, unknown>;

        expect(result.occupied).to.equal(true);
    });

    it("omits bitmap members whose bit is not set", () => {
        const occupancy = attributeModel(OccupancySensing.Cluster.id, "occupancy");

        const result = convertWebsocketDataToMatter("0", occupancy) as Record<string, unknown>;

        expect(result.occupied).to.equal(undefined);
    });
});
