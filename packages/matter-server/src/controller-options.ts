/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterControllerOptions } from "@matter-server/ws-controller";
import { Seconds } from "@matter/main";
import { join } from "node:path";
import type { CliOptions } from "./cli.js";

/**
 * Translate parsed CLI options into controller options. Kept out of {@link MatterServer} so the unit
 * conversions here are reachable from a test: importing MatterServer starts a server.
 */
export function controllerOptionsFrom(
    cliOptions: CliOptions,
    serverId: string | undefined,
    serverVersion: string,
): MatterControllerOptions {
    return {
        enableTestNetDcl: cliOptions.enableTestNetDcl,
        disableOtaProvider: cliOptions.disableOta,
        disableDclSeed: cliOptions.disableDclSeed,
        serverId,
        serverVersion,
        bleProxyEnabled: cliOptions.bleProxy,
        enableTimeSync: cliOptions.enableTimeSync,
        disableThreadDiagnostics: cliOptions.disableThreadDiagnostics,
        customClusterPollInterval: Seconds(cliOptions.customClusterPollInterval),
        otaUpload: {
            // Staged next to the images it feeds, so importing one never crosses a filesystem.
            tempDir: join(cliOptions.otaProviderDir ?? cliOptions.storagePath, "ota-uploads"),
            maxInFlight: cliOptions.otaUploadMaxInFlight,
            maxSizeBytes: cliOptions.otaUploadMaxSizeMb * 1024 * 1024,
        },
    };
}
