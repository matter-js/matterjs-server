/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Noble-based BLE proxy client - reference implementation of the BLE proxy protocol client side.
 *
 * Connects to the matter-server's /ble WebSocket endpoint and executes BLE commands
 * using Noble (via @matter/nodejs-ble). This provides:
 * - A reference implementation for the BLE proxy protocol
 * - A standalone local BLE bridge without Home Assistant
 * - An integration testing tool
 */

import { WebSocket } from "ws";
import {
    BLE_PROXY_PROTOCOL_VERSION,
    BinaryFrameOpcode,
    type BleProxyCommandName,
    type CommandMessage,
    type ConnectArgs,
    type DeviceDiscoveredData,
    type DiscoverCharacteristicsArgs,
    type DiscoverServicesArgs,
    type ReadCharacteristicArgs,
    type SubscribeCharacteristicArgs,
    type UnsubscribeCharacteristicArgs,
    type WriteCharacteristicArgs,
    decodeBinaryFrame,
    encodeBinaryFrame,
} from "../BleProxyProtocol.js";

type Peripheral = import("@stoprocent/noble").Peripheral;
type Characteristic = import("@stoprocent/noble").Characteristic;
type Service = import("@stoprocent/noble").Service;

interface ConnectionState {
    peripheral: Peripheral;
    services: Map<string, Service>;
    characteristics: Map<string, Characteristic>;
    subscriptions: Map<string, Characteristic>;
    lastWriteCharacteristic?: Characteristic;
}

type CommandHandler = (id: number, args: Record<string, unknown>) => Promise<void>;

export class NobleBleProxyClient {
    readonly #serverUrl: string;
    readonly #hciId?: number;
    #ws?: WebSocket;
    #noble?: import("@stoprocent/noble").Noble;
    #connections = new Map<number, ConnectionState>();
    #nextHandle = 1;
    #discoveredPeripherals = new Map<string, Peripheral>();
    #commandHandlers = new Map<BleProxyCommandName, CommandHandler>();
    #closing = false;

    constructor(serverUrl: string, hciId?: number) {
        this.#serverUrl = serverUrl;
        this.#hciId = hciId;
        this.#registerCommandHandlers();
    }

