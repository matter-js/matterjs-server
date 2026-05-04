/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoapClient } from "../src/coap/CoapClient.js";
import { CoapTimeoutError } from "../src/coap/CoapClient.js";
import type { CoapMessage } from "../src/coap/CoapMessage.js";
import type { Commissioner } from "../src/commissioner/Commissioner.js";
import { MeshCopDiagnosticSource } from "../src/diagnostic/MeshCopDiagnosticSource.js";
import { BasicTlv } from "../src/tlv/BasicTlvCodec.js";
import { NetworkDiagTlvType } from "../src/tlv/networkDiagTlvTypes.js";

type CommissionerLike = Pick<Commissioner, "withSession">;
type CoapLike = Pick<CoapClient, "request" | "listen">;

function mockCommissioner(): CommissionerLike {
    return {
        withSession: async <T>(fn: (sessionId: number) => Promise<T>) => fn(42),
    };
}

type RequestOpts = { type: "CON" | "NON"; code: string; uriPath: string[]; payload?: Uint8Array };

function mockCoap(responseFn: (opts: RequestOpts) => Promise<CoapMessage>): CoapLike {
    return {
        request: responseFn,
        listen: () => () => {},
    };
}

function ackMessage(payload: Uint8Array): CoapMessage {
    return { type: "ACK", code: "2.05", messageId: 1, token: new Uint8Array(4), payload };
}

function buildDiagPayload(type: number, value: Uint8Array): Uint8Array {
    return BasicTlv.encode([{ type, value }]);
}

