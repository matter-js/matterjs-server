/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Bytes,
    Crypto,
    DeviceNotDiscoveredError,
    DiscoveryIncompleteError,
    FabricId,
    MockCrypto,
    NoDiscoveryTransportError,
    NodeId,
    Seconds,
    ServerNode,
    VendorId,
} from "@matter/main";
import {
    CommissioningFlowType,
    DiscoveryCapabilitiesSchema,
    ManualPairingCodeCodec,
    QrPairingCodeCodec,
} from "@matter/main/types";
import { Endpoint } from "@matter/node";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import {
    AttestationFinding,
    CommissioningError,
    CommissioningTimeoutError,
    DclCertificateService,
    DeviceAttestationCheck,
    FabricAuthority,
    PairRetransmissionLimitReachedError,
    PasscodeMismatchError,
    TestCert_PAA_NoVID_Cert,
    TestCert_PAA_NoVID_SKID,
} from "@matter/protocol";
import {
    attestationRefusalOf,
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
        const { fabricIndex } = await (
            await controller.env.load(FabricAuthority)
        ).defaultFabric({
            adminFabricLabel: "TestFabric",
            adminFabricId: FabricId(1),
            adminNodeId: NodeId(112233),
        });
        handler = new ControllerCommandHandler(
            {
                node: controller,
                fabricIndex,
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

    describe("attestation", () => {
        let trustStore: DclCertificateService | undefined;

        afterEach(async () => {
            await trustStore?.close();
            trustStore = undefined;
        });

        /** An offline trust store; `testPaa` adds the PAA the simulated device chains to. */
        async function useTrustStore(testPaa: boolean, acceptTestCertificates = false) {
            const service = new DclCertificateService(controller.env, { offline: true, acceptTestCertificates });
            trustStore = service;
            await service.construction;
            if (testPaa) {
                await service.addCertificate(TestCert_PAA_NoVID_Cert, "PAA", { isProduction: false });
            }
            controller.env.set(DclCertificateService, service);
            return service;
        }

        // The simulated device's PAI is serial 1, issued by the test PAA.
        const simulatedPaiRevocation = {
            issuerSubjectKeyId: Bytes.toHex(TestCert_PAA_NoVID_SKID),
            revokedSerialNumbers: ["01"],
        };

        // Characterization: the baseline the revocation tests below refuse from.
        it("commissions a device with a trusted test certificate", async () => {
            await useTrustStore(true, true);

            const { nodeId } = await commissioning(() => handler.commissionNode(request()));

            expect(nodeId).equals(NODE_ID);
        });

        it("refuses a device whose PAI is revoked, naming the check", async () => {
            const service = await useTrustStore(true, true);
            service.installRevocations([simulatedPaiRevocation]);

            const error = await failureOf(() => commissioning(() => handler.commissionNode(request())));

            expect([error.code, error.reason]).deep.equals([
                ServerErrorCode.NodeCommissionFailed,
                "attestation-rejected",
            ]);
            expect(error.message).equals(
                "Commission failed: Device attestation refused: CertificateRevoked: Product Attestation Intermediate certificate has been revoked",
            );
            expect(handler.isNodeIdInUse(NODE_ID)).equals(false);
        });

        it("refuses a device whose PAI is revoked under its issuer name, as the CHIP tool states it", async () => {
            const service = await useTrustStore(true, true);
            // DER of the issuer name "CN=Matter Test PAA"
            service.installRevocations([
                { ...simulatedPaiRevocation, issuerName: "MBoxGDAWBgNVBAMMD01hdHRlciBUZXN0IFBBQQ==" },
            ]);

            const error = await failureOf(() => commissioning(() => handler.commissionNode(request())));

            expect(error.message).match(/CertificateRevoked/);
        });

        it("commissions a device whose PAI is revoked only under another issuer name", async () => {
            const service = await useTrustStore(true, true);
            // DER of the issuer name "CN=Example Vendor PAI"
            service.installRevocations([
                { ...simulatedPaiRevocation, issuerName: "MB0xGzAZBgNVBAMMEkV4YW1wbGUgVmVuZG9yIFBBSQ==" },
            ]);

            const { nodeId } = await commissioning(() => handler.commissionNode(request()));

            expect(nodeId).equals(NODE_ID);
        });

        it("reports a device with a test certificate as attestation-rejected", async () => {
            await useTrustStore(true);

            const error = await failureOf(() => commissioning(() => handler.commissionNode(request())));

            expect([error.code, error.reason]).deep.equals([
                ServerErrorCode.NodeCommissionFailed,
                "attestation-rejected",
            ]);
            expect(handler.isNodeIdInUse(NODE_ID)).equals(false);
        });

        it("reports a device whose PAA is not trusted as attestation-rejected", async () => {
            await useTrustStore(false);

            const error = await failureOf(() => commissioning(() => handler.commissionNode(request())));

            expect([error.code, error.reason]).deep.equals([
                ServerErrorCode.NodeCommissionFailed,
                "attestation-rejected",
            ]);
            expect(error.message).match(/^Commission failed: Device attestation refused: PaaNotTrusted: /);
            expect(handler.isNodeIdInUse(NODE_ID)).equals(false);
        });
    });

    describe("device type filter", () => {
        // Characterization: also passes without the device type filter.
        it("commissions a device advertising the device type", async () => {
            const { passcode } = device.state.commissioning;

            const { nodeId } = await commissioning(() =>
                handler.commissionNode({ nodeId: NODE_ID, passcode, deviceType: OnOffLightDevice.deviceType }),
            );

            expect(nodeId).equals(NODE_ID);
        });

        it("passes over a device advertising another device type", async () => {
            const { passcode } = device.state.commissioning;

            const error = await failureOf(() =>
                commissioning(() =>
                    handler.commissionNode({
                        nodeId: NODE_ID,
                        passcode,
                        deviceType: OnOffLightDevice.deviceType + 1,
                        discoveryTimeout: Seconds(10),
                    }),
                ),
            );

            expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
        });
    });

    describe("vendor and product named by the pairing code", () => {
        function qrCode(vendorId: number, productId: number) {
            const { passcode, discriminator } = device.state.commissioning;
            return QrPairingCodeCodec.encode([
                {
                    version: 0,
                    vendorId,
                    productId,
                    flowType: CommissioningFlowType.Standard,
                    discoveryCapabilities: DiscoveryCapabilitiesSchema.encode({ onIpNetwork: true }),
                    discriminator,
                    passcode,
                },
            ]);
        }

        function manualCode(vendorId: VendorId, productId: number) {
            const { passcode, discriminator } = device.state.commissioning;
            return ManualPairingCodeCodec.encode({ discriminator, passcode, vendorId, productId });
        }

        // Characterization: also passes without the vendor and product check.
        it("commissions a device whose advertisement matches them", async () => {
            const { vendorId, productId } = device.state.basicInformation;

            const { nodeId } = await commissioning(() =>
                handler.commissionNode({ nodeId: NODE_ID, manualCode: manualCode(vendorId, productId) }),
            );

            expect(nodeId).equals(NODE_ID);
        });

        it("passes over a device of another vendor", async () => {
            const { vendorId, productId } = device.state.basicInformation;

            const error = await failureOf(() =>
                commissioning(() =>
                    handler.commissionNode({
                        nodeId: NODE_ID,
                        manualCode: manualCode(VendorId(vendorId + 1), productId),
                        discoveryTimeout: Seconds(10),
                    }),
                ),
            );

            expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
            expect(handler.isNodeIdInUse(NODE_ID)).equals(false);
        });

        it("passes over a device of another vendor named in a QR code", async () => {
            const { vendorId, productId } = device.state.basicInformation;

            const error = await failureOf(() =>
                commissioning(() =>
                    handler.commissionNode({
                        nodeId: NODE_ID,
                        qrCode: qrCode(vendorId + 1, productId),
                        discoveryTimeout: Seconds(10),
                    }),
                ),
            );

            expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
        });

        it("passes over a device of another product", async () => {
            const { vendorId, productId } = device.state.basicInformation;

            const error = await failureOf(() =>
                commissioning(() =>
                    handler.commissionNode({
                        nodeId: NODE_ID,
                        manualCode: manualCode(vendorId, productId + 1),
                        discoveryTimeout: Seconds(10),
                    }),
                ),
            );

            expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
        });

        it("commissions a device that matches the vendor and product named in a QR code", async () => {
            const { vendorId, productId } = device.state.basicInformation;

            const { nodeId } = await commissioning(() =>
                handler.commissionNode({ nodeId: NODE_ID, qrCode: qrCode(vendorId, productId) }),
            );

            expect(nodeId).equals(NODE_ID);
        });

        it("searches by vendor alone for a device of that vendor", async () => {
            const { passcode } = device.state.commissioning;
            const { vendorId } = device.state.basicInformation;

            const error = await failureOf(() =>
                commissioning(() =>
                    handler.commissionNode({
                        nodeId: NODE_ID,
                        passcode,
                        vendorId: VendorId(vendorId + 1),
                        discoveryTimeout: Seconds(10),
                    }),
                ),
            );

            expect([error.code, error.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "not-discovered"]);
        });

        // Characterization: also passes without the vendor filter.
        it("commissions by vendor alone, whatever product the device advertises", async () => {
            const { passcode } = device.state.commissioning;
            const { vendorId } = device.state.basicInformation;

            const { nodeId } = await commissioning(() =>
                handler.commissionNode({ nodeId: NODE_ID, passcode, vendorId }),
            );

            expect(nodeId).equals(NODE_ID);
        });
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

    it("keeps the PASE limit of the attempt at the supplied address when a discovery timeout is set", async () => {
        const startedAt = MockTime.nowMs;

        const { nodeId } = await commissioning(() =>
            handler.commissionNode({ ...request({ ip: "10.10.10.99", port: 5540 }), discoveryTimeout: Seconds(1) }),
        );

        expect(nodeId).equals(NODE_ID);
        // Bounded by the 1 s discovery timeout, the stale address would be given up almost at once.
        expect(MockTime.nowMs - startedAt).at.least(10_000);
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

    it("names a device found but not reached in time a timeout, and one never found not discovered", () => {
        expect(commissionFailureOf(new DiscoveryIncompleteError("cut off"), false).reason).equals("timeout");
        expect(commissionFailureOf(new DeviceNotDiscoveredError("none"), false).reason).equals("not-discovered");
    });

    it("names a missing discovery transport other", () => {
        expect(commissionFailureOf(new NoDiscoveryTransportError("no BLE"), false).reason).equals("other");
    });

    it("names anything else other", () => {
        expect(commissionFailureOf(new CommissioningError("network setup failed"), false).reason).equals("other");
    });
});

describe("attestationRefusalOf", () => {
    const revoked: AttestationFinding = {
        level: "error",
        type: DeviceAttestationCheck.CertificateRevoked,
        message: "Device Attestation Certificate has been revoked",
    };
    const expired: AttestationFinding = {
        level: "error",
        type: DeviceAttestationCheck.CertificateExpired,
        message: "DAC has expired",
    };
    const provisional: AttestationFinding = {
        level: "warning",
        type: DeviceAttestationCheck.CertificationTypeProvisional,
        message: "provisional",
    };
    const testCertificate: AttestationFinding = {
        level: "error",
        type: DeviceAttestationCheck.TrustedAsTestCertificate,
        message: "test PAA",
    };

    it("accepts a device with only warnings", () => {
        expect(attestationRefusalOf([provisional])).equals(undefined);
    });

    it("names an error finding with its check", () => {
        expect(attestationRefusalOf([provisional, revoked])).equals(
            "Device attestation refused: CertificateRevoked: Device Attestation Certificate has been revoked",
        );
    });

    it("names every error finding", () => {
        expect(attestationRefusalOf([revoked, expired])).equals(
            "Device attestation refused: CertificateRevoked: Device Attestation Certificate has been revoked; CertificateExpired: DAC has expired",
        );
    });

    it("gives the test certificate hint over any other error", () => {
        expect(attestationRefusalOf([revoked, testCertificate])).match(/enable the test-net DCL option/);
    });
});
