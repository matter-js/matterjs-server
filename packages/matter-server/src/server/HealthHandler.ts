/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpServer, WebServerHandler, WebSocketControllerHandler } from "@matter-server/ws-controller";

/**
 * Health check endpoint that returns server status.
 * Responds to GET /health with HTTP 200 and JSON body containing version and node count.
 */
export class HealthHandler implements WebServerHandler {
    #wsHandler: WebSocketControllerHandler;

    constructor(wsHandler: WebSocketControllerHandler) {
        this.#wsHandler = wsHandler;
    }

    async register(server: HttpServer): Promise<void> {
        server.on("request", (req, res) => {
            if (req.url === "/health" && req.method === "GET") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(this.#wsHandler.health()));
            }
        });
    }

    async unregister(): Promise<void> {
        // Nothing to clean up
    }
}
