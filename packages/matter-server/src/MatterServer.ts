/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
// Must be first: applies storage-driver process.env defaults before any matter.js
// import (which loads NodeJsEnvironment and locks in baseline variables).
import "./pre-init.js";
// Register the custom clusters
import "@matter-server/custom-clusters";
// Standard imports
import { BleProxyHandler, ProxyBle } from "@matter-server/ble-proxy";
import {
    ConfigStorage,
    Environment,
    LegacyServerData,
    LogDestination,
    LogFormat,
    LogLevel,
    Logger,
    MatterController,
    StorageService,
    WebServerHandler,
    WebSocketControllerHandler,
} from "@matter-server/ws-controller";
import { Ble } from "@matter/main/protocol";
import { getCliOptions, type LogLevel as CliLogLevel } from "./cli.js";
import { LegacyDataWriter, loadLegacyData, type LegacyData } from "./converter/index.js";
import { createFileLogger } from "./file-logger.js";
import { initializeOta } from "./ota.js";
import { HealthHandler } from "./server/HealthHandler.js";
import { StaticFileHandler } from "./server/StaticFileHandler.js";
import { WebServer } from "./server/WebServer.js";
import { MATTER_SERVER_VERSION } from "./version.js";

// Parse CLI options early for logging setup
const cliOptions = getCliOptions();

/**
 * Map CLI log level strings to Matter.js LogLevel values.
 */
