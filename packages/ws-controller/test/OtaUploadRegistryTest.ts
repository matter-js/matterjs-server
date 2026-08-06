/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    OtaImageInfo,
    OtaUploadController,
    OtaUploadOptions,
    OtaUploadRegistry,
} from "../src/controller/OtaUploadRegistry.js";
import { ServerError, ServerErrorCode, UpdateSource } from "../src/types/WebSocketMessageTypes.js";

const PAST_RESERVATION_TTL_MS = 61_000;

const IMAGE_INFO: OtaImageInfo = {
    vid: 0xfff1,
    pid: 0x8000,
    softwareVersion: 3,
    softwareVersionString: "3.0",
    minApplicableSoftwareVersion: 1,
    maxApplicableSoftwareVersion: 2,
    releaseNotesUrl: "https://example.org/notes",
};

class TestController implements OtaUploadController {
    otaEnabled = true;
    storeError?: Error;
    readonly storedPaths = new Array<string>();
    readonly invalidated = new Array<[number, number]>();
    readonly commandHandler = {
        invalidateAvailableUpdates: (vendorId: number, productId: number) => {
            this.invalidated.push([vendorId, productId]);
        },
    };

    async storeOtaImage(filePath: string): Promise<OtaImageInfo> {
        this.storedPaths.push(filePath);
        if (this.storeError !== undefined) {
            throw this.storeError;
        }
        return IMAGE_INFO;
    }
}

async function expectOtaUploadError(fn: () => unknown): Promise<ServerError> {
    try {
        await fn();
    } catch (error) {
        expect(error).to.be.instanceOf(ServerError);
        expect((error as ServerError).code).to.equal(ServerErrorCode.OtaUploadError);
        return error as ServerError;
    }
    throw new Error("Expected an OtaUploadError but the call succeeded");
}

