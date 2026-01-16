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
} from "@matter-server/ws-controller";
import { open } from "node:fs/promises";
import { getCliOptions, type LogLevel as CliLogLevel } from "./cli.js";
import {
    addNodeToLegacyServerFile,
    loadLegacyData,
    removeNodeFromLegacyServerFile,
    type LegacyData,
} from "./converter/index.js";
import { StaticFileHandler } from "./server/StaticFileHandler.js";
import { WebServer } from "./server/WebServer.js";

// Register the custom clusters
import "@matter-server/custom-clusters";
import { initializeOta } from "./ota.js";
import { MATTER_SERVER_VERSION } from "./version.js";

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
    // Set up file logging additionally to the console if configured
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

    // If we found a most common fabric label in legacy data, use it as the default
    // (only applies on first migration when no fabricLabel is stored yet)
    if (
        legacyData.mostCommonFabricLabel?.length &&
        legacyData.mostCommonFabricLabel !== "HomeAssistant" &&
        config.fabricLabel === "HomeAssistant"
    ) {
        logger.info(`Setting fabric label from legacy data: "${legacyData.mostCommonFabricLabel}"`);
        await config.set({ fabricLabel: legacyData.mostCommonFabricLabel });
    }
    controller = await MatterController.create(
        env,
        config,
        { enableTestNetDcl: cliOptions.enableTestNetDcl, disableOtaProvider: cliOptions.disableOta },
        legacyServerData,
    );

    if (!cliOptions.disableOta) {
        await initializeOta(controller, cliOptions);
    }

    // Subscribe to node events for legacy data file updates
    if (legacyData.serverFile && legacyData.fabricConfig) {
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

    const handlers: WebServerHandler[] = [new WebSocketControllerHandler(controller, config, MATTER_SERVER_VERSION)];
    if (!cliOptions.disableDashboard) {
        handlers.push(new StaticFileHandler());
    } else {
        logger.info("Dashboard disabled via CLI flag");
    }
    server = new WebServer({ listenAddresses: cliOptions.listenAddress, port: cliOptions.port }, handlers);

    await server.start();
}

async function stop() {
    await server?.stop();
    await controller?.stop();
    await config?.close();
    process.exit(0);
}

start().catch(err => console.error(err));

process.on("SIGINT", () => void stop().catch(err => console.error(err)));
process.on("SIGTERM", () => void stop().catch(err => console.error(err)));
