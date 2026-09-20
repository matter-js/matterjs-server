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
    resolution: Resolution;
    referenceCount: number;
}

interface LeaseSubject {
    streamId: number;
    /**
     * False for a stream found already allocated: reusable, never released by us.
     *
     * Such a stream is leased anyway, so the reuse decision sees every stream this server has handed
     * out rather than only the ones it allocated.
     */
    allocatedByUs: boolean;
}

/**
 * What this server states about one stream it has handed out.
 *
 * A snapshot lease carries no allocation: snapshots have no reuse rung, and the lease normally lives
 * only for the rest of the `camera_snapshot` that allocated the stream. It outlives that call exactly
 * when the device refused to take the stream back, which is the case `camera_release_stream` exists
 * to reach.
 */
export type LeaseStatement =
    | (LeaseSubject & { kind: "video"; allocation: AllocatedVideoStream })
    | (LeaseSubject & { kind: "audio"; allocation: AllocatedAudioStream })
    | (LeaseSubject & { kind: "snapshot" });

/**
 * A {@link LeaseStatement} plus the facts reconciliation needs.
 *
 * The lease answers two questions with different lifetimes, and each has its own deadline. "May this
 * stream stand in for a device report?" expires quickly — see {@link shadowUntil}. "Is this stream
 * ours to release?" outlives it by a long way — see {@link retainUntil} — because a lease dropped
 * early leaves a stream nothing can deallocate.
 */
export type StreamLease = LeaseStatement & {
    /**
     * `Time.nowUs` (millisecond-valued) until which this lease may stand in for a device report.
     *
     * Set once, when the stream is allocated, and never extended: handing the stream out again is
     * not evidence that it still exists. 0 for a stream this server did not allocate.
     */
    shadowUntil: number;
    /**
     * `Time.nowUs` (millisecond-valued) until which this lease survives although no device state
     * read has ever named its stream.
     *
     * Set once, alongside {@link shadowUntil}, and never extended. Past it a stream the device has
     * had minutes to report and never did is treated as gone: keeping the lease forever grows the
     * per-endpoint array without bound, and lets the lease re-attach to a foreign stream once the
     * device reissues the id. 0 for a stream this server did not allocate, which is reported by
     * definition.
     */
    retainUntil: number;
    /**
     * True once a device state read has named this stream.
     *
     * Absence only means the stream is gone once the device has shown that it reports this stream at
     * all; before that, absence is a report that has not arrived.
     */
    reportedByDevice: boolean;
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

export interface ResolvedStream {
    streamId: number;
    envelope: VideoEnvelope | AudioEnvelope;
    reused: boolean;
    allocatedByUs: boolean;
    /** The result does not fit the envelope the server would have allocated; set only by the last ladder rung. */
    degraded?: boolean;
}
