/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Behavior, EndpointNumber, Immutable, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import type { Specifier } from "@matter/main/protocol";
import { CameraAvStreamManagementClient } from "@matter/node/behaviors/camera-av-stream-management";
import { WebRtcTransportProviderClient } from "@matter/node/behaviors/web-rtc-transport-provider";
import type { ControllerCommandHandler } from "../controller/ControllerCommandHandler.js";
import type { CameraDeviceIo, CameraState } from "./CameraStreamManager.js";
import type { Resolution } from "./cameraTypes.js";

function toResolution(resolution: { width: number; height: number }): Resolution {
    return { width: resolution.width, height: resolution.height };
}

/** The real client behaviour state type, as `endpoint.stateOf(CameraAvStreamManagementClient)` returns it. */
type CameraAvStreamManagementClientState = Immutable<Behavior.StateOf<typeof CameraAvStreamManagementClient>>;

/**
 * The subset of `CameraAvStreamManagementClient`'s state this subsystem reads, `Pick`ed from the real
 * client state type rather than hand-mirrored: a hand-written type with every field optional does not
 * fail to compile when matter.js renames a field (it just reads `undefined` at runtime, silently), and
 * that is the exact class of bug this subsystem exists to prevent. Deriving the type instead means a
 * rename anywhere in the picked fields — top-level or nested — is a compile error in
 * {@link toCameraState}, since the field types are references to the real ones, not copies.
 */
export type RawCameraAvStreamManagementState = Pick<
    CameraAvStreamManagementClientState,
    | "maxConcurrentEncoders"
    | "maxEncodedPixelRate"
    | "maxNetworkBandwidth"
    | "videoSensorParams"
    | "hdrModeEnabled"
    | "minViewportResolution"
    | "rateDistortionTradeOffPoints"
    | "snapshotCapabilities"
    | "supportedStreamUsages"
    | "streamUsagePriorities"
    | "allocatedVideoStreams"
    | "allocatedAudioStreams"
    | "allocatedSnapshotStreams"
    | "microphoneCapabilities"
    | "twoWayTalkSupport"
>;

/**
 * Translate matter.js's typed client state into {@link CameraState}.
 *
 * VideoSensorParams carries no HDR-capability flag itself; `hdrModeEnabled` is a HighDynamicRange
 * feature-gated attribute, present only when the endpoint supports that feature, so its presence is
 * `hdrCapable`.
 */
export function toCameraState(state: RawCameraAvStreamManagementState): CameraState {
    return {
        maxConcurrentEncoders: state.maxConcurrentEncoders,
        maxEncodedPixelRate: state.maxEncodedPixelRate,
        maxNetworkBandwidth: state.maxNetworkBandwidth,
        videoSensorParams:
            state.videoSensorParams === undefined
                ? undefined
                : {
                      sensorWidth: state.videoSensorParams.sensorWidth,
                      sensorHeight: state.videoSensorParams.sensorHeight,
                      maxFps: state.videoSensorParams.maxFps,
                      maxHdrFps: state.videoSensorParams.maxHdrfps,
                      hdrCapable: state.hdrModeEnabled !== undefined,
                  },
        minViewportResolution:
            state.minViewportResolution === undefined ? undefined : toResolution(state.minViewportResolution),
        rateDistortionTradeOffPoints: (state.rateDistortionTradeOffPoints ?? []).map(point => ({
            codec: point.codec,
            resolution: toResolution(point.resolution),
            minBitRate: point.minBitRate,
        })),
        snapshotCapabilities: (state.snapshotCapabilities ?? []).map(capability => ({
            resolution: toResolution(capability.resolution),
            maxFrameRate: capability.maxFrameRate,
            imageCodec: capability.imageCodec,
            requiresEncodedPixels: capability.requiresEncodedPixels,
            // RequiresHardwareEncoder is optional (§11.2.6.9.5). The reference server reads absent as
            // "no hardware encoder": CameraAVStreamManagementCluster.cpp initialises
            // snapshotStreamArgs.hardwareEncoder to false and overwrites it only on HasValue().
            requiresHardwareEncoder: capability.requiresHardwareEncoder ?? false,
        })),
        supportedStreamUsages: [...state.supportedStreamUsages],
        streamUsagePriorities: [...state.streamUsagePriorities],
        allocatedVideoStreams: (state.allocatedVideoStreams ?? []).map(stream => ({
            videoStreamId: stream.videoStreamId,
            streamUsage: stream.streamUsage,
            videoCodec: stream.videoCodec,
            minResolution: toResolution(stream.minResolution),
            maxResolution: toResolution(stream.maxResolution),
            minFrameRate: stream.minFrameRate,
            maxFrameRate: stream.maxFrameRate,
            minBitRate: stream.minBitRate,
            maxBitRate: stream.maxBitRate,
            referenceCount: stream.referenceCount,
        })),
        allocatedAudioStreams: (state.allocatedAudioStreams ?? []).map(stream => ({
            audioStreamId: stream.audioStreamId,
            streamUsage: stream.streamUsage,
            audioCodec: stream.audioCodec,
            channelCount: stream.channelCount,
            sampleRate: stream.sampleRate,
            bitRate: stream.bitRate,
            bitDepth: stream.bitDepth,
            referenceCount: stream.referenceCount,
        })),
        allocatedSnapshotStreams: (state.allocatedSnapshotStreams ?? []).map(stream => ({
            snapshotStreamId: stream.snapshotStreamId,
            imageCodec: stream.imageCodec,
            resolution: toResolution(stream.maxResolution),
            referenceCount: stream.referenceCount,
        })),
        microphoneCapabilities:
            state.microphoneCapabilities === undefined
                ? undefined
                : {
                      supportedCodecs: [...state.microphoneCapabilities.supportedCodecs],
                      maxNumberOfChannels: state.microphoneCapabilities.maxNumberOfChannels,
                      supportedSampleRates: [...state.microphoneCapabilities.supportedSampleRates],
                      supportedBitDepths: [...state.microphoneCapabilities.supportedBitDepths],
                  },
        twoWayTalkSupport: state.twoWayTalkSupport,
    };
}

