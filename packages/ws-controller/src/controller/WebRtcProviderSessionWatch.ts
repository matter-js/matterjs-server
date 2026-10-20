/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Seconds, Time } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { deviceForgotSession } from "./webRtcSessionTracking.js";

const logger = Logger.get("WebRtcProviderSessionWatch");

/**
 * How long after a `StartUp` event an endpoint's first `CurrentSessions` change still counts as the restart.
 * The event and the list the reboot emptied come from the report that sets the subscription up again, which
 * can take a few report batches; a change later than this is a separate drop.
 */
export const RESTART_MARK_TIMEOUT = Seconds(30);

export interface WebRtcProviderSessionWatchIo {
    /** The `PeerNodeID` a camera stores for this server's sessions. */
    localNodeId(): NodeId;
    providerEndpoints(nodeId: NodeId): EndpointNumber[];
    /** The provider's `CurrentSessions` from node state (fabric-filtered); undefined without the cluster. */
    currentSessions(
        nodeId: NodeId,
        endpointId: EndpointNumber,
    ): readonly { id: number; peerNodeId: NodeId }[] | undefined;
    /** Ids of this provider's sessions the local requestor holds, from every route of this process run. */
    requestorSessionIds(nodeId: NodeId, endpointId: EndpointNumber): ReadonlySet<number>;
    /** `EndSession` for a session no local record names. */
    endSession(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): Promise<void>;
    /** One report of an endpoint: `present` holds the ids it lists for this server. */
    reported(nodeId: NodeId, endpointId: EndpointNumber, present: ReadonlySet<number>, restarted: boolean): void;
}

interface RestartMark {
    /** `Time.nowUs` (monotonic) after which the mark no longer applies. */
    until: number;
    /** Endpoints whose restart report was made. */
    used: Set<EndpointNumber>;
}

/**
 * Watches each camera's `CurrentSessions` (§11.5.5.1). It reports every change at the end of the report
 * batch, so a `StartUp` event in the same batch marks it as a restart whatever order the batch had.
 *
 * A `StartUp` event marks every provider endpoint of the node "restart pending". The first report of an
 * endpoint that comes from a `CurrentSessions` change ({@link currentSessionsChanged}) is marked as a restart
 * and clears the mark; after {@link RESTART_MARK_TIMEOUT} the mark is gone. A report built from node state
 * without a change (the sweep's first report, {@link sweepAgain}, {@link endpointAdded}) never uses the mark,
 * and a batch end without a change (a keepalive) does not count.
 *
 * At the first batch end per endpoint and process run (the subscription is then current) it ends the
 * sessions the camera lists for this server that the local requestor does not hold. A server that stopped
 * without `EndSession` leaves them pinning streams and encoders. {@link sweepAgain} and
 * {@link endpointAdded} make a later batch end sweep again. The sweep waits while a `ProvideOffer` or
 * `SolicitOffer` to that endpoint is in flight ({@link establishing}), because the camera can report the new
 * session before this server records it; the next batch end tries again.
 */
export class WebRtcProviderSessionWatch {
    readonly #io: WebRtcProviderSessionWatchIo;
    readonly #changed = new Map<NodeId, Set<EndpointNumber>>();
    readonly #restarts = new Map<NodeId, RestartMark>();
    readonly #swept = new Set<string>();
    readonly #nodesSwept = new Set<NodeId>();
    readonly #establishing = new Map<string, number>();

    constructor(io: WebRtcProviderSessionWatchIo) {
        this.#io = io;
    }

