/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { readRequestOf, subscribeRequestOf, subscriptionIdOf } from "../src/server/interactionArguments.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

const NODE = NodeId(42);

function expectInvalidArguments(parse: () => unknown, message?: string) {
    let error: unknown;
    try {
        parse();
    } catch (caught) {
        error = caught;
    }
    expect(error).instanceOf(ServerError);
    if (error instanceof ServerError) {
        expect(error.code).equals(ServerErrorCode.InvalidArguments);
        if (message !== undefined) {
            expect(error.message).contains(message);
        }
    }
}

const SUBSCRIBE = { attribute_paths: ["1/6/0"], min_interval: 0, max_interval: 60 };

describe("read and subscribe arguments", () => {
    it("maps every read argument onto the request", () => {
        expect(
            readRequestOf(NODE, {
                attribute_paths: ["1/6/0", "*/29/*"],
                event_paths: [{ path: "1/69/*", is_urgent: true }],
                event_min: 2n,
                fabric_filtered: false,
                data_version_filters: [{ path: "1/6", data_version: 9 }],
            }),
        ).deep.equals({
            nodeId: NODE,
            attributePaths: ["1/6/0", "*/29/*"],
            eventPaths: [{ path: "1/69/*" }],
            eventMin: 2n,
            fabricFiltered: false,
            dataVersionFilters: [{ path: "1/6", dataVersion: 9 }],
        });
    });

    it("rejects a request without paths", () => {
        expectInvalidArguments(() => readRequestOf(NODE, {}), "At least one attribute or event path");
        expectInvalidArguments(() => readRequestOf(NODE, { attribute_paths: [], event_paths: [] }));
        expectInvalidArguments(() => subscribeRequestOf(NODE, { ...SUBSCRIBE, attribute_paths: [] }));
    });

    it("rejects a malformed path instead of reading it as a wildcard", () => {
        for (const attributePath of [
            "1/OnOff/0",
            "",
            "x",
            "1/6",
            "1/6/0/1",
            "1//0",
            "-1/6/0",
            "1/6/0x",
            "65536/6/0",
            "1/4294967296/0",
            "1/6/4294967296",
            "1/4294967294/0",
            "1/32768/0",
        ]) {
            expectInvalidArguments(() => readRequestOf(NODE, { attribute_paths: [attributePath] }));
        }
        expectInvalidArguments(() => readRequestOf(NODE, { event_paths: [{ path: "1/Switch/*" }] }));
        expectInvalidArguments(() => readRequestOf(NODE, { event_paths: [{ path: "1/59/256" }] }));
        expectInvalidArguments(() => readRequestOf(NODE, { event_paths: [{ path: "1/59/1" }, { path: "1/59" }] }));
        for (const filterPath of ["1/6/0", "one/6", "1", "65536/6", "1/*", "*/6"]) {
            expectInvalidArguments(() =>
                readRequestOf(NODE, {
                    attribute_paths: ["1/6/0"],
                    data_version_filters: [{ path: filterPath, data_version: 1 }],
                }),
            );
        }
    });

    it("rejects a malformed path that holds a bigint as invalid arguments", () => {
        expectInvalidArguments(
            () => readRequestOf(NODE, { attribute_paths: [9007199254740993n] }),
            "Malformed attribute_paths path 9007199254740993",
        );
        expectInvalidArguments(
            () => subscribeRequestOf(NODE, { ...SUBSCRIBE, event_paths: [{ path: { endpoint: 9007199254740993n } }] }),
            "9007199254740993",
        );
    });

    it("rejects an event_min or data_version out of range", () => {
        for (const eventMin of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, -1n, 0x1_0000_0000_0000_0000n]) {
            expectInvalidArguments(
                () => readRequestOf(NODE, { event_paths: [{ path: "1/69/0" }], event_min: eventMin }),
                "event_min",
            );
        }
        for (const dataVersion of [-1, 1.5, 0x1_0000_0000]) {
            expectInvalidArguments(
                () =>
                    readRequestOf(NODE, {
                        attribute_paths: ["1/6/0"],
                        data_version_filters: [{ path: "1/6", data_version: dataVersion }],
                    }),
                "data_version",
            );
        }
    });

    it("accepts the largest event_min and data_version", () => {
        const request = readRequestOf(NODE, {
            attribute_paths: ["1/6/0"],
            event_paths: [{ path: "1/69/0" }],
            event_min: 0xffff_ffff_ffff_ffffn,
            data_version_filters: [{ path: "1/6", data_version: 0xffff_ffff }],
        });

        expect(request.eventMin).equals(0xffff_ffff_ffff_ffffn);
        expect(request.dataVersionFilters).deep.equals([{ path: "1/6", dataVersion: 0xffff_ffff }]);
    });

    it("rejects event_min without event paths and data version filters without attribute paths", () => {
        expectInvalidArguments(
            () => readRequestOf(NODE, { attribute_paths: ["1/6/0"], event_paths: [], event_min: 0 }),
            "event_min requires event_paths",
        );
        expectInvalidArguments(
            () =>
                subscribeRequestOf(NODE, {
                    ...SUBSCRIBE,
                    attribute_paths: undefined,
                    event_paths: [{ path: "1/69/0" }],
                    data_version_filters: [{ path: "1/6", data_version: 1 }],
                }),
            "data_version_filters requires attribute_paths",
        );
    });

    it("accepts an empty data version filter list without attribute paths", () => {
        const request = readRequestOf(NODE, { event_paths: [{ path: "1/69/0" }], data_version_filters: [] });

        expect(request.dataVersionFilters).deep.equals([]);
    });

    it("maps every subscribe argument onto the request", () => {
        expect(
            subscribeRequestOf(NODE, {
                attribute_paths: ["1/6/0"],
                event_paths: [{ path: "1/69/0", is_urgent: true }, { path: "1/69/1" }],
                min_interval: 1,
                max_interval: 30,
                keep_subscriptions: true,
            }),
        ).deep.equals({
            nodeId: NODE,
            attributePaths: ["1/6/0"],
            eventPaths: [
                { path: "1/69/0", isUrgent: true },
                { path: "1/69/1", isUrgent: undefined },
            ],
            eventMin: undefined,
            fabricFiltered: undefined,
            dataVersionFilters: undefined,
            minInterval: 1,
            maxInterval: 30,
            keepSubscriptions: true,
        });
    });

    it("rejects intervals outside the Matter range or in the wrong order", () => {
        for (const [minInterval, maxInterval] of [
            [0, 0x10000],
            [-1, 60],
            [1.5, 60],
            [0, 60.5],
            [0, -1],
            [10, 5],
            ["0", 60],
            [0, undefined],
        ]) {
            expectInvalidArguments(() =>
                subscribeRequestOf(NODE, { ...SUBSCRIBE, min_interval: minInterval, max_interval: maxInterval }),
            );
        }
    });

    it("accepts equal intervals and the Matter maximum", () => {
        expect(subscribeRequestOf(NODE, { ...SUBSCRIBE, min_interval: 30, max_interval: 30 }).maxInterval).equals(30);
        expect(subscribeRequestOf(NODE, { ...SUBSCRIBE, min_interval: 0, max_interval: 0xffff }).maxInterval).equals(
            0xffff,
        );
    });

    it("rejects flags that are not booleans", () => {
        expectInvalidArguments(() => subscribeRequestOf(NODE, { ...SUBSCRIBE, keep_subscriptions: "true" }));
        expectInvalidArguments(() => subscribeRequestOf(NODE, { ...SUBSCRIBE, fabric_filtered: 1 }));
        expectInvalidArguments(() =>
            subscribeRequestOf(NODE, { ...SUBSCRIBE, event_paths: [{ path: "1/69/0", is_urgent: 1 }] }),
        );
    });

    it("accepts a subscription id of 0 to 2^32-1 only", () => {
        expect(subscriptionIdOf(0)).equals(0);
        expect(subscriptionIdOf(0xffff_ffff)).equals(0xffff_ffff);
        for (const id of [-1, 1.5, 0x1_0000_0000, "1", null, undefined, 1n]) {
            expectInvalidArguments(() => subscriptionIdOf(id), "subscription_id");
        }
    });
});
