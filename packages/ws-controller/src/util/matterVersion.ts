/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to get the Matter.js SDK version from @matter/main package.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

interface PackageJson {
    version: string;
}

/**
 * Get the version of the @matter/main package.
 */
export function getMatterVersion(): string {
    // Use createRequire to resolve the module path, then read the package.json
    const require = createRequire(import.meta.url);
    const matterMainPath = require.resolve("@matter/main");
    // Navigate up from the resolved module to find package.json
    let dir = dirname(matterMainPath);
    while (dir !== "/") {
        try {
            const packageJsonPath = join(dir, "package.json");
            const content = readFileSync(packageJsonPath, "utf-8");
            const pkg = JSON.parse(content) as PackageJson & { name?: string };
            if (pkg.name === "@matter/main") {
                return pkg.version;
            }
        } catch {
            // Continue searching
        }
        dir = dirname(dir);
    }
    throw new Error("Could not find @matter/main package.json");
}

/** Cached Matter.js SDK version */
export const MATTER_VERSION = getMatterVersion();
