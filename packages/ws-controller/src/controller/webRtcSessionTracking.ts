/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { Status } from "@matter/main/types";
import { deviceStatusOf } from "../camera/deviceStatus.js";

const logger = Logger.get("WebRtcSessionTracking");

/** What {@link dropWebRtcSessionTracking} needs of `ControllerCommandHandler`. */
export interface WebRtcSessionTracker {
    removeTrackedWebRtcSession(webRtcSessionId: number, nodeId: NodeId, endpointId: EndpointNumber): Promise<void>;
}

/**
 * Drop the local requestor's tracking of a WebRTC session the device is not holding.
 *
 * Never rejects. By the time it runs the device is not holding the session — it accepted the
 * `EndSession`, or answered `NotFound`, which it also does for an id it never held — so what is left
 * is a local record naming a session nothing can name again, and no caller has a remedy for it beyond
 * the log. On the camera manager's route a rejection would additionally skip the
 * registry entry `#endSession` drops next, leaving an entry shutdown would send a second `EndSession`
 * for; on the raw `device_command` route it would turn a successful `EndSession` into an error
 * response, inviting a retry the device can only answer `NotFound`.
 */
export async function dropWebRtcSessionTracking(
    tracker: WebRtcSessionTracker,
    webRtcSessionId: number,
    nodeId: NodeId,
    endpointId: EndpointNumber,
): Promise<void> {
    try {
        await tracker.removeTrackedWebRtcSession(webRtcSessionId, nodeId, endpointId);
    } catch (error) {
        logger.warn(`Could not drop local tracking of WebRTC session ${webRtcSessionId}:`, error);
    }
}

/**
 * Whether a failed `EndSession` means the device is not holding the session.
 *
 * The device answers `NotFound` for any id it cannot resolve to one of its sessions
 * (`WebRTCTransportProviderCluster.cpp`, `HandleEndSession` ahead of the delegate call), so what it
 * names is gone whether or not this call is what ended it.
 */
export function deviceForgotSession(error: unknown): boolean {
    return deviceStatusOf(error) === Status.NotFound;
}

/**
 * Invoke `EndSession` and drop the server's local records of the session whenever the device ends up
 * not holding it.
 *
 * Every route that ends a session it has a local record for goes through here — the camera manager's,
 * and a client's own `EndSession` on the raw `device_command` path — because all of them face the
 * same three outcomes. Records naming a session the device does not have would outlive it and make a
 * later pass send `EndSession` for a dead id, so they go on a success and on {@link
 * deviceForgotSession}; any other failure keeps them, so a later stop, disconnect or shutdown still
 * reaches the session. `dropRecords` must not reject: its rejection would replace the device's own
 * error, which is what the caller reports.
 */
export async function invokeEndSession<T>(invoke: () => Promise<T>, dropRecords: () => Promise<void>): Promise<T> {
    try {
        const response = await invoke();
        await dropRecords();
        return response;
    } catch (error) {
        if (deviceForgotSession(error)) await dropRecords();
        throw error;
    }
}
