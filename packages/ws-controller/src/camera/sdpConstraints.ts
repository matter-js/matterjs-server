/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import { parse } from "sdp-transform";

const logger = Logger.get("sdpConstraints");

/** A macroblock is 16x16 pixels; max-fs and max-mbps are both expressed in macroblocks. */
const PIXELS_PER_MACROBLOCK = 256;
/** max-br is in kilobits per second. */
const BITS_PER_KILOBIT = 1000;

export interface SdpVideoConstraints {
    /** Video codec names in m-line preference order, upper-cased. */
    codecs: string[];
    audioCodecs: string[];
    hasVideo: boolean;
    hasAudio: boolean;
    /** True when the audio m-line offers to send, i.e. the caller wants talkback. */
    wantsTalkback: boolean;
    maxPixels?: number;
    maxPixelsPerSecond?: number;
    maxBitRate?: number;
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

/**
 * Constraints an SDP offer places on a stream.
 *
 * The SDP is a filter, not a selector: it states an upper bound on what the caller can decode and
 * says nothing about what it wants. An unparseable offer yields no constraints rather than throwing,
 * so a malformed offer fails later on codec intersection with a typed error instead of here.
 */
export function parseSdpVideoConstraints(sdp: string): SdpVideoConstraints {
    const result: SdpVideoConstraints = {
        codecs: new Array<string>(),
        audioCodecs: new Array<string>(),
        hasVideo: false,
        hasAudio: false,
        wantsTalkback: false,
    };

    let parsed;
    try {
        parsed = parse(sdp);
    } catch (error) {
        logger.debug("Ignoring unparseable SDP offer", error);
        return result;
    }

    for (const media of parsed.media ?? []) {
        const codecs = (media.rtp ?? []).map(entry => entry.codec.toUpperCase());
        if (media.type === "video") {
            result.hasVideo = true;
            for (const codec of codecs) {
                if (!result.codecs.includes(codec)) result.codecs.push(codec);
            }
            for (const entry of media.fmtp ?? []) {
                const maxFs = fmtpNumber(entry.config, "max-fs");
                const maxMbps = fmtpNumber(entry.config, "max-mbps");
                const maxBr = fmtpNumber(entry.config, "max-br");
                if (maxFs !== undefined) {
                    result.maxPixels = smallest(result.maxPixels, maxFs * PIXELS_PER_MACROBLOCK);
                }
                if (maxMbps !== undefined) {
                    result.maxPixelsPerSecond = smallest(result.maxPixelsPerSecond, maxMbps * PIXELS_PER_MACROBLOCK);
                }
                if (maxBr !== undefined) {
                    result.maxBitRate = smallest(result.maxBitRate, maxBr * BITS_PER_KILOBIT);
                }
            }
        } else if (media.type === "audio") {
            result.hasAudio = true;
            for (const codec of codecs) {
                if (!result.audioCodecs.includes(codec)) result.audioCodecs.push(codec);
            }
            if (media.direction === "sendrecv" || media.direction === "sendonly") {
                result.wantsTalkback = true;
            }
        }
    }

    return result;
}
