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
import { asObject, pickNumber } from "../util/attribute-shapes.js";

// Spec values from @matter/types globals/StreamUsage.ts and
// web-rtc-transport-definitions.ts WebRtcEndReason. Kept inline to avoid a new
// @matter/types dep just for two numeric literals.
const STREAM_USAGE_LIVE_VIEW = 3;
const END_REASON_USER_HANGUP = 2;

// Hardcoded to avoid pulling full cluster schema into the dashboard bundle.
export const CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID = 0x551;
const WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID = 0x553;

// AVSM FeatureMap bits (spec §11.2.4): WMARK=6 enables watermark overlay,
// OSD=7 enables on-screen display. When advertised, VideoStreamAllocate and
// SnapshotStreamAllocate REQUIRE watermarkEnabled / osdEnabled fields.
const AVSM_FEAT_WMARK = 1 << 6;
const AVSM_FEAT_OSD = 1 << 7;
const AVSM_FEATURE_MAP_ATTR_ID = 0xfffc;

const DEFAULT_MAX_RESOLUTION = { width: 1920, height: 1080 };
const DEFAULT_MIN_RESOLUTION = { width: 640, height: 480 };

interface ProvideOfferResponse {
    webRtcSessionId: number;
    videoStreamId: number | null;
    audioStreamId: number | null;
}

function parseStreamAllocate(value: unknown, idKey: "videoStreamId" | "audioStreamId"): number | null {
    const obj = asObject(value);
    if (!obj) return null;
    return pickNumber(obj, idKey);
}

function parseSnapshotAllocateResponse(value: unknown): number | null {
    const obj = asObject(value);
    if (!obj) return null;
    return pickNumber(obj, "snapshotStreamId");
}

interface SnapshotCapability {
    resolution: { width: number; height: number };
    maxFrameRate: number;
    imageCodec: number;
}

const SNAPSHOT_DEFAULTS: SnapshotCapability = {
    resolution: { width: 1920, height: 1080 },
    maxFrameRate: 30,
    imageCodec: 0,
};

function parseSnapshotCapabilitiesFromList(list: unknown[]): SnapshotCapability {
    // SnapshotCapabilitiesStruct field IDs per Matter 1.5.1 §11.2.6.9:
    // 0=resolution (VideoResolutionStruct {0=width, 1=height}), 1=maxFrameRate, 2=imageCodec.
    // Cached attributes are tag-based (numeric keys); read_attribute responses are name-based.
    // Prefer the highest-resolution entry — Aqara G350 ships [VGA, 1080p] and 1080p is the useful one.
    const candidates = list.map(asObject).filter((c): c is Record<string, unknown> => c !== undefined);
    if (candidates.length === 0) return SNAPSHOT_DEFAULTS;
    const parsed = candidates.map(cap => {
        const res = asObject(cap["resolution"] ?? cap["0"]);
        const width = res ? pickNumber(res, "width", "0") : null;
        const height = res ? pickNumber(res, "height", "1") : null;
        const maxFrameRate = pickNumber(cap, "maxFrameRate", "1");
        const imageCodec = pickNumber(cap, "imageCodec", "2");
        return {
            resolution: {
                width: width ?? SNAPSHOT_DEFAULTS.resolution.width,
                height: height ?? SNAPSHOT_DEFAULTS.resolution.height,
            },
            maxFrameRate: maxFrameRate ?? SNAPSHOT_DEFAULTS.maxFrameRate,
            imageCodec: imageCodec ?? SNAPSHOT_DEFAULTS.imageCodec,
        };
    });
    return parsed.reduce((best, cur) =>
        cur.resolution.width * cur.resolution.height > best.resolution.width * best.resolution.height ? cur : best,
    );
}

interface CaptureSnapshotResult {
    dataBase64: string;
    imageCodec: number;
    resolution: { width: number; height: number };
}

