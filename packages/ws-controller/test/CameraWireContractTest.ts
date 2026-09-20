/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    AUDIO_HINT_KEYS,
    parseSnapshotArgs,
    parseStartStreamArgs,
    SNAPSHOT_ARG_KEYS,
    START_STREAM_ARG_KEYS,
    toWireCapabilities,
    toWireSnapshotResult,
    toWireStartStreamResult,
    VIDEO_HINT_KEYS,
} from "../src/camera/cameraCommands.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "../src/camera/CameraStreamManager.js";
import type { AudioSelection, VideoSelection } from "../src/camera/streamPolicy.js";
import { ServerError } from "../src/types/WebSocketMessageTypes.js";

function repoRoot(): string {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(join(dir, "docs", "websockets_api.md"))) {
        const parent = dirname(dir);
        if (parent === dir) throw new Error("repository root not found from the test's own location");
        dir = parent;
    }
    return dir;
}

const ROOT = repoRoot();

/** The part of a Markdown file between `heading` and the next heading of the same level. */
function section(path: string, heading: string): string {
    const text = readFileSync(join(ROOT, path), "utf8");
    const start = text.indexOf(heading);
    if (start < 0) throw new Error(`${path} has no section "${heading}"`);
    const level = heading.slice(0, heading.indexOf(" "));
    const end = text.indexOf(`\n${level} `, start + heading.length);
    return end < 0 ? text.slice(start) : text.slice(start, end);
}

