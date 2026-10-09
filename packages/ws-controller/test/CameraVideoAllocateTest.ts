/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Status, StatusResponseError } from "@matter/main/types";
import type { CameraState } from "../src/camera/CameraStreamManager.js";
import type { AllocatedVideoStream, Resolution } from "../src/camera/cameraTypes.js";
import { parseSdpVideoConstraints, videoCodecLimits } from "../src/camera/sdpConstraints.js";
import type { SelectedVideoCodecLimits } from "../src/camera/sdpConstraints.js";
import type { VideoHints } from "../src/camera/streamPolicy.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { NO_OVERLAYS } from "./cameraFixtures.js";
import { ENDPOINT, LIVE_VIEW, managerWith, NODE, STATE } from "./CameraStreamManagerTest.js";
import type { RecordedInvoke } from "./CameraStreamManagerTest.js";

const H264 = 0;
const RECORDING = 1;

/** What the Aqara Camera Hub G350 (AVSM revision 2) reports: the reference camera app's values. */
const AQARA_STATE: CameraState = {
    ...STATE,
    maxConcurrentEncoders: 1,
    maxEncodedPixelRate: 248832000,
    maxNetworkBandwidth: 128000000,
    videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 120, maxHdrFps: undefined, hdrCapable: false },
    minViewportResolution: { width: 640, height: 480 },
    rateDistortionTradeOffPoints: [{ codec: H264, resolution: { width: 640, height: 480 }, minBitRate: 10000 }],
    allocatedVideoStreams: [],
};

interface Range<T> {
    min: T;
    max: T;
}

interface Profile {
    /** Also the stream id the camera answers with, as the reference app does. */
    id: number;
    frameRate: Range<number>;
    resolution: Range<Resolution>;
    bitRate: Range<number>;
}

const BIT_RATE = { min: 10000, max: 2000000 };

/**
 * The Aqara's fixed stream profiles as raw `VideoStreamAllocate` probes found them: a 720p window at
 * 30 fps got stream id 1, wider windows id 3. None of the frame rate floor, the bit rate ceiling or
 * the key frame rule is published in an attribute.
 */
const AQARA_PROFILES: Profile[] = [
    {
        id: 1,
        frameRate: { min: 30, max: 60 },
        resolution: { min: { width: 640, height: 480 }, max: { width: 1280, height: 720 } },
        bitRate: BIT_RATE,
    },
    {
        id: 2,
        frameRate: { min: 60, max: 120 },
        resolution: { min: { width: 1280, height: 720 }, max: { width: 1920, height: 1080 } },
        bitRate: BIT_RATE,
    },
    {
        id: 3,
        frameRate: { min: 30, max: 120 },
        resolution: { min: { width: 640, height: 480 }, max: { width: 1920, height: 1080 } },
        bitRate: BIT_RATE,
    },
];

function numberField(invoke: RecordedInvoke, name: string): number {
    const value = invoke.fields[name];
    if (typeof value !== "number") throw new Error(`${name} is not a number`);
    return value;
}

function resolutionField(invoke: RecordedInvoke, name: string): Resolution {
    const value = invoke.fields[name];
    if (typeof value !== "object" || value === null || !("width" in value) || !("height" in value)) {
        throw new Error(`${name} is not a resolution`);
    }
    const { width, height } = value;
    if (typeof width !== "number" || typeof height !== "number") throw new Error(`${name} is not a resolution`);
    return { width, height };
}

function compatibleProfiles(invoke: RecordedInvoke): Profile[] {
    if (invoke.fields.videoCodec !== H264 || invoke.fields.keyFrameInterval !== 4000) return [];
    const minResolution = resolutionField(invoke, "minResolution");
    const maxResolution = resolutionField(invoke, "maxResolution");
    return AQARA_PROFILES.filter(
        profile =>
            numberField(invoke, "minFrameRate") >= profile.frameRate.min &&
            numberField(invoke, "maxFrameRate") <= profile.frameRate.max &&
            minResolution.width >= profile.resolution.min.width &&
            minResolution.height >= profile.resolution.min.height &&
            maxResolution.width <= profile.resolution.max.width &&
            maxResolution.height <= profile.resolution.max.height &&
            numberField(invoke, "minBitRate") >= profile.bitRate.min &&
            numberField(invoke, "maxBitRate") <= profile.bitRate.max,
    );
}

