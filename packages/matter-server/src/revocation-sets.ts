/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter-server/ws-controller";
import { DclCertificateService } from "@matter/main/protocol";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const logger = Logger.get("MatterServer.RevocationSets");

export interface RevocationInstaller {
    installRevocations(entries: DclCertificateService.RevocationSetEntry[]): void;
}

/**
 * Install every revocation set (`*.json`, as CHIP's `generate_revocation_set.py` writes it) in a directory.
 *
 * A file that cannot be read or does not hold a valid set is logged as an error and skipped, so one bad file
 * neither stops the server nor keeps the other sets out. The files stay in place: the install is in memory
 * and has to be repeated on every start.
 */
export async function loadRevocationSets(target: RevocationInstaller, directory: string) {
    let files = 0;
    let entries = 0;

    let names: string[];
    let readable = true;
    try {
        names = (await readdir(directory)).filter(name => name.toLowerCase().endsWith(".json")).sort();
    } catch (error) {
        if (isErrnoCode(error, "ENOENT")) {
            logger.error(`Revocation sets directory ${directory} does not exist, no revocation sets installed`);
        } else {
            logger.error(`Cannot read revocation sets directory ${directory}:`, error);
        }
        names = [];
        readable = false;
    }

    for (const name of names) {
        const path = join(directory, name);
        try {
            // Follows symlinks, which is how ConfigMap and Secret mounts present their files
            if (!(await stat(path)).isFile()) {
                logger.debug(`Ignoring ${name} in the revocation sets directory: not a file`);
                continue;
            }
            const set = DclCertificateService.parseRevocationSet(await readFile(path, "utf8"));
            target.installRevocations(set);
            files++;
            entries += set.length;
        } catch (error) {
            logger.error(`Skipped revocation set ${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (files > 0) {
        logger.notice(`Loaded revocation sets from ${directory}: ${files} files, ${entries} entries`);
    } else if (readable) {
        logger.warn(`No revocation sets installed from ${directory}`);
    }
    return { files, entries };
}

function isErrnoCode(error: unknown, code: string) {
    return error instanceof Error && "code" in error && error.code === code;
}