/**
 * Device access for the camera subsystem.
 *
 * State is read from typed behaviour state rather than the attribute cache: the cache flattens struct
 * fields to numeric tags for the Python-compatible wire protocol, so reading it in decision code
 * trades a compile error for a silent empty parse.
 */
export class MatterCameraDeviceIo implements CameraDeviceIo {
    readonly #handler: ControllerCommandHandler;

    constructor(handler: ControllerCommandHandler) {
        this.#handler = handler;
    }

    async readCameraState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState | undefined> {
        const node = this.#handler.getNode(nodeId).node;
        const endpoint = node.endpoints.for(endpointId);
        if (endpoint === undefined || !endpoint.behaviors.has(CameraAvStreamManagementClient)) {
            return undefined;
        }
        return toCameraState(endpoint.stateOf(CameraAvStreamManagementClient));
    }

    async missingCameraClusters(nodeId: NodeId, endpointId: EndpointNumber): Promise<number[]> {
        const endpoint = this.#handler.getNode(nodeId).node.endpoints.for(endpointId);
        const missing = new Array<number>();
        if (endpoint === undefined || !endpoint.behaviors.has(CameraAvStreamManagementClient)) {
            missing.push(CameraAvStreamManagement.Cluster.id);
        }
        if (endpoint === undefined || !endpoint.behaviors.has(WebRtcTransportProviderClient)) {
            missing.push(WebRtcTransportProvider.Cluster.id);
        }
        return missing;
    }

    async invoke(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        cluster: "avsm" | "webrtcProvider";
        command: string;
        fields: Record<string, unknown>;
    }): Promise<unknown> {
        if (args.cluster === "avsm") {
            const node = this.#handler.getNode(args.nodeId).node;
            // Widened to the generic cluster shape: the command name is validated by the manager, not
            // known at compile time, so it cannot be one of the concrete cluster's literal command keys.
            const cluster: Specifier.ClusterLike = CameraAvStreamManagement.Cluster;
            return this.#handler.invokeCommand(node, {
                endpoint: args.endpointId,
                cluster,
                command: args.command,
                fields: args.fields,
            });
        }

        if (args.command === "provideOffer" || args.command === "solicitOffer") {
            // Establishing a session (originatingEndpointId + local requestor upsertSession), not a
            // plain invoke: WebRtcTransportRequestorServer rejects Answer/ICECandidates NotFound for a
            // session it never stored, so a plain invoke here would return a session id whose signaling
            // can never be routed.
            return this.#handler.invokeWebRtcProviderCommand({
                nodeId: args.nodeId,
                endpointId: args.endpointId,
                commandName: args.command === "provideOffer" ? "ProvideOffer" : "SolicitOffer",
                fields: args.fields,
            });
        }

        const node = this.#handler.getNode(args.nodeId).node;
        const cluster: Specifier.ClusterLike = WebRtcTransportProvider.Cluster;
        const response = await this.#handler.invokeCommand(node, {
            endpoint: args.endpointId,
            cluster,
            command: args.command,
            fields: args.fields,
        });
        if (args.command === "endSession") {
            const sessionId = args.fields.webRtcSessionId;
            if (typeof sessionId === "number") {
                await this.#handler.removeTrackedWebRtcSession(sessionId);
            }
        }
        return response;
    }
}
