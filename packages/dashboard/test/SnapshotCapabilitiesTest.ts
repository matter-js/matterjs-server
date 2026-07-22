/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import {
    AVSM_FEATURE_MAP_ATTR_ID,
    AVSM_FEAT_OSD,
    AVSM_FEAT_SNP,
    AVSM_FEAT_WMARK,
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    WebRtcStreamView,
    parseSnapshotCapabilitiesFromList,
} from "../src/components/webrtc-stream-view.js";

// Tag-based (cached-attribute) SnapshotCapabilitiesStruct: 0=resolution {0:w,1:h},
// 1=maxFrameRate, 2=imageCodec, 3=requiresEncodedPixels.
const res = (w: number, h: number) => ({ "0": w, "1": h });

// A camera exposing an encoder-free 640×480 capability plus an encoder-required 1080p one.
const MIXED_CAPS = [
    { "0": res(640, 480), "1": 30, "2": 0, "3": false },
    { "0": res(1920, 1080), "1": 30, "2": 0, "3": true },
];

describe("parseSnapshotCapabilitiesFromList", () => {
    it("prefers the encoder-free capability when a stream is live (preferEncoderFree=true)", () => {
        const cap = parseSnapshotCapabilitiesFromList(MIXED_CAPS, true);
        expect(cap.requiresEncodedPixels).to.equal(false);
        expect(cap.resolution).to.deep.equal({ width: 640, height: 480 });
    });

    it("uses the highest-resolution capability when idle (preferEncoderFree=false)", () => {
        const cap = parseSnapshotCapabilitiesFromList(MIXED_CAPS, false);
        expect(cap.requiresEncodedPixels).to.equal(true);
        expect(cap.resolution).to.deep.equal({ width: 1920, height: 1080 });
    });

    it("takes the highest-resolution encoder-free entry when several exist", () => {
        const cap = parseSnapshotCapabilitiesFromList(
            [
                { "0": res(640, 480), "1": 30, "2": 0, "3": false },
                { "0": res(1280, 720), "1": 30, "2": 0, "3": false },
            ],
            true,
        );
        expect(cap.resolution).to.deep.equal({ width: 1280, height: 720 });
    });

    it("falls back to an encoder-requiring capability when none is encoder-free", () => {
        const cap = parseSnapshotCapabilitiesFromList([{ "0": res(1920, 1080), "1": 30, "2": 0, "3": true }], true);
        expect(cap.requiresEncodedPixels).to.equal(true);
        expect(cap.resolution).to.deep.equal({ width: 1920, height: 1080 });
    });

    it("skips non-object entries without crashing", () => {
        const cap = parseSnapshotCapabilitiesFromList(
            [null, 42, { "0": res(1920, 1080), "1": 30, "2": 0, "3": true }],
            true,
        );
        expect(cap.resolution).to.deep.equal({ width: 1920, height: 1080 });
    });

    it("parses name-based (read_attribute) shapes and treats a missing flag as encoder-requiring", () => {
        const cap = parseSnapshotCapabilitiesFromList(
            [{ resolution: { width: 1280, height: 720 }, maxFrameRate: 15, imageCodec: 0 }],
            true,
        );
        expect(cap.requiresEncodedPixels).to.equal(true);
        expect(cap.resolution).to.deep.equal({ width: 1280, height: 720 });
        expect(cap.maxFrameRate).to.equal(15);
    });
});

describe("WebRtcStreamView#start", () => {
    it("reports an error state instead of throwing when live view is unsupported", async () => {
        const view = new WebRtcStreamView();
        view.liveViewSupported = false;
        const states: { state: string; errorMessage: string | null }[] = [];
        view.addEventListener("streamstate", ev => states.push((ev as CustomEvent).detail));

        await view.start();

        expect(view.state).to.equal("error");
        expect(states).to.deep.equal([{ state: "error", errorMessage: "Live view is not supported on this device" }]);
    });
});

