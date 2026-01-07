import { Bytes } from "@matter/general";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChipConfigData } from "../../src/converter/index.js";

// Path to test fixtures (relative to package root since tests run from build dir)
const FIXTURE_CHIP_JSON = join(process.cwd(), "test/converter/fixtures/chip.json");

describe("ChipConfigData", () => {
    let testDir: string;

    before(async () => {
        testDir = join(tmpdir(), `chip-config-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    after(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    describe("load", () => {
        it("should load and parse fabric certificates", async () => {
            const testFile = join(testDir, "fabric-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/n": "SGVsbG8gTk9D", // "Hello NOC" in base64
                        "f/1/i": "SGVsbG8gSUNBQw==", // "Hello ICAC"
                        "f/1/r": "SGVsbG8gUkNBQw==", // "Hello RCAC"
                        "f/1/m": "TWV0YWRhdGE=", // "Metadata"
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.fabrics.size).to.equal(1);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.index).to.equal(1);

            expect(fabric!.noc).to.exist;
            expect(fabric!.noc!.base64).to.equal("SGVsbG8gTk9D");
            expect(Bytes.toString(fabric!.noc!.raw)).to.equal("Hello NOC");

            expect(fabric!.icac).to.exist;
            expect(Bytes.toString(fabric!.icac!.raw)).to.equal("Hello ICAC");

            expect(fabric!.rcac).to.exist;
            expect(Bytes.toString(fabric!.rcac!.raw)).to.equal("Hello RCAC");

            expect(fabric!.metadata).to.exist;
            expect(Bytes.toString(fabric!.metadata!.raw)).to.equal("Metadata");
        });

        it("should load and parse fabric key sets", async () => {
            const testFile = join(testDir, "keys-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/k/0": "SVBL", // "IPK" - key set 0
                        "f/1/k/1": "S2V5MQ==", // "Key1"
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.keys.size).to.equal(2);

            const ipk = fabric!.keys.get(0);
            expect(ipk).to.exist;
            expect(Bytes.toString(ipk!.raw)).to.equal("IPK");

            const key1 = fabric!.keys.get(1);
            expect(key1).to.exist;
            expect(Bytes.toString(key1!.raw)).to.equal("Key1");
        });

        it("should load and parse fabric sessions", async () => {
            const testFile = join(testDir, "fabric-sessions-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/s/0000000000000070": "U2Vzc2lvbjcw", // "Session70"
                        "f/1/s/00000000000000A3": "U2Vzc2lvbkEz", // "SessionA3"
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.sessions.size).to.equal(2);

            const session70 = fabric!.sessions.get("0000000000000070");
            expect(session70).to.exist;
            expect(Bytes.toString(session70!.raw)).to.equal("Session70");
        });

        it("should load and parse global data", async () => {
            const testFile = join(testDir, "globals-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "g/fidx": "RmFicmljSW5kZXg=", // "FabricIndex"
                        "g/lkgt": "TGFzdEtub3duR29vZFRpbWU=", // "LastKnownGoodTime"
                        "g/sri": "U2Vzc2lvblJlc3VtcHRpb24=", // "SessionResumption"
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.globals.fabricIndexList).to.exist;
            expect(Bytes.toString(config.globals.fabricIndexList!.raw)).to.equal("FabricIndex");

            expect(config.globals.lastKnownGoodTime).to.exist;
            expect(Bytes.toString(config.globals.lastKnownGoodTime!.raw)).to.equal("LastKnownGoodTime");

            expect(config.sessions.resumptionIndex).to.exist;
            expect(Bytes.toString(config.sessions.resumptionIndex!.raw)).to.equal("SessionResumption");
        });

        it("should load and parse global session nodes into fabric resumptions", async () => {
            const testFile = join(testDir, "session-nodes-test.json");
            // Use real TLV data for g/s/* entries (SessionResumptionEntry: {fabricIndex, peerNodeId})
            // The TLV structure needs to decode properly to determine the fabric
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        // Real TLV entry from chip.json for g/s/* - decodes to fabricIndex=1
                        "g/s/pnv0rZ2xrOFePe5DbfcY1g==": "FSQBASQCcBg=",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            // Session resumption entries should be stored in the fabric they belong to
            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.resumptions.size).to.equal(1);

            const resumption = fabric!.resumptions.get("pnv0rZ2xrOFePe5DbfcY1g==");
            expect(resumption).to.exist;
            expect(fabric!.resumptionsDecoded.get("pnv0rZ2xrOFePe5DbfcY1g==")).to.exist;
        });

        it("should store ignored keys as base64", async () => {
            const testFile = join(testDir, "ignored-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "g/fs/c": "ZmFpbHNhZmVj", // failsafe marker
                        "g/fs/n": "ZmFpbHNhZmVu", // failsafe marker
                        "g/gdc": "Y291bnRlcg==", // global counter
                        "g/gcc": "Y291bnRlcjI=", // global counter
                        "g/gfl": "Z3JvdXBz", // group mapping
                        "g/icdfl": "aWNk", // ICD
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.ignored.size).to.equal(6);
            expect(config.ignored.get("g/fs/c")).to.equal("ZmFpbHNhZmVj");
            expect(config.ignored.get("g/gdc")).to.equal("Y291bnRlcg==");
        });

        it("should store generic/unknown keys", async () => {
            const testFile = join(testDir, "generic-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        ExampleOpCredsCAKey1: "a2V5MQ==",
                        ExampleCARootCert1: "Y2VydDE=",
                        SomeUnknownKey: "dW5rbm93bg==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            // ExampleOpCredsCAKey1 and ExampleCARootCert1 are now parsed as operationalCredentials
            expect(config.generic.size).to.equal(1);
            expect(config.generic.get("SomeUnknownKey")).to.equal("dW5rbm93bg==");

            // Verify operational credentials were parsed
            const opcreds = config.getOperationalCredentials(1);
            expect(opcreds).to.exist;
            expect(opcreds!.rootCaKey).to.exist;
            expect(opcreds!.rootCaCert).to.exist;
        });

        it("should preserve repl-config as-is", async () => {
            const testFile = join(testDir, "repl-config-test.json");
            const replConfig = {
                caList: {
                    "1": [{ fabricId: 2, vendorId: 4939 }],
                },
                someOtherData: "test",
            };

            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {},
                    "repl-config": replConfig,
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.replConfig).to.deep.equal(replConfig);
        });

        it("should parse hex fabric indices", async () => {
            const testFile = join(testDir, "hex-fabric-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/A/n": "SGV4RmFicmlj", // Fabric index 10 (0xA)
                        "f/FF/m": "SGV4RmFicmljMjU1", // Fabric index 255 (0xFF)
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.fabrics.size).to.equal(2);

            const fabric10 = config.getFabric(10);
            expect(fabric10).to.exist;
            expect(fabric10!.index).to.equal(10);

            const fabric255 = config.getFabric(255);
            expect(fabric255).to.exist;
            expect(fabric255!.index).to.equal(255);
        });
    });

    describe("save", () => {
        it("should save and reload data with round-trip integrity", async () => {
            const originalFile = join(testDir, "roundtrip-original.json");
            const savedFile = join(testDir, "roundtrip-saved.json");

            const originalData = {
                "sdk-config": {
                    "g/fidx": "RmFicmljSW5kZXg=",
                    "g/lkgt": "TGFzdEtub3duR29vZFRpbWU=",
                    "g/sri": "U2Vzc2lvblJlc3VtcHRpb24=",
                    // Real TLV entry for g/s/* that decodes to fabricIndex=1, peerNodeId=112
                    "g/s/resumption1": "FSQBASQCcBg=",
                    "f/1/n": "SGVsbG8gTk9D",
                    "f/1/i": "SGVsbG8gSUNBQw==",
                    "f/1/r": "SGVsbG8gUkNBQw==",
                    "f/1/m": "TWV0YWRhdGE=",
                    "f/1/k/0": "SVBL",
                    "f/1/s/0000000000000070": "U2Vzc2lvbjcw",
                    "g/gdc": "Y291bnRlcg==",
                    ExampleKey: "ZXhhbXBsZQ==",
                },
                "repl-config": {
                    test: "value",
                },
            };

            await writeFile(originalFile, JSON.stringify(originalData));

            const config = new ChipConfigData();
            await config.load(originalFile);
            await config.save(savedFile);

            // Reload the saved file
            const config2 = new ChipConfigData();
            await config2.load(savedFile);

            // Verify data integrity
            expect(config2.globals.fabricIndexList!.base64).to.equal("RmFicmljSW5kZXg=");
            expect(config2.globals.lastKnownGoodTime!.base64).to.equal("TGFzdEtub3duR29vZFRpbWU=");
            expect(config2.sessions.resumptionIndex!.base64).to.equal("U2Vzc2lvblJlc3VtcHRpb24=");

            const fabric = config2.getFabric(1);
            expect(fabric!.noc!.base64).to.equal("SGVsbG8gTk9D");
            expect(fabric!.icac!.base64).to.equal("SGVsbG8gSUNBQw==");
            expect(fabric!.rcac!.base64).to.equal("SGVsbG8gUkNBQw==");
            expect(fabric!.metadata!.base64).to.equal("TWV0YWRhdGE=");
            expect(fabric!.keys.get(0)!.base64).to.equal("SVBL");
            expect(fabric!.sessions.get("0000000000000070")!.base64).to.equal("U2Vzc2lvbjcw");
            // Global session resumption entries are now in fabric.resumptions
            expect(fabric!.resumptions.get("resumption1")!.base64).to.equal("FSQBASQCcBg=");

            expect(config2.ignored.get("g/gdc")).to.equal("Y291bnRlcg==");
            expect(config2.generic.get("ExampleKey")).to.equal("ZXhhbXBsZQ==");
            expect(config2.replConfig).to.deep.equal({ test: "value" });
        });

        it("should produce valid JSON output", async () => {
            const testFile = join(testDir, "valid-json-test.json");

            const config = new ChipConfigData();
            config.globals.fabricIndexList = {
                raw: new Uint8Array([1, 2, 3]),
                base64: "AQID",
            };

            await config.save(testFile);

            const content = await readFile(testFile, "utf-8");
            const parsed = JSON.parse(content);

            expect(parsed["sdk-config"]["g/fidx"]).to.equal("AQID");
        });

        it("should not include repl-config when empty", async () => {
            const testFile = join(testDir, "no-repl-config-test.json");

            const config = new ChipConfigData();
            config.globals.fabricIndexList = {
                raw: new Uint8Array([1, 2, 3]),
                base64: "AQID",
            };

            await config.save(testFile);

            const content = await readFile(testFile, "utf-8");
            const parsed = JSON.parse(content);

            expect(parsed["repl-config"]).to.be.undefined;
        });
    });

    describe("getFabricIndices", () => {
        it("should return sorted fabric indices", async () => {
            const testFile = join(testDir, "fabric-indices-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/3/n": "dGVzdA==",
                        "f/1/n": "dGVzdA==",
                        "f/A/n": "dGVzdA==", // 10 in hex
                        "f/2/n": "dGVzdA==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const indices = config.getFabricIndices();
            expect(indices).to.deep.equal([1, 2, 3, 10]);
        });
    });

    describe("TLV decoding", () => {
        it("should decode fabric metadata TLV", async () => {
            const testFile = join(testDir, "tlv-metadata-test.json");
            // Real TLV data from chip.json: f/1/m = "FSUASxMsAQAY"
            // This decodes to: Structure { 0 => UnsignedInt(4939), 1 => Utf8String("") }
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/m": "FSUASxMsAQAY",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.metadata).to.exist;
            expect(fabric!.metadataDecoded).to.exist;
            expect(fabric!.metadataDecoded!.vendorId).to.equal(4939);
            expect(fabric!.metadataDecoded!.label).to.equal("");
        });

        it("should decode fabric index list TLV", async () => {
            const testFile = join(testDir, "tlv-fidx-test.json");
            // Real TLV data: g/fidx = "FSQAAjYBBAEYGA=="
            // Structure { 0 => UnsignedInt(2), 1 => Array { UnsignedInt(1) } }
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "g/fidx": "FSQAAjYBBAEYGA==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.globals.fabricIndexList).to.exist;
            expect(config.globals.fabricIndexListDecoded).to.exist;
            expect(config.globals.fabricIndexListDecoded!.nextFabricIndex).to.equal(2);
            expect(config.globals.fabricIndexListDecoded!.fabricIndices).to.deep.equal([1]);
        });

        it("should decode last known good time TLV", async () => {
            const testFile = join(testDir, "tlv-lkgt-test.json");
            // Real TLV data: g/lkgt = "FSYAgKi8LBg="
            // Structure { 0 => UnsignedInt(epochSeconds) }
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "g/lkgt": "FSYAgKi8LBg=",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.globals.lastKnownGoodTime).to.exist;
            expect(config.globals.lastKnownGoodTimeDecoded).to.exist;
            expect(config.globals.lastKnownGoodTimeDecoded!.epochSeconds).to.be.a("number");
            expect(config.globals.lastKnownGoodTimeDecoded!.epochSeconds).to.be.greaterThan(0);
        });

        it("should decode group key set TLV (IPK)", async () => {
            const testFile = join(testDir, "tlv-ipk-test.json");
            // Real TLV data from chip.json: f/1/k/0
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/k/0":
                            "FSQBACQCATYDFSQEACUFLSgwBhDzc7Jr6Sc58QxRECtgZOCeGBUkBAAkBQAwBhAAAAAAAAAAAAAAAAAAAAAAGBUkBAAkBQAwBhAAAAAAAAAAAAAAAAAAAAAAGBglB///GA==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.keys.has(0)).to.be.true;
            expect(fabric!.keysDecoded.has(0)).to.be.true;

            const ipk = fabric!.keysDecoded.get(0);
            expect(ipk).to.exist;
            expect(ipk!.policy).to.equal(0);
            expect(ipk!.keyCount).to.equal(1);
            expect(ipk!.keys).to.be.an("array");
            expect(ipk!.keys.length).to.equal(3);
            expect(ipk!.groupKeySetId).to.equal(65535);

            // First key should have actual key data
            expect(ipk!.keys[0].key).to.be.instanceOf(Uint8Array);
            expect(ipk!.keys[0].key.byteLength).to.equal(16);
        });

        it("should decode session resumption index TLV", async () => {
            const testFile = join(testDir, "tlv-sri-test.json");
            // Real TLV data from chip.json: g/sri
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "g/sri":
                            "FhUkAQEkAnAYFSQBASQCoxgVJAEBJAI3GBUkAQEkAocYFSQBASQCURgVJAEBJAJhGBUkAQEkAlcYFSQBASQCVRgVJAEBJAJmGBUkAQEkAhcYFSQBASQCeRgVJAEBJAJDGBUkAQEkAnoYFSQBASQCOhgVJAEBJAJUGBUkAQEkAkQYFSQBASQCOBgY",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.sessions.resumptionIndex).to.exist;
            expect(config.sessions.resumptionIndexDecoded).to.exist;
            expect(config.sessions.resumptionIndexDecoded).to.be.an("array");
            expect(config.sessions.resumptionIndexDecoded!.length).to.be.greaterThan(0);

            // Check first entry structure
            const firstEntry = config.sessions.resumptionIndexDecoded![0];
            expect(firstEntry.fabricIndex).to.equal(1);
            // peerNodeId is UInt64 - can be number or bigint depending on value
            expect(typeof firstEntry.peerNodeId === "number" || typeof firstEntry.peerNodeId === "bigint").to.be.true;
        });

        it("should decode session resumption details TLV", async () => {
            const testFile = join(testDir, "tlv-session-details-test.json");
            // Real TLV data from chip.json: f/1/s/0000000000000070
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/s/0000000000000070":
                            "FTADEKZ79K2dsazhXj3uQ233GNYwBCAJG2Lyb2YqHGO0unkRCD1CAvZwRbLOukMYvRMA2a/kZzAFDAAAAAAAAAAAAAAAABg=",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.sessions.has("0000000000000070")).to.be.true;
            expect(fabric!.sessionsDecoded.has("0000000000000070")).to.be.true;

            const session = fabric!.sessionsDecoded.get("0000000000000070");
            expect(session).to.exist;
            expect(session!.resumptionId).to.be.instanceOf(Uint8Array);
            expect(session!.resumptionId.byteLength).to.equal(16);
            expect(session!.sharedSecret).to.be.instanceOf(Uint8Array);
            expect(session!.sharedSecret.byteLength).to.equal(32);
            expect(session!.cat).to.be.instanceOf(Uint8Array);
            expect(session!.cat.byteLength).to.equal(12);
        });

        it("should handle invalid TLV data gracefully", async () => {
            const testFile = join(testDir, "tlv-invalid-test.json");
            // Invalid TLV data that won't decode properly
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/m": "aW52YWxpZA==", // "invalid" - not valid TLV
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const fabric = config.getFabric(1);
            expect(fabric).to.exist;
            expect(fabric!.metadata).to.exist; // Raw data is still stored
            expect(fabric!.metadataDecoded).to.be.undefined; // Decoded is undefined
        });
    });

    describe("real chip.json", () => {
        it("should load the actual .ha1/chip.json file with all TLV decoded", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;

            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            // Verify fabric 1 exists with certificates
            const fabric1 = config.getFabric(1);
            expect(fabric1).to.exist;
            expect(fabric1!.noc).to.exist;
            expect(fabric1!.icac).to.exist;
            expect(fabric1!.rcac).to.exist;
            expect(fabric1!.metadata).to.exist;
            expect(fabric1!.keys.has(0)).to.be.true; // IPK

            // Verify TLV metadata is decoded
            expect(fabric1!.metadataDecoded).to.exist;
            expect(fabric1!.metadataDecoded!.vendorId).to.equal(4939);
            expect(fabric1!.metadataDecoded!.label).to.equal("");

            // Verify TLV IPK (key set 0) is decoded
            expect(fabric1!.keysDecoded.has(0)).to.be.true;
            const ipk = fabric1!.keysDecoded.get(0);
            expect(ipk).to.exist;
            expect(ipk!.policy).to.be.a("number");
            expect(ipk!.keys).to.be.an("array");
            expect(ipk!.groupKeySetId).to.equal(65535);

            // Verify fabric sessions are decoded
            expect(fabric1!.sessions.size).to.be.greaterThan(0);
            expect(fabric1!.sessionsDecoded.size).to.equal(fabric1!.sessions.size);
            for (const [_nodeHex, sessionDecoded] of fabric1!.sessionsDecoded) {
                expect(sessionDecoded.resumptionId).to.be.instanceOf(Uint8Array);
                expect(sessionDecoded.resumptionId.byteLength).to.equal(16);
                expect(sessionDecoded.sharedSecret).to.be.instanceOf(Uint8Array);
                expect(sessionDecoded.sharedSecret.byteLength).to.equal(32);
            }

            // Verify global fabric index list is decoded
            expect(config.globals.fabricIndexList).to.exist;
            expect(config.globals.fabricIndexListDecoded).to.exist;
            expect(config.globals.fabricIndexListDecoded!.nextFabricIndex).to.equal(2);
            expect(config.globals.fabricIndexListDecoded!.fabricIndices).to.deep.equal([1]);

            // Verify global last known good time is decoded
            expect(config.globals.lastKnownGoodTime).to.exist;
            expect(config.globals.lastKnownGoodTimeDecoded).to.exist;
            expect(config.globals.lastKnownGoodTimeDecoded!.epochSeconds).to.be.a("number");

            // Verify session resumption index is decoded
            expect(config.sessions.resumptionIndex).to.exist;
            expect(config.sessions.resumptionIndexDecoded).to.exist;
            expect(config.sessions.resumptionIndexDecoded).to.be.an("array");
            expect(config.sessions.resumptionIndexDecoded!.length).to.be.greaterThan(0);

            // Verify global session resumption entries are in fabric.resumptions (maps resumptionId to fabric/node)
            expect(fabric1!.resumptions.size).to.be.greaterThan(0);
            expect(fabric1!.resumptionsDecoded.size).to.equal(fabric1!.resumptions.size);
            for (const [_resumptionId, entry] of fabric1!.resumptionsDecoded) {
                expect(entry.fabricIndex).to.equal(1);
                expect(typeof entry.peerNodeId === "number" || typeof entry.peerNodeId === "bigint").to.be.true;
            }

            // Verify operational credentials are parsed (not in generic anymore)
            expect(config.generic.has("ExampleOpCredsCAKey1")).to.be.false;
            expect(config.generic.has("ExampleCARootCert1")).to.be.false;
            expect(config.operationalCredentials.size).to.be.greaterThan(0);
            const opCreds = config.getOperationalCredentials(1);
            expect(opCreds).to.exist;
            expect(opCreds!.rootCaKey).to.exist;
            expect(opCreds!.rootCaCert).to.exist;

            // Verify repl-config preserved
            expect(config.replConfig).to.have.property("caList");
        });

        it("should round-trip the actual chip.json without data loss", async () => {
            const originalPath = FIXTURE_CHIP_JSON;
            const savedPath = join(testDir, "chip-roundtrip.json");

            const config = new ChipConfigData();
            await config.load(originalPath);
            await config.save(savedPath);

            // Load original and saved for comparison
            const originalContent = JSON.parse(await readFile(originalPath, "utf-8"));
            const savedContent = JSON.parse(await readFile(savedPath, "utf-8"));

            // Verify all sdk-config keys are present
            const originalKeys = Object.keys(originalContent["sdk-config"]).sort();
            const savedKeys = Object.keys(savedContent["sdk-config"]).sort();

            expect(savedKeys).to.deep.equal(originalKeys);

            // Verify all values match
            for (const key of originalKeys) {
                expect(savedContent["sdk-config"][key]).to.equal(
                    originalContent["sdk-config"][key],
                    `Value mismatch for key: ${key}`,
                );
            }

            // Verify repl-config matches
            expect(savedContent["repl-config"]).to.deep.equal(originalContent["repl-config"]);
        });
    });

    describe("certificate operations", () => {
        it("should decode RCAC from fabric", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const rcac = config.getRcac(1);
            expect(rcac).to.exist;
            // RCAC should have a cert property with subject
            expect(rcac!.cert).to.exist;
            expect(rcac!.cert.subject).to.exist;
            expect(rcac!.cert.subject.rcacId).to.exist;
        });

        it("should decode ICAC from fabric", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const icac = config.getIcac(1);
            expect(icac).to.exist;
            // ICAC should have a cert property with issuer referencing RCAC
            expect(icac!.cert).to.exist;
            expect(icac!.cert.issuer).to.exist;
            expect(icac!.cert.issuer.rcacId).to.exist;
        });

        it("should decode NOC from fabric", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const noc = config.getNoc(1);
            expect(noc).to.exist;
            // NOC should have a cert property with subject containing nodeId and fabricId
            expect(noc!.cert).to.exist;
            expect(noc!.cert.subject).to.exist;
            expect(noc!.cert.subject.nodeId).to.exist;
            expect(noc!.cert.subject.fabricId).to.exist;
        });

        it("should return undefined for non-existent fabric", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            expect(config.getRcac(99)).to.be.undefined;
            expect(config.getIcac(99)).to.be.undefined;
            expect(config.getNoc(99)).to.be.undefined;
        });

        it("should return undefined for invalid certificate data", async () => {
            const testFile = join(testDir, "invalid-cert-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/r": "aW52YWxpZA==", // "invalid" - not valid certificate TLV
                        "f/1/n": "aW52YWxpZA==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.getRcac(1)).to.be.undefined;
            expect(config.getNoc(1)).to.be.undefined;
        });

        it("should verify certificate chain successfully", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const result = await config.verifyCertificateChain(1);

            expect(result.valid).to.be.true;
            expect(result.rcacValid).to.be.true;
            expect(result.icacValid).to.be.true;
            expect(result.nocValid).to.be.true;
            expect(result.error).to.be.undefined;
        });

        it("should fail verification for non-existent fabric", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const result = await config.verifyCertificateChain(99);

            expect(result.valid).to.be.false;
            expect(result.error).to.include("RCAC not found");
        });

        it("should fail verification for invalid certificate data", async () => {
            const testFile = join(testDir, "invalid-chain-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        "f/1/r": "aW52YWxpZA==",
                        "f/1/n": "aW52YWxpZA==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const result = await config.verifyCertificateChain(1);

            expect(result.valid).to.be.false;
            expect(result.error).to.include("RCAC not found");
        });

        it("should report certificate details from decoded certificates", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const rcac = config.getRcac(1);
            const icac = config.getIcac(1);
            const noc = config.getNoc(1);

            // Verify certificate chain linkage
            expect(rcac!.cert.subject.rcacId).to.exist;
            expect(icac!.cert.issuer.rcacId).to.equal(rcac!.cert.subject.rcacId);
            expect(noc!.cert.issuer.icacId).to.equal(icac!.cert.subject.icacId);
        });
    });

    describe("getFabricConfig", () => {
        it("should extract fabric config from real chip.json", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const fabricConfig = config.getFabricConfig(1);
            expect(fabricConfig).to.exist;

            // Verify all required fields are present
            expect(fabricConfig!.fabricIndex).to.equal(1);
            // FabricId, NodeId can be number or bigint depending on value size
            expect(typeof fabricConfig!.fabricId === "number" || typeof fabricConfig!.fabricId === "bigint").to.be.true;
            expect(typeof fabricConfig!.nodeId === "number" || typeof fabricConfig!.nodeId === "bigint").to.be.true;
            expect(typeof fabricConfig!.rootNodeId === "number" || typeof fabricConfig!.rootNodeId === "bigint").to.be
                .true;
            expect(fabricConfig!.rootVendorId).to.equal(4939);
            expect(fabricConfig!.rootCert).to.be.instanceOf(Uint8Array);
            expect(fabricConfig!.rootPublicKey).to.be.instanceOf(Uint8Array);
            expect(fabricConfig!.rootPublicKey.byteLength).to.equal(65); // Uncompressed EC P-256 public key
            expect(fabricConfig!.identityProtectionKey).to.be.instanceOf(Uint8Array);
            expect(fabricConfig!.identityProtectionKey.byteLength).to.equal(16); // 128-bit IPK
            expect(fabricConfig!.intermediateCACert).to.be.instanceOf(Uint8Array);
            expect(fabricConfig!.operationalCert).to.be.instanceOf(Uint8Array);
            expect(fabricConfig!.label).to.equal("");
        });

        it("should return undefined for non-existent fabric", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            expect(config.getFabricConfig(99)).to.be.undefined;
        });

        it("should return undefined for fabric with missing data", async () => {
            const testFile = join(testDir, "incomplete-fabric.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        // Only has NOC, missing RCAC and metadata
                        "f/1/n": "SGVsbG8gTk9D",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.getFabricConfig(1)).to.be.undefined;
        });

        it("should have correct fabricId and nodeId from NOC", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const fabricConfig = config.getFabricConfig(1);
            const noc = config.getNoc(1);

            expect(fabricConfig).to.exist;
            expect(noc).to.exist;

            // fabricId and nodeId should match what's in the NOC
            expect(fabricConfig!.fabricId).to.equal(noc!.cert.subject.fabricId);
            expect(fabricConfig!.nodeId).to.equal(noc!.cert.subject.nodeId);
        });

        it("should have correct rootNodeId from NOC", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const fabricConfig = config.getFabricConfig(1);
            const noc = config.getNoc(1);

            expect(fabricConfig).to.exist;
            expect(noc).to.exist;

            // rootNodeId should be the rcacId from RCAC subject
            expect(fabricConfig!.rootNodeId).to.equal(noc!.cert.subject.nodeId);
        });

        it("should extract IPK from group key set 0", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const fabricConfig = config.getFabricConfig(1);
            const fabric = config.getFabric(1);

            expect(fabricConfig).to.exist;
            expect(fabric).to.exist;

            // IPK is always the same constant "temporary ipk 01" (the chip.json contains
            // the derived operational IPK, but we return the plain IPK constant)
            const expectedIpk = Bytes.fromHex("74656d706f726172792069706b203031");
            expect(fabricConfig!.identityProtectionKey).to.deep.equal(expectedIpk);
        });
    });

    describe("operationalCredentials", () => {
        it("should parse ExampleOpCreds* keys into operationalCredentials", async () => {
            const testFile = join(testDir, "opcreds-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        ExampleOpCredsCAKey1: "cm9vdGNha2V5", // "rootcakey" in base64
                        ExampleCARootCert1: "cm9vdGNhY2VydA==", // "rootcacert"
                        ExampleOpCredsICAKey1: "aWNha2V5", // "icakey"
                        ExampleCAIntermediateCert1: "aWNhY2VydA==", // "icacert"
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.operationalCredentials.size).to.equal(1);
            expect(config.generic.size).to.equal(0); // Should not be in generic

            const creds = config.getOperationalCredentials(1);
            expect(creds).to.exist;
            expect(creds!.rootCaKey).to.exist;
            expect(Bytes.toString(creds!.rootCaKey!.raw)).to.equal("rootcakey");
            expect(creds!.rootCaCert).to.exist;
            expect(Bytes.toString(creds!.rootCaCert!.raw)).to.equal("rootcacert");
            expect(creds!.icaKey).to.exist;
            expect(Bytes.toString(creds!.icaKey!.raw)).to.equal("icakey");
            expect(creds!.icaCert).to.exist;
            expect(Bytes.toString(creds!.icaCert!.raw)).to.equal("icacert");
        });

        it("should handle multiple credential sets", async () => {
            const testFile = join(testDir, "opcreds-multi-test.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        ExampleOpCredsCAKey1: "a2V5MQ==", // "key1"
                        ExampleCARootCert1: "Y2VydDE=", // "cert1"
                        ExampleOpCredsCAKey2: "a2V5Mg==", // "key2"
                        ExampleCARootCert2: "Y2VydDI=", // "cert2"
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            expect(config.operationalCredentials.size).to.equal(2);
            expect(config.getOperationalCredentialsIndices()).to.deep.equal([1, 2]);

            const creds1 = config.getOperationalCredentials(1);
            expect(creds1!.rootCaKey!.base64).to.equal("a2V5MQ==");

            const creds2 = config.getOperationalCredentials(2);
            expect(creds2!.rootCaKey!.base64).to.equal("a2V5Mg==");
        });

        it("should round-trip operational credentials", async () => {
            const originalFile = join(testDir, "opcreds-roundtrip-original.json");
            const savedFile = join(testDir, "opcreds-roundtrip-saved.json");

            await writeFile(
                originalFile,
                JSON.stringify({
                    "sdk-config": {
                        ExampleOpCredsCAKey1: "cm9vdGNha2V5",
                        ExampleCARootCert1: "cm9vdGNhY2VydA==",
                        ExampleOpCredsICAKey1: "aWNha2V5",
                        ExampleCAIntermediateCert1: "aWNhY2VydA==",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(originalFile);
            await config.save(savedFile);

            const savedContent = JSON.parse(await readFile(savedFile, "utf-8"));
            expect(savedContent["sdk-config"]["ExampleOpCredsCAKey1"]).to.equal("cm9vdGNha2V5");
            expect(savedContent["sdk-config"]["ExampleCARootCert1"]).to.equal("cm9vdGNhY2VydA==");
            expect(savedContent["sdk-config"]["ExampleOpCredsICAKey1"]).to.equal("aWNha2V5");
            expect(savedContent["sdk-config"]["ExampleCAIntermediateCert1"]).to.equal("aWNhY2VydA==");
        });
    });

    describe("getCertificateAuthorityConfig", () => {
        it("should extract CA config from real chip.json", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const caConfig = (await config.getCertificateAuthorityConfig(1)) as any;
            expect(caConfig).to.exist;

            // Verify root CA properties
            expect(caConfig.rootCertId).to.be.a("bigint");
            expect(caConfig.rootKeyPair).to.exist;
            expect(caConfig.rootKeyPair.publicKey).to.be.instanceOf(Uint8Array);
            expect(caConfig.rootKeyPair.publicKey.byteLength).to.equal(65); // Uncompressed EC P-256
            expect(caConfig.rootKeyPair.privateKey).to.be.instanceOf(Uint8Array);
            expect(caConfig.rootKeyPair.privateKey.byteLength).to.equal(32); // EC P-256 private key
            expect(caConfig.rootKeyIdentifier).to.be.instanceOf(Uint8Array);
            expect(caConfig.rootKeyIdentifier.byteLength).to.equal(20); // SHA-1 hash prefix
            expect(caConfig.rootCertBytes).to.be.instanceOf(Uint8Array);
            expect(caConfig.nextCertificateId).to.be.a("bigint");

            // Verify ICAC properties (if present)
            if (caConfig.icacCertBytes !== undefined) {
                expect(caConfig.icacCertId).to.be.a("bigint");
                expect(caConfig.icacKeyPair).to.exist;
                expect(caConfig.icacKeyPair!.publicKey.byteLength).to.equal(65);
                expect(caConfig.icacKeyPair!.privateKey.byteLength).to.equal(32);
                expect(caConfig!.icacKeyIdentifier).to.be.instanceOf(Uint8Array);
                expect(caConfig.icacKeyIdentifier!.byteLength).to.equal(20);
                expect(caConfig.icacCertBytes).to.be.instanceOf(Uint8Array);
            }
        });

        it("should return undefined for non-existent credentials", async () => {
            const chipJsonPath = FIXTURE_CHIP_JSON;
            const config = new ChipConfigData();
            await config.load(chipJsonPath);

            const caConfig = await config.getCertificateAuthorityConfig(99);
            expect(caConfig).to.be.undefined;
        });

        it("should return undefined for incomplete credentials", async () => {
            const testFile = join(testDir, "incomplete-opcreds.json");
            await writeFile(
                testFile,
                JSON.stringify({
                    "sdk-config": {
                        // Only has key, no cert
                        ExampleOpCredsCAKey1: "cm9vdGNha2V5",
                    },
                }),
            );

            const config = new ChipConfigData();
            await config.load(testFile);

            const caConfig = await config.getCertificateAuthorityConfig(1);
            expect(caConfig).to.be.undefined;
        });
    });
});
