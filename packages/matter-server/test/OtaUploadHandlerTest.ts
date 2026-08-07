/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerError, ServerErrorCode, UpdateSource, type MatterSoftwareVersion } from "@matter-server/ws-controller";
import { Logger, LogLevel } from "@matter/main";
import type { Diagnostic } from "@matter/main";
import { chmod, mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OtaUploadHandler } from "../src/server/OtaUploadHandler.js";

const MAX_SIZE = 1024;

const STORED: MatterSoftwareVersion = {
    vid: 0xfff1,
    pid: 0x8000,
    software_version: 3,
    software_version_string: "3.0",
    min_applicable_software_version: 0,
    max_applicable_software_version: 2,
    update_source: UpdateSource.LOCAL,
};

/** Stands in for the registry: hands out one staging path and records what the handler did with it. */
class TestStaging {
    readonly maxSizeBytes = MAX_SIZE;
    completeError?: Error;
    claimError?: Error;
    readonly completed = new Array<string>();
    readonly released = new Array<string>();

    constructor(readonly stagingDir: string) {}

    claim(uploadId: string): string {
        if (this.claimError !== undefined) {
            throw this.claimError;
        }
        return join(this.stagingDir, `${uploadId}.ota`);
    }

    async completeOtaUpload(uploadId: string): Promise<MatterSoftwareVersion> {
        this.completed.push(uploadId);
        if (this.completeError !== undefined) {
            throw this.completeError;
        }
        return STORED;
    }

    async release(uploadId: string): Promise<void> {
        this.released.push(uploadId);
        await rm(join(this.stagingDir, `${uploadId}.ota`), { force: true });
    }
}

const UPLOAD_ID = "0123456789abcdef0123456789abcdef";

/**
 * Node <=22 leaks the connection count of a socket the peer reset while a response was being
 * written, and `close()` then never calls back.
 */
function closeServer(server: Server): Promise<void> {
    return new Promise<void>(resolve => {
        server.close(() => resolve());
        server.closeAllConnections();
    });
}

