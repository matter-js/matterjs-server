/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    formatHex,
    mapZclType,
    toCamelCase,
    toPascalCase,
    type ParsedCluster,
    type ParsedCommand,
} from "./zap-cluster.js";

const LICENSE_HEADER = `/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
`;

function dedupeName(name: string, taken: Set<string>): string {
    let candidate = name;
    let suffix = 2;
    while (taken.has(candidate)) {
        candidate = `${name}${suffix++}`;
    }
    taken.add(candidate);
    return candidate;
}

function commandClassName(command: ParsedCommand): string {
    return `${toPascalCase(command.name)}Command`;
}

export interface GeneratedSource {
    source: string;
    /** One line per attribute/command/event this run could not translate; empty when everything mapped. */
    notes: string[];
}

/**
 * Renders a `packages/custom-clusters/src/clusters/*.ts` file from a parsed ZAP cluster. Anything this
 * package has no verified decorator pattern for (response-linked commands, events, unmapped datatypes)
 * is left out of the generated code and reported via `notes` plus a trailing comment block instead of
 * guessed at.
 */
export function generateClusterSource(cluster: ParsedCluster, className: string): GeneratedSource {
    const imports = new Set<string>(["attribute", "cluster"]);
    let usesBytes = false;
    const notes: string[] = [];
    const usedPropertyNames = new Set<string>();
    const bodyLines: string[] = [];
    const preludeClasses: string[] = [];

    for (const attr of cluster.attributes) {
        const propertyName = dedupeName(attr.propertyName, usedPropertyNames);
        const isArray = attr.zclType === "array";
        const entrySymbol = isArray && attr.entryType ? mapZclType(attr.entryType) : undefined;
        const scalarSymbol = isArray ? undefined : mapZclType(attr.zclType);

        if (isArray && !entrySymbol) {
            notes.push(`attribute "${attr.name}": array entryType "${attr.entryType ?? "?"}" has no known mapping`);
            continue;
        }
        if (!isArray && !scalarSymbol) {
            notes.push(`attribute "${attr.name}": type "${attr.zclType}" has no known mapping`);
            continue;
        }

        const modifiers: string[] = [isArray ? `listOf(${entrySymbol})` : scalarSymbol!];
        if (isArray) imports.add("listOf");
        const usedSymbol = isArray ? entrySymbol! : scalarSymbol!;
        imports.add(usedSymbol);
        if (usedSymbol === "octstr") usesBytes = true;
        if (attr.writable) {
            modifiers.push("writable");
            imports.add("writable");
        }
        if (attr.mandatory) {
            modifiers.push("mandatory");
            imports.add("mandatory");
        }
        if (attr.nullable) {
            modifiers.push("nullable");
            imports.add("nullable");
        }

        const tsType = isArray ? `${jsTypeFor(entrySymbol!)}[]` : jsTypeFor(scalarSymbol!);
        bodyLines.push(`    @attribute(${formatHex(attr.id)}, ${modifiers.join(", ")})`);
        bodyLines.push(`    ${propertyName}?: ${tsType};`);
        bodyLines.push("");
    }

    for (const command of cluster.commands) {
        const methodName = dedupeName(toCamelCase(command.name), usedPropertyNames);
        imports.add("command");

        if (command.args.length === 0) {
            bodyLines.push(`    @command(${formatHex(command.id)})`);
            bodyLines.push(`    ${methodName}(): void {}`);
            bodyLines.push("");
            continue;
        }

        const argSymbols = command.args.map(arg => ({ arg, symbol: mapZclType(arg.zclType) }));
        const unmapped = argSymbols.filter(a => !a.symbol);
        if (unmapped.length > 0) {
            notes.push(
                `command "${command.name}": argument type(s) ${unmapped.map(a => `"${a.arg.zclType}"`).join(", ")} have no known mapping`,
            );
            continue;
        }

        const argsClassName = commandClassName(command);
        imports.add("field");
        const usedArgNames = new Set<string>();
        const fieldLines = argSymbols
            .map(({ arg, symbol }) => {
                imports.add(symbol!);
                if (symbol === "octstr") usesBytes = true;
                const fieldName = dedupeName(toCamelCase(arg.name), usedArgNames);
                return `    @field(${symbol})\n    ${fieldName}!: ${jsTypeFor(symbol!)};`;
            })
            .join("\n\n");
        preludeClasses.push(
            `/**\n * Input to the {@link ${className}.${methodName}} command.\n */\nclass ${argsClassName} {\n${fieldLines}\n}\n`,
        );

        bodyLines.push(`    @command(${formatHex(command.id)}, ${argsClassName})`);
        bodyLines.push(`    ${methodName}(_request: ${argsClassName}): void {}`);
        bodyLines.push("");
    }

    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") bodyLines.pop();

    const importList = [...imports].sort().join(", ");
    const parts: string[] = [LICENSE_HEADER];
    if (usesBytes) parts.push(`\nimport { Bytes } from "@matter/main";`);
    parts.push(`\nimport { ${importList} } from "@matter/main/model";\n\n`);
    if (preludeClasses.length > 0) {
        parts.push(preludeClasses.join("\n"));
    }
    parts.push(`@cluster(${formatHex(cluster.code)})\nexport class ${className} {\n${bodyLines.join("\n")}\n}\n`);

    const reviewNotes = buildReviewNotes(cluster);
    if (reviewNotes.length > 0) {
        parts.push(
            `\n/*\n * Not auto-generated — review and add manually if needed:\n${reviewNotes.map(n => ` * - ${n}`).join("\n")}\n */\n`,
        );
    }

    return { source: parts.join(""), notes };
}

function buildReviewNotes(cluster: ParsedCluster): string[] {
    const notes: string[] = [];
    for (const command of cluster.commandsNeedingReview) {
        const args = command.args.map(a => `${a.name}: ${a.zclType}`).join(", ");
        notes.push(
            `command "${command.name}" (${formatHex(command.id)}, response: ${command.responseName}) args: [${args}]`,
        );
    }
    for (const event of cluster.events) {
        const fields = event.fields.map(f => `${f.name}: ${f.zclType}`).join(", ");
        notes.push(`event "${event.name}" (${formatHex(event.id)}) fields: [${fields}]`);
    }
    for (const skip of cluster.skipped) {
        if (skip.kind === "attribute") notes.push(`attribute "${skip.name}": ${skip.reason}`);
    }
    return notes;
}

/** TypeScript type for a decorator symbol, matching README.md's "Available Type Imports" table. */
function jsTypeFor(symbol: string): string {
    if (symbol === "bool") return "boolean";
    if (symbol === "string" || symbol === "octstr") return symbol === "octstr" ? "Bytes" : "string";
    if (symbol.startsWith("int") || symbol.startsWith("uint")) {
        const width = parseInt(symbol.replace(/^u?int/, ""), 10);
        // 56/64-bit values can exceed Number.MAX_SAFE_INTEGER (2^53); 48-bit and below always fit.
        return width >= 56 ? "number | bigint" : "number";
    }
    // single, double, enum8, enum16, map8, map16, map32, map64
    return "number";
}
