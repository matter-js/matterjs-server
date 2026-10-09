/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraStreamProvenance } from "@matter-server/ws-client";
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
    isDegradedFrom,
    selectSnapshotCapabilities,
    SNAPSHOT_QUALITY,
    usesHardwareEncoder,
} from "./snapshotPolicy.js";
import type { SnapshotCapability } from "./snapshotPolicy.js";
import {
    chooseEvictionVictim,
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    encodedPixelRate,
    findReusableVideoStream,
    freeEncodedPixelRate,
    satisfiesAudioCallerBounds,
    satisfiesVideoCallerBounds,
    statedHints,
    trackRequest,
    videoCallerBounds,
} from "./streamPolicy.js";
import type { AudioCallerBounds, AudioHints, RateDistortionPoint, TrackRequest, VideoHints } from "./streamPolicy.js";
import { firstVideoWindow, VideoWindowSearch } from "./videoWindowSearch.js";
import type { VideoRefusal } from "./videoWindowSearch.js";
import {
    audioCodecName,
    featureName,
    imageCodecName,
    knownVideoCodecs,
    streamUsageName,
    videoCodecName,
} from "./wireNames.js";

const logger = Logger.get("CameraStreamManager");

/** Allocate attempts per request, shared by the retry windows and eviction. Bounds how long the endpoint lock is held. */
export const MAX_ALLOCATE_ATTEMPTS = 16;

type LadderReaction =
    /** `unservable`: the device cannot serve this range; `capacity`: it has no room for it. */
    | VideoRefusal
    /** Malformed request (`min > max`, a field out of range, an unknown codec). No retry can fix it. */
    | "fail-incompatible"
    | "rethrow";

/** The single place a Matter status becomes a ladder decision (statuses per `CameraAVStreamManagementCluster.cpp`). */
function ladderReaction(status: number | undefined): LadderReaction {
    switch (status) {
        case Status.DynamicConstraintError:
            return "unservable";
        case Status.ResourceExhausted:
            return "capacity";
        case Status.ConstraintError:
            return "fail-incompatible";
        default:
            return "rethrow";
    }
}

/**
 * What an allocated stream delivers, not what was requested. `overlays` stays as the camera reports it,
 * so `#restoreFreedVideoStream` sends a conformant allocate.
 */
function envelopeOfVideoStream(stream: AllocatedVideoStream): VideoEnvelope {
    return {
        overlays: stream.overlays,
        codec: stream.videoCodec,
        minResolution: stream.minResolution,
        maxResolution: stream.maxResolution,
        minFrameRate: stream.minFrameRate,
        maxFrameRate: stream.maxFrameRate,
        minBitRate: stream.minBitRate,
        maxBitRate: stream.maxBitRate,
        keyFrameInterval: stream.keyFrameInterval,
    };
}

/** Stands in for the device's report until it arrives; the allocate response carries only the id. */
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
        keyFrameInterval: envelope.keyFrameInterval,
        referenceCount: 0,
        overlays: envelope.overlays,
    };
}

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

function existingStreamProvenance(allocatedByUs: boolean): CameraStreamProvenance {
    return allocatedByUs ? "reused" : "adopted";
}

function envelopeOfAudioStream(stream: AllocatedAudioStream): AudioEnvelope {
    return {
        codec: stream.audioCodec,
        channelCount: stream.channelCount,
        sampleRate: stream.sampleRate,
        bitRate: stream.bitRate,
        bitDepth: stream.bitDepth,
    };
}

/** WebRTCEndReasonEnum has no value for "the client stopped watching"; UserHangup is the closest. */
const WEBRTC_END_REASON_USER_HANGUP = WebRtcTransportDefinitions.WebRtcEndReason.UserHangup;

/**
 * `device` reports the set before this narrowing, not the camera's full list: the offer may already have
 * ruled codecs out.
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
 * The device's rate-distortion codecs, narrowed by what the offer can decode, then by the caller's
 * preference. Either narrowing throws when it leaves nothing. A camera with no trade-off points falls
 * back to every known codec.
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
            // The codec matches but its decode ceiling is unreadable: a level problem, not a codec one.
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
        // The caller's order wins over the device's.
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

/** The snapshot counterpart of {@link allocatedVideoStream}. */
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
        quality: SNAPSHOT_QUALITY,
        referenceCount: 0,
        frameRate: capability.maxFrameRate,
        encodedPixels: capability.requiresEncodedPixels,
        hardwareEncoder: usesHardwareEncoder(capability),
    };
}

