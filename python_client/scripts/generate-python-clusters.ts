/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates Python chip cluster definitions from the Matter.js model.
 *
 * Produces:
 *   - python_client/chip/clusters/objects/<ClusterName>.py (one per cluster)
 *   - python_client/chip/clusters/objects/__init__.py
 *   - python_client/chip/clusters/Objects.py (re-export)
 *   - python_client/matter_server/client/models/device_types.py
 *
 * Run with: npx tsx python_client/scripts/generate-python-clusters.ts
 */

import { AttributeModel, ClusterModel, CommandModel, EventModel, Matter, ValueModel } from "@matter/main/model";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Include custom cluster definitions in the model
import "@matter-server/custom-clusters";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pythonClientDir = join(__dirname, "..");
const objectsDir = join(pythonClientDir, "chip", "clusters", "objects");

// ============================================================================
// Name conversion utilities
// ============================================================================

/** Well-known acronyms that chip-clusters preserves as uppercase in class names. */
const ACRONYMS = ["OTA", "DST", "UTC", "NTP", "ICAC", "CSR", "NOC", "CEC", "URL", "PIN", "ACL", "VID", "LED", "RFID", "TC", "CO", "EV", "ID"];

/**
 * Convert a PascalCase name from Matter.js to chip-clusters-compatible PascalCase.
 * Matter.js uses standard PascalCase (e.g., "AnnounceOtaProvider"),
 * chip-clusters preserves known acronyms (e.g., "AnnounceOTAProvider").
 */
function toChipName(name: string): string {
    let result = name;
    for (const acr of ACRONYMS) {
        // Match the title-case version of the acronym at a PascalCase word boundary.
        // The acronym must be followed by an uppercase letter (next word), end-of-string,
        // or a non-alpha character — NOT a lowercase letter (which means it's mid-word).
        const titleCase = acr.charAt(0) + acr.slice(1).toLowerCase();
        const regex = new RegExp(`${titleCase}(?=[A-Z]|$|[^a-zA-Z])`, "g");
        result = result.replace(regex, acr);
    }
    return result;
}

/** Convert camelCase name to kPascalCase (chip SDK enum/bitmap naming). */
function toKName(name: string): string {
    return "k" + name.charAt(0).toUpperCase() + name.slice(1);
}

/** Convert PascalCase name to camelCase (for attribute/field labels). */
function toCamelCase(name: string): string {
    // First apply acronym preservation to get chip-style name
    const chipName = toChipName(name);
    // Then lowercase first char for camelCase
    return chipName.charAt(0).toLowerCase() + chipName.slice(1);
}

/** Pad a hex number to 8 hex digits with 0x prefix. */
function hex8(n: number): string {
    return "0x" + n.toString(16).toUpperCase().padStart(8, "0");
}

/** Pad a hex number to 2 hex digits with 0x prefix. */
function hex2(n: number): string {
    return "0x" + n.toString(16).toUpperCase().padStart(2, "0");
}

// ============================================================================
// Type resolution
// ============================================================================

interface PythonType {
    /** The type annotation string (e.g., "uint", "bool", "typing.List[uint]") */
    annotation: string;
    /** The default value string (e.g., "0", "False", 'b""') */
    defaultValue: string;
    /** Whether the default needs field(default_factory=...) */
    needsFactory: boolean;
}

/**
 * Resolve a Matter.js ValueModel to its Python type, taking into account
 * nullable/optional qualifiers, lists, enums, structs, etc.
 */
function resolvePythonType(
    model: ValueModel,
    clusterName: string,
    knownDatatypes: Map<string, { metatype: string; clusterName: string }>,
): PythonType {
    const type = (model as any).type as string | undefined;
    const metatype = model.effectiveMetatype;
    const isNullable = model.effectiveQuality?.nullable === true;
    const isOptional = !model.effectiveConformance?.isMandatory;

    let baseType: PythonType;

    if (type === "list" || metatype === "array") {
        // List type - get the entry type
        const entryModel = model.children?.[0] as ValueModel | undefined;
        let entryType = "uint";
        if (entryModel) {
            const entryPy = resolvePythonType(entryModel, clusterName, knownDatatypes);
            entryType = entryPy.annotation;
        }
        baseType = {
            annotation: `typing.List[${entryType}]`,
            defaultValue: "field(default_factory=lambda: [])",
            needsFactory: true,
        };
    } else {
        baseType = resolveScalarType(type, metatype, clusterName, knownDatatypes);
    }

    // Apply nullable/optional wrappers
    if (isOptional && isNullable) {
        return {
            annotation: `typing.Union[None, Nullable, ${baseType.annotation}]`,
            defaultValue: "None",
            needsFactory: false,
        };
    } else if (isNullable) {
        return {
            annotation: `typing.Union[Nullable, ${baseType.annotation}]`,
            defaultValue: "NullValue",
            needsFactory: false,
        };
    } else if (isOptional) {
        if (baseType.needsFactory) {
            // Optional list
            return {
                annotation: `typing.Optional[${baseType.annotation}]`,
                defaultValue: "None",
                needsFactory: false,
            };
        }
        return {
            annotation: `typing.Optional[${baseType.annotation}]`,
            defaultValue: "None",
            needsFactory: false,
        };
    }

    return baseType;
}

