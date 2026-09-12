/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    buildDaySegments,
    compareTransitionsForDisplay,
    computeSetpointRange,
    type DaySegment,
    firstClaimedDay,
    formatDayOfWeek,
    formatHandleShort,
    formatPresetLabel,
    formatMinutes,
    formatSegmentTooltip,
    formatSetpoint,
    isFeatureActive,
    pickSetpointForMode,
    readActivePresetHandle,
    readActiveScheduleHandle,
    readPresets,
    readSchedules,
    resolveScheduleDefaults,
    resolveTransitionLabel,
    setpointColorMixPercent,
    type ThermostatPreset,
    type ThermostatSchedule,
    type ThermostatScheduleTransition,
} from "../src/util/thermostat-schedule.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

// Single-byte schedule handles, base64-encoded (0x01 -> "AQ==", 0x02 -> "Ag==").
const HANDLE_1 = "AQ==";
const HANDLE_2 = "Ag==";

// ScheduleDayOfWeekBitmap bits (Sunday = bit 0 .. Saturday = bit 6).
const SUN = 1 << 0;
const MON = 1 << 1;
const TUE = 1 << 2;
const WED = 1 << 3;
const THU = 1 << 4;
const FRI = 1 << 5;
const SAT = 1 << 6;

function transition(
    dayOfWeek: number,
    transitionTimeMin: number,
    overrides: Partial<ThermostatScheduleTransition> = {},
): ThermostatScheduleTransition {
    return {
        dayOfWeek,
        transitionTimeMin,
        presetHandle: null,
        systemMode: null,
        coolingSetpoint: null,
        heatingSetpoint: null,
        ...overrides,
    };
}

function schedule(
    transitions: ThermostatScheduleTransition[],
    overrides: Partial<ThermostatSchedule> = {},
): ThermostatSchedule {
    return {
        handle: HANDLE_1,
        systemMode: 4,
        name: null,
        presetHandle: null,
        builtIn: null,
        transitions,
        ...overrides,
    };
}

function preset(handle: string, overrides: Partial<ThermostatPreset> = {}): ThermostatPreset {
    return {
        handle,
        scenario: null,
        name: null,
        coolingSetpoint: null,
        heatingSetpoint: null,
        builtIn: null,
        ...overrides,
    };
}

