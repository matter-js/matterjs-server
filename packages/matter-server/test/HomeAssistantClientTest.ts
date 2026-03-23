/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { HomeAssistantClient, type HaDevice } from "@matter-server/ws-controller";

function makeDevice(
    id: string,
    name: string,
    nameByUser: string | null,
    identifiers: Array<[string, string]>,
): HaDevice {
    return { id, name, name_by_user: nameByUser, identifiers };
}

describe("HomeAssistantClient", () => {
    describe("matchDevicesToNodes", () => {
        const fabricId = 12345678901234567890n;
        const prefix = `deviceid_${fabricId}-`;

        it("should match devices by compressed_fabric_id and node_id", () => {
            const devices: HaDevice[] = [
                makeDevice("dev-1", "Kitchen Light", "My Kitchen", [["matter", `${prefix}1-1`]]),
                makeDevice("dev-2", "Bedroom Plug", null, [["matter", `${prefix}2-1`]]),
            ];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.size).to.equal(2);
            expect(matches.get("1")!.name).to.equal("My Kitchen");
            expect(matches.get("1")!.deviceId).to.equal("dev-1");
            expect(matches.get("2")!.name).to.equal("Bedroom Plug"); // Falls back to device name
        });

        it("should prefer endpoint 0 when multiple endpoints exist for same node", () => {
            const devices: HaDevice[] = [
                makeDevice("dev-ep1", "Light EP1", "EP1 Name", [["matter", `${prefix}1-1`]]),
                makeDevice("dev-ep0", "Light EP0", "EP0 Name", [["matter", `${prefix}1-0`]]),
                makeDevice("dev-ep2", "Light EP2", "EP2 Name", [["matter", `${prefix}1-2`]]),
            ];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.size).to.equal(1);
            expect(matches.get("1")!.deviceId).to.equal("dev-ep0");
            expect(matches.get("1")!.name).to.equal("EP0 Name");
        });

        it("should ignore devices from other domains", () => {
            const devices: HaDevice[] = [
                makeDevice("dev-zb", "Zigbee Device", null, [["zha", "00:11:22:33"]]),
                makeDevice("dev-m", "Matter Device", "My Device", [["matter", `${prefix}5-0`]]),
            ];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.size).to.equal(1);
            expect(matches.has("5")).to.be.true;
        });

        it("should ignore devices from different fabrics", () => {
            const otherFabric = 99999999999999999999n;
            const otherPrefix = `deviceid_${otherFabric}-`;
            const devices: HaDevice[] = [
                makeDevice("dev-other", "Other Fabric", null, [["matter", `${otherPrefix}1-0`]]),
                makeDevice("dev-ours", "Our Fabric", "Ours", [["matter", `${prefix}1-0`]]),
            ];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.size).to.equal(1);
            expect(matches.get("1")!.deviceId).to.equal("dev-ours");
        });

        it("should return empty map when no Matter devices exist", () => {
            const devices: HaDevice[] = [makeDevice("dev-1", "Non-Matter", null, [["zha", "addr"]])];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.size).to.equal(0);
        });

        it("should use name_by_user over default name", () => {
            const devices: HaDevice[] = [
                makeDevice("dev-1", "Default Name", "User Name", [["matter", `${prefix}1-0`]]),
            ];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.get("1")!.name).to.equal("User Name");
        });

        it("should fall back to default name when name_by_user is null", () => {
            const devices: HaDevice[] = [makeDevice("dev-1", "Default Name", null, [["matter", `${prefix}1-0`]])];

            const matches = HomeAssistantClient.matchDevicesToNodes(devices, fabricId);

            expect(matches.get("1")!.name).to.equal("Default Name");
        });
    });
});
