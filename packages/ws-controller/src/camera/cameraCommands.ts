/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    CameraAudioHints,
    CameraCapabilitiesResult,
    CameraSnapshotResult,
    CameraStartStreamAudioResult,
    CameraStartStreamResult,
    CameraStartStreamVideoResult,
    CameraVideoHints,
} from "@matter-server/ws-client";
import { Bytes, EndpointNumber, NodeId } from "@matter/main";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "./CameraStreamManager.js";
import type { AudioEnvelope, Resolution, ResolvedStream, StreamKind, VideoEnvelope } from "./cameraTypes.js";
import type { AudioHints, VideoHints } from "./streamPolicy.js";

/** StreamUsageEnum values accepted from the wire; Internal (0) is device-only and never requested here. */
const STREAM_USAGE_BY_NAME = new Map<string, number>([
    ["Recording", 1],
    ["Analysis", 2],
    ["LiveView", 3],
]);

function isStreamKind(value: string): value is StreamKind {
    return value === "video" || value === "audio" || value === "snapshot";
}

function toResolution(value: unknown, field: string): Resolution {
    if (typeof value !== "object" || value === null || !("width" in value) || !("height" in value)) {
        throw ServerError.invalidArguments(`${field} must be an object with numeric width and height`);
    }
    const { width, height } = value;
    if (typeof width !== "number" || typeof height !== "number") {
        throw ServerError.invalidArguments(`${field} must be an object with numeric width and height`);
    }
    return { width, height };
}

export interface ParsedCameraTarget {
    nodeId: NodeId;
    endpointId: EndpointNumber;
}

export function parseCameraTarget(args: { node_id?: unknown; endpoint_id?: unknown }): ParsedCameraTarget {
    const { node_id: nodeId, endpoint_id: endpointId } = args;
    if (typeof nodeId !== "number" && typeof nodeId !== "bigint") {
        throw ServerError.invalidArguments("Camera command requires a numeric or bigint node_id");
    }
    if (typeof endpointId !== "number" || !Number.isInteger(endpointId) || endpointId < 0 || endpointId > 0xfffe) {
        throw ServerError.invalidArguments("Camera command requires endpoint_id to be an integer between 0 and 0xFFFE");
    }
    return { nodeId: NodeId(nodeId), endpointId: EndpointNumber(endpointId) };
}

function parseVideoHints(hints: CameraVideoHints): VideoHints {
    return {
        ...(hints.codecs === undefined ? {} : { codecs: hints.codecs }),
        ...(hints.min_resolution === undefined
            ? {}
            : { minResolution: toResolution(hints.min_resolution, "video.min_resolution") }),
        ...(hints.max_resolution === undefined
            ? {}
            : { maxResolution: toResolution(hints.max_resolution, "video.max_resolution") }),
        ...(hints.min_frame_rate === undefined ? {} : { minFrameRate: hints.min_frame_rate }),
        ...(hints.max_frame_rate === undefined ? {} : { maxFrameRate: hints.max_frame_rate }),
        ...(hints.min_bit_rate === undefined ? {} : { minBitRate: hints.min_bit_rate }),
        ...(hints.max_bit_rate === undefined ? {} : { maxBitRate: hints.max_bit_rate }),
    };
}

function parseAudioHints(hints: CameraAudioHints): AudioHints {
    return {
        ...(hints.codecs === undefined ? {} : { codecs: hints.codecs }),
        ...(hints.channel_count === undefined ? {} : { channelCount: hints.channel_count }),
        ...(hints.sample_rate === undefined ? {} : { sampleRate: hints.sample_rate }),
        ...(hints.bit_rate === undefined ? {} : { bitRate: hints.bit_rate }),
    };
}

export interface ParsedStartStreamArgs extends ParsedCameraTarget {
    streamUsage: number;
    sdp?: string;
    video?: VideoHints | false;
    audio?: AudioHints | false;
    iceServers?: Array<Record<string, unknown>>;
    iceTransportPolicy?: string;
    metadataEnabled?: boolean;
}