describe("OtaUploadHandler", () => {
    let stagingDir: string;
    let staging: TestStaging;
    let server: Server;
    let port: number;
    let baseUrl: string;
    let logged: Diagnostic.Message[];
    let restoreLog: () => void;

    beforeEach(async () => {
        logged = new Array<Diagnostic.Message>();
        const destination = Logger.destinations.default;
        const add = destination.add.bind(destination);
        destination.add = message => {
            if (message.facility === "MatterServer.OtaUpload") logged.push(message);
            add(message);
        };
        restoreLog = () => (destination.add = add);

        stagingDir = await mkdtemp(join(tmpdir(), "ota-upload-handler-test-"));
        staging = new TestStaging(stagingDir);
        server = createServer();
        await new OtaUploadHandler(staging).register(server);
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        const address = server.address();
        if (address === null || typeof address === "string") {
            throw new Error("Expected a TCP address");
        }
        port = address.port;
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
        restoreLog();
        await closeServer(server);
        await rm(stagingDir, { recursive: true, force: true });
    });

    function upload(body: BodyInit, uploadId = UPLOAD_ID, method = "POST") {
        return fetch(`${baseUrl}/ota-upload/${uploadId}`, { method, body });
    }

    /** Paths where the client learns the outcome from a torn-down socket rather than a response. */
    async function waitForCleanup() {
        for (let attempt = 0; attempt < 200; attempt++) {
            if (staging.released.length > 0 && (await readdir(stagingDir)).length === 0) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    it("stores the body and answers with the parsed image info", async () => {
        const response = await upload(new Uint8Array(64));

        expect(response.status).to.equal(200);
        expect(await response.json()).to.deep.equal(STORED);
        expect(staging.completed).to.deep.equal([UPLOAD_ID]);
    });

    it("always releases the reservation and leaves no staged file behind", async () => {
        await upload(new Uint8Array(64));

        expect(staging.released).to.deep.equal([UPLOAD_ID]);
        expect(await readdir(stagingDir)).to.be.empty;
    });

    it("maps a rejected claim to the error code, without releasing a slot it never held", async () => {
        staging.claimError = ServerError.otaUploadError("OTA upload id has already been used");

        const response = await upload(new Uint8Array(64));

        expect(response.status).to.equal(400);
        expect(await response.json()).to.deep.include({ error_code: ServerErrorCode.OtaUploadError });
        expect(staging.released).to.be.empty;
    });

    it("maps a failed import to the error code and still releases", async () => {
        staging.completeError = ServerError.otaUploadError("Invalid OTA image header");

        const response = await upload(new Uint8Array(64));

        expect(response.status).to.equal(400);
        expect(await response.json()).to.deep.include({
            error_code: ServerErrorCode.OtaUploadError,
            message: "Invalid OTA image header",
        });
        expect(staging.released).to.deep.equal([UPLOAD_ID]);
    });

    it("answers 500 for an unexpected import failure without exposing it", async () => {
        staging.completeError = new Error("kaboom in /etc/secrets");

        const response = await upload(new Uint8Array(64));

        expect(response.status).to.equal(500);
        expect(await response.text()).to.not.include("kaboom");
        expect(staging.released).to.deep.equal([UPLOAD_ID]);
    });

    it("rejects a body whose declared length is over the limit and frees the slot", async () => {
        const response = await upload(new Uint8Array(MAX_SIZE + 1));

        expect(response.status).to.equal(413);
        expect(staging.completed).to.be.empty;
        // A rejection that keeps the slot would let a handful of oversized picks lock out every
        // client for the reservation lifetime, since a reservation cannot be handed back.
        expect(staging.released).to.deep.equal([UPLOAD_ID]);
        expect(await readdir(stagingDir)).to.be.empty;
    });

    it("delivers the rejection to a client still writing the body it declared", async () => {
        const declared = 4 * 1024 * 1024;

        const request = httpRequest({
            host: "127.0.0.1",
            port,
            path: `/ota-upload/${UPLOAD_ID}`,
            method: "POST",
            headers: { "Content-Length": String(declared) },
        });
        // The rest of the body is still in flight once the answer is in, so the socket goes down
        // under it either way; only a failure before the answer is a test failure.
        request.on("error", () => {});

        try {
            const response = await new Promise<IncomingMessage>((resolve, reject) => {
                request.on("response", resolve);
                request.on("error", reject);
                request.end(Buffer.alloc(declared));
            });
            response.resume();

            expect(response.statusCode).to.equal(413);
            expect(staging.completed).to.be.empty;
        } finally {
            request.destroy();
        }
    });

    it("rejects a body that outgrows the limit without declaring its length", async () => {
        const oversized = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(MAX_SIZE));
                controller.enqueue(new Uint8Array(MAX_SIZE));
                controller.close();
            },
        });

        let status: number | undefined;
        try {
            // A chunked body cut off mid-transfer may surface as a fetch failure instead of the 413,
            // depending on which side wins the race; either way nothing may be imported.
            status = (
                await fetch(`${baseUrl}/ota-upload/${UPLOAD_ID}`, {
                    method: "POST",
                    body: oversized,
                    duplex: "half",
                } as RequestInit)
            ).status;
        } catch {
            status = undefined;
        }

        if (status !== undefined) {
            expect(status).to.equal(413);
        }
        await waitForCleanup();
        expect(staging.completed).to.be.empty;
        expect(staging.released).to.deep.equal([UPLOAD_ID]);
        expect(await readdir(stagingDir)).to.be.empty;
    });

    it("survives a client that hangs up while the image is being imported", async () => {
        const controller = new AbortController();
        let aborted: () => void;
        const abortSeen = new Promise<void>(resolve => (aborted = resolve));
        const complete = staging.completeOtaUpload.bind(staging);
        staging.completeOtaUpload = async uploadId => {
            controller.abort();
            await abortSeen;
            return complete(uploadId);
        };

        const pending = fetch(`${baseUrl}/ota-upload/${UPLOAD_ID}`, {
            method: "POST",
            body: new Uint8Array(64),
            signal: controller.signal,
        }).catch(() => undefined);
        await pending;
        aborted!();

        // Answering a socket the client already dropped must not take the process down.
        await waitForCleanup();
        expect(staging.released).to.deep.equal([UPLOAD_ID]);
    });

    it("answers 500 when the staging file cannot be created", async () => {
        await chmod(stagingDir, 0o500);
        try {
            const response = await upload(new Uint8Array(64));

            expect(response.status).to.equal(500);
            expect(staging.completed).to.be.empty;
            expect(staging.released).to.deep.equal([UPLOAD_ID]);
        } finally {
            await chmod(stagingDir, 0o700);
        }
    });

    it("refuses new uploads once shutdown was initiated", async () => {
        const handler = new OtaUploadHandler(staging);
        const shuttingDown = createServer();
        await handler.register(shuttingDown);
        await new Promise<void>(resolve => shuttingDown.listen(0, "127.0.0.1", resolve));
        const address = shuttingDown.address();
        if (address === null || typeof address === "string") {
            throw new Error("Expected a TCP address");
        }
        handler.initiateShutdown();

        try {
            const response = await fetch(`http://127.0.0.1:${address.port}/ota-upload/${UPLOAD_ID}`, {
                method: "POST",
                body: new Uint8Array(64),
            });

            expect(response.status).to.equal(503);
            expect(staging.completed).to.be.empty;
        } finally {
            await handler.unregister();
            await closeServer(shuttingDown);
        }
    });

    it("answers 404 for a path without a well-formed upload id", async () => {
        const response = await fetch(`${baseUrl}/ota-upload`, { method: "POST", body: new Uint8Array(4) });

        expect(response.status).to.equal(404);
        expect(await response.json()).to.have.property("error");
    });

    it("answers 404 for an id that is not 32 hex characters", async () => {
        expect((await upload(new Uint8Array(4), "not-hex")).status).to.equal(404);
        expect((await upload(new Uint8Array(4), "abcdef")).status).to.equal(404);
        expect((await upload(new Uint8Array(4), `${UPLOAD_ID}ff`)).status).to.equal(404);
        expect(staging.completed).to.be.empty;
    });

    it("answers 405 for a method other than POST", async () => {
        const response = await fetch(`${baseUrl}/ota-upload/${UPLOAD_ID}`, { method: "GET" });

        expect(response.status).to.equal(405);
        expect(response.headers.get("allow")).to.equal("POST");
    });

    it("classifies a client hangup as routine rather than a server fault", async () => {
        const controller = new AbortController();
        const stalled = new ReadableStream<Uint8Array>({
            start(streamController) {
                streamController.enqueue(new Uint8Array(16));
            },
        });

        const pending = fetch(`${baseUrl}/ota-upload/${UPLOAD_ID}`, {
            method: "POST",
            body: stalled,
            signal: controller.signal,
            duplex: "half",
        } as RequestInit).catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, 50));
        controller.abort();
        await pending;
        await waitForCleanup();

        // Warn/error would mean the abort fell through to the generic failure branch, which also
        // answers a socket that is already gone.
        expect(logged.filter(entry => entry.level >= LogLevel.WARN)).to.be.empty;
    });

    it("survives a client that hangs up mid-transfer", async () => {
        const controller = new AbortController();
        const stalled = new ReadableStream<Uint8Array>({
            start(streamController) {
                streamController.enqueue(new Uint8Array(16));
            },
        });

        const pending = fetch(`${baseUrl}/ota-upload/${UPLOAD_ID}`, {
            method: "POST",
            body: stalled,
            signal: controller.signal,
            duplex: "half",
        } as RequestInit).catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, 50));
        controller.abort();
        await pending;

        await waitForCleanup();
        expect(staging.released).to.deep.equal([UPLOAD_ID]);
        expect(staging.completed).to.be.empty;
        expect(await readdir(stagingDir)).to.be.empty;
    });
});
