/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoapClient, CoapTimeoutError } from "../src/coap/CoapClient.js";
import { CoapMessage } from "../src/coap/CoapMessage.js";
import type { DtlsSocket } from "../src/dtls/socket/DtlsSocket.js";

class MockSocket implements DtlsSocket {
    readonly sent = new Array<Uint8Array>();
    readonly #recvQueue = new Array<Uint8Array>();
    readonly #recvWaiters = new Array<{ resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();
    #closed = false;

    async send(bytes: Uint8Array): Promise<void> {
        this.sent.push(new Uint8Array(bytes));
    }

    async recv(): Promise<Uint8Array> {
        if (this.#recvQueue.length > 0) {
            return this.#recvQueue.shift()!;
        }
        return new Promise<Uint8Array>((resolve, reject) => {
            this.#recvWaiters.push({ resolve, reject });
        });
    }

    async close(): Promise<void> {
        if (this.#closed) return;
        this.#closed = true;
        const err = new Error("MockSocket: closed");
        for (const w of this.#recvWaiters) {
            w.reject(err);
        }
        this.#recvWaiters.length = 0;
    }

    deliver(bytes: Uint8Array): void {
        if (this.#recvWaiters.length > 0) {
            this.#recvWaiters.shift()!.resolve(bytes);
        } else {
            this.#recvQueue.push(bytes);
        }
    }

    deliverMessage(msg: CoapMessage): void {
        this.deliver(CoapMessage.encode(msg));
    }
}

function makeAck(req: CoapMessage, payload?: Uint8Array): CoapMessage {
    return {
        type: "ACK",
        code: "2.04",
        messageId: req.messageId,
        token: req.token,
        payload: payload ?? new Uint8Array(),
    };
}

describe("CoapClient", () => {
    it("sends a CON request and resolves when ACK arrives", async () => {
        const socket = new MockSocket();
        const client = new CoapClient(socket, { ackTimeoutMs: 5_000 });

        const responsePayload = new Uint8Array([0x10, 0x01, 0x01, 0x0b, 0x02, 0x00, 0x07]);
        const reqPromise = client.request({
            type: "CON",
            code: "0.02",
            uriPath: ["c", "cp"],
            payload: new Uint8Array([0x0a, 0x03, 0x61, 0x62, 0x63]),
        });

        await Promise.resolve(); // yield so the initial send microtask runs before the ACK is delivered
        expect(socket.sent.length).to.be.greaterThan(0);
        const sentMsg = CoapMessage.decode(socket.sent[0]);
        socket.deliverMessage(makeAck(sentMsg, responsePayload));

        const response = await reqPromise;
        expect(response.code).to.equal("2.04");
        expect(response.payload).to.deep.equal(responsePayload);

        await client.close();
    });

    it("retransmits when ACK is delayed — resolves on second attempt", async () => {
        const socket = new MockSocket();

        const client = new CoapClient(socket, { ackTimeoutMs: 20 });

        let sendCount = 0;
        const origSend = socket.send.bind(socket);
        socket.send = async (bytes: Uint8Array): Promise<void> => {
            await origSend(bytes);
            sendCount++;
            if (sendCount >= 2) {
                const msg = CoapMessage.decode(bytes);
                socket.deliverMessage(makeAck(msg));
            }
        };

        const response = await client.request({ type: "CON", code: "0.02", uriPath: ["c", "cp"] });

        expect(sendCount).to.be.greaterThanOrEqual(2);
        expect(response.code).to.equal("2.04");

        await client.close();
    });

    it("throws CoapTimeoutError when MAX_RETRANSMIT is exhausted", async () => {
        const socket = new MockSocket();
        const client = new CoapClient(socket, { ackTimeoutMs: 5 });

        try {
            await client.request({ type: "CON", code: "0.02", uriPath: ["c", "cp"] });
            expect.fail("expected CoapTimeoutError");
        } catch (err) {
            expect(err).to.be.instanceOf(CoapTimeoutError);
        }

        await client.close();
    });

    it("sends a NON request and returns immediately without waiting for ACK", async () => {
        const socket = new MockSocket();
        const client = new CoapClient(socket);

        const response = await client.request({ type: "NON", code: "0.01", uriPath: ["c", "cp"] });

        expect(response.code).to.equal("0.00");
        expect(socket.sent.length).to.equal(1);
        const sent = CoapMessage.decode(socket.sent[0]);
        expect(sent.type).to.equal("NON");

        await client.close();
    });

    it("CoapTimeoutError is an Error with a useful message", () => {
        const err = new CoapTimeoutError(0x1234);
        expect(err).to.be.instanceOf(Error);
        expect(err).to.be.instanceOf(CoapTimeoutError);
        // messageId 0x1234 = 4660 decimal
        const hasId = err.message.includes("4660") || err.message.includes("1234") || err.message.includes("0x1234");
        expect(hasId).to.equal(true);
        expect(err.name).to.equal("CoapTimeoutError");
    });
});
