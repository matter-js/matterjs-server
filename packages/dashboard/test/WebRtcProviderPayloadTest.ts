/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildProvideOfferRequest } from "../src/util/webrtc-provider-payload.js";

describe("buildProvideOfferRequest", () => {
    it("sends the stream lists when both ids are present", () => {
        expect(buildProvideOfferRequest("v=0", 3, 7, 9)).to.deep.equal({
            webRtcSessionId: null,
            sdp: "v=0",
            streamUsage: 3,
            videoStreams: [7],
            audioStreams: [9],
        });
    });

    it("omits the lists when ids are null", () => {
        expect(buildProvideOfferRequest("v=0", 3, null, null)).to.deep.equal({
            webRtcSessionId: null,
            sdp: "v=0",
            streamUsage: 3,
        });
    });

    it("sends only videoStreams when only video is allocated", () => {
        expect(buildProvideOfferRequest("v=0", 3, 5, null)).to.deep.equal({
            webRtcSessionId: null,
            sdp: "v=0",
            streamUsage: 3,
            videoStreams: [5],
        });
    });

    it("never emits the deprecated singular ids", () => {
        const request = buildProvideOfferRequest("v=0", 3, 5, 6);
        expect(request).to.not.have.property("videoStreamId");
        expect(request).to.not.have.property("audioStreamId");
    });
});
