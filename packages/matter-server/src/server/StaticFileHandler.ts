/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpServer, WebServerHandler } from "@matter-server/ws-controller";
import express from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Serves static files from the dashboard package's dist/web directory.
 */
export class StaticFileHandler implements WebServerHandler {
    #staticPath: string;

    constructor() {
        // Resolve the @matter-server/dashboard package entry point (dist/web/js/main.js)
        // and get its parent directory (dist/web) for serving static files
        const dashboardMain = import.meta.resolve("@matter-server/dashboard");
        // Go up from dist/web/js/ to dist/web/
        this.#staticPath = dirname(dirname(fileURLToPath(dashboardMain)));
    }

    async register(server: HttpServer): Promise<void> {
        const app = express();
        app.use(express.static(this.#staticPath));

        // Attach to the existing server
        server.on("request", (req, res) => {
            // Only handle non-WebSocket requests that aren't already handled
            if (!req.url?.startsWith("/ws")) {
                app(req, res);
            }
        });
    }

    async unregister(): Promise<void> {
        // Nothing to clean up
    }
}
