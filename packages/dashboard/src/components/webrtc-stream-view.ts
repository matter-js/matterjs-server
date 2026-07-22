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
import { mdiAlertCircleOutline, mdiVideoOutline } from "@mdi/js";
import { LitElement, css, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";
import { asObject, pickNumber } from "../util/attribute-shapes.js";
import {
    pixelRate,
    planVideoMaxFrameRate,
    VIDEO_MIN_FRAME_RATE,
    videoStreamFitsSnapshotBudget,
} from "../util/camera-stream-budget.js";
import { buildProvideOfferRequest } from "../util/webrtc-provider-payload.js";
import "./ha-svg-icon.js";

// Spec values from @matter/types globals/StreamUsage.ts and
// web-rtc-transport-definitions.ts WebRtcEndReason. Kept inline to avoid a new
// @matter/types dep just for two numeric literals.
const STREAM_USAGE_LIVE_VIEW = 3;
const END_REASON_USER_HANGUP = 2;

// Hardcoded to avoid pulling full cluster schema into the dashboard bundle.
export const CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID = 0x551;
const WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID = 0x553;

// AVSM FeatureMap bits (spec §11.2.4): SNP=2 enables snapshot streams, WMARK=6
// enables watermark overlay, OSD=7 enables on-screen display. When advertised,
// VideoStreamAllocate and SnapshotStreamAllocate REQUIRE watermarkEnabled / osdEnabled fields.
export const AVSM_FEAT_SNP = 1 << 2;
export const AVSM_FEAT_WMARK = 1 << 6;
export const AVSM_FEAT_OSD = 1 << 7;
export const AVSM_FEATURE_MAP_ATTR_ID = 0xfffc;
// MaxEncodedPixelRate (attr 0x0001): shared encoder budget in px/s that video and
// snapshot streams draw from.
const AVSM_MAX_ENCODED_PIXEL_RATE_ATTR_ID = 0x1;

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
    /** RequiresEncodedPixels — whether this capability draws from MaxEncodedPixelRate. */
    requiresEncodedPixels: boolean;
}

const SNAPSHOT_DEFAULTS: SnapshotCapability = {
    resolution: { width: 1920, height: 1080 },
    maxFrameRate: 30,
    imageCodec: 0,
    requiresEncodedPixels: true,
};

/** Clamp a requested resolution down to a capability's max, per dimension (never increases either). */
function clampToCapability(
    requested: { width: number; height: number },
    cap: { width: number; height: number },
): { width: number; height: number } {
    return {
        width: Math.min(requested.width, cap.width),
        height: Math.min(requested.height, cap.height),
    };
}

