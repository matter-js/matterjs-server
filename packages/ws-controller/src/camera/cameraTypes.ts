/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraStreamProvenance } from "@matter-server/ws-client";
import type { EndpointNumber, NodeId } from "@matter/main";
import type { CameraAvStreamManagementClient } from "@matter/node/behaviors/camera-av-stream-management";
import type { OverlayBounds } from "./overlayPolicy.js";

export type StreamKind = "video" | "audio" | "snapshot";

export interface Resolution {
    width: number;
    height: number;
}

/** The shape `VideoStreamAllocate` takes. An absent overlay flag must not be sent (§11.2.8.4). */
export interface VideoEnvelope {
    overlays: OverlayBounds;
    codec: number;
    minResolution: Resolution;
    maxResolution: Resolution;
    minFrameRate: number;
    maxFrameRate: number;
    minBitRate: number;
    maxBitRate: number;
    keyFrameInterval: number;
}

/** Each field holds that ceiling's value from before {@link budgetVideoEnvelope} lowered it. */
export interface VideoBudgetNarrowing {
    maxFrameRate?: number;
    maxResolution?: Resolution;
}

export interface AudioEnvelope {
    codec: number;
    channelCount: number;
    sampleRate: number;
    bitRate: number;
    bitDepth: number;
}

/** `overlays` is not defaulted: a re-allocation sends it as is, and an absent flag must stay absent (§11.2.6.11). */
export interface AllocatedVideoStream {
    overlays: OverlayBounds;
    videoStreamId: number;
    streamUsage: number;
    videoCodec: number;
    minResolution: Resolution;
    maxResolution: Resolution;
    minFrameRate: number;
    maxFrameRate: number;
    minBitRate: number;
    maxBitRate: number;
    keyFrameInterval: number;
    referenceCount: number;
}

export interface AllocatedAudioStream {
    audioStreamId: number;
    streamUsage: number;
    audioCodec: number;
    channelCount: number;
    sampleRate: number;
    bitRate: number;
    bitDepth: number;
    referenceCount: number;
}

/**
 * `overlays` is not a promise: §11.2.8.8.6 lets a camera use the source video stream's setting instead
 * of the requested flags when no hardware encoder is involved.
 */
export interface AllocatedSnapshotStream {
    overlays: OverlayBounds;
    snapshotStreamId: number;
    imageCodec: number;
    minResolution: Resolution;
    maxResolution: Resolution;
    quality: number;
    referenceCount: number;
    /** The rate this stream reserves in the encoded-pixel budget (§11.2.6.13.3). */
    frameRate: number;
    /** Whether this stream counts in the camera's encoded pixel rate (§11.2.6.13.8). */
    encodedPixels: boolean;
    /** Whether this stream uses one of the camera's `MaxConcurrentEncoders` (§11.2.6.13.9). */
    hardwareEncoder: boolean;
}

interface LeaseSubject {
    streamId: number;
    /** This process run allocated the stream, so it may deallocate it unasked. Not persisted. */
    allocatedByUs: boolean;
}

/** An adopted stream's `allocation` is the camera's own report of it. */
export type LeaseStatement =
    | (LeaseSubject & { kind: "video"; allocation: AllocatedVideoStream })
    | (LeaseSubject & { kind: "audio"; allocation: AllocatedAudioStream })
    | (LeaseSubject & { kind: "snapshot"; allocation: AllocatedSnapshotStream });

export type StreamLease = LeaseStatement & {
    /**
     * `Time.nowUs` (millisecond-valued) until which this lease may stand in for a device report. Set
     * once at allocation and never extended; 0 for a stream this server did not allocate.
     */
    shadowUntil: number;
    /** True once a device state read has named this stream; before that, absence means "not reported yet". */
    reportedByDevice: boolean;
    /**
     * The device reuses freed ids, so a late give-back must match this to remove the lease. Reconciliation
     * keeps it; only a new statement gets a new one.
     */
    generation: number;
};

export interface ManagedSession {
    webRtcSessionId: number;
    nodeId: NodeId;
    endpointId: EndpointNumber;
    connectionId: string;
    videoStreamIds: number[];
    audioStreamIds: number[];
}

/** Not raised for the peer's own `End`, which already reaches the owner as a `webrtc_callback` `end` event. */
export interface CameraSessionEnded {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    webRtcSessionId: number;
    /**
     * The connection that established the session. Absent for sessions with no recorded owner (raw
     * provider route, adopted from the camera); the route then tells every camera-aware connection.
     */
    ownerId?: string;
    /**
     * The connection whose `camera_stop_stream` or `EndSession` ended it; the route does not notify it.
     * Absent when the server ended it on its own (owner disconnected, or shutdown).
     */
    requestedBy?: string;
}

export interface CameraStreamEvicted {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    kind: "video" | "snapshot";
    streamId: number;
}

/**
 * From `CurrentSessions` (§11.5.5.1). `EndSession` (§11.5.6.7.3) answers `NOT_FOUND` unless `PeerNodeID`
 * is the caller's.
 */
export interface DeviceWebRtcSession {
    webRtcSessionId: number;
    peerNodeId: NodeId;
    peerEndpointId: EndpointNumber;
    streamUsage: number;
    videoStreamIds: number[];
    audioStreamIds: number[];
    /** `peerNodeId` is this server's own node id, so only this server can end the session. */
    establishedByThisServer: boolean;
}

export interface ResolvedStream {
    streamId: number;
    envelope: VideoEnvelope | AudioEnvelope;
    provenance: CameraStreamProvenance;
    /** The result does not fit the envelope the server would have allocated; set only by the last ladder rung. */
    degraded?: boolean;
    /** Video stream ids this request deallocated, whichever rung then answered; absent when it took nothing. */
    evicted?: number[];
    /** Allocate path only. Not recomputed when the ladder narrows further after a device refusal. */
    budgetNarrowed?: VideoBudgetNarrowing;
}

/** A flag not decoded reads `undefined`, so compare against `true`, never negate. */
export type CameraFeatures = Partial<typeof CameraAvStreamManagementClient.features>;

/** The camera's privacy attributes (§11.2.7.20 to §11.2.7.22). Absent means the camera has no such switch. */
export interface CameraPrivacyState {
    /** SoftRecordingPrivacyModeEnabled: blocks a session of stream usage Recording or Analysis. */
    softRecordingModeEnabled?: boolean;
    /** SoftLivestreamPrivacyModeEnabled: blocks a session of stream usage LiveView, and every snapshot. */
    softLivestreamModeEnabled?: boolean;
    /** HardPrivacyModeOn: the physical switch, which blocks every session and every snapshot. */
    hardModeOn?: boolean;
}
