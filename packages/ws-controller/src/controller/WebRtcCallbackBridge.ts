/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraIceServer, WebRtcCallbackData } from "@matter-server/ws-client";
import { Logger } from "@matter/main";
import type { WebRtcTransportDefinitions } from "@matter/main/clusters";
import type { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { answerWithinOfferedDirections } from "../camera/sdpConstraints.js";
import type { WebRtcProviderSessionKey } from "./webRtcSessionStreams.js";

const logger = Logger.get("WebRtcCallbackBridge");

/** The same wire shape `camera_start_stream` accepts (`urls`, not the struct's `URLs`, § 11.4.5.3). */
function toWireIceServer(server: WebRtcTransportDefinitions.IceServer): CameraIceServer {
    const { urls, username, credential, caid } = server;
    return {
        urls,
        ...(username === undefined ? {} : { username }),
        ...(credential === undefined ? {} : { credential }),
        ...(caid === undefined ? {} : { caid }),
    };
}

function sessionKeyText({ fabricIndex, peerNodeId, peerEndpointId, id }: WebRtcProviderSessionKey): string {
    return `${fabricIndex}/${peerNodeId}/${peerEndpointId}/${id}`;
}

export interface WebRtcCallbackBridge {
    /**
     * Records the SDP sent to the camera in a ProvideOffer for this session. The camera's next answer is
     * corrected against it before it is emitted, and uses it up. Must be called before the camera can answer.
     *
     * Returns a withdraw function for the paths on which the camera will not answer this offer: unless the
     * answer or a newer offer replaced it, the record goes back to the offer it replaced (an earlier offer of
     * the session the camera accepted and has not answered), or is dropped when there was none.
     */
    offerSent(session: WebRtcProviderSessionKey, sdp: string): () => void;
    /** Drops what {@link offerSent} recorded, for a session ended locally. A peer `End` drops it itself. */
    sessionEnded(session: WebRtcProviderSessionKey): void;
}

export function attachWebRtcCallbackBridge(
    events: WebRtcTransportRequestorServer.Events,
    emit: (data: WebRtcCallbackData) => void,
): WebRtcCallbackBridge {
    const sentOffers = new Map<string, { readonly sdp: string }>();

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
        const key = sessionKeyText(session);
        const offer = sentOffers.get(key);
        sentOffers.delete(key);
        const answer = offer === undefined ? { sdp, corrected: [] } : answerWithinOfferedDirections(sdp, offer.sdp);
        if (answer.corrected.length > 0) {
            logger.info(
                `answer from peer node=${session.peerNodeId} session=${session.id} states a direction its offer does not allow in m-sections ${answer.corrected.join(", ")}; narrowed to the offer (RFC 3264 §6.1)`,
            );
        }
        emit({
            event_type: "answer",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: { sdp: answer.sdp },
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
        sentOffers.delete(sessionKeyText(session));
        emit({
            event_type: "end",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: { reason },
        });
    });

    return {
        offerSent: (session, offerSdp) => {
            const key = sessionKeyText(session);
            const replaced = sentOffers.get(key);
            const sent = { sdp: offerSdp };
            sentOffers.set(key, sent);
            return () => {
                if (sentOffers.get(key) !== sent) return;
                if (replaced === undefined) sentOffers.delete(key);
                else sentOffers.set(key, replaced);
            };
        },
        sessionEnded: session => {
            sentOffers.delete(sessionKeyText(session));
        },
    };
}
