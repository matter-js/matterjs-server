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
    type CameraTalkbackMode,
    cameraTalkbackMode,
    microphoneUnavailableReason,
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

let attemptCount = 0;

/** One `start()`: everything it created, torn down together and never touched by another attempt. */
class StreamAttempt {
    /** Names the session in `camera_start_stream`, so its events and commands need no session id. */
    readonly key = `webrtc-stream-view-${++attemptCount}`;
    session: CameraSession | null = null;
    /** Set when the camera or another connection ended the session, so teardown must not end it again. */
    sessionEnded = false;
    /** One answered `camera_stop_stream` by key ends the session or cancels its start. */
    stopAnswered = false;
    /** The server answered the start with an error, so no session exists to stop. */
    startRefused = false;
    releasable = new Array<CameraStreamRef>();
    /** Found before `camera_start_stream` was sent; the key names no session until then. */
    readonly localCandidates = new Array<WebRtcIceCandidate>();
    stopSignalling: (() => void) | null = null;
    starting: Promise<unknown> | null = null;
    /** Resolves once the streams known at teardown are ended and released. */
    stopped: Promise<void> | null = null;
    /** Also covers a session that a `camera_start_stream` still in flight at teardown opens later. */
    settled: Promise<void> | null = null;
    /** Set only when the offer asked the camera for talkback. */
    talkTransceiver: RTCRtpTransceiver | null = null;
    talkbackMode: CameraTalkbackMode | null = null;
    micTrack: MediaStreamTrack | null = null;
    /** Bumped by every talk change and by teardown, so a microphone granted after either is stopped at once. */
    talkRequest = 0;

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
    private _userMuted = true;

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

    /** The user's choice; a half-duplex camera's audio is also muted while talking. */
    get muted(): boolean {
        return this._userMuted;
    }

    setMuted(muted: boolean): void {
        this._userMuted = muted;
        this._applyPlaybackMute();
    }

    /** On a live stream, changes of this and of {@link talking} are announced with `talkchange`; teardown with `streamstate`. */
    get talkAvailable(): boolean {
        return this._attempt !== null && this._talkNegotiated(this._attempt);
    }

    get talking(): boolean {
        return this._attempt?.micTrack != null;
    }

    get talkMutesPlayback(): boolean {
        return this._attempt?.talkbackMode === "HalfDuplex";
    }

    /**
     * Rejects when talking is not available or the microphone cannot be captured or sent; the view is then
     * not talking. Switching off rejects only when the sender cannot be cleared, after the microphone stopped.
     */
    async setTalking(talking: boolean): Promise<void> {
        const attempt = this._attempt;
        const sender = attempt?.talkTransceiver?.sender;
        if (!talking) {
            if (attempt) await this._releaseMicrophone(attempt);
            return;
        }
        if (!attempt || !sender || !this._talkNegotiated(attempt)) {
            throw new Error("Talking is not available for this stream");
        }
        if (attempt.micTrack) return;
        const unavailable = microphoneUnavailableReason();
        if (unavailable !== null) throw new Error(unavailable);
        const request = ++attempt.talkRequest;

        let media: MediaStream;
        try {
            media = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            if (attempt.talkRequest === request) throw err;
            return;
        }
        const track = media.getAudioTracks()[0];
        const current = attempt.talkRequest === request;
        if (!current || !track) {
            for (const captured of media.getTracks()) captured.stop();
            if (current) throw new Error("No microphone found");
            return;
        }
        attempt.micTrack = track;
        // The browser ends the track when the device goes away or the permission is revoked.
        track.addEventListener("ended", () => this._releaseMicrophoneIf(attempt, track), { once: true });
        this._applyPlaybackMute();
        this._fireTalkChange();
        try {
            await sender.replaceTrack(track);
        } catch (err) {
            this._releaseMicrophoneIf(attempt, track);
            throw err;
        }
    }

    private _releaseMicrophoneIf(attempt: StreamAttempt, track: MediaStreamTrack): void {
        if (attempt.micTrack !== track) return;
        this._releaseMicrophone(attempt)?.catch(warnSenderNotCleared);
    }

    private _talkNegotiated(attempt: StreamAttempt): boolean {
        const direction = attempt.talkTransceiver?.currentDirection;
        return (direction === "sendrecv" || direction === "sendonly") && attempt.session?.result.talkback === true;
    }

    private _fireTalkChange(): void {
        this.dispatchEvent(new CustomEvent("talkchange", { bubbles: false, composed: false }));
    }

    /**
     * Stops the live microphone. On the current attempt it also announces the change (unless `announce` is
     * false) and clears the sender, returning that call; null when nothing was live or the attempt is retired.
     */
    private _releaseMicrophone(attempt: StreamAttempt, announce = true): Promise<void> | null {
        attempt.talkRequest++;
        const track = attempt.micTrack;
        if (!track) return null;
        attempt.micTrack = null;
        track.stop();
        this._applyPlaybackMute();
        const sender = attempt.talkTransceiver?.sender;
        if (this._attempt !== attempt || !sender) return null;
        if (announce) this._fireTalkChange();
        return sender.replaceTrack(null);
    }

