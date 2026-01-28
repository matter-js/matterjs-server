/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    computeServerId,
    ConfigStorage,
    DEFAULT_SERVER_ID,
    Environment,
    resolveServerId,
    storageExists,
} from "@matter-server/ws-controller";
import { StorageService } from "@matter/general";
import { StorageFactory, StorageType } from "@matter/nodejs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("ServerIdResolver", () => {
    let testDir: string;

    before(async () => {
        testDir = join(tmpdir(), `server-id-resolver-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    after(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    describe("computeServerId", () => {
        it("should compute server ID with lowercase hex values", () => {
            const result = computeServerId(1, 0xfff1);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-1-fff1`);
        });

        it("should handle larger fabric IDs", () => {
            const result = computeServerId(0x1234, 0xabcd);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-1234-abcd`);
        });

        it("should handle bigint fabric IDs", () => {
            const result = computeServerId(BigInt(255), 0x100);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-ff-100`);
        });

        it("should produce consistent format", () => {
            // Verify the format is "<DEFAULT_SERVER_ID>-<fabricId>-<vendorId>" in hex
            const result = computeServerId(16, 256);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-10-100`);
        });
    });

    describe("storageExists", () => {
        it("should return false for undefined storage path", async () => {
            const result = await storageExists(undefined, DEFAULT_SERVER_ID);
            expect(result).to.be.false;
        });

        it("should return false for non-existent directory", async () => {
            const result = await storageExists(testDir, "nonexistent-server");
            expect(result).to.be.false;
        });

        it("should return true for existing directory", async () => {
            const serverDir = join(testDir, "existing-server");
            await mkdir(serverDir, { recursive: true });

            const result = await storageExists(testDir, "existing-server");
            expect(result).to.be.true;
        });

        it("should return true for existing file (not just directories)", async () => {
            // While we expect directories, the function uses access() which works for files too
            await writeFile(join(testDir, "server-file"), "test");

            const result = await storageExists(testDir, "server-file");
            expect(result).to.be.true;
        });
    });

    describe("computeServerId edge cases", () => {
        it("should handle vendorId of 0", () => {
            const result = computeServerId(1, 0);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-1-0`);
        });

        it("should handle fabricId of 0", () => {
            const result = computeServerId(0, 1);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-0-1`);
        });

        it("should handle maximum safe integer fabricId", () => {
            // Test with a large but safe integer
            const result = computeServerId(0xffffffffff, 0xffff);
            expect(result).to.equal(`${DEFAULT_SERVER_ID}-ffffffffff-ffff`);
        });
    });

    describe("resolveServerId", () => {
        const TEST_FABRIC_ID = 1;
        const TEST_VENDOR_ID = 0xfff1;
        let resolveTestDir: string;
        let env: Environment;
        let config: ConfigStorage;

        beforeEach(async () => {
            // Create a fresh test directory for each test
            resolveTestDir = join(testDir, `resolve-${Date.now()}`);
            await mkdir(resolveTestDir, { recursive: true });

            // Create environment with storage path
            env = new Environment("test");
            env.vars.set("storage.path", resolveTestDir);

            // Set up StorageService with a factory for file-based storage
            const storageService = new StorageService(env);
            storageService.factory = namespace =>
                StorageFactory.create({
                    driver: StorageType.FILE,
                    rootDir: resolveTestDir,
                    namespace,
                });
            storageService.location = resolveTestDir;

            // Create ConfigStorage
            config = await ConfigStorage.create(env);
        });

        afterEach(async () => {
            await config?.close();
        });

        it("should use provided serverId when not default", async () => {
            const customId = "custom-server-id";
            const result = await resolveServerId(env, config, { serverId: customId }, TEST_VENDOR_ID, TEST_FABRIC_ID);
            expect(result).to.equal(customId);
        });

        it("should use default when no fabric config provided", async () => {
            const result = await resolveServerId(env, config, {}, undefined, undefined);
            expect(result).to.equal(DEFAULT_SERVER_ID);
        });

        it("should use new format directory if it already exists", async () => {
            const expectedId = computeServerId(TEST_FABRIC_ID, TEST_VENDOR_ID);

            // Create the new format directory
            await mkdir(join(resolveTestDir, expectedId), { recursive: true });

            const result = await resolveServerId(env, config, {}, TEST_VENDOR_ID, TEST_FABRIC_ID);
            expect(result).to.equal(expectedId);
        });

        it("should rename server directory to new format when fabric matches", async () => {
            const expectedId = computeServerId(TEST_FABRIC_ID, TEST_VENDOR_ID);

            // Create "server" directory with matching fabric data
            const serverDir = join(resolveTestDir, DEFAULT_SERVER_ID);
            await mkdir(serverDir, { recursive: true });

            // Write fabrics.fabrics file with matching fabric config
            // FabricId is a BigInt, so we need to encode it using Matter.js storage format
            const fabricsData = [
                {
                    fabricId: `{"__object__":"BigInt","__value__":"${TEST_FABRIC_ID}"}`,
                    rootVendorId: TEST_VENDOR_ID,
                },
            ];
            await writeFile(join(serverDir, "fabrics.fabrics"), JSON.stringify(fabricsData));

            const result = await resolveServerId(env, config, {}, TEST_VENDOR_ID, TEST_FABRIC_ID);
            expect(result).to.equal(expectedId);

            // Verify the directory was renamed
            await expect(access(join(resolveTestDir, expectedId))).to.not.be.rejected;
            await expect(access(join(resolveTestDir, DEFAULT_SERVER_ID))).to.be.rejected;
        });

        it("should use new format when server directory has non-matching fabric", async () => {
            const expectedId = computeServerId(TEST_FABRIC_ID, TEST_VENDOR_ID);

            // Create "server" directory with different fabric data
            const serverDir = join(resolveTestDir, DEFAULT_SERVER_ID);
            await mkdir(serverDir, { recursive: true });

            // Write fabrics.fabrics file with different fabric config
            // FabricId is a BigInt, so we need to encode it using Matter.js storage format
            const fabricsData = [
                {
                    fabricId: `{"__object__":"BigInt","__value__":"999"}`,
                    rootVendorId: 0x1234,
                },
            ];
            await writeFile(join(serverDir, "fabrics.fabrics"), JSON.stringify(fabricsData));

            const result = await resolveServerId(env, config, {}, TEST_VENDOR_ID, TEST_FABRIC_ID);
            expect(result).to.equal(expectedId);

            // Verify the original directory still exists (not renamed)
            await expect(access(join(resolveTestDir, DEFAULT_SERVER_ID))).to.not.be.rejected;
        });

        it("should use new format for new installation", async () => {
            // No existing directories
            const expectedId = computeServerId(TEST_FABRIC_ID, TEST_VENDOR_ID);

            const result = await resolveServerId(env, config, {}, TEST_VENDOR_ID, TEST_FABRIC_ID);
            expect(result).to.equal(expectedId);
        });
    });
});
