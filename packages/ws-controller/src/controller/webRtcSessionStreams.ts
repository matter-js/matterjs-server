/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { DEVICE_CLEANUP_BUDGET_MS, withCleanupBudget } from "../util/deviceCleanupBudget.js";

const logger = Logger.get("webRtcSessionStreams");

/** VideoStreamID and AudioStreamID are uint16, so an id outside that names no stream. */
function isStreamId(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffff;
}

/**
 * Read the video/audio stream membership of one media kind out of what a device stated.
 *
 * Inputs are device data (a reported `WebRTCSessionStruct`, or an already-narrowed request plus the
 * provider's deprecated stream-id echo, spec §11.5.6.4), so invalid entries are skipped, not refused.
 * A caller's own request is validated by {@link selectWebRtcStreamFields}.
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

/** The revision-2 list field and the revision-1 id it deprecates, per media kind. */
const STREAM_FIELDS = [
    { kind: "video", list: "videoStreams", singular: "videoStreamId" },
    { kind: "audio", list: "audioStreams", singular: "audioStreamId" },
] as const;

/**
 * Put the caller's video/audio stream request into the form this camera's provider takes, in place.
 *
 * A request stating both a list (VideoStreams/AudioStreams, revision 2) and a singular id
 * (VideoStreamID/AudioStreamID, revision 1), across either media kind, is refused: the provider fails
 * it with INVALID_COMMAND (§11.5.6.1, §11.5.6.3), and dropping one form would change what was asked.
 * This also applies to a re-offer, where the device skips that check (§11.5.6.3); a re-offer does
 * not reselect streams, so nothing is lost.
 *
 * Lists go to a provider not known to be at revision 2 (revision 1, or not yet read) as singular ids,
 * because such a provider drops lists on receipt. A single-entry list converts; a longer one is refused.
 * `camera_start_stream` relies on this conversion for revision-1 cameras.
 *
 * Throws before writing anything, so a refusal leaves `fields` unchanged.
 */
export function selectWebRtcStreamFields(fields: Record<string, unknown>, clusterRevision: number | undefined): void {
    const listed = STREAM_FIELDS.filter(field => fields[field.list] !== undefined);
    const singular = STREAM_FIELDS.filter(field => fields[field.singular] !== undefined);
    if (listed.length > 0 && singular.length > 0) {
        throw ServerError.invalidArguments(
            `${listed.map(field => field.list).join(" and ")} cannot be sent together with ${singular
                .map(field => field.singular)
                .join(
                    " and ",
                )}: the WebRTC provider refuses a request that states both the stream lists and the stream ids they deprecate. Send one form for both media kinds.`,
        );
    }
    const requested = listed.map(field => ({ field, ids: requestedStreamIds(fields[field.list], field.list) }));
    for (const { field, ids } of requested) {
        // The field takes 1 to 16 entries (§11.5.6.1.8, §11.5.6.1.9).
        if (ids.length === 0) {
            throw ServerError.invalidArguments(
                `${field.list} names no stream. Leave it out to ask for no ${field.kind} stream.`,
            );
        }
    }
    if (typeof clusterRevision === "number" && clusterRevision >= STREAM_LIST_MIN_REVISION) return;
    const why =
        clusterRevision === undefined
            ? "this server has not read this camera's WebRTC Provider ClusterRevision"
            : `this camera's WebRTC Provider states cluster revision ${clusterRevision}`;
    for (const { field, ids } of requested) {
        if (ids.length > 1) {
            throw ServerError.invalidArguments(
                `${field.list} names ${ids.length} streams, and ${why}, so this request can carry one ${field.kind} stream at most. Ask for one ${field.kind} stream.`,
            );
        }
    }
    for (const { field, ids } of requested) {
        delete fields[field.list];
        fields[field.singular] = ids[0];
    }
}

/** The stream ids a caller stated in one list field, or a refusal naming the entry that is not one. */
function requestedStreamIds(value: unknown, field: string): number[] {
    if (!Array.isArray(value)) {
        throw ServerError.invalidArguments(`${field} must be an array of stream ids`);
    }
    return value.map((entry, index) => {
        if (!isStreamId(entry)) {
            throw ServerError.invalidArguments(`${field}[${index}] must be a stream id`);
        }
        return entry;
    });
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
 * Whether the requestor's entry for `webRtcSessionId` belongs to this node and endpoint.
 *
 * `WebRTCSessionID` is allocated per provider, but matter.js's requestor keys `CurrentSessions` by
 * the id alone, so a removal must check the peer or it can drop another camera's session.
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
    /** The provider's ClusterRevision, or undefined while the endpoint has not stated one. */
    clusterRevision: number | undefined;
    formatNode: (nodeId: NodeId) => string;
    /**
     * Called with the provider's session id before `upsertSession`. Until then the requestor answers
     * `NotFound` to every signalling command for the id, so no peer `End` for it can have arrived yet.
     */
    sessionEstablishing?: (webRtcSessionId: number) => void;
}

/**
 * End a session this call established but cannot hand back, waiting at most
 * {@link DEVICE_CLEANUP_BUDGET_MS} for the device, because the caller may hold the endpoint lock.
 *
 * This wait is separate from `AllocationScope.settle`'s, so one `camera_start_stream` can spend the
 * budget twice.
 */
async function endSessionWithinBudget(
    io: WebRtcProviderSessionIo,
    webRtcSessionId: number,
    what: string,
): Promise<void> {
    await withCleanupBudget(`ending an ${what} WebRTC session`, async () => {
        try {
            await io.invoke("endSession", {
                webRtcSessionId,
                reason: WebRtcTransportDefinitions.WebRtcEndReason.OutOfResources,
            });
        } catch (err) {
            logger.warn(
                `EndSession cleanup for ${what} WebRTC session id=${webRtcSessionId} failed: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
        }
    });
}

/**
 * Invoke ProvideOffer/SolicitOffer and track the resulting session in the local requestor, which
 * answers NotFound to Answer/ICECandidates for sessions it has not stored.
 *
 * A session that cannot be tracked (no stream usage, or no video/audio stream, e.g. a deferred
 * auto-select SolicitOffer) is ended on the device and the command fails. Deferred/auto-select
 * streaming is not supported.
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
    args.sessionEstablishing?.(webRtcSessionId);

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
        await endSessionWithinBudget(io, webRtcSessionId, "untrackable");
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
        // Only this scope knows the id; not ending it here would pin its streams on the device.
        logger.warn(
            `Tearing down WebRTC session id=${webRtcSessionId} for node ${formatNode(
                nodeId,
            )}: the local requestor did not take it, so signaling cannot be routed for it`,
        );
        await endSessionWithinBudget(io, webRtcSessionId, "untracked");
        throw error;
    }

    // `in` narrowing gives no string index signature, so TS cannot express this shape without a cast.
    return response as { webRtcSessionId: number } & Record<string, unknown>;
}
