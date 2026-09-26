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
 * An `a=fmtp` record binds its own payload type and nothing else, so an offer carrying H.264 at
 * `max-fs=3600` beside H.265 at `max-fs=8160` states two limits, not one. Every record naming the
 * same codec is folded to the tighter value — several payload types in one section, and several
 * sections — since which of them the camera picks is not this server's to decide.
 *
 * Within one record the codec's own level states these same ceilings, and the codec's own
 * capability-extension parameters override the level's value rather than being folded against it:
 * RFC 6184 §8.1 (`max-fs`, `max-mbps`, `max-br`) and RFC 7798 §7.1 (`max-lps`, `max-lsr`, `max-br`)
 * both define them as signalling a capability at or above the level's, so where both are stated the
 * explicit one is the peer's real ceiling. The names are per codec, never shared: an H.264 `max-fs`
 * on an H.265 record names no parameter H.265 defines, and reading it would let an unrecognised
 * token lift the level the peer did state.
 */
export interface VideoCodecLimits {
    readonly maxPixels?: number;
    readonly maxPixelsPerSecond?: number;
    /**
     * From `max-fr` in whole frames per second (RFC 7741 §6.1), or from H.265's `max-fps`, which
     * RFC 7798 §7.1 counts over 100 seconds and which is converted here. No codec level states a
     * frame rate, so this one has no level to fall back on.
     */
    readonly maxFrameRate?: number;
    readonly maxBitRate?: number;
}

/**
 * {@link VideoCodecLimits} carrying the codec that stated them.
 *
 * The codec travels inside the limits rather than beside them, so the codec an envelope is computed
 * for is always the codec whose limits narrowed it. {@link videoCodecLimits} is what produces one.
 */
export interface SelectedVideoCodecLimits extends VideoCodecLimits {
    readonly codec: number;
}

/**
 * What an offer states about one media kind.
 *
 * Four statements, four values, none of which can stand in for another. No section of this kind
 * leaves the answer no place to carry it (`absent`); a section the peer rejected (`m=` port 0, RFC 3264 §6) states that no
 * track of this kind may be put in the answer at all (`refused`); a live section the peer will not
 * receive on — `a=sendonly` or `a=inactive` — states that a track put in it would hold an encoder
 * and a reference count for media nobody receives (`notReceiving`); a live section the peer will
 * receive on — `a=recvonly`, `a=sendrecv`, or no direction at all, which is `sendrecv` per RFC 4566
 * §6 — states that this kind reaches the peer through it (`receiving`).
 *
 * A live section states two independent things and its port answers neither: whether the peer will
 * receive our media, and whether it asks to send us audio, which
 * {@link SdpVideoConstraints.wantsTalkback} reads. `a=sendonly` says no to the first and yes to the
 * second.
 *
 * `codecs` on a `receiving` section is what the peer stated it decodes, and it is absent — never
 * empty — when the peer stated nothing, which is a section carrying only statically-mapped payload
 * types (`sdp-transform` builds `media.rtp` from `a=rtpmap` lines only). The two are different
 * statements and an empty list would collapse them, so the parser never stores one and
 * {@link receivableCodecs} is the only way to read the list back.
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
     * Video codecs the offer states a level for that this server cannot map to a decode ceiling.
     *
     * Such a codec is not one this server may select: a level bounds the frame size and the
     * processing rate the peer can decode, so a level it cannot read is a ceiling it cannot honour,
     * and handing the peer a stream past it produces no picture at all. It is kept here rather than
     * dropped from the section's codec list, because a list narrowed to empty reads as "the peer
     * stated no codec", which is the opposite statement — the unconstrained one.
     */
    unreadableLevelCodecs: ReadonlySet<string>;
}

/**
 * Why a track of this kind may not be put in the answer to `offer`, or `undefined` when it may.
 *
 * The one read path for both kinds, so no consumer can read "the section is there" as "we may send
 * media into it": a nonzero port is not permission, the direction is.
 *
 * No offer is not a refusal of anything. The server is then soliciting an offer from the camera,
 * which writes its own m-lines for the streams it is given, so every kind is still open. An offer
 * with no section of this kind is a refusal: an answer carries exactly the m-lines of the offer it
 * answers, in the same order (RFC 3264 §6), so there is no section to attach the track to and a
 * stream allocated for it would hold an encoder and a reference count for media that can never be
 * sent. The asymmetry is answered here rather than at each call site, because reading "no statement"
 * as "no objection" is correct on one path and wrong on the other.
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
 * The codecs the peer stated it can receive for this kind, or none when it stated nothing to narrow
 * by.
 *
 * The one read path for both kinds, so video and audio cannot disagree about what a receiving
 * section carrying no codec means. A section the peer will not receive on answers "nothing to narrow
 * by" as well: narrowing a set to empty is not how a caller learns its peer declined the media, so
 * {@link mediaRefusal} is answered where the track is decided, ahead of any narrowing.
 */