describe("thermostat-schedule util", () => {
    describe("isFeatureActive", () => {
        it("is true when the given bit is set on the real Thermostat FeatureMap", () => {
            expect(isFeatureActive(node({ "6/513/65532": 1 << 7 }), 6, "MSCH")).to.equal(true);
        });
        it("is false when the given feature is not set", () => {
            expect(isFeatureActive(node({ "6/513/65532": 0b1 }), 6, "MSCH")).to.equal(false);
        });
        it("is false when FeatureMap is absent", () => {
            expect(isFeatureActive(node({}), 6, "MSCH")).to.equal(false);
        });
        it("resolves PRES and TSUGGEST against the real FeatureMap", () => {
            const presOnly = node({ "6/513/65532": 1 << 8 });
            expect(isFeatureActive(presOnly, 6, "PRES")).to.equal(true);
            expect(isFeatureActive(presOnly, 6, "TSUGGEST")).to.equal(false);
            expect(isFeatureActive(node({ "6/513/65532": 1 << 10 }), 6, "TSUGGEST")).to.equal(true);
        });
    });

    describe("formatPresetLabel", () => {
        it("prefers the preset's own name", () => {
            expect(formatPresetLabel(preset(HANDLE_1, { name: "Night", scenario: 3 }))).to.equal("Night");
        });
        it("falls back to the PresetScenario label", () => {
            expect(formatPresetLabel(preset(HANDLE_1, { scenario: 3 }))).to.equal("Sleep");
            expect(formatPresetLabel(preset(HANDLE_1, { scenario: 254 }))).to.equal("User Defined");
        });
        it("names an unknown scenario by its numeric value", () => {
            expect(formatPresetLabel(preset(HANDLE_1, { scenario: 42 }))).to.equal("Scenario 42");
        });
        it("falls back to the short handle when neither name nor scenario is reported", () => {
            expect(formatPresetLabel(preset(HANDLE_1))).to.equal("0x01");
        });
    });

    describe("readActiveScheduleHandle", () => {
        it("reads the handle string", () => {
            expect(readActiveScheduleHandle(node({ "6/513/79": HANDLE_1 }), 6)).to.equal(HANDLE_1);
        });
        it("returns null when null/absent", () => {
            expect(readActiveScheduleHandle(node({ "6/513/79": null }), 6)).to.equal(null);
            expect(readActiveScheduleHandle(node({}), 6)).to.equal(null);
        });
    });

    describe("readActivePresetHandle", () => {
        it("reads the handle string", () => {
            expect(readActivePresetHandle(node({ "6/513/78": HANDLE_1 }), 6)).to.equal(HANDLE_1);
        });
        it("returns null when null/absent", () => {
            expect(readActivePresetHandle(node({ "6/513/78": null }), 6)).to.equal(null);
            expect(readActivePresetHandle(node({}), 6)).to.equal(null);
        });
    });

    describe("readSchedules", () => {
        it("decodes field-tag-keyed structs, including nested transitions", () => {
            const schedules = readSchedules(
                node({
                    "6/513/81": [
                        {
                            "0": HANDLE_1,
                            "1": 4,
                            "2": "Weekdays",
                            "3": HANDLE_2,
                            "4": [{ "0": 0b0111110, "1": 480, "2": HANDLE_2, "3": 4, "4": 2600, "5": 2100 }],
                            "5": true,
                        },
                    ],
                }),
                6,
            );
            expect(schedules).to.deep.equal([
                {
                    handle: HANDLE_1,
                    systemMode: 4,
                    name: "Weekdays",
                    presetHandle: HANDLE_2,
                    builtIn: true,
                    transitions: [
                        {
                            dayOfWeek: 0b0111110,
                            transitionTimeMin: 480,
                            presetHandle: HANDLE_2,
                            systemMode: 4,
                            coolingSetpoint: 2600,
                            heatingSetpoint: 2100,
                        },
                    ],
                },
            ]);
        });
        it("leaves optional fields null when the struct omits them", () => {
            const schedules = readSchedules(
                node({ "6/513/81": [{ "0": HANDLE_2, "1": 4, "4": [{ "0": SAT | SUN, "1": 0, "5": 1750 }] }] }),
                6,
            );
            expect(schedules?.[0]).to.deep.equal({
                handle: HANDLE_2,
                systemMode: 4,
                name: null,
                presetHandle: null,
                builtIn: null,
                transitions: [
                    {
                        dayOfWeek: SAT | SUN,
                        transitionTimeMin: 0,
                        presetHandle: null,
                        systemMode: null,
                        coolingSetpoint: null,
                        heatingSetpoint: 1750,
                    },
                ],
            });
        });
        it("drops entries missing a required field, including name-keyed structs", () => {
            expect(readSchedules(node({ "6/513/81": [{ "1": 4 }] }), 6)).to.deep.equal([]);
            expect(readSchedules(node({ "6/513/81": [{ ScheduleHandle: HANDLE_1, SystemMode: 4 }] }), 6)).to.deep.equal(
                [],
            );
        });
        it("drops a transition whose DayOfWeek sets the reserved Vacation bit", () => {
            const schedules = readSchedules(
                node({ "6/513/81": [{ "0": HANDLE_1, "1": 4, "4": [{ "0": 0x80 | MON, "1": 0 }] }] }),
                6,
            );
            expect(schedules?.[0].transitions).to.deep.equal([]);
        });
        it("distinguishes an absent attribute from an empty list", () => {
            expect(readSchedules(node({}), 6)).to.equal(undefined);
            expect(readSchedules(node({ "6/513/81": null }), 6)).to.equal(undefined);
            expect(readSchedules(node({ "6/513/81": [] }), 6)).to.deep.equal([]);
        });
    });

    describe("readPresets", () => {
        it("decodes tag-keyed presets including their setpoints", () => {
            const presets = readPresets(
                node({
                    "6/513/80": [
                        { "0": HANDLE_1, "1": 4, "2": "Night", "4": 1700 },
                        { "0": HANDLE_2, "1": 1, "2": "Morning", "3": 2600, "4": 2100 },
                    ],
                }),
                6,
            );
            expect(presets).to.deep.equal([
                {
                    handle: HANDLE_1,
                    scenario: 4,
                    name: "Night",
                    coolingSetpoint: null,
                    heatingSetpoint: 1700,
                    builtIn: null,
                },
                {
                    handle: HANDLE_2,
                    scenario: 1,
                    name: "Morning",
                    coolingSetpoint: 2600,
                    heatingSetpoint: 2100,
                    builtIn: null,
                },
            ]);
        });
        it("distinguishes an absent attribute from an empty list", () => {
            expect(readPresets(node({}), 6)).to.equal(undefined);
            expect(readPresets(node({ "6/513/80": [] }), 6)).to.deep.equal([]);
        });
    });

    describe("resolveTransitionLabel", () => {
        const presets = [preset(HANDLE_1, { name: "Night" })];
        it("prefers a matching preset name", () => {
            const label = resolveTransitionLabel({ presetHandle: HANDLE_1, systemMode: 4 }, presets);
            expect(label).to.equal("Night");
        });
        it("falls back to the SystemMode label when no preset matches", () => {
            const label = resolveTransitionLabel({ presetHandle: null, systemMode: 4 }, presets);
            expect(label).to.equal("Heat");
        });
        it("falls back to a generic label when neither is available", () => {
            const label = resolveTransitionLabel({ presetHandle: null, systemMode: null }, presets);
            expect(label).to.equal("Setpoint");
        });
    });

    describe("resolveScheduleDefaults", () => {
        const presets = [preset(HANDLE_2, { name: "Night", coolingSetpoint: 2600, heatingSetpoint: 1700 })];

        it("fills absent setpoints from the referenced preset", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 480, { presetHandle: HANDLE_2 })]),
                presets,
            );
            expect(resolved.transitions[0].heatingSetpoint).to.equal(1700);
            expect(resolved.transitions[0].coolingSetpoint).to.equal(2600);
        });
        it("resolves setpoints through the schedule's default PresetHandle", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 480)], { presetHandle: HANDLE_2 }),
                presets,
            );
            expect(resolved.transitions[0].presetHandle).to.equal(HANDLE_2);
            expect(resolved.transitions[0].heatingSetpoint).to.equal(1700);
            expect(resolved.transitions[0].coolingSetpoint).to.equal(2600);
        });
        it("prefers the transition's own PresetHandle over the schedule default", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 480, { presetHandle: HANDLE_1 })], { presetHandle: HANDLE_2 }),
                [...presets, preset(HANDLE_1, { name: "Day", heatingSetpoint: 2100 })],
            );
            expect(resolved.transitions[0].heatingSetpoint).to.equal(2100);
            expect(resolved.transitions[0].coolingSetpoint).to.equal(null);
        });
        it("defaults a transition's SystemMode to the schedule's", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 0), transition(TUE, 0, { systemMode: 3 })], { systemMode: 4 }),
                presets,
            );
            expect(resolved.transitions.map(t => t.systemMode)).to.deep.equal([4, 3]);
        });
        it("lets the transition's own preset win over setpoints a device sent alongside it", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 480, { presetHandle: HANDLE_2, heatingSetpoint: 2100 })]),
                presets,
            );
            expect(resolved.transitions[0].heatingSetpoint).to.equal(1700);
            expect(resolved.transitions[0].coolingSetpoint).to.equal(2600);
        });
        it("uses a reported setpoint only for a bound its own preset leaves unset", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 480, { presetHandle: HANDLE_1, coolingSetpoint: 2400 })]),
                [preset(HANDLE_1, { name: "Day", heatingSetpoint: 2100 })],
            );
            expect(resolved.transitions[0].heatingSetpoint).to.equal(2100);
            expect(resolved.transitions[0].coolingSetpoint).to.equal(2400);
        });
        it("keeps reported setpoints out of the schedule's default preset and off its label", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 480, { heatingSetpoint: 2100 })], {
                    presetHandle: HANDLE_2,
                    systemMode: 4,
                }),
                presets,
            );
            expect(resolved.transitions[0].presetHandle).to.equal(null);
            expect(resolved.transitions[0].heatingSetpoint).to.equal(2100);
            expect(resolved.transitions[0].coolingSetpoint).to.equal(null);
            expect(resolveTransitionLabel(resolved.transitions[0], presets)).to.equal("Heat");
        });
        it("leaves setpoints null when neither the transition nor the schedule references a known preset", () => {
            const resolved = resolveScheduleDefaults(
                schedule([transition(MON, 0), transition(TUE, 0, { presetHandle: HANDLE_1 })]),
                presets,
            );
            expect(resolved.transitions.map(t => t.heatingSetpoint)).to.deep.equal([null, null]);
        });
        it("does not mutate the input schedule", () => {
            const original = schedule([transition(MON, 480, { presetHandle: HANDLE_2 })]);
            resolveScheduleDefaults(original, presets);
            expect(original.transitions[0].heatingSetpoint).to.equal(null);
        });
    });

    describe("compareTransitionsForDisplay", () => {
        it("orders by first claimed display day before time", () => {
            const rows = [
                transition(SAT, 360),
                transition(MON | TUE | WED | THU | FRI, 1320),
                transition(SUN, 0),
                transition(MON, 480),
            ].sort(compareTransitionsForDisplay);
            expect(rows.map(t => [firstClaimedDay(t.dayOfWeek), t.transitionTimeMin])).to.deep.equal([
                [0, 480],
                [0, 1320],
                [5, 360],
                [6, 0],
            ]);
        });
        it("sorts a transition claiming no day last", () => {
            const rows = [transition(0, 0), transition(SUN, 1320)].sort(compareTransitionsForDisplay);
            expect(rows[0].dayOfWeek).to.equal(SUN);
        });
    });

    describe("formatDayOfWeek", () => {
        it("compresses runs of three or more days with a dash", () => {
            expect(formatDayOfWeek(MON | TUE | WED | THU | FRI)).to.equal("Mon–Fri");
            expect(formatDayOfWeek(MON | TUE | WED | FRI)).to.equal("Mon–Wed, Fri");
        });
        it("lists short runs and single days separately", () => {
            expect(formatDayOfWeek(SAT | SUN)).to.equal("Sat, Sun");
            expect(formatDayOfWeek(WED)).to.equal("Wed");
            expect(formatDayOfWeek(MON | WED | FRI)).to.equal("Mon, Wed, Fri");
        });
        it("labels the full week, and a bitmap claiming no day with a dash", () => {
            expect(formatDayOfWeek(0x7f)).to.equal("Every day");
            expect(formatDayOfWeek(0)).to.equal("—");
        });
    });

    describe("firstClaimedDay", () => {
        it("returns the first claimed day in Mon..Sun display order", () => {
            expect(firstClaimedDay(MON)).to.equal(0);
            expect(firstClaimedDay(SAT | SUN)).to.equal(5);
            expect(firstClaimedDay(SUN)).to.equal(6);
        });
        it("sorts an empty bitmap last", () => {
            expect(firstClaimedDay(0)).to.equal(7);
        });
    });

    describe("buildDaySegments", () => {
        it("returns no segments when the schedule has no transitions for that day", () => {
            expect(buildDaySegments(schedule([]), 0)).to.deep.equal([]);
        });
        it("carries the previous day's last transition across midnight", () => {
            const monday = buildDaySegments(
                schedule([
                    transition(MON, 480, { heatingSetpoint: 2100 }),
                    transition(SUN, 1320, { heatingSetpoint: 1700 }),
                ]),
                0,
            );
            expect(monday).to.deep.equal([
                {
                    startMin: 0,
                    endMin: 480,
                    heatingSetpoint: 1700,
                    coolingSetpoint: null,
                    presetHandle: null,
                    systemMode: null,
                },
                {
                    startMin: 480,
                    endMin: 1440,
                    heatingSetpoint: 2100,
                    coolingSetpoint: null,
                    presetHandle: null,
                    systemMode: null,
                },
            ]);
        });
        it("uses the nearest earlier covered day when several are covered", () => {
            const tuesday = buildDaySegments(
                schedule([
                    transition(SUN, 1320, { heatingSetpoint: 1700 }),
                    transition(MON, 1320, { heatingSetpoint: 1800 }),
                    transition(TUE, 480, { heatingSetpoint: 2100 }),
                ]),
                1,
            );
            expect(tuesday[0].heatingSetpoint).to.equal(1800);
        });
        it("falls back to the day's own last transition when the schedule covers no other day", () => {
            const monday = buildDaySegments(
                schedule([
                    transition(MON, 480, { heatingSetpoint: 1800 }),
                    transition(MON, 1320, { heatingSetpoint: 2100 }),
                ]),
                0,
            );
            expect(monday).to.deep.equal([
                {
                    startMin: 0,
                    endMin: 480,
                    heatingSetpoint: 2100,
                    coolingSetpoint: null,
                    presetHandle: null,
                    systemMode: null,
                },
                {
                    startMin: 480,
                    endMin: 1320,
                    heatingSetpoint: 1800,
                    coolingSetpoint: null,
                    presetHandle: null,
                    systemMode: null,
                },
                {
                    startMin: 1320,
                    endMin: 1440,
                    heatingSetpoint: 2100,
                    coolingSetpoint: null,
                    presetHandle: null,
                    systemMode: null,
                },
            ]);
        });
        it("skips the wraparound segment when the first transition is already at midnight", () => {
            expect(buildDaySegments(schedule([transition(MON, 0, { heatingSetpoint: 1750 })]), 0)).to.deep.equal([
                {
                    startMin: 0,
                    endMin: 1440,
                    heatingSetpoint: 1750,
                    coolingSetpoint: null,
                    presetHandle: null,
                    systemMode: null,
                },
            ]);
        });
        it("carries preset-resolved setpoints when the schedule is resolved first", () => {
            const resolved = resolveScheduleDefaults(schedule([transition(MON, 480, { presetHandle: HANDLE_2 })]), [
                preset(HANDLE_2, { heatingSetpoint: 1900 }),
            ]);
            expect(buildDaySegments(resolved, 0).map(s => s.heatingSetpoint)).to.deep.equal([1900, 1900]);
        });
    });

    describe("formatSetpoint", () => {
        it("divides by 100 and appends the unit", () => {
            expect(formatSetpoint(1750)).to.equal("17.5°C");
            expect(formatSetpoint(2100)).to.equal("21.0°C");
        });
        it("returns undefined for null/undefined", () => {
            expect(formatSetpoint(null)).to.equal(undefined);
            expect(formatSetpoint(undefined)).to.equal(undefined);
        });
    });

    describe("computeSetpointRange", () => {
        const dual = schedule(
            [
                transition(0, 0, { coolingSetpoint: 2600, heatingSetpoint: 1750 }),
                transition(0, 480, { heatingSetpoint: 2100 }),
            ],
            { systemMode: 1 },
        );
        it("scopes the range to heating setpoints in heat mode", () => {
            expect(computeSetpointRange(dual, "heat")).to.deep.equal({ min: 1750, max: 2100 });
        });
        it("scopes the range to cooling setpoints in cool mode, falling back where cooling is absent", () => {
            expect(computeSetpointRange(dual, "cool")).to.deep.equal({ min: 2100, max: 2600 });
        });
        it("returns undefined when no numeric setpoints exist", () => {
            expect(computeSetpointRange(schedule([transition(0, 0)], { systemMode: 0 }), "heat")).to.equal(undefined);
        });
        it("covers setpoints that only a preset supplies", () => {
            const resolved = resolveScheduleDefaults(schedule([transition(MON, 0, { presetHandle: HANDLE_2 })]), [
                preset(HANDLE_2, { heatingSetpoint: 1900 }),
            ]);
            expect(computeSetpointRange(resolved, "heat")).to.deep.equal({ min: 1900, max: 1900 });
        });
    });

    describe("setpointColorMixPercent", () => {
        it("clamps to 0-100 within range", () => {
            expect(setpointColorMixPercent(1750, 1750, 2100)).to.equal(0);
            expect(setpointColorMixPercent(2100, 1750, 2100)).to.equal(100);
            expect(setpointColorMixPercent(1925, 1750, 2100)).to.be.closeTo(50, 0.01);
        });
        it("clamps values outside the range", () => {
            expect(setpointColorMixPercent(1000, 1750, 2100)).to.equal(0);
            expect(setpointColorMixPercent(3000, 1750, 2100)).to.equal(100);
        });
        it("returns 50 when min === max", () => {
            expect(setpointColorMixPercent(1750, 1750, 1750)).to.equal(50);
        });
    });

    describe("pickSetpointForMode", () => {
        const segment = (heatingSetpoint: number | null, coolingSetpoint: number | null): DaySegment => ({
            startMin: 0,
            endMin: 1440,
            heatingSetpoint,
            coolingSetpoint,
            presetHandle: null,
            systemMode: null,
        });

        it("picks the heating setpoint in heat mode", () => {
            expect(pickSetpointForMode(segment(2000, 2400), "heat")).to.equal(2000);
        });
        it("picks the cooling setpoint in cool mode", () => {
            expect(pickSetpointForMode(segment(2000, 2400), "cool")).to.equal(2400);
        });
        it("falls back to whichever setpoint is present when the selected mode's is absent", () => {
            expect(pickSetpointForMode(segment(null, 2400), "heat")).to.equal(2400);
            expect(pickSetpointForMode(segment(1750, null), "cool")).to.equal(1750);
        });
        it("returns null when neither is present", () => {
            expect(pickSetpointForMode(segment(null, null), "heat")).to.equal(null);
        });
    });

    describe("formatHandleShort", () => {
        it("formats a single-byte handle as hex", () => {
            expect(formatHandleShort(HANDLE_1)).to.equal("0x01");
            expect(formatHandleShort(HANDLE_2)).to.equal("0x02");
        });
        it("returns an empty string for null", () => {
            expect(formatHandleShort(null)).to.equal("");
        });
    });

    describe("formatMinutes", () => {
        it("formats minutes-since-midnight as HH:MM", () => {
            expect(formatMinutes(0)).to.equal("00:00");
            expect(formatMinutes(90)).to.equal("01:30");
            expect(formatMinutes(1439)).to.equal("23:59");
        });
    });

    describe("formatSegmentTooltip", () => {
        const segment = (heatingSetpoint: number | null, coolingSetpoint: number | null): DaySegment => ({
            startMin: 360,
            endMin: 480,
            heatingSetpoint,
            coolingSetpoint,
            presetHandle: null,
            systemMode: 4,
        });

        it("includes the time span, label, and both setpoints when both are present", () => {
            expect(formatSegmentTooltip(segment(1900, 2500), [])).to.equal(
                "06:00–08:00 · Heat\nHeat 19.0°C\nCool 25.0°C",
            );
        });
        it("omits the setpoint line for whichever mode is absent", () => {
            expect(formatSegmentTooltip(segment(1900, null), [])).to.equal("06:00–08:00 · Heat\nHeat 19.0°C");
        });
    });
});
