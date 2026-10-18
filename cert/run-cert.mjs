#!/usr/bin/env node
/**
 * Run the matter.js controller certification suite against this server.
 *
 * Usage: npm run cert -- [--tc TC-IDM-2.1] [--matterjs-ref <ref>] [--device chip-local|matterjs] [--dry-run]
 * See cert/README.md for flags, environment and prerequisites.
 * The RUN_CERT_TEST_* variables exist for testing the runner only.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CERT_DIR = process.env.RUN_CERT_TEST_DIR ?? resolve(ROOT, ".cert");
const MATTERJS_DIR = resolve(CERT_DIR, "matter.js");
const CHIP_TESTING_DIR = resolve(MATTERJS_DIR, "support/chip-testing");
const SERVER_ENTRY = resolve(ROOT, "packages/matter-server/dist/esm/MatterServer.js");
const MATTERJS_URL = process.env.RUN_CERT_TEST_MATTERJS_URL ?? "https://github.com/matter-js/matter.js";
const PACKAGE_JSON = process.env.RUN_CERT_TEST_PACKAGE_JSON ?? resolve(ROOT, "packages/matter-server/package.json");

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;
const TC_PATTERN = /^TC-[A-Za-z0-9.\-_]+$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const DEVICES = ["chip-local", "matterjs"];
// Dev builds are versioned <semver>-<yyyymmdd>-<commit>
const DEV_VERSION_PATTERN = /-\d{8}-([0-9a-f]{7,40})$/;

function fail(message) {
    console.error(`cert: ${message}`);
    process.exit(2);
}

function parseArgs(argv) {
    const options = { dryRun: false, tc: undefined, ref: undefined, device: "chip-local" };
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
            case "--device":
                options.device = value();
                break;
            default:
                fail(`unknown argument ${arg}`);
        }
    }
    return options;
}

function defaultRef() {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
    const version = pkg.dependencies?.["@matter/main"];
    if (typeof version !== "string") fail("@matter/main is not a dependency of packages/matter-server");
    return { ref: DEV_VERSION_PATTERN.exec(version)?.[1] ?? `v${version}`, source: `@matter/main ${version} of the server` };
}

function resolveRef(options) {
    const { ref, source } =
        options.ref !== undefined
            ? { ref: options.ref, source: "--matterjs-ref" }
            : process.env.MATTERJS_REF
              ? { ref: process.env.MATTERJS_REF, source: "MATTERJS_REF" }
              : defaultRef();
    if (!REF_PATTERN.test(ref) || ref.includes("..") || ref.endsWith("/") || ref.endsWith(".lock")) {
        fail(`invalid matter.js ref "${ref}"`);
    }
    console.error(`cert: matter.js ref ${ref} (${source})`);
    return ref;
}

// The matterjs test devices run in this process tree; only the CHIP apps of chip-local come from the platform.
function platformEnv(device) {
    const platform = process.env.RUN_CERT_TEST_PLATFORM ?? process.platform;
    if (platform !== "linux" && platform !== "darwin") return fail(`unsupported platform ${platform}`);
    if (device === "matterjs") return {};
    // chip-cert-bins is published for linux/arm64 only, so the harness container must run that platform too.
    if (platform === "linux") return { MATTER_CHIP_BINS_SOURCE: "cert-bins", MATTER_CHIP_PLATFORM: "linux/arm64" };
    const appDir = process.env.MATTER_CERT_APP_DIR;
    if (!appDir) fail("MATTER_CERT_APP_DIR must point to the local chip apps on macOS");
    return { MATTER_CERT_APP_DIR: appDir };
}

// The checkout must end detached at the current remote state of the ref. GitHub serves a fetch by sha only for a
// full 40-hex sha, so a short sha has to be reachable from a branch or tag.
function checkoutSteps(ref) {
    const git = (step, args, extra = {}) => ({ step, cwd: MATTERJS_DIR, command: "git", args, ...extra });
    if (!COMMIT_PATTERN.test(ref)) {
        return [
            git("fetch-ref", ["fetch", "origin", ref]),
            git("checkout", ["checkout", "--force", "--detach", "FETCH_HEAD", "--"]),
        ];
    }
    const steps = [git("fetch-all", ["fetch", "--tags", "--force", "origin"])];
    if (FULL_SHA_PATTERN.test(ref)) {
        steps.push(git("fetch-ref", ["fetch", "origin", ref], { optional: true }));
    }
    steps.push(git("checkout", ["checkout", "--force", "--detach", `${ref}^{commit}`, "--"]));
    return steps;
}

function buildSteps(options, ref, extraEnv) {
    const steps = [{ step: "build-server", cwd: ROOT, command: "npm", args: ["run", "build"] }];
    if (!existsSync(resolve(MATTERJS_DIR, ".git"))) {
        steps.push({
            step: "clone",
            cwd: ROOT,
            command: "git",
            args: ["clone", "--filter=blob:none", MATTERJS_URL, MATTERJS_DIR],
        });
    }
    steps.push(
        ...checkoutSteps(ref),
        { step: "install", cwd: MATTERJS_DIR, command: "npm", args: ["ci"] },
        { step: "build-matterjs", cwd: MATTERJS_DIR, command: "npm", args: ["run", "build"] },
    );

    const env = {
        MATTER_CERT_CONTROLLER: "matterjs-server",
        MATTER_CERT_SERVER_ENTRY: SERVER_ENTRY,
        MATTER_CERT_DEVICE: options.device,
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
if (!DEVICES.includes(options.device)) {
    fail(`invalid --device "${options.device}", expected ${DEVICES.join(" or ")}`);
}
const ref = resolveRef(options);
let steps = buildSteps(options, ref, platformEnv(options.device));
if (process.env.RUN_CERT_TEST_SOURCE_ONLY) {
    steps = steps.filter(({ step }) => step === "clone" || step.startsWith("fetch") || step === "checkout");
}
if (process.env.RUN_CERT_TEST_STEPS) {
    const only = process.env.RUN_CERT_TEST_STEPS.split(",");
    steps = steps.filter(({ step }) => only.includes(step));
}

if (options.dryRun) {
    for (const step of steps) console.log(JSON.stringify(step));
    process.exit(0);
}

// npm's description of this invocation, which would point nested npm runs at this project. Other npm_config_*
// settings and the PATH npm extended with node_modules/.bin pass.
const NPM_INVOCATION_ENV =
    /^(npm_lifecycle_|npm_package_|npm_command$|npm_execpath$|npm_node_execpath$|npm_config_local_prefix$|npm_config_user_agent$|INIT_CWD$)/;
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !NPM_INVOCATION_ENV.test(key)));

function reportEvidence() {
    console.error(
        `cert: evidence in ${resolve(CERT_DIR, "evidence")}, one <timestamp>-<test case> directory per test case ` +
            "with result.json and the controller and device logs",
    );
}

for (const { step, cwd, command, args, env, optional } of steps) {
    console.error(`cert: [${step}] ${command} ${args.join(" ")} (in ${cwd})`);
    const result = spawnSync(command, args, { cwd, stdio: "inherit", env: { ...baseEnv, ...env } });
    if (step === "test") reportEvidence();
    if (result.status !== 0) {
        const code = result.status ?? 1;
        const reason = result.error ? result.error.message : `exit code ${code}`;
        if (optional) {
            console.error(`cert: optional step "${step}" failed (${reason}), continuing`);
            continue;
        }
        console.error(`cert: step "${step}" failed (${reason})`);
        process.exit(code);
    }
}
