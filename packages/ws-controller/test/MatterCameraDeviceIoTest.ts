/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import type { RawCameraAvStreamManagementState } from "../src/camera/MatterCameraDeviceIo.js";
import { MatterCameraDeviceIo, toCameraState } from "../src/camera/MatterCameraDeviceIo.js";
import type { ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";

const MINIMAL_STATE: RawCameraAvStreamManagementState = {
    supportedStreamUsages: [3],
    streamUsagePriorities: [3],
    maxNetworkBandwidth: 8000000,
};

describe("toCameraState", () => {
    it("defaults every feature-gated list to empty when the source omits it", () => {
        const state = toCameraState(MINIMAL_STATE);
        expect(state.rateDistortionTradeOffPoints).to.deep.equal([]);
        expect(state.snapshotCapabilities).to.deep.equal([]);
        expect(state.allocatedVideoStreams).to.deep.equal([]);
        expect(state.allocatedAudioStreams).to.deep.equal([]);
        expect(state.allocatedSnapshotStreams).to.deep.equal([]);
        expect(state.videoSensorParams).to.equal(undefined);
        expect(state.microphoneCapabilities).to.equal(undefined);
    });

    it("copies supportedStreamUsages/streamUsagePriorities into plain mutable arrays", () => {
        const source: readonly number[] = [1, 2, 3];
        const state = toCameraState({ ...MINIMAL_STATE, supportedStreamUsages: source, streamUsagePriorities: source });
        expect(state.supportedStreamUsages).to.deep.equal([1, 2, 3]);
        expect(state.supportedStreamUsages).to.not.equal(source);
    });

    it("renames maxHdrfps to maxHdrFps and derives hdrCapable from hdrModeEnabled's presence", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            videoSensorParams: { sensorWidth: 2560, sensorHeight: 1440, maxFps: 30, maxHdrfps: 15 },
            hdrModeEnabled: true,
        });
        expect(state.videoSensorParams).to.deep.equal({
            sensorWidth: 2560,
            sensorHeight: 1440,
            maxFps: 30,
            maxHdrFps: 15,
            hdrCapable: true,
        });
    });

    it("carries videoSensorParams through without maxHdrfps when the device omits it", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        });
        expect(state.videoSensorParams?.maxHdrFps).to.equal(undefined);
    });

    it("reports hdrCapable false when the device has no HighDynamicRange feature", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        });
        expect(state.videoSensorParams?.hdrCapable).to.equal(false);
    });

    it("maps rateDistortionTradeOffPoints field names one-to-one", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            rateDistortionTradeOffPoints: [{ codec: 1, resolution: { width: 1920, height: 1080 }, minBitRate: 800000 }],
        });
        expect(state.rateDistortionTradeOffPoints).to.deep.equal([
            { codec: 1, resolution: { width: 1920, height: 1080 }, minBitRate: 800000 },
        ]);
    });

    it("defaults requiresHardwareEncoder to false when the device omits it", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            snapshotCapabilities: [
                {
                    resolution: { width: 640, height: 480 },
                    maxFrameRate: 1,
                    imageCodec: 0,
                    requiresEncodedPixels: false,
                },
            ],
        });
        expect(state.snapshotCapabilities[0]?.requiresHardwareEncoder).to.equal(false);
    });

    it("carries a stated requiresHardwareEncoder through unchanged", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            snapshotCapabilities: [
                {
                    resolution: { width: 640, height: 480 },
                    maxFrameRate: 1,
                    imageCodec: 0,
                    requiresEncodedPixels: true,
                    requiresHardwareEncoder: true,
                },
            ],
        });
        expect(state.snapshotCapabilities[0]?.requiresHardwareEncoder).to.equal(true);
    });

    it("maps an allocated video stream field-for-field", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            allocatedVideoStreams: [
                {
                    videoStreamId: 1,
                    streamUsage: 3,
                    videoCodec: 1,
                    minResolution: { width: 640, height: 360 },
                    maxResolution: { width: 1920, height: 1080 },
                    minFrameRate: 1,
                    maxFrameRate: 30,
                    minBitRate: 100000,
                    maxBitRate: 8000000,
                    keyFrameInterval: 2000,
                    referenceCount: 2,
                },
            ],
        });
        expect(state.allocatedVideoStreams).to.deep.equal([
            {
                videoStreamId: 1,
                streamUsage: 3,
                videoCodec: 1,
                minResolution: { width: 640, height: 360 },
                maxResolution: { width: 1920, height: 1080 },
                minFrameRate: 1,
                maxFrameRate: 30,
                minBitRate: 100000,
                maxBitRate: 8000000,
                referenceCount: 2,
            },
        ]);
    });

    it("maps an allocated audio stream field-for-field", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            allocatedAudioStreams: [
                {
                    audioStreamId: 2,
                    streamUsage: 3,
                    audioCodec: 0,
                    channelCount: 1,
                    sampleRate: 48000,
                    bitRate: 64000,
                    bitDepth: 16,
                    referenceCount: 1,
                },
            ],
        });
        expect(state.allocatedAudioStreams).to.deep.equal([
            {
                audioStreamId: 2,
                streamUsage: 3,
                audioCodec: 0,
                channelCount: 1,
                sampleRate: 48000,
                bitRate: 64000,
                bitDepth: 16,
                referenceCount: 1,
            },
        ]);
    });

    it("collapses an allocated snapshot stream's independent min/max into one resolution", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            allocatedSnapshotStreams: [
                {
                    snapshotStreamId: 3,
                    imageCodec: 0,
                    frameRate: 1,
                    minResolution: { width: 640, height: 480 },
                    maxResolution: { width: 640, height: 480 },
                    quality: 100,
                    encodedPixels: false,
                    hardwareEncoder: false,
                    referenceCount: 0,
                },
            ],
        });
        expect(state.allocatedSnapshotStreams).to.deep.equal([
            { snapshotStreamId: 3, imageCodec: 0, resolution: { width: 640, height: 480 }, referenceCount: 0 },
        ]);
    });

    it("copies microphoneCapabilities' list fields into plain mutable arrays", () => {
        const codecs: readonly number[] = [0, 1];
        const state = toCameraState({
            ...MINIMAL_STATE,
            microphoneCapabilities: {
                supportedCodecs: codecs,
                maxNumberOfChannels: 2,
                supportedSampleRates: [48000],
                supportedBitDepths: [16],
            },
        });
        expect(state.microphoneCapabilities).to.deep.equal({
            supportedCodecs: [0, 1],
            maxNumberOfChannels: 2,
            supportedSampleRates: [48000],
            supportedBitDepths: [16],
        });
        expect(state.microphoneCapabilities?.supportedCodecs).to.not.equal(codecs);
    });

    it("carries twoWayTalkSupport and scalar limits through unchanged", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            maxConcurrentEncoders: 1,
            maxEncodedPixelRate: 248832000,
            maxNetworkBandwidth: 4000000,
            twoWayTalkSupport: 2,
        });
        expect(state.maxConcurrentEncoders).to.equal(1);
        expect(state.maxEncodedPixelRate).to.equal(248832000);
        expect(state.maxNetworkBandwidth).to.equal(4000000);
        expect(state.twoWayTalkSupport).to.equal(2);
    });
});

