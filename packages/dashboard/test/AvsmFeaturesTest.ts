/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    AVSM_FEATURE_MAP_ATTR_ID,
    AVSM_FEAT_SNP,
    AVSM_FEAT_VDO,
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
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
const AUDIO_ONLY_FEATURE_MAP = 0; // ADO is bit 0, unset here on purpose: only vdo/snp/etc. matter for this gate

describe("readAvsmFeatures", () => {
    it("does not advertise video for an audio-only device (e.g. Audio Doorbell)", () => {
        const n = node({ [featureMapAttr]: AUDIO_ONLY_FEATURE_MAP });
        const features = readAvsmFeatures(n, ENDPOINT);
        expect(features.vdo).to.equal(false);
        expect(features.snp).to.equal(false);
    });

    it("does not advertise video when the FeatureMap attribute hasn't arrived yet", () => {
        // Guards the fix's default: an audio-only device must never fall through to
        // VideoStreamAllocate just because the attribute cache is still empty.
        const features = readAvsmFeatures(node({}), ENDPOINT);
        expect(features.vdo).to.equal(false);
    });

    it("advertises video for a device that supports it (sanity check against a real camera)", () => {
        const n = node({ [featureMapAttr]: AVSM_FEAT_VDO | AVSM_FEAT_SNP });
        const features = readAvsmFeatures(n, ENDPOINT);
        expect(features.vdo).to.equal(true);
        expect(features.snp).to.equal(true);
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
