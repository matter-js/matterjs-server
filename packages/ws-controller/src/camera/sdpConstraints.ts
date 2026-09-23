/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import { parse } from "sdp-transform";
import { videoCodecName } from "./wireNames.js";

const logger = Logger.get("sdpConstraints");

/** A macroblock is 16x16 pixels; max-fs and max-mbps are both expressed in macroblocks. */
const PIXELS_PER_MACROBLOCK = 256;
/** max-br is in kilobits per second. */
const BITS_PER_KILOBIT = 1000;

/**
 * What one video codec's `a=fmtp` lines state it can decode.
 *
 * An `a=fmtp` record binds its own payload type and nothing else, so an offer carrying H.264 at
 * `max-fs=3600` beside H.265 at `max-fs=8160` states two limits, not one. Every record naming the
 * same codec is folded to the tighter value — several payload types in one section, and several
 * sections — since which of them the camera picks is not this server's to decide.
 */
export interface VideoCodecLimits {
    readonly maxPixels?: number;
    readonly maxPixelsPerSecond?: number;
    /** From `max-fr`, which RFC 7741 §6.1 defines in whole frames per second. */
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
 * Three statements, three values, none of which can stand in for another. No section of this kind
 * states nothing (`absent`); a section the peer rejected (`m=` port 0, RFC 3264 §6) states that no
 * track of this kind may be put in the answer at all (`refused`); a live section states that the
 * peer will receive this kind (`offered`).
 *
 * `codecs` on an `offered` section is what the peer stated it decodes, and it is absent — never
 * empty — when the peer stated nothing, which is a section carrying only statically-mapped payload
 * types (`sdp-transform` builds `media.rtp` from `a=rtpmap` lines only). The two are different
 * statements and an empty list would collapse them, so the parser never stores one and
 * {@link offeredCodecs} is the only way to read the list back.
 */
export type MediaDisposition =
    | { readonly state: "absent" }
    | { readonly state: "refused" }
    | { readonly state: "offered"; readonly codecs?: readonly string[] };

export interface SdpVideoConstraints {
    video: MediaDisposition;
    audio: MediaDisposition;
    /** True when an offered audio m-line asks to send, i.e. the caller wants talkback. */
    wantsTalkback: boolean;
    /** Per-codec fmtp limits, keyed by upper-cased codec name. A codec absent here stated none. */
    limitsByCodec: ReadonlyMap<string, VideoCodecLimits>;
}

/**
 * The codecs the peer stated it decodes for this kind, or none when it stated nothing to narrow by.
 *
 * The one read path for both kinds, so video and audio cannot disagree about what an offered
 * section carrying no codec means. A refusal also answers "nothing to narrow by": it is answered
 * where the track is decided, ahead of any narrowing, because narrowing a set to empty is not how a
 * caller learns its peer declined the media.
 */
export function offeredCodecs(disposition: MediaDisposition): readonly string[] | undefined {
    return disposition.state === "offered" ? disposition.codecs : undefined;
}

function fmtpNumber(params: string, key: string): number | undefined {
    const match = new RegExp(`(?:^|;)\\s*${key}=(\\d+)`).exec(params);
    return match === null ? undefined : Number(match[1]);
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
    offered: boolean;
    refused: boolean;
    codecs: string[];
}

/** One live section makes the kind offered, whatever the other sections of that kind say. */
function disposition(sections: MediaSections): MediaDisposition {
    if (sections.offered) {
        return sections.codecs.length === 0 ? { state: "offered" } : { state: "offered", codecs: sections.codecs };
    }
    return sections.refused ? { state: "refused" } : { state: "absent" };
}

/**
 * The offer's limits on `codec`, or none when the offer stated none for it.
 *
 * Reads an offer's limits into a {@link SelectedVideoCodecLimits}, which carries the codec they were
 * read for: everything downstream receives the two as one value and cannot pair them differently.
 *
 * A codec that states its ceiling only through `profile-level-id` (H.264), `level-id` (H.265) or
 * `max-fps` (H.265, in frames per 100 seconds) states nothing here — those are not parsed — so the
 * offer places no limit on it. Its own level is the bound to read, never another codec's `max-fs`.
 */
export function videoCodecLimits(sdp: SdpVideoConstraints | undefined, codec: number): SelectedVideoCodecLimits {
    const limits = sdp?.limitsByCodec.get(videoCodecName(codec));
    return { codec, ...limits };
}

/**
 * Constraints an SDP offer places on a stream.
 *
 * The SDP is a filter, not a selector: it states an upper bound on what the caller can decode and
 * says nothing about what it wants. An unparseable offer yields no constraints rather than throwing,
 * so a malformed offer fails later on codec intersection with a typed error instead of here.
 */
export function parseSdpVideoConstraints(sdp: string): SdpVideoConstraints {
    const limitsByCodec = new Map<string, VideoCodecLimits>();
    const videoSections: MediaSections = { offered: false, refused: false, codecs: new Array<string>() };
    const audioSections: MediaSections = { offered: false, refused: false, codecs: new Array<string>() };
    let wantsTalkback = false;

    let parsed;
    try {
        parsed = parse(sdp);
    } catch (error) {
        logger.debug("Ignoring unparseable SDP offer", error);
        return { video: { state: "absent" }, audio: { state: "absent" }, wantsTalkback: false, limitsByCodec };
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
        sections.offered = true;
        const codecsByPayload = new Map<number, string>();
        for (const entry of media.rtp ?? []) codecsByPayload.set(entry.payload, entry.codec.toUpperCase());
        for (const codec of codecsByPayload.values()) {
            if (!sections.codecs.includes(codec)) sections.codecs.push(codec);
        }
        if (media.type === "video") {
            for (const entry of media.fmtp ?? []) {
                const codec = codecsByPayload.get(entry.payload);
                if (codec === undefined) continue;
                const maxFs = fmtpNumber(entry.config, "max-fs");
                const maxMbps = fmtpNumber(entry.config, "max-mbps");
                const maxFr = fmtpNumber(entry.config, "max-fr");
                const maxBr = fmtpNumber(entry.config, "max-br");
                tighten(limitsByCodec, codec, {
                    ...(maxFs === undefined ? {} : { maxPixels: maxFs * PIXELS_PER_MACROBLOCK }),
                    ...(maxMbps === undefined ? {} : { maxPixelsPerSecond: maxMbps * PIXELS_PER_MACROBLOCK }),
                    ...(maxFr === undefined ? {} : { maxFrameRate: maxFr }),
                    ...(maxBr === undefined ? {} : { maxBitRate: maxBr * BITS_PER_KILOBIT }),
                });
            }
        } else if (media.direction === "sendrecv" || media.direction === "sendonly") {
            wantsTalkback = true;
        }
    }

    return {
        video: disposition(videoSections),
        audio: disposition(audioSections),
        wantsTalkback,
        limitsByCodec,
    };
}
