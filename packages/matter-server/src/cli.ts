/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CLI argument parser for Matter Server.
 * Compatible with Python Matter Server CLI interface.
 */

import { Command, Option } from "commander";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

// Read version from package.json
// Path is relative to dist/esm/ where compiled code runs
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };
const VERSION = packageJson.version;

// Default values
const DEFAULT_VENDOR_ID = 0xfff1;
const DEFAULT_PORT = 5580;
const DEFAULT_STORAGE_PATH = join(homedir(), ".matter_server");

// Log level enums
const LOG_LEVELS = ["critical", "error", "warning", "info", "debug", "verbose"] as const;
const SDK_LOG_LEVELS = ["none", "error", "progress", "detail", "automation"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type SdkLogLevel = (typeof SDK_LOG_LEVELS)[number];

export interface CliOptions {
    // Fabric configuration
    vendorId: number;
    fabricId: number | undefined;

    // Server configuration
    storagePath: string;
    port: number;
    listenAddress: string[] | null;

    // Logging configuration
    logLevel: LogLevel;

    /** @deprecated Not supported */
    logLevelSdk: SdkLogLevel;

    logFile: string | null;

    /** @deprecated Not supported */
    logNodeIds: number[] | null;

    // Network configuration
    primaryInterface: string | null;

    // Certificate configuration
    /** @deprecated Not supported */
    paaRootCertDir: string | null;

    enableTestNetDcl: boolean;

    // Bluetooth configuration
    bluetoothAdapter: number | null;

    // OTA configuration
    otaProviderDir: string | null;

    // Server behavior
    /** @deprecated Not supported */
    disableServerInteractions: boolean;

    // Dashboard configuration
    disableDashboard: boolean;
}

function parseIntOption(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid integer: ${value}`);
    }
    return parsed;
}

function collectAddresses(value: string, previous: string[]): string[] {
    return previous.concat(value);
}

export function parseCliArgs(argv?: string[]): CliOptions {
    const program = new Command();

    program.name("matter-server").description("Matter Controller Server using WebSockets.").version(VERSION);

    program
        .option("--vendorid <id>", "Vendor ID for the Fabric", parseIntOption, DEFAULT_VENDOR_ID)
        .option("--fabricid <id>", "Fabric ID for the Fabric (random if not specified)", parseIntOption)
        .option("--storage-path <path>", "Storage path to keep persistent data", DEFAULT_STORAGE_PATH)
        .option("--port <port>", "TCP Port for WebSocket server", parseIntOption, DEFAULT_PORT)
        .option(
            "--listen-address <address>",
            "IP address to bind WebSocket server (repeatable, default: bind all)",
            collectAddresses,
            [],
        )
        .addOption(new Option("--log-level <level>", "Global logging level").choices(LOG_LEVELS).default("info"))
        .addOption(
            new Option("--log-level-sdk <level>", "Matter SDK logging level. This option is no longer supported.")
                .choices(SDK_LOG_LEVELS)
                .default("error"),
        )
        .option("--log-file <path>", "Log file path (optional)")
        .option("--primary-interface <interface>", "Primary network interface for link-local addresses")
        .option(
            "--paa-root-cert-dir <path>",
            "Directory for PAA root certificates. This option is no longer supported.",
        )
        .option("--enable-test-net-dcl", "Enable test-net DCL certificates", false)
        .option("--bluetooth-adapter <id>", "Bluetooth adapter HCI ID (e.g., 0 for hci0)", parseIntOption)
        .option(
            "--log-node-ids <ids...>",
            "Node IDs to filter logs (space-separated). This option is no longer supported.",
        )
        .option("--ota-provider-dir <path>", "Directory for OTA Provider files")
        .option(
            "--disable-server-interactions",
            "Disable server cluster interactions. This option is no longer supported.",
            false,
        )
        .option("--disable-dashboard", "Disable the web dashboard", false);

    program.parse(argv);
    const opts = program.opts();

    return {
        vendorId: opts.vendorid,
        fabricId: opts.fabricid ?? undefined,
        storagePath: opts.storagePath,
        port: opts.port,
        listenAddress: opts.listenAddress.length > 0 ? opts.listenAddress : null,
        logLevel: opts.logLevel,
        logLevelSdk: opts.logLevelSdk,
        logFile: opts.logFile ?? null,
        logNodeIds: opts.logNodeIds ?? null,
        primaryInterface: opts.primaryInterface ?? null,
        paaRootCertDir: opts.paaRootCertDir ?? null,
        enableTestNetDcl: opts.enableTestNetDcl,
        bluetoothAdapter: opts.bluetoothAdapter ?? null,
        otaProviderDir: opts.otaProviderDir ?? null,
        disableServerInteractions: opts.disableServerInteractions,
        disableDashboard: opts.disableDashboard,
    };
}

// Export parsed options as singleton for use across modules
let cliOptions: CliOptions | undefined;

export function getCliOptions(): CliOptions {
    if (!cliOptions) {
        cliOptions = parseCliArgs();
    }
    return cliOptions;
}
