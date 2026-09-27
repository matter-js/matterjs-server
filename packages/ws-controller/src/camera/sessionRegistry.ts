/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EndpointNumber, NodeId } from "@matter/main";
import type { CameraSessionEnded, ManagedSession } from "./cameraTypes.js";

/** What a release path matches on, shared by tracked sessions and registrations still in flight. */
export interface SessionScope {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    connectionId: string;
}

/**
 * A session from before the provider round trip until its id is known.
 *
 * The id does not exist yet, so a registration is identified by this token alone. It is what makes a
 * session that is being established visible to a release path that runs meanwhile.
 */
export type PendingSession = Readonly<SessionScope>;

interface PendingRecord {
    claimed: boolean;
    settled: Promise<void>;
    markSettled: () => void;
    /**
     * The id the provider answered this registration with, once it is known.
     *
     * Recorded before the local requestor is given the session, so it is known before any `End` for
     * it can be routed. That is what lets {@link CameraSessionRegistry.forget} tell an end of *this*
     * session from an end of any other session on the same camera.
     */
    webRtcSessionId?: number;
    /** Set when this registration's session ended before it was tracked, whoever ended it. */
    ended: boolean;
}

/**
 * Why a session this server established could not be tracked.
 *
 * Both mean the same thing to the caller — it owns ending the session it just established — and
 * differ only in what it tells its client.
 */
export type SessionTrackRefusal = "claimed" | "already_ended";

/**
 * The sessions this server established on devices, tracked from before establishment until release.
 *
 * `WebRTCSessionID` is allocated per provider, so two cameras issuing id 1 is ordinary and the id
 * alone identifies nothing: the key is node, endpoint and id together.
 */
export class CameraSessionRegistry {
    readonly #announce: (ended: CameraSessionEnded) => void;
    readonly #sessions = new Map<string, ManagedSession>();
    readonly #pending = new Map<PendingSession, PendingRecord>();
    readonly #releasing = new Map<ManagedSession, Promise<boolean>>();

    /** `announce` is called for every tracked session this registry stops holding on a release path. */
    constructor(announce: (ended: CameraSessionEnded) => void) {
        this.#announce = announce;
    }

