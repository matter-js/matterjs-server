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
    videoStreamId: number | null;
    audioStreamId: number | null;
    videoStreams?: number[];
    audioStreams?: number[];
}

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
        videoStreamId,
        audioStreamId,
        ...(videoStreamId !== null ? { videoStreams: [videoStreamId] } : {}),
        ...(audioStreamId !== null ? { audioStreams: [audioStreamId] } : {}),
    };
}
