/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CLI argument parser for Matter Server.
 * Compatible with Python Matter Server CLI interface.
 */

import { Command, InvalidArgumentError, Option } from "commander";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Read the version from package.json using an ESM-native approach
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string };
const VERSION = packageJson.version;

// Default values (exported for use in LegacyDataLoader)
export const DEFAULT_VENDOR_ID = 0xfff1;
export const DEFAULT_FABRIC_ID = 1;
const DEFAULT_PORT = 5580;
const DEFAULT_STORAGE_PATH = join(homedir(), ".matter_server");

// Log level enums
const LOG_LEVELS = ["critical", "error", "warning", "info", "debug", "verbose"] as const;
const SDK_LOG_LEVELS = ["none", "error", "progress", "detail", "automation"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

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
    logFile: string | null;

    // Network configuration
    primaryInterface: string | null;

    // Certificate configuration
    enableTestNetDcl: boolean;

    // Bluetooth configuration
    bluetoothAdapter: number | null;

    // OTA configuration
    disableOta: boolean;
    otaProviderDir: string | null;

    // Dashboard configuration
    disableDashboard: boolean;
    productionMode: boolean;
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

function parseBooleanEnv(value: string | boolean | undefined): boolean {
    // Handle boolean values directly (e.g. when a flag is used without a value and Commander passes the preset boolean to the argParser, or when called programmatically)
    if (typeof value === "boolean") return value;

    const lower = (value ?? "").toLowerCase().trim();
    if (lower === "" || ["false", "0", "no", "off"].includes(lower)) return false;
    if (["true", "1", "yes", "on"].includes(lower)) return true;
    throw new InvalidArgumentError(`Invalid boolean value: "${value}". Use true/false, 1/0, yes/no, or on/off.`);
}

/** Deprecated options that are still accepted but no longer used */
const DEPRECATED_OPTIONS: Record<string, string> = {
    logLevelSdk: "--log-level-sdk",
    logNodeIds: "--log-node-ids",
    paaRootCertDir: "--paa-root-cert-dir",
    disableServerInteractions: "--disable-server-interactions",
};

export function parseCliArgs(argv?: string[]): CliOptions {
    const program = new Command();

    program.name("matter-server").description("Matter Controller Server using WebSockets.").version(VERSION);

    program
        .addOption(
            new Option("--vendorid <id>", "Vendor ID for the Fabric")
                .argParser(parseIntOption)
                .default(DEFAULT_VENDOR_ID)
                .env("VENDOR_ID"),
        )
        .addOption(
            new Option("--fabricid <id>", "Fabric ID for the Fabric (random if not specified)")
                .argParser(parseIntOption)
                .default(DEFAULT_FABRIC_ID)
                .env("FABRIC_ID"),
        )
        .addOption(
            new Option("--storage-path <path>", "Storage path to keep persistent data")
                .default(DEFAULT_STORAGE_PATH)
                .env("STORAGE_PATH"),
        )
        .addOption(
            new Option("--port <port>", "TCP Port for WebSocket server")
                .argParser(parseIntOption)
                .default(DEFAULT_PORT)
                .env("PORT"),
        )
        .option(
            "--listen-address <address>",
            "IP address to bind WebSocket server (repeatable via CLI, single value via env: LISTEN_ADDRESS)",
            collectAddresses,
            [],
        )
        .addOption(
            new Option("--log-level <level>", "Global logging level")
                .choices(LOG_LEVELS)
                .default("info")
                .env("LOG_LEVEL"),
        )
        .addOption(new Option("--log-file <path>", "Log file path (optional)").env("LOG_FILE"))
        .addOption(
            new Option("--primary-interface <interface>", "Primary network interface for link-local addresses").env(
                "PRIMARY_INTERFACE",
            ),
        )
        .addOption(
            new Option("--enable-test-net-dcl [value]", "Enable test-net DCL certificates")
                .argParser(parseBooleanEnv)
                .preset(true)
                .default(false)
                .env("ENABLE_TEST_NET_DCL"),
        )
        .addOption(
            new Option("--bluetooth-adapter <id>", "Bluetooth adapter HCI ID (e.g., 0 for hci0)")
                .argParser(parseIntOption)
                .env("BLUETOOTH_ADAPTER"),
        )
        .addOption(
            new Option("--disable-ota [value]", "Disable OTA update functionality")
                .argParser(parseBooleanEnv)
                .preset(true)
                .default(false)
                .env("DISABLE_OTA"),
        )
        .addOption(new Option("--ota-provider-dir <path>", "Directory for OTA Provider files").env("OTA_PROVIDER_DIR"))
        .addOption(
            new Option("--disable-dashboard [value]", "Disable the web dashboard")
                .argParser(parseBooleanEnv)
                .preset(true)
                .default(false)
                .env("DISABLE_DASHBOARD"),
        )
        .addOption(
            new Option(
                "--production-mode [value]",
                "Force dashboard production mode (auto-connect to server). Use when running behind a reverse proxy.",
            )
                .argParser(parseBooleanEnv)
                .preset(true)
                .default(false)
                .env("PRODUCTION_MODE"),
        )
        // Deprecated options - still accepted for backwards compatibility
        .addOption(
            new Option("--log-level-sdk <level>", "Matter SDK logging level (deprecated, no longer used)")
                .choices(SDK_LOG_LEVELS)
                .hideHelp(),
        )
        .option("--log-node-ids <ids...>", "Node IDs to filter logs (deprecated, no longer used)")
        .option("--paa-root-cert-dir <path>", "Directory for PAA root certificates (deprecated, no longer used)")
        .option("--disable-server-interactions", "Disable server cluster interactions (deprecated, no longer used)");

    program.parse(argv);
    const opts = program.opts();

    // Warn about deprecated options if used
    for (const [key, flag] of Object.entries(DEPRECATED_OPTIONS)) {
        if (opts[key] !== undefined && opts[key] !== false) {
            console.warn(`Warning: ${flag} is deprecated and no longer supported. This option will be ignored.`);
        }
    }

    // Handle listenAddress: CLI provides an array, env var (LISTEN_ADDRESS) provides a single string
    let listenAddress: string[] | null = null;
    if (Array.isArray(opts.listenAddress) && opts.listenAddress.length > 0) {
        listenAddress = opts.listenAddress;
    } else if (process.env.LISTEN_ADDRESS) {
        listenAddress = [process.env.LISTEN_ADDRESS];
    }

    return {
        vendorId: opts.vendorid,
        fabricId: opts.fabricid ?? undefined,
        storagePath: opts.storagePath,
        port: opts.port,
        listenAddress,
        logLevel: opts.logLevel,
        logFile: opts.logFile ?? null,
        primaryInterface: opts.primaryInterface ?? null,
        enableTestNetDcl: opts.enableTestNetDcl,
        bluetoothAdapter: opts.bluetoothAdapter ?? null,
        disableOta: opts.disableOta,
        otaProviderDir: opts.otaProviderDir ?? null,
        disableDashboard: opts.disableDashboard,
        productionMode: opts.productionMode,
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
