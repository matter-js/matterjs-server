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
    type ServerErrorCodeWithDetails,
    type ServerErrorDetailsByCode,
} from "../src/index.js";

const FEATURE_DETAILS =
    '{"message":"Camera does not advertise the feature this request needs","reason":"feature","track":"video","feature":"Watermark","device":["H264"],"requested":["H265"],"device_status":135}';
const BOUNDS_DETAILS =
    '{"message":"Camera cannot serve the requested stream parameters","reason":"bounds","track":"audio","device":[],"requested":[],"bound":{"field":"sample_rate","requested":"44100","limit":"48000"}}';
const CODEC_DETAILS =
    '{"message":"No codec supported by both the camera and the caller","reason":"codec","track":"video","device":["H264"],"requested":["H265"]}';

function detailsOf<C extends ServerErrorCodeWithDetails>(
    error: ServerCommandError,
    code: C,
): ServerErrorDetailsByCode[C] {
    if (error.hasDetails(code)) return error.details;
    return expect.fail(`error ${code} details not parsed`);
}

describe("ServerCommandError details", () => {
    it("keeps the wire details string as the message", () => {
        const error = new ServerCommandError(CODEC_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        expect(error.message).to.equal(CODEC_DETAILS);
        expect(error.errorCode).to.equal(102);
    });

    it("parses error 102 into its reason's shape", () => {
        const error = new ServerCommandError(FEATURE_DETAILS, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        const details = detailsOf(error, CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE);
        expect(details.device_status).to.equal(135);
        if (details.reason !== "feature") return expect.fail(`reason ${details.reason}`);
        expect(details.track).to.equal("video");
        expect(details.feature).to.equal("Watermark");
    });

    it("parses error 103", () => {
        const error = new ServerCommandError(
            '{"message":"Camera has no capacity for this stream","allocated":[{"kind":"video","stream_id":1,"reference_count":2}],"max_concurrent_encoders":1,"max_encoded_pixel_rate":248832000}',
            CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
        );
        const details = detailsOf(error, CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE);
        expect(details.allocated).to.deep.equal([{ kind: "video", stream_id: 1, reference_count: 2 }]);
        expect(details.max_concurrent_encoders).to.equal(1);
        expect(details.max_encoded_pixel_rate).to.equal(248832000);
    });

    it("parses error 104", () => {
        const error = new ServerCommandError(
            '{"message":"Stream is in use and cannot be released","stream_id":3,"reference_count":2}',
            CAMERA_STREAM_IN_USE_ERROR_CODE,
        );
        const details = detailsOf(error, CAMERA_STREAM_IN_USE_ERROR_CODE);
        expect(details.stream_id).to.equal(3);
        expect(details.reference_count).to.equal(2);
    });

    it("parses error 105", () => {
        const error = new ServerCommandError(
            '{"message":"Endpoint does not support camera streaming","missing_clusters":[1362]}',
            CAMERA_NOT_SUPPORTED_ERROR_CODE,
        );
        const details = detailsOf(error, CAMERA_NOT_SUPPORTED_ERROR_CODE);
        expect(details.missing_clusters).to.deep.equal([1362]);
    });

    it("parses error 106", () => {
        const error = new ServerCommandError(
            '{"message":"Camera privacy mode is enabled","modes":["hard_mode_on"],"device_status":203}',
            CAMERA_PRIVACY_MODE_ERROR_CODE,
        );
        const details = detailsOf(error, CAMERA_PRIVACY_MODE_ERROR_CODE);
        expect(details.modes).to.deep.equal(["hard_mode_on"]);
        expect(details.device_status).to.equal(203);
    });

    it("parses error 100", () => {
        const error = new ServerCommandError(
            '{"message":"Peer has administrators from other vendors that may not support LIT","admin_vendor_ids":[4631]}',
            ICD_MULTI_ADMIN_ERROR_CODE,
        );
        const details = detailsOf(error, ICD_MULTI_ADMIN_ERROR_CODE);
        expect(details.admin_vendor_ids).to.deep.equal([4631]);
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

    describe("leaves details undefined when they do not satisfy the code's type", () => {
        const cases: Array<{ code: number; valid: Record<string, unknown>; invalid: Record<string, unknown>[] }> = [
            {
                code: ICD_MULTI_ADMIN_ERROR_CODE,
                valid: { message: "m", admin_vendor_ids: [4631] },
                invalid: [
                    { message: "m" },
                    { message: "m", admin_vendor_ids: null },
                    { admin_vendor_ids: [1] },
                    { message: "m", admin_vendor_ids: ["1"] },
                ],
            },
            {
                code: CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
                valid: { message: "m", reason: "codec", device: [], requested: [] },
                invalid: [
                    { message: "m", reason: "codec", requested: [] },
                    { message: "m", reason: "codec", device: [1], requested: [] },
                    { message: "m", reason: "unknown", device: [], requested: [] },
                    { message: "m", device: [], requested: [] },
                    { message: "m", reason: "codec", device: [], requested: [], track: "data" },
                    { message: "m", reason: "codec", device: [], requested: [], device_status: "135" },
                    { message: "m", reason: "feature", device: [], requested: [] },
                    { message: "m", reason: "bounds", device: [], requested: [], bound: { field: "min_resolution" } },
                    {
                        message: "m",
                        reason: "bounds",
                        device: [],
                        requested: [],
                        bound: { field: "max_resolution", requested: "1", limit: "2" },
                    },
                    { reason: "codec", device: [], requested: [] },
                ],
            },
            {
                code: CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
                valid: { message: "m", allocated: [] },
                invalid: [
                    { message: "m" },
                    { message: "m", allocated: [{ kind: "video", stream_id: 1 }] },
                    { message: "m", allocated: [{ kind: "data", stream_id: 1, reference_count: 0 }] },
                    { message: "m", allocated: [], max_concurrent_encoders: "1" },
                    { message: "m", allocated: [], max_encoded_pixel_rate: null },
                ],
            },
            {
                code: CAMERA_STREAM_IN_USE_ERROR_CODE,
                valid: { message: "m", stream_id: 3 },
                invalid: [{ message: "m" }, { message: "m", stream_id: 3, reference_count: "2" }],
            },
            {
                code: CAMERA_NOT_SUPPORTED_ERROR_CODE,
                valid: { message: "m", missing_clusters: [] },
                invalid: [{ message: "m" }, { message: "m", missing_clusters: [null] }],
            },
            {
                code: CAMERA_PRIVACY_MODE_ERROR_CODE,
                valid: { message: "m", modes: ["hard_mode_on"], device_status: 203 },
                invalid: [
                    { message: "m", device_status: 203 },
                    { message: "m", modes: ["lens_cap"], device_status: 203 },
                    { message: "m", modes: ["toString"], device_status: 203 },
                    { message: "m", modes: [] },
                ],
            },
        ];
        for (const { code, valid, invalid } of cases) {
            it(`error ${code}`, () => {
                expect(new ServerCommandError(JSON.stringify(valid), code).details).to.deep.equal(valid);
                for (const details of invalid) {
                    const message = JSON.stringify(details);
                    expect(new ServerCommandError(message, code).details, message).to.equal(undefined);
                }
            });
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
