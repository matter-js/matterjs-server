/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, Logger, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import { Status, StatusResponseError, StreamUsage } from "@matter/main/types";
import type { CameraDeviceIo, CameraState } from "../src/camera/CameraStreamManager.js";
import {
    CameraStreamManager,
    MAX_ALLOCATE_ATTEMPTS,
    preferredVideoCodec,
    UNREPORTED_LEASE_GRACE_MS,
} from "../src/camera/CameraStreamManager.js";
import type {
    AudioEnvelope,
    CameraFeatures,
    CameraSessionEnded,
    CameraStreamEvicted,
    DeviceWebRtcSession,
    Resolution,
    VideoEnvelope,
} from "../src/camera/cameraTypes.js";
import { deviceStatusOf } from "../src/camera/deviceStatus.js";
import type { OverlayBounds } from "../src/camera/overlayPolicy.js";
import { videoCodecLimits } from "../src/camera/sdpConstraints.js";
import type { SdpVideoConstraints } from "../src/camera/sdpConstraints.js";
import type { VideoHints } from "../src/camera/streamPolicy.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { DEVICE_CLEANUP_BUDGET_MS } from "../src/util/deviceCleanupBudget.js";
import { NO_OVERLAYS, cameraFeatures } from "./cameraFixtures.js";

/** ResolvedStream.envelope is a union; a result from resolveVideoStream is always the video shape. */
function requireVideoEnvelope(envelope: VideoEnvelope | AudioEnvelope): VideoEnvelope {
    if (!("minResolution" in envelope)) throw new Error("expected a video envelope");
    return envelope;
}

/** ResolvedStream.envelope is a union; a result from resolveAudioStream is always the audio shape. */
function requireAudioEnvelope(envelope: VideoEnvelope | AudioEnvelope): AudioEnvelope {
    if ("minResolution" in envelope) throw new Error("expected an audio envelope");
    return envelope;
}

/**
 * Allocate attempts a request makes before it reaches the eviction rung: the budgeted envelope plus
 * the narrowing rounds the ladder spends on this server's own defaults. A fake that refuses this many
 * is a camera short of capacity rather than one refusing a range.
 */
export const NARROWING_ATTEMPTS = 4;

export const NODE = NodeId(5);
export const ENDPOINT = EndpointNumber(1);
export const H265 = 1;
export const LIVE_VIEW = 3;

export const STATE: CameraState = {
    features: cameraFeatures("audio", "video", "snapshot", "highDynamicRange"),
    privacy: {},
    maxConcurrentEncoders: 1,
    maxEncodedPixelRate: 248832000,
    videoSensorParams: { sensorWidth: 2560, sensorHeight: 1440, maxFps: 30, maxHdrFps: 15, hdrCapable: true },
    minViewportResolution: { width: 640, height: 360 },
    rateDistortionTradeOffPoints: [{ codec: H265, resolution: { width: 1920, height: 1080 }, minBitRate: 800000 }],
    snapshotCapabilities: [
        {
            resolution: { width: 640, height: 480 },
            maxFrameRate: 1,
            imageCodec: 0,
            requiresEncodedPixels: false,
            requiresHardwareEncoder: false,
        },
        {
            resolution: { width: 1920, height: 1080 },
            maxFrameRate: 1,
            imageCodec: 0,
            requiresEncodedPixels: true,
            requiresHardwareEncoder: true,
        },
    ],
    supportedStreamUsages: [LIVE_VIEW, 1, 2],
    streamUsagePriorities: [LIVE_VIEW, 1, 2],
    allocatedVideoStreams: [],
    allocatedAudioStreams: [],
    allocatedSnapshotStreams: [],
    microphoneCapabilities: {
        supportedCodecs: [0],
        maxNumberOfChannels: 1,
        supportedSampleRates: [48000],
        supportedBitDepths: [16],
    },
    twoWayTalkSupport: 0,
};

/** A device rejection carrying a Matter status, as matter.js surfaces one. */
function statusError(status: number): Error & { code: number } {
    const error = new Error(`Device returned status ${status}`) as Error & { code: number };
    error.code = status;
    return error;
}

/**
 * A plain provide-offer: a live video section stating no codec, so it refuses nothing and narrows
 * nothing. What a test that only needs the server to be answering an offer passes.
 */
export const VIDEO_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "a=recvonly",
].join("\r\n");

/** {@link VIDEO_OFFER} with an audio section beside it, for the tests that ask for both tracks. */
export const VIDEO_AND_AUDIO_OFFER = [VIDEO_OFFER, "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=recvonly"].join("\r\n");

/** An offer whose audio m-line sends as well as receives, i.e. the caller wants talkback. */
export const TALKBACK_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "a=recvonly",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "a=sendrecv",
].join("\r\n");

/** An offer carrying audio and no video section at all, live and receiving. */
export const AUDIO_ONLY_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=recvonly",
].join("\r\n");

/** A re-offer that keeps audio and turns video off: the video section is present but rejected. */
export const VIDEO_REFUSED_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 0 UDP/TLS/RTP/SAVPF 96",
    "a=rtpmap:96 H265/90000",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "a=recvonly",
].join("\r\n");

/** The mirror image: audio refused, video live. */
export const AUDIO_REFUSED_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "a=rtpmap:96 H265/90000",
    "a=recvonly",
    "m=audio 0 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
].join("\r\n");

/** A live video section the peer will only send on, beside an audio section it will receive on. */
export const VIDEO_INACTIVE_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "a=rtpmap:96 H265/90000",
    "a=inactive",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "a=recvonly",
].join("\r\n");

/** Talkback without a return path: the peer asks to send audio and will not receive ours. */
export const AUDIO_SENDONLY_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "a=rtpmap:96 H265/90000",
    "a=recvonly",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "a=sendonly",
].join("\r\n");

export interface RecordedInvoke {
    command: string;
    fields: Record<string, unknown>;
    nodeId: NodeId;
    endpointId: EndpointNumber;
    /**
     * The manager's own id hook, for a test that needs to act in the window it opens: the real
     * provider path calls it with the answered id and then gives the session to the local requestor,
     * so a test that calls it and then ends the session is in that window and nowhere else.
     * Undefined for every command but `provideOffer` / `solicitOffer`.
     */
    sessionEstablishing?: (webRtcSessionId: number) => void;
}

/**
 * Call the manager's id hook as the real provider path does — after the response, before anything can
 * route an `End` for the id — so no test double can keep the pre-hook behaviour by accident.
 *
 * Calling it a second time states the same id, so a test that called it itself is not disturbed.
 */
function announceEstablishingSession(recorded: RecordedInvoke, response: unknown): void {
    if (recorded.command !== "provideOffer" && recorded.command !== "solicitOffer") return;
    if (typeof response !== "object" || response === null || !("webRtcSessionId" in response)) return;
    const { webRtcSessionId } = response;
    if (typeof webRtcSessionId === "number") recorded.sessionEstablishing?.(webRtcSessionId);
}

/**
 * A manager over a mutable state holder, recording every invoke so tests can assert on the wire
 * traffic. The holder lets a later test allocate a stream mid-test and have `readCameraState`
 * reflect it without rebuilding the fixture.
 */
export function managerWith(
    state: CameraState | undefined,
    respond: (invoke: RecordedInvoke) => Promise<unknown> = async () => undefined,
    missingClusters?: number[],
): {
    manager: CameraStreamManager;
    invokes: RecordedInvoke[];
    holder: { state: CameraState | undefined; sessions: DeviceWebRtcSession[] };
} {
    const invokes = new Array<RecordedInvoke>();
    const holder: { state: CameraState | undefined; sessions: DeviceWebRtcSession[] } = {
        state,
        sessions: new Array<DeviceWebRtcSession>(),
    };
    const io: CameraDeviceIo = {
        readCameraState: async () => holder.state,
        readWebRtcSessions: async () => holder.sessions,
        missingCameraClusters: async () =>
            missingClusters ??
            (holder.state === undefined
                ? [CameraAvStreamManagement.Cluster.id, WebRtcTransportProvider.Cluster.id]
                : new Array<number>()),
        invoke: async args => {
            const recorded = {
                command: args.command,
                fields: args.fields,
                nodeId: args.nodeId,
                endpointId: args.endpointId,
                sessionEstablishing: args.sessionEstablishing,
            };
            invokes.push(recorded);
            const response = await respond(recorded);
            announceEstablishingSession(recorded, response);
            return response;
        },
    };
    return { manager: new CameraStreamManager(io), invokes, holder };
}

/** Every session ending the manager announced, in order. */
function endingsOf(manager: CameraStreamManager): CameraSessionEnded[] {
    const seen = new Array<CameraSessionEnded>();
    manager.events.sessionEnded.on(ended => {
        seen.push(ended);
    });
    return seen;
}

/** `leasedEndpointCount` is a protected test hook; this exposes it. */
class LeaseProbe extends CameraStreamManager {
    get endpointsWithLeases(): number {
        return this.leasedEndpointCount;
    }
}

function probeWith(
    state: CameraState,
    respond: (invoke: RecordedInvoke) => Promise<unknown>,
): { manager: LeaseProbe; invokes: RecordedInvoke[]; holder: { state: CameraState } } {
    const invokes = new Array<RecordedInvoke>();
    const holder = { state };
    const io: CameraDeviceIo = {
        readCameraState: async () => holder.state,
        readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
        missingCameraClusters: async () => new Array<number>(),
        invoke: async args => {
            const recorded = {
                command: args.command,
                fields: args.fields,
                nodeId: args.nodeId,
                endpointId: args.endpointId,
                sessionEstablishing: args.sessionEstablishing,
            };
            invokes.push(recorded);
            const response = await respond(recorded);
            announceEstablishingSession(recorded, response);
            return response;
        },
    };
    return { manager: new LeaseProbe(io), invokes, holder };
}

