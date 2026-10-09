/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../../..");
const SCRIPT = resolve(ROOT, "utils/run-cert.mjs");

interface PlannedStep {
    step: string;
    cwd: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

const pinnedRef = (() => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "packages/matter-server/package.json"), "utf8"));
    return /-([0-9a-f]{7,40})$/.exec(pkg.dependencies["@matter/main"])?.[1];
})();

function runCert(args: string[], env: Record<string, string> = {}) {
    const cleanEnv: Record<string, string> = { PATH: process.env.PATH ?? "" };
    return spawnSync("node", [SCRIPT, ...args], { env: { ...cleanEnv, ...env }, encoding: "utf8", cwd: ROOT });
}

function plan(args: string[], env: Record<string, string> = {}): PlannedStep[] {
    const result = runCert(["--dry-run", ...args], { CERT_PLATFORM: "linux", ...env });
    expect(result.status, result.stderr).to.equal(0);
    return result.stdout
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => JSON.parse(line));
}

function find(steps: PlannedStep[], name: string): PlannedStep {
    const found = steps.find(s => s.step === name);
    if (found === undefined) {
        throw new Error(`step ${name} missing from ${steps.map(s => s.step).join(",")}`);
    }
    return found;
}

describe("utils/run-cert.mjs", function () {
    this.timeout(20_000);

    it("pins the default ref from the @matter/main commit suffix", () => {
        expect(pinnedRef).to.be.a("string");
        const checkout = find(plan([]), "checkout");
        expect(checkout.args).to.deep.equal(["checkout", "--detach", pinnedRef]);
    });

    it("lets MATTERJS_REF override the default and the flag override MATTERJS_REF", () => {
        expect(find(plan([], { MATTERJS_REF: "feature/x" }), "checkout").args.at(-1)).to.equal("feature/x");
        expect(
            find(plan(["--matterjs-ref", "abc1234"], { MATTERJS_REF: "feature/x" }), "checkout").args.at(-1),
        ).to.equal("abc1234");
    });

    it("runs the steps in order", () => {
        const names = plan([]).map(s => s.step);
        expect(names.filter(n => n !== "clone" && n !== "fetch")).to.deep.equal([
            "build-server",
            "checkout",
            "install",
            "build-matterjs",
            "test",
        ]);
        expect(names.indexOf("build-server")).to.equal(0);
        expect(["clone", "fetch"]).to.include(names[1]);
        expect(names.at(-1)).to.equal("test");
    });

    it("runs the whole cert suite with the linux env", () => {
        const test = find(plan([]), "test");
        expect(test.cwd).to.equal(resolve(ROOT, ".cert/matter.js/support/chip-testing"));
        expect([test.command, ...test.args].join(" ")).to.equal("npm run test-cert");
        expect(test.env).to.deep.equal({
            MATTER_CERT_CONTROLLER: "matterjs-server",
            MATTER_CERT_SERVER_ENTRY: resolve(ROOT, "packages/matter-server/dist/esm/MatterServer.js"),
            MATTER_CERT_DEVICE: "chip-local",
            MATTER_CERT_EVIDENCE_DIR: resolve(ROOT, ".cert/evidence"),
            MATTER_CHIP_BINS_SOURCE: "cert-bins",
        });
    });

    it("uses MATTER_CERT_APP_DIR on macOS", () => {
        const test = find(plan([], { CERT_PLATFORM: "darwin", MATTER_CERT_APP_DIR: "/opt/chip" }), "test");
        expect(test.env?.MATTER_CERT_APP_DIR).to.equal("/opt/chip");
        expect(test.env).to.not.have.property("MATTER_CHIP_BINS_SOURCE");
    });

    it("fails on macOS without MATTER_CERT_APP_DIR, before any step", () => {
        const result = runCert(["--dry-run"], { CERT_PLATFORM: "darwin" });
        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain("MATTER_CERT_APP_DIR");
        expect(result.stdout).to.equal("");
    });

    it("narrows the spec with --tc", () => {
        const test = find(plan(["--tc", "TC-IDM-2.1"]), "test");
        expect(test.command).to.equal("npx");
        expect(test.args).to.deep.equal(["matter-test", "--spec=test/cert/TC-IDM-2.1.test.ts", "--report"]);
        expect(test.env?.MATTER_TEST_SHUTDOWN_TIMEOUT_MS).to.equal("15000");
    });

    it("rejects an invalid --tc or ref", () => {
        for (const args of [
            ["--tc", "../evil"],
            ["--tc", "TC-X;rm"],
            ["--tc", "IDM-2.1"],
            ["--matterjs-ref", "-oUpload"],
            ["--matterjs-ref", "a b"],
            ["--matterjs-ref", "a..b"],
            ["--matterjs-ref", "$(x)"],
        ]) {
            const result = runCert(["--dry-run", ...args], { CERT_PLATFORM: "linux" });
            expect(result.status, args.join(" ")).to.not.equal(0);
            expect(result.stdout, args.join(" ")).to.equal("");
            expect(result.stderr, args.join(" ")).to.not.equal("");
        }
    });

    it("rejects an invalid MATTERJS_REF from the environment", () => {
        const result = runCert(["--dry-run"], { CERT_PLATFORM: "linux", MATTERJS_REF: "--bad" });
        expect(result.status).to.not.equal(0);
    });
});
