/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

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
 *
 * The two overlay flags are absent when the field must not be sent at all, which is what
 * `resolveOverlays` decides from the camera's feature map: their conformance on the command is
 * `WMARK` / `OSD` (§11.2.8.4), so a camera without the feature answers `INVALID_COMMAND` for a field
 * it never advertised.
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
 * `overlays` carries the camera's own statement with its own optionality: the struct reports each flag
 * only for a camera advertising the feature (§11.2.6.11), so an absent one is a camera that cannot draw
 * that overlay. It is not defaulted here, because the same value is what a re-allocation of this stream
 * has to send, and there the difference between "stated false" and "not stated" is the difference
 * between a conformant request and `INVALID_COMMAND`. `overlaysMatch` is the one place absence reads as
 * off.
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

/** An allocated audio stream as `AllocatedAudioStreams` reports it. */
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
 * `overlays` is what the camera states for this stream (§11.2.6.13). Unlike the video struct that table
 * states no fallback, so absence carries no spec-given value; what makes it read as off is the field's
 * `WMARK` / `OSD` conformance — a camera that states nothing has no such overlay to draw. It is the
 * camera's statement rather than a promise either way: §11.2.8.8.6 lets it ignore the requested flags
 * for a capability that needs no hardware encoder and use the source video stream's setting instead.
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
     * Whether this server allocated the stream during this process run.
     *
     * It answers one question — may this server deallocate the stream on its own initiative — and
     * never "may this server use it", which is decided by inspecting what the device reports. It is
     * therefore not persisted: after a restart the device's own report is the record, and nothing
     * this server allocated before the restart is its to give back unasked.
     */
    allocatedByUs: boolean;
}

/**
 * What this server states about one stream it has handed out.
 *
 * A snapshot lease carries no allocation: an adopted snapshot stream is found in device state on
 * every call that wants it, so there is nothing for the lease to stand in for.
 */
export type LeaseStatement =
    | (LeaseSubject & { kind: "video"; allocation: AllocatedVideoStream })
    | (LeaseSubject & { kind: "audio"; allocation: AllocatedAudioStream })
    | (LeaseSubject & { kind: "snapshot" });

/** A {@link LeaseStatement} plus the facts reconciliation needs. */
export type StreamLease = LeaseStatement & {
    /**
     * `Time.nowUs` (millisecond-valued) until which this lease may stand in for a device report.
     *
     * Set once, when the stream is allocated, and never extended: handing the stream out again is
     * not evidence that it still exists. 0 for a stream this server did not allocate.
     */
    shadowUntil: number;
    /**
     * True once a device state read has named this stream.
     *
     * Absence only means the stream is gone once the device has shown that it reports this stream at
     * all; before that, absence is a report that has not arrived.
     */
    reportedByDevice: boolean;
    /**
     * Identifies this exact statement about the stream id.
     *
     * A give-back whose wait was abandoned still lands, and the device reissues an id it has freed,
     * so by then the lease under that id may be a later request's. Reconciliation carries the value
     * over; only a new statement about the id gets a new one.
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
 * A WebRTC session as the camera's own `CurrentSessions` (§11.5.5.1) reports it.
 *
 * The camera is the record of which sessions exist, so this survives a restart of this server while
 * nothing it tracks itself does. `CurrentSessions` is fabric-sensitive, so a read never carries
 * another fabric's entries; within the fabric `peerNodeId` says which controller holds the session,
 * and `EndSession` (§11.5.6.7.3) answers `NOT_FOUND` for every entry whose fabric and `PeerNodeID`
 * are not the caller's.
 */
export interface DeviceWebRtcSession {
    webRtcSessionId: number;
    peerNodeId: NodeId;
    peerEndpointId: EndpointNumber;
    streamUsage: number;
    videoStreamIds: number[];
    audioStreamIds: number[];
    /** `peerNodeId` is this server's own node id, so this is a session only this server can end. */
    establishedByThisServer: boolean;
}

export interface ResolvedStream {
    streamId: number;
    envelope: VideoEnvelope | AudioEnvelope;
    reused: boolean;
    allocatedByUs: boolean;
    /** The result does not fit the envelope the server would have allocated; set only by the last ladder rung. */
    degraded?: boolean;
    /**
     * Ids of streams this request deallocated, absent when it took nothing.
     *
     * A stream a caller holds through another controller can be taken while nothing references it
     * (§11.2.8.7.2 checks use and Internal, not ownership), and the id it held is gone for good, so
     * the caller is told which ids stopped existing on its behalf. Reported whichever rung then
     * answered: a request that took a stream and was served by the degraded rung instead destroyed
     * that id just the same, even though the allocation scope puts an equivalent stream back under a
     * new one.
     */
    evicted?: number[];
}

/**
 * The AVSM `FeatureMap` (§11.2.5) as matter.js decodes it: one boolean per feature the cluster model
 * names.
 *
 * Taken from the client behaviour's own feature type rather than written out here, so a feature a
 * spec revision adds or renames is a compile error in the code that reads it by name, the same reason
 * {@link RawCameraAvStreamManagementState} is `Pick`ed from the real state type. `Partial`, because
 * the value is a bitmap matter.js types as partial: a flag it has not decoded reads `undefined`, not
 * `false`, so every read here compares against `true` rather than negating.
 */
export type CameraFeatures = Partial<typeof CameraAvStreamManagementClient.features>;

/**
 * The camera's privacy attributes (§11.2.7.20 to §11.2.7.22).
 *
 * A field is absent when the camera states nothing: the two soft modes are gated on the `PRIV`
 * feature and `HardPrivacyModeOn` is optional on its own, so absence is "this camera has no such
 * switch" and never "the switch is off".
 */
export interface CameraPrivacyState {
    /** SoftRecordingPrivacyModeEnabled: blocks a session of stream usage Recording or Analysis. */
    softRecordingModeEnabled?: boolean;
    /** SoftLivestreamPrivacyModeEnabled: blocks a session of stream usage LiveView, and every snapshot. */
    softLivestreamModeEnabled?: boolean;
    /** HardPrivacyModeOn: the physical switch, which blocks every session and every snapshot. */
    hardModeOn?: boolean;
}
