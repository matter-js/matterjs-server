/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    isTrackableWebRtcSession,
    resolveWebRtcSessionStreams,
    selectWebRtcStreamFields,
} from "../src/controller/webRtcSessionStreams.js";

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

describe("selectWebRtcStreamFields", () => {
    it("sends the lists verbatim for a rev-2 provider", () => {
        const fields: Record<string, unknown> = { sdp: "v=0", videoStreams: [7], audioStreams: [9] };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ sdp: "v=0", videoStreams: [7], audioStreams: [9] });
    });

    it("keeps multiple streams for a rev-2 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [3, 5] };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ videoStreams: [3, 5] });
    });

    it("synthesises the lists from a legacy caller's singular ids for a rev-2 provider", () => {
        const fields: Record<string, unknown> = { videoStreamId: 5, audioStreamId: null };
        selectWebRtcStreamFields(fields, 3);
        expect(fields).to.deep.equal({ videoStreams: [5] });
    });

    it("down-converts the lists to singular ids for a rev-1 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [7], audioStreams: [9] };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: 7, audioStreamId: 9 });
    });

    it("truncates a multi-stream list to its first entry for a rev-1 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [3, 5] };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: 3 });
    });

    it("down-converts the lists when the provider revision is unknown", () => {
        const fields: Record<string, unknown> = { videoStreams: [7] };
        selectWebRtcStreamFields(fields, undefined);
        expect(fields).to.deep.equal({ videoStreamId: 7 });
    });

    it("leaves a rev-1 auto-select request untouched", () => {
        const fields: Record<string, unknown> = { videoStreamId: null };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: null });
    });

    it("preserves a legacy null auto-select request on a rev-2 provider when no list is sent", () => {
        const fields: Record<string, unknown> = { videoStreamId: null, audioStreamId: null };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ videoStreamId: null, audioStreamId: null });
    });

    it("drops a null auto-select on the other media kind once any list is sent to a rev-2 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [5], audioStreamId: null };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ videoStreams: [5] });
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
