/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { ServerError } from "../types/WebSocketMessageTypes.js";

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

/**
 * Whether the requestor's entry for `webRtcSessionId` is the session established with this node and
 * endpoint.
 *
 * `WebRTCSessionID` is allocated per provider, so two cameras both issuing id 1 is ordinary, while
 * matter.js's requestor keys `CurrentSessions` by that id alone: `upsertSession` replaces on a
 * collision and `removeSession` takes nothing but the id. Only one of the two can be tracked at a
 * time — that much is upstream — but a removal keyed on the id alone would additionally drop
 * whichever camera's entry currently holds it, ending one camera's session and answering the other
 * camera's Answer and ICECandidates with NotFound.
 */
export function tracksSessionOf(
    sessions: readonly WebRtcTransportDefinitions.WebRtcSession[],
    webRtcSessionId: number,
    nodeId: NodeId,
    endpointId: EndpointNumber,
): boolean {
    const tracked = sessions.find(session => session.id === webRtcSessionId);
    return tracked !== undefined && tracked.peerNodeId === nodeId && tracked.peerEndpointId === endpointId;
}

export interface WebRtcProviderSessionIo {
    /** Invoke ProvideOffer/SolicitOffer or EndSession on the device's provider cluster. */
    invoke(command: "provideOffer" | "solicitOffer" | "endSession", fields: Record<string, unknown>): Promise<unknown>;
    /** Store the session in the local requestor so its Answer/ICECandidates are accepted, not NotFound. */
    upsertSession(session: WebRtcTransportDefinitions.WebRtcSession): Promise<void>;
}

export interface WebRtcProviderSessionArgs {
    commandName: "ProvideOffer" | "SolicitOffer";
    /** Already in matter.js's own field-name convention; `originatingEndpointId` is injected here. */
    fields: Record<string, unknown>;
    nodeId: NodeId;
    endpointId: EndpointNumber;
    originatingEndpointId: EndpointNumber;
    fabricIndex: FabricIndex;
    clusterRevision: unknown;
    formatNode: (nodeId: NodeId) => string;
}

/**
 * Invoke ProvideOffer/SolicitOffer and track the resulting session in the local requestor.
 *
 * WebRtcTransportRequestorServer rejects Answer/ICECandidates with NotFound for a session it never
 * stored, so a caller that skips `io.upsertSession` gets back a session id whose signaling can never be
 * routed — the peer's response is silently dropped, not just delayed. An untrackable session (no stream
 * usage, or no video/audio stream — e.g. an auto-select/deferred SolicitOffer whose provider reports no
 * stream id yet) is torn down on the device and the command fails instead, rather than handing back an
 * id that will silently never deliver media. Deferred/auto-select is thus unsupported for now.
 */
export async function establishWebRtcProviderSession(
    io: WebRtcProviderSessionIo,
    args: WebRtcProviderSessionArgs,
): Promise<{ webRtcSessionId: number } & Record<string, unknown>> {
    const { commandName, nodeId, endpointId, originatingEndpointId, fabricIndex, clusterRevision, formatNode } = args;
    const command = commandName === "ProvideOffer" ? "provideOffer" : "solicitOffer";

    const fields: Record<string, unknown> = { ...args.fields, originatingEndpointId };
    selectWebRtcStreamFields(fields, clusterRevision);

    const response = await io.invoke(command, fields);
    if (
        typeof response !== "object" ||
        response === null ||
        !("webRtcSessionId" in response) ||
        typeof response.webRtcSessionId !== "number"
    ) {
        throw ServerError.sdkStackError(
            `${commandName} did not return a WebRTCSessionID for node ${formatNode(nodeId)}`,
        );
    }
    const webRtcSessionId = response.webRtcSessionId;

    const streamUsage = fields.streamUsage;
    const metadataEnabled = fields.metadataEnabled === true;
    const responseVideoStreamId = "videoStreamId" in response ? response.videoStreamId : undefined;
    const responseAudioStreamId = "audioStreamId" in response ? response.audioStreamId : undefined;
    const videoStreams = resolveWebRtcSessionStreams(fields.videoStreams, fields.videoStreamId, responseVideoStreamId);
    const audioStreams = resolveWebRtcSessionStreams(fields.audioStreams, fields.audioStreamId, responseAudioStreamId);

    if (!isTrackableWebRtcSession(streamUsage, videoStreams, audioStreams)) {
        logger.warn(
            `Tearing down untrackable WebRTC session id=${webRtcSessionId} for node ${formatNode(
                nodeId,
            )}: request lacks a stream usage or any video/audio stream, so signaling cannot be routed for it`,
        );
        try {
            await io.invoke("endSession", {
                webRtcSessionId,
                reason: WebRtcTransportDefinitions.WebRtcEndReason.OutOfResources,
            });
        } catch (err) {
            logger.warn(
                `EndSession cleanup for untrackable WebRTC session id=${webRtcSessionId} failed: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
        }
        throw ServerError.sdkStackError(
            `${commandName} for node ${formatNode(nodeId)} produced a session with no stream usage or ` +
                `video/audio stream; deferred/auto-select streaming is not supported`,
        );
    }

    const session: WebRtcTransportDefinitions.WebRtcSession = {
        id: webRtcSessionId,
        peerNodeId: nodeId,
        peerEndpointId: endpointId,
        streamUsage: streamUsage as WebRtcTransportDefinitions.WebRtcSession["streamUsage"],
        metadataEnabled,
        videoStreams,
        audioStreams,
        fabricIndex,
    };

    logger.info(
        `upserting WebRTC session id=${session.id} peerNodeId=${nodeId} peerEndpointId=${endpointId} fabricIndex=${fabricIndex} streamUsage=${streamUsage} originatingEndpointId=${originatingEndpointId}`,
    );
    try {
        await io.upsertSession(session);
    } catch (error) {
        // The device has the session and only this scope knows its id, so raising without ending it
        // leaves a session nothing can name again and its streams pinned at ReferenceCount > 0.
        logger.warn(
            `Tearing down WebRTC session id=${webRtcSessionId} for node ${formatNode(
                nodeId,
            )}: the local requestor did not take it, so signaling cannot be routed for it`,
        );
        try {
            await io.invoke("endSession", {
                webRtcSessionId,
                reason: WebRtcTransportDefinitions.WebRtcEndReason.OutOfResources,
            });
        } catch (err) {
            logger.warn(
                `EndSession cleanup for untracked WebRTC session id=${webRtcSessionId} failed: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
        }
        throw error;
    }

    // Verified above: `response` carries a numeric webRtcSessionId. The rest of the assertion is the
    // residual TS can't express — an object narrowed to specific known keys via `in` has no general
    // string index signature, even though every real object satisfies one at runtime.
    return response as { webRtcSessionId: number } & Record<string, unknown>;
}
