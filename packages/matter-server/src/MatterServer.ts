/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ConfigStorage,
    Environment,
    LegacyServerData,
    LogDestination,
    LogFormat,
    LogLevel,
    Logger,
    MatterController,
    WebServerHandler,
    WebSocketControllerHandler,
} from "@matter-server/controller";
import { open, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getCliOptions, type LogLevel as CliLogLevel } from "./cli.js";
import {
    addNodeToLegacyServerFile,
    loadLegacyData,
    removeNodeFromLegacyServerFile,
    type LegacyData,
} from "./converter/LegacyDataLoader.js";
import { StaticFileHandler } from "./server/StaticFileHandler.js";
import { WebServer } from "./server/WebServer.js";

// Register the custom clusters
import "@matter-server/custom-clusters";

/**
 * Creates a file-based logger that appends to the given path.
 * The file is opened on start and closed when the process shuts down.
 */
async function createFileLogger(path: string) {
    const fileHandle = await open(path, "a");
    const writer = fileHandle.createWriteStream();
    process.on(
        "beforeExit",
        () => void fileHandle.close().catch(err => err && console.error(`Failed to close log file: ${err}`)),
    );

    return (formattedLog: string) => {
        try {
            writer.write(`${formattedLog}\n`);
        } catch (error) {
            console.error(`Failed to write to log file: ${error}`);
        }
    };
}

// Parse CLI options early for logging setup
const cliOptions = getCliOptions();

/**
 * Map CLI log level strings to Matter.js LogLevel values.
 */
function mapLogLevel(level: CliLogLevel): LogLevel {
    switch (level) {
        case "critical":
            return LogLevel.FATAL;
        case "error":
            return LogLevel.ERROR;
        case "warning":
            return LogLevel.WARN;
        case "info":
            return LogLevel.INFO;
        case "debug":
        case "verbose":
            return LogLevel.DEBUG;
        default:
            return LogLevel.INFO;
    }
}

// Configure logging before anything else
Logger.level = mapLogLevel(cliOptions.logLevel);

const logger = Logger.get("MatterServer");

const env = Environment.default;

// Apply CLI options to environment variables
env.vars.set("storage.path", cliOptions.storagePath);
if (cliOptions.bluetoothAdapter !== null) {
    env.vars.set("ble.enable", true);
    env.vars.set("ble.hci.id", cliOptions.bluetoothAdapter);
}
if (cliOptions.primaryInterface) {
    env.vars.set("mdns.networkInterface", cliOptions.primaryInterface);
}

let controller: MatterController;
let server: WebServer;
let config: ConfigStorage;
let legacyData: LegacyData;

async function start() {
    // Set up file logging if configured
    if (cliOptions.logFile) {
        try {
            const fileWriter = await createFileLogger(cliOptions.logFile);
            Logger.destinations.file = LogDestination({
                write: fileWriter,
                level: mapLogLevel(cliOptions.logLevel),
                format: LogFormat("plain"),
            });
            logger.info(`File logging enabled: ${cliOptions.logFile}`);
        } catch (error) {
            logger.error(`Failed to set up file logging: ${error}`);
        }
    }

    const legacyServerData: LegacyServerData = {
        vendorId: cliOptions.vendorId,
        fabricId: cliOptions.fabricId,
    };

    // Check for and load legacy Python Matter Server data
    legacyData = await loadLegacyData(env, cliOptions.storagePath);
    if (legacyData.error) {
        logger.warn(`Legacy data error: ${legacyData.error}`);
    }
    if (legacyData.hasData) {
        const parts: string[] = [];
        if (legacyData.fabricConfig) {
            parts.push("1 fabric");
            legacyServerData.fabric = legacyData.fabricConfig;
            logger.info("Fabric", legacyServerData.fabric);
        }
        if (legacyData.serverFile) {
            const nodeCount = Object.keys(legacyData.serverFile.nodes).length;
            legacyServerData.nodeData = legacyData.serverFile;
            parts.push(`${nodeCount} node(s)`);
        }
        if (legacyData.certificateAuthorityConfig) {
            parts.push("CA credentials");
            legacyServerData.credentials = legacyData.certificateAuthorityConfig;
            logger.info("Credentials", legacyServerData.credentials);
        }
        logger.info(`Found legacy data: ${parts.join(", ")}`);
    }

    config = await ConfigStorage.create(env);
    controller = await MatterController.create(env, config, legacyServerData);

    // Configure OTA settings after controller is created
    if (cliOptions.enableTestNetDcl) {
        await controller.enableTestOtaImages();
    }

    // Load OTA files from provider directory if configured
    if (cliOptions.otaProviderDir) {
        if (!cliOptions.enableTestNetDcl) {
            logger.warn(
                `OTA provider directory (${cliOptions.otaProviderDir}) is configured but --enable-test-net-dcl is not set. Custom OTA files will be ignored.`,
            );
        } else {
            await loadOtaFiles(cliOptions.otaProviderDir);
        }
    }

    // Subscribe to node events for legacy data file updates
    if (legacyData.fabricConfig) {
        const fabricConfig = legacyData.fabricConfig;
        const storagePath = cliOptions.storagePath;

        controller.commandHandler.events.nodeAdded.on(nodeId => {
            const dateCommissioned = new Date().toISOString();
            addNodeToLegacyServerFile(env, storagePath, fabricConfig, nodeId, dateCommissioned).catch(err => {
                logger.warn(`Failed to update legacy data for commissioned node ${nodeId}:`, err);
            });
        });

        controller.commandHandler.events.nodeDecommissioned.on(nodeId => {
            removeNodeFromLegacyServerFile(env, storagePath, fabricConfig, nodeId).catch(err => {
                logger.warn(`Failed to update legacy data for removed node ${nodeId}:`, err);
            });
        });

        logger.info("Legacy data event handlers configured for node commissioning/decommissioning");
    }

    const handlers: WebServerHandler[] = [new WebSocketControllerHandler(controller, config)];
    if (!cliOptions.disableDashboard) {
        handlers.push(new StaticFileHandler());
    } else {
        logger.info("Dashboard disabled via CLI flag");
    }
    server = new WebServer({ listenAddresses: cliOptions.listenAddress, port: cliOptions.port }, handlers);

    await server.start();
}

/**
 * Load OTA image files from a directory into the internal storage.
 * Files with .json extension are skipped.
 * Successfully loaded files are deleted from the directory.
 */
async function loadOtaFiles(directory: string) {
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

async function stop() {
    console.log("Shutting down...");
    await server?.stop();
    console.log("Server stopped.");
    await controller?.stop();
    console.log("Controller stopped.");
    await config?.close();
    console.log("Config storage closed.");
    process.exit(0);
}

start().catch(err => console.error(err));

process.on("SIGINT", () => void stop().catch(err => console.error(err)));
process.on("SIGTERM", () => void stop().catch(err => console.error(err)));