/**
 * Snapshot streams holding a hardware encoder (§11.2.6.13.9). The snapshot call never deallocates them,
 * so a capacity refusal names them: they are often the only thing a client can release.
 */
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
 * How long a stream this server allocated may be reused before the device reports it in
 * `Allocated*Streams`, so a second request in that gap does not allocate a twin.
 */
export const UNREPORTED_LEASE_GRACE_MS = 10000;

interface ScopedReturn {
    readonly give: () => Promise<unknown>;
    /** Whether the request's outcome leaves this effect to be given back. */
    readonly due: (succeeded: boolean) => boolean;
}

/**
 * The device effects of one request, each with its way back. Register an effect where it happens, never
 * at an exit: {@link CameraStreamManager.withAllocationScope} settles on every exit, so no exit forgets an
 * effect and no effect that never happened is given back.
 */
class AllocationScope {
    readonly #returns = new Array<ScopedReturn>();

    /** Give this back unless the request succeeds; on success the caller holds the ids and releases them. */
    returnOnFailure(give: () => Promise<unknown>): void {
        this.#returns.push({ give, due: succeeded => !succeeded });
    }

    /**
     * Give this back unless the request both spends it and succeeds; the returned callback records the
     * spending. Success means the whole request's: an allocate can succeed and the request still fail.
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
     * Run what is due, newest first: a session must end before its streams are deallocated (the device
     * refuses at `ReferenceCount > 0`). The chain shares one {@link DEVICE_CLEANUP_BUDGET_MS} budget;
     * streams left behind stay leased and releasable via `camera_release_stream`.
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

/** The AVSM state the policy needs: attributes from `stateOf` plus the global `FeatureMap` from `globalsOf`. */
export interface CameraState {
    features: CameraFeatures;
    privacy: CameraPrivacyState;
    maxConcurrentEncoders?: number;
    maxEncodedPixelRate?: number;
    /** MaxNetworkBandwidth (§11.2.7.12), bits per second. */
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
     * Undefined when the endpoint does not expose AVSM. Called (like {@link invoke}) under the manager's
     * endpoint lock: calling back into the manager for the same endpoint deadlocks.
     */
    readCameraState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState | undefined>;
    /** As `camera_not_supported` reports them; empty when the endpoint exposes AVSM and the WebRTC provider. */
    missingCameraClusters(nodeId: NodeId, endpointId: EndpointNumber): Promise<number[]>;
    /**
     * The provider's `CurrentSessions`, so it includes sessions from earlier process runs. Undefined
     * without a provider.
     */
    readWebRtcSessions(nodeId: NodeId, endpointId: EndpointNumber): Promise<DeviceWebRtcSession[] | undefined>;
    invoke(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        cluster: "avsm" | "webrtcProvider";
        command: string;
        fields: Record<string, unknown>;
        /**
         * `provideOffer` / `solicitOffer` only: called with the provider's session id before the local
         * requestor gets the session, so before any `End` for it can be routed.
         */
        sessionEstablishing?: (webRtcSessionId: number) => void;
    }): Promise<unknown>;
}

export interface CameraCapabilities {
    /** The features the camera advertises; absent (not empty) when it has not stated its feature map. */
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
    /** The sessions the camera reports for this fabric. Also empty when the endpoint has no WebRTC provider. */
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
 * A track's stream, or why there is none. Only {@link CameraStreamManager.resolveTrack} decides whether
 * no stream is a failure.
 */
export type TrackOutcome = { readonly stream: ResolvedStream } | { readonly unavailable: unknown };

export interface StartStreamResult {
    webRtcSessionId: number;
    mode: "solicit_offer" | "provide_offer";
    video?: ResolvedStream;
    audio?: ResolvedStream;
}

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
    provenance: CameraStreamProvenance;
}

