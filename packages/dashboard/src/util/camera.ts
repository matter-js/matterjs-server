/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import {
    AVSM_FEAT_SNP,
    AVSM_FEATURE_MAP_ATTR_ID,
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    readAvsmFeatures,
} from "../components/webrtc-stream-view.js";

export const WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID = 0x553;

const DESCRIPTOR_CLUSTER_ID = 29;
const SERVER_LIST_ATTR_ID = 1;
const ACCEPTED_COMMAND_LIST_ATTR_ID = 0xfff9;
const CAPTURE_SNAPSHOT_COMMAND_ID = 12;
const SNAPSHOT_CAPABILITIES_ATTR_ID = 10;

function serverClusters(node: MatterNode, endpoint: number): number[] {
    const raw = node.attributes[`${endpoint}/${DESCRIPTOR_CLUSTER_ID}/${SERVER_LIST_ATTR_ID}`];
    return Array.isArray(raw) ? raw.map(v => Number(v)) : new Array<number>();
}

/**
 * Live view drives a WebRTC session (WebRtcTransportProvider) fed by a video stream allocated
 * through CameraAvStreamManagement, so both clusters must be present on the endpoint.
 */
export function supportsLiveView(node: MatterNode, endpoint: number): boolean {
    const clusters = serverClusters(node, endpoint);
    return (
        clusters.includes(WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID) &&
        clusters.includes(CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID)
    );
}

export function supportsSnapshot(node: MatterNode, endpoint: number): boolean {
    const accepted =
        node.attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${ACCEPTED_COMMAND_LIST_ATTR_ID}`];
    if (!Array.isArray(accepted) || !accepted.includes(CAPTURE_SNAPSHOT_COMMAND_ID)) return false;
    // Some cameras set the SNP feature bit but leave SnapshotCapabilities empty, so the feature bit
    // is authoritative and the capabilities list a fallback hint.
    const featureMap =
        node.attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${AVSM_FEATURE_MAP_ATTR_ID}`];
    if (typeof featureMap === "number" && (featureMap & AVSM_FEAT_SNP) !== 0) return true;
    const caps =
        node.attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${SNAPSHOT_CAPABILITIES_ATTR_ID}`];
    return Array.isArray(caps) && caps.length > 0;
}

export function supportsCameraOverlay(node: MatterNode, endpoint: number): boolean {
    return supportsLiveView(node, endpoint) || supportsSnapshot(node, endpoint);
}

/**
 * True when live view is available but the device doesn't advertise the Video (VDO) feature —
 * e.g. Audio Doorbell, Intercom. The session streams audio only, so the UI should say "Listen"
 * rather than "Live View".
 */
export function supportsAudioOnlyLiveView(node: MatterNode, endpoint: number): boolean {
    return supportsLiveView(node, endpoint) && !readAvsmFeatures(node, endpoint).vdo;
}
