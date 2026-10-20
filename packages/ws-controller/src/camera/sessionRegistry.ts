/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EndpointNumber, NodeId } from "@matter/main";
import { endedOnDevice, invokeEndSession } from "../controller/webRtcSessionTracking.js";
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

/** A `CurrentSessions` report no longer listing the session, or the peer's `End`. */
export type CameraEnd = { cause: "camera_dropped" | "camera_restarted" } | { cause: "peer"; reason?: number };

/**
 * Everything learned about one session, from {@link CameraSessionRegistry.begin} until it ends. The tracked
 * entry is the registration's own lifecycle, so what was learned while establishing still counts.
 *
 * | state                                  | `session` | `cameraEnded` | `over` | in `#tracked` |
 * | -------------------------------------- | --------- | ------------- | ------ | ------------- |
 * | establishing                           | -         | -             | false  | no            |
 * | camera reported its end, not yet track | -         | set           | false  | no            |
 * | ended while establishing               | -         | any           | true   | no            |
 * | tracked                                | set       | -             | false  | yes           |
 * | camera reported its end, EndSession on | set       | set           | false  | yes           |
 * | ended and announced                    | set       | any           | true   | no            |
 *
 * A registration stays in `#pending` until `finish`, also after `track` and after it ended.
 */
interface Lifecycle {
    readonly nodeId: NodeId;
    readonly endpointId: EndpointNumber;
    webRtcSessionId?: number;
    session?: ManagedSession;
    /** A report listed the id; only then can a report without it end the session. */
    listed: boolean;
    /** Acted on once no `EndSession` for the session is in flight; the first evidence wins. */
    cameraEnded?: CameraEnd;
    endsInFlight: number;
    /** The one `EndSession` that stops and releases of this session share. */
    stopping?: Promise<boolean>;
    over: boolean;
}

interface PendingRecord {
    /** `released`: a release path (closing connection, shutdown) took it. `stopped`: its owner's stop did. */
    claimed?: "released" | "stopped";
    settled: Promise<void>;
    markSettled: () => void;
    /** The camera gave the id to another session: this registration neither receives its signalling nor ends it. */
    superseded: boolean;
    life: Lifecycle;
    /** The `EndSession` the establishing call sent for the session it gave up. */
    ending?: Promise<boolean>;
}

/** Either way the caller must end the session. */
export type SessionTrackRefusal = "claimed" | "stopped" | "already_ended";

/** The id names another session now: the caller must not end it or drop its local tracking. */
export type SessionSuperseded = "superseded";

/** What {@link CameraSessionRegistry.claim} took over. */
export interface ClaimedSessions {
    /** Each must be stopped with {@link CameraSessionRegistry.stop}. */
    tracked: ManagedSession[];
    /** Settle once the establishing call, which ends the session itself, has finished. */
    starting: Promise<void>[];
}

/**
 * Keyed by node, endpoint and id: `WebRTCSessionID` is unique per node (§11.4.5.1), and every route names a
 * session by all three.
 *
 * Every session ends and is announced at most once, whatever order reports, stops, releases, peer `End`s,
 * reissued ids and node removal arrive in. Ends the camera tells about are recorded and applied by
 * `#settle` once no `EndSession` is in flight, so a finished `EndSession` names who asked for it, and a
 * failed one leaves the recorded end to apply.
 */
export class CameraSessionRegistry {
    readonly #announce: (ended: CameraSessionEnded) => void;
    readonly #vanished: (session: ManagedSession, cause: CameraEnd["cause"]) => void;
    readonly #tracked = new Map<string, Lifecycle>();
    readonly #pending = new Map<PendingSession, PendingRecord>();

    /**
     * @param vanished called for a tracked session a report no longer lists, after it was announced; the
     *   local requestor still holds it, since no `EndSession` or `End` went through it.
     */
    constructor(
        announce: (ended: CameraSessionEnded) => void,
        vanished: (session: ManagedSession, cause: CameraEnd["cause"]) => void,
    ) {
        this.#announce = announce;
        this.#vanished = vanished;
    }

