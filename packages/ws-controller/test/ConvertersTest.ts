/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import {
    GeneralDiagnostics,
    OccupancySensing,
    Thermostat,
    TimeSynchronization,
    WindowCovering,
} from "@matter/main/clusters";
import { AttributeModel, ClusterModel, FieldModel } from "@matter/main/model";
import { MATTER_EPOCH_OFFSET_US } from "@matter/main/types";
import { ClusterMap } from "../src/model/ModelMapper.js";
import {
    convertMatterToWebSocketTagBased,
    convertWebsocketDataToMatter,
    convertWebSocketTagBasedToMatter,
} from "../src/server/Converters.js";

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
    function syntheticBitmap(type: string, children: FieldModel[]) {
        return new ClusterModel({
            name: "SyntheticBitmapTest",
            id: 0xfff1,
            children: [new AttributeModel({ name: "Flags", id: 0x0000, type, children })],
        }).attributes.require("Flags");
    }

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

    it("decodes multi-bit bitmap subfields as numbers", () => {
        const operationalStatus = attributeModel(WindowCovering.Cluster.id, "operationalstatus");

        // 0b010110: Global (bits 0-1) = 2, Lift (bits 2-3) = 1, Tilt (bits 4-5) = 1
        const result = convertWebsocketDataToMatter("22", operationalStatus) as Record<string, unknown>;

        expect(result.global).to.equal(2);
        expect(result.lift).to.equal(1);
        expect(result.tilt).to.equal(1);
    });

    it("decodes a multi-bit subfield at the top of a map32 without sign extension", () => {
        const flags = syntheticBitmap("map32", [new FieldModel({ name: "High", constraint: "30 to 31" })]);

        const result = convertWebsocketDataToMatter("2147483648", flags) as Record<string, unknown>;

        expect(result.high).to.equal(2);
    });

    it("skips map64 members beyond the 32-bit shift range instead of decoding another bit", () => {
        const flags = syntheticBitmap("map64", [
            new FieldModel({ name: "Low", constraint: "0" }),
            new FieldModel({ name: "Beyond", constraint: "32" }),
        ]);

        const result = convertWebsocketDataToMatter("1", flags) as Record<string, unknown>;

        expect(result.low).to.equal(true);
        expect(Object.keys(result)).to.deep.equal(["low"]);
    });

    it("skips bitmap members that have no bit position", () => {
        const flags = syntheticBitmap("map8", [
            new FieldModel({ name: "Positioned", constraint: "0" }),
            new FieldModel({ name: "Unpositioned" }),
        ]);

        const result = convertWebsocketDataToMatter("1", flags) as Record<string, unknown>;

        expect(result.positioned).to.equal(true);
        expect(Object.keys(result)).to.deep.equal(["positioned"]);
    });

    it("omits bitmap members whose bit is not set", () => {
        const occupancy = attributeModel(OccupancySensing.Cluster.id, "occupancy");

        const result = convertWebsocketDataToMatter("0", occupancy) as Record<string, unknown>;

        expect(result.occupied).to.equal(undefined);
    });
});

describe("convertMatterToWebSocketTagBased - bitmap packing", () => {
    const clusterEntry = ClusterMap[WindowCovering.Cluster.id];
    if (clusterEntry === undefined) {
        throw new Error("WindowCovering cluster missing from ClusterMap");
    }
    const operationalStatus = clusterEntry.attributes.operationalstatus;
    if (operationalStatus === undefined) {
        throw new Error("WindowCovering OperationalStatus attribute missing from ClusterMap");
    }

    it("packs multi-bit subfields at their own offsets", () => {
        const result = convertMatterToWebSocketTagBased(
            { global: 2, lift: 1, tilt: 1 },
            operationalStatus,
            clusterEntry.model,
        );

        // 0b010110: Global (bits 0-1) = 2, Lift (bits 2-3) = 1, Tilt (bits 4-5) = 1
        expect(result).to.equal(22);
    });

    it("packs a boolean supplied for a multi-bit subfield into that subfield's lowest bit", () => {
        const result = convertMatterToWebSocketTagBased({ lift: true }, operationalStatus, clusterEntry.model);

        expect(result).to.equal(4);
    });

    it("masks a subfield value that exceeds its width", () => {
        const result = convertMatterToWebSocketTagBased({ tilt: 7 }, operationalStatus, clusterEntry.model);

        // Tilt occupies bits 4-5, so only the low two bits of 7 survive
        expect(result).to.equal(0x30);
    });

    it("packs a member at the top bit of a map32 as an unsigned value", () => {
        const cluster = new ClusterModel({
            name: "SyntheticBitmapTest",
            id: 0xfff1,
            children: [
                new AttributeModel({
                    name: "Flags",
                    id: 0x0000,
                    type: "map32",
                    children: [new FieldModel({ name: "Top", constraint: "31" })],
                }),
            ],
        });

        const result = convertMatterToWebSocketTagBased({ top: true }, cluster.attributes.require("Flags"), cluster);

        expect(result).to.equal(0x80000000);
    });

    it("round-trips a multi-bit bitmap through both directions", () => {
        const decoded = convertWebSocketTagBasedToMatter(22, operationalStatus, clusterEntry.model);

        expect(convertMatterToWebSocketTagBased(decoded, operationalStatus, clusterEntry.model)).to.equal(22);
    });
});