describe("MatterCameraDeviceIo.invoke (webrtcProvider routing)", () => {
    const NODE_ID = NodeId(5n);
    const ENDPOINT_ID = EndpointNumber(1);

    interface HandlerStub {
        invokeCommand: () => Promise<unknown>;
        invokeWebRtcProviderCommand: (args: unknown) => Promise<unknown>;
        removeTrackedWebRtcSession: (webRtcSessionId: number) => Promise<void>;
    }

    function makeHandler(overrides: Partial<HandlerStub> = {}): ControllerCommandHandler {
        const stub: HandlerStub & { getNode: () => { node: unknown } } = {
            getNode: () => ({ node: {} }),
            invokeCommand: overrides.invokeCommand ?? (async () => undefined),
            invokeWebRtcProviderCommand: overrides.invokeWebRtcProviderCommand ?? (async () => undefined),
            removeTrackedWebRtcSession: overrides.removeTrackedWebRtcSession ?? (async () => {}),
        };
        return stub as unknown as ControllerCommandHandler;
    }

    it("routes a provideOffer invoke through invokeWebRtcProviderCommand as ProvideOffer", async () => {
        const calls = new Array<unknown>();
        const io = new MatterCameraDeviceIo(
            makeHandler({
                invokeWebRtcProviderCommand: async args => {
                    calls.push(args);
                    return { webRtcSessionId: 1 };
                },
            }),
        );

        await io.invoke({
            nodeId: NODE_ID,
            endpointId: ENDPOINT_ID,
            cluster: "webrtcProvider",
            command: "provideOffer",
            fields: { sdp: "v=0" },
        });

        expect(calls).to.deep.equal([
            { nodeId: NODE_ID, endpointId: ENDPOINT_ID, commandName: "ProvideOffer", fields: { sdp: "v=0" } },
        ]);
    });

    it("routes a solicitOffer invoke through invokeWebRtcProviderCommand as SolicitOffer", async () => {
        const calls = new Array<unknown>();
        const io = new MatterCameraDeviceIo(
            makeHandler({
                invokeWebRtcProviderCommand: async args => {
                    calls.push(args);
                    return { webRtcSessionId: 2 };
                },
            }),
        );

        await io.invoke({
            nodeId: NODE_ID,
            endpointId: ENDPOINT_ID,
            cluster: "webrtcProvider",
            command: "solicitOffer",
            fields: { streamUsage: 3 },
        });

        expect(calls).to.deep.equal([
            { nodeId: NODE_ID, endpointId: ENDPOINT_ID, commandName: "SolicitOffer", fields: { streamUsage: 3 } },
        ]);
    });

    it("untracks the session after a successful endSession invoke", async () => {
        const untracked = new Array<number>();
        const io = new MatterCameraDeviceIo(
            makeHandler({
                invokeCommand: async () => undefined,
                removeTrackedWebRtcSession: async webRtcSessionId => {
                    untracked.push(webRtcSessionId);
                },
            }),
        );

        await io.invoke({
            nodeId: NODE_ID,
            endpointId: ENDPOINT_ID,
            cluster: "webrtcProvider",
            command: "endSession",
            fields: { webRtcSessionId: 7, reason: 0 },
        });

        expect(untracked).to.deep.equal([7]);
    });

    it("does not untrack when endSession's webRtcSessionId is missing or non-numeric", async () => {
        const untracked = new Array<number>();
        const io = new MatterCameraDeviceIo(
            makeHandler({
                removeTrackedWebRtcSession: async webRtcSessionId => {
                    untracked.push(webRtcSessionId);
                },
            }),
        );

        await io.invoke({
            nodeId: NODE_ID,
            endpointId: ENDPOINT_ID,
            cluster: "webrtcProvider",
            command: "endSession",
            fields: { webRtcSessionId: "7" },
        });

        expect(untracked).to.deep.equal([]);
    });
});
