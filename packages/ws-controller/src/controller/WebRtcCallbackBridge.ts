/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebRtcCallbackData } from "@matter-server/ws-client";
import type { WebRtcTransportRequestorServer } from "./behaviors/WebRtcTransportRequestorServer.js";

export function attachWebRtcCallbackBridge(
    events: WebRtcTransportRequestorServer.Events,
    emit: (data: WebRtcCallbackData) => void,
): void {
    events.offer.on((session, request) => {
        emit({
            event_type: "offer",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: {
                sdp: request.sdp,
                ice_servers: request.iceServers,
                ice_transport_policy: request.iceTransportPolicy,
            },
        });
    });
    events.answer.on((session, sdp) => {
        emit({
            event_type: "answer",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: { sdp },
        });
    });
    events.iceCandidates.on((session, candidates) => {
        emit({
            event_type: "ice_candidates",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: {
                ice_candidates: candidates.map(c => ({
                    candidate: c.candidate,
                    sdpMid: c.sdpMid ?? null,
                    sdpMLineIndex: c.sdpmLineIndex ?? null,
                })),
            },
        });
    });
    events.end.on((session, reason) => {
        emit({
            event_type: "end",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: { reason },
        });
    });
}
