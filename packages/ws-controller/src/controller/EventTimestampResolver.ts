/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Timestamp } from "@matter/main";
import { EventNumber } from "@matter/main/types";
import { ChangeNotificationService } from "@matter/node";

const logger = Logger.get("EventTimestampResolver");

/** Absolute event timestamp on the clock the device used, or neither when it cannot be determined. */
export type ResolvedEventTimestamp = { epochTimestamp?: Timestamp; systemTimestamp?: Timestamp };

/**
 * Turns one peer's event timestamps into absolute times, resolving the delta variants against the preceding event.
 *
 * Event timestamps may be deltas from the prior event. CHIP SDK devices send the first event of each report message
 * with an absolute timestamp and a later one as a delta only when it uses the same clock as the event before. matter.js
 * passes events on without their message, delays some to the end of the interaction and skips events for endpoints,
 * clusters or events it does not know. A delta is therefore only resolved when its event number directly follows the
 * base event's number, so a skipped or reordered event is detected and the timestamp dropped.
 *
 * This relies on only the node's default subscription (matter.js default: every event path) and its initial read
 * emitting events to the node, so the event the device measured a delta from always reaches the resolver.
 *
 * Workaround until matter.js reports resolved timestamps itself.
 *
 * @see Matter Core specification § 10.7.3.1 "EventReports"
 */
export class EventTimestampResolver {
    #base?: { clock: "epoch" | "system"; timestamp: number; eventNumber: EventNumber };

    /** The timestamp fields to forward, empty for a delta that cannot be resolved. */
    resolve(
        eventNumber: EventNumber,
        timestamp: Timestamp,
        kind: ChangeNotificationService.TimestampKind,
    ): ResolvedEventTimestamp {
        const clock = kind === "epoch" || kind === "epoch-delta" ? "epoch" : "system";
        let absolute: number = timestamp;
        if (kind === "epoch-delta" || kind === "system-delta") {
            const base = this.#base;
            if (base?.clock !== clock || eventNumber !== base.eventNumber + 1n) {
                logger.debug(`Dropping ${kind} event timestamp of event ${eventNumber}: preceding event not known`);
                return {};
            }
            absolute += base.timestamp;
        }
        this.#base = { clock, timestamp: absolute, eventNumber };
        return clock === "epoch" ? { epochTimestamp: Timestamp(absolute) } : { systemTimestamp: Timestamp(absolute) };
    }
}
