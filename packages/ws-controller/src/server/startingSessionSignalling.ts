/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { formatNodeId } from "../util/formatNodeId.js";

const logger = Logger.get("StartingSessionSignalling");

/** Candidates of one starting session that may wait for its id; past this, the command is refused. */
export const MAX_QUEUED_ICE_CANDIDATES = 64;

interface QueuedCandidates {
    readonly clientSessionKey: string;
    readonly count: number;
    readonly fieldsFor: (webRtcSessionId: number) => Record<string, unknown>;
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
}

interface HeldStart {
    readonly nodeId: NodeId;
    readonly endpointId: EndpointNumber;
    readonly clientSessionKey?: string;
    webRtcSessionId?: number;
    holding: boolean;
    readonly held: Array<() => void>;
    readonly candidates: Array<QueuedCandidates>;
    queuedCandidates: number;
}

/** One `camera_start_stream` of a connection, from dispatch until its response is sent. */
export interface StartingSession {
    /** @see StartStreamArgs.sessionEstablishing */
    established(webRtcSessionId: number): void;
    /**
     * Call right after the response is sent: sends the held events in order and stops holding, then sends
     * the queued candidates in order with `provide`. Candidates queued meanwhile follow them.
     */
    release(provide: (fields: Record<string, unknown>) => Promise<void>): void;
    /** For an error response: the client never learned the session id, so its held events are discarded. */
    drop(): void;
}

/** Error 8, the answer for a `client_session_key` that names no starting or open session of the connection. */
export function unknownClientSessionKey(
    clientSessionKey: string,
    nodeId: NodeId,
    endpointId: EndpointNumber,
): ServerError {
    return ServerError.invalidArguments(
        `client_session_key "${clientSessionKey}" names no session of this connection that is starting or open on node ${formatNodeId(nodeId)} endpoint ${endpointId}`,
    );
}

/**
 * Holds one connection's events (`webrtc_callback`, `camera_session_ended`) for sessions whose
 * `camera_start_stream` is not answered yet, so the client has the response naming the session before
 * any of its events. The camera can signal as soon as the local requestor stores the session, which is
 * before the command returns.
 *
 * Also queues `camera_provide_ice_candidates` that name a starting session by its `client_session_key`,
 * until the response is sent and the id is known.
 */
export class StartingSessionSignalling {
    readonly #starts = new Set<HeldStart>();

    begin(nodeId: NodeId, endpointId: EndpointNumber, clientSessionKey?: string): StartingSession {
        const start: HeldStart = {
            nodeId,
            endpointId,
            ...(clientSessionKey === undefined ? {} : { clientSessionKey }),
            holding: true,
            held: new Array<() => void>(),
            candidates: new Array<QueuedCandidates>(),
            queuedCandidates: 0,
        };
        this.#starts.add(start);
        return {
            established: webRtcSessionId => {
                start.webRtcSessionId = webRtcSessionId;
            },
            release: provide => {
                start.holding = false;
                for (const send of start.held.splice(0)) send();
                this.#provideQueued(start, provide).catch(error =>
                    logger.error("Failed to send the ICE candidates queued for a starting session", error),
                );
            },
            drop: () => {
                start.holding = false;
                start.held.length = 0;
                this.#starts.delete(start);
                for (const queued of start.candidates.splice(0)) {
                    queued.reject(unknownClientSessionKey(queued.clientSessionKey, nodeId, endpointId));
                }
            },
        };
    }

    /** `true` when the event belongs to a session being started; `send` then runs at its release, not now. */
    hold(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number, send: () => void): boolean {
        for (const start of this.#starts) {
            if (
                start.holding &&
                start.webRtcSessionId === webRtcSessionId &&
                start.endpointId === endpointId &&
                start.nodeId === nodeId
            ) {
                start.held.push(send);
                return true;
            }
        }
        return false;
    }

    /**
     * Queues candidates for the start that named this key, while it is unanswered or its queue is still
     * being sent. The promise settles when they were sent. `undefined`: no such start, the key is resolved
     * against the tracked sessions instead.
     */
    queueCandidates(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clientSessionKey: string,
        count: number,
        fieldsFor: (webRtcSessionId: number) => Record<string, unknown>,
    ): Promise<void> | undefined {
        // The newest: an older start with this key can still be sending its queue after its session ended.
        const start = [...this.#starts]
            .filter(
                held =>
                    held.clientSessionKey === clientSessionKey &&
                    held.nodeId === nodeId &&
                    held.endpointId === endpointId,
            )
            .at(-1);
        if (start === undefined) return undefined;
        if (start.queuedCandidates + count > MAX_QUEUED_ICE_CANDIDATES) {
            return Promise.reject(
                ServerError.invalidArguments(
                    `client_session_key "${clientSessionKey}": at most ${MAX_QUEUED_ICE_CANDIDATES} ICE candidates wait for a session that is still starting`,
                ),
            );
        }
        start.queuedCandidates += count;
        return new Promise<void>((resolve, reject) => {
            start.candidates.push({ clientSessionKey, count, fieldsFor, resolve, reject });
        });
    }

    /** One at a time, so the camera receives them in the order the client sent them. */
    async #provideQueued(start: HeldStart, provide: (fields: Record<string, unknown>) => Promise<void>): Promise<void> {
        const { webRtcSessionId } = start;
        for (let queued = start.candidates.shift(); queued !== undefined; queued = start.candidates.shift()) {
            start.queuedCandidates -= queued.count;
            if (webRtcSessionId === undefined) {
                queued.reject(unknownClientSessionKey(queued.clientSessionKey, start.nodeId, start.endpointId));
                continue;
            }
            try {
                await provide(queued.fieldsFor(webRtcSessionId));
                queued.resolve();
            } catch (error) {
                queued.reject(error);
            }
        }
        this.#starts.delete(start);
    }
}
