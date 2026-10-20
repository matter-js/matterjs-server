/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EndpointNumber, NodeId } from "@matter/main";
import type { CameraSessionEnded, ManagedSession, SessionEnd } from "./cameraTypes.js";

export interface SessionScope {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    connectionId: string;
    clientSessionKey?: string;
}

/** Who receives a session's signalling, and the name that connection gave the session. */
export interface SessionOwner {
    connectionId: string;
    clientSessionKey?: string;
}

/** A connection's session found by its `clientSessionKey`: tracked, or still being established. */
export type KeyedSession = { readonly session: ManagedSession } | { readonly pending: PendingSession };

/** Identified by object identity, so a release path that runs before `finish` can see it. */
export type PendingSession = Readonly<SessionScope>;

interface PendingRecord {
    /** `released`: a release path (closing connection, shutdown) took it. `stopped`: its owner's stop did. */
    claimed?: "released" | "stopped";
    settled: Promise<void>;
    markSettled: () => void;
    webRtcSessionId?: number;
    ended: boolean;
    /** The `EndSession` the establishing call sent for the session it gave up. */
    ending?: Promise<boolean>;
}

/** Either way the caller must end the session. */
export type SessionTrackRefusal = "claimed" | "stopped" | "already_ended";

/** Keyed by node, endpoint and id: `WebRTCSessionID` is unique per node (§11.4.5.1), and every route names a session by all three. */
export class CameraSessionRegistry {
    readonly #announce: (ended: CameraSessionEnded) => void;
    readonly #sessions = new Map<string, ManagedSession>();
    readonly #pending = new Map<PendingSession, PendingRecord>();
    readonly #releasing = new Map<ManagedSession, Promise<boolean>>();
    /** Entries a `CurrentSessions` report named; only these can end by vanishing from a later one. */
    readonly #seenByCamera = new WeakSet<ManagedSession>();

    constructor(announce: (ended: CameraSessionEnded) => void) {
        this.#announce = announce;
    }

