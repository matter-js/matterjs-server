/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebServerHandler } from "@matter-server/ws-controller";
import { Logger, Observable } from "@matter/main";
import type { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { BleProxyConnection } from "./BleProxyConnection.js";
import { BleProxyCommand, BleProxyEvent, type DeviceDiscoveredData, type StartScanArgs } from "./BleProxyProtocol.js";

type HttpServer = ReturnType<typeof createServer>;

const logger = Logger.get("BleProxyHandler");

/**
 * WebSocket server handler (hub) for the `/ble` BLE proxy endpoint.
 *
 * Accepts any number of proxy client connections, broadcasts scan commands to
 * all of them, and tracks which client owns each discovered peripheral so that
 * per-peripheral traffic routes to a single client.
 */
export class BleProxyHandler implements WebServerHandler {
    #wss?: WebSocketServer;
    /** Upgrade listener removers, one per HTTP server `register()` call (multi-bind). */
    #removeUpgradeListeners: (() => void)[] = [];
    #connections = new Set<BleProxyConnection>();
    #closed = false;

    /** Active scan intent + args, so clients joining mid-scan can be synced. */
    #scanActive = false;
    #scanArgs?: StartScanArgs;
    /** Connections currently told to scan, for aggregate `scanStopped`. */
    #scanning = new Set<BleProxyConnection>();

    /** address -> owning connection + every connection that has seen it. */
    #owners = new Map<string, { owner: BleProxyConnection; seers: Set<BleProxyConnection> }>();

    /** Emitted whenever a connection completes its handshake. */
    readonly connectionEstablished = new Observable<[]>();
    /** Emitted for each `device_discovered`, after ownership is updated. */
    readonly deviceDiscovered = new Observable<[data: DeviceDiscoveredData, connection: BleProxyConnection]>();
    /** Emitted once no connection is scanning anymore. */
    readonly scanStopped = new Observable<[reason: string]>();

    get connected(): boolean {
        for (const c of this.#connections) {
            if (c.connected) return true;
        }
        return false;
    }

    async register(server: HttpServer): Promise<void> {
        const isFirstBind = this.#wss === undefined;
        const wss = (this.#wss ??= new WebSocketServer({ noServer: true }));
        const upgradeHandler = (
            req: { url?: string; _matterHandledUpgrade?: boolean },
            socket: unknown,
            head: unknown,
        ) => {
            logger.debug(`Upgrade request received: ${req.url}`);
            const path = req.url?.split("?")[0];
            if (path === "/ble") {
                req._matterHandledUpgrade = true;
                wss.handleUpgrade(
                    req as Parameters<typeof wss.handleUpgrade>[0],
                    socket as Parameters<typeof wss.handleUpgrade>[1],
                    head as Parameters<typeof wss.handleUpgrade>[2],
                    ws => wss.emit("connection", ws, req),
                );
            }
        };
        server.on("upgrade", upgradeHandler);
        this.#removeUpgradeListeners.push(() => server.removeListener("upgrade", upgradeHandler));
        logger.info("BLE proxy WebSocket endpoint registered on /ble");

        if (!isFirstBind) {
            return;
        }

        wss.on("connection", ws => {
            if (this.#closed) {
                ws.close();
                return;
            }

            const connection = new BleProxyConnection(ws);
            this.#connections.add(connection);

            connection.handshakeCompleted.on(() => this.#onHandshakeCompleted(connection));
            connection.eventReceived.on((event, data) => this.#onConnectionEvent(connection, event, data));
            connection.closed.on(() => this.#onConnectionClosed(connection));
        });
    }

    unregister(): Promise<void> {
        if (!this.#wss || this.#closed) {
            return Promise.resolve();
        }

        this.#closed = true;
        for (const remove of this.#removeUpgradeListeners) remove();
        this.#removeUpgradeListeners = [];

        for (const connection of this.#connections) {
            connection.close();
        }
        this.#connections.clear();
        this.#scanning.clear();
        this.#owners.clear();

        const wss = this.#wss;
        this.#wss = undefined;

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        });

        return new Promise<void>((resolve, reject) => {
            wss.close(err => (err ? reject(err) : resolve()));
        });
    }

    /** Returns the connection that owns `address`, if it is still connected. */
    getOwner(address: string): BleProxyConnection | undefined {
        const entry = this.#owners.get(address);
        if (entry && entry.owner.connected) return entry.owner;
        return undefined;
    }

    async startScan(args: StartScanArgs): Promise<void> {
        this.#scanActive = true;
        this.#scanArgs = args;
        const sends = new Array<Promise<unknown>>();
        for (const connection of this.#connections) {
            if (connection.connected) {
                this.#scanning.add(connection);
                sends.push(
                    connection.sendCommand(BleProxyCommand.StartScan, args).catch(err => {
                        logger.warn(`[${connection.id}] Failed to start scan:`, err);
                        this.#markNotScanning(connection, "start scan failed");
                    }),
                );
            }
        }
        await Promise.all(sends);
    }

    async stopScan(): Promise<void> {
        this.#scanActive = false;
        const sends = new Array<Promise<unknown>>();
        for (const connection of this.#connections) {
            if (connection.connected) {
                sends.push(
                    connection
                        .sendCommand(BleProxyCommand.StopScan)
                        .catch(err => logger.warn(`[${connection.id}] Failed to stop scan:`, err)),
                );
            }
        }
        this.#scanning.clear();
        await Promise.all(sends);
    }

    #onHandshakeCompleted(connection: BleProxyConnection): void {
        this.connectionEstablished.emit();
        if (this.#scanActive && this.#scanArgs) {
            this.#scanning.add(connection);
            connection.sendCommand(BleProxyCommand.StartScan, this.#scanArgs).catch(err => {
                logger.warn(`[${connection.id}] Failed to sync scan to joining client:`, err);
                this.#markNotScanning(connection, "start scan failed");
            });
        }
    }

    #onConnectionEvent(connection: BleProxyConnection, event: string, data: Record<string, unknown>): void {
        if (event === BleProxyEvent.DeviceDiscovered) {
            this.#onDeviceDiscovered(connection, data as unknown as DeviceDiscoveredData);
        } else if (event === BleProxyEvent.ScanStopped) {
            this.#markNotScanning(connection, (data as { reason?: string }).reason ?? "unknown");
        }
    }

    /** Drop a connection from the scanning set; emit aggregate scanStopped once none remain. */
    #markNotScanning(connection: BleProxyConnection, reason: string): void {
        if (!this.#scanning.delete(connection)) {
            return;
        }
        if (this.#scanning.size === 0) {
            this.scanStopped.emit(reason);
        }
    }

    #onDeviceDiscovered(connection: BleProxyConnection, data: DeviceDiscoveredData): void {
        let entry = this.#owners.get(data.address);
        if (!entry) {
            entry = { owner: connection, seers: new Set([connection]) };
            this.#owners.set(data.address, entry);
        } else {
            entry.seers.add(connection);
            if (!entry.owner.connected) {
                entry.owner = connection;
            }
        }
        logger.debug(
            `[${connection.id}] device_discovered ${data.address} rssi=${data.rssi ?? "n/a"} seers=${entry.seers.size} isOwner=${entry.owner === connection}`,
        );
        this.deviceDiscovered.emit(data, connection);
    }

    #onConnectionClosed(connection: BleProxyConnection): void {
        this.#connections.delete(connection);
        this.#markNotScanning(connection, "client disconnected");

        for (const [address, entry] of this.#owners) {
            entry.seers.delete(connection);
            if (entry.owner === connection) {
                let next: BleProxyConnection | undefined;
                for (const seer of entry.seers) {
                    if (seer.connected) {
                        next = seer;
                        break;
                    }
                }
                if (next) {
                    entry.owner = next;
                    logger.info(`Reassigned ownership of ${address} to [${next.id}]`);
                } else {
                    this.#owners.delete(address);
                }
            }
        }
    }
}
