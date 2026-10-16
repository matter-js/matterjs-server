/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, Diagnostic, Environment, Logger, LogLevel, MockStorageService } from "@matter/main";
import { DclCertificateService } from "@matter/main/protocol";
import { NodeJsCrypto } from "@matter/nodejs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRevocationSets } from "../src/revocation-sets.js";

const SKID_A = "785CE705B86B8F4E6FC793AA60CB43EA696882D5";
const SKID_B = "AF42B7094DEBD515EC6ECF33B81115225F325288";

function revocationSet(issuerSubjectKeyId: string, ...serials: string[]) {
    return JSON.stringify([
        {
            type: "revocation_set",
            issuer_subject_key_id: issuerSubjectKeyId,
            issuer_name: "MBoxGDAWBgNVBAMMD01hdHRlciBUZXN0IFBBQQ==",
            revoked_serial_numbers: serials,
            crl_signer_cert: "MIIB",
            crl_signer_delegator: null,
        },
    ]);
}

describe("loadRevocationSets", () => {
    let dir: string;
    let env: Environment;
    let service: DclCertificateService;
    let logged: Diagnostic.Message[];
    let restoreLog: () => void;

    beforeEach(async () => {
        logged = new Array<Diagnostic.Message>();
        const destination = Logger.destinations.default;
        const add = destination.add.bind(destination);
        destination.add = message => {
            if (message.facility === "MatterServer.RevocationSets") logged.push(message);
            add(message);
        };
        restoreLog = () => (destination.add = add);

        dir = await mkdtemp(join(tmpdir(), "revocation-sets-test-"));
        env = new Environment("revocation-sets-test");
        env.set(Crypto, new NodeJsCrypto());
        new MockStorageService(env);
        service = new DclCertificateService(env, { offline: true });
    });

    afterEach(async () => {
        restoreLog();
        await service.close();
        await rm(dir, { recursive: true, force: true });
    });

    function lines(level: LogLevel) {
        return logged.filter(message => message.level === level).map(message => message.values.join(" "));
    }

    function installedSerials() {
        return Object.fromEntries(
            [...service.installedRevocations].map(([akid, entries]) => [
                akid,
                entries.flatMap(({ serials }) => [...serials]).sort(),
            ]),
        );
    }

    it("installs every set in the directory and reports the count", async () => {
        await writeFile(join(dir, "a.json"), revocationSet(SKID_A, "01", "0A"));
        await writeFile(join(dir, "b.json"), revocationSet(SKID_B, "FF"));

        expect(await loadRevocationSets(service, dir)).deep.equals({ files: 2, entries: 2 });

        expect(installedSerials()).deep.equals({ [SKID_A]: ["01", "0A"], [SKID_B]: ["FF"] });
        expect(lines(LogLevel.NOTICE)).deep.equals([`Loaded revocation sets from ${dir}: 2 files, 2 entries`]);
        expect(lines(LogLevel.ERROR)).deep.equals([]);
    });

    it("skips an invalid file with an error naming it and still installs the valid one", async () => {
        await writeFile(join(dir, "good.json"), revocationSet(SKID_A, "01"));
        await writeFile(join(dir, "broken.json"), "{ not json");
        await writeFile(join(dir, "wrong.json"), revocationSet(SKID_B, "XYZ"));

        expect(await loadRevocationSets(service, dir)).deep.equals({ files: 1, entries: 1 });

        expect(installedSerials()).deep.equals({ [SKID_A]: ["01"] });
        const errors = lines(LogLevel.ERROR);
        expect(errors).length(2);
        expect(errors[0]).match(/^Skipped revocation set broken\.json: Revocation set is not JSON: /);
        expect(errors[1]).equals(
            'Skipped revocation set wrong.json: Revocation set entry 0 states revoked_serial_numbers[0] as "XYZ", which is not an even number of hex digits',
        );
        expect(lines(LogLevel.NOTICE)).deep.equals([`Loaded revocation sets from ${dir}: 1 files, 1 entries`]);
    });

    it("skips a file the service refuses to install", async () => {
        await writeFile(join(dir, "good.json"), revocationSet(SKID_A, "01"));
        await writeFile(join(dir, "refused.json"), revocationSet(SKID_B, "02"));
        const refusing = {
            installRevocations(entries: DclCertificateService.RevocationSetEntry[]) {
                if (entries[0].issuerSubjectKeyId === SKID_B) {
                    throw new Error("refused");
                }
                service.installRevocations(entries);
            },
        };

        expect(await loadRevocationSets(refusing, dir)).deep.equals({ files: 1, entries: 1 });

        expect(lines(LogLevel.ERROR)).deep.equals(["Skipped revocation set refused.json: refused"]);
    });

    it("reads only *.json files, not subdirectories", async () => {
        await writeFile(join(dir, "set.JSON"), revocationSet(SKID_A, "01"));
        await writeFile(join(dir, "notes.txt"), "not a set");
        await mkdir(join(dir, "nested.json"));

        expect(await loadRevocationSets(service, dir)).deep.equals({ files: 1, entries: 1 });
        expect(lines(LogLevel.ERROR)).deep.equals([]);
    });

    it("reads a set through a symlink, as a mounted ConfigMap presents it", async () => {
        await mkdir(join(dir, "..data"));
        await writeFile(join(dir, "..data", "set.json"), revocationSet(SKID_A, "01"));
        await symlink(join("..data", "set.json"), join(dir, "set.json"));

        expect(await loadRevocationSets(service, dir)).deep.equals({ files: 1, entries: 1 });
    });

    it("reports a missing directory as an error and continues", async () => {
        const missing = join(dir, "missing");

        expect(await loadRevocationSets(service, missing)).deep.equals({ files: 0, entries: 0 });

        expect(lines(LogLevel.ERROR)).deep.equals([
            `Revocation sets directory ${missing} does not exist, no revocation sets installed`,
        ]);
        expect(lines(LogLevel.WARN)).deep.equals([]);
        expect(lines(LogLevel.NOTICE)).deep.equals([]);
    });

    it("warns when the directory holds no usable set", async () => {
        expect(await loadRevocationSets(service, dir)).deep.equals({ files: 0, entries: 0 });

        expect(lines(LogLevel.WARN)).deep.equals([`No revocation sets installed from ${dir}`]);
        expect(lines(LogLevel.ERROR)).deep.equals([]);
        expect(lines(LogLevel.NOTICE)).deep.equals([]);
    });

    it("reports a path that is not a readable directory as an error", async () => {
        const file = join(dir, "file.json");
        await writeFile(file, revocationSet(SKID_A, "01"));

        expect(await loadRevocationSets(service, file)).deep.equals({ files: 0, entries: 0 });

        expect(lines(LogLevel.WARN)).deep.equals([]);
        expect(lines(LogLevel.NOTICE)).deep.equals([]);
        expect(lines(LogLevel.ERROR)).length(1);
        expect(lines(LogLevel.ERROR)[0]).match(new RegExp(`^Cannot read revocation sets directory ${file}:`));
    });
});
