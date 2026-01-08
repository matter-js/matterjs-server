/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type HttpServer, Logger, type WebServerHandler } from "@matter-server/ws-controller";
import { createServer } from "node:http";

const logger = Logger.get("WebServer");

export class WebServer {
    #listenAddresses: string[] | null;
    #port: number;
    #servers: HttpServer[] = [];
    #handlers: WebServerHandler[];

    constructor(config: WebServer.Config, handlers: WebServerHandler[]) {
        const { listenAddresses, port } = config;
        this.#listenAddresses = listenAddresses;
        this.#port = port;
        this.#handlers = handlers;
    }

    async start() {
        // Determine which addresses to bind to
        // null/empty means bind to all interfaces (single server with no host specified)
        const addresses = this.#listenAddresses?.length ? this.#listenAddresses : [undefined];

        // Create and start a server for each address
        for (const host of addresses) {
            const server = createServer();
            this.#servers.push(server);

            // Register all handlers with this server
            for (const handler of this.#handlers) {
                await handler.register(server);
            }

            // Start listening to this address
            await this.#startServer(server, host);
        }
    }

    #startServer(server: HttpServer, host: string | undefined): Promise<void> {
        const displayHost = host ?? "0.0.0.0";

        return new Promise<void>((resolve, reject) => {
            let resolvedOrErrored = false;

            server.listen({ host, port: this.#port }, () => {
                logger.info(`Webserver listening on http://${displayHost}:${this.#port}`);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    resolve();
                }
            });

            server.on("error", err => {
                logger.error(`Webserver error on ${displayHost}:${this.#port}`, err);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    reject(err);
                }
            });
        });
    }

    async stop() {
        // Unregister handlers first (closes WebSocket connections)
        for (const handler of this.#handlers) {
            await handler.unregister();
        }

        // Then close all HTTP servers and wait for them to finish
        await Promise.allSettled(
            this.#servers.map(
                server =>
                    new Promise<void>((resolve, reject) => {
                        server.close(err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    }),
            ),
        );

        this.#servers = [];
    }
}

export namespace WebServer {
    export interface Config {
        /** IP addresses to bind to. null means bind to all interfaces. */
        listenAddresses: string[] | null;
        port: number;
    }
}
