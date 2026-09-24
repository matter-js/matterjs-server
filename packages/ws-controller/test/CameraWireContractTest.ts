/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CameraCommandName } from "../src/camera/cameraCommands.js";
import {
    AUDIO_HINT_KEYS,
    CAMERA_ARG_KEYS,
    parseCapabilitiesArgs,
    parseReleaseStreamArgs,
    parseSnapshotArgs,
    parseStartStreamArgs,
    parseStopStreamArgs,
    toWireCapabilities,
    toWireSnapshotResult,
    toWireStartStreamResult,
    VIDEO_HINT_KEYS,
} from "../src/camera/cameraCommands.js";
import { CAMERA_FIELD_RANGES, ICE_SERVER_LIMITS } from "../src/camera/cameraFieldRanges.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "../src/camera/CameraStreamManager.js";
import type { AudioSelection, VideoSelection } from "../src/camera/streamPolicy.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

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
                minResolution: { width: 640, height: 480 },
                maxResolution: { width: 1920, height: 1080 },
                referenceCount: 0,
                hardwareEncoder: false,
                ownedByServer: true,
            },
        ],
    },
    sessions: [
        {
            webRtcSessionId: 4,
            peerNodeId: NodeId(5n),
            peerEndpointId: EndpointNumber(1),
            streamUsage: 2,
            videoStreamIds: [1],
            audioStreamIds: [2],
            establishedByThisServer: true,
        },
    ],
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
    snapshotStreamId: 8,
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
        ServerError.cameraStreamIncompatible({
            reason: "capability",
            track: "audio",
            device: new Array<string>(),
            requested: new Array<string>(),
        }),
        ServerError.cameraResourceExhausted({
            allocated: [{ kind: "video", streamId: 1, referenceCount: 1 }],
            maxConcurrentEncoders: 1,
            maxEncodedPixelRate: 248832000,
        }),
        ServerError.cameraStreamInUse({ streamId: 1, referenceCount: 1 }),
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
    sessions: "the camera's current sessions; camera_stop_stream takes their ids",
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

/**
 * Every bound the camera commands refuse a value for, spelled as both references spell it.
 *
 * The numbers are read from the tables the parsers check against, so a bound a spec revision moves
 * fails here until both documents follow it. The floor of 1 on the ICE strings is written out
 * because it is `toBoundedString`'s rule rather than a constraint the model states; the documents
 * say so too.
 *
 * Presence in the section is all this proves. A bound stated against the wrong field still passes,
 * and a bound a document states that nothing enforces is invisible here.
 */
