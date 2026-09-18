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

export interface StreamLease {
    kind: StreamKind;
    streamId: number;
    /** False for anything found already allocated; such a stream is reusable but never released by us. */
    allocatedByUs: boolean;
}

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