/**
 * The fake camera, in the reference app's order (`CameraAVStreamManager::VideoStreamAllocate`): a window
 * outside every profile is DynamicConstraintError; then a taken encoder or no free compatible profile
 * is ResourceExhausted. `MaxConcurrentEncoders` is 1 and every allocated stream holds an encoder.
 */
function aqara(allocatedProfiles: number[] = []): (invoke: RecordedInvoke) => Promise<unknown> {
    const allocated = new Set(allocatedProfiles);
    return async invoke => {
        if (invoke.command === "videoStreamDeallocate") {
            allocated.delete(numberField(invoke, "videoStreamId"));
            return undefined;
        }
        if (invoke.command !== "videoStreamAllocate") return undefined;
        const compatible = compatibleProfiles(invoke);
        if (compatible.length === 0) throw StatusResponseError.create(Status.DynamicConstraintError);
        const free = compatible.find(profile => !allocated.has(profile.id));
        if (allocated.size >= 1 || free === undefined) throw StatusResponseError.create(Status.ResourceExhausted);
        allocated.add(free.id);
        return { videoStreamId: free.id };
    };
}

/**
 * A stream another controller allocated on profile 3, which takes the camera's only encoder. At 640x480
 * and 30 fps it leaves most of the encoder budget free; at 1920x1080 and 120 fps it spends all of it.
 */
function recordingStream(referenceCount: number, spendsBudget = false): AllocatedVideoStream {
    return {
        videoStreamId: 3,
        overlays: NO_OVERLAYS,
        streamUsage: RECORDING,
        videoCodec: H264,
        minResolution: { width: 640, height: 480 },
        maxResolution: spendsBudget ? { width: 1920, height: 1080 } : { width: 640, height: 480 },
        minFrameRate: 30,
        maxFrameRate: spendsBudget ? 120 : 30,
        minBitRate: 10000,
        maxBitRate: 2000000,
        keyFrameInterval: 4000,
        referenceCount,
    };
}

/** Firefox's H.264 offer: profile-level-id 42e01f is level 3.1, so 1280x720 at 30 fps and up to 14 Mbit/s. */
const FIREFOX_OFFER = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 126",
    "a=recvonly",
    "a=rtpmap:126 H264/90000",
    "a=fmtp:126 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1",
].join("\r\n");

const FIREFOX_LIMITS = videoCodecLimits(parseSdpVideoConstraints(FIREFOX_OFFER), H264);

function allocates(invokes: RecordedInvoke[]): RecordedInvoke[] {
    return invokes.filter(invoke => invoke.command === "videoStreamAllocate");
}

function summary(invoke: RecordedInvoke): string {
    const max = resolutionField(invoke, "maxResolution");
    const rate = `${numberField(invoke, "minFrameRate")}-${numberField(invoke, "maxFrameRate")}`;
    return `${max.width}x${max.height}@${rate} ${numberField(invoke, "maxBitRate")}`;
}

async function resolveOn(
    state: CameraState,
    respond: (invoke: RecordedInvoke) => Promise<unknown>,
    hints?: VideoHints,
    limits: SelectedVideoCodecLimits = FIREFOX_LIMITS,
): Promise<{ invokes: RecordedInvoke[]; result: unknown }> {
    const { manager, invokes } = managerWith(state, respond);
    try {
        const result = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits,
            hints,
        });
        return { invokes, result };
    } catch (error) {
        return { invokes, result: error };
    }
}

