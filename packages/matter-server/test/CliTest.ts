/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Minutes, Seconds } from "@matter/main";
import { InvalidArgumentError } from "commander";
import { spawnSync } from "node:child_process";
import { parseCliArgs, parseCustomClusterPollIntervalOption } from "../src/cli.js";
import { controllerOptionsFrom } from "../src/controller-options.js";

/** Commander skips the first two entries of a parsed argv. */
function argv(...args: string[]): string[] {
    return ["node", "matter-server", ...args];
}

describe("cli", () => {
    // parseCliArgs reads the ambient environment, and this repo's documented test command exports env vars.
    let savedEnv: string | undefined;

    before(() => {
        savedEnv = process.env.CUSTOM_CLUSTER_POLL_INTERVAL;
        delete process.env.CUSTOM_CLUSTER_POLL_INTERVAL;
    });

    after(() => {
        if (savedEnv === undefined) {
            delete process.env.CUSTOM_CLUSTER_POLL_INTERVAL;
        } else {
            process.env.CUSTOM_CLUSTER_POLL_INTERVAL = savedEnv;
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

        it("converts the OTA upload limit from MB to bytes", () => {
            expect(options({ otaUploadMaxSizeMb: 64 }).otaUpload?.maxSizeBytes).to.equal(67_108_864);
        });
    });
});
