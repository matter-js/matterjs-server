/**
 * Test fixture: A minimal Matter OnOffLight device for integration testing.
 *
 * Usage: npx tsx test/fixtures/TestLightDevice.ts --storage-path=<path>
 */

import { Environment, ServerNode } from "@matter/main";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";
import { VendorId } from "@matter/main/types";

// Parse CLI args for storage path
const args = process.argv.slice(2);
const storagePathArg = args.find(a => a.startsWith("--storage-path="));
const storagePath = storagePathArg?.split("=")[1] ?? ".device-storage";

// Configure environment with storage path
const env = Environment.default;
env.vars.set("storage.path", storagePath);

// Create device with fixed pairing codes for test predictability
const node = await ServerNode.create({
    network: {
        port: 5540,
    },

    commissioning: {
        passcode: 20202021,
        discriminator: 3840,
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
});

// Add the OnOffLight endpoint
await node.add(OnOffLightDevice, {
    id: "light",
});

console.log("Test Light Device starting...");
console.log(`Storage path: ${storagePath}`);
console.log(`Manual pairing code: 34970112332`);
console.log(`QR pairing code: MT:Y.K9042C00KA0648G00`);

// Run the device
await node.run();

// Handle graceful shutdown
process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, shutting down...");
    await node.close();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("Received SIGINT, shutting down...");
    await node.close();
    process.exit(0);
});
