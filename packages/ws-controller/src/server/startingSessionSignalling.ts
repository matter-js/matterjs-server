/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, Logger, MAX_UDP_MESSAGE_SIZE } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { formatNodeId } from "../util/formatNodeId.js";

const logger = Logger.get("StartingSessionSignalling");

/** Candidates of one starting session that may wait for its id; past this, the command is refused. */
export const MAX_QUEUED_ICE_CANDIDATES = 64;

/**
 * Room left for the candidates in one `ProvideICECandidates` invoke, so it fits a Matter message that is not
 * sent over TCP: `MAX_UDP_MESSAGE_SIZE` (1232 bytes, Core § 4.4.4, IPv6 minimum MTU 1280 less 48 bytes of IP and
 * UDP header) less 128 bytes for the message and protocol headers, the message integrity code and the invoke
 * request around the command fields (about 92 bytes, with margin). The cluster states no limit for the list
 * or the candidate string (§ 11.5.6.6, § 11.4.5.4).
 */
export const ICE_CANDIDATES_BYTE_BUDGET = MAX_UDP_MESSAGE_SIZE - 128;

/** TLV framing of one `ICECandidateStruct`: struct and field control bytes, tags, lengths and the line index. */
export const ICE_CANDIDATE_FRAMING_BYTES = 16;

interface QueuedCandidates {
    readonly clientSessionKey: string;
    readonly candidates: ReadonlyArray<unknown>;
    readonly fieldsFor: (webRtcSessionId: number, candidates: ReadonlyArray<unknown>) => Record<string, unknown>;
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
     * the queued candidates in order with `provide`. One `provide` carries the candidates of every command
     * queued when it starts, split only to stay within one Matter message. Candidates queued meanwhile go in
     * the next `provide`. Before each `provide`, `trackedSessionId` must still name this start's session for
     * its key; once it does not (the session ended, or its id went to another session), the rest of the
     * queue is refused.
     */
    release(
        provide: (fields: Record<string, unknown>) => Promise<void>,
        trackedSessionId: (clientSessionKey: string) => number | undefined,
    ): void;
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
            release: (provide, trackedSessionId) => {
                start.holding = false;
                for (const send of start.held.splice(0)) send();
                this.#provideQueued(start, provide, trackedSessionId).catch(error =>
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
     * being sent. The promise settles when they were sent: resolved, or rejected with the error of the first
     * send that failed for them. `fieldsFor` builds the command fields for the session id and the candidates
     * of one send, which are some or all of these. `undefined`: no such start, the key is resolved against
     * the tracked sessions instead.
     */
    queueCandidates(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clientSessionKey: string,
        candidates: ReadonlyArray<unknown>,
        fieldsFor: (webRtcSessionId: number, candidates: ReadonlyArray<unknown>) => Record<string, unknown>,
    ): Promise<void> | undefined {
        const count = candidates.length;
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
            start.candidates.push({ clientSessionKey, candidates, fieldsFor, resolve, reject });
        });
    }

    /** Serial, so the camera receives the candidates in the order the client sent them. */
    async #provideQueued(
        start: HeldStart,
        provide: (fields: Record<string, unknown>) => Promise<void>,
        trackedSessionId: (clientSessionKey: string) => number | undefined,
    ): Promise<void> {
        const { webRtcSessionId } = start;
        while (start.candidates.length > 0) {
            const commands = start.candidates.splice(0);
            for (const command of commands) start.queuedCandidates -= command.candidates.length;
            const sends = sendsFor(commands);
            const outcomes = new Map<QueuedCandidates, { unsettled: number; failure?: { error: unknown } }>();
            for (const send of sends) {
                for (const command of new Set(send.map(part => part.command))) {
                    const outcome = outcomes.get(command);
                    if (outcome === undefined) outcomes.set(command, { unsettled: 1 });
                    else outcome.unsettled++;
                }
            }
            for (const send of sends) {
                const [{ command: first }] = send;
                let failure: { error: unknown } | undefined;
                if (webRtcSessionId === undefined || trackedSessionId(first.clientSessionKey) !== webRtcSessionId) {
                    failure = {
                        error: unknownClientSessionKey(first.clientSessionKey, start.nodeId, start.endpointId),
                    };
                } else {
                    try {
                        await provide(
                            first.fieldsFor(
                                webRtcSessionId,
                                send.map(part => part.candidate),
                            ),
                        );
                    } catch (error) {
                        failure = { error };
                    }
                }
                for (const command of new Set(send.map(part => part.command))) {
                    const outcome = outcomes.get(command);
                    if (outcome === undefined) continue;
                    outcome.failure ??= failure;
                    if (--outcome.unsettled > 0) continue;
                    if (outcome.failure === undefined) command.resolve();
                    else command.reject(outcome.failure.error);
                }
            }
        }
        this.#starts.delete(start);
    }
}

interface CandidatePart {
    readonly command: QueuedCandidates;
    readonly candidate: unknown;
}

/** The candidates of `commands` in order, cut into sends that each fit `ICE_CANDIDATES_BYTE_BUDGET`. */
function sendsFor(commands: ReadonlyArray<QueuedCandidates>): Array<Array<CandidatePart>> {
    const sends = new Array<Array<CandidatePart>>();
    let current = new Array<CandidatePart>();
    let currentBytes = 0;
    for (const command of commands) {
        for (const candidate of command.candidates) {
            const bytes = candidateBytes(candidate);
            if (current.length > 0 && currentBytes + bytes > ICE_CANDIDATES_BYTE_BUDGET) {
                sends.push(current);
                current = new Array<CandidatePart>();
                currentBytes = 0;
            }
            current.push({ command, candidate });
            currentBytes += bytes;
        }
    }
    if (current.length > 0) sends.push(current);
    return sends;
}

/** A candidate that is alone in its send goes out even when it is larger than the budget: it cannot be split. */
function candidateBytes(candidate: unknown): number {
    let bytes = ICE_CANDIDATE_FRAMING_BYTES;
    if (typeof candidate === "object" && candidate !== null) {
        for (const value of Object.values(candidate)) {
            if (typeof value === "string") bytes += Bytes.fromString(value).byteLength;
        }
    }
    return bytes;
}
