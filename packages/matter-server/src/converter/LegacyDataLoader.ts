/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CertificateAuthorityConfiguration,
    computeCompressedNodeId,
    computeServerId,
    Crypto,
    DEFAULT_SERVER_ID,
    Environment,
    LegacyFabricConfigData,
    LegacyServerFile,
    Logger,
    parseBigIntAwareJson,
} from "@matter-server/ws-controller";
import { MatterError } from "@matter/main";
import { access, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_FABRIC_ID, DEFAULT_VENDOR_ID } from "../cli.js";
import { ChipConfigData } from "./index.js";
import type { OperationalCredentials } from "./types.js";

/**
 * Legacy data loader for Python Matter Server storage files.
 *
 * Loads and provides access to data from a Python Matter Server installation:
 * - chip.json: Fabric configuration and certificates of every fabric
 * - <compressedFabricId>.json: Node data of one fabric
 *
 * The fabric is chosen by vendor ID and fabric ID.
 */

const logger = Logger.get("LegacyDataLoader");

// Attribute paths for the OperationalCredentials cluster (62/0x3E)
const FABRICS_ATTRIBUTE_PATH = "0/62/1"; // Fabrics list
const CURRENT_FABRIC_INDEX_PATH = "0/62/5"; // CurrentFabricIndex

// Keys in the tag-based FabricDescriptor structure
const FABRIC_LABEL_KEY = "5"; // Label field
const FABRIC_INDEX_KEY = "254"; // FabricIndex field

/**
 * Extract the most common fabric label from node attributes.
 *
 * For each node:
 * 1. Gets "0/62/5" (CurrentFabricIndex) - the index of our controller's fabric on that node
 * 2. Finds the matching entry in "0/62/1" (Fabrics) where key "254" equals CurrentFabricIndex
 * 3. Extracts the label (key "5") from that entry
 *
 * Returns the label that appears most frequently across all nodes.
 *
 * @param serverFile The legacy server file with node data
 * @returns The most common fabric label, or undefined if none found
 */
export function extractMostCommonFabricLabel(serverFile: LegacyServerFile): string | undefined {
    const labelCounts = new Map<string, number>();

    for (const nodeData of Object.values(serverFile.nodes)) {
        // Get the current fabric index for this node
        const currentFabricIndex = nodeData.attributes[CURRENT_FABRIC_INDEX_PATH];
        if (typeof currentFabricIndex !== "number") {
            continue;
        }

        // Get the fabrics list
        const fabricsAttr = nodeData.attributes[FABRICS_ATTRIBUTE_PATH];
        if (!Array.isArray(fabricsAttr)) {
            continue;
        }

        // Find the fabric entry matching our fabric index
        for (const fabricDescriptor of fabricsAttr) {
            if (
                fabricDescriptor &&
                typeof fabricDescriptor === "object" &&
                fabricDescriptor[FABRIC_INDEX_KEY] === currentFabricIndex
            ) {
                const label = fabricDescriptor[FABRIC_LABEL_KEY];
                if (typeof label === "string" && label.length > 0) {
                    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
                }
                break; // Found our fabric, no need to check others
            }
        }
    }

    if (labelCounts.size === 0) {
        return undefined;
    }

    // Find the label with the highest count
    let mostCommonLabel: string | undefined;
    let maxCount = 0;
    for (const [label, count] of labelCounts) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonLabel = label;
        }
    }

    if (mostCommonLabel) {
        logger.info(`Found most common fabric label "${mostCommonLabel}" (appeared in ${maxCount} node(s))`);
    }

    return mostCommonLabel;
}

/**
 * Determine the server ID for legacy data migration.
 * The first fabric index gets "server" (aka DEFAULT_SERVER_ID) for backward compatibility.
 * Other fabrics get "server-<hex(fabricId)>-<hex(vendorId)>".
 */
function determineLegacyServerId(fabricId: number | bigint, vendorId: number, isFirstFabric: boolean): string {
    if (isFirstFabric) {
        return DEFAULT_SERVER_ID;
    }
    return computeServerId(fabricId, vendorId);
}

