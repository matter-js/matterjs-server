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
 * Inputs are device data (a reported `WebRTCSessionStruct`, or an already-narrowed request plus the
 * provider's deprecated stream-id echo, §11.5.6.4), so invalid entries are skipped, not refused.
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

const STREAM_FIELDS = [
    { kind: "video", list: "videoStreams", singular: "videoStreamId" },
    { kind: "audio", list: "audioStreams", singular: "audioStreamId" },
] as const;

/**
 * Rewrites `fields` in place. A request with both a list and a singular id, across either media kind,
 * is refused: the provider answers INVALID_COMMAND (§11.5.6.1, §11.5.6.3), and dropping one form would
 * change what was asked.
 *
 * A provider not known to be at revision 2 drops lists, so a single-entry list becomes the singular id
 * and a longer one is refused. `camera_start_stream` relies on this for revision-1 cameras.
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

/** The fields matter.js's requestor keys `CurrentSessions` by: `WebRTCSessionID` is unique per node (§11.4.5.1). */
export type WebRtcSessionKey = Pick<WebRtcTransportDefinitions.WebRtcSession, "id" | "fabricIndex" | "peerNodeId">;

/** A session with the provider endpoint it runs on, the address every route uses for it. */
export type WebRtcProviderSessionKey = WebRtcSessionKey &
    Pick<WebRtcTransportDefinitions.WebRtcSession, "peerEndpointId">;

export function sameWebRtcSession(a: WebRtcSessionKey, b: WebRtcSessionKey): boolean {
    return a.id === b.id && a.fabricIndex === b.fabricIndex && a.peerNodeId === b.peerNodeId;
}

/** The requestor's entry for this session on this endpoint, if it tracks one. */
export function trackedSessionOf<S extends WebRtcProviderSessionKey>(
    sessions: readonly S[],
    key: WebRtcSessionKey,
    endpointId: EndpointNumber,
): S | undefined {
    return sessions.find(session => sameWebRtcSession(session, key) && session.peerEndpointId === endpointId);
}

export interface WebRtcProviderSessionIo {
    invoke(command: "provideOffer" | "solicitOffer" | "endSession", fields: Record<string, unknown>): Promise<unknown>;
    /**
     * Records the SDP a ProvideOffer sends for this session id, so the camera's answer can be checked
     * against it. Returns the withdraw function for a path on which the camera will not answer it.
     */
    offerSent(webRtcSessionId: number, sdp: string): () => void;
    /** Whether the local requestor holds this provider's session now. */
    tracks(webRtcSessionId: number): boolean;
    /** Store the session in the local requestor so its Answer/ICECandidates are accepted, not NotFound. */
    upsertSession(
        session: WebRtcTransportDefinitions.WebRtcSession,
        options?: { onlyIfAbsent: boolean },
    ): Promise<void>;
}

export interface WebRtcProviderSessionArgs {
    commandName: "ProvideOffer" | "SolicitOffer";
    /** Already in matter.js's own field-name convention; `originatingEndpointId` is injected here. */
    fields: Record<string, unknown>;
    nodeId: NodeId;
    endpointId: EndpointNumber;
    originatingEndpointId: EndpointNumber;
    fabricIndex: FabricIndex;
    clusterRevision: number | undefined;
    formatNode: (nodeId: NodeId) => string;
    /**
     * Called with the provider's session id before `upsertSession`. Until then the requestor answers
     * `NotFound` to every signalling command for the id, so no peer `End` for it can have arrived yet.
     */
    sessionEstablishing?: (webRtcSessionId: number) => void;
}

/**
 * Waits at most {@link DEVICE_CLEANUP_BUDGET_MS}, because the caller may hold the endpoint lock. This
 * wait is separate from `AllocationScope.settle`'s, so one `camera_start_stream` can spend the budget twice.
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

type EstablishedSession = { webRtcSessionId: number } & Record<string, unknown>;

/**
 * The session must be stored in the local requestor, which answers NotFound to Answer/ICECandidates
 * otherwise. A session that cannot be tracked (no stream usage, or no video/audio stream, e.g. a
 * deferred auto-select SolicitOffer) is ended on the device and the command fails.
 *
 * A ProvideOffer naming a session id is a re-offer for a session the camera already holds (§11.5.6.3.12).
 * It never ends a session and never overwrites a local requestor entry, because a re-offer may omit
 * StreamUsage and the streams and changes neither. The entry is only added when absent and the re-offer
 * carries enough to track it. Such a session is not being established by a managed start, so
 * `sessionEstablishing` is not called. An id the camera does not hold is answered NOT_FOUND by the camera.
 *
 * The offer is recorded with {@link WebRtcProviderSessionIo.offerSent} only while the camera can still
 * answer it: it is withdrawn when the camera refuses it, and when the local requestor does not hold the
 * session at the end, since the requestor refuses the answer of a session it does not hold.
 */
export async function establishWebRtcProviderSession(
    io: WebRtcProviderSessionIo,
    args: WebRtcProviderSessionArgs,
): Promise<EstablishedSession> {
    const fields: Record<string, unknown> = { ...args.fields, originatingEndpointId: args.originatingEndpointId };
    selectWebRtcStreamFields(fields, args.clusterRevision);
    const offer = typeof fields.sdp === "string" ? fields.sdp : undefined;
    if (typeof fields.webRtcSessionId === "number") {
        return reOffer(io, args, fields, fields.webRtcSessionId, offer);
    }
    return newSession(io, args, fields, offer);
}

async function reOffer(
    io: WebRtcProviderSessionIo,
    args: WebRtcProviderSessionArgs,
    fields: Record<string, unknown>,
    webRtcSessionId: number,
    offer: string | undefined,
): Promise<EstablishedSession> {
    // The requestor already holds the session, so the camera's answer can arrive before the response.
    const withdraw = offer === undefined ? undefined : io.offerSent(webRtcSessionId, offer);
    let accepted = false;
    try {
        const established = await invokeEstablishing(io, args, fields);
        accepted = true;
        const session = trackableSession(args, fields, established);
        if (session !== undefined) {
            try {
                await io.upsertSession(session, { onlyIfAbsent: true });
            } catch (error) {
                logger.warn(
                    `Could not track re-offered WebRTC session id=${webRtcSessionId} for node ${args.formatNode(args.nodeId)}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
        return established;
    } finally {
        if (!accepted || !io.tracks(webRtcSessionId)) withdraw?.();
    }
}

async function newSession(
    io: WebRtcProviderSessionIo,
    args: WebRtcProviderSessionArgs,
    fields: Record<string, unknown>,
    offer: string | undefined,
): Promise<EstablishedSession> {
    const { commandName, nodeId, formatNode } = args;
    const established = await invokeEstablishing(io, args, fields);
    const { webRtcSessionId } = established;
    args.sessionEstablishing?.(webRtcSessionId);

    const session = trackableSession(args, fields, established);
    if (session === undefined) {
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

    logger.info(
        `upserting WebRTC session id=${webRtcSessionId} peerNodeId=${nodeId} peerEndpointId=${args.endpointId} fabricIndex=${args.fabricIndex} streamUsage=${session.streamUsage} originatingEndpointId=${args.originatingEndpointId}`,
    );
    // Before the requestor holds the session: it accepts the camera's answer from then on.
    const withdraw = offer === undefined ? undefined : io.offerSent(webRtcSessionId, offer);
    try {
        await io.upsertSession(session);
    } catch (error) {
        withdraw?.();
        // Only this scope knows the id; not ending it here would pin its streams on the device.
        logger.warn(
            `Tearing down WebRTC session id=${webRtcSessionId} for node ${formatNode(
                nodeId,
            )}: the local requestor did not take it, so signaling cannot be routed for it`,
        );
        await endSessionWithinBudget(io, webRtcSessionId, "untracked");
        throw error;
    }
    return established;
}

async function invokeEstablishing(
    io: WebRtcProviderSessionIo,
    args: WebRtcProviderSessionArgs,
    fields: Record<string, unknown>,
): Promise<EstablishedSession> {
    const response = await io.invoke(args.commandName === "ProvideOffer" ? "provideOffer" : "solicitOffer", fields);
    if (
        typeof response !== "object" ||
        response === null ||
        !("webRtcSessionId" in response) ||
        typeof response.webRtcSessionId !== "number"
    ) {
        throw ServerError.sdkStackError(
            `${args.commandName} did not return a WebRTCSessionID for node ${args.formatNode(args.nodeId)}`,
        );
    }
    // `in` narrowing gives no string index signature, so TS cannot express this shape without a cast.
    return response as EstablishedSession;
}

/** The requestor entry for the session, or undefined when the request lacks what the struct requires. */
function trackableSession(
    args: WebRtcProviderSessionArgs,
    fields: Record<string, unknown>,
    response: EstablishedSession,
): WebRtcTransportDefinitions.WebRtcSession | undefined {
    const { nodeId, endpointId, fabricIndex } = args;
    const streamUsage = fields.streamUsage;
    const videoStreams = resolveWebRtcSessionStreams(fields.videoStreams, fields.videoStreamId, response.videoStreamId);
    const audioStreams = resolveWebRtcSessionStreams(fields.audioStreams, fields.audioStreamId, response.audioStreamId);
    if (!isTrackableWebRtcSession(streamUsage, videoStreams, audioStreams)) return undefined;
    return {
        id: response.webRtcSessionId,
        peerNodeId: nodeId,
        peerEndpointId: endpointId,
        streamUsage: streamUsage as WebRtcTransportDefinitions.WebRtcSession["streamUsage"],
        metadataEnabled: fields.metadataEnabled === true,
        videoStreams,
        audioStreams,
        fabricIndex,
    };
}