describe("VideoStreamAllocate against a camera with fixed stream profiles", () => {
    describe("the fake camera", () => {
        /** Rows from the raw probes against the real camera; the fake must give the same answer. */
        const PROBES: { fields: Record<string, unknown>; streamId: number | undefined }[] = [
            {
                fields: { minFrameRate: 1, maxFrameRate: 30, maxBitRate: 14000000, keyFrameInterval: 2000 },
                streamId: undefined,
            },
            { fields: { minFrameRate: 30, maxFrameRate: 120 }, streamId: 3 },
            { fields: { minFrameRate: 30, maxFrameRate: 30 }, streamId: 3 },
            { fields: { minFrameRate: 15, maxFrameRate: 30 }, streamId: undefined },
            { fields: { minFrameRate: 29, maxFrameRate: 30 }, streamId: undefined },
            { fields: { minFrameRate: 30, maxFrameRate: 121 }, streamId: undefined },
            { fields: { maxBitRate: 2000000 }, streamId: 3 },
            { fields: { maxBitRate: 2000001 }, streamId: undefined },
            { fields: { minBitRate: 9999 }, streamId: undefined },
            { fields: { minResolution: { width: 320, height: 240 } }, streamId: undefined },
            { fields: { keyFrameInterval: 3999 }, streamId: undefined },
            { fields: { keyFrameInterval: 5000 }, streamId: undefined },
            {
                fields: {
                    minFrameRate: 30,
                    maxFrameRate: 30,
                    minResolution: { width: 1280, height: 720 },
                    maxResolution: { width: 1280, height: 720 },
                    maxBitRate: 2000000,
                },
                streamId: 1,
            },
        ];
        const BASE = {
            streamUsage: LIVE_VIEW,
            videoCodec: H264,
            minFrameRate: 30,
            maxFrameRate: 120,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 1920, height: 1080 },
            minBitRate: 10000,
            maxBitRate: 10000,
            keyFrameInterval: 4000,
        };

        for (const probe of PROBES) {
            it(`${probe.streamId === undefined ? "refuses" : "accepts"} ${JSON.stringify(probe.fields)}`, async () => {
                const invoke: RecordedInvoke = {
                    command: "videoStreamAllocate",
                    fields: { ...BASE, ...probe.fields },
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                };
                const answer = await aqara()(invoke).catch(() => undefined);
                expect(answer).to.deep.equal(
                    probe.streamId === undefined ? undefined : { videoStreamId: probe.streamId },
                );
            });
        }

        it("answers a servable window with ResourceExhausted while its encoder is taken", async () => {
            const invoke: RecordedInvoke = {
                command: "videoStreamAllocate",
                fields: BASE,
                nodeId: NODE,
                endpointId: ENDPOINT,
            };
            const refused = await aqara([3])(invoke).catch(error => error);
            expect(refused).to.have.property("code", Status.ResourceExhausted);
        });
    });

    it("finds a window the camera accepts with no caller hints, lowering only the bit rate", async () => {
        const { invokes, result } = await resolveOn(AQARA_STATE, aqara());
        expect(result).to.deep.include({ streamId: 1, provenance: "allocated" });
        const sent = allocates(invokes);
        expect(sent[0].fields).to.deep.include({
            videoCodec: H264,
            minFrameRate: 30,
            maxFrameRate: 30,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 1280, height: 720 },
            minBitRate: 10000,
            maxBitRate: 8000000,
            keyFrameInterval: 4000,
        });
        expect(sent.map(summary)).to.deep.equal([
            "1280x720@30-30 8000000",
            "1280x720@30-30 4000000",
            "1280x720@30-30 2000000",
        ]);
    });

    it("finds a window without an offer, starting at the default bit rate, not the network bandwidth", async () => {
        // No offer: the sensor size at max_fps. MaxNetworkBandwidth (128 Mbit/s) does not raise the start.
        const { invokes, result } = await resolveOn(AQARA_STATE, aqara(), undefined, { codec: H264 });
        expect(result).to.deep.include({ streamId: 3 });
        expect(allocates(invokes).map(summary)).to.deep.equal([
            "1920x1080@120-120 8000000",
            "1920x1080@120-120 4000000",
            "1920x1080@120-120 2000000",
        ]);
        expect(allocates(invokes).at(-1)?.fields).to.deep.include({ minResolution: { width: 640, height: 480 } });
    });

    it("reaches a hidden bit rate ceiling far below the default", async () => {
        const { invokes, result } = await resolveOn(AQARA_STATE, async invoke => {
            if (invoke.command !== "videoStreamAllocate") return undefined;
            if (numberField(invoke, "maxBitRate") > 500000)
                throw StatusResponseError.create(Status.DynamicConstraintError);
            return { videoStreamId: 6 };
        });
        expect(result).to.deep.include({ streamId: 6 });
        expect(allocates(invokes).map(invoke => invoke.fields.maxBitRate)).to.deep.equal([
            8000000, 4000000, 2000000, 1000000, 500000,
        ]);
    });

    it("asks for one frame rate inside a caller's range the camera's hidden floor lies in", async () => {
        const { invokes, result } = await resolveOn(AQARA_STATE, aqara(), { minFrameRate: 15, maxFrameRate: 60 });
        expect(result).to.deep.include({ streamId: 1 });
        expect(allocates(invokes).at(-1)?.fields).to.deep.include({ minFrameRate: 30, maxFrameRate: 30 });
    });

    it("keeps every retry inside the bounds the caller stated", async () => {
        const hints = {
            minFrameRate: 10,
            maxFrameRate: 25,
            minBitRate: 50000,
            maxBitRate: 4000000,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 1280, height: 720 },
        };
        // 25 fps at most is under the camera's hidden 30 fps floor, so every window is refused.
        const { invokes, result } = await resolveOn(AQARA_STATE, aqara(), hints);
        expect(result).to.be.instanceOf(ServerError);
        expect(result).to.have.property("code", ServerErrorCode.CameraStreamIncompatible);
        const sent = allocates(invokes);
        expect(sent.length).to.be.greaterThan(5);
        for (const invoke of sent) {
            expect(numberField(invoke, "minFrameRate")).to.equal(numberField(invoke, "maxFrameRate"));
            expect(numberField(invoke, "maxFrameRate")).to.be.within(10, 25);
            expect(numberField(invoke, "minBitRate")).to.equal(50000);
            expect(numberField(invoke, "maxBitRate")).to.be.within(50000, 4000000);
            const max = resolutionField(invoke, "maxResolution");
            expect(max.width).to.be.within(640, 1280);
            expect(max.height).to.be.within(480, 720);
            expect(invoke.fields.keyFrameInterval).to.equal(4000);
        }
    });

    it("gives up bit rate, then frame rate, then frame size, at the size's own highest rate", async () => {
        const { invokes } = await resolveOn(AQARA_STATE, async () => {
            throw StatusResponseError.create(Status.DynamicConstraintError);
        });
        // Level 3.1 decodes 640x480 at up to 90 fps, so the smaller size starts there.
        // Bit rate halves down to the trade-off point's 10000 bit/s before frame rate is touched.
        expect(allocates(invokes).map(summary)).to.deep.equal([
            "1280x720@30-30 8000000",
            "1280x720@30-30 4000000",
            "1280x720@30-30 2000000",
            "1280x720@30-30 1000000",
            "1280x720@30-30 500000",
            "1280x720@30-30 250000",
            "1280x720@30-30 125000",
            "1280x720@30-30 62500",
            "1280x720@30-30 31250",
            "1280x720@30-30 15625",
            "1280x720@30-30 10000",
            "1280x720@15-15 10000",
            "1280x720@7-7 10000",
            "640x480@90-90 10000",
            "640x480@45-45 10000",
            "640x480@22-22 10000",
        ]);
    });

    it("reaches a camera that serves only 7 fps", async () => {
        const { invokes, result } = await resolveOn(AQARA_STATE, async invoke => {
            if (invoke.command !== "videoStreamAllocate") return undefined;
            if (numberField(invoke, "maxFrameRate") > 7)
                throw StatusResponseError.create(Status.DynamicConstraintError);
            return { videoStreamId: 5 };
        });
        expect(result).to.deep.include({ streamId: 5 });
        expect(allocates(invokes).at(-1)?.fields).to.deep.include({ minFrameRate: 7, maxFrameRate: 7 });
    });

    it("evicts an idle stream that holds the encoder budget once the camera answers ResourceExhausted, and keeps 30 fps", async () => {
        const state = { ...AQARA_STATE, allocatedVideoStreams: [recordingStream(0, true)] };
        const { invokes, result } = await resolveOn(state, aqara([3]));
        expect(result).to.deep.include({ streamId: 1, evicted: [3] });
        const commands = invokes.map(invoke =>
            invoke.command === "videoStreamAllocate" ? summary(invoke) : invoke.command,
        );
        // Nothing fits the budget, so the smallest size is asked; the room made goes to 1280x720.
        expect(commands).to.deep.equal([
            "640x480@30-30 8000000",
            "640x480@30-30 4000000",
            "640x480@30-30 2000000",
            "videoStreamDeallocate",
            "1280x720@30-30 2000000",
        ]);
    });

    it("takes no stream while the camera accepts a window the budget predicted it could not carry", async () => {
        const state = { ...AQARA_STATE, allocatedVideoStreams: [recordingStream(0, true)] };
        const { invokes, result } = await resolveOn(state, async invoke =>
            invoke.command === "videoStreamAllocate" ? { videoStreamId: 9 } : undefined,
        );
        expect(result).to.deep.include({ streamId: 9 });
        expect(invokes.map(invoke => invoke.command)).to.deep.equal(["videoStreamAllocate"]);
    });

    it("reuses a slower stream of its usage when no window fits the encoder budget", async () => {
        const slow: AllocatedVideoStream = {
            ...recordingStream(1),
            videoStreamId: 4,
            streamUsage: LIVE_VIEW,
            minFrameRate: 15,
            maxFrameRate: 15,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 640, height: 480 },
            minBitRate: 10000,
            maxBitRate: 1000000,
        };
        const state = { ...AQARA_STATE, allocatedVideoStreams: [recordingStream(1, true), slow] };
        const { invokes, result } = await resolveOn(state, aqara([3, 1]));
        expect(result).to.deep.include({ streamId: 4 });
        expect(invokes.map(invoke => invoke.command)).to.deep.equal([]);
    });

    it("does not offer a stream the camera refused to deallocate for eviction again", async () => {
        const state = { ...AQARA_STATE, allocatedVideoStreams: [recordingStream(0)] };
        const camera = aqara([3]);
        const { invokes, result } = await resolveOn(state, async invoke => {
            if (invoke.command === "videoStreamDeallocate") throw StatusResponseError.create(Status.Failure);
            return camera(invoke);
        });
        expect(result).to.have.property("code", ServerErrorCode.CameraResourceExhausted);
        expect(invokes.filter(invoke => invoke.command === "videoStreamDeallocate")).to.have.length(1);
    });

    it("evicts an idle stream after a capacity refusal and keeps the frame rate", async () => {
        const state = { ...AQARA_STATE, allocatedVideoStreams: [recordingStream(0)] };
        const { invokes, result } = await resolveOn(state, aqara([3]));
        expect(result).to.deep.include({ streamId: 1, evicted: [3] });
        const commands = invokes.map(invoke =>
            invoke.command === "videoStreamAllocate" ? summary(invoke) : invoke.command,
        );
        expect(commands).to.deep.equal([
            "1280x720@30-30 8000000",
            "1280x720@30-30 4000000",
            // Servable, but the only encoder is taken.
            "1280x720@30-30 2000000",
            "640x480@30-30 2000000",
            "videoStreamDeallocate",
            // Back to the best window refused only for capacity.
            "1280x720@30-30 2000000",
        ]);
    });

    it("never turns a capacity refusal into an incompatibility when nothing can be taken", async () => {
        const state = { ...AQARA_STATE, allocatedVideoStreams: [recordingStream(1)] };
        const { invokes, result } = await resolveOn(state, aqara([3]));
        expect(result).to.have.property("code", ServerErrorCode.CameraResourceExhausted);
        const frameRates = allocates(invokes).map(invoke => numberField(invoke, "maxFrameRate"));
        // One frame rate step, refused below the hidden floor, and no second one.
        expect(frameRates.filter(rate => rate < 30)).to.deep.equal([15]);
    });

    it("steps only the resolution, then the frame rate, while the camera answers ResourceExhausted", async () => {
        const { invokes } = await resolveOn(AQARA_STATE, async invoke => {
            if (invoke.command === "videoStreamAllocate") throw StatusResponseError.create(Status.ResourceExhausted);
            return undefined;
        });
        expect(allocates(invokes).map(summary)).to.deep.equal([
            "1280x720@30-30 8000000",
            "640x480@30-30 8000000",
            "640x480@15-15 8000000",
            "640x480@7-7 8000000",
        ]);
    });

    it("still reaches the smallest size when the bit rate walks down to 1 bit/s first", async () => {
        // No trade-off point, so the bit rate floor is 1: 22 halvings from 8 Mbit/s, then frame rate and size.
        const state: CameraState = { ...STATE, rateDistortionTradeOffPoints: [] };
        const { manager, invokes } = managerWith(state, async invoke => {
            if (invoke.command === "videoStreamAllocate")
                throw StatusResponseError.create(Status.DynamicConstraintError);
            return undefined;
        });
        await manager
            .resolveVideoStream({ nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, limits: { codec: 1 } })
            .catch(() => undefined);
        const sent = allocates(invokes);
        expect(sent).to.have.length(31);
        expect(sent.at(-1)?.fields).to.deep.include({ maxResolution: { width: 640, height: 360 }, maxBitRate: 1 });
    });

    it("gives up within a bounded number of attempts on a camera that refuses every window", async () => {
        const { manager, invokes } = managerWith(STATE, async invoke => {
            if (invoke.command === "videoStreamAllocate")
                throw StatusResponseError.create(Status.DynamicConstraintError);
            return undefined;
        });
        const refused = await manager
            .resolveVideoStream({ nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, limits: { codec: 1 } })
            .catch(error => error);
        expect(refused).to.have.property("code", ServerErrorCode.CameraStreamIncompatible);
        // Four bit rate steps and two frame rate steps at each of the three sizes.
        expect(allocates(invokes)).to.have.length(13);
    });
});
