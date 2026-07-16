/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProvideOfferRequest {
    [key: string]: unknown;
    webRtcSessionId: number | null;
    sdp: string;
    streamUsage: number;
    videoStreams?: number[];
    audioStreams?: number[];
}

// Send the canonical revision-2 VideoStreams/AudioStreams lists; the server down-converts them to the
// deprecated singular ids for a revision-1 provider per its advertised ClusterRevision.
export function buildProvideOfferRequest(
    sdp: string,
    streamUsage: number,
    videoStreamId: number | null,
    audioStreamId: number | null,
): ProvideOfferRequest {
    return {
        webRtcSessionId: null,
        sdp,
        streamUsage,
        ...(videoStreamId !== null ? { videoStreams: [videoStreamId] } : {}),
        ...(audioStreamId !== null ? { audioStreams: [audioStreamId] } : {}),
    };
}
