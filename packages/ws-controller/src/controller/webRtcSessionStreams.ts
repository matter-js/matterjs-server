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
 * Its inputs are device data: a `WebRTCSessionStruct` the camera reports, or the request this server
 * already narrowed together with the provider's deprecated stream-id echo, which exists only to
 * report the provider's choice for a rev-1 null (auto-select) request (spec §11.5.6.4). Reading it
 * tolerantly is right for that: a device entry this server cannot parse is one it reports nothing
 * about, not one it can refuse. A caller's own request is read by {@link selectWebRtcStreamFields},
 * which refuses what it cannot send rather than narrowing it.
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
 * VideoStreams/AudioStreams (cluster revision 2) deprecate the singular VideoStreamID/AudioStreamID
 * (revision 1), and a provider fails the command with INVALID_COMMAND when a list is present beside
 * a singular id — the test spans both media kinds rather than each on its own (§11.5.6.1 and
 * §11.5.6.3, Effect on Receipt). So a request stating both forms is refused here. Dropping one of
 * them would change what the caller asked for: `{ videoStreams: [5], audioStreamId: null }` states
 * a video stream and auto-selected audio, and dropping the id establishes a video-only session.
 *
 * The refusal is unconditional, which is stricter than a `ProvideOffer` re-offer: the device runs
 * that test only under `WebRTCSessionID == NULL` (§11.5.6.3). It costs a re-offer nothing it could
 * have used, because the provider's whole stream-selection step runs under that same condition, so
 * neither form changes the session a re-offer names. A re-offer that states the lists is not refused
 * here — the provider boundary logs it and forwards it (`reportFieldsPastTheirGate`).
 *
 * A stated form the provider takes is sent as stated. The one rewrite is a list going to a provider
 * this server does not know to be at revision 2 — one stating revision 1, and one whose revision has
 * not been read yet, which is the same position, since a list such a provider does not understand is
 * dropped on receipt and the session comes up with streams the caller did not choose. Such a
 * provider carries one id per media kind, so a single-entry list says exactly what the singular id
 * says and converts, while a longer one cannot be said at all and is refused rather than truncated.
 * `camera_start_stream` builds single-entry lists, so that conversion is what keeps it working
 * against a revision-1 camera.
 *
 * Nothing is written until every media kind has passed, so a refusal leaves the request as it was.
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
        // The field takes 1 to 16 entries (§11.5.6.1.8, §11.5.6.1.9), so an empty list asks for
        // nothing it can carry; leaving the field out is how a caller asks for no stream of a kind.
        if (ids.length === 0) {
            throw ServerError.invalidArguments(
                `${field.list} names no stream. Leave it out to ask for no ${field.kind} stream.`,
            );
        }
    }
    // A client cluster's globals come from the device, so the typed number can still be absent here.
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
    /** The provider's ClusterRevision, or undefined while the endpoint has not stated one. */
    clusterRevision: number | undefined;
    formatNode: (nodeId: NodeId) => string;
}

/**
 * End a session this call established but cannot hand back, waiting at most
 * {@link DEVICE_CLEANUP_BUDGET_MS} for the device.
 *
 * A provider that creates the session and then stops answering would otherwise hold this call for as
 * long as it stays silent — on `camera_start_stream`'s route that is the endpoint lock, the request's
 * streams unreturned and the error this teardown precedes never raised.
 *
 * The budget is the camera manager's because the failure is the same one, and the wait is its own
 * because the session is not one of the request's registered give-backs: nothing outside this call
 * knows the id. So a `camera_start_stream` that reaches here can spend this budget and then the one
 * `AllocationScope.settle` spends, which is what the 10 seconds bounds — each wait on a silent
 * camera, not the request.
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
        // The device has the session and only this scope knows its id, so raising without ending it
        // leaves a session nothing can name again and its streams pinned at ReferenceCount > 0.
        logger.warn(
            `Tearing down WebRTC session id=${webRtcSessionId} for node ${formatNode(
                nodeId,
            )}: the local requestor did not take it, so signaling cannot be routed for it`,
        );
        await endSessionWithinBudget(io, webRtcSessionId, "untracked");
        throw error;
    }

    // Verified above: `response` carries a numeric webRtcSessionId. The rest of the assertion is the
    // residual TS can't express — an object narrowed to specific known keys via `in` has no general
    // string index signature, even though every real object satisfies one at runtime.
    return response as { webRtcSessionId: number } & Record<string, unknown>;
}
