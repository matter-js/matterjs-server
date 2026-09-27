/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, MaybePromise, Observable, Time } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { Status } from "@matter/main/types";
import { deviceForgotSession, invokeEndSession } from "../controller/webRtcSessionTracking.js";
import {
    ServerError,
    type CameraOccupyingStreamDetail,
    type CameraPrivacyMode,
} from "../types/WebSocketMessageTypes.js";
import { DEVICE_CLEANUP_BUDGET_MS, withCleanupBudget } from "../util/deviceCleanupBudget.js";
import type {
    AllocatedAudioStream,
    AllocatedSnapshotStream,
    AllocatedVideoStream,
    AudioEnvelope,
    CameraFeatures,
    CameraPrivacyState,
    CameraSessionEnded,
    CameraStreamEvicted,
    DeviceWebRtcSession,
    LeaseStatement,
    ManagedSession,
    Resolution,
    ResolvedStream,
    StreamKind,
    StreamLease,
    VideoEnvelope,
} from "./cameraTypes.js";
import {
    lacksFeature,
    overlaySupport,
    sessionPrivacyModes,
    snapshotPrivacyModes,
    statedFeatureNames,
} from "./devicePolicy.js";
import { deviceStatusOf } from "./deviceStatus.js";
import { resolveOverlays } from "./overlayPolicy.js";
import type { OverlayBounds } from "./overlayPolicy.js";
import { decodableVideoCodecs, mediaRefusal, parseSdpVideoConstraints, videoCodecLimits } from "./sdpConstraints.js";
import type { MediaRefusal, SdpVideoConstraints, SelectedVideoCodecLimits } from "./sdpConstraints.js";
import { CameraSessionRegistry } from "./sessionRegistry.js";
import type { PendingSession, SessionScope } from "./sessionRegistry.js";
import {
    chooseSnapshotStreamToFree,
    encodersExhausted,
    findAdoptableSnapshotStream,
    isDegradeFrom,
    selectSnapshotCapabilities,
    usesHardwareEncoder,
} from "./snapshotPolicy.js";
import type { SnapshotCapability } from "./snapshotPolicy.js";
import {
    budgetVideoEnvelope,
    chooseEvictionVictim,
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    findReusableVideoStream,
    narrowEnvelope,
    satisfiesAudioCallerBounds,
    satisfiesVideoCallerBounds,
    statedHints,
    trackRequest,
    videoCallerBounds,
} from "./streamPolicy.js";
import type {
    AudioCallerBounds,
    AudioHints,
    BudgetedVideoEnvelope,
    RateDistortionPoint,
    TrackRequest,
    VideoHints,
} from "./streamPolicy.js";
import {
    audioCodecName,
    featureName,
    imageCodecName,
    knownVideoCodecs,
    streamUsageName,
    videoCodecName,
} from "./wireNames.js";

const logger = Logger.get("CameraStreamManager");

/** Bounded so a device that rejects everything fails fast rather than walking to 1x1. */
const MAX_NARROWING_ROUNDS = 3;

/**
 * `VideoStreamAllocate` attempts one request may make, narrowing and eviction together.
 *
 * Neither rung needs it to terminate — narrowing has its own budget and eviction's candidate set
 * shrinks with every victim — so this only bounds how long a camera that refuses everything can hold
 * the endpoint lock.
 */
export const MAX_ALLOCATE_ATTEMPTS = 8;

/** What an allocation ladder may do about a device rejection. */
type LadderReaction =
    /** The device cannot serve this range. A smaller request may succeed. */
    | "narrow"
    /** The device has no capacity. Freeing or sharing a stream may make room. */
    | "make-room"
    /** The request is malformed for this device. No retry can fix it. */
    | "fail-incompatible"
    | "rethrow";

/**
 * The single place a Matter status becomes a ladder decision.
 *
 * `ConstraintError` and `DynamicConstraintError` are one hex digit apart in meaning and nothing
 * alike in consequence: `ConstraintError` is `min > max`, a field out of range or an unknown codec
 * (`CameraAVStreamManagementCluster.cpp`, the ConstraintError returns ahead of the capability
 * lookup), so narrowing can only spend rounds before failing anyway.
 */
function ladderReaction(status: number | undefined): LadderReaction {
    switch (status) {
        case Status.DynamicConstraintError:
            return "narrow";
        case Status.ResourceExhausted:
            return "make-room";
        case Status.ConstraintError:
            return "fail-incompatible";
        default:
            return "rethrow";
    }
}

/**
 * The envelope actually delivered by an allocated video stream, as opposed to the one requested.
 *
 * `overlays` is the camera's own statement about this stream, carried across unchanged. That makes the
 * envelope both the honest report for a reused or degraded stream and a conformant request again for
 * `#restoreFreedVideoStream`: the struct states a flag only where the camera has the feature, so what
 * the camera left out is exactly what must not go back on an allocate.
 */
function envelopeOfVideoStream(stream: AllocatedVideoStream, keyFrameInterval: number): VideoEnvelope {
    return {
        overlays: stream.overlays,
        codec: stream.videoCodec,
        minResolution: stream.minResolution,
        maxResolution: stream.maxResolution,
        minFrameRate: stream.minFrameRate,
        maxFrameRate: stream.maxFrameRate,
        minBitRate: stream.minBitRate,
        maxBitRate: stream.maxBitRate,
        keyFrameInterval,
    };
}

/**
 * The range `VideoStreamAllocate` was asked for, in the shape the device reports allocations in.
 *
 * It is what this server requested, not what the device stated: the allocate response carries only
 * the id. Device state replaces it for every decision as soon as the device names the stream, and
 * `referenceCount` is 0 because nothing can reference a stream whose id has only just come back.
 */
function allocatedVideoStream(streamId: number, streamUsage: number, envelope: VideoEnvelope): AllocatedVideoStream {
    return {
        videoStreamId: streamId,
        streamUsage,
        videoCodec: envelope.codec,
        minResolution: envelope.minResolution,
        maxResolution: envelope.maxResolution,
        minFrameRate: envelope.minFrameRate,
        maxFrameRate: envelope.maxFrameRate,
        minBitRate: envelope.minBitRate,
        maxBitRate: envelope.maxBitRate,
        referenceCount: 0,
        overlays: envelope.overlays,
    };
}

/** The audio counterpart of {@link allocatedVideoStream}. */
function allocatedAudioStream(streamId: number, streamUsage: number, envelope: AudioEnvelope): AllocatedAudioStream {
    return {
        audioStreamId: streamId,
        streamUsage,
        audioCodec: envelope.codec,
        channelCount: envelope.channelCount,
        sampleRate: envelope.sampleRate,
        bitRate: envelope.bitRate,
        bitDepth: envelope.bitDepth,
        referenceCount: 0,
    };
}

/** The envelope actually delivered by an allocated audio stream, as opposed to the one requested. */
function envelopeOfAudioStream(stream: AllocatedAudioStream): AudioEnvelope {
    return {
        codec: stream.audioCodec,
        channelCount: stream.channelCount,
        sampleRate: stream.sampleRate,
        bitRate: stream.bitRate,
        bitDepth: stream.bitDepth,
    };
}

/** WebRTCEndReasonEnum has no dedicated field for "the caller stopped watching"; UserHangup is it. */
const WEBRTC_END_REASON_USER_HANGUP = WebRtcTransportDefinitions.WebRtcEndReason.UserHangup;

/**
 * `narrowed`, or a typed codec failure when narrowing emptied the set it was given.
 *
 * `device` reports the set that was narrowed, not the camera's full list: after the offer has already
 * ruled codecs out, "the camera supports it" is no longer the answer the client needs.
 */
function requireCodecCandidates(narrowed: number[], before: number[], requested: string[]): number[] {
    if (narrowed.length === 0) {
        throw ServerError.cameraStreamIncompatible({
            reason: "codec",
            track: "video",
            device: before.map(videoCodecName),
            requested,
        });
    }
    return narrowed;
}

/**
 * The codec to request, narrowed from the device's rate-distortion codecs by what the offer states
 * it can decode and then by what the caller prefers.
 *
 * Both narrowings are hard; `resolveVideoStreamLocked` then rejects a codec outside the device's own
 * list. A camera that advertises no trade-off point states nothing to narrow, so the enum's own
 * vocabulary stands in and the caller's or the offer's choice decides.
 */
export function preferredVideoCodec(
    deviceCodecs: number[],
    sdp: SdpVideoConstraints | undefined,
    hintCodecs: string[] | undefined,
): number {
    let candidates = deviceCodecs.length > 0 ? deviceCodecs : knownVideoCodecs();
    const offered = sdp === undefined ? undefined : decodableVideoCodecs(sdp);
    if (offered !== undefined) {
        const narrowed = candidates.filter(codec => offered.decodable.includes(videoCodecName(codec)));
        if (narrowed.length === 0 && candidates.some(codec => offered.unreadable.includes(videoCodecName(codec)))) {
            // The peer and the camera do have a codec in common; what is missing is a decode ceiling
            // this server can bound the stream by, and reporting that as "no codec in common" would
            // send the client to change a codec list that is not the problem.
            throw ServerError.cameraStreamIncompatible({
                reason: "level",
                track: "video",
                device: candidates.map(videoCodecName),
                requested: [...offered.unreadable],
            });
        }
        candidates = requireCodecCandidates(narrowed, candidates, [...offered.decodable, ...offered.unreadable]);
    }
    if (hintCodecs !== undefined) {
        // Walk the caller's stated order, not the device's: `candidates.filter(...)` would keep the
        // device's ordering and silently discard the caller's preference between two codecs it both offers.
        const preferred = hintCodecs
            .map(name => candidates.find(codec => videoCodecName(codec) === name))
            .filter((codec): codec is number => codec !== undefined);
        candidates = requireCodecCandidates(preferred, candidates, hintCodecs);
    }
    return candidates[0] ?? CameraAvStreamManagement.VideoCodec.H264;
}

function refusalText(refusal: MediaRefusal, kind: "video" | "audio"): string {
    switch (refusal.state) {
        case "absent":
            return `carries no ${kind} section`;
        case "refused":
            return `rejects the ${kind} section`;
        default:
            return `states a=${refusal.direction} on the ${kind} section`;
    }
}

function occupyingStream(kind: StreamKind, streamId: number, referenceCount: number): CameraOccupyingStreamDetail {
    return { kind, streamId, referenceCount };
}

/**
 * The allocated snapshot streams that hold one of the camera's encoders, for a capacity refusal.
 *
 * The camera states it per stream (`HardwareEncoder`, §11.2.6.13.9) and it does not depend on anyone
 * referencing the stream. No call gives such a stream back, so it is often the only thing a client
 * can release to make room, and a refusal that listed the video streams alone would name nothing.
 */
/**
 * What this server states about a snapshot stream it has just allocated, before the camera reports it.
 *
 * The request's own values, as {@link allocatedVideoStream} does for the video allocate: the camera
 * accepted them, and the struct's remaining fields are the two flags the capability decides
 * (§11.2.6.13.8, §11.2.6.13.9) and a reference count that is 0 on a stream nothing has taken yet
 * (§11.2.8.8). `minResolution` and `maxResolution` are both the capability's own resolution, which is
 * what the allocate sends.
 */
function allocatedSnapshotStream(
    snapshotStreamId: number,
    capability: SnapshotCapability,
    overlays: OverlayBounds,
): AllocatedSnapshotStream {
    return {
        overlays,
        snapshotStreamId,
        imageCodec: capability.imageCodec,
        minResolution: capability.resolution,
        maxResolution: capability.resolution,
        referenceCount: 0,
        frameRate: capability.maxFrameRate,
        encodedPixels: capability.requiresEncodedPixels,
        hardwareEncoder: usesHardwareEncoder(capability),
    };
}

function encoderHoldingSnapshotStreams(streams: AllocatedSnapshotStream[]): CameraOccupyingStreamDetail[] {
    return streams
        .filter(stream => stream.hardwareEncoder)
        .map(stream => occupyingStream("snapshot", stream.snapshotStreamId, stream.referenceCount));
}

function isResolution(value: unknown): value is Resolution {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as { width?: unknown; height?: unknown };
    return typeof candidate.width === "number" && typeof candidate.height === "number";
}

/**
 * How long a stream this server allocated may be reused before the device has ever named it.
 *
 * It spans the gap between an allocate command returning an id and the matching `Allocated*Streams`
 * report arriving, which is the window a second request would otherwise allocate a twin in.
 */
export const UNREPORTED_LEASE_GRACE_MS = 10000;

/** One device-side effect of a request, with the lifetime it was registered under. */
interface ScopedReturn {
    readonly give: () => Promise<unknown>;
    /** Whether the request's outcome leaves this effect to be given back. */
    readonly due: (succeeded: boolean) => boolean;
}

/**
 * Everything one request caused to exist on a device, each with the way to give it back.
 *
 * A request registers at the point the effect happens, never at an exit. {@link
 * CameraStreamManager.withAllocationScope} runs what is due on every exit the request has — a return,
 * a throw, and the throw a claimed registration causes when the requesting connection closed while
 * the camera was still answering. So an exit cannot be written that forgets one, and an effect the
 * request never caused has nothing registered and so cannot be given back by mistake.
 */
