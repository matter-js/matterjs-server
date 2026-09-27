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

/**
 * A range the device may adapt within; `VideoStreamAllocate` takes exactly this shape.
 * An absent overlay flag must not be sent (conformance `WMARK` / `OSD`, §11.2.8.4).
 */
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

/** Which ceilings {@link budgetVideoEnvelope} lowered, each carrying the value the envelope had before it. */
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

/**
 * An allocated video stream as `AllocatedVideoStreams` reports it.
 *
 * `overlays` is not defaulted: a re-allocation sends it as is, and an absent flag must stay absent
 * there (§11.2.6.11 conformance).
 */
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
 * An allocated snapshot stream as `AllocatedSnapshotStreams` reports it.
 *
 * `overlays` is not a promise: §11.2.8.8.6 lets a camera use the source video stream's setting instead
 * of the requested flags when no hardware encoder is involved.
 */
export interface AllocatedSnapshotStream {
    overlays: OverlayBounds;
    snapshotStreamId: number;
    imageCodec: number;
    minResolution: Resolution;
    maxResolution: Resolution;
    referenceCount: number;
    /** FrameRate (§11.2.6.13.3), the rate this stream reserves in the encoded-pixel calculation. */
    frameRate: number;
    /** Whether this stream counts in the camera's encoded pixel rate (§11.2.6.13.8). */
    encodedPixels: boolean;
    /** Whether this stream uses one of the camera's `MaxConcurrentEncoders` (§11.2.6.13.9). */
    hardwareEncoder: boolean;
}

interface LeaseSubject {
    streamId: number;
    /**
     * Whether this server allocated the stream during this process run, so it may deallocate it
     * unasked. Not persisted: after a restart nothing is this server's to give back unasked.
     */
    allocatedByUs: boolean;
}

/**
 * What this server states about one stream it has handed out. An adopted stream's allocation is the
 * camera's own report of it.
 */
export type LeaseStatement =
    | (LeaseSubject & { kind: "video"; allocation: AllocatedVideoStream })
    | (LeaseSubject & { kind: "audio"; allocation: AllocatedAudioStream })
    | (LeaseSubject & { kind: "snapshot"; allocation: AllocatedSnapshotStream });

/** A {@link LeaseStatement} plus the facts reconciliation needs. */
export type StreamLease = LeaseStatement & {
    /**
     * `Time.nowUs` (millisecond-valued) until which this lease may stand in for a device report. Set
     * once at allocation and never extended; 0 for a stream this server did not allocate.
     */
    shadowUntil: number;
    /** True once a device state read has named this stream; before that, absence means "not reported yet". */
    reportedByDevice: boolean;
    /**
     * Identifies this exact statement about the stream id, because the device reuses freed ids and a
     * late give-back must not remove a later lease. Reconciliation keeps it; only a new statement gets a
     * new one.
     */
    generation: number;
};

export interface ManagedSession {
    webRtcSessionId: number;
    nodeId: NodeId;
    endpointId: EndpointNumber;
    /** Owning WebSocket connection, so a disconnect can end exactly its sessions. */
    connectionId: string;
    videoStreamIds: number[];
    audioStreamIds: number[];
}

/**
 * One session that ended without the client that opened it asking for it.
 *
 * Not raised for the peer's own `End`, which already reaches the owner as a `webrtc_callback` `end` event.
 */
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
     * The connection whose `camera_stop_stream` ended it; the route does not notify that connection.
     * Absent when the server ended it on its own (owner disconnected, or shutdown).
     */
    requestedBy?: string;
}

/** One stream the make-room rung destroyed, for the clients that were not the ones it served. */
export interface CameraStreamEvicted {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    kind: "video" | "snapshot";
    streamId: number;
}

/**
 * A WebRTC session as the camera's own `CurrentSessions` (§11.5.5.1) reports it.
 *
 * `EndSession` (§11.5.6.7.3) answers `NOT_FOUND` for an entry whose `PeerNodeID` is not the caller's.
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
    /**
     * The ceilings the camera's encoder budget lowered, absent when it lowered none. Set for a freshly
     * allocated stream only. Not recomputed when the ladder narrows further after a device refusal.
     */
    budgetNarrowed?: VideoBudgetNarrowing;
}

/**
 * The AVSM `FeatureMap` (§11.2.5) as matter.js decodes it. A flag not decoded reads `undefined`, so
 * compare against `true`, never negate.
 */
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
