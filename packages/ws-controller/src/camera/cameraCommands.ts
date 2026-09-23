/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    ArgsOf,
    CameraAudioHints,
    CameraCapabilitiesResult,
    CameraSnapshotResult,
    CameraStartStreamAudioResult,
    CameraStartStreamResult,
    CameraStartStreamVideoResult,
    CameraVideoHints,
} from "@matter-server/ws-client";
import { Bytes, EndpointNumber, NodeId } from "@matter/main";
import { StreamUsage } from "@matter/main/types";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "./CameraStreamManager.js";
import type { AudioEnvelope, Resolution, ResolvedStream, StreamKind, VideoEnvelope } from "./cameraTypes.js";
import type { AudioHints, VideoHints } from "./streamPolicy.js";
import {
    audioCodecName,
    imageCodecByName,
    imageCodecName,
    streamUsageByName,
    streamUsageName,
    twoWayTalkSupportName,
    videoCodecName,
} from "./wireNames.js";

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

function toOptionalString(value: unknown, field: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw ServerError.invalidArguments(`${field} must be a string`);
    return value;
}

function toOptionalNumber(value: unknown, field: string): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "number") throw ServerError.invalidArguments(`${field} must be a number`);
    return value;
}

function toOptionalBoolean(value: unknown, field: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") throw ServerError.invalidArguments(`${field} must be a boolean`);
    return value;
}

function toOptionalStringArray(value: unknown, field: string): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some(entry => typeof entry !== "string")) {
        throw ServerError.invalidArguments(`${field} must be an array of strings`);
    }
    return value;
}

/** Codec names are matched against the SDP rtpmap spelling, which is upper case. */
function toOptionalCodecNames(value: unknown, field: string): string[] | undefined {
    return toOptionalStringArray(value, field)?.map(name => name.toUpperCase());
}

function toOptionalRecordArray(value: unknown, field: string): Array<Record<string, unknown>> | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some(entry => typeof entry !== "object" || entry === null)) {
        throw ServerError.invalidArguments(`${field} must be an array of objects`);
    }
    return value;
}

/** Arrays are excluded: a hint object's keys are named, and an array's are its indices. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
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

/**
 * Every key under a hint object is a bound on what the caller accepts, so a key the server does not
 * know is refused rather than dropped. Dropping it would answer a request nobody made, which is the
 * one thing these commands never do.
 */
function rejectUnknownKeys(value: object, known: readonly string[], subject: string): void {
    const unknown = Object.keys(value).filter(key => !known.includes(key));
    if (unknown.length > 0) {
        throw ServerError.invalidArguments(
            `unknown ${subject} key: ${unknown.join(", ")}. Accepted: ${known.join(", ")}`,
        );
    }
}

/**
 * The keys `camera_start_stream` takes under `video`, in the spelling the wire uses.
 *
 * Built from a `Record` over the wire model's own key set, so a hint added to `CameraVideoHints`
 * without being listed here does not compile. Without that tie the list is a third copy of the hint
 * shape, and a hint missing from it would be refused although the reference documents it.
 */
const VIDEO_HINT_KEY_SET: Record<keyof CameraVideoHints, true> = {
    codecs: true,
    min_resolution: true,
    max_resolution: true,
    min_frame_rate: true,
    max_frame_rate: true,
    min_bit_rate: true,
    max_bit_rate: true,
};

export const VIDEO_HINT_KEYS: readonly string[] = Object.keys(VIDEO_HINT_KEY_SET);

/** The keys `camera_start_stream` takes under `audio`. @see VIDEO_HINT_KEY_SET */
const AUDIO_HINT_KEY_SET: Record<keyof CameraAudioHints, true> = {
    codecs: true,
    channel_count: true,
    sample_rate: true,
    bit_rate: true,
};

export const AUDIO_HINT_KEYS: readonly string[] = Object.keys(AUDIO_HINT_KEY_SET);

/** The keys `camera_snapshot` takes. @see VIDEO_HINT_KEY_SET */
const SNAPSHOT_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_snapshot">>, true> = {
    node_id: true,
    endpoint_id: true,
    max_resolution: true,
    codec: true,
};

