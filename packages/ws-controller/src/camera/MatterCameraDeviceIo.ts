/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EndpointNumber, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import type { Specifier } from "@matter/main/protocol";
import { CameraAvStreamManagementClient } from "@matter/node/behaviors/camera-av-stream-management";
import type { ControllerCommandHandler } from "../controller/ControllerCommandHandler.js";
import { selectWebRtcStreamFields } from "../controller/webRtcSessionStreams.js";
import type { CameraDeviceIo, CameraState } from "./CameraStreamManager.js";
import type { Resolution } from "./cameraTypes.js";

function toResolution(resolution: { width: number; height: number }): Resolution {
    return { width: resolution.width, height: resolution.height };
}

/**
 * The subset of `CameraAvStreamManagementClient`'s state this subsystem reads, spelled out explicitly
 * (rather than inferred from `stateOf`) so the translation in {@link toCameraState} is unit-testable
 * without a live matter.js node. List attributes are `readonly` and feature-gated attributes are
 * optional on the real client state; both are modelled here the same way.
 */
export interface RawCameraAvStreamManagementState {
    maxConcurrentEncoders?: number;
    maxEncodedPixelRate?: number;
    videoSensorParams?: {
        sensorWidth: number;
        sensorHeight: number;
        maxFps: number;
        // Real attribute name; CameraState spells it maxHdrFps.
        maxHdrfps?: number;
    };
    minViewportResolution?: { width: number; height: number };
    rateDistortionTradeOffPoints?: readonly {
        codec: number;
        resolution: { width: number; height: number };
        minBitRate: number;
    }[];
    snapshotCapabilities?: readonly {
        resolution: { width: number; height: number };
        maxFrameRate: number;
        imageCodec: number;
        requiresEncodedPixels: boolean;
        requiresHardwareEncoder?: boolean;
    }[];
    supportedStreamUsages: readonly number[];
    streamUsagePriorities: readonly number[];
    allocatedVideoStreams?: readonly {
        videoStreamId: number;
        streamUsage: number;
        videoCodec: number;
        minResolution: { width: number; height: number };
        maxResolution: { width: number; height: number };
        minFrameRate: number;
        maxFrameRate: number;
        minBitRate: number;
        maxBitRate: number;
        referenceCount: number;
    }[];
    allocatedAudioStreams?: readonly {
        audioStreamId: number;
        streamUsage: number;
        audioCodec: number;
        channelCount: number;
        sampleRate: number;
        bitRate: number;
        bitDepth: number;
        referenceCount: number;
    }[];
    // The real SnapshotStream struct has independent min/max resolution; AllocatedSnapshotStream
    // carries one resolution (this server always allocates them equal — see CameraStreamManager.snapshot).
    allocatedSnapshotStreams?: readonly {
        snapshotStreamId: number;
        imageCodec: number;
        maxResolution: { width: number; height: number };
        referenceCount: number;
    }[];
    microphoneCapabilities?: {
        supportedCodecs: readonly number[];
        maxNumberOfChannels: number;
        supportedSampleRates: readonly number[];
        supportedBitDepths: readonly number[];
    };
    twoWayTalkSupport?: number;
}

/**
 * Translate matter.js's typed client state into {@link CameraState}.
 *
 * VideoSensorParams carries no HDR-capability flag at all — HighDynamicRange support is a feature bit,
 * not a struct field — so `hdrCapable` is reported absent rather than guessed from an unrelated
 * attribute.
 */
export function toCameraState(state: RawCameraAvStreamManagementState): CameraState {
    return {
        maxConcurrentEncoders: state.maxConcurrentEncoders,
        maxEncodedPixelRate: state.maxEncodedPixelRate,
        videoSensorParams:
            state.videoSensorParams === undefined
                ? undefined
                : {
                      sensorWidth: state.videoSensorParams.sensorWidth,
                      sensorHeight: state.videoSensorParams.sensorHeight,
                      maxFps: state.videoSensorParams.maxFps,
                      maxHdrFps: state.videoSensorParams.maxHdrfps,
                      hdrCapable: undefined,
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

    async invoke(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        cluster: "avsm" | "webrtcProvider";
        command: string;
        fields: Record<string, unknown>;
    }): Promise<unknown> {
        const node = this.#handler.getNode(args.nodeId).node;
        if (args.cluster === "avsm") {
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

        const fields = { ...args.fields };
        // A provider fails ProvideOffer with InvalidCommand when the singular stream ids and the
        // revision-2 lists are both present; this narrows to the set the provider's revision expects.
        selectWebRtcStreamFields(fields, this.#handler.webRtcProviderClusterRevision(args.nodeId, args.endpointId));
        const cluster: Specifier.ClusterLike = WebRtcTransportProvider.Cluster;
        return this.#handler.invokeCommand(node, {
            endpoint: args.endpointId,
            cluster,
            command: args.command,
            fields,
        });
    }
}
