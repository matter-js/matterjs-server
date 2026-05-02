/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DtlsSocket } from "../dtls/socket/DtlsSocket.js";
import { CoapMessage } from "./CoapMessage.js";

/** Thrown when a CON request exhausts MAX_RETRANSMIT without receiving an ACK. */
export class CoapTimeoutError extends Error {
    constructor(messageId: number) {
        super(`CoAP CON messageId=${messageId} timed out after MAX_RETRANSMIT`);
        this.name = "CoapTimeoutError";
    }
}

/** RFC 7252 §4.2 retransmission constants. */
const RFC_ACK_TIMEOUT_MS = 2_000;
const RFC_ACK_RANDOM_FACTOR = 1.5;
const MAX_RETRANSMIT = 4;

export interface CoapClientOpts {
    /** Override ACK_TIMEOUT for testing. Default: 2000ms per RFC 7252 §4.2. */
    ackTimeoutMs?: number;
}

type PendingEntry = {
    resolve: (msg: CoapMessage) => void;
    reject: (err: Error) => void;
};

export class CoapClient {
    #messageId = Math.floor(Math.random() * 0x10000);
    #socket: DtlsSocket;
    #ackTimeoutMs: number;
    #pending = new Map<number, PendingEntry>();

    constructor(socket: DtlsSocket, opts?: CoapClientOpts) {
        this.#socket = socket;
        this.#ackTimeoutMs = opts?.ackTimeoutMs ?? RFC_ACK_TIMEOUT_MS;
        void this.#runRecvLoop();
    }

    async request(opts: {
        type: "CON" | "NON";
        code: string;
        uriPath: string[];
        payload?: Uint8Array;
    }): Promise<CoapMessage> {
        const messageId = this.#nextMessageId();
        const token = this.#randomToken();
        const msg: CoapMessage = {
            type: opts.type,
            code: opts.code,
            messageId,
            token,
            uriPath: opts.uriPath,
            payload: opts.payload ?? new Uint8Array(),
        };

        if (opts.type === "NON") {
            await this.#socket.send(CoapMessage.encode(msg));
            // NON messages receive no ACK per RFC 7252 §4.3; return a synthetic sentinel.
            // Callers must not inspect code/type of this response.
            return { type: "NON", code: "0.00", messageId, token, payload: new Uint8Array() };
        }

        return this.#sendCon(msg);
    }

    async close(): Promise<void> {
        await this.#socket.close();
    }

    async #sendCon(msg: CoapMessage): Promise<CoapMessage> {
        if (this.#pending.has(msg.messageId)) {
            throw new Error(`CoapClient: messageId collision at ${msg.messageId} — too many concurrent CON requests`);
        }

        const encoded = CoapMessage.encode(msg);

        return new Promise<CoapMessage>((resolve, reject) => {
            let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
            let attempt = 0;

            const cleanup = (): void => {
                if (timeoutHandle !== undefined) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = undefined;
                }
                this.#pending.delete(msg.messageId);
            };

            const scheduleRetransmit = (delayMs: number): void => {
                timeoutHandle = setTimeout(() => {
                    timeoutHandle = undefined;
                    if (!this.#pending.has(msg.messageId)) return;
                    if (attempt >= MAX_RETRANSMIT) {
                        cleanup();
                        reject(new CoapTimeoutError(msg.messageId));
                        return;
                    }
                    attempt++;
                    void this.#socket.send(encoded).catch(() => {});
                    scheduleRetransmit(Math.min(delayMs * 2, this.#ackTimeoutMs * 2 ** MAX_RETRANSMIT));
                }, delayMs);
            };

            this.#pending.set(msg.messageId, {
                resolve: (response: CoapMessage) => {
                    cleanup();
                    resolve(response);
                },
                reject: (err: Error) => {
                    cleanup();
                    reject(err);
                },
            });

            const initialDelay = this.#ackTimeoutMs * (1 + Math.random() * (RFC_ACK_RANDOM_FACTOR - 1.0));
            void this.#socket
                .send(encoded)
                .then(() => {
                    scheduleRetransmit(initialDelay);
                })
                .catch(err => {
                    cleanup();
                    reject(err instanceof Error ? err : new Error(String(err)));
                });
        });
    }

    async #runRecvLoop(): Promise<void> {
        let socketError: Error | undefined;
        try {
            for (;;) {
                let bytes: Uint8Array;
                try {
                    bytes = await this.#socket.recv();
                } catch (err) {
                    socketError = err instanceof Error ? err : new Error(String(err));
                    break;
                }

                let response: CoapMessage;
                try {
                    response = CoapMessage.decode(bytes);
                } catch {
                    continue;
                }

                const pending = this.#pending.get(response.messageId);
                if (pending !== undefined) {
                    pending.resolve(response);
                }
            }
        } finally {
            const err = socketError ?? new Error("CoapClient: socket closed");
            for (const [, entry] of this.#pending) {
                entry.reject(err);
            }
            this.#pending.clear();
        }
    }

    #nextMessageId(): number {
        const id = this.#messageId;
        this.#messageId = (this.#messageId + 1) & 0xffff;
        return id;
    }

    #randomToken(): Uint8Array {
        const token = new Uint8Array(4);
        crypto.getRandomValues(token);
        return token;
    }
}
