/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeModel, Matter } from "@matter/main/model";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Add custom cluster definitions
import "@matter-server/custom-clusters";

/**
 * Generates the descriptions.ts file from matter.js model data.
 * Run with: npx tsx scripts/generate-descriptions.ts
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Preserve the canonical Matter SDK name as-is (no spacing changes).
 * Example: "LocalTemperature" stays "LocalTemperature".
 */
function toLabel(name: string): string {
    return name;
}

interface DeviceType {
    id: number;
    label: string;
}

interface ClusterAttributeDescription {
    id: number;
    cluster_id: number;
    label: string;
    type: string;
}

interface ClusterDescription {
    id: number;
    label: string;
    attributes: { [attribute_id: string]: ClusterAttributeDescription };
}

/**
 * Convert a matter.js type to a display-friendly type string.
 */
function getTypeString(attr: AttributeModel): string {
    const type = attr.type ?? "unknown";
    const metatype = attr.metabase?.metatype;

    // Handle list types
    if (type === "list" && attr.members.length > 0) {
        const entryType = attr.members[0].type ?? "any";
        return `List[${entryType}]`;
    }

    // Handle nullable/optional
    const isNullable = attr.effectiveQuality?.nullable;
    const isOptional = !attr.effectiveConformance?.isMandatory;

    let typeStr = type;

    // Map common metatypes to simpler names
    if (metatype === "integer") {
        typeStr = type; // Keep as int8, uint16, etc.
    } else if (metatype === "boolean") {
        typeStr = "bool";
    } else if (metatype === "string") {
        typeStr = "string";
    } else if (metatype === "bytes") {
        typeStr = "bytes";
    } else if (metatype === "enum") {
        typeStr = type; // Keep the enum type name
    } else if (metatype === "bitmap") {
        typeStr = type; // Keep the bitmap type name
    }

    if (isNullable && isOptional) {
        return `Optional[Nullable[${typeStr}]]`;
    } else if (isNullable) {
        return `Nullable[${typeStr}]`;
    } else if (isOptional) {
        return `Optional[${typeStr}]`;
    }

    return typeStr;
}

function generateDescriptions(): string {
    const deviceTypes: Record<number, DeviceType> = {};
    const clusters: Record<number, ClusterDescription> = {};

    // Generate device types
    for (const deviceType of Matter.deviceTypes) {
        if (deviceType.id === undefined) continue;
        deviceTypes[deviceType.id] = {
            id: deviceType.id,
            label: toLabel(deviceType.name),
        };
    }

    // Generate clusters
    for (const cluster of Matter.clusters) {
        if (cluster.id === undefined) continue;

        const attributes: { [id: string]: ClusterAttributeDescription } = {};

        for (const ace of cluster.allAces) {
            if (ace instanceof AttributeModel && ace.id !== undefined) {
                attributes[ace.id] = {
                    id: ace.id,
                    cluster_id: cluster.id,
                    label: toLabel(ace.name),
                    type: getTypeString(ace),
                };
            }
        }

        clusters[cluster.id] = {
            id: cluster.id,
            label: toLabel(cluster.name),
            attributes,
        };
    }

    // Generate TypeScript file content
    return `
/*
 * Descriptions for SDK Objects.
 * This file is auto-generated, DO NOT edit.
 */

export interface DeviceType {
    id: number;
    label: string;
}

export interface ClusterAttributeDescription {
    id: number;
    cluster_id: number;
    label: string;
    type: string;
}

export interface ClusterDescription {
    id: number;
    label: string;
    attributes: { [attribute_id: string]: ClusterAttributeDescription };
}

export const device_types: Record<number, DeviceType> = ${JSON.stringify(deviceTypes, null, 4)};

export const clusters: Record<number, ClusterDescription> = ${JSON.stringify(clusters, null, 4)};
`.trimStart();
}

// Generate and write the file
const content = generateDescriptions();
const outputPath = join(__dirname, "../src/client/models/descriptions.ts");
writeFileSync(outputPath, content);
console.log(`Generated ${outputPath}`);
