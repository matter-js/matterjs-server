/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test fixture: A minimal Matter OnOffLight device for integration testing.
 *
 * Usage: npx tsx test/fixtures/TestLightDevice.ts --storage-path=<path>
 */

import { Environment, ServerNode } from "@matter/main";
import { ThermostatServer } from "@matter/main/behaviors/thermostat";
import { UserLabelServer } from "@matter/main/behaviors/user-label";
import { Thermostat } from "@matter/main/clusters/thermostat";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";
import { ThermostatDevice } from "@matter/main/devices/thermostat";
import { VendorId } from "@matter/main/types";
import { DEVICE_DISCRIMINATOR, DEVICE_PASSCODE, DEVICE_PORT, MANUAL_PAIRING_CODE } from "../helpers/ProcessHelpers.js";

// Parse CLI args for storage path + listen port
const args = process.argv.slice(2);
const storagePathArg = args.find(a => a.startsWith("--storage-path="));
const storagePath = storagePathArg?.split("=")[1] ?? ".device-storage";
const portArg = args.find(a => a.startsWith("--port="));
const port = portArg !== undefined ? Number.parseInt(portArg.split("=")[1], 10) : DEVICE_PORT;

// Configure environment with storage path
const env = Environment.default;
env.vars.set("storage.path", storagePath);

// Create device with fixed pairing codes for test predictability
const node = await ServerNode.create({
    network: {
        port,
    },

    commissioning: {
        passcode: DEVICE_PASSCODE,
        discriminator: DEVICE_DISCRIMINATOR,
    },

    productDescription: {
        name: "Test Light",
        deviceType: OnOffLightDevice.deviceType,
    },

    basicInformation: {
        vendorName: "Test Vendor",
        vendorId: VendorId(0xfff1),
        productName: "Test Light",
        productId: 0x8000,
        serialNumber: "TEST-001",
        uniqueId: "test-light-unique-id",
    },

    subscriptions: {
        persistenceEnabled: false,
    },
});

// Add the OnOffLight endpoint; UserLabel provides a writable list-of-struct attribute for write tests
await node.add(OnOffLightDevice.with(UserLabelServer), {
    id: "light",
    userLabel: {
        labelList: [{ label: "room", value: "bedroom" }],
    },
});

// Its Presets attribute can only be written inside an atomic write (write_atomic_attribute).
await node.add(ThermostatDevice.with(ThermostatServer.with("Heating", "Cooling", "AutoMode", "Presets")), {
    id: "thermostat",
    thermostat: {
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingAndHeating,
        systemMode: Thermostat.SystemMode.Auto,
        occupiedHeatingSetpoint: 2000,
        occupiedCoolingSetpoint: 2600,
        minSetpointDeadBand: 25,
        numberOfPresets: 5,
        presetTypes: [
            { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 5, presetTypeFeatures: {} },
        ],
        activePresetHandle: null,
        presets: [],
    },
});

console.log("Test Light Device starting...");
console.log(`Storage path: ${storagePath}`);
console.log(`Manual pairing code: ${MANUAL_PAIRING_CODE}`);

// Run the device
await node.run();

// Handle a graceful shutdown
process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down...");
    node.stop()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
});

process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down...");
    node.stop()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
});
