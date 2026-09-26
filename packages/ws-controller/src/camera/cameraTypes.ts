/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EndpointNumber, NodeId } from "@matter/main";

export type StreamKind = "video" | "audio" | "snapshot";

export interface Resolution {
    width: number;
    height: number;
}

/** A range the device may adapt within; `VideoStreamAllocate` takes exactly this shape. */
export interface VideoEnvelope {
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

/** An allocated video stream as `AllocatedVideoStreams` reports it. */
export interface AllocatedVideoStream {
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

/** An allocated snapshot stream as `AllocatedSnapshotStreams` reports it. */
export interface AllocatedSnapshotStream {
    snapshotStreamId: number;
    imageCodec: number;
    minResolution: Resolution;
    maxResolution: Resolution;
    referenceCount: number;
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
}
