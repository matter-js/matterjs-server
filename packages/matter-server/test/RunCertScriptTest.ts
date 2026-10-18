/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../../..");
const SCRIPT = resolve(ROOT, "cert/run-cert.mjs");

interface PlannedStep {
    step: string;
    cwd: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    optional?: boolean;
}

const pinnedVersion: unknown = JSON.parse(readFileSync(resolve(ROOT, "packages/matter-server/package.json"), "utf8"))
    .dependencies["@matter/main"];

function runCert(args: string[], env: Record<string, string> = {}) {
    const cleanEnv: Record<string, string> = { PATH: process.env.PATH ?? "" };
    return spawnSync("node", [SCRIPT, ...args], { env: { ...cleanEnv, ...env }, encoding: "utf8", cwd: ROOT });
}

function plan(args: string[], env: Record<string, string> = {}): PlannedStep[] {
    const result = runCert(["--dry-run", ...args], { RUN_CERT_TEST_PLATFORM: "linux", ...env });
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

describe("cert/run-cert.mjs", function () {
    this.timeout(20_000);

    describe("default ref from the @matter/main pin", () => {
        let dir: string;

        beforeEach(() => {
            dir = mkdtempSync(join(tmpdir(), "cert-pin-"));
        });

        afterEach(() => {
            rmSync(dir, { recursive: true, force: true });
        });

        function packageJson(dependencies: Record<string, string>) {
            const path = join(dir, "package.json");
            writeFileSync(path, JSON.stringify({ dependencies }));
            return path;
        }

        function planFor(version: string) {
            return plan([], { RUN_CERT_TEST_PACKAGE_JSON: packageJson({ "@matter/main": version }) });
        }

        it("checks out the commit of a dev build", () => {
            const steps = planFor("0.18.0-alpha.0-20261008-6066b7499");
            expect(find(steps, "fetch-all").args).to.deep.equal(["fetch", "--tags", "--force", "origin"]);
            expect(find(steps, "checkout").args).to.deep.equal([
                "checkout",
                "--force",
                "--detach",
                "6066b7499^{commit}",
                "--",
            ]);
        });

        it("checks out the release tag of a release version", () => {
            const steps = planFor("0.17.9");
            expect(find(steps, "fetch-ref").args).to.deep.equal(["fetch", "origin", "v0.17.9"]);
            expect(find(steps, "checkout").args).to.deep.equal(["checkout", "--force", "--detach", "FETCH_HEAD", "--"]);
        });

        it("follows the pin of this repository", () => {
            expect(pinnedVersion).to.be.a("string");
            const commit = /-\d{8}-([0-9a-f]{7,40})$/.exec(String(pinnedVersion))?.[1];
            const checkout = find(plan([]), "checkout");
            expect(checkout.args.at(-2)).to.equal(commit === undefined ? "FETCH_HEAD" : `${commit}^{commit}`);
        });

        it("names the ref and the version it comes from", () => {
            const result = runCert(["--dry-run"], {
                RUN_CERT_TEST_PLATFORM: "linux",
                RUN_CERT_TEST_PACKAGE_JSON: packageJson({ "@matter/main": "0.18.0-alpha.0-20261008-6066b7499" }),
            });
            expect(result.stderr).to.contain(
                "cert: matter.js ref 6066b7499 (@matter/main 0.18.0-alpha.0-20261008-6066b7499 of the server)",
            );
        });

        it("fails when @matter/main is not a dependency", () => {
            const result = runCert(["--dry-run"], {
                RUN_CERT_TEST_PLATFORM: "linux",
                RUN_CERT_TEST_PACKAGE_JSON: packageJson({}),
            });
            expect(result.status).to.equal(2);
            expect(result.stderr).to.contain("@matter/main is not a dependency");
        });
    });

    it("fetches a branch ref by name and checks out FETCH_HEAD", () => {
        const steps = plan([], { MATTERJS_REF: "feat/xyz" });
        expect(find(steps, "fetch-ref").args).to.deep.equal(["fetch", "origin", "feat/xyz"]);
        expect(find(steps, "checkout").args).to.deep.equal(["checkout", "--force", "--detach", "FETCH_HEAD", "--"]);
    });

    it("also fetches a full sha directly, optionally", () => {
        const sha = "0123456789abcdef0123456789abcdef01234567";
        const fetchRef = find(plan(["--matterjs-ref", sha]), "fetch-ref");
        expect(fetchRef.args).to.deep.equal(["fetch", "origin", sha]);
        expect(fetchRef.optional).to.equal(true);
    });

    it("names an overriding ref and where it comes from", () => {
        const env = { RUN_CERT_TEST_PLATFORM: "linux", MATTERJS_REF: "feature/x" };
        expect(runCert(["--dry-run"], env).stderr).to.contain("cert: matter.js ref feature/x (MATTERJS_REF)");
        expect(runCert(["--dry-run", "--matterjs-ref", "abc1234"], env).stderr).to.contain(
            "cert: matter.js ref abc1234 (--matterjs-ref)",
        );
    });

    it("lets MATTERJS_REF override the default and the flag override MATTERJS_REF", () => {
        expect(find(plan([], { MATTERJS_REF: "feature/x" }), "fetch-ref").args.at(-1)).to.equal("feature/x");
        expect(
            find(plan(["--matterjs-ref", "abc1234"], { MATTERJS_REF: "feature/x" }), "checkout").args.at(-2),
        ).to.equal("abc1234^{commit}");
    });

    it("names the evidence directory after the test step, also when it fails", () => {
        const certDir = mkdtempSync(join(tmpdir(), "cert-evidence-"));
        try {
            const result = runCert(["--matterjs-ref", "abc1234"], {
                RUN_CERT_TEST_PLATFORM: "linux",
                RUN_CERT_TEST_DIR: certDir,
                RUN_CERT_TEST_STEPS: "test",
            });
            expect(result.status).to.not.equal(0);
            expect(result.stderr).to.contain(`cert: evidence in ${join(certDir, "evidence")}`);
        } finally {
            rmSync(certDir, { recursive: true, force: true });
        }
    });

    it("runs the steps in order", () => {
        const names = plan(["--matterjs-ref", "abc1234"]).map(s => s.step);
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
            MATTER_CHIP_PLATFORM: "linux/arm64",
        });
    });

    it("uses MATTER_CERT_APP_DIR on macOS", () => {
        const test = find(plan([], { RUN_CERT_TEST_PLATFORM: "darwin", MATTER_CERT_APP_DIR: "/opt/chip" }), "test");
        expect(test.env?.MATTER_CERT_APP_DIR).to.equal("/opt/chip");
        expect(test.env).to.not.have.property("MATTER_CHIP_BINS_SOURCE");
    });

    it("fails on macOS without MATTER_CERT_APP_DIR, before any step", () => {
        const result = runCert(["--dry-run"], { RUN_CERT_TEST_PLATFORM: "darwin" });
        expect(result.status).to.equal(2);
        expect(result.stderr).to.contain("MATTER_CERT_APP_DIR");
        expect(result.stdout).to.equal("");
    });

    it("runs the matterjs test devices without CHIP apps on any supported platform", () => {
        for (const env of new Array<Record<string, string>>({}, { RUN_CERT_TEST_PLATFORM: "darwin" })) {
            const test = find(plan(["--device", "matterjs"], env), "test");
            expect(test.env?.MATTER_CERT_DEVICE).to.equal("matterjs");
            expect(test.env).to.not.have.property("MATTER_CHIP_BINS_SOURCE");
            expect(test.env).to.not.have.property("MATTER_CERT_APP_DIR");
        }
    });

    it("narrows the spec with --tc", () => {
        const test = find(plan(["--tc", "TC-IDM-2.1"]), "test");
        expect(test.command).to.equal("npx");
        expect(test.args).to.deep.equal(["matter-test", "--spec=test/cert/TC-IDM-2.1.test.ts", "--report"]);
        expect(test.env?.MATTER_TEST_SHUTDOWN_TIMEOUT_MS).to.equal("15000");
    });

    it("takes flag values inline", () => {
        const steps = plan(["--tc=TC-IDM-2.1", "--matterjs-ref=feat/xyz"]);
        expect(find(steps, "test").args[1]).to.equal("--spec=test/cert/TC-IDM-2.1.test.ts");
        expect(find(steps, "fetch-ref").args.at(-1)).to.equal("feat/xyz");
    });

    it("rejects a flag without value, an unknown argument and an unsupported platform", () => {
        for (const [args, env, message] of [
            [["--tc"], {}, "--tc needs a value"],
            [["--frobnicate"], {}, "unknown argument --frobnicate"],
            [[], { RUN_CERT_TEST_PLATFORM: "win32" }, "unsupported platform win32"],
            [["--device", "matterjs"], { RUN_CERT_TEST_PLATFORM: "win32" }, "unsupported platform win32"],
            [["--device", "chip"], {}, 'invalid --device "chip"'],
        ] satisfies [string[], Record<string, string>, string][]) {
            const result = runCert(["--dry-run", ...args], { RUN_CERT_TEST_PLATFORM: "linux", ...env });
            expect(result.status, message).to.equal(2);
            expect(result.stderr, message).to.contain(message);
            expect(result.stdout, message).to.equal("");
        }
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
            ["--matterjs-ref", "feat/"],
            ["--matterjs-ref", "main.lock"],
        ]) {
            const result = runCert(["--dry-run", ...args], { RUN_CERT_TEST_PLATFORM: "linux" });
            expect(result.status, args.join(" ")).to.equal(2);
            expect(result.stdout, args.join(" ")).to.equal("");
            expect(result.stderr, args.join(" ")).to.not.equal("");
        }
    });

    it("rejects an invalid MATTERJS_REF from the environment", () => {
        const result = runCert(["--dry-run"], { RUN_CERT_TEST_PLATFORM: "linux", MATTERJS_REF: "--bad" });
        expect(result.status).to.equal(2);
    });

    describe("source checkout against a local upstream", () => {
        let dir: string;
        let upstream: string;
        let work: string;
        let certDir: string;
        let hooks: string;

        function git(cwd: string, ...args: string[]) {
            const result = spawnSync(
                "git",
                ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "protocol.file.allow=always", ...args],
                { cwd, encoding: "utf8" },
            );
            expect(result.status, `git ${args.join(" ")}: ${result.stderr}`).to.equal(0);
            return result.stdout.trim();
        }

        function commit(message: string, content?: string) {
            if (content === undefined) {
                git(work, "commit", "--allow-empty", "-m", message);
            } else {
                writeFileSync(join(work, "file.txt"), content);
                git(work, "add", "file.txt");
                git(work, "commit", "-m", message);
            }
            return git(work, "rev-parse", "HEAD");
        }

        function checkoutRef(ref: string, env: Record<string, string> = {}) {
            return spawnSync("node", [SCRIPT, "--matterjs-ref", ref], {
                env: {
                    PATH: process.env.PATH ?? "",
                    HOME: dir,
                    RUN_CERT_TEST_PLATFORM: "linux",
                    RUN_CERT_TEST_SOURCE_ONLY: "1",
                    RUN_CERT_TEST_DIR: certDir,
                    RUN_CERT_TEST_MATTERJS_URL: `file://${upstream}`,
                    GIT_CONFIG_COUNT: "2",
                    GIT_CONFIG_KEY_0: "protocol.file.allow",
                    GIT_CONFIG_VALUE_0: "always",
                    GIT_CONFIG_KEY_1: "core.hooksPath",
                    GIT_CONFIG_VALUE_1: hooks,
                    ...env,
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
            hooks = join(dir, "hooks");
            mkdirSync(hooks);
            const hook = join(hooks, "post-checkout");
            writeFileSync(hook, `#!/bin/sh\nenv > "${join(dir, "checkout-env.txt")}"\n`);
            chmodSync(hook, 0o755);
            git(dir, "init", "--bare", "-b", "main", upstream);
            git(dir, "clone", upstream, work);
            commit("first", "first");
            git(work, "branch", "-M", "main");
            git(work, "push", "origin", "main");
            git(work, "checkout", "-b", "feat/xyz");
            commit("on branch", "on branch");
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

        it("fails with the exit code and name of the failing step for an unknown ref", () => {
            const result = checkoutRef("no/such-branch");
            expect(result.status).to.equal(128);
            expect(result.stderr).to.contain('step "fetch-ref" failed (exit code 128)');
        });

        it("continues after the optional direct fetch of a full sha fails", () => {
            const unknown = "0123456789abcdef0123456789abcdef01234567";
            const result = checkoutRef(unknown);
            expect(result.stderr).to.contain('optional step "fetch-ref" failed');
            expect(result.stderr).to.contain('step "checkout" failed (exit code 128)');
            expect(result.status).to.equal(128);
        });

        it("checks out over tracked files the build left modified", () => {
            expect(checkoutRef("main").status).to.equal(0);
            writeFileSync(join(certDir, "matter.js", "file.txt"), "changed by a build");
            const tip = git(work, "rev-parse", "feat/xyz");
            const result = checkoutRef("feat/xyz");
            expect(result.status, result.stderr).to.equal(0);
            expect(checkedOut()).to.deep.equal({ head: tip, detached: true });
        });

        it("follows a hex-looking tag that moved upstream", () => {
            const first = git(work, "rev-parse", "main");
            git(work, "tag", "deadbeef", first);
            git(work, "push", "origin", "deadbeef");
            expect(checkoutRef("deadbeef").status).to.equal(0);
            expect(checkedOut().head).to.equal(first);

            const moved = git(work, "rev-parse", "feat/xyz");
            git(work, "tag", "-f", "deadbeef", moved);
            git(work, "push", "-f", "origin", "deadbeef");
            const result = checkoutRef("deadbeef");
            expect(result.status, result.stderr).to.equal(0);
            expect(checkedOut().head).to.equal(moved);
        });

        it("passes the user's npm config to the steps, but not npm's description of this run", () => {
            const result = checkoutRef("main", {
                npm_config_registry: "https://registry.example",
                npm_config_local_prefix: ROOT,
                npm_lifecycle_event: "cert",
                npm_package_name: "matterjs-server-monorepo",
                npm_command: "run-script",
                npm_execpath: "/usr/lib/npm-cli.js",
                npm_node_execpath: process.execPath,
                npm_config_user_agent: "npm/10 node/v22",
                INIT_CWD: ROOT,
            });
            expect(result.status, result.stderr).to.equal(0);
            const env = readFileSync(join(dir, "checkout-env.txt"), "utf8").split("\n");
            expect(env).to.include("npm_config_registry=https://registry.example");
            for (const name of [
                "npm_config_local_prefix",
                "npm_lifecycle_event",
                "npm_package_name",
                "npm_command",
                "npm_execpath",
                "npm_node_execpath",
                "npm_config_user_agent",
                "INIT_CWD",
            ]) {
                expect(
                    env.some(line => line.startsWith(`${name}=`)),
                    name,
                ).to.equal(false);
            }
        });
    });
});