class AllocationScope {
    readonly #returns = new Array<ScopedReturn>();

    /**
     * Give this back unless the request succeeds.
     *
     * A successful request hands its stream ids to the caller, which is what makes the caller able to
     * release them; a failed one does not, so this is their only way back.
     */
    returnOnFailure(give: () => Promise<unknown>): void {
        this.#returns.push({ give, due: succeeded => !succeeded });
    }

    /**
     * Give this back unless the request both spends it and succeeds.
     *
     * Capacity freed to make room is worth it exactly when the request ends up using it. That is the
     * request's outcome, not the outcome of the one call that spent it: an allocate can succeed and
     * the request still fail afterwards, on the audio track, on the offer, or on a registration a
     * closing connection claimed. The returned callback records the spending; whether the spending
     * was worth anything is decided in {@link settle}.
     */
    returnUnlessSpent(give: () => Promise<unknown>): () => void {
        let spent = false;
        this.#returns.push({ give, due: succeeded => !(spent && succeeded) });
        return () => {
            spent = true;
        };
    }

    /** Give this back when the request ends, however it ends. */
    returnAlways(give: () => Promise<unknown>): void {
        this.#returns.push({ give, due: () => true });
    }

    /**
     * Run what is due, newest first, so a session is ended before the streams it referenced are
     * deallocated — the device refuses to deallocate a stream at `ReferenceCount > 0`. That order is
     * also why the whole chain shares one {@link DEVICE_CLEANUP_BUDGET_MS} budget rather than one per
     * step: a camera that did not answer the session end would refuse the deallocates behind it
     * anyway, and the leases keep those streams reachable for `camera_release_stream`.
     */
    async settle(succeeded: boolean): Promise<void> {
        if (this.#returns.length === 0) return;
        await withCleanupBudget("undoing what a request caused", async () => {
            for (const entry of [...this.#returns].reverse()) {
                if (!entry.due(succeeded)) continue;
                try {
                    await entry.give();
                } catch (error) {
                    logger.warn("A camera request could not undo what it caused on the device:", error);
                }
            }
        });
    }
}

function deviceReportsStream(state: CameraState, kind: StreamKind, streamId: number): boolean {
    switch (kind) {
        case "video":
            return state.allocatedVideoStreams.some(stream => stream.videoStreamId === streamId);
        case "audio":
            return state.allocatedAudioStreams.some(stream => stream.audioStreamId === streamId);
        case "snapshot":
            return state.allocatedSnapshotStreams.some(stream => stream.snapshotStreamId === streamId);
    }
}

function referenceCountOf(state: CameraState, kind: StreamKind, streamId: number): number {
    switch (kind) {
        case "video":
            return state.allocatedVideoStreams.find(stream => stream.videoStreamId === streamId)?.referenceCount ?? 0;
        case "audio":
            return state.allocatedAudioStreams.find(stream => stream.audioStreamId === streamId)?.referenceCount ?? 0;
        case "snapshot":
            return (
                state.allocatedSnapshotStreams.find(stream => stream.snapshotStreamId === streamId)?.referenceCount ?? 0
            );
    }
}

function deallocateCall(kind: StreamKind, streamId: number): { command: string; fields: Record<string, unknown> } {
    switch (kind) {
        case "video":
            return { command: "videoStreamDeallocate", fields: { videoStreamId: streamId } };
        case "audio":
            return { command: "audioStreamDeallocate", fields: { audioStreamId: streamId } };
        case "snapshot":
            return { command: "snapshotStreamDeallocate", fields: { snapshotStreamId: streamId } };
    }
}

/**
 * The AVSM state the policy needs: the attributes as matter.js reports them through `stateOf`, and
 * the feature map, which is a global attribute and comes from `globalsOf` beside them.
 */
export interface CameraState {
    /** The cluster's `FeatureMap`, which says which kinds of stream this camera has at all. */
    features: CameraFeatures;
    /** The privacy switches, which say whether it will serve any of them right now. */
    privacy: CameraPrivacyState;
    maxConcurrentEncoders?: number;
    maxEncodedPixelRate?: number;
    /** MaxNetworkBandwidth (§11.2.7.12), bits per second; the bit-rate ceiling the camera states. */
    maxNetworkBandwidth?: number;
    videoSensorParams?: {
        sensorWidth: number;
        sensorHeight: number;
        maxFps: number;
        maxHdrFps?: number;
        hdrCapable?: boolean;
    };
    minViewportResolution?: Resolution;
    rateDistortionTradeOffPoints: RateDistortionPoint[];
    snapshotCapabilities: SnapshotCapability[];
    supportedStreamUsages: number[];
    streamUsagePriorities: number[];
    allocatedVideoStreams: AllocatedVideoStream[];
    allocatedAudioStreams: AllocatedAudioStream[];
    allocatedSnapshotStreams: AllocatedSnapshotStream[];
    microphoneCapabilities?: {
        supportedCodecs: number[];
        maxNumberOfChannels: number;
        supportedSampleRates: number[];
        supportedBitDepths: number[];
    };
    twoWayTalkSupport?: number;
}

export interface CameraDeviceIo {
    /**
     * Typed AVSM state, or undefined when the endpoint does not expose the behaviour.
     *
     * The manager may call this and {@link invoke} while holding its per-endpoint lock; an
     * implementation must not call back into the manager for the same endpoint from either method, or
     * the call deadlocks against itself.
     */
    readCameraState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState | undefined>;
    /**
     * Cluster ids of the clusters camera streaming needs that this endpoint does not expose, as
     * `camera_not_supported` reports them. Empty when the endpoint exposes both.
     */
    missingCameraClusters(nodeId: NodeId, endpointId: EndpointNumber): Promise<number[]>;
    /**
     * The WebRTC sessions the provider reports in `CurrentSessions`, or undefined when the endpoint
     * does not expose the provider behaviour.
     *
     * The camera's own list, not this server's: it names the sessions of earlier process runs too,
     * which nothing here records.
     */
    readWebRtcSessions(nodeId: NodeId, endpointId: EndpointNumber): Promise<DeviceWebRtcSession[] | undefined>;
    invoke(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        cluster: "avsm" | "webrtcProvider";
        command: string;
        fields: Record<string, unknown>;
        /**
         * For `provideOffer` / `solicitOffer` only: called with the session id the provider answered
         * with, before the local requestor is given the session and therefore before any `End` for it
         * can be routed. Ignored for every other command.
         */
        sessionEstablishing?: (webRtcSessionId: number) => void;
    }): Promise<unknown>;
}

export interface CameraCapabilities {
    /**
     * The features the camera advertises, or absent when it has not stated its feature map.
     *
     * Absent is not an empty set: a client may read a present list as the complete set of what this
     * camera can do, and an absent one as the camera not having answered yet.
     */
    features?: string[];
    privacy: CameraPrivacyState;
    video: {
        sensor?: Resolution;
        maxFps?: number;
        maxHdrFps?: number;
        hdrCapable?: boolean;
        minViewport?: Resolution;
        rateDistortionPoints: RateDistortionPoint[];
        codecs: number[];
    };
    audio: {
        codecs: number[];
        channels?: number;
        sampleRates: number[];
        bitDepths: number[];
        twoWayTalkSupport?: number;
    };
    snapshot: { capabilities: SnapshotCapability[] };
    limits: {
        maxEncodedPixelRate?: number;
        maxConcurrentEncoders?: number;
        maxNetworkBandwidth?: number;
        supportedStreamUsages: number[];
        streamUsagePriorities: number[];
    };
    allocated: {
        video: Array<AllocatedVideoStream & { allocatedByServer: boolean }>;
        audio: Array<AllocatedAudioStream & { allocatedByServer: boolean }>;
        snapshot: Array<AllocatedSnapshotStream & { allocatedByServer: boolean }>;
    };
    /**
     * The sessions the camera reports for this fabric, which is what holds an allocation's
     * `referenceCount` above zero. Empty both for an endpoint that holds none and for one with no
     * WebRTC provider cluster, which `camera_get_capabilities` serves because it needs only AV
     * Stream Management.
     */
    sessions: DeviceWebRtcSession[];
}

export interface StartStreamArgs {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    connectionId: string;
    streamUsage: number;
    sdp?: string;
    video?: VideoHints | false;
    audio?: AudioHints | false;
    iceServers?: WebRtcTransportDefinitions.IceServer[];
    iceTransportPolicy?: unknown;
    metadataEnabled?: boolean;
    /** Defaults to true. @see CameraStreamManager.resolveVideoStreamLocked */
    allowEviction?: boolean;
}

/**
 * A track's stream, or the reason there is none, for the outcomes a track may be absent for.
 *
 * Absence and failure are one fact seen from two sides there, and which side the caller sees depends
 * only on what it stated about the track, which {@link CameraStreamManager.resolveTrack} is the one
 * place to decide. Outcomes a track may never be absent for stay throws and do not come through
 * here: a camera that refuses video ends the request rather than producing a session without it.
 */
export type TrackOutcome = { readonly stream: ResolvedStream } | { readonly unavailable: unknown };

export interface StartStreamResult {
    webRtcSessionId: number;
    mode: "solicit_offer" | "provide_offer";
    video?: ResolvedStream;
    audio?: ResolvedStream;
}

/** What one `CaptureSnapshot` needs, including the facts its failure is reported with. */
interface CaptureSnapshotArgs {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    state: CameraState;
    snapshotStreamId: number;
    requestedResolution: Resolution;
    deviceCodecs: string[];
    requestedCodecs: string[];
}

export interface SnapshotResult {
    data: Uint8Array;
    imageCodec: number;
    resolution: Resolution;
    /** True when the frame is smaller than the best capability the caller's own bounds allowed. */
    degraded: boolean;
    /** The stream the frame came from, which a successful call always leaves on the camera. */
    snapshotStreamId: number;
}

export class CameraStreamManager {
    readonly #io: CameraDeviceIo;
    readonly #leases = new Map<string, StreamLease[]>();
    readonly #locks = new Map<string, Promise<unknown>>();
    /**
     * What this server did to a camera that no client asked it to do.
     *
     * Both are facts a client cannot learn from any response of its own: a session of its own that
     * something else ended, and a stream that stopped existing because another request needed the
     * capacity. Declared ahead of the registry, which emits the first of them.
     */
    readonly events = {
        sessionEnded: new Observable<[CameraSessionEnded], MaybePromise<void>>(),
        streamEvicted: new Observable<[CameraStreamEvicted], MaybePromise<void>>(),
    };
    readonly #sessions = new CameraSessionRegistry(ended => this.#announce(this.events.sessionEnded, ended));
    #nextLeaseGeneration = 0;

    constructor(io: CameraDeviceIo) {
        this.#io = io;
    }

    /**
     * Report something that already happened on the device, without letting a listener undo it.
     *
     * matter.js's `Observable.emit` rethrows an observer's error, and awaits one that answers with a
     * promise. Every one of these is emitted after a device round trip has succeeded and, for the
     * eviction, while the endpoint lock is held — so a listener must not be able to turn a stop that
     * happened into a failed `camera_stop_stream`, abort a shutdown pass, or leave a request without
     * the replacement its freed stream registers next.
     */
    #announce<T>(observable: Observable<[T], MaybePromise<void>>, event: T): void {
        MaybePromise.catch(
            () => observable.emit(event),
            error => logger.warn("A listener of a camera event failed:", error),
        );
    }

    /**
     * Run `work` with no other work in flight for the same endpoint.
     *
     * Two concurrent starts otherwise both miss the same reusable stream and allocate twins, which on
     * a single-encoder camera means the second one fails.
     */
    protected async withEndpointLock<T>(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        work: () => Promise<T>,
    ): Promise<T> {
        const key = this.endpointKey(nodeId, endpointId);
        const previous = this.#locks.get(key) ?? Promise.resolve();
        const current = previous.then(work);
        const settled = current.then(
            () => undefined,
            () => undefined,
        );
        this.#locks.set(key, settled);
        try {
            return await current;
        } finally {
            if (this.#locks.get(key) === settled) this.#locks.delete(key);
        }
    }

    protected endpointKey(nodeId: NodeId, endpointId: EndpointNumber): string {
        return `${nodeId}/${endpointId}`;
    }

    /** Test hook: the lock map holds one entry per endpoint with work in flight. */
    protected get pendingLockCount(): number {
        return this.#locks.size;
    }

    /** Test hook: the lease map holds one entry per endpoint with leases outstanding, and none otherwise. */
    protected get leasedEndpointCount(): number {
        return this.#leases.size;
    }

    protected get io(): CameraDeviceIo {
        return this.#io;
    }

    protected leasesOf(nodeId: NodeId, endpointId: EndpointNumber): StreamLease[] {
        return this.#leases.get(this.endpointKey(nodeId, endpointId)) ?? new Array<StreamLease>();
    }

    #putLease(nodeId: NodeId, endpointId: EndpointNumber, lease: StreamLease): void {
        const key = this.endpointKey(nodeId, endpointId);
        const existing = this.#leases.get(key) ?? new Array<StreamLease>();
        const others = existing.filter(entry => !(entry.kind === lease.kind && entry.streamId === lease.streamId));
        others.push(lease);
        this.#leases.set(key, others);
    }