    #key(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): string {
        return `${nodeId}/${endpointId}/${webRtcSessionId}`;
    }

    /**
     * Every exit of the establishing call must {@link finish} the returned registration. The caller makes
     * sure `clientSessionKey` is not {@link clientSessionKeyInUse}.
     */
    begin(nodeId: NodeId, endpointId: EndpointNumber, connectionId: string, clientSessionKey?: string): PendingSession {
        const pending: PendingSession = {
            nodeId,
            endpointId,
            connectionId,
            ...(clientSessionKey === undefined ? {} : { clientSessionKey }),
        };
        let markSettled = (): void => {};
        const settled = new Promise<void>(resolve => {
            markSettled = resolve;
        });
        this.#pending.set(pending, { settled, markSettled, ended: false });
        return pending;
    }

    /** On any node: a key names one session of its connection, so events and commands are unambiguous. */
    clientSessionKeyInUse(connectionId: string, clientSessionKey: string): boolean {
        const owns = (scope: SessionScope) =>
            scope.connectionId === connectionId && scope.clientSessionKey === clientSessionKey;
        for (const session of this.#sessions.values()) if (owns(session)) return true;
        for (const pending of this.#pending.keys()) if (owns(pending)) return true;
        return false;
    }

    /**
     * A tracked entry wins over its own registration, which stays until {@link finish}. Never another
     * connection's session: keys are scoped to the connection.
     */
    byClientKey(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        connectionId: string,
        clientSessionKey: string,
    ): KeyedSession | undefined {
        const named = (scope: SessionScope) =>
            scope.connectionId === connectionId &&
            scope.clientSessionKey === clientSessionKey &&
            scope.nodeId === nodeId &&
            scope.endpointId === endpointId;
        for (const session of this.#sessions.values()) if (named(session)) return { session };
        for (const pending of this.#pending.keys()) if (named(pending)) return { pending };
        return undefined;
    }

    /**
     * The owner stops a session it is still establishing: {@link track} refuses it with `stopped`, so the
     * establishing call ends it. Resolves once that call finished, with the outcome of its `EndSession`
     * (see {@link ending}), or `false` when it gave up before the camera opened a session.
     */
    cancel(pending: PendingSession): Promise<boolean> {
        const record = this.#pending.get(pending);
        if (record === undefined) return Promise.resolve(false);
        record.claimed ??= "stopped";
        return record.settled.then(() => record.ending ?? false);
    }

    /** The establishing call ends the session {@link track} refused; a {@link cancel} answers with this. */
    ending(pending: PendingSession, ending: Promise<boolean>): void {
        const record = this.#pending.get(pending);
        if (record !== undefined) record.ending = ending;
    }

    /** What {@link track} would refuse for a claim, asked before the offer so a claimed start sends none. */
    claimRefusal(pending: PendingSession): SessionTrackRefusal | undefined {
        const record = this.#pending.get(pending);
        if (record === undefined || record.claimed === "released") return "claimed";
        return record.claimed;
    }

    /**
     * Must be called before the local requestor is given the session, so a later `End` can be attributed.
     * Any other record still holding the id is a session the camera lost (it numbers sessions from 0 again
     * after a reboot), handled as {@link issued} does, so its signalling owner is no longer asked for this id.
     */
    establishing(pending: PendingSession, webRtcSessionId: number): void {
        this.#issued(pending.nodeId, pending.endpointId, webRtcSessionId, pending);
        const record = this.#pending.get(pending);
        if (record !== undefined) record.webRtcSessionId = webRtcSessionId;
    }

    /**
     * The camera handed this id to a session another route established. A session still recorded under it is
     * one the camera lost: an established entry is dropped and announced as `camera_restarted`, and a
     * registration waiting for it is marked ended.
     */
    issued(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): void {
        this.#issued(nodeId, endpointId, webRtcSessionId, undefined);
    }

    #issued(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number, to: PendingSession | undefined): void {
        const lost = this.get(nodeId, endpointId, webRtcSessionId);
        if (lost !== undefined) this.forgetEstablished(lost, { cause: "camera_restarted" });
        for (const [pending, record] of this.#pending) {
            if (
                pending !== to &&
                pending.nodeId === nodeId &&
                pending.endpointId === endpointId &&
                record.webRtcSessionId === webRtcSessionId
            ) {
                record.ended = true;
            }
        }
    }

    /**
     * `claimed`: a release path is waiting for it. `stopped`: its owner cancelled it. `already_ended`: it
     * ended between the offer response and this call.
     */
    track(pending: PendingSession, session: ManagedSession): SessionTrackRefusal | undefined {
        const claimRefusal = this.claimRefusal(pending);
        if (claimRefusal !== undefined) return claimRefusal;
        if (this.#pending.get(pending)?.ended === true) return "already_ended";
        this.#sessions.set(this.#key(session.nodeId, session.endpointId, session.webRtcSessionId), session);
        return undefined;
    }

    /** Call once the establishing call has dealt with the session, even by ending it: a claiming release waits for this. */
    finish(pending: PendingSession): void {
        const record = this.#pending.get(pending);
        this.#pending.delete(pending);
        record?.markSettled();
    }

    /**
     * `undefined` when no entry names the session (raw provider route, or already dropped). An in-flight
     * registration counts once {@link establishing} gave it the id: the local requestor accepts the camera's
     * signalling from then on, before {@link track} runs.
     */
    signallingOwner(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): SessionOwner | undefined {
        const session = this.get(nodeId, endpointId, webRtcSessionId);
        if (session !== undefined) return ownerOf(session);
        for (const [pending, record] of this.#pending) {
            if (
                pending.nodeId === nodeId &&
                pending.endpointId === endpointId &&
                record.webRtcSessionId === webRtcSessionId
            ) {
                return ownerOf(pending);
            }
        }
        return undefined;
    }

    get(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): ManagedSession | undefined {
        return this.#sessions.get(this.#key(nodeId, endpointId, webRtcSessionId));
    }

    /**
     * Announces nothing; callers report the end themselves. Also marks an in-flight registration answered
     * with this id as ended, so {@link track} refuses it. Every path that learns a session ended must call this.
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
     * freed ids). The one place that announces a tracked session's end, so every drop is announced once.
     */
    forgetEstablished(session: ManagedSession, end: SessionEnd): boolean {
        const key = this.#key(session.nodeId, session.endpointId, session.webRtcSessionId);
        if (this.#sessions.get(key) !== session) return false;
        this.#sessions.delete(key);
        this.#announce({
            nodeId: session.nodeId,
            endpointId: session.endpointId,
            webRtcSessionId: session.webRtcSessionId,
            ownerId: session.connectionId,
            ...(session.clientSessionKey === undefined ? {} : { clientSessionKey: session.clientSessionKey }),
            ...end,
        });
        return true;
    }

    /**
     * Applies one `CurrentSessions` report of an endpoint (`present`: the ids it lists for this server). An
     * entry is ended only when an earlier report listed it: a report built before a new session's offer
     * would otherwise end a live session. Returns the entries it dropped.
     */
    reconcile(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        present: ReadonlySet<number>,
        cause: "camera_restarted" | "camera_dropped",
    ): ManagedSession[] {
        const gone = new Array<ManagedSession>();
        for (const session of this.#sessions.values()) {
            // A release in flight announces the session itself, naming who asked for it.
            if (session.nodeId !== nodeId || session.endpointId !== endpointId || this.#releasing.has(session))
                continue;
            if (present.has(session.webRtcSessionId)) this.#seenByCamera.add(session);
            else if (this.#seenByCamera.has(session)) gone.push(session);
        }
        return gone.filter(session => this.forgetEstablished(session, { cause }));
    }

    /** Drops every entry of a removed node, announced as `node_removed`; its registrations are marked ended. */
    forgetNode(nodeId: NodeId): void {
        for (const session of [...this.#sessions.values()]) {
            if (session.nodeId === nodeId) this.forgetEstablished(session, { cause: "node_removed" });
        }
        for (const [pending, record] of this.#pending) {
            if (pending.nodeId === nodeId) record.ended = true;
        }
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
            record.claimed = "released";
            inFlight.push(record.settled);
        }
        return inFlight;
    }

    /** Every concurrent waiter gets the same device answer. */
    releaseOnce(session: ManagedSession, release: (session: ManagedSession) => Promise<boolean>): Promise<boolean> {
        return this.#release(session, release);
    }

    /** Dropped on settle, so a failure can be retried. */
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

function ownerOf(scope: SessionScope): SessionOwner {
    return {
        connectionId: scope.connectionId,
        ...(scope.clientSessionKey === undefined ? {} : { clientSessionKey: scope.clientSessionKey }),
    };
}