export function receivableCodecs(disposition: MediaDisposition): readonly string[] | undefined {
    return disposition.state === "receiving" ? disposition.codecs : undefined;
}

/**
 * `key`'s value in an `a=fmtp` parameter list, or none when the list does not state it.
 *
 * The name is matched without regard to case: `a=fmtp` carries media type parameters (RFC 8866
 * §6.15), whose names are case-insensitive (RFC 6838 §4.3), so `MAX-FS` states the same ceiling as
 * `max-fs`. Missing one is not a parse failure the caller sees — it silently drops the peer's decode
 * limit and lets a stream it cannot decode be allocated.
 */
function fmtpValue(params: string, key: string): string | undefined {
    const match = new RegExp(`(?:^|;)\\s*${key}=([^;\\s]+)`, "i").exec(params);
    return match?.[1];
}

/**
 * {@link fmtpValue} read as a whole number, or none when the list does not state the key or states
 * it as something other than digits.
 */
function fmtpNumber(params: string, key: string): number | undefined {
    const value = fmtpValue(params, key);
    return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
}

/**
 * How one codec spells the `a=fmtp` parameters this server reads, and how to read its level.
 *
 * Every parameter name belongs to one codec's own RTP payload format, so the set is per codec and
 * never shared: H.264's frame size is `max-fs` in macroblocks (RFC 6184 §8.1) while H.265's is
 * `max-lps` in luma samples (RFC 7798 §7.1), and reading an H.264 name on an H.265 record would take
 * a token that codec never defined as a licence to exceed the level it did state.
 *
 * `pixelsPerUnit` converts that codec's frame-size and rate units to pixels; `frameRatePerUnit`
 * converts its frame-rate parameter to whole frames per second — 1 for `max-fr` and 1/100 for
 * H.265's `max-fps`, which RFC 7798 §7.1 counts over 100 seconds.
 */
interface CodecFmtpParameters {
    readonly level?: { readonly name: string; readonly read: (value: string) => CodecLevelLimits | undefined };
    readonly maxFrameSize: string;
    readonly maxSampleRate: string;
    readonly maxFrameRate: string;
    readonly pixelsPerUnit: number;
    readonly frameRatePerUnit: number;
}

/**
 * The reading for a codec this server has no payload format for.
 *
 * H.264's names and units, because that is what every earlier release read for every codec and
 * dropping them would widen a bound an offer already states. No level is read, so such a codec is
 * bounded by whatever it states explicitly and by nothing else.
 */
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
 * What one `a=fmtp` record states about its codec's level.
 *
 * `none` covers both a codec whose level parameter this server does not read — H.266 and AV1 have
 * no table here — and one that states no level at all. The RFC-inferred defaults for an absent
 * level are deliberately not applied: H.264's is `42000A`, Baseline level 1, whose MaxMBPS bounds a
 * 1080p stream below one frame per second, so inferring it from a record that states only `max-fs`
 * would refuse offers no peer meant to restrict.
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
    /**
     * The direction of the first live section the peer will not receive on, if there is one.
     *
     * Both values forbid a track of this kind equally, so which one is reported changes no decision
     * and exists to be named in a log line.
     */
    notReceiving?: "sendonly" | "inactive";
    refused: boolean;
    codecs: string[];
}

/**
 * One section the peer will receive on makes the kind receiving, whatever the other sections say.
 *
 * A live section the peer will not receive on outranks a rejected one, because it is the section
 * that still exists in the negotiation. Both forbid the track, so the order decides only which
 * statement is reported.
 */
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
 * How the offer's video codec list splits into the codecs this server may select and the ones it
 * must refuse, or none when the offer stated no codec list to narrow by.
 *
 * The one read path for the split, so the codec a stream is requested in and the codec whose limits
 * bound it cannot come from different rules. A codec whose level could not be read is reported
 * rather than quietly dropped: it is what tells the caller why a list the peer did state narrowed to
 * nothing, and "no codec in common" would be an untrue answer to that.
 */
export function decodableVideoCodecs(
    sdp: SdpVideoConstraints,
): { readonly decodable: readonly string[]; readonly unreadable: readonly string[] } | undefined {
    const offered = receivableCodecs(sdp.video);
    if (offered === undefined) return undefined;
    return {
        decodable: offered.filter(name => !sdp.unreadableLevelCodecs.has(name)),
        unreadable: offered.filter(name => sdp.unreadableLevelCodecs.has(name)),
    };
}

