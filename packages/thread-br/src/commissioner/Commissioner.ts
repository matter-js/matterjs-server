/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { CoapClient } from "../coap/CoapClient.js";
import { MeshCopTlvType } from "../dataset/meshcopTlvTypes.js";
import { BasicTlv } from "../tlv/BasicTlvCodec.js";
import { LeadKa } from "./LeadKa.js";
import { LeadPet } from "./LeadPet.js";

const logger = Logger.get("Commissioner");

export class CommissionerRejectedError extends Error {
    constructor() {
        super("Commissioner petition rejected by Border Router");
        this.name = "CommissionerRejectedError";
    }
}

export class CommissionerTimeoutError extends Error {
    constructor() {
        super("Commissioner petition timed out (still pending after retry)");
        this.name = "CommissionerTimeoutError";
    }
}

export interface CommissionerOpts {
    /** Override the 30s pending-retry delay. Intended for testing. */
    pendingRetryDelayMs?: number;
}

export class Commissioner {
    static readonly COMMISSIONER_ID = "matter-server";
    static readonly #KA_INTERVAL_MS = 40_000;
    static readonly #PENDING_RETRY_DELAY_MS = 30_000;

    readonly #coap: CoapClient;
    readonly #pendingRetryDelayMs: number;

    constructor(coap: CoapClient, opts?: CommissionerOpts) {
        this.#coap = coap;
        this.#pendingRetryDelayMs = opts?.pendingRetryDelayMs ?? Commissioner.#PENDING_RETRY_DELAY_MS;
    }

    async petition(): Promise<number> {
        const response = await this.#coap.request({
            type: "CON",
            code: "0.02",
            uriPath: ["c", "cp"],
            payload: LeadPet.buildRequest(Commissioner.COMMISSIONER_ID),
        });

        logger.info(`[ThreadDiag] COMM_PET response code=${response.code} payloadLen=${response.payload.length}`);
        const parsed = LeadPet.parseResponse(response.payload);

        if (parsed.state === "accept") {
            return parsed.sessionId!;
        }

        if (parsed.state === "reject") {
            throw new CommissionerRejectedError();
        }

        // pending: wait and retry once
        await new Promise<void>(r => setTimeout(r, this.#pendingRetryDelayMs));

        const retryResponse = await this.#coap.request({
            type: "CON",
            code: "0.02",
            uriPath: ["c", "cp"],
            payload: LeadPet.buildRequest(Commissioner.COMMISSIONER_ID),
        });

        const retryParsed = LeadPet.parseResponse(retryResponse.payload);

        if (retryParsed.state === "accept") {
            return retryParsed.sessionId!;
        }

        if (retryParsed.state === "reject") {
            throw new CommissionerRejectedError();
        }

        throw new CommissionerTimeoutError();
    }

    async keepAlive(sessionId: number): Promise<void> {
        const response = await this.#coap.request({
            type: "CON",
            code: "0.02",
            uriPath: ["c", "ka"],
            payload: LeadKa.buildRequest(sessionId),
        });

        const parsed = LeadKa.parseResponse(response.payload);
        if (parsed.state !== "accept") {
            throw new Error(`Commissioner keep-alive rejected: state=${parsed.state}`);
        }
    }

    async release(sessionId: number): Promise<void> {
        try {
            // COMM_REL requires both COMMISSIONER_SESSION_ID and COMMISSIONER_ID (Thread spec Table 8-16).
            const sessionBytes = new Uint8Array(2);
            sessionBytes[0] = (sessionId >> 8) & 0xff;
            sessionBytes[1] = sessionId & 0xff;
            const releasePayload = BasicTlv.encode([
                { type: MeshCopTlvType.COMMISSIONER_SESSION_ID, value: sessionBytes },
                { type: MeshCopTlvType.COMMISSIONER_ID, value: new TextEncoder().encode(Commissioner.COMMISSIONER_ID) },
            ]);
            await this.#coap.request({
                type: "CON",
                code: "0.02",
                uriPath: ["c", "cr"],
                payload: releasePayload,
            });
        } catch (err) {
            logger.warn("Commissioner release failed (best-effort):", err);
        }
    }

    async withSession<T>(fn: (sessionId: number) => Promise<T>): Promise<T> {
        const sessionId = await this.petition();
        const kaInterval = setInterval(() => {
            void this.keepAlive(sessionId).catch(err => {
                logger.warn("Commissioner keep-alive error:", err);
            });
        }, Commissioner.#KA_INTERVAL_MS);

        try {
            return await fn(sessionId);
        } finally {
            clearInterval(kaInterval);
            await this.release(sessionId);
        }
    }
}