export class CameraStreamManager {
    readonly #io: CameraDeviceIo;
    readonly #leases = new Map<string, StreamLease[]>();
    readonly #locks = new Map<string, Promise<unknown>>();
    /** Camera effects no client's own response reports. Must be declared before `#sessions`, which emits into it. */
    readonly events = {
        sessionEnded: new Observable<[CameraSessionEnded], MaybePromise<void>>(),
        streamEvicted: new Observable<[CameraStreamEvicted], MaybePromise<void>>(),
    };
    readonly #sessions = new CameraSessionRegistry(ended => this.#announce(this.events.sessionEnded, ended));
    #nextLeaseGeneration = 0;

    constructor(io: CameraDeviceIo) {
        this.#io = io;
    }

    /** matter.js `Observable.emit` rethrows observer errors; a failing listener must not fail the caller. */
    #announce<T>(observable: Observable<[T], MaybePromise<void>>, event: T): void {
        MaybePromise.catch(
            () => observable.emit(event),
            error => logger.warn("A listener of a camera event failed:", error),
        );
    }

    /** Serializes work per endpoint, so concurrent starts cannot both miss a reusable stream and allocate twins. */
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
     * Record a stream this server just allocated, replacing any earlier lease for the id: the device
     * reissues freed ids, and the last statement about an id is the true one.
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
     * Record a stream handed out without allocating it now. A new lease is marked reported (it came from
     * device state); an existing lease keeps its grace window and reported flag.
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
     * Line the leases up with what the device reports. A lease the device named and then stopped naming
     * is dropped. A lease it never named lives for the process run: silence is no evidence the stream is
     * gone, and dropping it would lose the record that this server may give the stream back.
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
     * Video streams this server allocated that `reported` does not name yet. Past
     * {@link UNREPORTED_LEASE_GRACE_MS} they are left out: the camera has more likely dropped the stream.
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
     * Drop this lease unless the id was re-leased since. A give-back abandoned by the cleanup budget can
     * land after the lock is gone, when the reissued id may belong to a later request's stream.
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

    /** Returns whether this server allocated the stream. */
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

    /** Device state, or a typed failure when the endpoint cannot stream. Also reconciles the leases. */
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
     * {@link requireState} for a call that will establish a WebRTC session. Checks the clusters first, so
     * a provider-less endpoint never gets a stream allocated.
     */
    protected async requireStreamingState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState> {
        const missingClusters = await this.#io.missingCameraClusters(nodeId, endpointId);
        if (missingClusters.length > 0) {
            throw ServerError.cameraNotSupported({ missingClusters });
        }
        return this.requireState(nodeId, endpointId);
    }

    /**
     * The typed privacy refusal behind a device `INVALID_IN_STATE`, or `error` unchanged. That status has
     * other causes too (§11.5.6.1.10, §11.5.6.3.12, §11.2.8.13.3), so the switches, read after the
     * refusal, decide. Never checked before the invoke: a stale "on" would block a call the device accepts.
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
            // The device's refusal is the answer; a failed read must not replace it.
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
     * The stream for a track, or undefined. A declined or unstated track may be absent; a demanded one
     * (present in the request, even empty) throws the reason instead.
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

    /** Run `work` and, on every exit, give back what it caused but may not keep. See {@link AllocationScope}. */
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
     * Body of {@link resolveVideoStream}. The caller holds the endpoint lock and owns the scope, so
     * `startStream` can resolve video, audio and the offer under one lock and one scope.
     *
     * Rungs, cheapest for everyone first: reuse, allocate within the remaining encoder budget, narrow,
     * evict an unused stream (only with `allowEviction`, default true), then hand out a stream that meets
     * the caller's bounds but not the envelope, flagged `degraded`. No rung gives up the caller's bounds
     * (`videoCallerBounds`).
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
            // Sending the field without the feature is INVALID_COMMAND (§11.2.8.4, conformance WMARK / OSD).
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
        // Ladder-local copies; freeing updates these, never `state`. Unreported snapshot streams count
        // because the report lags a `camera_snapshot` followed by `camera_start_stream`.
        let liveStreams = state.allocatedVideoStreams;
        let liveSnapshotStreams = [
            ...state.allocatedSnapshotStreams,
            ...this.unreportedSnapshotStreams(nodeId, endpointId, state.allocatedSnapshotStreams),
        ];
        // Never freed or listed as occupying: only the device can state their reference counts.
        const unreported = this.unreportedVideoStreams(nodeId, endpointId, liveStreams);

        const bounds = videoCallerBounds(args.limits, streamUsage, args.hints);
        // Unreported allocations count, so the free budget is not overstated.
        const fitsBudget =
            (without?: AllocatedVideoStream) =>
            (window: VideoEnvelope): boolean => {
                const free = freeEncodedPixelRate({
                    maxEncodedPixelRate: state.maxEncodedPixelRate,
                    videoStreams: [...liveStreams, ...unreported].filter(stream => stream !== without),
                    snapshotStreams: liveSnapshotStreams,
                });
                return free === undefined || encodedPixelRate(window) <= free;
            };
        const reused = findReusableVideoStream(
            [...liveStreams, ...unreported],
            selection.plan,
            bounds,
            candidate => firstVideoWindow(selection.plan, fitsBudget(candidate)).maxFrameRate,
        );
        if (reused !== undefined) {
            return {
                streamId: reused.videoStreamId,
                envelope: envelopeOfVideoStream(reused),
                provenance: existingStreamProvenance(this.leaseReusedVideoStream(nodeId, endpointId, reused)),
            };
        }

        const search = new VideoWindowSearch(selection.plan, fitsBudget());

        // A stream the degraded rung could hand out is never evicted for the same request. Each candidate
        // is tried once, freed or not, so the candidate lists strictly shrink.
        let videoCandidates = liveStreams.filter(stream => !satisfiesVideoCallerBounds(stream, bounds));
        let snapshotCandidates = liveSnapshotStreams;

        let lastStatus: number | undefined;
        const freed = new Array<() => void>();
        const evicted = new Array<number>();
        const reporting = (resolved: ResolvedStream): ResolvedStream =>
            evicted.length === 0 ? resolved : { ...resolved, evicted };
        /** Frees one stream this request may take; false when no candidate is left. */
        const makeRoom = async (): Promise<boolean> => {
            // Our own snapshot streams go first: StreamUsagePriorities ranks video usages only.
            for (;;) {
                const room = await this.freeOwnSnapshotStream(
                    nodeId,
                    endpointId,
                    snapshotCandidates,
                    state.maxEncodedPixelRate,
                    scope,
                );
                if (room === undefined) break;
                snapshotCandidates = snapshotCandidates.filter(stream => stream.snapshotStreamId !== room.streamId);
                if (room.freed) {
                    liveSnapshotStreams = liveSnapshotStreams.filter(
                        stream => stream.snapshotStreamId !== room.streamId,
                    );
                    freed.push(room.spend);
                    return true;
                }
            }
            for (;;) {
                const room = await this.freeAnUnreferencedVideoStream(
                    nodeId,
                    endpointId,
                    videoCandidates,
                    state.streamUsagePriorities,
                    scope,
                );
                if (room === undefined) return false;
                videoCandidates = videoCandidates.filter(stream => stream.videoStreamId !== room.streamId);
                if (room.freed) {
                    liveStreams = liveStreams.filter(stream => stream.videoStreamId !== room.streamId);
                    freed.push(room.spend);
                    evicted.push(room.streamId);
                    return true;
                }
            }
        };
        for (let attempts = 0; ;) {
            const move = search.move;
            if (move.kind === "giveUp") break;
            if (move.kind === "makeRoom") {
                // No allocate follows the last attempt, so making room there would be for nothing.
                if (allowEviction && attempts < MAX_ALLOCATE_ATTEMPTS && (await makeRoom())) {
                    search.roomMade();
                } else {
                    search.noRoom();
                }
                continue;
            }
            if (attempts === MAX_ALLOCATE_ATTEMPTS) break;
            attempts += 1;
            const envelope = move.window;
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
                    // Without the id the stream cannot be given back.
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
                const budgetNarrowed = search.budgetNarrowing(envelope);
                return reporting({
                    streamId,
                    envelope,
                    provenance: "allocated",
                    ...(budgetNarrowed === undefined ? {} : { budgetNarrowed }),
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
                search.refused(reaction);
            }
        }

        // Last rung: gives up the computed envelope, never the caller's bounds.
        const degraded = findDegradedVideoStream([...liveStreams, ...unreported], bounds);
        if (degraded !== undefined) {
            return reporting({
                streamId: degraded.videoStreamId,
                envelope: envelopeOfVideoStream(degraded),
                degraded: true,
                provenance: existingStreamProvenance(this.leaseReusedVideoStream(nodeId, endpointId, degraded)),
            });
        }

        if (search.outcome === "unservable") {
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
                // The ladder's list, so a snapshot stream this request freed is not named.
                ...encoderHoldingSnapshotStreams(liveSnapshotStreams),
            ],
            maxConcurrentEncoders: state.maxConcurrentEncoders,
            maxEncodedPixelRate: state.maxEncodedPixelRate,
        });
    }

    /** `audio`: `false` declines, absent defers, an object demands, as on `camera_start_stream`. */
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
     * Body of {@link resolveAudioStream}; the caller holds the endpoint lock and owns the scope. No
     * narrowing ladder. Dead ends that still allow a video-only session are returned as `unavailable`. A
     * caller-stated value the camera cannot serve throws and is never replaced; so does a `ServerError`.
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
        // The offer's refusal is answered before anything the camera states.
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
            // Without the Audio feature, `AudioStreamAllocate` is not in the AcceptedCommandList even if
            // MicrophoneCapabilities is reported.
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
            // `device` is the camera's full list; the narrowed one is empty here by definition.
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
                    provenance: existingStreamProvenance(this.leaseReusedAudioStream(nodeId, endpointId, existing)),
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
            return { stream: { streamId, envelope, provenance: "allocated" } };
        } catch (error) {
            if (error instanceof ServerError) throw error;
            const status = deviceStatusOf(error);
            if (ladderReaction(status) === "rethrow") return { unavailable: error };
            if (ladderReaction(status) === "capacity") {
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
     * Deallocate one unreferenced video stream from `streams` (victim per {@link chooseEvictionVictim})
     * and return its id, or `undefined` if nothing was freed.
     *
     * Registered with `scope` via `returnUnlessSpent`: unless the request spends the capacity and
     * succeeds, an equivalent stream is allocated back under a new id.
     */
    protected async freeAnUnreferencedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        streams: AllocatedVideoStream[],
        priorities: number[],
        scope: AllocationScope,
    ): Promise<{ streamId: number; freed: boolean; spend: () => void } | undefined> {
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
            return { streamId: victim.videoStreamId, freed: false, spend: () => {} };
        }
        this.dropLease(nodeId, endpointId, "video", victim.videoStreamId);
        this.#announce(this.events.streamEvicted, {
            nodeId,
            endpointId,
            kind: "video",
            streamId: victim.videoStreamId,
        });
        const spend = scope.returnUnlessSpent(() =>
            this.#restoreFreedVideoStream(nodeId, endpointId, victim).catch(error => {
                logger.warn(
                    `Could not allocate a replacement for video stream ${victim.videoStreamId} on node ${nodeId}, which was deallocated to make room the request did not use; the camera is one stream poorer:`,
                    error,
                );
            }),
        );
        return { streamId: victim.videoStreamId, freed: true, spend };
    }

    /**
     * Deallocate one snapshot stream {@link ownsSnapshotStream} claims (victim per
     * {@link chooseSnapshotStreamToFree}). `undefined`: none worth taking; `freed: false`: the camera
     * refused. Registered with `scope` like {@link freeAnUnreferencedVideoStream}.
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
            // Only NotFound proves the stream is gone; any other status keeps the lease.
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
     * Whether a reported snapshot stream is one this server allocated. Stricter than {@link ownsStream}:
     * the reported parameters must match the lease, because a reissued id alone can name another
     * controller's stream.
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
     * The snapshot counterpart of {@link #restoreFreedVideoStream}. The struct's `frameRate`
     * (§11.2.6.13.3) is what the allocate takes as `MaxFrameRate`.
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
                quality: freed.quality,
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
     * Allocate a stream with the parameters of one the make-room rung took, when the request did not use
     * the capacity. Not an undo: the camera issues a new id, and the old one stays forgotten. The
     * replacement is leased as ours whoever allocated the original.
     */
    async #restoreFreedVideoStream(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        freed: AllocatedVideoStream,
    ): Promise<void> {
        const envelope = envelopeOfVideoStream(freed);
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

    /** The `SolicitOffer` / `ProvideOffer` that establishes the session, with privacy refusals typed. */
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
                // Must record the id before the local requestor can route an `End` for it.
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
        // Before the first await, so a connection closing from here on claims this registration.
        const pending = this.#sessions.begin(nodeId, endpointId, args.connectionId);
        try {
            // One lock through the offer: ReferenceCount rises only at session establishment, so until
            // then another request could evict the stream this call resolved.
            return await this.withEndpointLock(nodeId, endpointId, async () => {
                const state = await this.requireStreamingState(nodeId, endpointId);
                return this.withAllocationScope(scope => this.#establishSession(pending, args, state, sdp, scope));
            });
        } finally {
            this.#sessions.finish(pending);
        }
    }

    /**
     * Body of {@link startStream}, inside the endpoint lock, the registration and the scope. Gives
     * nothing back itself: every effect is registered with `scope` where it happens.
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
                // A stream the peer cannot receive would hold an encoder for nothing.
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
                // `VideoStreamAllocate` is not in such a camera's AcceptedCommandList.
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
            // Without an id the session can never be ended, so the device refuses the deallocates registered above.
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
            // Not announced: the session never reached the registry.
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
     * Give a stream back on a failure path. The lease is dropped on success or `NOT_FOUND`
     * (§11.2.8.7.2, §11.2.8.3.2, §11.2.8.10.2). Any other failure is logged, not raised, and the lease
     * stays so `camera_release_stream` can still reach the stream.
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
     * The one path that ends a session: `EndSession` on the device, then the registry entry. Returns
     * whether the device still had the session. A failed invoke keeps the entry, so a later stop,
     * disconnect or shutdown can retry; {@link invokeEndSession} decides the `NotFound` case.
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
     * Ends the session on the device; the allocation is kept. Returns false when the device answers
     * `NotFound`. A failed `EndSession` is raised, also when this call joined one another path sent.
     * Tracked ids share one `EndSession` through the registry; untracked ids are sent directly.
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
     * End a session this process run has no record of (for example one from before a restart). Sent
     * unconditionally: `EndSession` (§11.5.6.7.3) fails `NOT_FOUND` unless fabric and `PeerNodeID`
     * match, so it can only end a session of this server.
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
        // Even without an entry: a registration in flight may hold this id, and `track` must refuse it.
        this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
        this.#announceUntrackedEnd(nodeId, endpointId, webRtcSessionId, requestedBy);
        return true;
    }

    /**
     * Report a session this server ended but holds no record of. Announced with no owner ("tell
     * everyone"), since nothing names its connection. Call only when the camera held the session.
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
     * Stop tracking a session the peer ended, without invoking `EndSession`. Not announced: the peer's
     * `End` already reaches the owner as a `webrtc_callback` event. A client's own `EndSession` goes
     * through {@link endedByClient}.
     */
    forgetSession(nodeId: NodeId, endpointId: EndpointNumber, webRtcSessionId: number): boolean {
        return this.#sessions.forget(nodeId, endpointId, webRtcSessionId);
    }

    /**
     * Drop the record of a session a client's own `EndSession` (via `device_command`) ended, and
     * announce it as {@link stopStream} does: to the entry's owner naming `requestedBy`, or with no
     * owner for an untracked id.
     *
     * `deviceHeldSession`: whether the camera had the session. On `NotFound` a tracked entry is still
     * dropped and announced; an untracked id is not announced.
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

    /** End every session a closing connection owned; only `EndSession` lowers a stream's ReferenceCount. */
    async releaseConnection(connectionId: string): Promise<void> {
        await this.#releaseSessions(scope => scope.connectionId === connectionId);
    }

    /** Ends every tracked session regardless of owner. Used at shutdown, for {@link releaseConnection}'s reason. */
    async stopAll(): Promise<void> {
        await this.#releaseSessions(() => true);
    }

    /**
     * End every session in scope, including ones still being established (claimed registrations end
     * themselves inside `startStream`; this waits for them). Concurrent and bounded by
     * {@link DEVICE_CLEANUP_BUDGET_MS}, so one silent camera cannot spend the others' budget. An
     * abandoned `EndSession` keeps its entry; a later pass joins it rather than sending a second.
     */
    async #releaseSessions(matches: (scope: SessionScope) => boolean): Promise<void> {
        const inFlight = this.#sessions.claim(matches, session =>
            this.#endSession(session, undefined).catch(error => {
                logger.warn(`Failed to end session ${session.webRtcSessionId} on node ${session.nodeId}:`, error);
                // Rethrown so a joined `camera_stop_stream` learns the session is still open.
                throw error;
            }),
        );
        if (inFlight.length === 0) return;
        await withCleanupBudget("ending the sessions a connection or the server owned", async () => {
            await Promise.allSettled(inFlight);
        });
    }

    /**
     * The typed 102/103 error for a refused snapshot. A capacity refusal names every encoder holder:
     * the video streams and the `HardwareEncoder` snapshot streams.
     */
    protected snapshotFailure(
        state: CameraState,
        deviceStatus: number | undefined,
        deviceCodecs: string[],
        requestedCodecs: string[],
    ): ServerError {
        if (ladderReaction(deviceStatus) === "capacity") {
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
     * One still frame from a snapshot stream the camera keeps. Adopts a reported stream within the
     * caller's bounds, whoever allocated it (§11.2.1.1 asks controllers to avoid allocate churn);
     * otherwise allocates one and leases it as ours. A successful call never deallocates, so
     * `snapshotStreamId` always names a stream the camera holds, for `camera_release_stream`.
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
                    // Even with SnapshotCapabilities reported, `SnapshotStreamAllocate` is not accepted.
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
                    // Unreported allocations count, so a stream allocated moments ago is not missed.
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
                    // Only reachable when the camera advertises no snapshot capability.
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
                            degraded: isDegradedFrom(captured.resolution, bestWithinCallerBounds),
                            snapshotStreamId: adopted.snapshotStreamId,
                            provenance: existingStreamProvenance(
                                this.ownsStream(nodeId, endpointId, "snapshot", adopted.snapshotStreamId),
                            ),
                        };
                    }
                    logger.info(
                        `Node ${nodeId} no longer has snapshot stream ${adopted.snapshotStreamId} its reported state still lists; allocating one instead`,
                    );
                }

                // The device answers DynamicConstraintError when no SnapshotCapabilities entry matches,
                // so the next capability is the only retry that can succeed.
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
                                quality: SNAPSHOT_QUALITY,
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
                    // §11.2.8.8.6 keys the may-ignore on RequiresHardwareEncoder alone, not on `usesHardwareEncoder`.
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
                // A failed call names no stream id, so this is the stream's only way back.
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
                    degraded: isDegradedFrom(captured.resolution, bestWithinCallerBounds),
                    snapshotStreamId,
                    provenance: "allocated",
                };
            }),
        );
    }

    /**
     * {@link #captureSnapshot} on an adopted stream, or undefined on NOT_FOUND (§11.2.8.13.3): the
     * cached state may still list a stream deallocated since, and the device's answer decides.
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
     * Deallocate one stream, forwarding the camera's answer with no refusal of its own (§11.2.8.7.2,
     * §11.2.8.3.2, §11.2.8.10.2). The cached reference count can lag, so it only enriches the
     * INVALID_IN_STATE error.
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
                // The reference answers INVALID_IN_STATE only for ReferenceCount > 0
                // (`CameraAVStreamManagementCluster.h`, `ValidateStreamForModifyOrDeallocateImpl`);
                // the cause is kept for cameras that answer it for another reason.
                if (status === Status.InvalidInState) {
                    throw ServerError.cameraStreamInUse(
                        { streamId, ...(referenceCount > 0 ? { referenceCount } : {}) },
                        error instanceof Error ? error : undefined,
                    );
                }
                if (status === Status.NotFound) this.dropLease(nodeId, endpointId, kind, streamId);
                throw error;
            }
            this.dropLease(nodeId, endpointId, kind, streamId);
        });
    }
}