function mapLogLevel(level: CliLogLevel): LogLevel {
    switch (level) {
        case "fatal":
        case "critical": // old Python server loglevel
            return LogLevel.FATAL;
        case "error":
            return LogLevel.ERROR;
        case "warn":
        case "warning": // old Python server loglevel
            return LogLevel.WARN;
        case "notice":
            return LogLevel.NOTICE;
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

// Log command line arguments at startup for debugging
logger.info(`Command line: ${process.argv.slice(2).join(" ") || "(no arguments)"}`);

const env = Environment.default;

// matter-server is sole SIGINT/SIGTERM owner; matter.js's handler would race controller teardown.
env.vars.set("runtime.signals", false);

// Apply CLI options to environment variables
env.vars.set("storage.path", cliOptions.storagePath);
if (cliOptions.bleProxy) {
    if (cliOptions.bluetoothAdapter !== null) {
        logger.warn("--ble-proxy and --bluetooth-adapter are mutually exclusive. Using --ble-proxy.");
    }
    env.vars.set("ble.enable", true);
    logger.info("BLE proxy mode enabled");
} else if (cliOptions.bluetoothAdapter !== null) {
    env.vars.set("ble.enable", true);
    env.vars.set("ble.hci.id", cliOptions.bluetoothAdapter);
    logger.info(`Bluetooth enabled (hci-id=${cliOptions.bluetoothAdapter})`);
}
if (cliOptions.primaryInterface) {
    env.vars.set("mdns.networkInterface", cliOptions.primaryInterface);
}

const storageService = env.get(StorageService);
logger.info(
    `Using storage drivers: kv=${storageService.configuredDriver}, blob=${storageService.configuredBlobDriver}`,
);

let controller: MatterController;
let server: WebServer;
let config: ConfigStorage;
let legacyData: LegacyData;
let legacyDataWriter: LegacyDataWriter | undefined;
let fileLoggerClose: (() => Promise<void>) | undefined;
let stopping = false;
let startCompleted: Promise<void> = Promise.resolve();

async function start() {
    // Set up file logging additionally to the console if configured
    if (cliOptions.logFile) {
        try {
            const fileLogger = await createFileLogger(cliOptions.logFile);
            fileLoggerClose = fileLogger.close;
            Logger.destinations.file = LogDestination({
                write: fileLogger.write,
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
    legacyData = await loadLegacyData(env, cliOptions.storagePath, {
        vendorId: cliOptions.vendorId,
        fabricId: cliOptions.fabricId,
    });
    if (legacyData.error) {
        logger.warn(`Legacy data error: ${legacyData.error}`);
    }
    if (legacyData.hasData) {
        const parts: string[] = [];
        if (legacyData.fabricConfig) {
            parts.push("1 fabric");
            legacyServerData.fabric = legacyData.fabricConfig;
            logger.debug("Fabric", legacyServerData.fabric);
        }
        if (legacyData.serverFile) {
            const nodeCount = Object.keys(legacyData.serverFile.nodes).length;
            legacyServerData.nodeData = legacyData.serverFile;
            parts.push(`${nodeCount} node(s)`);
        }
        if (legacyData.certificateAuthorityConfig) {
            parts.push("CA credentials");
            legacyServerData.credentials = legacyData.certificateAuthorityConfig;
            logger.debug("Credentials", legacyServerData.credentials);
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
        {
            enableTestNetDcl: cliOptions.enableTestNetDcl,
            disableOtaProvider: cliOptions.disableOta,
            disableDclSeed: cliOptions.disableDclSeed,
            serverId: legacyData.serverId,
            serverVersion: MATTER_SERVER_VERSION,
            bleProxyEnabled: cliOptions.bleProxy,
        },
        legacyServerData,
    );

    if (!cliOptions.disableOta) {
        controller.commandHandler.events.started.once(async () => await initializeOta(controller, cliOptions));
    }

    // Subscribe to node events for legacy data file updates
    if (legacyData.serverFile && legacyData.fabricConfig) {
        legacyDataWriter = new LegacyDataWriter(env, cliOptions.storagePath, legacyData.fabricConfig);

        controller.commandHandler.events.nodeAdded.on(nodeId => {
            const dateCommissioned = new Date().toISOString();
            legacyDataWriter!.queueAddition(nodeId, dateCommissioned);
        });

        controller.commandHandler.events.nodeDecommissioned.on(nodeId => {
            legacyDataWriter!.queueRemoval(nodeId);
        });
    }

    // Register the proxy Ble on the environment and the /ble WebSocket handler.
    // Done after MatterController.create() because the controller's BLE bootstrap reads env.Ble
    // and we want the proxy to win even if some path auto-installs a default.
    let bleProxyHandler: BleProxyHandler | undefined;
    if (cliOptions.bleProxy) {
        const existingBle = env.has(Ble) ? env.get(Ble) : undefined;
        if (existingBle) {
            logger.info(`Replacing existing BLE implementation (${existingBle.constructor.name}) with ProxyBle`);
        }
        bleProxyHandler = new BleProxyHandler();
        env.set(Ble, new ProxyBle(bleProxyHandler, env));
    }

    const wsHandler = new WebSocketControllerHandler(controller, config, MATTER_SERVER_VERSION);
    const handlers: WebServerHandler[] = [new HealthHandler(wsHandler), wsHandler];
    if (bleProxyHandler) {
        handlers.push(bleProxyHandler);
    }
    if (!cliOptions.disableDashboard) {
        handlers.push(new StaticFileHandler(cliOptions.productionMode));
    } else {
        logger.info("Dashboard disabled via CLI flag");
    }
    server = new WebServer({ listenAddresses: cliOptions.listenAddress, port: cliOptions.port }, handlers);

    if (!cliOptions.listenAddress) {
        logger.warn(
            `WebSocket server is listening on all network interfaces. Use --listen-address to restrict access. Ensure your environment (firewall, network) prevents unauthorized access.`,
        );
    }

    await server.start();
}

async function stop() {
    if (stopping) {
        return;
    }
    stopping = true;

    // Must run before any await.
    server?.initiateShutdown();

    // Wait for start() to finish (or fail) before tearing down, so we don't
    // race against in-flight initialization that could re-create resources.
    try {
        await startCompleted;
    } catch {
        // start() failed - that's fine, we still need to clean up
    }

    try {
        await server?.stop();
    } catch (err) {
        console.warn("Failed to stop server:", err);
    }
    try {
        await controller?.stop();
    } catch (err) {
        console.warn("Failed to stop controller:", err);
    }
    // Flush any pending legacy data writes before closing
    try {
        if (legacyDataWriter?.hasPendingWork()) {
            logger.info("Flushing pending legacy data writes...");
            await legacyDataWriter.flush();
        }
    } catch (err) {
        console.warn("Failed to flush legacy data:", err);
    }
    try {
        await config?.close();
    } catch (err) {
        console.warn("Failed to close config storage:", err);
    }
    // Wait for the Environment runtime to fully shut down (flushes all storage,
    // completes async worker cleanup). Without this, controller storage like
    // "server-1-fff1" may not be flushed before the process exits.
    try {
        await env.runtime.close();
    } catch (err) {
        console.warn("Failed to close runtime:", err);
    }
    try {
        await fileLoggerClose?.();
    } catch (err) {
        console.warn("Failed to flush log file on shutdown:", err);
    }
}

startCompleted = start().catch(async err => {
    if (!stopping) {
        logger.fatal("Server failed to start", err);
        process.exitCode = 1;
    }
    await config?.close();
});

process.on("SIGINT", () => void stop().catch(err => console.error(err)));
process.on("SIGTERM", () => void stop().catch(err => console.error(err)));
process.on("SIGUSR2", () => env.diagnose());
