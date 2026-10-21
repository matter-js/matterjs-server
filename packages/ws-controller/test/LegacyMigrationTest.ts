/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Bytes,
    Crypto,
    Entropy,
    Environment,
    MemoryStorageDriver,
    MockStorageService,
    Network,
    NetworkSimulator,
    StorageService,
    SupportedStorageTypes,
} from "@matter/general";
import { CommissioningClient } from "@matter/main";
import { BasicInformationClient } from "@matter/main/behaviors";
import { CertificateAuthority, Fabric, FabricBuilder, Noc, PeerAddress } from "@matter/protocol";
import { FabricId, FabricIndex, NodeId, VendorId } from "@matter/types";
import { createControllerNode } from "../src/controller/ControllerNode.js";
import { LegacyServerData } from "../src/controller/LegacyDataInjector.js";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { captureLogs, LogCapture } from "./support/LogCapture.js";

const SERVER_ID = "server-1-fff1";
const LEGACY_NODE_IDS = [2, 3, 4];
const COMMISSIONED_AT = "2026-01-01T00:00:00.000Z";

/** Environments sharing one storage record, so a later start sees what an earlier one wrote. */
function createEnvironments() {
    const storage: Record<string, Record<string, SupportedStorageTypes>> = {};
    const simulator = new NetworkSimulator();
    let index = 0;

    return () => {
        const env = new Environment(`legacy-${++index}`);
        const crypto = Environment.default.get(Crypto);
        env.set(Entropy, crypto);
        env.set(Crypto, crypto);
        env.set(Network, simulator.addHost(index));
        new MockStorageService(env, () => new MemoryStorageDriver(storage));
        return env;
    };
}

async function createLegacyData(crypto: Crypto): Promise<{ data: LegacyServerData; fabric: Fabric }> {
    const ca = await CertificateAuthority.create(crypto, true);
    const builder = await FabricBuilder.create(crypto);
    await builder.setRootCert(ca.rootCert);
    builder
        .setRootNodeId(NodeId(112233))
        .setIdentityProtectionKey(crypto.randomBytes(16))
        .setRootVendorId(VendorId(0xfff1))
        .setLabel("");
    await builder.setOperationalCert(await ca.generateNoc(builder.publicKey, FabricId(1), NodeId(112233)), ca.icacCert);
    const fabric = await builder.build(FabricIndex(1));
    const { nodeId, fabricId } = Noc.fromTlv(fabric.operationalCert).cert.subject;

    const nodes = Object.fromEntries(
        LEGACY_NODE_IDS.map(nodeId => [
            nodeId.toString(),
            {
                node_id: nodeId,
                date_commissioned: COMMISSIONED_AT,
                last_interview: "2026-01-01T00:00:00.000000",
                interview_version: 6,
                available: true,
                is_bridge: false,
                attributes: { "0/40/1": "Test Vendor" },
                attribute_subscriptions: [] as const,
            },
        ]),
    );

    return {
        fabric,
        data: {
            credentials: ca.config,
            fabric: {
                fabricIndex: 1,
                fabricId,
                nodeId,
                rootNodeId: nodeId,
                rootVendorId: 0xfff1,
                rootCert: fabric.rootCert,
                rootPublicKey: fabric.rootPublicKey,
                identityProtectionKey: fabric.identityProtectionKey,
                intermediateCACert: fabric.intermediateCACert,
                operationalCert: fabric.operationalCert,
                label: "",
            },
            nodeData: { vendor_info: {}, last_node_id: 4, nodes },
            vendorId: 0xfff1,
            fabricId: 1,
        },
    };
}

async function migrate(env: Environment, legacy: LegacyServerData) {
    const config = await ConfigStorage.create(env);
    const controller = await MatterController.create(
        env,
        config,
        { serverId: SERVER_ID, dclOffline: true, disableOtaProvider: true },
        legacy,
    );
    await controller.injectCommissionedDates();
    await controller.stop();
    await config.close();
    return controller.legacyDataMigrated;
}

/** Starts and stops a controller without legacy data, so storage holds its own CA and fabric 1. */
async function startController(env: Environment) {
    const controller = await createControllerNode({
        environment: env,
        id: SERVER_ID,
        adminVendorId: VendorId(0xfff1),
        adminFabricId: FabricId(1),
        adminFabricLabel: "Home",
        serverVersion: "1.5.0",
        enableOtaProvider: false,
    });
    expect(controller.fabricIndex).equals(1);
    await controller.close();
}

