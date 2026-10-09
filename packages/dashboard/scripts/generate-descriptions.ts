/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { decamelize } from "@matter/main";
import { AttributeModel, CommandModel, Matter } from "@matter/main/model";
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

/** Global EventList attribute: provisional, since deprecated, so devices do not implement it. */
const EVENT_LIST_ATTRIBUTE_ID = 0xfffa;

/**
 * Names decamelize can't segment as a unit: an acronym with an embedded capital preceded by a lowercase
 * letter (e.g. the "C" in "SoC"), or letters split apart by a digit (e.g. "V2X"). decamelize splits on
 * every lowercase-to-uppercase and letter-to-digit transition, so it reads each of those as its own word
 * start: "SoCReporting" -> "so creporting", "V2X" -> "v2 x". Protecting the acronym behind a
 * digit-suffixed placeholder sidesteps the split, since decamelize does treat digit-to-letter as a boundary.
 */
const ACRONYMS = ["SoC", "V2X"];

/**
 * Convert camelCase name to human-readable label with a title case.
 * e.g., "OnOffLight" -> "On Off Light" when "addSpaces" is set to true, else camelize with first letter uppercase
 */
function toLabel(name: string, addSpaces = false): string {
    if (!addSpaces) {
        return name.replace(/\b\w/g, char => char.toUpperCase());
    }
    let protectedName = name;
    ACRONYMS.forEach((acronym, index) => {
        protectedName = protectedName.split(acronym).join(`Acronym${index}`);
    });
    // Title case: capitalize the first letter of each word
    const label = decamelize(protectedName, " ").replace(/\b\w/g, char => char.toUpperCase());
    // Global, and tolerant of a separator decamelize might insert before the digit (e.g. "Acronym 0"):
    // a plain string .replace() would only fix the first occurrence and only the exact "AcronymN" spelling.
    return ACRONYMS.reduce(
        (text, acronym, index) => text.replace(new RegExp(`Acronym\\s*${index}`, "g"), acronym),
        label,
    );
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
    writable: boolean;
}

interface ClusterCommandDescription {
    id: number;
    cluster_id: number;
    name: string;
    label: string;
}

interface ClusterFeatureDescription {
    bit: number;
    code: string;
    label: string;
}

interface ClusterDescription {
    id: number;
    label: string;
    attributes: { [attribute_id: string]: ClusterAttributeDescription };
    commands: { [command_id: string]: ClusterCommandDescription };
    features: { [bit: string]: ClusterFeatureDescription };
}

interface SemanticTagDescription {
    id: number;
    label: string;
}

interface SemanticTagNamespaceDescription {
    id: number;
    label: string;
    tags: { [tag_id: string]: SemanticTagDescription };
}

/**
 * Convert a matter.js type to a display-friendly type string.
 */
function getTypeString(attr: AttributeModel): string {
    const type = attr.type ?? "unknown";
    const metatype = attr.metabase?.metatype;

    // Handle list types
    if (type === "list" && attr.members.length > 0) {
        const entryType = attr.members.at(0)!.type ?? "any";
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
            label: toLabel(deviceType.name, true),
        };
    }

    // Generate clusters
    for (const cluster of Matter.clusters) {
        if (cluster.id === undefined) continue;

        const attributes: { [id: string]: ClusterAttributeDescription } = {};
        const commands: { [id: string]: ClusterCommandDescription } = {};

        for (const ace of cluster.allAces) {
            if (ace instanceof AttributeModel && ace.id !== undefined) {
                if (ace.id === EVENT_LIST_ATTRIBUTE_ID) continue;
                attributes[ace.id] = {
                    id: ace.id,
                    cluster_id: cluster.id,
                    label: toLabel(ace.name),
                    type: getTypeString(ace),
                    writable: ace.writable,
                };
            } else if (ace instanceof CommandModel && ace.id !== undefined && ace.isRequest) {
                commands[ace.id] = {
                    id: ace.id,
                    cluster_id: cluster.id,
                    name: ace.name,
                    label: toLabel(ace.name, true),
                };
            }
        }

        const features: { [id: string]: ClusterFeatureDescription } = {};
        for (const feature of cluster.features) {
            // Bitmap children key by constraint (the real bit); effectiveId collapses reserved-bit gaps.
            const key = feature.key;
            if (key === undefined || !/^\d+$/.test(key)) {
                throw new Error(`Cluster ${cluster.name} feature ${feature.name} has non-numeric bit key "${key}"`);
            }
            const bit = Number(key);
            features[bit] = {
                bit,
                code: feature.name,
                label: toLabel(feature.title ?? feature.name, true),
            };
        }

        clusters[cluster.id] = {
            id: cluster.id,
            label: toLabel(cluster.name),
            attributes,
            commands,
            features,
        };
    }

    // Generate semantic tag namespaces (Descriptor cluster TagList attribute values reference these)
    const semanticTagNamespaces: Record<number, SemanticTagNamespaceDescription> = {};
    for (const namespace of Matter.semanticNamespaces) {
        if (namespace.id === undefined) continue;

        const tags: { [id: string]: SemanticTagDescription } = {};
        for (const tag of namespace.tags) {
            if (tag.id === undefined) continue;
            tags[tag.id] = {
                id: tag.id,
                label: toLabel(tag.name, true),
            };
        }

        semanticTagNamespaces[namespace.id] = {
            id: namespace.id,
            label: toLabel(namespace.name, true),
            tags,
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
    writable: boolean;
}

export interface ClusterCommandDescription {
    id: number;
    cluster_id: number;
    name: string;
    label: string;
}

export interface ClusterFeatureDescription {
    bit: number;
    code: string;
    label: string;
}

export interface ClusterDescription {
    id: number;
    label: string;
    attributes: { [attribute_id: string]: ClusterAttributeDescription };
    commands: { [command_id: string]: ClusterCommandDescription };
    features: { [bit: string]: ClusterFeatureDescription };
}

export interface SemanticTagDescription {
    id: number;
    label: string;
}

export interface SemanticTagNamespaceDescription {
    id: number;
    label: string;
    tags: { [tag_id: string]: SemanticTagDescription };
}

export const device_types: Record<number, DeviceType> = ${JSON.stringify(deviceTypes, null, 4)};

export const clusters: Record<number, ClusterDescription> = ${JSON.stringify(clusters, null, 4)};

export const semantic_tag_namespaces: Record<number, SemanticTagNamespaceDescription> = ${JSON.stringify(semanticTagNamespaces, null, 4)};
`.trimStart();
}

// Generate and write the file
const content = generateDescriptions();
const outputPath = join(__dirname, "../src/client/models/descriptions.ts");
writeFileSync(outputPath, content);
console.log(`Generated ${outputPath}`);