    #key(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): string {
        return `${nodeId}/${endpointId}/${webRtcSessionId}`;
    }

    *#trackedSessions(): Generator<ManagedSession> {
        for (const life of this.#tracked.values()) if (life.session !== undefined) yield life.session;
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
        this.#pending.set(pending, {
            settled,
            markSettled,
            superseded: false,
            life: { nodeId, endpointId, listed: false, endsInFlight: 0, over: false },
        });
        return pending;
    }

    /** On any node: a key names one session of its connection, so events and commands are unambiguous. */
    clientSessionKeyInUse(connectionId: string, clientSessionKey: string): boolean {
        const owns = (scope: SessionScope) =>
            scope.connectionId === connectionId && scope.clientSessionKey === clientSessionKey;
        for (const session of this.#trackedSessions()) if (owns(session)) return true;
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
        for (const session of this.#trackedSessions()) if (named(session)) return { session };
        for (const pending of this.#pending.keys()) if (named(pending)) return { pending };
        return undefined;
    }

    /**
     * The owner stops a session it is still establishing: {@link track} refuses it with `stopped`, so the
     * establishing call ends it. Resolves once that call finished, with the outcome of its `EndSession`
     * (see {@link ending}), or `false` when it ended nothing: it gave up before the camera opened a session,
     * or the session's id names another session now.
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
        if (record !== undefined) record.life.webRtcSessionId = webRtcSessionId;
    }

    /**
     * The camera handed this id to a session another route established. A session still recorded under it is
     * one the camera lost: an established entry is dropped and announced as `camera_restarted`, and a
     * registration waiting for it is marked superseded.
     */
    issued(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): void {
        this.#issued(nodeId, endpointId, webRtcSessionId, undefined);
    }

    #issued(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number, to: PendingSession | undefined): void {
        const lost = this.#tracked.get(this.#key(nodeId, endpointId, webRtcSessionId));
        if (lost !== undefined) this.#close(lost, { cause: "camera_restarted" });
        for (const [pending, record] of this.#holding(nodeId, endpointId, webRtcSessionId)) {
            if (pending !== to) record.superseded = true;
        }
    }

    *#holding(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
    ): Generator<[PendingSession, PendingRecord]> {
        for (const [pending, record] of this.#pending) {
            if (
                pending.nodeId === nodeId &&
                pending.endpointId === endpointId &&
                record.life.webRtcSessionId === webRtcSessionId
            ) {
                yield [pending, record];
            }
        }
    }

    /** The lifecycle of the live session this server knows under the id: tracked, or still being established. */
    #named(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): Lifecycle | undefined {
        const tracked = this.#tracked.get(this.#key(nodeId, endpointId, webRtcSessionId));
        if (tracked !== undefined) return tracked;
        for (const [, record] of this.#holding(nodeId, endpointId, webRtcSessionId)) {
            if (!record.superseded) return record.life;
        }
        return undefined;
    }

    /**
     * `claimed`: a release path is waiting for it. `stopped`: its owner cancelled it. `already_ended`: it
     * ended between the offer response and this call, by an `EndSession`, the peer, a report that listed it
     * and then no longer did, or node removal. `superseded` wins over a claim, because ending the id would end
     * another session.
     */
    track(pending: PendingSession, session: ManagedSession): SessionTrackRefusal | SessionSuperseded | undefined {
        const record = this.#pending.get(pending);
        if (record === undefined) return "claimed";
        if (record.superseded) return "superseded";
        const claimRefusal = this.claimRefusal(pending);
        if (claimRefusal !== undefined) return claimRefusal;
        const { life } = record;
        if (life.over || life.cameraEnded !== undefined) return "already_ended";
        life.webRtcSessionId = session.webRtcSessionId;
        life.session = session;
        this.#tracked.set(this.#key(session.nodeId, session.endpointId, session.webRtcSessionId), life);
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
     * signalling from then on, before {@link track} runs. A superseded registration does not.
     */
    signallingOwner(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): SessionOwner | undefined {
        const session = this.get(nodeId, endpointId, webRtcSessionId);
        if (session !== undefined) return ownerOf(session);
        for (const [pending, record] of this.#holding(nodeId, endpointId, webRtcSessionId)) {
            if (!record.superseded) return ownerOf(pending);
        }
        return undefined;
    }

    get(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): ManagedSession | undefined {
        return this.#tracked.get(this.#key(nodeId, endpointId, webRtcSessionId))?.session;
    }

    /**
     * `EndSession` for a stop or a release (`camera_stop_stream`, closing owner, shutdown). Concurrent calls
     * for one session share one `EndSession` and its answer: `true` when the camera ended the session, `false`
     * on `NotFound`; any other failure rejects and leaves the session to a later attempt. An id nothing
     * names is sent all the same: the camera's `CurrentSessions` is the record of what exists.
     */
    stop(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        end: SessionEnd,
        send: () => Promise<unknown>,
    ): Promise<boolean> {
        const life = this.#named(nodeId, endpointId, webRtcSessionId);
        if (life === undefined)
            return endedOnDevice(this.#end(undefined, nodeId, endpointId, webRtcSessionId, end, send));
        if (life.stopping !== undefined) return life.stopping;
        const stopping = endedOnDevice(this.#end(life, nodeId, endpointId, webRtcSessionId, end, send)).finally(() => {
            if (life.stopping === stopping) life.stopping = undefined;
        });
        life.stopping = stopping;
        return stopping;
    }

    /**
     * A client's own `EndSession` (`device_command`): its own invoke, whose response or error is passed on,
     * ending the session like {@link stop} does.
     */
    endSession<T>(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        end: SessionEnd,
        send: () => Promise<T>,
    ): Promise<T> {
        return this.#end(
            this.#named(nodeId, endpointId, webRtcSessionId),
            nodeId,
            endpointId,
            webRtcSessionId,
            end,
            send,
        );
    }

    /** Counted on `life` from before `send` runs until it settled, so `#settle` waits for it. */
    async #end<T>(
        life: Lifecycle | undefined,
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        end: SessionEnd,
        send: () => Promise<T>,
    ): Promise<T> {
        if (life === undefined) {
            return invokeEndSession(send, async deviceHeldSession => {
                if (deviceHeldSession) this.#announceEnd(nodeId, endpointId, webRtcSessionId, end, undefined);
            });
        }
        life.endsInFlight++;
        try {
            return await invokeEndSession(send, async deviceHeldSession => {
                this.#endSessionAnswered(life, nodeId, endpointId, webRtcSessionId, end, deviceHeldSession);
            });
        } finally {
            life.endsInFlight--;
            this.#settle(life);
        }
    }

    /**
     * A tracked session is announced with the `EndSession`'s requester; on `NotFound` with the end the camera
     * reported, if any. A session still being established is not announced to its owner: its start fails
     * instead. Everyone else is told, as for an id nothing names, unless the server gave the session up.
     */
    #endSessionAnswered(
        life: Lifecycle,
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        end: SessionEnd,
        deviceHeldSession: boolean,
    ): void {
        if (life.over) return;
        if (life.session !== undefined) {
            this.#close(life, deviceHeldSession ? end : (life.cameraEnded ?? end));
            return;
        }
        life.over = true;
        if (deviceHeldSession && end.cause !== "released") {
            this.#announceEnd(nodeId, endpointId, webRtcSessionId, end, undefined);
        }
    }

    /**
     * The peer ended the session. Returns whether a tracked session had the id. With an `EndSession` in
     * flight the end is announced once that finished, with the `EndSession`'s requester if it succeeded.
     */
    peerEnded(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number, reason?: number): boolean {
        const life = this.#named(nodeId, endpointId, webRtcSessionId);
        if (life === undefined) return false;
        life.cameraEnded ??= { cause: "peer", ...(reason === undefined ? {} : { reason }) };
        const tracked = life.session !== undefined;
        this.#settle(life);
        return tracked;
    }

    /**
     * Applies one `CurrentSessions` report of an endpoint (`present`: the ids it lists for this server), to
     * tracked sessions and to registrations the camera gave an id. A session ends by a report only after an
     * earlier report listed it: a report built before a new session's offer does not list it.
     */
    reconcile(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        present: ReadonlySet<number>,
        cause: "camera_restarted" | "camera_dropped",
    ): void {
        const onEndpoint = (life: Lifecycle) =>
            life.nodeId === nodeId && life.endpointId === endpointId && life.webRtcSessionId !== undefined;
        const reported = new Set<Lifecycle>();
        for (const life of this.#tracked.values()) if (onEndpoint(life)) reported.add(life);
        for (const record of this.#pending.values()) if (onEndpoint(record.life)) reported.add(record.life);
        for (const life of reported) {
            const { webRtcSessionId } = life;
            if (webRtcSessionId === undefined) continue;
            if (present.has(webRtcSessionId)) life.listed = true;
            else if (life.listed) life.cameraEnded ??= { cause };
        }
        for (const life of reported) this.#settle(life);
    }

    /** Drops every entry of a removed node, announced as `node_removed`; its registrations are marked ended. */
    forgetNode(nodeId: NodeId): void {
        for (const life of [...this.#tracked.values()]) {
            if (life.nodeId === nodeId) this.#close(life, { cause: "node_removed" });
        }
        for (const [pending, record] of this.#pending) {
            if (pending.nodeId === nodeId) record.life.over = true;
        }
    }

    /**
     * Take responsibility for every session in scope, established or being established. A claimed in-flight
     * registration ends itself instead of being tracked.
     */
    claim(matches: (scope: SessionScope) => boolean): ClaimedSessions {
        const tracked = new Array<ManagedSession>();
        for (const session of this.#trackedSessions()) {
            if (matches(session)) tracked.push(session);
        }
        const starting = new Array<Promise<void>>();
        for (const [pending, record] of this.#pending) {
            if (!matches(pending)) continue;
            record.claimed = "released";
            starting.push(record.settled);
        }
        return { tracked, starting };
    }

    /** The one decision point for an end the camera reported: applied once no `EndSession` is in flight. */
    #settle(life: Lifecycle): void {
        const { session, cameraEnded } = life;
        if (life.over || life.endsInFlight > 0 || session === undefined || cameraEnded === undefined) return;
        this.#close(life, cameraEnded);
        if (cameraEnded.cause !== "peer") this.#vanished(session, cameraEnded.cause);
    }

    /** The one place a tracked session ends and is announced. */
    #close(life: Lifecycle, end: SessionEnd): void {
        const { session } = life;
        if (life.over || session === undefined) return;
        life.over = true;
        const key = this.#key(session.nodeId, session.endpointId, session.webRtcSessionId);
        if (this.#tracked.get(key) === life) this.#tracked.delete(key);
        this.#announceEnd(session.nodeId, session.endpointId, session.webRtcSessionId, end, session);
    }

    /** Without an owner the route tells every camera-aware connection. */
    #announceEnd(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        end: SessionEnd,
        owner: SessionScope | undefined,
    ): void {
        this.#announce({
            nodeId,
            endpointId,
            webRtcSessionId,
            ...(owner === undefined ? {} : { ownerId: owner.connectionId }),
            ...(owner?.clientSessionKey === undefined ? {} : { clientSessionKey: owner.clientSessionKey }),
            ...end,
        });
    }
}

function ownerOf(scope: SessionScope): SessionOwner {
    return {
        connectionId: scope.connectionId,
        ...(scope.clientSessionKey === undefined ? {} : { clientSessionKey: scope.clientSessionKey }),
    };
}
