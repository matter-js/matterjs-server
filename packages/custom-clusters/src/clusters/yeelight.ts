/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, Decorator } from "@matter/main";
import {
    attribute,
    bool,
    cluster,
    command,
    enum8,
    field,
    FieldSemantics,
    InvalidMetadataError,
    listOf,
    mandatory,
    nullable,
    octstr,
    response,
    string,
    uint8,
    uint16,
    uint32,
    uint64,
    ValueModel,
    writable,
} from "@matter/main/model";

// Vendor clusters of the Yeelight Cube Lite (vendor 0x1312 / 4882, product 4), a 20 x 5 RGB matrix lamp. Names follow
// the Yeelight app's cluster definitions; field tags and types follow the firmware's decoders (ESP32 firmware
// 1.12.32). Every attribute and command below was verified on a Cube Lite with that firmware, from fabrics with vendor
// id 0xfff1 and 0x134b (the device does not restrict these clusters by fabric).
//
// The firmware reads integer fields with unsigned getters, so they are declared unsigned. It copies color lists into
// fixed buffers without a length check, so the requests below take exactly 4 colors in an effect and at most 16 in a
// music palette (checked when a request is sent; replies are decoded without the check). Effect ids 41 and 43 hang
// the lamp.
//
// Left out on purpose: setIntensity (0x13120001), setColor (0x13120003) and getPersistEffect (0x1312000c) are listed by
// the device but never answer; CubeControl's effectModeNext (0x13120000) always fails; YeelightOverTheAir's
// yeeStartUpdate starts a firmware update.

/**
 * A field's Matter constraint (for a list: its length). matter.js checks it when it encodes a request, so a request
 * the device cannot take safely is refused before it is sent.
 */
function constraint(definition: string): Decorator.PropertyCollector {
    return Decorator<Decorator.PropertyCollector>((_target, context) => {
        const model = FieldSemantics.of(context).mutableModel;
        if (!(model instanceof ValueModel)) {
            throw new InvalidMetadataError(
                `Cannot constrain ${model.path} because ${model.tag} elements have no value`,
            );
        }
        model.constraint = definition;
    });
}

/** {@link YeelightCubeControlCluster.rotationAngle} values: the Yeelight app's direction arrows. */
const enum YeelightRotationAngle {
    Left = 0,
    Up = 1,
    Right = 2,
    Down = 3,
}

/** {@link YeelightCubeControlCluster.cubeTopology} values. */
const enum YeelightModuleType {
    None = 0,
    Panel = 1,
    Matrix = 2,
    Spot = 3,
}

/** Direction of an effect ({@link YeelightEffectConfig.direction}, {@link YeelightSetDirectionRequest}). */
const enum YeelightEffectDirection {
    Up = 0,
    Down = 1,
    Left = 2,
    Right = 3,
}

/** Animation of a drawing ({@link YeelightEffectConfig.mixer}); 1 is the clock overlay, never used on a drawing. */
const enum YeelightMixer {
    Static = 0,
    Clock = 1,
    Translation = 2,
    Breath = 3,
    Flashing = 4,
    Accumulation = 5,
    Scrolling = 6,
}

/** {@link YeelightSendGifDataFragmentResponse.status} values. */
const enum YeelightGifTransferStatus {
    Timeout = 0x00,
    Ack = 0x06,
    Nak = 0x15,
}

@cluster(0x1312fc00)
export class YeelightBasicCluster {
    /** Yeelight's product id (4: Cube Lite). */
    @attribute(0x13120000, uint32)
    yeelightId?: number;

    @attribute(0x13120001, uint32)
    softwareVersion?: number;

    @attribute(0x13120002, string)
    softwareVersionString?: string;
}

class YeelightSetMicMusicModeRequest {
    @field(0x0, bool, mandatory)
    on!: boolean;

    /** The music mode, 83-88 (Gather, Breathing, Blossom, Spectrum, Music Note, Impact). */
    @field(0x1, uint64)
    effectId?: number | bigint;

    /**
     * ARGB colors, at most 16. Required to turn a mode on: without it the device accepts the command and nothing
     * happens (the Yeelight app always sends 16).
     */
    @field(0x2, listOf(uint32), constraint("max 16"))
    palette?: number[];
}

@cluster(0x1312fc01)
export class YeelightBasicConfigCluster {
    /** The Yeelight app's "LAN Control": whether the lamp accepts control from the local network. */
    @attribute(0x13120001, bool, writable)
    lanControl?: boolean;

    /** Whether a music mode driven by the lamp's microphone is on. */
    @attribute(0x13120002, bool)
    micMusicOnOff?: boolean;

