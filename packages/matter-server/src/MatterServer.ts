/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
// Must be first: applies storage-driver process.env defaults before any matter.js
// import (which loads NodeJsEnvironment and locks in baseline variables).
import "./pre-init.js";
// Register the custom clusters; must stay above the matter.js consuming imports below because extensions of standard
// clusters fail once a cluster model is finalized
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
    cleanupLegacyStorage,
    WebServerHandler,
    WebSocketControllerHandler,
} from "@matter-server/ws-controller";
import { Ble } from "@matter/main/protocol";
import { join } from "node:path";
import { getCliOptions, getOriginalArgv, type LogLevel as CliLogLevel } from "./cli.js";
import { loadLegacyData, missingLegacyNodes, retireLegacyFiles, type LegacyData } from "./converter/index.js";
import { createFileLogger } from "./file-logger.js";
import { initializeOta } from "./ota.js";
import { HealthHandler } from "./server/HealthHandler.js";
import { OtaUploadHandler } from "./server/OtaUploadHandler.js";
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
logger.info(`Command line: ${getOriginalArgv().join(" ") || "(no arguments)"}`);

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

    // A CLI-pinned fabric label overrides any persisted/legacy value and blocks later WS changes,
    // preventing two Home Assistant instances from playing fabric-label ping-pong.
    const pinnedFabricLabel = cliOptions.defaultFabricLabel?.trim();
    if (pinnedFabricLabel) {
        const label = pinnedFabricLabel.substring(0, 32);
        logger.info(`Pinning fabric label to "${label}" via --default-fabric-label`);
        await config.lockFabricLabel(label);
    }

    // Registered before the controller is built: the controller node records BLE availability as behavior
    // state at construction, and that state is what decides whether a BLE scanner is installed.
    let bleProxyHandler: BleProxyHandler | undefined;
    if (cliOptions.bleProxy) {
        bleProxyHandler = new BleProxyHandler();
        env.set(Ble, new ProxyBle(bleProxyHandler, env));
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
            enableTimeSync: cliOptions.enableTimeSync,
            disableThreadDiagnostics: cliOptions.disableThreadDiagnostics,
            otaUpload: {
                // Staged next to the images it feeds, so importing one never crosses a filesystem.
                tempDir: join(cliOptions.otaProviderDir ?? cliOptions.storagePath, "ota-uploads"),
                maxInFlight: cliOptions.otaUploadMaxInFlight,
                maxSizeBytes: cliOptions.otaUploadMaxSizeMb * 1024 * 1024,
            },
        },
        legacyServerData,
    );

    if (!cliOptions.disableOta) {
        await controller.otaUploads.cleanupOrphans();
        controller.commandHandler.events.started.once(async () => await initializeOta(controller, cliOptions));
    }

    const wsHandler = new WebSocketControllerHandler(controller, config, MATTER_SERVER_VERSION);
    const handlers: WebServerHandler[] = [new HealthHandler(wsHandler), wsHandler];
    const reservedPaths = new Array<string>();
    if (!cliOptions.disableOta) {
        handlers.push(new OtaUploadHandler(controller.otaUploads));
        reservedPaths.push("/ota-upload");
    }
    if (bleProxyHandler) {
        handlers.push(bleProxyHandler);
    }
    if (!cliOptions.disableDashboard) {
        handlers.push(new StaticFileHandler(cliOptions.productionMode, reservedPaths));
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

    // Only once the server is up: a start that fails leaves the source untouched and simply retries.
    // Detached from the start path so retiring a large node file cannot delay coming up.
    if (config.legacyRetirementPendingFor === controller.serverId) {
        finishLegacyRetirement(legacyData.fabricConfig).catch(error =>
            logger.warn("Could not finish retiring legacy python-matter-server data:", error),
        );
    } else if (legacyData.hasData && legacyData.fabricConfig !== undefined) {
        retireLegacyData(legacyData.fabricConfig).catch(error =>
            logger.warn("Could not retire legacy python-matter-server data:", error),
        );
    }
}

/** Put the python-matter-server import behind us, once everything it held has arrived. */
async function retireLegacyData(fabricConfig: NonNullable<LegacyData["fabricConfig"]>) {
    if (controller === undefined) {
        return;
    }

    // Guard against retiring a source that did not fully arrive. Every node in the file being retired has
    // to be one the controller now knows, by id: a device commissioned since would otherwise make up the
    // numbers for one that never migrated, and that one's only remaining copy is what this deletes.
    const missing = missingLegacyNodes(legacyData.serverFile, controller.commandHandler.getNodeIds());
    if (missing.length > 0) {
        logger.warn(
            `Keeping legacy data: node(s) ${missing.join(", ")} from the legacy file are unknown to the ` +
                `controller. The next start retries the migration.`,
        );
        return;
    }

    await config.setLegacyRetirementPendingFor(controller.serverId);
    await finishLegacyRetirement(fabricConfig);
}

/**
 * Rename the source files and drop the storage they were imported into.
 *
 * Order matters — the files go first, because they are what would otherwise be re-imported, and the
 * storage cleanup removes the markers that recognise an already-imported node. Resumable on its own: a
 * start that finds the work flagged as unfinished runs it again, renaming whatever is left and repeating
 * a cleanup that has nothing more to remove.
 */
async function finishLegacyRetirement(fabricConfig: LegacyData["fabricConfig"]) {
    if (controller === undefined) {
        return;
    }

    if (fabricConfig !== undefined) {
        const retired = await retireLegacyFiles(env, cliOptions.storagePath, fabricConfig, legacyData.chipConfig);
        if (retired.length > 0) {
            logger.notice(`Migration complete; retired legacy data file(s): ${retired.join(", ")}`);
        }
    }
    if (!(await cleanupLegacyStorage(env, controller.serverId))) {
        // The cleanup refused because the migration is not complete after all. Leaving the job flagged is
        // what gets it another attempt; clearing it here would strand the imported storage.
        return;
    }
    await config.setLegacyRetirementPendingFor(undefined);
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
