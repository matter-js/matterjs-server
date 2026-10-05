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
        await writeFile(curl, '#!/bin/sh\nfor arg; do printf "%s\\n" "$arg"; done\n');
        await chmod(curl, 0o755);
    });

    after(async () => {
        await rm(stubDir, { recursive: true, force: true });
    });

    function curlArgs(listenAddress: string): string[] {
        const result = spawnSync("sh", [SCRIPT], {
            env: { PATH: `${stubDir}:${process.env.PATH}`, LISTEN_ADDRESS: listenAddress, PORT: "5580" },
            encoding: "utf8",
        });
        expect(result.status, result.stderr).to.equal(0);
        return result.stdout.split("\n").slice(0, -1);
    }

    function probedUrl(listenAddress: string): string {
        return curlArgs(listenAddress).at(-1) ?? "";
    }

    it("probes the first address the server binds from LISTEN_ADDRESS", () => {
        const cases = ["127.0.0.1", " ::1,127.0.0.1", ",192.168.1.10", "127.0.0.1 ,eth0", "127.0.0.1\r\n", "\r\n,::1"];
        for (const value of cases) {
            const first = parseListenAddressList(value)[0];
            const host = first.includes(":") ? `[${first}]` : first;
            expect(probedUrl(value), JSON.stringify(value)).to.equal(`http://${host}:5580/health`);
        }
    });

    it("queries a unix socket path through the socket, keeping inner spaces", () => {
        for (const value of ["/data/ws.sock", " /data/my ws.sock ,127.0.0.1", "/data/ws.sock\r\n"]) {
            const socketPath = parseListenAddressList(value)[0];
            const args = curlArgs(value);
            expect(args[args.indexOf("--unix-socket") + 1], JSON.stringify(value)).to.equal(socketPath);
            expect(args.at(-1)).to.equal("http://localhost/health");
        }
    });

    it("falls back to localhost when LISTEN_ADDRESS holds no address", () => {
        for (const value of ["", " , ", "\r\n"]) {
            expect(probedUrl(value), JSON.stringify(value)).to.equal("http://localhost:5580/health");
        }
    });
});
