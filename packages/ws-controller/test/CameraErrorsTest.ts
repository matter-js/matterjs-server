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
    ServerCommandError,
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
        // Only this test keeps the emitter in sync with CAMERA_INCOMPATIBLE_REASONS.
        const messages = CAMERA_INCOMPATIBLE_REASONS.map(
            reason => JSON.parse(ServerError.cameraStreamIncompatible(detailFor(reason)).message).message,
        );
        expect(messages.filter(message => typeof message === "string" && message.length > 0)).to.have.length(
            CAMERA_INCOMPATIBLE_REASONS.length,
        );
        expect(new Set(messages).size).to.equal(CAMERA_INCOMPATIBLE_REASONS.length);
    });

    it("carries `feature` for the feature reason and for no other", () => {
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
        // Only this test keeps the enum in sync with the client constants, which key exception classes.
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

    it("carries the track and the device status for every reason that has them", () => {
        for (const reason of CAMERA_INCOMPATIBLE_REASONS) {
            const base = detailFor(reason);
            const payload = JSON.parse(
                ServerError.cameraStreamIncompatible(
                    base.reason === "no_media"
                        ? { ...base, deviceStatus: 1 }
                        : { ...base, track: "audio", deviceStatus: 1 },
                ).message,
            );
            expect(payload.device_status, reason).to.equal(1);
            expect(payload.track, reason).to.equal(reason === "no_media" ? undefined : "audio");
        }
    });

    it("keeps the key order of the details", () => {
        const feature = ServerError.cameraStreamIncompatible({
            reason: "feature",
            track: "video",
            feature: "Watermark",
            device: ["H264"],
            requested: ["H265"],
            deviceStatus: 0x87,
        });
        expect(feature.message).to.equal(
            '{"message":"Camera does not advertise the feature this request needs","reason":"feature","track":"video","feature":"Watermark","device":["H264"],"requested":["H265"],"device_status":135}',
        );
        const bounds = ServerError.cameraStreamIncompatible({
            reason: "bounds",
            track: "audio",
            device: [],
            requested: [],
            bound: { field: "sample_rate", requested: "1", limit: "2" },
            deviceStatus: 1,
        });
        expect(bounds.message).to.equal(
            '{"message":"Camera cannot serve the requested stream parameters","reason":"bounds","track":"audio","device":[],"requested":[],"bound":{"field":"sample_rate","requested":"1","limit":"2"},"device_status":1}',
        );
    });

    it("produces details the client parses under the same code", () => {
        const errors = [
            ServerError.icdMultiAdmin([4631]),
            ServerError.cameraStreamIncompatible(detailFor("feature")),
            ServerError.cameraResourceExhausted({ allocated: [] }),
            ServerError.cameraStreamInUse({ streamId: 1 }),
            ServerError.cameraNotSupported({ missingClusters: [0x551] }),
            ServerError.cameraPrivacyMode({ modes: ["hard_mode_on"], deviceStatus: 0xcb }),
        ];
        for (const error of errors) {
            const clientError = new ServerCommandError(error.message, error.code);
            expect(clientError.details, String(error.code)).to.deep.equal(JSON.parse(error.message));
        }
    });

    it("names the clusters an endpoint is missing", () => {
        const error = ServerError.cameraNotSupported({ missingClusters: [0x551] });
        expect(error.code).to.equal(ServerErrorCode.CameraNotSupported);
        expect(JSON.parse(error.message).missing_clusters).to.deep.equal([0x551]);
    });
});
