/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { computeCompressedNodeId, Crypto, Environment } from "@matter-server/ws-controller";
import { NodeJsCrypto } from "@matter/nodejs";
import { access, copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLegacyData, retireLegacyData } from "../../src/converter/index.js";

const FIXTURE_DIR = join(process.cwd(), "test/converter/fixtures");
const FIXTURE_VENDOR_ID = 0x134b;
const FIXTURE_FABRIC_ID = 2;

describe("retireLegacyData", () => {
    let testDir: string;
    let env: Environment;

    before(async () => {
        testDir = join(tmpdir(), `legacy-retirement-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    after(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        env = new Environment("test");
        env.set(Crypto, new NodeJsCrypto());
    });

    async function seed(name: string) {
        const legacyDir = join(testDir, name);
        await mkdir(legacyDir, { recursive: true });
        await copyFile(join(FIXTURE_DIR, "chip.json"), join(legacyDir, "chip.json"));
        const { fabricConfig } = await loadLegacyData(env, legacyDir, {
            vendorId: FIXTURE_VENDOR_ID,
            fabricId: FIXTURE_FABRIC_ID,
        });
        if (fabricConfig === undefined) {
            expect.fail("fixture chip.json has no matching fabric");
            return { legacyDir, serverFileName: "" };
        }
        const serverFileName = `${await computeCompressedNodeId(env.get(Crypto), fabricConfig.fabricId, fabricConfig.rootPublicKey)}.json`;
        await copyFile(join(FIXTURE_DIR, "server.json"), join(legacyDir, serverFileName));
        return { legacyDir, serverFileName };
    }

    async function load(legacyDir: string) {
        return loadLegacyData(env, legacyDir, { vendorId: FIXTURE_VENDOR_ID, fabricId: FIXTURE_FABRIC_ID });
    }

    async function exists(path: string) {
        try {
            await access(path);
            return true;
        } catch {
            return false;
        }
    }

    function retire(legacyDir: string, legacyData: Awaited<ReturnType<typeof load>>) {
        return retireLegacyData({ env, storagePath: legacyDir, legacyData });
    }

    it("renames the Python Matter Server files", async () => {
        const { legacyDir, serverFileName } = await seed("complete");

        const retired = await retire(legacyDir, await load(legacyDir));

        expect(retired).to.deep.equal([serverFileName, "chip.json"]);
        expect(await exists(join(legacyDir, `${serverFileName}.migrated`))).to.be.true;
        expect(await exists(join(legacyDir, "chip.json.migrated"))).to.be.true;
    });

    it("keeps everything when the node file could not be read", async () => {
        const { legacyDir, serverFileName } = await seed("unreadable");
        await writeFile(join(legacyDir, serverFileName), "{ truncated");

        const retired = await retire(legacyDir, await load(legacyDir));

        expect(retired).to.deep.equal([]);
        expect(await exists(join(legacyDir, serverFileName))).to.be.true;
        expect(await exists(join(legacyDir, "chip.json"))).to.be.true;
    });

    it("renames the files when the backup stood in for an unreadable node file", async () => {
        const { legacyDir, serverFileName } = await seed("backup");
        await copyFile(join(legacyDir, serverFileName), join(legacyDir, `${serverFileName}.backup`));
        await writeFile(join(legacyDir, serverFileName), "{ truncated");

        const retired = await retire(legacyDir, await load(legacyDir));

        expect(retired).to.deep.equal([serverFileName, `${serverFileName}.backup`, "chip.json"]);
    });

    it("finishes a retirement that ended after renaming the server file", async () => {
        const { legacyDir, serverFileName } = await seed("resume");
        await rename(join(legacyDir, serverFileName), join(legacyDir, `${serverFileName}.migrated`));

        const retired = await retire(legacyDir, await load(legacyDir));

        expect(retired).to.deep.equal(["chip.json"]);
    });
});
