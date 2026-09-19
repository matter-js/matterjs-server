/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RawCameraAvStreamManagementState } from "../src/camera/MatterCameraDeviceIo.js";
import { toCameraState } from "../src/camera/MatterCameraDeviceIo.js";

const MINIMAL_STATE: RawCameraAvStreamManagementState = {
    supportedStreamUsages: [3],
    streamUsagePriorities: [3],
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

    it("renames maxHdrfps to maxHdrFps and reports hdrCapable absent", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            videoSensorParams: { sensorWidth: 2560, sensorHeight: 1440, maxFps: 30, maxHdrfps: 15 },
        });
        expect(state.videoSensorParams).to.deep.equal({
            sensorWidth: 2560,
            sensorHeight: 1440,
            maxFps: 30,
            maxHdrFps: 15,
            hdrCapable: undefined,
        });
    });

    it("carries videoSensorParams through without maxHdrfps when the device omits it", () => {
        const state = toCameraState({
            ...MINIMAL_STATE,
            videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        });
        expect(state.videoSensorParams?.maxHdrFps).to.equal(undefined);
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
                    maxResolution: { width: 640, height: 480 },
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
            twoWayTalkSupport: 2,
        });
        expect(state.maxConcurrentEncoders).to.equal(1);
        expect(state.maxEncodedPixelRate).to.equal(248832000);
        expect(state.twoWayTalkSupport).to.equal(2);
    });
});
