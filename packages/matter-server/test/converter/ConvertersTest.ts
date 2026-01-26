/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ClusterMap,
    convertMatterToWebSocketTagBased,
    convertWebSocketTagBasedToMatter,
    parseBigIntAwareJson,
    splitAttributePath,
    toBigIntAwareJson,
} from "@matter-server/ws-controller";
import { Bytes } from "@matter/main";

describe("Converters", () => {
    describe("convertWebSocketTagBasedToMatter", () => {
        describe("primitives", () => {
            it("should pass through null values", () => {
                const descriptorCluster = ClusterMap[29]!;
                const result = convertWebSocketTagBasedToMatter(
                    null,
                    descriptorCluster.attributes[0],
                    descriptorCluster.model,
                );
                expect(result).to.equal(null);
            });

            it("should pass through undefined values when model is undefined", () => {
                const descriptorCluster = ClusterMap[29]!;
                const result = convertWebSocketTagBasedToMatter("test", undefined, descriptorCluster.model);
                expect(result).to.equal("test");
            });

            it("should pass through number values", () => {
                // Cluster 40 (BasicInformation), attribute 0 (DataModelRevision) is a simple number
                const basicInfoCluster = ClusterMap[40]!;
                const result = convertWebSocketTagBasedToMatter(
                    16,
                    basicInfoCluster.attributes[0],
                    basicInfoCluster.model,
                );
                expect(result).to.equal(16);
            });

            it("should pass through boolean values", () => {
                // Cluster 6 (OnOff), attribute 0 (OnOff) is a boolean
                const onOffCluster = ClusterMap[6]!;
                const result = convertWebSocketTagBasedToMatter(true, onOffCluster.attributes[0], onOffCluster.model);
                expect(result).to.equal(true);
            });

            it("should pass through string values", () => {
                // Cluster 40 (BasicInformation), attribute 1 (VendorName) is a string
                const basicInfoCluster = ClusterMap[40]!;
                const result = convertWebSocketTagBasedToMatter(
                    "Test Vendor",
                    basicInfoCluster.attributes[1],
                    basicInfoCluster.model,
                );
                expect(result).to.equal("Test Vendor");
            });
        });

        describe("structs", () => {
            it("should convert tag-based struct to camelCased object", () => {
                // Cluster 29 (Descriptor), attribute 0 (DeviceTypeList) contains DeviceTypeStruct
                // DeviceTypeStruct has: 0 = deviceType, 1 = revision
                const descriptorCluster = ClusterMap[29]!;
                const deviceTypeListAttr = descriptorCluster.attributes[0]!; // list of DeviceTypeStruct
                const deviceTypeStructModel = deviceTypeListAttr.members[0]; // DeviceTypeStruct

                const tagBasedValue = { "0": 22, "1": 1 };
                const result = convertWebSocketTagBasedToMatter(
                    tagBasedValue,
                    deviceTypeStructModel,
                    descriptorCluster.model,
                );

                expect(result).to.deep.equal({ deviceType: 22, revision: 1 });
            });

            it("should convert nested structs with labels", () => {
                // Cluster 64 (UserLabel), attribute 0 (LabelList) contains LabelStruct
                // LabelStruct has: 0 = label, 1 = value
                const userLabelCluster = ClusterMap[64]!;
                const labelListAttr = userLabelCluster.attributes[0]!;
                const labelStructModel = labelListAttr.members[0];

                const tagBasedValue = { "0": "room", "1": "bedroom" };
                const result = convertWebSocketTagBasedToMatter(
                    tagBasedValue,
                    labelStructModel,
                    userLabelCluster.model,
                );

                expect(result).to.deep.equal({ label: "room", value: "bedroom" });
            });

            it("should handle GeneralCommissioning breadcrumb struct", () => {
                // Cluster 48 (GeneralCommissioning), attribute 1 (BasicCommissioningInfo)
                // BasicCommissioningInfoStruct has: 0 = failSafeExpiryLengthSeconds, 1 = maxCumulativeFailsafeSeconds
                const gcCluster = ClusterMap[48]!;
                const basicCommInfoAttr = gcCluster.attributes[1];

                const tagBasedValue = { "0": 60, "1": 900 };
                const result = convertWebSocketTagBasedToMatter(tagBasedValue, basicCommInfoAttr, gcCluster.model);

                expect(result).to.deep.equal({ failSafeExpiryLengthSeconds: 60, maxCumulativeFailsafeSeconds: 900 });
            });

            it("should preserve unknown keys in structs", () => {
                const descriptorCluster = ClusterMap[29]!;
                const deviceTypeListAttr = descriptorCluster.attributes[0]!;
                const deviceTypeStructModel = deviceTypeListAttr.members[0];

                const tagBasedValue = { "0": 22, "1": 1, "254": 1 }; // 254 is fabricIndex, often added
                const result = convertWebSocketTagBasedToMatter(
                    tagBasedValue,
                    deviceTypeStructModel,
                    descriptorCluster.model,
                ) as Record<string, unknown>;

                expect(result.deviceType).to.equal(22);
                expect(result.revision).to.equal(1);
                // Unknown key 254 should be preserved as-is
                expect(result["254"]).to.equal(1);
            });
        });

        describe("lists", () => {
            it("should convert list of structs", () => {
                // Cluster 29 (Descriptor), attribute 0 (DeviceTypeList)
                const descriptorCluster = ClusterMap[29]!;
                const deviceTypeListAttr = descriptorCluster.attributes[0];

                const tagBasedValue = [
                    { "0": 22, "1": 1 },
                    { "0": 17, "1": 1 },
                ];
                const result = convertWebSocketTagBasedToMatter(
                    tagBasedValue,
                    deviceTypeListAttr,
                    descriptorCluster.model,
                );

                expect(result).to.deep.equal([
                    { deviceType: 22, revision: 1 },
                    { deviceType: 17, revision: 1 },
                ]);
            });

            it("should convert list of primitives", () => {
                // Cluster 29 (Descriptor), attribute 1 (ServerList) - list of ClusterIds
                const descriptorCluster = ClusterMap[29]!;
                const serverListAttr = descriptorCluster.attributes[1];

                const tagBasedValue = [29, 31, 40, 48];
                const result = convertWebSocketTagBasedToMatter(tagBasedValue, serverListAttr, descriptorCluster.model);

                expect(result).to.deep.equal([29, 31, 40, 48]);
            });

            it("should handle empty lists", () => {
                const descriptorCluster = ClusterMap[29]!;
                const serverListAttr = descriptorCluster.attributes[1];

                const result = convertWebSocketTagBasedToMatter([], serverListAttr, descriptorCluster.model);

                expect(result).to.deep.equal([]);
            });
        });

        describe("bytes", () => {
            it("should convert base64 string to Uint8Array", () => {
                // Cluster 49 (NetworkCommissioning), attribute 6 (LastNetworkId) is bytes
                const networkCommCluster = ClusterMap[49]!;
                const lastNetworkIdAttr = networkCommCluster.attributes[6];

                const base64Value = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
                const result = convertWebSocketTagBasedToMatter(
                    base64Value,
                    lastNetworkIdAttr,
                    networkCommCluster.model,
                );

                expect(result).to.be.instanceOf(Uint8Array);
                expect(result).to.deep.equal(new Uint8Array(32)); // 32 bytes of zeros
            });

            it("should handle non-zero byte arrays", () => {
                const networkCommCluster = ClusterMap[49]!;
                const lastNetworkIdAttr = networkCommCluster.attributes[6];

                // Base64 for [1, 2, 3, 4] padded to 32 bytes
                const value = Bytes.toBase64(
                    new Uint8Array([
                        1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    ]),
                );
                const result = convertWebSocketTagBasedToMatter(
                    value,
                    lastNetworkIdAttr,
                    networkCommCluster.model,
                ) as Uint8Array;

                expect(result).to.be.instanceOf(Uint8Array);
                expect(result[0]).to.equal(1);
                expect(result[1]).to.equal(2);
                expect(result[2]).to.equal(3);
                expect(result[3]).to.equal(4);
            });
        });

        describe("bitmaps", () => {
            it("should convert bitmap number to object with boolean flags", () => {
                // Cluster 49 (NetworkCommissioning), attribute 65532 (FeatureMap) is bitmap
                // Features: WiFiNetworkInterface=bit0, ThreadNetworkInterface=bit1, EthernetNetworkInterface=bit2
                const networkCommCluster = ClusterMap[49]!;
                const featureMapAttr = networkCommCluster.attributes[65532];

                // Value 4 = EthernetNetworkInterface (bit 2)
                const result = convertWebSocketTagBasedToMatter(4, featureMapAttr, networkCommCluster.model) as Record<
                    string,
                    boolean
                >;

                expect(result).to.be.an("object");
                expect(result.wiFiNetworkInterface).to.equal(false); // bit 0
                expect(result.threadNetworkInterface).to.equal(false); // bit 1
                expect(result.ethernetNetworkInterface).to.equal(true); // bit 2
            });

            it("should handle multiple bits set", () => {
                const networkCommCluster = ClusterMap[49]!;
                const featureMapAttr = networkCommCluster.attributes[65532];

                // Value 5 = WiFiNetworkInterface (bit 0) + EthernetNetworkInterface (bit 2)
                const result = convertWebSocketTagBasedToMatter(5, featureMapAttr, networkCommCluster.model) as Record<
                    string,
                    boolean
                >;

                expect(result).to.be.an("object");
                expect(result.wiFiNetworkInterface).to.equal(true); // bit 0
                expect(result.threadNetworkInterface).to.equal(false); // bit 1
                expect(result.ethernetNetworkInterface).to.equal(true); // bit 2
            });

            it("should handle zero bitmap value", () => {
                const networkCommCluster = ClusterMap[49]!;
                const featureMapAttr = networkCommCluster.attributes[65532];

                const result = convertWebSocketTagBasedToMatter(0, featureMapAttr, networkCommCluster.model) as Record<
                    string,
                    boolean
                >;

                expect(result).to.be.an("object");
                expect(result.wiFiNetworkInterface).to.equal(false);
                expect(result.threadNetworkInterface).to.equal(false);
                expect(result.ethernetNetworkInterface).to.equal(false);
            });
        });
    });

    describe("round-trip conversion", () => {
        it("should round-trip struct correctly", () => {
            const descriptorCluster = ClusterMap[29]!;
            const deviceTypeListAttr = descriptorCluster.attributes[0]!;
            const deviceTypeStructModel = deviceTypeListAttr.members[0];

            const original = { deviceType: 256, revision: 2 };
            const tagBased = convertMatterToWebSocketTagBased(original, deviceTypeStructModel, descriptorCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(
                tagBased,
                deviceTypeStructModel,
                descriptorCluster.model,
            );

            expect(roundTripped).to.deep.equal(original);
        });

        it("should round-trip list of structs correctly", () => {
            const descriptorCluster = ClusterMap[29]!;
            const deviceTypeListAttr = descriptorCluster.attributes[0];

            const original = [
                { deviceType: 22, revision: 1 },
                { deviceType: 17, revision: 1 },
                { deviceType: 256, revision: 2 },
            ];
            const tagBased = convertMatterToWebSocketTagBased(original, deviceTypeListAttr, descriptorCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(
                tagBased,
                deviceTypeListAttr,
                descriptorCluster.model,
            );

            expect(roundTripped).to.deep.equal(original);
        });

        it("should round-trip bytes correctly", () => {
            const networkCommCluster = ClusterMap[49]!;
            const lastNetworkIdAttr = networkCommCluster.attributes[6];

            const original = new Uint8Array([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
                29, 30, 31, 32,
            ]);
            const tagBased = convertMatterToWebSocketTagBased(original, lastNetworkIdAttr, networkCommCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(
                tagBased,
                lastNetworkIdAttr,
                networkCommCluster.model,
            );

            expect(roundTripped).to.be.instanceOf(Uint8Array);
            expect(roundTripped).to.deep.equal(original);
        });

        it("should round-trip primitives correctly", () => {
            const basicInfoCluster = ClusterMap[40]!;
            const vendorNameAttr = basicInfoCluster.attributes[1];

            const original = "Test Vendor Name";
            const tagBased = convertMatterToWebSocketTagBased(original, vendorNameAttr, basicInfoCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(tagBased, vendorNameAttr, basicInfoCluster.model);

            expect(roundTripped).to.equal(original);
        });

        it("should round-trip boolean correctly", () => {
            const onOffCluster = ClusterMap[6]!;
            const onOffAttr = onOffCluster.attributes[0];

            const original = true;
            const tagBased = convertMatterToWebSocketTagBased(original, onOffAttr, onOffCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(tagBased, onOffAttr, onOffCluster.model);

            expect(roundTripped).to.equal(original);
        });

        it("should round-trip list of primitives correctly", () => {
            const descriptorCluster = ClusterMap[29]!;
            const serverListAttr = descriptorCluster.attributes[1];

            const original = [3, 4, 6, 8, 29, 30, 64];
            const tagBased = convertMatterToWebSocketTagBased(original, serverListAttr, descriptorCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(tagBased, serverListAttr, descriptorCluster.model);

            expect(roundTripped).to.deep.equal(original);
        });

        it("should round-trip nested struct (BasicCommissioningInfo) correctly", () => {
            const gcCluster = ClusterMap[48]!;
            const basicCommInfoAttr = gcCluster.attributes[1];

            const original = { failSafeExpiryLengthSeconds: 60, maxCumulativeFailsafeSeconds: 900 };
            const tagBased = convertMatterToWebSocketTagBased(original, basicCommInfoAttr, gcCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(tagBased, basicCommInfoAttr, gcCluster.model);

            expect(roundTripped).to.deep.equal(original);
        });

        it("should round-trip label list correctly", () => {
            const userLabelCluster = ClusterMap[64]!;
            const labelListAttr = userLabelCluster.attributes[0];

            const original = [
                { label: "room", value: "Wohnzimmer" },
                { label: "orientation", value: "Tisch" },
                { label: "floor", value: "EG" },
            ];
            const tagBased = convertMatterToWebSocketTagBased(original, labelListAttr, userLabelCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(tagBased, labelListAttr, userLabelCluster.model);

            expect(roundTripped).to.deep.equal(original);
        });

        it("should round-trip bitmap correctly", () => {
            const networkCommCluster = ClusterMap[49]!;
            const featureMapAttr = networkCommCluster.attributes[65532];

            // Features: wiFiNetworkInterface=bit0, threadNetworkInterface=bit1, ethernetNetworkInterface=bit2
            const original = {
                wiFiNetworkInterface: true,
                threadNetworkInterface: false,
                ethernetNetworkInterface: false,
            };
            const tagBased = convertMatterToWebSocketTagBased(original, featureMapAttr, networkCommCluster.model);
            const roundTripped = convertWebSocketTagBasedToMatter(tagBased, featureMapAttr, networkCommCluster.model);

            // Bitmap round-trip: the conversion to number and back includes all bitmap flags
            expect((roundTripped as Record<string, boolean>).wiFiNetworkInterface).to.equal(true);
            expect((roundTripped as Record<string, boolean>).threadNetworkInterface).to.equal(false);
            expect((roundTripped as Record<string, boolean>).ethernetNetworkInterface).to.equal(false);
        });
    });

    describe("convertMatterToWebSocketTagBased validation", () => {
        it("should convert struct to tag-based format", () => {
            const descriptorCluster = ClusterMap[29]!;
            const deviceTypeListAttr = descriptorCluster.attributes[0]!;
            const deviceTypeStructModel = deviceTypeListAttr.members[0];

            const original = { deviceType: 256, revision: 2 };
            const result = convertMatterToWebSocketTagBased(original, deviceTypeStructModel, descriptorCluster.model);

            expect(result).to.deep.equal({ "0": 256, "1": 2 });
        });

        it("should convert bytes to base64", () => {
            const networkCommCluster = ClusterMap[49]!;
            const lastNetworkIdAttr = networkCommCluster.attributes[6];

            const original = new Uint8Array([
                1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ]);
            const result = convertMatterToWebSocketTagBased(original, lastNetworkIdAttr, networkCommCluster.model);

            expect(result).to.be.a("string");
            expect(result).to.equal(Bytes.toBase64(original));
        });

        it("should convert list to tag-based format", () => {
            const descriptorCluster = ClusterMap[29]!;
            const deviceTypeListAttr = descriptorCluster.attributes[0];

            const original = [
                { deviceType: 22, revision: 1 },
                { deviceType: 17, revision: 1 },
            ];
            const result = convertMatterToWebSocketTagBased(original, deviceTypeListAttr, descriptorCluster.model);

            expect(result).to.deep.equal([
                { "0": 22, "1": 1 },
                { "0": 17, "1": 1 },
            ]);
        });
    });

    describe("toBigIntAwareJson", () => {
        it("should stringify objects with small numbers", () => {
            const obj = { node_id: 123, name: "test" };
            const result = toBigIntAwareJson(obj);
            expect(result).to.equal('{"node_id":123,"name":"test"}');
        });

        it("should handle BigInt values within safe integer range", () => {
            const obj = { node_id: BigInt(123) };
            const result = toBigIntAwareJson(obj);
            expect(result).to.equal('{"node_id":123}');
        });

        it("should handle BigInt values exceeding safe integer range", () => {
            const largeNumber = BigInt("18446744069414584320"); // 0xFFFF_FFFE_0000_0000
            const obj = { node_id: largeNumber };
            const result = toBigIntAwareJson(obj);
            // Should output the raw decimal number (not quoted)
            expect(result).to.equal('{"node_id":18446744069414584320}');
        });

        it("should handle multiple large BigInt values", () => {
            const obj = {
                node_id: BigInt("18446744069414584321"),
                fabric_id: BigInt("18446744073709551615"), // max uint64
            };
            const result = toBigIntAwareJson(obj);
            expect(result).to.include("18446744069414584321");
            expect(result).to.include("18446744073709551615");
        });

        it("should handle nested objects with BigInt", () => {
            const obj = {
                data: {
                    node_id: BigInt("18446744069414584320"),
                    name: "test",
                },
            };
            const result = toBigIntAwareJson(obj);
            expect(result).to.include("18446744069414584320");
        });

        it("should handle arrays with BigInt", () => {
            const obj = {
                nodes: [BigInt("18446744069414584320"), BigInt("18446744069414584321")],
            };
            const result = toBigIntAwareJson(obj);
            expect(result).to.include("18446744069414584320");
            expect(result).to.include("18446744069414584321");
        });
    });

    describe("parseBigIntAwareJson", () => {
        it("should parse objects with small numbers", () => {
            const json = '{"node_id":123,"name":"test"}';
            const result = parseBigIntAwareJson(json) as { node_id: number; name: string };
            expect(result.node_id).to.equal(123);
            expect(result.name).to.equal("test");
        });

        it("should parse objects with numbers within safe integer range", () => {
            const json = '{"node_id":9007199254740991}'; // MAX_SAFE_INTEGER
            const result = parseBigIntAwareJson(json) as { node_id: number };
            expect(result.node_id).to.equal(9007199254740991);
        });

        it("should convert large numbers to BigInt", () => {
            const json = '{"node_id":18446744069414584320}';
            const result = parseBigIntAwareJson(json) as { node_id: bigint };
            expect(typeof result.node_id).to.equal("bigint");
            expect(result.node_id).to.equal(BigInt("18446744069414584320"));
        });

        it("should handle multiple large numbers", () => {
            const json = '{"node_id":18446744069414584321,"fabric_id":18446744073709551615}';
            const result = parseBigIntAwareJson(json) as { node_id: bigint; fabric_id: bigint };
            expect(typeof result.node_id).to.equal("bigint");
            expect(typeof result.fabric_id).to.equal("bigint");
            expect(result.node_id).to.equal(BigInt("18446744069414584321"));
            expect(result.fabric_id).to.equal(BigInt("18446744073709551615"));
        });

        it("should handle nested objects with large numbers", () => {
            const json = '{"data":{"node_id":18446744069414584320,"name":"test"}}';
            const result = parseBigIntAwareJson(json) as { data: { node_id: bigint; name: string } };
            expect(typeof result.data.node_id).to.equal("bigint");
            expect(result.data.node_id).to.equal(BigInt("18446744069414584320"));
            expect(result.data.name).to.equal("test");
        });

        it("should handle arrays with large numbers", () => {
            const json = '{"nodes":[18446744069414584320,18446744069414584321]}';
            const result = parseBigIntAwareJson(json) as { nodes: bigint[] };
            expect(result.nodes).to.have.length(2);
            expect(typeof result.nodes[0]).to.equal("bigint");
            expect(typeof result.nodes[1]).to.equal("bigint");
            expect(result.nodes[0]).to.equal(BigInt("18446744069414584320"));
            expect(result.nodes[1]).to.equal(BigInt("18446744069414584321"));
        });

        it("should preserve small numbers as numbers", () => {
            const json = '{"small":123,"large":18446744069414584320}';
            const result = parseBigIntAwareJson(json) as { small: number; large: bigint };
            expect(typeof result.small).to.equal("number");
            expect(typeof result.large).to.equal("bigint");
            expect(result.small).to.equal(123);
            expect(result.large).to.equal(BigInt("18446744069414584320"));
        });

        it("should handle whitespace around large numbers", () => {
            const json = '{ "node_id": 18446744069414584320 }';
            const result = parseBigIntAwareJson(json) as { node_id: bigint };
            expect(typeof result.node_id).to.equal("bigint");
            expect(result.node_id).to.equal(BigInt("18446744069414584320"));
        });

        it("should NOT convert large numbers inside string values", () => {
            // This is the critical bug: numbers inside strings should remain as part of the string
            const json = '{"dump":"compressed_fabric_id: 18258567453835851999"}';
            const result = parseBigIntAwareJson(json) as { dump: string };
            expect(typeof result.dump).to.equal("string");
            expect(result.dump).to.equal("compressed_fabric_id: 18258567453835851999");
        });

        it("should handle nested JSON strings with large numbers", () => {
            // Real-world case: JSON inside a string field (like diagnostic dumps)
            const innerJson = '{ "fabric_id": 18258567453835851999 }';
            const outerJson = JSON.stringify({ dump: innerJson });
            const result = parseBigIntAwareJson(outerJson) as { dump: string };
            expect(typeof result.dump).to.equal("string");
            // The inner JSON string should be preserved exactly
            expect(result.dump).to.equal(innerJson);
        });

        it("should handle mixed: large numbers in strings AND as actual values", () => {
            const json = '{"dump":"id: 18258567453835851999","actual_id":18446744069414584320}';
            const result = parseBigIntAwareJson(json) as { dump: string; actual_id: bigint };
            // String should be unchanged
            expect(typeof result.dump).to.equal("string");
            expect(result.dump).to.equal("id: 18258567453835851999");
            // Actual number should be BigInt
            expect(typeof result.actual_id).to.equal("bigint");
            expect(result.actual_id).to.equal(BigInt("18446744069414584320"));
        });

        it("should handle large numbers in arrays inside strings", () => {
            const json = '{"dump":"[18258567453835851999, 12345678901234567890]"}';
            const result = parseBigIntAwareJson(json) as { dump: string };
            expect(typeof result.dump).to.equal("string");
            expect(result.dump).to.equal("[18258567453835851999, 12345678901234567890]");
        });

        it("should handle escaped quotes in strings", () => {
            const json = '{"msg":"value with \\"quote\\" and number: 18258567453835851999"}';
            const result = parseBigIntAwareJson(json) as { msg: string };
            expect(typeof result.msg).to.equal("string");
            expect(result.msg).to.equal('value with "quote" and number: 18258567453835851999');
        });

        it("should handle negative large numbers", () => {
            const json = '{"value":-18446744069414584320}';
            const result = parseBigIntAwareJson(json) as { value: bigint };
            expect(typeof result.value).to.equal("bigint");
            expect(result.value).to.equal(BigInt("-18446744069414584320"));
        });

        it("should handle negative large numbers in arrays", () => {
            const json = '{"values":[-18446744069414584320, 18446744069414584321]}';
            const result = parseBigIntAwareJson(json) as { values: bigint[] };
            expect(result.values).to.have.length(2);
            expect(result.values[0]).to.equal(BigInt("-18446744069414584320"));
            expect(result.values[1]).to.equal(BigInt("18446744069414584321"));
        });

        it("should NOT convert negative large numbers inside strings", () => {
            const json = '{"dump":"value: -18258567453835851999"}';
            const result = parseBigIntAwareJson(json) as { dump: string };
            expect(typeof result.dump).to.equal("string");
            expect(result.dump).to.equal("value: -18258567453835851999");
        });

        it("should handle floating point numbers", () => {
            const json = '{"value":3.14159}';
            const result = parseBigIntAwareJson(json) as { value: number };
            expect(typeof result.value).to.equal("number");
            expect(result.value).to.equal(3.14159);
        });

        it("should handle negative floating point numbers", () => {
            const json = '{"value":-123.456}';
            const result = parseBigIntAwareJson(json) as { value: number };
            expect(typeof result.value).to.equal("number");
            expect(result.value).to.equal(-123.456);
        });

        it("should handle numbers with exponents", () => {
            const json = '{"value":1.5e10}';
            const result = parseBigIntAwareJson(json) as { value: number };
            expect(typeof result.value).to.equal("number");
            expect(result.value).to.equal(1.5e10);
        });

        it("should handle numbers with negative exponents", () => {
            const json = '{"value":1E-5}';
            const result = parseBigIntAwareJson(json) as { value: number };
            expect(typeof result.value).to.equal("number");
            expect(result.value).to.equal(1e-5);
        });

        it("should handle mixed integers and floats", () => {
            const json = '{"int":18446744069414584320,"float":3.14}';
            const result = parseBigIntAwareJson(json) as { int: bigint; float: number };
            expect(typeof result.int).to.equal("bigint");
            expect(result.int).to.equal(BigInt("18446744069414584320"));
            expect(typeof result.float).to.equal("number");
            expect(result.float).to.equal(3.14);
        });
    });

    describe("toBigIntAwareJson and parseBigIntAwareJson round-trip", () => {
        it("should round-trip object with large BigInt", () => {
            const original = { node_id: BigInt("18446744069414584320") };
            const json = toBigIntAwareJson(original);
            const parsed = parseBigIntAwareJson(json) as { node_id: bigint };
            expect(parsed.node_id).to.equal(original.node_id);
        });

        it("should round-trip object with multiple BigInt values", () => {
            const original = {
                node_id: BigInt("18446744069414584320"),
                fabric_id: BigInt("18446744073709551615"),
                small_id: BigInt(123),
            };
            const json = toBigIntAwareJson(original);
            const parsed = parseBigIntAwareJson(json) as typeof original;
            expect(parsed.node_id).to.equal(original.node_id);
            expect(parsed.fabric_id).to.equal(original.fabric_id);
            // Small BigInt is converted to number during stringify, stays as number
            expect(parsed.small_id).to.equal(123);
        });

        it("should round-trip complex nested object", () => {
            const original = {
                message_id: "test-123",
                result: {
                    node_id: BigInt("18446744069414584320"),
                    available: true,
                    attributes: {
                        "0/29/0": [{ "0": 22, "1": 1 }],
                    },
                },
            };
            const json = toBigIntAwareJson(original);
            const parsed = parseBigIntAwareJson(json) as typeof original;
            expect(parsed.message_id).to.equal("test-123");
            expect(parsed.result.node_id).to.equal(original.result.node_id);
            expect(parsed.result.available).to.equal(true);
            expect(parsed.result.attributes["0/29/0"]).to.deep.equal([{ "0": 22, "1": 1 }]);
        });
    });

    describe("splitAttributePath", () => {
        it("should split fully specified path", () => {
            const result = splitAttributePath("0/40/1");
            expect(result.endpointId).to.equal(0);
            expect(result.clusterId).to.equal(40);
            expect(result.attributeId).to.equal(1);
        });

        it("should handle wildcard in attribute position", () => {
            const result = splitAttributePath("0/40/*");
            expect(result.endpointId).to.equal(0);
            expect(result.clusterId).to.equal(40);
            expect(result.attributeId).to.be.undefined;
        });

        it("should handle wildcard in cluster position", () => {
            const result = splitAttributePath("0/*/5");
            expect(result.endpointId).to.equal(0);
            expect(result.clusterId).to.be.undefined;
            expect(result.attributeId).to.equal(5);
        });

        it("should handle wildcard in endpoint position", () => {
            const result = splitAttributePath("*/40/1");
            expect(result.endpointId).to.be.undefined;
            expect(result.clusterId).to.equal(40);
            expect(result.attributeId).to.equal(1);
        });

        it("should handle all wildcards", () => {
            const result = splitAttributePath("*/*/*");
            expect(result.endpointId).to.be.undefined;
            expect(result.clusterId).to.be.undefined;
            expect(result.attributeId).to.be.undefined;
        });

        it("should handle multiple wildcards", () => {
            const result = splitAttributePath("*/40/*");
            expect(result.endpointId).to.be.undefined;
            expect(result.clusterId).to.equal(40);
            expect(result.attributeId).to.be.undefined;
        });
    });
});
