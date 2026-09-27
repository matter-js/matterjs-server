/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_NOT_SUPPORTED_ERROR_CODE,
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    cameraStreamIncompatibleDetails,
    ICD_MULTI_ADMIN_ERROR_CODE,
    ServerCommandError,
} from "../src/index.js";

const FEATURE_DETAILS =
    '{"message":"Camera does not advertise the feature this request needs","reason":"feature","track":"video","feature":"Watermark","device":["H264"],"requested":["H265"],"device_status":135}';
const BOUNDS_DETAILS =
    '{"message":"Camera cannot serve the requested stream parameters","reason":"bounds","track":"audio","device":[],"requested":[],"bound":{"field":"sample_rate","requested":"44100","limit":"48000"}}';
const CODEC_DETAILS =
    '{"message":"No codec supported by both the camera and the caller","reason":"codec","track":"video","device":["H264"],"requested":["H265"]}';

describe("ServerCommandError details", () => {
    it("keeps the wire details string as the message", () => {
        const error = new ServerCommandError(CODEC_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        expect(error.message).to.equal(CODEC_DETAILS);
        expect(error.errorCode).to.equal(102);
    });

    it("parses error 102 into its reason's shape", () => {
        const error = new ServerCommandError(FEATURE_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        if (!error.hasDetails(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE)) throw new Error("no details");
        expect(error.details.device_status).to.equal(135);
        if (error.details.reason !== "feature") throw new Error("wrong reason");
        expect(error.details.track).to.equal("video");
        expect(error.details.feature).to.equal("Watermark");
    });

    it("parses error 103", () => {
        const error = new ServerCommandError(
            '{"message":"Camera has no capacity for this stream","allocated":[{"kind":"video","stream_id":1,"reference_count":2}],"max_concurrent_encoders":1,"max_encoded_pixel_rate":248832000}',
            CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
        );
        if (!error.hasDetails(CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE)) throw new Error("no details");
        expect(error.details.allocated).to.deep.equal([{ kind: "video", stream_id: 1, reference_count: 2 }]);
        expect(error.details.max_concurrent_encoders).to.equal(1);
        expect(error.details.max_encoded_pixel_rate).to.equal(248832000);
    });

    it("parses error 104", () => {
        const error = new ServerCommandError(
            '{"message":"Stream is in use and cannot be released","stream_id":3,"reference_count":2}',
            CAMERA_STREAM_IN_USE_ERROR_CODE,
        );
        if (!error.hasDetails(CAMERA_STREAM_IN_USE_ERROR_CODE)) throw new Error("no details");
        expect(error.details.stream_id).to.equal(3);
        expect(error.details.reference_count).to.equal(2);
    });

    it("parses error 105", () => {
        const error = new ServerCommandError(
            '{"message":"Endpoint does not support camera streaming","missing_clusters":[1362]}',
            CAMERA_NOT_SUPPORTED_ERROR_CODE,
        );
        if (!error.hasDetails(CAMERA_NOT_SUPPORTED_ERROR_CODE)) throw new Error("no details");
        expect(error.details.missing_clusters).to.deep.equal([1362]);
    });

    it("parses error 106", () => {
        const error = new ServerCommandError(
            '{"message":"Camera privacy mode is enabled","modes":["hard_mode_on"],"device_status":203}',
            CAMERA_PRIVACY_MODE_ERROR_CODE,
        );
        if (!error.hasDetails(CAMERA_PRIVACY_MODE_ERROR_CODE)) throw new Error("no details");
        expect(error.details.modes).to.deep.equal(["hard_mode_on"]);
        expect(error.details.device_status).to.equal(203);
    });

    it("parses error 100", () => {
        const error = new ServerCommandError(
            '{"message":"Peer has administrators from other vendors that may not support LIT","admin_vendor_ids":[4631]}',
            ICD_MULTI_ADMIN_ERROR_CODE,
        );
        if (!error.hasDetails(ICD_MULTI_ADMIN_ERROR_CODE)) throw new Error("no details");
        expect(error.details.admin_vendor_ids).to.deep.equal([4631]);
    });

    it("leaves details undefined for a code without a known shape, even when the message is JSON", () => {
        const error = new ServerCommandError('{"message":"x"}', 8);
        expect(error.details).to.equal(undefined);
    });

    it("leaves details undefined when the message is not JSON", () => {
        const error = new ServerCommandError("Server error 102", CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        expect(error.details).to.equal(undefined);
        expect(error.hasDetails(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE)).to.equal(false);
    });

    it("leaves details undefined when the message is JSON but not an object", () => {
        for (const message of ["42", '"text"', "null", "[1]"]) {
            expect(new ServerCommandError(message, CAMERA_STREAM_IN_USE_ERROR_CODE).details, message).to.equal(
                undefined,
            );
        }
    });

    it("does not narrow to another code's details", () => {
        const error = new ServerCommandError(CODEC_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        expect(error.hasDetails(CAMERA_PRIVACY_MODE_ERROR_CODE)).to.equal(false);
    });

    describe("cameraStreamIncompatibleDetails", () => {
        it("returns the details typed to the asked reason", () => {
            const error = new ServerCommandError(BOUNDS_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
            expect(cameraStreamIncompatibleDetails(error, "bounds")?.bound).to.deep.equal({
                field: "sample_rate",
                requested: "44100",
                limit: "48000",
            });
            const feature = cameraStreamIncompatibleDetails(
                new ServerCommandError(FEATURE_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE),
                "feature",
            );
            expect(feature?.feature).to.equal("Watermark");
        });

        it("narrows a reason that shares its arm with other reasons", () => {
            const error = new ServerCommandError(CODEC_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
            expect(cameraStreamIncompatibleDetails(error, "codec")?.track).to.equal("video");
            expect(cameraStreamIncompatibleDetails(error, "offer")).to.equal(undefined);
        });

        it("returns undefined for another reason", () => {
            const error = new ServerCommandError(BOUNDS_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
            expect(cameraStreamIncompatibleDetails(error, "feature")).to.equal(undefined);
        });

        it("returns undefined for another error code or a value that is no ServerCommandError", () => {
            expect(cameraStreamIncompatibleDetails(new ServerCommandError(BOUNDS_DETAILS, 103), "bounds")).to.equal(
                undefined,
            );
            expect(cameraStreamIncompatibleDetails(new Error(BOUNDS_DETAILS), "bounds")).to.equal(undefined);
        });
    });
});
