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
    Timestamp,
} from "@matter/general";
import { CommissioningClient } from "@matter/main";
import { FabricId, NodeId, VendorId } from "@matter/main/types";
import { ServerNode, ServerNodeStore } from "@matter/node";
import { CertificateAuthority, PeerAddress } from "@matter/protocol";
import { createControllerNode } from "../src/controller/ControllerNode.js";
import { cleanupLegacyStorage, migrateLegacyCommissionedNodes } from "../src/controller/legacyStorageMigration.js";

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

async function createNode(env: Environment, migrateLegacyStorage = true) {
    return createControllerNode({
        environment: env,
        id: SERVER_ID,
        adminVendorId: VendorId(0xfff1),
        adminFabricId: FabricId(1),
        adminFabricLabel: "test-fabric",
        serverVersion: "1.0.0",
        enableOtaProvider: false,
        migrateLegacyStorage,
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

/** The authority a failed python-matter-server migration left under `credentials` next to the one in use. */
async function storeCredentialsAuthority(env: Environment, config: CertificateAuthority.Configuration) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        await mgr.createContext("credentials").set(config);
    } finally {
        await mgr.close();
    }
}

async function storedCertificateKeys(env: Environment) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        return await mgr.createContext("certificates").keys();
    } finally {
        await mgr.close();
    }
}

async function legacyNodeListLength(env: Environment) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        return (await mgr.createContext("nodes").get<SupportedStorageTypes[]>("commissionedNodes", [])).length;
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

/** Descriptor cluster on endpoint 0, as a pre-0.16 store recorded it. */
const LEGACY_ENDPOINT = "0";
const LEGACY_CLUSTER = "29";
const LEGACY_ATTRIBUTE = "1";

/** Write a commissioned node the way python-matter-server's import left it. */
async function seedLegacyPeer(env: Environment, nodeId: number, attributeValue: SupportedStorageTypes) {
    const mgr = await env.get(StorageService).open(SERVER_ID);
    try {
        const nodes = mgr.createContext("nodes");
        const commissioned = await nodes.get<SupportedStorageTypes[]>("commissionedNodes", []);
        commissioned.push([
            nodeId,
            {
                operationalServerAddress: { type: "udp", ip: "10.10.10.5", port: 5540 },
                discoveryData: { deviceIdentifier: `000000000000000${nodeId}` },
            },
        ]);
        await nodes.set("commissionedNodes", commissioned);

        const cluster = mgr
            .createContext(`node-${nodeId}`)
            .createContext(LEGACY_ENDPOINT)
            .createContext(LEGACY_CLUSTER);
        await cluster.set("__version__", 1);
        await cluster.set(LEGACY_ATTRIBUTE, { value: attributeValue } as unknown as SupportedStorageTypes);
    } finally {
        await mgr.close();
    }
}

/** The value the migration copied into the peer's own store, or undefined when it never arrived. */
async function migratedAttribute(node: ServerNode, peerId: string) {
    const cluster = node.env
        .get(ServerNodeStore)
        .storage.createContext("nodes")
        .createContext(peerId)
        .createContext("endpoints")
        .createContext(LEGACY_ENDPOINT)
        .createContext(LEGACY_CLUSTER);
    return (await cluster.has(LEGACY_ATTRIBUTE))
        ? await cluster.get<SupportedStorageTypes>(LEGACY_ATTRIBUTE)
        : undefined;
}

/** Removes the stored fabric list through the node's own storage, which stays open while it runs. */
async function dropStoredFabrics(node: ServerNode) {
    await node.env.get(ServerNodeStore).storage.createContext("fabrics").delete("fabrics");
}

