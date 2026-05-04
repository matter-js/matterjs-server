/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import type { DiagnosticResponse } from "../diagnostic/DiagnosticResponse.js";
import type { DiagnosticSource } from "../diagnostic/DiagnosticSource.js";
import type { OtbrRestCapability } from "./OtbrRestCapability.js";
import type { OtbrRestClient } from "./OtbrRestClient.js";
import { OtbrRestError } from "./OtbrRestError.js";
import { translateNodeJson } from "./translation.js";

type ClientLike = Pick<OtbrRestClient, "getDiagnostics" | "getNode">;

export class OtbrRestDiagnosticSource implements DiagnosticSource {
    readonly kind = "otbr-rest" as const;

    readonly #client: ClientLike;
    readonly #capability: OtbrRestCapability;

    constructor(client: ClientLike, capability: OtbrRestCapability) {
        this.#client = client;
        this.#capability = capability;
    }

    canQuery(extPanId: Uint8Array): boolean {
        return Bytes.areEqual(extPanId, this.#capability.extPanId);
    }

    async queryUnicast(target: { rloc16?: number; ip?: string }, _tlvTypes: number[]): Promise<DiagnosticResponse> {
        if (target.ip !== undefined && target.rloc16 === undefined) {
            throw new OtbrRestError(
                "rest_protocol",
                "OtbrRestDiagnosticSource: ip-routed unicast is not supported in REST mode — supply rloc16",
            );
        }
        if (target.rloc16 === undefined) {
            throw new OtbrRestError("rest_protocol", "OtbrRestDiagnosticSource: rloc16 required for unicast query");
        }
        // Per-RLOC16 endpoint (`/diagnostics/<rloc16>`) is not universally
        // supported — fetch the full mesh dump and filter client-side.
        // tlvTypes is ignored: REST returns the BR's full diagnostic snapshot
        // with no per-TLV filtering on the wire.
        const list = await this.#client.getDiagnostics();
        for (const entry of list) {
            const decoded = translateNodeJson(entry);
            if (decoded.rloc16 === target.rloc16) return decoded;
        }
        throw new OtbrRestError("rest_protocol", `rloc16 0x${target.rloc16.toString(16)} not found in /diagnostics`);
    }

    async queryMulticast(
        _scope: "ff03::1" | "ff03::2",
        _tlvTypes: number[],
        _collectMs: number,
    ): Promise<DiagnosticResponse[]> {
        // scope/collectMs are no-ops for REST: the BR has already collected
        // diagnostics for the whole mesh and exposes the snapshot via
        // /diagnostics. tlvTypes is ignored for the same reason as
        // queryUnicast.
        const list = await this.#client.getDiagnostics();
        return list.map(entry => translateNodeJson(entry));
    }
}
