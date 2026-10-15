/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import { AttributeId, ClusterId, Duration, NodeId } from "@matter/main";
import { CommissionableDeviceIdentifiers } from "@matter/main/protocol";
import { EndpointNumber, Status } from "@matter/main/types";
import { ControllerCommissioningFlowOptions } from "@matter/protocol";

export type AttributeResponseStatus = {
    clusterId: number;
    attributeId: number;
    endpointId: number;
    status?: Status;
    clusterStatus?: number;
};

export type WriteAttributeRequest = {
    nodeId: NodeId;
    /** Leave out to write the attribute on every endpoint of the node that has it. */
    endpointId?: EndpointNumber;
    clusterId: ClusterId;
    attributeId: AttributeId;
    value: unknown;
    timedInteractionTimeoutMs?: Duration;
};

export type BatchedInvokeRequest = {
    nodeId: NodeId;
    commands: Array<{ endpointId: EndpointNumber; clusterId: ClusterId; commandName: string; data: unknown }>;
    timedInteractionTimeoutMs?: Duration;
    interactionTimeoutMs?: Duration;
};

/** One entry per command of a {@link BatchedInvokeRequest}, in request order. */
export type BatchedInvokeResult = Array<{ status: Status; clusterStatus?: number; data?: unknown }>;

export type InvokeRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    commandName: string;
    data: unknown;
    timedInteractionTimeoutMs?: Duration;
    interactionTimeoutMs?: Duration;
    /**
     * Identical concurrent invokes are coalesced only within one scope; an unscoped invoke only with other unscoped ones.
     * The WebSocket handler passes the connection object, not its connId, which is recycled.
     */
    dedupScope?: object;
};

export type CommissioningRequest = {
    nodeId?: NodeId;
    knownAddress?: { ip: string; port: number };
    onNetworkOnly?: boolean;
    /** Bounds discovery and PASE; the attempt at `knownAddress` keeps the matter.js PASE limit. */
    discoveryTimeout?: Duration;
    wifiCredentials?: ControllerCommissioningFlowOptions["wifiNetwork"];
    threadCredentials?: ControllerCommissioningFlowOptions["threadNetwork"];
} & (
    | { qrCode: string }
    | { manualCode: string }
    | { passcode: number; vendorId: number; productId?: number }
    | { passcode: number; shortDiscriminator: number }
    | { passcode: number; longDiscriminator: number }
    | { passcode: number; deviceType: number }
    | { passcode: number } // Discover any commissionable device
);

export type CommissioningResponse = {
    nodeId: NodeId;
};

export type DiscoveryRequest = {
    findBy?: CommissionableDeviceIdentifiers;
};

export type DiscoveryResponse = {
    commissioningMode: number;
    deviceName: string;
    deviceType: number;
    hostName: string;
    instanceName: string;
    longDiscriminator: number;
    numIPs: number;
    pairingHint: number;
    pairingInstruction: string;
    port: number;
    productId: number;
    rotatingId: string;
    rotatingIdLen: number;
    shortDiscriminator: number;
    supportsTcpClient: boolean;
    supportsTcpServer: boolean;
    vendorId: number;
    addresses?: string[];
    mrpSessionIdleInterval?: number;
    mrpSessionActiveInterval?: number;
}[];

export type OpenCommissioningWindowRequest = {
    nodeId: NodeId;
    timeout?: number;
};

export type OpenCommissioningWindowResponse = {
    manualCode: string;
    qrCode: string;
    passcode: number;
    discriminator: number;
    vendorId: number;
    productId: number;
    commissioningTimeout: number;
};

import type {
    AttributesData,
    EndpointParentsData,
    InteractionReportData,
    MatterNodeData,
} from "@matter-server/ws-client";

export type { AttributesData, EndpointParentsData, MatterNodeData };

/** A Matter read with full request control. Paths use the `read_attribute` string format, wildcards included. */
export type InteractionReadRequest = {
    nodeId: NodeId;
    /** "endpoint/cluster/attribute" */
    attributePaths?: string[];
    /** "endpoint/cluster/event" */
    eventPaths?: { path: string }[];
    eventMin?: number | bigint;
    /** Defaults to true. */
    fabricFiltered?: boolean;
    /** `path` is "endpoint/cluster", both concrete. */
    dataVersionFilters?: { path: string; dataVersion: number }[];
};

/** A Matter subscribe with full request control; the paths and filters are those of {@link InteractionReadRequest}. */
export type InteractionSubscribeRequest = Omit<InteractionReadRequest, "eventPaths"> & {
    eventPaths?: { path: string; isUrgent?: boolean }[];
    /** Seconds. */
    minInterval: number;
    /** Seconds. */
    maxInterval: number;
    /** Defaults to false. */
    keepSubscriptions?: boolean;
};

/** The data and per-path statuses of one read result or subscription report, in the wire shape. */
export type InteractionReport = InteractionReportData;

/** Receives the reports after the priming report and the end of one subscription. */
export interface InteractionSubscriptionListener {
    report(report: InteractionReport): void;
    /**
     * The subscription ended, whoever ended it. Also called when `subscribe` rejects after matter.js opened the
     * subscription, so a listener ignores a call for a subscription it never received.
     */
    closed(): void;
}

/** A subscription opened with `subscribe`; `close` ends it locally, and the device ends it at its next report. */
export interface InteractionSubscription {
    /** The subscription id the device assigned. */
    readonly id: number;
    readonly nodeId: NodeId;
    /**
     * The first report; later reports reach the listener. Only the caller's data version filters are sent, so every
     * requested cluster the caller does not filter is in it.
     */
    readonly priming: InteractionReport;
    close(): void;
}

/**
 * Interface for node command handlers.
 * Both real nodes (ControllerCommandHandler) and test nodes (TestNodeCommandHandler) implement this.
 */
export interface NodeCommandHandler {
    /**
     * Check if this handler manages the given node ID.
     */
    hasNode(nodeId: NodeId): boolean;

    /**
     * Get full node details in WebSocket API format.
     */
    getNodeDetails(nodeId: NodeId): Promise<MatterNodeData>;

    /**
     * Read multiple attributes from a node by path strings.
     * Handles wildcards in paths (e.g., asterisk/29/asterisk for all descriptor attributes).
     */
    handleReadAttributes(nodeId: NodeId, attributePaths: string[], fabricFiltered?: boolean): Promise<AttributesData>;

    /**
     * Write an attribute to a node.
     */
    handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus[]>;

    handleBatchedInvoke(data: BatchedInvokeRequest): Promise<BatchedInvokeResult>;

    /**
     * Invoke a command on a node.
     */
    handleInvoke(data: InvokeRequest): Promise<unknown>;

    /**
     * Get IP addresses for a node.
     */
    getNodeIpAddresses(nodeId: NodeId, preferCache?: boolean): Promise<string[]>;

    /**
     * Ping a node.
     */
    pingNode(nodeId: NodeId, attempts?: number): Promise<Record<string, boolean>>;

    /**
     * Remove/decommission a node.
     */
    removeNode(nodeId: NodeId): Promise<void>;
}