    #key(nodeId: NodeId, endpointId: EndpointNumber): string {
        return `${nodeId}/${endpointId}`;
    }

    currentSessionsChanged(nodeId: NodeId, endpointId: EndpointNumber): void {
        let endpoints = this.#changed.get(nodeId);
        if (endpoints === undefined) {
            endpoints = new Set();
            this.#changed.set(nodeId, endpoints);
        }
        endpoints.add(endpointId);
    }

    /** The node reported a `StartUp` event. */
    startedUp(nodeId: NodeId): void {
        this.#restarts.set(nodeId, { until: Time.nowUs + RESTART_MARK_TIMEOUT, used: new Set() });
    }

    /** Wraps every call that can make the camera create a session, until the local requestor holds it. */
    async establishing<T>(nodeId: NodeId, endpointId: EndpointNumber, work: () => Promise<T>): Promise<T> {
        const key = this.#key(nodeId, endpointId);
        this.#establishing.set(key, (this.#establishing.get(key) ?? 0) + 1);
        try {
            return await work();
        } finally {
            const left = (this.#establishing.get(key) ?? 1) - 1;
            if (left === 0) this.#establishing.delete(key);
            else this.#establishing.set(key, left);
        }
    }

    /** A report batch of the node was applied, so its state is current. */
    reportCompleted(nodeId: NodeId): void {
        const changed = this.#changed.get(nodeId) ?? new Set<EndpointNumber>();
        this.#changed.delete(nodeId);
        const sweepPending = !this.#nodesSwept.has(nodeId);
        const providers = sweepPending ? this.#io.providerEndpoints(nodeId) : [];
        const endpoints = new Set([...changed, ...providers]);
        if (endpoints.size > 0) this.#report(nodeId, endpoints, changed);
        const restart = this.#restarts.get(nodeId);
        if (restart !== undefined && Time.nowUs >= restart.until) this.#restarts.delete(nodeId);
        if (sweepPending && providers.every(endpointId => this.#swept.has(this.#key(nodeId, endpointId)))) {
            this.#nodesSwept.add(nodeId);
        }
    }

    #report(nodeId: NodeId, endpoints: ReadonlySet<EndpointNumber>, changed: ReadonlySet<EndpointNumber>): void {
        const localNodeId = this.#io.localNodeId();
        for (const endpointId of endpoints) {
            const sessions = this.#io.currentSessions(nodeId, endpointId);
            if (sessions === undefined) continue;
            const ours = new Set(
                sessions.filter(session => session.peerNodeId === localNodeId).map(session => session.id),
            );
            const restarted = changed.has(endpointId) && this.#useRestartMark(nodeId, endpointId);
            try {
                this.#io.reported(nodeId, endpointId, ours, restarted);
            } catch (error) {
                logger.warn(
                    `Handling the WebRTC session report of node ${nodeId} endpoint ${endpointId} failed:`,
                    error,
                );
            }
            this.#sweep(nodeId, endpointId, ours);
        }
    }

    #useRestartMark(nodeId: NodeId, endpointId: EndpointNumber): boolean {
        const restart = this.#restarts.get(nodeId);
        if (restart === undefined) return false;
        if (Time.nowUs >= restart.until) {
            this.#restarts.delete(nodeId);
            return false;
        }
        if (restart.used.has(endpointId)) return false;
        restart.used.add(endpointId);
        return true;
    }

    /** A later batch end looks for provider endpoints again, so a new one is swept too. */
    endpointAdded(nodeId: NodeId): void {
        this.#nodesSwept.delete(nodeId);
    }

    /** The next batch end sweeps this endpoint again, for a session this server gave up and could not end. */
    sweepAgain(nodeId: NodeId, endpointId: EndpointNumber): void {
        this.#swept.delete(this.#key(nodeId, endpointId));
        this.#nodesSwept.delete(nodeId);
    }

    nodeRemoved(nodeId: NodeId): void {
        this.#changed.delete(nodeId);
        this.#restarts.delete(nodeId);
        this.#nodesSwept.delete(nodeId);
        const prefix = `${nodeId}/`;
        for (const key of [...this.#swept]) {
            if (key.startsWith(prefix)) this.#swept.delete(key);
        }
    }

    #sweep(nodeId: NodeId, endpointId: EndpointNumber, ours: ReadonlySet<number>): void {
        const key = this.#key(nodeId, endpointId);
        if (this.#swept.has(key) || this.#establishing.has(key)) return;
        this.#swept.add(key);
        const tracked = this.#io.requestorSessionIds(nodeId, endpointId);
        for (const webRtcSessionId of ours) {
            if (tracked.has(webRtcSessionId)) continue;
            this.#endLeftover(nodeId, endpointId, webRtcSessionId).catch(error =>
                logger.warn(`Ending leftover WebRTC session ${webRtcSessionId} on node ${nodeId} failed:`, error),
            );
        }
    }

    async #endLeftover(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): Promise<void> {
        try {
            await this.#io.endSession(nodeId, endpointId, webRtcSessionId);
        } catch (error) {
            if (deviceForgotSession(error)) return;
            throw error;
        }
        logger.notice(
            `Ended WebRTC session ${webRtcSessionId} on node ${nodeId} endpoint ${endpointId}: the camera held it for this server, but the local requestor does not (left from an earlier run, opened with device_command, or given up and not ended)`,
        );
    }
}
