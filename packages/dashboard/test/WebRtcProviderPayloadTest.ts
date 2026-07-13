/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildProvideOfferRequest } from "../src/util/webrtc-provider-payload.js";

describe("buildProvideOfferRequest", () => {
    it("includes list fields when stream IDs are present", () => {
        expect(buildProvideOfferRequest("v=0", 3, 7, 9)).to.deep.equal({
            webRtcSessionId: null,
            sdp: "v=0",
            streamUsage: 3,
            videoStreamId: 7,
            audioStreamId: 9,
            videoStreams: [7],
            audioStreams: [9],
        });
    });

    it("omits list fields when stream IDs are null", () => {
        expect(buildProvideOfferRequest("v=0", 3, null, null)).to.deep.equal({
            webRtcSessionId: null,
            sdp: "v=0",
            streamUsage: 3,
            videoStreamId: null,
            audioStreamId: null,
        });
    });

    it("keeps only videoStreams when only video is allocated", () => {
        expect(buildProvideOfferRequest("v=0", 3, 5, null)).to.deep.equal({
            webRtcSessionId: null,
            sdp: "v=0",
            streamUsage: 3,
            videoStreamId: 5,
            audioStreamId: null,
            videoStreams: [5],
        });
    });
});
