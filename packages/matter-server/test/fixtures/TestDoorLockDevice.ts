/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manual test fixture: A DoorLock device with User + PIN credentials + Week Day / Year Day
 * access schedules enabled, for exercising the dashboard's Door Lock panel.
 *
 * Usage: npx tsx packages/matter-server/test/fixtures/TestDoorLockDevice.ts --storage-path=<path> --port=<port>
 */

import { Environment, ServerNode } from "@matter/main";
import { DoorLockServer } from "@matter/main/behaviors/door-lock";
import { DoorLock } from "@matter/main/clusters/door-lock";
import { DoorLockDevice } from "@matter/main/devices/door-lock";
import { VendorId } from "@matter/main/types";

const args = process.argv.slice(2);

function numericArg(name: string, fallback: number): number {
    const arg = args.find(candidate => candidate.startsWith(`--${name}=`));
    if (arg === undefined) return fallback;
    const raw = arg.slice(name.length + 3);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
        console.error(`--${name} must be a whole number, got "${raw}"`);
        process.exit(1);
    }
    return value;
}

const storagePathArg = args.find(a => a.startsWith("--storage-path="));
const storagePath = storagePathArg?.split("=")[1] ?? ".doorlock-device-storage";
const port = numericArg("port", 5541);
const discriminator = numericArg("discriminator", 3841);
const passcode = numericArg("passcode", 20202022);

const env = Environment.default;
env.vars.set("storage.path", storagePath);

const node = await ServerNode.create({
    network: { port },

    commissioning: {
        passcode,
        discriminator,
    },

    productDescription: {
        name: "Test Door Lock",
        deviceType: DoorLockDevice.deviceType,
    },

    basicInformation: {
        vendorName: "Test Vendor",
        vendorId: VendorId(0xfff1),
        productName: "Test Door Lock",
        productId: 0x8001,
        serialNumber: "TEST-DOORLOCK-001",
        uniqueId: "test-door-lock-unique-id",
    },

    subscriptions: {
        persistenceEnabled: false,
    },
});

const TestDoorLock = DoorLockDevice.with(
    DoorLockServer.with(
        "PinCredential",
        "CredentialOverTheAirAccess",
        "User",
        "WeekDayAccessSchedules",
        "YearDayAccessSchedules",
        "HolidaySchedules",
    ),
);

await node.add(TestDoorLock, {
    id: "doorlock",
    doorLock: {
        lockState: DoorLock.LockState.Locked,
        lockType: DoorLock.LockType.DeadBolt,
        actuatorEnabled: true,
        autoRelockTime: 0,
        operatingMode: DoorLock.OperatingMode.Normal,

        // PinCredential feature
        numberOfPinUsersSupported: 10,
        minPinCodeLength: 4,
        maxPinCodeLength: 10,
        wrongCodeEntryLimit: 5,
        userCodeTemporaryDisableTime: 60,
        requirePinForRemoteOperation: false,

        // User feature
        numberOfTotalUsersSupported: 10,
        numberOfCredentialsSupportedPerUser: 5,
        credentialRulesSupport: { single: true, dual: false, tri: false },

        // WeekDayAccessSchedules / YearDayAccessSchedules / HolidaySchedules features
        numberOfWeekDaySchedulesSupportedPerUser: 10,
        numberOfYearDaySchedulesSupportedPerUser: 10,
        numberOfHolidaySchedulesSupported: 5,
    },
});

console.log("Test Door Lock Device starting...");
console.log(`Storage path: ${storagePath}`);
console.log(`Discriminator: ${discriminator}`);
console.log(`Passcode: ${passcode}`);

// Registered before run(), which only resolves once the node has already stopped.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
        console.log(`Received ${signal}, shutting down...`);
        node.cancel()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    });
}

await node.run();