export const SNAPSHOT_ARG_KEYS: readonly string[] = Object.keys(SNAPSHOT_ARG_KEY_SET);

/** The top-level keys `camera_start_stream` takes. @see VIDEO_HINT_KEY_SET */
const START_STREAM_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_start_stream">>, true> = {
    node_id: true,
    endpoint_id: true,
    stream_usage: true,
    sdp: true,
    video: true,
    audio: true,
    ice_servers: true,
    ice_transport_policy: true,
    metadata_enabled: true,
};

export const START_STREAM_ARG_KEYS: readonly string[] = Object.keys(START_STREAM_ARG_KEY_SET);

function parseVideoHints(value: unknown): VideoHints {
    if (!isRecord(value)) {
        throw ServerError.invalidArguments("video hints must be an object");
    }
    rejectUnknownKeys(value, VIDEO_HINT_KEYS, "video hint");
    const codecs = toOptionalCodecNames(value.codecs, "video.codecs");
    const minFrameRate = toOptionalNumber(value.min_frame_rate, "video.min_frame_rate");
    const maxFrameRate = toOptionalNumber(value.max_frame_rate, "video.max_frame_rate");
    const minBitRate = toOptionalNumber(value.min_bit_rate, "video.min_bit_rate");
    const maxBitRate = toOptionalNumber(value.max_bit_rate, "video.max_bit_rate");
    return {
        ...(codecs === undefined ? {} : { codecs }),
        ...(value.min_resolution === undefined
            ? {}
            : { minResolution: toResolution(value.min_resolution, "video.min_resolution") }),
        ...(value.max_resolution === undefined
            ? {}
            : { maxResolution: toResolution(value.max_resolution, "video.max_resolution") }),
        ...(minFrameRate === undefined ? {} : { minFrameRate }),
        ...(maxFrameRate === undefined ? {} : { maxFrameRate }),
        ...(minBitRate === undefined ? {} : { minBitRate }),
        ...(maxBitRate === undefined ? {} : { maxBitRate }),
    };
}

