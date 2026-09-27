/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import { parse } from "sdp-transform";
import type { CodecLevelLimits } from "./codecLevels.js";
import { h264ProfileLevelIdLimits, h265LevelIdLimits, PIXELS_PER_MACROBLOCK } from "./codecLevels.js";
import { videoCodecName } from "./wireNames.js";

const logger = Logger.get("sdpConstraints");

/** `max-br` is in units of 1000 bits per second under both RFC 6184 §8.1 and RFC 7798 §7.1. */
const BITS_PER_KILOBIT = 1000;
/** H.265's `max-fps` counts frames over this period (RFC 7798 §7.1). */
const FRAME_RATE_PERIOD_SECONDS = 100;

/**
 * What one video codec's `a=fmtp` lines state it can decode.
 *
 * Several records for the same codec are folded to the tighter value. Within one record an explicit
 * capability parameter replaces the level's value, because RFC 6184 §8.1 and RFC 7798 §7.1 define it
 * as at or above the level.
 */
export interface VideoCodecLimits {
    readonly maxPixels?: number;
    readonly maxPixelsPerSecond?: number;
    /** Whole frames per second, from `max-fr` (RFC 7741 §6.1) or H.265's `max-fps` (per 100 s, RFC 7798 §7.1). */
    readonly maxFrameRate?: number;
    readonly maxBitRate?: number;
}

/** {@link VideoCodecLimits} carrying the codec that stated them, so the two cannot be paired wrongly. */
export interface SelectedVideoCodecLimits extends VideoCodecLimits {
    readonly codec: number;
}

/**
 * What an offer states about one media kind: no section (`absent`), rejected with port 0, RFC 3264 §6
 * (`refused`), `a=sendonly` / `a=inactive` (`notReceiving`), or `a=recvonly` / `a=sendrecv` / no
 * direction, RFC 4566 §6 (`receiving`).
 *
 * `codecs` is absent, never empty, when the section has no `a=rtpmap` lines (static payload types only).
 */
export type MediaDisposition =
    | { readonly state: "absent" }
    | { readonly state: "refused" }
    | { readonly state: "notReceiving"; readonly direction: "sendonly" | "inactive" }
    | { readonly state: "receiving"; readonly codecs?: readonly string[] };

/** The {@link MediaDisposition} states that forbid a track of this kind in the answer. */
export type MediaRefusal = Extract<MediaDisposition, { state: "refused" | "notReceiving" | "absent" }>;

export interface SdpVideoConstraints {
    video: MediaDisposition;
    audio: MediaDisposition;
    /** True when a live audio m-line asks to send, i.e. the caller wants talkback. */
    wantsTalkback: boolean;
    /** Per-codec fmtp limits, keyed by upper-cased codec name. A codec absent here stated none. */
    limitsByCodec: ReadonlyMap<string, VideoCodecLimits>;
    /**
     * Video codecs whose stated decode ceiling this server cannot read; they must not be selected. Kept
     * apart from the codec list, because an empty list would read as "no codec stated", i.e. unconstrained.
     */
    unreadableCeilingCodecs: ReadonlySet<string>;
}

/**
 * Why a track of this kind may not be put in the answer to `offer`, or `undefined` when it may.
 *
 * No offer (the server solicits one) refuses nothing. An offer with no section of this kind refuses
 * it, because the answer can only carry the offer's m-lines (RFC 3264 §6).
 */
export function mediaRefusal(
    offer: SdpVideoConstraints | undefined,
    kind: "video" | "audio",
): MediaRefusal | undefined {
    if (offer === undefined) return undefined;
    const disposition = offer[kind];
    switch (disposition.state) {
        case "refused":
        case "notReceiving":
        case "absent":
            return disposition;
        default:
            return undefined;
    }
}

/**
 * The codecs the peer stated it can receive for this kind, or `undefined` when there is nothing to
 * narrow by (also for a non-receiving section; check {@link mediaRefusal} first).
 */
export function receivableCodecs(disposition: MediaDisposition): readonly string[] | undefined {
    return disposition.state === "receiving" ? disposition.codecs : undefined;
}

