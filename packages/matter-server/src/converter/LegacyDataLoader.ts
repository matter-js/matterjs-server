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
} from "@matter-server/ws-controller";
import { Millis, Time, Timer } from "@matter/main";
import { access, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_FABRIC_ID, DEFAULT_VENDOR_ID } from "../cli.js";
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
    /** Fabric configuration extracted from chip.json (fabric index 1) */
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
            logger.warn(result.error);
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
    const filesToTry = [serverFilePath, backupFilePath];

    for (const filePath of filesToTry) {
        const isBackup = filePath === backupFilePath;
        const fileLabel = isBackup ? `${serverFileName}.backup` : serverFileName;

        try {
            await access(filePath);
            const content = await readFile(filePath, "utf-8");
            const serverFile = JSON.parse(content) as LegacyServerFile;

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
            } else if (err instanceof SyntaxError) {
                // JSON parse error - log and try backup
                logger.error(`Error parsing server file ${fileLabel}: ${err.message}`);
                // Continue to try backup
            } else {
                logger.warn(`Error loading server file ${fileLabel}: ${err}`);
                // Continue to try backup
            }
        }
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

/**
 * Save the legacy server file back to disk.
 *
 * Backup strategy depends on whether the main file was successfully loaded:
 * - If loadedFromMainFile=true: delete old backup → rename main to backup → write new main
 * - If loadedFromMainFile=false: just write new main (backup is preserved since main was broken)
 *
 * @param env Environment for crypto access
 * @param storagePath Path to the storage directory
 * @param fabricConfig Fabric configuration (needed to compute the file name)
 * @param serverFile The server file data to save
 * @param loadedFromMainFile Whether the data was loaded from the main file (vs backup)
 */
export async function saveLegacyServerFile(
    env: Environment,
    storagePath: string,
    fabricConfig: LegacyFabricConfigData,
    serverFile: LegacyServerFile,
    loadedFromMainFile = true,
): Promise<void> {
    const crypto = env.get(Crypto);
    const compressedFabricId = await computeCompressedNodeId(crypto, fabricConfig.fabricId, fabricConfig.rootPublicKey);
    const serverFileName = `${compressedFabricId}.json`;
    const serverFilePath = join(storagePath, serverFileName);
    const backupFilePath = `${serverFilePath}.backup`;

    if (loadedFromMainFile) {
        // The main file was valid - rotate: delete old backup → rename main to backup → write new main
        try {
            await access(serverFilePath);
            // Delete existing backup if present
            try {
                await unlink(backupFilePath);
                logger.debug(`Deleted old backup: ${serverFileName}.backup`);
            } catch (error) {
                const err = error as NodeJS.ErrnoException;
                if (err.code === "ENOENT") {
                    // No existing backup, that's fine
                    logger.debug(`No existing backup to delete for ${serverFileName}.backup`);
                } else {
                    logger.warn(
                        `Failed to delete existing backup ${serverFileName}.backup (code=${err.code}): ${err.message}`,
                    );
                    throw error;
                }
            }
            // Rename the current main file to backup
            await rename(serverFilePath, backupFilePath);
            logger.debug(`Renamed ${serverFileName} to ${serverFileName}.backup`);
        } catch {
            // Main file doesn't exist yet (new installation), no backup needed
        }
    } else {
        // The main file was broken, we loaded from backup - just write new main, keep backup intact
        logger.debug(`Keeping existing backup intact (main file was corrupted)`);
    }

    const content = JSON.stringify(serverFile, null, 2);
    await writeFile(serverFilePath, content, "utf-8");

    const nodeCount = Object.keys(serverFile.nodes).length;
    logger.info(
        `Saved server data to ${serverFileName}: ${nodeCount} node(s), last_node_id=${serverFile.last_node_id}`,
    );
}

/** Task type for queued operations */
type LegacyWriteTask =
    | { type: "add"; nodeId: bigint | number; dateCommissioned: string }
    | { type: "remove"; nodeId: bigint | number };