function bytesToBase64(bytes: Uint8Array): string {
    // Chunked to avoid stack overflow when spreading large arrays into String.fromCharCode.
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

function parseDataToBase64(data: unknown): string {
    if (typeof data === "string") return data;
    if (data instanceof Uint8Array) return bytesToBase64(data);
    if (data instanceof ArrayBuffer) return bytesToBase64(new Uint8Array(data));
    if (Array.isArray(data)) return bytesToBase64(new Uint8Array(data as number[]));
    throw new Error(`Unexpected snapshot data shape: ${typeof data}`);
}

function parseCaptureSnapshotResponse(value: unknown): CaptureSnapshotResult {
    const obj = asObject(value);
    if (!obj) throw new Error("CaptureSnapshot returned no response");
    const data = obj["data"];
    if (data == null) throw new Error("CaptureSnapshot response missing data field");
    const imageCodec = pickNumber(obj, "imageCodec") ?? 0;
    const res = asObject(obj["resolution"]);
    const width = res ? (pickNumber(res, "width") ?? 0) : 0;
    const height = res ? (pickNumber(res, "height") ?? 0) : 0;
    return { dataBase64: parseDataToBase64(data), imageCodec, resolution: { width, height } };
}

function parseProvideOfferResponse(value: unknown): ProvideOfferResponse | null {
    const obj = asObject(value);
    if (!obj) return null;
    const sessionId = pickNumber(obj, "webRtcSessionId");
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
    client?: MatterClient;

    @property({ attribute: false }) nodeId!: number | bigint;
    @property({ type: Number }) endpointId!: number;
    @property({ type: Object }) resolution: { width: number; height: number } | null = null;

    @state() private _state: StreamState = "idle";
    @state() private _errorMessage: string | null = null;

    private _snapshotStreamId: number | null = null;
    private _snapshotResolution: { width: number; height: number } | null = null;

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

    get videoStreamId(): number | null {
        return this._videoStreamId;
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        void this.deallocateSnapshot();
        void this.stop();
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
            ${this._state === "idle" ? html`<div class="status">Ready</div>` : null}
            ${this._state === "connecting" ? html`<div class="status">Connecting…</div>` : null}
            ${this._state === "error"
                ? html`<div class="status error">${this._errorMessage ?? "Stream error"}</div>`
                : null}
        `;
    }

    async start(): Promise<void> {
        if (!this.client) throw new Error("Matter client not available");
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
                if (ev.candidate === null) {
                    console.log("[webrtc-stream-view] local ICE gathering complete");
                    return;
                }
                console.log("[webrtc-stream-view] local ICE candidate", ev.candidate.candidate, {
                    queued: !this._answerReceived,
                    queueDepth: this._localIceQueue.length,
                });
                if (!this._answerReceived) {
                    this._localIceQueue.push(ev.candidate);
                    return;
                }
                void this._sendLocalIceCandidates([ev.candidate]);
            };
            pc.oniceconnectionstatechange = () => {
                console.log("[webrtc-stream-view] iceConnectionState ->", pc.iceConnectionState);
            };
            pc.onconnectionstatechange = () => {
                console.log("[webrtc-stream-view] connectionState ->", pc.connectionState);
            };
            pc.onsignalingstatechange = () => {
                console.log("[webrtc-stream-view] signalingState ->", pc.signalingState);
            };

            pc.ontrack = ev => {
                const video = this._video;
                if (video && ev.streams[0]) {
                    video.srcObject = ev.streams[0];
                }
            };

            const minResolution = this.resolution ?? DEFAULT_MIN_RESOLUTION;
            const maxResolution = this.resolution ?? DEFAULT_MAX_RESOLUTION;
            const avsmFeatures = this._readAvsmFeatures();
            const videoAllocPayload: Record<string, unknown> = {
                streamUsage: STREAM_USAGE_LIVE_VIEW,
                videoCodec: 0,
                minFrameRate: 30,
                maxFrameRate: 120,
                minResolution,
                maxResolution,
                minBitRate: 10000,
                maxBitRate: 10000,
                keyFrameInterval: 4000,
            };
            if (avsmFeatures.wmark) videoAllocPayload.watermarkEnabled = false;
            if (avsmFeatures.osd) videoAllocPayload.osdEnabled = false;
            let videoAlloc: unknown;
            try {
                videoAlloc = await this.client.deviceCommand(
                    this.nodeId,
                    this.endpointId,
                    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                    "VideoStreamAllocate",
                    videoAllocPayload,
                );
            } catch (err) {
                // Cameras with shared encoder pools (Aqara G350) refuse VideoStreamAllocate
                // while a snapshot stream is held. Detect ResourceExhausted (Matter Status 137),
                // free the snapshot stream, retry once.
                const message = err instanceof Error ? err.message : String(err);
                const isResourceExhausted = message.includes("Resource exhausted") || message.includes("(code 137)");
                if (!isResourceExhausted || this._snapshotStreamId === null) throw err;
                console.info(
                    "[webrtc-stream-view] VideoStreamAllocate ResourceExhausted; freeing snapshot stream and retrying",
                );
                await this.deallocateSnapshot();
                videoAlloc = await this.client.deviceCommand(
                    this.nodeId,
                    this.endpointId,
                    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                    "VideoStreamAllocate",
                    videoAllocPayload,
                );
            }
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

            console.log("[webrtc-stream-view] sending ProvideOffer", {
                nodeId: this.nodeId,
                endpointId: this.endpointId,
                videoStreamId: this._videoStreamId,
                audioStreamId: this._audioStreamId,
                streamUsage: STREAM_USAGE_LIVE_VIEW,
                sdpLength: sdp.length,
            });
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
            console.log("[webrtc-stream-view] ProvideOffer response", offerResponse);
            const parsed = parseProvideOfferResponse(offerResponse);
            if (parsed === null) {
                throw new Error("ProvideOffer response missing webRtcSessionId");
            }
            this._webRtcSessionId = parsed.webRtcSessionId;
            console.log("[webrtc-stream-view] webRtcSessionId established", this._webRtcSessionId);

            const buffered = this._preSessionQueue;
            this._preSessionQueue = [];
            for (const ev of buffered) {
                if (ev.webrtc_session_id === parsed.webRtcSessionId) {
                    await this._onWebRtcCallback(ev);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // Clear stream id before notifying error so listeners observing videoStreamId during the
            // error state-change snapshot don't see a stale id pointing at a no-longer-allocated stream.
            this._videoStreamId = null;
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
                await this.client?.deviceCommand(
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
                await this.client?.deviceCommand(
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
                await this.client?.deviceCommand(
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

        await this.deallocateSnapshot();

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

    async takeSnapshot(): Promise<{ dataUri: string; resolution: { width: number; height: number } }> {
        if (!this.client) throw new Error("Matter client not available");
        const streamId = await this._ensureSnapshotStream();
        const requestedResolution = this._snapshotResolution ?? SNAPSHOT_DEFAULTS.resolution;
        const response = await this.client.deviceCommand(
            this.nodeId,
            this.endpointId,
            CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
            "CaptureSnapshot",
            { snapshotStreamId: streamId, requestedResolution },
        );
        const parsed = parseCaptureSnapshotResponse(response);
        const mimeType = parsed.imageCodec === 0 ? "jpeg" : "png";
        return {
            dataUri: `data:image/${mimeType};base64,${parsed.dataBase64}`,
            resolution: parsed.resolution,
        };
    }

    private _readAvsmFeatures(): { wmark: boolean; osd: boolean } {
        const node = this.client?.nodes[String(this.nodeId)];
        const raw =
            node?.attributes[
                `${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`
            ];
        const bits = typeof raw === "number" ? raw : 0;
        return {
            wmark: (bits & AVSM_FEAT_WMARK) !== 0,
            osd: (bits & AVSM_FEAT_OSD) !== 0,
        };
    }

    async deallocateSnapshot(): Promise<void> {
        if (this._snapshotStreamId === null) return;
        const id = this._snapshotStreamId;
        this._snapshotStreamId = null;
        this._snapshotResolution = null;
        try {
            await this.client?.deviceCommand(
                this.nodeId,
                this.endpointId,
                CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                "SnapshotStreamDeallocate",
                { snapshotStreamId: id },
            );
        } catch (e) {
            console.warn("SnapshotStreamDeallocate failed (continuing):", e);
        }
    }

    private async _ensureSnapshotStream(): Promise<number> {
        if (this._snapshotStreamId !== null) return this._snapshotStreamId;
        if (!this.client) throw new Error("Matter client not available");

        const node = this.client.nodes[String(this.nodeId)];

        // AllocatedSnapshotStreams (attr id 17) — reuse existing stream if camera already allocated one
        const allocatedRaw = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/17`];
        if (Array.isArray(allocatedRaw) && allocatedRaw.length > 0) {
            const entry = asObject(allocatedRaw[0]);
            const id = entry ? pickNumber(entry, "snapshotStreamId") : null;
            if (id !== null) {
                this._snapshotStreamId = id;
                return id;
            }
        }

        // SnapshotCapabilities (attr id 10) — preferred source. Aqara G350 advertises SNP via
        // FeatureMap bit 2 but ships an empty capabilities list, so fall back to sensible
        // defaults (matching the resolution range our VideoStream uses) when the list is empty.
        const capsRaw = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/10`];
        const cap: SnapshotCapability =
            Array.isArray(capsRaw) && capsRaw.length > 0
                ? parseSnapshotCapabilitiesFromList(capsRaw)
                : SNAPSHOT_DEFAULTS;

        const avsmFeatures = this._readAvsmFeatures();
        const snapshotAllocPayload: Record<string, unknown> = {
            imageCodec: cap.imageCodec,
            maxFrameRate: cap.maxFrameRate,
            minResolution: cap.resolution,
            maxResolution: cap.resolution,
            quality: 90,
        };
        if (avsmFeatures.wmark) snapshotAllocPayload.watermarkEnabled = false;
        if (avsmFeatures.osd) snapshotAllocPayload.osdEnabled = false;
        const response = await this.client.deviceCommand(
            this.nodeId,
            this.endpointId,
            CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
            "SnapshotStreamAllocate",
            snapshotAllocPayload,
        );
        const snapshotStreamId = parseSnapshotAllocateResponse(response);
        if (snapshotStreamId === null) {
            throw new Error("SnapshotStreamAllocate did not return a snapshot stream id");
        }
        this._snapshotStreamId = snapshotStreamId;
        this._snapshotResolution = cap.resolution;
        return this._snapshotStreamId;
    }

    private async _onWebRtcCallback(data: WebRtcCallbackData): Promise<void> {
        console.log("[webrtc-stream-view] webrtc_callback received", {
            event_type: data.event_type,
            webrtc_session_id: data.webrtc_session_id,
            node_id: data.node_id,
            endpoint_id: data.endpoint_id,
            fabric_index: data.fabric_index,
            myNodeId: this.nodeId,
            myEndpointId: this.endpointId,
            mySessionId: this._webRtcSessionId,
        });
        if (this._webRtcSessionId === null) {
            if (String(data.node_id) === String(this.nodeId) && data.endpoint_id === this.endpointId) {
                this._preSessionQueue.push(data);
                console.log("[webrtc-stream-view] queued pre-session callback");
            } else {
                console.log("[webrtc-stream-view] dropped pre-session callback (different node/endpoint)");
            }
            return;
        }
        if (data.webrtc_session_id !== this._webRtcSessionId) {
            console.log("[webrtc-stream-view] dropped: session id mismatch");
            return;
        }
        if (String(data.node_id) !== String(this.nodeId)) {
            console.log("[webrtc-stream-view] dropped: node id mismatch");
            return;
        }
        if (data.endpoint_id !== this.endpointId) {
            console.log("[webrtc-stream-view] dropped: endpoint id mismatch");
            return;
        }

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
                console.info("WebRTC re-offer received; renegotiation unsupported", data);
                return;
        }
    }

    private async _handleAnswer(data: WebRtcAnswerData | null): Promise<void> {
        if (!this._pc || !data) return;
        try {
            const sdp = this._sanitizeAnswerSdp(data.sdp);
            await this._pc.setRemoteDescription({ type: "answer", sdp });
            this._answerReceived = true;
            const queue = this._localIceQueue;
            this._localIceQueue = [];
            if (queue.length > 0) {
                await this._sendLocalIceCandidates(queue);
            }
            this._fireStateChange("streaming", null);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._videoStreamId = null;
            this._fireStateChange("error", `Failed to apply answer: ${message}`);
            await this.stop();
        }
    }

    /**
     * Some Matter cameras (notably the matter.js camera-controller example app) answer
     * `a=sendrecv` on audio m-lines even when our offer is `a=recvonly`. Per RFC 3264 the
     * only valid mirror of recvonly is sendonly; sendrecv triggers
     * "Answer tried to set recv when offer did not set send" in setRemoteDescription.
     * We add both video and audio transceivers as recvonly, so any sendrecv answer must
     * be coerced to sendonly to apply cleanly.
     */
    private _sanitizeAnswerSdp(sdp: string): string {
        const lines = sdp.split(/\r\n|\n/);
        let inMediaSection = false;
        let mutated = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("m=")) {
                inMediaSection = true;
                continue;
            }
            if (inMediaSection && line === "a=sendrecv") {
                lines[i] = "a=sendonly";
                mutated = true;
            }
        }
        if (mutated) {
            console.warn(
                "[webrtc-stream-view] coerced a=sendrecv -> a=sendonly in answer (offer was recvonly on all m-lines)",
            );
        }
        return lines.join("\r\n");
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
        if (!this.client || this._webRtcSessionId === null || candidates.length === 0) return;
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