function parseAudioHints(value: unknown): AudioHints {
    if (!isRecord(value)) {
        throw ServerError.invalidArguments("audio hints must be an object");
    }
    rejectUnknownKeys(value, AUDIO_HINT_KEYS, "audio hint");
    const codecs = toOptionalCodecNames(value.codecs, "audio.codecs");
    const channelCount = toOptionalNumber(value.channel_count, "audio.channel_count");
    const sampleRate = toOptionalNumber(value.sample_rate, "audio.sample_rate");
    const bitRate = toOptionalNumber(value.bit_rate, "audio.bit_rate");
    return {
        ...(codecs === undefined ? {} : { codecs }),
        ...(channelCount === undefined ? {} : { channelCount }),
        ...(sampleRate === undefined ? {} : { sampleRate }),
        ...(bitRate === undefined ? {} : { bitRate }),
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
    sdp?: unknown;
    video?: unknown;
    audio?: unknown;
    ice_servers?: unknown;
    ice_transport_policy?: unknown;
    metadata_enabled?: unknown;
}): ParsedStartStreamArgs {
    rejectUnknownKeys(args, START_STREAM_ARG_KEYS, "camera_start_stream argument");
    const target = parseCameraTarget(args);
    // Internal is device-only: a stream carrying it must not be modified, so it is never requested here.
    const streamUsage = typeof args.stream_usage === "string" ? streamUsageByName(args.stream_usage) : undefined;
    if (streamUsage === undefined || streamUsage === StreamUsage.Internal) {
        throw ServerError.invalidArguments(`Unknown or device-only stream_usage "${String(args.stream_usage)}"`);
    }
    const sdp = toOptionalString(args.sdp, "sdp");
    const iceServers = toOptionalRecordArray(args.ice_servers, "ice_servers");
    const iceTransportPolicy = toOptionalString(args.ice_transport_policy, "ice_transport_policy");
    const metadataEnabled = toOptionalBoolean(args.metadata_enabled, "metadata_enabled");
    const video = args.video === undefined ? undefined : args.video === false ? false : parseVideoHints(args.video);
    const audio = args.audio === undefined ? undefined : args.audio === false ? false : parseAudioHints(args.audio);
    return {
        ...target,
        streamUsage,
        ...(sdp === undefined ? {} : { sdp }),
        ...(video === undefined ? {} : { video }),
        ...(audio === undefined ? {} : { audio }),
        ...(iceServers === undefined ? {} : { iceServers }),
        ...(iceTransportPolicy === undefined ? {} : { iceTransportPolicy }),
        ...(metadataEnabled === undefined ? {} : { metadataEnabled }),
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

function toImageCodec(value: unknown): number {
    const codec = typeof value === "string" ? imageCodecByName(value) : undefined;
    if (codec === undefined) {
        throw ServerError.invalidArguments(
            `camera_snapshot codec must be an image codec name such as "JPEG" or "HEIC", not ${JSON.stringify(value)}`,
        );
    }
    return codec;
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
    rejectUnknownKeys(args, SNAPSHOT_ARG_KEYS, "camera_snapshot argument");
    const target = parseCameraTarget(args);
    const { max_resolution: maxResolution, codec } = args;
    const imageCodec = codec === undefined ? undefined : toImageCodec(codec);
    return {
        ...target,
        ...(maxResolution === undefined ? {} : { maxResolution: toResolution(maxResolution, "max_resolution") }),
        ...(imageCodec === undefined ? {} : { codec: imageCodec }),
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
                codec: videoCodecName(point.codec),
                resolution: point.resolution,
                min_bit_rate: point.minBitRate,
            })),
            codecs: capabilities.video.codecs.map(videoCodecName),
        },
        audio: {
            codecs: capabilities.audio.codecs.map(audioCodecName),
            ...(capabilities.audio.channels === undefined ? {} : { channels: capabilities.audio.channels }),
            sample_rates: capabilities.audio.sampleRates,
            bit_depths: capabilities.audio.bitDepths,
            ...(capabilities.audio.twoWayTalkSupport === undefined
                ? {}
                : { two_way_talk_support: twoWayTalkSupportName(capabilities.audio.twoWayTalkSupport) }),
        },
        snapshot: {
            capabilities: capabilities.snapshot.capabilities.map(entry => ({
                resolution: entry.resolution,
                max_frame_rate: entry.maxFrameRate,
                image_codec: imageCodecName(entry.imageCodec),
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
            ...(capabilities.limits.maxNetworkBandwidth === undefined
                ? {}
                : { max_network_bandwidth: capabilities.limits.maxNetworkBandwidth }),

            supported_stream_usages: capabilities.limits.supportedStreamUsages.map(streamUsageName),
            stream_usage_priorities: capabilities.limits.streamUsagePriorities.map(streamUsageName),
        },
        allocated: {
            video: capabilities.allocated.video.map(stream => ({
                video_stream_id: stream.videoStreamId,
                stream_usage: streamUsageName(stream.streamUsage),
                video_codec: videoCodecName(stream.videoCodec),
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
                stream_usage: streamUsageName(stream.streamUsage),
                audio_codec: audioCodecName(stream.audioCodec),
                channel_count: stream.channelCount,
                sample_rate: stream.sampleRate,
                bit_rate: stream.bitRate,
                bit_depth: stream.bitDepth,
                reference_count: stream.referenceCount,
                owned_by_server: stream.ownedByServer,
            })),
            snapshot: capabilities.allocated.snapshot.map(stream => ({
                snapshot_stream_id: stream.snapshotStreamId,
                image_codec: imageCodecName(stream.imageCodec),
                min_resolution: stream.minResolution,
                max_resolution: stream.maxResolution,
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
        codec: videoCodecName(envelope.codec),
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
        codec: audioCodecName(envelope.codec),
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
        codec: imageCodecName(result.imageCodec),
        resolution: result.resolution,
        downgraded: result.downgraded,
    };
}
