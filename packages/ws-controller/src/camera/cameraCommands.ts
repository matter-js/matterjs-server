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
import { Bytes, EndpointNumber, NodeId, UINT64_MAX } from "@matter/main";
import type { WebRtcTransportDefinitions } from "@matter/main/clusters";
import { StreamUsage } from "@matter/main/types";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { nodeIdTarget } from "../util/nodeIdClasses.js";
import { CAMERA_FIELD_RANGES, ICE_SERVER_LIMITS } from "./cameraFieldRanges.js";
import type { FieldRange } from "./cameraFieldRanges.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "./CameraStreamManager.js";
import type { AudioEnvelope, Resolution, ResolvedStream, StreamKind, VideoEnvelope } from "./cameraTypes.js";
import type { AudioHints, VideoHints } from "./streamPolicy.js";
import type { SignallingCommandName } from "./webRtcProviderArguments.js";
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

const STREAM_ID_RANGES: Record<StreamKind, FieldRange> = {
    video: CAMERA_FIELD_RANGES.videoStreamId,
    audio: CAMERA_FIELD_RANGES.audioStreamId,
    snapshot: CAMERA_FIELD_RANGES.snapshotStreamId,
};

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

/** Upper-cased, to match the SDP rtpmap spelling. */
function toOptionalCodecNames(value: unknown, field: string): string[] | undefined {
    return toOptionalStringArray(value, field)?.map(name => name.toUpperCase());
}

export interface ParsedCameraTarget {
    nodeId: NodeId;
    endpointId: EndpointNumber;
}

/** One camera command's arguments, once they are known to be an object and to hold no unknown key. */
interface ParsedCameraCommand {
    target: ParsedCameraTarget;
    fields: Record<string, unknown>;
}

/**
 * The argument object and target of a camera command, with the command's top-level keys checked.
 * Nested objects (hints, `ice_servers` entries, resolutions) are checked where they are parsed.
 */
function parseCameraCommand(args: unknown, command: CameraCommandName): ParsedCameraCommand {
    const fields = requireArgumentObject(args, command);
    rejectUnknownKeys(fields, CAMERA_ARG_KEYS[command], `${command} argument`);
    return { target: parseTargetIds(fields, command), fields };
}

/**
 * The command's arguments as an object, or an invalid-arguments refusal. Call before walking argument
 * keys: `Object.keys` accepts a string and throws a non-`ServerError` for `null`.
 */
export function requireArgumentObject(args: unknown, command: string): Record<string, unknown> {
    if (!isRecord(args)) {
        throw ServerError.invalidArguments(`${command} requires an object of arguments`);
    }
    return args;
}

/**
 * The node and endpoint a command names, validated here because `NodeId()` validates nothing. Refuses
 * node ids outside 64 bits and any id that does not name one single node (e.g. a Group Node ID).
 *
 * @see Matter Core spec § 2.5.5 — a Node ID is a 64-bit number.
 */
export function parseTargetIds(fields: Record<string, unknown>, subject: string): ParsedCameraTarget {
    const { node_id: nodeId, endpoint_id: endpointId } = fields;
    if (typeof nodeId !== "number" && typeof nodeId !== "bigint") {
        throw ServerError.invalidArguments(`${subject} requires a numeric or bigint node_id`);
    }
    // parseBigIntAwareJson turns large integer literals into bigint; an unsafe number here lost precision.
    if (typeof nodeId === "number" && !Number.isSafeInteger(nodeId)) {
        throw ServerError.invalidArguments(
            `${subject} requires a numeric node_id to be an integer no greater than ${Number.MAX_SAFE_INTEGER}; state a larger node id as a bigint`,
        );
    }
    if (nodeId < 0 || nodeId > UINT64_MAX) {
        throw ServerError.invalidArguments(`${subject} requires node_id to be between 0 and ${UINT64_MAX}`);
    }
    if (typeof endpointId !== "number" || !Number.isInteger(endpointId) || endpointId < 0 || endpointId > 0xfffe) {
        throw ServerError.invalidArguments(`${subject} requires endpoint_id to be an integer between 0 and 0xFFFE`);
    }
    const target = NodeId(nodeId);
    // A group invoke suppresses the response, and every camera command needs the camera's answer.
    const classified = nodeIdTarget(target);
    if (classified.kind !== "node") {
        throw ServerError.invalidArguments(
            `${subject} cannot address ${classified.className}: node_id must name one node`,
        );
    }
    return { nodeId: target, endpointId: EndpointNumber(endpointId) };
}

/**
 * The keys `camera_start_stream` takes under `video`. Typed as a `Record` over the wire model's keys,
 * so a key added to `CameraVideoHints` must be added here to compile; the other key sets follow suit.
 */
const VIDEO_HINT_KEY_SET: Record<keyof CameraVideoHints, true> = {
    codecs: true,
    min_resolution: true,
    max_resolution: true,
    min_frame_rate: true,
    max_frame_rate: true,
    min_bit_rate: true,
    max_bit_rate: true,
    watermark_enabled: true,
    osd_enabled: true,
};