    protected leaseFor(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        kind: StreamKind,
        streamId: number,
    ): StreamLease | undefined {
        return this.leasesOf(nodeId, endpointId).find(lease => lease.kind === kind && lease.streamId === streamId);
    }

    /**
     * Record a stream this server has just allocated, replacing what it knew about the id before.
     *
     * The device reissues a stream id once the stream it named is deallocated, so an entry that still
     * said `allocatedByUs: false` from an earlier foreign stream would make the id we just allocated
     * unreleasable. The last statement about an id is the true one.
     */
    protected recordAllocation(nodeId: NodeId, endpointId: EndpointNumber, statement: LeaseStatement): StreamLease {
        const now = Time.nowUs;
        const lease: StreamLease = {
            ...statement,
            shadowUntil: now + UNREPORTED_LEASE_GRACE_MS,
            reportedByDevice: false,
            generation: ++this.#nextLeaseGeneration,
        };
        this.#putLease(nodeId, endpointId, lease);
        return lease;
    }

    /**
     * Record a stream this call hands out without having allocated it here and now.
     *
     * With no entry yet the stream came out of device state, which is both its only evidence and
     * proof that the device reports it. With an entry, that entry's own evidence carries over:
     * handing a stream out again says nothing new about whether it still exists.
     */
    #recordReuse(nodeId: NodeId, endpointId: EndpointNumber, statement: LeaseStatement): boolean {
        const previous = this.leaseFor(nodeId, endpointId, statement.kind, statement.streamId);
        this.#putLease(nodeId, endpointId, {
            ...statement,
            shadowUntil: previous?.shadowUntil ?? 0,
            reportedByDevice: previous?.reportedByDevice ?? true,
            generation: previous?.generation ?? ++this.#nextLeaseGeneration,
        });
        return statement.allocatedByUs;
    }

    /**
     * Line the leases up with what the device reports.
     *
     * A stream the device has named and then stops naming is gone, so its lease goes with it. Before
     * the first such report absence says nothing, and dropping the lease there would leave a stream
     * this server allocated with nothing recording that it may give back unasked. A lease the device
     * never names therefore lives for the process run: there is no later moment at which silence
     * becomes an answer, and this server's own allocation is the whole of what ownership claims.
     */
    protected reconcileLeases(nodeId: NodeId, endpointId: EndpointNumber, state: CameraState): void {
        const key = this.endpointKey(nodeId, endpointId);
        const existing = this.#leases.get(key);
        if (existing === undefined) return;

        const kept = new Array<StreamLease>();
        for (const lease of existing) {
            if (deviceReportsStream(state, lease.kind, lease.streamId)) {
                kept.push(lease.reportedByDevice ? lease : { ...lease, reportedByDevice: true });
                continue;
            }
            if (lease.reportedByDevice) continue;
            kept.push(lease);
        }
        if (kept.length === 0) {
            this.#leases.delete(key);
        } else {
            this.#leases.set(key, kept);
        }
    }

    /**
     * The video streams this server has allocated that `reported` does not name yet.
     *
     * The reuse decision consults these alongside device state, so a request arriving before the
     * device has reported an allocation sees it rather than allocating a twin of it. Past
     * {@link UNREPORTED_LEASE_GRACE_MS} a stream the device has never named is no longer offered: at
     * that point the missing report is more likely a stream the camera dropped than one it has yet
     * to mention, and reusing it would put a session on an id that no longer exists.
     */
    protected unreportedVideoStreams(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        reported: AllocatedVideoStream[],
    ): AllocatedVideoStream[] {
        const now = Time.nowUs;
        const streams = new Array<AllocatedVideoStream>();
        for (const lease of this.leasesOf(nodeId, endpointId)) {
            if (lease.kind !== "video" || now >= lease.shadowUntil) continue;
            if (reported.some(stream => stream.videoStreamId === lease.streamId)) continue;
            streams.push(lease.allocation);
        }
        return streams;
    }

    /** The snapshot counterpart of {@link unreportedVideoStreams}. */
    protected unreportedSnapshotStreams(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        reported: AllocatedSnapshotStream[],
    ): AllocatedSnapshotStream[] {
        const now = Time.nowUs;
        const streams = new Array<AllocatedSnapshotStream>();
        for (const lease of this.leasesOf(nodeId, endpointId)) {
            if (lease.kind !== "snapshot" || now >= lease.shadowUntil) continue;
            if (reported.some(stream => stream.snapshotStreamId === lease.streamId)) continue;
            streams.push(lease.allocation);
        }
        return streams;
    }

    /** The audio counterpart of {@link unreportedVideoStreams}. */
    protected unreportedAudioStreams(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        reported: AllocatedAudioStream[],
    ): AllocatedAudioStream[] {
        const now = Time.nowUs;
        const streams = new Array<AllocatedAudioStream>();
        for (const lease of this.leasesOf(nodeId, endpointId)) {
            if (lease.kind !== "audio" || now >= lease.shadowUntil) continue;
            if (reported.some(stream => stream.audioStreamId === lease.streamId)) continue;
            streams.push(lease.allocation);
        }
        return streams;
    }

    /**
     * Drop this lease unless the id has been restated since.
     *
     * A give-back whose wait {@link DEVICE_CLEANUP_BUDGET_MS} abandoned still lands, and by then the
     * endpoint lock is gone. The device reissues an id it has freed, so the lease under that id may
     * belong to a stream a later request allocated; dropping it would leave a stream this server owns
     * with nothing recording that it may release it.
     */
    #dropLeaseIfCurrent(nodeId: NodeId, endpointId: EndpointNumber, lease: StreamLease): void {
        const current = this.leaseFor(nodeId, endpointId, lease.kind, lease.streamId);
        if (current?.generation !== lease.generation) return;
        this.dropLease(nodeId, endpointId, lease.kind, lease.streamId);
    }

    protected dropLease(nodeId: NodeId, endpointId: EndpointNumber, kind: StreamKind, streamId: number): void {
        const key = this.endpointKey(nodeId, endpointId);
        const existing = this.#leases.get(key);
        if (existing === undefined) return;
        const remaining = existing.filter(entry => !(entry.kind === kind && entry.streamId === streamId));
        if (remaining.length === 0) {
            this.#leases.delete(key);
        } else {
            this.#leases.set(key, remaining);
        }
    }

    /**
     * Record a video stream this call reuses, and report whether this server allocated it.
     *
     * A stream this server did not allocate is leased with `allocatedByUs: false`: reusable, never
     * released by us. Leasing it anyway is what lets a later request see every stream this server has
     * handed out, rather than only what the subscription has reported back.
     */
    protected leaseReusedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        stream: AllocatedVideoStream,
    ): boolean {
        return this.#recordReuse(nodeId, endpointId, {
            kind: "video",
            streamId: stream.videoStreamId,
            allocatedByUs: this.ownsStream(nodeId, endpointId, "video", stream.videoStreamId),
            allocation: stream,
        });
    }

    /** The audio counterpart of {@link leaseReusedVideoStream}. */
    protected leaseReusedAudioStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        stream: AllocatedAudioStream,
    ): boolean {
        return this.#recordReuse(nodeId, endpointId, {
            kind: "audio",
            streamId: stream.audioStreamId,
            allocatedByUs: this.ownsStream(nodeId, endpointId, "audio", stream.audioStreamId),
            allocation: stream,
        });
    }

    protected ownsStream(nodeId: NodeId, endpointId: EndpointNumber, kind: StreamKind, streamId: number): boolean {
        return this.leasesOf(nodeId, endpointId).some(
            lease => lease.kind === kind && lease.streamId === streamId && lease.allocatedByUs,
        );
    }

    /**
     * Device state, or a typed failure when the endpoint cannot stream.
     *
     * Reading state is also what reconciles the leases against it; see {@link reconcileLeases}.
     */
    protected async requireState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState> {
        const state = await this.#io.readCameraState(nodeId, endpointId);
        if (state === undefined) {
            throw ServerError.cameraNotSupported({
                missingClusters: await this.#io.missingCameraClusters(nodeId, endpointId),
            });
        }
        this.reconcileLeases(nodeId, endpointId, state);
        return state;
    }

    /**
     * Device state for a call that will establish a WebRTC session, or a typed failure when the
     * endpoint cannot carry one.
     *
     * The cluster check comes first: a provider-less endpoint otherwise allocates a stream and only
     * then fails on the provider invoke, with an untyped error and an allocation nobody asked for.
     */
    protected async requireStreamingState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState> {
        const missingClusters = await this.#io.missingCameraClusters(nodeId, endpointId);
        if (missingClusters.length > 0) {
            throw ServerError.cameraNotSupported({ missingClusters });
        }
        return this.requireState(nodeId, endpointId);
    }

    /**
     * The typed privacy refusal behind a device `INVALID_IN_STATE`, or `error` unchanged.
     *
     * The camera's own answer decides, never the state this server has read: `INVALID_IN_STATE` is
     * what the provider (§11.5.6.1.10, §11.5.6.3.12) and `CaptureSnapshot` (§11.2.8.13.3) answer for a
     * privacy switch, and also what they answer for several things that have nothing to do with
     * privacy — a `turns:` ICE server on a camera whose UTCTime is null, among others — so the
     * reported switches are what tells the cases apart. Nothing is checked ahead of the invoke for
     * the reason `releaseStream` checks no reference count: the switches are read from a
     * subscription-backed view that can lag in either direction, and a refusal decided on a stale
     * "on" leaves no path that reaches the device, while a stale "off" costs only this mapping. The
     * read is repeated here rather than taken from the state the call started with, because a report
     * that arrived in the meantime is what makes the answer nameable at all.
     */
    protected async privacyFailure(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        error: unknown,
        modesOf: (privacy: CameraPrivacyState) => CameraPrivacyMode[],
    ): Promise<unknown> {
        if (error instanceof ServerError) return error;
        const status = deviceStatusOf(error);
        if (status !== Status.InvalidInState) return error;
        let state: CameraState | undefined;
        try {
            state = await this.io.readCameraState(nodeId, endpointId);
        } catch (readError) {
            // The device's own refusal is the answer; a read that fails on the way to explaining it
            // must not be reported in its place.
            logger.debug(`Node ${nodeId} endpoint ${endpointId}: privacy state unreadable: ${readError}`);
            return error;
        }
        const modes = state === undefined ? new Array<CameraPrivacyMode>() : modesOf(state.privacy);
        if (modes.length === 0) return error;
        return ServerError.cameraPrivacyMode(
            { modes, deviceStatus: status },
            error instanceof Error ? error : undefined,
        );
    }

    async getCapabilities(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraCapabilities> {
        const state = await this.requireState(nodeId, endpointId);
        const sessions = (await this.#io.readWebRtcSessions(nodeId, endpointId)) ?? new Array<DeviceWebRtcSession>();
        const owned = (kind: StreamKind, streamId: number): boolean =>
            this.ownsStream(nodeId, endpointId, kind, streamId);

        const codecs = new Array<number>();
        for (const point of state.rateDistortionTradeOffPoints) {
            if (!codecs.includes(point.codec)) codecs.push(point.codec);
        }

        const features = statedFeatureNames(state.features);
        return {
            ...(features === undefined ? {} : { features }),
            privacy: state.privacy,
            video: {
                sensor:
                    state.videoSensorParams === undefined
                        ? undefined
                        : {
                              width: state.videoSensorParams.sensorWidth,
                              height: state.videoSensorParams.sensorHeight,
                          },
                maxFps: state.videoSensorParams?.maxFps,
                maxHdrFps: state.videoSensorParams?.maxHdrFps,
                hdrCapable: state.videoSensorParams?.hdrCapable,
                minViewport: state.minViewportResolution,
                rateDistortionPoints: state.rateDistortionTradeOffPoints,
                codecs,
            },
            audio: {
                codecs: state.microphoneCapabilities?.supportedCodecs ?? new Array<number>(),
                channels: state.microphoneCapabilities?.maxNumberOfChannels,
                sampleRates: state.microphoneCapabilities?.supportedSampleRates ?? new Array<number>(),
                bitDepths: state.microphoneCapabilities?.supportedBitDepths ?? new Array<number>(),
                twoWayTalkSupport: state.twoWayTalkSupport,
            },
            snapshot: { capabilities: state.snapshotCapabilities },
            limits: {
                maxEncodedPixelRate: state.maxEncodedPixelRate,
                maxConcurrentEncoders: state.maxConcurrentEncoders,
                maxNetworkBandwidth: state.maxNetworkBandwidth,
                supportedStreamUsages: state.supportedStreamUsages,
                streamUsagePriorities: state.streamUsagePriorities,
            },
            allocated: {
                video: state.allocatedVideoStreams.map(stream => ({
                    ...stream,
                    allocatedByServer: owned("video", stream.videoStreamId),
                })),
                audio: state.allocatedAudioStreams.map(stream => ({
                    ...stream,
                    allocatedByServer: owned("audio", stream.audioStreamId),
                })),
                snapshot: state.allocatedSnapshotStreams.map(stream => ({
                    ...stream,
                    allocatedByServer: owned("snapshot", stream.snapshotStreamId),
                })),
            },
            sessions,
        };
    }

    /**
     * The stream for a track, or nothing when the caller left the track to the server.
     *
     * The one place a track request's three states are answered. A track the caller declined or left
     * unstated may be absent; a track it asked for — `video` or `audio` present, however empty —
     * fails with the reason it is absent, never with a null track and success.
     */
    protected resolveTrack(
        track: "video" | "audio",
        nodeId: NodeId,
        request: TrackRequest<unknown>,
        outcome: TrackOutcome,
    ): ResolvedStream | undefined {
        if ("stream" in outcome) return outcome.stream;
        if (request.state === "demanded") throw outcome.unavailable;
        const reason = outcome.unavailable instanceof Error ? outcome.unavailable.message : String(outcome.unavailable);
        logger.info(`No ${track} stream for node ${nodeId}; continuing without it: ${reason}`);
        return undefined;
    }

    async resolveVideoStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        limits: SelectedVideoCodecLimits;
        hints?: VideoHints;
        allowEviction?: boolean;
    }): Promise<ResolvedStream> {
        return this.withEndpointLock(args.nodeId, args.endpointId, () =>
            this.withAllocationScope(scope => this.resolveVideoStreamLocked(args, scope)),
        );
    }

    /**
     * Run `work` and give back whatever it caused on the device that it may not keep.
     *
     * See {@link AllocationScope}: this is the one return path, and it runs on every exit.
     */
    protected async withAllocationScope<T>(work: (scope: AllocationScope) => Promise<T>): Promise<T> {
        const scope = new AllocationScope();
        let succeeded = false;
        try {
            const result = await work(scope);
            succeeded = true;
            return result;
        } finally {
            await scope.settle(succeeded);
        }
    }

    /**
     * Body of {@link resolveVideoStream}. The caller must already hold the endpoint lock and own the
     * scope: `startStream` calls this directly, under its own lock and scope, to resolve video and
     * audio without releasing the lock between them and the offer round trip that follows, and so
     * that a failure after this returns still gives back what this allocated.
     *
     * The rungs run cheapest-for-everyone first: reuse a stream the camera already produces, then
     * allocate inside the encoder budget the camera has left, then narrow this server's own envelope
     * as far as it goes, then — only with `allowEviction`, which defaults to true — take a stream
     * nobody is using and re-derive the envelope from the freed capacity, and last hand out a stream
     * that fits the caller's bounds but not the envelope, flagged `degraded`. `allowEviction: false`
     * stops before the taking rung, so such a request fails with error 103 rather than costing
     * another controller a stream.
     */
    protected async resolveVideoStreamLocked(
        args: {
            nodeId: NodeId;
            endpointId: EndpointNumber;
            streamUsage: number;
            limits: SelectedVideoCodecLimits;
            hints?: VideoHints;
            allowEviction?: boolean;
        },
        scope: AllocationScope,
    ): Promise<ResolvedStream> {
        const { nodeId, endpointId, streamUsage } = args;
        const allowEviction = args.allowEviction ?? true;
        const codec = args.limits.codec;
        const state = await this.requireState(nodeId, endpointId);
        const deviceCodecs = new Array<number>();
        for (const point of state.rateDistortionTradeOffPoints) {
            if (!deviceCodecs.includes(point.codec)) deviceCodecs.push(point.codec);
        }
        if (deviceCodecs.length > 0 && !deviceCodecs.includes(codec)) {
            throw ServerError.cameraStreamIncompatible({
                reason: "codec",
                track: "video",
                device: deviceCodecs.map(videoCodecName),
                requested: [videoCodecName(codec)],
            });
        }

        const support = overlaySupport(state.features);
        const overlaySelection = resolveOverlays(args.hints ?? {}, support);
        if ("unsupported" in overlaySelection) {
            // No narrowing reaches this: the camera cannot draw an overlay it has no feature for, and
            // sending the field at all is INVALID_COMMAND there (§11.2.8.4, conformance WMARK / OSD).
            throw ServerError.cameraStreamIncompatible({
                reason: "feature",
                track: "video",
                feature: featureName(overlaySelection.unsupported),
                device: deviceCodecs.map(videoCodecName),
                requested: [videoCodecName(codec)],
            });
        }

        const capabilities = {
            sensor:
                state.videoSensorParams === undefined
                    ? { width: 1920, height: 1080 }
                    : { width: state.videoSensorParams.sensorWidth, height: state.videoSensorParams.sensorHeight },
            maxFrameRate: state.videoSensorParams?.maxFps ?? 30,
            minViewport: state.minViewportResolution,
            rateDistortionPoints: state.rateDistortionTradeOffPoints,
            maxNetworkBandwidth: state.maxNetworkBandwidth,
        };

        const selection = computeVideoEnvelope({
            capabilities,
            limits: args.limits,
            hints: args.hints,
            overlays: overlaySelection.overlays,
        });
        if ("unsatisfiable" in selection) {
            throw ServerError.cameraStreamIncompatible({
                reason: selection.unsatisfiable,
                track: "video",
                device: deviceCodecs.map(videoCodecName),
                requested: [videoCodecName(codec)],
                bound: { field: selection.field, requested: selection.requested, limit: selection.limit },
            });
        }
        // The ladder's own copies: freeing a stream updates these arrays, never the state object. The
        // snapshot list carries the streams this server allocated that the camera has not reported yet,
        // because a `camera_snapshot` followed straight away by a `camera_start_stream` is the sequence
        // this whole rung exists for, and the reported view lags it.
        let liveStreams = state.allocatedVideoStreams;
        let liveSnapshotStreams = [
            ...state.allocatedSnapshotStreams,
            ...this.unreportedSnapshotStreams(nodeId, endpointId, state.allocatedSnapshotStreams),
        ];
        // Freeing and the exhaustion report stay on device state: a stream this server has only just
        // allocated has no reference count anyone but the device can state.
        const unreported = this.unreportedVideoStreams(nodeId, endpointId, liveStreams);

        const bounds = videoCallerBounds(args.limits, streamUsage, args.hints);
        // The encoder budget is not applied here: a stream the camera already produces is already
        // spending it, so reusing one costs the budget nothing however wide it is.
        const reused = findReusableVideoStream([...liveStreams, ...unreported], selection.envelope, bounds);
        if (reused !== undefined) {
            return {
                streamId: reused.videoStreamId,
                envelope: envelopeOfVideoStream(reused, selection.envelope.keyFrameInterval),
                reused: true,
                allocatedByUs: this.leaseReusedVideoStream(nodeId, endpointId, reused),
            };
        }

        // Re-derived rather than adjusted after an eviction: the envelope is a function of what the
        // camera has left, and freeing a stream changes that. Both halves count what this server has
        // allocated and the camera has not reported yet, so the sum does not over-state the free budget
        // for the request that follows its own snapshot.
        const budgeted = (
            streams: AllocatedVideoStream[],
            snapshots: AllocatedSnapshotStream[],
        ): BudgetedVideoEnvelope =>
            budgetVideoEnvelope(selection.envelope, {
                maxEncodedPixelRate: state.maxEncodedPixelRate,
                videoStreams: [...streams, ...unreported],
                snapshotStreams: snapshots,
            });
        let budget = budgeted(liveStreams, liveSnapshotStreams);
        let envelope = budget.envelope;

        // A stream the degraded rung could hand out is not a stream to destroy for the same request:
        // taking it and then failing costs the victim's holder an id for a request the victim itself
        // would have served. `chooseEvictionVictim` still applies the reference count and Internal.
        const evictable = liveStreams.filter(stream => !satisfiesVideoCallerBounds(stream, bounds));

        let lastStatus: number | undefined;
        let narrowingsLeft = MAX_NARROWING_ROUNDS;
        const freed = new Array<() => void>();
        const evicted = new Array<number>();
        // Every way out that hands a stream over goes through this, so a stream destroyed on the
        // caller's behalf cannot go unreported by the rung that happened to answer.
        const reporting = (resolved: ResolvedStream): ResolvedStream =>
            evicted.length === 0 ? resolved : { ...resolved, evicted };
        for (let attempt = 1; attempt <= MAX_ALLOCATE_ATTEMPTS; attempt++) {
            try {
                const response = await this.io.invoke({
                    nodeId,
                    endpointId,
                    cluster: "avsm",
                    command: "videoStreamAllocate",
                    fields: {
                        streamUsage,
                        videoCodec: envelope.codec,
                        minFrameRate: envelope.minFrameRate,
                        maxFrameRate: envelope.maxFrameRate,
                        minResolution: envelope.minResolution,
                        maxResolution: envelope.maxResolution,
                        minBitRate: envelope.minBitRate,
                        maxBitRate: envelope.maxBitRate,
                        keyFrameInterval: envelope.keyFrameInterval,
                        ...envelope.overlays,
                    },
                });
                const streamId =
                    typeof response === "object" && response !== null && "videoStreamId" in response
                        ? response.videoStreamId
                        : undefined;
                if (typeof streamId !== "number") {
                    // A stream allocated but answered without its id cannot be named, so nothing
                    // here can give it back. Shared by the audio and snapshot allocates.
                    throw ServerError.sdkStackError("VideoStreamAllocate returned no VideoStreamID");
                }
                const lease = this.recordAllocation(nodeId, endpointId, {
                    kind: "video",
                    streamId,
                    allocatedByUs: true,
                    allocation: allocatedVideoStream(streamId, streamUsage, envelope),
                });
                scope.returnOnFailure(() => this.#deallocate(nodeId, endpointId, lease));
                for (const spend of freed) spend();
                return reporting({
                    streamId,
                    envelope,
                    reused: false,
                    allocatedByUs: true,
                    ...(budget.narrowed === undefined ? {} : { budgetNarrowed: budget.narrowed }),
                });
            } catch (error) {
                if (error instanceof ServerError) throw error;
                lastStatus = deviceStatusOf(error);
                const reaction = ladderReaction(lastStatus);
                if (reaction === "rethrow") throw error;
                if (reaction === "fail-incompatible") {
                    throw ServerError.cameraStreamIncompatible({
                        reason: "bounds",
                        track: "video",
                        device: deviceCodecs.map(videoCodecName),
                        requested: [videoCodecName(codec)],
                        deviceStatus: lastStatus,
                    });
                }
                // Narrowing before eviction: the envelope is the server's own to give up, and a
                // stream with no listeners still belongs to whoever allocated it. Nothing is taken
                // while asking for less might still work. An eviction does not refill these rounds —
                // a camera that refused every narrowing has said that asking smaller is not what it
                // lacks — which is also what keeps the attempt count bounded.
                if (narrowingsLeft > 0) {
                    const narrowed = narrowEnvelope(envelope);
                    if (narrowed !== undefined) {
                        narrowingsLeft -= 1;
                        envelope = narrowed;
                        continue;
                    }
                }
                if (reaction !== "make-room" || !allowEviction) break;
                // Nothing is taken on the last attempt: the allocate that would have spent the
                // capacity is outside the loop, so the victim would be destroyed for nothing.
                if (attempt === MAX_ALLOCATE_ATTEMPTS) break;
                // Our own snapshot stream goes first, and the video rung then takes our own video
                // streams before any foreign one: one rule for both rungs, stated on
                // `chooseEvictionVictim`. The camera's StreamUsagePriorities ranks video usages and
                // says nothing about snapshot streams, so there is no ranking to fold this into, and
                // the next camera_snapshot allocates one again from the camera's own capabilities.
                const snapshotRoom = await this.freeOwnSnapshotStream(
                    nodeId,
                    endpointId,
                    liveSnapshotStreams,
                    state.maxEncodedPixelRate,
                    scope,
                );
                if (snapshotRoom !== undefined) {
                    // Out of the candidates whether the camera freed it or refused: strictly shrinking
                    // is what keeps the rung from choosing the same stream again, and a refusal it sent
                    // once it will send again.
                    liveSnapshotStreams = liveSnapshotStreams.filter(
                        stream => stream.snapshotStreamId !== snapshotRoom.streamId,
                    );
                    if (snapshotRoom.freed) {
                        freed.push(snapshotRoom.spend);
                        budget = budgeted(liveStreams, liveSnapshotStreams);
                        envelope = budget.envelope;
                        continue;
                    }
                }
                const madeRoom = await this.freeAnUnreferencedVideoStream(
                    nodeId,
                    endpointId,
                    evictable.filter(stream => liveStreams.includes(stream)),
                    state.streamUsagePriorities,
                    scope,
                    envelope.keyFrameInterval,
                );
                if (madeRoom === undefined) break;
                // Strictly shrinking, so eviction cannot keep finding the same victim.
                liveStreams = liveStreams.filter(stream => stream.videoStreamId !== madeRoom.streamId);
                freed.push(madeRoom.spend);
                evicted.push(madeRoom.streamId);
                budget = budgeted(liveStreams, liveSnapshotStreams);
                envelope = budget.envelope;
            }
        }

        // Last rung: hand out a stream that is in use, giving up the computed envelope and nothing
        // the caller stated.
        const degraded = findDegradedVideoStream([...liveStreams, ...unreported], bounds);
        if (degraded !== undefined) {
            return reporting({
                streamId: degraded.videoStreamId,
                envelope: envelopeOfVideoStream(degraded, envelope.keyFrameInterval),
                reused: true,
                degraded: true,
                allocatedByUs: this.leaseReusedVideoStream(nodeId, endpointId, degraded),
            });
        }

        if (ladderReaction(lastStatus) === "narrow") {
            throw ServerError.cameraStreamIncompatible({
                reason: "bounds",
                track: "video",
                device: deviceCodecs.map(videoCodecName),
                requested: [videoCodecName(codec)],
                deviceStatus: lastStatus,
            });
        }
        throw ServerError.cameraResourceExhausted({
            allocated: [
                ...liveStreams.map(stream => occupyingStream("video", stream.videoStreamId, stream.referenceCount)),
                // The ladder's own list, not the state's: a stream this request took no longer holds
                // anything, and naming it would send the client to release an id the camera has freed.
                ...encoderHoldingSnapshotStreams(liveSnapshotStreams),
            ],
            maxConcurrentEncoders: state.maxConcurrentEncoders,
            maxEncodedPixelRate: state.maxEncodedPixelRate,
        });
    }

    /** `audio` takes the three statements `camera_start_stream`'s own argument takes. */
    async resolveAudioStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        sdp?: SdpVideoConstraints;
        audio?: AudioHints | false;
    }): Promise<ResolvedStream | undefined> {
        const request = trackRequest(args.audio);
        if (request.state === "declined") return undefined;
        return this.withEndpointLock(args.nodeId, args.endpointId, () =>
            this.withAllocationScope(async scope => {
                const outcome = await this.resolveAudioStreamLocked({ ...args, hints: statedHints(request) }, scope);
                return this.resolveTrack("audio", args.nodeId, request, outcome);
            }),
        );
    }

    /**
     * Body of {@link resolveAudioStream}. The caller must already hold the endpoint lock and own the
     * scope; see {@link resolveVideoStreamLocked}.
     *
     * Audio has no narrowing ladder: a camera either supports the codec or it does not.
     *
     * The dead ends a video-only session is an acceptable answer to are reported as
     * {@link TrackOutcome}s for {@link resolveTrack} to decide on. Two are not, and throw from here:
     * a caller value the camera cannot serve, which only a caller that stated one can reach, and a
     * typed failure raised under the allocate, which already says what happened. A value the caller
     * stated is never substituted either way: a sample rate or channel count the camera cannot serve
     * fails before anything is asked of the device, and a reused stream must already carry the bit
     * rate, channel count, sample rate and codec the caller asked for.
     */
    protected async resolveAudioStreamLocked(
        args: {
            nodeId: NodeId;
            endpointId: EndpointNumber;
            streamUsage: number;
            sdp?: SdpVideoConstraints;
            hints?: AudioHints;
        },
        scope: AllocationScope,
    ): Promise<TrackOutcome> {
        const { nodeId, endpointId, streamUsage } = args;
        const state = await this.requireState(nodeId, endpointId);
        const requestedCodecs = args.hints?.codecs ?? new Array<string>();
        // The peer's own refusal outranks anything the camera can offer, and no different request
        // changes it, which is what `capability` reports. Answering it here rather than by narrowing
        // the codec set keeps the caller from being sent after the camera's codec list.
        const refusal = mediaRefusal(args.sdp, "audio");
        if (refusal !== undefined) {
            logger.notice(
                `Node ${nodeId} endpoint ${endpointId}: the offer ${refusalText(refusal, "audio")}, so no audio stream is allocated for it`,
            );
            return {
                unavailable: ServerError.cameraStreamIncompatible({
                    reason: "offer",
                    track: "audio",
                    device: new Array<string>(),
                    requested: requestedCodecs,
                }),
            };
        }
        const microphone = state.microphoneCapabilities;
        const lacksAudio = lacksFeature(state.features, "audio");
        if (
            lacksAudio ||
            microphone === undefined ||
            microphone.supportedCodecs.length === 0 ||
            microphone.supportedSampleRates.length === 0 ||
            microphone.supportedBitDepths.length === 0
        ) {
            // The feature is read beside the attribute for two reasons: the refusal can name it, and
            // a camera that reports MicrophoneCapabilities without advertising the feature is refused
            // here rather than at an `AudioStreamAllocate` that is not in its AcceptedCommandList.
            return {
                unavailable: ServerError.cameraStreamIncompatible(
                    lacksAudio
                        ? {
                              reason: "feature",
                              track: "audio",
                              feature: featureName("audio"),
                              device: new Array<string>(),
                              requested: requestedCodecs,
                          }
                        : {
                              // The camera advertises Audio and reports no MicrophoneCapabilities this
                              // server can build a stream from, which no argument of the request changes.
                              reason: "capability",
                              track: "audio",
                              device: new Array<string>(),
                              requested: requestedCodecs,
                          },
                ),
            };
        }
        const deviceCodecs = microphone.supportedCodecs.map(audioCodecName);

        const selection = computeAudioEnvelope({
            capabilities: microphone,
            sdp: args.sdp,
            hints: args.hints,
        });
        if ("unsatisfiable" in selection) {
            throw ServerError.cameraStreamIncompatible({
                reason: "bounds",
                track: "audio",
                device: deviceCodecs,
                requested: requestedCodecs,
                bound: { field: selection.field, requested: selection.requested, limit: selection.limit },
            });
        }
        const envelope = selection.envelope;
        if (envelope === undefined) {
            // `device` is the camera's own list rather than what the narrowing left, which is empty
            // here by definition: a client told the camera supports nothing would go looking at the
            // camera, when what ruled the codecs out is its own offer or its own codec list.
            return {
                unavailable: ServerError.cameraStreamIncompatible({
                    reason: "codec",
                    track: "audio",
                    device: deviceCodecs,
                    requested: requestedCodecs,
                }),
            };
        }

        const bounds: AudioCallerBounds = { ...args.hints, streamUsage };
        const existing = [
            ...state.allocatedAudioStreams,
            ...this.unreportedAudioStreams(nodeId, endpointId, state.allocatedAudioStreams),
        ].find(
            stream =>
                satisfiesAudioCallerBounds(stream, bounds) &&
                stream.audioCodec === envelope.codec &&
                stream.channelCount === envelope.channelCount &&
                stream.sampleRate === envelope.sampleRate,
        );
        if (existing !== undefined) {
            return {
                stream: {
                    streamId: existing.audioStreamId,
                    envelope: envelopeOfAudioStream(existing),
                    reused: true,
                    allocatedByUs: this.leaseReusedAudioStream(nodeId, endpointId, existing),
                },
            };
        }

        try {
            const response = await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "audioStreamAllocate",
                fields: {
                    streamUsage,
                    audioCodec: envelope.codec,
                    channelCount: envelope.channelCount,
                    sampleRate: envelope.sampleRate,
                    bitRate: envelope.bitRate,
                    bitDepth: envelope.bitDepth,
                },
            });
            const streamId =
                typeof response === "object" && response !== null && "audioStreamId" in response
                    ? response.audioStreamId
                    : undefined;
            if (typeof streamId !== "number") {
                return { unavailable: ServerError.sdkStackError("AudioStreamAllocate returned no AudioStreamID") };
            }
            const lease = this.recordAllocation(nodeId, endpointId, {
                kind: "audio",
                streamId,
                allocatedByUs: true,
                allocation: allocatedAudioStream(streamId, streamUsage, envelope),
            });
            scope.returnOnFailure(() => this.#deallocate(nodeId, endpointId, lease));
            return { stream: { streamId, envelope, reused: false, allocatedByUs: true } };
        } catch (error) {
            if (error instanceof ServerError) throw error;
            const status = deviceStatusOf(error);
            if (ladderReaction(status) === "rethrow") return { unavailable: error };
            if (ladderReaction(status) === "make-room") {
                return {
                    unavailable: ServerError.cameraResourceExhausted({
                        allocated: state.allocatedAudioStreams.map(stream =>
                            occupyingStream("audio", stream.audioStreamId, stream.referenceCount),
                        ),
                        maxConcurrentEncoders: state.maxConcurrentEncoders,
                        maxEncodedPixelRate: state.maxEncodedPixelRate,
                    }),
                };
            }
            return {
                unavailable: ServerError.cameraStreamIncompatible({
                    reason: "bounds",
                    track: "audio",
                    device: deviceCodecs,
                    requested: requestedCodecs,
                    deviceStatus: status,
                }),
            };
        }
    }

    /**
     * Deallocate one unreferenced video stream from `streams` and report its id, or `undefined` if
     * nothing was freed. `streams` is a plain array and the caller's `CameraState` (which may be a
     * cached or subscription-backed snapshot) is never written to.
     *
     * The victim is chosen by {@link chooseEvictionVictim}, which takes this server's own streams
     * before any foreign one and orders each side by the camera's ranking. A stream this server did not
     * allocate may be taken at all because the cluster protects a stream by use and by Internal, not by
     * who created it; it is taken only once nothing of this server's own is left to give up, and it is
     * logged, since the spec recommends commissioners pre-allocate (§11.2.1.1) and such a stream may be
     * deliberate.
     *
     * The freeing is registered with `scope` so a request that never uses the capacity it bought puts
     * an equivalent stream back rather than leaving the camera one stream poorer for nothing. The
     * caller reports the spending through `spend` once an allocate has consumed the capacity, and the
     * scope restores unless that request then also succeeded — a throw after the allocate, or a
     * success reached by reusing a stream that was already there, both restore. The replacement is a
     * new stream under a new id, not the one that was taken: a controller holding the old id is not
     * given it back by the restore, and the camera no longer knows that id at all.
     */
    protected async freeAnUnreferencedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        streams: AllocatedVideoStream[],
        priorities: number[],
        scope: AllocationScope,
        keyFrameInterval: number,
    ): Promise<{ streamId: number; spend: () => void } | undefined> {
        const ours = (stream: AllocatedVideoStream): boolean =>
            this.ownsStream(nodeId, endpointId, "video", stream.videoStreamId);
        const victim = chooseEvictionVictim(streams, priorities, ours);
        if (victim === undefined) return undefined;

        if (!ours(victim)) {
            logger.notice(
                `Deallocating ${streamUsageName(victim.streamUsage)} video stream ${victim.videoStreamId} on node ${nodeId}: it has no listeners and the camera has no capacity left, but this server did not allocate it. The controller that did holds an id the camera will no longer know`,
            );
        }
        try {
            await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "videoStreamDeallocate",
                fields: { videoStreamId: victim.videoStreamId },
            });
        } catch (error) {
            logger.info(`Could not deallocate video stream ${victim.videoStreamId}:`, error);
            return undefined;
        }
        this.dropLease(nodeId, endpointId, "video", victim.videoStreamId);
        this.#announce(this.events.streamEvicted, {
            nodeId,
            endpointId,
            kind: "video",
            streamId: victim.videoStreamId,
        });
        const spend = scope.returnUnlessSpent(() =>
            this.#restoreFreedVideoStream(nodeId, endpointId, victim, keyFrameInterval).catch(error => {
                logger.warn(
                    `Could not allocate a replacement for video stream ${victim.videoStreamId} on node ${nodeId}, which was deallocated to make room the request did not use; the camera is one stream poorer:`,
                    error,
                );
            }),
        );
        return { streamId: victim.videoStreamId, spend };
    }

    /**
     * Deallocate one snapshot stream this server allocated, and report which stream it dealt with.
     *
     * `undefined` means there was none worth taking; `freed: false` means one was chosen and the camera
     * refused the deallocate. The caller drops the id from its candidate list either way, so a refusal
     * is not sent again on the next attempt, and only a real freeing is worth a retry. `streams` is a
     * plain array and the caller's `CameraState` is never written to.
     *
     * {@link chooseSnapshotStreamToFree} decides which, from the streams this server's leases claim and
     * whose recorded parameters the camera's report still matches: a camera reissues an id it has freed,
     * and a lease the camera has never confirmed lives for the process run, so the id alone could name
     * another controller's stream by coincidence. Everything else the camera reports belongs to somebody
     * else and is left to the video rung's own ordering.
     *
     * The freeing is registered with `scope` for the video rung's reason: a request that never spends
     * the capacity puts an equivalent stream back rather than leaving the camera one stream poorer for
     * nothing. It is the parameters that come back and not the stream — the camera issues a new id, as
     * it does for a restored video stream.
     */
    protected async freeOwnSnapshotStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        streams: AllocatedSnapshotStream[],
        maxEncodedPixelRate: number | undefined,
        scope: AllocationScope,
    ): Promise<{ streamId: number; freed: boolean; spend: () => void } | undefined> {
        const ours = streams.filter(stream => this.ownsSnapshotStream(nodeId, endpointId, stream));
        const victim = chooseSnapshotStreamToFree(ours, { maxEncodedPixelRate });
        if (victim === undefined) return undefined;
        const { snapshotStreamId } = victim;
        try {
            await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "snapshotStreamDeallocate",
                fields: { snapshotStreamId },
            });
        } catch (error) {
            // NotFound is the camera stating it has no such stream, which is the fact the lease claimed;
            // every other status leaves the lease standing, as the other give-back paths do.
            if (deviceStatusOf(error) === Status.NotFound) {
                this.dropLease(nodeId, endpointId, "snapshot", snapshotStreamId);
            }
            logger.info(`Could not deallocate snapshot stream ${snapshotStreamId}:`, error);
            return { streamId: snapshotStreamId, freed: false, spend: () => {} };
        }
        this.dropLease(nodeId, endpointId, "snapshot", snapshotStreamId);
        logger.notice(
            `Deallocated snapshot stream ${snapshotStreamId} on node ${nodeId}, which this server allocated and nothing references, to make room for a video stream`,
        );
        this.#announce(this.events.streamEvicted, { nodeId, endpointId, kind: "snapshot", streamId: snapshotStreamId });
        const spend = scope.returnUnlessSpent(() =>
            this.#restoreFreedSnapshotStream(nodeId, endpointId, victim).catch(error => {
                logger.warn(
                    `Could not allocate a replacement for snapshot stream ${snapshotStreamId} on node ${nodeId}, which was deallocated to make room the request did not use; the camera is one stream poorer:`,
                    error,
                );
            }),
        );
        return { streamId: snapshotStreamId, freed: true, spend };
    }

    /**
     * Whether a snapshot stream the camera reports is one this server allocated in this process run.
     *
     * Stricter than {@link ownsStream} on the id alone: the lease has to carry the parameters it was
     * allocated with, and the camera has to still report those. A camera reissues an id it has freed and
     * a lease it never confirmed lives for the process run, so an id match on its own can name another
     * controller's stream — which this rung would then destroy while reporting it as ours.
     */
    protected ownsSnapshotStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        reported: AllocatedSnapshotStream,
    ): boolean {
        const lease = this.leaseFor(nodeId, endpointId, "snapshot", reported.snapshotStreamId);
        if (lease?.kind !== "snapshot" || !lease.allocatedByUs) return false;
        const allocated = lease.allocation;
        return (
            allocated.imageCodec === reported.imageCodec &&
            allocated.minResolution.width === reported.minResolution.width &&
            allocated.minResolution.height === reported.minResolution.height &&
            allocated.maxResolution.width === reported.maxResolution.width &&
            allocated.maxResolution.height === reported.maxResolution.height
        );
    }

    /**
     * Allocate a snapshot stream with the parameters of one the make-room rung took, for a request that
     * did not end up using the capacity that taking it bought.
     *
     * The counterpart of {@link #restoreFreedVideoStream} and not an undo for the same reason: the
     * camera issues a new `SnapshotStreamID`, so what comes back is the camera's capacity to serve a
     * snapshot of that range, not the stream a client holds the id of. `frameRate` is what the struct
     * reports (§11.2.6.13.3) and `MaxFrameRate` is what the allocate takes.
     */
    async #restoreFreedSnapshotStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        freed: AllocatedSnapshotStream,
    ): Promise<void> {
        const response = await this.io.invoke({
            nodeId,
            endpointId,
            cluster: "avsm",
            command: "snapshotStreamAllocate",
            fields: {
                imageCodec: freed.imageCodec,
                maxFrameRate: freed.frameRate,
                minResolution: freed.minResolution,
                maxResolution: freed.maxResolution,
                ...freed.overlays,
            },
        });
        const snapshotStreamId =
            typeof response === "object" && response !== null && "snapshotStreamId" in response
                ? response.snapshotStreamId
                : undefined;
        if (typeof snapshotStreamId !== "number") {
            throw ServerError.sdkStackError("SnapshotStreamAllocate returned no SnapshotStreamID");
        }
        this.recordAllocation(nodeId, endpointId, {
            kind: "snapshot",
            streamId: snapshotStreamId,
            allocatedByUs: true,
            allocation: { ...freed, snapshotStreamId, referenceCount: 0 },
        });
        logger.notice(
            `Allocated snapshot stream ${snapshotStreamId} on node ${nodeId} with the parameters of stream ${freed.snapshotStreamId}, which was deallocated to make room that the request did not end up using`,
        );
    }

    /**
     * Allocate a stream with the parameters of one the make-room rung took, for a request that did
     * not end up using the capacity that taking it bought.
     *
     * This does not undo the eviction. The camera issues a new VideoStreamID, and a controller
     * holding the old one holds an id the camera has forgotten; what is restored is the camera's
     * capacity to serve a stream of that range and usage, not the stream that was taken. It is worth
     * doing anyway: leaving the camera one stream poorer for a request that bought nothing costs
     * every later allocation, on hardware where an encoder is the scarce resource, and the parameters
     * are the only part of the original this server can put back.
     *
     * The replacement is this server's to give back, whoever allocated the original: this server
     * allocated it, and a stream nothing records as releasable is the leak the lease map prevents.
     * `keyFrameInterval` is not among the fields the device reports back, so the replacement carries
     * the one the failed request was working with.
     */
    async #restoreFreedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        freed: AllocatedVideoStream,
        keyFrameInterval: number,
    ): Promise<void> {
        const envelope = envelopeOfVideoStream(freed, keyFrameInterval);
        const response = await this.io.invoke({
            nodeId,
            endpointId,
            cluster: "avsm",
            command: "videoStreamAllocate",
            fields: {
                streamUsage: freed.streamUsage,
                videoCodec: envelope.codec,
                minFrameRate: envelope.minFrameRate,
                maxFrameRate: envelope.maxFrameRate,
                minResolution: envelope.minResolution,
                maxResolution: envelope.maxResolution,
                minBitRate: envelope.minBitRate,
                maxBitRate: envelope.maxBitRate,
                keyFrameInterval: envelope.keyFrameInterval,
                ...envelope.overlays,
            },
        });
        const streamId =
            typeof response === "object" && response !== null && "videoStreamId" in response
                ? response.videoStreamId
                : undefined;
        if (typeof streamId !== "number") {
            throw ServerError.sdkStackError("VideoStreamAllocate returned no VideoStreamID");
        }
        this.recordAllocation(nodeId, endpointId, {
            kind: "video",
            streamId,
            allocatedByUs: true,
            allocation: allocatedVideoStream(streamId, freed.streamUsage, envelope),
        });
        logger.notice(
            `Allocated video stream ${streamId} on node ${nodeId} with the parameters of stream ${freed.videoStreamId}, which was deallocated to make room that the request did not end up using. The old id is gone; a controller still holding it must allocate again`,
        );
    }

    /**
     * The `SolicitOffer` / `ProvideOffer` that establishes the session.
     *
     * Separate from the rest of {@link #establishSession} only so the device's refusal has one place
     * to be read: a privacy switch is the one refusal here whose reason this server can name.
     */
    async #invokeEstablishingOffer(
        pending: PendingSession,
        args: StartStreamArgs,
        video: ResolvedStream | undefined,
        audio: ResolvedStream | undefined,
    ): Promise<unknown> {
        const { nodeId, endpointId, streamUsage } = args;
        try {
            return await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "webrtcProvider",
                command: args.sdp === undefined ? "solicitOffer" : "provideOffer",
                // The registration has to hold the id before the local requestor can route an `End`
                // for it, which is the only point at which an end of this session can be told apart
                // from an end of any other session on this camera.
                sessionEstablishing: webRtcSessionId => this.#sessions.establishing(pending, webRtcSessionId),
                fields: {
                    ...(args.sdp === undefined ? {} : { sdp: args.sdp }),
                    streamUsage,
                    ...(video === undefined ? {} : { videoStreams: [video.streamId] }),
                    ...(audio === undefined ? {} : { audioStreams: [audio.streamId] }),
                    ...(args.iceServers === undefined ? {} : { iceServers: args.iceServers }),
                    ...(args.iceTransportPolicy === undefined ? {} : { iceTransportPolicy: args.iceTransportPolicy }),
                    metadataEnabled: args.metadataEnabled === true,
                },
            });
        } catch (error) {
            throw await this.privacyFailure(nodeId, endpointId, error, privacy =>
                sessionPrivacyModes(privacy, streamUsage),
            );
        }
    }

    async startStream(args: StartStreamArgs): Promise<StartStreamResult> {
        const { nodeId, endpointId } = args;
        const sdp = args.sdp === undefined ? undefined : parseSdpVideoConstraints(args.sdp);
        // One lock for resolution through the offer round trip: the device only raises ReferenceCount
        // at session establishment, so a stream resolved here reads as unreferenced at the device until
        // the response below lands. Releasing the lock in between would let a concurrent RESOURCE_EXHAUSTED
        // on this endpoint free or hand out the very stream this call is mid-way through using.
        // Before the first await: a connection closing from here on must claim this registration
        // rather than find nothing and leave the session it is about to create unowned.
        const pending = this.#sessions.begin(nodeId, endpointId, args.connectionId);
        try {
            return await this.withEndpointLock(nodeId, endpointId, async () => {
                const state = await this.requireStreamingState(nodeId, endpointId);
                return this.withAllocationScope(scope => this.#establishSession(pending, args, state, sdp, scope));
            });
        } finally {
            this.#sessions.finish(pending);
        }
    }

    /**
     * Body of {@link startStream}, inside the endpoint lock, the registration and the scope.
     *
     * Nothing here gives anything back: every session and every allocation is registered with `scope`
     * where it happens, and {@link withAllocationScope} returns what this call may not keep on every
     * exit it has.
     */
    async #establishSession(
        pending: PendingSession,
        args: StartStreamArgs,
        state: CameraState,
        sdp: SdpVideoConstraints | undefined,
        scope: AllocationScope,
    ): Promise<StartStreamResult> {
        const { nodeId, endpointId, streamUsage } = args;
        if (
            sdp?.wantsTalkback === true &&
            (state.twoWayTalkSupport ?? CameraAvStreamManagement.TwoWayTalkSupportType.NotSupported) ===
                CameraAvStreamManagement.TwoWayTalkSupportType.NotSupported
        ) {
            logger.notice(
                `Node ${nodeId} endpoint ${endpointId} states no TwoWayTalkSupport; the audio the offer asks to send will not reach the camera`,
            );
        }
        const videoRequest = trackRequest(args.video);
        const audioRequest = trackRequest(args.audio);
        let video: ResolvedStream | undefined;
        let audio: ResolvedStream | undefined;

        if (videoRequest.state !== "declined") {
            const videoHints = statedHints(videoRequest);
            let outcome: TrackOutcome;
            const refusal = mediaRefusal(sdp, "video");
            if (refusal !== undefined) {
                // The peer rejected the section, will not receive on it, or never offered one, so
                // there is nothing to allocate for: a stream put in the answer would hold an encoder
                // and a ReferenceCount for media that can never reach it. Same statement, same
                // answer as the audio half reads for its own section.
                logger.notice(
                    `Node ${nodeId} endpoint ${endpointId}: the offer ${refusalText(refusal, "video")}, so no video stream is allocated for it`,
                );
                outcome = {
                    unavailable: ServerError.cameraStreamIncompatible({
                        reason: "offer",
                        track: "video",
                        device: new Array<string>(),
                        requested: videoHints?.codecs ?? new Array<string>(),
                    }),
                };
            } else if (lacksFeature(state.features, "video")) {
                // No ladder rung recovers from this: `VideoStreamAllocate` is not in such a camera's
                // AcceptedCommandList at all, so it answers UnsupportedCommand to every narrowing.
                outcome = {
                    unavailable: ServerError.cameraStreamIncompatible({
                        reason: "feature",
                        track: "video",
                        feature: featureName("video"),
                        device: new Array<string>(),
                        requested: videoHints?.codecs ?? new Array<string>(),
                    }),
                };
            } else {
                const codecs = state.rateDistortionTradeOffPoints.map(point => point.codec);
                const codec = preferredVideoCodec(codecs, sdp, videoHints?.codecs);
                outcome = {
                    stream: await this.resolveVideoStreamLocked(
                        {
                            nodeId,
                            endpointId,
                            streamUsage,
                            limits: videoCodecLimits(sdp, codec),
                            hints: videoHints,
                            allowEviction: args.allowEviction,
                        },
                        scope,
                    ),
                };
            }
            video = this.resolveTrack("video", nodeId, videoRequest, outcome);
        }

        if (audioRequest.state !== "declined") {
            const outcome = await this.resolveAudioStreamLocked(
                {
                    nodeId,
                    endpointId,
                    streamUsage,
                    sdp,
                    hints: statedHints(audioRequest),
                },
                scope,
            );
            audio = this.resolveTrack("audio", nodeId, audioRequest, outcome);
        }

        // Both tracks absent means nothing for the offer to carry: every track the caller stated
        // resolved, and what is left — declined tracks, and tracks left to the server that no stream
        // could be found for — adds up to no media at all.
        if (video === undefined && audio === undefined) {
            throw ServerError.cameraStreamIncompatible({
                reason: "no_media",
                device: new Array<string>(),
                requested: new Array<string>(),
            });
        }

        const response = await this.#invokeEstablishingOffer(pending, args, video, audio);

        const webRtcSessionId =
            typeof response === "object" && response !== null && "webRtcSessionId" in response
                ? response.webRtcSessionId
                : undefined;
        if (typeof webRtcSessionId !== "number") {
            // A session whose id never reaches here can never be ended, so its streams stay at
            // ReferenceCount > 0 and the deallocates registered above are refused.
            throw ServerError.sdkStackError("Provider returned no WebRTCSessionID");
        }

        const session: ManagedSession = {
            webRtcSessionId,
            nodeId,
            endpointId,
            connectionId: args.connectionId,
            videoStreamIds: video === undefined ? new Array<number>() : [video.streamId],
            audioStreamIds: audio === undefined ? new Array<number>() : [audio.streamId],
        };
        scope.returnOnFailure(async () => {
            // No client asked for this: what ends a session here is the closing connection claiming
            // this registration, or the camera having ended it already. Nothing is announced either
            // way, because the session never reached the registry.
            await this.#endSession(session, undefined);
        });
        const refusal = this.#sessions.track(pending, session);
        if (refusal !== undefined) {
            throw ServerError.sdkStackError(
                refusal === "claimed"
                    ? `WebRTC session ${webRtcSessionId} was ended: the requesting connection closed while the camera was establishing it`
                    : `WebRTC session ${webRtcSessionId} was ended before this server could track it, so it is no longer usable`,
            );
        }

        return {
            webRtcSessionId,
            mode: args.sdp === undefined ? "solicit_offer" : "provide_offer",
            video,
            audio,
        };
    }

    /**
     * Give a stream back to the device on a path that reports nothing to the caller.
     *
     * The lease goes when the camera is done with the stream — it accepted the deallocate, or
     * answered `NOT_FOUND` for an id it does not have (§11.2.8.7.2, §11.2.8.3.2, §11.2.8.10.2), which
     * says the same thing about it. Any other failure is logged and not raised: the lease survives
     * it, so `camera_release_stream` and the allocation ladder can still reach the stream, and the
     * caller sees the error that started the teardown rather than this one. Every call site is a
     * failure return, whose answer names no stream id, which is why nothing here is reported.
     */
    async #deallocate(nodeId: NodeId, endpointId: EndpointNumber, lease: StreamLease): Promise<void> {
        const { kind, streamId } = lease;
        const { command, fields } = deallocateCall(kind, streamId);
        try {
            await this.io.invoke({ nodeId, endpointId, cluster: "avsm", command, fields });
        } catch (error) {
            if (deviceStatusOf(error) !== Status.NotFound) {
                logger.warn(`Could not give back ${kind} stream ${streamId} on node ${nodeId}:`, error);
                return;
            }
        }
        this.#dropLeaseIfCurrent(nodeId, endpointId, lease);
    }

    /**
     * The one path that ends a session: `EndSession` on the device, then the registry entry.
     *
     * Reports whether the device still had the session. The order is what keeps the two in step. A
     * failed invoke keeps the entry, so a later stop, disconnect or shutdown still reaches the
     * session; dropping first would leave the device holding a session nothing can name, pinning its
     * streams at `ReferenceCount > 0` for good.
     *
     * `NotFound` is the exception, and {@link invokeEndSession} is where that is decided for every
     * route that ends a session: the entry then names nothing the device will act on, and this call
     * ended nothing.
     */
    async #endSession(session: ManagedSession, requestedBy: string | undefined): Promise<boolean> {
        const { nodeId, endpointId, webRtcSessionId } = session;
        try {
            await invokeEndSession(
                () =>
                    this.io.invoke({
                        nodeId,
                        endpointId,
                        cluster: "webrtcProvider",
                        command: "endSession",
                        fields: { webRtcSessionId, reason: WEBRTC_END_REASON_USER_HANGUP },
                    }),
                async () => {
                    this.#sessions.forgetEstablished(session, requestedBy);
                },
            );
        } catch (error) {
            if (!deviceForgotSession(error)) throw error;
            logger.info(
                `Node ${nodeId} did not resolve WebRTC session ${webRtcSessionId} (NotFound); dropping the server's tracking of it`,
            );
            return false;
        }
        return true;
    }

    /**
     * Ends the session on the device. The allocation is deliberately kept.
     *
     * Returns whether this call ended a live session: false for an id the device answers `NotFound`
     * for, which is one it cannot resolve to a session of its own with this server. A failed
     * `EndSession` is raised, not reported as a stop, including when another path sent the
     * `EndSession` this call joined. An id this process run tracks goes through the registry, so it
     * shares one `EndSession` with every other path that reaches the same session; any other id is
     * sent to the device as it stands, since `webRtcSessionId` is allocated per provider and names a
     * session only together with the node and endpoint it was issued on.
     */
    async stopStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        requestedBy?: string,
    ): Promise<boolean> {
        const session = this.#sessions.get(nodeId, endpointId, webRtcSessionId);
        if (session !== undefined) {
            return this.#sessions.releaseOnce(session, held => this.#endSession(held, requestedBy));
        }
        return this.#endUntrackedSession(nodeId, endpointId, webRtcSessionId, requestedBy);
    }

    /**
     * End a session on the camera that this process run has no record of.
     *
     * The camera's `CurrentSessions` is the record of which sessions exist; this server's registry is
     * an in-memory one that a restart takes with it, and only `EndSession` decrements a stream's
     * `ReferenceCount`, so a session no record names still holds its streams. The invoke goes out
     * unconditionally because `EndSession` (§11.5.6.7.3) fails `NOT_FOUND` unless the accessing fabric
     * and `PeerNodeID` match the stored entry: whatever id a client passes, the camera ends a session
     * of this server's or none. That check is about the server, not the connection — any connection
     * can end any of this server's sessions here, as it already can for a tracked one.
     */
    async #endUntrackedSession(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        requestedBy: string | undefined,
    ): Promise<boolean> {
        try {
            await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "webrtcProvider",
                command: "endSession",
                fields: { webRtcSessionId, reason: WEBRTC_END_REASON_USER_HANGUP },
            });
        } catch (error) {
            if (!deviceForgotSession(error)) throw error;
            logger.info(
                `Node ${nodeId} holds no WebRTC session ${webRtcSessionId} for this server (NotFound); nothing was ended`,
            );
            return false;
        }
        // Every path on which this server learns a session has ended goes through the registry, even
        // one that had no entry to drop: a registration in flight may have been answered with this id,
        // and `forget` is where that is remembered so `track` refuses the session it is about to hand
        // back as live.
        this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
        this.#announceUntrackedEnd(nodeId, endpointId, webRtcSessionId, requestedBy);
        return true;
    }

    /**
     * Report a session this server ended but holds no record of.
     *
     * Announced with no owner, which every route reads as "tell everyone": nothing names the
     * connection driving such a session, and the client that can least afford to be left guessing is
     * the one that opened it on the raw route. Only a camera that answered that it held the session
     * reaches here: announcing its `NotFound` would report a session that never existed.
     */
    #announceUntrackedEnd(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        requestedBy: string | undefined,
    ): void {
        this.#announce(this.events.sessionEnded, { nodeId, endpointId, webRtcSessionId, requestedBy });
    }

    /**
     * Stop tracking a session the peer ended, without invoking `EndSession` for it.
     *
     * The peer's `End` notification leaves the device with no session. Keeping the entry would make
     * `camera_stop_stream` report `ended: true` for a session that ended minutes earlier, and shutdown
     * send `EndSession` for a dead id.
     *
     * Nothing is announced: round 18 routes the peer's `End` to the owner as a `webrtc_callback` event,
     * and a second report of one fact has no order against the first. A client's own `EndSession` goes
     * through {@link endedByClient} instead, which does announce.
     */
    forgetSession(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): boolean {
        return this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
    }

    /**
     * Drop the record of a session a client's own `EndSession` has dealt with, and report it.
     *
     * The generic `device_command` route sends that command itself, so this is where its session ends
     * as far as this server is concerned — the counterpart of what {@link stopStream} does on the
     * managed route, and announced by the same two rules. A session an entry names is announced to its
     * owner, naming `requestedBy` so the asking connection is not told what its own command response
     * already says. A session no entry names is announced with no owner, which every route reads as
     * "tell everyone", because the client that opened such a session on the raw route is the one that
     * cannot otherwise learn it is gone.
     *
     * `deviceHeldSession` is whether the camera answered that it had the session. Its `NotFound` still
     * drops an entry — the entry named nothing the camera will act on — and is still announced to that
     * entry's owner, whose session is gone either way. What it must not do is announce an id **no**
     * entry named: that would report a session this server never had and the camera denies.
     */
    endedByClient(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
        requestedBy: string,
        deviceHeldSession: boolean,
    ): boolean {
        const session = this.#sessions.get(nodeId, endpointId, webRtcSessionId);
        if (session !== undefined) return this.#sessions.forgetEstablished(session, requestedBy);
        this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
        if (deviceHeldSession) this.#announceUntrackedEnd(nodeId, endpointId, webRtcSessionId, requestedBy);
        return false;
    }

    /**
     * Which WebSocket connections may receive one session's WebRTC signalling.
     *
     * @see CameraSessionRegistry.signallingOwners for what an absent answer means.
     */
    signallingOwners(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        webRtcSessionId: number,
    ): ReadonlySet<string> | undefined {
        return this.#sessions.signallingOwners(nodeId, endpointId, webRtcSessionId);
    }

    /**
     * End every session a closing connection owned.
     *
     * The device only decrements ReferenceCount on EndSession, so a session left open pins its
     * streams permanently — VideoStreamDeallocate then answers INVALID_IN_STATE for good.
     */
    async releaseConnection(connectionId: string): Promise<void> {
        await this.#releaseSessions(scope => scope.connectionId === connectionId);
    }

    /**
     * Ends every session this server currently tracks, regardless of owning connection.
     *
     * Used at shutdown: a session still open when the process stops otherwise pins its streams at a
     * non-zero reference count forever, since `ReferenceCount` is device-maintained and only `EndSession`
     * decrements it — the same failure `releaseConnection` exists to prevent, by a different exit.
     */
    async stopAll(): Promise<void> {
        await this.#releaseSessions(() => true);
    }

    /**
     * End every session in scope, including the ones still being established.
     *
     * A claimed registration ends itself inside `startStream`; this waits for that to happen, so
     * shutdown does not close the device connections out from under an `EndSession` it caused — for
     * at most {@link DEVICE_CLEANUP_BUDGET_MS}, since a camera that has stopped answering is a common
     * reason to be shutting down. The sessions are ended concurrently: they name different cameras
     * and different streams, so one silent camera must not spend the budget the others need. A
     * session whose `EndSession` the budget abandoned keeps its entry; a later pass waits on that
     * same `EndSession` rather than sending a second one, and retries only once it has failed.
     */
    async #releaseSessions(matches: (scope: SessionScope) => boolean): Promise<void> {
        // No client asked for these, so the announcement names nobody who needs telling: the only
        // connection a closing connection's sessions concern is the one that went away, and at
        // shutdown every socket is closed before this runs — `server_shutdown` is that event.
        const inFlight = this.#sessions.claim(matches, session =>
            this.#endSession(session, undefined).catch(error => {
                logger.warn(`Failed to end session ${session.webRtcSessionId} on node ${session.nodeId}:`, error);
                // Rethrown so a `camera_stop_stream` joined to this same release is told the session is
                // still open rather than being handed a stop that did not happen. Logged as well because
                // a connection close and a shutdown have no client to raise to; the allSettled below is
                // what absorbs the rejection here.
                throw error;
            }),
        );
        if (inFlight.length === 0) return;
        await withCleanupBudget("ending the sessions a connection or the server owned", async () => {
            await Promise.allSettled(inFlight);
        });
    }

    /**
     * The typed camera error for a snapshot the device refused.
     *
     * Snapshots share the video path's error codes, so a client sees the same 102/103 distinction on
     * either surface rather than a raw SDK error on one of them. A capacity refusal names every
     * stream that holds an encoder: the referenced video streams, and the snapshot streams the camera
     * marks `HardwareEncoder`, which are the ones a snapshot call left behind.
     */
    protected snapshotFailure(
        state: CameraState,
        deviceStatus: number | undefined,
        deviceCodecs: string[],
        requestedCodecs: string[],
    ): ServerError {
        if (ladderReaction(deviceStatus) === "make-room") {
            return ServerError.cameraResourceExhausted({
                allocated: [
                    ...state.allocatedVideoStreams.map(stream =>
                        occupyingStream("video", stream.videoStreamId, stream.referenceCount),
                    ),
                    ...encoderHoldingSnapshotStreams(state.allocatedSnapshotStreams),
                ],
                maxConcurrentEncoders: state.maxConcurrentEncoders,
                maxEncodedPixelRate: state.maxEncodedPixelRate,
            });
        }
        return ServerError.cameraStreamIncompatible({
            reason: "bounds",
            device: deviceCodecs,
            requested: requestedCodecs,
            deviceStatus,
        });
    }

    /**
     * One still frame, captured from a snapshot stream the camera keeps.
     *
     * The stream is adopted rather than allocated wherever the device already reports one the
     * caller's bounds allow, whoever allocated it. Allocating per call is the churn §11.2.1.1 asks
     * controllers to avoid, and every allocate competes for the encoders the livestream needs.
     * Adoption remembers nothing between calls: the candidate is found in the device's own report
     * each time, which is why a restart changes nothing about which stream this call reaches for. A
     * stream this call allocates is recorded as its own, which is what `allocated_by_server` reports and
     * what lets the video ladder's make-room rung take it back when the camera has no capacity left.
     *
     * Every stream this call allocates is left in place, whatever capability it came from, so the
     * result always names the stream the camera holds and that id is the one `camera_release_stream`
     * takes. A stream whose capability needs the hardware encoder holds one of
     * `MaxConcurrentEncoders` while it exists; a `camera_release_stream` gives it back, and so does the
     * video ladder when it needs that encoder. What this call never does is give it back itself: a
     * give-back here could only be sent, never awaited to a conclusion the answer can state, because
     * the device invoke carries no abort and the wait has to be bounded to keep the endpoint lock (see
     * {@link withCleanupBudget}). An answer naming a stream a deallocate may still remove is the one
     * outcome this field must never have.
     */
    async snapshot(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        maxResolution?: Resolution;
        codec?: number;
        watermarkEnabled?: boolean;
        osdEnabled?: boolean;
    }): Promise<SnapshotResult> {
        const { nodeId, endpointId } = args;
        return this.withEndpointLock(nodeId, endpointId, () =>
            this.withAllocationScope(async scope => {
                const state = await this.requireState(nodeId, endpointId);
                if (lacksFeature(state.features, "snapshot")) {
                    // Ahead of the empty-list refusal below, which usually answers first because
                    // SnapshotCapabilities is gated on the feature: a camera that reports the list
                    // anyway has no `SnapshotStreamAllocate` in its AcceptedCommandList either.
                    throw ServerError.cameraStreamIncompatible({
                        reason: "feature",
                        feature: featureName("snapshot"),
                        device: new Array<string>(),
                        requested: args.codec === undefined ? new Array<string>() : [imageCodecName(args.codec)],
                    });
                }
                const support = overlaySupport(state.features);
                const overlaySelection = resolveOverlays(
                    { watermarkEnabled: args.watermarkEnabled, osdEnabled: args.osdEnabled },
                    support,
                );
                if ("unsupported" in overlaySelection) {
                    throw ServerError.cameraStreamIncompatible({
                        reason: "feature",
                        feature: featureName(overlaySelection.unsupported),
                        device: new Array<string>(),
                        requested: args.codec === undefined ? new Array<string>() : [imageCodecName(args.codec)],
                    });
                }
                const overlays = overlaySelection.overlays;
                const selection = selectSnapshotCapabilities(state.snapshotCapabilities, {
                    // Both lists carry what this server allocated and the camera has not reported yet,
                    // so a stream allocated moments ago is not missing from the count.
                    encodersExhausted: encodersExhausted({
                        maxConcurrentEncoders: state.maxConcurrentEncoders,
                        videoStreams: [
                            ...state.allocatedVideoStreams,
                            ...this.unreportedVideoStreams(nodeId, endpointId, state.allocatedVideoStreams),
                        ],
                        snapshotStreams: [
                            ...state.allocatedSnapshotStreams,
                            ...this.unreportedSnapshotStreams(nodeId, endpointId, state.allocatedSnapshotStreams),
                        ],
                    }),
                    maxResolution: args.maxResolution,
                    codec: args.codec,
                });
                const deviceCodecs = new Array<string>();
                for (const entry of state.snapshotCapabilities) {
                    const name = imageCodecName(entry.imageCodec);
                    if (!deviceCodecs.includes(name)) deviceCodecs.push(name);
                }
                const requestedCodecs = args.codec === undefined ? new Array<string>() : [imageCodecName(args.codec)];
                if ("unsatisfiable" in selection) {
                    throw ServerError.cameraStreamIncompatible({
                        reason: selection.unsatisfiable,
                        device: deviceCodecs,
                        requested: requestedCodecs,
                    });
                }
                const candidates = selection.capabilities;
                const bestWithinCallerBounds = selection.bestWithinCallerBounds;
                const best = candidates[0];
                if (best === undefined) {
                    // Every narrowing step reports its own dimension above, so the list can only be empty
                    // when the camera advertises no snapshot capability at all. No bound the caller could
                    // change makes this request work.
                    throw ServerError.cameraStreamIncompatible({
                        reason: "capability",
                        device: deviceCodecs,
                        requested: requestedCodecs,
                    });
                }

                const adopted = findAdoptableSnapshotStream(state.allocatedSnapshotStreams, best, {
                    ...args,
                    overlays,
                });
                if (adopted !== undefined) {
                    const captured = await this.#captureAdoptedSnapshot({
                        nodeId,
                        endpointId,
                        state,
                        snapshotStreamId: adopted.snapshotStreamId,
                        requestedResolution: adopted.maxResolution,
                        deviceCodecs,
                        requestedCodecs,
                    });
                    if (captured !== undefined) {
                        return {
                            ...captured,
                            degraded: isDegradeFrom(captured.resolution, bestWithinCallerBounds),
                            snapshotStreamId: adopted.snapshotStreamId,
                        };
                    }
                    logger.info(
                        `Node ${nodeId} no longer has snapshot stream ${adopted.snapshotStreamId} its reported state still lists; allocating one instead`,
                    );
                }

                // Walking the candidates is the snapshot ladder: the device validates the request against
                // its own SnapshotCapabilities list and answers DynamicConstraintError when none matches,
                // so the next-best capability is the only retry that can succeed.
                let allocated: { capability: SnapshotCapability; snapshotStreamId: number } | undefined;
                let lastStatus: number | undefined;
                for (const capability of candidates) {
                    try {
                        const allocateResponse = await this.io.invoke({
                            nodeId,
                            endpointId,
                            cluster: "avsm",
                            command: "snapshotStreamAllocate",
                            fields: {
                                imageCodec: capability.imageCodec,
                                maxFrameRate: capability.maxFrameRate,
                                minResolution: capability.resolution,
                                maxResolution: capability.resolution,
                                ...overlays,
                            },
                        });
                        const snapshotStreamId =
                            typeof allocateResponse === "object" &&
                            allocateResponse !== null &&
                            "snapshotStreamId" in allocateResponse
                                ? allocateResponse.snapshotStreamId
                                : undefined;
                        if (typeof snapshotStreamId !== "number") {
                            throw ServerError.sdkStackError("SnapshotStreamAllocate returned no SnapshotStreamID");
                        }
                        allocated = { capability, snapshotStreamId };
                        break;
                    } catch (error) {
                        if (error instanceof ServerError) throw error;
                        lastStatus = deviceStatusOf(error);
                        const reaction = ladderReaction(lastStatus);
                        if (reaction === "rethrow") throw error;
                        if (reaction === "fail-incompatible") {
                            throw ServerError.cameraStreamIncompatible({
                                reason: "bounds",
                                device: deviceCodecs,
                                requested: requestedCodecs,
                                deviceStatus: lastStatus,
                            });
                        }
                    }
                }
                if (allocated === undefined) {
                    throw this.snapshotFailure(state, lastStatus, deviceCodecs, requestedCodecs);
                }
                const { capability, snapshotStreamId } = allocated;
                if (Object.keys(overlays).length > 0 && !capability.requiresHardwareEncoder) {
                    // §11.2.8.8.6 keys the may-ignore on RequiresHardwareEncoder alone, not on
                    // `usesHardwareEncoder`'s nesting of it under RequiresEncodedPixels. A camera that
                    // ignores the flags reports its own, so adoption then re-allocates every call.
                    logger.info(
                        `Node ${nodeId} snapshot stream ${snapshotStreamId} was allocated at a capability that needs no hardware encoder, so the camera may ignore the watermark and OSD flags it was asked for and apply the source video stream's instead`,
                    );
                }
                const lease = this.recordAllocation(nodeId, endpointId, {
                    kind: "snapshot",
                    streamId: snapshotStreamId,
                    allocatedByUs: true,
                    allocation: allocatedSnapshotStream(snapshotStreamId, capability, overlays),
                });
                // A failed call answers with no stream id, so nothing the caller holds can free
                // this; only a call that returns keeps its stream for the next one.
                scope.returnOnFailure(() => this.#deallocate(nodeId, endpointId, lease));

                const captured = await this.#captureSnapshot({
                    nodeId,
                    endpointId,
                    state,
                    snapshotStreamId,
                    requestedResolution: capability.resolution,
                    deviceCodecs,
                    requestedCodecs,
                });
                return {
                    ...captured,
                    degraded: isDegradeFrom(captured.resolution, bestWithinCallerBounds),
                    snapshotStreamId,
                };
            }),
        );
    }

    /**
     * {@link #captureSnapshot} against an adopted stream, or undefined when the device does not know
     * that stream and the caller should allocate one.
     *
     * NOT_FOUND is what the device answers for an id that is not in `AllocatedSnapshotStreams`
     * (§11.2.8.13.3), and device state is a cached, subscription-backed view: a stream it still
     * lists may have been deallocated since, by another controller or by a `camera_release_stream`.
     * The device's own answer is the only statement about that worth acting on, which is why
     * adoption asks and falls back rather than trying to predict it from the leases.
     */
    async #captureAdoptedSnapshot(
        args: CaptureSnapshotArgs,
    ): Promise<{ data: Uint8Array; imageCodec: number; resolution: Resolution } | undefined> {
        try {
            return await this.#captureSnapshot(args);
        } catch (error) {
            if (deviceStatusOf(error) === Status.NotFound) return undefined;
            throw error;
        }
    }

    /** `CaptureSnapshot` against one allocated stream, with the snapshot path's own error mapping. */
    async #captureSnapshot(
        args: CaptureSnapshotArgs,
    ): Promise<{ data: Uint8Array; imageCodec: number; resolution: Resolution }> {
        const { nodeId, endpointId, snapshotStreamId } = args;
        try {
            const captureResponse = await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "avsm",
                command: "captureSnapshot",
                fields: { snapshotStreamId, requestedResolution: args.requestedResolution },
            });
            if (
                typeof captureResponse !== "object" ||
                captureResponse === null ||
                !("data" in captureResponse) ||
                !("imageCodec" in captureResponse) ||
                !("resolution" in captureResponse) ||
                !(captureResponse.data instanceof Uint8Array) ||
                typeof captureResponse.imageCodec !== "number" ||
                !isResolution(captureResponse.resolution)
            ) {
                throw ServerError.sdkStackError("CaptureSnapshot returned an incomplete response");
            }
            return {
                data: captureResponse.data,
                imageCodec: captureResponse.imageCodec,
                resolution: captureResponse.resolution,
            };
        } catch (error) {
            if (error instanceof ServerError) throw error;
            const status = deviceStatusOf(error);
            if (ladderReaction(status) === "rethrow") {
                throw await this.privacyFailure(nodeId, endpointId, error, snapshotPrivacyModes);
            }
            throw this.snapshotFailure(args.state, status, args.deviceCodecs, args.requestedCodecs);
        }
    }

    /**
     * Deallocate one stream on the camera's terms.
     *
     * The cluster refuses a deallocate for exactly three reasons — an id it does not know, a
     * `ReferenceCount` above 0, and StreamUsage Internal (§11.2.8.7.2, §11.2.8.3.2; the snapshot
     * command has no Internal case, §11.2.8.10.2). It checks neither who allocated the stream nor
     * which fabric asks, so this forwards and reports what the camera answers rather than adding a
     * refusal of its own. That includes the reference count: it is read from a subscription-backed
     * view that can be behind the device in either direction, so deciding on it would refuse a
     * release the camera would accept, with no path left that reaches the device. The count is used
     * only to say more in the refusal than the camera's bare INVALID_IN_STATE does. A missing
     * cluster still fails as `camera_not_supported` before any of this runs.
     */
    async releaseStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        kind: StreamKind;
        streamId: number;
    }): Promise<void> {
        const { nodeId, endpointId, kind, streamId } = args;
        return this.withEndpointLock(nodeId, endpointId, async () => {
            const state = await this.requireState(nodeId, endpointId);
            const referenceCount = referenceCountOf(state, kind, streamId);
            const { command, fields } = deallocateCall(kind, streamId);
            try {
                await this.io.invoke({ nodeId, endpointId, cluster: "avsm", command, fields });
            } catch (error) {
                const status = deviceStatusOf(error);
                // The reference implementation answers INVALID_IN_STATE for a reference count
                // above 0 and for nothing else (`connectedhomeip/src/app/clusters/
                // camera-av-stream-management-server/CameraAVStreamManagementCluster.h`,
                // `ValidateStreamForModifyOrDeallocateImpl`), and passes its delegate's status
                // through, so the cause is kept for a camera that answers it for another reason.
                if (status === Status.InvalidInState) {
                    throw ServerError.cameraStreamInUse(
                        { streamId, ...(referenceCount > 0 ? { referenceCount } : {}) },
                        error instanceof Error ? error : undefined,
                    );
                }
                // The camera states it has no such stream, which is the fact the lease claimed.
                if (status === Status.NotFound) this.dropLease(nodeId, endpointId, kind, streamId);
                throw error;
            }
            this.dropLease(nodeId, endpointId, kind, streamId);
        });
    }
}