/** The peers a controller node restores from storage, as matter.js sees them. */
async function readPeers(env: Environment) {
    const controller = await createControllerNode({
        environment: env,
        id: SERVER_ID,
        adminFabricLabel: "Home",
        serverVersion: "1.5.0",
        enableOtaProvider: false,
    });
    try {
        return [...controller.node.peers].map(peer => ({
            address: String(peer.peerAddress),
            vendorName: peer.maybeStateOf(BasicInformationClient)?.vendorName,
            commissionedAt: peer.maybeStateOf(CommissioningClient)?.commissionedAt,
        }));
    } finally {
        await controller.close();
    }
}

async function readState(env: Environment) {
    const storage = await env.get(StorageService).open(SERVER_ID);
    try {
        const certificates = storage.createContext("certificates");
        const caRootCert = (await certificates.has("rootCertBytes"))
            ? await certificates.get<Bytes>("rootCertBytes")
            : undefined;
        const fabrics = await storage.createContext("fabrics").get<Fabric.Config[]>("fabrics", []);
        const nodes = storage.createContext("nodes");
        const peers = new Array<string>();
        for (const peerId of await nodes.contexts()) {
            const commissioning = nodes
                .createContext(peerId)
                .createContext("endpoints")
                .createContext("0")
                .createContext("commissioning");
            if (await commissioning.has("peerAddress")) {
                peers.push(PeerAddress(await commissioning.get<PeerAddress>("peerAddress")).toString());
            }
        }
        return { caRootCert, fabricRoots: fabrics.map(({ rootCert }) => rootCert), peers: peers.sort() };
    } finally {
        await storage.close();
    }
}

/** The storage the pre-1.5.0 injector left before the controller moved its CA: the legacy fabric, but no CA. */
async function storeLegacyFabricOnly(env: Environment, legacyFabric: Fabric) {
    const storage = await env.get(StorageService).open(SERVER_ID);
    try {
        await storage.createContext("fabrics").set("fabrics", [legacyFabric.config]);
    } finally {
        await storage.close();
    }
}

async function clearCertificateAuthority(env: Environment) {
    const storage = await env.get(StorageService).open(SERVER_ID);
    try {
        await storage.createContext("certificates").clearAll();
    } finally {
        await storage.close();
    }
}

