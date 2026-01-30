/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** Raw node data from server */
export interface MatterNodeData {
    node_id: number | bigint;
    date_commissioned: string;
    last_interview: string;
    interview_version: number;
    available: boolean;
    is_bridge: boolean;
    attributes: { [key: string]: unknown };
    attribute_subscriptions: Array<[number | null, number | null, number | null]>;
    /**
     * Matter specification version of the node (e.g., "1.2.0", "1.3.0", "1.4.0").
     * Determined from the SpecificationVersion attribute (0x15) if available,
     * otherwise estimated from DataModelRevision (0x0) on BasicInformation cluster.
     * Optional - not available in Python Matter Server.
     */
    matter_version?: string;
}

export class MatterNode {
    node_id: number | bigint;
    date_commissioned: string;
    last_interview: string;
    interview_version: number;
    available: boolean;
    is_bridge: boolean;
    attributes: { [key: string]: unknown };
    attribute_subscriptions: Array<[number | null, number | null, number | null]>;
    /**
     * Matter specification version of the node (e.g., "1.2.0", "1.3.0", "1.4.0").
     * Optional - not available in Python Matter Server.
     */
    matter_version?: string;

    constructor(public data: MatterNodeData) {
        this.node_id = data.node_id;
        this.date_commissioned = data.date_commissioned;
        this.last_interview = data.last_interview;
        this.interview_version = data.interview_version;
        this.available = data.available;
        this.is_bridge = data.is_bridge;
        this.attributes = data.attributes;
        this.attribute_subscriptions = data.attribute_subscriptions;
        this.matter_version = data.matter_version;
    }

    get nodeLabel(): string {
        const label = this.attributes["0/40/5"];
        if (typeof label !== "string") return "";
        if (label.includes("\u0000\u0000")) return "";
        return label.trim();
    }

    get vendorName(): string {
        const value = this.attributes["0/40/1"];
        return typeof value === "string" ? value : "";
    }

    get productName(): string {
        const value = this.attributes["0/40/3"];
        return typeof value === "string" ? value : "";
    }

    get serialNumber(): string {
        const value = this.attributes["0/40/15"];
        return typeof value === "string" ? value : "";
    }

    get updateState(): number | undefined {
        const value = this.attributes["0/42/2"];
        return typeof value === "number" ? value : undefined;
    }

    get updateStateProgress(): number | undefined {
        const value = this.attributes["0/42/3"];
        return typeof value === "number" ? value : undefined;
    }

    update(data: Partial<MatterNodeData>): MatterNode {
        return new MatterNode({ ...this.data, ...data });
    }
}