/** Words a Markdown reference spells out, so a key is only "documented" when it stands on its own. */
function tokens(text: string): Set<string> {
    return new Set(text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
}

/** Every key of every object in `payload`, however deeply nested. */
function keysOf(payload: unknown, into = new Set<string>()): Set<string> {
    if (Array.isArray(payload)) {
        for (const entry of payload) keysOf(entry, into);
    } else if (typeof payload === "object" && payload !== null) {
        for (const [key, value] of Object.entries(payload)) {
            into.add(key);
            keysOf(value, into);
        }
    }
    return into;
}

const CAPABILITIES: CameraCapabilities = {
    video: {
        sensor: { width: 3840, height: 2160 },
        maxFps: 30,
        maxHdrFps: 15,
        hdrCapable: true,
        minViewport: { width: 640, height: 360 },
        rateDistortionPoints: [{ codec: 0, resolution: { width: 1920, height: 1080 }, minBitRate: 2000000 }],
        codecs: [0],
    },
    audio: { codecs: [0], channels: 2, sampleRates: [48000, 16000], bitDepths: [16], twoWayTalkSupport: 0 },
    snapshot: {
        capabilities: [
            {
                resolution: { width: 1920, height: 1080 },
                maxFrameRate: 1,
                imageCodec: 0,
                requiresEncodedPixels: true,
                requiresHardwareEncoder: false,
            },
        ],
    },
    limits: {
        maxEncodedPixelRate: 248832000,
        maxConcurrentEncoders: 2,
        maxNetworkBandwidth: 8000000,
        supportedStreamUsages: [0, 1, 2, 3],
        streamUsagePriorities: [3, 1, 2, 0],
    },
    allocated: {
        video: [
            {
                videoStreamId: 1,
                streamUsage: 2,
                videoCodec: 0,
                minResolution: { width: 640, height: 360 },
                maxResolution: { width: 1920, height: 1080 },
                minFrameRate: 1,
                maxFrameRate: 30,
                minBitRate: 1000000,
                maxBitRate: 4000000,
                referenceCount: 1,
                ownedByServer: true,
            },
        ],
        audio: [
            {
                audioStreamId: 2,
                streamUsage: 2,
                audioCodec: 0,
                channelCount: 2,
                sampleRate: 48000,
                bitRate: 64000,
                bitDepth: 16,
                referenceCount: 1,
                ownedByServer: false,
            },
        ],
        snapshot: [
            {
                snapshotStreamId: 3,
                imageCodec: 0,
                resolution: { width: 1920, height: 1080 },
                referenceCount: 0,
                ownedByServer: true,
            },
        ],
    },
};

const START_STREAM: StartStreamResult = {
    webRtcSessionId: 7,
    mode: "provide_offer",
    video: {
        streamId: 1,
        envelope: {
            codec: 0,
            minResolution: { width: 640, height: 360 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 1000000,
            maxBitRate: 4000000,
            keyFrameInterval: 4000,
        },
        reused: true,
        allocatedByUs: true,
        degraded: true,
    },
    audio: {
        streamId: 2,
        envelope: { codec: 0, channelCount: 2, sampleRate: 48000, bitRate: 64000, bitDepth: 16 },
        reused: false,
        allocatedByUs: true,
    },
};

const SNAPSHOT: SnapshotResult = {
    data: Uint8Array.of(1, 2, 3),
    imageCodec: 0,
    resolution: { width: 1920, height: 1080 },
    downgraded: true,
};

/** Every error payload the camera commands can produce, with every optional field present. */
function errorPayloads(): unknown[] {
    return [
        ServerError.cameraStreamIncompatible({
            reason: "bounds",
            device: ["H264"],
            requested: ["H265"],
            bound: { field: "min_resolution", requested: "1920x1080", limit: "1280x720" },
            deviceStatus: 0x87,
        }),
        ServerError.cameraResourceExhausted({
            allocated: [{ kind: "video", streamId: 1, referenceCount: 1 }],
            maxConcurrentEncoders: 1,
            maxEncodedPixelRate: 248832000,
        }),
        ServerError.cameraStreamInUse({ streamId: 1, referenceCount: 1 }),
        ServerError.cameraStreamNotOwned({ streamId: 1 }),
        ServerError.cameraNotSupported({ missingClusters: [1362] }),
    ].map(error => JSON.parse(error.message));
}

/**
 * Where a `camera_get_capabilities` value goes when a client sends it straight back.
 *
 * The round trip is claimed in four documents. Here it is asserted against the real emitter and the
 * real parser, so a reported key that no hint accepts cannot keep the claim alive.
 */
const CAPABILITY_TO_HINT = [
    { capability: "video.codecs", hint: "video.codecs" },
    { capability: "audio.codecs", hint: "audio.codecs" },
    { capability: "audio.channels", hint: "audio.channel_count" },
    { capability: "audio.sample_rates", hint: "audio.sample_rate" },
    { capability: "limits.supported_stream_usages", hint: "stream_usage" },
    { capability: "snapshot.capabilities[].image_codec", hint: "camera_snapshot.codec" },
];

/**
 * Reported keys that feed no hint, each with the reason. A new key on `camera_get_capabilities`
 * fails the totality check below until it is either mapped or listed here.
 */
const CAPABILITY_WITHOUT_HINT: Record<string, string> = {
    "video.sensor": "sensor size; a caller states a resolution range instead",
    "video.min_viewport": "the floor the server derives from; not a caller value",
    "video.max_fps": "read as a ceiling for max_frame_rate, not sent back verbatim",
    "video.max_hdr_fps": "as max_fps",
    "video.hdr_capable": "a fact about the camera, nothing to request",
    "video.rate_distortion_points": "the codec/resolution/bit-rate table the envelope is computed from",
    "audio.bit_depths": "AudioStreamAllocate takes a bit depth the device picks; there is no hint",
    "audio.two_way_talk_support": "talkback is asked for in the SDP offer, not by a hint",
    "snapshot.capabilities": "the list itself; its image_codec is the part that round-trips",
    "limits.max_encoded_pixel_rate": "a camera-wide budget, not a per-request value",
    "limits.max_concurrent_encoders": "as max_encoded_pixel_rate",
    "limits.max_network_bandwidth": "the ceiling the server caps max_bit_rate at",
    "limits.stream_usage_priorities": "the camera's own ordering, not a value to request",
    "allocated.video": "what is on the camera now; camera_release_stream takes its ids",
    "allocated.audio": "as allocated.video",
    "allocated.snapshot": "as allocated.video",
};

/**
 * Every value `bound.field` (error 102) can take, tied to {@link VideoSelection} and
 * {@link AudioSelection} so a field added to either union without being listed here does not compile.
 */
type VideoBoundField = Extract<VideoSelection, { unsatisfiable: "bounds" }>["field"];
type AudioBoundField = Extract<AudioSelection, { unsatisfiable: "bounds" }>["field"];

const BOUND_FIELD_SET: Record<VideoBoundField | AudioBoundField, true> = {
    min_resolution: true,
    min_frame_rate: true,
    min_bit_rate: true,
    sample_rate: true,
    channel_count: true,
};

const BOUND_FIELDS: readonly string[] = Object.keys(BOUND_FIELD_SET);

describe("camera wire contract", () => {
    const wireDoc = section("docs/websockets_api.md", "### Camera Streaming");
    const errorDoc = section("docs/websockets_api.md", "## Error Codes");
    const readme = section("packages/ws-client/README.md", "## Camera Streaming");

    describe("every emitted key is in the client-facing reference", () => {
        const emitted = new Set<string>();
        keysOf(toWireCapabilities(CAPABILITIES), emitted);
        keysOf(toWireStartStreamResult(START_STREAM), emitted);
        keysOf(toWireSnapshotResult(SNAPSHOT), emitted);
        const errorKeys = new Set<string>();
        for (const payload of errorPayloads()) keysOf(payload, errorKeys);

        it("docs/websockets_api.md names every key the camera commands answer with", () => {
            const documented = tokens(wireDoc);
            const missing = [...emitted].filter(key => !documented.has(key)).sort();
            expect(missing).to.deep.equal([]);
        });

        it("the ws-client README names every key the camera commands answer with", () => {
            const documented = tokens(readme);
            const missing = [...emitted].filter(key => !documented.has(key)).sort();
            expect(missing).to.deep.equal([]);
        });

        it("the error-code table names every key the camera error details carry", () => {
            const documented = tokens(errorDoc);
            const missing = [...errorKeys].filter(key => !documented.has(key)).sort();
            expect(missing).to.deep.equal([]);
        });

        it("both references name every hint key the parser accepts", () => {
            const hints = [...VIDEO_HINT_KEYS, ...AUDIO_HINT_KEYS];
            const inWireDoc = tokens(wireDoc);
            const inReadme = tokens(readme);
            expect(hints.filter(key => !inWireDoc.has(key))).to.deep.equal([]);
            expect(hints.filter(key => !inReadme.has(key))).to.deep.equal([]);
        });

        // README coverage is not asserted here: every one of these values is also a VIDEO_HINT_KEYS or
        // AUDIO_HINT_KEYS entry, and "both references name every hint key the parser accepts" above
        // already covers the README, so a second README check on the same strings would always pass.
        it("the error-code table names every value bound.field can take", () => {
            const inErrorDoc = tokens(errorDoc);
            expect(BOUND_FIELDS.filter(field => !inErrorDoc.has(field))).to.deep.equal([]);
        });
    });

    describe("capabilities round-trip into hints", () => {
        const wire = toWireCapabilities(CAPABILITIES);

        // `Internal` is the one reported usage the command refuses: it marks a stream the device
        // keeps for itself, and modifying one is not the caller's to ask for.
        const requestableUsage = wire.limits.supported_stream_usages.filter(name => name !== "Internal")[0];

        it("accepts what camera_get_capabilities reports, in the same spelling", () => {
            const parsed = parseStartStreamArgs({
                node_id: 1,
                endpoint_id: 1,
                stream_usage: requestableUsage,
                video: { codecs: wire.video.codecs },
                audio: {
                    codecs: wire.audio.codecs,
                    channel_count: wire.audio.channels,
                    sample_rate: wire.audio.sample_rates[0],
                },
            });
            expect(parsed.video).to.deep.equal({ codecs: wire.video.codecs });
            expect(parsed.audio).to.deep.equal({
                codecs: wire.audio.codecs,
                channelCount: wire.audio.channels,
                sampleRate: wire.audio.sample_rates[0],
            });
            const snapshot = parseSnapshotArgs({
                node_id: 1,
                endpoint_id: 1,
                codec: wire.snapshot.capabilities[0].image_codec,
            });
            expect(snapshot.codec).to.equal(CAPABILITIES.snapshot.capabilities[0].imageCodec);
        });

        it("refuses the one reported stream usage that is the device's own", () => {
            expect(wire.limits.supported_stream_usages).to.contain("Internal");
            expect(() => parseStartStreamArgs({ node_id: 1, endpoint_id: 1, stream_usage: "Internal" })).to.throw(
                /device-only stream_usage/,
            );
        });

        it("accounts for every reported key, as a hint or as a stated reason for having none", () => {
            const reported = new Array<string>();
            for (const [group, value] of Object.entries(wire)) {
                for (const key of Object.keys(value as Record<string, unknown>)) reported.push(`${group}.${key}`);
            }
            reported.push("snapshot.capabilities[].image_codec");
            const mapped = new Set(CAPABILITY_TO_HINT.map(entry => entry.capability));
            const unaccounted = reported
                .filter(path => !mapped.has(path) && CAPABILITY_WITHOUT_HINT[path] === undefined)
                .sort();
            expect(unaccounted).to.deep.equal([]);
        });

        it("names a hint key the parser takes for every mapped capability", () => {
            for (const { hint } of CAPABILITY_TO_HINT) {
                const [object, key] = hint.split(".");
                // A hint with no dot (e.g. "stream_usage") names a top-level camera_start_stream
                // argument rather than a key under a video/audio hint object.
                if (key === undefined) expect(START_STREAM_ARG_KEYS).to.contain(object);
                else if (object === "video") expect(VIDEO_HINT_KEYS).to.contain(key);
                else if (object === "audio") expect(AUDIO_HINT_KEYS).to.contain(key);
                else if (object === "camera_snapshot") expect(SNAPSHOT_ARG_KEYS).to.contain(key);
                else throw new Error(`CAPABILITY_TO_HINT hint "${hint}" names an object this test does not check`);
            }
        });
    });

    describe("hint keys the server does not know", () => {
        it("refuses an unknown video key rather than ignoring it", () => {
            expect(() =>
                parseStartStreamArgs({
                    node_id: 1,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { resolution: { width: 1920, height: 1080 } },
                }),
            ).to.throw(/unknown video hint key: resolution/);
        });

        it("refuses an audio range key, which audio has none of", () => {
            expect(() =>
                parseStartStreamArgs({
                    node_id: 1,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    audio: { min_bit_rate: 128000 },
                }),
            ).to.throw(/unknown audio hint key: min_bit_rate/);
        });

        it("refuses an unknown camera_snapshot argument", () => {
            const args = { node_id: 1, endpoint_id: 1, image_codec: "JPEG" };
            expect(() => parseSnapshotArgs(args)).to.throw(/unknown camera_snapshot argument key: image_codec/);
        });
    });
});
