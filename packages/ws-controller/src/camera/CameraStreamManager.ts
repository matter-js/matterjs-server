/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Time } from "@matter/main";
import type { EndpointNumber, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { Status } from "@matter/main/types";
import { deviceForgotSession, invokeEndSession } from "../controller/webRtcSessionTracking.js";
import { ServerError, type CameraOccupyingStreamDetail } from "../types/WebSocketMessageTypes.js";
import { DEVICE_CLEANUP_BUDGET_MS, withCleanupBudget } from "../util/deviceCleanupBudget.js";
import type {
    AllocatedAudioStream,
    AllocatedSnapshotStream,
    AllocatedVideoStream,
    AudioEnvelope,
    DeviceWebRtcSession,
    LeaseStatement,
    ManagedSession,
    Resolution,
    ResolvedStream,
    StreamKind,
    StreamLease,
    VideoEnvelope,
} from "./cameraTypes.js";
import { deviceStatusOf } from "./deviceStatus.js";
import { mediaRefusal, parseSdpVideoConstraints, receivableCodecs, videoCodecLimits } from "./sdpConstraints.js";
import type { MediaRefusal, SdpVideoConstraints, SelectedVideoCodecLimits } from "./sdpConstraints.js";
import { CameraSessionRegistry } from "./sessionRegistry.js";
import type { PendingSession, SessionScope } from "./sessionRegistry.js";
import {
    encodersExhausted,
    findAdoptableSnapshotStream,
    isDowngradeFrom,
    selectSnapshotCapabilities,
} from "./snapshotPolicy.js";
import type { SnapshotCapability } from "./snapshotPolicy.js";
import {
    chooseEvictionVictim,
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    findReusableVideoStream,
    narrowEnvelope,
    satisfiesAudioCallerBounds,
    statedHints,
    trackRequest,
    videoCallerBounds,
} from "./streamPolicy.js";
import type { AudioCallerBounds, AudioHints, RateDistortionPoint, TrackRequest, VideoHints } from "./streamPolicy.js";
import { audioCodecName, imageCodecName, knownVideoCodecs, streamUsageName, videoCodecName } from "./wireNames.js";

const logger = Logger.get("CameraStreamManager");

/** Bounded so a device that rejects everything fails fast rather than walking to 1x1. */
const MAX_NARROWING_ROUNDS = 3;

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

/** The envelope actually delivered by an allocated video stream, as opposed to the one requested. */
function envelopeOfVideoStream(stream: AllocatedVideoStream, keyFrameInterval: number): VideoEnvelope {
    return {
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
    const offered = sdp === undefined ? undefined : receivableCodecs(sdp.video);
    if (offered !== undefined) {
        const narrowed = candidates.filter(codec => offered.includes(videoCodecName(codec)));
        candidates = requireCodecCandidates(narrowed, candidates, [...offered]);
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
function encoderHoldingSnapshotStreams(state: CameraState): CameraOccupyingStreamDetail[] {
    return state.allocatedSnapshotStreams
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

/** The AVSM attributes the policy needs, as matter.js reports them through `stateOf`. */
export interface CameraState {
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
    }): Promise<unknown>;
}

export interface CameraCapabilities {
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
        video: Array<AllocatedVideoStream & { ownedByServer: boolean }>;
        audio: Array<AllocatedAudioStream & { ownedByServer: boolean }>;
        snapshot: Array<AllocatedSnapshotStream & { ownedByServer: boolean }>;
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
    downgraded: boolean;
    /** The stream the frame came from, which a successful call always leaves on the camera. */
    snapshotStreamId: number;
}

export class CameraStreamManager {
    readonly #io: CameraDeviceIo;
    readonly #leases = new Map<string, StreamLease[]>();
    readonly #locks = new Map<string, Promise<unknown>>();
    readonly #sessions = new CameraSessionRegistry();
    #nextLeaseGeneration = 0;

    constructor(io: CameraDeviceIo) {
        this.#io = io;
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

    async getCapabilities(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraCapabilities> {
        const state = await this.requireState(nodeId, endpointId);
        const sessions = (await this.#io.readWebRtcSessions(nodeId, endpointId)) ?? new Array<DeviceWebRtcSession>();
        const owned = (kind: StreamKind, streamId: number): boolean =>
            this.ownsStream(nodeId, endpointId, kind, streamId);

        const codecs = new Array<number>();
        for (const point of state.rateDistortionTradeOffPoints) {
            if (!codecs.includes(point.codec)) codecs.push(point.codec);
        }

        return {
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
                    ownedByServer: owned("video", stream.videoStreamId),
                })),
                audio: state.allocatedAudioStreams.map(stream => ({
                    ...stream,
                    ownedByServer: owned("audio", stream.audioStreamId),
                })),
                snapshot: state.allocatedSnapshotStreams.map(stream => ({
                    ...stream,
                    ownedByServer: owned("snapshot", stream.snapshotStreamId),
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
     */
    protected async resolveVideoStreamLocked(
        args: {
            nodeId: NodeId;
            endpointId: EndpointNumber;
            streamUsage: number;
            limits: SelectedVideoCodecLimits;
            hints?: VideoHints;
        },
        scope: AllocationScope,
    ): Promise<ResolvedStream> {
        const { nodeId, endpointId, streamUsage } = args;
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
        let envelope = selection.envelope;

        // The ladder's own copy: freeing a stream updates this array, never the state object.
        let liveStreams = state.allocatedVideoStreams;
        // Freeing and the exhaustion report stay on device state: a stream this server has only just
        // allocated has no reference count anyone but the device can state.
        const unreported = this.unreportedVideoStreams(nodeId, endpointId, liveStreams);

        const bounds = videoCallerBounds(args.limits, streamUsage, args.hints);
        const reused = findReusableVideoStream([...liveStreams, ...unreported], envelope, bounds);
        if (reused !== undefined) {
            return {
                streamId: reused.videoStreamId,
                envelope: envelopeOfVideoStream(reused, envelope.keyFrameInterval),
                reused: true,
                allocatedByUs: this.leaseReusedVideoStream(nodeId, endpointId, reused),
            };
        }

        let lastStatus: number | undefined;
        const freed = new Array<() => void>();
        for (let round = 0; round <= MAX_NARROWING_ROUNDS; round++) {
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
                return { streamId, envelope, reused: false, allocatedByUs: true };
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
                if (reaction === "make-room") {
                    const madeRoom = await this.freeAnUnreferencedVideoStream(
                        nodeId,
                        endpointId,
                        liveStreams,
                        state.streamUsagePriorities,
                        scope,
                        envelope.keyFrameInterval,
                    );
                    if (madeRoom !== undefined) {
                        liveStreams = liveStreams.filter(stream => stream.videoStreamId !== madeRoom.streamId);
                        freed.push(madeRoom.spend);
                        continue;
                    }
                }
                const narrowed = narrowEnvelope(envelope);
                if (narrowed === undefined) break;
                envelope = narrowed;
            }
        }

        // Last rung: hand out a stream that is in use, giving up the computed envelope and nothing
        // the caller stated.
        const degraded = findDegradedVideoStream([...liveStreams, ...unreported], bounds);
        if (degraded !== undefined) {
            return {
                streamId: degraded.videoStreamId,
                envelope: envelopeOfVideoStream(degraded, envelope.keyFrameInterval),
                reused: true,
                degraded: true,
                allocatedByUs: this.leaseReusedVideoStream(nodeId, endpointId, degraded),
            };
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
                ...encoderHoldingSnapshotStreams(state),
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
                    reason: "capability",
                    track: "audio",
                    device: new Array<string>(),
                    requested: requestedCodecs,
                }),
            };
        }
        const microphone = state.microphoneCapabilities;
        if (
            microphone === undefined ||
            microphone.supportedCodecs.length === 0 ||
            microphone.supportedSampleRates.length === 0 ||
            microphone.supportedBitDepths.length === 0
        ) {
            return {
                unavailable: ServerError.cameraStreamIncompatible({
                    reason: "capability",
                    track: "audio",
                    device: new Array<string>(),
                    requested: requestedCodecs,
                }),
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
     * The victim is chosen by {@link chooseEvictionVictim} from the camera's own ranking, which is
     * also what decides that a stream this server did not allocate may be taken: the cluster
     * protects a stream by use and by Internal, not by who created it. A foreign stream is logged,
     * since the spec recommends commissioners pre-allocate (§11.2.1.1) and such a stream may be
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
                        reason: "capability",
                        track: "video",
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
                reason: "capability",
                device: new Array<string>(),
                requested: new Array<string>(),
            });
        }

        const response = await this.io.invoke({
            nodeId,
            endpointId,
            cluster: "webrtcProvider",
            command: args.sdp === undefined ? "solicitOffer" : "provideOffer",
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
            await this.#endSession(session);
        });
        if (!this.#sessions.track(pending, session)) {
            throw ServerError.sdkStackError(
                `WebRTC session ${webRtcSessionId} was ended: the requesting connection closed while the camera was establishing it`,
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
    async #endSession(session: ManagedSession): Promise<boolean> {
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
                    this.#sessions.forgetEstablished(session);
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
    async stopStream(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): Promise<boolean> {
        const session = this.#sessions.get(nodeId, endpointId, webRtcSessionId);
        if (session !== undefined) return this.#sessions.releaseOnce(session, held => this.#endSession(held));
        return this.#endUntrackedSession(nodeId, endpointId, webRtcSessionId);
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
    async #endUntrackedSession(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): Promise<boolean> {
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
        return true;
    }

    /**
     * Stop tracking a session the device has already ended, without invoking `EndSession` for it.
     *
     * The peer's `End` notification and a client's own `EndSession` on the raw path both leave the
     * device with no session. Keeping the entry would make `camera_stop_stream` report `ended: true`
     * for a session that ended minutes earlier, and shutdown send `EndSession` for a dead id.
     */
    forgetSession(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): boolean {
        return this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
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
        const inFlight = this.#sessions.claim(matches, session =>
            this.#endSession(session).catch(error => {
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
                    ...encoderHoldingSnapshotStreams(state),
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
     * stream this call allocates is still recorded as its own, which is what `owned_by_server`
     * reports and all that record decides.
     *
     * Every stream this call allocates is left in place, whatever capability it came from, so the
     * result always names the stream the camera holds and that id is the one `camera_release_stream`
     * takes. A stream whose capability needs the hardware encoder holds one of
     * `MaxConcurrentEncoders` while it exists, and releasing it is the client's call: a give-back
     * here could only be sent, never awaited to a conclusion the answer can state, because the
     * device invoke carries no abort and the wait has to be bounded to keep the endpoint lock (see
     * {@link withCleanupBudget}). An answer naming a stream a deallocate may still remove is the one
     * outcome this field must never have.
     */
    async snapshot(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        maxResolution?: Resolution;
        codec?: number;
    }): Promise<SnapshotResult> {
        const { nodeId, endpointId } = args;
        return this.withEndpointLock(nodeId, endpointId, () =>
            this.withAllocationScope(async scope => {
                const state = await this.requireState(nodeId, endpointId);
                const selection = selectSnapshotCapabilities(state.snapshotCapabilities, {
                    encodersExhausted: encodersExhausted({
                        maxConcurrentEncoders: state.maxConcurrentEncoders,
                        videoStreams: state.allocatedVideoStreams,
                        snapshotStreams: state.allocatedSnapshotStreams,
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
                const bestWithFreeEncoder = selection.bestWithFreeEncoder;
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

                const adopted = findAdoptableSnapshotStream(state.allocatedSnapshotStreams, best, args);
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
                            downgraded: isDowngradeFrom(captured.resolution, bestWithFreeEncoder),
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
                const lease = this.recordAllocation(nodeId, endpointId, {
                    kind: "snapshot",
                    streamId: snapshotStreamId,
                    allocatedByUs: true,
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
                    downgraded: isDowngradeFrom(captured.resolution, bestWithFreeEncoder),
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
            if (ladderReaction(status) === "rethrow") throw error;
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
