/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** A stream id is a non-negative integer (matter.js VideoStreamID/AudioStreamID are uint16). */
function isStreamId(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Resolve the video/audio stream list stored in a WebRTCSessionStruct for one media kind.
 *
 * Stream membership comes from the ProvideOffer/SolicitOffer request; the response's deprecated
 * stream-id echo exists only to report the provider's choice for a rev-1 null (auto-select) request
 * (spec §11.5.6.4). Inputs are the raw request/response values (untyped wire data), narrowed here:
 *
 *   - `requestList` (rev-2): the valid ids from a non-empty list are used verbatim.
 *   - `requestId` (rev-1): a valid id is an explicit request; `null` requests auto-selection, so the
 *     provider's `responseId` echo is used; anything else means the request omitted this media kind.
 */
export function resolveWebRtcSessionStreams(
    requestList: unknown,
    requestId: unknown,
    responseId: unknown,
): number[] | undefined {
    if (Array.isArray(requestList)) {
        const ids = requestList.filter(isStreamId);
        if (ids.length > 0) {
            return ids;
        }
    }
    if (isStreamId(requestId)) {
        return [requestId];
    }
    if (requestId === null && isStreamId(responseId)) {
        return [responseId];
    }
    return undefined;
}

/**
 * Whether a resolved WebRTC session can be stored in the WebRTCSessionStruct.
 *
 * The struct requires a StreamUsage (mandatory) and at least one video or audio stream (choice "a",
 * min 1). streamUsage is optional on the request and the stream lists may resolve to none, so a session
 * failing this cannot be tracked and must not be written (the write would throw and orphan the session
 * the provider already created).
 */
export function isTrackableWebRtcSession(
    streamUsage: unknown,
    videoStreams: number[] | undefined,
    audioStreams: number[] | undefined,
): boolean {
    return (
        typeof streamUsage === "number" &&
        Number.isInteger(streamUsage) &&
        streamUsage >= 0 &&
        (videoStreams !== undefined || audioStreams !== undefined)
    );
}
