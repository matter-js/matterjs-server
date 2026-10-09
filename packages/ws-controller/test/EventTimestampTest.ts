/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timestamp } from "@matter/main";
import { absoluteTimestampOf } from "../src/controller/PeerChangeBus.js";

const TIMESTAMP = Timestamp(1_700_000_000_000);

describe("absoluteTimestampOf", () => {
    it("reports an epoch timestamp against the epoch clock", () => {
        expect(absoluteTimestampOf(TIMESTAMP, "epoch")).to.deep.equal({ epochTimestamp: TIMESTAMP });
    });

    it("reports a system timestamp against the system clock", () => {
        expect(absoluteTimestampOf(TIMESTAMP, "system")).to.deep.equal({ systemTimestamp: TIMESTAMP });
    });

    it("drops an epoch delta rather than dating it from 1970", () => {
        expect(absoluteTimestampOf(Timestamp(1_500), "epoch-delta")).to.deep.equal({});
    });

    it("drops a system delta rather than reporting it as an uptime", () => {
        expect(absoluteTimestampOf(Timestamp(1_500), "system-delta")).to.deep.equal({});
    });
});