describe("CameraStreamManager", () => {
    describe("getCapabilities", () => {
        it("reports the camera's own facts", async () => {
            const capabilities = await managerWith(STATE).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.video.sensor).to.deep.equal({ width: 2560, height: 1440 });
            expect(capabilities.video.minViewport).to.deep.equal({ width: 640, height: 360 });
            expect(capabilities.video.maxFps).to.equal(30);
            expect(capabilities.limits.maxConcurrentEncoders).to.equal(1);
            expect(capabilities.limits.maxEncodedPixelRate).to.equal(248832000);
        });

        it("reports the sessions the camera itself holds, whoever established them", async () => {
            const { manager, holder } = managerWith(STATE);
            holder.sessions = [
                {
                    webRtcSessionId: 7,
                    peerNodeId: NodeId(1),
                    peerEndpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    videoStreamIds: [9],
                    audioStreamIds: [],
                    establishedByThisServer: true,
                },
                {
                    webRtcSessionId: 8,
                    peerNodeId: NodeId(2),
                    peerEndpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    videoStreamIds: [9],
                    audioStreamIds: [],
                    establishedByThisServer: false,
                },
            ];

            const capabilities = await manager.getCapabilities(NODE, ENDPOINT);

            expect(capabilities.sessions.map(session => session.webRtcSessionId)).to.deep.equal([7, 8]);
            expect(capabilities.sessions.map(session => session.establishedByThisServer)).to.deep.equal([true, false]);
        });

        it("derives the codec list from the trade-off points", async () => {
            const capabilities = await managerWith(STATE).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.video.codecs).to.deep.equal([H265]);
        });

        it("reports an absent capability as absent rather than substituting a default", async () => {
            const bare: CameraState = {
                ...STATE,
                rateDistortionTradeOffPoints: [],
                minViewportResolution: undefined,
            };
            const capabilities = await managerWith(bare).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.video.rateDistortionPoints).to.deep.equal([]);
            expect(capabilities.video.minViewport).to.equal(undefined);
            expect(capabilities.video.codecs).to.deep.equal([]);
        });

        it("reports every snapshot capability, including whether it needs an encoder", async () => {
            const capabilities = await managerWith(STATE).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.snapshot.capabilities).to.have.length(2);
            expect(capabilities.snapshot.capabilities[1].requiresEncodedPixels).to.equal(true);
        });

        it("fails typed when the endpoint has no camera behaviour", async () => {
            let thrown: unknown;
            try {
                await managerWith(undefined).manager.getCapabilities(NODE, ENDPOINT);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.be.instanceOf(ServerError);
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraNotSupported);
        });

        it("reports a stream we did not allocate as not owned by the server", async () => {
            const allocated: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 2,
                    },
                ],
            };
            const capabilities = await managerWith(allocated).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.allocated.video[0].referenceCount).to.equal(2);
            expect(capabilities.allocated.video[0].allocatedByServer).to.equal(false);
            expect(capabilities.allocated.video[0].minBitRate).to.equal(800000);
            expect(capabilities.allocated.video[0].maxBitRate).to.equal(4000000);
        });

        it("reports a stream the server allocated itself as owned by the server", async () => {
            const { manager, holder } = managerWith({ ...STATE, allocatedVideoStreams: [] }, async invoke =>
                invoke.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined,
            );
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });

            holder.state = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 9,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 0,
                    },
                ],
            };
            const capabilities = await manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.allocated.video[0].allocatedByServer).to.equal(true);
        });

        it("reads state without invoking anything on the device", async () => {
            const { manager, invokes } = managerWith(STATE);
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(invokes).to.deep.equal([]);
        });
    });

    describe("resolveVideoStream", () => {
        function withStreams(streams: CameraState["allocatedVideoStreams"]): CameraState {
            return { ...STATE, allocatedVideoStreams: streams };
        }

        const CONTAINED_STREAM = {
            videoStreamId: 7,
            overlays: NO_OVERLAYS,
            streamUsage: LIVE_VIEW,
            videoCodec: H265,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            referenceCount: 1,
        };

        const PINNED_1080P = {
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
        };

        it("reuses a contained stream without invoking anything", async () => {
            const { manager, invokes } = managerWith(withStreams([CONTAINED_STREAM]));
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.reused).to.equal(true);
            expect(resolved.allocatedByUs).to.equal(false);
            expect(invokes).to.deep.equal([]);
        });

        it("reports the reused stream's own bounds, not the wider envelope the request computed", async () => {
            // No hints: the computed envelope spans the device's full range (640x360..2560x1440),
            // but CONTAINED_STREAM's own range is the fixed 1920x1080 the client actually gets.
            const { manager } = managerWith(withStreams([CONTAINED_STREAM]));
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.reused).to.equal(true);
            const envelope = requireVideoEnvelope(resolved.envelope);
            expect(envelope.minResolution).to.deep.equal(CONTAINED_STREAM.minResolution);
            expect(envelope.maxResolution).to.deep.equal(CONTAINED_STREAM.maxResolution);
        });

        it("does not reuse a stream whose floor is below the requested floor", async () => {
            // Issue #1056: [720p..1080p] may deliver 720p, so a 1080p floor is not satisfied.
            const wider = { ...CONTAINED_STREAM, minResolution: { width: 1280, height: 720 } };
            const { manager, invokes } = managerWith(withStreams([wider]), async () => ({ videoStreamId: 9 }));
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(9);
            expect(resolved.reused).to.equal(false);
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamAllocate"]);
        });

        it("records a newly allocated stream as owned by the server", async () => {
            const { manager } = managerWith(STATE, async () => ({ videoStreamId: 9 }));
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.allocatedByUs).to.equal(true);
        });

        it("fails typed when the caller's resolution floor exceeds what the camera can deliver", async () => {
            // Clamping the floor down to the sensor reports success while delivering less than the
            // caller stated it needs, which is the same silent substitution reuse containment forbids.
            const { manager, invokes } = managerWith(STATE, async () => ({ videoStreamId: 9 }));
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: { minResolution: { width: 3840, height: 2160 } },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.reason).to.equal("bounds");
            // Which bound failed, and against what: `device`/`requested` stay the codec vocabulary
            // every other 102 uses, so a client can read both without guessing which one it got.
            expect(payload.bound).to.deep.equal({
                field: "min_resolution",
                requested: "3840x2160",
                limit: "2560x1440",
            });
            expect(payload.device).to.deep.equal(["H265"]);
            expect(invokes).to.deep.equal([]);
        });

        it("takes the bit-rate ceiling from the camera's MaxNetworkBandwidth", async () => {
            const throttled: CameraState = { ...STATE, maxNetworkBandwidth: 2000000 };
            const { manager, invokes } = managerWith(throttled, async () => ({ videoStreamId: 9 }));
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            const allocate = invokes.find(invoke => invoke.command === "videoStreamAllocate");
            expect(allocate?.fields.maxBitRate).to.equal(2000000);
        });

        it("narrows the envelope and retries when the device rejects the parameters", async () => {
            let attempt = 0;
            const { manager, invokes } = managerWith(STATE, async () => {
                attempt += 1;
                if (attempt === 1) throw statusError(Status.DynamicConstraintError);
                return { videoStreamId: 9 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(9);
            expect(invokes).to.have.length(2);
            const first = invokes[0].fields.maxResolution as { width: number };
            const second = invokes[1].fields.maxResolution as { width: number };
            expect(second.width).to.be.lessThan(first.width);
        });

        it("fails immediately when the device calls the request structurally invalid", async () => {
            // ConstraintError (0x87) is min > max, a field out of range or an unknown codec. Narrowing
            // cannot make any of those valid, so the ladder must not spend its rounds on them.
            const { manager, invokes } = managerWith(STATE, async () => {
                throw statusError(Status.ConstraintError);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.device_status).to.equal(Status.ConstraintError);
            expect(payload.device).to.deep.equal(["H265"]);
            expect(invokes).to.have.length(1);
        });

        it("fails typed once narrowing is exhausted and the device still cannot serve the range", async () => {
            const { manager, invokes } = managerWith(STATE, async () => {
                throw statusError(Status.DynamicConstraintError);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.reason).to.equal("bounds");
            expect(payload.device_status).to.equal(Status.DynamicConstraintError);
            expect(payload.device).to.deep.equal(["H265"]);
            expect(invokes.length).to.be.greaterThan(1);
        });

        it("propagates a device rejection the ladder does not know how to react to", async () => {
            const UNSUPPORTED = 0x81; // INVALID_ACTION, arbitrary and not one the ladder special-cases.
            const { manager, invokes } = managerWith(STATE, async () => {
                throw statusError(UNSUPPORTED);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as { code: number }).code).to.equal(UNSUPPORTED);
            expect(invokes).to.have.length(1);
        });

        it("never hands out a stream of another usage, however little capacity the camera has", async () => {
            // stream_usage is the only mandatory argument. A LiveView caller given a Recording stream
            // has had the one thing it must state substituted, and no rung is allowed to do that.
            const otherUsage = { ...CONTAINED_STREAM, streamUsage: 1, referenceCount: 1 };
            const { manager } = managerWith(withStreams([otherUsage]), async () => {
                throw statusError(Status.ResourceExhausted);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: PINNED_1080P,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
        });

        it("hands out a stream outside the computed bit-rate range as degraded, not as a clean reuse", async () => {
            // The camera's own trade-off point puts 1080p at 800 kbit/s, so a stream capped at
            // 200 kbit/s delivers less than this server would have allocated. The caller stated no
            // bit rate, so it is the server's bound being given up — which is what degraded reports.
            const starved = { ...CONTAINED_STREAM, minBitRate: 100000, maxBitRate: 200000 };
            const { manager } = managerWith(withStreams([starved]), async () => {
                throw statusError(Status.ResourceExhausted);
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
        });

        it("refuses a stream whose bit-rate ceiling is above the one the caller stated", async () => {
            // Reported back as reused with bit_rate.max far above the ceiling, this was a stream the
            // caller had said it could not carry.
            const loud = { ...CONTAINED_STREAM, maxBitRate: 8000000 };
            const { manager, invokes } = managerWith(withStreams([loud]), async () => ({ videoStreamId: 9 }));
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { ...PINNED_1080P, maxBitRate: 500000 },
            });
            expect(resolved.streamId).to.equal(9);
            expect(resolved.reused).to.equal(false);
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamAllocate"]);
        });

        it("deallocates an unreferenced stream and retries rather than failing", async () => {
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command === "videoStreamAllocate") {
                    allocateAttempts += 1;
                    // Refuses every narrowing too, so the request reaches the eviction rung: a camera
                    // short of capacity is not served by a smaller envelope.
                    if (allocateAttempts <= NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(11);
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
            // The freed capacity went into stream 11, so there is nothing to put back.
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(
                NARROWING_ATTEMPTS + 1,
            );
        });

        it("frees a snapshot stream it allocated itself when that is the only capacity left", async () => {
            // Round 13 made every snapshot stream outlive its call, so on single-encoder hardware a
            // client's own snapshot poll blocked its own stream start and only camera_release_stream
            // could clear it.
            const encoderHolder = {
                snapshotStreamId: 5,
                overlays: NO_OVERLAYS,
                imageCodec: 0,
                minResolution: { width: 1920, height: 1080 },
                maxResolution: { width: 1920, height: 1080 },
                referenceCount: 0,
                frameRate: 1,
                encodedPixels: true,
                hardwareEncoder: true,
            };
            let snapshotStreamLive = false;
            const { manager, invokes, holder } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") {
                    snapshotStreamLive = true;
                    return { snapshotStreamId: 5 };
                }
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                if (invoke.command === "snapshotStreamDeallocate") {
                    snapshotStreamLive = false;
                    return undefined;
                }
                if (invoke.command === "videoStreamAllocate") {
                    // The camera's last encoder is the snapshot stream's while it exists.
                    if (snapshotStreamLive) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            const evicted = new Array<CameraStreamEvicted>();
            manager.events.streamEvicted.on(taken => {
                evicted.push(taken);
            });

            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, allocatedSnapshotStreams: [encoderHolder] };

            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });

            expect(resolved.streamId).to.equal(11);
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([5]);
            // Nothing is put back: the next camera_snapshot allocates one from the camera's own
            // capabilities, and a replacement here would re-take the encoder this request needed.
            expect(invokes.filter(invoke => invoke.command === "snapshotStreamAllocate")).to.have.length(1);
            expect(evicted).to.deep.equal([{ nodeId: NODE, endpointId: ENDPOINT, kind: "snapshot", streamId: 5 }]);
            // The id is not a video stream id, so it stays out of the field that names those.
            expect(resolved.evicted).to.equal(undefined);
        });

        it("puts the pixel rate a freed snapshot stream held back into the envelope", async () => {
            // The sensor frame at 30 fps is 110.6 Mpx/s. The snapshot stream reserves 62.2 of it,
            // leaving 48.4, which carries that frame at 13 fps; the request that freed it must get the
            // whole budget back rather than the envelope the shortage produced.
            const BUDGET = 110592000;
            const snapshotHolder = {
                snapshotStreamId: 5,
                overlays: NO_OVERLAYS,
                imageCodec: 0,
                minResolution: { width: 1920, height: 1080 },
                maxResolution: { width: 1920, height: 1080 },
                referenceCount: 0,
                frameRate: 30,
                encodedPixels: true,
                hardwareEncoder: false,
            };
            let snapshotStreamLive = false;
            const { manager, invokes, holder } = managerWith(
                { ...STATE, maxEncodedPixelRate: BUDGET },
                async invoke => {
                    if (invoke.command === "snapshotStreamAllocate") {
                        snapshotStreamLive = true;
                        return { snapshotStreamId: 5 };
                    }
                    if (invoke.command === "captureSnapshot") {
                        return {
                            data: new Uint8Array([1]),
                            imageCodec: 0,
                            resolution: { width: 1920, height: 1080 },
                        };
                    }
                    if (invoke.command === "snapshotStreamDeallocate") {
                        snapshotStreamLive = false;
                        return undefined;
                    }
                    if (invoke.command === "videoStreamAllocate") {
                        if (snapshotStreamLive) throw statusError(Status.ResourceExhausted);
                        return { videoStreamId: 11 };
                    }
                    return undefined;
                },
            );
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, maxEncodedPixelRate: BUDGET, allocatedSnapshotStreams: [snapshotHolder] };

            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxFrameRate: 30, minResolution: { width: 2560, height: 1440 } },
            });

            expect(resolved.streamId).to.equal(11);
            expect(requireVideoEnvelope(resolved.envelope).maxFrameRate).to.equal(30);
            const allocates = invokes.filter(invoke => invoke.command === "videoStreamAllocate");
            expect(allocates[0]?.fields.maxFrameRate).to.equal(13);
            expect(allocates[allocates.length - 1]?.fields.maxFrameRate).to.equal(30);
        });

        /** A snapshot stream of our own, as the camera reports one it allocated at 1920x1080. */
        const SNAPSHOT_HOLDER = {
            snapshotStreamId: 5,
            overlays: NO_OVERLAYS,
            imageCodec: 0,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            referenceCount: 0,
            frameRate: 1,
            encodedPixels: true,
            hardwareEncoder: true,
        };

        /**
         * A camera that answers a snapshot allocate and capture, refuses every video allocate while the
         * snapshot stream exists, and answers `respond` first for anything a test wants to override.
         */
        function cameraShortOfEncoders(respond: (invoke: RecordedInvoke) => unknown = () => undefined) {
            let snapshotStreamLive = false;
            const built = managerWith(STATE, async invoke => {
                const overridden = respond(invoke);
                if (overridden !== undefined) return overridden;
                if (invoke.command === "snapshotStreamAllocate") {
                    snapshotStreamLive = true;
                    return { snapshotStreamId: 5 };
                }
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                if (invoke.command === "snapshotStreamDeallocate") {
                    snapshotStreamLive = false;
                    return undefined;
                }
                if (invoke.command === "videoStreamAllocate") {
                    if (snapshotStreamLive) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            return built;
        }

        const videoRequest = { nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, limits: { codec: H265 } };

        it("takes its own snapshot stream before a video stream anyone else allocated", async () => {
            // The ordering is the whole point: a foreign video stream nothing references is a legitimate
            // victim, and taking it while a snapshot stream of ours holds the encoder is the unkind order.
            // A different codec keeps it out of the reuse and degraded rungs, so the ladder reaches the
            // make-room step with both candidates available.
            const foreignIdle = { ...CONTAINED_STREAM, videoStreamId: 21, videoCodec: 2, referenceCount: 0 };
            const { manager, invokes, holder } = cameraShortOfEncoders();
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = {
                ...STATE,
                allocatedVideoStreams: [foreignIdle],
                allocatedSnapshotStreams: [SNAPSHOT_HOLDER],
            };

            const resolved = await manager.resolveVideoStream(videoRequest);

            expect(resolved.streamId).to.equal(11);
            expect(
                invokes
                    .map(invoke => invoke.command)
                    .filter(command => command === "snapshotStreamDeallocate" || command === "videoStreamDeallocate"),
            ).to.deep.equal(["snapshotStreamDeallocate"]);
        });

        it("takes a snapshot stream of its own the camera has not reported yet", async () => {
            // The sequence the rung exists for is a camera_snapshot followed straight away by a
            // camera_start_stream, and AllocatedSnapshotStreams lags it. Reading the reported view alone
            // left the request failing with 103 while the stream blocking it was this server's own.
            const { manager, invokes } = cameraShortOfEncoders();
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            // holder.state is deliberately not updated: the camera has reported nothing.

            const resolved = await manager.resolveVideoStream(videoRequest);

            expect(resolved.streamId).to.equal(11);
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([5]);
        });

        it("sends one deallocate for a snapshot stream the camera refuses to free, and moves on", async () => {
            const foreignIdle = { ...CONTAINED_STREAM, videoStreamId: 21, videoCodec: 2, referenceCount: 0 };
            const { manager, invokes, holder } = cameraShortOfEncoders(invoke => {
                if (invoke.command === "snapshotStreamDeallocate") throw statusError(Status.Busy);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = {
                ...STATE,
                allocatedVideoStreams: [foreignIdle],
                allocatedSnapshotStreams: [SNAPSHOT_HOLDER],
            };

            await manager.resolveVideoStream(videoRequest).catch(() => undefined);

            // A refusal it sent once it will send again, so the stream leaves the candidate list and the
            // video rung gets the remaining attempts.
            expect(invokes.filter(invoke => invoke.command === "snapshotStreamDeallocate")).to.have.length(1);
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
        });

        it("does not name a snapshot stream it destroyed in the capacity it reports as taken", async () => {
            // `allocated` is what a client releases from; naming a freed id sends it to the camera for a
            // stream that no longer exists.
            const { manager, holder } = cameraShortOfEncoders(invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, allocatedSnapshotStreams: [SNAPSHOT_HOLDER] };

            let thrown: unknown;
            try {
                await manager.resolveVideoStream(videoRequest);
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(JSON.parse((thrown as ServerError).message).allocated).to.deep.equal([]);
        });

        it("puts a snapshot stream back when the request that freed it never used the capacity", async () => {
            // The video rung's rule, for the same reason: a request that bought capacity and then failed
            // must not leave the camera one stream poorer. The id does not come back — the camera issues
            // a new one — but the snapshot range does.
            const { manager, invokes, holder } = cameraShortOfEncoders(invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, allocatedSnapshotStreams: [SNAPSHOT_HOLDER] };

            await manager.resolveVideoStream(videoRequest).catch(() => undefined);

            const allocates = invokes.filter(invoke => invoke.command === "snapshotStreamAllocate");
            expect(allocates).to.have.length(2);
            expect(allocates[1]?.fields.minResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(allocates[1]?.fields.maxFrameRate).to.equal(1);
        });

        it("puts a snapshot stream back when the degraded rung served the caller instead", async () => {
            // The success that spends nothing: the loop ends, an existing in-use stream meets the
            // caller's bounds, and the capacity the eviction bought went unused — which is what tells
            // the difference between a give-back due on failure and one due unless spent.
            // Wider than the envelope, so reuse passes it over, and referenced, so nothing can take it:
            // the degraded rung is the only rung left that can answer.
            const inUse = {
                ...CONTAINED_STREAM,
                videoStreamId: 7,
                referenceCount: 1,
                maxResolution: { width: 3840, height: 2160 },
            };
            const { manager, invokes, holder } = cameraShortOfEncoders(invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, allocatedVideoStreams: [inUse], allocatedSnapshotStreams: [SNAPSHOT_HOLDER] };

            const resolved = await manager.resolveVideoStream(videoRequest);

            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
            expect(invokes.filter(invoke => invoke.command === "snapshotStreamAllocate")).to.have.length(2);
        });

        it("leaves the id alone when the camera reports it with parameters this server never asked for", async () => {
            // The camera reissues an id it has freed, and a lease it never confirmed lives for the
            // process run, so an id match on its own can name another controller's stream.
            const reissued = {
                ...SNAPSHOT_HOLDER,
                minResolution: { width: 640, height: 480 },
                maxResolution: { width: 640, height: 480 },
            };
            const { manager, invokes, holder } = cameraShortOfEncoders(invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, allocatedSnapshotStreams: [reissued] };

            await manager.resolveVideoStream(videoRequest).catch(() => undefined);

            expect(invokes.map(invoke => invoke.command)).to.not.include("snapshotStreamDeallocate");
        });

        it("stops claiming a snapshot stream the camera answers NotFound for", async () => {
            // NotFound is the camera stating the lease was wrong, so a later request must not try the
            // same id again; every other give-back path reads that status the same way.
            const { manager, invokes, holder } = cameraShortOfEncoders(invoke => {
                if (invoke.command === "snapshotStreamDeallocate") throw statusError(Status.NotFound);
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = { ...STATE, allocatedSnapshotStreams: [SNAPSHOT_HOLDER] };

            await manager.resolveVideoStream(videoRequest).catch(() => undefined);
            const afterFirst = invokes.filter(invoke => invoke.command === "snapshotStreamDeallocate").length;
            await manager.resolveVideoStream(videoRequest).catch(() => undefined);

            expect(afterFirst).to.equal(1);
            expect(invokes.filter(invoke => invoke.command === "snapshotStreamDeallocate")).to.have.length(1);
        });

        it("leaves a snapshot stream another controller allocated alone", async () => {
            const foreign = {
                snapshotStreamId: 6,
                overlays: NO_OVERLAYS,
                imageCodec: 0,
                minResolution: { width: 1920, height: 1080 },
                maxResolution: { width: 1920, height: 1080 },
                referenceCount: 0,
                frameRate: 1,
                encodedPixels: true,
                hardwareEncoder: true,
            };
            const { manager, invokes } = managerWith(
                { ...STATE, allocatedSnapshotStreams: [foreign] },
                async invoke => {
                    if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                    return undefined;
                },
            );
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(invokes.map(invoke => invoke.command)).to.not.include("snapshotStreamDeallocate");
        });

        it("takes no snapshot stream of its own when the caller forbade eviction", async () => {
            const { manager, invokes, holder } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 5 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        snapshotStreamId: 5,
                        overlays: NO_OVERLAYS,
                        imageCodec: 0,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        referenceCount: 0,
                        frameRate: 1,
                        encodedPixels: true,
                        hardwareEncoder: true,
                    },
                ],
            };

            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    allowEviction: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            // The caller said take nothing, and this id was handed to it by its own camera_snapshot.
            expect(invokes.map(invoke => invoke.command)).to.not.include("snapshotStreamDeallocate");
        });

        it("announces the stream the make-room rung took", async () => {
            // The request that benefits is told in its own response; the client holding the id that
            // stopped existing has nothing else to learn it from.
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command === "videoStreamAllocate") {
                    allocateAttempts += 1;
                    if (allocateAttempts <= NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            const evicted = new Array<CameraStreamEvicted>();
            manager.events.streamEvicted.on(taken => {
                evicted.push(taken);
            });

            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });

            expect(evicted).to.deep.equal([{ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 7 }]);
        });

        it("reacts to a device status matter.js wrapped in a cause chain", async () => {
            // matter.js's own callers read a status with StatusResponseError.of, which walks the cause
            // chain. A bare `code` read misses a wrapped status, every rung reads "rethrow", and the
            // whole ladder degrades to raising what the SDK raised.
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command === "videoStreamAllocate") {
                    allocateAttempts += 1;
                    if (allocateAttempts <= NARROWING_ATTEMPTS) {
                        throw new Error("invoke failed", {
                            cause: StatusResponseError.create(Status.ResourceExhausted),
                        });
                    }
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(11);
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
        });

        it("reacts to a device status matter.js wrapped in an AggregateError", async () => {
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command === "videoStreamAllocate") {
                    allocateAttempts += 1;
                    if (allocateAttempts <= NARROWING_ATTEMPTS) {
                        throw new AggregateError([StatusResponseError.create(Status.ResourceExhausted)]);
                    }
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(11);
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
        });

        it("frees its own unreferenced stream before touching a foreign one", async () => {
            // A different codec keeps both candidates out of the reuse/relaxed-reuse checks, so the
            // ladder reaches freeAnUnreferencedVideoStream regardless of which one it would pick.
            const H264 = 2;
            let allocateAttempts = 0;
            const { manager, invokes, holder } = managerWith(STATE, async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                if (allocateAttempts === 1) return { videoStreamId: 20 };
                if (allocateAttempts <= 1 + NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 30 };
            });
            const request = { nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, limits: { codec: H265 } };
            await manager.resolveVideoStream(request); // allocates and owns stream 20

            const foreign = { ...CONTAINED_STREAM, videoStreamId: 21, videoCodec: H264, referenceCount: 0 };
            const ours = { ...CONTAINED_STREAM, videoStreamId: 20, videoCodec: H264, referenceCount: 0 };
            holder.state = { ...STATE, allocatedVideoStreams: [foreign, ours] };

            const resolved = await manager.resolveVideoStream(request);
            expect(resolved.streamId).to.equal(30);
            const deallocates = invokes.filter(invoke => invoke.command === "videoStreamDeallocate");
            expect(deallocates.map(invoke => invoke.fields.videoStreamId)).to.deep.equal([20]);
            // freeAnUnreferencedVideoStream must not write back into the CameraState the mock returned:
            // a real implementation may hand back a cached/subscription-backed object.
            expect(holder.state?.allocatedVideoStreams.map(stream => stream.videoStreamId)).to.deep.equal([21, 20]);
        });

        it("does not retry deallocating a stream it already freed", async () => {
            const H264 = 2;
            const first = { ...CONTAINED_STREAM, videoStreamId: 20, videoCodec: H264, referenceCount: 0 };
            const second = { ...CONTAINED_STREAM, videoStreamId: 21, videoCodec: H264, referenceCount: 0 };
            const { manager, invokes, holder } = managerWith(withStreams([first, second]), async invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: { maxResolution: { width: 1280, height: 720 } },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            const deallocated = invokes
                .filter(invoke => invoke.command === "videoStreamDeallocate")
                .map(invoke => invoke.fields.videoStreamId);
            // Each idle stream is a candidate exactly once: no repeat attempt on one already freed.
            expect(deallocated).to.deep.equal([20, 21]);
            // "allocated" comes from the ladder's local copy, so it reflects both streams freed this call.
            expect(JSON.parse((thrown as ServerError).message).allocated).to.deep.equal([]);
            expect(holder.state?.allocatedVideoStreams.map(stream => stream.videoStreamId)).to.deep.equal([20, 21]);
        });

        it("takes the lowest-priority unreferenced stream, not the first one it finds", async () => {
            // StreamUsagePriorities is ranked highest first (§11.2.7.19), so the candidate furthest
            // down it goes: taking a Recording stream while an Analysis one sits idle would cost
            // someone a recording the camera itself ranks above what this request is for.
            const H264 = 2;
            const recording = {
                ...CONTAINED_STREAM,
                videoStreamId: 20,
                overlays: NO_OVERLAYS,
                videoCodec: H264,
                streamUsage: 1,
                referenceCount: 0,
            };
            const analysis = {
                ...CONTAINED_STREAM,
                videoStreamId: 21,
                overlays: NO_OVERLAYS,
                videoCodec: H264,
                streamUsage: 2,
                referenceCount: 0,
            };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([recording, analysis]), async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                if (allocateAttempts <= NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 30 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(30);
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([21]);
        });

        it("still frees a stream when the camera reports no stream-usage ranking at all", async () => {
            // With nothing ranked every candidate ties, and the request must still get its capacity
            // rather than failing because the camera left an optional ordering unreported.
            const H264 = 2;
            const idle = { ...CONTAINED_STREAM, videoStreamId: 20, videoCodec: H264, referenceCount: 0 };
            let allocateAttempts = 0;
            const unranked: CameraState = {
                ...STATE,
                streamUsagePriorities: new Array<number>(),
                allocatedVideoStreams: [idle],
            };
            const { manager, invokes } = managerWith(unranked, async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                if (allocateAttempts <= NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 30 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(30);
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([20]);
        });

        it("never takes an Internal stream to make room, however idle it is", async () => {
            // The device refuses it with DynamicConstraintError (§11.2.8.7.2), and the stream is one
            // the camera keeps for itself.
            const H264 = 2;
            const internal = {
                ...CONTAINED_STREAM,
                videoStreamId: 20,
                overlays: NO_OVERLAYS,
                videoCodec: H264,
                streamUsage: 0,
                referenceCount: 0,
            };
            const { manager, invokes } = managerWith(withStreams([internal]), async invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("hands out an in-use stream as degraded when the caller stated no bounds", async () => {
            // Wider than the sensor so it fails plain AND relaxed reuse (both contain-in-envelope
            // checks); only the degraded rung, which checks caller-stated bounds instead, accepts it.
            const busy = {
                ...CONTAINED_STREAM,
                videoStreamId: 7,
                overlays: NO_OVERLAYS,
                referenceCount: 1,
                maxResolution: { width: 3840, height: 2160 },
            };
            const { manager } = managerWith(withStreams([busy]), async () => {
                throw statusError(Status.ResourceExhausted);
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
            // busy.maxResolution (3840x2160) is well outside the device's own sensor ceiling, so this
            // only matches if degraded reports the stream's own bounds.
            const envelope = requireVideoEnvelope(resolved.envelope);
            expect(envelope.minResolution).to.deep.equal(busy.minResolution);
            expect(envelope.maxResolution).to.deep.equal(busy.maxResolution);
        });

        it("fails rather than degrading when the caller pinned a resolution the stream cannot guarantee", async () => {
            // Issue #1056 on the degraded path: a pinned caller must never be silently given less.
            const busy = {
                ...CONTAINED_STREAM,
                videoStreamId: 7,
                overlays: NO_OVERLAYS,
                referenceCount: 1,
                minResolution: { width: 1280, height: 720 },
            };
            const { manager } = managerWith(withStreams([busy]), async () => {
                throw statusError(Status.ResourceExhausted);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: PINNED_1080P,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
        });

        it("hands a pinned caller a stream that meets its pins exactly", async () => {
            // The stream's bit-rate range sits below the 800 kbit/s floor this camera's own
            // trade-off point puts on 1080p, so the reuse rung refuses it and the request walks the
            // whole ladder down to the degraded rung. There the caller's pins are met exactly:
            // meeting a pin is not a substitution, and the flag reports only that the stream was
            // already there rather than allocated to the range the server computed.
            const busy = { ...CONTAINED_STREAM, referenceCount: 1, minBitRate: 100000, maxBitRate: 200000 };
            const { manager } = managerWith(withStreams([busy]), async () => {
                throw statusError(Status.ResourceExhausted);
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.reused).to.equal(true);
            expect(resolved.degraded).to.equal(true);
            const envelope = requireVideoEnvelope(resolved.envelope);
            expect(envelope.minResolution).to.deep.equal(PINNED_1080P.minResolution);
            expect(envelope.maxResolution).to.deep.equal(PINNED_1080P.maxResolution);
        });

        /**
         * A camera that refuses any allocate whose reservation would exceed `budget`.
         *
         * `maxResolution` times `maxFrameRate` is the reservation §11.2.6.9.4 tells clients to
         * compute, so this is the accounting a real camera applies to `MaxEncodedPixelRate`.
         */
        function encoderBudgetedCamera(budget: number): (invoke: RecordedInvoke) => Promise<unknown> {
            return async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                const ceiling = invoke.fields.maxResolution;
                const frameRate = invoke.fields.maxFrameRate;
                if (
                    typeof ceiling !== "object" ||
                    ceiling === null ||
                    !("width" in ceiling) ||
                    !("height" in ceiling) ||
                    typeof frameRate !== "number"
                ) {
                    throw new Error("videoStreamAllocate without a resolution ceiling and frame rate");
                }
                const { width, height } = ceiling;
                if (typeof width !== "number" || typeof height !== "number") {
                    throw new Error("videoStreamAllocate with a non-numeric resolution ceiling");
                }
                if (width * height * frameRate > budget) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 40 };
            };
        }

        /** Half of what the sensor's 2560x1440 at 30 fps would reserve, so 15 fps is the most that fits. */
        const HALF_SENSOR_BUDGET = 55296000;

        it("reuses a stream the camera already produces although the budget is spent", async () => {
            // Such a stream is already drawing on the budget, so reusing it costs nothing: budgeting
            // the reuse check would send a request to a camera that had the answer already allocated.
            const { manager, invokes } = managerWith(
                // Just past what stream 7 reserves, so the budget would narrow the envelope below that
                // stream if the reuse check were budgeted, and reuse would turn into an allocate.
                { ...withStreams([CONTAINED_STREAM]), maxEncodedPixelRate: 1920 * 1080 * 30 + 1000 },
                async () => {
                    throw new Error("nothing should be invoked");
                },
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.reused).to.equal(true);
            expect(invokes).to.have.length(0);
        });

        it("asks for a frame rate the camera's stated encoder budget can carry", async () => {
            const { manager, invokes } = managerWith(
                { ...STATE, maxEncodedPixelRate: HALF_SENSOR_BUDGET },
                encoderBudgetedCamera(HALF_SENSOR_BUDGET),
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(40);
            const envelope = requireVideoEnvelope(resolved.envelope);
            expect(envelope.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(envelope.maxFrameRate).to.equal(15);
            // One attempt: the request the camera can serve was the first one it saw.
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
        });

        it("reports the ceiling the budget lowered, so the caller is not left guessing", async () => {
            // The budget spends the frame rate first, so a tight one answers a LiveView request at full
            // sensor size and a low rate. Without this field nothing in the response said that another
            // stream's reservation was the reason rather than the camera's own limit.
            const { manager } = managerWith(
                { ...STATE, maxEncodedPixelRate: HALF_SENSOR_BUDGET },
                encoderBudgetedCamera(HALF_SENSOR_BUDGET),
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(requireVideoEnvelope(resolved.envelope).maxFrameRate).to.equal(15);
            expect(resolved.budgetNarrowed).to.deep.equal({ maxFrameRate: 30 });
            expect(resolved.degraded).to.equal(undefined);
        });

        it("reports no budget narrowing for a stream it reused", async () => {
            // A stream the camera already produces carries the camera's own range, which the budget had
            // no part in — and reuse never reaches the budget at all.
            const { manager } = managerWith(
                { ...withStreams([CONTAINED_STREAM]), maxEncodedPixelRate: HALF_SENSOR_BUDGET },
                encoderBudgetedCamera(HALF_SENSOR_BUDGET),
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: PINNED_1080P,
            });
            expect(resolved.reused).to.equal(true);
            expect(resolved.budgetNarrowed).to.equal(undefined);
        });

        it("would have been refused by the same camera without the budget", async () => {
            // The contrast the budget exists for: with MaxEncodedPixelRate unread the request goes out
            // at the sensor's maximum, and the camera that could have served it first time refuses.
            const { manager, invokes } = managerWith(
                { ...STATE, maxEncodedPixelRate: undefined },
                encoderBudgetedCamera(HALF_SENSOR_BUDGET),
            );
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            const allocates = invokes.filter(invoke => invoke.command === "videoStreamAllocate");
            expect(allocates[0]?.fields.maxFrameRate).to.equal(30);
            expect(allocates.length).to.be.greaterThan(1);
        });

        it("counts what the camera's other streams reserve, not just its ceiling", async () => {
            // One 1920x1080 at 30 fps stream reserves 62.2 Mpx/s of the 110.6 Mpx/s budget, leaving 48.4,
            // which carries the sensor's frame size at 13 fps.
            const { manager, invokes } = managerWith(
                { ...withStreams([CONTAINED_STREAM]), maxEncodedPixelRate: 110592000 },
                encoderBudgetedCamera(110592000 - 1920 * 1080 * 30),
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxFrameRate: 30, minResolution: { width: 2560, height: 1440 } },
            });
            expect(requireVideoEnvelope(resolved.envelope).maxFrameRate).to.equal(13);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
        });

        it("sends a floor the caller stated to the device although the budget cannot carry it", async () => {
            // The budget narrows this server's own defaults and never a bound the caller stated: a
            // caller that needs 30 fps is not quietly given 15, the camera is asked and answers.
            const { manager, invokes } = managerWith(
                { ...STATE, maxEncodedPixelRate: HALF_SENSOR_BUDGET },
                async () => ({
                    videoStreamId: 41,
                }),
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { minFrameRate: 30 },
            });
            expect(resolved.streamId).to.equal(41);
            const first = invokes.filter(invoke => invoke.command === "videoStreamAllocate")[0];
            expect(first?.fields.minFrameRate).to.equal(30);
            expect(first?.fields.maxFrameRate).to.equal(30);
        });

        it("narrows its own envelope before taking a stream that is not being used", async () => {
            // §11.2.1.1 asks commissioners to pre-allocate long-lived streams, so an idle stream is
            // somebody's reservation. Giving up the server's own envelope costs nobody anything.
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                if (allocateAttempts === 1) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 42 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(42);
            expect(resolved.evicted).to.equal(undefined);
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("names the stream it took in the result", async () => {
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                if (allocateAttempts <= NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 43 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(43);
            expect(resolved.evicted).to.deep.equal([7]);
            // The envelope is re-derived from the freed capacity rather than left where narrowing
            // ended it: paying for capacity and then not using it costs the caller picture size for
            // nothing.
            expect(requireVideoEnvelope(resolved.envelope).maxResolution).to.deep.equal({
                width: 1280,
                height: 720,
            });
        });

        it("fails rather than taking a stream when the caller forbade eviction", async () => {
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            const { manager, invokes } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: { maxResolution: { width: 1280, height: 720 } },
                    allowEviction: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("counts an encoded-pixels snapshot stream against the video budget", async () => {
            // The other half of the reservation sum, through the manager rather than the policy: a
            // snapshot stream the camera counts in its own pixel rate leaves less for the livestream.
            const snapshot = {
                snapshotStreamId: 4,
                overlays: NO_OVERLAYS,
                imageCodec: 0,
                minResolution: { width: 2560, height: 1440 },
                maxResolution: { width: 2560, height: 1440 },
                referenceCount: 0,
                frameRate: 15,
                encodedPixels: true,
                hardwareEncoder: false,
            };
            const budget = 2560 * 1440 * 30;
            const { manager, invokes } = managerWith(
                { ...STATE, maxEncodedPixelRate: budget, allocatedSnapshotStreams: [snapshot] },
                encoderBudgetedCamera(budget - 2560 * 1440 * 15),
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(requireVideoEnvelope(resolved.envelope).maxFrameRate).to.equal(15);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
        });

        it("never takes a stream the degraded rung could have handed out", async () => {
            // Taking it and then failing costs its holder an id for a request that very stream would
            // have served — and the restore proves it, since it puts the same parameters back.
            const usable = {
                ...CONTAINED_STREAM,
                videoStreamId: 7,
                overlays: NO_OVERLAYS,
                referenceCount: 0,
                minBitRate: 100000,
                maxBitRate: 200000,
            };
            const { manager, invokes } = managerWith(withStreams([usable]), async invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
            expect(resolved.evicted).to.equal(undefined);
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("reports a stream it took even when the degraded rung is what served the caller", async () => {
            // The taking happened, so the id is gone whichever rung then answered. A response that
            // said nothing would hand the caller a success and hide the cost.
            const H264 = 2;
            const victim = { ...CONTAINED_STREAM, videoStreamId: 20, videoCodec: H264, referenceCount: 0 };
            const busy = {
                ...CONTAINED_STREAM,
                videoStreamId: 7,
                overlays: NO_OVERLAYS,
                referenceCount: 1,
                maxResolution: { width: 3840, height: 2160 },
            };
            const { manager, invokes } = managerWith(withStreams([victim, busy]), async invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
            expect(resolved.evicted).to.deep.equal([20]);
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([20]);
        });

        it("takes a stream it allocated itself before a foreign one the camera ranks lower", async () => {
            // STATE ranks LiveView, then Recording, then Analysis, so the camera's own ranking alone
            // would destroy the foreign Analysis stream and leave ours. Ownership decides first: this
            // server gives up what it allocated before it costs another controller an id.
            const RECORDING = 1;
            const ANALYSIS = 2;
            const idle = (id: number, streamUsage: number) => ({
                ...CONTAINED_STREAM,
                videoStreamId: id,
                streamUsage,
                referenceCount: 0,
            });
            let allocates = 0;
            const { manager, holder } = managerWith({ ...STATE, allocatedVideoStreams: [] }, async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocates += 1;
                // The first allocate is what makes stream 30 this server's own; from then on the
                // camera is out of capacity until two streams have been taken.
                if (allocates === 1) return { videoStreamId: 30 };
                if (allocates <= NARROWING_ATTEMPTS + 2) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 44 };
            });
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: RECORDING,
                limits: { codec: H265 },
            });

            holder.state = {
                ...STATE,
                allocatedVideoStreams: [idle(31, ANALYSIS), idle(30, RECORDING)],
            };
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(44);
            expect(resolved.evicted).to.deep.equal([30, 31]);
        });

        it("names every stream it took, not only the first", async () => {
            const H264 = 2;
            const idle = (id: number) => ({
                ...CONTAINED_STREAM,
                videoStreamId: id,
                videoCodec: H264,
                streamUsage: 1,
                referenceCount: 0,
            });
            let allocateAttempts = 0;
            const { manager } = managerWith(withStreams([idle(20), idle(21)]), async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                // Two evictions before the camera relents, so a result naming one id is a result
                // hiding the second stream it destroyed.
                if (allocateAttempts <= NARROWING_ATTEMPTS + 1) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 44 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 1280, height: 720 } },
            });
            expect(resolved.streamId).to.equal(44);
            expect(resolved.evicted).to.deep.equal([20, 21]);
        });

        it("stops taking streams when no allocate attempt is left to use the capacity", async () => {
            // The allocate that spends the capacity is inside the loop; the last iteration has none
            // behind it, so a stream taken there would be destroyed for nothing.
            const H264 = 2;
            const idle = (id: number) => ({
                ...CONTAINED_STREAM,
                videoStreamId: id,
                videoCodec: H264,
                streamUsage: 1,
                referenceCount: 0,
            });
            const { manager, invokes } = managerWith(
                withStreams([idle(20), idle(21), idle(22), idle(23), idle(24)]),
                async invoke => {
                    if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                    return undefined;
                },
            );
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: { maxResolution: { width: 1280, height: 720 } },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            // Only this request's own attempts: the scope's restores are allocates of the victims'
            // own stream usage, and there is one per stream taken.
            const attempts = invokes.filter(
                invoke => invoke.command === "videoStreamAllocate" && invoke.fields.streamUsage === LIVE_VIEW,
            );
            const deallocates = invokes.filter(invoke => invoke.command === "videoStreamDeallocate");
            // Five candidates, but only the attempts before the last can spend what they buy.
            expect(attempts.length).to.equal(MAX_ALLOCATE_ATTEMPTS);
            expect(deallocates.length).to.equal(MAX_ALLOCATE_ATTEMPTS - NARROWING_ATTEMPTS);
        });

        it("still reaches the degraded rung when the caller forbade eviction", async () => {
            // allow_eviction stops the taking rung only: handing out a stream that is already there
            // takes nothing from anyone, so forbidding eviction must not also forbid being served.
            const H264 = 2;
            const idle = { ...CONTAINED_STREAM, videoStreamId: 20, videoCodec: H264, referenceCount: 0 };
            const busy = {
                ...CONTAINED_STREAM,
                videoStreamId: 7,
                overlays: NO_OVERLAYS,
                referenceCount: 1,
                maxResolution: { width: 3840, height: 2160 },
            };
            const { manager, invokes } = managerWith(withStreams([idle, busy]), async invoke => {
                if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                allowEviction: false,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
            expect(resolved.evicted).to.equal(undefined);
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("fails typed with the allocated list once the ladder is exhausted", async () => {
            const { manager, invokes } = managerWith(withStreams([CONTAINED_STREAM]), async () => {
                throw statusError(Status.ResourceExhausted);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                    hints: { maxResolution: { width: 1280, height: 720 } },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(JSON.parse((thrown as ServerError).message).allocated).to.deep.equal([
                { kind: "video", stream_id: 7, reference_count: 1 },
            ]);
            // One attempt at the budgeted envelope plus MAX_NARROWING_ROUNDS narrowings, and then
            // eviction, which finds no candidate here because stream 7 is in use.
            expect(invokes.length).to.equal(4);
        });

        it("fails typed when no codec suits both the camera and the offer", async () => {
            const { manager } = managerWith(STATE);
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: 99 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.device).to.deep.equal(["H265"]);
            expect(payload.requested).to.deep.equal(["99"]);
        });

        it("names a codec the enum knows when the camera does not support it", async () => {
            const { manager } = managerWith(STATE);
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: CameraAvStreamManagement.VideoCodec.H264 },
                });
            } catch (error) {
                thrown = error;
            }
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.requested).to.deep.equal(["H264"]);
            expect(payload.device).to.deep.equal(["H265"]);
        });

        it("allocates once when two callers race for the same endpoint", async () => {
            // Device state never names the allocation, which is what a real camera's AllocatedVideoStreams
            // report does for as long as it takes to arrive. The second caller can therefore only avoid a
            // twin by seeing the first caller's lease; a mock that wrote the allocation into state would
            // let it reuse through the ordinary device-state path and prove nothing.
            const ids = [9, 10];
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                return { videoStreamId: ids.shift() };
            });
            const request = {
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            };
            const [first, second] = await Promise.all([
                manager.resolveVideoStream(request),
                manager.resolveVideoStream(request),
            ]);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
            expect(first.streamId).to.equal(9);
            expect(second.streamId).to.equal(9);
            expect(second.reused).to.equal(true);
        });
    });

    describe("withEndpointLock", () => {
        class TestableCameraStreamManager extends CameraStreamManager {
            get lockCount(): number {
                return this.pendingLockCount;
            }
        }

        it("clears the per-endpoint lock once the work it guards has settled", async () => {
            const io: CameraDeviceIo = {
                readCameraState: async () => STATE,
                readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
                missingCameraClusters: async () => new Array<number>(),
                invoke: async () => ({ videoStreamId: 9 }),
            };
            const manager = new TestableCameraStreamManager(io);
            const request = { nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, limits: { codec: H265 } };
            await manager.resolveVideoStream(request);
            await manager.resolveVideoStream(request);
            expect(manager.lockCount).to.equal(0);
        });
    });

    describe("resolveAudioStream", () => {
        function withAudioStreams(streams: CameraState["allocatedAudioStreams"]): CameraState {
            return { ...STATE, allocatedAudioStreams: streams };
        }

        const EXISTING_AUDIO_STREAM = {
            audioStreamId: 4,
            streamUsage: LIVE_VIEW,
            audioCodec: 0,
            channelCount: 1,
            sampleRate: 48000,
            bitRate: 64000,
            bitDepth: 16,
            referenceCount: 1,
        };

        it("reuses a matching audio stream without invoking anything", async () => {
            const { manager, invokes } = managerWith(withAudioStreams([EXISTING_AUDIO_STREAM]));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved?.streamId).to.equal(4);
            expect(resolved?.reused).to.equal(true);
            expect(resolved?.allocatedByUs).to.equal(false);
            expect(invokes).to.deep.equal([]);
        });

        it("reports the reused audio stream's own bitRate, not the freshly computed default", async () => {
            // bitRate/bitDepth are not part of the reuse match, so a stream allocated with a different
            // bitRate than today's default must still be reported as what it actually is.
            const customBitRate = { ...EXISTING_AUDIO_STREAM, bitRate: 32000 };
            const { manager } = managerWith(withAudioStreams([customBitRate]));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved?.reused).to.equal(true);
            expect(requireAudioEnvelope(resolved!.envelope).bitRate).to.equal(32000);
        });

        it("allocates rather than reporting another stream's bit rate as the caller's", async () => {
            // Matching on usage, codec, channels and sample rate alone handed this stream back with
            // bit_rate 64000 to a caller that asked for 32000.
            const { manager, invokes } = managerWith(withAudioStreams([EXISTING_AUDIO_STREAM]), async () => ({
                audioStreamId: 9,
            }));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                audio: { bitRate: 32000 },
            });
            expect(resolved?.streamId).to.equal(9);
            expect(resolved?.reused).to.equal(false);
            expect(invokes.find(invoke => invoke.command === "audioStreamAllocate")?.fields.bitRate).to.equal(32000);
        });

        it("reuses a stream that already carries the bit rate the caller asked for", async () => {
            const { manager, invokes } = managerWith(withAudioStreams([EXISTING_AUDIO_STREAM]));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                audio: { bitRate: 64000 },
            });
            expect(resolved?.streamId).to.equal(4);
            expect(invokes).to.deep.equal([]);
        });

        it("fails typed when the camera lists no such sample rate, rather than picking its own", async () => {
            const { manager, invokes } = managerWith(STATE, async () => ({ audioStreamId: 9 }));
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { sampleRate: 44100 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).bound).to.deep.equal({
                field: "sample_rate",
                requested: "44100",
                limit: "48000",
            });
            expect(invokes).to.deep.equal([]);
        });

        it("fails typed when the caller asks for more channels than the camera has", async () => {
            const { manager } = managerWith(STATE, async () => ({ audioStreamId: 9 }));
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { channelCount: 2 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).bound).to.deep.equal({
                field: "channel_count",
                requested: "2",
                limit: "1",
            });
        });

        it("allocates a new audio stream and records it as owned by the server", async () => {
            const { manager, invokes } = managerWith(STATE, async () => ({ audioStreamId: 9 }));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved?.streamId).to.equal(9);
            expect(resolved?.reused).to.equal(false);
            expect(resolved?.allocatedByUs).to.equal(true);
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["audioStreamAllocate"]);
        });

        it("fails typed when a caller that asked for audio gets none from the codec narrowing", async () => {
            // The caller stated OPUS and the camera has it; the offer is what leaves nothing. `device`
            // reports the camera's own list, so the caller can see the blocker is its own offer.
            const { manager } = managerWith(STATE, async () => ({ audioStreamId: 9 }));
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    sdp: {
                        video: { state: "absent" as const },
                        audio: { state: "receiving" as const, codecs: ["AAC"] },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
                        unreadableCeilingCodecs: new Set<string>(),
                    },
                    audio: { codecs: ["OPUS"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("codec");
            expect(detail.device).to.deep.equal(["OPUS"]);
            expect(detail.requested).to.deep.equal(["OPUS"]);
        });

        it("goes video-only for the same narrowing when the caller stated no audio value", async () => {
            const { manager } = managerWith(STATE, async () => ({ audioStreamId: 9 }));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                sdp: {
                    video: { state: "absent" as const },
                    audio: { state: "receiving" as const, codecs: ["AAC"] },
                    wantsTalkback: false,
                    limitsByCodec: new Map(),
                    unreadableCeilingCodecs: new Set<string>(),
                },
            });
            expect(resolved).to.equal(undefined);
        });

        it("keeps the camera's audio codecs when the offered audio section states none", async () => {
            // The section carries only statically-mapped payload types, so the peer stated nothing
            // about what it decodes. Narrowing by that empties the set and refuses a caller for a
            // codec mismatch the offer never stated.
            const { manager } = managerWith(STATE, async () => ({ audioStreamId: 9 }));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                sdp: {
                    video: { state: "absent" as const },
                    audio: { state: "receiving" as const },
                    wantsTalkback: false,
                    limitsByCodec: new Map(),
                    unreadableCeilingCodecs: new Set<string>(),
                },
                audio: { bitRate: 32000 },
            });
            expect(resolved?.streamId).to.equal(9);
        });

        it("reads an empty audio object as asking for audio", async () => {
            // The key being present is the statement, not which fields are inside it. `audio: {}`
            // used to read as "left to the server" and come back as a video-only session, so a
            // caller asking for audio without pinning anything was told nothing went wrong.
            const { manager } = managerWith({ ...STATE, microphoneCapabilities: undefined });
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).track).to.equal("audio");
        });

        it("fails typed when a caller that asked for audio meets a camera with no microphone", async () => {
            const bare: CameraState = { ...STATE, microphoneCapabilities: undefined };
            const { manager } = managerWith(bare);
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("capability");
        });

        it("fails when a caller that asked for audio gets an allocate response with no id", async () => {
            const { manager } = managerWith(STATE, async () => ({}));
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
        });

        it("fails typed when a caller that asked for audio meets a device that refuses to allocate", async () => {
            const occupied = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 8,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 1,
                    },
                ],
                allocatedAudioStreams: [
                    {
                        audioStreamId: 4,
                        streamUsage: LIVE_VIEW,
                        audioCodec: 0,
                        channelCount: 1,
                        sampleRate: 48000,
                        bitRate: 64000,
                        bitDepth: 16,
                        referenceCount: 1,
                    },
                ],
            };
            const { manager } = managerWith(occupied, async () => {
                throw statusError(Status.ResourceExhausted);
            });
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            // The two limits are camera attributes, not a claim about what ran out.
            const detail: unknown = JSON.parse((thrown as ServerError).message);
            expect(detail).to.deep.equal({
                message: "Camera has no capacity for this stream",
                allocated: [{ kind: "audio", stream_id: 4, reference_count: 1 }],
                max_concurrent_encoders: STATE.maxConcurrentEncoders,
                max_encoded_pixel_rate: STATE.maxEncodedPixelRate,
            });
        });

        it("raises the device's own error when a caller that asked for audio meets a status the ladder does not know", async () => {
            const { manager } = managerWith(STATE, async () => {
                throw statusError(Status.Busy);
            });
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.not.be.instanceOf(ServerError);
            expect(deviceStatusOf(thrown)).to.equal(Status.Busy);
        });

        it("fails typed when a caller that asked for audio meets a device that rejects the range", async () => {
            // DynamicConstraintError has no audio ladder to narrow with, so it reports the caller's
            // bounds against the camera's own codec list rather than the raw SDK error.
            const { manager } = managerWith(STATE, async () => {
                throw statusError(Status.DynamicConstraintError);
            });
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).device_status).to.equal(Status.DynamicConstraintError);
        });

        it("returns undefined rather than failing when the device has no microphone", async () => {
            const bare: CameraState = { ...STATE, microphoneCapabilities: undefined };
            const { manager } = managerWith(bare);
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved).to.equal(undefined);
        });

        it("returns undefined rather than computing -Infinity when a capability list is empty", async () => {
            // An empty supportedSampleRates/supportedBitDepths would otherwise put Math.max(...[]) = -Infinity on the wire.
            const noUsableAudio: CameraState = {
                ...STATE,
                microphoneCapabilities: {
                    supportedCodecs: [0],
                    maxNumberOfChannels: 1,
                    supportedSampleRates: [],
                    supportedBitDepths: [16],
                },
            };
            const { manager, invokes } = managerWith(noUsableAudio);
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved).to.equal(undefined);
            expect(invokes).to.deep.equal([]);
        });

        it("returns undefined rather than failing when the device rejects audio allocation", async () => {
            const { manager } = managerWith(STATE, async () => {
                throw new Error("device refused audio allocation");
            });
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved).to.equal(undefined);
        });

        it("returns undefined rather than failing when the response carries no AudioStreamID", async () => {
            const { manager } = managerWith(STATE, async () => ({}));
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved).to.equal(undefined);
        });

        it("rethrows a ServerError from the device rather than treating it as a missing microphone", async () => {
            const { manager } = managerWith(STATE, async () => {
                throw ServerError.cameraNotSupported({ missingClusters: [] });
            });
            let thrown: unknown;
            try {
                await manager.resolveAudioStream({ nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraNotSupported);
        });
    });

    describe("sessions", () => {
        function statusError(status: number): Error & { code: number } {
            const error = new Error(`Device returned status ${status}`) as Error & { code: number };
            error.code = status;
            return error;
        }

        const CONTAINED_STREAM = {
            videoStreamId: 7,
            overlays: NO_OVERLAYS,
            streamUsage: LIVE_VIEW,
            videoCodec: H265,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            referenceCount: 1,
        };

        function allocatingManager() {
            return managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
        }

        it("puts no video track in a session whose offer rejects the video section", async () => {
            // The peer refused it. A stream allocated here would hold an encoder and a ReferenceCount
            // for media that can never flow, and the next request is the one that then fails 103.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_REFUSED_OFFER,
            });
            expect(session.video).to.equal(undefined);
            expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(false);
            const offer = invokes.find(invoke => invoke.command === "provideOffer");
            expect(offer?.fields.videoStreams).to.equal(undefined);
            expect(offer?.fields.audioStreams).to.deep.equal([4]);
        });

        it("tells a caller that asked for video why a rejected video section left it none", async () => {
            // The audio half of the same situation raises 102. A caller that stated video bounds gets
            // the same answer, not a session with video: null and no error it could act on.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_REFUSED_OFFER,
                    video: { codecs: ["H265"], minResolution: { width: 1280, height: 720 } },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("offer");
            expect(detail.track).to.equal("video");
            expect(detail.requested).to.deep.equal(["H265"]);
            expect(invokes.some(invoke => invoke.command === "provideOffer")).to.equal(false);
        });

        it("puts no audio track in a session whose offer rejects the audio section", async () => {
            const { manager, invokes } = allocatingManager();
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: AUDIO_REFUSED_OFFER,
                video: {},
            });
            expect(session.audio).to.equal(undefined);
            expect(invokes.some(invoke => invoke.command === "audioStreamAllocate")).to.equal(false);
        });

        it("tells a caller that asked for audio why a rejected audio section left it none", async () => {
            const { manager } = allocatingManager();
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: AUDIO_REFUSED_OFFER,
                    video: {},
                    audio: { codecs: ["OPUS"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            // Not "codec": the camera's codec list is not what ruled audio out, and no codec the
            // caller could name instead would change the peer's refusal.
            expect(detail.reason).to.equal("offer");
            expect(detail.device).to.deep.equal([]);
            expect(detail.track).to.equal("audio");
        });

        it("names the track when the audio value the caller stated is not a codec list", async () => {
            // `requested` is a codec list, so a caller that stated only a channel count leaves it
            // empty. Without `track` the payload is byte-identical to the one that says both tracks
            // were left out, which is a different problem with a different fix.
            const { manager } = allocatingManager();
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: AUDIO_REFUSED_OFFER,
                    video: {},
                    audio: { channelCount: 2 },
                });
            } catch (error) {
                thrown = error;
            }
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("offer");
            expect(detail.requested).to.deep.equal([]);
            expect(detail.track).to.equal("audio");
        });

        it("puts no video track in a session whose offer will not receive video", async () => {
            // The section is live, but a=inactive says nothing reaches the peer through it. A stream
            // allocated here holds an encoder and a ReferenceCount for media nobody receives.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_INACTIVE_OFFER,
            });
            expect(session.video).to.equal(undefined);
            expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(false);
            const offer = invokes.find(invoke => invoke.command === "provideOffer");
            expect(offer?.fields.videoStreams).to.equal(undefined);
        });

        it("tells a caller that asked for video why a section it will not receive left it none", async () => {
            // Same answer as a rejected section: the caller stated video and must hear why it has
            // none, rather than reading video: null with no error.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_INACTIVE_OFFER,
                    video: { codecs: ["H265"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("offer");
            expect(detail.track).to.equal("video");
            expect(detail.requested).to.deep.equal(["H265"]);
            expect(invokes.some(invoke => invoke.command === "provideOffer")).to.equal(false);
        });

        it("puts no audio track in a session whose audio section only asks to send", async () => {
            // a=sendonly asks for talkback and refuses our audio in one statement. The talkback
            // request must not be read as permission to send audio back.
            const { manager, invokes } = allocatingManager();
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: AUDIO_SENDONLY_OFFER,
                video: {},
            });
            expect(session.audio).to.equal(undefined);
            expect(invokes.some(invoke => invoke.command === "audioStreamAllocate")).to.equal(false);
            const offer = invokes.find(invoke => invoke.command === "provideOffer");
            expect(offer?.fields.audioStreams).to.equal(undefined);
        });

        it("tells a caller that asked for audio why a sendonly audio section left it none", async () => {
            const { manager } = allocatingManager();
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: AUDIO_SENDONLY_OFFER,
                    video: {},
                    audio: { codecs: ["OPUS"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("offer");
            expect(detail.track).to.equal("audio");
        });

        it("puts no video track in a session whose offer carries no video section", async () => {
            // An answer carries the m-lines of the offer it answers and no others (RFC 3264 §6), so a
            // stream allocated for a section that is not there could never be attached to anything.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: AUDIO_ONLY_OFFER,
            });
            expect(session.video).to.equal(undefined);
            expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(false);
            const offer = invokes.find(invoke => invoke.command === "provideOffer");
            expect(offer?.fields.videoStreams).to.equal(undefined);
            expect(offer?.fields.audioStreams).to.deep.equal([4]);
        });

        it("names the missing section in the log when a deferred track is left out for it", async () => {
            // A deferred track resolves to null with nothing else in the response to explain it.
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const messages = await logged(() =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: AUDIO_ONLY_OFFER,
                }),
            );
            expect(messages.some(message => message.includes("the offer carries no video section"))).to.equal(true);
        });

        it("tells a caller that asked for video why an offer with no video section left it none", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: AUDIO_ONLY_OFFER,
                    video: { codecs: ["H265"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("offer");
            expect(detail.track).to.equal("video");
            expect(detail.requested).to.deep.equal(["H265"]);
            expect(invokes.some(invoke => invoke.command === "provideOffer")).to.equal(false);
        });

        it("puts no audio track in a session whose offer carries no audio section", async () => {
            const { manager, invokes } = allocatingManager();
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
            });
            expect(session.audio).to.equal(undefined);
            expect(invokes.some(invoke => invoke.command === "audioStreamAllocate")).to.equal(false);
        });

        it("tells a caller that asked for audio why an offer with no audio section left it none", async () => {
            const { manager } = allocatingManager();
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                    audio: { codecs: ["OPUS"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("offer");
            expect(detail.track).to.equal("audio");
        });

        it("allocates both tracks when there is no offer to answer", async () => {
            // SolicitOffer: the camera writes the m-lines, so nothing has stated that a kind cannot
            // be carried. A missing section only refuses a track when there is an offer it is
            // missing from.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "solicitOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                video: { codecs: ["H265"] },
                audio: { codecs: ["OPUS"] },
            });
            expect(session.mode).to.equal("solicit_offer");
            expect(session.video?.streamId).to.equal(9);
            expect(session.audio?.streamId).to.equal(4);
            expect(invokes.some(invoke => invoke.command === "solicitOffer")).to.equal(true);
        });

        it("names the establishing connection as the signalling owner of a tracked session", async () => {
            const { manager } = allocatingManager();
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            expect([...(manager.signallingOwners(NODE, ENDPOINT, session.webRtcSessionId) ?? [])]).to.deep.equal([
                "conn-1",
            ]);
            // A session on the same camera that this server holds no record of names no owner, which
            // is what the WebSocket route reads as "every opted-in connection".
            expect(manager.signallingOwners(NODE, ENDPOINT, session.webRtcSessionId + 1)).to.equal(undefined);
        });

        it("names no owner while a session is being established on that camera", async () => {
            // A session being established is not an owner of every id the registry does not know:
            // naming it would withhold a raw-route client's own signalling for as long as any
            // camera_start_stream runs on the camera. What such a rule would buy is one window, since
            // WebRtcTransportRequestorServer answers NotFound for signalling naming a session it has
            // not stored — Offer included — so an event can only arrive for a session already
            // registered with the local requestor.
            let ownersWhileEstablishing: ReadonlySet<string> | undefined;
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "solicitOffer") {
                    ownersWhileEstablishing = manager.signallingOwners(NODE, ENDPOINT, 42);
                    return { webRtcSessionId: 42 };
                }
                return undefined;
            });
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-7",
                streamUsage: LIVE_VIEW,
                video: {},
                audio: false,
            });
            expect(ownersWhileEstablishing).to.equal(undefined);
            expect([...(manager.signallingOwners(NODE, ENDPOINT, session.webRtcSessionId) ?? [])]).to.deep.equal([
                "conn-7",
            ]);
        });

        it("references the resolved stream ids in the provider offer", async () => {
            const { manager, invokes } = allocatingManager();
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            expect(session.webRtcSessionId).to.equal(42);
            const offer = invokes.find(invoke => invoke.command === "provideOffer");
            expect(offer?.fields.videoStreams).to.deep.equal([9]);
        });

        /** Messages the camera manager logged while `work` ran. */
        async function logged(work: () => Promise<unknown>): Promise<string[]> {
            const captured = new Array<string>();
            const destination = Logger.destinations.default;
            const original = destination.add;
            destination.add = message => {
                if (message.facility === "CameraStreamManager") {
                    captured.push(message.values.map(value => String(value)).join(" "));
                }
                original.call(destination, message);
            };
            try {
                await work();
            } finally {
                destination.add = original;
            }
            return captured;
        }

        it("reports an offer asking for talkback on a camera that does not support it", async () => {
            // The camera never receives that audio and nothing in the response says so, so the log is
            // the only place the mismatch is visible.
            const { manager } = allocatingManager();
            const messages = await logged(() =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: TALKBACK_OFFER,
                    video: {},
                    audio: false,
                }),
            );
            expect(messages.some(message => message.includes("TwoWayTalkSupport"))).to.equal(true);
        });

        it("reports the talkback mismatch on a session that does negotiate audio", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const messages = await logged(() =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: TALKBACK_OFFER,
                    video: {},
                }),
            );
            expect(messages.some(message => message.includes("TwoWayTalkSupport"))).to.equal(true);
        });

        it("says nothing about talkback when the offer does not ask for it", async () => {
            const { manager } = allocatingManager();
            const messages = await logged(() =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                    audio: false,
                }),
            );
            expect(messages.some(message => message.includes("TwoWayTalkSupport"))).to.equal(false);
        });

        it("says nothing about talkback when the camera supports one direction at a time", async () => {
            // HalfDuplex is talkback support, so an offer asking for it is served, not reported.
            const { manager } = managerWith(
                { ...STATE, twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.HalfDuplex },
                async invoke => {
                    if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                    if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                    return undefined;
                },
            );
            const messages = await logged(() =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: TALKBACK_OFFER,
                    video: {},
                    audio: false,
                }),
            );
            expect(messages.some(message => message.includes("TwoWayTalkSupport"))).to.equal(false);
        });

        it("says nothing about talkback when the camera supports it", async () => {
            const { manager } = managerWith(
                { ...STATE, twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex },
                async invoke => {
                    if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                    if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                    return undefined;
                },
            );
            const messages = await logged(() =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: TALKBACK_OFFER,
                    video: {},
                    audio: false,
                }),
            );
            expect(messages.some(message => message.includes("TwoWayTalkSupport"))).to.equal(false);
        });

        it("ends the session without deallocating the stream", async () => {
            const { manager, invokes } = allocatingManager();
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            const ended = await manager.stopStream(NODE, ENDPOINT, 42);
            expect(ended).to.equal(true);
            expect(invokes.map(invoke => invoke.command)).to.include("endSession");
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("tells the owning connection that its session was stopped, whoever stopped it", async () => {
            // `camera_stop_stream` names no connection, by design: the camera's PeerNodeID check is the
            // gate. So the connection that started the session learns of its end nowhere else.
            const { manager } = allocatingManager();
            const announced = endingsOf(manager);
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });

            await manager.stopStream(NODE, ENDPOINT, 42, "conn-2");

            expect(announced).to.deep.equal([
                {
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    webRtcSessionId: 42,
                    ownerId: "conn-1",
                    requestedBy: "conn-2",
                },
            ]);
        });

        it("announces the sessions a closing connection and a shutdown ended, asked for by nobody", async () => {
            let nextSessionId = 42;
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: nextSessionId++ };
                return undefined;
            });
            const announced = endingsOf(manager);
            const start = (connectionId: string) =>
                manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId,
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                    audio: false,
                });
            await start("conn-1");
            await start("conn-2");

            await manager.releaseConnection("conn-1");
            await manager.stopAll();

            // `requestedBy` absent is what tells a route that no client is waiting to hear this.
            expect(announced.map(ended => [ended.webRtcSessionId, ended.ownerId, ended.requestedBy])).to.deep.equal([
                [42, "conn-1", undefined],
                [43, "conn-2", undefined],
            ]);
        });

        it("announces a session it holds no record of with no owner, so every client hears it", async () => {
            // A raw-route session is nobody's as far as this server's records go, and the client
            // driving it is the one that cannot afford to keep signalling into a session that is gone.
            const { manager } = managerWith(STATE);
            const announced = endingsOf(manager);
            expect(await manager.stopStream(NODE, ENDPOINT, 999, "conn-9")).to.equal(true);
            expect(announced).to.deep.equal([
                { nodeId: NODE, endpointId: ENDPOINT, webRtcSessionId: 999, requestedBy: "conn-9" },
            ]);
        });

        it("announces nothing for a session the camera says it does not hold", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "endSession") throw statusError(Status.NotFound);
                return undefined;
            });
            const announced = endingsOf(manager);
            expect(await manager.stopStream(NODE, ENDPOINT, 999)).to.equal(false);
            expect(announced).to.deep.equal([]);
        });

        it("announces nothing while a session is still open because EndSession failed", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") throw statusError(Status.Busy);
                return undefined;
            });
            const announced = endingsOf(manager);
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            let thrown: unknown;
            try {
                await manager.stopStream(NODE, ENDPOINT, 42);
            } catch (error) {
                thrown = error;
            }
            expect(deviceStatusOf(thrown)).to.equal(Status.Busy);
            expect(announced).to.deep.equal([]);
        });

        it("reports the stop even when a listener of the ending throws", async () => {
            // The EndSession has already happened when the ending is announced, so a listener must not
            // be able to turn a stop that did happen into a failure.
            const { manager } = allocatingManager();
            manager.events.sessionEnded.on(() => {
                throw new Error("listener refused");
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(true);
        });

        it("reports the stop of a session it holds no record of even when a listener throws", async () => {
            const { manager } = managerWith(STATE);
            manager.events.sessionEnded.on(() => {
                throw new Error("listener refused");
            });
            expect(await manager.stopStream(NODE, ENDPOINT, 999, "conn-9")).to.equal(true);
        });

        it("does not leave an async listener's rejection unhandled", async () => {
            // Observable.emit awaits an observer that answers with a promise and hands the promise back,
            // so a guard that only catches a synchronous throw leaves an unhandled rejection behind.
            const { manager } = allocatingManager();
            manager.events.sessionEnded.on(async () => {
                await Promise.resolve();
                throw new Error("async listener refused");
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            const messages = await logged(async () => {
                expect(await manager.stopStream(NODE, ENDPOINT, 42, "conn-2")).to.equal(true);
                // The rejection settles a microtask after the emit; an unhandled one would be reported
                // against whatever test is running by then.
                await new Promise(resolve => setImmediate(resolve));
            });
            expect(messages.some(message => message.includes("async listener refused"))).to.equal(true);
        });

        it("announces nothing when the peer is the one that ended the session", async () => {
            // The owner already has it as a webrtc_callback `end`; a second report of the same session
            // ending would leave a client two events to reconcile and no order between them.
            const { manager } = allocatingManager();
            const announced = endingsOf(manager);
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
            expect(announced).to.deep.equal([]);
        });

        it("ends a session the camera holds that this process run never tracked", async () => {
            // The way back after an ungraceful restart: the registry is gone, the camera still holds
            // the session, and only EndSession decrements the stream's ReferenceCount.
            const { manager, invokes } = managerWith(STATE);
            const ended = await manager.stopStream(NODE, ENDPOINT, 999);
            expect(ended).to.equal(true);
            const endSession = invokes.find(invoke => invoke.command === "endSession");
            expect(endSession?.fields.webRtcSessionId).to.equal(999);
            expect(endSession?.nodeId).to.equal(NODE);
        });

        it("reports false for an untracked id the camera answers NotFound for", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "endSession") throw statusError(Status.NotFound);
                return undefined;
            });
            expect(await manager.stopStream(NODE, ENDPOINT, 999)).to.equal(false);
        });

        it("raises any other refusal of an untracked session rather than reporting a stop", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "endSession") throw statusError(Status.Busy);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.stopStream(NODE, ENDPOINT, 999);
            } catch (error) {
                thrown = error;
            }
            expect(deviceStatusOf(thrown)).to.equal(Status.Busy);
        });

        it("leaves a session tracked for another node alone and asks the named node instead", async () => {
            const { manager, invokes } = allocatingManager();
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            const otherNode = NodeId(999);

            await manager.stopStream(otherNode, ENDPOINT, 42);

            const ends = invokes.filter(invoke => invoke.command === "endSession");
            expect(ends.map(invoke => invoke.nodeId)).to.deep.equal([otherNode]);
            // The session on NODE is untouched, so its own stop is still the one that ends it.
            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(true);
        });

        it("leaves a session tracked for another endpoint alone and asks the named endpoint instead", async () => {
            const { manager, invokes } = allocatingManager();
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            const otherEndpoint = EndpointNumber(99);

            await manager.stopStream(NODE, otherEndpoint, 42);

            const ends = invokes.filter(invoke => invoke.command === "endSession");
            expect(ends.map(invoke => invoke.endpointId)).to.deep.equal([otherEndpoint]);
            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(true);
        });

        it("ends only the sessions of the connection that closed", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    return { webRtcSessionId: invoke.fields.__testSessionId ?? 42 };
                }
                return undefined;
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            await manager.releaseConnection("conn-2");
            expect(invokes.map(invoke => invoke.command)).to.not.include("endSession");
            await manager.releaseConnection("conn-1");
            expect(invokes.map(invoke => invoke.command)).to.include("endSession");
        });

        it("stopAll ends every tracked session regardless of owning connection", async () => {
            let nextSessionId = 42;
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: nextSessionId++ };
                return undefined;
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-2",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });

            await manager.stopAll();

            const endedSessionIds = invokes
                .filter(invoke => invoke.command === "endSession")
                .map(invoke => invoke.fields.webRtcSessionId);
            expect(endedSessionIds.sort()).to.deep.equal([42, 43]);
        });

        it("does not let a concurrent startStream evict a session still being established", async () => {
            // The device raises ReferenceCount only at session establishment (simulated in the
            // provideOffer branch below), so call 1's stream reads as unreferenced at the device for
            // the whole resolve -> offer-response window. If startStream released its lock before that
            // window closed, call 2's ResourceExhausted would see an unreferenced, server-owned stream
            // and evict it out from under call 1.
            let videoAllocateCount = 0;
            let sessionCounter = 0;
            let releaseOffer: () => void = () => {};
            const offerGate = new Promise<void>(resolve => {
                releaseOffer = resolve;
            });
            let call1ReachedOffer: () => void = () => {};
            const reachedOffer = new Promise<void>(resolve => {
                call1ReachedOffer = resolve;
            });

            const { manager, invokes, holder } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") {
                    videoAllocateCount += 1;
                    if (videoAllocateCount === 1) {
                        holder.state = {
                            ...(holder.state as CameraState),
                            allocatedVideoStreams: [
                                ...(holder.state as CameraState).allocatedVideoStreams,
                                { ...CONTAINED_STREAM, videoStreamId: 20, referenceCount: 0 },
                            ],
                        };
                        return { videoStreamId: 20 };
                    }
                    // Call 2 asks for a resolution stream 20 cannot cover, and the one-encoder camera
                    // has no room until call 1's stream is confirmed unneeded — fails until attempt 4.
                    if (videoAllocateCount < 4) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 30 };
                }
                if (invoke.command === "provideOffer") {
                    call1ReachedOffer();
                    await offerGate;
                    sessionCounter += 1;
                    holder.state = {
                        ...(holder.state as CameraState),
                        allocatedVideoStreams: (holder.state as CameraState).allocatedVideoStreams.map(stream =>
                            stream.videoStreamId === 20
                                ? { ...stream, referenceCount: stream.referenceCount + 1 }
                                : stream,
                        ),
                    };
                    return { webRtcSessionId: sessionCounter };
                }
                return undefined;
            });

            const first = manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            await reachedOffer; // Call 1 now holds the endpoint lock, blocked inside provideOffer.
            const second = manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-2",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: { minResolution: { width: 2560, height: 1440 }, maxResolution: { width: 2560, height: 1440 } },
                audio: false,
            });

            // Give a genuinely unlocked call 2 many chances to run before call 1 is ever released. A
            // call queued behind the endpoint lock cannot execute any of its own body in this window,
            // no matter how long — its continuation is not scheduled until the lock resolves.
            for (let flush = 0; flush < 20; flush++) {
                await new Promise(resolve => setImmediate(resolve));
            }
            expect(videoAllocateCount).to.equal(1);
            expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(0);

            releaseOffer();
            const [firstSession, secondSession] = await Promise.all([first, second]);
            expect(firstSession.webRtcSessionId).to.be.a("number");
            expect(secondSession.webRtcSessionId).to.be.a("number");
            expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(0);
        });

        it("does not block startStream on a different endpoint while one is mid-establishment", async () => {
            const OTHER_ENDPOINT = EndpointNumber(2);
            let releaseOffer: () => void = () => {};
            const offerGate = new Promise<void>(resolve => {
                releaseOffer = resolve;
            });
            let firstReachedOffer: () => void = () => {};
            const reachedOffer = new Promise<void>(resolve => {
                firstReachedOffer = resolve;
            });

            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 20 };
                if (invoke.command === "provideOffer") {
                    if (invoke.endpointId === ENDPOINT) {
                        firstReachedOffer();
                        await offerGate;
                        return { webRtcSessionId: 1 };
                    }
                    return { webRtcSessionId: 2 };
                }
                return undefined;
            });

            const first = manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            await reachedOffer; // Endpoint ENDPOINT's lock is held, blocked inside provideOffer.
            const second = manager.startStream({
                nodeId: NODE,
                endpointId: OTHER_ENDPOINT,
                connectionId: "conn-2",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
            // Must resolve without waiting for releaseOffer(): a different endpoint's lock, not this one.
            const secondSession = await second;
            expect(secondSession.webRtcSessionId).to.equal(2);
            releaseOffer();
            const firstSession = await first;
            expect(firstSession.webRtcSessionId).to.equal(1);
        });

        async function start(
            manager: CameraStreamManager,
            connectionId = "conn-1",
            nodeId = NODE,
            endpointId = ENDPOINT,
        ) {
            return manager.startStream({
                nodeId,
                endpointId,
                connectionId,
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_OFFER,
                video: {},
                audio: false,
            });
        }

        function endedSessions(invokes: RecordedInvoke[]): Array<{ nodeId: NodeId; webRtcSessionId: unknown }> {
            return invokes
                .filter(invoke => invoke.command === "endSession")
                .map(invoke => ({ nodeId: invoke.nodeId, webRtcSessionId: invoke.fields.webRtcSessionId }));
        }

        it("tracks two cameras that both issue session id 1 as two sessions", async () => {
            const OTHER_NODE = NodeId(6);
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 1 };
                return undefined;
            });
            await start(manager, "conn-1", NODE);
            await start(manager, "conn-2", OTHER_NODE);

            expect(await manager.stopStream(OTHER_NODE, ENDPOINT, 1)).to.equal(true);
            expect(endedSessions(invokes)).to.deep.equal([{ nodeId: OTHER_NODE, webRtcSessionId: 1 }]);

            // The first camera's session is still reachable: the second did not take its place.
            expect(await manager.stopStream(NODE, ENDPOINT, 1)).to.equal(true);
            expect(endedSessions(invokes)).to.deep.equal([
                { nodeId: OTHER_NODE, webRtcSessionId: 1 },
                { nodeId: NODE, webRtcSessionId: 1 },
            ]);
        });

        it("keeps the session tracked when EndSession fails, so a later attempt still reaches it", async () => {
            let endSessionAttempts = 0;
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") {
                    endSessionAttempts += 1;
                    if (endSessionAttempts === 1) throw new Error("device unreachable");
                }
                return undefined;
            });
            await start(manager);

            let thrown: unknown;
            try {
                await manager.stopStream(NODE, ENDPOINT, 42);
            } catch (error) {
                thrown = error;
            }
            expect((thrown as Error).message).to.equal("device unreachable");

            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(true);
            expect(endSessionAttempts).to.equal(2);
        });

        it("reports no session ended, and drops tracking, when the device answers NotFound", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") throw statusError(Status.NotFound);
                return undefined;
            });
            await start(manager);

            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(false);
            await manager.stopAll();
            expect(endedSessions(invokes)).to.have.length(1);
        });

        it("raises on a stop that waits for a failing EndSession the closing connection started", async () => {
            let releaseEnd: () => void = () => {};
            const endGate = new Promise<void>(resolve => {
                releaseEnd = resolve;
            });
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") {
                    await endGate;
                    throw new Error("device unreachable");
                }
                return undefined;
            });
            await start(manager, "conn-1");

            const releasing = manager.releaseConnection("conn-1");
            const stopping = manager.stopStream(NODE, ENDPOINT, 42);
            releaseEnd();

            let thrown: unknown;
            try {
                await stopping;
            } catch (error) {
                thrown = error;
            }
            await releasing;
            expect((thrown as Error | undefined)?.message).to.equal("device unreachable");
            expect(invokes.filter(invoke => invoke.command === "endSession")).to.have.length(1);

            // The rethrow is only safe because the entry survives the failure: the session is still
            // reachable, so the client's retry and the shutdown pass both still find it.
            await manager.stopAll();
            expect(invokes.filter(invoke => invoke.command === "endSession")).to.have.length(2);
        });

        it("forgets a session the peer ended, so shutdown sends no EndSession for it", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                // The peer ended it, so the camera resolves the id to no session of its own.
                if (invoke.command === "endSession") throw statusError(Status.NotFound);
                return undefined;
            });
            await start(manager);

            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(false);
            const afterStop = endedSessions(invokes).length;
            await manager.stopAll();
            expect(endedSessions(invokes)).to.have.length(afterStop);
        });

        async function withTrackedSession(): Promise<CameraStreamManager> {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            await start(manager, "conn-1");
            return manager;
        }

        it("announces a client's own EndSession to the session's owner, naming the connection that asked", async () => {
            const manager = await withTrackedSession();
            const announced = endingsOf(manager);

            expect(manager.endedByClient(NODE, ENDPOINT, 42, "conn-2", true)).to.equal(true);
            expect(announced).to.deep.equal([
                {
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    webRtcSessionId: 42,
                    ownerId: "conn-1",
                    requestedBy: "conn-2",
                },
            ]);
        });

        it("announces to the owner even when the camera denies the session, because it is gone either way", async () => {
            const manager = await withTrackedSession();
            const announced = endingsOf(manager);

            expect(manager.endedByClient(NODE, ENDPOINT, 42, "conn-2", false)).to.equal(true);
            expect(announced).to.have.length(1);
            expect(announced[0]?.ownerId).to.equal("conn-1");
        });

        it("announces nothing for the peer's own End, which the owner already has on webrtc_callback", async () => {
            const manager = await withTrackedSession();
            const announced = endingsOf(manager);

            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
            expect(announced).to.deep.equal([]);
        });

        it("announces a client's EndSession for an untracked session with no owner, so everyone is told", async () => {
            // Nothing names the connection driving such a session, and the client that opened it on
            // the raw route cannot learn it is gone any other way.
            const { manager } = managerWith(STATE);
            const announced = endingsOf(manager);

            expect(manager.endedByClient(NODE, ENDPOINT, 42, "conn-2", true)).to.equal(false);
            expect(announced).to.deep.equal([
                { nodeId: NODE, endpointId: ENDPOINT, webRtcSessionId: 42, requestedBy: "conn-2" },
            ]);
        });

        it("announces nothing for an untracked id the camera denies, which named no session at all", async () => {
            const { manager } = managerWith(STATE);
            const announced = endingsOf(manager);

            expect(manager.endedByClient(NODE, ENDPOINT, 42, "conn-2", false)).to.equal(false);
            expect(announced).to.deep.equal([]);
        });

        it("refuses to track a session the peer ended while the registration was still in flight", async () => {
            // The window this test exists for: the provider has answered the offer and the id has
            // reached the registration, the local requestor is being given the session and can route
            // an `End` for it, and no registry entry names it yet. A peer end emitted anywhere else
            // proves nothing about it.
            const peerEndFoundNoEntry = new Array<boolean>();
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    invoke.sessionEstablishing?.(42);
                    peerEndFoundNoEntry.push(manager.forgetSession(NODE, ENDPOINT, 42) === false);
                    return { webRtcSessionId: 42 };
                }
                // The camera resolves the id to no session of its own: it ended the session itself.
                if (invoke.command === "endSession") throw statusError(Status.NotFound);
                return undefined;
            });

            let thrown: unknown;
            try {
                await start(manager);
            } catch (error) {
                thrown = error;
            }

            expect(peerEndFoundNoEntry).to.deep.equal([true]);
            expect(thrown).to.be.instanceOf(ServerError);
            expect((thrown as ServerError).message).to.contain("was ended before this server could track it");
            // Nothing names the session, so no later pass sends a second EndSession for it, and the
            // failed call gave its stream back.
            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(false);
            expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(1);
        });

        it("refuses to track a session another connection stopped while the registration was in flight", async () => {
            // camera_stop_stream for an id this server holds no entry for still ends it on the camera,
            // so it has to reach the registry the same way the peer's End does. Without that the caller
            // is handed a session another connection has already ended.
            const stopped = new Array<boolean>();
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    invoke.sessionEstablishing?.(42);
                    stopped.push(await manager.stopStream(NODE, ENDPOINT, 42, "conn-2"));
                    return { webRtcSessionId: 42 };
                }
                return undefined;
            });

            let thrown: unknown;
            try {
                await start(manager);
            } catch (error) {
                thrown = error;
            }

            expect(stopped).to.deep.equal([true]);
            expect(thrown).to.be.instanceOf(ServerError);
            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(false);
            expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(1);
        });

        it("tracks a session whose camera ended a different session while the registration was in flight", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    invoke.sessionEstablishing?.(42);
                    manager.forgetSession(NODE, ENDPOINT, 41);
                    return { webRtcSessionId: 42 };
                }
                return undefined;
            });

            expect((await start(manager)).webRtcSessionId).to.equal(42);
            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
        });

        it("tracks a reissued id whose earlier session the peer ended, since that end named an entry", async () => {
            // A camera reissues an id it has freed, so the end of session 42 and a registration about
            // to be answered with 42 can be the same id and different sessions. An end an entry names
            // is the first case: the camera cannot have issued 42 again while it still held it.
            let secondInFlight = false;
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    if (secondInFlight) {
                        invoke.sessionEstablishing?.(42);
                        manager.forgetSession(NODE, ENDPOINT, 42);
                    }
                    return { webRtcSessionId: 42 };
                }
                return undefined;
            });

            await start(manager, "conn-1");
            secondInFlight = true;
            expect((await start(manager, "conn-2")).webRtcSessionId).to.equal(42);
            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
        });

        it("gives back the streams it allocated when the provider call fails", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") throw new Error("provider refused");
                return undefined;
            });

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_AND_AUDIO_OFFER,
                    video: {},
                    audio: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as Error).message).to.equal("provider refused");
            expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(1);
            expect(invokes.filter(invoke => invoke.command === "audioStreamDeallocate")).to.have.length(1);
        });

        it("gives the video stream back when an audio codec the caller stated cannot be served", async () => {
            // The audio failure arrives after the video stream is allocated, so the release path is
            // the only thing keeping the device's ReferenceCount from staying up for good.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                return undefined;
            });

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_AND_AUDIO_OFFER,
                    video: {},
                    audio: { codecs: ["AAC"] },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.reason).to.equal("codec");
            expect(payload.device).to.deep.equal(["OPUS"]);
            expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(1);
        });

        it("fails the whole call when the offer names no video codec the camera supports", async () => {
            const { manager, invokes } = managerWith(STATE, async () => undefined);

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 H264/90000\r\n",
                    video: {},
                    audio: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.reason).to.equal("codec");
            expect(payload.requested).to.deep.equal(["H264"]);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(0);
        });

        it("fails typed rather than invoking the provider with no tracks, when video is declined and the camera has no microphone", async () => {
            const bare: CameraState = { ...STATE, microphoneCapabilities: undefined };
            const { manager, invokes } = managerWith(bare, async () => undefined);

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    video: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("no_media");
            expect(invokes.map(invoke => invoke.command)).to.not.include("solicitOffer");
        });

        it("fails typed rather than invoking the provider with no tracks, when both video and audio are declined", async () => {
            const { manager, invokes } = managerWith(STATE, async () => undefined);

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    video: false,
                    audio: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(invokes.map(invoke => invoke.command)).to.not.include("solicitOffer");
        });

        it("fails typed for an audio hint a mic-less camera cannot serve, rather than treating it as no audio", async () => {
            // Video succeeding must not hide this behind a silent `audio: null`.
            const bare: CameraState = { ...STATE, microphoneCapabilities: undefined };
            const { manager } = managerWith(bare, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                return undefined;
            });

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    video: {},
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("capability");
        });

        it("succeeds audio-only when video is declined and the camera has a microphone", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "solicitOffer") return { webRtcSessionId: 42 };
                return undefined;
            });

            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                video: false,
            });
            expect(session.video).to.equal(undefined);
            expect(session.audio?.streamId).to.equal(4);
        });

        it("gives back the stream it allocated when the provider returns no session id", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                return undefined;
            });

            let thrown: unknown;
            try {
                await start(manager);
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([9]);
        });

        it("leaves a reused stream alone when the provider call fails", async () => {
            const reusable = { ...CONTAINED_STREAM, referenceCount: 0 };
            const { manager, invokes } = managerWith({ ...STATE, allocatedVideoStreams: [reusable] }, async invoke => {
                if (invoke.command === "provideOffer") throw new Error("provider refused");
                return undefined;
            });

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                    },
                    audio: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as Error).message).to.equal("provider refused");
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("reports the provider failure even when giving the stream back fails too", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") throw new Error("provider refused");
                if (invoke.command === "videoStreamDeallocate") throw new Error("deallocate refused");
                return undefined;
            });

            let thrown: unknown;
            try {
                await start(manager);
            } catch (error) {
                thrown = error;
            }
            expect((thrown as Error).message).to.equal("provider refused");

            // The lease outlived the failed deallocate, so the caller can still release the stream;
            // dropping it there would have left an allocation nobody is allowed to touch.
            let released: unknown;
            try {
                await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
            } catch (error) {
                released = error;
            }
            expect((released as Error).message).to.equal("deallocate refused");
        });

        it("ends a session that finished establishing after its connection had closed", async () => {
            let releaseOffer: () => void = () => {};
            const offerGate = new Promise<void>(resolve => {
                releaseOffer = resolve;
            });
            let reachedOffer: () => void = () => {};
            const atOffer = new Promise<void>(resolve => {
                reachedOffer = resolve;
            });
            let releaseEnd: () => void = () => {};
            const endGate = new Promise<void>(resolve => {
                releaseEnd = resolve;
            });
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    reachedOffer();
                    await offerGate;
                    return { webRtcSessionId: 42 };
                }
                if (invoke.command === "endSession") await endGate;
                return undefined;
            });

            // The rejection is captured the moment the call is made: a `try`/`catch` further down would
            // leave it unhandled for as long as this test waits, which makes the test's own outcome
            // depend on when the rejection happens rather than on what the manager did.
            let thrown: unknown;
            const starting = start(manager, "conn-1").then(
                () => undefined,
                error => {
                    thrown = error;
                },
            );
            const announced = endingsOf(manager);
            await atOffer; // The session is registered as in flight and the provider has the request.
            let releaseReturned = false;
            const releasing = manager.releaseConnection("conn-1").then(() => {
                releaseReturned = true;
            });
            releaseOffer();

            for (let flush = 0; flush < 20; flush++) {
                await new Promise(resolve => setImmediate(resolve));
            }
            expect(endedSessions(invokes)).to.deep.equal([{ nodeId: NODE, webRtcSessionId: 42 }]);
            // releaseConnection is what the disconnect path awaits, so it must not report done while
            // the EndSession it is responsible for is still in flight.
            expect(releaseReturned).to.equal(false);

            releaseEnd();
            await starting;
            await releasing;
            expect(releaseReturned).to.equal(true);
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
            // The caller was given an error instead of this stream id, so it can never release the
            // stream itself; ending the session without giving it back leaves the camera holding it.
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([9]);
            // EndSession is what decrements the device's ReferenceCount, so deallocating first would
            // be refused with INVALID_IN_STATE and the stream would stay allocated.
            expect(
                invokes
                    .map(invoke => invoke.command)
                    .filter(command => command === "endSession" || command === "videoStreamDeallocate"),
            ).to.deep.equal(["endSession", "videoStreamDeallocate"]);
            // Nothing is announced for a session that never reached a client: the connection that
            // asked for it is gone, and its own failure answer is the report.
            expect(announced).to.deep.equal([]);
        });

        it("ends a session whose connection closed while the call was still queued for the endpoint", async () => {
            let releaseFirstOffer: () => void = () => {};
            const offerGate = new Promise<void>(resolve => {
                releaseFirstOffer = resolve;
            });
            let firstReachedOffer: () => void = () => {};
            const atOffer = new Promise<void>(resolve => {
                firstReachedOffer = resolve;
            });
            let nextSessionId = 42;
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") {
                    if (nextSessionId === 42) {
                        firstReachedOffer();
                        await offerGate;
                    }
                    return { webRtcSessionId: nextSessionId++ };
                }
                return undefined;
            });

            const first = start(manager, "conn-1");
            await atOffer; // conn-1 holds the endpoint lock.
            // startStream registers before it queues for the lock, so the release below sees this call
            // even though none of its body has run.
            const queued = start(manager, "conn-2");
            const releasing = manager.releaseConnection("conn-2");

            releaseFirstOffer();
            await first;
            let thrown: unknown;
            try {
                await queued;
            } catch (error) {
                thrown = error;
            }
            await releasing;
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
            expect(endedSessions(invokes)).to.deep.equal([{ nodeId: NODE, webRtcSessionId: 43 }]);
        });

        it("sends one EndSession when a connection release and shutdown claim the same session", async () => {
            // Shutdown closes the sockets it then waits on, so the connection's own release and the
            // shutdown pass reach the same session. Two EndSession invokes for one session is the
            // lesser half; the worse half is shutdown returning while the release it collided with is
            // still in flight, which is the thing stopAll exists to prevent.
            let releaseEnd: () => void = () => {};
            const endGate = new Promise<void>(resolve => {
                releaseEnd = resolve;
            });
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") await endGate;
                return undefined;
            });
            await start(manager, "conn-1");

            const releasing = manager.releaseConnection("conn-1");
            let stopReturned = false;
            const stopping = manager.stopAll().then(() => {
                stopReturned = true;
            });
            for (let flush = 0; flush < 20; flush++) {
                await new Promise(resolve => setImmediate(resolve));
            }
            expect(invokes.filter(invoke => invoke.command === "endSession")).to.have.length(1);
            expect(stopReturned).to.equal(false);

            releaseEnd();
            await releasing;
            await stopping;
            expect(stopReturned).to.equal(true);
            expect(invokes.filter(invoke => invoke.command === "endSession")).to.have.length(1);
        });

        it("sends one EndSession when camera_stop_stream races the connection's own release", async () => {
            let releaseEnd: () => void = () => {};
            const endGate = new Promise<void>(resolve => {
                releaseEnd = resolve;
            });
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") await endGate;
                return undefined;
            });
            await start(manager, "conn-1");

            const stopping = manager.stopStream(NODE, ENDPOINT, 42);
            const releasing = manager.releaseConnection("conn-1");
            for (let flush = 0; flush < 20; flush++) {
                await new Promise(resolve => setImmediate(resolve));
            }
            expect(invokes.filter(invoke => invoke.command === "endSession")).to.have.length(1);

            releaseEnd();
            expect(await stopping).to.equal(true);
            await releasing;
            expect(invokes.filter(invoke => invoke.command === "endSession")).to.have.length(1);
        });

        it("ends the remaining sessions at shutdown when one camera refuses EndSession", async () => {
            const OTHER_NODE = NodeId(6);
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession" && invoke.nodeId === NODE) throw new Error("device unreachable");
                return undefined;
            });
            await start(manager, "conn-1", NODE);
            await start(manager, "conn-2", OTHER_NODE);

            await manager.stopAll();

            expect(endedSessions(invokes)).to.deep.equal([
                { nodeId: NODE, webRtcSessionId: 42 },
                { nodeId: OTHER_NODE, webRtcSessionId: 42 },
            ]);
        });
    });

    describe("snapshot", () => {
        it("uses an encoder-free capability while a video stream is referenced", async () => {
            const streaming: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 1,
                    },
                ],
            };
            const { manager, invokes } = managerWith(streaming, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1, 2, 3]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({
                nodeId: NODE,
                endpointId: ENDPOINT,
                maxResolution: { width: 1920, height: 1080 },
            });
            expect(result.resolution).to.deep.equal({ width: 640, height: 480 });
            expect(result.degraded).to.equal(true);
            const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
            expect(allocate?.fields.minResolution).to.deep.equal({ width: 640, height: 480 });
            expect(allocate?.fields.maxResolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("keeps the best capability while a viewer streams on a camera with encoders to spare", async () => {
            // One live stream on a camera that states four encoders leaves three. Reading any live
            // stream as "no encoder left" costs the caller picture size and reports it as a degradation
            // that did not happen.
            const spare: CameraState = {
                ...STATE,
                maxConcurrentEncoders: 4,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 1,
                    },
                ],
            };
            const { manager, invokes } = managerWith(spare, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(result.degraded).to.equal(false);
            const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
            expect(allocate?.fields.minResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(allocate?.fields.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("counts the encoder a snapshot stream of its own holds before the camera reports it", async () => {
            // Two calls in a row on a camera whose report has not caught up: the first takes the one
            // encoder, so the second has to start at the capability that needs none. Reading the
            // reported list alone made the second call ask for the encoder again and be refused.
            const asked = new Array<unknown>();
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") {
                    asked.push(invoke.fields.maxResolution);
                    return { snapshotStreamId: asked.length };
                }
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });

            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });

            expect(asked).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 640, height: 480 },
            ]);
        });

        it("keeps the best capability although the device still lists a snapshot stream", async () => {
            // AllocatedSnapshotStreams is a cached view that lags a deallocate, so the stream the
            // previous camera_snapshot gave back is still listed. Counting it against the encoder
            // budget would clamp this call to a smaller capability and report the loss as a
            // degradation, which is the false report the budget exists to remove.
            const stale: CameraState = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        snapshotStreamId: 8,
                        overlays: NO_OVERLAYS,
                        imageCodec: 0,
                        minResolution: { width: 640, height: 480 },
                        maxResolution: { width: 1920, height: 1080 },
                        referenceCount: 0,
                        frameRate: 1,
                        encodedPixels: false,
                        hardwareEncoder: false,
                    },
                ],
            };
            const { manager, invokes } = managerWith(stale, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(result.degraded).to.equal(false);
            const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
            expect(allocate?.fields.minResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(allocate?.fields.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("uses the highest capability when nothing holds the encoder", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return {
                        data: new Uint8Array([1]),
                        imageCodec: 0,
                        resolution: { width: 1920, height: 1080 },
                    };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(result.degraded).to.equal(false);
            const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
            expect(allocate?.fields.minResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(allocate?.fields.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("fails typed when the caller's resolution ceiling excludes every capability", async () => {
            // Dropping the ceiling returns an image larger than the caller said it can handle.
            const { manager, invokes } = managerWith(STATE, async () => undefined);
            let thrown: unknown;
            try {
                await manager.snapshot({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    maxResolution: { width: 100, height: 100 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("bounds");
            expect(invokes).to.have.length(0);
        });

        it("says the camera has no snapshot capability rather than blaming the caller's bounds", async () => {
            // "bounds" tells a client to relax what it asked for; there is nothing to relax here, so
            // it would retry forever against a camera that can never answer.
            const { manager, invokes } = managerWith({ ...STATE, snapshotCapabilities: [] }, async () => undefined);
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("capability");
            expect(invokes).to.have.length(0);
        });

        it("names the image codecs it reports in a snapshot failure, once each", async () => {
            const { manager } = managerWith(STATE, async () => undefined);
            let thrown: unknown;
            try {
                await manager.snapshot({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    codec: CameraAvStreamManagement.ImageCodec.Heic,
                });
            } catch (error) {
                thrown = error;
            }
            const payload = JSON.parse((thrown as ServerError).message);
            expect(payload.device).to.deep.equal(["JPEG"]);
            expect(payload.requested).to.deep.equal(["HEIC"]);
        });

        it("reports a codec failure when no capability uses the requested codec", async () => {
            const { manager } = managerWith(STATE, async () => undefined);
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT, codec: 7 });
            } catch (error) {
                thrown = error;
            }
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("codec");
        });

        it("reports a bounds failure when a ceiling excludes every capability of the requested codec", async () => {
            const { manager } = managerWith(STATE, async () => undefined);
            let thrown: unknown;
            try {
                await manager.snapshot({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    codec: 0,
                    maxResolution: { width: 100, height: 100 },
                });
            } catch (error) {
                thrown = error;
            }
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("bounds");
        });

        function snapshotStatusError(status: number): Error & { code: number } {
            const error = new Error(`Device returned status ${status}`) as Error & { code: number };
            error.code = status;
            return error;
        }

        it("tries the next capability when the device matches none against the one it was offered", async () => {
            const allocates = new Array<unknown>();
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") {
                    allocates.push(invoke.fields.minResolution);
                    if (allocates.length === 1) throw snapshotStatusError(Status.DynamicConstraintError);
                    return { snapshotStreamId: 3 };
                }
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(allocates).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 640, height: 480 },
            ]);
        });

        it("fails typed without retrying when the device calls the snapshot request invalid", async () => {
            const allocateAttempts = new Array<unknown>();
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command !== "snapshotStreamAllocate") return undefined;
                allocateAttempts.push(invoke.fields);
                throw snapshotStatusError(Status.ConstraintError);
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            expect(JSON.parse((thrown as ServerError).message).device_status).to.equal(Status.ConstraintError);
            expect(allocateAttempts).to.have.length(1);
        });

        it("fails typed rather than raw when no capability survives the device's capacity", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command !== "snapshotStreamAllocate") return undefined;
                throw snapshotStatusError(Status.ResourceExhausted);
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
        });

        it("fails typed when the device refuses the capture itself", async () => {
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") throw snapshotStatusError(Status.ResourceExhausted);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
        });

        it("propagates a snapshot rejection the ladder does not know how to react to", async () => {
            const UNSUPPORTED = 0x81; // INVALID_ACTION, not one the ladder special-cases.
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command !== "snapshotStreamAllocate") return undefined;
                throw snapshotStatusError(UNSUPPORTED);
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as { code: number }).code).to.equal(UNSUPPORTED);
        });

        it("tries an encoder-using capability once the device refuses every encoder-free one", async () => {
            // A live stream holds the camera's only encoder, so the encoder-free 640x480 capability
            // is preferred. The device refuses it anyway — the reference count this server reads is
            // subscription-backed and lags — and the 1920x1080 capability the caller's bounds allow
            // is what is left. Narrowing the ladder to the encoder-free entries failed the call here.
            const streaming: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 1,
                    },
                ],
            };
            const attempted = new Array<Resolution>();
            const { manager } = managerWith(streaming, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") {
                    const fields = invoke.fields as { minResolution: Resolution };
                    attempted.push(fields.minResolution);
                    if (attempted.length === 1) throw snapshotStatusError(Status.DynamicConstraintError);
                    return { snapshotStreamId: 3 };
                }
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(attempted).to.deep.equal([
                { width: 640, height: 480 },
                { width: 1920, height: 1080 },
            ]);
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(result.snapshotStreamId).to.equal(3);
            // 1920x1080 is the largest the caller's own bounds allowed, so reaching it through the
            // encoder rung is not a degradation.
            expect(result.degraded).to.equal(false);
        });

        it("keeps a capability that needs no hardware encoder while a video stream is live", async () => {
            // requiresEncodedPixels with requiresHardwareEncoder false takes no encoder, so filtering
            // on requiresEncodedPixels alone would drop the best capability the camera can still serve.
            const softwareEncoded: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 1,
                    },
                ],
                snapshotCapabilities: [
                    { ...STATE.snapshotCapabilities[1], requiresHardwareEncoder: false },
                    STATE.snapshotCapabilities[0],
                ],
            };
            const { manager } = managerWith(softwareEncoded, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            // The live stream cost this caller nothing: 1920x1080 is the largest the camera offers and
            // it needs no encoder, so reporting a degradation would be a false alarm.
            expect(result.degraded).to.equal(false);
        });

        it("reports a degradation when the device refuses the best capability and the next one is smaller", async () => {
            // Nothing holds the encoder here: the caller still received a 640x480 frame in place of
            // the 1920x1080 its bounds allowed.
            let allocateAttempts = 0;
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") {
                    allocateAttempts += 1;
                    if (allocateAttempts === 1) throw statusError(Status.DynamicConstraintError);
                    return { snapshotStreamId: 3 };
                }
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 640, height: 480 });
            expect(result.degraded).to.equal(true);
        });

        it("gives the snapshot stream back when the capture fails", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    const error = new Error("no capacity") as Error & { code: number };
                    error.code = Status.ResourceExhausted;
                    throw error;
                }
                return undefined;
            });

            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            // The caller never learned the id, so this is the only chance to release it.
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([3]);
        });

        it("names the stream it allocated at a capability that holds the hardware encoder", async () => {
            // STATE's best capability requires the hardware encoder. The stream stays on the camera:
            // a deallocate here could be sent but never awaited to an outcome the answer can state,
            // so the answer would name a stream a late landing may already have removed.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.snapshotStreamId).to.equal(3);
            expect(invokes.map(invoke => invoke.command)).to.not.contain("snapshotStreamDeallocate");
        });

        it("adopts the encoder-holding stream it left behind on the next call", async () => {
            // The stream stays, so the second call captures from it instead of allocating a twin
            // that single-encoder hardware would refuse.
            const { manager, holder, invokes } = managerWith(
                { ...STATE, allocatedSnapshotStreams: [] },
                async invoke => {
                    if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                    if (invoke.command === "captureSnapshot") {
                        return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                    }
                    return undefined;
                },
            );
            const first = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            holder.state = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        snapshotStreamId: first.snapshotStreamId,
                        overlays: NO_OVERLAYS,
                        imageCodec: 0,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        referenceCount: 0,
                        frameRate: 1,
                        encodedPixels: false,
                        hardwareEncoder: false,
                    },
                ],
            };
            const second = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(second.snapshotStreamId).to.equal(first.snapshotStreamId);
            expect(invokes.filter(invoke => invoke.command === "snapshotStreamAllocate").length).to.equal(1);
            expect(invokes.map(invoke => invoke.command)).to.not.contain("snapshotStreamDeallocate");
        });

        it("counts a snapshot stream the camera says holds the encoder before choosing a capability", async () => {
            // The kept stream is what takes the camera's only encoder, and the camera states that per
            // stream. Reading past it picks the 1080p capability, which the camera must then refuse
            // for lack of capacity; on hardware whose every capability needs the encoder there is no
            // rung below it to walk down to. Its range reaches below 1080p, so it is adoptable only
            // once the encoder count has narrowed the choice to the 640x480 capability.
            const encoderTaken: CameraState = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        snapshotStreamId: 8,
                        overlays: NO_OVERLAYS,
                        imageCodec: 0,
                        minResolution: { width: 640, height: 480 },
                        maxResolution: { width: 1920, height: 1080 },
                        referenceCount: 0,
                        frameRate: 1,
                        encodedPixels: false,
                        hardwareEncoder: true,
                    },
                ],
            };
            const { manager, invokes } = managerWith(encoderTaken, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") throw statusError(Status.ResourceExhausted);
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["captureSnapshot"]);
            expect(result.snapshotStreamId).to.equal(8);
            expect(result.degraded).to.equal(true);
        });

        it("names an adopted stream although the camera's best capability needs the encoder", async () => {
            // Adoption reads AllocatedSnapshotStreams, which states no encoder flag, so it cannot
            // tell such a stream apart. Naming it is right anyway: this call allocated nothing and
            // gives nothing back, so the stream is still there when the answer is sent, and the id
            // is the only way a client can free the encoder it holds.
            const existing: CameraState = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        snapshotStreamId: 8,
                        overlays: NO_OVERLAYS,
                        imageCodec: 0,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        referenceCount: 0,
                        frameRate: 1,
                        encodedPixels: false,
                        hardwareEncoder: false,
                    },
                ],
            };
            const { manager, invokes } = managerWith(existing, async invoke => {
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.snapshotStreamId).to.equal(8);
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["captureSnapshot"]);
        });

        it("gives a kept-capability stream back when the capture fails", async () => {
            // A failed call answers with no stream id, so nothing the caller holds could free this
            // one. Only a call that returns keeps its stream.
            const softwareOnly: CameraState = { ...STATE, snapshotCapabilities: [STATE.snapshotCapabilities[0]] };
            const { manager, invokes } = managerWith(softwareOnly, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") throw new Error("capture refused");
                return undefined;
            });
            await expect(manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT })).to.be.rejected;
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([3]);
        });

        it("names the stream it kept, and releases that same id on request", async () => {
            // A kept stream is on the camera until someone frees it, and on a camera whose allocation
            // report lags it is reachable through no other command.
            const softwareOnly: CameraState = { ...STATE, snapshotCapabilities: [STATE.snapshotCapabilities[0]] };
            const { manager, invokes } = managerWith(softwareOnly, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.snapshotStreamId).to.equal(3);
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["snapshotStreamAllocate", "captureSnapshot"]);

            await manager.releaseStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                kind: "snapshot",
                streamId: result.snapshotStreamId ?? 0,
            });
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([3]);
        });

        /** A snapshot stream the device already lists, at the camera's largest capability. */
        const EXISTING_SNAPSHOT_STREAM = {
            snapshotStreamId: 8,
            overlays: NO_OVERLAYS,
            imageCodec: 0,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            referenceCount: 0,
            frameRate: 1,
            encodedPixels: false,
            hardwareEncoder: false,
        };

        it("captures from a snapshot stream the device already holds rather than allocating one", async () => {
            // Allocating one per call is the churn the cluster asks controllers to avoid, and every
            // allocate competes for the encoders the livestream needs. Who allocated the stream does
            // not enter into it: CaptureSnapshot names any allocated stream.
            const existing: CameraState = { ...STATE, allocatedSnapshotStreams: [EXISTING_SNAPSHOT_STREAM] };
            const { manager, invokes } = managerWith(existing, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["captureSnapshot"]);
            expect(invokes[0]?.fields.snapshotStreamId).to.equal(8);
            expect(result.degraded).to.equal(false);
            // Nothing in this call deallocates the adopted stream, so the caller may release it.
            expect(result.snapshotStreamId).to.equal(8);
        });

        it("does not adopt a stream whose range reaches below the capability it would allocate", async () => {
            // The ceiling states what the frame may be, not what it will be: the camera may answer with
            // any size in the stream's range (§11.2.8.13.3), so the floor is what has to cover the
            // capability. Adopting on the ceiling would hand back a smaller frame than allocating.
            const ranged: CameraState = {
                ...STATE,
                allocatedSnapshotStreams: [{ ...EXISTING_SNAPSHOT_STREAM, minResolution: { width: 640, height: 480 } }],
            };
            const { manager, invokes } = managerWith(ranged, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.include("snapshotStreamAllocate");
            expect(invokes.find(invoke => invoke.command === "captureSnapshot")?.fields.snapshotStreamId).to.equal(3);
        });

        it("reports the degradation from the frame the device delivered, not from the stream it used", async () => {
            // The response reports what arrived. A device that answers below the size it was asked for
            // is out of spec, and the caller still needs to know the frame is small.
            const existing: CameraState = { ...STATE, allocatedSnapshotStreams: [EXISTING_SNAPSHOT_STREAM] };
            const { manager } = managerWith(existing, async invoke => {
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 640, height: 480 });
            expect(result.degraded).to.equal(true);
        });

        it("allocates rather than adopting a stream smaller than the capability it would have used", async () => {
            // Adoption saves an allocate; it may not cost the caller picture size to do so.
            const existing: CameraState = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        ...EXISTING_SNAPSHOT_STREAM,
                        minResolution: { width: 640, height: 480 },
                        maxResolution: { width: 640, height: 480 },
                    },
                ],
            };
            const { manager, invokes } = managerWith(existing, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["snapshotStreamAllocate", "captureSnapshot"]);
        });

        it("refuses to adopt a stream above the resolution ceiling the caller stated", async () => {
            const existing: CameraState = { ...STATE, allocatedSnapshotStreams: [EXISTING_SNAPSHOT_STREAM] };
            const { manager, invokes } = managerWith(existing, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            await manager.snapshot({
                nodeId: NODE,
                endpointId: ENDPOINT,
                maxResolution: { width: 640, height: 480 },
            });
            expect(invokes.map(invoke => invoke.command)).to.include("snapshotStreamAllocate");
            expect(invokes.find(invoke => invoke.command === "captureSnapshot")?.fields.snapshotStreamId).to.equal(3);
        });

        it("allocates when the device answers NotFound for the stream its reported state still lists", async () => {
            // Device state is a cached view, so a stream it lists may have been deallocated since.
            // The device's own answer is the only statement about that worth acting on.
            const existing: CameraState = { ...STATE, allocatedSnapshotStreams: [EXISTING_SNAPSHOT_STREAM] };
            const { manager, invokes } = managerWith(existing, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    if (invoke.fields.snapshotStreamId === 8) throw statusError(Status.NotFound);
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal([
                "captureSnapshot",
                "snapshotStreamAllocate",
                "captureSnapshot",
            ]);
            expect(result.data).to.deep.equal(new Uint8Array([1]));
        });

        it("leaves a snapshot stream in place when its capability needs no hardware encoder", async () => {
            // Such a stream holds none of MaxConcurrentEncoders, so keeping it costs the livestream
            // nothing and the next call adopts it instead of allocating again.
            const encoderFreeOnly: CameraState = {
                ...STATE,
                snapshotCapabilities: [
                    {
                        resolution: { width: 640, height: 480 },
                        maxFrameRate: 1,
                        imageCodec: 0,
                        requiresEncodedPixels: false,
                        requiresHardwareEncoder: false,
                    },
                ],
                allocatedSnapshotStreams: [],
            };
            const { manager, invokes } = managerWith(encoderFreeOnly, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["snapshotStreamAllocate", "captureSnapshot"]);
        });

        it("keeps the snapshot stream releasable by the id the answer named", async () => {
            const { manager } = probeWith({ ...STATE, allocatedSnapshotStreams: [] }, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(manager.endpointsWithLeases).to.equal(1);

            await manager.releaseStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                kind: "snapshot",
                streamId: result.snapshotStreamId,
            });
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("gives the snapshot stream back when the capture response is unusable", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") return { imageCodec: 0 };
                return undefined;
            });

            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([3]);
        });
    });

    describe("camera_not_supported", () => {
        it("reports a missing WebRTC provider cluster rather than allocating a stream first", async () => {
            const { manager, invokes } = managerWith(STATE, async () => ({ videoStreamId: 9 }), [
                WebRtcTransportProvider.Cluster.id,
            ]);
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                    audio: false,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraNotSupported);
            expect(JSON.parse((thrown as ServerError).message).missing_clusters).to.deep.equal([
                WebRtcTransportProvider.Cluster.id,
            ]);
            expect(invokes).to.deep.equal([]);
        });

        it("reports both clusters when the endpoint exposes neither", async () => {
            let thrown: unknown;
            try {
                await managerWith(undefined).manager.getCapabilities(NODE, ENDPOINT);
            } catch (error) {
                thrown = error;
            }
            expect(JSON.parse((thrown as ServerError).message).missing_clusters).to.deep.equal([
                CameraAvStreamManagement.Cluster.id,
                WebRtcTransportProvider.Cluster.id,
            ]);
        });
    });

    describe("releaseStream", () => {
        it("refuses to release a stream the device still references, naming the count it read", async () => {
            const referenced: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 1,
                    },
                ],
            };
            const { manager, invokes } = managerWith(referenced, async () => {
                throw statusError(Status.InvalidInState);
            });
            let thrown: unknown;
            try {
                await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamInUse);
            expect(JSON.parse((thrown as ServerError).message)).to.deep.equal({
                message: "Stream is in use and cannot be released",
                stream_id: 1,
                reference_count: 1,
            });
            // The camera decides, so the deallocate goes out even for a count the server reads as
            // nonzero: a count behind the device would otherwise refuse a release it would accept.
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamDeallocate"]);
        });

        it("releases a stream the server reads as referenced when the camera accepts it", async () => {
            const stale: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 2,
                    },
                ],
            };
            const { manager, invokes } = managerWith(stale);
            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamDeallocate"]);
        });

        it("releases a stream the server did not allocate, because the camera allows it", async () => {
            const foreign: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 0,
                    },
                ],
            };
            const { manager, invokes } = managerWith(foreign);
            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamDeallocate"]);
            expect(invokes[0]?.fields).to.deep.equal({ videoStreamId: 1 });
        });

        it("answers the camera's own INVALID_IN_STATE with the in-use error, not the generic one", async () => {
            // The cached count is 0 and the camera disagrees: the state a subscription feeds can be
            // behind a reference another controller took. Without the mapping the handler sees a
            // plain device error and answers error_code 0, for the fact the API documents as 104.
            const stale: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 0,
                    },
                ],
            };
            const { manager } = managerWith(stale, async () => {
                throw statusError(Status.InvalidInState);
            });
            let thrown: unknown;
            try {
                await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            } catch (error) {
                thrown = error;
            }
            // `instanceof ServerError` is what WebSocketControllerHandler reads for `error_code`, so
            // anything else here is the 0 this test exists to rule out.
            expect(thrown).to.be.instanceOf(ServerError);
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamInUse);
            expect(JSON.parse((thrown as ServerError).message)).to.deep.equal({
                message: "Stream is in use and cannot be released",
                stream_id: 1,
            });
            // A camera answering INVALID_IN_STATE for a reason of its own is indistinguishable from
            // a reference-count refusal unless its own error stays reachable.
            expect(deviceStatusOf((thrown as ServerError).cause)).to.equal(Status.InvalidInState);
        });

        it("forwards the camera's own refusal rather than deciding for it", async () => {
            const foreign: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
                        overlays: NO_OVERLAYS,
                        streamUsage: 0,
                        videoCodec: H265,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 0,
                    },
                ],
            };
            const { manager } = managerWith(foreign, async () => {
                throw statusError(Status.DynamicConstraintError);
            });
            let thrown: unknown;
            try {
                await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            } catch (error) {
                thrown = error;
            }
            expect(deviceStatusOf(thrown)).to.equal(Status.DynamicConstraintError);
        });
    });

    describe("leases", () => {
        const FOREIGN_STREAM = {
            videoStreamId: 7,
            overlays: NO_OVERLAYS,
            streamUsage: 1,
            videoCodec: 0,
            minResolution: { width: 320, height: 240 },
            maxResolution: { width: 320, height: 240 },
            minFrameRate: 1,
            maxFrameRate: 5,
            minBitRate: 100000,
            maxBitRate: 200000,
            referenceCount: 0,
        };

        /**
         * The bounds that make FOREIGN_STREAM reusable for an unhinted LiveView request.
         *
         * The bit-rate range is part of that: the computed envelope for this camera runs from the
         * trade-off point's 800 kbit/s to MaxNetworkBandwidth, and a stream outside it reaches only
         * the degraded rung.
         */
        const CONTAINED_FOREIGN = {
            streamUsage: LIVE_VIEW,
            videoCodec: H265,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
        };

        it("holds no entry for an endpoint whose last lease is gone", async () => {
            const { manager } = probeWith({ ...STATE, allocatedVideoStreams: [] }, async invoke =>
                invoke.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined,
            );
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(manager.endpointsWithLeases).to.equal(1);

            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("leases a foreign stream it hands out, without claiming to own it", async () => {
            // The lease map records every stream this server handed out, so a reuse decision can be
            // made from it rather than from device state that lags the allocation.
            const reusable = { ...FOREIGN_STREAM, ...CONTAINED_FOREIGN };
            const { manager, invokes } = probeWith(
                { ...STATE, allocatedVideoStreams: [reusable] },
                async () => undefined,
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.reused).to.equal(true);
            expect(resolved.allocatedByUs).to.equal(false);
            expect(manager.endpointsWithLeases).to.equal(1);
            expect(invokes).to.deep.equal([]);
        });

        it("releases a foreign stream it leased for reuse, without ever having owned it", async () => {
            const reusable = { ...FOREIGN_STREAM, ...CONTAINED_FOREIGN };
            const { manager, invokes } = probeWith(
                { ...STATE, allocatedVideoStreams: [reusable] },
                async () => undefined,
            );
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.allocatedByUs).to.equal(false);

            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 7 });
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
        });

        it("leases a foreign audio stream it hands out", async () => {
            const foreignAudio = {
                audioStreamId: 4,
                streamUsage: LIVE_VIEW,
                audioCodec: 0,
                channelCount: 1,
                sampleRate: 48000,
                bitRate: 64000,
                bitDepth: 16,
                referenceCount: 1,
            };
            const { manager } = probeWith({ ...STATE, allocatedAudioStreams: [foreignAudio] }, async () => undefined);
            const resolved = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(resolved?.allocatedByUs).to.equal(false);
            expect(manager.endpointsWithLeases).to.equal(1);
        });

        it("leases nothing when the only stream left has a usage the caller did not ask for", async () => {
            const otherUsage = { ...FOREIGN_STREAM, ...CONTAINED_FOREIGN, streamUsage: 1, referenceCount: 1 };
            const { manager } = probeWith({ ...STATE, allocatedVideoStreams: [otherUsage] }, async () => {
                throw statusError(Status.ResourceExhausted);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("leases a foreign stream the degraded rung hands out", async () => {
            const busy = {
                ...FOREIGN_STREAM,
                ...CONTAINED_FOREIGN,
                referenceCount: 1,
                maxResolution: { width: 3840, height: 2160 },
            };
            const { manager } = probeWith({ ...STATE, allocatedVideoStreams: [busy] }, async () => {
                throw statusError(Status.ResourceExhausted);
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.degraded).to.equal(true);
            expect(resolved.allocatedByUs).to.equal(false);
            expect(manager.endpointsWithLeases).to.equal(1);
        });

        it("treats a stream id reissued to a fresh allocation as its own", async () => {
            // The device reuses an id once the stream it named is deallocated. A lease still saying the
            // id is foreign would make the stream this server just allocated unreleasable.
            const reusable = { ...FOREIGN_STREAM, ...CONTAINED_FOREIGN };
            const { manager, holder } = probeWith({ ...STATE, allocatedVideoStreams: [reusable] }, async invoke =>
                invoke.command === "videoStreamAllocate" ? { videoStreamId: 7 } : undefined,
            );
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });

            holder.state = { ...STATE, allocatedVideoStreams: [] };
            const fresh = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(fresh.streamId).to.equal(7);
            expect(fresh.allocatedByUs).to.equal(true);

            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 7 });
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("still calls a stream its own when a later request reuses it rather than allocating", async () => {
            // Every other reuse assertion in this file names a stream the server did not allocate.
            const { manager, holder, invokes } = probeWith({ ...STATE, allocatedVideoStreams: [] }, async invoke =>
                invoke.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined,
            );
            const allocated = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(allocated.reused).to.equal(false);

            holder.state = {
                ...STATE,
                allocatedVideoStreams: [{ ...FOREIGN_STREAM, ...CONTAINED_FOREIGN, videoStreamId: 9 }],
            };
            const reused = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(reused.streamId).to.equal(9);
            expect(reused.reused).to.equal(true);
            expect(reused.allocatedByUs).to.equal(true);
            expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamAllocate"]);
        });

        it("does not stand in for a device report of a stream it only reused", async () => {
            // A foreign stream was read out of device state, so device state is the only evidence it
            // ever had. Shadowing it would hand the next request a stream the camera has dropped.
            const reusable = { ...FOREIGN_STREAM, ...CONTAINED_FOREIGN };
            const { manager, holder } = probeWith({ ...STATE, allocatedVideoStreams: [reusable] }, async invoke =>
                invoke.command === "videoStreamAllocate" ? { videoStreamId: 11 } : undefined,
            );
            const first = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(first.streamId).to.equal(7);

            holder.state = { ...STATE, allocatedVideoStreams: [] };
            const second = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(second.streamId).to.equal(11);
            expect(second.reused).to.equal(false);
        });

        it("drops the lease for a foreign stream once the device stops naming it", async () => {
            // A stream read out of device state is reported by definition, so its disappearance is the
            // camera having dropped it and the lease has nothing left to describe.
            const reusable = { ...FOREIGN_STREAM, ...CONTAINED_FOREIGN };
            const { manager, holder } = probeWith(
                { ...STATE, allocatedVideoStreams: [reusable] },
                async () => undefined,
            );
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(manager.endpointsWithLeases).to.equal(1);

            holder.state = { ...STATE, allocatedVideoStreams: [] };
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("drops a video lease once the device has named the stream and then stops", async () => {
            const { manager, holder } = probeWith({ ...STATE, allocatedVideoStreams: [] }, async invoke =>
                invoke.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined,
            );
            const allocated = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            const envelope = requireVideoEnvelope(allocated.envelope);
            holder.state = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 9,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: envelope.codec,
                        minResolution: envelope.minResolution,
                        maxResolution: envelope.maxResolution,
                        minFrameRate: envelope.minFrameRate,
                        maxFrameRate: envelope.maxFrameRate,
                        minBitRate: envelope.minBitRate,
                        maxBitRate: envelope.maxBitRate,
                        referenceCount: 0,
                    },
                ],
            };
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(1);

            holder.state = { ...STATE, allocatedVideoStreams: [] };
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("drops an audio lease once the device has named the stream and then stops", async () => {
            const { manager, holder } = probeWith({ ...STATE, allocatedAudioStreams: [] }, async invoke =>
                invoke.command === "audioStreamAllocate" ? { audioStreamId: 4 } : undefined,
            );
            const allocated = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            if (allocated === undefined) throw new Error("expected an allocated audio stream");
            const envelope = requireAudioEnvelope(allocated.envelope);
            holder.state = {
                ...STATE,
                allocatedAudioStreams: [
                    {
                        audioStreamId: 4,
                        streamUsage: LIVE_VIEW,
                        audioCodec: envelope.codec,
                        channelCount: envelope.channelCount,
                        sampleRate: envelope.sampleRate,
                        bitRate: envelope.bitRate,
                        bitDepth: envelope.bitDepth,
                        referenceCount: 0,
                    },
                ],
            };
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(1);

            holder.state = { ...STATE, allocatedAudioStreams: [] };
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("leases the snapshot stream it allocated at a capability that holds the hardware encoder", async () => {
            const { manager } = probeWith({ ...STATE, allocatedSnapshotStreams: [] }, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(manager.endpointsWithLeases).to.equal(1);
        });

        it("holds no entry for an endpoint that only ever gave up a foreign stream", async () => {
            // The ladder deallocates the foreign stream to make room and drops a lease that never
            // existed; every allocate fails, so nothing of ours is ever leased on this endpoint.
            const { manager, invokes } = probeWith(
                { ...STATE, allocatedVideoStreams: [FOREIGN_STREAM] },
                async invoke => {
                    if (invoke.command === "videoStreamAllocate") {
                        const error = new Error("no capacity") as Error & { code: number };
                        error.code = Status.ResourceExhausted;
                        throw error;
                    }
                    return undefined;
                },
            );

            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
            expect(manager.endpointsWithLeases).to.equal(0);
        });

        it("puts back a stream it freed to make room when the request succeeds without the capacity", async () => {
            // The degraded rung hands out a stream that was already there, so the freeing bought this
            // request nothing. "The request succeeded" is the wrong question; "was the capacity used"
            // is the right one.
            const inUse = {
                ...FOREIGN_STREAM,
                ...CONTAINED_FOREIGN,
                videoStreamId: 11,
                overlays: NO_OVERLAYS,
                referenceCount: 1,
                maxResolution: { width: 3840, height: 2160 },
            };
            const { manager, invokes } = probeWith(
                { ...STATE, allocatedVideoStreams: [FOREIGN_STREAM, inUse] },
                async invoke => {
                    if (invoke.command !== "videoStreamAllocate") return undefined;
                    if (invoke.fields.streamUsage === LIVE_VIEW) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 20 };
                },
            );

            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(resolved.streamId).to.equal(11);
            expect(resolved.degraded).to.equal(true);
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([FOREIGN_STREAM.videoStreamId]);
            const restore = invokes.find(
                invoke =>
                    invoke.command === "videoStreamAllocate" &&
                    invoke.fields.streamUsage === FOREIGN_STREAM.streamUsage,
            );
            expect(restore?.fields.maxResolution).to.deep.equal(FOREIGN_STREAM.maxResolution);
        });

        it("puts back a stream it freed to make room when the request fails after the allocate", async () => {
            // The allocate that spends the freed capacity is not the end of the request: audio, the
            // offer and the registration all follow it. A request that fails there deallocates the
            // stream the capacity bought, so the camera is a stream poorer until the victim goes back.
            let liveViewAllocates = 0;
            const { manager, invokes } = probeWith(
                { ...STATE, allocatedVideoStreams: [FOREIGN_STREAM] },
                async invoke => {
                    if (invoke.command === "videoStreamAllocate") {
                        if (invoke.fields.streamUsage !== LIVE_VIEW) return { videoStreamId: 21 };
                        liveViewAllocates += 1;
                        if (liveViewAllocates <= NARROWING_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                        return { videoStreamId: 20 };
                    }
                    if (invoke.command === "audioStreamAllocate") throw statusError(Status.ConstraintError);
                    return undefined;
                },
            );

            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_AND_AUDIO_OFFER,
                    video: {},
                    audio: { bitRate: 32000 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            // The stream the freed capacity bought is given back, so the capacity was never used.
            expect(
                invokes
                    .filter(invoke => invoke.command === "videoStreamDeallocate")
                    .map(invoke => invoke.fields.videoStreamId),
            ).to.deep.equal([FOREIGN_STREAM.videoStreamId, 20]);
            const restore = invokes.find(
                invoke =>
                    invoke.command === "videoStreamAllocate" &&
                    invoke.fields.streamUsage === FOREIGN_STREAM.streamUsage,
            );
            expect(restore?.fields.maxResolution).to.deep.equal(FOREIGN_STREAM.maxResolution);
        });

        it("puts back a stream it freed to make room when the request fails anyway", async () => {
            // Freeing someone else's unreferenced stream buys capacity for this request. A request that
            // then fails has spent that stream for nothing, so an equivalent one goes back.
            const { manager, invokes } = probeWith(
                { ...STATE, allocatedVideoStreams: [FOREIGN_STREAM] },
                async invoke => {
                    if (invoke.command !== "videoStreamAllocate") return undefined;
                    // The camera has room only for the smaller stream that was freed, never for this
                    // request, so every rung fails and the restoring allocate is the one that succeeds.
                    if (invoke.fields.streamUsage === LIVE_VIEW) throw statusError(Status.ResourceExhausted);
                    return { videoStreamId: 20 };
                },
            );

            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    limits: { codec: H265 },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);

            const restore = invokes.find(
                invoke =>
                    invoke.command === "videoStreamAllocate" &&
                    invoke.fields.streamUsage === FOREIGN_STREAM.streamUsage,
            );
            expect(restore?.fields.maxResolution).to.deep.equal(FOREIGN_STREAM.maxResolution);
            expect(restore?.fields.videoCodec).to.equal(FOREIGN_STREAM.videoCodec);
            // The replacement exists because this server allocated it, so it must be this server's to
            // release; a stream nothing records as releasable is the leak the lease map prevents.
            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 20 });
            expect(manager.endpointsWithLeases).to.equal(0);
        });
    });
});

describe("CameraStreamManager reuse before the device has reported", () => {
    /** Allocation ids handed out in order, so a second allocate is visible as a second id. */
    function allocatingManager(
        state: CameraState,
        videoIds: number[],
    ): { manager: CameraStreamManager; invokes: RecordedInvoke[]; holder: { state: CameraState | undefined } } {
        const remaining = [...videoIds];
        return managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") {
                const next = remaining.shift();
                if (next === undefined) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: next };
            }
            return undefined;
        });
    }

    /** Device state that names no video stream, and an allocate that always answers `videoStreamId`. */
    function leaseProbeAllocating(videoStreamId: number) {
        return probeWith({ ...STATE, allocatedVideoStreams: [] }, async invoke =>
            invoke.command === "videoStreamAllocate" ? { videoStreamId } : undefined,
        );
    }

    function liveView(manager: CameraStreamManager, overrides?: { streamUsage?: number; sdp?: SdpVideoConstraints }) {
        return manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: overrides?.streamUsage ?? LIVE_VIEW,
            limits: videoCodecLimits(overrides?.sdp, H265),
        });
    }

    it("reuses the stream it has just allocated instead of allocating a twin", async () => {
        // The endpoint lock serialises the two calls but does not wait for AllocatedVideoStreams to
        // report the first allocation, which is the window this reuse closes.
        const { manager, invokes } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9, 10]);
        const first = await liveView(manager);
        const second = await liveView(manager);

        expect(second.streamId).to.equal(9);
        expect(second.reused).to.equal(true);
        expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
        // The reuse is reported from the lease's own description of the allocation, so it has to be
        // the range that was allocated rather than a default.
        expect(second.envelope).to.deep.equal(first.envelope);
    });

    it("refuses an unreported stream whose overlays the caller did not ask for", async () => {
        // The lease's stand-in allocation has to record the overlays that were asked for, or the
        // shadow window hands a watermarked stream to the next request that wants none.
        const overlayState: CameraState = {
            ...STATE,
            features: cameraFeatures("video", "snapshot", "watermark", "onScreenDisplay"),
            allocatedVideoStreams: [],
        };
        const { manager, invokes } = allocatingManager(overlayState, [9, 10]);
        const first = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
            hints: { watermarkEnabled: true },
        });
        expect(first.streamId).to.equal(9);

        const second = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
            hints: { watermarkEnabled: false },
        });
        expect(second.streamId).to.equal(10);
        expect(second.reused).to.equal(false);
        expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(2);
    });

    it("reuses an unreported stream whose overlays are the ones asked for again", async () => {
        const overlayState: CameraState = {
            ...STATE,
            features: cameraFeatures("video", "snapshot", "watermark", "onScreenDisplay"),
            allocatedVideoStreams: [],
        };
        const { manager, invokes } = allocatingManager(overlayState, [9, 10]);
        const hints = { watermarkEnabled: true };
        await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
            hints,
        });
        const second = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
            hints,
        });
        expect(second.streamId).to.equal(9);
        expect(second.reused).to.equal(true);
        expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
    });

    it("reuses an audio stream it has just allocated instead of allocating a twin", async () => {
        const { manager, invokes } = managerWith({ ...STATE, allocatedAudioStreams: [] }, async invoke =>
            invoke.command === "audioStreamAllocate" ? { audioStreamId: 4 } : undefined,
        );
        const first = await manager.resolveAudioStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
        });
        const second = await manager.resolveAudioStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
        });

        expect(second?.streamId).to.equal(4);
        expect(second?.reused).to.equal(true);
        expect(invokes.filter(invoke => invoke.command === "audioStreamAllocate")).to.have.length(1);
        expect(second?.envelope).to.deep.equal(first?.envelope);
    });

    it("refuses an unreported stream whose usage the caller did not ask for", async () => {
        const { manager, invokes } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9]);
        await liveView(manager);

        // The unreported stream is LiveView; this caller asks for another usage, so no rung may hand
        // it over and the camera's refusal to allocate a second one is the answer.
        let thrown: unknown;
        try {
            await liveView(manager, { streamUsage: 1 });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
        expect(
            invokes.some(invoke => invoke.command === "videoStreamAllocate" && invoke.fields.streamUsage === 1),
        ).to.equal(true);
    });

    it("hands out an unreported stream on the degraded rung when nothing else is left", async () => {
        const { manager, holder } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9]);
        await liveView(manager);

        // The bandwidth the camera states drops, so the stream's bit-rate ceiling now sits outside the
        // envelope the server computes. That envelope is the server's own, and giving it up is what
        // this rung is for; the caller stated no bound of its own to violate.
        holder.state = { ...STATE, allocatedVideoStreams: [], maxNetworkBandwidth: 2000000 };
        const second = await liveView(manager);
        expect(second.streamId).to.equal(9);
        expect(second.degraded).to.equal(true);
    });

    it("refuses to degrade to a stream the offer says the peer cannot decode", async () => {
        const { manager } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9]);
        await liveView(manager);

        // The stream's 2560x1440 ceiling is past the offer's own max-fs budget. That is a decode
        // ceiling, not the server's preference, so no rung may trade it away: video the peer cannot
        // decode is not a degraded picture, it is no picture.
        let thrown: unknown;
        try {
            await liveView(manager, {
                sdp: {
                    video: { state: "receiving" as const },
                    audio: { state: "absent" as const },
                    wantsTalkback: false,
                    limitsByCodec: new Map([["H265", { maxPixels: 1280 * 720 }]]),
                    unreadableCeilingCodecs: new Set<string>(),
                },
            });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
    });

    it("lets the device's own report replace its record of a stream it allocated", async () => {
        // The lease describes what was asked for. Once the device names the stream it is the device
        // that says what was allocated, and a request the device's version does not satisfy must not
        // be answered from the older description.
        const { manager, holder } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9]);
        const first = await liveView(manager);
        const envelope = requireVideoEnvelope(first.envelope);
        holder.state = {
            ...STATE,
            allocatedVideoStreams: [
                {
                    videoStreamId: 9,
                    overlays: NO_OVERLAYS,
                    streamUsage: LIVE_VIEW,
                    videoCodec: envelope.codec,
                    minResolution: envelope.minResolution,
                    // Wider than this server asked for, so it no longer fits the envelope it requested.
                    maxResolution: { width: 3840, height: 2160 },
                    minFrameRate: envelope.minFrameRate,
                    maxFrameRate: envelope.maxFrameRate,
                    minBitRate: envelope.minBitRate,
                    maxBitRate: envelope.maxBitRate,
                    referenceCount: 1,
                },
            ],
        };

        const second = await liveView(manager);
        expect(second.streamId).to.equal(9);
        expect(second.degraded).to.equal(true);
        expect(requireVideoEnvelope(second.envelope).maxResolution).to.deep.equal({ width: 3840, height: 2160 });
    });

    it("lets the device's own report replace its record of an audio stream it allocated", async () => {
        const allocated = new Array<number>(4, 5);
        const { manager, holder } = managerWith({ ...STATE, allocatedAudioStreams: [] }, async invoke =>
            invoke.command === "audioStreamAllocate" ? { audioStreamId: allocated.shift() } : undefined,
        );
        const first = await manager.resolveAudioStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
        });
        if (first === undefined) throw new Error("expected an allocated audio stream");
        const envelope = requireAudioEnvelope(first.envelope);
        holder.state = {
            ...STATE,
            allocatedAudioStreams: [
                {
                    audioStreamId: 4,
                    streamUsage: LIVE_VIEW,
                    audioCodec: envelope.codec,
                    channelCount: envelope.channelCount,
                    // The camera settled on a rate this server did not ask for.
                    sampleRate: envelope.sampleRate / 2,
                    bitRate: envelope.bitRate,
                    bitDepth: envelope.bitDepth,
                    referenceCount: 1,
                },
            ],
        };

        const second = await manager.resolveAudioStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
        });
        expect(second?.streamId).to.equal(5);
        expect(second?.reused).to.equal(false);
    });

    it("keeps reusing an unreported stream up to the last millisecond of the grace window", async () => {
        MockTime.reset();
        try {
            const { manager, invokes } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9, 10]);
            await liveView(manager);
            // A reuse in between must carry the window over rather than open or close one.
            await MockTime.advance(1);
            await liveView(manager);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS - 2);

            const third = await liveView(manager);
            expect(third.streamId).to.equal(9);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
        } finally {
            MockTime.disable();
        }
    });

    it("allocates again once the grace window passes and the device still names no stream", async () => {
        MockTime.reset();
        try {
            const { manager, invokes } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9, 10]);
            await liveView(manager);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS);

            const second = await liveView(manager);
            expect(second.streamId).to.equal(10);
            expect(second.reused).to.equal(false);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(2);
        } finally {
            MockTime.disable();
        }
    });

    it("keeps a stream it allocated releasable although the device never names it", async () => {
        // Ownership is not evidence that the stream exists, and it must not expire with that evidence:
        // the lease is the only record that says this server may deallocate the stream.
        MockTime.reset();
        try {
            const invokes = new Array<RecordedInvoke>();
            const probe = new LeaseProbe({
                readCameraState: async () => ({ ...STATE, allocatedVideoStreams: [] }),
                readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
                missingCameraClusters: async () => new Array<number>(),
                invoke: async args => {
                    invokes.push({
                        command: args.command,
                        fields: args.fields,
                        nodeId: args.nodeId,
                        endpointId: args.endpointId,
                    });
                    return args.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined;
                },
            });
            await liveView(probe);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS * 6);
            await probe.getCapabilities(NODE, ENDPOINT);
            expect(probe.endpointsWithLeases).to.equal(1);

            await probe.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
            expect(probe.endpointsWithLeases).to.equal(0);
        } finally {
            MockTime.disable();
        }
    });

    /** A probe holding one lease for video stream 9 that the device's report never names. */
    function leasedProbe(deallocateStatus: number): LeaseProbe {
        return new LeaseProbe({
            readCameraState: async () => ({ ...STATE, allocatedVideoStreams: [] }),
            readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
            missingCameraClusters: async () => new Array<number>(),
            invoke: async args => {
                if (args.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (args.command === "videoStreamDeallocate") throw statusError(deallocateStatus);
                return undefined;
            },
        });
    }

    it("keeps the lease when the camera refuses the release as in use", async () => {
        // The stream is still on the camera, so the record that says this server may deallocate it
        // has to survive: without it a retry has nothing to release the stream by.
        const probe = leasedProbe(Status.InvalidInState);
        await liveView(probe);
        expect(probe.endpointsWithLeases).to.equal(1);

        let thrown: unknown;
        try {
            await probe.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamInUse);
        expect(probe.endpointsWithLeases).to.equal(1);
    });

    it("drops the lease when the camera states it has no such stream", async () => {
        // NOT_FOUND says the stream the lease claims is gone. Keeping the lease would report it as
        // this server's for the rest of the process run, and let a reissued id be matched to it.
        const probe = leasedProbe(Status.NotFound);
        await liveView(probe);
        expect(probe.endpointsWithLeases).to.equal(1);

        let thrown: unknown;
        try {
            await probe.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
        } catch (error) {
            thrown = error;
        }
        expect(deviceStatusOf(thrown)).to.equal(Status.NotFound);
        expect(probe.endpointsWithLeases).to.equal(0);
    });

    it("allocates a second audio stream once the grace window passes", async () => {
        MockTime.reset();
        try {
            const allocated = new Array<number>(4, 5);
            const { manager } = managerWith({ ...STATE, allocatedAudioStreams: [] }, async invoke =>
                invoke.command === "audioStreamAllocate" ? { audioStreamId: allocated.shift() } : undefined,
            );
            await manager.resolveAudioStream({ nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW });
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS);

            const second = await manager.resolveAudioStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
            });
            expect(second?.streamId).to.equal(5);
            expect(second?.reused).to.equal(false);
        } finally {
            MockTime.disable();
        }
    });

    it("keeps ownership of an unreported stream it has handed out again", async () => {
        MockTime.reset();
        try {
            const invokes = new Array<RecordedInvoke>();
            const probe = new LeaseProbe({
                readCameraState: async () => ({ ...STATE, allocatedVideoStreams: [] }),
                readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
                missingCameraClusters: async () => new Array<number>(),
                invoke: async args => {
                    invokes.push({
                        command: args.command,
                        fields: args.fields,
                        nodeId: args.nodeId,
                        endpointId: args.endpointId,
                    });
                    return args.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined;
                },
            });
            await liveView(probe);
            await liveView(probe);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS * 6);
            await probe.getCapabilities(NODE, ENDPOINT);

            await probe.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
            expect(probe.endpointsWithLeases).to.equal(0);
        } finally {
            MockTime.disable();
        }
    });

    it("keeps a stream it allocated its own to give back, however long the device never names it", async () => {
        // Ownership records one thing: that this process run allocated the stream. Nothing about the
        // passing of time makes that less true, and a lease dropped on silence alone leaves a stream
        // this server allocated with nothing recording that it may give it back unasked.
        MockTime.reset();
        try {
            const { manager, invokes } = leaseProbeAllocating(9);
            await liveView(manager);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS * 1000);
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(1);
            const owned = await manager.getCapabilities(NODE, ENDPOINT);
            expect(owned.allocated.video).to.deep.equal([]);

            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
        } finally {
            MockTime.disable();
        }
    });

    it("keeps a lease the device has reported, however long the endpoint then stays quiet", async () => {
        // A reported stream stays ours until the device stops naming it; the endpoint going quiet is
        // not the device saying the stream is gone.
        MockTime.reset();
        try {
            const { manager, invokes, holder } = leaseProbeAllocating(9);
            const allocated = await liveView(manager);
            const envelope = requireVideoEnvelope(allocated.envelope);
            holder.state = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 9,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: envelope.codec,
                        minResolution: envelope.minResolution,
                        maxResolution: envelope.maxResolution,
                        minFrameRate: envelope.minFrameRate,
                        maxFrameRate: envelope.maxFrameRate,
                        minBitRate: envelope.minBitRate,
                        maxBitRate: envelope.maxBitRate,
                        referenceCount: 0,
                    },
                ],
            };
            await manager.getCapabilities(NODE, ENDPOINT);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS * 1000);
            await manager.getCapabilities(NODE, ENDPOINT);
            expect(manager.endpointsWithLeases).to.equal(1);

            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
            expect(invokes.map(invoke => invoke.command)).to.include("videoStreamDeallocate");
        } finally {
            MockTime.disable();
        }
    });

    it("does not extend the window of a stream it hands out again", async () => {
        // Handing a stream out is not a report from the camera, so it says nothing about whether the
        // stream still exists. A window that renewed itself here could never close.
        MockTime.reset();
        try {
            const { manager, invokes } = allocatingManager({ ...STATE, allocatedVideoStreams: [] }, [9, 10]);
            await liveView(manager);
            await MockTime.advance(UNREPORTED_LEASE_GRACE_MS - 1);
            expect((await liveView(manager)).streamId).to.equal(9);

            await MockTime.advance(1);
            const third = await liveView(manager);
            expect(third.streamId).to.equal(10);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(2);
        } finally {
            MockTime.disable();
        }
    });
});

