/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test fixture: a Matter bridge that combines the bridge topologies the server and the clients
 * have to tell apart - an aggregator that is not endpoint 1, a second aggregator, an aggregator
 * nested below another one, and a bridged device composed of further endpoints.
 *
 * Usage: npx tsx packages/matter-server/test/fixtures/TestBridgeDevice.ts --storage-path=<path> --port=<port>
 */

import { Environment, ServerNode } from "@matter/main";
import type { Endpoint } from "@matter/main";
import { BridgedDeviceBasicInformationServer } from "@matter/main/behaviors/bridged-device-basic-information";
import { HumiditySensorDevice } from "@matter/main/devices/humidity-sensor";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";
import { TemperatureSensorDevice } from "@matter/main/devices/temperature-sensor";
import { AggregatorEndpoint } from "@matter/main/endpoints/aggregator";
import { VendorId } from "@matter/main/types";

const args = process.argv.slice(2);

function numericArg(name: string, fallback: number): number {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    if (arg === undefined) {
        return fallback;
    }
    const raw = arg.slice(name.length + 3);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
        console.error(`--${name} must be a whole number, got "${raw}"`);
        process.exit(1);
    }
    return value;
}

const storagePathArg = args.find(a => a.startsWith("--storage-path="));
const storagePath = storagePathArg?.slice("--storage-path=".length) ?? ".bridge-device-storage";
const port = numericArg("port", 5542);
const discriminator = numericArg("discriminator", 3842);
const passcode = numericArg("passcode", 20202023);

const env = Environment.default;
env.vars.set("storage.path", storagePath);

const node = await ServerNode.create({
    network: { port },

    commissioning: {
        passcode,
        discriminator,
    },

    productDescription: {
        name: "Test Bridge",
        deviceType: AggregatorEndpoint.deviceType,
    },

    basicInformation: {
        vendorName: "Test Vendor",
        vendorId: VendorId(0xfff1),
        productName: "Test Bridge",
        productId: 0x8002,
        serialNumber: "TEST-BRIDGE-001",
        uniqueId: "test-bridge-unique-id",
    },

    subscriptions: {
        persistenceEnabled: false,
    },
});

const BridgedLight = OnOffLightDevice.with(BridgedDeviceBasicInformationServer);
const BridgedTemperatureSensor = TemperatureSensorDevice.with(BridgedDeviceBasicInformationServer);
const BridgedAggregator = AggregatorEndpoint.with(BridgedDeviceBasicInformationServer);

// A local device before any aggregator, so no aggregator sits on endpoint 1
await node.add(OnOffLightDevice, { id: "local-light", number: 1 });

const primaryAggregator = await node.add(AggregatorEndpoint, { id: "primary-aggregator", number: 2 });

await primaryAggregator.add(BridgedLight, {
    id: "bridged-light",
    number: 3,
    bridgedDeviceBasicInformation: {
        nodeLabel: "Bridged Light",
        serialNumber: "BRIDGED-LIGHT-1",
        uniqueId: "bridged-light-1",
        reachable: true,
    },
});

const composedDevice = await primaryAggregator.add(BridgedTemperatureSensor, {
    id: "composed-sensor",
    number: 4,
    bridgedDeviceBasicInformation: {
        nodeLabel: "Composed Sensor",
        serialNumber: "COMPOSED-SENSOR-1",
        uniqueId: "composed-sensor-1",
        reachable: true,
    },
});
await composedDevice.add(TemperatureSensorDevice, { id: "composed-temperature", number: 5 });
await composedDevice.add(HumiditySensorDevice, { id: "composed-humidity", number: 6 });

const nestedAggregator = await primaryAggregator.add(BridgedAggregator, {
    id: "nested-aggregator",
    number: 7,
    bridgedDeviceBasicInformation: {
        nodeLabel: "Nested Aggregator",
        serialNumber: "NESTED-AGGREGATOR-1",
        uniqueId: "nested-aggregator-1",
        reachable: true,
    },
});
await nestedAggregator.add(BridgedLight, {
    id: "nested-light",
    number: 8,
    bridgedDeviceBasicInformation: {
        nodeLabel: "Nested Light",
        serialNumber: "NESTED-LIGHT-1",
        uniqueId: "nested-light-1",
        reachable: true,
    },
});
await nestedAggregator.add(BridgedTemperatureSensor, {
    id: "nested-sensor",
    number: 9,
    bridgedDeviceBasicInformation: {
        nodeLabel: "Nested Sensor",
        serialNumber: "NESTED-SENSOR-1",
        uniqueId: "nested-sensor-1",
        reachable: true,
    },
});

// Bridges exist that do not tag the children of a nested aggregator as bridged nodes
await nestedAggregator.add(OnOffLightDevice, { id: "nested-untagged-light", number: 10 });
await nestedAggregator.add(OnOffLightDevice, { id: "nested-untagged-light-2", number: 11 });

const secondaryAggregator = await node.add(AggregatorEndpoint, { id: "secondary-aggregator", number: 12 });
await secondaryAggregator.add(BridgedLight, {
    id: "secondary-light",
    number: 13,
    bridgedDeviceBasicInformation: {
        nodeLabel: "Secondary Light",
        serialNumber: "SECONDARY-LIGHT-1",
        uniqueId: "secondary-light-1",
        reachable: true,
    },
});

function describeEndpoint(endpoint: Endpoint): string {
    return `${endpoint.id}=${endpoint.number}`;
}

console.log("Test Bridge Device starting...");
console.log(`Storage path: ${storagePath}`);
console.log("Endpoints:", [...node.endpoints].map(describeEndpoint).join(" "));
console.log(`Manual pairing code: ${node.state.commissioning.pairingCodes.manualPairingCode}`);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
        node.cancel()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    });
}

await node.run();
