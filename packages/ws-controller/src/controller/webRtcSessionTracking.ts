/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";

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
