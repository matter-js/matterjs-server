/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EndpointNumber, NodeId } from "@matter/main";
import type { ManagedSession } from "./cameraTypes.js";

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
}

/**
 * The sessions this server established on devices, tracked from before establishment until release.
 *
 * `WebRTCSessionID` is allocated per provider, so two cameras issuing id 1 is ordinary and the id
 * alone identifies nothing: the key is node, endpoint and id together.
 */
export class CameraSessionRegistry {
    readonly #sessions = new Map<string, ManagedSession>();
    readonly #pending = new Map<PendingSession, PendingRecord>();

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
        this.#pending.set(pending, { claimed: false, settled, markSettled });
        return pending;
    }

    /**
     * Track an established session, unless a release path claimed the registration meanwhile.
     *
     * False means the caller owns ending the session it just established: a release path is waiting
     * for exactly that, and tracking it now would hand back a session nobody is coming for.
     */
    track(pending: PendingSession, session: ManagedSession): boolean {
        if (this.#pending.get(pending)?.claimed !== false) return false;
        this.#sessions.set(this.#key(session.nodeId, session.endpointId, session.webRtcSessionId), session);
        return true;
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

    get(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): ManagedSession | undefined {
        return this.#sessions.get(this.#key(nodeId, endpointId, webRtcSessionId));
    }

    /** Stop tracking a session the device no longer holds. Reports whether an entry existed. */
    forget(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): boolean {
        return this.#sessions.delete(this.#key(nodeId, endpointId, webRtcSessionId));
    }

    /**
     * Stop tracking this exact session, leaving a later one under the same key alone.
     *
     * An `EndSession` whose wait was abandoned still completes, and a camera reissues a
     * `WebRTCSessionID` it has freed, so a give-back that lands late must not be able to drop the
     * session established since.
     */
    forgetEstablished(session: ManagedSession): boolean {
        const key = this.#key(session.nodeId, session.endpointId, session.webRtcSessionId);
        if (this.#sessions.get(key) !== session) return false;
        return this.#sessions.delete(key);
    }

    /**
     * Take responsibility for every session in scope, established or being established.
     *
     * Claiming a registration that is still in flight makes it end itself instead of registering
     * behind the caller's back; `inFlight` settles once it has, so a caller that must not return
     * early — shutdown — can wait for it.
     */
    claim(matches: (scope: SessionScope) => boolean): { sessions: ManagedSession[]; inFlight: Promise<void>[] } {
        const sessions = new Array<ManagedSession>();
        for (const session of this.#sessions.values()) {
            if (matches(session)) sessions.push(session);
        }
        const inFlight = new Array<Promise<void>>();
        for (const [pending, record] of this.#pending) {
            if (!matches(pending)) continue;
            record.claimed = true;
            inFlight.push(record.settled);
        }
        return { sessions, inFlight };
    }
}
