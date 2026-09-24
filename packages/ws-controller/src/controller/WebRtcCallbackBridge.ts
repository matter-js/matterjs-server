/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraIceServer, WebRtcCallbackData } from "@matter-server/ws-client";
import { Logger } from "@matter/main";
import type { WebRtcTransportDefinitions } from "@matter/main/clusters";
import type { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";

const logger = Logger.get("WebRtcCallbackBridge");

/**
 * The struct's `URLs` list under the `urls` key the wire uses in both directions, so an ICE server
 * a client reads from an offer is one it can send back to `camera_start_stream` unchanged.
 *
 * @see Matter spec § 11.4.5.3 (ICEServerStruct)
 */
function toWireIceServer(server: WebRtcTransportDefinitions.IceServer): CameraIceServer {
    const { urLs, username, credential, caid } = server;
    return {
        urls: urLs,
        ...(username === undefined ? {} : { username }),
        ...(credential === undefined ? {} : { credential }),
        ...(caid === undefined ? {} : { caid }),
    };
}

export function attachWebRtcCallbackBridge(
    events: WebRtcTransportRequestorServer.Events,
    emit: (data: WebRtcCallbackData) => void,
): void {
    events.offer.on((session, request) => {
        logger.info(
            `offer from peer node=${session.peerNodeId} ep=${session.peerEndpointId} session=${session.id} sdpLen=${request.sdp.length}`,
        );
        emit({
            event_type: "offer",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: {
                sdp: request.sdp,
                ice_servers: request.iceServers?.map(toWireIceServer),
                ice_transport_policy: request.iceTransportPolicy,
            },
        });
    });
    events.answer.on((session, sdp) => {
        logger.info(
            `answer from peer node=${session.peerNodeId} ep=${session.peerEndpointId} session=${session.id} sdpLen=${sdp.length}`,
        );
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
        logger.info(
            `ice_candidates from peer node=${session.peerNodeId} ep=${session.peerEndpointId} session=${session.id} count=${candidates.length}`,
        );
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
        logger.info(
            `end from peer node=${session.peerNodeId} ep=${session.peerEndpointId} session=${session.id} reason=${reason}`,
        );
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
