/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, Environment, MockStorageService } from "@matter/main";
import { DclCertificateService } from "@matter/main/protocol";
import { NodeJsCrypto } from "@matter/nodejs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importCertificates } from "../src/certificates.js";

// Self-signed P-256 PAAs generated with openssl for this test only
const PEM_A = `-----BEGIN CERTIFICATE-----
MIIBqTCCAU+gAwIBAgIJAPIRAVvwo/pTMAoGCCqGSM49BAMCMCUxIzAhBgNVBAMM
Gm1hdHRlcmpzLXNlcnZlciBUZXN0IFBBQSBhMCAXDTI2MTAxNzExMjYxOVoYDzIx
MjYwOTIzMTEyNjE5WjAlMSMwIQYDVQQDDBptYXR0ZXJqcy1zZXJ2ZXIgVGVzdCBQ
QUEgYTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHd0PXXfuiCxBOJf3X/KkQZo
fgLllR3B/mILfRAsdxmvFfqL+7tA3wKtTVK9pIReIM/wGUeXnOFyhi9yhNmIip2j
ZjBkMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYDVR0PAQH/BAQDAgEGMB0GA1UdDgQW
BBS0tratqxxRZY7iqenPNHOgH6TtIzAfBgNVHSMEGDAWgBS0tratqxxRZY7iqenP
NHOgH6TtIzAKBggqhkjOPQQDAgNIADBFAiBxFBu90p2QYOBE/1Xpx+9ysXZvCvDx
wfyiVXarbocHZwIhAIIoKyn4ykWm4N3skNGwJoTra4OsCbTY2sKNnketGlnr
-----END CERTIFICATE-----
`;
const SKID_A = "B4B6B6ADAB1C51658EE2A9E9CF3473A01FA4ED23";

const PEM_B = `-----BEGIN CERTIFICATE-----
MIIBpzCCAU6gAwIBAgIIDyBimTn42v4wCgYIKoZIzj0EAwIwJTEjMCEGA1UEAwwa
bWF0dGVyanMtc2VydmVyIFRlc3QgUEFBIGIwIBcNMjYxMDE3MTEyNjE5WhgPMjEy
NjA5MjMxMTI2MTlaMCUxIzAhBgNVBAMMGm1hdHRlcmpzLXNlcnZlciBUZXN0IFBB
QSBiMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAELMwQgJlOg2XNymnYV+Dr6/Un
xQFG5CP9JyCzSolVDh4dJI9siOXPp4pCsCntyPcwxKJMM3pxnMAObKUZnfZL6qNm
MGQwEgYDVR0TAQH/BAgwBgEB/wIBATAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYE
FIKNKWlIjD7SG+xtKMicRqCjbds3MB8GA1UdIwQYMBaAFIKNKWlIjD7SG+xtKMic
RqCjbds3MAoGCCqGSM49BAMCA0cAMEQCIAV099d/vZH+p/KOmwdWi47XP4Y8/Ten
OXzhIUAYRERoAiA6jliKToZy7c5KLr+4UAXctF5SydD4Jih/WtH0VHRylw==
-----END CERTIFICATE-----
`;
const SKID_B = "828D2969488C3ED21BEC6D28C89C46A0A36DDB37";

function der(pem: string) {
    return Buffer.from(pem.replace(/-----[A-Z ]+-----/g, ""), "base64");
}

