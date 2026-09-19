/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import type {
    AudioEnvelope,
    ManagedSession,
    Resolution,
    ResolvedStream,
    StreamKind,
    StreamLease,
    VideoEnvelope,
} from "./cameraTypes.js";
import { parseSdpVideoConstraints } from "./sdpConstraints.js";
import type { SdpVideoConstraints } from "./sdpConstraints.js";
import { selectSnapshotCapability } from "./snapshotPolicy.js";
import type { SnapshotCapability } from "./snapshotPolicy.js";
import {
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    findReusableVideoStream,
    narrowEnvelope,
} from "./streamPolicy.js";
import type { AllocatedVideoStream, AudioHints, RateDistortionPoint, VideoHints } from "./streamPolicy.js";

const logger = Logger.get("CameraStreamManager");

/** CameraAVStreamManagement cluster id, reported when an endpoint cannot stream. */
const CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID = 0x551;
/** Matter status codes the allocation ladder reacts to. */
const DYNAMIC_CONSTRAINT_ERROR = 0x87;
const RESOURCE_EXHAUSTED = 0x89;
/** Bounded so a device that rejects everything fails fast rather than walking to 1x1. */
const MAX_NARROWING_ROUNDS = 3;

function deviceStatusOf(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "number" ? error.code : undefined;
}

/** The envelope actually delivered by an allocated video stream, as opposed to the one requested. */
function envelopeOfVideoStream(stream: AllocatedVideoStream, keyFrameInterval: number): VideoEnvelope {
    return {
        codec: stream.videoCodec,
        minResolution: stream.minResolution,
        maxResolution: stream.maxResolution,
        minFrameRate: stream.minFrameRate,
        maxFrameRate: stream.maxFrameRate,
        minBitRate: stream.minBitRate,
        maxBitRate: stream.maxBitRate,
        keyFrameInterval,
    };
}

/** The envelope actually delivered by an allocated audio stream, as opposed to the one requested. */
function envelopeOfAudioStream(stream: AllocatedAudioStream): AudioEnvelope {
    return {
        codec: stream.audioCodec,
        channelCount: stream.channelCount,
        sampleRate: stream.sampleRate,
        bitRate: stream.bitRate,
        bitDepth: stream.bitDepth,
    };
}

/** WebRTCEndReasonEnum has no dedicated field for "the caller stopped watching"; UserHangup is it. */
const WEBRTC_END_REASON_USER_HANGUP = WebRtcTransportDefinitions.WebRtcEndReason.UserHangup;

/** VideoCodecEnum values, named as SDP rtpmap advertises them (§11.2.6.1). */
const VIDEO_CODEC_NAMES = new Map<number, string>([
    [0, "H264"],
    [1, "H265"],
    [2, "H266"],
    [3, "AV1"],
]);

/**
 * The codec to request, narrowed from the device's rate-distortion codecs by what the offer states
 * it can decode and what the caller prefers. Neither narrowing widens past the device list, and an
 * empty result at either stage falls back to the wider set: resolveVideoStream is what rejects a
 * codec the device does not support.
 */
export function preferredVideoCodec(
    deviceCodecs: number[],
    sdp: SdpVideoConstraints | undefined,
    hintCodecs: string[] | undefined,
): number {
    let candidates = deviceCodecs;
    if (sdp?.hasVideo === true) {
        const offered = candidates.filter(codec => sdp.codecs.includes(VIDEO_CODEC_NAMES.get(codec) ?? ""));
        if (offered.length > 0) candidates = offered;
    }
    if (hintCodecs !== undefined) {
        const preferred = candidates.filter(codec => hintCodecs.includes(VIDEO_CODEC_NAMES.get(codec) ?? ""));
        if (preferred.length > 0) candidates = preferred;
    }
    return candidates[0] ?? deviceCodecs[0] ?? 0;
}

function isResolution(value: unknown): value is Resolution {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as { width?: unknown; height?: unknown };
    return typeof candidate.width === "number" && typeof candidate.height === "number";
}

