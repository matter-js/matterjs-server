/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import type {
    MatterClient,
    WebRtcAnswerData,
    WebRtcCallbackData,
    WebRtcIceCandidatesData,
    WebRtcEndData,
} from "@matter-server/ws-client";
import { LitElement, css, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";

// Spec values from @matter/types globals/StreamUsage.ts and
// web-rtc-transport-definitions.ts WebRtcEndReason. Kept inline to avoid a new
// @matter/types dep just for two numeric literals.
const STREAM_USAGE_LIVE_VIEW = 3;
const END_REASON_USER_HANGUP = 2;

const CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID = 0x551;
const WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID = 0x553;

const DEFAULT_MAX_RESOLUTION = { width: 1920, height: 1080 };
const DEFAULT_MIN_RESOLUTION = { width: 640, height: 480 };

interface ProvideOfferResponse {
    webRtcSessionId: number;
    videoStreamId: number | null;
    audioStreamId: number | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
}

function parseStreamAllocate(value: unknown, idKey: "videoStreamId" | "audioStreamId"): number | null {
    const obj = asObject(value);
    if (!obj) return null;
    // Server may return either { videoStreamId } or { videoStreamID } depending on serializer.
    const upperKey = idKey === "videoStreamId" ? "videoStreamID" : "audioStreamID";
    return pickNumber(obj, idKey, upperKey);
}

function parseProvideOfferResponse(value: unknown): ProvideOfferResponse | null {
    const obj = asObject(value);
    if (!obj) return null;
    const sessionId = pickNumber(obj, "webRtcSessionId", "webRtcSessionID", "webrtc_session_id");
    if (sessionId === null) return null;
    return {
        webRtcSessionId: sessionId,
        videoStreamId: parseStreamAllocate(value, "videoStreamId"),
        audioStreamId: parseStreamAllocate(value, "audioStreamId"),
    };
}

type StreamState = "idle" | "connecting" | "streaming" | "error";

@customElement("webrtc-stream-view")
export class WebRtcStreamView extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    client!: MatterClient;

    @property({ type: Number }) nodeId!: number;
    @property({ type: Number }) endpointId!: number;
    @property({ type: Object }) resolution: { width: number; height: number } | null = null;

    @state() private _state: StreamState = "idle";
    @state() private _errorMessage: string | null = null;

    @query("video") private _video?: HTMLVideoElement;

    private _pc: RTCPeerConnection | null = null;
    private _localIceQueue: RTCIceCandidate[] = [];
    private _answerReceived = false;
    private _webRtcSessionId: number | null = null;
    private _videoStreamId: number | null = null;
    private _audioStreamId: number | null = null;
    private _unsubscribe: (() => void) | null = null;
    private _stopping = false;
    private _endReceivedFromPeer = false;
    private _preSessionQueue: WebRtcCallbackData[] = [];

    get state(): StreamState {
        return this._state;
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        void this.stop();
    }

    override render() {
        return html`
            <video autoplay playsinline ?hidden=${this._state !== "streaming"}></video>
            ${this._state === "idle" ? html`<div class="status">Ready</div>` : null}
            ${this._state === "connecting" ? html`<div class="status">Connecting…</div>` : null}
            ${this._state === "error"
                ? html`<div class="status error">${this._errorMessage ?? "Stream error"}</div>`
                : null}
        `;
    }

    async start(): Promise<void> {
        if (this._state === "connecting" || this._state === "streaming") return;

        this._fireStateChange("connecting", null);
        this._answerReceived = false;
        this._localIceQueue = [];
        this._stopping = false;
        this._endReceivedFromPeer = false;
        this._preSessionQueue = [];

        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            this._pc = pc;

            pc.addTransceiver("video", { direction: "recvonly" });
            pc.addTransceiver("audio", { direction: "recvonly" });

            pc.onicecandidate = ev => {
                if (ev.candidate === null) return;
                if (!this._answerReceived) {
                    this._localIceQueue.push(ev.candidate);
                    return;
                }
                void this._sendLocalIceCandidates([ev.candidate]);
            };

            pc.ontrack = ev => {
                const video = this._video;
                if (video && ev.streams[0]) {
                    video.srcObject = ev.streams[0];
                }
            };

            const videoResolution = this.resolution ?? DEFAULT_MAX_RESOLUTION;
            const videoAlloc = await this.client.deviceCommand(
                this.nodeId,
                this.endpointId,
                CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                "VideoStreamAllocate",
                {
                    streamUsage: STREAM_USAGE_LIVE_VIEW,
                    videoCodec: 0,
                    minFrameRate: 30,
                    maxFrameRate: 120,
                    minResolution: DEFAULT_MIN_RESOLUTION,
                    maxResolution: videoResolution,
                    minBitRate: 10000,
                    maxBitRate: 10000,
                    minKeyFrameInterval: 4000,
                    maxKeyFrameInterval: 4000,
                },
            );
            const videoStreamId = parseStreamAllocate(videoAlloc, "videoStreamId");
            if (videoStreamId === null) {
                throw new Error("VideoStreamAllocate did not return a videoStreamId");
            }
            this._videoStreamId = videoStreamId;

            // Audio is best-effort: not all cameras expose it.
            try {
                const audioAlloc = await this.client.deviceCommand(
                    this.nodeId,
                    this.endpointId,
                    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                    "AudioStreamAllocate",
                    {
                        streamUsage: STREAM_USAGE_LIVE_VIEW,
                        audioCodec: 0,
                        channelCount: 1,
                        sampleRate: 48000,
                        bitRate: 20000,
                        bitDepth: 24,
                    },
                );
                this._audioStreamId = parseStreamAllocate(audioAlloc, "audioStreamId");
            } catch (err) {
                console.info("AudioStreamAllocate failed; continuing video-only", err);
                this._audioStreamId = null;
            }

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            this._unsubscribe = this.client.addWebRtcCallbackListener(data => void this._onWebRtcCallback(data));

            const sdp = pc.localDescription?.sdp;
            if (!sdp) {
                throw new Error("Failed to create local SDP offer");
            }

            const offerResponse = await this.client.sendWebRtcProviderCommand(
                this.nodeId,
                this.endpointId,
                "ProvideOffer",
                {
                    webRtcSessionId: null,
                    sdp,
                    streamUsage: STREAM_USAGE_LIVE_VIEW,
                    videoStreamId: this._videoStreamId,
                    audioStreamId: this._audioStreamId,
                },
            );
            const parsed = parseProvideOfferResponse(offerResponse);
            if (parsed === null) {
                throw new Error("ProvideOffer response missing webRtcSessionId");
            }
            this._webRtcSessionId = parsed.webRtcSessionId;

            const buffered = this._preSessionQueue;
            this._preSessionQueue = [];
            for (const ev of buffered) {
                if (ev.webrtc_session_id === parsed.webRtcSessionId) {
                    await this._onWebRtcCallback(ev);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._fireStateChange("error", message);
            await this.stop();
        }
    }

    async stop(): Promise<void> {
        if (this._stopping) return;
        this._stopping = true;

        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        const sessionId = this._webRtcSessionId;
        const initiatedEnd = sessionId !== null && !this._endReceivedFromPeer;
        if (initiatedEnd) {
            try {
                await this.client.deviceCommand(
                    this.nodeId,
                    this.endpointId,
                    WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID,
                    "EndSession",
                    { webRtcSessionId: sessionId, reason: END_REASON_USER_HANGUP },
                );
            } catch (err) {
                console.warn("EndSession failed during stop", err);
            }
        }

        if (this._videoStreamId !== null) {
            try {
                await this.client.deviceCommand(
                    this.nodeId,
                    this.endpointId,
                    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                    "VideoStreamDeallocate",
                    { videoStreamId: this._videoStreamId },
                );
            } catch (err) {
                console.warn("VideoStreamDeallocate failed during stop", err);
            }
        }
        if (this._audioStreamId !== null) {
            try {
                await this.client.deviceCommand(
                    this.nodeId,
                    this.endpointId,
                    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                    "AudioStreamDeallocate",
                    { audioStreamId: this._audioStreamId },
                );
            } catch (err) {
                console.warn("AudioStreamDeallocate failed during stop", err);
            }
        }

        const video = this._video;
        if (video && video.srcObject) {
            video.srcObject = null;
        }

        if (this._pc) {
            try {
                this._pc.close();
            } catch {
                // Closing twice raises in some browsers; safe to ignore.
            }
            this._pc = null;
        }

        this._localIceQueue = [];
        this._answerReceived = false;
        this._webRtcSessionId = null;
        this._videoStreamId = null;
        this._audioStreamId = null;
        this._endReceivedFromPeer = false;
        this._preSessionQueue = [];

        if (this._state !== "idle" && this._state !== "error") {
            this._fireStateChange("idle", null);
        }
        this._stopping = false;
    }

    private async _onWebRtcCallback(data: WebRtcCallbackData): Promise<void> {
        if (this._webRtcSessionId === null) {
            if (Number(data.node_id) === Number(this.nodeId) && data.endpoint_id === this.endpointId) {
                this._preSessionQueue.push(data);
            }
            return;
        }
        if (data.webrtc_session_id !== this._webRtcSessionId) return;
        if (Number(data.node_id) !== Number(this.nodeId)) return;
        if (data.endpoint_id !== this.endpointId) return;

        switch (data.event_type) {
            case "answer":
                void this._handleAnswer(data.data);
                return;
            case "ice_candidates":
                void this._handleRemoteIceCandidates(data.data);
                return;
            case "end":
                this._handleEnd(data.data);
                return;
            case "offer":
                console.info("WebRTC re-offer received; ignoring (not handled in v1)", data);
                return;
        }
    }

    private async _handleAnswer(data: WebRtcAnswerData | null): Promise<void> {
        if (!this._pc || !data) return;
        try {
            await this._pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
            this._answerReceived = true;
            const queue = this._localIceQueue;
            this._localIceQueue = [];
            if (queue.length > 0) {
                await this._sendLocalIceCandidates(queue);
            }
            this._fireStateChange("streaming", null);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._fireStateChange("error", `Failed to apply answer: ${message}`);
            await this.stop();
        }
    }

    private async _handleRemoteIceCandidates(data: WebRtcIceCandidatesData | null): Promise<void> {
        if (!this._pc || !data) return;
        for (const c of data.ice_candidates) {
            try {
                await this._pc.addIceCandidate({
                    candidate: c.candidate,
                    sdpMid: c.sdpMid ?? undefined,
                    sdpMLineIndex: c.sdpMLineIndex ?? undefined,
                });
            } catch (err) {
                console.warn("Failed to add remote ICE candidate", err, c);
            }
        }
    }

    private _handleEnd(_data: WebRtcEndData | null): void {
        // Peer initiated the end; skip our own EndSession on teardown.
        this._endReceivedFromPeer = true;
        void this.stop();
    }

    private async _sendLocalIceCandidates(candidates: RTCIceCandidate[]): Promise<void> {
        if (this._webRtcSessionId === null || candidates.length === 0) return;
        try {
            await this.client.deviceCommand(
                this.nodeId,
                this.endpointId,
                WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID,
                "ProvideICECandidates",
                {
                    webRtcSessionId: this._webRtcSessionId,
                    ICECandidates: candidates.map(c => ({
                        candidate: c.candidate,
                        SDPMid: c.sdpMid,
                        SDPMLineIndex: c.sdpMLineIndex,
                    })),
                },
            );
        } catch (err) {
            console.warn("ProvideICECandidates failed", err);
        }
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
            display: block;
            width: 100%;
            height: 100%;
            background: black;
            position: relative;
        }
        video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: black;
        }
        video[hidden] {
            display: none;
        }
        .status {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            color: var(--md-sys-color-on-surface-variant);
            font-style: italic;
        }
        .status.error {
            color: var(--danger-color);
            font-style: normal;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "webrtc-stream-view": WebRtcStreamView;
    }
}
