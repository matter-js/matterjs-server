/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, type Behavior, type EndpointNumber, type Immutable, type NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import { Read, type Specifier } from "@matter/main/protocol";
import type { Endpoint } from "@matter/node";
import { CameraAvStreamManagementClient } from "@matter/node/behaviors/camera-av-stream-management";
import { WebRtcTransportProviderClient } from "@matter/node/behaviors/web-rtc-transport-provider";
import type { ControllerCommandHandler } from "../controller/ControllerCommandHandler.js";
import { resolveWebRtcSessionStreams } from "../controller/webRtcSessionStreams.js";
import { dropWebRtcSessionTracking, invokeEndSession } from "../controller/webRtcSessionTracking.js";
import type { CameraDeviceIo, CameraState } from "./CameraStreamManager.js";
import type { CameraFeatures, DeviceWebRtcSession, Resolution } from "./cameraTypes.js";

const logger = Logger.get("MatterCameraDeviceIo");

type StreamListAttribute = "allocatedVideoStreams" | "allocatedAudioStreams" | "allocatedSnapshotStreams";

const STREAM_LIST_OF_COMMAND = new Map<string, StreamListAttribute>([
    ["videoStreamAllocate", "allocatedVideoStreams"],
    ["videoStreamDeallocate", "allocatedVideoStreams"],
    ["audioStreamAllocate", "allocatedAudioStreams"],
    ["audioStreamDeallocate", "allocatedAudioStreams"],
    ["snapshotStreamAllocate", "allocatedSnapshotStreams"],
    ["snapshotStreamDeallocate", "allocatedSnapshotStreams"],
]);

function toResolution(resolution: { width: number; height: number }): Resolution {
    return { width: resolution.width, height: resolution.height };
}

type CameraAvStreamManagementClientState = Immutable<Behavior.StateOf<typeof CameraAvStreamManagementClient>>;

/** Keep it `Pick`ed from the real state type so a matter.js rename is a compile error, not a silent `undefined`. */
export type RawCameraAvStreamManagementState = Pick<
    CameraAvStreamManagementClientState,
    | "maxConcurrentEncoders"
    | "maxEncodedPixelRate"
    | "maxNetworkBandwidth"
    | "videoSensorParams"
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
    | "softRecordingPrivacyModeEnabled"
    | "softLivestreamPrivacyModeEnabled"
    | "hardPrivacyModeOn"
>;

