/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { CoapClient } from "../coap/CoapClient.js";
import type { Commissioner } from "../commissioner/Commissioner.js";
import { ChildTable } from "../tlv/diag/ChildTable.js";
import { Connectivity } from "../tlv/diag/Connectivity.js";
import { Ipv6AddressList } from "../tlv/diag/Ipv6AddressList.js";
import { LeaderData } from "../tlv/diag/LeaderData.js";
import { MacCounters } from "../tlv/diag/MacCounters.js";
import { MleCounters } from "../tlv/diag/MleCounters.js";
import { Mode } from "../tlv/diag/Mode.js";
import {
    Address16,
    BatteryLevel,
    ChannelPages,
    Eui64,
    ExtMacAddress,
    MaxChildTimeout,
    SupplyVoltage,
} from "../tlv/diag/Primitives.js";
import { Route64 } from "../tlv/diag/Route64.js";
import { Timeout } from "../tlv/diag/Timeout.js";
import {
    ThreadStackVersion,
    VendorAppUrl,
    VendorModel,
    VendorName,
    VendorSwVersion,
    Version,
} from "../tlv/diag/VendorInfo.js";
import { NetworkDiagnosticTlv } from "../tlv/NetworkDiagnosticTlv.js";
import { NetworkDiagTlvType } from "../tlv/networkDiagTlvTypes.js";
import { TypeListTlv } from "../tlv/TypeListTlv.js";
import type { DiagnosticResponse } from "./DiagnosticResponse.js";
import type { DiagnosticSource } from "./DiagnosticSource.js";

const logger = Logger.get("MeshCopDiagnosticSource");

export class MeshCopDiagnosticSource implements DiagnosticSource {
    readonly kind = "meshcop" as const;

    readonly #commissioner: Pick<Commissioner, "withSession">;
    readonly #coap: Pick<CoapClient, "request" | "listen">;

    constructor(commissioner: Pick<Commissioner, "withSession">, coap: Pick<CoapClient, "request" | "listen">) {
        this.#commissioner = commissioner;
        this.#coap = coap;
    }

    canQuery(_extPanId: Uint8Array): boolean {
        return true;
    }

    async queryUnicast(target: { rloc16?: number; ip?: string }, tlvTypes: number[]): Promise<DiagnosticResponse> {
        if (target.ip !== undefined) {
            throw new Error(
                "MeshCopDiagnosticSource: ip-routed unicast is not supported in Phase 5 — use rloc16 or the commissioner session address",
            );
        }
        return this.#commissioner.withSession(async () => {
            const response = await this.#coap.request({
                type: "CON",
                code: "0.02",
                uriPath: ["d", "dg"],
                payload: NetworkDiagnosticTlv.encode([
                    { type: NetworkDiagTlvType.TYPE_LIST, value: TypeListTlv.encode(tlvTypes) },
                ]),
            });
            return decodeResponse(response.payload);
        });
    }

    async queryMulticast(
        _scope: "ff03::1" | "ff03::2",
        tlvTypes: number[],
        collectMs: number,
    ): Promise<DiagnosticResponse[]> {
        // scope param accepted but not wired into the request: our DTLS socket has a single peer (the BR),
        // and the BR forwards /d/dq to its configured multicast scope. Per-scope routing requires
        // socket-level destination control (Phase 8).
        return this.#commissioner.withSession(async () => {
            const responses = new Array<DiagnosticResponse>();
            const unsubscribe = this.#coap.listen(["d", "da"], msg => {
                if (msg.payload.length === 0) return;
                try {
                    responses.push(decodeResponse(msg.payload));
                } catch (err) {
                    logger.warn("failed to decode .ans payload, dropping:", err);
                }
            });
            try {
                await this.#coap.request({
                    type: "NON",
                    code: "0.02",
                    uriPath: ["d", "dq"],
                    payload: NetworkDiagnosticTlv.encode([
                        { type: NetworkDiagTlvType.TYPE_LIST, value: TypeListTlv.encode(tlvTypes) },
                    ]),
                });
                await new Promise<void>(r => setTimeout(r, collectMs));
            } finally {
                unsubscribe();
            }
            return responses;
        });
    }
}

function decodeResponse(payload: Uint8Array): DiagnosticResponse {
    const entries = NetworkDiagnosticTlv.decode(payload);
    const result: DiagnosticResponse = { unknown: new Array<{ type: number; value: Uint8Array }>() };

    for (const entry of entries) {
        switch (entry.type) {
            case NetworkDiagTlvType.EXT_MAC_ADDRESS:
                result.extMacAddress = ExtMacAddress.decode(entry.value);
                break;
            case NetworkDiagTlvType.ADDRESS16:
                result.rloc16 = Address16.decode(entry.value);
                break;
            case NetworkDiagTlvType.MODE:
                result.mode = Mode.decode(entry.value);
                break;
            case NetworkDiagTlvType.TIMEOUT:
                result.timeout = Timeout.decode(entry.value);
                break;
            case NetworkDiagTlvType.CONNECTIVITY:
                result.connectivity = Connectivity.decode(entry.value);
                break;
            case NetworkDiagTlvType.ROUTE64:
                result.route64 = Route64.decode(entry.value);
                break;
            case NetworkDiagTlvType.LEADER_DATA:
                result.leaderData = LeaderData.decode(entry.value);
                break;
            case NetworkDiagTlvType.NETWORK_DATA:
                result.networkData = entry.value;
                break;
            case NetworkDiagTlvType.IPV6_ADDRESS_LIST:
                result.ipv6Addresses = Ipv6AddressList.decode(entry.value);
                break;
            case NetworkDiagTlvType.MAC_COUNTERS:
                result.macCounters = MacCounters.decode(entry.value);
                break;
            case NetworkDiagTlvType.BATTERY_LEVEL:
                result.batteryLevel = BatteryLevel.decode(entry.value);
                break;
            case NetworkDiagTlvType.SUPPLY_VOLTAGE:
                result.supplyVoltage = SupplyVoltage.decode(entry.value);
                break;
            case NetworkDiagTlvType.CHILD_TABLE:
                result.childTable = ChildTable.decode(entry.value);
                break;
            case NetworkDiagTlvType.CHANNEL_PAGES:
                result.channelPages = ChannelPages.decode(entry.value);
                break;
            case NetworkDiagTlvType.MAX_CHILD_TIMEOUT:
                result.maxChildTimeout = MaxChildTimeout.decode(entry.value);
                break;
            case NetworkDiagTlvType.EUI64:
                result.eui64 = Eui64.decode(entry.value);
                break;
            case NetworkDiagTlvType.VERSION:
                result.version = Version.decode(entry.value);
                break;
            case NetworkDiagTlvType.VENDOR_NAME:
                result.vendorName = VendorName.decode(entry.value);
                break;
            case NetworkDiagTlvType.VENDOR_MODEL:
                result.vendorModel = VendorModel.decode(entry.value);
                break;
            case NetworkDiagTlvType.VENDOR_SW_VERSION:
                result.vendorSwVersion = VendorSwVersion.decode(entry.value);
                break;
            case NetworkDiagTlvType.THREAD_STACK_VERSION:
                result.threadStackVersion = ThreadStackVersion.decode(entry.value);
                break;
            case NetworkDiagTlvType.MLE_COUNTERS:
                result.mleCounters = MleCounters.decode(entry.value);
                break;
            case NetworkDiagTlvType.VENDOR_APP_URL:
                result.vendorAppUrl = VendorAppUrl.decode(entry.value);
                break;
            default:
                result.unknown.push({ type: entry.type, value: entry.value });
                break;
        }
    }

    return result;
}
