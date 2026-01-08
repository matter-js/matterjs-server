/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CertificateAuthorityConfiguration,
    computeCompressedNodeId,
    Crypto,
    Environment,
    LegacyFabricConfigData,
    LegacyServerFile,
    Logger,
} from "@matter-server/ws-controller";
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ChipConfigData } from "./index.js";
import type { OperationalCredentials } from "./types.js";

/**
 * Legacy data loader for Python Matter Server storage files.
 *
 * Loads and provides access to data from a Python Matter Server installation:
 * - chip.json: Fabric configuration, certificates, sessions
 * - <compressedNodeId>.json: Node-specific data file
 *
 * Only supports single fabric configurations (fabric index 1).
 */

const logger = Logger.get("LegacyDataLoader");

/** Result of loading legacy data */
export interface LegacyData {
    /** Chip config data (fabric certs, sessions, etc.) */
    chipConfig?: ChipConfigData;
    /** Server file data (vendor info, nodes, etc.) */
    serverFile?: LegacyServerFile;
    /** Fabric configuration extracted from chip.json (fabric index 1) */
    fabricConfig?: LegacyFabricConfigData;
    /** Operational credentials (CA/ICA keys and certs) from credential set 1 */
    operationalCredentials?: OperationalCredentials;
    /** Certificate Authority configuration (parsed from operational credentials) */
    certificateAuthorityConfig?: CertificateAuthorityConfiguration;
    /** Whether any legacy data was found */
    hasData: boolean;
    /** Error message if loading failed */
    error?: string;
}

/**
 * Load legacy Python Matter Server data from a storage directory.
 *
 * Expects:
 * - chip.json: Main configuration file with exactly one fabric (index 1)
 * - <compressedNodeId>.json: Node data file matching the fabric's compressed node ID
 */
export async function loadLegacyData(env: Environment, storagePath: string): Promise<LegacyData> {
    const result: LegacyData = {
        hasData: false,
    };

    // Check if a storage directory exists
    try {
        await access(storagePath);
    } catch {
        logger.debug(`Storage directory not found: ${storagePath}`);
        return result;
    }

    // Try to load chip.json
    const chipJsonPath = join(storagePath, "chip.json");
    let chipConfig: ChipConfigData;
    try {
        await access(chipJsonPath);
        chipConfig = new ChipConfigData();
        await chipConfig.load(chipJsonPath);
        result.chipConfig = chipConfig;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            result.error = `Error loading chip.json: ${err}`;
            logger.warn(result.error);
        } else {
            logger.debug(`No chip.json found at ${chipJsonPath}`);
        }
        return result;
    }

    logger.info(`Loaded legacy chip.json with ${chipConfig.fabrics.size} fabric(s)`);

    // Validate: we expect exactly one fabric with index 1
    const fabricIndices = chipConfig.getFabricIndices();
    if (fabricIndices.length !== 1 || fabricIndices[0] !== 1) {
        result.error = `Expected exactly one fabric with index 1, found indices: [${fabricIndices.join(", ")}]`;
        logger.error(result.error);
        return result;
    }

    // Extract fabric config for index 1
    const fabricConfig = chipConfig.getFabricConfig(1);
    if (!fabricConfig) {
        result.error = "Failed to extract fabric config for index 1";
        logger.error(result.error);
        return result;
    }
    result.fabricConfig = fabricConfig;
    result.hasData = true;
    logger.debug(`Extracted fabric config: fabricId=${fabricConfig.fabricId}, nodeId=${fabricConfig.nodeId}`);

    // Extract operational credentials (credential set 1)
    const credIndices = chipConfig.getOperationalCredentialsIndices();
    if (credIndices.length > 0) {
        // Prefer credential set 1, fall back to the first available
        const credIndex = credIndices.includes(1) ? 1 : credIndices[0];
        const creds = chipConfig.getOperationalCredentials(credIndex);
        if (creds) {
            result.operationalCredentials = creds;
            logger.debug(`Extracted operational credentials from set ${credIndex}`);

            // Also extract CertificateAuthority.Configuration
            const caConfig = await chipConfig.getCertificateAuthorityConfig(credIndex);
            if (caConfig) {
                result.certificateAuthorityConfig = caConfig;
                logger.debug(
                    `Extracted CA config: rootCertId=${caConfig.rootCertId}, hasIcac=${"icacCertBytes" in caConfig && caConfig.icacCertBytes !== undefined}`,
                );
            }
        }
    }

    // Compute the compressed fabric ID to find the server data file
    const crypto = env.get(Crypto);
    const compressedFabricId = await computeCompressedNodeId(crypto, fabricConfig.fabricId, fabricConfig.rootPublicKey);
    const serverFileName = `${compressedFabricId}.json`;
    const serverFilePath = join(storagePath, serverFileName);

    logger.debug(`Looking for server data file: ${serverFileName}`);

    // Try to load the server data file
    try {
        await access(serverFilePath);
        const content = await readFile(serverFilePath, "utf-8");
        const serverFile = JSON.parse(content) as LegacyServerFile;
        result.serverFile = serverFile;

        const nodeCount = Object.keys(serverFile.nodes).length;
        logger.info(
            `Loaded legacy server data from ${serverFileName}: ${nodeCount} node(s), last_node_id=${serverFile.last_node_id}`,
        );
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            logger.warn(`Error loading server file ${serverFileName}: ${err}`);
        } else {
            logger.debug(`No server data file found at ${serverFilePath}`);
        }
        // Server data file is optional, don't fail
    }

    return result;
}

