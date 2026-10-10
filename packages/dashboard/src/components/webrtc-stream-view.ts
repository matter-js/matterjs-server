/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import {
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    type CameraCapabilitiesResult,
    type CameraResolution,
    type CameraSessionEndedData,
    type CameraStartStreamResult,
    type CameraStreamEvictedData,
    type MatterClient,
    type WebRtcAnswerData,
    type WebRtcCallbackData,
    type WebRtcIceCandidate,
    type WebRtcIceCandidatesData,
    type WebRtcOfferData,
    ServerCommandError,
} from "@matter-server/ws-client";
import { mdiAlertCircleOutline, mdiVideoOutline } from "@mdi/js";
import { LitElement, css, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";
import {
    buildSnapshotOverlays,
    buildVideoRequest,
    cameraErrorText,
    type CameraQualityBadge,
    type CameraStreamRef,
    snapshotMimeType,
    streamQualityBadges,
    streamsToRelease,
} from "../util/camera-api.js";
import { errorText } from "../util/error-text.js";
import "./ha-svg-icon.js";

const CAMERA_API_SCHEMA = 14;

type StreamState = "idle" | "connecting" | "streaming" | "error";

export interface CameraSnapshot {
    dataUri: string;
    resolution: CameraResolution;
    degraded: boolean;
}

interface CameraSession {
    id: number;
    result: CameraStartStreamResult;
}

/** One `start()`: everything it created, torn down together and never touched by another attempt. */
class StreamAttempt {
    session: CameraSession | null = null;
    /** Set when the camera or another connection ended the session, so teardown must not end it again. */
    sessionEnded = false;
    releasable = new Array<CameraStreamRef>();
    readonly early = new Map<number, WebRtcCallbackData[]>();
    readonly localCandidates = new Array<WebRtcIceCandidate>();
    stopSignalling: (() => void) | null = null;
    starting: Promise<unknown> | null = null;
    /** Resolves once the streams known at teardown are ended and released. */
    stopped: Promise<void> | null = null;
    /** Also covers a session that a `camera_start_stream` still in flight at teardown opens later. */
    settled: Promise<void> | null = null;

    constructor(
        readonly client: MatterClient,
        readonly pc: RTCPeerConnection,
    ) {}
}

@customElement("webrtc-stream-view")
export class WebRtcStreamView extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    client?: MatterClient;

    @property({ attribute: false }) nodeId!: number | bigint;
    @property({ type: Number }) endpointId!: number;
    @property({ type: Boolean }) liveViewSupported = true;
    @property({ attribute: false }) capabilities: CameraCapabilitiesResult | null = null;
    /** Upper bound for the video stream; null lets the server choose. */
    @property({ attribute: false }) resolution: CameraResolution | null = null;
    @property({ type: Boolean }) watermarkEnabled = false;
    @property({ type: Boolean }) osdEnabled = false;
    /** Upper bound for snapshots; null lets the server choose. */
    @property({ attribute: false }) snapshotResolution: CameraResolution | null = null;

    @state() private _state: StreamState = "idle";
    @state() private _errorMessage: string | null = null;

    @query("video") private _video?: HTMLVideoElement;

    private _attempt: StreamAttempt | null = null;
    private _retiring = new Set<StreamAttempt>();
    private _ownSnapshotStreams = new Set<number>();
    private _stopCameraEvents: (() => void) | null = null;
    private _snapshotChain: Promise<unknown> = Promise.resolve();

    get state(): StreamState {
        return this._state;
    }

    get videoStreamId(): number | null {
        return this._attempt?.session?.result.video?.stream_id ?? null;
    }

    get audioOnlySession(): boolean {
        const result = this._attempt?.session?.result;
        return result !== undefined && result.video === null && result.audio !== null;
    }

    get qualityBadges(): CameraQualityBadge[] {
        return streamQualityBadges(this._attempt?.session?.result.video ?? null);
    }

    get muted(): boolean {
        return this._video?.muted ?? true;
    }

    setMuted(muted: boolean): void {
        if (this._video) this._video.muted = muted;
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.stop()
            .then(() => this.releaseSnapshotStreams())
            .catch(err => console.warn("[webrtc-stream-view] teardown failed", err))
            .finally(() => {
                this._stopCameraEvents?.();
                this._stopCameraEvents = null;
            });
    }

    override render() {
        return html`
            <video
                autoplay
                playsinline
                muted
                disablepictureinpicture
                disableremoteplayback
                ?hidden=${this._state !== "streaming"}
            ></video>
            ${
                this._state === "idle"
                    ? html`<div class="placeholder">
                          <ha-svg-icon class="placeholder-icon" .path=${mdiVideoOutline}></ha-svg-icon>
                          <div class="placeholder-text">
                              ${
                                  this.liveViewSupported
                                      ? html`Click <b>Start</b> to begin streaming`
                                      : "Live view not supported — use Snapshot"
                              }
                          </div>
                      </div>`
                    : null
            }
            ${
                this._state === "connecting"
                    ? html`<div class="placeholder">
                          <div class="spinner"></div>
                          <div class="placeholder-text">Connecting…</div>
                      </div>`
                    : null
            }
            ${
                this._state === "error"
                    ? html`<div class="placeholder error">
                          <ha-svg-icon class="placeholder-icon" .path=${mdiAlertCircleOutline}></ha-svg-icon>
                          <div class="placeholder-text">${this._errorMessage ?? "Stream error"}</div>
                      </div>`
                    : null
            }
        `;
    }

    async start(): Promise<void> {
        if (!this.liveViewSupported) {
            this._fireStateChange("error", "Live view is not supported on this device");
            return;
        }
        const client = this.client;
        if (!client) throw new Error("Matter client not available");
        if (this._attempt) return;

        let pc: RTCPeerConnection;
        try {
            pc = new RTCPeerConnection({ iceServers: [] });
        } catch (err) {
            this._fireStateChange("error", errorText(err));
            return;
        }
        const attempt = new StreamAttempt(client, pc);
        this._attempt = attempt;
        this._fireStateChange("connecting", null);
        this._ensureCameraEvents(client);

        try {
            // A retiring attempt may still hold encoders or be opening a late session on this camera.
            await Promise.all([...this._retiring].map(retiring => retiring.settled));
            if (this._attempt !== attempt) return;

            const video = buildVideoRequest(this.capabilities, {
                maxResolution: this.resolution,
                watermarkEnabled: this.watermarkEnabled,
                osdEnabled: this.osdEnabled,
            });
            if (video !== false) pc.addTransceiver("video", { direction: "recvonly" });
            pc.addTransceiver("audio", { direction: "recvonly" });

            pc.onicecandidate = ev => {
                if (ev.candidate === null) return;
                const candidate: WebRtcIceCandidate = {
                    candidate: ev.candidate.candidate,
                    sdpMid: ev.candidate.sdpMid,
                    sdpMLineIndex: ev.candidate.sdpMLineIndex,
                };
                if (attempt.session === null) {
                    attempt.localCandidates.push(candidate);
                    return;
                }
                this._sendLocalIceCandidates(client, attempt.session, [candidate]).catch(err =>
                    console.warn("[webrtc-stream-view] sending ICE candidates failed", err),
                );
            };
            pc.onconnectionstatechange = () => {
                console.log("[webrtc-stream-view] connectionState ->", pc.connectionState);
            };
            pc.ontrack = ev => {
                const videoElement = this._video;
                if (!videoElement) return;
                // Cameras may put each track in its own MediaStream, so ev.streams[0] differs per track and
                // assigning it directly would let the audio stream replace the video stream.
                const existing = videoElement.srcObject instanceof MediaStream ? videoElement.srcObject : null;
                const stream = existing ?? new MediaStream();
                if (!stream.getTracks().includes(ev.track)) stream.addTrack(ev.track);
                if (videoElement.srcObject !== stream) videoElement.srcObject = stream;
            };

            attempt.stopSignalling = client.addWebRtcCallbackListener(event => this._onWebRtcCallback(attempt, event));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const sdp = pc.localDescription?.sdp;
            if (!sdp) throw new Error("Failed to create local SDP offer");
            if (this._attempt !== attempt) return;

            const starting = client.sendCommand("camera_start_stream", CAMERA_API_SCHEMA, {
                node_id: this.nodeId,
                endpoint_id: this.endpointId,
                stream_usage: "LiveView",
                sdp,
                ...(video === undefined ? {} : { video }),
            });
            attempt.starting = starting;
            const result = await starting;
            attempt.session = { id: result.webrtc_session_id, result };
            attempt.releasable = streamsToRelease(result);
            if (this._attempt !== attempt) {
                await attempt.settled;
                return;
            }

            for (const event of attempt.early.get(result.webrtc_session_id) ?? []) {
                await this._handleSignalling(attempt, event).catch(err => this._logSignallingFailure(event, err));
            }
            attempt.early.clear();
            if (attempt.localCandidates.length > 0 && this._attempt === attempt) {
                this._sendLocalIceCandidates(client, attempt.session, attempt.localCandidates.splice(0)).catch(err =>
                    console.warn("[webrtc-stream-view] sending ICE candidates failed", err),
                );
            }
        } catch (err) {
            await this._fail(attempt, "start failed", err);
        }
    }

    /** Ends the current attempt and waits for every attempt already being ended. */
    async stop(): Promise<void> {
        const stopped = this._retireCurrent();
        await Promise.all([stopped, ...[...this._retiring].map(retiring => retiring.stopped)]);
    }

    async takeSnapshot(): Promise<CameraSnapshot> {
        return this._runSerialized(() => this._takeSnapshot());
    }

    /** Releases the snapshot streams this view's own captures allocated. */
    async releaseSnapshotStreams(): Promise<void> {
        return this._runSerialized(async () => {
            const client = this.client;
            if (!client) return;
            for (const streamId of [...this._ownSnapshotStreams]) {
                this._ownSnapshotStreams.delete(streamId);
                await this._release(client, { kind: "snapshot", stream_id: streamId });
            }
        });
    }

    private _runSerialized<T>(op: () => Promise<T>): Promise<T> {
        const run = this._snapshotChain.then(op, op);
        this._snapshotChain = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }

    private async _takeSnapshot(): Promise<CameraSnapshot> {
        const client = this.client;
        if (!client) throw new Error("Matter client not available");
        this._ensureCameraEvents(client);
        const result = await client.sendCommand("camera_snapshot", CAMERA_API_SCHEMA, {
            node_id: this.nodeId,
            endpoint_id: this.endpointId,
            ...(this.snapshotResolution ? { max_resolution: this.snapshotResolution } : {}),
            ...buildSnapshotOverlays(this.capabilities, {
                watermarkEnabled: this.watermarkEnabled,
                osdEnabled: this.osdEnabled,
            }),
        });
        if (result.provenance === "allocated") this._ownSnapshotStreams.add(result.stream_id);
        return {
            dataUri: `data:${snapshotMimeType(result.codec)};base64,${result.data}`,
            resolution: result.resolution,
            degraded: result.degraded,
        };
    }

    /**
     * Detaches the current attempt from the view at once, so a newer `start()` can take over, and ends its
     * session in the background.
     */
    private _retireCurrent(): Promise<void> {
        const attempt = this._attempt;
        if (!attempt) return Promise.resolve();
        this._attempt = null;
        attempt.stopSignalling?.();
        attempt.stopSignalling = null;
        attempt.pc.close();
        const video = this._video;
        if (video?.srcObject) video.srcObject = null;
        if (this._state === "connecting" || this._state === "streaming") this._fireStateChange("idle", null);

        const lateStart = attempt.session === null ? attempt.starting : null;
        const stopped = this._endAttemptSession(attempt);
        attempt.stopped = stopped;
        attempt.settled = (
            lateStart
                ? stopped
                      .then(() => lateStart)
                      .then(
                          () => this._endAttemptSession(attempt),
                          // A start that fails leaves nothing to end; the start path reports it.
                          () => undefined,
                      )
                : stopped
        ).finally(() => this._retiring.delete(attempt));
        this._retiring.add(attempt);
        return stopped;
    }

    /** Reports a failure of the current attempt and ends it; a retired attempt's failure is only logged. */
    private async _fail(attempt: StreamAttempt, what: string, err: unknown): Promise<void> {
        console.warn(`[webrtc-stream-view] ${what}`, err);
        if (this._attempt !== attempt) return;
        this._fireStateChange("error", cameraErrorText(err));
        await this._retireCurrent();
    }

    private _ensureCameraEvents(client: MatterClient): void {
        if (this._stopCameraEvents) return;
        const stopEnded = client.addCameraSessionEndedListener(data => this._onSessionEnded(data));
        const stopEvicted = client.addCameraStreamEvictedListener(data => this._onStreamEvicted(data));
        this._stopCameraEvents = () => {
            stopEnded();
            stopEvicted();
        };
    }

    private _isThisCamera(data: { node_id: number | bigint; endpoint_id: number }): boolean {
        return String(data.node_id) === String(this.nodeId) && data.endpoint_id === this.endpointId;
    }

    private _onSessionEnded(data: CameraSessionEndedData): void {
        const attempt = this._attempt;
        if (!attempt || !this._isThisCamera(data) || data.webrtc_session_id !== attempt.session?.id) return;
        attempt.sessionEnded = true;
        this._retireCurrent().catch(err => console.warn("[webrtc-stream-view] stop after session end failed", err));
    }

    private _onStreamEvicted(data: CameraStreamEvictedData): void {
        if (!this._isThisCamera(data)) return;
        if (data.kind === "snapshot") this._ownSnapshotStreams.delete(data.stream_id);
        for (const attempt of [this._attempt, ...this._retiring]) {
            if (!attempt) continue;
            attempt.releasable = attempt.releasable.filter(
                stream => stream.kind !== data.kind || stream.stream_id !== data.stream_id,
            );
        }
    }

    private async _endAttemptSession(attempt: StreamAttempt): Promise<void> {
        const { client, session } = attempt;
        if (!session) return;
        if (!attempt.sessionEnded) {
            try {
                await client.sendCommand("camera_stop_stream", CAMERA_API_SCHEMA, {
                    node_id: this.nodeId,
                    endpoint_id: this.endpointId,
                    webrtc_session_id: session.id,
                });
            } catch (err) {
                console.warn("[webrtc-stream-view] camera_stop_stream failed", err);
            }
        }
        // Read after the stop, so a stream evicted meanwhile is not released.
        const releasable = attempt.releasable;
        attempt.releasable = new Array<CameraStreamRef>();
        for (const stream of releasable) await this._release(client, stream);
    }

    private async _release(client: MatterClient, stream: CameraStreamRef): Promise<void> {
        try {
            await client.sendCommand("camera_release_stream", CAMERA_API_SCHEMA, {
                node_id: this.nodeId,
                endpoint_id: this.endpointId,
                ...stream,
            });
        } catch (err) {
            const inUse = err instanceof ServerCommandError && err.errorCode === CAMERA_STREAM_IN_USE_ERROR_CODE;
            const log = inUse ? console.info : console.warn;
            log(`[webrtc-stream-view] ${stream.kind} stream ${stream.stream_id} not released`, err);
        }
    }

    private _onWebRtcCallback(attempt: StreamAttempt, event: WebRtcCallbackData): void {
        if (!this._isThisCamera(event)) return;
        const session = attempt.session;
        if (session === null) {
            const queue = attempt.early.get(event.webrtc_session_id) ?? new Array<WebRtcCallbackData>();
            queue.push(event);
            attempt.early.set(event.webrtc_session_id, queue);
            return;
        }
        if (event.webrtc_session_id !== session.id) return;
        this._handleSignalling(attempt, event).catch(err => this._logSignallingFailure(event, err));
    }

    private _logSignallingFailure(event: WebRtcCallbackData, err: unknown): void {
        console.warn("[webrtc-stream-view] signalling failed", event.event_type, err);
    }

    private async _handleSignalling(attempt: StreamAttempt, event: WebRtcCallbackData): Promise<void> {
        if (this._attempt !== attempt) return;
        switch (event.event_type) {
            case "answer":
                return this._handleAnswer(attempt, event.data);
            case "ice_candidates":
                return this._handleRemoteIceCandidates(attempt.pc, event.data);
            case "offer":
                return this._handleOffer(attempt, event.data);
            case "end":
                attempt.sessionEnded = true;
                return this._retireCurrent();
        }
    }

    private async _handleAnswer(attempt: StreamAttempt, data: WebRtcAnswerData | null): Promise<void> {
        if (!data) return;
        try {
            await attempt.pc.setRemoteDescription({ type: "answer", sdp: sanitizeAnswerSdp(data.sdp) });
        } catch (err) {
            return this._fail(attempt, "applying the answer failed", err);
        }
        if (this._attempt === attempt) this._fireStateChange("streaming", null);
    }

    /**
     * A camera re-offer on an established session; answered through `camera_provide_answer`. An offer the
     * browser refuses leaves the session as it was; once it is applied, the camera waits for an answer, so
     * a failure after that ends the session.
     */
    private async _handleOffer(attempt: StreamAttempt, data: WebRtcOfferData | null): Promise<void> {
        const { client, session, pc } = attempt;
        if (!data || !session) return;
        if (pc.signalingState !== "stable") {
            console.info("[webrtc-stream-view] camera offer ignored in signaling state", pc.signalingState);
            return;
        }
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        try {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const sdp = pc.localDescription?.sdp;
            if (!sdp) throw new Error("Failed to create local SDP answer");
            await client.sendCommand("camera_provide_answer", CAMERA_API_SCHEMA, {
                node_id: this.nodeId,
                endpoint_id: this.endpointId,
                webrtc_session_id: session.id,
                sdp,
            });
        } catch (err) {
            await this._fail(attempt, "answering the camera offer failed", err);
        }
    }

    private async _handleRemoteIceCandidates(
        pc: RTCPeerConnection,
        data: WebRtcIceCandidatesData | null,
    ): Promise<void> {
        for (const candidate of data?.ice_candidates ?? []) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (err) {
                console.warn("[webrtc-stream-view] failed to add remote ICE candidate", err, candidate);
            }
        }
    }

    private async _sendLocalIceCandidates(
        client: MatterClient,
        session: CameraSession,
        candidates: WebRtcIceCandidate[],
    ): Promise<void> {
        await client.sendCommand("camera_provide_ice_candidates", CAMERA_API_SCHEMA, {
            node_id: this.nodeId,
            endpoint_id: this.endpointId,
            webrtc_session_id: session.id,
            ice_candidates: candidates,
        });
    }

    private _fireStateChange(state: StreamState, errorMessage: string | null): void {
        this._state = state;
        this._errorMessage = errorMessage;
        this.dispatchEvent(
            new CustomEvent<{ state: StreamState; errorMessage: string | null }>("streamstate", {
                detail: { state, errorMessage },
                bubbles: false,
                composed: false,
            }),
        );
    }

    static override styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            background: black;
            position: relative;
        }
        video {
            display: block;
            flex: 1 1 0;
            min-height: 0;
            width: 100%;
            object-fit: contain;
            background: black;
        }
        video[hidden] {
            display: none;
        }
        .placeholder {
            flex: 1 1 0;
            min-height: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            color: rgba(255, 255, 255, 0.6);
            text-align: center;
            padding: 24px;
        }
        .placeholder-icon {
            --icon-primary-color: rgba(255, 255, 255, 0.3);
            width: 64px;
            height: 64px;
        }
        .placeholder-text {
            font-size: 0.95rem;
        }
        .placeholder-text b {
            color: rgba(255, 255, 255, 0.85);
            font-weight: 500;
        }
        .placeholder.error {
            color: var(--danger-color, #ff6b6b);
        }
        .placeholder.error .placeholder-icon {
            --icon-primary-color: var(--danger-color, #ff6b6b);
        }
        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(255, 255, 255, 0.15);
            border-top-color: rgba(255, 255, 255, 0.7);
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .spinner {
                animation: none;
            }
        }
    `;
}

/**
 * Some cameras (notably the matter.js camera-controller example) answer `a=sendrecv` on m-lines this
 * view offered as `a=recvonly`. RFC 3264 only allows `sendonly` as the mirror of `recvonly`, and the
 * browser rejects the answer otherwise.
 */
export function sanitizeAnswerSdp(sdp: string): string {
    const lines = sdp.split(/\r\n|\n/);
    let inMediaSection = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("m=")) {
            inMediaSection = true;
        } else if (inMediaSection && lines[i] === "a=sendrecv") {
            lines[i] = "a=sendonly";
        }
    }
    return lines.join("\r\n");
}

declare global {
    interface HTMLElementTagNameMap {
        "webrtc-stream-view": WebRtcStreamView;
    }
}