function referenceCountOf(state: CameraState, kind: StreamKind, streamId: number): number {
    switch (kind) {
        case "video":
            return state.allocatedVideoStreams.find(stream => stream.videoStreamId === streamId)?.referenceCount ?? 0;
        case "audio":
            return state.allocatedAudioStreams.find(stream => stream.audioStreamId === streamId)?.referenceCount ?? 0;
        case "snapshot":
            return (
                state.allocatedSnapshotStreams.find(stream => stream.snapshotStreamId === streamId)?.referenceCount ?? 0
            );
    }
}

function deallocateCall(kind: StreamKind, streamId: number): { command: string; fields: Record<string, unknown> } {
    switch (kind) {
        case "video":
            return { command: "videoStreamDeallocate", fields: { videoStreamId: streamId } };
        case "audio":
            return { command: "audioStreamDeallocate", fields: { audioStreamId: streamId } };
        case "snapshot":
            return { command: "snapshotStreamDeallocate", fields: { snapshotStreamId: streamId } };
    }
}

export interface AllocatedAudioStream {
    audioStreamId: number;
    streamUsage: number;
    audioCodec: number;
    channelCount: number;
    sampleRate: number;
    bitRate: number;
    bitDepth: number;
    referenceCount: number;
}

export interface AllocatedSnapshotStream {
    snapshotStreamId: number;
    imageCodec: number;
    resolution: Resolution;
    referenceCount: number;
}

/** The AVSM attributes the policy needs, as matter.js reports them through `stateOf`. */
export interface CameraState {
    maxConcurrentEncoders?: number;
    maxEncodedPixelRate?: number;
    videoSensorParams?: {
        sensorWidth: number;
        sensorHeight: number;
        maxFps: number;
        maxHdrFps?: number;
        hdrCapable?: boolean;
    };
    minViewportResolution?: Resolution;
    rateDistortionTradeOffPoints: RateDistortionPoint[];
    snapshotCapabilities: SnapshotCapability[];
    supportedStreamUsages: number[];
    streamUsagePriorities: number[];
    allocatedVideoStreams: AllocatedVideoStream[];
    allocatedAudioStreams: AllocatedAudioStream[];
    allocatedSnapshotStreams: AllocatedSnapshotStream[];
    microphoneCapabilities?: {
        supportedCodecs: number[];
        maxNumberOfChannels: number;
        supportedSampleRates: number[];
        supportedBitDepths: number[];
    };
    twoWayTalkSupport?: number;
}

export interface CameraDeviceIo {
    /**
     * Typed AVSM state, or undefined when the endpoint does not expose the behaviour.
     *
     * The manager may call this and {@link invoke} while holding its per-endpoint lock; an
     * implementation must not call back into the manager for the same endpoint from either method, or
     * the call deadlocks against itself.
     */
    readCameraState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState | undefined>;
    invoke(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        cluster: "avsm" | "webrtcProvider";
        command: string;
        fields: Record<string, unknown>;
    }): Promise<unknown>;
}

export interface CameraCapabilities {
    video: {
        sensor?: Resolution;
        maxFps?: number;
        maxHdrFps?: number;
        hdrCapable?: boolean;
        minViewport?: Resolution;
        rateDistortionPoints: RateDistortionPoint[];
        codecs: number[];
    };
    audio: {
        codecs: number[];
        channels?: number;
        sampleRates: number[];
        bitDepths: number[];
        twoWayTalkSupport?: number;
    };
    snapshot: { capabilities: SnapshotCapability[] };
    limits: {
        maxEncodedPixelRate?: number;
        maxConcurrentEncoders?: number;
        supportedStreamUsages: number[];
        streamUsagePriorities: number[];
    };
    allocated: {
        video: Array<AllocatedVideoStream & { ownedByServer: boolean }>;
        audio: Array<AllocatedAudioStream & { ownedByServer: boolean }>;
        snapshot: Array<AllocatedSnapshotStream & { ownedByServer: boolean }>;
    };
}

