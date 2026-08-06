/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { decamelize } from "@matter/main";
import { findAll, findFirst, textOf, type XmlElement } from "./simple-xml.js";

/**
 * ZAP/CHIP `type` and `entryType` values mapped to the `@matter/main/model` decorator symbol that
 * represents them. Values not in this table (custom struct names, unrecognized ZCL aliases) are left
 * unmapped and reported to the caller instead of guessed at.
 *
 * Widths for the semantic ZCL aliases (percent, epoch_s, node_id, ...) follow the Matter core spec's
 * "Data Types" appendix rather than a matter.js-specific export, since not all of those have a
 * dedicated named export.
 */
export const ZCL_TYPE_MAP: Record<string, string> = {
    boolean: "bool",
    bool: "bool",
    single: "single",
    float: "single",
    double: "double",
    octet_string: "octstr",
    long_octet_string: "octstr",
    octstr: "octstr",
    char_string: "string",
    long_char_string: "string",
    string: "string",
    int8u: "uint8",
    int16u: "uint16",
    int24u: "uint24",
    int32u: "uint32",
    int40u: "uint40",
    int48u: "uint48",
    int56u: "uint56",
    int64u: "uint64",
    int8s: "int8",
    int16s: "int16",
    int24s: "int24",
    int32s: "int32",
    int40s: "int40",
    int48s: "int48",
    int56s: "int56",
    int64s: "int64",
    enum8: "enum8",
    enum16: "enum16",
    bitmap8: "map8",
    bitmap16: "map16",
    bitmap32: "map32",
    bitmap64: "map64",
    percent: "uint8",
    percent100ths: "uint16",
    epoch_s: "uint32",
    utc: "uint32",
    epoch_us: "uint64",
    posix_ms: "uint64",
    systime_us: "uint64",
    systime_ms: "uint64",
    elapsed_s: "uint32",
    temperature: "int16",
    amperage_ma: "int64",
    voltage_mv: "int64",
    power_mw: "int64",
    energy_mwh: "int64",
    node_id: "uint64",
    vendor_id: "uint16",
    fabric_id: "uint64",
    fabric_idx: "uint8",
    group_id: "uint16",
    endpoint_no: "uint16",
    cluster_id: "uint32",
    devtype_id: "uint32",
    attrib_id: "uint32",
    field_id: "uint32",
    event_id: "uint32",
    command_id: "uint32",
    trans_id: "uint32",
    action_id: "uint8",
    status: "uint8",
    data_ver: "uint32",
    event_no: "uint64",
    eui64: "octstr",
    ipadr: "octstr",
    ipv4adr: "octstr",
    ipv6adr: "octstr",
    ipv6pre: "octstr",
    hwadr: "octstr",
};

/** Resolves a ZCL type name case-insensitively against {@link ZCL_TYPE_MAP}. */
export function mapZclType(zclType: string): string | undefined {
    return ZCL_TYPE_MAP[zclType] ?? ZCL_TYPE_MAP[zclType.toLowerCase()];
}

/**
 * Parses a `code="0x1234"` or `code="1234"` style value into an integer, preserving the number of hex
 * digits used in the source so generated output round-trips the same width (e.g. `0x0000` vs `0xfff1fc20`).
 */
export function parseCode(raw: string): { value: number; digits: number } {
    const trimmed = raw.trim();
    const hexMatch = /^0x([0-9a-fA-F]+)$/.exec(trimmed);
    if (hexMatch) {
        return { value: parseInt(hexMatch[1], 16), digits: hexMatch[1].length };
    }
    const value = parseInt(trimmed, 10);
    if (Number.isNaN(value)) throw new Error(`Cannot parse code "${raw}"`);
    return { value, digits: Math.max(2, value.toString(16).length) };
}

export function formatHex(code: { value: number; digits: number }): string {
    return `0x${code.value.toString(16).padStart(code.digits, "0")}`;
}

export interface ParsedAttribute {
    id: { value: number; digits: number };
    name: string;
    propertyName: string;
    zclType: string;
    entryType?: string;
    writable: boolean;
    mandatory: boolean;
    nullable: boolean;
}

export interface ParsedCommandArg {
    name: string;
    zclType: string;
}

export interface ParsedCommand {
    id: { value: number; digits: number };
    name: string;
    args: ParsedCommandArg[];
    responseName?: string;
}

export interface ParsedEventField {
    name: string;
    zclType: string;
}

export interface ParsedEvent {
    id: { value: number; digits: number };
    name: string;
    fields: ParsedEventField[];
}

export interface Skipped {
    kind: "attribute" | "command" | "event";
    name: string;
    reason: string;
}

