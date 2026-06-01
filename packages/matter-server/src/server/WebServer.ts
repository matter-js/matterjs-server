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

            // Fallback upgrade handler: handlers each register their own upgrade listener
            // that only claims its path (e.g. /ws, /ble) and silently ignore others, so a
            // request to an unknown path otherwise leaves the TCP socket open with no
            // response. Handlers tag the request via `req._matterHandledUpgrade = true`
            // when they claim an upgrade; this fallback runs after all listeners and 404s
            // anything that nobody claimed.
            server.on("upgrade", (req, socket) => {
                setImmediate(() => {
                    if (socket.destroyed) return;
                    if ((req as { _matterHandledUpgrade?: boolean })._matterHandledUpgrade) return;
                    try {
                        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
                    } catch {
                        // socket already closing; destroy below
                    }
                    socket.destroy();
                });
            });

            // Start listening to this address
            await this.#startServer(server, host);
        }
    }

    #startServer(server: HttpServer, host: string | undefined): Promise<void> {
        const displayHost = host ?? "0.0.0.0";

        return new Promise<void>((resolve, reject) => {
            let resolvedOrErrored = false;

            server.listen({ host, port: this.#port }, () => {
                logger.notice(`Webserver listening on http://${displayHost}:${this.#port}`);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    resolve();
                }
            });

            server.on("error", err => {
                logger.fatal(`Webserver error on ${displayHost}:${this.#port}`, err);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    reject(err);
                }
            });
        });
    }

    initiateShutdown(): void {
        for (const handler of this.#handlers) {
            handler.initiateShutdown?.();
        }
    }

    async stop() {
        console.log("Stopping webserver...");
        // Unregister handlers first (closes WebSocket connections)
        for (const handler of this.#handlers) {
            await handler.unregister();
        }
        console.log("Handlers unregistered");

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
        console.log("Servers closed");

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
