/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID,
    supportsAudioOnlyLiveView,
    supportsLiveView,
    supportsSnapshot,
} from "../src/util/camera.js";

const DESCRIPTOR_CLUSTER_ID = 29;
const AVSM_FEATURE_MAP_ATTR_ID = 0xfffc;
const AVSM_FEAT_ADO = 1 << 0;
const AVSM_FEAT_VDO = 1 << 1;
const AVSM_FEAT_SNP = 1 << 2;
const AVSM_ACCEPTED_COMMAND_LIST_ATTR_ID = 0xfff9;
const AVSM_SNAPSHOT_CAPABILITIES_ATTR_ID = 10;
const CAPTURE_SNAPSHOT_COMMAND_ID = 12;
const SERVER_LIST_ATTR_ID = 1;
const ENDPOINT = 6;

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

// An endpoint exposing both clusters required for a WebRTC live-view session — the shape
// shared by Audio Doorbell, Intercom, Camera and Video Doorbell.
function liveViewNode(featureMap: number): MatterNode {
    return node({
        [`${ENDPOINT}/${DESCRIPTOR_CLUSTER_ID}/${SERVER_LIST_ATTR_ID}`]: [
            WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID,
            CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
        ],
        [`${ENDPOINT}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`]: featureMap,
    });
}

describe("supportsAudioOnlyLiveView", () => {
    it("is true for an Audio Doorbell / Intercom-shaped endpoint (live view, no VDO)", () => {
        const n = liveViewNode(AVSM_FEAT_ADO);
        expect(supportsLiveView(n, ENDPOINT)).to.equal(true);
        expect(supportsAudioOnlyLiveView(n, ENDPOINT)).to.equal(true);
    });

    it("is false for a device that advertises Video", () => {
        const n = liveViewNode(AVSM_FEAT_ADO | AVSM_FEAT_VDO);
        expect(supportsAudioOnlyLiveView(n, ENDPOINT)).to.equal(false);
    });

    it("is false when the endpoint doesn't support live view at all", () => {
        const n = node({});
        expect(supportsAudioOnlyLiveView(n, ENDPOINT)).to.equal(false);
    });

    it("is false for a live-view endpoint whose FeatureMap hasn't arrived (don't mislabel a real camera)", () => {
        const n = node({
            [`${ENDPOINT}/${DESCRIPTOR_CLUSTER_ID}/${SERVER_LIST_ATTR_ID}`]: [
                WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID,
                CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
            ],
        });
        expect(supportsLiveView(n, ENDPOINT)).to.equal(true);
        expect(supportsAudioOnlyLiveView(n, ENDPOINT)).to.equal(false);
    });
});

describe("supportsSnapshot", () => {
    const accepted = `${ENDPOINT}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_ACCEPTED_COMMAND_LIST_ATTR_ID}`;
    const featureMap = `${ENDPOINT}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`;
    const snapshotCaps = `${ENDPOINT}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_SNAPSHOT_CAPABILITIES_ATTR_ID}`;

    it("is true when CaptureSnapshot is accepted and the Snapshot feature is advertised", () => {
        const n = node({ [accepted]: [CAPTURE_SNAPSHOT_COMMAND_ID], [featureMap]: AVSM_FEAT_SNP });
        expect(supportsSnapshot(n, ENDPOINT)).to.equal(true);
    });

    it("falls back to a non-empty SnapshotCapabilities list without the feature bit", () => {
        const n = node({ [accepted]: [CAPTURE_SNAPSHOT_COMMAND_ID], [snapshotCaps]: [{}] });
        expect(supportsSnapshot(n, ENDPOINT)).to.equal(true);
    });

    it("is false without the feature bit or capabilities", () => {
        const n = node({ [accepted]: [CAPTURE_SNAPSHOT_COMMAND_ID], [featureMap]: AVSM_FEAT_VDO, [snapshotCaps]: [] });
        expect(supportsSnapshot(n, ENDPOINT)).to.equal(false);
    });

    it("is false when CaptureSnapshot is not accepted", () => {
        const n = node({ [accepted]: [], [featureMap]: AVSM_FEAT_SNP });
        expect(supportsSnapshot(n, ENDPOINT)).to.equal(false);
    });
});
