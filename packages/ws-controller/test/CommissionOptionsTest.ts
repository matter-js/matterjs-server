/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildCommissionOptions } from "@matter-server/ws-controller";
import { NodeId } from "@matter/main";
import { CommissioningFlowType, ManualPairingCodeCodec, QrPairingCodeCodec, VendorId } from "@matter/main/types";
import { CommissioningRequest } from "../src/types/CommandHandler.js";

/** Helper to extract identifierData from a discovery options union type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getIdentifierData(discovery: any): unknown {
    return discovery.identifierData;
}

/** Encode a single-device QR code for testing. */
function encodeQrCode(discriminator: number, passcode: number): string {
    return QrPairingCodeCodec.encode([
        {
            version: 0,
            vendorId: VendorId(0xfff1),
            productId: 0x8000,
            flowType: CommissioningFlowType.Standard,
            discoveryCapabilities: 2, // On IP network
            discriminator,
            passcode,
        },
    ]);
}

/** Encode a multi-device QR code with *-separated payloads per Matter spec Section 5.1.3. */
function encodeMultiDeviceQrCode(devices: { discriminator: number; passcode: number }[]): string {
    return QrPairingCodeCodec.encode(
        devices.map(d => ({
            version: 0,
            vendorId: VendorId(0xfff1),
            productId: 0x8000,
            flowType: CommissioningFlowType.Standard,
            discoveryCapabilities: 2,
            discriminator: d.discriminator,
            passcode: d.passcode,
        })),
    );
}

