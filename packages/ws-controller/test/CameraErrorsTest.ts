/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_INCOMPATIBLE_REASONS,
    CAMERA_NOT_SUPPORTED_ERROR_CODE,
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    CAMERA_STREAM_IN_USE_ERROR_CODE,
} from "@matter-server/ws-client";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import type {
    CameraStreamIncompatibleDetail,
    CameraStreamIncompatibleReason,
} from "../src/types/WebSocketMessageTypes.js";

/** An error-102 detail for one reason, with the `feature` the `feature` reason has to carry. */
function detailFor(reason: CameraStreamIncompatibleReason): CameraStreamIncompatibleDetail {
    const facts = { device: new Array<string>(), requested: new Array<string>() };
    return reason === "feature" ? { reason, feature: "Video", ...facts } : { reason, ...facts };
}

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
            message: "Camera states no capability this request can use",
            reason: "capability",
            device: [],
            requested: [],
        });
    });

    it("states one message per reason, over the vocabulary the client package publishes", () => {
        // The emitter and CAMERA_INCOMPATIBLE_REASONS are two statements of one wire vocabulary, and a
        // reason with no message of its own reaches a client as `undefined`.
        const messages = CAMERA_INCOMPATIBLE_REASONS.map(
            reason => JSON.parse(ServerError.cameraStreamIncompatible(detailFor(reason)).message).message,
        );
        expect(messages.filter(message => typeof message === "string" && message.length > 0)).to.have.length(
            CAMERA_INCOMPATIBLE_REASONS.length,
        );
        expect(new Set(messages).size).to.equal(CAMERA_INCOMPATIBLE_REASONS.length);
    });

    it("carries `feature` for the feature reason and for no other", () => {
        // The field was the thing telling four meanings of one reason apart, so a client branched
        // twice. It is a detail of `feature` now, and nothing else may carry it.
        expect(
            JSON.parse(
                ServerError.cameraStreamIncompatible({
                    reason: "feature",
                    track: "video",
                    feature: "Watermark",
                    device: [],
                    requested: [],
                }).message,
            ).feature,
        ).to.equal("Watermark");
        for (const reason of CAMERA_INCOMPATIBLE_REASONS.filter(name => name !== "feature")) {
            expect(JSON.parse(ServerError.cameraStreamIncompatible(detailFor(reason)).message)).to.not.have.property(
                "feature",
            );
        }
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

    it("numbers the camera codes 102 to 106 with no gap, as the ws-client constants spell them", () => {
        // The enum and the client constants are two statements of one wire contract with nothing but
        // this test between them, and a client keys its exception classes on the number.
        expect([
            ServerErrorCode.CameraStreamIncompatible,
            ServerErrorCode.CameraResourceExhausted,
            ServerErrorCode.CameraStreamInUse,
            ServerErrorCode.CameraNotSupported,
            ServerErrorCode.CameraPrivacyMode,
        ]).to.deep.equal([102, 103, 104, 105, 106]);
        expect([
            CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
            CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
            CAMERA_STREAM_IN_USE_ERROR_CODE,
            CAMERA_NOT_SUPPORTED_ERROR_CODE,
            CAMERA_PRIVACY_MODE_ERROR_CODE,
        ]).to.deep.equal([102, 103, 104, 105, 106]);
    });

    it("names the clusters an endpoint is missing", () => {
        const error = ServerError.cameraNotSupported({ missingClusters: [0x551] });
        expect(error.code).to.equal(ServerErrorCode.CameraNotSupported);
        expect(JSON.parse(error.message).missing_clusters).to.deep.equal([0x551]);
    });
});