    /** The microphone music mode (83-88), 0 when off. */
    @attribute(0x13120003, uint64)
    micMusicEffectId?: number | bigint;

    /** Starts or stops a music mode driven by the lamp's microphone, as the lamp's left button does. */
    @command(0x13120000, YeelightSetMicMusicModeRequest)
    setMicMusicMode(_request: YeelightSetMicMusicModeRequest): void {}
}

class YeelightUpdateTopologyRequest {
    /** Module types ({@link YeelightModuleType}), at most 8; the Yeelight app sends [2, 2, 2, 2] for a Cube Lite. */
    @field(0x0, listOf(uint8), mandatory)
    topology!: number[];
}

@cluster(0x1312fc02)
export class YeelightCubeControlCluster {
    /** See {@link YeelightModuleType}. */
    @attribute(0x13120000, listOf(enum8))
    cubeTopology?: YeelightModuleType[];

    /**
     * The display direction, see {@link YeelightRotationAngle}. The lamp applies it to the next effect it starts; the
     * Yeelight app restarts the current effect after a change.
     */
    @attribute(0x13120001, enum8, writable)
    rotationAngle?: YeelightRotationAngle;

    @command(0x13120002, YeelightUpdateTopologyRequest)
    updateTopology(_request: YeelightUpdateTopologyRequest): void {}
}

/** The settings of an effect (one segment: the whole panel on a Cube Lite). */
class YeelightEffectConfig {
    @field(0x0, uint16)
    start?: number;

    @field(0x1, uint16)
    end?: number;

    @field(0x2, uint8)
    onoff?: number;

    /** The effect's renderer; the device picks it from the effect id, send the effect id. */
    @field(0x3, uint16, mandatory)
    mode!: number;

    @field(0x4, uint8)
    intensity?: number;

    @field(0x5, uint8)
    speed?: number;

    /**
     * ARGB colors, exactly 4: more overflow the device's buffer, missing ones are read from stale memory (checked
     * when the request is sent).
     */
    @field(0x6, listOf(uint32), constraint("4"))
    color?: number[];

    /**
     * The effect's data. A drawing (effect 36): 100 pixels of 4 bytes (0xff, red, green, blue), column by column from
     * the left, each column from the bottom row up. Always send all 400 bytes with effect 36.
     */
    @field(0x7, octstr)
    data?: Bytes;

    /** See {@link YeelightMixer}. */
    @field(0x8, uint8)
    mixer?: number;

    /** See {@link YeelightEffectDirection}. */
    @field(0x9, uint8)
    direction?: number;
}

class YeelightEffectStruct {
    /** The effect, by the Yeelight app's ids (for example 42 Ocean Waves, 36 a drawing, 40 the clock, 71 the GIF). */
    @field(0x0, uint64, mandatory)
    effectId!: number | bigint;

    /** The Yeelight app's id of what is shown (for example which GIF is stored); 0 works. */
    @field(0x1, uint64)
    customId?: number | bigint;

    @field(0x2, listOf(YeelightEffectConfig))
    effectParams?: YeelightEffectConfig[];
}

class YeelightEffectSnapshot {
    @field(0x0, uint64, mandatory)
    effectId!: number | bigint;

    @field(0x1, uint64, mandatory)
    customId!: number | bigint;
}

class YeelightSetEffectRequest {
    /** 0 previews, 1 applies (the Yeelight app uses 2 for drawings and the clock). */
    @field(0x0, uint8)
    apply?: number;

    @field(0x1, YeelightEffectStruct, mandatory)
    effect!: YeelightEffectStruct;
}

class YeelightSetRateRequest {
    @field(0x0, uint8, mandatory)
    rate!: number;
}

class YeelightSetMixerRequest {
    /** See {@link YeelightMixer}. */
    @field(0x0, uint8, mandatory)
    mixer!: number;
}

class YeelightSetDataRequest {
    @field(0x0, octstr, mandatory)
    data!: Bytes;
}

class YeelightSetDirectionRequest {
    /** See {@link YeelightEffectDirection}. */
    @field(0x0, uint8, mandatory)
    direction!: number;
}

class YeelightUpdatePersistEffectListRequest {
    /** The playlist slot, 0-7. */
    @field(0x0, uint8, mandatory)
    index!: number;

    @field(0x1, YeelightEffectStruct, mandatory)
    effect!: YeelightEffectStruct;
}

class YeelightGetPersistEffectListResponse {
    @field(0x0, listOf(YeelightEffectSnapshot), mandatory)
    effectList!: YeelightEffectSnapshot[];
}

class YeelightGetCurrentEffectResponse {
    @field(0x0, YeelightEffectStruct, mandatory)
    effect!: YeelightEffectStruct;
}