describe("MeshCopDiagnosticSource", () => {
    it("kind is 'meshcop'", () => {
        const source = new MeshCopDiagnosticSource(
            mockCommissioner(),
            mockCoap(async () => ackMessage(new Uint8Array())),
        );
        expect(source.kind).to.equal("meshcop");
    });

    it("canQuery always returns true", () => {
        const source = new MeshCopDiagnosticSource(
            mockCommissioner(),
            mockCoap(async () => ackMessage(new Uint8Array())),
        );
        expect(source.canQuery(new Uint8Array(8))).to.equal(true);
        expect(source.canQuery(new Uint8Array(0))).to.equal(true);
    });

    it("queryUnicast sends CON POST to /d/dg with TLV(18) framed payload and decodes extMacAddress", async () => {
        const extMacValue = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
        const responsePayload = buildDiagPayload(NetworkDiagTlvType.EXT_MAC_ADDRESS, extMacValue);

        let capturedOpts: RequestOpts | undefined;

        const coap = mockCoap(async opts => {
            capturedOpts = opts;
            return ackMessage(responsePayload);
        });

        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        const result = await source.queryUnicast({ rloc16: 0x0400 }, [NetworkDiagTlvType.EXT_MAC_ADDRESS]);

        expect(capturedOpts).to.not.be.undefined;
        expect(capturedOpts!.type).to.equal("CON");
        expect(capturedOpts!.code).to.equal("0.02");
        expect(capturedOpts!.uriPath).to.deep.equal(["d", "dg"]);
        // Wire format: TLV(type=18 TYPE_LIST, length=1, value=[0x00 EXT_MAC_ADDRESS])
        expect(capturedOpts!.payload).to.deep.equal(new Uint8Array([0x12, 0x01, NetworkDiagTlvType.EXT_MAC_ADDRESS]));

        expect(result.extMacAddress).to.not.be.undefined;
        expect(result.extMacAddress).to.deep.equal(extMacValue);
    });

    it("queryUnicast propagates errors from coap.request", async () => {
        const coap = mockCoap(async _opts => {
            throw new CoapTimeoutError(0);
        });

        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);

        try {
            await source.queryUnicast({}, [0]);
            expect.fail("expected CoapTimeoutError");
        } catch (err) {
            expect(err).to.be.instanceOf(CoapTimeoutError);
        }
    });

    it("queryUnicast places unknown TLV types in response.unknown", async () => {
        const unknownType = 0xfe;
        const unknownValue = new Uint8Array([0xaa, 0xbb]);
        const responsePayload = buildDiagPayload(unknownType, unknownValue);

        const coap = mockCoap(async () => ackMessage(responsePayload));
        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        const result = await source.queryUnicast({}, [unknownType]);

        expect(result.unknown).to.have.length(1);
        expect(result.unknown[0].type).to.equal(unknownType);
        expect(result.unknown[0].value).to.deep.equal(unknownValue);
        expect(result.extMacAddress).to.be.undefined;
    });

    it("queryUnicast throws when target.ip is supplied", async () => {
        const source = new MeshCopDiagnosticSource(
            mockCommissioner(),
            mockCoap(async () => ackMessage(new Uint8Array())),
        );

        try {
            await source.queryUnicast({ ip: "fd00::1" }, [0]);
            expect.fail("expected Error");
        } catch (err) {
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.include("ip-routed");
        }
    });

    it("queryUnicast with empty response returns only empty unknown[]", async () => {
        const coap = mockCoap(async () => ackMessage(new Uint8Array()));
        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        const result = await source.queryUnicast({}, [NetworkDiagTlvType.EXT_MAC_ADDRESS]);

        expect(result.extMacAddress).to.be.undefined;
        expect(result.unknown).to.have.length(0);
    });

    it("queryUnicast with multiple TLV types sends all types in TypeListTlv payload", async () => {
        let capturedPayload: Uint8Array | undefined;

        const coap = mockCoap(async opts => {
            capturedPayload = opts.payload;
            return ackMessage(new Uint8Array());
        });

        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        await source.queryUnicast({}, [NetworkDiagTlvType.EXT_MAC_ADDRESS, NetworkDiagTlvType.ADDRESS16]);

        // TLV(type=18 TYPE_LIST, length=2, value=[0x00, 0x01])
        expect(capturedPayload).to.deep.equal(new Uint8Array([0x12, 0x02, 0x00, 0x01]));
    });

    it("queryMulticast collects responses for collectMs window and returns array", async () => {
        const extMacA = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
        const extMacB = new Uint8Array([0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18]);
        const ansA = buildDiagPayload(NetworkDiagTlvType.EXT_MAC_ADDRESS, extMacA);
        const ansB = buildDiagPayload(NetworkDiagTlvType.EXT_MAC_ADDRESS, extMacB);

        let listenHandler: ((msg: CoapMessage) => void) | undefined;

        const coap: CoapLike = {
            request: async () => ackMessage(new Uint8Array()),
            listen: (uriPath, handler) => {
                expect(uriPath).to.deep.equal(["d", "da"]);
                listenHandler = handler;
                return () => {};
            },
        };

        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);

        const queryPromise = source.queryMulticast("ff03::2", [NetworkDiagTlvType.EXT_MAC_ADDRESS], 50);

        await new Promise(r => setTimeout(r, 10));
        expect(listenHandler).to.not.be.undefined;
        listenHandler!({ type: "NON", code: "0.02", messageId: 1, token: new Uint8Array(4), payload: ansA });
        listenHandler!({ type: "NON", code: "0.02", messageId: 2, token: new Uint8Array(4), payload: ansB });

        const results = await queryPromise;
        expect(results).to.have.length(2);
        expect(results[0].extMacAddress).to.deep.equal(extMacA);
        expect(results[1].extMacAddress).to.deep.equal(extMacB);
    });

    it("queryMulticast subscribes BEFORE sending the query", async () => {
        const events = new Array<string>();

        const coap: CoapLike = {
            request: async () => {
                events.push("request");
                return ackMessage(new Uint8Array());
            },
            listen: () => {
                events.push("listen");
                return () => {};
            },
        };

        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        await source.queryMulticast("ff03::2", [NetworkDiagTlvType.EXT_MAC_ADDRESS], 10);

        expect(events).to.deep.equal(["listen", "request"]);
    });

    it("queryMulticast returns [] when no .ans arrives within collectMs", async () => {
        const coap: CoapLike = {
            request: async () => ackMessage(new Uint8Array()),
            listen: () => () => {},
        };
        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        const results = await source.queryMulticast("ff03::2", [NetworkDiagTlvType.EXT_MAC_ADDRESS], 10);
        expect(results).to.have.length(0);
    });

    it("queryMulticast drops empty .ans payloads", async () => {
        let listenHandler: ((msg: CoapMessage) => void) | undefined;
        const coap: CoapLike = {
            request: async () => ackMessage(new Uint8Array()),
            listen: (_uriPath, handler) => {
                listenHandler = handler;
                return () => {};
            },
        };
        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        const queryPromise = source.queryMulticast("ff03::2", [NetworkDiagTlvType.EXT_MAC_ADDRESS], 30);

        await new Promise(r => setTimeout(r, 5));
        listenHandler!({
            type: "NON",
            code: "0.02",
            messageId: 1,
            token: new Uint8Array(4),
            payload: new Uint8Array(),
        });

        const results = await queryPromise;
        expect(results).to.have.length(0);
    });

    it("queryMulticast drops .ans payloads that fail to decode", async () => {
        let listenHandler: ((msg: CoapMessage) => void) | undefined;
        const coap: CoapLike = {
            request: async () => ackMessage(new Uint8Array()),
            listen: (_uriPath, handler) => {
                listenHandler = handler;
                return () => {};
            },
        };
        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        const queryPromise = source.queryMulticast("ff03::2", [NetworkDiagTlvType.EXT_MAC_ADDRESS], 30);

        await new Promise(r => setTimeout(r, 5));
        // Truncated TLV: type=0, length=8, but only 2 bytes follow.
        listenHandler!({
            type: "NON",
            code: "0.02",
            messageId: 1,
            token: new Uint8Array(4),
            payload: new Uint8Array([0x00, 0x08, 0x01, 0x02]),
        });

        const results = await queryPromise;
        expect(results).to.have.length(0);
    });

    it("queryMulticast unsubscribes after the collect window", async () => {
        let unsubCalled = false;

        const coap: CoapLike = {
            request: async () => ackMessage(new Uint8Array()),
            listen: () => () => {
                unsubCalled = true;
            },
        };

        const source = new MeshCopDiagnosticSource(mockCommissioner(), coap);
        await source.queryMulticast("ff03::2", [NetworkDiagTlvType.EXT_MAC_ADDRESS], 10);

        expect(unsubCalled).to.equal(true);
    });
});
