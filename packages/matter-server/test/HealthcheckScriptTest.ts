/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseListenAddressList } from "../src/cli.js";

const SCRIPT = resolve(import.meta.dirname, "../../../../../docker/matterjs-server/healthcheck.sh");

describe("docker healthcheck.sh", function () {
    this.timeout(20_000);
    let stubDir: string;

    before(async () => {
        stubDir = await mkdtemp(join(tmpdir(), "hc-"));
        const curl = join(stubDir, "curl");
        await writeFile(curl, '#!/bin/sh\nfor arg; do last="$arg"; done\nprintf "%s" "$last"\n');
        await chmod(curl, 0o755);
    });

    after(async () => {
        await rm(stubDir, { recursive: true, force: true });
    });

    function probedUrl(listenAddress: string): string {
        const result = spawnSync("sh", [SCRIPT], {
            env: { PATH: `${stubDir}:${process.env.PATH}`, LISTEN_ADDRESS: listenAddress, PORT: "5580" },
            encoding: "utf8",
        });
        expect(result.status, result.stderr).to.equal(0);
        return result.stdout;
    }

    it("probes the first address the server binds from LISTEN_ADDRESS", () => {
        const cases = ["127.0.0.1", " ::1,127.0.0.1", ",192.168.1.10", "127.0.0.1 ,eth0", "127.0.0.1\r\n", "\r\n,::1"];
        for (const value of cases) {
            const first = parseListenAddressList(value)[0];
            const host = first.includes(":") ? `[${first}]` : first;
            expect(probedUrl(value), JSON.stringify(value)).to.equal(`http://${host}:5580/health`);
        }
    });

    it("falls back to localhost when LISTEN_ADDRESS holds no address", () => {
        for (const value of ["", " , ", "\r\n"]) {
            expect(probedUrl(value), JSON.stringify(value)).to.equal("http://localhost:5580/health");
        }
    });
});
