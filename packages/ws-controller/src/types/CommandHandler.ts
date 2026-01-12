/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import { AttributeId, ClusterId, CommandId, Duration, EventId, EventNumber, NodeId, Observable } from "@matter/main";
import { CommissionableDeviceIdentifiers } from "@matter/main/protocol";
import { EndpointNumber, Status } from "@matter/main/types";
import { ControllerCommissioningFlowOptions } from "@matter/protocol";

export type ReadAttributeRequest = {
    nodeId: NodeId;
    /** Endpoint ID or undefined for wildcard */
    endpointId?: EndpointNumber;
    /** Cluster ID or undefined for wildcard */
    clusterId?: ClusterId;
    /** Attribute ID or undefined for wildcard */
    attributeId?: AttributeId;
    fabricFiltered?: boolean;
};
export type AttributeResponseData = {
    clusterId: number;
    attributeId: number;
    endpointId: number;
    dataVersion: number;
    value: unknown;
};
export type AttributeResponseStatus = {
    clusterId: number;
    attributeId: number;
    endpointId: number;
    status?: Status;
    clusterStatus?: number;
};
export type ReadAttributeResponse = { values: AttributeResponseData[]; status?: AttributeResponseStatus[] };

export type ReadByIdRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    attributeId: AttributeId;
    fabricFiltered?: boolean;
};
export type AttributeErrorResponseData = {
    clusterId: number;
    attributeId: number;
    endpointId: number;
    error: string;
};

export type ReadByIdResponse = AttributeErrorResponseData;

export type SubscribeAttributeRequest = ReadAttributeRequest & {
    minInterval: number;
    maxInterval: number;
    changeListener: (data: AttributeResponseData) => void;
};
export type SubscribeAttributeResponse = {
    values: AttributeResponseData[];
    updated: Observable<[void]>;
};

export type WriteAttributeRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    attributeId: AttributeId;
    value: unknown;
};

export type WriteAttributeByIdRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    attributeId: AttributeId;
    value: unknown;
};

export type ReadEventRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    eventId: EventId;
    eventMin?: EventNumber;
};
export type EventResponseData = {
    clusterId: number;
    eventId: number;
    endpointId: number;
    eventNumber: number | bigint;
    value: unknown;
};
export type EventResponseStatus = {
    clusterId: number;
    eventId: number;
    endpointId: number;
    status?: Status;
    clusterStatus?: number;
};
export type ReadEventResponse = { values: EventResponseData[]; status?: EventResponseStatus[] };

export type SubscribeEventRequest = ReadEventRequest & {
    minInterval: number;
    maxInterval: number;
    changeListener: (data: EventResponseData) => void;
};
export type SubscribeEventResponse = {
    values: EventResponseData[];
    updated: Observable<[void]>;
};

export type InvokeRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    commandName: string;
    data: unknown;
    timedInteractionTimeoutMs?: Duration;
    interactionTimeoutMs?: Duration;
};
export type InvokeResponse = {
    clusterId: number;
    commandId?: number;
    endpointId: number;
    value?: unknown;
};

export type InvokeByIdRequest = {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    commandId: CommandId;
    data: unknown;
    timedInteractionTimeoutMs?: number;
};

export type DelayRequest = {
    nodeId?: NodeId;
    expireExistingSession?: boolean;
};

export type CommissioningRequest = {
    nodeId?: NodeId;
    knownAddress?: { ip: string; port: number };
    onNetworkOnly?: boolean;
    wifiCredentials?: ControllerCommissioningFlowOptions["wifiNetwork"];
    threadCredentials?: ControllerCommissioningFlowOptions["threadNetwork"];
} & (
    | { qrCode: string }
    | { manualCode: string }
    | { passcode: number; vendorId: number; productId: number }
    | { passcode: number; shortDiscriminator: number }
    | { passcode: number; longDiscriminator: number }
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

export type RootCertificateResponse = {
    RCAC: Uint8Array;
};

export type IssueNocChainRequest = {
    elements: Uint8Array;
    nodeId: NodeId;
};

export type IssueNocChainResponse = {
    ICAC?: Uint8Array;
    IPK: Uint8Array;
    NOC: Uint8Array;
    RCAC: Uint8Array;
};

export type OpenCommissioningWindowRequest = {
    nodeId: NodeId;
    timeout?: number;
};

export type OpenCommissioningWindowResponse = {
    manualCode: string;
    qrCode: string;
};

import { AttributesData, MatterNode } from "./WebSocketMessageTypes.js";

/** MatterNode details for WebSocket API - re-export from WebSocketMessageTypes */
export type { AttributesData };
export type MatterNodeData = MatterNode;

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
     * Get all node IDs managed by this handler.
     */
    getNodeIds(): NodeId[];

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
     * Read attributes from a node.
     */
    handleReadAttribute(data: ReadAttributeRequest): Promise<ReadAttributeResponse>;

    /**
     * Write an attribute to a node.
     */
    handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus>;

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