export const VIDEO_HINT_KEYS: readonly string[] = Object.keys(VIDEO_HINT_KEY_SET);

const AUDIO_HINT_KEY_SET: Record<keyof CameraAudioHints, true> = {
    codecs: true,
    channel_count: true,
    sample_rate: true,
    bit_rate: true,
};

export const AUDIO_HINT_KEYS: readonly string[] = Object.keys(AUDIO_HINT_KEY_SET);

const SNAPSHOT_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_snapshot">>, true> = {
    node_id: true,
    endpoint_id: true,
    max_resolution: true,
    codec: true,
    watermark_enabled: true,
    osd_enabled: true,
};

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
    allow_eviction: true,
};

const CAPABILITIES_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_get_capabilities">>, true> = {
    node_id: true,
    endpoint_id: true,
};

const STOP_STREAM_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_stop_stream">>, true> = {
    node_id: true,
    endpoint_id: true,
    webrtc_session_id: true,
};

const PROVIDE_ANSWER_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_provide_answer">>, true> = {
    node_id: true,
    endpoint_id: true,
    webrtc_session_id: true,
    sdp: true,
};

const PROVIDE_ICE_CANDIDATES_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_provide_ice_candidates">>, true> = {
    node_id: true,
    endpoint_id: true,
    webrtc_session_id: true,
    ice_candidates: true,
};

const RELEASE_STREAM_ARG_KEY_SET: Record<keyof Required<ArgsOf<"camera_release_stream">>, true> = {
    node_id: true,
    endpoint_id: true,
    kind: true,
    stream_id: true,
};

/** What each camera command takes at the top level. */
export const CAMERA_ARG_KEYS = {
    camera_get_capabilities: Object.keys(CAPABILITIES_ARG_KEY_SET),
    camera_start_stream: Object.keys(START_STREAM_ARG_KEY_SET),
    camera_stop_stream: Object.keys(STOP_STREAM_ARG_KEY_SET),
    camera_snapshot: Object.keys(SNAPSHOT_ARG_KEY_SET),
    camera_release_stream: Object.keys(RELEASE_STREAM_ARG_KEY_SET),
    camera_provide_answer: Object.keys(PROVIDE_ANSWER_ARG_KEY_SET),
    camera_provide_ice_candidates: Object.keys(PROVIDE_ICE_CANDIDATES_ARG_KEY_SET),
} satisfies Record<string, readonly string[]>;

export type CameraCommandName = keyof typeof CAMERA_ARG_KEYS;

/**
 * Which provider command each camera signalling command sends, and the target it sends it to.
 * `payload` is the caller's fields minus the target, unconverted; `toProviderCommandFields` converts it.
 */
export interface ParsedSignallingArgs extends ParsedCameraTarget {
    commandName: SignallingCommandName;
    payload: Record<string, unknown>;
}

/** The camera commands that signal into a session rather than establishing or ending one. */
export type CameraSignallingCommandName = "camera_provide_answer" | "camera_provide_ice_candidates";

const SIGNALLING_PROVIDER_COMMANDS: Record<CameraSignallingCommandName, SignallingCommandName> = {
    camera_provide_answer: "ProvideAnswer",
    camera_provide_ice_candidates: "ProvideIceCandidates",
};

export function parseSignallingArgs(args: unknown, command: CameraSignallingCommandName): ParsedSignallingArgs {
    const { target, fields } = parseCameraCommand(args, command);
    const payload = { ...fields };
    delete payload.node_id;
    delete payload.endpoint_id;
    return { ...target, commandName: SIGNALLING_PROVIDER_COMMANDS[command], payload };
}

export function parseCapabilitiesArgs(args: unknown): ParsedCameraTarget {
    return parseCameraCommand(args, "camera_get_capabilities").target;
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
    const watermarkEnabled = toOptionalBoolean(value.watermark_enabled, "video.watermark_enabled");
    const osdEnabled = toOptionalBoolean(value.osd_enabled, "video.osd_enabled");
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
        ...(watermarkEnabled === undefined ? {} : { watermarkEnabled }),
        ...(osdEnabled === undefined ? {} : { osdEnabled }),
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
    allowEviction?: boolean;
}

export function parseStartStreamArgs(args: unknown): ParsedStartStreamArgs {
    const { target, fields } = parseCameraCommand(args, "camera_start_stream");
    // Internal is device-only and must not be requested.
    const streamUsage = typeof fields.stream_usage === "string" ? streamUsageByName(fields.stream_usage) : undefined;
    if (streamUsage === undefined || streamUsage === StreamUsage.Internal) {
        throw ServerError.invalidArguments(`Unknown or device-only stream_usage "${String(fields.stream_usage)}"`);
    }
    const sdp = toOptionalString(fields.sdp, "sdp");
    const iceServers = fields.ice_servers === undefined ? undefined : toIceServers(fields.ice_servers, "ice_servers");
    const iceTransportPolicy =
        fields.ice_transport_policy === undefined
            ? undefined
            : toBoundedString(
                  fields.ice_transport_policy,
                  "ice_transport_policy",
                  ICE_SERVER_LIMITS.maxTransportPolicyLength,
              );
    const metadataEnabled = toOptionalBoolean(fields.metadata_enabled, "metadata_enabled");
    const allowEviction = toOptionalBoolean(fields.allow_eviction, "allow_eviction");
    const video =
        fields.video === undefined ? undefined : fields.video === false ? false : parseVideoHints(fields.video);
    const audio =
        fields.audio === undefined ? undefined : fields.audio === false ? false : parseAudioHints(fields.audio);
    return {
        ...target,
        streamUsage,
        ...(sdp === undefined ? {} : { sdp }),
        ...(video === undefined ? {} : { video }),
        ...(audio === undefined ? {} : { audio }),
        ...(iceServers === undefined ? {} : { iceServers }),
        ...(iceTransportPolicy === undefined ? {} : { iceTransportPolicy }),
        ...(metadataEnabled === undefined ? {} : { metadataEnabled }),
        ...(allowEviction === undefined ? {} : { allowEviction }),
    };
}

