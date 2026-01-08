/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type HttpServer, Logger, type WebServerHandler } from "@matter-server/controller";
import { createServer } from "node:http";

const logger = Logger.get("WebServer");

export class WebServer {
    #listenAddresses: string[] | null;
    #port: number;
    #server?: HttpServer;
    #handler: WebServerHandler[];

    constructor(config: WebServer.Config, handler: WebServerHandler[]) {
        const { listenAddresses, port } = config;
        this.#listenAddresses = listenAddresses;
        this.#port = port;
        this.#handler = handler;
    }

    async start() {
        const server = (this.#server = createServer());

        for (const handler of this.#handler) {
            await handler.register(this.#server);
        }

        // Determine bind host: null/undefined means bind to all interfaces
        const host = this.#listenAddresses?.[0] ?? undefined;
        const displayHost = host ?? "0.0.0.0";

        let resolvedOrErrored = false;
        await new Promise<void>((resolve, reject) => {
            server.listen({ host, port: this.#port }, () => {
                logger.info(`Webserver Listening on http://${displayHost}:${this.#port}`);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    resolve();
                }
            });

            server.on("error", err => {
                logger.error("Webserver error", err);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    reject(err);
                }
            });
        });
    }

    async stop() {
        // Unregister handlers first (closes WebSocket connections)
        for (const handler of this.#handler) {
            await handler.unregister();
        }

        // Then close the HTTP server and wait for it to finish
        if (this.#server) {
            await new Promise<void>((resolve, reject) => {
                this.#server!.close(err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }
}

export namespace WebServer {
    export interface Config {
        /** IP addresses to bind to. null means bind to all interfaces. */
        listenAddresses: string[] | null;
        port: number;
    }
}