class YeelightSetPresetsEffectRequest {
    /** 0 previews, 1 applies. */
    @field(0x0, uint8)
    apply?: number;

    @field(0x1, uint64, mandatory)
    effectId!: number | bigint;

    /** Present (with any content): the effect is turned on. */
    @field(0x2, listOf(uint8))
    onoff?: number[];

    @field(0x3, uint8)
    intensity?: number;

    @field(0x4, uint8)
    rate?: number;

    /** ARGB colors: send exactly 4. */
    @field(0x5, listOf(uint32), constraint("4"))
    color?: number[];

    /** See {@link YeelightEffectDirection}. */
    @field(0x6, uint8)
    direction?: number;
}

class YeelightSendGifDataFragmentRequest {
    /**
     * One XMODEM packet: [0x01, n, 255 - n, 504 bytes of the GIF file (the last one padded with 0x1a),
     * CRC-16/CCITT-FALSE of those 504 bytes, high byte first], n counting from 1; then [0x04] to end the transfer.
     */
    @field(0x0, octstr, mandatory)
    data!: Bytes;
}

class YeelightSendGifDataFragmentResponse {
    /** See {@link YeelightGifTransferStatus}. */
    @field(0x0, uint8, mandatory)
    status!: number;
}

/** The lamp's effects, drawings, playlist and GIF (Yeelight's EnhancedColorEffectConfigV2). */
@cluster(0x1312fc05)
export class YeelightEnhancedColorEffectConfigV2Cluster {
    /** The effect shown (36 a drawing, 50 frames streamed over the local network). */
    @attribute(0x13120000, uint64)
    effectId?: number | bigint;

    /** The shown effect's custom id (the playlist slot's, the GIF's). */
    @attribute(0x13120001, uint64)
    customId?: number | bigint;

    @command(0x13120000, YeelightSetEffectRequest)
    setEffect(_request: YeelightSetEffectRequest): void {}

    /** Changes the speed of the running effect. */
    @command(0x13120002, YeelightSetRateRequest)
    setRate(_request: YeelightSetRateRequest): void {}

    /** Changes the animation of the running drawing. */
    @command(0x13120006, YeelightSetMixerRequest)
    setMixer(_request: YeelightSetMixerRequest): void {}

    /** Replaces the running effect's data (a drawing's pixels) without restarting it. */
    @command(0x13120007, YeelightSetDataRequest)
    setData(_request: YeelightSetDataRequest): void {}

    /** Changes the direction of the running effect. */
    @command(0x13120008, YeelightSetDirectionRequest)
    setDirection(_request: YeelightSetDirectionRequest): void {}

    /** Accepted; no visible change on a Cube Lite. */
    @command(0x13120009)
    resetEffect(): void {}

    /** Stores an effect in a slot of the playlist the lamp's right button steps through. */
    @command(0x1312000a, YeelightUpdatePersistEffectListRequest)
    updatePersistEffectList(_request: YeelightUpdatePersistEffectListRequest): void {}

    @command(0x1312000b, response(0x13120001, YeelightGetPersistEffectListResponse))
    getPersistEffectList(): YeelightGetPersistEffectListResponse {
        return {} as YeelightGetPersistEffectListResponse;
    }

    @command(0x1312000d, response(0x13120003, YeelightGetCurrentEffectResponse))
    getCurrentEffect(): YeelightGetCurrentEffectResponse {
        return {} as YeelightGetCurrentEffectResponse;
    }

    /** Starts one of the lamp's effects, as a tap on an effect in the Yeelight app does. */
    @command(0x1312000e, YeelightSetPresetsEffectRequest)
    setPresetsEffect(_request: YeelightSetPresetsEffectRequest): void {}

    /**
     * Stores a GIF (20 x 5) in the lamp, replacing the one stored; {@link setEffect} with effect 71 plays it. The lamp
     * shows the image's pixels column by column: pixel n of the file (in row order) at column n / 5, row n % 5 from
     * the top.
     */
    @command(0x1312000f, YeelightSendGifDataFragmentRequest, response(0x13120004, YeelightSendGifDataFragmentResponse))
    sendGifDataFragment(_request: YeelightSendGifDataFragmentRequest): YeelightSendGifDataFragmentResponse {
        return {} as YeelightSendGifDataFragmentResponse;
    }
}

/** The firmware update state (read only: updates are left to the Yeelight app). */
@cluster(0x1312fc11)
export class YeelightOverTheAirCluster {
    @attribute(0x13120000, enum8)
    yeeUpdateState?: number;

    @attribute(0x13120001, uint8, nullable)
    progress?: number | null;
}
