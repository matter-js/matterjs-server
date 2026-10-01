/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";

export const CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID = 0x551;
export const WEBRTC_TRANSPORT_PROVIDER_CLUSTER_ID = 0x553;

const DESCRIPTOR_CLUSTER_ID = 29;
const SERVER_LIST_ATTR_ID = 1;
const ACCEPTED_COMMAND_LIST_ATTR_ID = 0xfff9;
const CAPTURE_SNAPSHOT_COMMAND_ID = 12;
const SNAPSHOT_CAPABILITIES_ATTR_ID = 10;
const FEATURE_MAP_ATTR_ID = 0xfffc;
// AVSM FeatureMap bits (spec §11.2.4), for gating before any camera command is sent. Once one can be
// sent, read `features` from camera_get_capabilities instead.
const FEATURE_VIDEO = 1 << 1;
const FEATURE_SNAPSHOT = 1 << 2;

function featureMap(node: MatterNode, endpoint: number): number | undefined {
    const raw = node.attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${FEATURE_MAP_ATTR_ID}`];
    return typeof raw === "number" ? raw : undefined;
}

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
    if (((featureMap(node, endpoint) ?? 0) & FEATURE_SNAPSHOT) !== 0) return true;
    const caps =
        node.attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${SNAPSHOT_CAPABILITIES_ATTR_ID}`];
    return Array.isArray(caps) && caps.length > 0;
}

export function supportsCameraOverlay(node: MatterNode, endpoint: number): boolean {
    return supportsLiveView(node, endpoint) || supportsSnapshot(node, endpoint);
}

/**
 * True when live view is available and the FeatureMap is known not to advertise Video (VDO) —
 * e.g. Audio Doorbell, Intercom. The session streams audio only, so the UI should say "Listen"
 * rather than "Live View". A device whose FeatureMap hasn't been read yet is not treated as
 * audio-only, so a real camera isn't mislabelled while its attribute is still in flight.
 */
export function supportsAudioOnlyLiveView(node: MatterNode, endpoint: number): boolean {
    const features = featureMap(node, endpoint);
    return supportsLiveView(node, endpoint) && features !== undefined && (features & FEATURE_VIDEO) === 0;
}
