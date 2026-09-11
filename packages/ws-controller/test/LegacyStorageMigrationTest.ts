/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Crypto,
    Entropy,
    Environment,
    MockCrypto,
    MockStorageService,
    Network,
    NetworkSimulator,
    StorageService,
    SupportedStorageTypes,
} from "@matter/general";
import { FabricId, VendorId } from "@matter/main/types";
import { createControllerNode } from "../src/controller/MatterController.js";

const SERVER_ID = "server";

/** Contexts the current layout keeps fabric and certificate authority material in. */
const CERTIFICATE_KEYS = ["rootCertId", "rootKeyIdentifier", "rootCertBytes", "nextCertificateId", "rootKeyPair"];

function testEnvironment() {
    const env = new Environment("test");
    const crypto = MockCrypto(1);
    env.set(Entropy, crypto);
    env.set(Crypto, crypto);
    env.set(Network, new NetworkSimulator().addHost(1));
    new MockStorageService(env);
    return env;
}

async function createNode(env: Environment) {
    return createControllerNode({
        environment: env,
        id: SERVER_ID,
        adminVendorId: VendorId(0xfff1),
        adminFabricId: FabricId(1),
        adminFabricLabel: "test-fabric",
        serverVersion: "1.0.0",
        enableOtaProvider: false,
    });
}

/**
 * Rewrite a current-layout store into the pre-0.16 one: fabric and certificate authority material both
 * lived under `credentials` before 0.16, with the fabric itself under the `fabric` key. Derived from real
 * material rather than synthesised, so the fabric that comes back out is one the controller can load.
 */
async function demoteStoreToLegacyLayout(env: Environment) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        const fabrics = mgr.createContext("fabrics");
        const certificates = mgr.createContext("certificates");
        const credentials = mgr.createContext("credentials");

        const stored = await fabrics.get<SupportedStorageTypes[]>("fabrics", []);
        expect(stored.length).equals(1);
        await credentials.set("fabric", stored[0]);
        await fabrics.delete("fabrics");

        for (const key of CERTIFICATE_KEYS) {
            if (await certificates.has(key)) {
                await credentials.set(key, await certificates.get<SupportedStorageTypes>(key));
                await certificates.delete(key);
            }
        }
    } finally {
        await mgr.close();
    }
}

/** Puts the fabric back where the injector leaves it, with the authority still under `credentials`. */
async function restoreFabricsOnly(env: Environment) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        const credentials = mgr.createContext("credentials");
        const fabric = await credentials.get<SupportedStorageTypes>("fabric");
        await mgr.createContext("fabrics").set("fabrics", [fabric]);
    } finally {
        await mgr.close();
    }
}

async function legacyKeysPresent(env: Environment) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        return (await mgr.createContext("credentials").keys()).length;
    } finally {
        await mgr.close();
    }
}

async function storedFabricCount(env: Environment) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        return (await mgr.createContext("fabrics").get<SupportedStorageTypes[]>("fabrics", [])).length;
    } finally {
        await mgr.close();
    }
}

describe("legacy storage migration on controller construction", () => {
    let env: Environment;

    beforeEach(() => {
        MockTime.reset();
        env = testEnvironment();
    });

    it("adopts a fabric left in the pre-0.16 layout instead of creating a new one", async () => {
        // Without the migration the controller silently starts a brand new fabric and every device
        // commissioned by the old install becomes unreachable.
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        const originalFabricIndex = first.fabric.fabricIndex;
        await first.node.close();

        await demoteStoreToLegacyLayout(env);

        const second = await createNode(env);
        try {
            expect(second.fabric.fabricIndex).equals(originalFabricIndex);
            expect(second.fabric.rootCert).deep.equals(originalRootCert);
        } finally {
            await second.node.close();
        }
    });

    // LegacyDataInjector (the python-matter-server import path) writes the certificate authority under
    // `credentials` but the fabric straight into `fabrics`. Gating the authority's relocation on the
    // fabric still needing to move would skip it, and matter.js would then mint a root that does not
    // control the imported fabric.
    it("relocates certificate authority material even when the fabric is already in the current layout", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();

        await demoteStoreToLegacyLayout(env);
        await restoreFabricsOnly(env);

        const second = await createNode(env);
        try {
            expect(second.fabric.rootCert).deep.equals(originalRootCert);
            expect(await storedFabricCount(env)).equals(1);
        } finally {
            await second.node.close();
        }
    });

    it("leaves a store that was never legacy untouched", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();

        const second = await createNode(env);
        try {
            expect(second.fabric.rootCert).deep.equals(originalRootCert);
            expect(await storedFabricCount(env)).equals(1);
        } finally {
            await second.node.close();
        }
    });

    it("tolerates a repeated start after migrating, so an interrupted run resumes", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();

        await demoteStoreToLegacyLayout(env);

        // Legacy data is left in place deliberately, so the next start sees it again and must not
        // duplicate or re-migrate it into a second fabric.
        const second = await createNode(env);
        await second.node.close();

        const third = await createNode(env);
        try {
            expect(third.fabric.rootCert).deep.equals(originalRootCert);
            expect(await storedFabricCount(env)).equals(1);
        } finally {
            await third.node.close();
        }
    });

    // The source is kept: the python-matter-server importer recognises an already-imported node by
    // markers stored alongside it, and re-reads its files on every start.
    it("keeps the legacy source after migrating", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();

        await demoteStoreToLegacyLayout(env);
        expect(await legacyKeysPresent(env)).greaterThan(0);

        const second = await createNode(env);
        try {
            expect(await legacyKeysPresent(env)).greaterThan(0);
            expect(second.fabric.rootCert).deep.equals(originalRootCert);
        } finally {
            await second.node.close();
        }

        const third = await createNode(env);
        try {
            expect(third.fabric.rootCert).deep.equals(originalRootCert);
        } finally {
            await third.node.close();
        }
    });
});