describe("WebRtcStreamView#takeSnapshot", () => {
    const NODE_ID = 10;
    const ENDPOINT_ID = 5;

    /** Records every deviceCommand call and fakes just enough of MatterClient for _ensureSnapshotStream. */
    function createFakeClient(featureBits = 0): {
        client: MatterClient;
        calls: { command: string; payload: Record<string, unknown> }[];
    } {
        const calls: { command: string; payload: Record<string, unknown> }[] = [];
        let nextStreamId = 0;
        const client = {
            nodes: {
                [String(NODE_ID)]: {
                    attributes: {
                        [`${ENDPOINT_ID}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/10`]: [
                            { "0": res(640, 480), "1": 30, "2": 0, "3": false },
                            { "0": res(1920, 1080), "1": 30, "2": 0, "3": false },
                        ],
                        // AllocatedSnapshotStreams: empty, so nothing is ever reused across allocations.
                        [`${ENDPOINT_ID}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/17`]: [],
                        [`${ENDPOINT_ID}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`]:
                            featureBits,
                    },
                },
            },
            deviceCommand: async (
                _nodeId: number | bigint,
                _endpointId: number,
                _clusterId: number,
                commandName: string,
                payload: Record<string, unknown> = {},
            ) => {
                calls.push({ command: commandName, payload });
                if (commandName === "SnapshotStreamAllocate") {
                    nextStreamId += 1;
                    return { snapshotStreamId: nextStreamId };
                }
                if (commandName === "CaptureSnapshot") {
                    return { data: "AA==", imageCodec: 0, resolution: payload["requestedResolution"] };
                }
                return {};
            },
        } as unknown as MatterClient;
        return { client, calls };
    }

    it("reuses the same snapshot stream across captures at the same resolution", async () => {
        const { client, calls } = createFakeClient();
        const view = new WebRtcStreamView();
        view.client = client;
        view.nodeId = NODE_ID;
        view.endpointId = ENDPOINT_ID;
        view.snapshotResolution = { width: 1920, height: 1080 };

        await view.takeSnapshot();
        await view.takeSnapshot();

        expect(calls.map(c => c.command)).to.deep.equal([
            "SnapshotStreamAllocate",
            "CaptureSnapshot",
            "CaptureSnapshot",
        ]);
    });

    it("deallocates and reallocates when the target resolution changes between captures", async () => {
        const { client, calls } = createFakeClient();
        const view = new WebRtcStreamView();
        view.client = client;
        view.nodeId = NODE_ID;
        view.endpointId = ENDPOINT_ID;

        view.snapshotResolution = { width: 1920, height: 1080 };
        const first = await view.takeSnapshot();
        expect(first.resolution).to.deep.equal({ width: 1920, height: 1080 });

        view.snapshotResolution = { width: 640, height: 480 };
        const second = await view.takeSnapshot();
        expect(second.resolution).to.deep.equal({ width: 640, height: 480 });

        expect(calls.map(c => c.command)).to.deep.equal([
            "SnapshotStreamAllocate",
            "CaptureSnapshot",
            "SnapshotStreamDeallocate",
            "SnapshotStreamAllocate",
            "CaptureSnapshot",
        ]);
        expect(calls[3]?.payload).to.deep.include({
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 640, height: 480 },
        });
    });

    it("serializes concurrent captures so two first-time calls allocate a single stream", async () => {
        const { client, calls } = createFakeClient();
        const view = new WebRtcStreamView();
        view.client = client;
        view.nodeId = NODE_ID;
        view.endpointId = ENDPOINT_ID;
        view.snapshotResolution = { width: 1920, height: 1080 };

        await Promise.all([view.takeSnapshot(), view.takeSnapshot()]);

        expect(calls.filter(c => c.command === "SnapshotStreamAllocate")).to.have.length(1);
        expect(calls.map(c => c.command)).to.deep.equal([
            "SnapshotStreamAllocate",
            "CaptureSnapshot",
            "CaptureSnapshot",
        ]);
    });

    it("captures at the user target resolution, not the stream max, when reusing an existing stream", async () => {
        const calls: { command: string; payload: Record<string, unknown> }[] = [];
        const client = {
            nodes: {
                [String(NODE_ID)]: {
                    attributes: {
                        [`${ENDPOINT_ID}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/10`]: [
                            { "0": res(640, 480), "1": 30, "2": 0, "3": false },
                            { "0": res(1920, 1080), "1": 30, "2": 0, "3": false },
                        ],
                        // AllocatedSnapshotStreams: a pre-existing stream whose range (640×480–1920×1080)
                        // covers, but is larger than, the user-selected 1280×720 target.
                        [`${ENDPOINT_ID}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/17`]: [
                            { "0": 7, "1": 0, "3": res(640, 480), "4": res(1920, 1080) },
                        ],
                        [`${ENDPOINT_ID}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`]: 0,
                    },
                },
            },
            deviceCommand: async (
                _n: number | bigint,
                _e: number,
                _c: number,
                commandName: string,
                payload: Record<string, unknown> = {},
            ) => {
                calls.push({ command: commandName, payload });
                if (commandName === "CaptureSnapshot") {
                    return { data: "AA==", imageCodec: 0, resolution: payload["requestedResolution"] };
                }
                return {};
            },
        } as unknown as MatterClient;

        const view = new WebRtcStreamView();
        view.client = client;
        view.nodeId = NODE_ID;
        view.endpointId = ENDPOINT_ID;
        view.snapshotResolution = { width: 1280, height: 720 };

        const snap = await view.takeSnapshot();

        expect(calls.map(c => c.command)).to.deep.equal(["CaptureSnapshot"]);
        expect(calls[0]?.payload).to.deep.include({
            snapshotStreamId: 7,
            requestedResolution: { width: 1280, height: 720 },
        });
        expect(snap.resolution).to.deep.equal({ width: 1280, height: 720 });
    });

    it("deallocates and reallocates when watermark/OSD toggles between captures", async () => {
        const { client, calls } = createFakeClient(AVSM_FEAT_SNP | AVSM_FEAT_WMARK | AVSM_FEAT_OSD);
        const view = new WebRtcStreamView();
        view.client = client;
        view.nodeId = NODE_ID;
        view.endpointId = ENDPOINT_ID;
        view.snapshotResolution = { width: 1920, height: 1080 };
        view.watermarkEnabled = false;
        view.osdEnabled = false;

        await view.takeSnapshot();

        view.watermarkEnabled = true;
        await view.takeSnapshot();

        expect(calls.map(c => c.command)).to.deep.equal([
            "SnapshotStreamAllocate",
            "CaptureSnapshot",
            "SnapshotStreamDeallocate",
            "SnapshotStreamAllocate",
            "CaptureSnapshot",
        ]);
        expect(calls[3]?.payload).to.deep.include({ watermarkEnabled: true, osdEnabled: false });
    });
});
