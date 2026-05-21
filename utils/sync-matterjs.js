#!/usr/bin/env node
/**
 * Sync Matter.js dependencies to a specific npm tag version.
 *
 * Usage: node utils/sync-matterjs.js [latest|dev]
 *        npm run sync-matterjs [-- latest|dev]
 *
 * Defaults to "dev" tag if no argument provided.
 */

import { glob } from "glob";
import { execFileSync, execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const MATTER_PACKAGES = ["@matter/", "@project-chip/matter.js"];

// Matter.js packages whose versioning is independent of the matter.js core release
// (e.g. @matter/dcl-data ships its own dataset versioning) and must NOT be rewritten
// to the matter.js core version by sync-matterjs.
const EXCLUDED_PACKAGES = new Set(["@matter/dcl-data"]);

async function getVersionFromNpm(tag) {
    // Use @matter/main as the reference package for the version
    const cmd = `npm view @matter/main@${tag} version`;
    try {
        return execSync(cmd, { encoding: "utf-8" }).trim();
    } catch (error) {
        console.error(`Failed to fetch version for tag "${tag}":`, error.message);
        process.exit(1);
    }
}

function isMatterPackage(packageName) {
    if (EXCLUDED_PACKAGES.has(packageName)) return false;
    return MATTER_PACKAGES.some(prefix => packageName.startsWith(prefix));
}

async function updatePackageJson(filePath, version) {
    const content = await readFile(filePath, "utf-8");
    const pkg = JSON.parse(content);
    let modified = false;

    for (const depType of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        const deps = pkg[depType];
        if (!deps) continue;

        for (const [name, currentVersion] of Object.entries(deps)) {
            if (isMatterPackage(name)) {
                const newVersion = `${version}`;
                if (currentVersion !== newVersion) {
                    deps[name] = newVersion;
                    modified = true;
                    console.log(`  ${name}: ${currentVersion} -> ${newVersion}`);
                }
            }
        }
    }

    if (modified) {
        // Preserve original formatting (2-space indent, trailing newline)
        const newContent = JSON.stringify(pkg, null, 4) + "\n";
        await writeFile(filePath, newContent, "utf-8");
        return true;
    }
    return false;
}

async function main() {
    const tag = process.argv[2] ?? "dev";

    if (!["latest", "dev"].includes(tag)) {
        console.error(`Invalid tag "${tag}". Use "latest" or "dev".`);
        process.exit(1);
    }

    console.log(`Fetching Matter.js version for tag "${tag}"...`);
    const version = await getVersionFromNpm(tag);
    console.log(`Found version: ${version}\n`);

    // Find all package.json files
    const packageFiles = ["package.json", ...(await glob("packages/*/package.json"))];

    let totalModified = 0;

    for (const file of packageFiles) {
        console.log(`Checking ${file}...`);
        const modified = await updatePackageJson(file, version);
        if (modified) {
            totalModified++;
        }
    }

    if (totalModified > 0) {
        console.log(`\nUpdated ${totalModified} package.json file(s) to Matter.js ${version}`);
        console.log("\nRunning relock...");
        const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
        execFileSync(npmCmd, ["run", "relock"], { stdio: "inherit" });
    } else {
        console.log("\nNo changes needed - all packages already at the correct version.");
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