/** Default debounce delay in milliseconds (30 seconds) */
const DEFAULT_DEBOUNCE_DELAY_MS = 30_000;

/**
 * Race-condition safe writer for the legacy server file.
 *
 * Batches additions and removals, applies them with a debounce timer,
 * and ensures only one file operation runs at a time. Provides a flush()
 * method to await pending operations during server shutdown.
 */
export class LegacyDataWriter {
    readonly #env: Environment;
    readonly #storagePath: string;
    readonly #fabricConfig: LegacyFabricConfigData;

    /** Queued tasks to apply on next flush */
    #pendingTasks: LegacyWriteTask[] = [];

    /** Timer for debounced writes */
    #debounceTimer: Timer;

    /** Promise for the currently running file operation */
    #activeOperation?: Promise<void>;

    #ended = false;

    constructor(
        env: Environment,
        storagePath: string,
        fabricConfig: LegacyFabricConfigData,
        debounceDelayMs: number = DEFAULT_DEBOUNCE_DELAY_MS,
    ) {
        this.#env = env;
        this.#storagePath = storagePath;
        this.#fabricConfig = fabricConfig;
        this.#debounceTimer = Time.getTimer("legacy-data-writer", Millis(debounceDelayMs), () => this.#onTimerFired());
    }

    /**
     * Queue a node addition. Starts or continues the debounce timer.
     */
    queueAddition(nodeId: bigint | number, dateCommissioned: string): void {
        if (this.#ended) {
            throw new Error("Cannot queue addition after writer has ended");
        }
        this.#pendingTasks.push({ type: "add", nodeId, dateCommissioned });
        logger.debug(`Queued addition of node ${nodeId}`);
        this.#scheduleFlush();
    }

    /**
     * Queue a node removal. Starts or continues the debounce timer.
     */
    queueRemoval(nodeId: bigint | number): void {
        if (this.#ended) {
            throw new Error("Cannot queue removal after writer has ended");
        }
        this.#pendingTasks.push({ type: "remove", nodeId });
        logger.debug(`Queued removal of node ${nodeId}`);
        this.#scheduleFlush();
    }

    /**
     * Check if there are pending tasks or an active operation.
     */
    hasPendingWork(): boolean {
        return this.#pendingTasks.length > 0 || this.#activeOperation !== undefined;
    }

    /**
     * Flush all pending tasks immediately, bypassing the debounce timer.
     * Awaits any currently running operation first.
     * Call this during server shutdown to ensure all changes are persisted.
     */
    async flush(): Promise<void> {
        this.#ended = true;

        // Stop the debounce timer if running
        this.#debounceTimer.stop();

        // Wait for any active operation to complete
        if (this.#activeOperation !== undefined) {
            await this.#activeOperation;
        }

        // Process any remaining tasks
        if (this.#pendingTasks.length > 0) {
            this.#executeTasks();

            // Wait for any active operation to complete
            if (this.#activeOperation !== undefined) {
                await this.#activeOperation;
            }
        }
    }

    /**
     * Schedule a flush after the debounce delay.
     * Does not restart the timer if already running.
     */
    #scheduleFlush(): void {
        // Don't start a new timer if one is already running
        if (this.#debounceTimer.isRunning) {
            return;
        }

