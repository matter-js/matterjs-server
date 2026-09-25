/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import {
    decodableVideoCodecs,
    mediaRefusal,
    parseSdpVideoConstraints,
    receivableCodecs,
    videoCodecLimits,
} from "../src/camera/sdpConstraints.js";

const H264 = CameraAvStreamManagement.VideoCodec.H264;
const H265 = CameraAvStreamManagement.VideoCodec.Hevc;

/** A receiving video section offering one codec, with `params` as its only `a=fmtp` line. */
function offerWithFmtp(codec: string, params: string): string {
    return [
        "v=0",
        "o=- 1 1 IN IP4 127.0.0.1",
        "s=-",
        "t=0 0",
        "m=video 9 UDP/TLS/RTP/SAVPF 102",
        "c=IN IP4 0.0.0.0",
        "a=recvonly",
        `a=rtpmap:102 ${codec}/90000`,
        `a=fmtp:102 ${params}`,
        "",
    ].join("\r\n");
}

const OFFER_H265_THEN_H264 = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 100 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:100 H265/90000",
    "a=fmtp:100 level-id=93",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 profile-level-id=42e01f;max-fs=8160;max-mbps=245760;max-br=5000",
    "",
].join("\r\n");

const OFFER_TWO_VIDEO_LEVEL_CAPS = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 100 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:100 H265/90000",
    "a=fmtp:100 max-lps=2088960",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 max-fs=3600",
    "",
].join("\r\n");

/** RFC 6838 §4.3 makes media type parameter names case-insensitive, and peers do vary the spelling. */
const OFFER_UPPER_CASE_FMTP = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 profile-level-id=42e01f;MAX-FS=3600;Max-Mbps=108000;MAX-FR=15;Max-Br=2000",
    "",
].join("\r\n");

const OFFER_AUDIO_SENDRECV = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=sendrecv",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_AUDIO_SENDONLY = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=sendonly",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_SAME_CODEC_TWO_PAYLOADS = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 100 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:100 H264/90000",
    "a=fmtp:100 profile-level-id=42e01f;max-fs=3600",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 profile-level-id=640c1f;max-fs=8160",
    "",
].join("\r\n");

const OFFER_VIDEO_ONLY_REJECTED = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 0 UDP/TLS/RTP/SAVPF 100",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:100 H265/90000",
    "",
].join("\r\n");

const OFFER_REJECTED_SECTIONS = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 0 UDP/TLS/RTP/SAVPF 100",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:100 AV1/90000",
    "a=fmtp:100 max-fs=900",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:102 H264/90000",
    "m=audio 0 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=sendrecv",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_VIDEO_SENDONLY = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=sendonly",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 max-fs=900",
    "",
].join("\r\n");

const OFFER_VIDEO_INACTIVE = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=inactive",
    "a=rtpmap:102 H264/90000",
    "",
].join("\r\n");

const OFFER_VIDEO_NO_DIRECTION = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 max-fs=3600",
    "",
].join("\r\n");

const OFFER_SESSION_INACTIVE = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=inactive",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:102 H264/90000",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_VIDEO_SENDONLY_AND_RECVONLY = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 100",
    "c=IN IP4 0.0.0.0",
    "a=sendonly",
    "a=rtpmap:100 AV1/90000",
    "a=fmtp:100 max-fs=900",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:102 H264/90000",
    "",
].join("\r\n");

const OFFER_AUDIO_NO_DIRECTION = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_SESSION_SENDRECV = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=sendrecv",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:102 H264/90000",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_VIDEO_SENDRECV = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=sendrecv",
    "a=rtpmap:102 H264/90000",
    "",
].join("\r\n");

const OFFER_TWO_AUDIO_SECTIONS = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 8",
    "c=IN IP4 0.0.0.0",
    "a=inactive",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=sendrecv",
    "a=rtpmap:111 opus/48000/2",
    "",
].join("\r\n");