function boundPhrases(): string[] {
    const phrases = Object.values(CAMERA_FIELD_RANGES).map(range => `${range.min} to ${range.max}`);
    phrases.push(
        `0 to ${ICE_SERVER_LIMITS.maxServers}`,
        `1 to ${ICE_SERVER_LIMITS.maxTransportPolicyLength}`,
        `1 to ${ICE_SERVER_LIMITS.maxUrls}`,
        `1 to ${ICE_SERVER_LIMITS.maxUrlLength}`,
        `1 to ${ICE_SERVER_LIMITS.maxUsernameLength}`,
        `1 to ${ICE_SERVER_LIMITS.maxCredentialLength}`,
        `${ICE_SERVER_LIMITS.caid.min} to ${ICE_SERVER_LIMITS.caid.max}`,
    );
    return [...new Set(phrases)];
}

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

        it("both references spell out every bound the camera commands enforce", () => {
            const bounds = boundPhrases();
            expect(bounds.filter(phrase => !wireDoc.includes(phrase))).to.deep.equal([]);
            expect(bounds.filter(phrase => !readme.includes(phrase))).to.deep.equal([]);
        });

        it("both references name every hint key the parser accepts", () => {
            const hints = [...VIDEO_HINT_KEYS, ...AUDIO_HINT_KEYS, ...Object.values(CAMERA_ARG_KEYS).flat()];
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

        it("reports each audio capability under its own wire key", () => {
            // Every field below is fed straight back into a camera_start_stream hint, so a key wired
            // to the wrong source list is accepted by the parser and mis-allocates the stream.
            expect(wire.audio.codecs).to.deep.equal(["OPUS"]);
            expect(wire.audio.channels).to.equal(2);
            expect(wire.audio.sample_rates).to.deep.equal([48000, 16000]);
            expect(wire.audio.bit_depths).to.deep.equal([16]);
            expect(wire.audio.two_way_talk_support).to.equal("NotSupported");
        });

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
            // channelCount and sampleRate name the capabilities the wire form was built from: the
            // same wire expression on both sides would hold whatever the mapping puts there.
            expect(parsed.audio).to.deep.equal({
                codecs: wire.audio.codecs,
                channelCount: CAPABILITIES.audio.channels,
                sampleRate: CAPABILITIES.audio.sampleRates[0],
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
                // A list group's own keys are indices, so it is accounted for as a whole.
                if (Array.isArray(value)) {
                    reported.push(group);
                    continue;
                }
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
                if (key === undefined) expect(CAMERA_ARG_KEYS.camera_start_stream).to.contain(object);
                else if (object === "video") expect(VIDEO_HINT_KEYS).to.contain(key);
                else if (object === "audio") expect(AUDIO_HINT_KEYS).to.contain(key);
                else if (object === "camera_snapshot") expect(CAMERA_ARG_KEYS.camera_snapshot).to.contain(key);
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

        it("refuses a hint sent at the wrong nesting level", () => {
            const args = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView", max_frame_rate: 15 };
            expect(() => parseStartStreamArgs(args)).to.throw(
                /unknown camera_start_stream argument key: max_frame_rate/,
            );
        });

        it("refuses an unknown key inside a resolution, which states a bound as surely as a hint does", () => {
            expect(() =>
                parseStartStreamArgs({
                    node_id: 1,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { max_resolution: { width: 1920, height: 1080, frame_rate: 30 } },
                }),
            ).to.throw("unknown video.max_resolution key: frame_rate");
            expect(() =>
                parseSnapshotArgs({
                    node_id: 1,
                    endpoint_id: 1,
                    max_resolution: { width: 1280, height: 720, codec: "JPEG" },
                }),
            ).to.throw("unknown max_resolution key: codec");
        });

        it("refuses an unknown camera_snapshot argument", () => {
            const args = { node_id: 1, endpoint_id: 1, image_codec: "JPEG" };
            expect(() => parseSnapshotArgs(args)).to.throw(/unknown camera_snapshot argument key: image_codec/);
        });

        it("refuses an unknown argument on every camera command", () => {
            // `accepted` is written out rather than read from CAMERA_ARG_KEYS: the table is what is
            // under test, so asserting it against itself would pass for a route wired to another
            // command's set, which refuses the unknown key below and takes that command's arguments.
            const routes: {
                command: CameraCommandName;
                parse: (args: Record<string, unknown>) => unknown;
                args: Record<string, unknown>;
                accepted: string[];
            }[] = [
                {
                    command: "camera_get_capabilities",
                    parse: parseCapabilitiesArgs,
                    args: {},
                    accepted: ["node_id", "endpoint_id"],
                },
                {
                    command: "camera_start_stream",
                    parse: parseStartStreamArgs,
                    args: { stream_usage: "LiveView" },
                    accepted: [
                        "node_id",
                        "endpoint_id",
                        "stream_usage",
                        "sdp",
                        "video",
                        "audio",
                        "ice_servers",
                        "ice_transport_policy",
                        "metadata_enabled",
                    ],
                },
                {
                    command: "camera_stop_stream",
                    parse: parseStopStreamArgs,
                    args: { webrtc_session_id: 1 },
                    accepted: ["node_id", "endpoint_id", "webrtc_session_id"],
                },
                {
                    command: "camera_snapshot",
                    parse: parseSnapshotArgs,
                    args: {},
                    accepted: ["node_id", "endpoint_id", "max_resolution", "codec"],
                },
                {
                    command: "camera_release_stream",
                    parse: parseReleaseStreamArgs,
                    args: { kind: "video", stream_id: 1 },
                    accepted: ["node_id", "endpoint_id", "kind", "stream_id"],
                },
            ];
            for (const { command, parse, args, accepted: expected } of routes) {
                const valid = { node_id: 1, endpoint_id: 1, ...args };
                // Parses without the extra key, so the refusal below is the key and not the payload.
                parse(valid);
                // The route is named in the asserted value, so a route that accepts the key is
                // identified by the failure rather than reported as "expected to throw".
                let refusal = `${command} accepted an unknown argument key`;
                let code: number | undefined;
                try {
                    parse({ ...valid, node_ids: 1 });
                } catch (error) {
                    if (error instanceof ServerError) {
                        refusal = error.message;
                        code = error.code;
                    } else {
                        refusal = String(error);
                    }
                }
                expect(refusal).to.match(new RegExp(`^unknown ${command} argument key: node_ids\\.`));
                expect(code, command).to.equal(ServerErrorCode.InvalidArguments);
                // The keys the refusal lists are the ones this command takes and no others, so a
                // route wired to another command's set — which would still refuse `node_ids` — fails
                // here instead of quietly accepting that command's arguments.
                const accepted = refusal.slice(refusal.indexOf("Accepted: ") + "Accepted: ".length).split(", ");
                expect(accepted, command).to.deep.equal(expected);
                // What the wire model ties to the command, so a key added there and left out of the
                // spelled list fails here too rather than being refused although the model states it.
                expect([...CAMERA_ARG_KEYS[command]], command).to.deep.equal(expected);
            }
        });
    });
});