describe("Legacy migration", () => {
    let nextEnvironment: ReturnType<typeof createEnvironments>;
    let legacy: LegacyServerData;
    let legacyFabric: Fabric;
    let logs: LogCapture | undefined;

    afterEach(() => {
        logs?.stop();
        logs = undefined;
    });

    beforeEach(async () => {
        MockTime.reset();
        nextEnvironment = createEnvironments();
        ({ data: legacy, fabric: legacyFabric } = await createLegacyData(Environment.default.get(Crypto)));
    });

    function isLegacyRoot(rootCert?: Bytes) {
        return rootCert !== undefined && Bytes.areEqual(rootCert, legacyFabric.rootCert);
    }

    it("keeps the legacy CA and fabric as the only fabric across restarts", async () => {
        expect(await migrate(nextEnvironment(), legacy)).equals(true);
        expect(await migrate(nextEnvironment(), legacy)).equals(true);

        const state = await readState(nextEnvironment());
        expect(isLegacyRoot(state.caRootCert)).equals(true);
        expect(state.fabricRoots.length).equals(1);
        expect(isLegacyRoot(state.fabricRoots[0])).equals(true);
        expect(state.peers).deep.equals(["@1:2", "@1:3", "@1:4"]);
    });

    it("restores the legacy nodes with their vendor name and commissioning date", async () => {
        await migrate(nextEnvironment(), legacy);

        const peers = await readPeers(nextEnvironment());
        expect(peers).deep.equals(
            LEGACY_NODE_IDS.map(nodeId => ({
                address: `@1:${nodeId}`,
                vendorName: "Test Vendor",
                commissionedAt: new Date(COMMISSIONED_AT).getTime(),
            })),
        );
    });

    it("migrates the CA and fabric of legacy data without nodes", async () => {
        await migrate(nextEnvironment(), { ...legacy, nodeData: undefined });

        const state = await readState(nextEnvironment());
        expect(isLegacyRoot(state.caRootCert)).equals(true);
        expect(state.fabricRoots.length).equals(1);
        expect(isLegacyRoot(state.fabricRoots[0])).equals(true);
        expect(state.peers).deep.equals([]);
    });

    it("leaves storage with another controller CA untouched", async () => {
        await startController(nextEnvironment());
        const before = await readState(nextEnvironment());
        expect(before.caRootCert).not.equals(undefined);
        expect(isLegacyRoot(before.caRootCert)).equals(false);

        // A free fabric index, so the fabric check cannot be what skips the migration
        const fabric = legacy.fabric;
        expect(fabric).not.equals(undefined);
        expect(await migrate(nextEnvironment(), { ...legacy, fabric: fabric && { ...fabric, fabricIndex: 2 } })).equals(
            false,
        );

        const state = await readState(nextEnvironment());
        expect(state.caRootCert).deep.equals(before.caRootCert);
        expect(state.fabricRoots).deep.equals(before.fabricRoots);
        expect(state.peers).deep.equals([]);
    });

    it("keeps another fabric stored at the legacy fabric index", async () => {
        await startController(nextEnvironment());
        await clearCertificateAuthority(nextEnvironment());
        const before = await readState(nextEnvironment());
        expect(before.fabricRoots.length).equals(1);
        expect(isLegacyRoot(before.fabricRoots[0])).equals(false);

        expect(await migrate(nextEnvironment(), legacy)).equals(false);

        const state = await readState(nextEnvironment());
        expect(isLegacyRoot(state.caRootCert)).equals(false);
        expect(state.fabricRoots[0]).deep.equals(before.fabricRoots[0]);
        expect(state.fabricRoots.some(isLegacyRoot)).equals(false);
        expect(state.peers).deep.equals([]);
    });

    it("installs the legacy CA when storage holds the legacy fabric without it", async () => {
        await storeLegacyFabricOnly(nextEnvironment(), legacyFabric);

        expect(await migrate(nextEnvironment(), legacy)).equals(true);

        const state = await readState(nextEnvironment());
        expect(isLegacyRoot(state.caRootCert)).equals(true);
        expect(state.fabricRoots.length).equals(1);
        expect(isLegacyRoot(state.fabricRoots[0])).equals(true);
    });

    it("does not migrate legacy data whose CA does not issue the legacy fabric", async () => {
        const other = await createLegacyData(Environment.default.get(Crypto));

        expect(await migrate(nextEnvironment(), { ...legacy, credentials: other.data.credentials })).equals(false);

        const state = await readState(nextEnvironment());
        expect(isLegacyRoot(state.caRootCert)).equals(false);
        expect(state.fabricRoots.some(isLegacyRoot)).equals(false);
        expect(state.peers).deep.equals([]);
    });

    it("does not migrate legacy data without a CA", async () => {
        logs = captureLogs("MatterController", /not migrated/);

        expect(await migrate(nextEnvironment(), { ...legacy, credentials: undefined })).equals(false);

        expect(logs.lines.length).equals(1);

        const state = await readState(nextEnvironment());
        expect(state.fabricRoots.some(isLegacyRoot)).equals(false);
        expect(state.peers).deep.equals([]);
    });

    it("migrates a legacy fabric stored at fabric index 2", async () => {
        const fabric = legacy.fabric;
        expect(fabric).not.equals(undefined);

        expect(await migrate(nextEnvironment(), { ...legacy, fabric: fabric && { ...fabric, fabricIndex: 2 } })).equals(
            true,
        );

        const state = await readState(nextEnvironment());
        expect(isLegacyRoot(state.caRootCert)).equals(true);
        expect(state.fabricRoots.length).equals(1);
        expect(isLegacyRoot(state.fabricRoots[0])).equals(true);
        expect(state.peers).deep.equals(["@2:2", "@2:3", "@2:4"]);
    });

    it("keeps another fabric of the legacy CA stored at the legacy fabric index", async () => {
        const credentials = legacy.credentials;
        if (credentials === undefined) {
            expect.fail("legacy data without CA");
            return;
        }
        const crypto = Environment.default.get(Crypto);
        const ca = new CertificateAuthority(crypto, credentials);
        const builder = await FabricBuilder.create(crypto);
        await builder.setRootCert(ca.rootCert);
        builder
            .setRootNodeId(NodeId(112233))
            .setIdentityProtectionKey(crypto.randomBytes(16))
            .setRootVendorId(VendorId(0xfff1))
            .setLabel("");
        await builder.setOperationalCert(
            await ca.generateNoc(builder.publicKey, FabricId(2), NodeId(112233)),
            ca.icacCert,
        );
        await storeLegacyFabricOnly(nextEnvironment(), await builder.build(FabricIndex(1)));

        expect(await migrate(nextEnvironment(), legacy)).equals(false);

        const storage = await nextEnvironment().get(StorageService).open(SERVER_ID);
        try {
            const fabrics = await storage.createContext("fabrics").get<Fabric.Config[]>("fabrics", []);
            expect(fabrics.find(({ fabricIndex }) => fabricIndex === 1)?.fabricId).equals(FabricId(2));
        } finally {
            await storage.close();
        }
        expect((await readState(nextEnvironment())).peers).deep.equals([]);
    });

    it("starts without a warning when there is no Python Matter Server data", async () => {
        logs = captureLogs("MatterController", /not migrated/);

        expect(await migrate(nextEnvironment(), { vendorId: 0xfff1, fabricId: 1 })).equals(false);

        expect(logs.lines).deep.equals([]);
    });
});