    #key(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): string {
        return `${nodeId}/${endpointId}/${webRtcSessionId}`;
    }

    /** Announce a session about to be established. Every exit of the establishing call must {@link finish} it. */
    begin(nodeId: NodeId, endpointId: EndpointNumber, connectionId: string): PendingSession {
        const pending: PendingSession = { nodeId, endpointId, connectionId };
        let markSettled = (): void => {};
        const settled = new Promise<void>(resolve => {
            markSettled = resolve;
        });
        this.#pending.set(pending, { claimed: false, settled, markSettled, ended: false });
        return pending;
    }

    /**
     * Record the id the provider answered a registration with.
     *
     * Must be called before the local requestor is given the session: after that an `End` for the id
     * can be routed, and an end this registry cannot attribute is one {@link track} cannot refuse.
     * An id recorded for a registration that never reaches {@link track} costs nothing — the record
     * goes with the registration.
     */
    establishing(pending: PendingSession, webRtcSessionId: number): void {
        const record = this.#pending.get(pending);
        if (record !== undefined) record.webRtcSessionId = webRtcSessionId;
    }

    /**
     * Track an established session, or refuse it and say why.
     *
     * A refusal means the caller owns ending the session it just established. `claimed` is a release
     * path waiting for exactly that, which tracking the session would leave nobody coming for.
     * `already_ended` is a session that ended between the provider answering the offer and this call —
     * the peer's own `End`, or another connection's `camera_stop_stream` or `EndSession` for the id the
     * provider had just issued. The registry holds no entry to drop at that point, so without this the
     * caller would be handed a dead session id as a live one, its signalling would be routed to
     * nothing, and the next stop or shutdown would send an `EndSession` for a session that no longer
     * exists. Which of those ended it is not knowable here, and the refusal does not claim to know.
     */
    track(pending: PendingSession, session: ManagedSession): SessionTrackRefusal | undefined {
        const record = this.#pending.get(pending);
        if (record === undefined || record.claimed) return "claimed";
        if (record.ended) return "already_ended";
        this.#sessions.set(this.#key(session.nodeId, session.endpointId, session.webRtcSessionId), session);
        return undefined;
    }

    /**
     * Drop a registration begun by {@link begin}, whatever became of it.
     *
     * Call it once the establishing call has dealt with the session — ended it included — not when its
     * id becomes known: a release path waiting on this promise is waiting for the `EndSession`, not
     * for the offer response.
     */
    finish(pending: PendingSession): void {
        const record = this.#pending.get(pending);
        this.#pending.delete(pending);
        record?.markSettled();
    }

    /**
     * Which connections may receive the signalling of one session, or none when this server holds no
     * record naming an owner.
     *
     * A tracked session names exactly one connection, and nothing else names any. `undefined` is not
     * "no connection": it is this server having no record of the session, which is what a session the
     * raw provider route opened is, and what one whose entry has already been dropped is. What a
     * caller does with that is the caller's to decide.
     *
     * A registration still in flight is deliberately not consulted. It would name the establishing
     * connection for *every* id this registry does not know, which withholds another client's own
     * signalling for as long as any `camera_start_stream` runs on that camera. What it would buy is
     * one narrow window: `WebRtcTransportRequestorServer` answers `NotFound` for every signalling
     * command naming a session it has not stored, `Offer` included, so an event can only arrive for a
     * session already registered with the local requestor, and the window is the one between that
     * registration and this entry. An event in it is broadcast, like any session with no record.
     */
    signallingOwners(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
    ): ReadonlySet<string> | undefined {
        const session = this.get(nodeId, endpointId, webRtcSessionId);
        return session === undefined ? undefined : new Set([session.connectionId]);
    }

    get(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): ManagedSession | undefined {
        return this.#sessions.get(this.#key(nodeId, endpointId, webRtcSessionId));
    }

    /**
     * Stop tracking a session the device no longer holds. Reports whether an entry existed.
     *
     * Nothing is announced here, unlike {@link forgetEstablished}: the two callers are the peer's own
     * `End`, which the owner already receives as a `webrtc_callback` event, and a client's own
     * `EndSession` on the generic `device_command` route, which that client sent itself.
     *
     * An id no entry names is still this server's own when a registration in flight has been answered
     * with it, which {@link establishing} is what records — a session ends before it is tracked
     * whenever the camera answers an offer it cannot serve, and whenever another connection ends the
     * id the camera has just issued. Such a registration is marked and {@link track} refuses it, so
     * every path on which this server learns a session has ended must come through here. Nothing is marked on the strength of node and endpoint alone: the
     * camera reissues an id it has freed, so any end on that camera could otherwise be read as the end
     * of a session established since, and a live session would be refused and torn down.
     */
    forget(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): boolean {
        if (this.#sessions.delete(this.#key(nodeId, endpointId, webRtcSessionId))) return true;
        for (const [pending, record] of this.#pending) {
            if (
                pending.nodeId === nodeId &&
                pending.endpointId === endpointId &&
                record.webRtcSessionId === webRtcSessionId
            ) {
                record.ended = true;
            }
        }
        return false;
    }

    /**
     * Stop tracking this exact session, leaving a later one under the same key alone.
     *
     * An `EndSession` whose wait was abandoned still completes, and a camera reissues a
     * `WebRTCSessionID` it has freed, so a give-back that lands late must not be able to drop the
     * session established since.
     *
     * Every drop here is announced, `requestedBy` naming the connection whose `camera_stop_stream` it
     * was, or absent when the server ended the session on its own. A drop this reports nothing for is
     * one no entry named, so there was nothing of this server's to report.
     */
    forgetEstablished(session: ManagedSession, requestedBy: string | undefined): boolean {
        const key = this.#key(session.nodeId, session.endpointId, session.webRtcSessionId);
        if (this.#sessions.get(key) !== session) return false;
        this.#sessions.delete(key);
        this.#announce({
            nodeId: session.nodeId,
            endpointId: session.endpointId,
            webRtcSessionId: session.webRtcSessionId,
            ownerId: session.connectionId,
            requestedBy,
        });
        return true;
    }

    /**
     * Take responsibility for every session in scope, established or being established, and report
     * what to wait for.
     *
     * Claiming a registration that is still in flight makes it end itself instead of registering
     * behind the caller's back. An established session is released here rather than handed back, so
     * that one session has one `EndSession` however many release paths reach it: shutdown closes the
     * sockets it then waits on, so a connection's own release and the shutdown pass overlap by
     * design. The returned promises settle once every claimed session and registration has, so a
     * caller that must not return early can wait for all of them.
     */
    claim(
        matches: (scope: SessionScope) => boolean,
        release: (session: ManagedSession) => Promise<boolean>,
    ): Promise<void>[] {
        const claimed = new Array<ManagedSession>();
        for (const session of this.#sessions.values()) {
            if (matches(session)) claimed.push(session);
        }
        const inFlight = new Array<Promise<void>>();
        for (const session of claimed) inFlight.push(this.#release(session, release).then(() => undefined));
        for (const [pending, record] of this.#pending) {
            if (!matches(pending)) continue;
            record.claimed = true;
            inFlight.push(record.settled);
        }
        return inFlight;
    }

    /**
     * Release one session through the same de-duplication every other path uses, and report what the
     * device answered.
     *
     * A client `camera_stop_stream` races the closing connection's own release and the shutdown pass.
     * Whichever of them reaches the device first is the one whose answer every waiter gets: there is
     * one `EndSession` per session, so there is one answer to report.
     */
    releaseOnce(session: ManagedSession, release: (session: ManagedSession) => Promise<boolean>): Promise<boolean> {
        return this.#release(session, release);
    }

    /**
     * The release already running for this session, or a new one.
     *
     * The entry is dropped once the release settles, so a session whose `EndSession` failed is tried
     * again by the next pass rather than being waited on forever.
     */
    #release(session: ManagedSession, release: (session: ManagedSession) => Promise<boolean>): Promise<boolean> {
        const running = this.#releasing.get(session);
        if (running !== undefined) return running;
        const started = release(session).finally(() => {
            if (this.#releasing.get(session) === started) this.#releasing.delete(session);
        });
        this.#releasing.set(session, started);
        return started;
    }
}
