/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import type { CameraDeviceIo, CameraState } from "../src/camera/CameraStreamManager.js";
import { CameraStreamManager } from "../src/camera/CameraStreamManager.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

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

export interface RecordedInvoke {
    command: string;
    fields: Record<string, unknown>;
}

/**
 * A manager over a mutable state holder, recording every invoke so tests can assert on the wire
 * traffic. The holder lets a later test allocate a stream mid-test and have `readCameraState`
 * reflect it without rebuilding the fixture.
 */
export function managerWith(
    state: CameraState | undefined,
    respond: (invoke: RecordedInvoke) => Promise<unknown> = async () => undefined,
): { manager: CameraStreamManager; invokes: RecordedInvoke[]; holder: { state: CameraState | undefined } } {
    const invokes = new Array<RecordedInvoke>();
    const holder: { state: CameraState | undefined } = { state };
    const io: CameraDeviceIo = {
        readCameraState: async () => holder.state,
        invoke: async args => {
            const recorded = { command: args.command, fields: args.fields };
            invokes.push(recorded);
            return respond(recorded);
        },
    };
    return { manager: new CameraStreamManager(io), invokes, holder };
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
        const DYNAMIC_CONSTRAINT_ERROR = 0x87;
        const RESOURCE_EXHAUSTED = 0x89;

        function statusError(status: number): Error & { code: number } {
            const error = new Error(`Device returned status ${status}`) as Error & { code: number };
            error.code = status;
            return error;
        }

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
                codec: H265,
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.reused).to.equal(true);
            expect(resolved.allocatedByUs).to.equal(false);
            expect(invokes).to.deep.equal([]);
        });

        it("does not reuse a stream whose floor is below the requested floor", async () => {
            // Issue #1056: [720p..1080p] may deliver 720p, so a 1080p floor is not satisfied.
            const wider = { ...CONTAINED_STREAM, minResolution: { width: 1280, height: 720 } };
            const { manager, invokes } = managerWith(withStreams([wider]), async () => ({ videoStreamId: 9 }));
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                codec: H265,
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
                codec: H265,
            });
            expect(resolved.allocatedByUs).to.equal(true);
        });

        it("narrows the envelope and retries when the device rejects the parameters", async () => {
            let attempt = 0;
            const { manager, invokes } = managerWith(STATE, async () => {
                attempt += 1;
                if (attempt === 1) throw statusError(DYNAMIC_CONSTRAINT_ERROR);
                return { videoStreamId: 9 };
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                codec: H265,
            });
            expect(resolved.streamId).to.equal(9);
            expect(invokes).to.have.length(2);
            const first = invokes[0].fields.maxResolution as { width: number };
            const second = invokes[1].fields.maxResolution as { width: number };
            expect(second.width).to.be.lessThan(first.width);
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
                    codec: H265,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as { code: number }).code).to.equal(UNSUPPORTED);
            expect(invokes).to.have.length(1);
        });

        it("retries reuse ignoring stream usage when resources are exhausted", async () => {
            const otherUsage = { ...CONTAINED_STREAM, streamUsage: 1 };
            const { manager, invokes } = managerWith(withStreams([otherUsage]), async () => {
                throw statusError(RESOURCE_EXHAUSTED);
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                codec: H265,
                hints: PINNED_1080P,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.reused).to.equal(true);
            // Distinguishes this rung from the later degraded fallback, which would also accept this
            // stream (same caller bounds) but only after exhausting the narrowing loop first.
            expect(resolved.degraded).to.equal(undefined);
            expect(invokes).to.have.length(1);
        });

        it("deallocates an unreferenced stream and retries rather than failing", async () => {
            const idle = { ...CONTAINED_STREAM, videoStreamId: 7, referenceCount: 0 };
            let allocateAttempts = 0;
            const { manager, invokes } = managerWith(withStreams([idle]), async invoke => {
                if (invoke.command === "videoStreamAllocate") {
                    allocateAttempts += 1;
                    if (allocateAttempts === 1) throw statusError(RESOURCE_EXHAUSTED);
                    return { videoStreamId: 11 };
                }
                return undefined;
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                codec: H265,
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
                if (allocateAttempts === 2) throw statusError(RESOURCE_EXHAUSTED);
                return { videoStreamId: 30 };
            });
            const request = { nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, codec: H265 };
            await manager.resolveVideoStream(request); // allocates and owns stream 20

            const foreign = { ...CONTAINED_STREAM, videoStreamId: 21, videoCodec: H264, referenceCount: 0 };
            const ours = { ...CONTAINED_STREAM, videoStreamId: 20, videoCodec: H264, referenceCount: 0 };
            holder.state = { ...STATE, allocatedVideoStreams: [foreign, ours] };

            const resolved = await manager.resolveVideoStream(request);
            expect(resolved.streamId).to.equal(30);
            const deallocated = invokes.find(invoke => invoke.command === "videoStreamDeallocate");
            expect(deallocated?.fields.videoStreamId).to.equal(20);
            expect(holder.state?.allocatedVideoStreams.map(stream => stream.videoStreamId)).to.deep.equal([21]);
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
                throw statusError(RESOURCE_EXHAUSTED);
            });
            const resolved = await manager.resolveVideoStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                codec: H265,
            });
            expect(resolved.streamId).to.equal(7);
            expect(resolved.degraded).to.equal(true);
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
                throw statusError(RESOURCE_EXHAUSTED);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    codec: H265,
                    hints: PINNED_1080P,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
        });

        it("fails typed with the allocated list once the ladder is exhausted", async () => {
            const { manager, invokes } = managerWith(withStreams([CONTAINED_STREAM]), async () => {
                throw statusError(RESOURCE_EXHAUSTED);
            });
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    codec: H265,
                    hints: { maxResolution: { width: 1280, height: 720 } },
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraResourceExhausted);
            expect(JSON.parse((thrown as ServerError).message).allocated).to.deep.equal([
                { stream_id: 7, reference_count: 1 },
            ]);
            expect(invokes.length).to.be.at.most(4);
        });

        it("fails typed when no codec suits both the camera and the offer", async () => {
            const { manager } = managerWith(STATE);
            let thrown: unknown;
            try {
                await manager.resolveVideoStream({
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                    streamUsage: LIVE_VIEW,
                    codec: 99,
                });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        });

        it("allocates once when two callers race for the same endpoint", async () => {
            const { manager, invokes, holder } = managerWith(STATE, async invoke => {
                if (invoke.command !== "videoStreamAllocate") return undefined;
                // The mock stands in for the device: the second caller only sees the allocation as a
                // matter of re-reading state, so the response must land in the state it reads back.
                if (holder.state !== undefined) {
                    holder.state = {
                        ...holder.state,
                        allocatedVideoStreams: [
                            ...holder.state.allocatedVideoStreams,
                            { ...CONTAINED_STREAM, videoStreamId: 9 },
                        ],
                    };
                }
                return { videoStreamId: 9 };
            });
            const request = {
                nodeId: NODE,
                endpointId: ENDPOINT,
                streamUsage: LIVE_VIEW,
                codec: H265,
            };
            // The second caller must see the first one's lease, not race past it into a twin stream.
            await Promise.all([manager.resolveVideoStream(request), manager.resolveVideoStream(request)]);
            expect(invokes.filter(invoke => invoke.command === "videoStreamAllocate")).to.have.length(1);
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
                invoke: async () => ({ videoStreamId: 9 }),
            };
            const manager = new TestableCameraStreamManager(io);
            const request = { nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, codec: H265 };
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
    });

    describe("sessions", () => {
        function allocatingManager() {
            return managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
        }

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
            await manager.stopStream(42);
            expect(invokes.map(invoke => invoke.command)).to.include("endSession");
            expect(invokes.map(invoke => invoke.command)).to.not.include("videoStreamDeallocate");
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

        it("refuses to release a stream the server did not allocate", async () => {
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
            const { manager } = managerWith(foreign);
            let thrown: unknown;
            try {
                await manager.releaseStream({ nodeId: NODE, endpointId: ENDPOINT, kind: "video", streamId: 1 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.CameraStreamNotOwned);
        });
    });
});
