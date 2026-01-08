/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, type MatterController } from "@matter-server/ws-controller";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { CliOptions } from "./cli.js";

const logger = Logger.get("MatterServer.Ota");

export async function initializeOta(controller: MatterController, cliOptions: CliOptions) {
    // Configure OTA settings after the controller is created
    if (cliOptions.enableTestNetDcl) {
        await controller.enableTestOtaImages();
    }

    // Load OTA files from the provider directory if configured
    if (cliOptions.otaProviderDir) {
        if (!cliOptions.enableTestNetDcl) {
            logger.warn(
                `OTA provider directory (${cliOptions.otaProviderDir}) is configured but --enable-test-net-dcl is not set. Custom OTA files will be ignored.`,
            );
        } else {
            await loadOtaFiles(controller, cliOptions.otaProviderDir);
        }
    }
}

/**
 * Load OTA image files from a directory into the internal storage.
 * Files with .json extension are skipped.
 * Successfully loaded files are deleted from the directory.
 */
async function loadOtaFiles(controller: MatterController, directory: string) {
    try {
        const files = await readdir(directory);
        for (const file of files) {
            // Skip JSON files (metadata files)
            if (file.toLowerCase().endsWith(".json")) {
                continue;
            }

            const filePath = join(directory, file);
            try {
                const success = await controller.storeOtaImageFromFile(filePath, false);
                if (success) {
                    logger.info(`Loaded OTA file: ${file}`);
                    // Delete the file after a successful import
                    await unlink(filePath);
                    logger.debug(`Deleted OTA file after import: ${file}`);
                }
            } catch (error) {
                logger.error(`Failed to load OTA file ${file}: ${error}`);
                // Continue with the next file
            }
        }
    } catch (error) {
        logger.error(`Failed to read OTA provider directory ${directory}: ${error}`);
    }
}