/** Resolve a scalar (non-list, non-nullable/optional wrapper) type. */
function resolveScalarType(
    type: string | undefined,
    metatype: string | undefined,
    clusterName: string,
    knownDatatypes: Map<string, { metatype: string; clusterName: string }>,
): PythonType {
    if (!type) {
        return { annotation: "uint", defaultValue: "0", needsFactory: false };
    }

    // Check if it's a reference to a known datatype (enum, bitmap, struct)
    // Could be "EnumName" (local) or "OtherCluster.EnumName" (cross-cluster)
    if (type.includes(".")) {
        // Cross-cluster reference
        const [otherCluster, dtName] = type.split(".");
        const key = `${otherCluster}.${dtName}`;
        const info = knownDatatypes.get(key);
        if (info) {
            const qualifiedName = `${otherCluster}.${getCategoryForMetatype(info.metatype)}.${toChipName(dtName)}`;
            return typeForCategory(info.metatype, qualifiedName);
        }
        // Fallback - assume enum
        return { annotation: `${otherCluster}.Enums.${toChipName(dtName)}`, defaultValue: "0", needsFactory: false };
    }

    // Check if it's a local datatype reference
    const localInfo = knownDatatypes.get(`${clusterName}.${type}`);
    if (localInfo) {
        const qualifiedName = `${clusterName}.${getCategoryForMetatype(localInfo.metatype)}.${toChipName(type)}`;
        return typeForCategory(localInfo.metatype, qualifiedName);
    }

    // Check global datatypes
    const globalInfo = knownDatatypes.get(`Globals.${type}`);
    if (globalInfo) {
        const qualifiedName = `Globals.${getCategoryForMetatype(globalInfo.metatype)}.${toChipName(type)}`;
        return typeForCategory(globalInfo.metatype, qualifiedName);
    }

    // Primitive type mapping
    switch (metatype) {
        case "boolean":
            return { annotation: "bool", defaultValue: "False", needsFactory: false };
        case "string":
            return { annotation: "str", defaultValue: '""', needsFactory: false };
        case "bytes":
            return { annotation: "bytes", defaultValue: 'b""', needsFactory: false };
        case "float":
            if (type === "single") {
                return { annotation: "float32", defaultValue: "0.0", needsFactory: false };
            }
            return { annotation: "float", defaultValue: "0.0", needsFactory: false };
        case "integer":
            if (type.startsWith("int")) {
                return { annotation: "int", defaultValue: "0", needsFactory: false };
            }
            return { annotation: "uint", defaultValue: "0", needsFactory: false };
        default:
            // For base primitive types by name
            return resolvePrimitiveByName(type);
    }
}

function resolvePrimitiveByName(type: string): PythonType {
    switch (type) {
        case "bool":
            return { annotation: "bool", defaultValue: "False", needsFactory: false };
        case "string":
        case "locationdesc":
            return { annotation: "str", defaultValue: '""', needsFactory: false };
        case "octstr":
        case "hwadr":
        case "ipv4adr":
        case "ipv6adr":
        case "ipv6pre":
        case "ipadr":
            return { annotation: "bytes", defaultValue: 'b""', needsFactory: false };
        case "single":
            return { annotation: "float32", defaultValue: "0.0", needsFactory: false };
        case "double":
            return { annotation: "float", defaultValue: "0.0", needsFactory: false };
        default:
            // Assume unsigned integer (uint8, uint16, uint32, uint64, etc.)
            return { annotation: "uint", defaultValue: "0", needsFactory: false };
    }
}

function getCategoryForMetatype(metatype: string): string {
    switch (metatype) {
        case "enum": return "Enums";
        case "bitmap": return "Bitmaps";
        case "object": return "Structs";
        default: return "Enums";
    }
}

function typeForCategory(metatype: string, qualifiedName: string): PythonType {
    switch (metatype) {
        case "enum":
            return { annotation: qualifiedName, defaultValue: "0", needsFactory: false };
        case "bitmap":
            return { annotation: qualifiedName, defaultValue: "0", needsFactory: false };
        case "object":
            return { annotation: qualifiedName, defaultValue: `field(default_factory=lambda: ${qualifiedName}())`, needsFactory: true };
        default:
            return { annotation: qualifiedName, defaultValue: "0", needsFactory: false };
    }
}

