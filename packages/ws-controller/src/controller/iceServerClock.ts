/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import { Status } from "@matter/main/types";
import { deviceStatusOf } from "../camera/deviceStatus.js";

const logger = Logger.get("IceServerClock");

const TLS_ICE_SCHEME = /^(turns|stuns):/i;

/** Only `turns:` and `stuns:` need a valid clock for their TLS certificate check. */
export function usesTlsIceServer(iceServers: unknown): boolean {
    if (!Array.isArray(iceServers)) return false;
    return iceServers.some(
        server =>
            typeof server === "object" &&
            server !== null &&
            "urls" in server &&
            Array.isArray(server.urls) &&
            server.urls.some((url: unknown) => typeof url === "string" && TLS_ICE_SCHEME.test(url)),
    );
}

/**
 * Whether the camera checks its clock for this request: `SolicitOffer` always (§11.5.6.1.10), `ProvideOffer`
 * only for a new session, one whose `WebRTCSessionID` is null (§11.5.6.3.12), and only with a `turns:` or
 * `stuns:` ICE server.
 */
export function offerChecksClock(
    command: "provideOffer" | "solicitOffer",
    fields: Readonly<Record<string, unknown>>,
): boolean {
    if (command === "provideOffer" && typeof fields.webRtcSessionId === "number") return false;
    return usesTlsIceServer(fields.iceServers);
}

/**
 * Sends an offer. When the camera checks its clock for it ({@link offerChecksClock}) and refuses it with
 * INVALID_IN_STATE, pushes time once and sends the same offer once more.
 *
 * The camera refuses such an offer while its UTCTime is null, but the same status has other causes (privacy
 * modes, among others). The subscribed UTCTime cannot tell them apart: its quality is `C X` (§11.17.8 table),
 * so reports leave out its changes. Asking the camera first costs a request on every offer; reacting to the
 * refusal costs nothing on an accepted offer. A refused new-session offer ends "with no other side effects"
 * (§11.5.6.1.10, §11.5.6.3.12), so the second offer cannot create a second session.
 *
 * `syncTime` is the regular time push, which also sets TimeZone and DSTOffset on a camera with that feature.
 * When the second offer is refused with a device status, that refusal is thrown. When the push fails, or
 * the second offer fails without a device status (a timeout, for example), the first refusal is thrown, so
 * the caller sees the camera's answer as it would without the retry.
 */
export async function offerWithClockRetry<T>(args: {
    command: "provideOffer" | "solicitOffer";
    fields: Readonly<Record<string, unknown>>;
    invoke: () => Promise<T>;
    syncTime: () => Promise<void>;
    node: string;
}): Promise<T> {
    const { command, fields, invoke, syncTime, node } = args;
    try {
        return await invoke();
    } catch (refusal) {
        if (deviceStatusOf(refusal) !== Status.InvalidInState || !offerChecksClock(command, fields)) throw refusal;
        try {
            await syncTime();
        } catch (error) {
            logger.notice(
                `Node ${node} refused an offer with turns:/stuns: ICE servers as INVALID_IN_STATE, and pushing time to it failed (${
                    error instanceof Error ? error.message : String(error)
                })`,
            );
            throw refusal;
        }
        logger.info(
            `Node ${node} refused an offer with turns:/stuns: ICE servers as INVALID_IN_STATE; pushed time and sending it again`,
        );
        try {
            return await invoke();
        } catch (error) {
            if (deviceStatusOf(error) !== undefined) throw error;
            logger.notice(
                `Node ${node}: the offer sent again after the time push failed (${
                    error instanceof Error ? error.message : String(error)
                }); reporting the camera's first refusal`,
            );
            throw refusal;
        }
    }
}
