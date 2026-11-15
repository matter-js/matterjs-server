/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, Logger } from "@matter-server/ws-controller";
import { retireLegacyFiles, type LegacyData } from "./LegacyDataLoader.js";

const logger = Logger.get("LegacyRetirement");

export interface LegacyRetirementOptions {
    env: Environment;
    storagePath: string;
    legacyData: LegacyData;
}

/**
 * Retire the Python Matter Server data by renaming its files to `*.migrated`.
 *
 * Call only after a start that holds all of the data (`MatterController.legacyDataMigrated`), while the controller
 * runs. Every step can run again, so a start that ends part-way is finished by the next one.
 *
 * @returns the renamed files
 * @throws MatterError when a file cannot be renamed; the next start tries again
 */
export async function retireLegacyData({ env, storagePath, legacyData }: LegacyRetirementOptions) {
    const { fabricConfig, chipConfig, serverFileUnreadable } = legacyData;
    if (fabricConfig === undefined) {
        return [];
    }
    if (serverFileUnreadable) {
        logger.warn("Keeping the Python Matter Server data: its node file could not be read");
        return [];
    }

    return retireLegacyFiles(env, storagePath, fabricConfig, chipConfig);
}
