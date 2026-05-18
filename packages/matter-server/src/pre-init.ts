/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Apply server storage defaults before matter.js loads. matter.js's
// NodeJsEnvironment runs at import time and installs `storage.driver = "file"`
// from `config.storageDriver` as a baseline before overlaying process.env, so
// we cannot distinguish user-set "file" from the matter.js default after the
// fact. Setting process.env here (no matter.js imports in this file) means the
// matter.js loadVariables pass picks these up as if the user had set them, and
// any value the user actually provided still wins (??=).

process.env.MATTER_STORAGE_DRIVER ??= "wal";
process.env.MATTER_STORAGE_BLOBDRIVER ??= "dir";
