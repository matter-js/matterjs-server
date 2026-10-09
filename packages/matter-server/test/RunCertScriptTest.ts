/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../../..");
const SCRIPT = resolve(ROOT, "utils/run-cert.mjs");

interface PlannedStep {
    step: string;
    cwd: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    optional?: boolean;
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
        expect(checkout.args).to.deep.equal(["checkout", "--detach", `${pinnedRef}^{commit}`, "--"]);
        expect(find(plan([]), "fetch-all").args).to.deep.equal(["fetch", "origin"]);
    });

    it("fetches a branch ref by name and checks out FETCH_HEAD", () => {
        const steps = plan([], { MATTERJS_REF: "feat/xyz" });
        expect(find(steps, "fetch-ref").args).to.deep.equal(["fetch", "origin", "feat/xyz"]);
        expect(find(steps, "checkout").args).to.deep.equal(["checkout", "--detach", "FETCH_HEAD", "--"]);
    });

    it("also fetches a full sha directly, optionally", () => {
        const sha = "0123456789abcdef0123456789abcdef01234567";
        const fetchRef = find(plan(["--matterjs-ref", sha]), "fetch-ref");
        expect(fetchRef.args).to.deep.equal(["fetch", "origin", sha]);
        expect(fetchRef.optional).to.equal(true);
    });

    it("lets MATTERJS_REF override the default and the flag override MATTERJS_REF", () => {
        expect(find(plan([], { MATTERJS_REF: "feature/x" }), "fetch-ref").args.at(-1)).to.equal("feature/x");
        expect(
            find(plan(["--matterjs-ref", "abc1234"], { MATTERJS_REF: "feature/x" }), "checkout").args.at(-2),
        ).to.equal("abc1234^{commit}");
    });

    it("runs the steps in order", () => {
        const names = plan([]).map(s => s.step);
        expect(names.filter(n => n !== "clone")).to.deep.equal([
            "build-server",
            "fetch-all",
            "checkout",
            "install",
            "build-matterjs",
            "test",
        ]);
        expect(names.indexOf("build-server")).to.equal(0);
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

    describe("source checkout against a local upstream", () => {
        let dir: string;
        let upstream: string;
        let work: string;
        let certDir: string;

        function git(cwd: string, ...args: string[]) {
            const result = spawnSync(
                "git",
                ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "protocol.file.allow=always", ...args],
                { cwd, encoding: "utf8" },
            );
            expect(result.status, `git ${args.join(" ")}: ${result.stderr}`).to.equal(0);
            return result.stdout.trim();
        }

        function commit(message: string) {
            git(work, "commit", "--allow-empty", "-m", message);
            return git(work, "rev-parse", "HEAD");
        }

        function checkoutRef(ref: string) {
            return spawnSync("node", [SCRIPT, "--matterjs-ref", ref], {
                env: {
                    PATH: process.env.PATH ?? "",
                    HOME: dir,
                    CERT_PLATFORM: "linux",
                    CERT_SOURCE_ONLY: "1",
                    CERT_DIR: certDir,
                    CERT_MATTERJS_URL: `file://${upstream}`,
                    GIT_CONFIG_COUNT: "1",
                    GIT_CONFIG_KEY_0: "protocol.file.allow",
                    GIT_CONFIG_VALUE_0: "always",
                },
                encoding: "utf8",
                cwd: ROOT,
            });
        }

        function checkedOut() {
            const cwd = join(certDir, "matter.js");
            const detached = spawnSync("git", ["symbolic-ref", "-q", "HEAD"], { cwd }).status !== 0;
            return { head: git(cwd, "rev-parse", "HEAD"), detached };
        }

        beforeEach(() => {
            dir = mkdtempSync(join(tmpdir(), "cert-"));
            upstream = join(dir, "upstream.git");
            work = join(dir, "work");
            certDir = join(dir, "cert");
            git(dir, "init", "--bare", "-b", "main", upstream);
            git(dir, "clone", upstream, work);
            commit("first");
            git(work, "branch", "-M", "main");
            git(work, "push", "origin", "main");
            git(work, "checkout", "-b", "feat/xyz");
            commit("on branch");
            git(work, "push", "origin", "feat/xyz");
        });

        afterEach(() => {
            rmSync(dir, { recursive: true, force: true });
        });

        it("detaches at a branch ref on a fresh clone", () => {
            const tip = git(work, "rev-parse", "feat/xyz");
            const result = checkoutRef("feat/xyz");
            expect(result.status, result.stderr).to.equal(0);
            expect(checkedOut()).to.deep.equal({ head: tip, detached: true });
        });

        it("lands on the new tip of a reused clone after the upstream branch advanced", () => {
            expect(checkoutRef("main").status).to.equal(0);
            git(work, "checkout", "main");
            const tip = commit("advanced");
            git(work, "push", "origin", "main");
            const result = checkoutRef("main");
            expect(result.status, result.stderr).to.equal(0);
            expect(checkedOut()).to.deep.equal({ head: tip, detached: true });
        });

        it("resolves a short sha reachable from a branch", () => {
            const tip = git(work, "rev-parse", "feat/xyz");
            const result = checkoutRef(tip.slice(0, 9));
            expect(result.status, result.stderr).to.equal(0);
            expect(checkedOut()).to.deep.equal({ head: tip, detached: true });
        });

        it("fails loudly with the step name for an unknown ref", () => {
            const result = checkoutRef("no/such-branch");
            expect(result.status).to.not.equal(0);
            expect(result.stderr).to.contain('step "fetch-ref" failed');
        });
    });
});