/**
 * `key`'s value in an `a=fmtp` parameter list, or `undefined`. Case-insensitive: media type parameter
 * names are (RFC 8866 §6.15, RFC 6838 §4.3).
 */
function fmtpValue(params: string, key: string): string | undefined {
    const match = new RegExp(`(?:^|;)\\s*${key}=([^;\\s]+)`, "i").exec(params);
    return match?.[1];
}

/** What an `a=fmtp` parameter list says about one numeric key. `unreadable` must never be treated as `absent`. */
type FmtpReading =
    | { readonly state: "absent" }
    | { readonly state: "read"; readonly value: number }
    | { readonly state: "unreadable"; readonly value: string };

const FMTP_ABSENT: FmtpReading = { state: "absent" };

function fmtpNumber(params: string, key: string): FmtpReading {
    const value = fmtpValue(params, key);
    if (value === undefined) return FMTP_ABSENT;
    if (!/^\d+$/.test(value)) return { state: "unreadable", value };
    return { state: "read", value: Number(value) };
}

function statedNumber(reading: FmtpReading): number | undefined {
    return reading.state === "read" ? reading.value : undefined;
}

function unreadableParameter(
    readings: Readonly<Record<string, FmtpReading>>,
): { readonly name: string; readonly value: string } | undefined {
    for (const [name, reading] of Object.entries(readings)) {
        if (reading.state === "unreadable") return { name, value: reading.value };
    }
    return undefined;
}

const MAX_BIT_RATE_PARAMETER = "max-br";

/**
 * How one codec spells the `a=fmtp` parameters this server reads (RFC 6184 §8.1, RFC 7798 §7.1), and
 * how to read its level. Names are per codec and never shared.
 *
 * `pixelsPerUnit` converts frame-size and sample-rate units to pixels; `frameRatePerUnit` converts the
 * frame-rate parameter to frames per second.
 */
interface CodecFmtpParameters {
    readonly level?: { readonly name: string; readonly read: (value: string) => CodecLevelLimits | undefined };
    readonly maxFrameSize: string;
    readonly maxSampleRate: string;
    readonly maxFrameRate: string;
    readonly pixelsPerUnit: number;
    readonly frameRatePerUnit: number;
}

/** The reading for a codec with no entry in {@link FMTP_PARAMETERS}: H.264's names and units, no level. */
const DEFAULT_FMTP_PARAMETERS: CodecFmtpParameters = {
    maxFrameSize: "max-fs",
    maxSampleRate: "max-mbps",
    maxFrameRate: "max-fr",
    pixelsPerUnit: PIXELS_PER_MACROBLOCK,
    frameRatePerUnit: 1,
};

const FMTP_PARAMETERS = new Map<string, CodecFmtpParameters>([
    [
        "H264",
        {
            level: { name: "profile-level-id", read: h264ProfileLevelIdLimits },
            ...DEFAULT_FMTP_PARAMETERS,
        },
    ],
    [
        "H265",
        {
            level: { name: "level-id", read: h265LevelIdLimits },
            maxFrameSize: "max-lps",
            maxSampleRate: "max-lsr",
            maxFrameRate: "max-fps",
            pixelsPerUnit: 1,
            frameRatePerUnit: 1 / FRAME_RATE_PERIOD_SECONDS,
        },
    ],
]);

/**
 * What one `a=fmtp` record states about its codec's level. `none` also covers codecs with no level
 * table here. The RFC default for an absent level (H.264: `42000A`, level 1) is not applied, because
 * it would bound 1080p below one frame per second.
 */
type LevelStatement =
    | { readonly state: "none" }
    | { readonly state: "read"; readonly limits: CodecLevelLimits }
    | { readonly state: "unreadable"; readonly parameter: string; readonly value: string };

function statedLevel(parameters: CodecFmtpParameters, config: string): LevelStatement {
    const level = parameters.level;
    if (level === undefined) return { state: "none" };
    const value = fmtpValue(config, level.name);
    if (value === undefined) return { state: "none" };
    const limits = level.read(value);
    return limits === undefined ? { state: "unreadable", parameter: level.name, value } : { state: "read", limits };
}

