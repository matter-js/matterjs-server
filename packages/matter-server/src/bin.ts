#!/usr/bin/env node
/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// A shebang cannot portably pass --enable-source-maps. The import must stay dynamic: static imports load before this runs.
process.setSourceMapsEnabled(true);
await import("./MatterServer.js");