export function parseStartStreamArgs(args: {
    node_id?: unknown;
    endpoint_id?: unknown;
    stream_usage?: unknown;
    sdp?: string;
    video?: CameraVideoHints | false;
    audio?: CameraAudioHints | false;
    ice_servers?: Array<Record<string, unknown>>;
    ice_transport_policy?: string;
    metadata_enabled?: boolean;
}): ParsedStartStreamArgs {
    const target = parseCameraTarget(args);
    const streamUsage = typeof args.stream_usage === "string" ? STREAM_USAGE_BY_NAME.get(args.stream_usage) : undefined;
    if (streamUsage === undefined) {
        throw ServerError.invalidArguments(`Unknown stream_usage "${String(args.stream_usage)}"`);
    }
    return {
        ...target,
        streamUsage,
        ...(args.sdp === undefined ? {} : { sdp: args.sdp }),
        ...(args.video === undefined ? {} : { video: args.video === false ? false : parseVideoHints(args.video) }),
        ...(args.audio === undefined ? {} : { audio: args.audio === false ? false : parseAudioHints(args.audio) }),
        ...(args.ice_servers === undefined ? {} : { iceServers: args.ice_servers }),
        ...(args.ice_transport_policy === undefined ? {} : { iceTransportPolicy: args.ice_transport_policy }),
        ...(args.metadata_enabled === undefined ? {} : { metadataEnabled: args.metadata_enabled }),
    };
}

export interface ParsedStopStreamArgs extends ParsedCameraTarget {
    webRtcSessionId: number;
}

export function parseStopStreamArgs(args: {
    node_id?: unknown;
    endpoint_id?: unknown;
    webrtc_session_id?: unknown;
}): ParsedStopStreamArgs {
    const target = parseCameraTarget(args);
    const { webrtc_session_id: webRtcSessionId } = args;
    if (typeof webRtcSessionId !== "number" || !Number.isInteger(webRtcSessionId) || webRtcSessionId < 0) {
        throw ServerError.invalidArguments("camera_stop_stream requires a non-negative integer webrtc_session_id");
    }
    return { ...target, webRtcSessionId };
}

export interface ParsedSnapshotArgs extends ParsedCameraTarget {
    maxResolution?: Resolution;
    codec?: number;
}

export function parseSnapshotArgs(args: {
    node_id?: unknown;
    endpoint_id?: unknown;
    max_resolution?: unknown;
    codec?: unknown;
}): ParsedSnapshotArgs {
    const target = parseCameraTarget(args);
    const { max_resolution: maxResolution, codec } = args;
    if (codec !== undefined && (typeof codec !== "number" || !Number.isInteger(codec) || codec < 0)) {
        throw ServerError.invalidArguments("camera_snapshot codec must be a non-negative integer");
    }
    return {
        ...target,
        ...(maxResolution === undefined ? {} : { maxResolution: toResolution(maxResolution, "max_resolution") }),
        ...(codec === undefined ? {} : { codec }),
    };
}

export interface ParsedReleaseStreamArgs extends ParsedCameraTarget {
    kind: StreamKind;
    streamId: number;
}

export function parseReleaseStreamArgs(args: {
    node_id?: unknown;
    endpoint_id?: unknown;
    kind?: unknown;
    stream_id?: unknown;
}): ParsedReleaseStreamArgs {
    const target = parseCameraTarget(args);
    const { kind, stream_id: streamId } = args;
    if (typeof kind !== "string" || !isStreamKind(kind)) {
        throw ServerError.invalidArguments('camera_release_stream requires kind to be "video", "audio", or "snapshot"');
    }
    if (typeof streamId !== "number" || !Number.isInteger(streamId) || streamId < 0) {
        throw ServerError.invalidArguments("camera_release_stream requires a non-negative integer stream_id");
    }
    return { ...target, kind, streamId };
}

