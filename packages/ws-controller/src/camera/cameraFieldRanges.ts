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

function requireDatatype(name: string): DatatypeModel {
    const datatype = avsm.get(DatatypeModel, name);
    if (datatype === undefined) throw new InternalError(`The Matter model states no ${avsm.name}.${name}`);
    return datatype;
}

const resolution = requireDatatype("VideoResolutionStruct");

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
} satisfies Record<string, FieldRange>;