    private _applyPlaybackMute(): void {
        const attempt = this._attempt;
        const halfDuplexTalking = attempt?.micTrack != null && attempt.talkbackMode === "HalfDuplex";
        if (this._video) this._video.muted = this._userMuted || halfDuplexTalking;
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
            const talkbackMode = cameraTalkbackMode(this.capabilities);
            const audio = pc.addTransceiver("audio", { direction: talkbackMode ? "sendrecv" : "recvonly" });
            if (talkbackMode) {
                attempt.talkTransceiver = audio;
                attempt.talkbackMode = talkbackMode;
            }

            pc.onicecandidate = ev => {
                if (ev.candidate === null) return;
                const candidate: WebRtcIceCandidate = {
                    candidate: ev.candidate.candidate,
                    sdpMid: ev.candidate.sdpMid,
                    sdpMLineIndex: ev.candidate.sdpMLineIndex,
                };
                if (attempt.starting === null) {
                    attempt.localCandidates.push(candidate);
                    return;
                }
                this._sendLocalIceCandidates(attempt, [candidate]);
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
                ...(attempt.talkbackMode === null ? {} : { talkback: true }),
                client_session_key: attempt.key,
            });
            attempt.starting = starting;
            if (attempt.localCandidates.length > 0) {
                this._sendLocalIceCandidates(attempt, attempt.localCandidates.splice(0));
            }
            const result = await starting;
            attempt.session = { id: result.webrtc_session_id, result };
            attempt.releasable = streamsToRelease(result);
            if (this._attempt !== attempt) {
                await attempt.settled;
                return;
            }
        } catch (err) {
            // Any other failure (a timeout, a lost answer) may leave a session the key can still end.
            if (attempt.session === null && err instanceof ServerCommandError) attempt.startRefused = true;
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
        this._releaseMicrophone(attempt);
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
        if (!attempt || !this._isThisCamera(data) || data.client_session_key !== attempt.key) return;
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

    /** Also cancels a `camera_start_stream` still running, which then fails. */
    private async _endAttemptSession(attempt: StreamAttempt): Promise<void> {
        const { client } = attempt;
        if (attempt.starting === null || attempt.startRefused) return;
        if (!attempt.sessionEnded && !attempt.stopAnswered) {
            try {
                await client.sendCommand("camera_stop_stream", CAMERA_API_SCHEMA, {
                    node_id: this.nodeId,
                    endpoint_id: this.endpointId,
                    client_session_key: attempt.key,
                });
                attempt.stopAnswered = true;
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
        if (!this._isThisCamera(event) || event.client_session_key !== attempt.key) return;
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
                return this._handleOffer(attempt, event.webrtc_session_id, event.data);
        }
    }

    private async _handleAnswer(attempt: StreamAttempt, data: WebRtcAnswerData | null): Promise<void> {
        if (!data) return;
        try {
            await attempt.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
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
    private async _handleOffer(
        attempt: StreamAttempt,
        webRtcSessionId: number,
        data: WebRtcOfferData | null,
    ): Promise<void> {
        const { client, pc } = attempt;
        if (!data) return;
        if (pc.signalingState !== "stable") {
            console.info("[webrtc-stream-view] camera offer ignored in signaling state", pc.signalingState);
            return;
        }
        const wasAvailable = this._talkNegotiated(attempt);
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        try {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const available = this._talkNegotiated(attempt);
            const released = available ? null : this._releaseMicrophone(attempt, false);
            released?.catch(warnSenderNotCleared);
            if (this._attempt === attempt && (released !== null || available !== wasAvailable)) {
                this._fireTalkChange();
            }
            const sdp = pc.localDescription?.sdp;
            if (!sdp) throw new Error("Failed to create local SDP answer");
            await client.sendCommand("camera_provide_answer", CAMERA_API_SCHEMA, {
                node_id: this.nodeId,
                endpoint_id: this.endpointId,
                webrtc_session_id: webRtcSessionId,
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

    private _sendLocalIceCandidates(attempt: StreamAttempt, candidates: WebRtcIceCandidate[]): void {
        attempt.client
            .sendCommand("camera_provide_ice_candidates", CAMERA_API_SCHEMA, {
                node_id: this.nodeId,
                endpoint_id: this.endpointId,
                client_session_key: attempt.key,
                ice_candidates: candidates,
            })
            .catch(err => console.warn("[webrtc-stream-view] sending ICE candidates failed", err));
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

function warnSenderNotCleared(err: unknown): void {
    console.warn("[webrtc-stream-view] clearing the microphone from the sender failed", err);
}

declare global {
    interface HTMLElementTagNameMap {
        "webrtc-stream-view": WebRtcStreamView;
    }
}
