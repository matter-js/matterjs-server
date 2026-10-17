/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Minutes, Seconds } from "@matter/main";
import { InvalidArgumentError } from "commander";
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import {
    bluetoothAdapterFrom,
    parseBluetoothAdapterOption,
    parseCliArgs,
    parseCustomClusterPollIntervalOption,
    parseListenAddressList,
    parseTcpPortOption,
} from "../src/cli.js";
import { controllerOptionsFrom } from "../src/controller-options.js";

/** Commander skips the first two entries of a parsed argv. */
function argv(...args: string[]): string[] {
    return ["node", "matter-server", ...args];
}

describe("cli", () => {
    // parseCliArgs reads the ambient environment, and this repo's documented test command exports env vars.
    const isolatedEnv = [
        "DISABLE_AUTO_SUBSCRIPTION",
        "LISTEN_ADDRESS",
        "CUSTOM_CLUSTER_POLL_INTERVAL",
        "THREAD_REST_PROBE_PORT",
        "DCL_OFFLINE",
        "DISABLE_DCL_SEED",
        "REVOCATION_SETS_DIR",
        "CERTIFICATES_DIR",
        "BLUETOOTH_ADAPTER",
    ];
    const savedEnv = new Map<string, string | undefined>();

    before(() => {
        for (const name of isolatedEnv) {
            savedEnv.set(name, process.env[name]);
            delete process.env[name];
        }
    });

    after(() => {
        for (const [name, value] of savedEnv) {
            if (value === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = value;
            }
        }
    });

    // Literals, not the constants under test: these are the bounds docs/cli.md advertises, so a change to
    // either bound must fail here rather than silently redefine what is documented.
    describe("--custom-cluster-poll-interval", () => {
        it("defaults to 60 seconds", () => {
            expect(parseCliArgs(argv()).customClusterPollInterval).to.equal(60);
        });

        it("accepts a value above the minimum", () => {
            expect(parseCliArgs(argv("--custom-cluster-poll-interval", "600")).customClusterPollInterval).to.equal(600);
        });

        it("accepts the documented minimum and maximum", () => {
            expect(parseCustomClusterPollIntervalOption("60")).to.equal(60);
            expect(parseCustomClusterPollIntervalOption("86400")).to.equal(86400);
        });

        // Rejected rather than clamped: silently polling at a cadence the operator did not ask for is worse
        // than refusing to start.
        it("rejects a value below the minimum", () => {
            expect(() => parseCustomClusterPollIntervalOption("59")).to.throw(InvalidArgumentError);
            expect(() => parseCustomClusterPollIntervalOption("0")).to.throw(InvalidArgumentError);
        });

        it("rejects a value above the maximum", () => {
            expect(() => parseCustomClusterPollIntervalOption("86401")).to.throw(InvalidArgumentError);
        });

        it("rejects a non-numeric value", () => {
            expect(() => parseCustomClusterPollIntervalOption("often")).to.throw(InvalidArgumentError);
        });

        // Commander exits the process on a rejected value, so whether the validator is attached to the
        // option at all can only be observed from outside this one.
        it("routes the option through the validator", () => {
            const cli = JSON.stringify(import.meta.resolve("../src/cli.js"));
            const result = spawnSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `const m = await import(${cli}); m.parseCliArgs(["node", "matter-server", "--custom-cluster-poll-interval", "59"]);`,
                ],
                { encoding: "utf8" },
            );

            expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(1);
            expect(result.stderr).to.include("between 60 and 86400");
        });
    });

    describe("--thread-rest-probe-port", () => {
        it("is unset by default so the controller default applies", () => {
            expect(parseCliArgs(argv()).threadRestProbePort).to.equal(null);
        });

        it("accepts a port", () => {
            expect(parseCliArgs(argv("--thread-rest-probe-port", "8080")).threadRestProbePort).to.equal(8080);
        });

        it("reads the port from the environment", () => {
            process.env.THREAD_REST_PROBE_PORT = "8080";
            try {
                expect(parseCliArgs(argv()).threadRestProbePort).to.equal(8080);
            } finally {
                delete process.env.THREAD_REST_PROBE_PORT;
            }
        });

        it("accepts the bounds of the TCP port range", () => {
            expect(parseTcpPortOption("1")).to.equal(1);
            expect(parseTcpPortOption("65535")).to.equal(65535);
        });

        it("rejects a port outside the TCP port range", () => {
            expect(() => parseTcpPortOption("0")).to.throw(InvalidArgumentError);
            expect(() => parseTcpPortOption("65536")).to.throw(InvalidArgumentError);
        });

        it("rejects a non-numeric value", () => {
            expect(() => parseTcpPortOption("rest")).to.throw(InvalidArgumentError);
        });

        it("rejects a value that only starts with digits", () => {
            expect(() => parseTcpPortOption("8080abc")).to.throw(InvalidArgumentError);
            expect(() => parseTcpPortOption("1e4")).to.throw(InvalidArgumentError);
        });
    });

    describe("--disable-auto-subscription", () => {
        it("defaults to false", () => {
            expect(parseCliArgs(argv()).disableAutoSubscription).to.equal(false);
        });

        it("is set by the flag", () => {
            expect(parseCliArgs(argv("--disable-auto-subscription")).disableAutoSubscription).to.equal(true);
            expect(parseCliArgs(argv("--disable-auto-subscription", "false")).disableAutoSubscription).to.equal(false);
        });

        it("is set by the environment", () => {
            process.env.DISABLE_AUTO_SUBSCRIPTION = "true";
            try {
                expect(parseCliArgs(argv()).disableAutoSubscription).to.equal(true);
            } finally {
                delete process.env.DISABLE_AUTO_SUBSCRIPTION;
            }
        });

        it("reaches the controller options", () => {
            const cliOptions = parseCliArgs(argv("--disable-auto-subscription"));
            expect(controllerOptionsFrom(cliOptions, "server", "1.2.3").disableAutoSubscription).to.equal(true);
        });
    });

    describe("--dcl-offline", () => {
        it("defaults to false", () => {
            expect(parseCliArgs(argv()).dclOffline).to.equal(false);
        });

        it("is set by the flag and the environment", () => {
            expect(parseCliArgs(argv("--dcl-offline")).dclOffline).to.equal(true);
            process.env.DCL_OFFLINE = "true";
            try {
                expect(parseCliArgs(argv()).dclOffline).to.equal(true);
            } finally {
                delete process.env.DCL_OFFLINE;
            }
        });

        it("reaches the controller options", () => {
            const cliOptions = parseCliArgs(argv("--dcl-offline"));
            expect(controllerOptionsFrom(cliOptions, "server", "1.2.3").dclOffline).to.equal(true);
        });

        it("cannot be combined with --disable-dcl-seed", () => {
            const cli = JSON.stringify(import.meta.resolve("../src/cli.js"));
            const result = spawnSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `const m = await import(${cli}); m.parseCliArgs(["node", "matter-server", "--dcl-offline", "--disable-dcl-seed"]);`,
                ],
                { encoding: "utf8" },
            );

            expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(1);
            expect(result.stderr).to.include("cannot be combined with --disable-dcl-seed");
        });

        it("accepts both options set to false", () => {
            process.env.DCL_OFFLINE = "false";
            process.env.DISABLE_DCL_SEED = "false";
            try {
                const cliOptions = parseCliArgs(argv("--dcl-offline", "false", "--disable-dcl-seed", "false"));
                expect([cliOptions.dclOffline, cliOptions.disableDclSeed]).deep.equals([false, false]);
            } finally {
                delete process.env.DCL_OFFLINE;
                delete process.env.DISABLE_DCL_SEED;
            }
        });
    });

    describe("--revocation-sets-dir", () => {
        it("is unset by default", () => {
            expect(parseCliArgs(argv()).revocationSetsDir).to.equal(null);
        });

        it("is set by the option and the environment", () => {
            expect(parseCliArgs(argv("--revocation-sets-dir", "/sets")).revocationSetsDir).to.equal("/sets");
            process.env.REVOCATION_SETS_DIR = "/env-sets";
            try {
                expect(parseCliArgs(argv()).revocationSetsDir).to.equal("/env-sets");
            } finally {
                delete process.env.REVOCATION_SETS_DIR;
            }
        });

        // Characterization: the options are independent, so nothing rejects the combination.
        it("combines with --dcl-offline and --enable-test-net-dcl", () => {
            const options = parseCliArgs(
                argv("--revocation-sets-dir", "/sets", "--dcl-offline", "--enable-test-net-dcl"),
            );
            expect([options.revocationSetsDir, options.dclOffline, options.enableTestNetDcl]).deep.equals([
                "/sets",
                true,
                true,
            ]);
        });
    });

    describe("--certificates-dir", () => {
        it("is unset by default", () => {
            expect(parseCliArgs(argv()).certificatesDir).to.equal(null);
        });

        it("is set by the option and the environment", () => {
            expect(parseCliArgs(argv("--certificates-dir", "/certs")).certificatesDir).to.equal("/certs");
            process.env.CERTIFICATES_DIR = "/env-certs";
            try {
                expect(parseCliArgs(argv()).certificatesDir).to.equal("/env-certs");
            } finally {
                delete process.env.CERTIFICATES_DIR;
            }
        });
    });

    describe("--bluetooth-adapter", () => {
        /** A missing ID ends the process through `program.error`, so the bare flag is parsed in a child process. */
        function parseCliArgsInChild(script: string, env: Record<string, string> = {}) {
            const cli = JSON.stringify(import.meta.resolve("../src/cli.js"));
            return spawnSync(
                process.execPath,
                ["--input-type=module", "-e", `const m = await import(${cli}); ${script}`],
                { encoding: "utf8", env: { ...process.env, ...env } },
            );
        }

        it("is unset by default", () => {
            expect(parseCliArgs(argv()).bluetoothAdapter).to.equal(null);
        });

        it("uses the given HCI ID on every platform", () => {
            expect(parseCliArgs(argv("--bluetooth-adapter", "1")).bluetoothAdapter).to.equal(1);
            expect(bluetoothAdapterFrom(1, "linux")).to.equal(1);
            expect(bluetoothAdapterFrom(1, "win32")).to.equal(1);
        });

        it("parses an HCI ID or a boolean", () => {
            expect(parseBluetoothAdapterOption("1")).to.equal(1);
            expect(parseBluetoothAdapterOption(" 0 ")).to.equal(0);
            for (const value of ["true", "TRUE", "yes", "on"]) {
                expect(parseBluetoothAdapterOption(value)).to.equal(true);
            }
            for (const value of ["", "false", "no", "off"]) {
                expect(parseBluetoothAdapterOption(value)).to.equal(false);
            }
            expect(() => parseBluetoothAdapterOption("hci0")).to.throw(InvalidArgumentError, "Expected an HCI ID");
        });

        it("leaves BLE off for false on every platform", () => {
            expect(bluetoothAdapterFrom(false, "linux")).to.equal(null);
            expect(bluetoothAdapterFrom(false, "darwin")).to.equal(null);
        });

        it("reads BLUETOOTH_ADAPTER=true like the flag without an ID", () => {
            const result = parseCliArgsInChild(
                "console.log(m.parseCliArgs(['node', 'matter-server']).bluetoothAdapter);",
                { BLUETOOTH_ADAPTER: "true" },
            );

            if (process.platform === "win32" || process.platform === "darwin") {
                expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(0);
                expect(result.stdout.trim()).to.equal("0");
            } else {
                expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(1);
                expect(result.stderr).to.include("--bluetooth-adapter needs the HCI ID");
            }
        });

        it("reads an empty BLUETOOTH_ADAPTER as BLE off", () => {
            const result = parseCliArgsInChild(
                "console.log(m.parseCliArgs(['node', 'matter-server']).bluetoothAdapter);",
                { BLUETOOTH_ADAPTER: "" },
            );

            expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(0);
            expect(result.stdout.trim()).to.equal("null");
        });

        it("uses HCI ID 0 on Windows and macOS when given without an ID", () => {
            expect(bluetoothAdapterFrom(true, "win32")).to.equal(0);
            expect(bluetoothAdapterFrom(true, "darwin")).to.equal(0);
        });

        it("enables BLE without an ID on this platform if it has no HCI IDs", function () {
            if (process.platform !== "win32" && process.platform !== "darwin") this.skip();
            const result = parseCliArgsInChild(
                "console.log(m.parseCliArgs(['node', 'matter-server', '--bluetooth-adapter']).bluetoothAdapter);",
            );

            expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(0);
            expect(result.stdout.trim()).to.equal("0");
        });

        it("needs an HCI ID on other platforms", () => {
            for (const platform of ["linux", "freebsd"] as const) {
                expect(() => bluetoothAdapterFrom(true, platform)).to.throw(InvalidArgumentError, "needs the HCI ID");
            }
        });

        it("exits with an error when given without an ID outside Windows and macOS", function () {
            if (process.platform === "win32" || process.platform === "darwin") this.skip();
            const result = parseCliArgsInChild("m.parseCliArgs(['node', 'matter-server', '--bluetooth-adapter']);");

            expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).to.equal(1);
            expect(result.stderr).to.include("--bluetooth-adapter needs the HCI ID");
        });
    });

    describe("LISTEN_ADDRESS", () => {
        function withListenAddressEnv(value: string, run: () => void) {
            process.env.LISTEN_ADDRESS = value;
            try {
                run();
            } finally {
                delete process.env.LISTEN_ADDRESS;
            }
        }

        it("splits a comma-separated list, trimming spaces and dropping empty entries", () => {
            expect(parseListenAddressList(" 127.0.0.1, ::1 ,,192.168.1.10,")).to.deep.equal([
                "127.0.0.1",
                "::1",
                "192.168.1.10",
            ]);
        });

        it("binds every address from the environment", () => {
            withListenAddressEnv("127.0.0.1,::1", () => {
                expect(parseCliArgs(argv()).listenAddress).to.deep.equal(["127.0.0.1", "::1"]);
            });
        });

        it("binds all interfaces when the environment value holds no address", () => {
            withListenAddressEnv(" , ", () => {
                expect(parseCliArgs(argv()).listenAddress).to.equal(null);
            });
        });

        it("binds an address listed twice, directly and through its interface, only once", function () {
            const loopback = Object.entries(networkInterfaces()).find(([, addresses]) =>
                addresses?.some(address => address.address === "127.0.0.1"),
            );
            if (loopback === undefined) this.skip();
            const [name] = loopback;
            withListenAddressEnv(`${name},127.0.0.1`, () => {
                const addresses = parseCliArgs(argv()).listenAddress ?? [];
                expect(addresses.filter(address => address === "127.0.0.1")).to.have.length(1);
            });
        });

        it("lets the CLI option take precedence over the environment", () => {
            withListenAddressEnv("127.0.0.1,::1", () => {
                expect(parseCliArgs(argv("--listen-address", "10.0.0.1")).listenAddress).to.deep.equal(["10.0.0.1"]);
            });
        });
    });

    describe("controllerOptionsFrom", () => {
        function options(overrides: Partial<ReturnType<typeof parseCliArgs>> = {}) {
            return controllerOptionsFrom({ ...parseCliArgs(argv()), ...overrides }, "server", "1.2.3");
        }

        // The CLI carries seconds and the controller takes a Duration, so this is the one place a unit
        // slip can hide; the poller's own minimum would mask it as merely a slow cadence.
        it("converts the poll interval from seconds to a Duration", () => {
            expect(options().customClusterPollInterval).to.equal(Minutes(1));
            expect(options({ customClusterPollInterval: 600 }).customClusterPollInterval).to.equal(Minutes(10));
            expect(options({ customClusterPollInterval: 86400 }).customClusterPollInterval).to.equal(Seconds(86400));
        });

        it("passes the REST probe port through, leaving it undefined when unset", () => {
            expect(options().threadRestProbePort).to.equal(undefined);
            expect(options({ threadRestProbePort: 8080 }).threadRestProbePort).to.equal(8080);
        });

        it("converts the OTA upload limit from MB to bytes", () => {
            expect(options({ otaUploadMaxSizeMb: 64 }).otaUpload?.maxSizeBytes).to.equal(67_108_864);
        });
    });
});