export interface StartStreamResult {
    webRtcSessionId: number;
    mode: "solicit_offer" | "provide_offer";
    video?: ResolvedStream;
    audio?: ResolvedStream;
}

export interface SnapshotResult {
    data: Uint8Array;
    imageCodec: number;
    resolution: Resolution;
    /** True when a live video stream's encoder use forced this below the camera's best capability. */
    downgraded: boolean;
}

export class CameraStreamManager {
    readonly #io: CameraDeviceIo;
    readonly #leases = new Map<string, StreamLease[]>();
    readonly #locks = new Map<string, Promise<unknown>>();
    readonly #sessions = new Map<number, ManagedSession>();

    constructor(io: CameraDeviceIo) {
        this.#io = io;
    }

    /**
     * Run `work` with no other work in flight for the same endpoint.
     *
     * Two concurrent starts otherwise both miss the same reusable stream and allocate twins, which on
     * a single-encoder camera means the second one fails.
     */
    protected async withEndpointLock<T>(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        work: () => Promise<T>,
    ): Promise<T> {
        const key = this.endpointKey(nodeId, endpointId);
        const previous = this.#locks.get(key) ?? Promise.resolve();
        const current = previous.then(work);
        const settled = current.then(
            () => undefined,
            () => undefined,
        );
        this.#locks.set(key, settled);
        try {
            return await current;
        } finally {
            if (this.#locks.get(key) === settled) this.#locks.delete(key);
        }
    }

    protected endpointKey(nodeId: NodeId, endpointId: EndpointNumber): string {
        return `${nodeId}/${endpointId}`;
    }

    /** Test hook: the lock map holds one entry per endpoint with work in flight. */
    protected get pendingLockCount(): number {
        return this.#locks.size;
    }

    protected get io(): CameraDeviceIo {
        return this.#io;
    }

    protected leasesOf(nodeId: NodeId, endpointId: EndpointNumber): StreamLease[] {
        return this.#leases.get(this.endpointKey(nodeId, endpointId)) ?? new Array<StreamLease>();
    }

    protected recordLease(nodeId: NodeId, endpointId: EndpointNumber, lease: StreamLease): void {
        const key = this.endpointKey(nodeId, endpointId);
        const existing = this.#leases.get(key) ?? new Array<StreamLease>();
        if (!existing.some(entry => entry.kind === lease.kind && entry.streamId === lease.streamId)) {
            existing.push(lease);
        }
        this.#leases.set(key, existing);
    }

    protected dropLease(nodeId: NodeId, endpointId: EndpointNumber, kind: StreamKind, streamId: number): void {
        const key = this.endpointKey(nodeId, endpointId);
        const remaining = this.leasesOf(nodeId, endpointId).filter(
            entry => !(entry.kind === kind && entry.streamId === streamId),
        );
        this.#leases.set(key, remaining);
    }

    protected ownsStream(nodeId: NodeId, endpointId: EndpointNumber, kind: StreamKind, streamId: number): boolean {
        return this.leasesOf(nodeId, endpointId).some(
            lease => lease.kind === kind && lease.streamId === streamId && lease.allocatedByUs,
        );
    }

    /** Device state, or a typed failure when the endpoint cannot stream. */
    protected async requireState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState> {
        const state = await this.#io.readCameraState(nodeId, endpointId);
        if (state === undefined) {
            throw ServerError.cameraNotSupported({ missingClusters: [CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID] });
        }
        return state;
    }

    async getCapabilities(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraCapabilities> {
        const state = await this.requireState(nodeId, endpointId);
        const owned = (kind: StreamKind, streamId: number): boolean =>
            this.ownsStream(nodeId, endpointId, kind, streamId);

        const codecs = new Array<number>();
        for (const point of state.rateDistortionTradeOffPoints) {
            if (!codecs.includes(point.codec)) codecs.push(point.codec);
        }

        return {
            video: {
                sensor:
                    state.videoSensorParams === undefined
                        ? undefined
                        : {
                              width: state.videoSensorParams.sensorWidth,
                              height: state.videoSensorParams.sensorHeight,
                          },
                maxFps: state.videoSensorParams?.maxFps,
                maxHdrFps: state.videoSensorParams?.maxHdrFps,
                hdrCapable: state.videoSensorParams?.hdrCapable,
                minViewport: state.minViewportResolution,
                rateDistortionPoints: state.rateDistortionTradeOffPoints,
                codecs,
            },
            audio: {
                codecs: state.microphoneCapabilities?.supportedCodecs ?? new Array<number>(),
                channels: state.microphoneCapabilities?.maxNumberOfChannels,
                sampleRates: state.microphoneCapabilities?.supportedSampleRates ?? new Array<number>(),
                bitDepths: state.microphoneCapabilities?.supportedBitDepths ?? new Array<number>(),
                twoWayTalkSupport: state.twoWayTalkSupport,
            },
            snapshot: { capabilities: state.snapshotCapabilities },
            limits: {
                maxEncodedPixelRate: state.maxEncodedPixelRate,
                maxConcurrentEncoders: state.maxConcurrentEncoders,
                supportedStreamUsages: state.supportedStreamUsages,
                streamUsagePriorities: state.streamUsagePriorities,
            },
            allocated: {
                video: state.allocatedVideoStreams.map(stream => ({
                    ...stream,
                    ownedByServer: owned("video", stream.videoStreamId),
                })),
                audio: state.allocatedAudioStreams.map(stream => ({
                    ...stream,
                    ownedByServer: owned("audio", stream.audioStreamId),
                })),
                snapshot: state.allocatedSnapshotStreams.map(stream => ({
                    ...stream,
                    ownedByServer: owned("snapshot", stream.snapshotStreamId),
                })),
            },
        };
    }

    async resolveVideoStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        codec: number;
        sdp?: SdpVideoConstraints;
        hints?: VideoHints;
    }): Promise<ResolvedStream> {
        return this.withEndpointLock(args.nodeId, args.endpointId, () => this.resolveVideoStreamLocked(args));
    }

