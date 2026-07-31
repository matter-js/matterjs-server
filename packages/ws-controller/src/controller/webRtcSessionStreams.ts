/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";

const logger = Logger.get("webRtcSessionStreams");

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

/** WebRtcTransportProvider ClusterRevision from which VideoStreams/AudioStreams replace the singular ids. */
const STREAM_LIST_MIN_REVISION = 2;

/**
 * Enforce the ProvideOffer/SolicitOffer video/audio stream field choice on a request, in place.
 *
 * VideoStreams/AudioStreams (cluster revision 2) deprecate the singular VideoStreamID/AudioStreamID
 * (revision 1); a provider fails the command with InvalidCommand when both are present. Callers pass the
 * canonical revision-2 lists; this narrows the request to exactly the set the provider expects: the lists
 * for revision >= 2, or the singular ids for revision 1 / unknown. A revision-1 provider carries a single
 * id per media kind, so a multi-entry list is truncated to its first entry.
 */
export function selectWebRtcStreamFields(fields: Record<string, unknown>, clusterRevision: unknown): void {
    const videoStreams = resolveWebRtcSessionStreams(fields.videoStreams, fields.videoStreamId, undefined);
    const audioStreams = resolveWebRtcSessionStreams(fields.audioStreams, fields.audioStreamId, undefined);
    if (typeof clusterRevision === "number" && clusterRevision >= STREAM_LIST_MIN_REVISION) {
        // A provider fails the command when any list coexists with any singular id (the check spans both
        // media kinds, not each in isolation), so a list on one kind forces both singular ids out. With no
        // list to send, the deprecated singular ids stay — they remain valid on rev 2 and preserve a null
        // (auto-select) request.
        if (videoStreams !== undefined || audioStreams !== undefined) {
            delete fields.videoStreamId;
            delete fields.audioStreamId;
        }
        if (videoStreams !== undefined) fields.videoStreams = videoStreams;
        else delete fields.videoStreams;
        if (audioStreams !== undefined) fields.audioStreams = audioStreams;
        else delete fields.audioStreams;
    } else {
        delete fields.videoStreams;
        delete fields.audioStreams;
        downconvertToSingularStreamId(fields, "videoStreamId", videoStreams, "video");
        downconvertToSingularStreamId(fields, "audioStreamId", audioStreams, "audio");
    }
}

function downconvertToSingularStreamId(
    fields: Record<string, unknown>,
    key: "videoStreamId" | "audioStreamId",
    resolved: number[] | undefined,
    kind: string,
): void {
    if (resolved === undefined) {
        return;
    }
    if (resolved.length > 1) {
        logger.warn(
            `WebRTC provider does not advertise ClusterRevision >= 2 (revision 1 or not yet cached): ${resolved.length} ${kind} streams requested but only a single stream id can be sent; using ${resolved[0]}`,
        );
    }
    fields[key] = resolved[0];
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