export function parseSnapshotCapabilitiesFromList(list: unknown[], preferEncoderFree: boolean): SnapshotCapability {
    // SnapshotCapabilitiesStruct field IDs per the Matter spec:
    // 0=resolution (VideoResolutionStruct {0=width, 1=height}), 1=maxFrameRate, 2=imageCodec,
    // 3=requiresEncodedPixels. Cached attributes are tag-based (numeric keys); read_attribute
    // responses are name-based.
    const candidates = list.map(asObject).filter((c): c is Record<string, unknown> => c !== null);
    if (candidates.length === 0) return SNAPSHOT_DEFAULTS;
    const parsed = candidates.map(cap => {
        const res = asObject(cap["resolution"] ?? cap["0"]);
        const width = res ? pickNumber(res, "width", "0") : null;
        const height = res ? pickNumber(res, "height", "1") : null;
        const maxFrameRate = pickNumber(cap, "maxFrameRate", "1");
        const imageCodec = pickNumber(cap, "imageCodec", "2");
        const requiresEncodedPixels = cap["requiresEncodedPixels"] ?? cap["3"];
        return {
            resolution: {
                width: width ?? SNAPSHOT_DEFAULTS.resolution.width,
                height: height ?? SNAPSHOT_DEFAULTS.resolution.height,
            },
            maxFrameRate: maxFrameRate ?? SNAPSHOT_DEFAULTS.maxFrameRate,
            imageCodec: imageCodec ?? SNAPSHOT_DEFAULTS.imageCodec,
            requiresEncodedPixels: requiresEncodedPixels !== false,
        };
    });
    // When preferEncoderFree (a video stream is live), restrict to encoder-free capabilities
    // (RequiresEncodedPixels=false): a camera with MaxConcurrentEncoders=1 holds its sole encoder
    // for the video stream, so only an encoder-free capability can be captured concurrently (often
    // a lower resolution). When idle, use the full set so a capture can use the higher-resolution
    // (encoder) capability. Within the chosen set, take the highest resolution.
    const encoderFree = parsed.filter(cap => !cap.requiresEncodedPixels);
    const pool = preferEncoderFree && encoderFree.length > 0 ? encoderFree : parsed;
    return pool.reduce((best, cur) =>
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
    @property({ type: Boolean }) liveViewSupported = true;
    @property({ type: Object }) resolution: { width: number; height: number } | null = null;

    @property({ type: Boolean }) watermarkEnabled = false;
    @property({ type: Boolean }) osdEnabled = false;

    @state() private _state: StreamState = "idle";
    @state() private _errorMessage: string | null = null;

    @property({ attribute: false }) snapshotResolution: { width: number; height: number } | null = null;

    private _snapshotStreamId: number | null = null;
    private _snapshotResolution: { width: number; height: number } | null = null;
    private _snapshotImageCodec: number | null = null;
    private _snapshotMaxFrameRate: number | null = null;
    private _snapshotWatermarkEnabled: boolean | undefined = undefined;
    private _snapshotOsdEnabled: boolean | undefined = undefined;
    // Serializes takeSnapshot() calls: re-negotiation in one call must not deallocate the stream a
    // concurrent capture is mid-flight on, and two first-time captures must not each allocate (leak).
    private _snapshotChain: Promise<unknown> = Promise.resolve();
    /** True when we allocated this stream ourselves and must Deallocate it on stop. False when reusing an existing allocation. */
    private _videoStreamOwned = false;
    private _audioStreamOwned = false;
    private _snapshotStreamOwned = false;

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

    get muted(): boolean {
        return this._video?.muted ?? true;
    }

    setMuted(muted: boolean): void {
        if (this._video) this._video.muted = muted;
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
            ${this._state === "idle"
                ? html`<div class="placeholder">
                      <ha-svg-icon class="placeholder-icon" .path=${mdiVideoOutline}></ha-svg-icon>
                      <div class="placeholder-text">
                          ${this.liveViewSupported
                              ? html`Click <b>Start</b> to begin streaming`
                              : "Live view not supported — use Snapshot"}
                      </div>
                  </div>`
                : null}
            ${this._state === "connecting"
                ? html`<div class="placeholder">
                      <div class="spinner"></div>
                      <div class="placeholder-text">Connecting…</div>
                  </div>`
                : null}
            ${this._state === "error"
                ? html`<div class="placeholder error">
                      <ha-svg-icon class="placeholder-icon" .path=${mdiAlertCircleOutline}></ha-svg-icon>
                      <div class="placeholder-text">${this._errorMessage ?? "Stream error"}</div>
                  </div>`
                : null}
        `;
    }

    async start(): Promise<void> {
        if (!this.liveViewSupported) {
            this._fireStateChange("error", "Live view is not supported on this device");
            return;
        }
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
                console.log("[webrtc-stream-view] ontrack", {
                    kind: ev.track.kind,
                    readyState: ev.track.readyState,
                    streams: ev.streams.length,
                });
                const video = this._video;
                if (!video) {
                    console.warn("[webrtc-stream-view] ontrack fired but <video> query is null");
                    return;
                }
                // Cameras may put each track in its own MediaStream (distinct msid), so
                // ev.streams[0] differs per track. Assigning it to srcObject directly lets the audio
                // track's stream clobber the video track's. Aggregate every received track into one
                // element-owned MediaStream instead.
                const existing = video.srcObject instanceof MediaStream ? video.srcObject : null;
                const stream = existing ?? new MediaStream();
                if (!stream.getTracks().includes(ev.track)) {
                    stream.addTrack(ev.track);
                }
                if (video.srcObject !== stream) {
                    video.srcObject = stream;
                }
            };

            const minResolution = this.resolution ?? DEFAULT_MIN_RESOLUTION;
            const maxResolution = this.resolution ?? DEFAULT_MAX_RESOLUTION;
            const avsmFeatures = this._readAvsmFeatures();
            const maxEncodedPixelRate = this._readMaxEncodedPixelRate();
            const snapshotReservation = this._snapshotBudgetReservation();
            // Reserving the whole MaxEncodedPixelRate (e.g. 1080p@120) starves a concurrent
            // SnapshotStreamAllocate (ResourceExhausted); size the video rate to leave the
            // snapshot stream room within the shared encoder budget.
            const videoMaxFrameRate = planVideoMaxFrameRate({
                maxEncodedPixelRate,
                videoResolution: maxResolution,
                snapshotReservation,
            });
            const videoAllocPayload: Record<string, unknown> = {
                streamUsage: STREAM_USAGE_LIVE_VIEW,
                videoCodec: 0,
                minFrameRate: Math.min(VIDEO_MIN_FRAME_RATE, videoMaxFrameRate),
                maxFrameRate: videoMaxFrameRate,
                minResolution,
                maxResolution,
                minBitRate: 10000,
                maxBitRate: 10000,
                keyFrameInterval: 4000,
            };
            if (avsmFeatures.wmark) videoAllocPayload.watermarkEnabled = this.watermarkEnabled;
            if (avsmFeatures.osd) videoAllocPayload.osdEnabled = this.osdEnabled;

            // Spec §11.2.1.2.1 — server SHALL reuse an existing stream that covers our
            // request. Search AllocatedVideoStreams (attr 0x000F) first to avoid even
            // sending VideoStreamAllocate when a usable stream is already in place. Skip
            // candidates that over-reserve the encoder budget so reuse can't reintroduce
            // the snapshot ResourceExhausted a fresh allocation avoids.
            const videoWant = {
                streamUsage: STREAM_USAGE_LIVE_VIEW,
                videoCodec: 0,
                minRes: minResolution,
                maxRes: maxResolution,
                watermarkEnabled: avsmFeatures.wmark ? this.watermarkEnabled : undefined,
                osdEnabled: avsmFeatures.osd ? this.osdEnabled : undefined,
                budget: { maxEncodedPixelRate, snapshotReservation },
            };
            const reusedVideoId = this._findMatchingVideoStream(videoWant);
            let videoAlloc: unknown = null;
            let usedFallbackReuse = false;
            if (reusedVideoId !== null) {
                console.info("[webrtc-stream-view] reusing existing video stream", reusedVideoId);
                this._videoStreamId = reusedVideoId;
                this._videoStreamOwned = false;
            } else {
                try {
                    videoAlloc = await this.client.deviceCommand(
                        this.nodeId,
                        this.endpointId,
                        CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                        "VideoStreamAllocate",
                        videoAllocPayload,
                    );
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const isResourceExhausted =
                        message.includes("Resource exhausted") || message.includes("(code 137)");
                    if (!isResourceExhausted) throw err;
                    // Cameras with a shared encoder pool refuse VideoStreamAllocate while a snapshot
                    // stream is held — free ours and retry once.
                    if (this._snapshotStreamId !== null) {
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
                    } else {
                        // The budget is held by a stream we didn't allocate (e.g. another
                        // controller's 120 fps stream). Fall back to reusing it so live view
                        // still works; a concurrent snapshot may then be refused.
                        const fallbackId = this._findMatchingVideoStream({ ...videoWant, budget: undefined });
                        if (fallbackId === null) throw err;
                        console.warn(
                            "[webrtc-stream-view] VideoStreamAllocate ResourceExhausted; reusing over-budget stream",
                            fallbackId,
                            "(concurrent snapshot may be unavailable)",
                        );
                        this._videoStreamId = fallbackId;
                        this._videoStreamOwned = false;
                        usedFallbackReuse = true;
                    }
                }
                if (!usedFallbackReuse) {
                    const videoStreamId = parseStreamAllocate(videoAlloc, "videoStreamId");
                    if (videoStreamId === null) {
                        throw new Error("VideoStreamAllocate did not return a videoStreamId");
                    }
                    this._videoStreamId = videoStreamId;
                    this._videoStreamOwned = true;
                }
            }

            // Audio is best-effort: not all cameras expose it. Reuse if a matching
            // AllocatedAudioStreams entry exists, else allocate.
            const audioWant = {
                streamUsage: STREAM_USAGE_LIVE_VIEW,
                audioCodec: 0,
                channelCount: 1,
                sampleRate: 48000,
            };
            const reusedAudioId = this._findMatchingAudioStream(audioWant);
            if (reusedAudioId !== null) {
                console.info("[webrtc-stream-view] reusing existing audio stream", reusedAudioId);
                this._audioStreamId = reusedAudioId;
                this._audioStreamOwned = false;
            } else {
                try {
                    const audioAlloc = await this.client.deviceCommand(
                        this.nodeId,
                        this.endpointId,
                        CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
                        "AudioStreamAllocate",
                        {
                            ...audioWant,
                            bitRate: 20000,
                            bitDepth: 24,
                        },
                    );
                    this._audioStreamId = parseStreamAllocate(audioAlloc, "audioStreamId");
                    this._audioStreamOwned = this._audioStreamId !== null;
                } catch (err) {
                    console.info("AudioStreamAllocate failed; continuing video-only", err);
                    this._audioStreamId = null;
                }
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
                buildProvideOfferRequest(sdp, STREAM_USAGE_LIVE_VIEW, this._videoStreamId, this._audioStreamId),
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

        if (this._videoStreamId !== null && this._videoStreamOwned) {
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
        if (this._audioStreamId !== null && this._audioStreamOwned) {
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
        this._videoStreamOwned = false;
        this._audioStreamOwned = false;

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
        const run = this._snapshotChain.then(
            () => this._takeSnapshot(),
            () => this._takeSnapshot(),
        );
        this._snapshotChain = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }

    private async _takeSnapshot(): Promise<{ dataUri: string; resolution: { width: number; height: number } }> {
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

    private _readAvsmFeatures(): { snp: boolean; wmark: boolean; osd: boolean } {
        const node = this.client?.nodes[String(this.nodeId)];
        const raw =
            node?.attributes[
                `${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`
            ];
        const bits = typeof raw === "number" ? raw : 0;
        return {
            snp: (bits & AVSM_FEAT_SNP) !== 0,
            wmark: (bits & AVSM_FEAT_WMARK) !== 0,
            osd: (bits & AVSM_FEAT_OSD) !== 0,
        };
    }

    private _readMaxEncodedPixelRate(): number | null {
        const node = this.client?.nodes[String(this.nodeId)];
        const raw =
            node?.attributes[
                `${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_MAX_ENCODED_PIXEL_RATE_ATTR_ID}`
            ];
        return typeof raw === "number" && raw > 0 ? raw : null;
    }

    /**
     * px/s a concurrent snapshot stream would reserve from MaxEncodedPixelRate, so the
     * video stream can be sized to leave room. Zero when the camera has no snapshot feature
     * or the chosen capability does not draw from the encoder budget.
     */
    private _snapshotBudgetReservation(): number {
        if (!this._readAvsmFeatures().snp) return 0;
        const node = this.client?.nodes[String(this.nodeId)];
        const capsRaw = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/10`];
        const cap =
            Array.isArray(capsRaw) && capsRaw.length > 0
                ? parseSnapshotCapabilitiesFromList(capsRaw, true)
                : SNAPSHOT_DEFAULTS;
        if (!cap.requiresEncodedPixels) return 0;
        // Match the clamp _ensureSnapshotStream applies so the reservation reflects what will
        // actually be requested, not an over-large snapshotResolution the capability can't provide.
        const resolution = clampToCapability(this.snapshotResolution ?? cap.resolution, cap.resolution);
        return pixelRate(resolution, cap.maxFrameRate);
    }

    async deallocateSnapshot(): Promise<void> {
        if (this._snapshotStreamId === null) return;
        const id = this._snapshotStreamId;
        const wasOwned = this._snapshotStreamOwned;
        this._snapshotStreamId = null;
        this._snapshotResolution = null;
        this._snapshotImageCodec = null;
        this._snapshotMaxFrameRate = null;
        this._snapshotWatermarkEnabled = undefined;
        this._snapshotOsdEnabled = undefined;
        this._snapshotStreamOwned = false;
        if (!wasOwned) return; // Reused an existing allocation — leave it for its owner.
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

    /**
     * Search AllocatedVideoStreams (attr 0x000F) for an entry whose advertised
     * capability ranges cover our requested params. Spec §11.2.1.2.1 says the
     * camera SHALL reuse a matching stream — reading first avoids creating
     * duplicates when a server's reuse logic is buggy or matching is too strict.
     */
    private _findMatchingVideoStream(want: {
        streamUsage: number;
        videoCodec: number;
        minRes: { width: number; height: number };
        maxRes: { width: number; height: number };
        watermarkEnabled?: boolean;
        osdEnabled?: boolean;
        budget?: { maxEncodedPixelRate: number | null; snapshotReservation: number };
    }): number | null {
        const node = this.client?.nodes[String(this.nodeId)];
        const list = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/15`];
        if (!Array.isArray(list)) return null;
        for (const item of list) {
            const obj = asObject(item);
            if (!obj) continue;
            const streamUsage = pickNumber(obj, "streamUsage", "1");
            const videoCodec = pickNumber(obj, "videoCodec", "2");
            if (streamUsage !== want.streamUsage || videoCodec !== want.videoCodec) continue;
            const minRes = asObject(obj["minResolution"] ?? obj["5"]);
            const maxRes = asObject(obj["maxResolution"] ?? obj["6"]);
            if (!minRes || !maxRes) continue;
            const eMinW = pickNumber(minRes, "width", "0") ?? 0;
            const eMinH = pickNumber(minRes, "height", "1") ?? 0;
            const eMaxW = pickNumber(maxRes, "width", "0") ?? 0;
            const eMaxH = pickNumber(maxRes, "height", "1") ?? 0;
            if (eMinW > want.minRes.width || eMaxW < want.maxRes.width) continue;
            if (eMinH > want.minRes.height || eMaxH < want.maxRes.height) continue;
            if (want.budget) {
                // Unknown frame rate under a real budget can't be shown to fit → treat as infinite
                // (skip). When the budget is unknown, videoStreamFitsSnapshotBudget short-circuits to
                // true regardless, so an unparseable frame rate doesn't wrongly block reuse.
                const eMaxFrameRate = pickNumber(obj, "maxFrameRate", "4") ?? Number.POSITIVE_INFINITY;
                const fits = videoStreamFitsSnapshotBudget({
                    maxEncodedPixelRate: want.budget.maxEncodedPixelRate,
                    candidateResolution: { width: eMaxW, height: eMaxH },
                    candidateFrameRate: eMaxFrameRate,
                    snapshotReservation: want.budget.snapshotReservation,
                });
                if (!fits) continue;
            }
            if (want.watermarkEnabled !== undefined) {
                const v = obj["watermarkEnabled"] ?? obj["10"];
                if (v !== want.watermarkEnabled) continue;
            }
            if (want.osdEnabled !== undefined) {
                const v = obj["osdEnabled"] ?? obj["11"];
                if (v !== want.osdEnabled) continue;
            }
            const id = pickNumber(obj, "videoStreamId", "0");
            if (id !== null) return id;
        }
        return null;
    }

    private _findMatchingAudioStream(want: {
        streamUsage: number;
        audioCodec: number;
        channelCount: number;
        sampleRate: number;
    }): number | null {
        const node = this.client?.nodes[String(this.nodeId)];
        const list = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/16`];
        if (!Array.isArray(list)) return null;
        for (const item of list) {
            const obj = asObject(item);
            if (!obj) continue;
            const streamUsage = pickNumber(obj, "streamUsage", "1");
            const audioCodec = pickNumber(obj, "audioCodec", "2");
            const channelCount = pickNumber(obj, "channelCount", "3");
            const sampleRate = pickNumber(obj, "sampleRate", "4");
            if (
                streamUsage !== want.streamUsage ||
                audioCodec !== want.audioCodec ||
                channelCount !== want.channelCount ||
                sampleRate !== want.sampleRate
            )
                continue;
            const id = pickNumber(obj, "audioStreamId", "0");
            if (id !== null) return id;
        }
        return null;
    }

    private _findMatchingSnapshotStream(want: {
        imageCodec: number;
        resolution: { width: number; height: number };
        watermarkEnabled?: boolean;
        osdEnabled?: boolean;
    }): number | null {
        const node = this.client?.nodes[String(this.nodeId)];
        const list = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/17`];
        if (!Array.isArray(list)) return null;
        for (const item of list) {
            const obj = asObject(item);
            if (!obj) continue;
            const imageCodec = pickNumber(obj, "imageCodec", "1");
            if (imageCodec !== want.imageCodec) continue;
            const minRes = asObject(obj["minResolution"] ?? obj["3"]);
            const maxRes = asObject(obj["maxResolution"] ?? obj["4"]);
            if (!minRes || !maxRes) continue;
            const eMinW = pickNumber(minRes, "width", "0") ?? 0;
            const eMinH = pickNumber(minRes, "height", "1") ?? 0;
            const eMaxW = pickNumber(maxRes, "width", "0") ?? 0;
            const eMaxH = pickNumber(maxRes, "height", "1") ?? 0;
            if (eMinW > want.resolution.width || eMaxW < want.resolution.width) continue;
            if (eMinH > want.resolution.height || eMaxH < want.resolution.height) continue;
            if (want.watermarkEnabled !== undefined) {
                const v = obj["watermarkEnabled"] ?? obj["9"];
                if (v !== want.watermarkEnabled) continue;
            }
            if (want.osdEnabled !== undefined) {
                const v = obj["osdEnabled"] ?? obj["10"];
                if (v !== want.osdEnabled) continue;
            }
            const id = pickNumber(obj, "snapshotStreamId", "0");
            if (id !== null) return id;
        }
        return null;
    }

    private async _ensureSnapshotStream(): Promise<number> {
        if (!this.client) throw new Error("Matter client not available");

        const node = this.client.nodes[String(this.nodeId)];

        // SnapshotCapabilities (attr id 10) — preferred source. Some cameras advertise the SNP
        // feature but ship an empty capabilities list, so fall back to sensible defaults when it
        // is empty.
        // Once a video stream is allocated the sole encoder (MaxConcurrentEncoders=1) is held —
        // through the whole connecting/streaming phase, not just once "streaming" — so a concurrent
        // snapshot must use an encoder-free capability (typically a lower resolution).
        const encoderBusy = this._videoStreamId !== null;
        const capsRaw = node?.attributes[`${this.endpointId}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/10`];
        const cap: SnapshotCapability =
            Array.isArray(capsRaw) && capsRaw.length > 0
                ? parseSnapshotCapabilitiesFromList(capsRaw, encoderBusy)
                : SNAPSHOT_DEFAULTS;
        // Never request more than the chosen capability provides: a larger resolution would map
        // to an encoder-requiring capability the busy encoder can't satisfy (ResourceExhausted).
        const targetResolution = clampToCapability(this.snapshotResolution ?? cap.resolution, cap.resolution);

        const avsmFeatures = this._readAvsmFeatures();
        const wantWatermark = avsmFeatures.wmark ? this.watermarkEnabled : undefined;
        const wantOsd = avsmFeatures.osd ? this.osdEnabled : undefined;

        // A cached stream only still covers the current call if its resolution, codec, frame rate,
        // and watermark/OSD flags all still match: the caller may have changed `snapshotResolution`
        // or toggled watermark/OSD, or the encoder may have freed up (which reselects the capability,
        // changing maxFrameRate), since it was ensured. Otherwise release it before searching for
        // (or allocating) one that actually covers the new target.
        if (this._snapshotStreamId !== null) {
            if (
                this._snapshotResolution?.width === targetResolution.width &&
                this._snapshotResolution?.height === targetResolution.height &&
                this._snapshotImageCodec === cap.imageCodec &&
                this._snapshotMaxFrameRate === cap.maxFrameRate &&
                this._snapshotWatermarkEnabled === wantWatermark &&
                this._snapshotOsdEnabled === wantOsd
            ) {
                return this._snapshotStreamId;
            }
            await this.deallocateSnapshot();
        }

        // AllocatedSnapshotStreams (attr 0x0011) — reuse existing stream when its capability
        // range covers our target resolution (spec §11.2.1.2.1 / §11.2.8.8.8).
        const reused = this._findMatchingSnapshotStream({
            imageCodec: cap.imageCodec,
            resolution: targetResolution,
            watermarkEnabled: wantWatermark,
            osdEnabled: wantOsd,
        });
        if (reused !== null) {
            console.info("[webrtc-stream-view] reusing existing snapshot stream", reused);
            this._snapshotStreamId = reused;
            this._snapshotResolution = targetResolution;
            this._snapshotImageCodec = cap.imageCodec;
            this._snapshotMaxFrameRate = cap.maxFrameRate;
            this._snapshotWatermarkEnabled = wantWatermark;
            this._snapshotOsdEnabled = wantOsd;
            this._snapshotStreamOwned = false;
            return reused;
        }

        const snapshotAllocPayload: Record<string, unknown> = {
            imageCodec: cap.imageCodec,
            maxFrameRate: cap.maxFrameRate,
            minResolution: targetResolution,
            maxResolution: targetResolution,
            quality: 90,
        };
        if (avsmFeatures.wmark) snapshotAllocPayload.watermarkEnabled = this.watermarkEnabled;
        if (avsmFeatures.osd) snapshotAllocPayload.osdEnabled = this.osdEnabled;
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
        this._snapshotResolution = targetResolution;
        this._snapshotImageCodec = cap.imageCodec;
        this._snapshotMaxFrameRate = cap.maxFrameRate;
        this._snapshotWatermarkEnabled = wantWatermark;
        this._snapshotOsdEnabled = wantOsd;
        this._snapshotStreamOwned = true;
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

declare global {
    interface HTMLElementTagNameMap {
        "webrtc-stream-view": WebRtcStreamView;
    }
}