export interface ParsedStopStreamArgs extends ParsedCameraTarget {
    webRtcSessionId: number;
}

export function parseStopStreamArgs(args: unknown): ParsedStopStreamArgs {
    const { target, fields } = parseCameraCommand(args, "camera_stop_stream");
    const webRtcSessionId = toRequiredNumber(
        fields.webrtc_session_id,
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
    watermarkEnabled?: boolean;
    osdEnabled?: boolean;
}

export function parseSnapshotArgs(args: unknown): ParsedSnapshotArgs {
    const { target, fields } = parseCameraCommand(args, "camera_snapshot");
    const { max_resolution: maxResolution, codec } = fields;
    const imageCodec = codec === undefined ? undefined : toImageCodec(codec);
    const watermarkEnabled = toOptionalBoolean(fields.watermark_enabled, "watermark_enabled");
    const osdEnabled = toOptionalBoolean(fields.osd_enabled, "osd_enabled");
    return {
        ...target,
        ...(maxResolution === undefined ? {} : { maxResolution: toResolution(maxResolution, "max_resolution") }),
        ...(imageCodec === undefined ? {} : { codec: imageCodec }),
        ...(watermarkEnabled === undefined ? {} : { watermarkEnabled }),
        ...(osdEnabled === undefined ? {} : { osdEnabled }),
    };
}

export interface ParsedReleaseStreamArgs extends ParsedCameraTarget {
    kind: StreamKind;
    streamId: number;
}

export function parseReleaseStreamArgs(args: unknown): ParsedReleaseStreamArgs {
    const { target, fields } = parseCameraCommand(args, "camera_release_stream");
    const { kind, stream_id: streamId } = fields;
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
    const privacy = capabilities.privacy;
    return {
        ...(capabilities.features === undefined ? {} : { features: capabilities.features }),
        privacy: {
            ...(privacy.softRecordingModeEnabled === undefined
                ? {}
                : { soft_recording_mode_enabled: privacy.softRecordingModeEnabled }),
            ...(privacy.softLivestreamModeEnabled === undefined
                ? {}
                : { soft_livestream_mode_enabled: privacy.softLivestreamModeEnabled }),
            ...(privacy.hardModeOn === undefined ? {} : { hard_mode_on: privacy.hardModeOn }),
        },
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
                allocated_by_server: stream.allocatedByServer,
                watermark_enabled: stream.overlays.watermarkEnabled ?? false,
                osd_enabled: stream.overlays.osdEnabled ?? false,
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
                allocated_by_server: stream.allocatedByServer,
            })),
            snapshot: capabilities.allocated.snapshot.map(stream => ({
                snapshot_stream_id: stream.snapshotStreamId,
                image_codec: imageCodecName(stream.imageCodec),
                min_resolution: stream.minResolution,
                max_resolution: stream.maxResolution,
                reference_count: stream.referenceCount,
                allocated_by_server: stream.allocatedByServer,
                frame_rate: stream.frameRate,
                encoded_pixels: stream.encodedPixels,
                hardware_encoder: stream.hardwareEncoder,
                watermark_enabled: stream.overlays.watermarkEnabled ?? false,
                osd_enabled: stream.overlays.osdEnabled ?? false,
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
        provenance: stream.provenance,
        // Absent means no such overlay.
        watermark_enabled: envelope.overlays.watermarkEnabled ?? false,
        osd_enabled: envelope.overlays.osdEnabled ?? false,
        degraded: stream.degraded ?? false,
        ...(stream.evicted === undefined ? {} : { evicted_stream_ids: stream.evicted }),
        ...(stream.budgetNarrowed === undefined
            ? {}
            : {
                  narrowed_by_encoder_budget: {
                      ...(stream.budgetNarrowed.maxFrameRate === undefined
                          ? {}
                          : { max_frame_rate: stream.budgetNarrowed.maxFrameRate }),
                      ...(stream.budgetNarrowed.maxResolution === undefined
                          ? {}
                          : { max_resolution: stream.budgetNarrowed.maxResolution }),
                  },
              }),
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
        provenance: stream.provenance,
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
        degraded: result.degraded,
        stream_id: result.snapshotStreamId,
        provenance: result.provenance,
    };
}