describe("preferredVideoCodec", () => {
    /** VideoCodecEnum: H.264 = 0, H.265 = 1. */
    const H264 = 0;
    const H265 = 1;

    /** The typed failure a call raised, or a test failure when it raised nothing. */
    function incompatible(call: () => unknown): {
        code: number;
        payload: { reason: string; device: string[]; requested: string[] };
    } {
        try {
            call();
        } catch (error) {
            if (error instanceof ServerError) return { code: error.code, payload: JSON.parse(error.message) };
            throw error;
        }
        throw new Error("expected a typed camera failure");
    }

    it("honors the caller's stated preference order over the device's own ordering", () => {
        // Device lists H.264 before H.265; the caller prefers H.265 first.
        expect(preferredVideoCodec([H264, H265], undefined, ["H265", "H264"])).to.equal(H265);
    });

    it("falls back to the device's order when the caller states no preference", () => {
        expect(preferredVideoCodec([H264, H265], undefined, undefined)).to.equal(H264);
    });

    it("ignores a hint codec the device does not support", () => {
        expect(preferredVideoCodec([H264], undefined, ["H265", "H264"])).to.equal(H264);
    });

    it("fails typed when no hint codec matches, instead of handing back another one", () => {
        const failure = incompatible(() => preferredVideoCodec([H264, H265], undefined, ["AV1"]));
        expect(failure.code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        expect(failure.payload.reason).to.equal("codec");
        expect(failure.payload.requested).to.deep.equal(["AV1"]);
    });

    it("fails typed when the offer names no codec the camera supports", () => {
        // An H.264-only peer handed an H.265 stream sees a session it cannot decode and no error.
        const offer = {
            video: { state: "receiving" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set<string>(),
        };
        const failure = incompatible(() => preferredVideoCodec([H265], offer, undefined));
        expect(failure.code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        expect(failure.payload.reason).to.equal("codec");
        expect(failure.payload.requested).to.deep.equal(["H264"]);
    });

    it("refuses a codec whose level it cannot read rather than treating it as unconstrained", () => {
        // The camera and the peer both offer H.264 and nothing else. The level states the frame size
        // the peer can decode and this one names no row of Table A-1, so there is no ceiling to hold
        // the stream to — selecting H.264 anyway is what hands the peer a picture it cannot decode.
        const offer = {
            video: { state: "receiving" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set(["H264"]),
        };
        const failure = incompatible(() => preferredVideoCodec([H264], offer, undefined));
        expect(failure.code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        // Not "codec": the two do have a codec in common, so sending the client to change its codec
        // list would send it to change the one thing that is not the problem.
        expect(failure.payload.reason).to.equal("level");
        expect(failure.payload.requested).to.deep.equal(["H264"]);
        expect(failure.payload.device).to.deep.equal(["H264"]);
    });

    it("selects the codec whose level it can read over the one it cannot", () => {
        const offer = {
            video: { state: "receiving" as const, codecs: ["H264", "H265"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set(["H264"]),
        };
        expect(preferredVideoCodec([H264, H265], offer, undefined)).to.equal(H265);
    });

    it("reports a codec mismatch, not a level failure, when the unreadable codec was never shared", () => {
        // Characterization: this is the pre-existing codec narrowing, asserted here so the level
        // branch cannot start claiming a failure the codec lists already explain. The peer's
        // unreadable codec is one the camera does not offer either, so the level is not what
        // emptied the set and naming it would send the client after the wrong thing.
        const offer = {
            video: { state: "receiving" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set(["H264"]),
        };
        const failure = incompatible(() => preferredVideoCodec([H265], offer, undefined));
        expect(failure.payload.reason).to.equal("codec");
        expect(failure.payload.requested).to.deep.equal(["H264"]);
    });

    it("reports the set the failing step narrowed, not the camera's full list", () => {
        // After the offer has ruled H.265 out, "the camera supports H.265" is not the answer the
        // client needs to act on.
        const offer = {
            video: { state: "receiving" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set<string>(),
        };
        const failure = incompatible(() => preferredVideoCodec([H264, H265], offer, ["H265"]));
        expect(failure.payload.device).to.deep.equal(["H264"]);
    });

    it("keeps the offer's narrowing when a later hint agrees with it", () => {
        const offer = {
            video: { state: "receiving" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set<string>(),
        };
        expect(preferredVideoCodec([H264, H265], offer, ["H264"])).to.equal(H264);
    });

    it("honours the caller's codec when the camera advertises no trade-off point", () => {
        // Nothing was narrowed away, so the caller's choice is the only statement there is; the
        // allocate call is what a camera that cannot serve it rejects.
        expect(preferredVideoCodec(new Array<number>(), undefined, ["H265"])).to.equal(H265);
    });

    it("defaults to H.264 when neither the camera, the offer nor the caller names a codec", () => {
        expect(preferredVideoCodec(new Array<number>(), undefined, undefined)).to.equal(H264);
    });

    it("keeps a video m-line with no rtpmap from failing the request", () => {
        // An m-line carrying only static payload types parses to hasVideo with an empty codec list;
        // that states nothing about what the peer can decode.
        const offer = {
            video: { state: "receiving" as const },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
            unreadableCeilingCodecs: new Set<string>(),
        };
        expect(preferredVideoCodec([H265], offer, undefined)).to.equal(H265);
    });
});

describe("CameraStreamManager device cleanup budget", () => {
    const START: Parameters<CameraStreamManager["startStream"]>[0] = {
        nodeId: NODE,
        endpointId: ENDPOINT,
        connectionId: "conn-1",
        streamUsage: LIVE_VIEW,
        sdp: VIDEO_OFFER,
        video: {},
        audio: false,
    };

    /** A promise that never settles, as a camera that has stopped answering leaves an invoke. */
    function silent(): Promise<never> {
        return new Promise<never>(() => {});
    }

    it("stops waiting for an EndSession the camera never answers, and keeps the session tracked", async () => {
        MockTime.reset();
        try {
            let entered = (): void => {};
            const endSessionEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession") {
                    entered();
                    return silent();
                }
                return undefined;
            });
            await manager.startStream(START);

            const stopping = manager.stopAll();
            await endSessionEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);

            await stopping;
            // The session the budget gave up on is still this server's to end, so the next release
            // pass must still find it. Probed with forgetSession, which reports the entry without
            // invoking the camera that is not answering.
            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
        } finally {
            MockTime.disable();
        }
    });

    it("ends the other cameras' sessions although one camera never answers", async () => {
        MockTime.reset();
        try {
            const OTHER = NodeId(6);
            let entered = (): void => {};
            const silentEndSessionEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            let nextSessionId = 42;
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: nextSessionId++ };
                if (invoke.command === "endSession") {
                    if (invoke.nodeId === NODE) {
                        entered();
                        return silent();
                    }
                    return undefined;
                }
                return undefined;
            });
            await manager.startStream(START);
            await manager.startStream({ ...START, nodeId: OTHER, connectionId: "conn-2" });

            const stopping = manager.stopAll();
            await silentEndSessionEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);
            await stopping;

            const ended = invokes.filter(invoke => invoke.command === "endSession").map(invoke => invoke.nodeId);
            expect(ended).to.have.length(2);
            expect(manager.forgetSession(OTHER, ENDPOINT, 43)).to.equal(false);
        } finally {
            MockTime.disable();
        }
    });

    it("lets an abandoned EndSession that lands late keep its hands off a session established since", async () => {
        MockTime.reset();
        try {
            let answerSilentEndSession = (): void => {};
            let entered = (): void => {};
            const endSessionEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            let endSessionCount = 0;
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                // The camera reissues the id it freed, which is what makes the late give-back able to
                // name the wrong session.
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                if (invoke.command === "endSession" && ++endSessionCount === 1) {
                    entered();
                    return new Promise<void>(resolve => {
                        answerSilentEndSession = resolve;
                    });
                }
                return undefined;
            });
            await manager.startStream(START);

            const stopping = manager.stopAll();
            await endSessionEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);
            await stopping;

            await manager.startStream({ ...START, connectionId: "conn-2" });
            answerSilentEndSession();
            // A macrotask boundary: every microtask the answered invoke queued, including the
            // give-back's own continuation, has run by the time this resolves.
            await new Promise<void>(resolve => setImmediate(resolve));

            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
        } finally {
            MockTime.disable();
        }
    });

    it("lets an abandoned deallocate that lands late keep its hands off a lease taken since", async () => {
        MockTime.reset();
        try {
            let answerSilentDeallocate: () => void = () => {};
            let entered = (): void => {};
            const deallocateEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            let deallocateCount = 0;
            const { manager, holder } = managerWith(STATE, async invoke => {
                // The camera reissues the id it freed, which is what makes the late give-back able to
                // drop the lease on the wrong stream.
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") throw statusError(Status.Failure);
                if (invoke.command === "videoStreamDeallocate" && ++deallocateCount === 1) {
                    entered();
                    return new Promise<void>(resolve => {
                        answerSilentDeallocate = resolve;
                    });
                }
                return undefined;
            });

            const starting = manager.startStream(START).then(
                () => undefined,
                () => undefined,
            );
            await deallocateEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);
            await starting;

            const retaken = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            // The shadow on the abandoned lease has expired, so this is a fresh allocation under a
            // new generation rather than a reuse of the lease the give-back names.
            expect(retaken.reused).to.equal(false);

            answerSilentDeallocate();
            // A macrotask boundary: every microtask the answered invoke queued, including the
            // give-back's own continuation, has run by the time this resolves.
            await new Promise<void>(resolve => setImmediate(resolve));

            holder.state = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 9,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 0,
                    },
                ],
            };
            // The lease the second request took is the only record that this server may free stream 9.
            const capabilities = await manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.allocated.video.map(stream => stream.allocatedByServer)).to.deep.equal([true]);
        } finally {
            MockTime.disable();
        }
    });

    it("lets an abandoned deallocate drop a lease that was only reused since, not allocated again", async () => {
        // Reuse restates nothing about the id, so it keeps the generation it found. The give-back
        // that lands afterwards freed exactly the stream that lease names, and must take it with it.
        MockTime.reset();
        try {
            let answerSilentDeallocate: () => void = () => {};
            let entered = (): void => {};
            const deallocateEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            const { manager, holder } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") throw statusError(Status.Failure);
                if (invoke.command === "videoStreamDeallocate") {
                    entered();
                    return new Promise<void>(resolve => {
                        answerSilentDeallocate = resolve;
                    });
                }
                return undefined;
            });

            const starting = manager.startStream(START).then(
                () => undefined,
                () => undefined,
            );
            await deallocateEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);
            await starting;

            // The camera has not processed the give-back yet, so it still reports the stream.
            holder.state = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 9,
                        overlays: NO_OVERLAYS,
                        streamUsage: LIVE_VIEW,
                        videoCodec: H265,
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 800000,
                        maxBitRate: 4000000,
                        referenceCount: 0,
                    },
                ],
            };
            const reused = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            expect(reused.reused).to.equal(true);

            answerSilentDeallocate();
            await new Promise<void>(resolve => setImmediate(resolve));

            // The camera still reports the stream, so reconciliation cannot be what drops the lease:
            // only the give-back that freed it can.
            const capabilities = await manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.allocated.video.map(stream => stream.allocatedByServer)).to.deep.equal([false]);
        } finally {
            MockTime.disable();
        }
    });

    it("fails a request rather than waiting for a give-back the camera never answers", async () => {
        MockTime.reset();
        try {
            let entered = (): void => {};
            const deallocateEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            const { manager } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") throw statusError(Status.Failure);
                if (invoke.command === "videoStreamDeallocate") {
                    entered();
                    return silent();
                }
                return undefined;
            });

            let outcome: unknown;
            const starting = manager.startStream(START).then(
                () => {
                    outcome = "resolved";
                },
                error => {
                    outcome = error;
                },
            );
            await deallocateEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);
            await starting;

            expect(outcome).to.be.instanceOf(Error);
            expect(deviceStatusOf(outcome)).to.equal(Status.Failure);
        } finally {
            MockTime.disable();
        }
    });

    describe("device features and privacy", () => {
        /** A camera that advertises Audio and nothing else: an audio doorbell or an intercom. */
        const AUDIO_ONLY_STATE: CameraState = {
            ...STATE,
            features: cameraFeatures("audio"),
            videoSensorParams: undefined,
            rateDistortionTradeOffPoints: [],
            snapshotCapabilities: [],
        };

        function audioOnlyManager() {
            return managerWith(AUDIO_ONLY_STATE, async invoke => {
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
        }

        /** A camera that refuses the establishing offer the way a privacy switch makes it refuse. */
        function refusingManager(state: CameraState, status = Status.InvalidInState) {
            return managerWith(state, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer" || invoke.command === "solicitOffer") throw statusError(status);
                return undefined;
            });
        }

        it("reports the advertised features in the spec's bit order", async () => {
            // The flags are written in the reverse of the spec's order, so the order in the report is
            // the model's and not the order the read bitmap happens to carry its keys in.
            const features: CameraFeatures = {
                nightVision: true,
                onScreenDisplay: true,
                privacy: true,
                audio: true,
            };
            const capabilities = await managerWith({ ...STATE, features }).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.features).to.deep.equal(["Audio", "Privacy", "OnScreenDisplay", "NightVision"]);
        });

        it("reports each privacy switch the camera states, and omits one it does not", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("video", "privacy"),
                privacy: { softRecordingModeEnabled: false, softLivestreamModeEnabled: true },
            };
            const capabilities = await managerWith(state).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.privacy.softLivestreamModeEnabled).to.equal(true);
            expect(capabilities.privacy.softRecordingModeEnabled).to.equal(false);
            // Absent is not "off": HardPrivacyModeOn is optional, and a camera without the physical
            // switch states nothing about it.
            expect(capabilities.privacy.hardModeOn).to.equal(undefined);
        });

        it("serves capabilities while every switch is on, because that is how a client learns it", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("video", "privacy"),
                privacy: { hardModeOn: true, softLivestreamModeEnabled: true, softRecordingModeEnabled: true },
            };
            const capabilities = await managerWith(state).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.privacy.hardModeOn).to.equal(true);
            expect(capabilities.features).to.contain("Privacy");
        });

        it("opens an audio-only session on a camera with no Video feature when video was left to it", async () => {
            // The offer carries a live video section, so nothing but the feature map says the camera
            // cannot serve it. VideoStreamAllocate is not in such a camera's AcceptedCommandList and
            // answers UnsupportedCommand, which no ladder rung recovers from.
            const { manager, invokes } = audioOnlyManager();

            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_AND_AUDIO_OFFER,
            });

            expect(session.video).to.equal(undefined);
            expect(session.audio?.streamId).to.equal(4);
            expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(false);
            const offer = invokes.find(invoke => invoke.command === "provideOffer");
            expect(offer?.fields.videoStreams).to.equal(undefined);
            expect(offer?.fields.audioStreams).to.deep.equal([4]);
        });

        it("names the missing feature when the caller demanded video from such a camera", async () => {
            const { manager, invokes } = audioOnlyManager();
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_AND_AUDIO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }

            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("feature");
            expect(detail.track).to.equal("video");
            // The fact that distinguishes this from a peer that rejected the section, which names no
            // feature: no codec, bound or offer the caller could send instead makes it work.
            expect(detail.feature).to.equal("Video");
            expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(false);
            expect(invokes.some(invoke => invoke.command === "provideOffer")).to.equal(false);
        });

        it("names the missing feature when the caller demanded audio from a camera with no Audio feature", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("video"),
                microphoneCapabilities: undefined,
            };
            const { manager } = managerWith(state, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_AND_AUDIO_OFFER,
                    audio: {},
                });
            } catch (error) {
                thrown = error;
            }
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("feature");
            expect(detail.track).to.equal("audio");
            expect(detail.feature).to.equal("Audio");
        });

        it("refuses audio on a camera that reports a microphone without advertising the feature", async () => {
            // The attribute is gated on the feature, so this camera contradicts itself — and its
            // AudioStreamAllocate is not in its AcceptedCommandList either. The feature is read beside
            // the attribute so the refusal happens here rather than at the allocate.
            const state: CameraState = { ...STATE, features: cameraFeatures("video") };
            const { manager, invokes } = managerWith(state, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_AND_AUDIO_OFFER,
                    audio: { codecs: ["OPUS"] },
                });
            } catch (error) {
                thrown = error;
            }
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.track).to.equal("audio");
            expect(detail.feature).to.equal("Audio");
            expect(invokes.some(invoke => invoke.command === "audioStreamAllocate")).to.equal(false);
        });

        it("names the missing feature when a camera with no Snapshot feature is asked for a frame", async () => {
            const state: CameraState = { ...STATE, features: cameraFeatures("video"), snapshotCapabilities: [] };
            let thrown: unknown;
            try {
                await managerWith(state).manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.reason).to.equal("feature");
            expect(detail.feature).to.equal("Snapshot");
        });

        it("refuses a snapshot on a camera that lists capabilities without advertising the feature", async () => {
            // SnapshotCapabilities is gated on the feature, so this camera contradicts itself and its
            // SnapshotStreamAllocate is not in its AcceptedCommandList. Without the gate the request
            // walks the whole capability ladder and the device's UnsupportedCommand reaches the client
            // untyped.
            const state: CameraState = { ...STATE, features: cameraFeatures("video") };
            const { manager, invokes } = managerWith(state, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.feature).to.equal("Snapshot");
            expect(invokes.some(invoke => invoke.command === "snapshotStreamAllocate")).to.equal(false);
        });

        it("does not gate a track on a feature map the camera has not stated", async () => {
            // matter.js fills the feature map from the device's own report and it reads all-false
            // until that arrives. At least one of Audio, Video and Snapshot is mandatory (§11.2.5),
            // so none of the three is "not stated yet": gating on it would strand a real camera in an
            // audio-only session, which is worse than the UnsupportedCommand the gate prevents.
            const unstated: CameraState = { ...STATE, features: cameraFeatures("highDynamicRange") };
            const { manager, invokes } = managerWith(unstated, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "audioStreamAllocate") return { audioStreamId: 4 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });

            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: VIDEO_AND_AUDIO_OFFER,
                video: {},
                audio: {},
            });

            expect(session.video?.streamId).to.equal(9);
            expect(session.audio?.streamId).to.equal(4);
            expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(true);
        });

        it("reports no feature list at all when the camera has not stated its feature map", async () => {
            // A list is the complete set the camera advertises, so one that cannot be complete is not
            // reported: an empty or partial list would be read as a camera that has no video.
            const unstated: CameraState = { ...STATE, features: cameraFeatures("highDynamicRange") };
            const capabilities = await managerWith(unstated).manager.getCapabilities(NODE, ENDPOINT);
            expect(capabilities.features).to.equal(undefined);
        });

        it("reports the hard privacy switch as the reason the camera refused the session", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { hardModeOn: true, softLivestreamModeEnabled: false, softRecordingModeEnabled: false },
            };
            const { manager, invokes } = refusingManager(state);
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }

            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraPrivacyMode);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.modes).to.deep.equal(["hard_mode_on"]);
            expect(detail.device_status).to.equal(Status.InvalidInState);
            // The stream allocated for the refused session goes back; the switch turning off must not
            // leave an encoder held by a session that never existed.
            expect(invokes.some(invoke => invoke.command === "videoStreamDeallocate")).to.equal(true);
        });

        it("reports the soft livestream switch for a LiveView session", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { softLivestreamModeEnabled: true, softRecordingModeEnabled: false, hardModeOn: false },
            };
            let thrown: unknown;
            try {
                await refusingManager(state).manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraPrivacyMode);
            expect(JSON.parse((thrown as ServerError).message).modes).to.deep.equal(["soft_livestream_mode_enabled"]);
        });

        it("does not blame the livestream switch for a Recording session it does not cover", async () => {
            // The switch covers LiveView only (§11.2.7.21). Reporting it for another usage would name
            // a switch that is not what the camera refused on.
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { softLivestreamModeEnabled: true, softRecordingModeEnabled: false, hardModeOn: false },
            };
            let thrown: unknown;
            try {
                await refusingManager(state).manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: StreamUsage.Recording,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.not.be.instanceOf(ServerError);
            expect(deviceStatusOf(thrown)).to.equal(Status.InvalidInState);
        });

        it("reports the soft recording switch for a Recording session", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { softRecordingModeEnabled: true, softLivestreamModeEnabled: false, hardModeOn: false },
            };
            let thrown: unknown;
            try {
                await refusingManager(state).manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: StreamUsage.Recording,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraPrivacyMode);
            expect(JSON.parse((thrown as ServerError).message).modes).to.deep.equal(["soft_recording_mode_enabled"]);
        });

        it("does not blame the recording switch for a LiveView session it does not cover", async () => {
            // The camera answers INVALID_IN_STATE for several things that are not privacy at all — a
            // `turns:` ICE server on a camera whose UTCTime is null, among others. A switch that does
            // not cover this usage is not an explanation, and claiming it would be a false one.
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { softRecordingModeEnabled: true, softLivestreamModeEnabled: false, hardModeOn: false },
            };
            let thrown: unknown;
            try {
                await refusingManager(state).manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.not.be.instanceOf(ServerError);
            expect(deviceStatusOf(thrown)).to.equal(Status.InvalidInState);
        });

        it("leaves an INVALID_IN_STATE no switch explains as the device's own error", async () => {
            const state: CameraState = { ...STATE, features: cameraFeatures("audio", "video", "privacy"), privacy: {} };
            let thrown: unknown;
            try {
                await refusingManager(state).manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.not.be.instanceOf(ServerError);
        });

        it("keeps a typed failure raised under the offer, even one wrapping the device's own status", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { hardModeOn: true },
            };
            const { manager } = managerWith(state, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                // Wrapping a device INVALID_IN_STATE is the case the guard exists for: `deviceStatusOf`
                // walks the cause chain, so an error that already says what happened would otherwise be
                // replaced by a privacy explanation it never claimed.
                if (invoke.command === "provideOffer") {
                    throw ServerError.sdkStackError(
                        "provider relay failed",
                        StatusResponseError.create(Status.InvalidInState),
                    );
                }
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
        });

        it("keeps the device's refusal when the endpoint no longer reports the camera behaviour", async () => {
            const privacyState: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { hardModeOn: true },
            };
            let refused = false;
            const io: CameraDeviceIo = {
                readCameraState: async () => (refused ? undefined : privacyState),
                readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
                missingCameraClusters: async () => new Array<number>(),
                invoke: async args => {
                    if (args.command === "videoStreamAllocate") return { videoStreamId: 9 };
                    if (args.command === "provideOffer") {
                        refused = true;
                        throw statusError(Status.InvalidInState);
                    }
                    return undefined;
                },
            };
            let thrown: unknown;
            try {
                await new CameraStreamManager(io).startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.not.be.instanceOf(ServerError);
            expect(deviceStatusOf(thrown)).to.equal(Status.InvalidInState);
        });

        it("keeps the device's refusal when the state read that would explain it fails", async () => {
            // The node can go away between the refused offer and the read that would name the switch.
            // The camera's own answer is the one to report; an unrelated read failure in its place
            // would tell the client nothing about what happened.
            const privacyState: CameraState = {
                ...STATE,
                features: cameraFeatures("audio", "video", "privacy"),
                privacy: { hardModeOn: true },
            };
            let refused = false;
            const io: CameraDeviceIo = {
                readCameraState: async () => {
                    if (refused) throw new Error("node is gone");
                    return privacyState;
                },
                readWebRtcSessions: async () => new Array<DeviceWebRtcSession>(),
                missingCameraClusters: async () => new Array<number>(),
                invoke: async args => {
                    if (args.command === "videoStreamAllocate") return { videoStreamId: 9 };
                    if (args.command === "provideOffer") {
                        refused = true;
                        throw statusError(Status.InvalidInState);
                    }
                    return undefined;
                },
            };
            let thrown: unknown;
            try {
                await new CameraStreamManager(io).startStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    connectionId: "conn-1",
                    streamUsage: LIVE_VIEW,
                    sdp: VIDEO_OFFER,
                    video: {},
                });
            } catch (error) {
                thrown = error;
            }
            expect(deviceStatusOf(thrown)).to.equal(Status.InvalidInState);
            expect((thrown as Error).message).to.not.contain("node is gone");
        });

        it("reports a privacy switch as the reason a snapshot was refused", async () => {
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("snapshot", "privacy"),
                privacy: { hardModeOn: false, softLivestreamModeEnabled: true, softRecordingModeEnabled: false },
            };
            const { manager } = managerWith(state, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") throw statusError(Status.InvalidInState);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraPrivacyMode);
            const detail = JSON.parse((thrown as ServerError).message);
            expect(detail.modes).to.deep.equal(["soft_livestream_mode_enabled"]);
            expect(detail.device_status).to.equal(Status.InvalidInState);
        });

        it("does not blame a snapshot on the recording switch, which carries no snapshot", async () => {
            // §11.2.8.13.3 tests the hard switch and the livestream one; a snapshot has no stream
            // usage for the recording switch to apply to.
            const state: CameraState = {
                ...STATE,
                features: cameraFeatures("snapshot", "privacy"),
                privacy: { hardModeOn: false, softLivestreamModeEnabled: false, softRecordingModeEnabled: true },
            };
            const { manager } = managerWith(state, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") throw statusError(Status.InvalidInState);
                return undefined;
            });
            let thrown: unknown;
            try {
                await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.not.be.instanceOf(ServerError);
            expect(deviceStatusOf(thrown)).to.equal(Status.InvalidInState);
        });
    });
});

