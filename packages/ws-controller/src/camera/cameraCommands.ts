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
    CameraResolution,
    CameraVideoHints,
} from "@matter-server/ws-client";
import { Bytes, EndpointNumber, NodeId } from "@matter/main";
import type { WebRtcTransportDefinitions } from "@matter/main/clusters";
import { StreamUsage } from "@matter/main/types";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { CAMERA_FIELD_RANGES, ICE_SERVER_LIMITS } from "./cameraFieldRanges.js";
import type { FieldRange } from "./cameraFieldRanges.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "./CameraStreamManager.js";
import type { AudioEnvelope, Resolution, ResolvedStream, StreamKind, VideoEnvelope } from "./cameraTypes.js";
import type { AudioHints, VideoHints } from "./streamPolicy.js";
import { toIceServers } from "./webRtcProviderArguments.js";
import {
    isInRange,
    isRecord,
    rangeText,
    rejectUnknownKeys,
    toBoundedString,
    toRequiredNumber,
} from "./wireArgumentChecks.js";
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

/** Each kind's id is its own field, so the bound is read per kind rather than shared. */
const STREAM_ID_RANGES: Record<StreamKind, FieldRange> = {
    video: CAMERA_FIELD_RANGES.videoStreamId,
    audio: CAMERA_FIELD_RANGES.audioStreamId,
    snapshot: CAMERA_FIELD_RANGES.snapshotStreamId,
};

/** The keys a resolution object takes. @see VIDEO_HINT_KEY_SET */
const RESOLUTION_KEY_SET: Record<keyof Required<CameraResolution>, true> = {
    width: true,
    height: true,
};

const RESOLUTION_KEYS: readonly string[] = Object.keys(RESOLUTION_KEY_SET);

function toResolution(value: unknown, field: string): Resolution {
    const { resolutionWidth, resolutionHeight } = CAMERA_FIELD_RANGES;
    const expected = `${field} must be an object whose width is ${rangeText(resolutionWidth)} and whose height is ${rangeText(resolutionHeight)}`;
    if (!isRecord(value) || !("width" in value) || !("height" in value)) {
        throw ServerError.invalidArguments(expected);
    }
    rejectUnknownKeys(value, RESOLUTION_KEYS, field);
    const { width, height } = value;
    if (!isInRange(width, resolutionWidth) || !isInRange(height, resolutionHeight)) {
        throw ServerError.invalidArguments(expected);
    }
    return { width, height };
}

function toOptionalString(value: unknown, field: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw ServerError.invalidArguments(`${field} must be a string`);
    return value;
}

function toOptionalNumber(value: unknown, field: string, range: FieldRange): number | undefined {
    if (value === undefined) return undefined;
    return toRequiredNumber(value, field, range);
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

export interface ParsedCameraTarget {
    nodeId: NodeId;
    endpointId: EndpointNumber;
}

/**
 * The target every camera command names, and the one place a camera command's own argument keys are
 * checked. The keys of an object nested under one — a `video` / `audio` hint, an `ice_servers` entry,
 * a resolution — are checked where that object is parsed.
 *
 * The command is named rather than its key set passed, so the set and the name in the refusal cannot
 * be paired wrongly. The set is the command's, not this function's: `node_id` and `endpoint_id` are
 * all it reads, so a key it does not know is the command's own argument. Checking it here is what
 * puts the refusal on every route, since every one of the five parses its target.
 */
function parseCameraTarget(
    args: { node_id?: unknown; endpoint_id?: unknown },
    command: CameraCommandName,
): ParsedCameraTarget {
    rejectUnknownKeys(args, CAMERA_ARG_KEYS[command], `${command} argument`);
    const { node_id: nodeId, endpoint_id: endpointId } = args;
    if (typeof nodeId !== "number" && typeof nodeId !== "bigint") {
        throw ServerError.invalidArguments("Camera command requires a numeric or bigint node_id");
    }
    // NodeId(v) is BigInt(v); a non-integer number reaches that conversion and throws an
    // uncaught RangeError instead of this typed error.
    if (typeof nodeId === "number" && !Number.isInteger(nodeId)) {
        throw ServerError.invalidArguments("Camera command requires a numeric node_id to be an integer");
    }
    if (typeof endpointId !== "number" || !Number.isInteger(endpointId) || endpointId < 0 || endpointId > 0xfffe) {
        throw ServerError.invalidArguments("Camera command requires endpoint_id to be an integer between 0 and 0xFFFE");
    }
    return { nodeId: NodeId(nodeId), endpointId: EndpointNumber(endpointId) };
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

/** The keys `camera_get_capabilities` takes. @see VIDEO_HINT_KEY_SET */
const CAPABILITIES_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_get_capabilities">>, true> = {
    node_id: true,
    endpoint_id: true,
};

/** The keys `camera_stop_stream` takes. @see VIDEO_HINT_KEY_SET */
const STOP_STREAM_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_stop_stream">>, true> = {
    node_id: true,
    endpoint_id: true,
    webrtc_session_id: true,
};

