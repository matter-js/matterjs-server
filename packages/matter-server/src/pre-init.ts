/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// cli.ts has no matter.js imports, so parsing here stays before matter.js loads.
import { getCliOptions } from "./cli.js";

// Apply server storage defaults before matter.js loads. matter.js's
// NodeJsEnvironment runs at import time and installs `storage.driver = "file"`
// from `config.storageDriver` as a baseline before overlaying process.env, so
// we cannot distinguish user-set "file" from the matter.js default after the
// fact. Setting process.env here (no matter.js imports in this file) means the
// matter.js loadVariables pass picks these up as if the user had set them, and
// any value the user actually provided still wins (??=).

process.env.MATTER_STORAGE_DRIVER ??= "wal";
process.env.MATTER_STORAGE_BLOBDRIVER ??= "dir";

// matter.js's NodeJsEnvironment also parses process.argv at import time,
// splitting any `--a-b-c` flag into the env var `a.b.c` (so `--log-level debug`
// becomes `log.level = true`, crashing the logger). We translate every CLI
// option to matter.js env vars ourselves, so parse now and strip argv to keep
// matter.js from re-interpreting our flags.
getCliOptions();
process.argv = process.argv.slice(0, 2);
