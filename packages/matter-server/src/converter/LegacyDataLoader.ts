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
import { Millis, Time, Timer } from "@matter/main";
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

// Attribute paths for OperationalCredentials cluster (62/0x3E)
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

        // Extract the most common fabric label from node attributes
        result.mostCommonFabricLabel = extractMostCommonFabricLabel(serverFile);
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
            await saveLegacyServerFile(this.#env, this.#storagePath, this.#fabricConfig, serverFile);

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