describe("legacy storage migration on controller construction", () => {
    let env: Environment;

    beforeEach(() => {
        MockTime.reset();
        env = testEnvironment();
    });

    it("adopts a fabric left in the pre-0.16 layout instead of creating a new one", async () => {
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

    // Older LegacyDataInjector versions wrote the certificate authority under `credentials` but the fabric
    // straight into `fabrics`.
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

    it("keeps a certificate authority already in place when another one is left under credentials", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();
        await storeCredentialsAuthority(env, (await CertificateAuthority.create(env.get(Crypto), true)).config);

        const second = await createNode(env);
        try {
            expect(second.fabric.rootCert).deep.equals(originalRootCert);
            expect(await storedCertificateKeys(env)).not.include("icacCertBytes");
            expect(await legacyKeysPresent(env)).greaterThan(0);
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

    it("removes the legacy data once it is migrated", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();
        await demoteStoreToLegacyLayout(env);
        expect(await legacyKeysPresent(env)).greaterThan(0);

        const second = await createNode(env);
        await second.node.close();
        expect(await legacyKeysPresent(env)).equals(0);

        const third = await createNode(env);
        try {
            expect(third.fabric.rootCert).deep.equals(originalRootCert);
            expect(await storedFabricCount(env)).equals(1);
        } finally {
            await third.node.close();
        }
    });

    it("leaves the store alone when the migration is off", async () => {
        const first = await createNode(env);
        const originalRootCert = first.fabric.rootCert;
        await first.node.close();
        await demoteStoreToLegacyLayout(env);

        const second = await createNode(env, false);
        try {
            expect(second.fabric.rootCert).not.deep.equals(originalRootCert);
            expect(await legacyKeysPresent(env)).greaterThan(0);
        } finally {
            await second.node.close();
        }
    });
});

describe("migrateLegacyCommissionedNodes", () => {
    let env: Environment;

    beforeEach(() => {
        MockTime.reset();
        env = testEnvironment();
    });

    function peerOf(controller: Awaited<ReturnType<typeof createNode>>, nodeId: bigint) {
        return controller.node.peers.get(
            PeerAddress({ fabricIndex: controller.fabric.fabricIndex, nodeId: NodeId(nodeId) }),
        );
    }

    it("brings a commissioned node and its attributes across", async () => {
        const first = await createNode(env);
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);

        const controller = await createNode(env);
        try {
            const peer = peerOf(controller, 5n);
            if (peer === undefined) {
                expect.fail("node 5 was not migrated");
                return;
            }
            expect(await migratedAttribute(controller.node, peer.id)).equals(42);
        } finally {
            await controller.node.close();
        }
    });

    it("migrates nothing once the store holds peers", async () => {
        const first = await createNode(env);
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);

        const controller = await createNode(env);
        try {
            expect(await migrateLegacyCommissionedNodes(controller.node)).deep.equals({
                nodes: 0,
                endpoints: 0,
                failed: 0,
            });
            expect(controller.node.peers.commissioned.length).equals(1);
        } finally {
            await controller.node.close();
        }
    });

    it("does not bring back a removed peer from a legacy list next to existing peers", async () => {
        const first = await createNode(env);
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);
        await seedLegacyPeer(env, 6, 43);

        const second = await createNode(env);
        await peerOf(second, 5n)?.delete();
        await second.node.close();
        await seedLegacyPeer(env, 5, 42);

        const third = await createNode(env);
        try {
            expect(peerOf(third, 5n)).undefined;
            expect(peerOf(third, 6n)).not.undefined;
        } finally {
            await third.node.close();
        }
    });

    it("does not migrate legacy nodes that belong to another controller CA", async () => {
        const first = await createNode(env);
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);
        await storeCredentialsAuthority(env, (await CertificateAuthority.create(env.get(Crypto), true)).config);

        const controller = await createNode(env);
        try {
            expect(peerOf(controller, 5n)).undefined;
            expect(await legacyNodeListLength(env)).equals(1);
        } finally {
            await controller.node.close();
        }
    });

    it("keeps legacy node data of another controller CA even when a peer has the same node ID", async () => {
        const first = await createNode(env, false);
        const peer = await first.node.peers.forAddress(first.fabric.addressOf(NodeId(5n)));
        await peer.setStateOf(CommissioningClient, { commissionedAt: Timestamp(1) });
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);
        await storeCredentialsAuthority(env, (await CertificateAuthority.create(env.get(Crypto), true)).config);

        const controller = await createNode(env);
        try {
            expect(await legacyNodeListLength(env)).equals(1);
        } finally {
            await controller.node.close();
        }
    });

    it("keeps the legacy data of nodes that have no peer", async () => {
        const first = await createNode(env);
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);

        const controller = await createNode(env, false);
        try {
            await cleanupLegacyStorage(controller.node);
            expect(await legacyNodeListLength(env)).equals(1);
        } finally {
            await controller.node.close();
        }
    });

    it("reports every peer as failed when the store has no single fabric to attach them to", async () => {
        const first = await createNode(env);
        await first.node.close();
        await seedLegacyPeer(env, 5, 42);
        await seedLegacyPeer(env, 6, 43);

        const controller = await createNode(env, false);
        try {
            await dropStoredFabrics(controller.node);

            expect(await migrateLegacyCommissionedNodes(controller.node)).deep.equals({
                nodes: 0,
                endpoints: 0,
                failed: 2,
            });
        } finally {
            await controller.node.close();
        }
    });
});