function smallest(a: number | undefined, b: number | undefined): number | undefined {
    if (a === undefined) return b;
    if (b === undefined) return a;
    return Math.min(a, b);
}

/** Merge `limits` into what `codec` already states, keeping the value both payload types can decode. */
function tighten(into: Map<string, VideoCodecLimits>, codec: string, limits: VideoCodecLimits): void {
    const known = into.get(codec) ?? {};
    const maxPixels = smallest(known.maxPixels, limits.maxPixels);
    const maxPixelsPerSecond = smallest(known.maxPixelsPerSecond, limits.maxPixelsPerSecond);
    const maxFrameRate = smallest(known.maxFrameRate, limits.maxFrameRate);
    const maxBitRate = smallest(known.maxBitRate, limits.maxBitRate);
    into.set(codec, {
        ...(maxPixels === undefined ? {} : { maxPixels }),
        ...(maxPixelsPerSecond === undefined ? {} : { maxPixelsPerSecond }),
        ...(maxFrameRate === undefined ? {} : { maxFrameRate }),
        ...(maxBitRate === undefined ? {} : { maxBitRate }),
    });
}

/** What the sections of one media kind stated, before {@link disposition} reduces them to one value. */
interface MediaSections {
    receiving: boolean;
    /** The direction of the first live section the peer will not receive on; reported only, decides nothing. */
    notReceiving?: "sendonly" | "inactive";
    refused: boolean;
    codecs: string[];
}

/** One receiving section makes the kind receiving, whatever the other sections say. */
function disposition(sections: MediaSections): MediaDisposition {
    if (sections.receiving) {
        return sections.codecs.length === 0 ? { state: "receiving" } : { state: "receiving", codecs: sections.codecs };
    }
    if (sections.notReceiving !== undefined) {
        return { state: "notReceiving", direction: sections.notReceiving };
    }
    return sections.refused ? { state: "refused" } : { state: "absent" };
}

/**
 * How the offer's video codec list splits into codecs this server may select and ones whose ceiling it
 * cannot read, or `undefined` when the offer stated no codec list.
 */
export function decodableVideoCodecs(
    sdp: SdpVideoConstraints,
): { readonly decodable: readonly string[]; readonly unreadable: readonly string[] } | undefined {
    const offered = receivableCodecs(sdp.video);
    if (offered === undefined) return undefined;
    return {
        decodable: offered.filter(name => !sdp.unreadableCeilingCodecs.has(name)),
        unreadable: offered.filter(name => sdp.unreadableCeilingCodecs.has(name)),
    };
}

/** The offer's limits on `codec`, read only from that codec's own `a=fmtp` records. */
export function videoCodecLimits(sdp: SdpVideoConstraints | undefined, codec: number): SelectedVideoCodecLimits {
    const limits = sdp?.limitsByCodec.get(videoCodecName(codec));
    return { codec, ...limits };
}

/**
 * Constraints an SDP offer places on a stream: upper bounds on what the caller can decode, not
 * preferences. An unparseable offer reads as `absent` for both kinds, so {@link mediaRefusal} refuses it.
 */
