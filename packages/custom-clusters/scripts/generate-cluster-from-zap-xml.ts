/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateClusterSource } from "../src/zap-xml/generate-source.js";
import { parseXml, findFirst } from "../src/zap-xml/simple-xml.js";
import { extractClusters, toPascalCase, type ParsedCluster } from "../src/zap-xml/zap-cluster.js";

/**
 * Converts a ZAP/CHIP custom (MEI) cluster definition XML file — e.g. the "sample-mei-cluster.xml"
 * format used by connectedhomeip and exported by Nordic's Matter Cluster Editor — into a
 * `packages/custom-clusters/src/clusters/*.ts` file.
 *
 * Usage:
 *   npx tsx scripts/generate-cluster-from-zap-xml.ts <path-to-xml> [options]
 *
 * Options:
 *   --out <path>        Output file, relative to the package root (default: src/clusters/<kebab-name>.ts)
 *   --class-name <Name>  Override the generated class name (only valid with a single <cluster> in the file)
 *   --dry-run             Print the generated source instead of writing files
 *   --force               Overwrite an existing output file
 */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function toKebabCase(pascalName: string): string {
    return pascalName
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/Cluster$/, "")
        .toLowerCase()
        .replace(/^-+|-+$/g, "");
}

function parseArgs(argv: string[]) {
    const positional: string[] = [];
    const options: { out?: string; className?: string; dryRun: boolean; force: boolean } = {
        dryRun: false,
        force: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--out") options.out = argv[++i];
        else if (arg === "--class-name") options.className = argv[++i];
        else if (arg === "--dry-run") options.dryRun = true;
        else if (arg === "--force") options.force = true;
        else positional.push(arg);
    }
    return { positional, options };
}

function updateIndex(exportFile: string): void {
    const indexPath = join(packageRoot, "src/clusters/index.ts");
    const content = readFileSync(indexPath, "utf8");
    const exportLine = `export * from "./${exportFile}.js";`;
    if (content.includes(exportLine)) return;

    const lines = content.split("\n");
    const exportLineRegex = /^export \* from "\.\/(.+)\.js";$/;
    let inserted = false;
    const result: string[] = [];
    for (const line of lines) {
        const match = exportLineRegex.exec(line);
        if (!inserted && match && exportFile < match[1]) {
            result.push(exportLine);
            inserted = true;
        }
        result.push(line);
    }
    if (!inserted) {
        // Insert before the trailing blank line at EOF, or at the end if there isn't one.
        const lastNonEmpty = result.length - (result[result.length - 1] === "" ? 2 : 1);
        result.splice(lastNonEmpty + 1, 0, exportLine);
    }
    writeFileSync(indexPath, result.join("\n"));
    console.log(`Updated ${indexPath}`);
}

function main(): void {
    const { positional, options } = parseArgs(process.argv.slice(2));
    const [xmlPath] = positional;
    if (!xmlPath) {
        console.error(
            "Usage: generate-cluster-from-zap-xml.ts <path-to-xml> [--out <path>] [--class-name <Name>] [--dry-run] [--force]",
        );
        process.exit(1);
    }

    const source = readFileSync(resolve(xmlPath), "utf8");
    const doc = parseXml(source);
    if (!findFirst(doc, "configurator")) {
        console.error(`${xmlPath} does not look like a ZAP cluster XML file (no <configurator> root element)`);
        process.exit(1);
    }

    const clusters = extractClusters(doc);
    if (clusters.length === 0) {
        console.error(`${xmlPath} contains no <cluster> elements`);
        process.exit(1);
    }
    if (clusters.length > 1 && options.className) {
        console.error("--class-name can only be used with a file containing a single <cluster>");
        process.exit(1);
    }

    const renderedClasses: string[] = [];
    const readmeRows: string[] = [];
    let firstClassName = "";
    let anyNotes = false;

    for (const cluster of clusters) {
        const className = options.className ?? `${toPascalCase(cluster.name)}Cluster`;
        firstClassName ||= className;
        const { source: classSource, notes } = generateClusterSource(cluster, className);
        renderedClasses.push(classSource);
        readmeRows.push(readmeRow(cluster, className));
        reportSummary(cluster, className, notes);
        anyNotes ||= notes.length > 0 || cluster.skipped.length > 0;
    }

    const outFile = options.out ?? `src/clusters/${toKebabCase(firstClassName)}.ts`;
    const outPath = resolve(packageRoot, outFile);
    const combinedSource = renderedClasses.join("\n");

    if (options.dryRun) {
        console.log(`\n--- ${outFile} (dry run, not written) ---\n`);
        console.log(combinedSource);
        return;
    }

    if (existsSync(outPath) && !options.force) {
        console.error(`${outPath} already exists. Pass --force to overwrite, or --out to pick a different path.`);
        process.exit(1);
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, combinedSource);
    console.log(`Wrote ${outPath}`);

    const exportFile = toKebabCase(firstClassName);
    updateIndex(exportFile);

    console.log("\nAdd this row to README.md's cluster table:");
    for (const row of readmeRows) console.log(row);
    console.log("\nNext steps: npm run format && npm run lint && npm run build (from the package or repo root),");
    console.log(
        "then review the generated file — datatypes are inferred from the XML and not verified against a real device.",
    );
    if (anyNotes) {
        console.log(
            "\nSome elements were not translated automatically — see the comment block at the end of the generated file.",
        );
    }
}

function readmeRow(cluster: ParsedCluster, className: string): string {
    const code = `0x${cluster.code.value.toString(16).padStart(cluster.code.digits, "0")}`;
    const vendorId = `0x${(cluster.code.value >>> 16).toString(16).padStart(4, "0")}`;
    return `| \`${className}\` | ${code} | TODO (vendor ${vendorId}) | TODO |`;
}

function reportSummary(cluster: ParsedCluster, className: string, notes: string[]): void {
    console.log(
        `\n${className}: ${cluster.attributes.length} attribute(s) and ${cluster.commands.length} command(s) in source, ${notes.length} not translated`,
    );
    for (const skip of cluster.skipped) {
        console.log(`  skipped ${skip.kind} "${skip.name}": ${skip.reason}`);
    }
    for (const note of notes) {
        console.log(`  skipped: ${note}`);
    }
}

main();
