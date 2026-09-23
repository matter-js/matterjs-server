/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

describe("camera server errors", () => {
    it("carries the incompatibility detail as JSON in the message", () => {
        const error = ServerError.cameraStreamIncompatible({
            reason: "codec",
            device: ["H265"],
            requested: ["H264"],
        });
        expect(error.code).to.equal(ServerErrorCode.CameraStreamIncompatible);
        expect(JSON.parse(error.message)).to.deep.equal({
            message: "No codec supported by both the camera and the caller",
            reason: "codec",
            device: ["H265"],
            requested: ["H264"],
        });
    });

    it("distinguishes a missing capability from a bound the caller can change", () => {
        const error = ServerError.cameraStreamIncompatible({
            reason: "capability",
            device: [],
            requested: [],
        });
        expect(JSON.parse(error.message)).to.deep.equal({
            message: "No capability for this request on the camera or in the offer",
            reason: "capability",
            device: [],
            requested: [],
        });
    });

    it("reports the device status that produced a bounds failure", () => {
        const error = ServerError.cameraStreamIncompatible({
            reason: "bounds",
            device: [],
            requested: [],
            deviceStatus: 0x87,
        });
        expect(JSON.parse(error.message).device_status).to.equal(0x87);
    });

    it("names the streams in the way when resources are exhausted", () => {
        const error = ServerError.cameraResourceExhausted({
            allocated: [{ kind: "video", streamId: 1, referenceCount: 1 }],
            maxConcurrentEncoders: 1,
            maxEncodedPixelRate: 248832000,
        });
        expect(error.code).to.equal(ServerErrorCode.CameraResourceExhausted);
        expect(JSON.parse(error.message)).to.deep.equal({
            message: "Camera has no capacity for this stream",
            allocated: [{ kind: "video", stream_id: 1, reference_count: 1 }],
            max_concurrent_encoders: 1,
            max_encoded_pixel_rate: 248832000,
        });
    });

    it("names the stream and its reference count when release is refused", () => {
        const error = ServerError.cameraStreamInUse({ streamId: 3, referenceCount: 2 });
        expect(error.code).to.equal(ServerErrorCode.CameraStreamInUse);
        expect(JSON.parse(error.message)).to.deep.equal({
            message: "Stream is in use and cannot be released",
            stream_id: 3,
            reference_count: 2,
        });
    });

    it("names the clusters an endpoint is missing", () => {
        const error = ServerError.cameraNotSupported({ missingClusters: [0x551] });
        expect(error.code).to.equal(ServerErrorCode.CameraNotSupported);
        expect(JSON.parse(error.message).missing_clusters).to.deep.equal([0x551]);
    });
});
