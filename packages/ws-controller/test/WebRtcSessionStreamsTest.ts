/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { isTrackableWebRtcSession, resolveWebRtcSessionStreams } from "../src/controller/webRtcSessionStreams.js";

describe("resolveWebRtcSessionStreams", () => {
    it("uses the requested rev-2 list verbatim", () => {
        expect(resolveWebRtcSessionStreams([3, 5], undefined, undefined)).to.deep.equal([3, 5]);
    });

    it("prefers the requested list over the deprecated scalar echoes", () => {
        expect(resolveWebRtcSessionStreams([3], 9, 9)).to.deep.equal([3]);
    });

    it("wraps an explicit rev-1 request id even when the response omits its echo", () => {
        expect(resolveWebRtcSessionStreams(undefined, 3, undefined)).to.deep.equal([3]);
    });

    it("keeps the explicit request id when the response echoes a different value", () => {
        expect(resolveWebRtcSessionStreams(undefined, 3, 7)).to.deep.equal([3]);
    });

    it("falls back to the response echo when the request asked for auto-selection", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, 7)).to.deep.equal([7]);
    });

    it("yields no stream when auto-selection is requested but the provider reports none", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, null)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, null, undefined)).to.equal(undefined);
    });

    it("yields no stream when the media kind is absent from the request", () => {
        expect(resolveWebRtcSessionStreams(undefined, undefined, undefined)).to.equal(undefined);
    });

    it("ignores an empty requested list and falls through to the scalar path", () => {
        expect(resolveWebRtcSessionStreams([], 3, undefined)).to.deep.equal([3]);
        expect(resolveWebRtcSessionStreams([], undefined, undefined)).to.equal(undefined);
    });

    it("keeps only numeric entries from a mixed request list", () => {
        expect(resolveWebRtcSessionStreams([3, "x", null, 5], undefined, undefined)).to.deep.equal([3, 5]);
    });

    it("falls through when a request list contains no numeric entries", () => {
        expect(resolveWebRtcSessionStreams(["x", null], 3, undefined)).to.deep.equal([3]);
        expect(resolveWebRtcSessionStreams(["x"], undefined, undefined)).to.equal(undefined);
    });

    it("treats a non-numeric, non-null request id as an omitted media kind", () => {
        expect(resolveWebRtcSessionStreams(undefined, "3", 7)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, undefined, 7)).to.equal(undefined);
    });

    it("yields no stream when auto-selection is requested but the echo is non-numeric", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, "7")).to.equal(undefined);
    });

    it("rejects non-integer, negative, and NaN ids from a list", () => {
        expect(resolveWebRtcSessionStreams([3, -1, 2.5, NaN, 5], undefined, undefined)).to.deep.equal([3, 5]);
        expect(resolveWebRtcSessionStreams([-1, 2.5, NaN], 4, undefined)).to.deep.equal([4]);
    });

    it("treats a non-integer/negative scalar request id as an omitted media kind", () => {
        expect(resolveWebRtcSessionStreams(undefined, 2.5, undefined)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, -1, undefined)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, NaN, undefined)).to.equal(undefined);
    });

    it("ignores a non-integer auto-select echo", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, 2.5)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, null, -1)).to.equal(undefined);
    });

    it("accepts stream id 0", () => {
        expect(resolveWebRtcSessionStreams(undefined, 0, undefined)).to.deep.equal([0]);
    });
});

describe("isTrackableWebRtcSession", () => {
    it("accepts a session with a numeric usage and a video stream", () => {
        expect(isTrackableWebRtcSession(3, [3], undefined)).to.equal(true);
    });

    it("accepts a session with a numeric usage and an audio stream", () => {
        expect(isTrackableWebRtcSession(3, undefined, [1])).to.equal(true);
    });

    it("rejects a session with no video and no audio stream", () => {
        expect(isTrackableWebRtcSession(3, undefined, undefined)).to.equal(false);
    });

    it("rejects a session whose stream usage is missing or non-numeric", () => {
        expect(isTrackableWebRtcSession(undefined, [3], [1])).to.equal(false);
        expect(isTrackableWebRtcSession("3", [3], undefined)).to.equal(false);
        expect(isTrackableWebRtcSession(null, undefined, [1])).to.equal(false);
    });

    it("rejects a session whose stream usage is non-integer or negative", () => {
        expect(isTrackableWebRtcSession(2.5, [3], undefined)).to.equal(false);
        expect(isTrackableWebRtcSession(-1, [3], undefined)).to.equal(false);
        expect(isTrackableWebRtcSession(NaN, [3], undefined)).to.equal(false);
    });

    it("accepts stream usage 0", () => {
        expect(isTrackableWebRtcSession(0, [3], undefined)).to.equal(true);
    });
});
