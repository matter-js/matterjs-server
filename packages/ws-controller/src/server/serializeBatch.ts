/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    ThreadDiagnosticsBatch as ThreadDiagnosticsBatchWire,
    ThreadDiagnosticsNode as ThreadDiagnosticsNodeWire,
} from "@matter-server/ws-client";
import { Bytes } from "@matter/main";
import type { DiagnosticResponse } from "@matter/thread-br-client";
import type { ThreadDiagnosticsBatch } from "../controller/ThreadDiagnosticsService.js";

function hex(bytes: Bytes): string {
    return Bytes.toHex(bytes).toUpperCase();
}

function serializeNode(r: DiagnosticResponse): ThreadDiagnosticsNodeWire {
    const out: ThreadDiagnosticsNodeWire = {};

    if (r.extMacAddress !== undefined) out.extMacAddress = hex(r.extMacAddress);
    if (r.rloc16 !== undefined) out.rloc16 = r.rloc16;

    if (r.mode !== undefined) {
        out.mode = {
            rxOnWhenIdle: r.mode.rxOnWhenIdle,
            ftd: r.mode.fullThreadDevice,
            fullNetworkData: r.mode.fullNetworkData,
        };
    }

    if (r.timeout !== undefined) out.timeout = r.timeout;
    if (r.connectivity !== undefined) out.connectivity = { ...r.connectivity };
    if (r.route64 !== undefined) {
        out.route64 = {
            idSequence: r.route64.idSequence,
            entries: r.route64.entries.map(e => ({ ...e })),
        };
    }
    if (r.leaderData !== undefined) out.leaderData = { ...r.leaderData };
    if (r.networkData !== undefined) out.networkData = hex(r.networkData.raw);
    if (r.ipv6Addresses !== undefined) out.ipv6Addresses = r.ipv6Addresses.map(addr => hex(addr));
    if (r.macCounters !== undefined) out.macCounters = { ...r.macCounters };
    if (r.batteryLevel !== undefined) out.batteryLevel = r.batteryLevel;
    if (r.supplyVoltage !== undefined) out.supplyVoltage = r.supplyVoltage;
    if (r.childTable !== undefined) {
        out.childTable = r.childTable.map(c => ({
            timeoutExponent: c.timeoutExponent,
            timeoutSeconds: c.timeoutSeconds,
            incomingLinkQuality: c.incomingLinkQuality,
            childId: c.childId,
            mode: {
                rxOnWhenIdle: c.mode.rxOnWhenIdle,
                ftd: c.mode.fullThreadDevice,
                fullNetworkData: c.mode.fullNetworkData,
            },
        }));
    }
    if (r.channelPages !== undefined) out.channelPages = [...r.channelPages];
    if (r.maxChildTimeout !== undefined) out.maxChildTimeout = r.maxChildTimeout;
    if (r.eui64 !== undefined) out.eui64 = hex(r.eui64);
    if (r.version !== undefined) out.version = r.version;
    if (r.vendorName !== undefined) out.vendorName = r.vendorName;
    if (r.vendorModel !== undefined) out.vendorModel = r.vendorModel;
    if (r.vendorSwVersion !== undefined) out.vendorSwVersion = r.vendorSwVersion;
    if (r.threadStackVersion !== undefined) out.threadStackVersion = r.threadStackVersion;
    if (r.vendorAppUrl !== undefined) out.vendorAppUrl = r.vendorAppUrl;
    if (r.mleCounters !== undefined) {
        out.mleCounters = {
            disabledRole: r.mleCounters.disabledRole,
            detachedRole: r.mleCounters.detachedRole,
            childRole: r.mleCounters.childRole,
            routerRole: r.mleCounters.routerRole,
            leaderRole: r.mleCounters.leaderRole,
            attachAttempts: r.mleCounters.attachAttempts,
            partitionIdChanges: r.mleCounters.partitionIdChanges,
            betterPartitionAttachAttempts: r.mleCounters.betterPartitionAttachAttempts,
            parentChanges: r.mleCounters.parentChanges,
            trackedTime: r.mleCounters.trackedTime,
            disabledTime: r.mleCounters.disabledTime,
            detachedTime: r.mleCounters.detachedTime,
            childTime: r.mleCounters.childTime,
            routerTime: r.mleCounters.routerTime,
            leaderTime: r.mleCounters.leaderTime,
        };
    }
    if (r.unknown.length > 0) {
        out.unknown = r.unknown.map(({ type, value }) => ({ type, value: hex(value) }));
    }

    return out;
}

export function serializeBatch(batch: ThreadDiagnosticsBatch): ThreadDiagnosticsBatchWire {
    const wire: ThreadDiagnosticsBatchWire = {
        extPanIdHex: batch.extPanIdHex.toUpperCase(),
        networkName: batch.networkName,
        collectedAt: batch.collectedAt,
        source: batch.source,
        nodes: batch.nodes.map(serializeNode),
    };
    if (batch.partialReason !== undefined) wire.partialReason = batch.partialReason;
    return wire;
}
