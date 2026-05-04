/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { normalizeKeys } from "./caseNormalizer.js";
import { OtbrRestError } from "./OtbrRestError.js";

export interface OtbrLeaderData {
    partitionId: number;
    weighting: number;
    dataVersion: number;
    stableDataVersion: number;
    leaderRouterId: number;
}

export interface OtbrNodeInfo {
    baId: Uint8Array;
    state: string;
    numOfRouter: number;
    rlocAddress: string;
    extAddress: Uint8Array;
    networkName: string;
    rloc16: number;
    leaderData: OtbrLeaderData;
    extPanId: Uint8Array;
}

export interface OtbrDatasetHex {
    activeHex?: string;
    pendingHex?: string;
}

export interface OtbrRestClientOptions {
    host: string;
    port?: number;
    timeoutMs?: number;
}

const DEFAULT_PORT = 8081;
const DEFAULT_TIMEOUT_MS = 5000;
const HTTP_NO_CONTENT = 204;

interface FetchedJson {
    status: number;
    body: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function expectString(record: Record<string, unknown>, key: string, where: string): string {
    const value = record[key];
    if (typeof value !== "string") {
        throw new OtbrRestError("rest_protocol", `${where}: missing or non-string field ${key}`);
    }
    return value;
}

function expectNumber(record: Record<string, unknown>, key: string, where: string): number {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new OtbrRestError("rest_protocol", `${where}: missing or non-numeric field ${key}`);
    }
    return value;
}

function expectRecord(record: Record<string, unknown>, key: string, where: string): Record<string, unknown> {
    const value = record[key];
    if (!isRecord(value)) {
        throw new OtbrRestError("rest_protocol", `${where}: missing or non-object field ${key}`);
    }
    return value;
}

function parseHexBytes(hex: string, expectedLen: number, where: string): Uint8Array {
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
        throw new OtbrRestError("rest_protocol", `${where}: not hex`);
    }
    if (hex.length !== expectedLen * 2) {
        throw new OtbrRestError("rest_protocol", `${where}: expected ${expectedLen} bytes, got ${hex.length / 2}`);
    }
    return Bytes.of(Bytes.fromHex(hex));
}

export class OtbrRestClient {
    readonly #baseUrl: string;
    readonly #timeoutMs: number;

    constructor(opts: OtbrRestClientOptions) {
        const port = opts.port ?? DEFAULT_PORT;
        const host = opts.host.includes(":") && !opts.host.startsWith("[") ? `[${opts.host}]` : opts.host;
        this.#baseUrl = `http://${host}:${port}`;
        this.#timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    get baseUrl(): string {
        return this.#baseUrl;
    }

    async getNode(): Promise<OtbrNodeInfo> {
        const { body } = await this.#fetchJson("/node");
        if (!isRecord(body)) {
            throw new OtbrRestError("rest_protocol", "/node did not return a JSON object");
        }
        const where = "/node";
        const leaderRaw = expectRecord(body, "leaderData", where);
        const leaderData: OtbrLeaderData = {
            partitionId: expectNumber(leaderRaw, "partitionId", `${where}.leaderData`),
            weighting: expectNumber(leaderRaw, "weighting", `${where}.leaderData`),
            dataVersion: expectNumber(leaderRaw, "dataVersion", `${where}.leaderData`),
            stableDataVersion: expectNumber(leaderRaw, "stableDataVersion", `${where}.leaderData`),
            leaderRouterId: expectNumber(leaderRaw, "leaderRouterId", `${where}.leaderData`),
        };
        return {
            baId: parseHexBytes(expectString(body, "baId", where), 16, `${where}.baId`),
            state: expectString(body, "state", where),
            numOfRouter: expectNumber(body, "numOfRouter", where),
            rlocAddress: expectString(body, "rlocAddress", where),
            extAddress: parseHexBytes(expectString(body, "extAddress", where), 8, `${where}.extAddress`),
            networkName: expectString(body, "networkName", where),
            rloc16: expectNumber(body, "rloc16", where),
            leaderData,
            extPanId: parseHexBytes(expectString(body, "extPanId", where), 8, `${where}.extPanId`),
        };
    }

    async getDiagnostics(): Promise<unknown[]> {
        const { body } = await this.#fetchJson("/diagnostics");
        if (!Array.isArray(body)) {
            throw new OtbrRestError("rest_protocol", "/diagnostics did not return a JSON array");
        }
        return body;
    }

    async getDataset(): Promise<OtbrDatasetHex> {
        const active = await this.#fetchText("/node/dataset/active");
        const pending = await this.#fetchText("/node/dataset/pending");
        const out: OtbrDatasetHex = {};
        if (active !== undefined) out.activeHex = active;
        if (pending !== undefined) out.pendingHex = pending;
        return out;
    }

    async #fetchJson(path: string): Promise<FetchedJson> {
        const response = await this.#doFetch(path, "application/json");
        if (response.status === HTTP_NO_CONTENT) {
            return { status: response.status, body: null };
        }
        if (!response.ok) {
            throw new OtbrRestError("rest_protocol", `GET ${path} returned ${response.status}`, {
                httpStatus: response.status,
            });
        }
        const text = await response.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            throw new OtbrRestError("rest_protocol", `GET ${path} returned non-JSON body`, {
                cause: err instanceof Error ? err : undefined,
            });
        }
        return { status: response.status, body: normalizeKeys(parsed) };
    }

    async #fetchText(path: string): Promise<string | undefined> {
        const response = await this.#doFetch(path, "text/plain");
        if (response.status === HTTP_NO_CONTENT) return undefined;
        if (!response.ok) {
            throw new OtbrRestError("rest_protocol", `GET ${path} returned ${response.status}`, {
                httpStatus: response.status,
            });
        }
        return response.text();
    }

    async #doFetch(path: string, accept: string): Promise<Response> {
        const url = `${this.#baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
        try {
            return await fetch(url, {
                method: "GET",
                headers: { Accept: accept },
                signal: controller.signal,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new OtbrRestError("rest_unreachable", `GET ${path} failed: ${message}`, {
                cause: err instanceof Error ? err : undefined,
            });
        } finally {
            clearTimeout(timer);
        }
    }
}
