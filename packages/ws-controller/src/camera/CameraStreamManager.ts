/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import type { Resolution, ResolvedStream, StreamKind, StreamLease } from "./cameraTypes.js";
import type { SdpVideoConstraints } from "./sdpConstraints.js";
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
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === "number" ? code : undefined;
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
    /** Typed AVSM state, or undefined when the endpoint does not expose the behaviour. */
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

export class CameraStreamManager {
    readonly #io: CameraDeviceIo;
    readonly #leases = new Map<string, StreamLease[]>();
    readonly #locks = new Map<string, Promise<unknown>>();

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
        const { nodeId, endpointId, streamUsage, codec } = args;
        return this.withEndpointLock(nodeId, endpointId, async () => {
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

            const reused = findReusableVideoStream(state.allocatedVideoStreams, envelope, streamUsage);
            if (reused !== undefined) {
                return {
                    streamId: reused.videoStreamId,
                    envelope,
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
                    const streamId = (response as { videoStreamId?: unknown } | undefined)?.videoStreamId;
                    if (typeof streamId !== "number") {
                        throw ServerError.sdkStackError("VideoStreamAllocate returned no VideoStreamID");
                    }
                    this.recordLease(nodeId, endpointId, { kind: "video", streamId, allocatedByUs: true });
                    return { streamId, envelope, reused: false, allocatedByUs: true };
                } catch (error) {
                    if (error instanceof ServerError) throw error;
                    lastStatus = deviceStatusOf(error);
                    if (lastStatus === RESOURCE_EXHAUSTED) {
                        const relaxed = findReusableVideoStream(state.allocatedVideoStreams, envelope, streamUsage, {
                            ignoreStreamUsage: true,
                        });
                        if (relaxed !== undefined) {
                            return {
                                streamId: relaxed.videoStreamId,
                                envelope,
                                reused: true,
                                allocatedByUs: this.ownsStream(nodeId, endpointId, "video", relaxed.videoStreamId),
                            };
                        }
                        if (await this.freeAnUnreferencedVideoStream(nodeId, endpointId, state)) {
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
            const degraded = findDegradedVideoStream(state.allocatedVideoStreams, codec, args.hints ?? {});
            if (degraded !== undefined) {
                return {
                    streamId: degraded.videoStreamId,
                    envelope,
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
                allocated: state.allocatedVideoStreams.map(stream => ({
                    streamId: stream.videoStreamId,
                    referenceCount: stream.referenceCount,
                })),
                maxConcurrentEncoders: state.maxConcurrentEncoders,
                maxEncodedPixelRate: state.maxEncodedPixelRate,
            });
        });
    }

    /**
     * Audio has no narrowing ladder: a camera either supports the codec or it does not. An audio
     * track is optional in a way a video track is not, so a device rejection yields `undefined` and a
     * video-only session rather than a failure.
     */
    async resolveAudioStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        sdp?: SdpVideoConstraints;
        hints?: AudioHints;
    }): Promise<ResolvedStream | undefined> {
        const { nodeId, endpointId, streamUsage } = args;
        return this.withEndpointLock(nodeId, endpointId, async () => {
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
                    envelope,
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
                const streamId = (response as { audioStreamId?: unknown } | undefined)?.audioStreamId;
                if (typeof streamId !== "number") return undefined;
                this.recordLease(nodeId, endpointId, { kind: "audio", streamId, allocatedByUs: true });
                return { streamId, envelope, reused: false, allocatedByUs: true };
            } catch (error) {
                logger.info(`Audio stream unavailable for node ${nodeId}; continuing without audio:`, error);
                return undefined;
            }
        });
    }

    /**
     * Deallocate one unreferenced video stream and report whether it freed anything.
     *
     * Server-owned streams go first; a foreign one is touched only when nothing of ours is free, and
     * is logged, since the spec recommends commissioners pre-allocate (§15.2.1.1) and such a stream may
     * be deliberate. Nothing referenced is ever passed here — the device would refuse it with
     * INVALID_IN_STATE anyway.
     */
    protected async freeAnUnreferencedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        state: CameraState,
    ): Promise<boolean> {
        const unreferenced = state.allocatedVideoStreams.filter(stream => stream.referenceCount === 0);
        const ours = unreferenced.filter(stream => this.ownsStream(nodeId, endpointId, "video", stream.videoStreamId));
        const victim = ours[0] ?? unreferenced[0];
        if (victim === undefined) return false;

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
            return false;
        }
        this.dropLease(nodeId, endpointId, "video", victim.videoStreamId);
        state.allocatedVideoStreams = state.allocatedVideoStreams.filter(
            stream => stream.videoStreamId !== victim.videoStreamId,
        );
        return true;
    }
}
