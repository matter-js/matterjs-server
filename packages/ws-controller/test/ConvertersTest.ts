/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, NodeId } from "@matter/main";
import {
    GeneralDiagnostics,
    OccupancySensing,
    OperationalCredentials,
    Thermostat,
    TimeSynchronization,
    WindowCovering,
} from "@matter/main/clusters";
import { AttributeModel, ClusterModel, FieldModel } from "@matter/main/model";
import {
    ClusterId,
    EndpointNumber,
    EventId,
    EventNumber,
    MATTER_EPOCH_OFFSET_US,
    Status,
    TlvAny,
    TlvArray,
    TlvByteString,
    TlvField,
    TlvObject,
    TlvString,
    TlvUInt8,
} from "@matter/main/types";
import { ClusterMap } from "../src/model/ModelMapper.js";
import {
    convertEventToWebSocket,
    convertMatterToWebSocketTagBased,
    convertWebsocketDataToMatter,
    convertWebSocketTagBasedToMatter,
    pathStatusOf,
    splitAttributePath,
    splitEventPath,
    statusPathOf,
} from "../src/server/Converters.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

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

describe("convertMatterToWebSocketTagBased - list element model", () => {
    const clusterEntry = ClusterMap[OperationalCredentials.Cluster.id];
    if (clusterEntry === undefined) {
        throw new Error("OperationalCredentials cluster missing from ClusterMap");
    }
    const fabrics = clusterEntry.attributes.fabrics;
    if (fabrics === undefined) {
        throw new Error("OperationalCredentials Fabrics attribute missing from ClusterMap");
    }

    /** Counts reads of `members` on one model; the getter rebuilds the cluster scope on every read. */
    function countMembersReads(model: object) {
        let owner: object | null = Object.getPrototypeOf(model);
        let descriptor: PropertyDescriptor | undefined;
        while (owner !== null) {
            descriptor = Object.getOwnPropertyDescriptor(owner, "members");
            if (descriptor !== undefined) break;
            owner = Object.getPrototypeOf(owner);
        }
        const getter = descriptor?.get;
        if (owner === null || descriptor === undefined || getter === undefined) {
            throw new Error("members getter not found");
        }
        const prototype = owner;
        const counter = { reads: 0 };
        Object.defineProperty(prototype, "members", {
            ...descriptor,
            get() {
                if (this === model) {
                    counter.reads++;
                }
                return getter.call(this);
            },
        });
        return { counter, restore: () => Object.defineProperty(prototype, "members", descriptor) };
    }

    it("resolves the element model once, however often the list is converted", () => {
        const { counter, restore } = countMembersReads(fabrics);
        try {
            // Struct entries are keyed by field tag only through the element model: fabricIndex is tag 254.
            for (let i = 0; i < 3; i++) {
                const converted = convertMatterToWebSocketTagBased([{ fabricIndex: 1 }], fabrics, clusterEntry.model);
                expect(converted).deep.equals([{ "254": 1 }]);
            }
        } finally {
            restore();
        }

        expect(counter.reads).at.most(1);
    });
});

describe("values without a model", () => {
    const Inner = TlvObject({ text: TlvField(0, TlvString) });
    const Outer = TlvObject({
        number: TlvField(1, TlvUInt8),
        bytes: TlvField(2, TlvByteString),
        inner: TlvField(3, Inner),
        list: TlvField(4, TlvArray(Inner)),
    });
    const unmodeled = TlvAny.decodeAnyTlvStream(
        Outer.encodeTlv({ number: 5, bytes: Bytes.fromHex("0102"), inner: { text: "a" }, list: [{ text: "b" }] }),
    );
    const tagKeyed = { "1": 5, "2": "AQI=", "3": { "0": "a" }, "4": [{ "0": "b" }] };

    it("sends a structure as tag-keyed JSON", () => {
        expect(convertMatterToWebSocketTagBased(unmodeled, undefined, undefined)).deep.equals(tagKeyed);
    });

    it("sends the payload of an unknown event as tag-keyed JSON", () => {
        const event = convertEventToWebSocket(
            NodeId(5),
            { endpointId: EndpointNumber(1), clusterId: ClusterId(0xfff1fc05), eventId: EventId(1) },
            { eventNumber: EventNumber(1n), priority: 1, data: unmodeled },
        );
        expect(event.data).deep.equals(tagKeyed);
    });
});

