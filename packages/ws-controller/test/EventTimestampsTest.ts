/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { deviceTimestampOfRead } from "../src/controller/eventTimestamps.js";

describe("deviceTimestampOfRead", () => {
    it("puts an absolute epoch timestamp on the epoch clock", () => {
        expect(deviceTimestampOfRead({ epochTimestamp: 1_000, resolvedTimestamp: 1_000 })).deep.equals({
            epochTimestamp: 1_000,
        });
    });

    it("puts a resolved epoch delta on the epoch clock", () => {
        expect(deviceTimestampOfRead({ deltaEpochTimestamp: 4, resolvedTimestamp: 1_004 })).deep.equals({
            epochTimestamp: 1_004,
        });
    });

    it("puts an absolute system timestamp on the system clock, also next to an epoch delta", () => {
        expect(
            deviceTimestampOfRead({ systemTimestamp: 5_000, deltaEpochTimestamp: 4, resolvedTimestamp: 5_000 }),
        ).deep.equals({ systemTimestamp: 5_000 });
    });

    it("puts a resolved system delta on the system clock", () => {
        expect(deviceTimestampOfRead({ resolvedTimestamp: 5_004 })).deep.equals({ systemTimestamp: 5_004 });
    });

    it("gives no timestamp for a delta matter.js could not resolve", () => {
        expect(deviceTimestampOfRead({ deltaEpochTimestamp: 4 })).deep.equals({});
    });
});
