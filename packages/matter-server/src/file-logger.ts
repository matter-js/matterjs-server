/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { closeSync, createWriteStream, renameSync, unlinkSync, type WriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, posix, sep } from "node:path";

const LOG_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOG_BACKUP_COUNT = 7; // keep up to 7 daily backup files
const LOG_TEMP_SUFFIX = ".new"; // temp file written to during rotation

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
export async function createFileLogger(logPath: string) {
    // sep is "\\" on Windows, "/" on POSIX; posix.sep is always "/"
    if (logPath.endsWith(sep) || logPath.endsWith(posix.sep) || !basename(logPath)) {
        throw new Error(`Log file path must include a filename, not just a directory: "${logPath}"`);
    }
    await mkdir(dirname(logPath), { recursive: true });

    /** Shift backups synchronously: .6→.7, …, .1→.2, logPath→.1 */
    function shiftBackupsSync() {
        try {
            unlinkSync(`${logPath}.${LOG_BACKUP_COUNT}`);
        } catch (err) {
            if (!isEnoent(err)) throw err;
        }
        for (let i = LOG_BACKUP_COUNT - 1; i >= 1; i--) {
            try {
                renameSync(`${logPath}.${i}`, `${logPath}.${i + 1}`);
            } catch (err) {
                if (!isEnoent(err)) throw err;
            }
        }
        try {
            renameSync(logPath, `${logPath}.1`);
        } catch (err) {
            if (!isEnoent(err)) throw err;
        }
    }

    /** Open a write stream at filePath and wait until it is ready.
     *  Pass autoClose:false for streams whose fd lifetime is managed explicitly
     *  (e.g. the rotation temp stream, where we call closeSync before renaming). */
    function openLogStream(
        filePath: string,
        flags = "a",
        autoClose = true,
    ): Promise<{ stream: WriteStream; fd: number }> {
        return new Promise<{ stream: WriteStream; fd: number }>((resolve, reject) => {
            const stream = createWriteStream(filePath, { flags, autoClose });
            stream.once("open", (fd: number) => resolve({ stream, fd }));
            stream.once("error", reject);
        });
    }

    /** End a stream and resolve when all data is flushed ('finish').
     *  Rejects if the stream emits an error before finishing, preventing an
     *  unresolvable hang when e.g. the disk is full during a rotation flush. */
    function drainStream(stream: WriteStream): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const onError = (err: Error) => reject(err);
            stream.once("error", onError);
            stream.end((err?: Error | null) => {
                stream.removeListener("error", onError);
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Startup: clean up any stale temp file from a previously crashed rotation,
    // shift existing backups, then open the log file.
    try {
        unlinkSync(`${logPath}${LOG_TEMP_SUFFIX}`);
    } catch (err) {
        if (!isEnoent(err)) console.error(`Failed to clean up stale log temp file: ${err}`);
    }
    try {
        shiftBackupsSync();
    } catch (err) {
        console.error(`Initial log file backup shifting failed: ${err}`);
    }
    let { stream: writer } = await openLogStream(logPath);
    writer.on("error", err => console.error(`Log file write error: ${err}`));

    // When non-null, write() buffers lines here instead of writing to the stream.
    // Used during the drain+rename phase of rotation to capture writes that arrive
    // while tempStream is being flushed, with no fd open for them yet.
    let pendingLines: string[] | null = null;

    // Track in-progress rotation so close() can wait for it to finish.
    let rotationPromise: Promise<void> | null = null;

    async function doRotate() {
        const tempPath = `${logPath}${LOG_TEMP_SUFFIX}`;

        // 1. Open the temp file with "w" (truncate) — ensures any stale .new file from
        //    a previously crashed rotation is discarded rather than appended to.
        let tempStream: WriteStream;
        let tempFd: number;
        try {
            // autoClose:false — we own tempFd and must closeSync it before renameSync (required on Windows)
            ({ stream: tempStream, fd: tempFd } = await openLogStream(tempPath, "w", false));
            tempStream.on("error", err => console.error(`Log file write error: ${err}`));
        } catch (err) {
            console.error(`Failed to open temp log file for rotation: ${err}`);
            return;
        }

        // 2. Atomic swap — single-threaded JS, so no write() can execute between
        //    this assignment and any following synchronous statement.
        const oldStream = writer;
        writer = tempStream;

        // 3. Drain the old stream. New writes are already going to tempStream.
        try {
            await drainStream(oldStream);
        } catch (err) {
            console.error(`Failed to flush old log file during rotation: ${err}`);
        }

        // 4. Shift the backups now that the old file handle is drained and closed.
        try {
            shiftBackupsSync();
        } catch (err) {
            // Backups could not be shifted; log continues at tempPath with the wrong
            // name. Still attempt the rename so the active file is at logPath.
            console.error(`Log file backup shifting failed: ${err}`);
        }

        // 5. Enable in-memory buffering so writes that arrive during the next two
        //    async steps are captured rather than going to the soon-to-be-closed
        //    tempStream or a not-yet-open finalStream.
        pendingLines = [];

        // 6. Drain tempStream fully before closing its fd. This guarantees no
        //    in-flight libuv fs.write() calls remain when closeSync runs below,
        //    eliminating the risk of EBADF errors from a closed fd.
        try {
            await drainStream(tempStream);
        } catch (err) {
            console.error(`Failed to flush temp log file during rotation: ${err}`);
        }

        // 7. Close tempFd (required on Windows before rename) and rename .new → logPath.
        //    pendingLines buffers any writes that arrive while this is in progress.
        try {
            closeSync(tempFd);
            renameSync(tempPath, logPath);
        } catch (err) {
            console.error(`Failed to finalize log file rotation: ${err}`);
            // Rotation failed: reopen logPath in append mode so logging can continue.
            // pendingLines is flushed into the reopened stream below.
        }

        // 8. Open the final stream. pendingLines remains active so that writes
        //    arriving while the file is opening are buffered, not dropped.
        let finalStream: WriteStream | undefined;
        try {
            ({ stream: finalStream } = await openLogStream(logPath, "a"));
            finalStream.on("error", err => console.error(`Log file write error: ${err}`));
        } catch (err) {
            console.error(`Failed to open final log file after rotation: ${err}`);
            // writer still points to the ended tempStream; the guards in write()
            // (writableEnded / destroyed) will silently drop further writes.
        }

        // Disable buffering and flush everything captured since step 5. Done
        // synchronously so write() cannot observe a window where pendingLines is
        // null but writer still points to the ended tempStream.
        const buffered = pendingLines ?? [];
        pendingLines = null;
        if (finalStream !== undefined) {
            writer = finalStream;
            for (const line of buffered) {
                finalStream.write(`${line}\n`);
            }
        }
    }

    function rotateLog() {
        if (rotationPromise !== null) {
            return;
        }
        rotationPromise = doRotate()
            .catch(err => console.error(`Log file rotation failed: ${err}`))
            .finally(() => {
                rotationPromise = null;
            });
    }

    const rotationTimer = setInterval(() => rotateLog(), LOG_ROTATION_INTERVAL_MS);
    rotationTimer.unref();

    async function close() {
        clearInterval(rotationTimer);
        // If a rotation is in progress, let it finish before we close.
        if (rotationPromise !== null) {
            await rotationPromise.catch(() => {});
        }
        await drainStream(writer).catch(err => console.error(`Failed to flush log file on close: ${err}`));
    }

    return {
        write: (formattedLog: string) => {
            if (pendingLines !== null) {
                // Rotation in progress: buffer the line; it will be flushed to the
                // final stream once the new file is open (step 8 in doRotate).
                pendingLines.push(formattedLog);
            } else if (!writer.writableEnded && !writer.destroyed) {
                writer.write(`${formattedLog}\n`);
            }
        },
        close,
    };
}