describe("path status helpers", () => {
    it("keeps a wildcard the device left in the status path", () => {
        expect(statusPathOf(1, undefined, 3)).equals("1/*/3");
        expect(statusPathOf(undefined, 6, undefined)).equals("*/6/*");
    });

    it("adds cluster_status only when the device sent one", () => {
        expect(pathStatusOf({ status: Status.Failure })).deep.equals({ status: Status.Failure });
        expect(pathStatusOf({ status: Status.Failure, clusterStatus: 0 })).deep.equals({
            status: Status.Failure,
            cluster_status: 0,
        });
    });
});

describe("path splitting", () => {
    function errorOf(split: () => unknown) {
        try {
            split();
        } catch (error) {
            return error;
        }
        return undefined;
    }

    it("names the event id when an event path has an invalid one", () => {
        const error = errorOf(() => splitEventPath("1/59/32768"));

        expect(error).instanceOf(ServerError);
        if (error instanceof ServerError) {
            expect(error.code).equals(ServerErrorCode.InvalidArguments);
            expect(error.message).contains("Invalid event ID");
            expect(error.message).not.contains("attribute");
        }
    });

    it("names the attribute id when an attribute path has an invalid one", () => {
        const error = errorOf(() => splitAttributePath("1/6/32768"));

        expect(error).instanceOf(ServerError);
        if (error instanceof ServerError) {
            expect(error.message).contains("Invalid attribute ID");
        }
    });

    it("reads the wildcard values and non-numeric parts as wildcards", () => {
        expect(splitEventPath("65535/4294967295/4294967295")).deep.equals({
            endpointId: undefined,
            clusterId: undefined,
            eventId: undefined,
        });
        expect(splitAttributePath("*/6/*")).deep.equals({
            endpointId: undefined,
            clusterId: 6,
            attributeId: undefined,
        });
        expect(splitEventPath("1/59/1")).deep.equals({ endpointId: 1, clusterId: 59, eventId: 1 });
    });
});

describe("convertEventToWebSocket", () => {
    const path = { endpointId: EndpointNumber(1), clusterId: ClusterId(0x45), eventId: EventId(0) };
    const occurrence = { eventNumber: EventNumber(7n), priority: 1, data: { stateValue: true } };

    it("prefers the epoch timestamp", () => {
        const event = convertEventToWebSocket(NodeId(5), path, {
            ...occurrence,
            epochTimestamp: 1_700_000_000_000,
            systemTimestamp: 1234,
        });

        expect(event).deep.equals({
            node_id: NodeId(5),
            endpoint_id: 1,
            cluster_id: 0x45,
            event_id: 0,
            event_number: 7n,
            priority: 1,
            timestamp: 1_700_000_000_000,
            timestamp_type: 1,
            data: { stateValue: true },
        });
    });

    it("falls back to the system timestamp, then to the local clock", () => {
        const system = convertEventToWebSocket(NodeId(5), path, { ...occurrence, systemTimestamp: 1234 });
        expect([system.timestamp, system.timestamp_type]).deep.equals([1234, 0]);

        const before = Date.now();
        const local = convertEventToWebSocket(NodeId(5), path, occurrence);
        expect(local.timestamp_type).equals(2);
        expect(Number(local.timestamp)).within(before, Date.now());
    });

    it("sends null for an event without data", () => {
        expect(convertEventToWebSocket(NodeId(5), path, { ...occurrence, data: undefined }).data).equals(null);
    });
});
