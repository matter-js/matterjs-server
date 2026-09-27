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
 * A session being established, from before the provider round trip until `finish`. Identified by
 * object identity, so a release path that runs meanwhile can see it.
 */
export type PendingSession = Readonly<SessionScope>;

interface PendingRecord {
    claimed: boolean;
    settled: Promise<void>;
    markSettled: () => void;
    /** The id the provider answered with, so {@link CameraSessionRegistry.forget} can match an end to it. */
    webRtcSessionId?: number;
    /** Set when this registration's session ended before it was tracked, whoever ended it. */
    ended: boolean;
}

/** Why a session this server established could not be tracked. Either way the caller must end the session. */
export type SessionTrackRefusal = "claimed" | "already_ended";

/**
 * The sessions this server established on devices, tracked from before establishment until release.
 * Keyed by node, endpoint and id, because `WebRTCSessionID` is allocated per provider.
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
     * Record the id the provider answered a registration with. Must be called before the local requestor
     * is given the session, so an `End` routed after that can be attributed.
     */
    establishing(pending: PendingSession, webRtcSessionId: number): void {
        const record = this.#pending.get(pending);
        if (record !== undefined) record.webRtcSessionId = webRtcSessionId;
    }

    /**
     * Track an established session, or refuse it and say why. On a refusal the caller must end the
     * session. `claimed`: a release path is waiting for it. `already_ended`: it ended between the offer
     * response and this call.
     */
    track(pending: PendingSession, session: ManagedSession): SessionTrackRefusal | undefined {
        const record = this.#pending.get(pending);
        if (record === undefined || record.claimed) return "claimed";
        if (record.ended) return "already_ended";
        this.#sessions.set(this.#key(session.nodeId, session.endpointId, session.webRtcSessionId), session);
        return undefined;
    }

    /**
     * Drop a registration begun by {@link begin}. Call it once the establishing call has dealt with the
     * session, ending it included: a claiming release path waits for this.
     */
    finish(pending: PendingSession): void {
        const record = this.#pending.get(pending);
        this.#pending.delete(pending);
        record?.markSettled();
    }

    /**
     * Which connections may receive the signalling of one session, or `undefined` when this server has no
     * record of it (raw provider route, or already dropped). In-flight registrations are not consulted.
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
     * Stop tracking a session the device no longer holds. Reports whether an entry existed. Announces
     * nothing; callers report the end themselves.
     *
     * Also marks an in-flight registration answered with this id as ended, so {@link track} refuses it.
     * Every path that learns a session has ended must come through here.
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
     * Stop tracking this exact session, leaving a later one under the same key alone (cameras reuse
     * freed ids). Every drop is announced with `requestedBy`.
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
     * Take responsibility for every session in scope, established or being established, and return
     * promises that settle when each is done. A claimed in-flight registration ends itself instead of
     * being tracked; established sessions are released with one `EndSession` however many paths claim them.
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

    /** Release one session with the shared de-duplication; every concurrent waiter gets the same device answer. */
    releaseOnce(session: ManagedSession, release: (session: ManagedSession) => Promise<boolean>): Promise<boolean> {
        return this.#release(session, release);
    }

    /** The release already running for this session, or a new one. Dropped on settle, so a failure can be retried. */
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