/**
 * The offer's limits on `codec`, or none when the offer stated none for it.
 *
 * Reads an offer's limits into a {@link SelectedVideoCodecLimits}, which carries the codec they were
 * read for: everything downstream receives the two as one value and cannot pair them differently.
 *
 * A codec the offer names with no `a=fmtp` record of its own states nothing here, so the offer
 * places no limit on it. Its own record is the bound to read, never another codec's `max-fs`.
 */
export function videoCodecLimits(sdp: SdpVideoConstraints | undefined, codec: number): SelectedVideoCodecLimits {
    const limits = sdp?.limitsByCodec.get(videoCodecName(codec));
    return { codec, ...limits };
}

/**
 * Constraints an SDP offer places on a stream.
 *
 * The SDP is a filter, not a selector: it states an upper bound on what the caller can decode and
 * says nothing about what it wants. An unparseable offer states nothing for either kind rather than
 * throwing here, which {@link mediaRefusal} answers the same way as an offer that carries no section
 * of a kind: the request fails instead of putting a stream into an offer the server could not read.
 */
export function parseSdpVideoConstraints(sdp: string): SdpVideoConstraints {
    const limitsByCodec = new Map<string, VideoCodecLimits>();
    const unreadableLevelCodecs = new Set<string>();
    const videoSections: MediaSections = { receiving: false, refused: false, codecs: new Array<string>() };
    const audioSections: MediaSections = { receiving: false, refused: false, codecs: new Array<string>() };
    let wantsTalkback = false;

    let parsed;
    try {
        parsed = parse(sdp);
    } catch (error) {
        // The refusal this produces names the missing sections, so without this line the caller is
        // told its offer carries no media when the real answer is that none of it could be read.
        logger.notice("Ignoring unparseable SDP offer; no media section can be read from it", error);
        return {
            video: { state: "absent" },
            audio: { state: "absent" },
            wantsTalkback: false,
            limitsByCodec,
            unreadableLevelCodecs,
        };
    }

    for (const media of parsed.media ?? []) {
        const sections = media.type === "video" ? videoSections : media.type === "audio" ? audioSections : undefined;
        if (sections === undefined) continue;
        if (media.port === 0) {
            sections.refused = true;
            // A rejected section states only that the peer refused the kind. Its codecs, its limits
            // and its direction describe media that will never flow.
            continue;
        }
        // RFC 4566 §5.13 makes a session-level attribute apply to every section that does not
        // restate it, and §6 makes a section stating no direction `sendrecv` — which offers to send,
        // so such an audio section asks for talkback.

        const direction = media.direction ?? parsed.direction ?? "sendrecv";
        if (media.type === "audio" && (direction === "sendonly" || direction === "sendrecv")) {
            wantsTalkback = true;
        }
        if (direction === "sendonly" || direction === "inactive") {
            sections.notReceiving ??= direction;
            // The peer will not receive this kind here, so this section's codecs and `a=fmtp` limits
            // describe media that cannot reach it.
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
                // An `a=fmtp` line whose payload type has no `a=rtpmap` names no codec in this
                // section. Every codec this server can select is dynamically mapped, so there is no
                // codec to attribute the limit to and guessing one would clamp the wrong stream.
                if (codec === undefined) continue;
                const parameters = FMTP_PARAMETERS.get(codec) ?? DEFAULT_FMTP_PARAMETERS;
                const level = statedLevel(parameters, entry.config);
                if (level.state === "unreadable") {
                    // Reading this as "no limit" is what the hard-bound rule forbids: the peer
                    // stated a decode ceiling and the server would allocate past it.
                    unreadableLevelCodecs.add(codec);
                    logger.notice(
                        `Offer states ${codec} ${level.parameter}=${level.value}, which is no level this server can bound a stream by; ${codec} is not selectable for it`,
                    );
                    continue;
                }
                const stated = level.state === "read" ? level.limits : undefined;
                const frameSize = fmtpNumber(entry.config, parameters.maxFrameSize);
                const sampleRate = fmtpNumber(entry.config, parameters.maxSampleRate);
                const frameRate = fmtpNumber(entry.config, parameters.maxFrameRate);
                const bitRate = fmtpNumber(entry.config, "max-br");
                const maxPixels = frameSize === undefined ? stated?.maxPixels : frameSize * parameters.pixelsPerUnit;
                const maxPixelsPerSecond =
                    sampleRate === undefined ? stated?.maxPixelsPerSecond : sampleRate * parameters.pixelsPerUnit;
                const maxBitRate = bitRate === undefined ? stated?.maxBitRate : bitRate * BITS_PER_KILOBIT;
                const maxFrameRate = frameRate === undefined ? undefined : frameRate * parameters.frameRatePerUnit;
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
        unreadableLevelCodecs,
    };
}
