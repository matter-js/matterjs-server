/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type createServer } from "node:http";

export type HttpServer = ReturnType<typeof createServer>;

export interface WebServerHandler {
    register(server: HttpServer): Promise<void>;
    unregister(): Promise<void>;
}
