/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { closeSync, createWriteStream, openSync, renameSync, unlinkSync, type WriteStream } from "node:fs";
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

    /** Open a write stream at filePath and wait until it is ready. */
    function openLogStream(filePath: string, flags = "a"): Promise<{ stream: WriteStream; fd: number }> {
        return new Promise<{ stream: WriteStream; fd: number }>((resolve, reject) => {
            const stream = createWriteStream(filePath, { flags });
            stream.once("open", (fd: number) => resolve({ stream, fd }));
            stream.once("error", reject);
        });
    }

    /** Drain (end) a stream and resolve when flushed. */
    function drainStream(stream: WriteStream): Promise<void> {
        return new Promise<void>((resolve, reject) =>
            stream.end((err?: Error | null) => (err ? reject(err) : resolve())),
        );
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

    // Track in-progress rotation so close() can wait for it to finish.
    let rotationPromise: Promise<void> | null = null;

    async function doRotate() {
        const tempPath = `${logPath}${LOG_TEMP_SUFFIX}`;

        // 1. Open the temp file with "w" (truncate) — ensures any stale .new file from
        //    a previously crashed rotation is discarded rather than appended to.
        let tempStream: WriteStream;
        let tempFd: number;
        try {
            ({ stream: tempStream, fd: tempFd } = await openLogStream(tempPath, "w"));
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

        // 5. Brief sync block — no await here, so the event loop cannot yield and
        //    no write() call can be interleaved between these three operations:
        //      a) close the temp stream fd  (required on Windows before rename)
        //      b) rename .new → logPath     (atomic filesystem rename)
        //      c) reopen logPath            (new fd; tempStream fd is now invalid)
        //    After (c), the new writer is swapped in synchronously, so there is
        //    no window where write() could hit a closed or non-existent stream.
        try {
            tempStream.removeAllListeners("error");
            // Absorb any EBADF error from in-flight libuv fs.write() callbacks that
            // complete after closeSync below — without this, no-listener throws crashes.
            tempStream.on("error", () => {});
            closeSync(tempFd);
            renameSync(tempPath, logPath);
            const finalFd = openSync(logPath, "a");
            // createWriteStream with an existing fd is synchronously usable — no 'open'
            // event needed. autoClose:true means stream.end() will close finalFd.
            const finalStream = createWriteStream(logPath, { fd: finalFd });
            finalStream.on("error", err => console.error(`Log file write error: ${err}`));
            writer = finalStream; // sync swap — no writes lost
        } catch (err) {
            console.error(`Failed to finalize log file rotation: ${err}`);
            // Destroy the stream: its fd is already closed by closeSync() above, so any
            // further write() call would produce EBADF with no error listener and crash.
            // Setting destroyed=true lets the write() guard below silently drop writes.
            writer.destroy();
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
            // writableEnded: set by close(); destroyed: set on error-path destroy().
            // Both guard against writing to a stream that can no longer accept data.
            if (!writer.writableEnded && !writer.destroyed) {
                writer.write(`${formattedLog}\n`);
            }
        },
        close,
    };
}