// ============================================================================
// Cluster inheritance resolution
// ============================================================================

/**
 * For derived clusters (those with `.type`), collect children from the base cluster
 * that are not already overridden locally. The chip-clusters package duplicates all
 * inherited members into derived clusters, so we must do the same.
 */
function resolveClusterChildren(cluster: ClusterModel): {
    datatypes: ValueModel[];
    commands: CommandModel[];
    attributes: ValueModel[];
    events: EventModel[];
} {
    // Collect local children first
    const localDatatypeNames = new Set(
        cluster.children.filter(c => c.tag === "datatype").map(c => c.name),
    );
    const localCommandNames = new Set(
        cluster.children.filter(c => c.tag === "command").map(c => c.name),
    );
    const localAttrNames = new Set(
        cluster.children.filter(c => c.tag === "attribute").map(c => c.name),
    );
    const localEventNames = new Set(
        cluster.children.filter(c => c.tag === "event").map(c => c.name),
    );

    const datatypes = [...cluster.children.filter(c => c.tag === "datatype")] as ValueModel[];
    const commands: CommandModel[] = [...cluster.children.filter(c => c.tag === "command")] as CommandModel[];
    const attributes = [...cluster.children.filter(c => c.tag === "attribute")] as ValueModel[];
    const events: EventModel[] = [...cluster.children.filter(c => c.tag === "event")] as EventModel[];

    // If cluster derives from a base, merge in missing children from the base
    if (cluster.type) {
        const baseCluster = Matter.clusters.find(c => c.name === cluster.type);
        if (baseCluster) {
            for (const child of baseCluster.children) {
                switch (child.tag) {
                    case "datatype":
                        if (!localDatatypeNames.has(child.name)) {
                            datatypes.push(child);
                        }
                        break;
                    case "command":
                        if (!localCommandNames.has(child.name)) {
                            commands.push(child);
                        } else {
                            // Local override exists but may be missing properties (e.g., direction).
                            // Replace it with the base version to get full metadata.
                            const idx = commands.findIndex(c => c.name === child.name);
                            if (idx >= 0 && commands[idx].direction === undefined) {
                                commands[idx] = child;
                            }
                        }
                        break;
                    case "attribute":
                        if (!localAttrNames.has(child.name)) {
                            attributes.push(child);
                        }
                        break;
                    case "event":
                        if (!localEventNames.has(child.name)) {
                            events.push(child);
                        }
                        break;
                }
            }
        }
    }

    return { datatypes, commands, attributes, events };
}

// ============================================================================
// Build the global datatype registry
// ============================================================================

function buildDatatypeRegistry(): Map<string, { metatype: string; clusterName: string }> {
    const registry = new Map<string, { metatype: string; clusterName: string }>();

    // Global datatypes
    for (const dt of Matter.children.filter(c => c.tag === "datatype")) {
        const vm = dt as ValueModel;
        const metatype = vm.effectiveMetatype;
        if (metatype === "enum" || metatype === "bitmap" || metatype === "object") {
            registry.set(`Globals.${dt.name}`, { metatype, clusterName: "Globals" });
        }
    }

    // Per-cluster datatypes (including inherited ones from base clusters)
    for (const cluster of Matter.clusters) {
        if (cluster.id === undefined) continue;
        const { datatypes } = resolveClusterChildren(cluster);
        for (const dt of datatypes) {
            const metatype = dt.effectiveMetatype;
            if (metatype === "enum" || metatype === "bitmap" || metatype === "object") {
                registry.set(`${cluster.name}.${dt.name}`, { metatype, clusterName: cluster.name });
            }
        }
    }

    return registry;
}

// ============================================================================
// Code generation helpers
// ============================================================================

class PythonWriter {
    private lines: string[] = [];
    private indent = 0;

    pushIndent(): void { this.indent++; }
    popIndent(): void { this.indent--; }

    line(text = ""): void {
        if (text === "") {
            this.lines.push("");
        } else {
            this.lines.push("    ".repeat(this.indent) + text);
        }
    }

    blankLine(): void {
        this.lines.push("");
    }

    toString(): string {
        return this.lines.join("\n") + "\n";
    }
}

// ============================================================================
// Cluster file generation
// ============================================================================

interface ClusterGenResult {
    fileName: string;
    className: string;
    content: string;
    crossClusterImports: Set<string>;
}