describe("OtaUploadRegistry", () => {
    let tempDir: string;
    let controller: TestController;

    function registry(options: Omit<OtaUploadOptions, "tempDir"> = {}) {
        return new OtaUploadRegistry(controller, { ...options, tempDir });
    }

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "ota-upload-registry-test-"));
        controller = new TestController();
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe("initiateOtaUpload", () => {
        it("issues distinct ids and reports the configured limit", async () => {
            const uploads = registry({ maxSizeBytes: 1234 });

            const first = await uploads.initiateOtaUpload();
            const second = await uploads.initiateOtaUpload();

            expect(first.upload_id).to.not.equal(second.upload_id);
            expect(first.max_size).to.equal(1234);
            expect(first.expires_in).to.be.greaterThan(0);
        });

        it("refuses to issue an id while OTA is disabled", async () => {
            controller.otaEnabled = false;
            const uploads = registry();

            const error = await expectOtaUploadError(() => uploads.initiateOtaUpload());
            expect(error.message).to.include("OTA is disabled");
        });

        it("holds a slot from issue time, before any upload arrives", async () => {
            const uploads = registry({ maxInFlight: 2 });

            await uploads.initiateOtaUpload();
            await uploads.initiateOtaUpload();

            const error = await expectOtaUploadError(() => uploads.initiateOtaUpload());
            expect(error.message).to.include("Too many OTA uploads in flight");
        });

        it("enforces the limit against concurrent calls, not just sequential ones", async () => {
            const uploads = registry({ maxInFlight: 2 });

            const results = await Promise.allSettled([
                uploads.initiateOtaUpload(),
                uploads.initiateOtaUpload(),
                uploads.initiateOtaUpload(),
            ]);

            expect(results.filter(result => result.status === "fulfilled")).to.have.lengthOf(2);
            expect(results.filter(result => result.status === "rejected")).to.have.lengthOf(1);
        });

        it("frees the slot once a reservation is released", async () => {
            const uploads = registry({ maxInFlight: 1 });

            const ticket = await uploads.initiateOtaUpload();
            await uploads.release(ticket.upload_id);

            const next = await uploads.initiateOtaUpload();
            expect(next.upload_id).to.be.a("string");
        });
    });

    describe("claim", () => {
        it("returns a staging path inside the temp directory named after the id", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();

            const filePath = uploads.claim(ticket.upload_id);

            expect(filePath).to.equal(join(tempDir, `${ticket.upload_id}.ota`));
        });

        it("rejects an unknown id", async () => {
            const uploads = registry();

            await expectOtaUploadError(() => uploads.claim("deadbeef"));
        });

        it("rejects a replayed id", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();

            uploads.claim(ticket.upload_id);

            const error = await expectOtaUploadError(() => uploads.claim(ticket.upload_id));
            expect(error.message).to.include("already been used");
        });

        it("rejects a peer other than the one the id was issued to", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload("192.168.1.5");

            const error = await expectOtaUploadError(() => uploads.claim(ticket.upload_id, "192.168.1.6"));
            expect(error.message).to.include("different client");
        });

        it("accepts the issuing peer across loopback families and IPv4-mapped form", async () => {
            const uploads = registry();
            const loopback = await uploads.initiateOtaUpload("::1");
            const mapped = await uploads.initiateOtaUpload("::ffff:192.168.1.5");

            expect(uploads.claim(loopback.upload_id, "127.0.0.1")).to.be.a("string");
            expect(uploads.claim(mapped.upload_id, "192.168.1.5")).to.be.a("string");
        });
    });

    describe("completeOtaUpload", () => {
        it("stores the staged file and reports its header as a local update", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            const filePath = uploads.claim(ticket.upload_id);

            const version = await uploads.completeOtaUpload(ticket.upload_id);

            expect(controller.storedPaths).to.deep.equal([filePath]);
            expect(version).to.deep.equal({
                vid: IMAGE_INFO.vid,
                pid: IMAGE_INFO.pid,
                software_version: IMAGE_INFO.softwareVersion,
                software_version_string: IMAGE_INFO.softwareVersionString,
                min_applicable_software_version: IMAGE_INFO.minApplicableSoftwareVersion,
                max_applicable_software_version: IMAGE_INFO.maxApplicableSoftwareVersion,
                release_notes_url: IMAGE_INFO.releaseNotesUrl,
                update_source: UpdateSource.LOCAL,
            });
        });

        it("drops cached update info for the stored vendor/product", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            uploads.claim(ticket.upload_id);

            await uploads.completeOtaUpload(ticket.upload_id);

            expect(controller.invalidated).to.deep.equal([[IMAGE_INFO.vid, IMAGE_INFO.pid]]);
        });

        it("reports a store failure without leaking the staging path", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            const filePath = uploads.claim(ticket.upload_id);
            controller.storeError = new Error(`ENOENT: no such file, open '${filePath}'`);

            const error = await expectOtaUploadError(() => uploads.completeOtaUpload(ticket.upload_id));
            expect(error.message).to.not.include(tempDir);
            expect(error.message).to.include("<staged upload>");
        });

        it("reports a store failure without leaking where the store lives either", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            uploads.claim(ticket.upload_id);
            controller.storeError = new Error(
                "ENOSPC: no space left on device, write '/var/lib/matter/ota/prod/fff1-8000.bin'",
            );

            const error = await expectOtaUploadError(() => uploads.completeOtaUpload(ticket.upload_id));
            expect(error.message).to.not.include("/var/lib/matter");
            expect(error.message).to.include("ENOSPC");
        });

        it("rejects an id that was never issued", async () => {
            const uploads = registry();

            await expectOtaUploadError(() => uploads.completeOtaUpload("deadbeef"));
            expect(controller.storedPaths).to.be.empty;
        });

        it("refuses to store while OTA is disabled", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            uploads.claim(ticket.upload_id);
            controller.otaEnabled = false;

            await expectOtaUploadError(() => uploads.completeOtaUpload(ticket.upload_id));
            expect(controller.storedPaths).to.be.empty;
        });
    });

    describe("release", () => {
        it("deletes a partially written staged file", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            const filePath = uploads.claim(ticket.upload_id);
            await writeFile(filePath, "partial");

            await uploads.release(ticket.upload_id);

            expect(await readdir(tempDir)).to.be.empty;
            await expectOtaUploadError(() => uploads.claim(ticket.upload_id));
        });

        it("is a no-op for an id that was never issued", async () => {
            const uploads = registry();

            await uploads.release("deadbeef");
        });
    });

    describe("sweepExpired", () => {
        beforeEach(() => MockTime.reset());

        // Without this the mock stays enabled for the rest of the file, where real time is expected.
        afterEach(() => MockTime.disable());

        it("reclaims the slots of reservations whose upload never started", async () => {
            const uploads = registry({ maxInFlight: 2 });
            const first = await uploads.initiateOtaUpload();
            const second = await uploads.initiateOtaUpload();

            await MockTime.advance(PAST_RESERVATION_TTL_MS);
            // Nothing but the sweep may touch the reservations here: `claim` and
            // `initiateOtaUpload` drop expired entries themselves, which would hide a broken sweep.
            await uploads.sweepExpired();

            expect(uploads.inFlight).to.equal(0);
            await expectOtaUploadError(() => uploads.claim(first.upload_id));
            await expectOtaUploadError(() => uploads.claim(second.upload_id));
        });

        it("keeps a reservation whose upload is already in progress", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();
            const filePath = uploads.claim(ticket.upload_id);

            await MockTime.advance(PAST_RESERVATION_TTL_MS);
            await uploads.sweepExpired();

            await uploads.completeOtaUpload(ticket.upload_id);
            expect(controller.storedPaths).to.deep.equal([filePath]);
        });

        it("rejects a claim once the reservation has expired", async () => {
            const uploads = registry();
            const ticket = await uploads.initiateOtaUpload();

            await MockTime.advance(PAST_RESERVATION_TTL_MS);

            const error = await expectOtaUploadError(() => uploads.claim(ticket.upload_id));
            expect(error.message).to.include("expired");
        });
    });

    describe("cleanupOrphans", () => {
        it("removes files left behind by a previous process", async () => {
            await writeFile(join(tempDir, "0123456789abcdef0123456789abcdef.ota"), "leftover");
            const uploads = registry();

            await uploads.cleanupOrphans();

            expect(await readdir(tempDir)).to.be.empty;
        });

        it("leaves files and directories that aren't staged uploads alone", async () => {
            await writeFile(join(tempDir, "not-an-upload.txt"), "unrelated");
            await mkdir(join(tempDir, "some-subdir"));
            const uploads = registry();

            await uploads.cleanupOrphans();

            expect(await readdir(tempDir)).to.have.members(["not-an-upload.txt", "some-subdir"]);
        });

        it("tolerates a missing staging directory", async () => {
            const uploads = new OtaUploadRegistry(controller, { tempDir: join(tempDir, "does-not-exist") });

            await uploads.cleanupOrphans();
        });
    });
});