export function toWireCapabilities(capabilities: CameraCapabilities): CameraCapabilitiesResult {
    return {
        video: {
            ...(capabilities.video.sensor === undefined ? {} : { sensor: capabilities.video.sensor }),
            ...(capabilities.video.minViewport === undefined ? {} : { min_viewport: capabilities.video.minViewport }),
            ...(capabilities.video.maxFps === undefined ? {} : { max_fps: capabilities.video.maxFps }),
            ...(capabilities.video.maxHdrFps === undefined ? {} : { max_hdr_fps: capabilities.video.maxHdrFps }),
            ...(capabilities.video.hdrCapable === undefined ? {} : { hdr_capable: capabilities.video.hdrCapable }),
            rate_distortion_points: capabilities.video.rateDistortionPoints.map(point => ({
                codec: point.codec,
                resolution: point.resolution,
                min_bit_rate: point.minBitRate,
            })),
            codecs: capabilities.video.codecs,
        },
        audio: {
            codecs: capabilities.audio.codecs,
            ...(capabilities.audio.channels === undefined ? {} : { channels: capabilities.audio.channels }),
            sample_rates: capabilities.audio.sampleRates,
            bit_depths: capabilities.audio.bitDepths,
            ...(capabilities.audio.twoWayTalkSupport === undefined
                ? {}
                : { two_way_talk_support: capabilities.audio.twoWayTalkSupport }),
        },
        snapshot: {
            capabilities: capabilities.snapshot.capabilities.map(entry => ({
                resolution: entry.resolution,
                max_frame_rate: entry.maxFrameRate,
                image_codec: entry.imageCodec,
                requires_encoded_pixels: entry.requiresEncodedPixels,
                requires_hardware_encoder: entry.requiresHardwareEncoder,
            })),
        },
        limits: {
            ...(capabilities.limits.maxEncodedPixelRate === undefined
                ? {}
                : { max_encoded_pixel_rate: capabilities.limits.maxEncodedPixelRate }),
            ...(capabilities.limits.maxConcurrentEncoders === undefined
                ? {}
                : { max_concurrent_encoders: capabilities.limits.maxConcurrentEncoders }),
            supported_stream_usages: capabilities.limits.supportedStreamUsages,
            stream_usage_priorities: capabilities.limits.streamUsagePriorities,
        },
        allocated: {
            video: capabilities.allocated.video.map(stream => ({
                video_stream_id: stream.videoStreamId,
                stream_usage: stream.streamUsage,
                video_codec: stream.videoCodec,
                min_resolution: stream.minResolution,
                max_resolution: stream.maxResolution,
                min_frame_rate: stream.minFrameRate,
                max_frame_rate: stream.maxFrameRate,
                min_bit_rate: stream.minBitRate,
                max_bit_rate: stream.maxBitRate,
                reference_count: stream.referenceCount,
                owned_by_server: stream.ownedByServer,
            })),
            audio: capabilities.allocated.audio.map(stream => ({
                audio_stream_id: stream.audioStreamId,
                stream_usage: stream.streamUsage,
                audio_codec: stream.audioCodec,
                channel_count: stream.channelCount,
                sample_rate: stream.sampleRate,
                bit_rate: stream.bitRate,
                bit_depth: stream.bitDepth,
                reference_count: stream.referenceCount,
                owned_by_server: stream.ownedByServer,
            })),
            snapshot: capabilities.allocated.snapshot.map(stream => ({
                snapshot_stream_id: stream.snapshotStreamId,
                image_codec: stream.imageCodec,
                resolution: stream.resolution,
                reference_count: stream.referenceCount,
                owned_by_server: stream.ownedByServer,
            })),
        },
    };
}

/** `ResolvedStream.envelope` is a union; the manager only ever pairs a video envelope with a video track. */
function isVideoEnvelope(envelope: VideoEnvelope | AudioEnvelope): envelope is VideoEnvelope {
    return "minResolution" in envelope;
}

function toWireStartStreamVideo(stream: ResolvedStream): CameraStartStreamVideoResult {
    const { envelope } = stream;
    if (!isVideoEnvelope(envelope)) {
        throw ServerError.sdkStackError("Resolved video stream carried an audio envelope");
    }
    return {
        stream_id: stream.streamId,
        codec: envelope.codec,
        resolution: { min: envelope.minResolution, max: envelope.maxResolution },
        frame_rate: { min: envelope.minFrameRate, max: envelope.maxFrameRate },
        bit_rate: { min: envelope.minBitRate, max: envelope.maxBitRate },
        reused: stream.reused,
        allocated_by_server: stream.allocatedByUs,
        ...(stream.degraded === undefined ? {} : { degraded: stream.degraded }),
    };
}

function toWireStartStreamAudio(stream: ResolvedStream): CameraStartStreamAudioResult {
    const { envelope } = stream;
    if (isVideoEnvelope(envelope)) {
        throw ServerError.sdkStackError("Resolved audio stream carried a video envelope");
    }
    return {
        stream_id: stream.streamId,
        codec: envelope.codec,
        channel_count: envelope.channelCount,
        sample_rate: envelope.sampleRate,
        bit_rate: envelope.bitRate,
        bit_depth: envelope.bitDepth,
        reused: stream.reused,
        allocated_by_server: stream.allocatedByUs,
    };
}

export function toWireStartStreamResult(result: StartStreamResult): CameraStartStreamResult {
    return {
        webrtc_session_id: result.webRtcSessionId,
        mode: result.mode,
        video: result.video === undefined ? null : toWireStartStreamVideo(result.video),
        audio: result.audio === undefined ? null : toWireStartStreamAudio(result.audio),
    };
}

export function toWireSnapshotResult(result: SnapshotResult): CameraSnapshotResult {
    return {
        data: Bytes.toBase64(result.data),
        codec: result.imageCodec,
        resolution: result.resolution,
        downgraded: result.downgraded,
    };
}