function generateClusterFile(
    cluster: ClusterModel,
    datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
): ClusterGenResult {
    const w = new PythonWriter();
    const clusterName = cluster.name;
    const clusterId = cluster.id!;
    const crossClusterImports = new Set<string>();

    // Resolve all children including inherited ones from base clusters
    const resolved = resolveClusterChildren(cluster);

    // Collect datatypes
    const enums: ValueModel[] = [];
    const bitmaps: ValueModel[] = [];
    const structs: ValueModel[] = [];
    for (const dt of resolved.datatypes) {
        switch (dt.effectiveMetatype) {
            case "enum": enums.push(dt); break;
            case "bitmap": bitmaps.push(dt); break;
            case "object": structs.push(dt); break;
        }
    }

    // Collect Feature bitmap from FeatureMap attribute
    const features = (cluster as any).features || [];

    // Collect commands (from resolved, which includes inherited)
    const requestCommands = resolved.commands.filter(c => c.direction === "request");
    const responseCommands = resolved.commands.filter(c => c.direction === "response");
    const allCommands = [...requestCommands, ...responseCommands];

    // Collect attributes (excluding global ones that we add ourselves)
    const globalAttrIds = new Set([65528, 65529, 65530, 65531, 65532, 65533]);
    const clusterSpecificAttrs = resolved.attributes.filter(
        c => c.id !== undefined && !globalAttrIds.has(c.id)
    );

    // Collect events (from resolved, which includes inherited)
    const events = resolved.events;

    // Helper to resolve type and track cross-cluster imports
    function resolveType(model: ValueModel): PythonType {
        const result = resolvePythonType(model, clusterName, datatypeRegistry);
        // Check for cross-cluster references in the annotation
        trackCrossClusterImport(result.annotation);
        return result;
    }

    function trackCrossClusterImport(annotation: string) {
        // Match patterns like "OtherCluster.Enums.SomeName" or "OtherCluster.Structs.SomeName"
        const match = annotation.match(/^(\w+)\.(?:Enums|Structs|Bitmaps)\./);
        if (match && match[1] !== clusterName) {
            crossClusterImports.add(match[1]);
        }
        // Also check inside typing wrappers
        const innerMatch = annotation.match(/(?:typing\.(?:List|Optional|Union)\[.*?)(\w+)\.(?:Enums|Structs|Bitmaps)\./g);
        if (innerMatch) {
            for (const m of innerMatch) {
                const nameMatch = m.match(/(\w+)\.(?:Enums|Structs|Bitmaps)\./);
                if (nameMatch && nameMatch[1] !== clusterName) {
                    crossClusterImports.add(nameMatch[1]);
                }
            }
        }
    }

    // ---- Header / imports ----
    w.line(`"""${clusterName} cluster definition (auto-generated, DO NOT edit)."""`);
    w.blankLine();
    w.line("from __future__ import annotations");
    w.blankLine();
    w.line("import typing");
    w.line("from dataclasses import dataclass, field");
    w.line("from enum import IntFlag");
    w.blankLine();
    w.line("from ... import ChipUtility");
    w.line("from ...clusters.enum import MatterIntEnum");
    w.line("from ...tlv import float32, uint");
    w.line("from ..ClusterObjects import (Cluster, ClusterAttributeDescriptor, ClusterCommand, ClusterEvent, ClusterObject,");
    w.line("                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)");
    w.line("from ..Types import Nullable, NullValue");

    // We'll add cross-cluster imports after generating the body
    // (placeholder — will be inserted later)
    const importInsertionPoint = "# CROSS_CLUSTER_IMPORTS_PLACEHOLDER";
    w.line(importInsertionPoint);
    w.blankLine();

    // ---- Cluster class ----
    w.blankLine();
    w.line("@dataclass");
    w.line(`class ${clusterName}(Cluster):`);
    w.pushIndent();
    w.line(`id: typing.ClassVar[int] = ${hex8(clusterId)}`);
    w.blankLine();

    // Descriptor with all attribute fields
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    // Cluster-specific attributes
    for (const attr of clusterSpecificAttrs) {
        const pyType = resolveType(attr);
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(attr.name)}", Tag=${hex8(attr.id!)}, Type=${pyType.annotation}),`);
    }
    // Global attributes (always present)
    w.line(`ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),`);
    w.line(`ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),`);

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Top-level attribute fields
    for (const attr of clusterSpecificAttrs) {
        const pyType = resolveType(attr);
        const label = toCamelCase(attr.name);
        if (pyType.needsFactory) {
            w.line(`${label}: '${pyType.annotation}' = ${pyType.defaultValue}`);
        } else {
            w.line(`${label}: '${pyType.annotation}' = ${pyType.defaultValue}`);
        }
    }
    // Global attribute fields
    w.line(`generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])`);
    w.line(`acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])`);
    w.line(`attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])`);
    w.line(`featureMap: 'uint' = 0`);
    w.line(`clusterRevision: 'uint' = 0`);

    // ---- Enums section ----
    if (enums.length > 0) {
        w.blankLine();
        w.line("class Enums:");
        w.pushIndent();
        for (let i = 0; i < enums.length; i++) {
            generateEnum(w, enums[i]);
            if (i < enums.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Bitmaps section ----
    const hasBitmaps = bitmaps.length > 0 || features.length > 0;
    if (hasBitmaps) {
        w.blankLine();
        w.line("class Bitmaps:");
        w.pushIndent();

        // Feature bitmap
        if (features.length > 0) {
            w.line("class Feature(IntFlag):");
            w.pushIndent();
            for (const f of features) {
                const bitIndex = Number(f.constraint?.value ?? f.constraint?.definition ?? 0);
                const flagValue = 1 << bitIndex;
                w.line(`${toKName(f.title || f.name)} = 0x${flagValue.toString(16).toUpperCase()}`);
            }
            w.popIndent();
            if (bitmaps.length > 0) {
                w.blankLine();
            }
        }

        for (let i = 0; i < bitmaps.length; i++) {
            generateBitmap(w, bitmaps[i]);
            if (i < bitmaps.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Structs section ----
    if (structs.length > 0) {
        w.blankLine();
        w.line("class Structs:");
        w.pushIndent();
        for (let i = 0; i < structs.length; i++) {
            generateStruct(w, structs[i], clusterName, datatypeRegistry, resolveType);
            if (i < structs.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Commands section ----
    if (allCommands.length > 0) {
        w.blankLine();
        w.line("class Commands:");
        w.pushIndent();
        for (let i = 0; i < allCommands.length; i++) {
            generateCommand(w, allCommands[i], clusterName, clusterId, datatypeRegistry, resolveType, responseCommands);
            if (i < allCommands.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Attributes section ----
    w.blankLine();
    w.line("class Attributes:");
    w.pushIndent();

    for (let i = 0; i < clusterSpecificAttrs.length; i++) {
        generateAttribute(w, clusterSpecificAttrs[i] as AttributeModel, clusterName, clusterId, datatypeRegistry, resolveType);
        if (i < clusterSpecificAttrs.length - 1) {
            w.blankLine();
        }
    }

    // Global attributes
    if (clusterSpecificAttrs.length > 0) {
        w.blankLine();
    }
    generateGlobalAttribute(w, "GeneratedCommandList", 0xFFF8, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "AcceptedCommandList", 0xFFF9, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "AttributeList", 0xFFFB, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "FeatureMap", 0xFFFC, "uint", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "ClusterRevision", 0xFFFD, "uint", clusterId);

    w.popIndent();

    // ---- Events section ----
    if (events.length > 0) {
        w.blankLine();
        w.line("class Events:");
        w.pushIndent();
        for (let i = 0; i < events.length; i++) {
            generateEvent(w, events[i], clusterName, clusterId, datatypeRegistry, resolveType);
            if (i < events.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    w.popIndent(); // end of cluster class

    // Now resolve cross-cluster imports and insert them
    let content = w.toString();
    if (crossClusterImports.size > 0) {
        const importLines = Array.from(crossClusterImports).sort().map(
            name => `from .${name} import ${name}`
        ).join("\n");
        content = content.replace(importInsertionPoint, importLines);
    } else {
        content = content.replace(importInsertionPoint + "\n", "");
    }

    return {
        fileName: `${clusterName}.py`,
        className: clusterName,
        content,
        crossClusterImports,
    };
}

// ============================================================================
// Enum generation
// ============================================================================

function generateEnum(w: PythonWriter, model: ValueModel): void {
    w.line(`class ${toChipName(model.name)}(MatterIntEnum):`);
    w.pushIndent();

    const members = model.children || [];
    let maxValue = -1;
    const usedValues = new Set<number>();

    for (const m of members) {
        const value = m.id ?? 0;
        usedValues.add(value);
        if (value > maxValue) maxValue = value;
        w.line(`${toKName(m.name)} = ${hex2(value)}`);
    }

    // Find the kUnknownEnumValue - first unused value after the last defined value
    let unknownValue = maxValue + 1;
    while (usedValues.has(unknownValue)) unknownValue++;

    w.line("# All received enum values that are not listed above will be mapped");
    w.line("# to kUnknownEnumValue. This is a helper enum value that should only");
    w.line("# be used by code to process how it handles receiving an unknown");
    w.line("# enum value. This specific value should never be transmitted.");
    w.line(`kUnknownEnumValue = ${unknownValue}`);

    w.popIndent();
}

// ============================================================================
// Bitmap generation
// ============================================================================

function generateBitmap(w: PythonWriter, model: ValueModel): void {
    w.line(`class ${toChipName(model.name)}(IntFlag):`);
    w.pushIndent();

    const members = model.children || [];
    if (members.length === 0) {
        w.line("pass");
    } else {
        for (const m of members) {
            const constraint = (m as ValueModel).constraint;
            const bitIndex = Number(constraint?.value ?? constraint?.definition ?? 0);
            const flagValue = 1 << bitIndex;
            w.line(`${toKName(m.name)} = 0x${flagValue.toString(16).toUpperCase()}`);
        }
    }

    w.popIndent();
}

// ============================================================================
// Struct generation
// ============================================================================

function generateStruct(
    w: PythonWriter,
    model: ValueModel,
    _clusterName: string,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
): void {
    w.line("@dataclass");
    w.line(`class ${toChipName(model.name)}(ClusterObject):`);
    w.pushIndent();

    // Descriptor
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    const members = model.children || [];
    for (const m of members) {
        const vm = m as ValueModel;
        const pyType = resolveType(vm);
        const tag = m.id ?? 0;
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(m.name)}", Tag=${tag}, Type=${pyType.annotation}),`);
    }

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Fields
    for (const m of members) {
        const vm = m as ValueModel;
        const pyType = resolveType(vm);
        const label = toCamelCase(m.name);
        w.line(`${label}: '${pyType.annotation}' = ${pyType.defaultValue}`);
    }

    if (members.length === 0) {
        w.line("pass");
    }

    w.popIndent();
}

// ============================================================================
// Command generation
// ============================================================================

function generateCommand(
    w: PythonWriter,
    model: CommandModel,
    _clusterName: string,
    clusterId: number,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
    _responseCommands: CommandModel[],
): void {
    const isClient = model.direction === "request";
    const commandId = model.id ?? 0;

    // Determine response_type
    let responseType = "None";
    if (isClient && model.response && model.response !== "status") {
        responseType = `'${toChipName(model.response)}'`;
    }

    w.line("@dataclass");
    w.line(`class ${toChipName(model.name)}(ClusterCommand):`);
    w.pushIndent();

    w.line(`cluster_id: typing.ClassVar[int] = ${hex8(clusterId)}`);
    w.line(`command_id: typing.ClassVar[int] = ${hex8(commandId)}`);
    w.line(`is_client: typing.ClassVar[bool] = ${isClient ? "True" : "False"}`);
    w.line(`response_type: typing.ClassVar[typing.Optional[str]] = ${responseType}`);
    w.blankLine();

    // Descriptor
    const fields = model.children || [];
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(f.name)}", Tag=${f.id ?? 0}, Type=${pyType.annotation}),`);
    }

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Fields
    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`${toCamelCase(f.name)}: '${pyType.annotation}' = ${pyType.defaultValue}`);
    }

    if (fields.length === 0) {
        w.line("pass");
    }

    w.popIndent();
}

// ============================================================================
// Attribute generation
// ============================================================================

function generateAttribute(
    w: PythonWriter,
    model: AttributeModel,
    _clusterName: string,
    clusterId: number,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
): void {
    const attrId = model.id ?? 0;
    const pyType = resolveType(model);

    w.line("@dataclass");
    w.line(`class ${model.name}(ClusterAttributeDescriptor):`);
    w.pushIndent();

    w.line("@ChipUtility.classproperty");
    w.line("def cluster_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(clusterId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(attrId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_type(cls) -> ClusterObjectFieldDescriptor:");
    w.pushIndent();
    w.line(`return ClusterObjectFieldDescriptor(Type=${pyType.annotation})`);
    w.popIndent();
    w.blankLine();

    w.line(`value: '${pyType.annotation}' = ${pyType.defaultValue}`);

    w.popIndent();
}

function generateGlobalAttribute(
    w: PythonWriter,
    name: string,
    attrId: number,
    typeStr: string,
    clusterId: number,
): void {
    const isListType = typeStr.startsWith("typing.List");
    const defaultValue = isListType ? "field(default_factory=lambda: [])" : "0";

    w.line("@dataclass");
    w.line(`class ${name}(ClusterAttributeDescriptor):`);
    w.pushIndent();

    w.line("@ChipUtility.classproperty");
    w.line("def cluster_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(clusterId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(attrId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_type(cls) -> ClusterObjectFieldDescriptor:");
    w.pushIndent();
    w.line(`return ClusterObjectFieldDescriptor(Type=${typeStr})`);
    w.popIndent();
    w.blankLine();

    w.line(`value: '${typeStr}' = ${defaultValue}`);

    w.popIndent();
}

// ============================================================================
// Event generation
// ============================================================================

function generateEvent(
    w: PythonWriter,
    model: EventModel,
    _clusterName: string,
    clusterId: number,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
): void {
    const eventId = model.id ?? 0;

    w.line("@dataclass");
    w.line(`class ${toChipName(model.name)}(ClusterEvent):`);
    w.pushIndent();

    w.line("@ChipUtility.classproperty");
    w.line("def cluster_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(clusterId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def event_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(eventId)}`);
    w.popIndent();
    w.blankLine();

    // Descriptor
    const fields = model.children || [];
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(f.name)}", Tag=${f.id ?? 0}, Type=${pyType.annotation}),`);
    }

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Fields
    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`${toCamelCase(f.name)}: '${pyType.annotation}' = ${pyType.defaultValue}`);
    }

    if (fields.length === 0) {
        w.line("pass");
    }

    w.popIndent();
}

// ============================================================================
// Globals generation (non-Cluster class for global types)
// ============================================================================

function generateGlobalsFile(
    datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
): string {
    const w = new PythonWriter();

    w.line('"""Global datatypes shared across clusters (auto-generated, DO NOT edit)."""');
    w.blankLine();
    w.line("from __future__ import annotations");
    w.blankLine();
    w.line("import typing");
    w.line("from dataclasses import dataclass, field");
    w.line("from enum import IntFlag");
    w.blankLine();
    w.line("from ... import ChipUtility");
    w.line("from ...clusters.enum import MatterIntEnum");
    w.line("from ...tlv import float32, uint");
    w.line("from ..ClusterObjects import (ClusterObject,");
    w.line("                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)");
    w.line("from ..Types import Nullable, NullValue");
    w.blankLine();
    w.blankLine();

    w.line("class Globals:");
    w.pushIndent();

    // Global enums
    const globalEnums = Matter.children.filter(c => c.tag === "datatype" && (c as ValueModel).effectiveMetatype === "enum");
    if (globalEnums.length > 0) {
        w.line("class Enums:");
        w.pushIndent();
        for (const e of globalEnums) {
            generateEnum(w, e as ValueModel);
            w.blankLine();
        }
        w.popIndent();
    }

    // Global bitmaps
    const globalBitmaps = Matter.children.filter(c => c.tag === "datatype" && (c as ValueModel).effectiveMetatype === "bitmap");
    if (globalBitmaps.length > 0) {
        w.blankLine();
        w.line("class Bitmaps:");
        w.pushIndent();
        for (const b of globalBitmaps) {
            generateBitmap(w, b as ValueModel);
            w.blankLine();
        }
        w.popIndent();
    }

    // Global structs
    const globalStructs = Matter.children.filter(c => c.tag === "datatype" && (c as ValueModel).effectiveMetatype === "object");
    if (globalStructs.length > 0) {
        w.blankLine();
        w.line("class Structs:");
        w.pushIndent();
        for (const s of globalStructs) {
            const resolveType = (m: ValueModel) => resolvePythonType(m, "Globals", datatypeRegistry);
            generateStruct(w, s as ValueModel, "Globals", datatypeRegistry, resolveType);
            w.blankLine();
        }
        w.popIndent();
    }

    w.popIndent();

    return w.toString();
}

// ============================================================================
// Objects.py re-export file
// ============================================================================

function generateObjectsReexport(_clusterNames: string[]): string {
    const w = new PythonWriter();

    w.line('"""');
    w.line(" Cluster object definitions.");
    w.line(" This file is auto-generated, DO NOT edit.");
    w.line(' Users can import chip.clusters.Objects to get all cluster definitions.');
    w.line('"""');
    w.blankLine();
    w.line("# Re-export all cluster classes from per-cluster files");
    w.line("from chip.clusters.objects import *  # noqa: F401,F403");
    w.blankLine();
    w.line("# Also re-export base classes for backward compatibility");
    w.line("from chip.clusters.ClusterObjects import (  # noqa: F401");
    w.line("    Cluster,");
    w.line("    ClusterAttributeDescriptor,");
    w.line("    ClusterCommand,");
    w.line("    ClusterEvent,");
    w.line("    ClusterObject,");
    w.line("    ClusterObjectDescriptor,");
    w.line("    ClusterObjectFieldDescriptor,");
    w.line(")");
    w.blankLine();

    return w.toString();
}

// ============================================================================
// objects/__init__.py
// ============================================================================

function generateObjectsInit(clusterNames: string[]): string {
    const w = new PythonWriter();

    w.line('"""Auto-generated cluster imports (DO NOT edit)."""');
    w.blankLine();

    for (const name of clusterNames) {
        w.line(`from .${name} import ${name}`);
    }

    w.blankLine();
    w.line("__all__ = [");
    w.pushIndent();
    for (const name of clusterNames) {
        w.line(`"${name}",`);
    }
    w.popIndent();
    w.line("]");
    w.blankLine();

    return w.toString();
}

// ============================================================================
// device_types.py generation
// ============================================================================

function generateDeviceTypes(): string {
    const w = new PythonWriter();

    w.line('"""');
    w.line(" Device type definitions.");
    w.line(" This file is auto-generated, DO NOT edit.");
    w.line('"""');
    w.blankLine();
    w.line("from __future__ import annotations");
    w.blankLine();
    w.line("from chip.clusters import Objects as all_clusters");
    w.line("from chip.clusters.ClusterObjects import Cluster");
    w.blankLine();
    w.blankLine();

    // Collect cluster names for lookup
    const clustersByName = new Map<string, ClusterModel>();
    for (const c of Matter.clusters) {
        if (c.id !== undefined) clustersByName.set(c.name, c);
    }

    w.line("ALL_TYPES: dict[int, type[DeviceType]] = {}");
    w.blankLine();
    w.blankLine();

    w.line("class DeviceType:");
    w.pushIndent();
    w.line('"""Base class for Matter device types."""');
    w.line("device_type: int = 0");
    w.line("clusters: set[type[Cluster]] = set()");
    w.blankLine();
    w.line("def __init_subclass__(cls, **kwargs) -> None:");
    w.pushIndent();
    w.line("super().__init_subclass__(**kwargs)");
    w.line("if cls.device_type != 0:");
    w.pushIndent();
    w.line("ALL_TYPES[cls.device_type] = cls");
    w.popIndent();
    w.popIndent();
    w.popIndent();
    w.blankLine();
    w.blankLine();

    // Generate device type classes
    const deviceTypesList = Matter.deviceTypes.filter(dt => dt.id !== undefined);
    for (let idx = 0; idx < deviceTypesList.length; idx++) {
        const dt = deviceTypesList[idx];
        const name = dt.name;

        // Get required server clusters
        const requirements = dt.children.filter(c =>
            c.tag === "requirement" && (c as any).element === "serverCluster"
        );

        const clusterRefs: string[] = [];
        for (const req of requirements) {
            const clusterName = req.name;
            if (clustersByName.has(clusterName)) {
                clusterRefs.push(`all_clusters.${clusterName}`);
            }
        }

        w.line(`class ${name}(DeviceType):`);
        w.pushIndent();
        w.line(`device_type: int = 0x${dt.id.toString(16).toUpperCase().padStart(4, "0")}`);

        if (clusterRefs.length === 0) {
            w.line("clusters: set[type[Cluster]] = set()");
        } else {
            w.line("clusters: set[type[Cluster]] = {");
            w.pushIndent();
            for (const ref of clusterRefs.sort()) {
                w.line(`${ref},`);
            }
            w.popIndent();
            w.line("}");
        }

        w.popIndent();
        if (idx < deviceTypesList.length - 1) {
            w.blankLine();
            w.blankLine();
        }
    }

    return w.toString();
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
    console.log("Building datatype registry...");
    const datatypeRegistry = buildDatatypeRegistry();

    // Ensure output directory exists
    if (!existsSync(objectsDir)) {
        mkdirSync(objectsDir, { recursive: true });
    }

    // Generate Globals file
    console.log("Generating Globals.py...");
    const globalsContent = generateGlobalsFile(datatypeRegistry);
    writeFileSync(join(objectsDir, "Globals.py"), globalsContent);

    // Generate per-cluster files
    const results: ClusterGenResult[] = [];
    const clusters = Matter.clusters.filter(c => c.id !== undefined);

    console.log(`Generating ${clusters.length} cluster files...`);
    for (const cluster of clusters) {
        try {
            const result = generateClusterFile(cluster, datatypeRegistry);
            results.push(result);
            writeFileSync(join(objectsDir, result.fileName), result.content);
        } catch (e) {
            console.error(`Error generating ${cluster.name}:`, e);
        }
    }

    // Generate objects/__init__.py
    const allNames = ["Globals", ...results.map(r => r.className).sort()];
    const initContent = generateObjectsInit(allNames);
    writeFileSync(join(objectsDir, "__init__.py"), initContent);

    // Generate Objects.py re-export
    const objectsContent = generateObjectsReexport(allNames);
    writeFileSync(join(pythonClientDir, "chip", "clusters", "Objects.py"), objectsContent);

    // Generate device_types.py
    console.log("Generating device_types.py...");
    const deviceTypesContent = generateDeviceTypes();
    writeFileSync(join(pythonClientDir, "matter_server", "client", "models", "device_types.py"), deviceTypesContent);

    console.log(`Done! Generated ${results.length} cluster files + Globals + Objects.py + device_types.py`);
}

main();