describe("importCertificates", () => {
    let dir: string;
    let env: Environment;
    let service: DclCertificateService;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "certificates-test-"));
        env = new Environment("certificates-test");
        env.set(Crypto, new NodeJsCrypto());
        new MockStorageService(env);
        service = new DclCertificateService(env, { offline: true });
        await service.construction;
    });

    afterEach(async () => {
        await service.close();
        await rm(dir, { recursive: true, force: true });
    });

    function stored(skid: string) {
        const metadata = service.getCertificate(skid, { considerTestCertificates: true });
        return metadata === undefined ? undefined : { kind: metadata.kind, isProduction: metadata.isProduction };
    }

    it("imports a file whose name only ends in -prod as test PAA", async () => {
        await writeFile(join(dir, "vendor-prod.paa.der"), der(PEM_A));

        await importCertificates(service, dir);

        expect(stored(SKID_A)).deep.equals({ kind: "PAA", isProduction: false });
    });

    it("imports a DER file as test PAA and deletes it", async () => {
        await writeFile(join(dir, "vendor.paa.der"), der(PEM_A));

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 1,
            upgraded: 0,
            known: 0,
            failedFiles: 0,
        });

        expect(stored(SKID_A)).deep.equals({ kind: "PAA", isProduction: false });
        expect(await readdir(dir)).deep.equals([]);
    });

    it("imports every certificate of a .prod PEM file as production PAA", async () => {
        await writeFile(join(dir, "vendor.PROD.PAA.PEM"), PEM_A + PEM_B);

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 2,
            upgraded: 0,
            known: 0,
            failedFiles: 0,
        });

        expect([stored(SKID_A), stored(SKID_B)]).deep.equals([
            { kind: "PAA", isProduction: true },
            { kind: "PAA", isProduction: true },
        ]);
        expect(await readdir(dir)).deep.equals([]);
    });

    it("deletes a file whose certificate is already stored", async () => {
        await service.addCertificate(der(PEM_A), "PAA");
        await writeFile(join(dir, "vendor.paa.pem"), PEM_A);

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 1,
            failedFiles: 0,
        });

        expect(await readdir(dir)).deep.equals([]);
    });

    it("upgrades a certificate stored as test with a .prod file", async () => {
        await service.addCertificate(der(PEM_A), "PAA");
        await writeFile(join(dir, "vendor.prod.paa.der"), der(PEM_A));

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 1,
            known: 0,
            failedFiles: 0,
        });

        expect(stored(SKID_A)).deep.equals({ kind: "PAA", isProduction: true });
        expect(await readdir(dir)).deep.equals([]);
    });

    it("keeps a production certificate production when a test file names it", async () => {
        await service.addCertificate(der(PEM_A), "PAA", { isProduction: true });
        await writeFile(join(dir, "vendor.paa.der"), der(PEM_A));

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 1,
            failedFiles: 0,
        });

        expect(stored(SKID_A)).deep.equals({ kind: "PAA", isProduction: true });
    });

    it("stores nothing from a PEM file whose second certificate is invalid", async () => {
        await writeFile(
            join(dir, "mixed.paa.pem"),
            `${PEM_A}-----BEGIN CERTIFICATE-----\nMAMCAQE=\n-----END CERTIFICATE-----\n`,
        );

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 0,
            failedFiles: 1,
        });

        expect(stored(SKID_A)).equals(undefined);
        expect(await readdir(dir)).deep.equals(["mixed.paa.pem"]);
    });

    it("keeps a PEM file with a block it cannot read next to a valid one", async () => {
        await writeFile(join(dir, "header.paa.pem"), PEM_B + PEM_A.replace("-----\n", "-----\nComment: a-b\n"));

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 0,
            failedFiles: 1,
        });

        expect(await readdir(dir)).deep.equals(["header.paa.pem"]);
    });

    it("keeps a PEM file that also holds a private key", async () => {
        await writeFile(
            join(dir, "with-key.paa.pem"),
            `${PEM_A}-----BEGIN PRIVATE KEY-----\nMAMCAQE=\n-----END PRIVATE KEY-----\n`,
        );

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 0,
            failedFiles: 1,
        });

        expect(await readdir(dir)).deep.equals(["with-key.paa.pem"]);
    });

    it("keeps a file that holds no valid certificate", async () => {
        await writeFile(join(dir, "broken.paa.der"), Buffer.from("3003020101", "hex"));
        await writeFile(join(dir, "empty.paa.pem"), "no certificate here");

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 0,
            failedFiles: 2,
        });

        expect(service.certificates).deep.equals([]);
        expect((await readdir(dir)).sort()).deep.equals(["broken.paa.der", "empty.paa.pem"]);
    });

    it("leaves files without the .paa.der or .paa.pem suffix untouched", async () => {
        await writeFile(join(dir, "vendor.der"), der(PEM_A));
        await writeFile(join(dir, "vendor.paa.prod.der"), der(PEM_A));
        await writeFile(join(dir, "vendor.pem"), PEM_A);

        expect(await importCertificates(service, dir)).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 0,
            failedFiles: 0,
        });

        expect(service.certificates).deep.equals([]);
        expect((await readdir(dir)).sort()).deep.equals(["vendor.der", "vendor.paa.prod.der", "vendor.pem"]);
    });

    it("imports nothing from a missing directory", async () => {
        expect(await importCertificates(service, join(dir, "missing"))).deep.equals({
            imported: 0,
            upgraded: 0,
            known: 0,
            failedFiles: 0,
        });
    });
});
