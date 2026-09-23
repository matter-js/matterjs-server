/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, Logger, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import { Status, StatusResponseError } from "@matter/main/types";
import type { CameraDeviceIo, CameraState } from "../src/camera/CameraStreamManager.js";
import {
    CameraStreamManager,
    DEVICE_CLEANUP_BUDGET_MS,
    preferredVideoCodec,
    UNREPORTED_LEASE_GRACE_MS,
} from "../src/camera/CameraStreamManager.js";
import type { AudioEnvelope, VideoEnvelope } from "../src/camera/cameraTypes.js";
import { deviceStatusOf } from "../src/camera/deviceStatus.js";
import { videoCodecLimits } from "../src/camera/sdpConstraints.js";
import type { SdpVideoConstraints } from "../src/camera/sdpConstraints.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

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

export const NODE = NodeId(5);
export const ENDPOINT = EndpointNumber(1);
export const H265 = 1;
export const LIVE_VIEW = 3;

export const STATE: CameraState = {
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

/** An offer whose audio m-line sends as well as receives, i.e. the caller wants talkback. */
export const TALKBACK_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "a=sendrecv",
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

export interface RecordedInvoke {
    command: string;
    fields: Record<string, unknown>;
    nodeId: NodeId;
    endpointId: EndpointNumber;
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
): { manager: CameraStreamManager; invokes: RecordedInvoke[]; holder: { state: CameraState | undefined } } {
    const invokes = new Array<RecordedInvoke>();
    const holder: { state: CameraState | undefined } = { state };
    const io: CameraDeviceIo = {
        readCameraState: async () => holder.state,
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
            };
            invokes.push(recorded);
            return respond(recorded);
        },
    };
    return { manager: new CameraStreamManager(io), invokes, holder };
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
        missingCameraClusters: async () => new Array<number>(),
        invoke: async args => {
            const recorded = {
                command: args.command,
                fields: args.fields,
                nodeId: args.nodeId,
                endpointId: args.endpointId,
            };
            invokes.push(recorded);
            return respond(recorded);
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
            expect(capabilities.allocated.video[0].ownedByServer).to.equal(false);
            expect(capabilities.allocated.video[0].minBitRate).to.equal(800000);
            expect(capabilities.allocated.video[0].maxBitRate).to.equal(4000000);
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
                    if (allocateAttempts === 1) throw statusError(Status.ResourceExhausted);
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
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(2);
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
                    if (allocateAttempts === 1) {
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
                    if (allocateAttempts === 1) {
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
                if (allocateAttempts === 2) throw statusError(Status.ResourceExhausted);
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
                videoCodec: H264,
                streamUsage: 1,
                referenceCount: 0,
            };
            const analysis = {
                ...CONTAINED_STREAM,
                videoStreamId: 21,
                videoCodec: H264,
                streamUsage: 2,
                referenceCount: 0,
            };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([recording, analysis]), async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                allocateAttempts += 1;
                if (allocateAttempts === 1) throw statusError(Status.ResourceExhausted);
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
                if (allocateAttempts === 1) throw statusError(Status.ResourceExhausted);
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
            // MAX_NARROWING_ROUNDS = 3, rounds 0..3 inclusive: exactly 4 allocate attempts.
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
                        audio: { state: "offered" as const, codecs: ["AAC"] },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
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
                    audio: { state: "offered" as const, codecs: ["AAC"] },
                    wantsTalkback: false,
                    limitsByCodec: new Map(),
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
                    audio: { state: "offered" as const },
                    wantsTalkback: false,
                    limitsByCodec: new Map(),
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
            const { manager } = managerWith(STATE, async () => {
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
            expect(detail.reason).to.equal("capability");
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
            expect(detail.reason).to.equal("capability");
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
            expect(detail.reason).to.equal("capability");
            expect(detail.requested).to.deep.equal([]);
            expect(detail.track).to.equal("audio");
        });

        it("references the resolved stream ids in the provider offer", async () => {
            const { manager, invokes } = allocatingManager();
            const session = await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: "v=0",
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
                    sdp: "v=0",
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
                sdp: "v=0",
                video: {},
                audio: false,
            });
            const ended = await manager.stopStream(NODE, ENDPOINT, 42);
            expect(ended).to.equal(true);
            expect(invokes.map(invoke => invoke.command)).to.include("endSession");
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
        });

        it("reports false and does nothing for a session id that is not tracked", async () => {
            const { manager, invokes } = allocatingManager();
            const ended = await manager.stopStream(NODE, ENDPOINT, 999);
            expect(ended).to.equal(false);
            expect(invokes.map(invoke => invoke.command)).to.not.include("endSession");
        });

        it("reports false and does not end a session tracked for a different node", async () => {
            const { manager, invokes } = allocatingManager();
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: "v=0",
                video: {},
                audio: false,
            });
            const otherNode = NodeId(999);
            const ended = await manager.stopStream(otherNode, ENDPOINT, 42);
            expect(ended).to.equal(false);
            expect(invokes.map(invoke => invoke.command)).to.not.include("endSession");
        });

        it("reports false and does not end a session tracked for a different endpoint", async () => {
            const { manager, invokes } = allocatingManager();
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: "v=0",
                video: {},
                audio: false,
            });
            const otherEndpoint = EndpointNumber(99);
            const ended = await manager.stopStream(NODE, otherEndpoint, 42);
            expect(ended).to.equal(false);
            expect(invokes.map(invoke => invoke.command)).to.not.include("endSession");
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
                sdp: "v=0",
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
                sdp: "v=0",
                video: {},
                audio: false,
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-2",
                streamUsage: LIVE_VIEW,
                sdp: "v=1",
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
                sdp: "v=0",
                video: {},
                audio: false,
            });
            await reachedOffer; // Call 1 now holds the endpoint lock, blocked inside provideOffer.
            const second = manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-2",
                streamUsage: LIVE_VIEW,
                sdp: "v=0",
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
                sdp: "v=0",
                video: {},
                audio: false,
            });
            await reachedOffer; // Endpoint ENDPOINT's lock is held, blocked inside provideOffer.
            const second = manager.startStream({
                nodeId: NODE,
                endpointId: OTHER_ENDPOINT,
                connectionId: "conn-2",
                streamUsage: LIVE_VIEW,
                sdp: "v=0",
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
                sdp: "v=0",
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
            const { manager, invokes } = allocatingManager();
            await start(manager);

            expect(manager.forgetSession(NODE, ENDPOINT, 42)).to.equal(true);
            expect(await manager.stopStream(NODE, ENDPOINT, 42)).to.equal(false);
            await manager.stopAll();
            expect(endedSessions(invokes)).to.deep.equal([]);
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
                    sdp: "v=0",
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
                    sdp: "v=0",
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
            expect(JSON.parse((thrown as ServerError).message).reason).to.equal("capability");
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
                    sdp: "v=0",
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
            expect(result.downgraded).to.equal(true);
            const allocate = invokes.find(invoke => invoke.command === "snapshotStreamAllocate");
            expect(allocate?.fields.minResolution).to.deep.equal({ width: 640, height: 480 });
            expect(allocate?.fields.maxResolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("keeps the best capability while a viewer streams on a camera with encoders to spare", async () => {
            // One live stream on a camera that states four encoders leaves three. Reading any live
            // stream as "no encoder left" costs the caller picture size and reports it as a downgrade
            // that did not happen.
            const spare: CameraState = {
                ...STATE,
                maxConcurrentEncoders: 4,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
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
            const { manager } = managerWith(spare, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(result.downgraded).to.equal(false);
        });

        it("keeps the best capability although the device still lists a snapshot stream", async () => {
            // AllocatedSnapshotStreams is a cached view that lags a deallocate, so the stream the
            // previous camera_snapshot gave back is still listed. Counting it against the encoder
            // budget would clamp this call to a smaller capability and report the loss as a
            // downgrade, which is the false report the budget exists to remove.
            const stale: CameraState = {
                ...STATE,
                allocatedSnapshotStreams: [
                    {
                        snapshotStreamId: 8,
                        imageCodec: 0,
                        minResolution: { width: 640, height: 480 },
                        maxResolution: { width: 1920, height: 1080 },
                        referenceCount: 0,
                    },
                ],
            };
            const { manager } = managerWith(stale, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            const result = await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(result.resolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(result.downgraded).to.equal(false);
        });

        it("uses the highest capability when nothing holds the encoder", async () => {
            const { manager } = managerWith(STATE, async invoke => {
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
            expect(result.downgraded).to.equal(false);
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

        it("keeps a capability that needs no hardware encoder while a video stream is live", async () => {
            // requiresEncodedPixels with requiresHardwareEncoder false takes no encoder, so filtering
            // on requiresEncodedPixels alone would drop the best capability the camera can still serve.
            const softwareEncoded: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
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
            // it needs no encoder, so reporting a downgrade would be a false alarm.
            expect(result.downgraded).to.equal(false);
        });

        it("reports a downgrade when the device refuses the best capability and the next one is smaller", async () => {
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
            expect(result.downgraded).to.equal(true);
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

        it("gives the snapshot stream back although the frame was delivered", async () => {
            // An allocated snapshot stream takes one of MaxConcurrentEncoders for as long as it exists,
            // so keeping it would make the next poll fail and would block video allocation entirely.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(
                invokes
                    .filter(invoke => invoke.command === "snapshotStreamDeallocate")
                    .map(invoke => invoke.fields.snapshotStreamId),
            ).to.deep.equal([3]);
        });

        it("allocates one snapshot stream per call and never two at once", async () => {
            // A polling client is the case this guards: one stream per poll left behind is what made
            // every snapshot after the first fail with 103 on single-encoder hardware.
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(invokes.map(invoke => invoke.command)).to.deep.equal([
                "snapshotStreamAllocate",
                "captureSnapshot",
                "snapshotStreamDeallocate",
                "snapshotStreamAllocate",
                "captureSnapshot",
                "snapshotStreamDeallocate",
            ]);
        });

        /** A snapshot stream the device already lists, at the camera's largest capability. */
        const EXISTING_SNAPSHOT_STREAM = {
            snapshotStreamId: 8,
            imageCodec: 0,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            referenceCount: 0,
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
            expect(result.downgraded).to.equal(false);
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

        it("reports the downgrade from the frame the device delivered, not from the stream it used", async () => {
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
            expect(result.downgraded).to.equal(true);
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
            expect(invokes.map(invoke => invoke.command)).to.deep.equal([
                "snapshotStreamAllocate",
                "captureSnapshot",
                "snapshotStreamDeallocate",
            ]);
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
                "snapshotStreamDeallocate",
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

        it("keeps a snapshot stream releasable when the device refuses to take it back", async () => {
            // The caller is told nothing about the stream, so the lease is the only record that this
            // server allocated it and may still free it.
            const { manager, invokes } = probeWith({ ...STATE, allocatedSnapshotStreams: [] }, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 1920, height: 1080 } };
                }
                if (invoke.command === "snapshotStreamDeallocate" && invokes.length < 4) {
                    throw new Error("deallocate refused");
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(manager.endpointsWithLeases).to.equal(1);

            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "snapshot", streamId: 3 });
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
                    sdp: "v=0",
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
        it("refuses to release a stream the device still references", async () => {
            const referenced: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
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
            const { manager } = managerWith(referenced);
            let thrown: unknown;
            try {
                await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamInUse);
        });

        it("releases a stream the server did not allocate, because the camera allows it", async () => {
            const foreign: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
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

        it("forwards the camera's own refusal rather than deciding for it", async () => {
            const foreign: CameraState = {
                ...STATE,
                allocatedVideoStreams: [
                    {
                        videoStreamId: 1,
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

        it("leases no snapshot stream when the capability it used holds the hardware encoder", async () => {
            const { manager } = probeWith({ ...STATE, allocatedSnapshotStreams: [] }, async invoke => {
                if (invoke.command === "snapshotStreamAllocate") return { snapshotStreamId: 3 };
                if (invoke.command === "captureSnapshot") {
                    return { data: new Uint8Array([1]), imageCodec: 0, resolution: { width: 640, height: 480 } };
                }
                return undefined;
            });
            await manager.snapshot({ nodeId: NODE, endpointId: ENDPOINT });
            expect(manager.endpointsWithLeases).to.equal(0);
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
                        if (liveViewAllocates === 1) throw statusError(Status.ResourceExhausted);
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
                    sdp: "v=0",
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
                    video: { state: "offered" as const },
                    audio: { state: "absent" as const },
                    wantsTalkback: false,
                    limitsByCodec: new Map([["H265", { maxPixels: 1280 * 720 }]]),
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
            video: { state: "offered" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
        };
        const failure = incompatible(() => preferredVideoCodec([H265], offer, undefined));
        expect(failure.code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        expect(failure.payload.reason).to.equal("codec");
        expect(failure.payload.requested).to.deep.equal(["H264"]);
    });

    it("reports the set the failing step narrowed, not the camera's full list", () => {
        // After the offer has ruled H.265 out, "the camera supports H.265" is not the answer the
        // client needs to act on.
        const offer = {
            video: { state: "offered" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
        };
        const failure = incompatible(() => preferredVideoCodec([H264, H265], offer, ["H265"]));
        expect(failure.payload.device).to.deep.equal(["H264"]);
    });

    it("keeps the offer's narrowing when a later hint agrees with it", () => {
        const offer = {
            video: { state: "offered" as const, codecs: ["H264"] },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
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
            video: { state: "offered" as const },
            audio: { state: "absent" as const },
            wantsTalkback: false,
            limitsByCodec: new Map(),
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
        sdp: "v=0",
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
            const { manager } = managerWith(STATE, async invoke => {
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

            await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                limits: { codec: H265 },
            });
            answerSilentDeallocate();
            // A macrotask boundary: every microtask the answered invoke queued, including the
            // give-back's own continuation, has run by the time this resolves.
            await new Promise<void>(resolve => setImmediate(resolve));

            // The lease the second request took is the only record that this server may free stream 9.
            await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 9 });
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
            expect(capabilities.allocated.video.map(stream => stream.ownedByServer)).to.deep.equal([false]);
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
});
