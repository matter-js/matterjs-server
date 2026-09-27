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
 * Never rejects: a failure only logs. Callers run it after a finished `EndSession` and must still
 * drop their other records and report the device's result.
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
 * @see connectedhomeip `WebRTCTransportProviderCluster.cpp` `HandleEndSession`: `NotFound` for any unknown id
 */
export function deviceForgotSession(error: unknown): boolean {
    return deviceStatusOf(error) === Status.NotFound;
}

/**
 * Invoke `EndSession` and drop the server's local records of the session if the device no longer
 * holds it: on success (`deviceHeldSession` true) and on {@link deviceForgotSession} (false). Any
 * other failure keeps the records so a later stop, disconnect or shutdown still ends the session.
 *
 * Every route that ends a locally recorded session must use this. `dropRecords` must not reject, or
 * its error replaces the device's.
 */
export async function invokeEndSession<T>(
    invoke: () => Promise<T>,
    dropRecords: (deviceHeldSession: boolean) => Promise<void>,
): Promise<T> {
    try {
        const response = await invoke();
        await dropRecords(true);
        return response;
    } catch (error) {
        if (deviceForgotSession(error)) await dropRecords(false);
        throw error;
    }
}