/** The keys `camera_release_stream` takes. @see VIDEO_HINT_KEY_SET */
const RELEASE_STREAM_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_release_stream">>, true> = {
    node_id: true,
    endpoint_id: true,
    kind: true,
    stream_id: true,
};

/**
 * What each camera command takes at the top level, and the only place a command name is paired with
 * a key set: the refusal names the command this table lists it under, so the two cannot drift.
 */
export const CAMERA_ARG_KEYS = {
    camera_get_capabilities: Object.keys(CAPABILITIES_ARG_KEY_SET),
    camera_start_stream: Object.keys(START_STREAM_ARG_KEY_SET),
    camera_stop_stream: Object.keys(STOP_STREAM_ARG_KEY_SET),
    camera_snapshot: Object.keys(SNAPSHOT_ARG_KEY_SET),
    camera_release_stream: Object.keys(RELEASE_STREAM_ARG_KEY_SET),
} satisfies Record<string, readonly string[]>;

export type CameraCommandName = keyof typeof CAMERA_ARG_KEYS;

export function parseCapabilitiesArgs(args: { node_id?: unknown; endpoint_id?: unknown }): ParsedCameraTarget {
    return parseCameraTarget(args, "camera_get_capabilities");
}

function parseVideoHints(value: unknown): VideoHints {
    if (!isRecord(value)) {
        throw ServerError.invalidArguments("video hints must be an object");
    }
    rejectUnknownKeys(value, VIDEO_HINT_KEYS, "video hint");
    const codecs = toOptionalCodecNames(value.codecs, "video.codecs");
    const minFrameRate = toOptionalNumber(
        value.min_frame_rate,
        "video.min_frame_rate",
        CAMERA_FIELD_RANGES.minFrameRate,
    );
    const maxFrameRate = toOptionalNumber(
        value.max_frame_rate,
        "video.max_frame_rate",
        CAMERA_FIELD_RANGES.maxFrameRate,
    );
    const minBitRate = toOptionalNumber(value.min_bit_rate, "video.min_bit_rate", CAMERA_FIELD_RANGES.minBitRate);
    const maxBitRate = toOptionalNumber(value.max_bit_rate, "video.max_bit_rate", CAMERA_FIELD_RANGES.maxBitRate);
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
    const channelCount = toOptionalNumber(value.channel_count, "audio.channel_count", CAMERA_FIELD_RANGES.channelCount);
    const sampleRate = toOptionalNumber(value.sample_rate, "audio.sample_rate", CAMERA_FIELD_RANGES.sampleRate);
    const bitRate = toOptionalNumber(value.bit_rate, "audio.bit_rate", CAMERA_FIELD_RANGES.audioBitRate);
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
    iceServers?: WebRtcTransportDefinitions.IceServer[];
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
    const target = parseCameraTarget(args, "camera_start_stream");
    // Internal is device-only: a stream carrying it must not be modified, so it is never requested here.
    const streamUsage = typeof args.stream_usage === "string" ? streamUsageByName(args.stream_usage) : undefined;
    if (streamUsage === undefined || streamUsage === StreamUsage.Internal) {
        throw ServerError.invalidArguments(`Unknown or device-only stream_usage "${String(args.stream_usage)}"`);
    }
    const sdp = toOptionalString(args.sdp, "sdp");
    const iceServers = args.ice_servers === undefined ? undefined : toIceServers(args.ice_servers, "ice_servers");
    const iceTransportPolicy =
        args.ice_transport_policy === undefined
            ? undefined
            : toBoundedString(
                  args.ice_transport_policy,
                  "ice_transport_policy",
                  ICE_SERVER_LIMITS.maxTransportPolicyLength,
              );
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
    const target = parseCameraTarget(args, "camera_stop_stream");
    const webRtcSessionId = toRequiredNumber(
        args.webrtc_session_id,
        "camera_stop_stream webrtc_session_id",
        CAMERA_FIELD_RANGES.webRtcSessionId,
    );
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
    const target = parseCameraTarget(args, "camera_snapshot");
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
    const target = parseCameraTarget(args, "camera_release_stream");
    const { kind, stream_id: streamId } = args;
    if (typeof kind !== "string" || !isStreamKind(kind)) {
        throw ServerError.invalidArguments('camera_release_stream requires kind to be "video", "audio", or "snapshot"');
    }
    return {
        ...target,
        kind,
        streamId: toRequiredNumber(streamId, "camera_release_stream stream_id", STREAM_ID_RANGES[kind]),
    };
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
        sessions: capabilities.sessions.map(session => ({
            webrtc_session_id: session.webRtcSessionId,
            peer_node_id: session.peerNodeId,
            peer_endpoint_id: session.peerEndpointId,
            stream_usage: streamUsageName(session.streamUsage),
            video_stream_ids: session.videoStreamIds,
            audio_stream_ids: session.audioStreamIds,
            established_by_this_server: session.establishedByThisServer,
        })),
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
    const wire: CameraSnapshotResult = {
        data: Bytes.toBase64(result.data),
        codec: imageCodecName(result.imageCodec),
        resolution: result.resolution,
        downgraded: result.downgraded,
    };
    if (result.snapshotStreamId !== undefined) wire.stream_id = result.snapshotStreamId;
    return wire;
}
