/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Time } from "@matter/main";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    type MatterSoftwareVersion,
    type OtaUploadTicket,
    ServerError,
    UpdateSource,
} from "../types/WebSocketMessageTypes.js";

const logger = Logger.get("OtaUploadRegistry");

/** Window for the POST to *start*; once it has, the transfer itself is bounded by size, not time. */
const RESERVATION_TTL_MS = 60_000;

const DEFAULT_MAX_IN_FLIGHT = 5;

/** Filename of a staged upload: the 32-hex upload id `initiateOtaUpload()` generates, plus `.ota`. */
const STAGED_UPLOAD_NAME = /^[0-9a-f]{32}\.ota$/;

/** Anything path-shaped in an error message, wherever on disk the failure happened. */
const ABSOLUTE_PATH = /(?:[A-Za-z]:)?[\\/][^\s'"]*[\\/][^\s'"]*/g;

/**
 * Placeholder sized on observation, not on spec: shipping Matter images run ~1-8 MB (ESP32/nRF
 * class) and tens of MB for camera-class devices, so 64 MB is headroom rather than a real limit.
 * Tune via `--ota-upload-max-size-mb` if a legitimate image is rejected.
 */
const DEFAULT_MAX_SIZE_MB = 64;

export interface OtaUploadOptions {
    /** Directory holding in-progress uploads. Defaults to a subdirectory of the OS temp dir. */
    tempDir?: string;
    maxInFlight?: number;
    maxSizeBytes?: number;
}

/** The parts of a stored image's OTA header this registry reports back to the client. */
export interface OtaImageInfo {
    vid: number;
    pid: number;
    softwareVersion: number;
    softwareVersionString: string;
    minApplicableSoftwareVersion: number;
    maxApplicableSoftwareVersion: number;
    releaseNotesUrl?: string;
}

/**
 * The controller surface an upload needs. Declared structurally so the registry can be exercised
 * without a live Matter node; {@link MatterController} satisfies it.
 */
export interface OtaUploadController {
    readonly otaEnabled: boolean;
    storeOtaImage(filePath: string): Promise<OtaImageInfo>;
    readonly commandHandler: {
        invalidateAvailableUpdates(vendorId: number, productId: number): void;
    };
}

/**
 * The staging side of an upload, as the HTTP endpoint delivering the bytes sees it.
 * {@link OtaUploadRegistry} implements it.
 */
export interface OtaUploadStaging {
    readonly maxSizeBytes: number;
    claim(uploadId: string, peerAddress?: string): string;
    completeOtaUpload(uploadId: string): Promise<MatterSoftwareVersion>;
    release(uploadId: string): Promise<void>;
}

interface Reservation {
    expiresAt: number;
    filePath: string;
    consumed: boolean;
    peer: string;
}

/**
 * Loopback collapses to one bucket: the WebSocket and the following POST may resolve `localhost`
 * to different address families, which would otherwise look like a different peer.
 */
function normalizePeer(address: string | undefined): string {
    if (address === undefined || address === "") {
        return "unknown";
    }
    const plain = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
    return plain === "127.0.0.1" || plain === "::1" ? "loopback" : plain;
}

/**
 * Owns OTA firmware uploads end to end: the `initiate_ota_upload` WebSocket command that authorizes
 * one, the staging file the HTTP POST streams into, and the import into the local OTA image store.
 *
 * A slot is held from the moment an id is issued, so a client cannot hoard ids without uploading
 * and starve others. Ids are random and double as the on-disk filename, keeping every
 * client-supplied string out of the staging path.
 */
export class OtaUploadRegistry implements OtaUploadStaging {
    readonly #controller: OtaUploadController;
    readonly #reservations = new Map<string, Reservation>();
    readonly #tempDir: string;
    readonly #maxInFlight: number;
    readonly #maxSizeBytes: number;

    constructor(controller: OtaUploadController, options: OtaUploadOptions = {}) {
        this.#controller = controller;
        this.#tempDir = options.tempDir ?? join(tmpdir(), "matter-server-ota-uploads");
        this.#maxInFlight = Math.max(1, options.maxInFlight ?? DEFAULT_MAX_IN_FLIGHT);
        this.#maxSizeBytes = Math.max(1, options.maxSizeBytes ?? DEFAULT_MAX_SIZE_MB * 1024 * 1024);
    }

    get tempDir() {
        return this.#tempDir;
    }

    get maxSizeBytes() {
        return this.#maxSizeBytes;
    }

    /** Reservations currently occupying a slot, issued or transferring. */
    get inFlight() {
        return this.#reservations.size;
    }

    /**
     * Authorize one OTA firmware upload: issue an id, hold an in-flight slot for it, and bind it to
     * the peer that asked, so the id is only spendable from the connection that obtained it.
     */
    async initiateOtaUpload(peerAddress?: string): Promise<OtaUploadTicket> {
        if (!this.#controller.otaEnabled) {
            throw ServerError.otaUploadError("OTA is disabled");
        }

        await this.sweepExpired();
        await this.#prepareStagingDir();

        // The size check must happen right before the insert, with no `await` in between: WebSocket
        // messages are handled concurrently, so two calls racing past a check taken earlier (e.g.
        // before the `mkdir` above) could both slip through and exceed maxInFlight.
        if (this.#reservations.size >= this.#maxInFlight) {
            throw ServerError.otaUploadError(
                `Too many OTA uploads in flight (limit ${this.#maxInFlight}); retry once one completes`,
            );
        }

        const uploadId = randomBytes(16).toString("hex");
        this.#reservations.set(uploadId, {
            expiresAt: Time.nowMs + RESERVATION_TTL_MS,
            filePath: join(this.#tempDir, `${uploadId}.ota`),
            consumed: false,
            peer: normalizePeer(peerAddress),
        });

        return {
            upload_id: uploadId,
            expires_in: RESERVATION_TTL_MS / 1000,
            max_size: this.#maxSizeBytes,
        };
    }

    /**
     * Bind an arriving POST to its reservation and return the path to stream into. Marking the
     * reservation consumed here rather than on completion is what makes an id single-use: a replayed
     * or concurrent POST cannot join a transfer that is already writing to that path.
     */
    claim(uploadId: string, peerAddress?: string): string {
        const reservation = this.#reservations.get(uploadId);
        if (reservation === undefined) {
            throw ServerError.otaUploadError("Unknown OTA upload id");
        }
        if (reservation.consumed) {
            throw ServerError.otaUploadError("OTA upload id has already been used");
        }
        if (reservation.expiresAt <= Time.nowMs) {
            this.#reservations.delete(uploadId);
            throw ServerError.otaUploadError("OTA upload id expired before the upload started");
        }
        if (reservation.peer !== normalizePeer(peerAddress)) {
            throw ServerError.otaUploadError("OTA upload id was issued to a different client");
        }
        reservation.consumed = true;
        return reservation.filePath;
    }

    /**
     * Import a fully staged upload into the local OTA image store. The staged file is discarded by
     * {@link release} afterwards; the store keeps its own copy.
     */
    async completeOtaUpload(uploadId: string): Promise<MatterSoftwareVersion> {
        if (!this.#controller.otaEnabled) {
            throw ServerError.otaUploadError("OTA is disabled");
        }
        const reservation = this.#reservations.get(uploadId);
        if (reservation === undefined) {
            throw ServerError.otaUploadError("Unknown OTA upload id");
        }

        let info: OtaImageInfo;
        try {
            info = await this.#controller.storeOtaImage(reservation.filePath);
        } catch (error) {
            if (error instanceof ServerError) throw error;
            logger.warn(`Failed to store OTA image for upload ${uploadId}:`, error);
            throw ServerError.otaUploadError(`Failed to store OTA image: ${this.#sanitize(error)}`, error as Error);
        }

        // A cached older update for this vendor/product would otherwise shadow the image that was
        // just stored, because check_node_update returns the cache before querying again.
        this.#controller.commandHandler.invalidateAvailableUpdates(info.vid, info.pid);

        return {
            vid: info.vid,
            pid: info.pid,
            software_version: info.softwareVersion,
            software_version_string: info.softwareVersionString,
            min_applicable_software_version: info.minApplicableSoftwareVersion,
            max_applicable_software_version: info.maxApplicableSoftwareVersion,
            release_notes_url: info.releaseNotesUrl,
            update_source: UpdateSource.LOCAL,
        };
    }

    /** Free the in-flight slot and discard the staged file, whether partial or already imported. */
    async release(uploadId: string): Promise<void> {
        const reservation = this.#reservations.get(uploadId);
        if (reservation === undefined) {
            return;
        }
        this.#reservations.delete(uploadId);
        try {
            await rm(reservation.filePath, { force: true });
        } catch (error) {
            logger.warn(`Failed to remove staged OTA upload ${reservation.filePath}:`, error);
        }
    }

    /** Drop reservations whose POST never arrived, returning their slot to other clients. */
    async sweepExpired(): Promise<void> {
        const now = Time.nowMs;
        for (const [uploadId, reservation] of this.#reservations) {
            if (!reservation.consumed && reservation.expiresAt <= now) {
                await this.release(uploadId);
            }
        }
    }

    /** Discard staged files left behind by a previous process that died mid-upload. */
    async cleanupOrphans(): Promise<void> {
        let entries: string[];
        try {
            entries = await readdir(this.#tempDir);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.warn(`Failed to read OTA upload staging directory ${this.#tempDir}:`, error);
            }
            return;
        }

        for (const entry of entries) {
            if (!STAGED_UPLOAD_NAME.test(entry)) {
                continue;
            }
            try {
                await rm(join(this.#tempDir, entry), { force: true });
                logger.info(`Removed orphaned OTA upload ${entry}`);
            } catch (error) {
                logger.warn(`Failed to remove orphaned OTA upload ${entry}:`, error);
            }
        }
    }

    /**
     * The staging directory doubles as an authorization boundary: every file the uploads write and
     * `cleanupOrphans` deletes lives in it. `mkdir` happily accepts a path another local user
     * pre-created as a symlink into their own tree, which would relocate both.
     */
    async #prepareStagingDir(): Promise<void> {
        try {
            await mkdir(this.#tempDir, { recursive: true, mode: 0o700 });
            const stats = await lstat(this.#tempDir);
            if (!stats.isDirectory()) {
                throw new Error("is not a directory");
            }
            const uid = process.getuid?.();
            if (uid !== undefined && stats.uid !== uid) {
                throw new Error(`is owned by uid ${stats.uid}, not by this process (uid ${uid})`);
            }
        } catch (error) {
            logger.warn(`OTA upload staging directory ${this.#tempDir} is not usable:`, error);
            throw ServerError.otaUploadError("OTA upload staging directory is not usable");
        }
    }

    /** Filesystem layout reaches the client through error messages; it has no business knowing it. */
    #sanitize(error: unknown): string {
        const message = error instanceof Error ? error.message : String(error);
        return message.replaceAll(this.#tempDir, "<staged upload>").replace(ABSOLUTE_PATH, "<path>");
    }
}