describe("CameraStreamManager overlays", () => {
    /** A camera that draws both overlays, which makes both allocate fields mandatory. */
    const OVERLAY_STATE: CameraState = {
        ...STATE,
        features: cameraFeatures("video", "snapshot", "watermark", "onScreenDisplay"),
    };

    function allocatingManager(state: CameraState) {
        return managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
            if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
            if (invoke.command === "captureSnapshot") {
                return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
            }
            return undefined;
        });
    }

    function videoStream(overlays: OverlayBounds) {
        return {
            videoStreamId: 7,
            overlays,
            streamUsage: LIVE_VIEW,
            videoCodec: H265,
            minResolution: { width: 640, height: 360 },
            maxResolution: { width: 2560, height: 1440 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 8000000,
            referenceCount: 0,
        };
    }

    function snapshotStream(overlays: OverlayBounds) {
        return {
            snapshotStreamId: 8,
            overlays,
            imageCodec: 0,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            referenceCount: 0,
            frameRate: 1,
            encodedPixels: false,
            hardwareEncoder: false,
        };
    }

    async function resolve(state: CameraState, hints?: VideoHints) {
        const { manager, invokes } = allocatingManager(state);
        const stream = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
            ...(hints === undefined ? {} : { hints }),
        });
        return { stream, invokes };
    }

    it("asks a camera that draws overlays for neither when the caller stated neither", async () => {
        const { invokes } = await resolve(OVERLAY_STATE);
        const allocate = invokes.find(invoke => invoke.command === "videoStreamAllocate");
        // §11.2.6.11 gives both struct fields a fallback of 0, so false is what an unstated
        // overlay means; omitting the field is INVALID_COMMAND on such a camera.
        expect(allocate?.fields.watermarkEnabled).to.equal(false);
        expect(allocate?.fields.osdEnabled).to.equal(false);
    });

    it("sends what the caller stated", async () => {
        const { invokes, stream } = await resolve(OVERLAY_STATE, { watermarkEnabled: true });
        const allocate = invokes.find(invoke => invoke.command === "videoStreamAllocate");
        expect(allocate?.fields.watermarkEnabled).to.equal(true);
        expect(allocate?.fields.osdEnabled).to.equal(false);
        expect(requireVideoEnvelope(stream.envelope).overlays).to.deep.equal({
            watermarkEnabled: true,
            osdEnabled: false,
        });
    });

    it("sends neither field to a camera that advertises neither feature", async () => {
        const { invokes } = await resolve(STATE);
        const allocate = invokes.find(invoke => invoke.command === "videoStreamAllocate");
        expect(allocate?.fields).to.not.have.property("watermarkEnabled");
        expect(allocate?.fields).to.not.have.property("osdEnabled");
    });

    it("accepts a caller that declined an overlay the camera cannot draw anyway", async () => {
        const { invokes } = await resolve(STATE, { watermarkEnabled: false, osdEnabled: false });
        const allocate = invokes.find(invoke => invoke.command === "videoStreamAllocate");
        expect(allocate?.fields).to.not.have.property("watermarkEnabled");
        expect(allocate?.fields).to.not.have.property("osdEnabled");
    });

    it("names the missing feature when the caller demanded an overlay the camera cannot draw", async () => {
        let thrown: unknown;
        try {
            await resolve(STATE, { watermarkEnabled: true });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        const detail = JSON.parse((thrown as ServerError).message);
        expect(detail.reason).to.equal("feature");
        expect(detail.feature).to.equal("Watermark");
        expect(detail.track).to.equal("video");
    });

    it("names OnScreenDisplay for a demanded OSD the camera cannot draw", async () => {
        let thrown: unknown;
        try {
            await resolve(STATE, { osdEnabled: true });
        } catch (error) {
            thrown = error;
        }
        const detail = JSON.parse((thrown as ServerError).message);
        expect(detail.feature).to.equal("OnScreenDisplay");
    });

    it("does not reuse a stream without a watermark for a caller that asked for one", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [videoStream({ watermarkEnabled: false, osdEnabled: false })],
        };
        const { invokes, stream } = await resolve(state, { watermarkEnabled: true });
        expect(stream.reused).to.equal(false);
        expect(stream.streamId).to.equal(9);
        expect(invokes.some(invoke => invoke.command === "videoStreamAllocate")).to.equal(true);
    });

    it("does not reuse a watermarked stream for a caller that asked for no watermark", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [videoStream({ watermarkEnabled: true, osdEnabled: false })],
        };
        const { stream } = await resolve(state, { watermarkEnabled: false });
        expect(stream.reused).to.equal(false);
    });

    it("does not reuse a watermarked stream for a caller that stated nothing either", async () => {
        // An unstated overlay resolves to false, which is what the reuse rung then requires: two
        // identical calls may not get visibly different pictures depending on what is allocated.
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [videoStream({ watermarkEnabled: true, osdEnabled: false })],
        };
        const { stream } = await resolve(state);
        expect(stream.reused).to.equal(false);
    });

    it("reuses a stream whose overlays are the ones the request resolved to", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [videoStream({ watermarkEnabled: true, osdEnabled: false })],
        };
        const { stream } = await resolve(state, { watermarkEnabled: true, osdEnabled: false });
        expect(stream.reused).to.equal(true);
        expect(stream.streamId).to.equal(7);
    });

    it("reports a reused stream's own overlays, not the ones the request resolved to", async () => {
        // The reported envelope is the camera's statement about the stream, so a feature map that has
        // not arrived cannot turn a watermarked stream into an unwatermarked report.
        const state: CameraState = {
            ...STATE,
            features: {},
            allocatedVideoStreams: [videoStream({ watermarkEnabled: true, osdEnabled: false })],
        };
        const { stream } = await resolve(state, { watermarkEnabled: true });
        expect(stream.reused).to.equal(true);
        expect(requireVideoEnvelope(stream.envelope).overlays).to.deep.equal({
            watermarkEnabled: true,
            osdEnabled: false,
        });
    });

    it("reports a degraded stream's own overlays", async () => {
        const state: CameraState = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [
                { ...videoStream({ watermarkEnabled: true, osdEnabled: false }), referenceCount: 1 },
            ],
        };
        const { manager } = managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
            return undefined;
        });
        const stream = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
        });
        expect(stream.degraded).to.equal(true);
        expect(requireVideoEnvelope(stream.envelope).overlays).to.deep.equal({
            watermarkEnabled: true,
            osdEnabled: false,
        });
    });

    it("puts a taken stream's overlays back although the camera has not stated its feature map", async () => {
        // The replacement carries what the camera reported for the victim. Deriving it from the feature
        // map instead dropped the fields here, which both changes the picture and, on a camera that does
        // have the feature, is INVALID_COMMAND for the replacement allocate.
        // osdEnabled absent, as a camera without OSD reports it: the replacement must not send it.
        const victim = { ...videoStream({ watermarkEnabled: true }), videoStreamId: 11 };
        const state: CameraState = { ...STATE, features: {}, allocatedVideoStreams: [victim] };
        let allocates = 0;
        const { manager, invokes } = managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") {
                allocates += 1;
                if (allocates <= MAX_ALLOCATE_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 12 };
            }
            return undefined;
        });
        let thrown: unknown;
        try {
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { watermarkEnabled: false },
            });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        const restore = invokes.filter(invoke => invoke.command === "videoStreamAllocate").at(-1);
        expect(restore?.fields.watermarkEnabled).to.equal(true);
        expect(restore?.fields).to.not.have.property("osdEnabled");
    });

    it("hands out a stream with an unasked-for overlay only from the degraded rung, flagged", async () => {
        // The degraded rung gives up the server's own choices, and an unstated overlay is one of
        // them. A stated one is a caller bound and stays hard here too, which the next test shows.
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [
                { ...videoStream({ watermarkEnabled: true, osdEnabled: false }), referenceCount: 1 },
            ],
        };
        const { manager } = managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
            return undefined;
        });
        const stream = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: { codec: H265 },
        });
        expect(stream.streamId).to.equal(7);
        expect(stream.degraded).to.equal(true);
    });

    it("refuses rather than degrading onto a stream whose overlays the caller stated against", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [
                { ...videoStream({ watermarkEnabled: true, osdEnabled: false }), referenceCount: 1 },
            ],
        };
        const { manager } = managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") throw statusError(Status.ResourceExhausted);
            return undefined;
        });
        let thrown: unknown;
        try {
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { watermarkEnabled: false },
            });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
    });

    it("puts a taken stream's own overlays back on the replacement", async () => {
        // The restore does not undo the eviction, but it may not change the picture it puts back.
        const victim = { ...videoStream({ watermarkEnabled: true, osdEnabled: true }), videoStreamId: 11 };
        const state = { ...OVERLAY_STATE, allocatedVideoStreams: [victim] };
        let allocates = 0;
        const { manager, invokes } = managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate") {
                allocates += 1;
                // Every attempt for this request fails, so the capacity it bought goes unused and
                // the scope restores the victim; the restore's own allocate then succeeds.
                if (allocates <= MAX_ALLOCATE_ATTEMPTS) throw statusError(Status.ResourceExhausted);
                return { videoStreamId: 12 };
            }
            return undefined;
        });
        let thrown: unknown;
        try {
            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
                hints: { watermarkEnabled: false },
            });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        const restore = invokes.filter(invoke => invoke.command === "videoStreamAllocate").at(-1);
        expect(restore?.fields.watermarkEnabled).to.equal(true);
        expect(restore?.fields.osdEnabled).to.equal(true);
    });

    it("asks a snapshot camera that draws overlays for neither when the caller stated neither", async () => {
        const { manager, invokes } = allocatingManager(OVERLAY_STATE);
        await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
        const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
        expect(allocate?.fields.watermarkEnabled).to.equal(false);
        expect(allocate?.fields.osdEnabled).to.equal(false);
    });

    it("sends a snapshot's stated overlays", async () => {
        const { manager, invokes } = allocatingManager(OVERLAY_STATE);
        await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT, osdEnabled: true });
        const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
        expect(allocate?.fields.watermarkEnabled).to.equal(false);
        expect(allocate?.fields.osdEnabled).to.equal(true);
    });

    it("sends neither snapshot field to a camera that advertises neither feature", async () => {
        const { manager, invokes } = allocatingManager(STATE);
        await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
        const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
        expect(allocate?.fields).to.not.have.property("watermarkEnabled");
        expect(allocate?.fields).to.not.have.property("osdEnabled");
    });

    it("names the missing feature when a snapshot demanded an overlay the camera cannot draw", async () => {
        const { manager } = allocatingManager(STATE);
        let thrown: unknown;
        try {
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT, watermarkEnabled: true });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        const detail = JSON.parse((thrown as ServerError).message);
        expect(detail.reason).to.equal("feature");
        expect(detail.feature).to.equal("Watermark");
    });

    it("does not adopt a snapshot stream without the watermark the caller asked for", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedSnapshotStreams: [snapshotStream({ watermarkEnabled: false, osdEnabled: false })],
        };
        const { manager, invokes } = allocatingManager(state);
        const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT, watermarkEnabled: true });
        expect(result.snapshotStreamId).to.equal(3);
        expect(invokes.some(invoke => invoke.command === "snapshotStreamAllocate")).to.equal(true);
    });

    it("does not adopt a watermarked snapshot stream for a caller that stated nothing", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedSnapshotStreams: [snapshotStream({ watermarkEnabled: true, osdEnabled: false })],
        };
        const { manager } = allocatingManager(state);
        const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
        expect(result.snapshotStreamId).to.equal(3);
    });

    it("adopts a snapshot stream whose overlays are the ones the request resolved to", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedSnapshotStreams: [snapshotStream({ watermarkEnabled: true, osdEnabled: false })],
        };
        const { manager, invokes } = allocatingManager(state);
        const result = await manager.snapshot({
            nodeId: NODE,
            endpointId: ENDPOINT,
            watermarkEnabled: true,
            osdEnabled: false,
        });
        expect(result.snapshotStreamId).to.equal(8);
        expect(invokes.some(invoke => invoke.command === "snapshotStreamAllocate")).to.equal(false);
    });

    it("reports each allocated stream's overlays", async () => {
        const state = {
            ...OVERLAY_STATE,
            allocatedVideoStreams: [videoStream({ watermarkEnabled: true, osdEnabled: false })],
            allocatedSnapshotStreams: [snapshotStream({ watermarkEnabled: false, osdEnabled: true })],
        };
        const capabilities = await managerWith(state).manager.getCapabilities(NODE, ENDPOINT);
        expect(capabilities.allocated.video[0].overlays).to.deep.equal({
            watermarkEnabled: true,
            osdEnabled: false,
        });
        expect(capabilities.allocated.snapshot[0].overlays).to.deep.equal({
            watermarkEnabled: false,
            osdEnabled: true,
        });
    });

    it("sends only what the caller stated while the camera has not stated its feature map", async () => {
        // Nothing is gated on a map that has not arrived, so the caller's own statement reaches
        // the device and the device answers for itself.
        const state: CameraState = { ...STATE, features: {} };
        const { invokes } = await resolve(state, { osdEnabled: true });
        const allocate = invokes.find(invoke => invoke.command === "videoStreamAllocate");
        expect(allocate?.fields.osdEnabled).to.equal(true);
        expect(allocate?.fields).to.not.have.property("watermarkEnabled");
    });
});
