/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

const LOG_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOG_BACKUP_COUNT = 7; // keep up to 7 daily backup files

function isEnoent(err: unknown): boolean {
    return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * Creates a file-based logger that writes to the given path.
 * On startup and every 24 hours the existing backups are shifted
 * (.6→.7, .5→.6, …, .1→.2, current→.1) and a fresh file is opened,
 * keeping up to LOG_BACKUP_COUNT daily backups (≈7 days of logs).
 *
 * Returns `{ write, close }`. Call `close()` before `process.exit()` to flush
 * any buffered data and release the file handle.
 */
export async function createFileLogger(path: string) {
    await mkdir(dirname(path), { recursive: true });

    async function openFreshLogFile() {
        // Remove the oldest backup to make room, then shift: .6→.7, …, .1→.2, current→.1
        try {
            await unlink(`${path}.${LOG_BACKUP_COUNT}`);
        } catch (err) {
            if (!isEnoent(err)) {
                throw err;
            }
        }
        for (let i = LOG_BACKUP_COUNT - 1; i >= 1; i--) {
            try {
                await rename(`${path}.${i}`, `${path}.${i + 1}`);
            } catch (err) {
                if (!isEnoent(err)) {
                    throw err;
                }
            }
        }
        try {
            await rename(path, `${path}.1`);
        } catch (err) {
            if (!isEnoent(err)) {
                throw err;
            }
        }
        const fileHandle = await open(path, "a");
        const writer = fileHandle.createWriteStream();
        writer.on("error", err => console.error(`Log file write error: ${err}`));
        return { fileHandle, writer };
    }

    let { fileHandle, writer } = await openFreshLogFile();

    let rotating = false;

    async function rotateLog() {
        if (rotating) {
            return;
        }
        rotating = true;
        try {
            const oldWriter = writer;
            const oldHandle = fileHandle;
            let next;
            try {
                next = await openFreshLogFile();
            } catch (err) {
                console.error(`Log file rotation failed, keeping current log file: ${err}`);
                return;
            }
            fileHandle = next.fileHandle;
            writer = next.writer;
            await new Promise<void>((resolve, reject) =>
                oldWriter.end((err?: Error | null) => (err ? reject(err) : resolve())),
            );
            await oldHandle.close().catch(err => console.error(`Failed to close old log file: ${err}`));
        } finally {
            rotating = false;
        }
    }

    const rotationTimer = setInterval(() => void rotateLog(), LOG_ROTATION_INTERVAL_MS);
    rotationTimer.unref();

    async function close() {
        clearInterval(rotationTimer);
        await new Promise<void>((resolve, reject) =>
            writer.end((err?: Error | null) => (err ? reject(err) : resolve())),
        );
        await fileHandle.close().catch(err => console.error(`Failed to close log file: ${err}`));
    }

    return {
        write: (formattedLog: string) => {
            writer.write(`${formattedLog}\n`);
        },
        close,
    };
}
