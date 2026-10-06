/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type HttpServer, Logger, type WebServerHandler } from "@matter-server/ws-controller";
import { lstat, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";

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

    async #startServer(server: HttpServer, host: string | undefined): Promise<void> {
        const socketPath = host !== undefined && isUnixSocketPath(host) ? host : undefined;
        const displayAddress =
            socketPath !== undefined ? `unix socket ${socketPath}` : `http://${host ?? "0.0.0.0"}:${this.#port}`;

        if (socketPath !== undefined) {
            await removeStaleSocket(socketPath);
        }

        return new Promise<void>((resolve, reject) => {
            let resolvedOrErrored = false;

            server.listen(socketPath !== undefined ? { path: socketPath } : { host, port: this.#port }, () => {
                logger.notice(`Webserver listening on ${displayAddress}`);
                if (!resolvedOrErrored) {
                    resolvedOrErrored = true;
                    resolve();
                }
            });

            server.on("error", err => {
                logger.fatal(`Webserver error on ${displayAddress}`, err);
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
                        // Node <=22 leaks the connection count of a socket the peer reset while a
                        // response was being written, and `close()` then never calls back.
                        server.closeAllConnections();
                    }),
            ),
        );
        console.log("Servers closed");

        this.#servers = [];
    }
}

function isUnixSocketPath(address: string): boolean {
    return address.startsWith("/");
}

/**
 * Removes a socket file left behind by a server that did not shut down cleanly, so the next start
 * does not fail with EADDRINUSE. Only a socket that refuses connections is removed; a socket that
 * accepts them and any non-socket file make `listen()` fail, and other probe errors are rethrown.
 */
async function removeStaleSocket(path: string): Promise<void> {
    // A missing or unreadable path has nothing to remove; listen() reports the actual error.
    const stats = await lstat(path).catch(() => undefined);
    if (!stats?.isSocket()) {
        return;
    }

    const stale = await new Promise<boolean>((resolve, reject) => {
        const probe = connect({ path });
        probe.once("connect", () => {
            probe.destroy();
            resolve(false);
        });
        probe.once("error", error =>
            "code" in error && error.code === "ECONNREFUSED" ? resolve(true) : reject(error),
        );
    });
    if (stale) {
        logger.info(`Removing stale unix socket ${path}`);
        await unlink(path);
    }
}

export namespace WebServer {
    export interface Config {
        /** IP addresses or absolute unix socket paths to bind to. null means bind to all interfaces. */
        listenAddresses: string[] | null;
        port: number;
    }
}
