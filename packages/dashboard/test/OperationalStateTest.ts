/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    decodeAcceptedCommands,
    decodeOperationalCommandResponse,
    decodeOperationalError,
    describeOperationalState,
    ErrorState,
    errorStateLabel,
    OperationalCommand,
    OperationalState,
    OPERATIONAL_STATE_CLUSTER_ID,
    OPERATIONAL_STATE_VARIANTS,
    OVEN_CAVITY_OPERATIONAL_STATE_CLUSTER_ID,
    RVC_OPERATIONAL_STATE_CLUSTER_ID,
    RvcErrorState,
    RvcOperationalState,
} from "../src/util/operational-state.js";

function variant(clusterId: number) {
    const found = OPERATIONAL_STATE_VARIANTS[clusterId];
    if (found === undefined) throw new Error(`No variant for cluster ${clusterId}`);
    return found;
}

const BASE = variant(OPERATIONAL_STATE_CLUSTER_ID);
const RVC = variant(RVC_OPERATIONAL_STATE_CLUSTER_ID);
const OVEN = variant(OVEN_CAVITY_OPERATIONAL_STATE_CLUSTER_ID);

describe("Operational State", () => {
    describe("variants", () => {
        it("offers the commands each derivation allows", () => {
            expect(BASE.commands.map(command => command.id)).to.deep.equal([
                OperationalCommand.Start,
                OperationalCommand.Stop,
                OperationalCommand.Pause,
                OperationalCommand.Resume,
            ]);
            expect(RVC.commands.map(command => command.id)).to.deep.equal([
                OperationalCommand.Pause,
                OperationalCommand.Resume,
                OperationalCommand.GoHome,
            ]);
            expect(OVEN.commands.map(command => command.id)).to.deep.equal([
                OperationalCommand.Start,
                OperationalCommand.Stop,
            ]);
        });

        it("covers exactly the OperationalState cluster and its derivations", () => {
            expect(
                Object.keys(OPERATIONAL_STATE_VARIANTS)
                    .map(Number)
                    .sort((a, b) => a - b),
            ).to.deep.equal([0x48, 0x60, 0x61]);
            expect([OVEN.clusterId, BASE.clusterId, RVC.clusterId]).to.deep.equal([0x48, 0x60, 0x61]);
        });
    });

    describe("describeOperationalState", () => {
        it("maps the base states for every variant", () => {
            for (const variant of [BASE, RVC, OVEN]) {
                expect(describeOperationalState(variant, OperationalState.Stopped)).to.equal("Stopped");
                expect(describeOperationalState(variant, OperationalState.Running)).to.equal("Running");
                expect(describeOperationalState(variant, OperationalState.Paused)).to.equal("Paused");
                expect(describeOperationalState(variant, OperationalState.Error)).to.equal("Error");
            }
        });

        it("maps the RVC states 64-70 only for the RVC variant", () => {
            const rvcStates: [number, string][] = [
                [RvcOperationalState.SeekingCharger, "Seeking Charger"],
                [RvcOperationalState.Charging, "Charging"],
                [RvcOperationalState.Docked, "Docked"],
                [RvcOperationalState.EmptyingDustBin, "Emptying Dust Bin"],
                [RvcOperationalState.CleaningMop, "Cleaning Mop"],
                [RvcOperationalState.FillingWaterTank, "Filling Water Tank"],
                [RvcOperationalState.UpdatingMaps, "Updating Maps"],
            ];
            for (const [id, label] of rvcStates) {
                expect(describeOperationalState(RVC, id)).to.equal(label);
                expect(describeOperationalState(BASE, id)).to.equal(`Unknown (${id})`);
            }
        });

        it("returns null for an absent attribute", () => {
            expect(describeOperationalState(BASE, undefined)).to.be.null;
            expect(describeOperationalState(BASE, null)).to.be.null;
        });

        it("uses the OperationalStateList label for a manufacturer-specific id", () => {
            const stateList = [{ "0": 128, "1": "Sanitising" }];
            expect(describeOperationalState(BASE, 128, stateList)).to.equal("Sanitising");
            expect(describeOperationalState(BASE, 129, stateList)).to.equal("Unknown (129)");
        });

        it("prefers the enum name over a list entry for a known id", () => {
            const stateList = [{ "0": OperationalState.Running, "1": "Busy" }];
            expect(describeOperationalState(BASE, OperationalState.Running, stateList)).to.equal("Running");
        });
    });

    describe("errorStateLabel", () => {
        it("maps the base errors for every variant", () => {
            for (const variant of [BASE, RVC, OVEN]) {
                expect(errorStateLabel(variant, ErrorState.NoError)).to.equal("No Error");
                expect(errorStateLabel(variant, ErrorState.CommandInvalidInState)).to.equal(
                    "Command Invalid in Current State",
                );
            }
        });

        it("maps the RVC errors only for the RVC variant", () => {
            expect(errorStateLabel(RVC, RvcErrorState.Stuck)).to.equal("Stuck");
            expect(errorStateLabel(RVC, RvcErrorState.NavigationSensorObscured)).to.equal("Navigation Sensor Obscured");
            expect(errorStateLabel(OVEN, RvcErrorState.Stuck)).to.equal(`Unknown (${RvcErrorState.Stuck})`);
        });

        it("uses the device label only for an id the enum does not know", () => {
            expect(errorStateLabel(BASE, 130, "Door Open")).to.equal("Door Open");
            expect(errorStateLabel(BASE, ErrorState.NoError, "All Good")).to.equal("No Error");
        });
    });

    describe("decodeOperationalError", () => {
        it("reads the ErrorStateStruct from its field-tag-keyed wire shape", () => {
            const info = decodeOperationalError(RVC, { "0": RvcErrorState.DustBinFull, "2": "empty the bin" });
            expect(info).to.deep.equal({
                errorStateId: RvcErrorState.DustBinFull,
                isError: true,
                label: "Dust Bin Full",
                details: "empty the bin",
            });
        });

        it("does not flag NoError as an error", () => {
            expect(decodeOperationalError(BASE, { "0": ErrorState.NoError })?.isError).to.be.false;
        });

        it("reads the ErrorStateLabel (tag 1) for a manufacturer-specific id", () => {
            expect(decodeOperationalError(BASE, { "0": 131, "1": "Bin Not Seated" })?.label).to.equal("Bin Not Seated");
        });

        it("returns null when the attribute is absent or malformed", () => {
            expect(decodeOperationalError(BASE, undefined)).to.be.null;
            expect(decodeOperationalError(BASE, null)).to.be.null;
            expect(decodeOperationalError(BASE, {})).to.be.null;
        });
    });

    describe("decodeOperationalCommandResponse", () => {
        it("reports success when commandResponseState is NoError", () => {
            const outcome = decodeOperationalCommandResponse(BASE, {
                commandResponseState: { errorStateID: ErrorState.NoError },
            });
            expect(outcome.isError).to.be.false;
            expect(outcome.label).to.equal("No Error");
        });

        it("reads the wire key errorStateID and falls back to the legacy errorStateId", () => {
            const both = decodeOperationalCommandResponse(BASE, {
                commandResponseState: {
                    errorStateID: ErrorState.CommandInvalidInState,
                    errorStateId: ErrorState.UnableToStartOrResume,
                },
            });
            expect(both.errorStateId).to.equal(ErrorState.CommandInvalidInState);
            const legacy = decodeOperationalCommandResponse(BASE, {
                commandResponseState: { errorStateId: ErrorState.CommandInvalidInState },
            });
            expect(legacy.errorStateId).to.equal(ErrorState.CommandInvalidInState);
        });

        it("surfaces a rejected command with the variant's label and details", () => {
            const outcome = decodeOperationalCommandResponse(RVC, {
                commandResponseState: { errorStateID: RvcErrorState.Stuck, errorStateDetails: "left wheel" },
            });
            expect(outcome).to.deep.equal({
                errorStateId: RvcErrorState.Stuck,
                isError: true,
                label: "Stuck",
                details: "left wheel",
            });
        });

        it("keeps the errorStateLabel for a manufacturer-specific rejection", () => {
            const outcome = decodeOperationalCommandResponse(BASE, {
                commandResponseState: { errorStateID: 131, errorStateLabel: "Bin Not Seated" },
            });
            expect(outcome.label).to.equal("Bin Not Seated");
        });

        it("throws when the response carries no command response state, instead of reading as success", () => {
            expect(() => decodeOperationalCommandResponse(BASE, undefined)).to.throw("no command response state");
            expect(() => decodeOperationalCommandResponse(BASE, {})).to.throw("no command response state");
            expect(() => decodeOperationalCommandResponse(BASE, { commandResponseState: {} })).to.throw(
                "no command response state",
            );
        });
    });

    describe("decodeAcceptedCommands", () => {
        it("collects the advertised command ids into a set", () => {
            const ids = decodeAcceptedCommands([OperationalCommand.Pause, OperationalCommand.GoHome]);
            expect(ids?.has(OperationalCommand.Pause)).to.be.true;
            expect(ids?.has(OperationalCommand.GoHome)).to.be.true;
            expect(ids?.has(OperationalCommand.Resume)).to.be.false;
        });

        it("returns undefined while the attribute is not reported, so the panel does not hide every command", () => {
            expect(decodeAcceptedCommands(undefined)).to.equal(undefined);
            expect(decodeAcceptedCommands(null)).to.equal(undefined);
            expect(decodeAcceptedCommands("nope")).to.equal(undefined);
        });
    });
});
