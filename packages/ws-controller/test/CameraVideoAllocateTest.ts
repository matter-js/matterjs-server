/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Status, StatusResponseError } from "@matter/main/types";
import type { CameraState } from "../src/camera/CameraStreamManager.js";
import type { Resolution } from "../src/camera/cameraTypes.js";
import { parseSdpVideoConstraints, videoCodecLimits } from "../src/camera/sdpConstraints.js";
import type { VideoHints } from "../src/camera/streamPolicy.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { ENDPOINT, LIVE_VIEW, managerWith, NODE, STATE } from "./CameraStreamManagerTest.js";
import type { RecordedInvoke } from "./CameraStreamManagerTest.js";

const H264 = 0;

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
    frameRate: Range<number>;
    resolution: Range<Resolution>;
    bitRate: Range<number>;
}

/**
 * The Aqara's fixed stream profiles as raw `VideoStreamAllocate` probes found them. None of the frame
 * rate floor, the bit rate ceiling or the key frame rule is published in an attribute.
 */
const AQARA_PROFILES: Profile[] = [
    {
        frameRate: { min: 30, max: 120 },
        resolution: { min: { width: 640, height: 480 }, max: { width: 1920, height: 1080 } },
        bitRate: { min: 10000, max: 2000000 },
    },
    {
        frameRate: { min: 30, max: 30 },
        resolution: { min: { width: 1280, height: 720 }, max: { width: 1280, height: 720 } },
        bitRate: { min: 10000, max: 2000000 },
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

function aqaraAccepts(invoke: RecordedInvoke): boolean {
    if (invoke.fields.videoCodec !== H264 || invoke.fields.keyFrameInterval !== 4000) return false;
    const minResolution = resolutionField(invoke, "minResolution");
    const maxResolution = resolutionField(invoke, "maxResolution");
    return AQARA_PROFILES.some(
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

/** The fake camera: a window outside every profile is DynamicConstraintError, as on the device. */
async function aqara(invoke: RecordedInvoke): Promise<unknown> {
    if (invoke.command !== "videoStreamAllocate") return undefined;
    if (!aqaraAccepts(invoke)) throw StatusResponseError.create(Status.DynamicConstraintError);
    return { videoStreamId: 3 };
}

/** Firefox's H.264 offer: profile-level-id 42e01f is level 3.1, so 1280x720 at 30 fps and 14 Mbit/s. */
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

async function resolveOnAqara(
    respond: (invoke: RecordedInvoke) => Promise<unknown>,
    hints?: VideoHints,
): Promise<{ invokes: RecordedInvoke[]; result: unknown }> {
    const { manager, invokes } = managerWith(AQARA_STATE, respond);
    try {
        const result = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: FIREFOX_LIMITS,
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
        const PROBES: { fields: Record<string, unknown>; accepted: boolean }[] = [
            {
                fields: { minFrameRate: 1, maxFrameRate: 30, maxBitRate: 14000000, keyFrameInterval: 2000 },
                accepted: false,
            },
            { fields: { minFrameRate: 30, maxFrameRate: 120 }, accepted: true },
            { fields: { minFrameRate: 29, maxFrameRate: 30 }, accepted: false },
            { fields: { minFrameRate: 30, maxFrameRate: 121 }, accepted: false },
            { fields: { maxBitRate: 2000000 }, accepted: true },
            { fields: { maxBitRate: 2000001 }, accepted: false },
            { fields: { minBitRate: 9999 }, accepted: false },
            { fields: { minResolution: { width: 320, height: 240 } }, accepted: false },
            { fields: { keyFrameInterval: 3999 }, accepted: false },
            { fields: { keyFrameInterval: 5000 }, accepted: false },
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
            it(`${probe.accepted ? "accepts" : "refuses"} ${JSON.stringify(probe.fields)}`, () => {
                const invoke: RecordedInvoke = {
                    command: "videoStreamAllocate",
                    fields: { ...BASE, ...probe.fields },
                    nodeId: NODE,
                    endpointId: ENDPOINT,
                };
                expect(aqaraAccepts(invoke)).to.equal(probe.accepted);
            });
        }
    });

    it("finds a window the camera accepts with no caller hints, lowering only the bit rate", async () => {
        const { invokes, result } = await resolveOnAqara(aqara);
        expect(result).to.deep.include({ streamId: 3, provenance: "allocated" });
        const sent = allocates(invokes);
        expect(sent[0].fields).to.deep.include({
            videoCodec: H264,
            minFrameRate: 30,
            maxFrameRate: 30,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 1280, height: 720 },
            minBitRate: 10000,
            maxBitRate: 14000000,
            keyFrameInterval: 4000,
        });
        expect(sent.map(invoke => invoke.fields.maxBitRate)).to.deep.equal([14000000, 7000000, 3500000, 1750000]);
        for (const invoke of sent) {
            expect(invoke.fields.maxFrameRate).to.equal(30);
            expect(invoke.fields.maxResolution).to.deep.equal({ width: 1280, height: 720 });
        }
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
        // The 10 fps floor is under the camera's hidden 30 fps floor, so every window is refused.
        const { invokes, result } = await resolveOnAqara(aqara, hints);
        expect(result).to.be.instanceOf(ServerError);
        expect(result).to.have.property("code", ServerErrorCode.CameraStreamIncompatible);
        const sent = allocates(invokes);
        expect(sent.length).to.be.greaterThan(5);
        for (const invoke of sent) {
            expect(numberField(invoke, "minFrameRate")).to.equal(10);
            expect(numberField(invoke, "maxFrameRate")).to.be.within(10, 25);
            expect(numberField(invoke, "minBitRate")).to.equal(50000);
            expect(numberField(invoke, "maxBitRate")).to.be.within(50000, 4000000);
            const max = resolutionField(invoke, "maxResolution");
            expect(max.width).to.be.within(640, 1280);
            expect(max.height).to.be.within(480, 720);
            expect(invoke.fields.keyFrameInterval).to.equal(4000);
        }
    });

    it("steps the frame rate and then the resolution down once the bit rate steps are spent", async () => {
        const { invokes } = await resolveOnAqara(async () => {
            throw StatusResponseError.create(Status.DynamicConstraintError);
        });
        const summary = allocates(invokes).map(invoke => {
            const max = resolutionField(invoke, "maxResolution");
            return `${max.width}x${max.height}@${String(invoke.fields.maxFrameRate)} ${String(invoke.fields.maxBitRate)}`;
        });
        expect(summary).to.deep.equal([
            "1280x720@30 14000000",
            "1280x720@30 7000000",
            "1280x720@30 3500000",
            "1280x720@30 1750000",
            "1280x720@30 875000",
            "1280x720@15 875000",
            "1280x720@7 875000",
            "640x480@7 875000",
        ]);
    });

    it("skips the bit rate steps after a capacity refusal, since they charge the encoder the same", async () => {
        const { invokes } = await resolveOnAqara(async invoke => {
            if (invoke.command === "videoStreamAllocate") throw StatusResponseError.create(Status.ResourceExhausted);
            return undefined;
        });
        const sent = allocates(invokes);
        expect(sent.map(invoke => invoke.fields.maxBitRate)).to.deep.equal([14000000, 14000000, 14000000, 14000000]);
        expect(sent.map(invoke => invoke.fields.maxFrameRate)).to.deep.equal([30, 15, 7, 7]);
        expect(sent[3].fields.maxResolution).to.deep.equal({ width: 640, height: 480 });
    });

    it("tries every window before it gives up on a camera that refuses each one", async () => {
        const { manager, invokes } = managerWith(STATE, async invoke => {
            if (invoke.command === "videoStreamAllocate")
                throw StatusResponseError.create(Status.DynamicConstraintError);
            return undefined;
        });
        const refused = await manager
            .resolveVideoStream({ nodeId: NODE, endpointId: ENDPOINT, streamUsage: LIVE_VIEW, limits: { codec: 1 } })
            .catch(error => error);
        expect(refused).to.have.property("code", ServerErrorCode.CameraStreamIncompatible);
        // Four bit rate, two frame rate and two resolution steps after the first window.
        expect(allocates(invokes)).to.have.length(9);
    });

    it("restarts after freeing capacity at the first window the camera did not refuse as unservable", async () => {
        const idle = {
            videoStreamId: 7,
            overlays: { watermarkEnabled: false, osdEnabled: false },
            streamUsage: LIVE_VIEW,
            videoCodec: 1,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 30,
            maxFrameRate: 30,
            minBitRate: 10000,
            maxBitRate: 2000000,
            referenceCount: 0,
        };
        let freed = 0;
        let attempts = 0;
        const { manager, invokes } = managerWith({ ...AQARA_STATE, allocatedVideoStreams: [idle] }, async invoke => {
            if (invoke.command === "videoStreamDeallocate") freed += 1;
            if (invoke.command !== "videoStreamAllocate") return undefined;
            attempts += 1;
            if (attempts === 1) throw StatusResponseError.create(Status.DynamicConstraintError);
            if (freed === 0) throw StatusResponseError.create(Status.ResourceExhausted);
            return { videoStreamId: 4 };
        });
        const resolved = await manager.resolveVideoStream({
            nodeId: NODE,
            endpointId: ENDPOINT,
            streamUsage: LIVE_VIEW,
            limits: FIREFOX_LIMITS,
        });
        expect(resolved.evicted).to.deep.equal([7]);
        const accepted = allocates(invokes).at(-1);
        expect(accepted?.fields).to.deep.include({
            maxBitRate: 7000000,
            maxFrameRate: 30,
            maxResolution: { width: 1280, height: 720 },
        });
    });
});
