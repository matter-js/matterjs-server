/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to get the matter-server package version.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageJson {
    version: string;
    name?: string;
}

/**
 * Get the version of the matter-server package.
 */
function getMatterServerVersion(): string {
    // Get the directory of this module
    const thisFile = fileURLToPath(import.meta.url);
    let dir = dirname(thisFile);

    // Navigate up to find package.json; stop at filesystem root (portable across OS)
    while (dirname(dir) !== dir) {
        try {
            const packageJsonPath = join(dir, "package.json");
            const content = readFileSync(packageJsonPath, "utf-8");
            const pkg = JSON.parse(content) as PackageJson;
            if (pkg.name === "matter-server") {
                return pkg.version;
            }
        } catch {
            // Continue searching
        }
        dir = dirname(dir);
    }
    throw new Error("Could not find matter-server package.json");
}

/** Cached matter-server version */
export const MATTER_SERVER_VERSION = getMatterServerVersion();
