import { readFileSync, writeFileSync } from "node:fs";

// A `bun build --compile`d binary resolves import.meta.url to /$bunfs/...,
// so matter-server's package.json lookups (cli.ts, version.ts) escape to the
// real fs root and crash. Bake the pinned version in instead.
// Fails loudly if upstream restructures (check the new code, adjust, re-pin).
const [ver] = process.argv.slice(2);
if (!ver) throw new Error("usage: matter-compile-patch.mjs <version>");

const vjs = "node_modules/matter-server/dist/esm/version.js";
let s = readFileSync(vjs, "utf8");
const vAnchor = "const MATTER_SERVER_VERSION = getMatterServerVersion();";
if (!s.includes(vAnchor)) throw new Error("version.js pattern gone - check upstream");
s = s.replace(vAnchor, `const MATTER_SERVER_VERSION = ${JSON.stringify(ver)};`);
writeFileSync(vjs, s);

const cjs = "node_modules/matter-server/dist/esm/cli.js";
let c = readFileSync(cjs, "utf8");
const cAnchor = 'const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));';
if (!c.includes(cAnchor)) throw new Error("cli.js pattern gone - check upstream");
c = c.replace(cAnchor, `const packageJson = { version: ${JSON.stringify(ver)} };`);
writeFileSync(cjs, c);

console.log(`patched to ${ver}`);
