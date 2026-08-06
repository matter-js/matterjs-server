/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpServer, OtaUploadStaging, WebServerHandler } from "@matter-server/ws-controller";
import { Logger, ServerError } from "@matter-server/ws-controller";
import { createWriteStream, type WriteStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";

const logger = Logger.get("OtaUploadHandler");

const UPLOAD_PATH = /^\/ota-upload\/([0-9a-f]{32})$/;

/** Thrown once the streamed body passes the configured limit, to distinguish it from I/O failures. */
class UploadTooLargeError extends Error {}

/** A peer that hung up mid-transfer is routine, not a server fault: log it quietly, answer nobody. */
function isClientDisconnect(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === "ECONNRESET" || code === "ECANCELED" || code === "ERR_STREAM_PREMATURE_CLOSE";
}

/**
 * Receives the body of an OTA firmware upload authorized by the `initiate_ota_upload` WebSocket
 * command and imports it into the server's OTA image store.
 *
 * Responds to POST /ota-upload/<upload_id>, where the id is the single-use ticket issued over the
 * WebSocket session. Bytes stream straight to a file named after that id, so an upload never costs
 * more than a chunk of memory and no client-supplied string ever reaches the filesystem path.
 */
export class OtaUploadHandler implements WebServerHandler {
    #uploads: OtaUploadStaging;
    #shuttingDown = false;
    /** In-flight request bodies. An upload can run for minutes, which would outlive `stop()`. */
    readonly #active = new Set<IncomingMessage>();

    constructor(uploads: OtaUploadStaging) {
        this.#uploads = uploads;
    }

    async register(server: HttpServer): Promise<void> {
        server.on("request", (req, res) => {
            const path = req.url?.split("?")[0];
            if (path === undefined || (path !== "/ota-upload" && !path.startsWith("/ota-upload/"))) {
                return;
            }

            // The response is written after long awaits (streaming, import), by when the peer may be
            // gone; an unlistened 'error' on a stream is an uncaught exception.
            res.on("error", error => logger.debug("OTA upload response stream failed:", error));

            if (req.method !== "POST") {
                req.resume();
                res.writeHead(405, { Allow: "POST" });
                res.end();
                return;
            }

            if (this.#shuttingDown) {
                this.#endRequest(req, res, 503, { error: "Server is shutting down" });
                return;
            }

            const uploadId = UPLOAD_PATH.exec(path)?.[1];
            if (uploadId === undefined) {
                this.#endRequest(req, res, 404, {
                    error: "Upload id missing; request one via the initiate_ota_upload command",
                });
                return;
            }

            this.#handleUpload(req, res, uploadId).catch(error =>
                logger.error(`OTA upload ${uploadId} failed to complete:`, error),
            );
        });
    }

    initiateShutdown(): void {
        this.#shuttingDown = true;
    }

    async unregister(): Promise<void> {
        this.#shuttingDown = true;
        // An in-flight body keeps its socket active, and `server.close()` waits for that — up to
        // Node's request timeout. Teardown must not be at an uploading client's mercy.
        for (const req of this.#active) {
            req.destroy();
        }
        this.#active.clear();
    }

    async #handleUpload(req: IncomingMessage, res: ServerResponse, uploadId: string): Promise<void> {
        let filePath: string;
        try {
            filePath = this.#uploads.claim(uploadId, req.socket.remoteAddress);
        } catch (error) {
            // Nothing was reserved, so there is no slot to release and no file to remove.
            req.resume();
            this.#respondServerError(res, error);
            return;
        }

        this.#active.add(req);
        // Deferred so the slot is free before the client learns the outcome and uploads again. The
        // streaming-overflow path is the exception: it has to answer while the socket still lives.
        let respond: () => void;
        try {
            // Rejecting on the declared length is the only way the client reliably reads the 413:
            // once the body is flowing, aborting the write tears down the socket with it.
            const declaredSize = Number(req.headers["content-length"]);
            if (Number.isFinite(declaredSize) && declaredSize > this.#uploads.maxSizeBytes) {
                throw new UploadTooLargeError();
            }

            await this.#streamToFile(req, res, filePath);
            const info = await this.#uploads.completeOtaUpload(uploadId);
            respond = () => this.#respondJson(res, 200, { ...info });
        } catch (error) {
            if (error instanceof UploadTooLargeError) {
                respond = () => this.#rejectTooLarge(req, res);
            } else if (error instanceof ServerError) {
                respond = () => this.#respondServerError(res, error);
            } else if (isClientDisconnect(error)) {
                logger.debug(`OTA upload ${uploadId} was aborted by the client`);
                respond = () => {};
            } else {
                logger.warn(`OTA upload ${uploadId} failed:`, error);
                respond = () => this.#respondError(res, 500, "Failed to store OTA image");
            }
        } finally {
            this.#active.delete(req);
        }

        try {
            await this.#uploads.release(uploadId);
        } finally {
            respond();
        }
    }

    async #streamToFile(req: IncomingMessage, res: ServerResponse, filePath: string): Promise<void> {
        const maxSizeBytes = this.#uploads.maxSizeBytes;
        const rejectTooLarge = () => this.#rejectTooLarge(req, res);
        let size = 0;

        // A broken staging directory (EACCES, ENOENT, EEXIST) surfaces asynchronously through
        // `pipeline`, but an unusable path argument throws right here.
        let staged: WriteStream;
        try {
            // O_EXCL: never write through a file, or a symlink, that someone else put there first.
            staged = createWriteStream(filePath, { flags: "wx" });
        } catch (error) {
            throw new Error(`Cannot stage upload at ${filePath}`, { cause: error });
        }

        await pipeline(
            req,
            async function* (source: AsyncIterable<Buffer>) {
                for await (const chunk of source) {
                    size += chunk.length;
                    if (size > maxSizeBytes) {
                        // Answer before throwing: the throw destroys the request, and with it the
                        // socket the response would have gone out on.
                        rejectTooLarge();
                        throw new UploadTooLargeError();
                    }
                    yield chunk;
                }
            },
            staged,
        );
    }

    /**
     * A rejected body still has to be answered, but draining it to the end would let a ticket holder
     * keep the server reading for as long as the request timeout allows, so the socket goes with it.
     */
    #rejectTooLarge(req: IncomingMessage, res: ServerResponse) {
        this.#endRequest(
            req,
            res,
            413,
            { error: `Firmware image exceeds the ${Math.round(this.#uploads.maxSizeBytes / 1024 / 1024)} MB limit` },
            true,
        );
    }

    #endRequest(
        req: IncomingMessage,
        res: ServerResponse,
        status: number,
        body: Record<string, unknown>,
        discardBody = false,
    ) {
        if (res.headersSent || res.writableEnded) {
            return;
        }
        if (discardBody) {
            res.setHeader("Connection", "close");
            res.once("finish", () => req.destroy());
        }
        req.resume();
        this.#respondJson(res, status, body);
    }

    #respondServerError(res: ServerResponse, error: unknown) {
        if (error instanceof ServerError) {
            this.#respondJson(res, 400, { error_code: error.code, message: error.message });
        } else {
            this.#respondError(res, 500, "Failed to store OTA image");
        }
    }

    #respondError(res: ServerResponse, status: number, message: string) {
        this.#respondJson(res, status, { error: message });
    }

    #respondJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
        if (res.headersSent || res.writableEnded) {
            return;
        }
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
    }
}
