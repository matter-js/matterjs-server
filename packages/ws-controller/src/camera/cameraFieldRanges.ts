/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { InternalError } from "@matter/main";
import { ClusterModel, CommandModel, DatatypeModel, FieldModel, MatterModel } from "@matter/main/model";
import { TlvUInt8, TlvUInt16, TlvUInt32 } from "@matter/main/types";

/** Inclusive range a wire value must fall in to be encodable as the Matter field it becomes. */
export interface FieldRange {
    readonly min: number;
    readonly max: number;
}

/**
 * The widths the cluster's scalar types encode in, taken from the TLV schemas rather than written
 * out here: a field whose constraint states no ceiling is still bounded by its type.
 */
const TYPE_MAX = new Map<string, number>([
    ["uint8", TlvUInt8.max],
    ["uint16", TlvUInt16.max],
    ["uint32", TlvUInt32.max],
]);

function requireCluster(name: string): ClusterModel {
    const cluster = MatterModel.standard.get(ClusterModel, name);
    if (cluster === undefined) throw new InternalError(`The Matter model states no ${name} cluster`);
    return cluster;
}

const avsm = requireCluster("CameraAvStreamManagement");
const webRtcDefinitions = requireCluster("WebRtcTransportDefinitions");

function requireField(parent: ClusterModel | CommandModel | DatatypeModel, name: string): FieldModel {
    const field = parent.get(FieldModel, name);
    if (field === undefined) {
        throw new InternalError(`The Matter model states no ${parent.name}.${name}`);
    }
    return field;
}

/**
 * The range `field` accepts, from its own constraint where that states a number and from its type's
 * width otherwise.
 *
 * A constraint bound can also name a sibling field — `MinFrameRate` is "1 to maxFrameRate" — which
 * states a relation between two arguments rather than a limit on one value, and is the device's to
 * enforce. Falling back for the floor lands on 0, the true minimum of every unsigned type here, so a
 * field whose constraint stops stating "min 1" is bounded by its type rather than by nothing.
 *
 * This runs at module load, so a cluster the model does not carry fails the import rather than the
 * first camera command. The trade is deliberate: `@matter/model` ships with a pinned `@matter/main`,
 * a mismatch means the camera commands cannot work at all, and a loud start beats a command that
 * fails on a device the operator will blame instead.
 */
function rangeOf(field: FieldModel): FieldRange {
    const typeName = field.metabase?.name;
    const typeMax = typeName === undefined ? undefined : TYPE_MAX.get(typeName);
    if (typeMax === undefined) {
        throw new InternalError(`The Matter model gives ${field.name} the unhandled scalar type ${String(typeName)}`);
    }
    const { min, max } = field.constraint;
    return { min: typeof min === "number" ? min : 0, max: typeof max === "number" ? max : typeMax };
}

function commandField(command: string, field: string): FieldModel {
    const model = avsm.get(CommandModel, command);
    if (model === undefined) {
        throw new InternalError(`The Matter model states no CameraAvStreamManagement.${command}`);
    }
    return requireField(model, field);
}

function requireDatatype(parent: ClusterModel, name: string): DatatypeModel {
    const datatype = parent.get(DatatypeModel, name);
    if (datatype === undefined) throw new InternalError(`The Matter model states no ${parent.name}.${name}`);
    return datatype;
}

/** The ceiling `field`'s own constraint states, which a field bounded only by its type does not have. */
function maxOf(field: FieldModel): number {
    const { max } = field.constraint;
    if (typeof max !== "number") {
        throw new InternalError(`The Matter model states no length ceiling for ${field.name}`);
    }
    return max;
}

/** The ceiling each entry of a list field states, as `max 10[max 2000]` states 2000. */
function entryMaxOf(field: FieldModel): number {
    const max = field.constraint.entry?.max;
    if (typeof max !== "number") {
        throw new InternalError(`The Matter model states no per-entry ceiling for ${field.name}`);
    }
    return max;
}

const resolution = requireDatatype(avsm, "VideoResolutionStruct");
const iceServer = requireDatatype(webRtcDefinitions, "ICEServerStruct");
// matter.js camelizes the spec's `URLs` to `UrLs`, and the model lookup is by that exact name.
const iceServerUrls = requireField(iceServer, "UrLs");

const webRtcProvider = requireCluster("WebRtcTransportProvider");

function providerCommand(name: string): CommandModel {
    const command = webRtcProvider.get(CommandModel, name);
    if (command === undefined) {
        throw new InternalError(`The Matter model states no WebRtcTransportProvider.${name}`);
    }
    return command;
}

const provideOffer = providerCommand("ProvideOffer");

/**
 * The wire ranges the camera commands validate their numeric arguments against, read from the
 * cluster's own element definitions.
 *
 * @see Matter spec § 11.2.8.4 (VideoStreamAllocate), § 11.2.8.1 (AudioStreamAllocate), § 11.2.6.10
 * (VideoResolutionStruct)
 */
export const CAMERA_FIELD_RANGES = {
    resolutionWidth: rangeOf(requireField(resolution, "Width")),
    resolutionHeight: rangeOf(requireField(resolution, "Height")),
    minFrameRate: rangeOf(commandField("VideoStreamAllocate", "MinFrameRate")),
    maxFrameRate: rangeOf(commandField("VideoStreamAllocate", "MaxFrameRate")),
    minBitRate: rangeOf(commandField("VideoStreamAllocate", "MinBitRate")),
    maxBitRate: rangeOf(commandField("VideoStreamAllocate", "MaxBitRate")),
    channelCount: rangeOf(commandField("AudioStreamAllocate", "ChannelCount")),
    sampleRate: rangeOf(commandField("AudioStreamAllocate", "SampleRate")),
    audioBitRate: rangeOf(commandField("AudioStreamAllocate", "BitRate")),
    videoStreamId: rangeOf(commandField("VideoStreamDeallocate", "VideoStreamId")),
    audioStreamId: rangeOf(commandField("AudioStreamDeallocate", "AudioStreamId")),
    snapshotStreamId: rangeOf(commandField("SnapshotStreamDeallocate", "SnapshotStreamId")),
    webRtcSessionId: rangeOf(requireField(providerCommand("EndSession"), "WebRtcSessionId")),
} satisfies Record<string, FieldRange>;

/**
 * What `camera_start_stream`'s ICE arguments may carry, read from `ProvideOffer` and
 * `ICEServerStruct` rather than written out here.
 *
 * A list, a URL or a credential past these lengths reaches matter.js's TLV encoder and fails there,
 * the same way an out-of-range number does.
 *
 * @see Matter spec § 11.4.5.3 (ICEServerStruct), § 11.5.7.2 (ProvideOffer)
 */
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
    caid: rangeOf(requireField(iceServer, "Caid")),
};