const OFFER_VIDEO_REJECTED_AND_SENDONLY = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 0 UDP/TLS/RTP/SAVPF 100",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:100 AV1/90000",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=sendonly",
    "a=rtpmap:102 H264/90000",
    "",
].join("\r\n");

describe("sdpConstraints", () => {
    describe("parseSdpVideoConstraints", () => {
        it("lists video codecs in m-line preference order", () => {
            expect(receivableCodecs(parseSdpVideoConstraints(OFFER_H265_THEN_H264).video)).to.deep.equal([
                "H265",
                "H264",
            ]);
        });

        it("reports a video m-line and no audio m-line", () => {
            const constraints = parseSdpVideoConstraints(OFFER_H265_THEN_H264);
            expect(constraints.video.state).to.equal("receiving");
            expect(constraints.audio.state).to.equal("absent");
        });

        it("converts max-fs macroblocks to a pixel ceiling for the codec that stated it", () => {
            // max-fs counts 16x16 macroblocks: 8160 * 256 = 2088960 pixels (1920x1088).
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H264).maxPixels).to.equal(2088960);
        });

        it("converts max-mbps macroblocks per second to a pixel rate ceiling", () => {
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H264).maxPixelsPerSecond).to.equal(
                245760 * 256,
            );
        });

        it("reads max-br as kilobits per second and reports bits per second", () => {
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H264).maxBitRate).to.equal(
                5000 * 1000,
            );
        });

        it("reads an fmtp parameter name written in upper case", () => {
            // Dropping these leaves the codec unconstrained, and the peer is handed a stream past
            // the ceiling it stated it can decode.
            const limits = videoCodecLimits(parseSdpVideoConstraints(OFFER_UPPER_CASE_FMTP), H264);
            expect(limits.maxPixels).to.equal(3600 * 256);
            expect(limits.maxPixelsPerSecond).to.equal(108000 * 256);
            expect(limits.maxFrameRate).to.equal(15);
            expect(limits.maxBitRate).to.equal(2000 * 1000);
        });

        it("bounds a codec offered at a level alone by that level, not by another codec's max-fs", () => {
            // H265 is offered at level-id=93 alone, and H264 beside it states max-fs=8160. Folding
            // that in would clamp an H265 stream to a bound H265 never stated; reading the level as
            // no statement at all would leave H265 unbounded, which is the worse of the two.
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H265)).to.deep.equal({
                codec: H265,
                maxPixels: 983040,
                maxPixelsPerSecond: 33177600,
            });
        });

        it("keeps each codec's level cap apart instead of folding them into one", () => {
            const constraints = parseSdpVideoConstraints(OFFER_TWO_VIDEO_LEVEL_CAPS);
            // H.265 states its frame size in luma samples (`max-lps`), H.264 in macroblocks
            // (`max-fs`), so the same ceiling is written two ways and neither reads the other's.
            expect(videoCodecLimits(constraints, H265).maxPixels).to.equal(2088960);
            expect(videoCodecLimits(constraints, H264).maxPixels).to.equal(3600 * 256);
        });

        it("takes the tighter of two payload types of the same codec", () => {
            // Which profile the camera encodes in is not this server's to pick, so only the value both
            // payload types can decode is a bound it may rely on.
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_SAME_CODEC_TWO_PAYLOADS), H264).maxPixels).to.equal(
                3600 * 256,
            );
        });

        it("reads an H.264 level as a frame size, pixel rate and bit rate ceiling", () => {
            // H.264 Table A-1, level 3.1: MaxFS 3600 macroblocks, MaxMBPS 108000, MaxBR 14000 kbit/s.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e01f")),
                H264,
            );
            expect(limits.maxPixels).to.equal(3600 * 256);
            expect(limits.maxPixelsPerSecond).to.equal(108000 * 256);
            expect(limits.maxBitRate).to.equal(14000 * 1000);
        });

        it("lets an explicit max-fs raise the level's frame size", () => {
            // RFC 6184 §8.1 defines max-fs as signalling a capability at or above the level's, so the
            // explicit value is the peer's real ceiling and the level fills in what it leaves unsaid.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e01f;max-fs=8160")),
                H264,
            );
            expect(limits.maxPixels).to.equal(8160 * 256);
            expect(limits.maxPixelsPerSecond).to.equal(108000 * 256);
        });

        it("reads constraint_set3_flag on a Baseline level_idc 11 as level 1b", () => {
            // RFC 6184 §8.1: profile_idc 66/77/88 with level_idc 11 and constraint_set3_flag set is
            // level 1b, whose MaxBR is half of level 1.1's. 0x4d = Main, 0x50 sets constraint_set3.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=4d500b")),
                H264,
            );
            expect(limits.maxPixels).to.equal(99 * 256);
            expect(limits.maxBitRate).to.equal(128 * 1000);
        });

        it("reads the same level_idc without that flag as level 1.1", () => {
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=4d400b")),
                H264,
            );
            expect(limits.maxPixels).to.equal(396 * 256);
            expect(limits.maxBitRate).to.equal(192 * 1000);
        });

        it("reads constraint_set3_flag outside those three profiles as level 1.1", () => {
            // 0x64 is High, which RFC 6184 §8.1 leaves out of the level 1b rule, so level_idc 11 is
            // level 1.1 there whatever the flag says.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=64100b")),
                H264,
            );
            expect(limits.maxPixels).to.equal(396 * 256);
        });

        it("reads level_idc 9 as level 1b, which is how the other profiles spell it", () => {
            // H.264 §A.3.1 gives level 1b two spellings; a High-profile offer uses this one, and
            // refusing it would reject a conformant peer for a level Table A-1 does define.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=640009")),
                H264,
            );
            expect(limits.maxPixels).to.equal(99 * 256);
            expect(limits.maxBitRate).to.equal(128 * 1000);
        });

        it("reads H.265 max-fps as frames per 100 seconds", () => {
            // RFC 7798 §7.1 states max-fps in frames per 100 seconds, unlike max-fr's whole frames
            // per second, so taking the digits as they stand is a 100x overstatement of the ceiling.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H265", "level-id=93;max-fps=1500")),
                H265,
            );
            expect(limits.maxFrameRate).to.equal(15);
        });

        it("states no limits for a codec the offer never mentioned", () => {
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H264 + 99)).to.deep.equal({
                codec: H264 + 99,
            });
        });

        it("reads no H.264 parameter name on an H.265 record", () => {
            // `max-fs` and `max-fr` are RFC 6184 / RFC 7741 names H.265 never defines. Reading them
            // here would let an unrecognised token lift the ceiling `level-id` did state.
            const offer = offerWithFmtp("H265", "level-id=93;max-fs=1000000;max-fr=60");
            expect(videoCodecLimits(parseSdpVideoConstraints(offer), H265)).to.deep.equal({
                codec: H265,
                maxPixels: 983040,
                maxPixelsPerSecond: 33177600,
            });
        });

        it("reads H.265's own max-lps and max-lsr in luma samples", () => {
            // RFC 7798 §7.1 states both in luma samples, not macroblocks, so no 256x conversion.
            const offer = offerWithFmtp("H265", "level-id=93;max-lps=2228224;max-lsr=133693440");
            expect(videoCodecLimits(parseSdpVideoConstraints(offer), H265)).to.deep.equal({
                codec: H265,
                maxPixels: 2228224,
                maxPixelsPerSecond: 133693440,
            });
        });

        it("reads max-fr as a frame rate ceiling for the codec that stated it", () => {
            const offer = [
                "v=0",
                "o=- 0 0 IN IP4 127.0.0.1",
                "s=-",
                "t=0 0",
                "m=video 9 UDP/TLS/RTP/SAVPF 96",
                "a=rtpmap:96 H264/90000",
                "a=fmtp:96 max-fs=8160;max-fr=10",
                "",
            ].join("\r\n");
            expect(videoCodecLimits(parseSdpVideoConstraints(offer), H264)).to.deep.equal({
                codec: H264,
                maxPixels: 8160 * 256,
                maxFrameRate: 10,
            });
        });

        it("states no limits when there is no offer at all", () => {
            expect(videoCodecLimits(undefined, H265)).to.deep.equal({ codec: H265 });
        });

        it("separates a refused video section from an offer that has none", () => {
            // Opposite statements: one peer declined video, the other left the track to the server.
            expect(parseSdpVideoConstraints(OFFER_VIDEO_ONLY_REJECTED).video.state).to.equal("refused");
            expect(parseSdpVideoConstraints(OFFER_AUDIO_SENDRECV).video.state).to.equal("absent");
        });

        it("ignores a rejected video section's codecs and limits while a live one stands", () => {
            const constraints = parseSdpVideoConstraints(OFFER_REJECTED_SECTIONS);
            expect(constraints.video.state).to.equal("receiving");
            expect(receivableCodecs(constraints.video)).to.deep.equal(["H264"]);
            expect(videoCodecLimits(constraints, CameraAvStreamManagement.VideoCodec.Av1)).to.deep.equal({
                codec: CameraAvStreamManagement.VideoCodec.Av1,
            });
        });

        it("reports a rejected audio section as refused, with no codecs and no talkback", () => {
            const constraints = parseSdpVideoConstraints(OFFER_REJECTED_SECTIONS);
            expect(constraints.audio.state).to.equal("refused");
            expect(receivableCodecs(constraints.audio)).to.equal(undefined);
            expect(constraints.wantsTalkback).to.equal(false);
        });

        it("reports audio codecs and talkback intent from a sendrecv audio m-line", () => {
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_SENDRECV);
            expect(constraints.audio.state).to.equal("receiving");
            expect(receivableCodecs(constraints.audio)).to.deep.equal(["OPUS"]);
            expect(constraints.wantsTalkback).to.equal(true);
        });

        it("separates an offered section that names no codec from one that names some", () => {
            // sdp-transform builds media.rtp from a=rtpmap lines only, so a section using statically
            // mapped payload types states nothing about what the peer decodes. An empty codec list
            // would say the peer decodes nothing, and every consumer then narrows its set to empty.
            const offer = [
                "v=0",
                "o=- 0 0 IN IP4 127.0.0.1",
                "s=-",
                "t=0 0",
                "m=audio 9 RTP/AVP 0 8",
                "a=recvonly",
                "",
            ].join("\r\n");
            const constraints = parseSdpVideoConstraints(offer);
            expect(constraints.audio.state).to.equal("receiving");
            expect(receivableCodecs(constraints.audio)).to.equal(undefined);
        });

        it("reports talkback intent from a sendonly audio m-line", () => {
            expect(parseSdpVideoConstraints(OFFER_AUDIO_SENDONLY).wantsTalkback).to.equal(true);
        });

        it("reports no talkback for an offer with no audio section", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).wantsTalkback).to.equal(false);
        });

        it("reports no talkback for a recvonly audio section", () => {
            expect(parseSdpVideoConstraints(OFFER_SESSION_INACTIVE).audio.state).to.equal("receiving");
            expect(parseSdpVideoConstraints(OFFER_SESSION_INACTIVE).wantsTalkback).to.equal(false);
        });

        it("reads an audio section stating no direction as asking for talkback", () => {
            // RFC 4566 §6 makes it sendrecv, and sendrecv offers to send.
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_NO_DIRECTION);
            expect(constraints.audio.state).to.equal("receiving");
            expect(constraints.wantsTalkback).to.equal(true);
        });

        it("applies a permissive session-level direction to a section that restates none", () => {
            const constraints = parseSdpVideoConstraints(OFFER_SESSION_SENDRECV);
            expect(constraints.video.state).to.equal("receiving");
            expect(constraints.audio.state).to.equal("receiving");
            expect(constraints.wantsTalkback).to.equal(true);
        });

        it("treats an explicit sendrecv video section as receiving", () => {
            expect(parseSdpVideoConstraints(OFFER_VIDEO_SENDRECV).video.state).to.equal("receiving");
        });

        it("takes one receiving audio section among several of that kind", () => {
            const constraints = parseSdpVideoConstraints(OFFER_TWO_AUDIO_SECTIONS);
            expect(constraints.video.state).to.equal("absent");
            expect(receivableCodecs(constraints.audio)).to.deep.equal(["OPUS"]);
            expect(constraints.wantsTalkback).to.equal(true);
        });

        it("reports the live statement when one section is rejected and another will not receive", () => {
            // Both forbid the track, so the answer is the same either way; the live section is the
            // one still in the negotiation, so it is the one reported.
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_REJECTED_AND_SENDONLY);
            expect(constraints.video).to.deep.equal({ state: "notReceiving", direction: "sendonly" });
        });

        it("reports no constraints for an offer it cannot parse", () => {
            const constraints = parseSdpVideoConstraints("not an sdp");
            expect(constraints.video.state).to.equal("absent");
            expect(receivableCodecs(constraints.video)).to.equal(undefined);
        });

        it("refuses our video for a sendonly section, with no codecs and no limits from it", () => {
            // A nonzero port is not permission to send: the peer states it will only send on this
            // section, so a stream allocated for it would hold an encoder nobody receives from.
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_SENDONLY);
            expect(constraints.video).to.deep.equal({ state: "notReceiving", direction: "sendonly" });
            expect(receivableCodecs(constraints.video)).to.equal(undefined);
            expect(videoCodecLimits(constraints, H264)).to.deep.equal({ codec: H264 });
        });

        it("refuses our video for an inactive section", () => {
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_INACTIVE);
            expect(constraints.video).to.deep.equal({ state: "notReceiving", direction: "inactive" });
        });

        it("treats a section with no direction as sendrecv", () => {
            // RFC 4566 §6: a section stating none of the four direction attributes is sendrecv, so
            // the peer will receive on it.
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_NO_DIRECTION);
            expect(constraints.video.state).to.equal("receiving");
            expect(receivableCodecs(constraints.video)).to.deep.equal(["H264"]);
            expect(videoCodecLimits(constraints, H264).maxPixels).to.equal(3600 * 256);
        });

        it("treats a recvonly section as receiving", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).video.state).to.equal("receiving");
        });

        it("refuses our audio for a sendonly section while still reading its talkback request", () => {
            // The two questions the direction answers pull apart here: the peer will not receive our
            // audio, and it asks to send us its own.
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_SENDONLY);
            expect(constraints.audio).to.deep.equal({ state: "notReceiving", direction: "sendonly" });
            expect(receivableCodecs(constraints.audio)).to.equal(undefined);
            expect(constraints.wantsTalkback).to.equal(true);
        });

        it("applies a session-level direction to a section that restates none", () => {
            // RFC 4566 §5.13: a session-level attribute holds for every section that does not
            // override it, so the video section here is inactive and the audio section is not.
            const constraints = parseSdpVideoConstraints(OFFER_SESSION_INACTIVE);
            expect(constraints.video).to.deep.equal({ state: "notReceiving", direction: "inactive" });
            expect(constraints.audio.state).to.equal("receiving");
        });

        it("ignores a sendonly section's codecs and limits while a receiving one stands", () => {
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_SENDONLY_AND_RECVONLY);
            expect(constraints.video.state).to.equal("receiving");
            expect(receivableCodecs(constraints.video)).to.deep.equal(["H264"]);
            expect(videoCodecLimits(constraints, CameraAvStreamManagement.VideoCodec.Av1)).to.deep.equal({
                codec: CameraAvStreamManagement.VideoCodec.Av1,
            });
        });

        it("states no limit for an fmtp line whose payload type has no rtpmap", () => {
            // Every codec this server can select is dynamically mapped, so such a line names no
            // codec in the section and its limit belongs to none of them.
            const offer = [
                "v=0",
                "o=- 0 0 IN IP4 127.0.0.1",
                "s=-",
                "t=0 0",
                "m=video 9 UDP/TLS/RTP/SAVPF 96 98",
                "a=recvonly",
                "a=rtpmap:96 H265/90000",
                "a=fmtp:98 max-fs=900",
                "",
            ].join("\r\n");
            const constraints = parseSdpVideoConstraints(offer);
            expect(receivableCodecs(constraints.video)).to.deep.equal(["H265"]);
            expect(videoCodecLimits(constraints, H265)).to.deep.equal({ codec: H265 });
        });
    });

    describe("decodableVideoCodecs", () => {
        it("refuses a codec whose level_idc names no row of the level table", () => {
            // 0xff is not a level H.264 Table A-1 defines. Reading it as "no limit" is what lets a
            // stream past the peer's real ceiling be allocated, and a wrong guess is worse than none.
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e0ff"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
            expect(videoCodecLimits(sdp, H264)).to.deep.equal({ codec: H264 });
        });

        it("refuses a profile-level-id that is not three bytes of base16", () => {
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e0"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
        });

        it("refuses an H.265 level-id outside the level tables", () => {
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H265", "level-id=99"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H265"] });
        });

        it("keeps the codec whose level it can read beside the one it cannot", () => {
            const offer = [
                "v=0",
                "o=- 1 1 IN IP4 127.0.0.1",
                "s=-",
                "t=0 0",
                "m=video 9 UDP/TLS/RTP/SAVPF 100 102",
                "c=IN IP4 0.0.0.0",
                "a=recvonly",
                "a=rtpmap:100 H265/90000",
                "a=fmtp:100 level-id=93",
                "a=rtpmap:102 H264/90000",
                "a=fmtp:102 profile-level-id=42e0ff",
                "",
            ].join("\r\n");
            expect(decodableVideoCodecs(parseSdpVideoConstraints(offer))).to.deep.equal({
                decodable: ["H265"],
                unreadable: ["H264"],
            });
        });

        it("states nothing to narrow by when the section named no codec", () => {
            // A section carrying only statically-mapped payload types states no codec at all, which
            // an empty decodable list would be indistinguishable from.
            const offer = [
                "v=0",
                "o=- 1 1 IN IP4 127.0.0.1",
                "s=-",
                "t=0 0",
                "m=video 9 UDP/TLS/RTP/SAVPF 34",
                "c=IN IP4 0.0.0.0",
                "a=recvonly",
                "",
            ].join("\r\n");
            expect(decodableVideoCodecs(parseSdpVideoConstraints(offer))).to.equal(undefined);
        });

        it("keeps a codec that states no level at all", () => {
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "max-fs=3600"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: ["H264"], unreadable: [] });
        });
    });

    describe("mediaRefusal", () => {
        it("names the statement that forbids a track, and answers nothing for the one that does not", () => {
            expect(mediaRefusal(parseSdpVideoConstraints(OFFER_VIDEO_ONLY_REJECTED), "video")).to.deep.equal({
                state: "refused",
            });
            expect(mediaRefusal(parseSdpVideoConstraints(OFFER_VIDEO_SENDONLY), "video")).to.deep.equal({
                state: "notReceiving",
                direction: "sendonly",
            });
            expect(mediaRefusal(parseSdpVideoConstraints(OFFER_VIDEO_INACTIVE), "video")).to.deep.equal({
                state: "notReceiving",
                direction: "inactive",
            });
            expect(mediaRefusal(parseSdpVideoConstraints(OFFER_H265_THEN_H264), "video")).to.equal(undefined);
        });

        it("refuses a kind the offer carries no section for", () => {
            expect(mediaRefusal(parseSdpVideoConstraints(OFFER_H265_THEN_H264), "audio")).to.deep.equal({
                state: "absent",
            });
            expect(mediaRefusal(parseSdpVideoConstraints("v=0"), "video")).to.deep.equal({ state: "absent" });
        });

        it("refuses nothing when there is no offer to answer", () => {
            expect(mediaRefusal(undefined, "video")).to.equal(undefined);
            expect(mediaRefusal(undefined, "audio")).to.equal(undefined);
        });
    });
});
