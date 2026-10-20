/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import {
    answerWithinOfferedDirections,
    decodableVideoCodecs,
    mediaRefusal,
    parseSdpVideoConstraints,
    receivableCodecs,
    videoCodecLimits,
    withoutTalkback,
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

/** Port 0 with `a=bundle-only` is live on the bundle transport (RFC 8843); without it port 0 refuses the section. */
function bundledVideoOffer(bundleOnly: boolean): string {
    return [
        "v=0",
        "o=- 1 1 IN IP4 127.0.0.1",
        "s=-",
        "t=0 0",
        "a=group:BUNDLE 0 1",
        "m=audio 9 UDP/TLS/RTP/SAVPF 111",
        "c=IN IP4 0.0.0.0",
        "a=mid:0",
        "a=recvonly",
        "a=rtpmap:111 opus/48000/2",
        "m=video 0 UDP/TLS/RTP/SAVPF 102",
        "c=IN IP4 0.0.0.0",
        "a=mid:1",
        ...(bundleOnly ? ["a=bundle-only"] : []),
        "a=recvonly",
        "a=rtpmap:102 H264/90000",
        "",
    ].join("\r\n");
}

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
            const limits = videoCodecLimits(parseSdpVideoConstraints(OFFER_UPPER_CASE_FMTP), H264);
            expect(limits.maxPixels).to.equal(3600 * 256);
            expect(limits.maxPixelsPerSecond).to.equal(108000 * 256);
            expect(limits.maxFrameRate).to.equal(15);
            expect(limits.maxBitRate).to.equal(2000 * 1000);
        });

        it("bounds a codec offered at a level alone by that level, not by another codec's max-fs", () => {
            // H265 states only level-id=93; the max-fs=8160 beside it belongs to H264.
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H265)).to.deep.equal({
                codec: H265,
                maxPixels: 983040,
                maxPixelsPerSecond: 33177600,
            });
        });

        it("keeps each codec's level cap apart instead of folding them into one", () => {
            const constraints = parseSdpVideoConstraints(OFFER_TWO_VIDEO_LEVEL_CAPS);
            // H.265 states frame size in luma samples (`max-lps`), H.264 in macroblocks (`max-fs`).
            expect(videoCodecLimits(constraints, H265).maxPixels).to.equal(2088960);
            expect(videoCodecLimits(constraints, H264).maxPixels).to.equal(3600 * 256);
        });

        it("takes the tighter of two payload types of the same codec", () => {
            // The server does not pick the profile the camera encodes in, so only the tighter bound is safe.
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
            // RFC 6184 §8.1: max-fs signals a capability at or above the level's.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e01f;max-fs=8160")),
                H264,
            );
            expect(limits.maxPixels).to.equal(8160 * 256);
            expect(limits.maxPixelsPerSecond).to.equal(108000 * 256);
        });

        it("refuses the codec when an fmtp capability value is not whole digits", () => {
            // The parameter overrides the level, so the level is not a ceiling the peer still states.
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e01f;max-fs=8160px"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
            expect(videoCodecLimits(sdp, H264).maxPixels).to.equal(undefined);
        });

        it("refuses the codec when a malformed fmtp value stands beside no level at all", () => {
            // Reading the malformed value as absent would leave the codec unbounded.
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "max-fs=8160px"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
            expect(videoCodecLimits(sdp, H264).maxPixels).to.equal(undefined);
        });

        it("refuses the codec for a malformed max-br, which no level states for H.265", () => {
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H265", "level-id=93;max-br=1e6"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H265"] });
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
            // H.264 §A.3.1 gives level 1b two spellings.
            const limits = videoCodecLimits(
                parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=640009")),
                H264,
            );
            expect(limits.maxPixels).to.equal(99 * 256);
            expect(limits.maxBitRate).to.equal(128 * 1000);
        });

        it("reads H.265 max-fps as frames per 100 seconds", () => {
            // RFC 7798 §7.1 states max-fps in frames per 100 seconds.
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
            // `max-fs` and `max-fr` are RFC 6184 / RFC 7741 names that H.265 does not define.
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

        it("counts a port 0 video section marked bundle-only as offered", () => {
            const video = parseSdpVideoConstraints(bundledVideoOffer(true)).video;
            expect(video.state).to.equal("receiving");
            expect(receivableCodecs(video)).to.deep.equal(["H264"]);
        });

        it("still refuses a port 0 video section that is not bundle-only", () => {
            expect(parseSdpVideoConstraints(bundledVideoOffer(false)).video.state).to.equal("refused");
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
            expect(constraints.sendingAudioSections).to.deep.equal([]);
        });

        it("reports audio codecs and talkback intent from a sendrecv audio m-line", () => {
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_SENDRECV);
            expect(constraints.audio.state).to.equal("receiving");
            expect(receivableCodecs(constraints.audio)).to.deep.equal(["OPUS"]);
            expect(constraints.sendingAudioSections).to.not.be.empty;
        });

        it("separates an offered section that names no codec from one that names some", () => {
            // sdp-transform builds media.rtp from a=rtpmap lines only, so static payload types name no codec.
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
            expect(parseSdpVideoConstraints(OFFER_AUDIO_SENDONLY).sendingAudioSections).to.not.be.empty;
        });

        it("reports no talkback for an offer with no audio section", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).sendingAudioSections).to.deep.equal([]);
        });

        it("reports no talkback for a recvonly audio section", () => {
            expect(parseSdpVideoConstraints(OFFER_SESSION_INACTIVE).audio.state).to.equal("receiving");
            expect(parseSdpVideoConstraints(OFFER_SESSION_INACTIVE).sendingAudioSections).to.deep.equal([]);
        });

        it("reads an audio section stating no direction as asking for talkback", () => {
            // RFC 4566 §6 makes it sendrecv, and sendrecv offers to send.
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_NO_DIRECTION);
            expect(constraints.audio.state).to.equal("receiving");
            expect(constraints.sendingAudioSections).to.not.be.empty;
        });

        it("applies a permissive session-level direction to a section that restates none", () => {
            const constraints = parseSdpVideoConstraints(OFFER_SESSION_SENDRECV);
            expect(constraints.video.state).to.equal("receiving");
            expect(constraints.audio.state).to.equal("receiving");
            expect(constraints.sendingAudioSections).to.not.be.empty;
        });

        it("treats an explicit sendrecv video section as receiving", () => {
            expect(parseSdpVideoConstraints(OFFER_VIDEO_SENDRECV).video.state).to.equal("receiving");
        });

        it("takes one receiving audio section among several of that kind", () => {
            const constraints = parseSdpVideoConstraints(OFFER_TWO_AUDIO_SECTIONS);
            expect(constraints.video.state).to.equal("absent");
            expect(receivableCodecs(constraints.audio)).to.deep.equal(["OPUS"]);
            expect(constraints.sendingAudioSections).to.not.be.empty;
        });

        it("reports the live statement when one section is rejected and another will not receive", () => {
            // Both forbid the track; the live section is the one still in the negotiation.
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_REJECTED_AND_SENDONLY);
            expect(constraints.video).to.deep.equal({ state: "notReceiving", direction: "sendonly" });
        });

        it("reports no constraints for an offer it cannot parse", () => {
            const constraints = parseSdpVideoConstraints("not an sdp");
            expect(constraints.video.state).to.equal("absent");
            expect(receivableCodecs(constraints.video)).to.equal(undefined);
        });

        it("refuses our video for a sendonly section, with no codecs and no limits from it", () => {
            // A nonzero port is not permission to send: the peer will only send on this section.
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
            // RFC 4566 §6: a section with no direction attribute is sendrecv.
            const constraints = parseSdpVideoConstraints(OFFER_VIDEO_NO_DIRECTION);
            expect(constraints.video.state).to.equal("receiving");
            expect(receivableCodecs(constraints.video)).to.deep.equal(["H264"]);
            expect(videoCodecLimits(constraints, H264).maxPixels).to.equal(3600 * 256);
        });

        it("treats a recvonly section as receiving", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).video.state).to.equal("receiving");
        });

        it("refuses our audio for a sendonly section while still reading its talkback request", () => {
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_SENDONLY);
            expect(constraints.audio).to.deep.equal({ state: "notReceiving", direction: "sendonly" });
            expect(receivableCodecs(constraints.audio)).to.equal(undefined);
            expect(constraints.sendingAudioSections).to.not.be.empty;
        });

        it("applies a session-level direction to a section that restates none", () => {
            // RFC 4566 §5: a session-level attribute applies to every section that does not override it.
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
            // Every codec the server can select is dynamically mapped, so this limit belongs to none of them.
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
            // 0xff is not an H.264 Table A-1 level; reading it as "no limit" could exceed the peer's ceiling.
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e0ff"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
            expect(videoCodecLimits(sdp, H264)).to.deep.equal({ codec: H264 });
        });

        it("refuses a profile-level-id that is not three bytes of base16", () => {
            const short = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e0"));
            expect(decodableVideoCodecs(short)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
            // The third byte 0x1f is a valid level (3.1), so only the length check refuses this one.
            const long = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e01f0"));
            expect(decodableVideoCodecs(long)).to.deep.equal({ decodable: [], unreadable: ["H264"] });
        });

        it("refuses an H.265 level-id outside the level tables", () => {
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H265", "level-id=99"));
            expect(decodableVideoCodecs(sdp)).to.deep.equal({ decodable: [], unreadable: ["H265"] });
        });

        it("refuses a level-id that is not decimal digits, where Number would still read a level", () => {
            // Number("93.0") is 93, a Table A.8 row, so only the digit check refuses it.
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H265", "level-id=93.0"));
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
            // Static payload types name no codec; an empty decodable list would read as "decodes nothing".
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

describe("withoutTalkback", () => {
    const SESSION = ["v=0", "o=- 1 1 IN IP4 127.0.0.1", "s=-", "t=0 0"];

    function rewritten(sdp: string): string {
        return withoutTalkback(sdp, parseSdpVideoConstraints(sdp).sendingAudioSections);
    }

    function offer(...lines: string[]): string {
        return [...SESSION, ...lines, ""].join("\r\n");
    }

    it("names each sending audio section by its m-line position and the direction in effect", () => {
        expect(parseSdpVideoConstraints(OFFER_TWO_AUDIO_SECTIONS).sendingAudioSections).to.deep.equal([
            { index: 1, direction: "sendrecv" },
        ]);
        expect(parseSdpVideoConstraints(OFFER_SESSION_SENDRECV).sendingAudioSections).to.deep.equal([
            { index: 1, direction: "sendrecv" },
        ]);
    });

    it("makes a sendrecv audio section recvonly and leaves a sendrecv video section alone", () => {
        const sdp = offer(
            "m=video 9 UDP/TLS/RTP/SAVPF 96",
            "a=sendrecv",
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=sendrecv",
            "a=rtpmap:111 opus/48000/2",
        );
        expect(rewritten(sdp)).to.equal(
            offer(
                "m=video 9 UDP/TLS/RTP/SAVPF 96",
                "a=sendrecv",
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=recvonly",
                "a=rtpmap:111 opus/48000/2",
            ),
        );
    });

    it("leaves an extmap line with a direction suffix alone", () => {
        const sdp = offer(
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=extmap:2/recvonly urn:ietf:params:rtp-hdrext:csrc-audio-level",
            "a=sendrecv",
        );
        expect(rewritten(sdp)).to.equal(
            offer(
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=extmap:2/recvonly urn:ietf:params:rtp-hdrext:csrc-audio-level",
                "a=recvonly",
            ),
        );
    });

    it("makes a sendonly audio section inactive", () => {
        const sdp = offer("m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=sendonly");
        expect(rewritten(sdp)).to.equal(offer("m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=inactive"));
    });

    it("adds recvonly at the end of an audio section that states no direction", () => {
        const sdp = offer(
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=rtpmap:111 opus/48000/2",
            "m=video 9 UDP/TLS/RTP/SAVPF 96",
            "a=recvonly",
        );
        expect(rewritten(sdp)).to.equal(
            offer(
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=rtpmap:111 opus/48000/2",
                "a=recvonly",
                "m=video 9 UDP/TLS/RTP/SAVPF 96",
                "a=recvonly",
            ),
        );
    });

    it("adds the direction to the last section of an offer with no final line break", () => {
        const sdp = [...SESSION, "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=rtpmap:111 opus/48000/2"].join("\r\n");
        expect(rewritten(sdp)).to.equal(`${sdp}\r\na=recvonly`);
    });

    it("keeps the offer's own line breaks", () => {
        const sdp = [...SESSION, "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=sendrecv", ""].join("\n");
        expect(rewritten(sdp)).to.equal(sdp.replace("a=sendrecv", "a=recvonly"));
        expect(rewritten(OFFER_AUDIO_NO_DIRECTION)).to.equal(`${OFFER_AUDIO_NO_DIRECTION}a=recvonly\r\n`);
    });

    it("rewrites every sending audio section and no other", () => {
        const sdp = offer(
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=sendrecv",
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=recvonly",
            "m=audio 0 UDP/TLS/RTP/SAVPF 111",
            "a=sendrecv",
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=sendonly",
        );
        expect(rewritten(sdp)).to.equal(
            offer(
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=recvonly",
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=recvonly",
                "m=audio 0 UDP/TLS/RTP/SAVPF 111",
                "a=sendrecv",
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=inactive",
            ),
        );
    });

    it("adds the direction to each of several audio sections that state none", () => {
        const sdp = offer("m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=mid:0", "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=mid:1");
        expect(rewritten(sdp)).to.equal(
            offer(
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=mid:0",
                "a=recvonly",
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=mid:1",
                "a=recvonly",
            ),
        );
    });

    it("rewrites every direction line of a section that states more than one", () => {
        const sdp = offer("m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=recvonly", "a=sendrecv");
        expect(rewritten(sdp)).to.equal(offer("m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=recvonly", "a=recvonly"));
    });

    it("counts an application section when locating the audio section after it", () => {
        const sdp = offer(
            "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
            "a=sendrecv",
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=sendrecv",
        );
        expect(rewritten(sdp)).to.equal(
            offer(
                "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
                "a=sendrecv",
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=recvonly",
            ),
        );
    });

    it("adds the direction after the section's last line, not after a blank line in it", () => {
        const sdp = [...SESSION, "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=mid:0", "", "a=mid:1", ""].join("\r");
        expect(rewritten(sdp)).to.equal(
            [...SESSION, "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=mid:0", "", "a=mid:1", "a=recvonly", ""].join("\r"),
        );
    });

    it("rewrites a bundle-only audio section, which is live although its port is 0", () => {
        const sdp = offer("m=audio 0 UDP/TLS/RTP/SAVPF 111", "a=bundle-only", "a=sendrecv");
        expect(rewritten(sdp)).to.equal(offer("m=audio 0 UDP/TLS/RTP/SAVPF 111", "a=bundle-only", "a=recvonly"));
    });

    it("overrides a sending session-level direction in the audio section only", () => {
        // The session line still applies to the video section, which states none.
        expect(rewritten(OFFER_SESSION_SENDRECV)).to.equal(`${OFFER_SESSION_SENDRECV}a=recvonly\r\n`);
        const sendonly = [...SESSION, "a=sendonly", "m=audio 9 UDP/TLS/RTP/SAVPF 111", ""].join("\r\n");
        expect(rewritten(sendonly)).to.equal(`${sendonly}a=inactive\r\n`);
    });

    it("leaves an offer that asks for no talkback unchanged", () => {
        const sdp = offer("m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=recvonly");
        expect(rewritten(sdp)).to.equal(sdp);
        expect(rewritten("not an sdp")).to.equal("not an sdp");
    });
});

describe("answerWithinOfferedDirections", () => {
    const VIDEO = "m=video 9 UDP/TLS/RTP/SAVPF 96";
    const AUDIO = "m=audio 9 UDP/TLS/RTP/SAVPF 111";
    const sdp = (...lines: string[]) => ["v=0", "o=- 1 1 IN IP4 127.0.0.1", "s=-", "t=0 0", ...lines, ""].join("\r\n");

    it("narrows sendrecv to sendonly in a section offered recvonly and keeps a sendrecv offer's answer", () => {
        const offer = sdp(VIDEO, "a=recvonly", AUDIO, "a=sendrecv");
        const answer = sdp(VIDEO, "a=sendrecv", AUDIO, "a=sendrecv");

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({
            sdp: sdp(VIDEO, "a=sendonly", AUDIO, "a=sendrecv"),
            corrected: [0],
        });
    });

    it("answers a section offered inactive with inactive and one offered sendonly with recvonly", () => {
        const offer = sdp(VIDEO, "a=inactive", AUDIO, "a=sendonly");
        const answer = sdp(VIDEO, "a=sendrecv", AUDIO, "a=sendrecv");

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({
            sdp: sdp(VIDEO, "a=inactive", AUDIO, "a=recvonly"),
            corrected: [0, 1],
        });
    });

    it("reads the offer's session-level direction for a section that states none", () => {
        const offer = sdp("a=recvonly", VIDEO);
        const answer = sdp(VIDEO, "a=sendrecv");

        expect(answerWithinOfferedDirections(answer, offer).sdp).to.equal(sdp(VIDEO, "a=sendonly"));
    });

    it("keeps the answer's session-level lines and a section with no offered counterpart", () => {
        const offer = sdp(VIDEO, "a=recvonly");
        const answer = sdp("a=sendrecv", VIDEO, "a=sendonly", AUDIO, "a=sendrecv");

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({ sdp: answer, corrected: [] });
    });

    it("keeps a section where neither offer nor answer states a direction: both are sendrecv", () => {
        const offer = sdp(VIDEO);
        const answer = sdp(VIDEO);

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({ sdp: answer, corrected: [] });
    });

    it("reads a section without a direction in the offer as sendrecv", () => {
        const offer = sdp(VIDEO);
        const answer = sdp(VIDEO, "a=sendonly");

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({ sdp: answer, corrected: [] });
    });

    it("gives a section a direction of its own when the answer states none, read as sendrecv", () => {
        const offer = sdp(VIDEO, "a=recvonly");
        const answer = sdp(VIDEO, "a=rtpmap:96 H264/90000");

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({
            sdp: sdp(VIDEO, "a=rtpmap:96 H264/90000", "a=sendonly"),
            corrected: [0],
        });
    });

    it("narrows a section that takes the answer's session-level direction", () => {
        const offer = sdp(VIDEO, "a=recvonly", AUDIO, "a=sendrecv");
        const answer = sdp("a=sendrecv", VIDEO, AUDIO);

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({
            sdp: sdp("a=sendrecv", VIDEO, "a=sendonly", AUDIO),
            corrected: [0],
        });
    });

    it("keeps a section whose answer-level direction the offer allows", () => {
        const offer = sdp(VIDEO, "a=recvonly");
        const answer = sdp("a=sendonly", VIDEO);

        expect(answerWithinOfferedDirections(answer, offer)).to.deep.equal({ sdp: answer, corrected: [] });
    });

    it("keeps the answer's line endings", () => {
        const offer = sdp(VIDEO, "a=recvonly");
        const answer = ["v=0", VIDEO, "a=sendrecv", ""].join("\n");

        expect(answerWithinOfferedDirections(answer, offer).sdp).to.equal(["v=0", VIDEO, "a=sendonly", ""].join("\n"));
    });
});