    async connect(): Promise<void> {
        // Load Noble dynamically (it's an optional dependency)
        await this.#loadNoble();

        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(this.#serverUrl);
            this.#ws = ws;

            ws.on("open", () => {
                // Send hello handshake
                ws.send(JSON.stringify({ type: "hello", version: BLE_PROXY_PROTOCOL_VERSION }));
            });

            let handshakeComplete = false;

            ws.on("message", (data, isBinary) => {
                if (isBinary) {
                    this.#handleBinaryFrame(Buffer.from(data as ArrayBuffer));
                    return;
                }

                const msg = JSON.parse(data.toString());

                if (!handshakeComplete) {
                    if (msg.type === "hello_response") {
                        if (msg.error) {
                            reject(new Error(`Handshake failed: ${msg.error} - ${msg.message}`));
                            ws.close();
                            return;
                        }
                        handshakeComplete = true;
                        console.log(`BLE proxy handshake complete (protocol v${msg.version})`);
                        resolve();
                    }
                    return;
                }

                // Handle command from server
                if ("id" in msg && "command" in msg) {
                    void this.#handleCommand(msg as CommandMessage);
                }
            });

            ws.on("close", () => {
                if (!this.#closing) {
                    console.log("Disconnected from server");
                }
            });

            ws.on("error", err => {
                if (!handshakeComplete) {
                    reject(err);
                } else {
                    console.error("WebSocket error:", err);
                }
            });
        });
    }

    close(): void {
        this.#closing = true;
        // Disconnect all BLE peripherals
        for (const [, conn] of this.#connections) {
            if (conn.peripheral.state === "connected") {
                conn.peripheral.disconnectAsync().catch(() => {});
            }
        }
        this.#connections.clear();
        this.#noble?.stop();
        this.#ws?.close();
    }

    async #loadNoble(): Promise<void> {
        if (this.#hciId !== undefined) {
            process.env.NOBLE_HCI_DEVICE_ID = this.#hciId.toString();
        }
        // Dynamic import since @matter/nodejs-ble is optional
        const noble = (await import("@stoprocent/noble")).default;
        if (typeof noble.on !== "function") {
            this.#noble = (noble as any)({ extended: false });
        } else {
            this.#noble = noble;
        }
    }

    #registerCommandHandlers(): void {
        this.#commandHandlers.set("start_scan", (id, _args) => this.#handleStartScan(id));
        this.#commandHandlers.set("stop_scan", id => this.#handleStopScan(id));
        this.#commandHandlers.set("connect", (id, args) => this.#handleConnect(id, args as unknown as ConnectArgs));
        this.#commandHandlers.set("disconnect", (id, args) =>
            this.#handleDisconnect(id, (args as { connection_handle: number }).connection_handle),
        );
        this.#commandHandlers.set("discover_services", (id, args) =>
            this.#handleDiscoverServices(id, args as unknown as DiscoverServicesArgs),
        );
        this.#commandHandlers.set("discover_characteristics", (id, args) =>
            this.#handleDiscoverCharacteristics(id, args as unknown as DiscoverCharacteristicsArgs),
        );
        this.#commandHandlers.set("read_characteristic", (id, args) =>
            this.#handleReadCharacteristic(id, args as unknown as ReadCharacteristicArgs),
        );
        this.#commandHandlers.set("write_characteristic", (id, args) =>
            this.#handleWriteCharacteristic(id, args as unknown as WriteCharacteristicArgs),
        );
        this.#commandHandlers.set("subscribe_characteristic", (id, args) =>
            this.#handleSubscribeCharacteristic(id, args as unknown as SubscribeCharacteristicArgs),
        );
        this.#commandHandlers.set("unsubscribe_characteristic", (id, args) =>
            this.#handleUnsubscribeCharacteristic(id, args as unknown as UnsubscribeCharacteristicArgs),
        );
        this.#commandHandlers.set("request_mtu", (id, args) =>
            this.#handleRequestMtu(
                id,
                (args as { connection_handle: number; mtu: number }).connection_handle,
                (args as { mtu: number }).mtu,
            ),
        );
    }

    async #handleCommand(msg: CommandMessage): Promise<void> {
        const handler = this.#commandHandlers.get(msg.command);
        if (!handler) {
            this.#sendError(msg.id, "internal_error", `Unknown command: ${msg.command}`);
            return;
        }
        try {
            await handler(msg.id, msg.args ?? {});
        } catch (err) {
            this.#sendError(msg.id, "internal_error", `${(err as Error).message}`);
        }
    }

    // ─── Command Handlers ────────────────────────────────────────────────────

    async #handleStartScan(id: number): Promise<void> {
        if (!this.#noble) {
            this.#sendError(id, "bluetooth_unavailable", "Noble not initialized");
            return;
        }

        // Remove any existing discover listeners to prevent duplicates on repeated scans
        this.#noble.removeAllListeners("discover");
        this.#noble.on("discover", (peripheral: Peripheral) => {
            this.#discoveredPeripherals.set(peripheral.address, peripheral);

            const serviceData: Record<string, string> = {};
            for (const sd of peripheral.advertisement.serviceData ?? []) {
                serviceData[sd.uuid] = Buffer.from(sd.data).toString("base64");
            }

            const event: DeviceDiscoveredData = {
                address: peripheral.address,
                name: peripheral.advertisement.localName,
                rssi: peripheral.rssi,
                connectable: peripheral.connectable ?? false,
                service_data: serviceData,
                service_uuids: peripheral.advertisement.serviceUuids,
            };

            this.#sendEvent("device_discovered", event as unknown as Record<string, unknown>);
        });

        await this.#noble.startScanningAsync(["fff6"], true);
        this.#sendSuccess(id);
    }

    async #handleStopScan(id: number): Promise<void> {
        await this.#noble?.stopScanningAsync();
        this.#sendSuccess(id);
    }

    async #handleConnect(id: number, args: ConnectArgs): Promise<void> {
        const peripheral = this.#discoveredPeripherals.get(args.address);
        if (!peripheral) {
            this.#sendError(id, "device_not_found", `No device found for address ${args.address}`);
            return;
        }

        await peripheral.connectAsync();
        const handle = this.#nextHandle++;

        this.#connections.set(handle, {
            peripheral,
            services: new Map(),
            characteristics: new Map(),
            subscriptions: new Map(),
        });

        peripheral.once("disconnect", () => {
            this.#connections.delete(handle);
            this.#sendEvent("disconnected", { connection_handle: handle });
        });

        this.#sendSuccess(id, { connection_handle: handle, mtu: peripheral.mtu ?? 23 });
    }

    async #handleDisconnect(id: number, connectionHandle: number): Promise<void> {
        const conn = this.#connections.get(connectionHandle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${connectionHandle}`);
            return;
        }

        if (conn.peripheral.state === "connected") {
            await conn.peripheral.disconnectAsync();
        }
        this.#connections.delete(connectionHandle);
        this.#sendSuccess(id);
    }

    async #handleDiscoverServices(id: number, args: DiscoverServicesArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${args.connection_handle}`);
            return;
        }

        const services = await conn.peripheral.discoverServicesAsync([]);
        for (const service of services) {
            conn.services.set(service.uuid, service);
        }

        this.#sendSuccess(id, {
            services: services.map(s => ({ uuid: s.uuid })),
        });
    }

    async #handleDiscoverCharacteristics(id: number, args: DiscoverCharacteristicsArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${args.connection_handle}`);
            return;
        }

        const service = conn.services.get(args.service_uuid);
        if (!service) {
            this.#sendError(id, "service_not_found", `Service ${args.service_uuid} not found`);
            return;
        }

        const characteristics = await service.discoverCharacteristicsAsync();
        for (const char of characteristics) {
            conn.characteristics.set(char.uuid, char);
        }

        this.#sendSuccess(id, {
            characteristics: characteristics.map(c => ({
                uuid: c.uuid,
                properties: c.properties,
            })),
        });
    }

    async #handleReadCharacteristic(id: number, args: ReadCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = this.#findCharacteristic(conn, args.characteristic_uuid);
        if (!char) {
            this.#sendError(id, "characteristic_not_found", `Characteristic ${args.characteristic_uuid} not found`);
            return;
        }

        const data = await char.readAsync();
        this.#sendSuccess(id, { value: Buffer.from(data).toString("base64") });
    }

    async #handleWriteCharacteristic(id: number, args: WriteCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = this.#findCharacteristic(conn, args.characteristic_uuid);
        if (!char) {
            this.#sendError(id, "characteristic_not_found", `Characteristic ${args.characteristic_uuid} not found`);
            return;
        }

        const data = Buffer.from(args.value, "base64");
        const withResponse = args.response ?? false;
        await char.writeAsync(data, !withResponse);
        conn.lastWriteCharacteristic = char;
        this.#sendSuccess(id);
    }

    async #handleSubscribeCharacteristic(id: number, args: SubscribeCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = this.#findCharacteristic(conn, args.characteristic_uuid);
        if (!char) {
            this.#sendError(id, "characteristic_not_found", `Characteristic ${args.characteristic_uuid} not found`);
            return;
        }

        const handle = args.connection_handle;
        char.on("data", (data: Buffer) => {
            // Send notification as binary frame for efficiency
            this.#sendBinaryFrame(BinaryFrameOpcode.Notification, handle, new Uint8Array(data));
        });

        await char.subscribeAsync();
        conn.subscriptions.set(args.characteristic_uuid, char);
        this.#sendSuccess(id);
    }

    async #handleUnsubscribeCharacteristic(id: number, args: UnsubscribeCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = conn.subscriptions.get(args.characteristic_uuid);
        if (!char) {
            this.#sendError(id, "not_subscribed", `Not subscribed to ${args.characteristic_uuid}`);
            return;
        }

        await char.unsubscribeAsync();
        char.removeAllListeners("data");
        conn.subscriptions.delete(args.characteristic_uuid);
        this.#sendSuccess(id);
    }

    async #handleRequestMtu(id: number, connectionHandle: number, mtu: number): Promise<void> {
        const conn = this.#connections.get(connectionHandle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${connectionHandle}`);
            return;
        }
        // Noble doesn't have explicit MTU request - return the peripheral's MTU
        this.#sendSuccess(id, { mtu: conn.peripheral.mtu ?? mtu });
    }

    // ─── Binary Frame Handling ───────────────────────────────────────────────

    #handleBinaryFrame(data: Buffer): void {
        const frame = decodeBinaryFrame(new Uint8Array(data));

        if (frame.opcode === BinaryFrameOpcode.WriteData) {
            const conn = this.#connections.get(frame.connectionHandle);
            if (!conn?.lastWriteCharacteristic) return;

            conn.lastWriteCharacteristic.writeAsync(Buffer.from(frame.payload), true).catch(err => {
                console.error("Binary write error:", err);
            });
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    #findCharacteristic(conn: ConnectionState, uuid: string): Characteristic | undefined {
        // Try exact match first, then case-insensitive
        return (
            conn.characteristics.get(uuid) ??
            conn.characteristics.get(uuid.toLowerCase()) ??
            conn.characteristics.get(uuid.toUpperCase().replace(/-/g, "").toLowerCase())
        );
    }

    #sendSuccess(id: number, result?: Record<string, unknown>): void {
        this.#ws?.send(JSON.stringify({ id, success: true, result: result ?? {} }));
    }

    #sendError(id: number, error: string, message: string): void {
        this.#ws?.send(JSON.stringify({ id, success: false, error, message }));
    }

    #sendEvent(event: string, data: Record<string, unknown>): void {
        this.#ws?.send(JSON.stringify({ event, data }));
    }

    #sendBinaryFrame(opcode: number, connectionHandle: number, payload: Uint8Array): void {
        const frame = encodeBinaryFrame(opcode, connectionHandle, payload);
        this.#ws?.send(frame);
    }
}