export function parseSdpVideoConstraints(sdp: string): SdpVideoConstraints {
    const limitsByCodec = new Map<string, VideoCodecLimits>();
    const unreadableCeilingCodecs = new Set<string>();
    const videoSections: MediaSections = { receiving: false, refused: false, codecs: new Array<string>() };
    const audioSections: MediaSections = { receiving: false, refused: false, codecs: new Array<string>() };
    let wantsTalkback = false;

    let parsed;
    try {
        parsed = parse(sdp);
    } catch (error) {
        logger.notice("Ignoring unparseable SDP offer; no media section can be read from it", error);
        return {
            video: { state: "absent" },
            audio: { state: "absent" },
            wantsTalkback: false,
            limitsByCodec,
            unreadableCeilingCodecs,
        };
    }

    for (const media of parsed.media ?? []) {
        const sections = media.type === "video" ? videoSections : media.type === "audio" ? audioSections : undefined;
        if (sections === undefined) continue;
        if (media.port === 0) {
            sections.refused = true;
            continue;
        }
        // Session-level direction applies where a section states none (RFC 4566 §5.13); default sendrecv (§6).
        const direction = media.direction ?? parsed.direction ?? "sendrecv";
        if (media.type === "audio" && (direction === "sendonly" || direction === "sendrecv")) {
            wantsTalkback = true;
        }
        if (direction === "sendonly" || direction === "inactive") {
            sections.notReceiving ??= direction;
            continue;
        }
        sections.receiving = true;
        const codecsByPayload = new Map<number, string>();
        for (const entry of media.rtp ?? []) codecsByPayload.set(entry.payload, entry.codec.toUpperCase());
        for (const codec of codecsByPayload.values()) {
            if (!sections.codecs.includes(codec)) sections.codecs.push(codec);
        }
        if (media.type === "video") {
            for (const entry of media.fmtp ?? []) {
                const codec = codecsByPayload.get(entry.payload);
                // No `a=rtpmap` for this payload type; every selectable codec is dynamically mapped.
                if (codec === undefined) continue;
                const parameters = FMTP_PARAMETERS.get(codec) ?? DEFAULT_FMTP_PARAMETERS;
                const level = statedLevel(parameters, entry.config);
                if (level.state === "unreadable") {
                    unreadableCeilingCodecs.add(codec);
                    logger.notice(
                        `Offer states ${codec} ${level.parameter}=${level.value}, which is no level this server can bound a stream by; ${codec} is not selectable for it`,
                    );
                    continue;
                }
                const stated = level.state === "read" ? level.limits : undefined;
                const readings = {
                    [parameters.maxFrameSize]: fmtpNumber(entry.config, parameters.maxFrameSize),
                    [parameters.maxSampleRate]: fmtpNumber(entry.config, parameters.maxSampleRate),
                    [parameters.maxFrameRate]: fmtpNumber(entry.config, parameters.maxFrameRate),
                    [MAX_BIT_RATE_PARAMETER]: fmtpNumber(entry.config, MAX_BIT_RATE_PARAMETER),
                };
                const unreadable = unreadableParameter(readings);
                if (unreadable !== undefined) {
                    // No fallback to the level: an explicit parameter overrides it.
                    unreadableCeilingCodecs.add(codec);
                    logger.notice(
                        `Offer states ${codec} ${unreadable.name}=${unreadable.value}, which is no decode ceiling this server can read; ${codec} is not selectable for it`,
                    );
                    continue;
                }
                const frameSizeUnits = statedNumber(readings[parameters.maxFrameSize]);
                const sampleRateUnits = statedNumber(readings[parameters.maxSampleRate]);
                const frameRateUnits = statedNumber(readings[parameters.maxFrameRate]);
                const bitRateUnits = statedNumber(readings[MAX_BIT_RATE_PARAMETER]);
                const maxPixels =
                    frameSizeUnits === undefined ? stated?.maxPixels : frameSizeUnits * parameters.pixelsPerUnit;
                const maxPixelsPerSecond =
                    sampleRateUnits === undefined
                        ? stated?.maxPixelsPerSecond
                        : sampleRateUnits * parameters.pixelsPerUnit;
                const maxBitRate = bitRateUnits === undefined ? stated?.maxBitRate : bitRateUnits * BITS_PER_KILOBIT;
                const maxFrameRate =
                    frameRateUnits === undefined ? undefined : frameRateUnits * parameters.frameRatePerUnit;
                tighten(limitsByCodec, codec, {
                    ...(maxPixels === undefined ? {} : { maxPixels }),
                    ...(maxPixelsPerSecond === undefined ? {} : { maxPixelsPerSecond }),
                    ...(maxFrameRate === undefined ? {} : { maxFrameRate }),
                    ...(maxBitRate === undefined ? {} : { maxBitRate }),
                });
            }
        }
    }

    return {
        video: disposition(videoSections),
        audio: disposition(audioSections),
        wantsTalkback,
        limitsByCodec,
        unreadableCeilingCodecs,
    };
}
