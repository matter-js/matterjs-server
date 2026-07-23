/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    AVSM_FEATURE_MAP_ATTR_ID,
    AVSM_FEAT_ADO,
    AVSM_FEAT_SNP,
    AVSM_FEAT_VDO,
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    isAudioOnlyAvsm,
    readAvsmFeatures,
} from "../src/components/webrtc-stream-view.js";

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

const ENDPOINT = 6;
const featureMapAttr = `${ENDPOINT}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`;

// An Audio Doorbell (device type 0x0141) enables only Audio on its CameraAvStreamManagement
// FeatureMap — no Video, no Snapshot (Matter §16.5). Intercom (0x0140) is the same shape.
const AUDIO_ONLY_FEATURE_MAP = AVSM_FEAT_ADO;

describe("readAvsmFeatures", () => {
    it("reports a known, video-less FeatureMap for an audio-only device (e.g. Audio Doorbell)", () => {
        const n = node({ [featureMapAttr]: AUDIO_ONLY_FEATURE_MAP });
        const features = readAvsmFeatures(n, ENDPOINT);
        expect(features.known).to.equal(true);
        expect(features.ado).to.equal(true);
        expect(features.vdo).to.equal(false);
        expect(features.snp).to.equal(false);
        expect(isAudioOnlyAvsm(features)).to.equal(true);
    });

    it("is not audio-only when the FeatureMap attribute hasn't arrived yet", () => {
        // A missing FeatureMap must read as unknown, not as "no video": otherwise a real camera
        // whose attribute is still in flight would skip VideoStreamAllocate and stream audio-only.
        const features = readAvsmFeatures(node({}), ENDPOINT);
        expect(features.known).to.equal(false);
        expect(isAudioOnlyAvsm(features)).to.equal(false);
    });

    it("advertises video for a device that supports it (sanity check against a real camera)", () => {
        const n = node({ [featureMapAttr]: AVSM_FEAT_VDO | AVSM_FEAT_SNP });
        const features = readAvsmFeatures(n, ENDPOINT);
        expect(features.known).to.equal(true);
        expect(features.vdo).to.equal(true);
        expect(features.snp).to.equal(true);
        expect(isAudioOnlyAvsm(features)).to.equal(false);
    });

    it("reads the FeatureMap for the given endpoint only, not other endpoints on the same node", () => {
        const otherEndpoint = 7;
        const n = node({
            [featureMapAttr]: 0,
            [`${otherEndpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`]: AVSM_FEAT_VDO,
        });
        expect(readAvsmFeatures(n, ENDPOINT).vdo).to.equal(false);
        expect(readAvsmFeatures(n, otherEndpoint).vdo).to.equal(true);
    });
});
