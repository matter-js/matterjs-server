/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timestamp } from "@matter/main";
import { EventNumber } from "@matter/main/types";
import { EventTimestampResolver } from "../src/controller/EventTimestampResolver.js";

const TIMESTAMP = Timestamp(1_700_000_000_000);

describe("EventTimestampResolver", () => {
    let resolver: EventTimestampResolver;

    beforeEach(() => {
        resolver = new EventTimestampResolver();
    });

    it("reports an epoch timestamp against the epoch clock", () => {
        expect(resolver.resolve(EventNumber(1), TIMESTAMP, "epoch")).to.deep.equal({ epochTimestamp: TIMESTAMP });
    });

    it("reports a system timestamp against the system clock", () => {
        expect(resolver.resolve(EventNumber(1), TIMESTAMP, "system")).to.deep.equal({ systemTimestamp: TIMESTAMP });
    });

    it("drops an epoch delta without a preceding event rather than dating it from 1970", () => {
        expect(resolver.resolve(EventNumber(1), Timestamp(1_500), "epoch-delta")).to.deep.equal({});
    });

    it("drops a system delta without a preceding event rather than reporting it as an uptime", () => {
        expect(resolver.resolve(EventNumber(1), Timestamp(1_500), "system-delta")).to.deep.equal({});
    });

    it("adds a chain of system deltas to the report's absolute system timestamp", () => {
        const resolved = [
            resolver.resolve(EventNumber(0x28c9a4), Timestamp(1_130_677_783), "system"),
            ...[1, 4, 1, 3, 1, 4, 1].map((delta, index) =>
                resolver.resolve(EventNumber(0x28c9a5 + index), Timestamp(delta), "system-delta"),
            ),
        ];

        expect(resolved.map(({ systemTimestamp }) => systemTimestamp)).to.deep.equal([
            1_130_677_783, 1_130_677_784, 1_130_677_788, 1_130_677_789, 1_130_677_792, 1_130_677_793, 1_130_677_797,
            1_130_677_798,
        ]);
    });

    it("adds a chain of epoch deltas to the preceding epoch timestamp", () => {
        resolver.resolve(EventNumber(1), TIMESTAMP, "epoch");
        resolver.resolve(EventNumber(2), Timestamp(1_000), "epoch-delta");

        expect(resolver.resolve(EventNumber(3), Timestamp(500), "epoch-delta")).to.deep.equal({
            epochTimestamp: Timestamp(1_700_000_001_500),
        });
    });

    it("drops a system delta after an epoch timestamp", () => {
        resolver.resolve(EventNumber(1), TIMESTAMP, "epoch");

        expect(resolver.resolve(EventNumber(2), Timestamp(1), "system-delta")).to.deep.equal({});
    });

    it("drops an epoch delta after a system timestamp", () => {
        resolver.resolve(EventNumber(1), TIMESTAMP, "system");

        expect(resolver.resolve(EventNumber(2), Timestamp(1), "epoch-delta")).to.deep.equal({});
    });

    it("drops a delta whose preceding event was skipped", () => {
        resolver.resolve(EventNumber(1), Timestamp(5_000), "system");

        expect(resolver.resolve(EventNumber(3), Timestamp(10), "system-delta")).to.deep.equal({});
    });

    it("drops a delta that arrives before the absolute event it builds on", () => {
        resolver.resolve(EventNumber(1), Timestamp(5_000), "system");

        expect(resolver.resolve(EventNumber(3), Timestamp(10), "system-delta")).to.deep.equal({});
        expect(resolver.resolve(EventNumber(2), Timestamp(9_000), "system")).to.deep.equal({
            systemTimestamp: Timestamp(9_000),
        });
        expect(resolver.resolve(EventNumber(3), Timestamp(10), "system-delta")).to.deep.equal({
            systemTimestamp: Timestamp(9_010),
        });
    });

    it("keeps the base when a delta is dropped", () => {
        resolver.resolve(EventNumber(1), Timestamp(5_000), "system");
        resolver.resolve(EventNumber(3), Timestamp(10), "system-delta");

        expect(resolver.resolve(EventNumber(2), Timestamp(7), "system-delta")).to.deep.equal({
            systemTimestamp: Timestamp(5_007),
        });
    });

    it("rebases on the next absolute timestamp", () => {
        resolver.resolve(EventNumber(1), Timestamp(5_000), "system");
        resolver.resolve(EventNumber(2), Timestamp(10), "system-delta");
        resolver.resolve(EventNumber(3), Timestamp(9_000), "system");

        expect(resolver.resolve(EventNumber(4), Timestamp(7), "system-delta")).to.deep.equal({
            systemTimestamp: Timestamp(9_007),
        });
    });
});
