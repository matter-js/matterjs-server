/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter-server/ws-controller";
import { Bytes } from "@matter/main";
import { DclCertificateService, Paa } from "@matter/main/protocol";
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const logger = Logger.get("MatterServer.Certificates");

const PAA_FILE = /^.+?(?<production>\.prod)?\.paa\.(?<format>der|pem)$/i;
const PEM_BEGIN = "-----BEGIN ";
const PEM_CERTIFICATE = /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----/g;

export type PaaTrustStore = Pick<DclCertificateService, "addCertificate" | "getCertificate" | "deleteCertificate">;

/**
 * Import the PAA root certificates in a directory into the persisted trust store.
 *
 * Only files named `<name>.paa.der` (one DER certificate) or `<name>.paa.pem` (one or more PEM certificates) are read;
 * other files stay untouched. A certificate is stored as production when the name is `<name>.prod.paa.der` or
 * `<name>.prod.paa.pem`, otherwise as test.
 * A production file turns a certificate stored as test into production; a test file never changes a stored certificate.
 * A file is deleted once each of its certificates is stored. A file that cannot be read or holds an invalid certificate
 * or PEM block is logged as an error and kept, and none of its certificates is stored.
 *
 * @param store a trust store that has finished its construction
 */
export async function importCertificates(store: PaaTrustStore, directory: string) {
    const result = { imported: 0, upgraded: 0, known: 0, failedFiles: 0 };

    let names: string[];
    try {
        names = (await readdir(directory)).sort();
    } catch (error) {
        if (isErrnoCode(error, "ENOENT")) {
            logger.warn(`Certificates directory ${directory} does not exist, no certificates imported`);
        } else {
            logger.error(`Cannot read certificates directory ${directory}:`, error);
        }
        return result;
    }

    for (const name of names) {
        const path = join(directory, name);
        const match = PAA_FILE.exec(name);
        if (match?.groups === undefined) {
            logger[name.startsWith(".") ? "debug" : "info"](
                `Ignoring ${name} in the certificates directory: name does not end in .paa.der or .paa.pem`,
            );
            continue;
        }
        const isProduction = match.groups.production !== undefined;

        let index = 0;
        try {
            // Follows symlinks, which is how ConfigMap and Secret mounts present their files
            if (!(await stat(path)).isFile()) {
                logger.debug(`Ignoring ${name} in the certificates directory: not a file`);
                continue;
            }
            const content = await readFile(path);
            const certificates = match.groups.format.toLowerCase() === "pem" ? pemCertificates(content) : [content];

            // Parse every certificate first, so an invalid one leaves the whole file unstored
            for (const [position, der] of certificates.entries()) {
                index = position + 1;
                Paa.fromAsn1(der);
            }
            for (const [position, der] of certificates.entries()) {
                index = position + 1;
                const outcome = await storePaa(store, der, isProduction);
                result[outcome]++;
                const action = {
                    imported: `imported as ${isProduction ? "production" : "test"}`,
                    upgraded: "upgraded to production",
                    known: "already stored",
                }[outcome];
                logger.info(`${name}: PAA certificate ${index} of ${certificates.length} ${action}`);
            }
        } catch (error) {
            result.failedFiles++;
            const position = index > 0 ? ` at certificate ${index}` : "";
            logger.error(
                `Failed to import PAA certificate file ${name}${position}, file kept: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
        }

        try {
            await unlink(path);
        } catch (error) {
            logger.warn(`Cannot delete imported certificate file ${name}:`, error);
        }
    }

    if (result.imported + result.upgraded + result.known + result.failedFiles > 0) {
        logger.notice(
            `Certificates from ${directory}: ${result.imported} imported, ${result.upgraded} upgraded to production, ${result.known} already stored, ${result.failedFiles} files failed`,
        );
    }
    return result;
}

async function storePaa(store: PaaTrustStore, der: Bytes, isProduction: boolean) {
    if (await store.addCertificate(der, "PAA", { isProduction })) {
        return "imported";
    }
    const { subjectKeyIdentifier } = Paa.fromAsn1(der).cert.extensions;
    if (!isProduction || store.getCertificate(subjectKeyIdentifier, { considerTestCertificates: true })?.isProduction) {
        return "known";
    }
    await store.deleteCertificate(subjectKeyIdentifier);
    await store.addCertificate(der, "PAA", { isProduction });
    return "upgraded";
}

function pemCertificates(content: Bytes) {
    const text = Bytes.toString(content);
    const certificates = [...text.matchAll(PEM_CERTIFICATE)].map(([, base64]) =>
        Bytes.fromBase64(base64.replace(/\s/g, "")),
    );
    if (certificates.length === 0 || certificates.length !== text.split(PEM_BEGIN).length - 1) {
        throw new Error("not a PEM file of only CERTIFICATE blocks");
    }
    return certificates;
}

function isErrnoCode(error: unknown, code: string) {
    return error instanceof Error && "code" in error && error.code === code;
}