/**
 * Check if a storage directory contains legacy Python Matter Server data.
 *
 * @param storagePath Path to the storage directory
 * @returns true if chip.json exists
 */
export async function hasLegacyData(storagePath: string): Promise<boolean> {
    try {
        await access(join(storagePath, "chip.json"));
        return true;
    } catch {
        return false;
    }
}

/**
 * Save the legacy server file back to disk.
 * Creates a .bak backup of the existing file before overwriting.
 *
 * @param env Environment for crypto access
 * @param storagePath Path to the storage directory
 * @param fabricConfig Fabric configuration (needed to compute the file name)
 * @param serverFile The server file data to save
 */
export async function saveLegacyServerFile(
    env: Environment,
    storagePath: string,
    fabricConfig: LegacyFabricConfigData,
    serverFile: LegacyServerFile,
): Promise<void> {
    const crypto = env.get(Crypto);
    const compressedFabricId = await computeCompressedNodeId(crypto, fabricConfig.fabricId, fabricConfig.rootPublicKey);
    const serverFileName = `${compressedFabricId}.json`;
    const serverFilePath = join(storagePath, serverFileName);
    const backupFilePath = `${serverFilePath}.bak`;

    // Create backup of an existing file if it exists
    try {
        await access(serverFilePath);
        await copyFile(serverFilePath, backupFilePath);
        logger.debug(`Created backup: ${serverFileName}.bak`);
    } catch {
        // File doesn't exist yet, no backup needed
    }

    const content = JSON.stringify(serverFile, null, 2);
    await writeFile(serverFilePath, content, "utf-8");

    const nodeCount = Object.keys(serverFile.nodes).length;
    logger.info(
        `Saved server data to ${serverFileName}: ${nodeCount} node(s), last_node_id=${serverFile.last_node_id}`,
    );
}

/**
 * Add a node to the legacy server file.
 * Loads the file, adds the node entry, and saves it back with a backup.
 *
 * @param env Environment for crypto access
 * @param storagePath Path to the storage directory
 * @param fabricConfig Fabric configuration (needed to compute the file name)
 * @param nodeId The node ID to add
 * @param dateCommissioned The date the node was commissioned (ISO string)
 */
export async function addNodeToLegacyServerFile(
    env: Environment,
    storagePath: string,
    fabricConfig: LegacyFabricConfigData,
    nodeId: bigint | number,
    dateCommissioned: string,
): Promise<void> {
    const crypto = env.get(Crypto);
    const compressedFabricId = await computeCompressedNodeId(crypto, fabricConfig.fabricId, fabricConfig.rootPublicKey);
    const serverFileName = `${compressedFabricId}.json`;
    const serverFilePath = join(storagePath, serverFileName);

    // Load existing file or create a new structure
    let serverFile: LegacyServerFile;
    try {
        const content = await readFile(serverFilePath, "utf-8");
        serverFile = JSON.parse(content) as LegacyServerFile;
    } catch {
        // File doesn't exist, create a new structure
        serverFile = {
            vendor_info: {},
            last_node_id: 0,
            nodes: {},
        };
    }

    const nodeIdNum = typeof nodeId === "bigint" ? Number(nodeId) : nodeId;
    const nodeIdStr = nodeIdNum.toString();

    // Add the node entry (minimal data - just the ID and commissioned date)
    serverFile.nodes[nodeIdStr] = {
        node_id: nodeIdNum,
        date_commissioned: dateCommissioned,
        last_interview: dateCommissioned,
        interview_version: 6,
        available: false,
        is_bridge: false,
        attributes: {},
        attribute_subscriptions: [],
    };

    // Update last_node_id if this node is higher
    if (nodeIdNum > serverFile.last_node_id) {
        serverFile.last_node_id = nodeIdNum;
    }

    await saveLegacyServerFile(env, storagePath, fabricConfig, serverFile);
    logger.info(`Added node ${nodeIdStr} to legacy server file`);
}

/**
 * Remove a node from the legacy server file.
 * Loads the file, removes the node entry, and saves it back with a backup.
 *
 * @param env Environment for crypto access
 * @param storagePath Path to the storage directory
 * @param fabricConfig Fabric configuration (needed to compute the file name)
 * @param nodeId The node ID to remove
 */
export async function removeNodeFromLegacyServerFile(
    env: Environment,
    storagePath: string,
    fabricConfig: LegacyFabricConfigData,
    nodeId: bigint | number,
): Promise<void> {
    const crypto = env.get(Crypto);
    const compressedFabricId = await computeCompressedNodeId(crypto, fabricConfig.fabricId, fabricConfig.rootPublicKey);
    const serverFileName = `${compressedFabricId}.json`;
    const serverFilePath = join(storagePath, serverFileName);

    // Load existing file
    let serverFile: LegacyServerFile;
    try {
        const content = await readFile(serverFilePath, "utf-8");
        serverFile = JSON.parse(content) as LegacyServerFile;
    } catch {
        // File doesn't exist, nothing to remove
        logger.debug(`No legacy server file found, nothing to remove for node ${nodeId}`);
        return;
    }

    const nodeIdStr = (typeof nodeId === "bigint" ? Number(nodeId) : nodeId).toString();

    // Check if node exists
    if (!(nodeIdStr in serverFile.nodes)) {
        logger.debug(`Node ${nodeIdStr} not found in legacy server file`);
        return;
    }

    // Remove the node entry
    delete serverFile.nodes[nodeIdStr];

    await saveLegacyServerFile(env, storagePath, fabricConfig, serverFile);
    logger.info(`Removed node ${nodeIdStr} from legacy server file`);
}