        this.#debounceTimer.start();
    }

    /**
     * Called when the debounced timer fires.
     */
    #onTimerFired(): void {
        // If a previous operation is still running, reschedule
        if (this.#activeOperation !== undefined) {
            logger.debug("Previous file operation still running, rescheduling flush");
            this.#scheduleFlush();
            return;
        }

        // Execute the pending tasks
        if (this.#pendingTasks.length > 0) {
            this.#executeTasks();
        }
    }

    /**
     * Execute all pending tasks in a single file operation.
     */
    #executeTasks() {
        // Take all current tasks and clear the queue
        const tasks = this.#pendingTasks;
        this.#pendingTasks = [];

        if (tasks.length === 0) {
            return;
        }

        logger.debug(`Executing ${tasks.length} queued task(s)`);

        // Create the operation promise and store it
        this.#activeOperation = this.#applyTasks(tasks);

        this.#activeOperation
            .catch()
            .catch(error => logger.error("Error executing pending tasks", error))
            .finally(() => {
                this.#activeOperation = undefined;
            });
    }

    /**
     * Apply a batch of tasks to the server file.
     */
    async #applyTasks(tasks: LegacyWriteTask[]): Promise<void> {
        const crypto = this.#env.get(Crypto);
        const compressedFabricId = await computeCompressedNodeId(
            crypto,
            this.#fabricConfig.fabricId,
            this.#fabricConfig.rootPublicKey,
        );
        const serverFileName = `${compressedFabricId}.json`;
        const serverFilePath = join(this.#storagePath, serverFileName);

        // Load an existing file or create a new structure (with backup fallback)
        const backupFilePath = `${serverFilePath}.backup`;
        let serverFile: LegacyServerFile | undefined;
        let loadedFromMainFile = true;

        // First, try to load the main file
        try {
            const content = await readFile(serverFilePath, "utf-8");
            serverFile = JSON.parse(content) as LegacyServerFile;

            // Warn if the nodes key is missing
            if (!serverFile.nodes) {
                logger.warn(`Server file ${serverFileName} is missing "nodes" key`);
                serverFile.nodes = {};
            }
            loadedFromMainFile = true;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.error(`Error loading server file ${serverFileName}: ${err}`);
            }

            // Main file failed, try the backup
            try {
                const content = await readFile(backupFilePath, "utf-8");
                serverFile = JSON.parse(content) as LegacyServerFile;

                // Warn if the nodes key is missing
                if (!serverFile.nodes) {
                    logger.warn(`Backup file ${serverFileName}.backup is missing "nodes" key`);
                    serverFile.nodes = {};
                }

                logger.warn(`Loaded server file from backup: ${serverFileName}.backup`);
                loadedFromMainFile = false;
            } catch (backupErr) {
                if ((backupErr as NodeJS.ErrnoException).code !== "ENOENT") {
                    logger.error(`Error loading backup file ${serverFileName}.backup: ${backupErr}`);
                }
                // Neither file could be loaded, will create new
            }
        }

        // If no file could be loaded, create a new structure
        if (!serverFile) {
            serverFile = {
                vendor_info: {},
                last_node_id: 0,
                nodes: {},
            };
            loadedFromMainFile = true; // Treat the new file as "main file" for backup logic
        }

        // Track changes for logging
        const added: string[] = [];
        const removed: string[] = [];

        // Apply all tasks in order
        for (const task of tasks) {
            const nodeIdNum = typeof task.nodeId === "bigint" ? Number(task.nodeId) : task.nodeId;
            const nodeIdStr = nodeIdNum.toString();

            if (task.type === "add") {
                // Add the node entry
                serverFile.nodes[nodeIdStr] = {
                    node_id: nodeIdNum,
                    date_commissioned: task.dateCommissioned,
                    last_interview: task.dateCommissioned,
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

                added.push(nodeIdStr);
            } else {
                // Remove the node entry
                if (nodeIdStr in serverFile.nodes) {
                    delete serverFile.nodes[nodeIdStr];
                    removed.push(nodeIdStr);
                } else {
                    logger.debug(`Node ${nodeIdStr} not found in legacy server file, skipping removal`);
                }
            }
        }

        // Only save if there were actual changes
        if (added.length > 0 || removed.length > 0) {
            await saveLegacyServerFile(
                this.#env,
                this.#storagePath,
                this.#fabricConfig,
                serverFile,
                loadedFromMainFile,
            );

            const changes: string[] = [];
            if (added.length > 0) {
                changes.push(`added: ${added.join(", ")}`);
            }
            if (removed.length > 0) {
                changes.push(`removed: ${removed.join(", ")}`);
            }
            logger.info(`Batch update to legacy server file: ${changes.join("; ")}`);
        }
    }
}
