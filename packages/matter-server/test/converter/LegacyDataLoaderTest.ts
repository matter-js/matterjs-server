import { computeCompressedNodeId, Crypto, Environment, LegacyServerFile } from "@matter-server/controller";
import { NodeJsCrypto } from "@matter/nodejs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChipConfigData, hasLegacyData, loadLegacyData, saveLegacyServerFile } from "../../src/converter/index.js";

// Path to test fixtures (relative to package root since tests run from build dir)
const FIXTURE_DIR = join(process.cwd(), "test/converter/fixtures");
const FIXTURE_CHIP_JSON = join(FIXTURE_DIR, "chip.json");
const FIXTURE_SERVER_JSON = join(FIXTURE_DIR, "server.json");

describe("LegacyDataLoader", () => {
    let testDir: string;
    let env: Environment;

    before(async () => {
        testDir = join(tmpdir(), `legacy-loader-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });

        // Create an environment with crypto support
        env = new Environment("test");
        env.set(Crypto, new NodeJsCrypto());
    });

    after(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    describe("hasLegacyData", () => {
        it("should return true when chip.json exists", async () => {
            const legacyDir = join(testDir, "has-legacy");
            await mkdir(legacyDir, { recursive: true });
            await writeFile(join(legacyDir, "chip.json"), "{}");

            const result = await hasLegacyData(legacyDir);
            expect(result).to.be.true;
        });

        it("should return false when chip.json does not exist", async () => {
            const emptyDir = join(testDir, "no-legacy");
            await mkdir(emptyDir, { recursive: true });

            const result = await hasLegacyData(emptyDir);
            expect(result).to.be.false;
        });

        it("should return false for non-existent directory", async () => {
            const result = await hasLegacyData(join(testDir, "nonexistent"));
            expect(result).to.be.false;
        });
    });

    describe("loadLegacyData", () => {
        it("should return hasData=false for non-existent directory", async () => {
            const result = await loadLegacyData(env, join(testDir, "nonexistent"));
            expect(result.hasData).to.be.false;
            expect(result.chipConfig).to.be.undefined;
            expect(result.error).to.be.undefined;
        });

        it("should return hasData=false for directory without chip.json", async () => {
            const emptyDir = join(testDir, "empty-storage");
            await mkdir(emptyDir, { recursive: true });

            const result = await loadLegacyData(env, emptyDir);
            expect(result.hasData).to.be.false;
            expect(result.chipConfig).to.be.undefined;
        });

        it("should load chip.json and extract fabric config", async () => {
            const legacyDir = join(testDir, "chip-only");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            const result = await loadLegacyData(env, legacyDir);

            expect(result.hasData).to.be.true;
            expect(result.chipConfig).to.exist;
            expect(result.fabricConfig).to.exist;
            expect(result.fabricConfig!.fabricIndex).to.equal(1);
            expect(result.error).to.be.undefined;
        });

        it("should load operational credentials from chip.json", async () => {
            const legacyDir = join(testDir, "with-opcreds");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            const result = await loadLegacyData(env, legacyDir);

            expect(result.operationalCredentials).to.exist;
            expect(result.operationalCredentials!.rootCaKey).to.exist;
            expect(result.operationalCredentials!.rootCaCert).to.exist;
            expect(result.certificateAuthorityConfig).to.exist;
            expect(result.certificateAuthorityConfig!.rootCertId).to.be.a("bigint");
        });

        it("should load server file when present with correct name", async () => {
            const legacyDir = join(testDir, "with-server");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            // Load chip.json to compute the correct server file name
            const chipConfig = new ChipConfigData();
            await chipConfig.load(join(legacyDir, "chip.json"));
            const fabricConfig = chipConfig.getFabricConfig(1);
            expect(fabricConfig).to.exist;

            const crypto = env.get(Crypto);
            const compressedFabricId = await computeCompressedNodeId(
                crypto,
                fabricConfig!.fabricId,
                fabricConfig!.rootPublicKey,
            );
            const serverFileName = `${compressedFabricId}.json`;

            // Copy server fixture to the computed name
            await copyFile(FIXTURE_SERVER_JSON, join(legacyDir, serverFileName));

            const result = await loadLegacyData(env, legacyDir);

            expect(result.hasData).to.be.true;
            expect(result.serverFile).to.exist;
            expect(result.serverFile!.last_node_id).to.equal(7);
            expect(Object.keys(result.serverFile!.nodes)).to.have.lengthOf(3);
            expect(result.serverFile!.nodes["4"]).to.exist;
            expect(result.serverFile!.nodes["4"].node_id).to.equal(4);
            expect(result.serverFile!.nodes["5"].is_bridge).to.be.true;
        });

        it("should still succeed when server file is missing", async () => {
            const legacyDir = join(testDir, "no-server");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            const result = await loadLegacyData(env, legacyDir);

            expect(result.hasData).to.be.true;
            expect(result.fabricConfig).to.exist;
            expect(result.serverFile).to.be.undefined;
            expect(result.error).to.be.undefined;
        });

        it("should return error for multiple fabrics", async () => {
            const legacyDir = join(testDir, "multi-fabric");
            await mkdir(legacyDir, { recursive: true });

            // Create chip.json with multiple fabrics
            await writeFile(
                join(legacyDir, "chip.json"),
                JSON.stringify({
                    "sdk-config": {
                        "f/1/n": "dGVzdA==",
                        "f/2/n": "dGVzdA==",
                    },
                }),
            );

            const result = await loadLegacyData(env, legacyDir);

            expect(result.hasData).to.be.false;
            expect(result.error).to.include("Expected exactly one fabric with index 1");
        });

        it("should return error for wrong fabric index", async () => {
            const legacyDir = join(testDir, "wrong-fabric");
            await mkdir(legacyDir, { recursive: true });

            // Create chip.json with fabric index 2 only
            await writeFile(
                join(legacyDir, "chip.json"),
                JSON.stringify({
                    "sdk-config": {
                        "f/2/n": "dGVzdA==",
                    },
                }),
            );

            const result = await loadLegacyData(env, legacyDir);

            expect(result.hasData).to.be.false;
            expect(result.error).to.include("Expected exactly one fabric with index 1");
        });
    });

    describe("saveLegacyServerFile", () => {
        it("should save server file with correct name", async () => {
            const legacyDir = join(testDir, "save-test");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            // Load chip.json to get fabric config
            const chipConfig = new ChipConfigData();
            await chipConfig.load(join(legacyDir, "chip.json"));
            const fabricConfig = chipConfig.getFabricConfig(1);
            expect(fabricConfig).to.exist;

            // Create a server file to save
            const serverFile: LegacyServerFile = {
                vendor_info: {
                    "1234": {
                        vendor_id: 1234,
                        vendor_name: "Saved Vendor",
                        company_legal_name: "Saved Company",
                        company_preferred_name: "SavedCo",
                        vendor_landing_page_url: "https://saved.example.com",
                        creator: "test",
                    },
                },
                last_node_id: 10,
                nodes: {
                    "8": {
                        node_id: 8,
                        date_commissioned: "2024-05-01T00:00:00.000000",
                        last_interview: "2024-06-01T00:00:00.000000",
                        interview_version: 6,
                        available: true,
                        is_bridge: false,
                        attributes: { "0/40/1": "Saved Device" },
                        attribute_subscriptions: [],
                    },
                },
            };

            await saveLegacyServerFile(env, legacyDir, fabricConfig!, serverFile);

            // Compute expected filename and verify
            const crypto = env.get(Crypto);
            const compressedFabricId = await computeCompressedNodeId(
                crypto,
                fabricConfig!.fabricId,
                fabricConfig!.rootPublicKey,
            );
            const serverFileName = `${compressedFabricId}.json`;

            const savedContent = JSON.parse(await readFile(join(legacyDir, serverFileName), "utf-8"));
            expect(savedContent.last_node_id).to.equal(10);
            expect(savedContent.nodes["8"].node_id).to.equal(8);
            expect(savedContent.nodes["8"].attributes["0/40/1"]).to.equal("Saved Device");
            expect(savedContent.vendor_info["1234"].vendor_name).to.equal("Saved Vendor");
        });

        it("should round-trip server file data", async () => {
            const legacyDir = join(testDir, "roundtrip-test");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            // Load chip.json
            const chipConfig = new ChipConfigData();
            await chipConfig.load(join(legacyDir, "chip.json"));
            const fabricConfig = chipConfig.getFabricConfig(1);
            expect(fabricConfig).to.exist;

            // Load server fixture
            const originalServerFile = JSON.parse(await readFile(FIXTURE_SERVER_JSON, "utf-8")) as LegacyServerFile;

            // Save it
            await saveLegacyServerFile(env, legacyDir, fabricConfig!, originalServerFile);

            // Load it back
            const result = await loadLegacyData(env, legacyDir);

            expect(result.serverFile).to.exist;
            expect(result.serverFile!.last_node_id).to.equal(originalServerFile.last_node_id);
            expect(Object.keys(result.serverFile!.nodes)).to.deep.equal(Object.keys(originalServerFile.nodes));

            for (const [nodeId, originalNode] of Object.entries(originalServerFile.nodes)) {
                const loadedNode = result.serverFile!.nodes[nodeId];
                expect(loadedNode).to.exist;
                expect(loadedNode.node_id).to.equal(originalNode.node_id);
                expect(loadedNode.is_bridge).to.equal(originalNode.is_bridge);
                expect(loadedNode.available).to.equal(originalNode.available);
            }
        });
    });

    describe("vendor_info handling", () => {
        it("should load vendor info from server file", async () => {
            const legacyDir = join(testDir, "vendor-info-test");
            await mkdir(legacyDir, { recursive: true });
            await copyFile(FIXTURE_CHIP_JSON, join(legacyDir, "chip.json"));

            // Load and compute server file name
            const chipConfig = new ChipConfigData();
            await chipConfig.load(join(legacyDir, "chip.json"));
            const fabricConfig = chipConfig.getFabricConfig(1);
            const crypto = env.get(Crypto);
            const compressedFabricId = await computeCompressedNodeId(
                crypto,
                fabricConfig!.fabricId,
                fabricConfig!.rootPublicKey,
            );

            // Copy server fixture
            await copyFile(FIXTURE_SERVER_JSON, join(legacyDir, `${compressedFabricId}.json`));

            const result = await loadLegacyData(env, legacyDir);

            expect(result.serverFile).to.exist;
            expect(result.serverFile!.vendor_info).to.exist;
            expect(result.serverFile!.vendor_info["4939"]).to.exist;
            expect(result.serverFile!.vendor_info["4939"].vendor_id).to.equal(4939);
            expect(result.serverFile!.vendor_info["4939"].vendor_name).to.equal("Test Vendor");
        });
    });
});
