/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImplementationError } from "@matter/main";
import { QrPairingCodeCodec } from "@matter/main/types";
import { ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

const QR_PAYLOAD = {
    version: 0,
    vendor_id: 0xfff1,
    product_id: 0x8000,
    flow_type: 0,
    discovery_capabilities: 4,
    discriminator: 3840,
    setup_pin_code: 20202021,
};

describe("parse_onboarding_payload over WebSocket", () => {
    let harness: InteractionWsHarness;

    beforeEach(async () => {
        harness = await InteractionWsHarness.create();
    });

    afterEach(async () => {
        await harness.close();
    });

    async function parse(code: unknown) {
        const client = await harness.connect();
        return await client.command("parse_onboarding_payload", { code });
    }

    it("decodes a QR code", async () => {
        const response = await parse("MT:Y.K90AFN00KA0648G00");

        expect(response.result).deep.equals({ type: "qr", payloads: [QR_PAYLOAD] });
    });

    it("leaves out the TLV data of a QR code", async () => {
        const response = await parse("MT:Y.K90AFN00KA064IJ3P027M30PKC42O0");

        expect(response.result).deep.equals({ type: "qr", payloads: [QR_PAYLOAD] });
    });

    it("returns every payload of a concatenated QR code", async () => {
        const response = await parse("MT:Y.K90AFN00KA0648G00*Y.K90Q1212MGVH7SR00");

        expect(response.result).deep.equals({
            type: "qr",
            payloads: [QR_PAYLOAD, { ...QR_PAYLOAD, discriminator: 1234, setup_pin_code: 34567890 }],
        });
    });

    it("leaves out a vendor and product the QR code gives as 0", async () => {
        const response = await parse("MT:00000CQM00KA0648G00");

        const { vendor_id, product_id, ...rest } = QR_PAYLOAD;
        expect([vendor_id, product_id]).deep.equals([0xfff1, 0x8000]);
        expect(response.result).deep.equals({ type: "qr", payloads: [rest] });
    });

    it("decodes an 11-digit manual pairing code", async () => {
        const response = await parse("34970112332");

        expect(response.result).deep.equals({ type: "manual", short_discriminator: 15, setup_pin_code: 20202021 });
    });

    it("decodes the vendor and product of a 21-digit manual pairing code", async () => {
        const response = await parse("749701123365521327687");

        expect(response.result).deep.equals({
            type: "manual",
            short_discriminator: 15,
            setup_pin_code: 20202021,
            vendor_id: 0xfff1,
            product_id: 0x8000,
        });
    });

    it("refuses a code that cannot be decoded with reason invalid-payload", async () => {
        // 400000000070000327685 states vendor ID 70000, out of range for a VendorId.
        for (const code of ["MT:invalid", "1234", "34970112333", "400000000070000327685"]) {
            const response = await parse(code);

            expect([response.error_code, response.reason], code).deep.equals([
                ServerErrorCode.InvalidArguments,
                "invalid-payload",
            ]);
        }
    });

    it("fails with SDKStackError, not invalid-payload, when decoding fails for another reason", async () => {
        QrPairingCodeCodec.decode = () => {
            throw new ImplementationError("decoder broke");
        };
        try {
            const response = await parse("MT:Y.K90AFN00KA0648G00");

            expect([response.error_code, response.reason]).deep.equals([ServerErrorCode.SDKStackError, undefined]);
            expect(response.details).equals("Could not process the pairing code: decoder broke");
        } finally {
            Reflect.deleteProperty(QrPairingCodeCodec, "decode");
        }
    });

    it("refuses a missing or non-string code without a reason", async () => {
        for (const code of [undefined, 34970112332, null]) {
            const response = await parse(code);

            expect(response.error_code, String(code)).equals(ServerErrorCode.InvalidArguments);
            expect(response.reason, String(code)).undefined;
        }
    });
});