/** Result of loading legacy data */
export interface LegacyData {
    /** Chip config data (fabric certs, sessions, etc.) */
    chipConfig?: ChipConfigData;
    /** Server file data (vendor info, nodes, etc.) */
    serverFile?: LegacyServerFile;
    /** Configuration of the chosen fabric, extracted from chip.json */
    fabricConfig?: LegacyFabricConfigData;
    /** Operational credentials (CA/ICA keys and certs) from credential set 1 */
    operationalCredentials?: OperationalCredentials;
    /** Certificate Authority configuration (parsed from operational credentials) */
    certificateAuthorityConfig?: CertificateAuthorityConfiguration;
    /** Most common fabric label found across all nodes (from attribute 0/62/1) */
    mostCommonFabricLabel?: string;
    /**
     * Server ID to use for the matter.js server and storage ("server" aka DEFAULT_SERVER_ID for the first fabric,
     * "server-<hex>-<hex>" for others)
     */
    serverId?: string;
    /** Whether any legacy data was found */
    hasData: boolean;
    /** The main node file of the fabric exists but could not be read, and no backup stood in for it */
    serverFileUnreadable?: boolean;
    /** Error message if loading failed */
    error?: string;
}

/** Options for loading legacy data */
export interface LegacyDataLoadOptions {
    /** Target vendor ID to match (default: 0xFFF1) */
    vendorId?: number;
    /** Target fabric ID to match (default: 1) */
    fabricId?: number;
}

/**
 * Load legacy Python Matter Server data from a storage directory.
 *
 * Searches chip.json for a fabric matching the target vendorId and fabricId
 * (matching Python Matter Server's fabric selection behavior).
 *
 * Expects:
 * - chip.json: Main configuration file with fabric data
 * - <compressedNodeId>.json: Node data file matching the fabric's compressed node ID
 */
export async function loadLegacyData(
    env: Environment,
    storagePath: string,
    options?: LegacyDataLoadOptions,
): Promise<LegacyData> {
    const targetVendorId = options?.vendorId ?? DEFAULT_VENDOR_ID;
    const targetFabricId = options?.fabricId ?? DEFAULT_FABRIC_ID;

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
            logger.error(result.error);
        } else {
            logger.debug(`No chip.json found at ${chipJsonPath}`);
        }
        return result;
    }

    logger.info(`Loaded legacy chip.json with ${chipConfig.fabrics.size} fabric(s)`);

    // Search for fabric matching target vendorId AND fabricId (like Python does)
    const fabricIndices = chipConfig.getFabricIndices();
    let fabricConfig: LegacyFabricConfigData | undefined;
    let isFirstFabric = false;

    for (let i = 0; i < fabricIndices.length; i++) {
        const fabricIndex = fabricIndices[i];
        const config = chipConfig.getFabricConfig(fabricIndex);
        if (config && config.rootVendorId === targetVendorId && Number(config.fabricId) === targetFabricId) {
            fabricConfig = config;
            isFirstFabric = i === 0; // The first fabric in the list gets "server" ID for backward compatibility
            logger.debug(
                `Found matching fabric at index ${fabricIndex}: vendorId=0x${targetVendorId.toString(16)}, fabricId=${targetFabricId}, isFirst=${isFirstFabric}`,
            );
            break;
        }
    }

    if (!fabricConfig) {
        // Log what we searched for and what we found
        const foundFabrics = fabricIndices
            .map(idx => {
                const cfg = chipConfig.getFabricConfig(idx);
                return cfg ? `index=${idx} vendorId=0x${cfg.rootVendorId.toString(16)} fabricId=${cfg.fabricId}` : null;
            })
            .filter(Boolean);

        result.error =
            `No fabric found matching vendorId=0x${targetVendorId.toString(16)} and fabricId=${targetFabricId}. ` +
            `Available fabrics: [${foundFabrics.join("; ")}]`;
        logger.warn(result.error);
        return result;
    }

    result.fabricConfig = fabricConfig;
    result.serverId = determineLegacyServerId(fabricConfig.fabricId, fabricConfig.rootVendorId, isFirstFabric);
    result.hasData = true;
    logger.info(
        `Extracted fabric config: fabricId=${fabricConfig.fabricId}, vendorId=0x${targetVendorId.toString(16)}, nodeId=${fabricConfig.nodeId}, serverId=${result.serverId}`,
    );

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

    // Try to load the server data file (with backup fallback like Python)
    const backupFilePath = `${serverFilePath}.backup`;
    const filesToTry = [serverFilePath];
    // A retired main file means this fabric was already imported, and the backup is an older copy of the
    // same data: loading it would import nodes that have been removed since.
    if (!(await fileExists(`${serverFilePath}${MIGRATED_SUFFIX}`))) {
        filesToTry.push(backupFilePath);
    }

    for (const filePath of filesToTry) {
        const isBackup = filePath === backupFilePath;
        const fileLabel = isBackup ? `${serverFileName}.backup` : serverFileName;

        try {
            await access(filePath);
            const content = await readFile(filePath, "utf-8");
            const serverFile = parseBigIntAwareJson(content) as LegacyServerFile;

            // Warn if the nodes key is missing
            if (!serverFile.nodes) {
                logger.warn(`Server file ${fileLabel} is missing "nodes" key. Loading anyway ...`);
                serverFile.nodes = {};
            }

            result.serverFile = serverFile;

            const nodeCount = Object.keys(serverFile.nodes).length;
            if (isBackup) {
                logger.warn(
                    `Loaded legacy server data from BACKUP ${fileLabel}: ${nodeCount} node(s), last_node_id=${serverFile.last_node_id}`,
                );
            } else {
                logger.info(
                    `Loaded legacy server data from ${fileLabel}: ${nodeCount} node(s), last_node_id=${serverFile.last_node_id}`,
                );
            }

            // Extract the most common fabric label from node attributes
            result.mostCommonFabricLabel = extractMostCommonFabricLabel(serverFile);
            break; // Successfully loaded, don't try backup
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                if (!isBackup) {
                    logger.debug(`No server data file found at ${filePath}`);
                }
                // Continue to try backup
            } else {
                if (!isBackup) {
                    result.serverFileUnreadable = true;
                }
                if (err instanceof SyntaxError) {
                    logger.error(`Error parsing server file ${fileLabel}: ${err.message}`);
                } else {
                    logger.error(`Error loading server file ${fileLabel}:`, err);
                }
            }
        }
    }
    if (result.serverFile !== undefined) {
        // The backup stood in for the unreadable main file, so the nodes are known after all.
        result.serverFileUnreadable = undefined;
    }
    // Server data file is optional, don't fail if neither exists

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

