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
import { ServerError } from "../types/WebSocketMessageTypes.js";
import type {
    AllocatedAudioStream,
    AllocatedSnapshotStream,
    AllocatedVideoStream,
    AudioEnvelope,
    LeaseStatement,
    ManagedSession,
    Resolution,
    ResolvedStream,
    StreamKind,
    StreamLease,
    VideoEnvelope,
} from "./cameraTypes.js";
import { parseSdpVideoConstraints } from "./sdpConstraints.js";
import type { SdpVideoConstraints } from "./sdpConstraints.js";
import { CameraSessionRegistry } from "./sessionRegistry.js";
import type { PendingSession, SessionScope } from "./sessionRegistry.js";
import { isDowngradeFrom, selectSnapshotCapabilities } from "./snapshotPolicy.js";
import type { SnapshotCapability } from "./snapshotPolicy.js";
import {
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    findReusableVideoStream,
    narrowEnvelope,
} from "./streamPolicy.js";
import type { AudioHints, RateDistortionPoint, VideoHints } from "./streamPolicy.js";
import { audioCodecName, imageCodecName, knownVideoCodecs, videoCodecName } from "./wireNames.js";

const logger = Logger.get("CameraStreamManager");

/** Bounded so a device that rejects everything fails fast rather than walking to 1x1. */
const MAX_NARROWING_ROUNDS = 3;

