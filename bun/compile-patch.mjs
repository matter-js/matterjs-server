import { readFileSync, writeFileSync } from "node:fs";

// A `bun build --compile`d binary resolves import.meta.url to /$bunfs/...,
// so matter-server's package.json lookups (cli.ts, version.ts) escape to the
// real fs root and crash. Bake the pinned version in instead.
// Fails loudly if upstream restructures (check the new code, adjust, re-pin).
const [version] = process.argv.slice(2);
if (!version) throw new Error("usage: bun compile-patch.mjs <version>");

const distDir = "node_modules/matter-server/dist/esm";

function patch(file, anchor, replacement) {
    const path = `${distDir}/${file}`;
    const source = readFileSync(path, "utf8");
    const count = source.split(anchor).length - 1;
    if (count !== 1) {
        throw new Error(`${path}: expected exactly one "${anchor}", found ${count} - check upstream`);
    }
    writeFileSync(path, source.replace(anchor, replacement));
}

patch(
    "version.js",
    "const MATTER_SERVER_VERSION = getMatterServerVersion();",
    `const MATTER_SERVER_VERSION = ${JSON.stringify(version)};`,
);
patch(
    "cli.js",
    'const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));',
    `const packageJson = { version: ${JSON.stringify(version)} };`,
);

console.log(`patched matter-server to ${version}`);