export function toCameraState(state: RawCameraAvStreamManagementState, features: CameraFeatures): CameraState {
    return {
        features,
        privacy: {
            softRecordingModeEnabled: state.softRecordingPrivacyModeEnabled,
            softLivestreamModeEnabled: state.softLivestreamPrivacyModeEnabled,
            hardModeOn: state.hardPrivacyModeOn,
        },
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
                      hdrCapable: features.highDynamicRange,
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
            // Optional (§11.2.6.9.5); absent is false, as in the reference server.
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
            keyFrameInterval: stream.keyFrameInterval,
            referenceCount: stream.referenceCount,
            // Not defaulted: see AllocatedVideoStream.
            overlays: { watermarkEnabled: stream.watermarkEnabled, osdEnabled: stream.osdEnabled },
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
            minResolution: toResolution(stream.minResolution),
            maxResolution: toResolution(stream.maxResolution),
            quality: stream.quality,
            referenceCount: stream.referenceCount,
            frameRate: stream.frameRate,
            encodedPixels: stream.encodedPixels,
            hardwareEncoder: stream.hardwareEncoder,
            overlays: { watermarkEnabled: stream.watermarkEnabled, osdEnabled: stream.osdEnabled },
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

export class MatterCameraDeviceIo implements CameraDeviceIo {
    readonly #handler: ControllerCommandHandler;

    constructor(handler: ControllerCommandHandler) {
        this.#handler = handler;
    }

    #endpoint(nodeId: NodeId, endpointId: EndpointNumber): Endpoint | undefined {
        const { endpoints } = this.#handler.getNode(nodeId);
        return endpoints.has(endpointId) ? endpoints.for(endpointId) : undefined;
    }

    async readCameraState(nodeId: NodeId, endpointId: EndpointNumber): Promise<CameraState | undefined> {
        const endpoint = this.#endpoint(nodeId, endpointId);
        if (endpoint === undefined || !endpoint.behaviors.has(CameraAvStreamManagementClient)) {
            return undefined;
        }
        // `stateOf` does not carry global attributes such as the feature map.
        return toCameraState(
            endpoint.stateOf(CameraAvStreamManagementClient),
            endpoint.globalsOf(CameraAvStreamManagementClient).featureMap,
        );
    }

    /** Stream ids come from both the revision-2 lists and the deprecated revision-1 fields (§11.4.5.5). */
    async readWebRtcSessions(nodeId: NodeId, endpointId: EndpointNumber): Promise<DeviceWebRtcSession[] | undefined> {
        const endpoint = this.#endpoint(nodeId, endpointId);
        if (endpoint === undefined || !endpoint.behaviors.has(WebRtcTransportProviderClient)) return undefined;
        const localNodeId = this.#handler.localNodeId;
        return endpoint.stateOf(WebRtcTransportProviderClient).currentSessions.map(session => ({
            webRtcSessionId: session.id,
            peerNodeId: session.peerNodeId,
            peerEndpointId: session.peerEndpointId,
            streamUsage: session.streamUsage,
            videoStreamIds: resolveWebRtcSessionStreams(session.videoStreams, session.videoStreamId, undefined) ?? [],
            audioStreamIds: resolveWebRtcSessionStreams(session.audioStreams, session.audioStreamId, undefined) ?? [],
            establishedByThisServer: session.peerNodeId === localNodeId,
        }));
    }

    /**
     * Read a stream list now. The camera answers the command before it reports the changed list, so
     * without this read the next request sees a freed stream as still allocated.
     */
    async #refreshStreamList(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        attribute: StreamListAttribute,
    ): Promise<void> {
        // Fabric-filtered like the subscription: matter.js only applies a read to the cache when the filters match.
        const read = Read(
            { fabricFilter: true },
            Read.Attribute({ endpoint: endpointId, cluster: CameraAvStreamManagement, attributes: attribute }),
        );
        try {
            for await (const chunk of this.#handler.getNode(nodeId).interaction.read(read)) {
                for await (const _entry of chunk);
            }
        } catch (error) {
            // The command succeeded; the subscription report will still bring the list up to date.
            logger.warn(
                `Node ${nodeId} endpoint ${endpointId}: reading ${attribute} after the change failed: ${error}`,
            );
        }
    }

    async missingCameraClusters(nodeId: NodeId, endpointId: EndpointNumber): Promise<number[]> {
        const endpoint = this.#endpoint(nodeId, endpointId);
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
        sessionEstablishing?: (webRtcSessionId: number) => void;
    }): Promise<unknown> {
        if (args.cluster === "avsm") {
            const node = this.#handler.getNode(args.nodeId);
            // Widened: the command name is a runtime string validated by the manager.
            const cluster: Specifier.ClusterLike = CameraAvStreamManagement.Cluster;
            const response = await this.#handler.invokeCommand(node, {
                endpoint: args.endpointId,
                cluster,
                command: args.command,
                fields: args.fields,
            });
            const streamList = STREAM_LIST_OF_COMMAND.get(args.command);
            if (streamList !== undefined) await this.#refreshStreamList(args.nodeId, args.endpointId, streamList);
            return response;
        }

        if (args.command === "provideOffer" || args.command === "solicitOffer") {
            // Must register the session with the local requestor: WebRtcTransportRequestorServer answers
            // NotFound to Answer/ICECandidates for a session it never stored.
            return this.#handler.invokeWebRtcProviderCommand({
                nodeId: args.nodeId,
                endpointId: args.endpointId,
                commandName: args.command === "provideOffer" ? "ProvideOffer" : "SolicitOffer",
                fields: args.fields,
                sessionEstablishing: args.sessionEstablishing,
            });
        }

        const node = this.#handler.getNode(args.nodeId);
        const cluster: Specifier.ClusterLike = WebRtcTransportProvider.Cluster;
        const invoke = (): Promise<unknown> =>
            this.#handler.invokeCommand(node, {
                endpoint: args.endpointId,
                cluster,
                command: args.command,
                fields: args.fields,
            });
        if (args.command !== "endSession") return invoke();

        const sessionId = args.fields.webRtcSessionId;
        return invokeEndSession(invoke, async () => {
            if (typeof sessionId !== "number") return;
            await dropWebRtcSessionTracking(this.#handler, sessionId, args.nodeId, args.endpointId);
        });
    }
}
