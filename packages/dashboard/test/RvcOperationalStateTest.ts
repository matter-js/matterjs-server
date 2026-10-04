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
    OperationalState,
    operationalStateLabel,
    RvcOperationalCommand,
} from "../src/util/rvc-operational-state.js";

describe("RVC Operational State", () => {
    describe("describeOperationalState", () => {
        it("maps the base and RVC-specific states to their spec labels", () => {
            expect(describeOperationalState(OperationalState.Stopped)).to.equal("Stopped");
            expect(describeOperationalState(OperationalState.Running)).to.equal("Running");
            expect(describeOperationalState(OperationalState.Paused)).to.equal("Paused");
            expect(describeOperationalState(OperationalState.Error)).to.equal("Error");
            expect(describeOperationalState(OperationalState.SeekingCharger)).to.equal("Seeking Charger");
            expect(describeOperationalState(OperationalState.Charging)).to.equal("Charging");
            expect(describeOperationalState(OperationalState.Docked)).to.equal("Docked");
            expect(describeOperationalState(OperationalState.EmptyingDustBin)).to.equal("Emptying Dust Bin");
            expect(describeOperationalState(OperationalState.CleaningMop)).to.equal("Cleaning Mop");
            expect(describeOperationalState(OperationalState.FillingWaterTank)).to.equal("Filling Water Tank");
            expect(describeOperationalState(OperationalState.UpdatingMaps)).to.equal("Updating Maps");
        });

        it("uses the RVC enum values 64/65/66 for the charging states", () => {
            expect(operationalStateLabel(64)).to.equal("Seeking Charger");
            expect(operationalStateLabel(65)).to.equal("Charging");
            expect(operationalStateLabel(66)).to.equal("Docked");
        });

        it("returns null for an absent attribute", () => {
            expect(describeOperationalState(undefined)).to.be.null;
            expect(describeOperationalState(null)).to.be.null;
        });

        it("labels unknown numeric states instead of dropping them", () => {
            expect(describeOperationalState(99)).to.equal("Unknown (99)");
        });

        it("uses the OperationalStateList label for a manufacturer-specific id", () => {
            const stateList = [{ "0": 128, "1": "Sanitising" }];
            expect(describeOperationalState(128, stateList)).to.equal("Sanitising");
        });

        it("prefers the enum name over a list entry for a known id", () => {
            const stateList = [{ "0": OperationalState.Charging, "1": "Topping Up" }];
            expect(describeOperationalState(OperationalState.Charging, stateList)).to.equal("Charging");
        });
    });

    describe("errorStateLabel", () => {
        it("maps the spec error ids to their labels", () => {
            expect(errorStateLabel(ErrorState.NoError)).to.equal("No Error");
            expect(errorStateLabel(ErrorState.UnableToStartOrResume)).to.equal("Unable to Start or Resume");
            expect(errorStateLabel(ErrorState.UnableToCompleteOperation)).to.equal("Unable to Complete Operation");
            expect(errorStateLabel(ErrorState.CommandInvalidInState)).to.equal("Command Invalid in Current State");
            expect(errorStateLabel(ErrorState.Stuck)).to.equal("Stuck");
            expect(errorStateLabel(ErrorState.DustBinFull)).to.equal("Dust Bin Full");
        });

        it("labels unknown error ids", () => {
            expect(errorStateLabel(200)).to.equal("Unknown (200)");
        });

        it("uses the device-supplied label for a manufacturer-specific id", () => {
            expect(errorStateLabel(130, "Side Brush Tangled")).to.equal("Side Brush Tangled");
        });
    });

    describe("decodeOperationalError", () => {
        it("reads the ErrorStateStruct from its field-tag-keyed wire shape", () => {
            const decoded = decodeOperationalError({ "0": ErrorState.Stuck, "2": "left wheel blocked" });
            expect(decoded).to.not.be.null;
            expect(decoded?.errorStateId).to.equal(ErrorState.Stuck);
            expect(decoded?.isError).to.be.true;
            expect(decoded?.label).to.equal("Stuck");
            expect(decoded?.details).to.equal("left wheel blocked");
        });

        it("does not flag NoError as an error", () => {
            const decoded = decodeOperationalError({ "0": ErrorState.NoError });
            expect(decoded?.errorStateId).to.equal(0);
            expect(decoded?.isError).to.be.false;
            expect(decoded?.label).to.equal("No Error");
        });

        it("reads the ErrorStateLabel (tag 1) for a manufacturer-specific id", () => {
            const decoded = decodeOperationalError({ "0": 130, "1": "Side Brush Tangled", "2": "rear brush" });
            expect(decoded?.errorStateId).to.equal(130);
            expect(decoded?.isError).to.be.true;
            expect(decoded?.label).to.equal("Side Brush Tangled");
            expect(decoded?.details).to.equal("rear brush");
        });

        it("returns null when the attribute is absent or malformed", () => {
            expect(decodeOperationalError(undefined)).to.be.null;
            expect(decodeOperationalError(null)).to.be.null;
            expect(decodeOperationalError({})).to.be.null;
        });
    });

    describe("decodeOperationalCommandResponse", () => {
        it("reports success when commandResponseState is NoError", () => {
            const outcome = decodeOperationalCommandResponse({
                commandResponseState: { errorStateID: ErrorState.NoError },
            });
            expect(outcome.isError).to.be.false;
            expect(outcome.label).to.equal("No Error");
        });

        it("reads the wire key errorStateID and falls back to the legacy errorStateId", () => {
            const both = decodeOperationalCommandResponse({
                commandResponseState: {
                    errorStateID: ErrorState.CommandInvalidInState,
                    errorStateId: ErrorState.UnableToStartOrResume,
                },
            });
            expect(both.errorStateId).to.equal(ErrorState.CommandInvalidInState);
            const legacy = decodeOperationalCommandResponse({
                commandResponseState: { errorStateId: ErrorState.CommandInvalidInState },
            });
            expect(legacy.errorStateId).to.equal(ErrorState.CommandInvalidInState);
        });

        it("surfaces a rejected command whose invoke otherwise succeeded", () => {
            const outcome = decodeOperationalCommandResponse({
                commandResponseState: {
                    errorStateID: ErrorState.CommandInvalidInState,
                    errorStateDetails: "already docked",
                },
            });
            expect(outcome.isError).to.be.true;
            expect(outcome.errorStateId).to.equal(ErrorState.CommandInvalidInState);
            expect(outcome.label).to.equal("Command Invalid in Current State");
            expect(outcome.details).to.equal("already docked");
        });

        it("keeps the errorStateLabel for a manufacturer-specific rejection", () => {
            const outcome = decodeOperationalCommandResponse({
                commandResponseState: { errorStateID: 131, errorStateLabel: "Bin Not Seated" },
            });
            expect(outcome.isError).to.be.true;
            expect(outcome.errorStateId).to.equal(131);
            expect(outcome.label).to.equal("Bin Not Seated");
        });

        it("throws when the response carries no command response state, instead of reading as success", () => {
            expect(() => decodeOperationalCommandResponse(undefined)).to.throw("no command response state");
            expect(() => decodeOperationalCommandResponse({})).to.throw("no command response state");
            expect(() => decodeOperationalCommandResponse({ commandResponseState: {} })).to.throw(
                "no command response state",
            );
        });
    });

    describe("decodeAcceptedCommands", () => {
        it("collects the advertised command ids into a set", () => {
            const ids = decodeAcceptedCommands([RvcOperationalCommand.Pause, RvcOperationalCommand.GoHome]);
            expect(ids?.has(RvcOperationalCommand.Pause)).to.be.true;
            expect(ids?.has(RvcOperationalCommand.GoHome)).to.be.true;
            expect(ids?.has(RvcOperationalCommand.Resume)).to.be.false;
        });

        it("returns undefined while the attribute is not reported, so the panel does not hide every command", () => {
            expect(decodeAcceptedCommands(undefined)).to.equal(undefined);
            expect(decodeAcceptedCommands(null)).to.equal(undefined);
            expect(decodeAcceptedCommands("nope")).to.equal(undefined);
        });
    });
});
