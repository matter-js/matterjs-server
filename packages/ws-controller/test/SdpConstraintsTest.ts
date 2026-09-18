/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseSdpVideoConstraints } from "../src/camera/sdpConstraints.js";

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

describe("sdpConstraints", () => {
    describe("parseSdpVideoConstraints", () => {
        it("lists video codecs in m-line preference order", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).codecs).to.deep.equal(["H265", "H264"]);
        });

        it("reports a video m-line and no audio m-line", () => {
            const constraints = parseSdpVideoConstraints(OFFER_H265_THEN_H264);
            expect(constraints.hasVideo).to.equal(true);
            expect(constraints.hasAudio).to.equal(false);
        });

        it("converts max-fs macroblocks to a pixel ceiling", () => {
            // max-fs counts 16x16 macroblocks: 8160 * 256 = 2088960 pixels (1920x1088).
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).maxPixels).to.equal(2088960);
        });

        it("converts max-mbps macroblocks per second to a pixel rate ceiling", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).maxPixelsPerSecond).to.equal(245760 * 256);
        });

        it("reads max-br as kilobits per second and reports bits per second", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).maxBitRate).to.equal(5000 * 1000);
        });

        it("takes the tighter of two per-codec level caps in the same m-line", () => {
            expect(parseSdpVideoConstraints(OFFER_TWO_VIDEO_LEVEL_CAPS).maxPixels).to.equal(3600 * 256);
        });

        it("reports audio codecs and talkback intent from a sendrecv audio m-line", () => {
            const constraints = parseSdpVideoConstraints(OFFER_AUDIO_SENDRECV);
            expect(constraints.hasAudio).to.equal(true);
            expect(constraints.audioCodecs).to.deep.equal(["OPUS"]);
            expect(constraints.wantsTalkback).to.equal(true);
        });

        it("reports talkback intent from a sendonly audio m-line", () => {
            expect(parseSdpVideoConstraints(OFFER_AUDIO_SENDONLY).wantsTalkback).to.equal(true);
        });

        it("reports no talkback for a recvonly offer", () => {
            expect(parseSdpVideoConstraints(OFFER_H265_THEN_H264).wantsTalkback).to.equal(false);
        });

        it("reports no constraints for an offer it cannot parse", () => {
            const constraints = parseSdpVideoConstraints("not an sdp");
            expect(constraints.hasVideo).to.equal(false);
            expect(constraints.codecs).to.deep.equal([]);
        });
    });
});
