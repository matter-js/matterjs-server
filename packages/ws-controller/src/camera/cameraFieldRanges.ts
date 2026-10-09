/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { InternalError } from "@matter/main";
import { ClusterModel, CommandModel, DatatypeModel, FieldModel, MatterModel, ValueModel } from "@matter/main/model";
import { TlvUInt8, TlvUInt16, TlvUInt32 } from "@matter/main/types";

export interface FieldRange {
    readonly min: number;
    readonly max: number;
}

/** Type widths, so a field whose constraint states no ceiling is still bounded. */
const TYPE_MAX = new Map<string, number>([
    ["uint8", TlvUInt8.max],
    ["enum8", TlvUInt8.max],
    ["uint16", TlvUInt16.max],
    ["uint32", TlvUInt32.max],
]);

function required<T>(model: T | undefined, what: string): T {
    if (model === undefined) throw new InternalError(`The Matter model states no ${what}`);
    return model;
}

function requireField(parent: ClusterModel | CommandModel | DatatypeModel, name: string): FieldModel {
    return required(parent.get(FieldModel, name), `${parent.name}.${name}`);
}

const avsm = required(
    MatterModel.standard.get(ClusterModel, "CameraAvStreamManagement"),
    "CameraAvStreamManagement cluster",
);
const webRtcDefinitions = required(
    MatterModel.standard.get(ClusterModel, "WebRtcTransportDefinitions"),
    "WebRtcTransportDefinitions cluster",
);
const webRtcProvider = required(
    MatterModel.standard.get(ClusterModel, "WebRtcTransportProvider"),
    "WebRtcTransportProvider cluster",
);

/** A bound that names another field (`MinFrameRate` is "1 to maxFrameRate") is left to the device. */
export function fieldRange(field: ValueModel): FieldRange {
    const typeName = field.metabase?.name;
    const typeMax = typeName === undefined ? undefined : TYPE_MAX.get(typeName);
    if (typeMax === undefined) {
        throw new InternalError(`The Matter model gives ${field.name} the unhandled scalar type ${String(typeName)}`);
    }
    const { min, max } = field.constraint;
    return { min: typeof min === "number" ? min : 0, max: typeof max === "number" ? max : typeMax };
}

function commandField(command: string, field: string): FieldModel {
    return requireField(required(avsm.get(CommandModel, command), `CameraAvStreamManagement.${command}`), field);
}

export function providerCommand(name: string): CommandModel {
    return required(webRtcProvider.get(CommandModel, name), `WebRtcTransportProvider.${name}`);
}

function maxOf(field: FieldModel): number {
    const { max } = field.constraint;
    if (typeof max !== "number") {
        throw new InternalError(`The Matter model states no length ceiling for ${field.name}`);
    }
    return max;
}

function entryMaxOf(field: FieldModel): number {
    const max = field.constraint.entry?.max;
    if (typeof max !== "number") {
        throw new InternalError(`The Matter model states no per-entry ceiling for ${field.name}`);
    }
    return max;
}

const resolution = required(avsm.get(DatatypeModel, "VideoResolutionStruct"), "VideoResolutionStruct");
const iceServer = required(webRtcDefinitions.get(DatatypeModel, "ICEServerStruct"), "ICEServerStruct");
const iceServerUrls = requireField(iceServer, "Urls");

const provideOffer = providerCommand("ProvideOffer");

/**
 * @see Matter spec § 11.2.8.4 (VideoStreamAllocate), § 11.2.8.1 (AudioStreamAllocate), § 11.2.6.7
 * (VideoResolutionStruct)
 */
export const CAMERA_FIELD_RANGES = {
    resolutionWidth: fieldRange(requireField(resolution, "Width")),
    resolutionHeight: fieldRange(requireField(resolution, "Height")),
    minFrameRate: fieldRange(commandField("VideoStreamAllocate", "MinFrameRate")),
    maxFrameRate: fieldRange(commandField("VideoStreamAllocate", "MaxFrameRate")),
    minBitRate: fieldRange(commandField("VideoStreamAllocate", "MinBitRate")),
    maxBitRate: fieldRange(commandField("VideoStreamAllocate", "MaxBitRate")),
    channelCount: fieldRange(commandField("AudioStreamAllocate", "ChannelCount")),
    sampleRate: fieldRange(commandField("AudioStreamAllocate", "SampleRate")),
    audioBitRate: fieldRange(commandField("AudioStreamAllocate", "BitRate")),
    videoStreamId: fieldRange(commandField("VideoStreamDeallocate", "VideoStreamId")),
    audioStreamId: fieldRange(commandField("AudioStreamDeallocate", "AudioStreamId")),
    snapshotStreamId: fieldRange(commandField("SnapshotStreamDeallocate", "SnapshotStreamId")),
    webRtcSessionId: fieldRange(requireField(providerCommand("EndSession"), "WebRtcSessionId")),
} satisfies Record<string, FieldRange>;

/** @see Matter spec § 11.4.5.3 (ICEServerStruct), § 11.5.6.3 (ProvideOffer) */
export const ICE_SERVER_LIMITS: {
    readonly maxServers: number;
    readonly maxTransportPolicyLength: number;
    readonly maxUrls: number;
    readonly maxUrlLength: number;
    readonly maxUsernameLength: number;
    readonly maxCredentialLength: number;
    readonly caid: FieldRange;
} = {
    /** `SolicitOffer` states the same ceiling, so one bound covers both commands. */
    maxServers: maxOf(requireField(provideOffer, "IceServers")),
    maxTransportPolicyLength: maxOf(requireField(provideOffer, "IceTransportPolicy")),
    maxUrls: maxOf(iceServerUrls),
    maxUrlLength: entryMaxOf(iceServerUrls),
    maxUsernameLength: maxOf(requireField(iceServer, "Username")),
    maxCredentialLength: maxOf(requireField(iceServer, "Credential")),
    caid: fieldRange(requireField(iceServer, "Caid")),
};