describe("buildCommissionOptions", () => {
    describe("QR code commissioning", () => {
        it("should return a single option for a single-device QR code", () => {
            const qrCode = encodeQrCode(3840, 20202021);
            const result = buildCommissionOptions({ qrCode }, false);

            expect(result).to.have.lengthOf(1);
            expect(result[0].passcode).to.equal(20202021);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({ longDiscriminator: 3840 });
        });

        it("should return multiple options for a multi-device QR code", () => {
            const qrCode = encodeMultiDeviceQrCode([
                { discriminator: 3840, passcode: 20202021 },
                { discriminator: 1234, passcode: 99999999 },
                { discriminator: 500, passcode: 12345678 },
            ]);
            const result = buildCommissionOptions({ qrCode }, false);

            expect(result).to.have.lengthOf(3);

            expect(result[0].passcode).to.equal(20202021);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({ longDiscriminator: 3840 });

            expect(result[1].passcode).to.equal(99999999);
            expect(getIdentifierData(result[1].discovery)).to.deep.equal({ longDiscriminator: 1234 });

            expect(result[2].passcode).to.equal(12345678);
            expect(getIdentifierData(result[2].discovery)).to.deep.equal({ longDiscriminator: 500 });
        });

        it("should assign sequential node IDs for multi-device QR codes", () => {
            const qrCode = encodeMultiDeviceQrCode([
                { discriminator: 3840, passcode: 20202021 },
                { discriminator: 1234, passcode: 99999999 },
            ]);
            const result = buildCommissionOptions({ qrCode, nodeId: NodeId(10) }, false);

            expect(result).to.have.lengthOf(2);
            expect(result[0].commissioning.nodeId).to.equal(NodeId(10));
            expect(result[1].commissioning.nodeId).to.equal(NodeId(11));
        });

        it("should leave nodeId undefined for all devices when not provided", () => {
            const qrCode = encodeMultiDeviceQrCode([
                { discriminator: 3840, passcode: 20202021 },
                { discriminator: 1234, passcode: 99999999 },
            ]);
            const result = buildCommissionOptions({ qrCode }, false);

            expect(result[0].commissioning.nodeId).to.be.undefined;
            expect(result[1].commissioning.nodeId).to.be.undefined;
        });

        it("should throw for an empty QR code string", () => {
            expect(() => buildCommissionOptions({ qrCode: "" } as CommissioningRequest, false)).to.throw(
                "No pairing code provided",
            );
        });
    });

    describe("manual pairing code commissioning", () => {
        it("should return a single option with short discriminator", () => {
            const manualCode = "34970112332";
            const decoded = ManualPairingCodeCodec.decode(manualCode);
            const result = buildCommissionOptions({ manualCode }, false);

            expect(result).to.have.lengthOf(1);
            expect(result[0].passcode).to.equal(decoded.passcode);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({
                shortDiscriminator: decoded.shortDiscriminator,
            });
        });
    });

    describe("passcode-based commissioning", () => {
        it("should handle passcode with short discriminator", () => {
            const result = buildCommissionOptions({ passcode: 20202021, shortDiscriminator: 15 }, false);

            expect(result).to.have.lengthOf(1);
            expect(result[0].passcode).to.equal(20202021);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({ shortDiscriminator: 15 });
        });

        it("should handle passcode with long discriminator", () => {
            const result = buildCommissionOptions({ passcode: 20202021, longDiscriminator: 3840 }, false);

            expect(result).to.have.lengthOf(1);
            expect(result[0].passcode).to.equal(20202021);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({ longDiscriminator: 3840 });
        });

        it("should handle passcode with vendor/product ID", () => {
            const result = buildCommissionOptions({ passcode: 20202021, vendorId: 0xfff1, productId: 0x8000 }, false);

            expect(result).to.have.lengthOf(1);
            expect(result[0].passcode).to.equal(20202021);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({
                vendorId: VendorId(0xfff1),
                productId: 0x8000,
            });
        });

        it("should handle passcode-only (discover any)", () => {
            const result = buildCommissionOptions({ passcode: 20202021 }, false);

            expect(result).to.have.lengthOf(1);
            expect(result[0].passcode).to.equal(20202021);
            expect(getIdentifierData(result[0].discovery)).to.deep.equal({});
        });
    });

    describe("discovery capabilities", () => {
        it("should enable BLE when bleEnabled is true and not network-only", () => {
            const qrCode = encodeQrCode(3840, 20202021);
            const result = buildCommissionOptions({ qrCode }, true);
            const caps = result[0].discovery.discoveryCapabilities!;

            expect(caps.ble).to.be.true;
            expect(caps.onIpNetwork).to.be.true;
        });

        it("should disable BLE when bleEnabled is false", () => {
            const qrCode = encodeQrCode(3840, 20202021);
            const result = buildCommissionOptions({ qrCode }, false);

            expect(result[0].discovery.discoveryCapabilities!.ble).to.be.false;
        });

        it("should disable BLE when network-only is set even if BLE is enabled", () => {
            const qrCode = encodeQrCode(3840, 20202021);
            const result = buildCommissionOptions({ qrCode, onNetworkOnly: true }, true);

            expect(result[0].discovery.discoveryCapabilities!.ble).to.be.false;
        });
    });

    describe("known address", () => {
        it("should include known address when provided", () => {
            const qrCode = encodeQrCode(3840, 20202021);
            const result = buildCommissionOptions({ qrCode, knownAddress: { ip: "192.168.1.100", port: 5540 } }, false);

            expect(result[0].discovery.knownAddress).to.deep.equal({
                type: "udp",
                ip: "192.168.1.100",
                port: 5540,
            });
        });

        it("should apply known address to all devices in multi-device QR code", () => {
            const qrCode = encodeMultiDeviceQrCode([
                { discriminator: 3840, passcode: 20202021 },
                { discriminator: 1234, passcode: 99999999 },
            ]);
            const result = buildCommissionOptions({ qrCode, knownAddress: { ip: "192.168.1.100", port: 5540 } }, false);

            expect(result[0].discovery.knownAddress).to.deep.equal({
                type: "udp",
                ip: "192.168.1.100",
                port: 5540,
            });
            expect(result[1].discovery.knownAddress).to.deep.equal({
                type: "udp",
                ip: "192.168.1.100",
                port: 5540,
            });
        });
    });

    describe("error cases", () => {
        it("should throw when no pairing code is provided", () => {
            expect(() => buildCommissionOptions({} as CommissioningRequest, false)).to.throw(
                "No pairing code provided",
            );
        });
    });
});
