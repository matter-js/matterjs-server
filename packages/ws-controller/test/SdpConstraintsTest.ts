/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import {
    mediaRefusal,
    parseSdpVideoConstraints,
    receivableCodecs,
    videoCodecLimits,
} from "../src/camera/sdpConstraints.js";

const H264 = CameraAvStreamManagement.VideoCodec.H264;
const H265 = CameraAvStreamManagement.VideoCodec.Hevc;

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
    "a=fmtp:100 max-fs=8160",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 max-fs=3600",
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

        it("states no limit for a codec whose payload type carries no fmtp limit", () => {
            // H265 is offered at level-id=93 alone. Folding the H264 line's max-fs in here would clamp
            // an H265 stream to a bound H265 never stated.
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H265)).to.deep.equal({
                codec: H265,
            });
        });

        it("keeps each codec's level cap apart instead of folding them into one", () => {
            const constraints = parseSdpVideoConstraints(OFFER_TWO_VIDEO_LEVEL_CAPS);
            expect(videoCodecLimits(constraints, H265).maxPixels).to.equal(8160 * 256);
            expect(videoCodecLimits(constraints, H264).maxPixels).to.equal(3600 * 256);
        });

        it("takes the tighter of two payload types of the same codec", () => {
            // Which profile the camera encodes in is not this server's to pick, so only the value both
            // payload types can decode is a bound it may rely on.
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_SAME_CODEC_TWO_PAYLOADS), H264).maxPixels).to.equal(
                3600 * 256,
            );
        });

        it("states no limits for a codec the offer never mentioned", () => {
            expect(videoCodecLimits(parseSdpVideoConstraints(OFFER_H265_THEN_H264), H264 + 99)).to.deep.equal({
                codec: H264 + 99,
            });
        });

        it("reads max-fr as a frame rate ceiling for the codec that stated it", () => {
            const offer = [
                "v=0",
                "o=- 0 0 IN IP4 127.0.0.1",
                "s=-",
                "t=0 0",
                "m=video 9 UDP/TLS/RTP/SAVPF 96",
                "a=rtpmap:96 H265/90000",
                "a=fmtp:96 max-fs=8160;max-fr=10",
                "",
            ].join("\r\n");
            expect(videoCodecLimits(parseSdpVideoConstraints(offer), H265)).to.deep.equal({
                codec: H265,
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