export interface ParsedCluster {
    code: { value: number; digits: number };
    name: string;
    attributes: ParsedAttribute[];
    /** Commands with no response payload — translatable to `@command`, mirroring `heiman.ts`. */
    commands: ParsedCommand[];
    /** Commands with a `response=` link — no verified decorator pattern in this package yet; reported only. */
    commandsNeedingReview: ParsedCommand[];
    /** Events — no verified `@event` usage in this package yet; reported only. */
    events: ParsedEvent[];
    skipped: Skipped[];
}

export function toCamelCase(name: string): string {
    // decamelize splits PascalCase/camelCase runs on word boundaries (FlipFlop -> "flip flop");
    // the surrounding replace/split handles ZCL names that use spaces/underscores/hyphens instead.
    const words = decamelize(name.replace(/[^a-zA-Z0-9]+/g, " "), " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (index === 0) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join("");
}

export function toPascalCase(name: string): string {
    const camel = toCamelCase(name);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Extracts every `<cluster>` from a parsed ZAP configurator document. Server-side attributes are kept;
 * client-side attributes, response-shape commands (referenced via another command's `response`
 * attribute), and events are recorded in `skipped` rather than translated, since this package has no
 * verified decorator pattern for them yet — see `README.md` "Adding a New Custom Cluster".
 */
export function extractClusters(doc: XmlElement): ParsedCluster[] {
    const configurator = findFirst(doc, "configurator");
    if (!configurator) throw new Error("Not a ZAP cluster XML file: missing <configurator> root element");

    return findAll(configurator, "cluster").map(clusterEl => {
        const nameEl = findFirst(clusterEl, "name");
        const codeEl = findFirst(clusterEl, "code");
        if (!nameEl || !codeEl) throw new Error("<cluster> is missing <name> or <code>");

        const skipped: Skipped[] = [];

        const attributes: ParsedAttribute[] = [];
        for (const attrEl of findAll(clusterEl, "attribute")) {
            const name = textOf(attrEl);
            const side = attrEl.attrs.side ?? "server";
            if (side !== "server") {
                skipped.push({
                    kind: "attribute",
                    name,
                    reason: `side="${side}" attributes aren't decoded by this package`,
                });
                continue;
            }
            const zclType = attrEl.attrs.type;
            if (!zclType) {
                skipped.push({ kind: "attribute", name, reason: "missing type= " });
                continue;
            }
            attributes.push({
                id: parseCode(attrEl.attrs.code),
                name,
                propertyName: toCamelCase(name),
                zclType,
                entryType: attrEl.attrs.entryType,
                writable: attrEl.attrs.writable === "true",
                mandatory: attrEl.attrs.optional === "false",
                nullable: attrEl.attrs.isNullable === "true" || attrEl.attrs.nullable === "true",
            });
        }

        const commandEls = findAll(clusterEl, "command");
        const responseShapeNames = new Set(
            commandEls.map(el => el.attrs.response).filter((name): name is string => Boolean(name)),
        );

        const commands: ParsedCommand[] = [];
        const commandsNeedingReview: ParsedCommand[] = [];
        for (const cmdEl of commandEls) {
            const name = cmdEl.attrs.name;
            const source = cmdEl.attrs.source ?? "client";
            if (source === "server") {
                if (!responseShapeNames.has(name)) {
                    skipped.push({
                        kind: "command",
                        name,
                        reason: 'source="server" command with no matching response reference',
                    });
                }
                continue;
            }
            const args: ParsedCommandArg[] = findAll(cmdEl, "arg").map(argEl => ({
                name: argEl.attrs.name,
                zclType: argEl.attrs.type,
            }));
            const command: ParsedCommand = {
                id: parseCode(cmdEl.attrs.code),
                name,
                args,
                responseName: cmdEl.attrs.response,
            };
            if (command.responseName) {
                skipped.push({
                    kind: "command",
                    name,
                    reason: `has a response ("${command.responseName}") — not auto-generated`,
                });
                commandsNeedingReview.push(command);
            } else {
                commands.push(command);
            }
        }

        const events: ParsedEvent[] = [];
        for (const eventEl of findAll(clusterEl, "event")) {
            const name = eventEl.attrs.name;
            skipped.push({ kind: "event", name, reason: "events are not auto-generated" });
            events.push({
                id: parseCode(eventEl.attrs.code),
                name,
                fields: findAll(eventEl, "field").map(fieldEl => ({
                    name: fieldEl.attrs.name,
                    zclType: fieldEl.attrs.type,
                })),
            });
        }

        return {
            code: parseCode(textOf(codeEl)),
            name: textOf(nameEl),
            attributes,
            commands,
            commandsNeedingReview,
            events,
            skipped,
        };
    });
}
