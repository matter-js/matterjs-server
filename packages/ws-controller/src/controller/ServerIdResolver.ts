/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server ID resolution for multi-fabric storage support.
 *
 * Handles determining the appropriate server ID for storage based on:
 * - Explicitly provided server ID
 * - Existing storage directories
 * - Fabric configuration matching
 * - Migration from legacy "server" naming to new format
 */

import { Environment, FabricId, Logger } from "@matter/main";
import { VendorId } from "@matter/main/types";
import { access, rename } from "node:fs/promises";
import { join } from "node:path";
import { ConfigStorage } from "../server/ConfigStorage.js";

const logger = Logger.get("ServerIdResolver");

/** Default server ID for backward compatibility */
export const DEFAULT_SERVER_ID = "server";

/**
 * Compute the server ID for a given fabric configuration.
 * Format: "server-<hex(fabricId)>-<hex(vendorId)>" (lowercase)
 */
export function computeServerId(fabricId: number | bigint, vendorId: number): string {
    return `server-${FabricId(fabricId).toString(16)}-${vendorId.toString(16)}`;
}

/**
 * Check if a storage directory exists.
 */
export async function storageExists(storagePath: string | undefined, serverId: string): Promise<boolean> {
    if (storagePath === undefined) {
        return false;
    }
    try {
        const fullPath = join(storagePath, serverId);
        await access(fullPath);
        return true;
    } catch {
        return false;
    }
}

/** Options for resolving server ID */
export interface ResolveServerIdOptions {
    /** Explicitly provided server ID (overrides resolution) */
    serverId?: string;
}

/**
 * Resolve the server ID to use based on options, legacy data, and existing storage.
 *
 * Resolution logic:
 * 1. If serverId is provided and not "server" -> use directly
 * 2. If serverId is "server" (default) and we have fabricId/vendorId:
 *    a. Check if "server-<hex>-<hex>" directory exists -> use it
 *    b. Check if "server" directory exists:
 *       - Open and verify fabric matches -> rename to new format
 *       - If rename fails -> use "server" as fallback
 *       - If no match -> use "server-<hex>-<hex>"
 *    c. New installation -> use "server-<hex>-<hex>"
 */
export async function resolveServerId(
    env: Environment,
    config: ConfigStorage,
    options: ResolveServerIdOptions,
    vendorId?: number,
    fabricId?: number | bigint,
): Promise<string> {
    const requestedServerId = options.serverId ?? DEFAULT_SERVER_ID;

    // If a specific server ID was provided (not the default), use it directly
    if (requestedServerId !== DEFAULT_SERVER_ID) {
        logger.info(`Using provided server ID: ${requestedServerId}`);
        return requestedServerId;
    }

    // Default was requested - need to determine the right ID based on storage state
    // This only applies when we have a target fabricId/vendorId
    if (vendorId === undefined || fabricId === undefined) {
        logger.info(`Using default server ID (no fabric config): ${DEFAULT_SERVER_ID}`);
        return DEFAULT_SERVER_ID;
    }

    const storagePath = env.vars.get<string>("storage.path");
    const candidateId = computeServerId(fabricId, vendorId);

    // Check if the new format directory already exists
    if (await storageExists(storagePath, candidateId)) {
        logger.info(`Found existing storage for server ID: ${candidateId}`);
        return candidateId;
    }

    // Check if the "server" directory exists (backward compatibility check)
    if (await storageExists(storagePath, DEFAULT_SERVER_ID)) {
        // Open and verify the fabric configuration matches
        try {
            const baseStorage = await config.service.open(DEFAULT_SERVER_ID);
            const fabricsContext = baseStorage.createContext("fabrics");

            // Read fabric entries
            const fabrics = await fabricsContext.get<{ fabricId: FabricId; rootVendorId: VendorId }[]>("fabrics", []);
            if (fabrics.length === 1) {
                // Single fabric - check if it matches
                const fabricData = fabrics[0];
                const storedFabricId = fabricData.fabricId;
                const storedVendorId = fabricData.rootVendorId;
                if (storedFabricId === FabricId(fabricId) && storedVendorId === vendorId) {
                    // Matching fabric - rename to new format to avoid future checks
                    await baseStorage.close();
                    if (storagePath !== undefined) {
                        const oldPath = join(storagePath, DEFAULT_SERVER_ID);
                        const newPath = join(storagePath, candidateId);
                        try {
                            await rename(oldPath, newPath);
                            logger.info(`Renamed storage "${DEFAULT_SERVER_ID}" to "${candidateId}"`);
                            return candidateId;
                        } catch (renameErr) {
                            logger.error(
                                `Failed to rename storage from "${DEFAULT_SERVER_ID}" to "${candidateId}"`,
                                renameErr,
                            );
                            return DEFAULT_SERVER_ID;
                        }
                    }
                    return DEFAULT_SERVER_ID;
                }
            }
            await baseStorage.close();
            logger.info(`Existing "server" storage does not match fabric config, using new ID: ${candidateId}`);
        } catch (err) {
            logger.debug(`Could not verify "server" storage: ${err}`);
        }
    }

    // New installation or no matching storage - use the new format
    logger.info(`Using new server ID format: ${candidateId}`);
    return candidateId;
}
