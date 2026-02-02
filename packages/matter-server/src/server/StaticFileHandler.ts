/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpServer, WebServerHandler } from "@matter-server/ws-controller";
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Serves static files from the dashboard package's dist/web directory.
 * Optionally, injects server configuration into index.html.
 */
export class StaticFileHandler implements WebServerHandler {
    #staticPath: string;
    #productionMode: boolean;
    #indexHtml: string | null = null;

    constructor(productionMode: boolean = false) {
        // Resolve the @matter-server/dashboard package entry point (dist/web/js/main.js)
        // and get its parent directory (dist/web) for serving static files
        const dashboardMain = import.meta.resolve("@matter-server/dashboard");
        // Go up from dist/web/js/ to dist/web/
        this.#staticPath = dirname(dirname(fileURLToPath(dashboardMain)));
        this.#productionMode = productionMode;
    }

    async register(server: HttpServer): Promise<void> {
        const app = express();

        // Custom handler for index.html to inject the production mode flag
        app.get("/", (_req, res) => {
            res.type("html").send(this.#getIndexHtml());
        });
        app.get("/index.html", (_req, res) => {
            res.type("html").send(this.#getIndexHtml());
        });

        // Serve other static files normally
        app.use(express.static(this.#staticPath));

        // Attach to the existing server
        server.on("request", (req, res) => {
            // Only handle requests that aren't already handled by other handlers
            if (!req.url?.startsWith("/ws") && req.url !== "/health") {
                app(req, res);
            }
        });
    }

    /**
     * Get the index.html content, potentially modified with server configuration.
     */
    #getIndexHtml(): string {
        if (!this.#indexHtml) {
            const indexPath = join(this.#staticPath, "index.html");
            let html = readFileSync(indexPath, "utf-8");

            // Inject production mode configuration if enabled
            if (this.#productionMode) {
                const configScript = `<script>window.__MATTERJS_PRODUCTION_MODE__ = true;</script>`;
                // Insert before the closing </head> tag
                html = html.replace("</head>", `${configScript}\n</head>`);
            }

            this.#indexHtml = html;
        }
        return this.#indexHtml;
    }

    async unregister(): Promise<void> {
        // Nothing to clean up
    }
}