    /**
     * Body of {@link resolveVideoStream}. The caller must already hold the endpoint lock:
     * `startStream` calls this directly, under its own lock, to resolve video and audio without
     * releasing the lock between them and the offer round trip that follows.
     */
    protected async resolveVideoStreamLocked(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        codec: number;
        sdp?: SdpVideoConstraints;
        hints?: VideoHints;
    }): Promise<ResolvedStream> {
        const { nodeId, endpointId, streamUsage, codec } = args;
        const state = await this.requireState(nodeId, endpointId);
        const deviceCodecs = new Array<number>();
        for (const point of state.rateDistortionTradeOffPoints) {
            if (!deviceCodecs.includes(point.codec)) deviceCodecs.push(point.codec);
        }
        if (deviceCodecs.length > 0 && !deviceCodecs.includes(codec)) {
            throw ServerError.cameraStreamIncompatible({
                reason: "codec",
                device: deviceCodecs.map(String),
                requested: [String(codec)],
            });
        }

        const capabilities = {
            sensor:
                state.videoSensorParams === undefined
                    ? { width: 1920, height: 1080 }
                    : { width: state.videoSensorParams.sensorWidth, height: state.videoSensorParams.sensorHeight },
            maxFrameRate: state.videoSensorParams?.maxFps ?? 30,
            minViewport: state.minViewportResolution,
            rateDistortionPoints: state.rateDistortionTradeOffPoints,
        };

        let envelope = computeVideoEnvelope({
            capabilities,
            codec,
            sdp: args.sdp,
            hints: args.hints,
        });

        // The ladder's own copy: freeing a stream updates this array, never the state object.
        let liveStreams = state.allocatedVideoStreams;

        const reused = findReusableVideoStream(liveStreams, envelope, streamUsage);
        if (reused !== undefined) {
            return {
                streamId: reused.videoStreamId,
                envelope: envelopeOfVideoStream(reused, envelope.keyFrameInterval),
                reused: true,
                allocatedByUs: this.ownsStream(nodeId, endpointId, "video", reused.videoStreamId),
            };
        }

        let lastStatus: number | undefined;
        for (let round = 0; round <= MAX_NARROWING_ROUNDS; round++) {
            try {
                const response = await this.io.invoke({
                    nodeId,
                    endpointId,
                    cluster: "avsm",
                    command: "videoStreamAllocate",
                    fields: {
                        streamUsage,
                        videoCodec: envelope.codec,
                        minFrameRate: envelope.minFrameRate,
                        maxFrameRate: envelope.maxFrameRate,
                        minResolution: envelope.minResolution,
                        maxResolution: envelope.maxResolution,
                        minBitRate: envelope.minBitRate,
                        maxBitRate: envelope.maxBitRate,
                        keyFrameInterval: envelope.keyFrameInterval,
                    },
                });
                const streamId =
                    typeof response === "object" && response !== null && "videoStreamId" in response
                        ? response.videoStreamId
                        : undefined;
                if (typeof streamId !== "number") {
                    throw ServerError.sdkStackError("VideoStreamAllocate returned no VideoStreamID");
                }
                this.recordLease(nodeId, endpointId, { kind: "video", streamId, allocatedByUs: true });
                return { streamId, envelope, reused: false, allocatedByUs: true };
            } catch (error) {
                if (error instanceof ServerError) throw error;
                lastStatus = deviceStatusOf(error);
                if (lastStatus === RESOURCE_EXHAUSTED) {
                    const relaxed = findReusableVideoStream(liveStreams, envelope, streamUsage, {
                        ignoreStreamUsage: true,
                    });
                    if (relaxed !== undefined) {
                        return {
                            streamId: relaxed.videoStreamId,
                            envelope: envelopeOfVideoStream(relaxed, envelope.keyFrameInterval),
                            reused: true,
                            allocatedByUs: this.ownsStream(nodeId, endpointId, "video", relaxed.videoStreamId),
                        };
                    }
                    const freedId = await this.freeAnUnreferencedVideoStream(nodeId, endpointId, liveStreams);
                    if (freedId !== undefined) {
                        liveStreams = liveStreams.filter(stream => stream.videoStreamId !== freedId);
                        continue;
                    }
                } else if (lastStatus !== DYNAMIC_CONSTRAINT_ERROR) {
                    throw error;
                }
                const narrowed = narrowEnvelope(envelope);
                if (narrowed === undefined) break;
                envelope = narrowed;
            }
        }

        // Last rung: hand out a stream that is in use, but only within bounds the caller stated.
        // A caller who pinned a resolution matches nothing here and gets the typed failure below.
        const degraded = findDegradedVideoStream(liveStreams, codec, args.hints ?? {});
        if (degraded !== undefined) {
            return {
                streamId: degraded.videoStreamId,
                envelope: envelopeOfVideoStream(degraded, envelope.keyFrameInterval),
                reused: true,
                degraded: true,
                allocatedByUs: this.ownsStream(nodeId, endpointId, "video", degraded.videoStreamId),
            };
        }

        if (lastStatus === DYNAMIC_CONSTRAINT_ERROR) {
            throw ServerError.cameraStreamIncompatible({
                reason: "bounds",
                device: deviceCodecs.map(String),
                requested: [String(codec)],
                deviceStatus: lastStatus,
            });
        }
        throw ServerError.cameraResourceExhausted({
            allocated: liveStreams.map(stream => ({
                streamId: stream.videoStreamId,
                referenceCount: stream.referenceCount,
            })),
            maxConcurrentEncoders: state.maxConcurrentEncoders,
            maxEncodedPixelRate: state.maxEncodedPixelRate,
        });
    }

    async resolveAudioStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        sdp?: SdpVideoConstraints;
        hints?: AudioHints;
    }): Promise<ResolvedStream | undefined> {
        return this.withEndpointLock(args.nodeId, args.endpointId, () => this.resolveAudioStreamLocked(args));
    }

    /**
     * Body of {@link resolveAudioStream}. The caller must already hold the endpoint lock; see
     * {@link resolveVideoStreamLocked}.
     *
     * Audio has no narrowing ladder: a camera either supports the codec or it does not. An audio
     * track is optional in a way a video track is not, so a device rejection yields `undefined` and a
     * video-only session rather than a failure.
     */
    protected async resolveAudioStreamLocked(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        sdp?: SdpVideoConstraints;
        hints?: AudioHints;
    }): Promise<ResolvedStream | undefined> {
        const { nodeId, endpointId, streamUsage } = args;
        const state = await this.requireState(nodeId, endpointId);
        const microphone = state.microphoneCapabilities;
        if (
            microphone === undefined ||
            microphone.supportedCodecs.length === 0 ||
            microphone.supportedSampleRates.length === 0 ||
            microphone.supportedBitDepths.length === 0
        ) {
            return undefined;
        }

        const envelope = computeAudioEnvelope({
            capabilities: {
                ...microphone,
                twoWayTalkSupport: state.twoWayTalkSupport ?? 0,
            },
            sdp: args.sdp,
            hints: args.hints,
            wantsTalkback: args.sdp?.wantsTalkback === true,
        });
        if (envelope === undefined) return undefined;

        const existing = state.allocatedAudioStreams.find(
            stream =>
                stream.streamUsage === streamUsage &&
                stream.audioCodec === envelope.codec &&
                stream.channelCount === envelope.channelCount &&
                stream.sampleRate === envelope.sampleRate,
        );
        if (existing !== undefined) {
            return {
                streamId: existing.audioStreamId,
                envelope: envelopeOfAudioStream(existing),
                reused: true,
                allocatedByUs: this.ownsStream(nodeId, endpointId, "audio", existing.audioStreamId),
            };
        }

        try {
            const response = await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "audioStreamAllocate",
                fields: {
                    streamUsage,
                    audioCodec: envelope.codec,
                    channelCount: envelope.channelCount,
                    sampleRate: envelope.sampleRate,
                    bitRate: envelope.bitRate,
                    bitDepth: envelope.bitDepth,
                },
            });
            const streamId =
                typeof response === "object" && response !== null && "audioStreamId" in response
                    ? response.audioStreamId
                    : undefined;
            if (typeof streamId !== "number") {
                logger.info(
                    `Audio stream unavailable for node ${nodeId}; continuing without audio: AudioStreamAllocate returned no AudioStreamID`,
                );
                return undefined;
            }
            this.recordLease(nodeId, endpointId, { kind: "audio", streamId, allocatedByUs: true });
            return { streamId, envelope, reused: false, allocatedByUs: true };
        } catch (error) {
            if (error instanceof ServerError) throw error;
            logger.info(`Audio stream unavailable for node ${nodeId}; continuing without audio:`, error);
            return undefined;
        }
    }

    /**
     * Deallocate one unreferenced video stream from `streams` and report its id, or `undefined` if
     * nothing was freed. `streams` is a plain array and the caller's `CameraState` (which may be a
     * cached or subscription-backed snapshot) is never written to.
     *
     * Server-owned streams go first; a foreign one is touched only when nothing of ours is free, and
     * is logged, since the spec recommends commissioners pre-allocate (§15.2.1.1) and such a stream may
     * be deliberate. Nothing referenced is ever passed here — the device would refuse it with
     * INVALID_IN_STATE anyway.
     */
    protected async freeAnUnreferencedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        streams: AllocatedVideoStream[],
    ): Promise<number | undefined> {
        const unreferenced = streams.filter(stream => stream.referenceCount === 0);
        const ours = unreferenced.filter(stream => this.ownsStream(nodeId, endpointId, "video", stream.videoStreamId));
        const victim = ours[0] ?? unreferenced[0];
        if (victim === undefined) return undefined;

        if (ours[0] === undefined) {
            logger.notice(
                `Deallocating video stream ${victim.videoStreamId} on node ${nodeId}: it has no listeners and the camera has no capacity left, but this server did not allocate it`,
            );
        }
        try {
            await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "videoStreamDeallocate",
                fields: { videoStreamId: victim.videoStreamId },
            });
        } catch (error) {
            logger.info(`Could not deallocate video stream ${victim.videoStreamId}:`, error);
            return undefined;
        }
        this.dropLease(nodeId, endpointId, "video", victim.videoStreamId);
        return victim.videoStreamId;
    }

    async startStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        connectionId: string;
        streamUsage: number;
        sdp?: string;
        video?: VideoHints | false;
        audio?: AudioHints | false;
        iceServers?: unknown;
        iceTransportPolicy?: unknown;
        metadataEnabled?: boolean;
    }): Promise<StartStreamResult> {
        const { nodeId, endpointId, streamUsage } = args;
        const sdp = args.sdp === undefined ? undefined : parseSdpVideoConstraints(args.sdp);
        // One lock for resolution through the offer round trip: the device only raises ReferenceCount
        // at session establishment, so a stream resolved here reads as unreferenced at the device until
        // the response below lands. Releasing the lock in between would let a concurrent RESOURCE_EXHAUSTED
        // on this endpoint free or hand out the very stream this call is mid-way through using.
        return this.withEndpointLock(nodeId, endpointId, async () => {
            const state = await this.requireState(nodeId, endpointId);

            let video: ResolvedStream | undefined;
            if (args.video !== false) {
                const codecs = state.rateDistortionTradeOffPoints.map(point => point.codec);
                const codec = preferredVideoCodec(
                    codecs,
                    sdp,
                    args.video === undefined ? undefined : args.video.codecs,
                );
                video = await this.resolveVideoStreamLocked({
                    nodeId,
                    endpointId,
                    streamUsage,
                    codec,
                    sdp,
                    hints: args.video === undefined ? undefined : args.video,
                });
            }

            let audio: ResolvedStream | undefined;
            if (args.audio !== false && state.microphoneCapabilities !== undefined) {
                audio = await this.resolveAudioStreamLocked({
                    nodeId,
                    endpointId,
                    streamUsage,
                    sdp,
                    hints: args.audio === undefined ? undefined : args.audio,
                });
            }

            const response = await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "webrtcProvider",
                command: args.sdp === undefined ? "solicitOffer" : "provideOffer",
                fields: {
                    ...(args.sdp === undefined ? {} : { sdp: args.sdp }),
                    streamUsage,
                    ...(video === undefined ? {} : { videoStreams: [video.streamId] }),
                    ...(audio === undefined ? {} : { audioStreams: [audio.streamId] }),
                    ...(args.iceServers === undefined ? {} : { iceServers: args.iceServers }),
                    ...(args.iceTransportPolicy === undefined ? {} : { iceTransportPolicy: args.iceTransportPolicy }),
                    metadataEnabled: args.metadataEnabled === true,
                },
            });

            const webRtcSessionId = (response as { webRtcSessionId?: unknown } | undefined)?.webRtcSessionId;
            if (typeof webRtcSessionId !== "number") {
                throw ServerError.sdkStackError("Provider returned no WebRTCSessionID");
            }

            this.#sessions.set(webRtcSessionId, {
                webRtcSessionId,
                nodeId,
                endpointId,
                connectionId: args.connectionId,
                videoStreamIds: video === undefined ? new Array<number>() : [video.streamId],
                audioStreamIds: audio === undefined ? new Array<number>() : [audio.streamId],
            });

            return {
                webRtcSessionId,
                mode: args.sdp === undefined ? "solicit_offer" : "provide_offer",
                video,
                audio,
            };
        });
    }

    /** Ends the session on the device. The allocation is deliberately kept. */
    async stopStream(webRtcSessionId: number): Promise<void> {
        const session = this.#sessions.get(webRtcSessionId);
        if (session === undefined) return;
        this.#sessions.delete(webRtcSessionId);
        await this.io.invoke({
            nodeId: session.nodeId,
            endpointId: session.endpointId,
            cluster: "webrtcProvider",
            command: "endSession",
            fields: { webRtcSessionId, reason: WEBRTC_END_REASON_USER_HANGUP },
        });
    }

    /**
     * End every session a closing connection owned.
     *
     * The device only decrements ReferenceCount on EndSession, so a session left open pins its
     * streams permanently — VideoStreamDeallocate then answers INVALID_IN_STATE for good.
     */
    async releaseConnection(connectionId: string): Promise<void> {
        const owned = [...this.#sessions.values()].filter(session => session.connectionId === connectionId);
        for (const session of owned) {
            await this.stopStream(session.webRtcSessionId).catch(error =>
                logger.warn(`Failed to end session ${session.webRtcSessionId} on disconnect:`, error),
            );
        }
    }

    async snapshot(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        maxResolution?: Resolution;
        codec?: number;
    }): Promise<SnapshotResult> {
        const { nodeId, endpointId } = args;
        return this.withEndpointLock(nodeId, endpointId, async () => {
            const state = await this.requireState(nodeId, endpointId);
            const encoderBusy = state.allocatedVideoStreams.some(stream => stream.referenceCount > 0);
            const capability = selectSnapshotCapability(state.snapshotCapabilities, {
                encoderBusy,
                maxResolution: args.maxResolution,
                codec: args.codec,
            });
            if (capability === undefined) {
                throw ServerError.cameraStreamIncompatible({
                    reason: args.codec === undefined ? "bounds" : "codec",
                    device: state.snapshotCapabilities.map(entry => String(entry.imageCodec)),
                    requested: args.codec === undefined ? new Array<string>() : [String(args.codec)],
                });
            }

            const allocateResponse = await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "snapshotStreamAllocate",
                fields: {
                    imageCodec: capability.imageCodec,
                    maxFrameRate: capability.maxFrameRate,
                    minResolution: capability.resolution,
                    maxResolution: capability.resolution,
                },
            });
            const snapshotStreamId = (allocateResponse as { snapshotStreamId?: unknown } | undefined)?.snapshotStreamId;
            if (typeof snapshotStreamId !== "number") {
                throw ServerError.sdkStackError("SnapshotStreamAllocate returned no SnapshotStreamID");
            }
            this.recordLease(nodeId, endpointId, {
                kind: "snapshot",
                streamId: snapshotStreamId,
                allocatedByUs: true,
            });

            const captureResponse = await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "captureSnapshot",
                fields: { snapshotStreamId, requestedResolution: capability.resolution },
            });
            const parsed = captureResponse as
                | { data?: unknown; imageCodec?: unknown; resolution?: unknown }
                | undefined;
            if (
                !(parsed?.data instanceof Uint8Array) ||
                typeof parsed.imageCodec !== "number" ||
                !isResolution(parsed.resolution)
            ) {
                throw ServerError.sdkStackError("CaptureSnapshot returned an incomplete response");
            }

            return {
                data: parsed.data,
                imageCodec: parsed.imageCodec,
                resolution: parsed.resolution,
                downgraded: encoderBusy && !capability.requiresEncodedPixels,
            };
        });
    }

    async releaseStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        kind: StreamKind;
        streamId: number;
    }): Promise<void> {
        const { nodeId, endpointId, kind, streamId } = args;
        return this.withEndpointLock(nodeId, endpointId, async () => {
            const state = await this.requireState(nodeId, endpointId);
            const referenceCount = referenceCountOf(state, kind, streamId);
            if (referenceCount > 0) {
                throw ServerError.cameraStreamInUse({ streamId, referenceCount });
            }
            if (!this.ownsStream(nodeId, endpointId, kind, streamId)) {
                throw ServerError.cameraStreamNotOwned({ streamId });
            }
            const { command, fields } = deallocateCall(kind, streamId);
            await this.io.invoke({ nodeId, endpointId, cluster: "avsm", command, fields });
            this.dropLease(nodeId, endpointId, kind, streamId);
        });
    }
}
