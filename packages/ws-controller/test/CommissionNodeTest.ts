/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, FabricId, MockCrypto, NodeId, Seconds, ServerNode } from "@matter/main";
import { Endpoint } from "@matter/node";
import {
    CommissioningError,
    CommissioningTimeoutError,
    FabricAuthority,
    PairRetransmissionLimitReachedError,
    PasscodeMismatchError,
} from "@matter/protocol";
import {
    CameraControllerEndpoint,
    commissionFailureOf,
    ControllerCommandHandler,
} from "../src/controller/ControllerCommandHandler.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { TestSite } from "./support/ControllerSite.js";

const NODE_ID = NodeId(42n);

describe("commissionNode", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let handler: ControllerCommandHandler;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device } = await site.startPair());

        // The controller has no fabric until something creates one; production does this in
        // createControllerNode, before the command handler exists.
        const fabric = await (
            await controller.env.load(FabricAuthority)
        ).defaultFabric({
            adminFabricLabel: "TestFabric",
            adminFabricId: FabricId(1),
            adminNodeId: NodeId(112233),
        });
        handler = new ControllerCommandHandler(
            {
                node: controller,
                fabric,
                otaProvider: undefined,
                webRtcRequestor: await controller.add(
                    new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }),
                ),
            },
            { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
        );
        await MockTime.resolve(handler.start(), { macrotasks: true });
    });

    afterEach(async () => {
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await site.close();
    });

    /** Session ids collide without entropy while pairing. */
    async function commissioning<T>(act: () => Promise<T>) {
        const controllerCrypto = controller.env.get(Crypto) as MockCrypto;
        const deviceCrypto = device.env.get(Crypto) as MockCrypto;
        controllerCrypto.entropic = deviceCrypto.entropic = true;
        try {
            return await MockTime.resolve(act(), { macrotasks: true });
        } finally {
            controllerCrypto.entropic = deviceCrypto.entropic = false;
        }
    }

    async function failureOf(act: () => Promise<unknown>): Promise<ServerError> {
        try {
            await act();
        } catch (error) {
            if (error instanceof ServerError) {
                return error;
            }
            throw error;
        }
        throw new Error("Expected the command to fail");
    }

    function request(knownAddress?: { ip: string; port: number }) {
        const { passcode, discriminator } = device.state.commissioning;
        return { nodeId: NODE_ID, passcode, longDiscriminator: discriminator, knownAddress };
    }

    it("commissions a device found by discovery", async () => {
        const { nodeId } = await commissioning(() => handler.commissionNode(request()));

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });

    it("commissions a device at the address the caller supplied", async () => {
        // A discriminator no advertisement carries, so only the supplied address can reach this device:
        // falling back to discovery would find nothing.
        const { passcode } = device.state.commissioning;
        const port = device.state.network.operationalPort;
        const { nodeId } = await commissioning(() =>
            handler.commissionNode({
                nodeId: NODE_ID,
                passcode,
                longDiscriminator: 0xfff,
                knownAddress: { ip: "10.10.10.2", port },
            }),
        );

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });

    it("reports every device that advertised, not just one", async () => {
        const second = await site.addDevice("device2");

        const discovered = await MockTime.resolve(handler.handleDiscovery({}), { macrotasks: true });

        const discriminators = discovered.map(({ longDiscriminator }) => longDiscriminator).sort();
        expect(discriminators).deep.equals(
            [device.state.commissioning.discriminator, second.state.commissioning.discriminator].sort(),
        );
    });

    it("reports a wrong pairing code as such", async () => {
        const { passcode, discriminator } = device.state.commissioning;
        const port = device.state.network.operationalPort;

        const error = await failureOf(() =>
            commissioning(() =>
                handler.commissionNode({
                    nodeId: NODE_ID,
                    passcode: passcode + 1,
                    longDiscriminator: discriminator,
                    knownAddress: { ip: "10.10.10.2", port },
                }),
            ),
        );

        expect(error.message).match(/pairing code does not match/);
        expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "passcode-mismatch"]);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(false);
    });

    it("reports a device that is not found as not discovered", async () => {
        const { passcode } = device.state.commissioning;

        const error = await failureOf(() =>
            commissioning(() => handler.commissionNode({ nodeId: NODE_ID, passcode, longDiscriminator: 0xfff })),
        );

        expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
    });

    it("gives up the search after the requested discovery timeout", async () => {
        const { passcode } = device.state.commissioning;
        const startedAt = MockTime.nowMs;

        const error = await failureOf(() =>
            commissioning(() =>
                handler.commissionNode({
                    nodeId: NODE_ID,
                    passcode,
                    longDiscriminator: 0xfff,
                    discoveryTimeout: Seconds(10),
                }),
            ),
        );

        expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
        // matter.js searches 3 minutes by default.
        expect(MockTime.nowMs - startedAt).within(10_000, 60_000);
    });

    for (const request of [{ manualCode: "12345" }, { qrCode: "MT:not-a-code" }]) {
        it(`reports a ${Object.keys(request)[0]} that does not decode as an invalid payload`, async () => {
            const error = await failureOf(() => handler.commissionNode({ nodeId: NODE_ID, ...request }));

            expect([error.code, error.reason]).deep.equals([ServerErrorCode.InvalidArguments, "invalid-payload"]);
            expect(error.message).match(/^Invalid pairing code: /);
        });
    }

    it("falls back to discovery without a caller-chosen node id", async () => {
        // The node id is the server's to allocate, but a library caller may omit it. Nothing about the
        // fallback depends on it: whether the device joined is the peer's own answer.
        const { passcode, discriminator } = device.state.commissioning;
        const { nodeId } = await commissioning(() =>
            handler.commissionNode({
                passcode,
                longDiscriminator: discriminator,
                knownAddress: { ip: "10.10.10.99", port: 5540 },
            }),
        );

        expect(handler.isNodeIdInUse(nodeId)).equals(true);
    });

    it("falls back to discovery when the supplied address is stale", async () => {
        const { nodeId } = await commissioning(() =>
            handler.commissionNode(request({ ip: "10.10.10.99", port: 5540 })),
        );

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });
});

describe("commissionFailureOf", () => {
    it("names a timeout anywhere in the cause chain", () => {
        const timeout = new CommissioningError("PASE failed", { cause: new PairRetransmissionLimitReachedError() });
        expect(commissionFailureOf(timeout, false).reason).equals("timeout");
        expect(commissionFailureOf(new CommissioningTimeoutError("too long"), false).reason).equals("timeout");
    });

    it("names an attestation rejection before any other cause", () => {
        const rejected = new CommissioningError("rejected", { cause: new PasscodeMismatchError() });
        expect(commissionFailureOf(rejected, true).reason).equals("attestation-rejected");
    });

    it("names anything else other", () => {
        expect(commissionFailureOf(new CommissioningError("network setup failed"), false).reason).equals("other");
    });
});
