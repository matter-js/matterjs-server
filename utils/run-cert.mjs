#!/usr/bin/env node
/**
 * Run the matter.js controller certification suite against this server.
 *
 * Usage: npm run cert -- [--tc TC-IDM-2.1] [--matterjs-ref <ref>] [--dry-run]
 * See DEVELOPMENT.md ("Certification tests") for flags, environment and prerequisites.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CERT_DIR = resolve(ROOT, ".cert");
const MATTERJS_DIR = resolve(CERT_DIR, "matter.js");
const CHIP_TESTING_DIR = resolve(MATTERJS_DIR, "support/chip-testing");
const SERVER_ENTRY = resolve(ROOT, "packages/matter-server/dist/esm/MatterServer.js");
const MATTERJS_URL = "https://github.com/matter-js/matter.js";

const TC_PATTERN = /^TC-[A-Za-z0-9.\-_]+$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
// Dev builds are versioned <semver>-<yyyymmdd>-<commit>
const DEV_VERSION_PATTERN = /-\d{8}-([0-9a-f]{7,40})$/;

function fail(message) {
    console.error(`cert: ${message}`);
    process.exit(2);
}

function parseArgs(argv) {
    const options = { dryRun: false, tc: undefined, ref: undefined };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const [flag, inlineValue] = arg.startsWith("--") ? arg.split(/=(.*)/s, 2) : [arg];
        const value = () => {
            if (inlineValue !== undefined) return inlineValue;
            const next = argv[++i];
            if (next === undefined) fail(`${flag} needs a value`);
            return next;
        };
        switch (flag) {
            case "--dry-run":
                options.dryRun = true;
                break;
            case "--tc":
                options.tc = value();
                break;
            case "--matterjs-ref":
                options.ref = value();
                break;
            default:
                fail(`unknown argument ${arg}`);
        }
    }
    return options;
}

function defaultRef() {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "packages/matter-server/package.json"), "utf8"));
    const version = pkg.dependencies?.["@matter/main"];
    if (typeof version !== "string") fail("@matter/main is not a dependency of packages/matter-server");
    return DEV_VERSION_PATTERN.exec(version)?.[1] ?? `v${version}`;
}

function resolveRef(options) {
    const ref = options.ref ?? (process.env.MATTERJS_REF || defaultRef());
    if (!REF_PATTERN.test(ref) || ref.includes("..") || ref.endsWith("/") || ref.endsWith(".lock")) {
        fail(`invalid matter.js ref "${ref}"`);
    }
    return ref;
}

function platformEnv() {
    const platform = process.env.CERT_PLATFORM ?? process.platform;
    if (platform === "linux") return { MATTER_CHIP_BINS_SOURCE: "cert-bins" };
    if (platform === "darwin") {
        const appDir = process.env.MATTER_CERT_APP_DIR;
        if (!appDir) fail("MATTER_CERT_APP_DIR must point to the local chip apps on macOS");
        return { MATTER_CERT_APP_DIR: appDir };
    }
    return fail(`unsupported platform ${platform}`);
}

function buildSteps(options, ref, extraEnv) {
    const steps = [{ step: "build-server", cwd: ROOT, command: "npm", args: ["run", "build"] }];
    steps.push(
        existsSync(resolve(MATTERJS_DIR, ".git"))
            ? { step: "fetch", cwd: MATTERJS_DIR, command: "git", args: ["fetch", "origin"] }
            : {
                  step: "clone",
                  cwd: ROOT,
                  command: "git",
                  args: ["clone", "--filter=blob:none", MATTERJS_URL, MATTERJS_DIR],
              },
        { step: "checkout", cwd: MATTERJS_DIR, command: "git", args: ["checkout", "--detach", ref] },
        { step: "install", cwd: MATTERJS_DIR, command: "npm", args: ["ci"] },
        { step: "build-matterjs", cwd: MATTERJS_DIR, command: "npm", args: ["run", "build"] },
    );

    const env = {
        MATTER_CERT_CONTROLLER: "matterjs-server",
        MATTER_CERT_SERVER_ENTRY: SERVER_ENTRY,
        MATTER_CERT_DEVICE: "chip-local",
        MATTER_CERT_EVIDENCE_DIR: resolve(CERT_DIR, "evidence"),
        ...extraEnv,
    };
    if (options.tc === undefined) {
        steps.push({ step: "test", cwd: CHIP_TESTING_DIR, command: "npm", args: ["run", "test-cert"], env });
    } else {
        // Keep in step with the "test-cert" script of support/chip-testing
        steps.push({
            step: "test",
            cwd: CHIP_TESTING_DIR,
            command: "npx",
            args: ["matter-test", `--spec=test/cert/${options.tc}.test.ts`, "--report"],
            env: { ...env, MATTER_TEST_SHUTDOWN_TIMEOUT_MS: "15000" },
        });
    }
    return steps;
}

const options = parseArgs(process.argv.slice(2));
if (options.tc !== undefined && !TC_PATTERN.test(options.tc)) {
    fail(`invalid --tc "${options.tc}", expected e.g. TC-IDM-2.1`);
}
const ref = resolveRef(options);
const steps = buildSteps(options, ref, platformEnv());

if (options.dryRun) {
    for (const step of steps) console.log(JSON.stringify(step));
    process.exit(0);
}

for (const { step, cwd, command, args, env } of steps) {
    console.error(`cert: [${step}] ${command} ${args.join(" ")} (in ${cwd})`);
    const result = spawnSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
    if (result.status !== 0) {
        const code = result.status ?? 1;
        const reason = result.error ? result.error.message : `exit code ${code}`;
        console.error(`cert: step "${step}" failed (${reason})`);
        process.exit(code);
    }
}