/** Suffix given to python-matter-server files once their contents live in the current storage. */
const MIGRATED_SUFFIX = ".migrated";

async function fileExists(path: string) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Retire the python-matter-server source files after their contents have been imported.
 *
 * Renamed rather than deleted so an operator can still inspect or recover them. Renaming is what makes
 * the import one-shot: {@link loadLegacyData} looks for exact names, so the node data of a retired fabric is
 * not found again.
 */
export async function retireLegacyFiles(
    env: Environment,
    storagePath: string,
    fabricConfig: LegacyFabricConfigData,
    chipConfig?: Pick<ChipConfigData, "getFabricIndices" | "getFabricConfig">,
): Promise<string[]> {
    const crypto = env.get(Crypto);
    const serverFileNameOf = async (config: LegacyFabricConfigData) =>
        `${await computeCompressedNodeId(crypto, config.fabricId, config.rootPublicKey)}.json`;
    const serverFileName = await serverFileNameOf(fabricConfig);

    const retired = new Array<string>();
    const failed = new Array<string>();
    async function retire(name: string) {
        const from = join(storagePath, name);
        try {
            await rename(from, `${from}${MIGRATED_SUFFIX}`);
            retired.push(name);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return; // Never existed, or a previous run already retired it.
            }
            logger.warn(`Could not retire legacy file ${name}: ${error}`);
            failed.push(name);
        }
    }

    await retire(serverFileName);
    await retire(`${serverFileName}.backup`);

    // chip.json holds the credentials of every fabric. A fabric whose node file is still in place has yet to be
    // migrated by a server started with its vendor and fabric ID, and needs them. A fabric without a node file
    // has no nodes to migrate.
    const pendingFabrics = new Array<string>();
    for (const fabricIndex of chipConfig?.getFabricIndices() ?? []) {
        const other = chipConfig?.getFabricConfig(fabricIndex);
        if (other === undefined || other.fabricId === fabricConfig.fabricId) {
            continue;
        }
        const otherFileName = await serverFileNameOf(other);
        if (
            (await fileExists(join(storagePath, otherFileName))) ||
            (await fileExists(join(storagePath, `${otherFileName}.backup`)))
        ) {
            pendingFabrics.push(otherFileName);
        }
    }
    if (pendingFabrics.length > 0) {
        logger.info(`Keeping chip.json: ${pendingFabrics.length} other fabric(s) still have to be migrated`);
    } else if (failed.length > 0) {
        // The next start reads the fabric from chip.json, and needs it to work out which files this
        // retirement still has to rename.
        logger.info("Keeping chip.json: the retirement of this fabric is unfinished");
    } else {
        await retire("chip.json");
    }
    // A file still under its original name is read again on the next start, which retries the retirement.
    if (failed.length > 0) {
        throw new MatterError(`Could not retire legacy data file(s): ${failed.join(", ")}`);
    }
    return retired;
}