function deviceStatusOf(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "number" ? error.code : undefined;
}

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
    if (sdp?.hasVideo === true && sdp.codecs.length > 0) {
        const offered = candidates.filter(codec => sdp.codecs.includes(videoCodecName(codec)));
        candidates = requireCodecCandidates(offered, candidates, sdp.codecs);
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

/**
 * How long a stream this server allocated stays its own to release while the device names no such
 * stream.
 *
 * `stateOf` is a cached, subscription-backed view, so an early read says nothing and a lease must
 * outlive it. A device that has not named the stream after this long is not slow: either the stream
 * is gone, or this endpoint never reports allocations at all. Keeping the lease past that point grows
 * the per-endpoint array for as long as the server runs, and lets the lease re-attach to a foreign
 * stream once the device reissues the id — `camera_release_stream` would then deallocate a stream
 * this server does not own.
 */
export const UNREPORTED_LEASE_RETENTION_MS = 300000;

/** One device-side effect of a request, with the lifetime it was registered under. */
interface ScopedReturn {
    readonly give: () => Promise<void>;
    /** True for an effect the request gives back even when it succeeds. */
    readonly onSuccessToo: boolean;
    /** Set once the request has made the effect good, so there is nothing left to give back. */
    discharged: boolean;
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
    returnOnFailure(give: () => Promise<void>): void {
        this.#returns.push({ give, onSuccessToo: false, discharged: false });
    }

    /**
     * Give this back unless the request discharges it, whether or not the request succeeds.
     *
     * For an effect whose "was it worth it" question the request's own outcome does not answer: a
     * stream freed to make room is worth it exactly when an allocate then succeeded, which can be
     * false on a path that succeeds by other means.
     */
    returnUntilDischarged(give: () => Promise<void>): () => void {
        const entry: ScopedReturn = { give, onSuccessToo: true, discharged: false };
        this.#returns.push(entry);
        return () => {
            entry.discharged = true;
        };
    }

    /** Give this back when the request ends, however it ends. */
    returnAlways(give: () => Promise<void>): void {
        this.#returns.push({ give, onSuccessToo: true, discharged: false });
    }

    /**
     * Run what is due, newest first, so a session is ended before the streams it referenced are
     * deallocated — the device refuses to deallocate a stream at `ReferenceCount > 0`.
     */
    async settle(succeeded: boolean): Promise<void> {
        for (const entry of [...this.#returns].reverse()) {
            if (entry.discharged) continue;
            if (succeeded && !entry.onSuccessToo) continue;
            try {
                await entry.give();
            } catch (error) {
                logger.warn("A camera request could not give back what it caused on the device:", error);
            }
        }
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
}

export interface StartStreamArgs {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    connectionId: string;
    streamUsage: number;
    sdp?: string;
    video?: VideoHints | false;
    audio?: AudioHints | false;
    iceServers?: unknown;
    iceTransportPolicy?: unknown;
    metadataEnabled?: boolean;
}

export interface StartStreamResult {
    webRtcSessionId: number;
    mode: "solicit_offer" | "provide_offer";
    video?: ResolvedStream;
    audio?: ResolvedStream;
}

export interface SnapshotResult {
    data: Uint8Array;
    imageCodec: number;
    resolution: Resolution;
    /** True when the frame is smaller than the best capability the caller's own bounds allowed. */
    downgraded: boolean;
}

export class CameraStreamManager {
    readonly #io: CameraDeviceIo;
    readonly #leases = new Map<string, StreamLease[]>();
    readonly #locks = new Map<string, Promise<unknown>>();
    readonly #sessions = new CameraSessionRegistry();

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
    protected recordAllocation(nodeId: NodeId, endpointId: EndpointNumber, statement: LeaseStatement): void {
        const now = Time.nowUs;
        this.#putLease(nodeId, endpointId, {
            ...statement,
            shadowUntil: now + UNREPORTED_LEASE_GRACE_MS,
            retainUntil: now + UNREPORTED_LEASE_RETENTION_MS,
            reportedByDevice: false,
        });
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
            retainUntil: previous?.retainUntil ?? 0,
            reportedByDevice: previous?.reportedByDevice ?? true,
        });
        return statement.allocatedByUs;
    }

    /**
     * Line the leases up with what the device reports.
     *
     * A stream the device has named and then stops naming is gone, so its lease goes with it. Before
     * the first such report absence says nothing, and dropping the lease there would leave a stream
     * this server allocated with nothing recording that it may release it — until
     * {@link UNREPORTED_LEASE_RETENTION_MS}, past which silence is the answer rather than the wait
     * for one.
     */
    protected reconcileLeases(nodeId: NodeId, endpointId: EndpointNumber, state: CameraState): void {
        const key = this.endpointKey(nodeId, endpointId);
        const existing = this.#leases.get(key);
        if (existing === undefined) return;

        const now = Time.nowUs;
        const kept = new Array<StreamLease>();
        for (const lease of existing) {
            if (deviceReportsStream(state, lease.kind, lease.streamId)) {
                kept.push(lease.reportedByDevice ? lease : { ...lease, reportedByDevice: true });
                continue;
            }
            if (lease.reportedByDevice) continue;
            if (now >= lease.retainUntil) {
                logger.notice(
                    `Giving up the lease on ${lease.kind} stream ${lease.streamId} of node ${nodeId}: the device has never reported it, so this server can no longer claim it`,
                );
                continue;
            }
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
        };
    }

    async resolveVideoStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        codec: number;
        sdp?: SdpVideoConstraints;
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
            codec: number;
            sdp?: SdpVideoConstraints;
            hints?: VideoHints;
        },
        scope: AllocationScope,
    ): Promise<ResolvedStream> {
        const { nodeId, endpointId, streamUsage, codec } = args;
        const state = await this.requireState(nodeId, endpointId);
        const deviceCodecs = new Array<number>();
        for (const point of state.rateDistortionTradeOffPoints) {
            if (!deviceCodecs.includes(point.codec)) deviceCodecs.push(point.codec);
        }
        if (deviceCodecs.length > 0 && !deviceCodecs.includes(codec)) {
            throw ServerError.cameraStreamIncompatible({
                reason: "codec",
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
            codec,
            sdp: args.sdp,
            hints: args.hints,
        });
        if ("unsatisfiable" in selection) {
            throw ServerError.cameraStreamIncompatible({
                reason: selection.unsatisfiable,
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

        const reused = findReusableVideoStream([...liveStreams, ...unreported], envelope, streamUsage);
        if (reused !== undefined) {
            return {
                streamId: reused.videoStreamId,
                envelope: envelopeOfVideoStream(reused, envelope.keyFrameInterval),
                reused: true,
                allocatedByUs: this.leaseReusedVideoStream(nodeId, endpointId, reused),
            };
        }

        let lastStatus: number | undefined;
        // Only an allocate that then succeeds makes a freeing worth it. Every other way out of this
        // ladder, success included, leaves the camera a stream poorer for nothing.
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
                    throw ServerError.sdkStackError("VideoStreamAllocate returned no VideoStreamID");
                }
                this.recordAllocation(nodeId, endpointId, {
                    kind: "video",
                    streamId,
                    allocatedByUs: true,
                    allocation: allocatedVideoStream(streamId, streamUsage, envelope),
                });
                scope.returnOnFailure(() => this.#deallocate(nodeId, endpointId, "video", streamId));
                for (const discharge of freed) discharge();
                return { streamId, envelope, reused: false, allocatedByUs: true };
            } catch (error) {
                if (error instanceof ServerError) throw error;
                lastStatus = deviceStatusOf(error);
                const reaction = ladderReaction(lastStatus);
                if (reaction === "rethrow") throw error;
                if (reaction === "fail-incompatible") {
                    throw ServerError.cameraStreamIncompatible({
                        reason: "bounds",
                        device: deviceCodecs.map(videoCodecName),
                        requested: [videoCodecName(codec)],
                        deviceStatus: lastStatus,
                    });
                }
                if (reaction === "make-room") {
                    const relaxed = findReusableVideoStream([...liveStreams, ...unreported], envelope, streamUsage, {
                        ignoreStreamUsage: true,
                    });
                    if (relaxed !== undefined) {
                        return {
                            streamId: relaxed.videoStreamId,
                            envelope: envelopeOfVideoStream(relaxed, envelope.keyFrameInterval),
                            reused: true,
                            allocatedByUs: this.leaseReusedVideoStream(nodeId, endpointId, relaxed),
                        };
                    }
                    const madeRoom = await this.freeAnUnreferencedVideoStream(
                        nodeId,
                        endpointId,
                        liveStreams,
                        scope,
                        envelope.keyFrameInterval,
                    );
                    if (madeRoom !== undefined) {
                        liveStreams = liveStreams.filter(stream => stream.videoStreamId !== madeRoom.streamId);
                        freed.push(madeRoom.discharge);
                        continue;
                    }
                }
                const narrowed = narrowEnvelope(envelope);
                if (narrowed === undefined) break;
                envelope = narrowed;
            }
        }

        // Last rung: hand out a stream that is in use, but only within bounds the caller stated.
        // A caller who pinned a resolution matches nothing here and gets the typed failure below.
        const degraded = findDegradedVideoStream([...liveStreams, ...unreported], codec, args.hints ?? {});
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
                device: deviceCodecs.map(videoCodecName),
                requested: [videoCodecName(codec)],
                deviceStatus: lastStatus,
            });
        }
        throw ServerError.cameraResourceExhausted({
            allocated: liveStreams.map(stream => ({
                streamId: stream.videoStreamId,
                referenceCount: stream.referenceCount,
            })),
            maxConcurrentEncoders: state.maxConcurrentEncoders,
            maxEncodedPixelRate: state.maxEncodedPixelRate,
        });
    }

    async resolveAudioStream(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        streamUsage: number;
        sdp?: SdpVideoConstraints;
        hints?: AudioHints;
    }): Promise<ResolvedStream | undefined> {
        return this.withEndpointLock(args.nodeId, args.endpointId, () =>
            this.withAllocationScope(scope => this.resolveAudioStreamLocked(args, scope)),
        );
    }

    /**
     * Body of {@link resolveAudioStream}. The caller must already hold the endpoint lock and own the
     * scope; see {@link resolveVideoStreamLocked}.
     *
     * Audio has no narrowing ladder: a camera either supports the codec or it does not. A device
     * rejection, and an offer sharing no codec with the camera, yield `undefined` and a video-only
     * session rather than a failure. A codec the caller itself stated is hard, as it is for video.
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
    ): Promise<ResolvedStream | undefined> {
        const { nodeId, endpointId, streamUsage } = args;
        const state = await this.requireState(nodeId, endpointId);
        const microphone = state.microphoneCapabilities;
        if (
            microphone === undefined ||
            microphone.supportedCodecs.length === 0 ||
            microphone.supportedSampleRates.length === 0 ||
            microphone.supportedBitDepths.length === 0
        ) {
            return undefined;
        }

        const selection = computeAudioEnvelope({
            capabilities: microphone,
            sdp: args.sdp,
            hints: args.hints,
        });
        if ("unsatisfiable" in selection) {
            throw ServerError.cameraStreamIncompatible({
                reason: selection.unsatisfiable,
                device: selection.device.map(audioCodecName),
                requested: selection.requested,
            });
        }
        const envelope = selection.envelope;
        if (envelope === undefined) return undefined;

        const existing = [
            ...state.allocatedAudioStreams,
            ...this.unreportedAudioStreams(nodeId, endpointId, state.allocatedAudioStreams),
        ].find(
            stream =>
                stream.streamUsage === streamUsage &&
                stream.audioCodec === envelope.codec &&
                stream.channelCount === envelope.channelCount &&
                stream.sampleRate === envelope.sampleRate,
        );
        if (existing !== undefined) {
            return {
                streamId: existing.audioStreamId,
                envelope: envelopeOfAudioStream(existing),
                reused: true,
                allocatedByUs: this.leaseReusedAudioStream(nodeId, endpointId, existing),
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
                logger.info(
                    `Audio stream unavailable for node ${nodeId}; continuing without audio: AudioStreamAllocate returned no AudioStreamID`,
                );
                return undefined;
            }
            this.recordAllocation(nodeId, endpointId, {
                kind: "audio",
                streamId,
                allocatedByUs: true,
                allocation: allocatedAudioStream(streamId, streamUsage, envelope),
            });
            scope.returnOnFailure(() => this.#deallocate(nodeId, endpointId, "audio", streamId));
            return { streamId, envelope, reused: false, allocatedByUs: true };
        } catch (error) {
            if (error instanceof ServerError) throw error;
            logger.info(`Audio stream unavailable for node ${nodeId}; continuing without audio:`, error);
            return undefined;
        }
    }

    /**
     * Deallocate one unreferenced video stream from `streams` and report its id, or `undefined` if
     * nothing was freed. `streams` is a plain array and the caller's `CameraState` (which may be a
     * cached or subscription-backed snapshot) is never written to.
     *
     * Server-owned streams go first; a foreign one is touched only when nothing of ours is free, and
     * is logged, since the spec recommends commissioners pre-allocate (§15.2.1.1) and such a stream may
     * be deliberate. Nothing referenced is ever passed here — the device would refuse it with
     * INVALID_IN_STATE anyway.
     *
     * The freeing is registered with `scope` so a request that never uses the capacity it bought puts
     * an equivalent stream back rather than leaving the camera one stream poorer for nothing. The
     * caller discharges that registration once an allocate has succeeded; a request that ends any
     * other way — a throw, or a success reached by reusing a stream that was already there — restores.
     * The device issues a new id, so what comes back is the range and usage the freed stream stated,
     * not the stream itself.
     */
    protected async freeAnUnreferencedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        streams: AllocatedVideoStream[],
        scope: AllocationScope,
        keyFrameInterval: number,
    ): Promise<{ streamId: number; discharge: () => void } | undefined> {
        const unreferenced = streams.filter(stream => stream.referenceCount === 0);
        const ours = unreferenced.filter(stream => this.ownsStream(nodeId, endpointId, "video", stream.videoStreamId));
        const victim = ours[0] ?? unreferenced[0];
        if (victim === undefined) return undefined;

        if (ours[0] === undefined) {
            logger.notice(
                `Deallocating video stream ${victim.videoStreamId} on node ${nodeId}: it has no listeners and the camera has no capacity left, but this server did not allocate it`,
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
        const discharge = scope.returnUntilDischarged(() =>
            this.#restoreFreedVideoStream(nodeId, endpointId, victim, keyFrameInterval),
        );
        return { streamId: victim.videoStreamId, discharge };
    }

    /**
     * Allocate a stream matching one the make-room rung freed, for a request that failed regardless.
     *
     * The replacement is this server's to release, whoever allocated the original: this server
     * allocated it, and a stream nothing records as releasable is the leak the lease map prevents. `keyFrameInterval` is not among the fields the device reports back, so the
     * replacement carries the one the failed request was working with.
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
            `Allocated video stream ${streamId} on node ${nodeId} in place of stream ${freed.videoStreamId}, which was deallocated to make room for a request that then failed`,
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
        let video: ResolvedStream | undefined;
        let audio: ResolvedStream | undefined;
        if (args.video !== false) {
            const codecs = state.rateDistortionTradeOffPoints.map(point => point.codec);
            const codec = preferredVideoCodec(codecs, sdp, args.video === undefined ? undefined : args.video.codecs);
            video = await this.resolveVideoStreamLocked(
                {
                    nodeId,
                    endpointId,
                    streamUsage,
                    codec,
                    sdp,
                    hints: args.video === undefined ? undefined : args.video,
                },
                scope,
            );
        }

        if (args.audio !== false && state.microphoneCapabilities !== undefined) {
            audio = await this.resolveAudioStreamLocked(
                {
                    nodeId,
                    endpointId,
                    streamUsage,
                    sdp,
                    hints: args.audio === undefined ? undefined : args.audio,
                },
                scope,
            );
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
        scope.returnOnFailure(() => this.#endSession(session));
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
     * Give a stream back to the device, reporting nothing to the caller.
     *
     * A failure here is logged and swallowed: the lease survives it, so `camera_release_stream` and the
     * allocation ladder can still reach the stream, and the caller sees the error that started this.
     */
    async #deallocate(nodeId: NodeId, endpointId: EndpointNumber, kind: StreamKind, streamId: number): Promise<void> {
        const { command, fields } = deallocateCall(kind, streamId);
        try {
            await this.io.invoke({ nodeId, endpointId, cluster: "avsm", command, fields });
        } catch (error) {
            logger.warn(
                `Could not deallocate ${kind} stream ${streamId} on node ${nodeId} after a failed request:`,
                error,
            );
            return;
        }
        this.dropLease(nodeId, endpointId, kind, streamId);
    }

    /**
     * The one path that ends a session: `EndSession` on the device, then the registry entry.
     *
     * The order is what keeps the two in step. A failed invoke keeps the entry, so a later stop,
     * disconnect or shutdown still reaches the session; dropping first would leave the device holding
     * a session nothing can name, pinning its streams at `ReferenceCount > 0` for good.
     *
     * `NotFound` is the exception: the device answers it when it has no such session
     * (`WebRTCTransportProviderCluster.cpp`, `HandleEndSession` ahead of the delegate call), so the
     * entry is stale and keeping it would only re-send a dead id.
     */
    async #endSession(session: ManagedSession): Promise<void> {
        const { nodeId, endpointId, webRtcSessionId } = session;
        try {
            await this.io.invoke({
                nodeId,
                endpointId,
                cluster: "webrtcProvider",
                command: "endSession",
                fields: { webRtcSessionId, reason: WEBRTC_END_REASON_USER_HANGUP },
            });
        } catch (error) {
            if (deviceStatusOf(error) !== Status.NotFound) throw error;
            logger.info(
                `Node ${nodeId} no longer has WebRTC session ${webRtcSessionId}; dropping the server's tracking of it`,
            );
        }
        this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
    }

    /**
     * Ends the session on the device. The allocation is deliberately kept.
     *
     * Returns whether a session was actually ended: `webRtcSessionId` is caller-supplied and allocated
     * per provider, so it names a session only together with the node and endpoint it was issued on.
     */
    async stopStream(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): Promise<boolean> {
        const session = this.#sessions.get(nodeId, endpointId, webRtcSessionId);
        if (session === undefined) return false;
        await this.#endSession(session);
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
     * shutdown does not close the device connections out from under an `EndSession` it caused.
     */
    async #releaseSessions(matches: (scope: SessionScope) => boolean): Promise<void> {
        const { sessions, inFlight } = this.#sessions.claim(matches);
        for (const session of sessions) {
            await this.#endSession(session).catch(error =>
                logger.warn(`Failed to end session ${session.webRtcSessionId} on node ${session.nodeId}:`, error),
            );
        }
        await Promise.allSettled(inFlight);
    }

    /**
     * The typed camera error for a snapshot the device refused.
     *
     * Snapshots share the video path's error codes, so a client sees the same 102/103 distinction on
     * either surface rather than a raw SDK error on one of them.
     */
    protected snapshotFailure(
        state: CameraState,
        deviceStatus: number | undefined,
        deviceCodecs: string[],
        requestedCodecs: string[],
    ): ServerError {
        if (ladderReaction(deviceStatus) === "make-room") {
            return ServerError.cameraResourceExhausted({
                allocated: state.allocatedVideoStreams.map(stream => ({
                    streamId: stream.videoStreamId,
                    referenceCount: stream.referenceCount,
                })),
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
     * One still frame, from a snapshot stream that does not outlive this call.
     *
     * A snapshot stream allocated from a capability that needs the hardware encoder holds that encoder
     * for as long as the stream exists, so on `MaxConcurrentEncoders: 1` hardware a kept stream makes
     * the next snapshot fail with `ResourceExhausted` and blocks video allocation. The stream is given
     * back on every exit, success included, whatever capability it came from — a snapshot stream
     * nobody asked to keep is not worth the branch. The result therefore names no stream: by the time
     * the caller reads it, there is normally nothing left to name. The exception is a deallocate the
     * device refused, and `camera_get_capabilities` is where that shows, as `owned_by_server` on the
     * snapshot stream that is still there.
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
                const encoderBusy = state.allocatedVideoStreams.some(stream => stream.referenceCount > 0);
                const selection = selectSnapshotCapabilities(state.snapshotCapabilities, {
                    encoderBusy,
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
                if (candidates.length === 0) {
                    // Every narrowing step reports its own dimension above, so the list can only be empty
                    // when the camera advertises no snapshot capability at all. No bound the caller could
                    // change makes this request work.
                    throw ServerError.cameraStreamIncompatible({
                        reason: "capability",
                        device: deviceCodecs,
                        requested: requestedCodecs,
                    });
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
                // A deallocate the device refuses leaves this lease standing, which is the only record
                // that `camera_release_stream` may still free the stream.
                this.recordAllocation(nodeId, endpointId, {
                    kind: "snapshot",
                    streamId: snapshotStreamId,
                    allocatedByUs: true,
                });
                scope.returnAlways(() => this.#deallocate(nodeId, endpointId, "snapshot", snapshotStreamId));

                let captured: { data: Uint8Array; imageCodec: number; resolution: Resolution };
                try {
                    const captureResponse = await this.io.invoke({
                        nodeId,
                        endpointId,
                        cluster: "avsm",
                        command: "captureSnapshot",
                        fields: { snapshotStreamId, requestedResolution: capability.resolution },
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
                    captured = {
                        data: captureResponse.data,
                        imageCodec: captureResponse.imageCodec,
                        resolution: captureResponse.resolution,
                    };
                } catch (error) {
                    if (error instanceof ServerError) throw error;
                    const status = deviceStatusOf(error);
                    if (ladderReaction(status) === "rethrow") throw error;
                    throw this.snapshotFailure(state, status, deviceCodecs, requestedCodecs);
                }

                return {
                    data: captured.data,
                    imageCodec: captured.imageCodec,
                    resolution: captured.resolution,
                    downgraded: isDowngradeFrom(capability, bestWithFreeEncoder),
                };
            }),
        );
    }

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
            if (referenceCount > 0) {
                throw ServerError.cameraStreamInUse({ streamId, referenceCount });
            }
            if (!this.ownsStream(nodeId, endpointId, kind, streamId)) {
                throw ServerError.cameraStreamNotOwned({ streamId });
            }
            const { command, fields } = deallocateCall(kind, streamId);
            await this.io.invoke({ nodeId, endpointId, cluster: "avsm", command, fields });
            this.dropLease(nodeId, endpointId, kind, streamId);
        });
    }
}
