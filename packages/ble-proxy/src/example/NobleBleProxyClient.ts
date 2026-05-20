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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

function ts(): string {
    const d = new Date();
    const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function log(...args: unknown[]): void {
    process.stdout.write(`${ts()} `);
    console.log(...args);
}

function warn(...args: unknown[]): void {
    process.stdout.write(`${ts()} `);
    console.warn(...args);
}

function error(...args: unknown[]): void {
    process.stdout.write(`${ts()} `);
    console.error(...args);
}

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

/** Fields that, when changed, justify re-emitting a device_discovered event. */
interface DiscoverFingerprint {
    name: string;
    connectable: boolean;
    serviceUuids: string;
    serviceData: string;
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
    #lastDiscoverFingerprint = new Map<string, DiscoverFingerprint>();
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
                        log(`BLE proxy handshake complete (protocol v${msg.version})`);
                        resolve();
                    }
                    return;
                }

                // Handle command from server
                if ("id" in msg && "command" in msg) {
                    this.#handleCommand(msg as CommandMessage).catch(err =>
                        error(`Unhandled error in command handler: ${(err as Error).message}`),
                    );
                }
            });

            ws.on("close", (code, reason) => {
                if (!this.#closing) {
                    log(`Disconnected from server (code=${code}${reason.length ? `, reason=${reason}` : ""})`);
                }
            });

            ws.on("unexpected-response", (_req, res) => {
                let body = "";
                res.on("data", (chunk: Buffer) => (body += chunk.toString()));
                res.on("end", () => {
                    const err = new Error(`Unexpected server response: ${res.statusCode}`);
                    error(`Server rejected WebSocket upgrade: HTTP ${res.statusCode}`, body ? `- Body: ${body}` : "");
                    error("Hint: Make sure the server is running with --ble-proxy (server must expose /ble endpoint)");
                    reject(err);
                });
            });

            ws.on("error", err => {
                if (!handshakeComplete) {
                    reject(err);
                } else {
                    error("WebSocket error:", err);
                }
            });
        });
    }

    close(): void {
        this.#closing = true;
        // Disconnect all BLE peripherals
        for (const [handle, conn] of this.#connections) {
            if (conn.peripheral.state === "connected") {
                conn.peripheral
                    .disconnectAsync()
                    .catch(err =>
                        warn(`[CONN] handle=${handle} disconnect during shutdown failed: ${(err as Error).message}`),
                    );
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
        // Dynamic import since @matter/nodejs-ble is optional. Some noble builds export a
        // factory function rather than a ready-made instance — handle both shapes.
        const noble = (await import("@stoprocent/noble")).default;
        const nobleAsUnknown: unknown = noble;
        if (typeof nobleAsUnknown === "function") {
            const factory = nobleAsUnknown as (opts: { extended: boolean }) => typeof noble;
            this.#noble = factory({ extended: false });
        } else {
            this.#noble = noble;
        }
        // Surface noble's internal warnings (unknown peripheral, missing service, etc.). matter.js
        // native NobleBleClient also picks these up via its general logger; the proxy needs them
        // explicitly because diagnostics here run in a different process.
        this.#noble.on("warning", (message: string) => warn(`[NOBLE] warning: ${message}`));
        this.#noble.on("stateChange", (state: string) => log(`[NOBLE] stateChange: ${state}`));
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
        const argsStr = msg.args ? JSON.stringify(msg.args) : "";
        log(`[←CMD] id=${msg.id} ${msg.command}${argsStr ? ` ${argsStr}` : ""}`);
        const handler = this.#commandHandlers.get(msg.command);
        if (!handler) {
            error(`[→ERR] id=${msg.id} Unknown command: ${msg.command}`);
            this.#sendError(msg.id, "internal_error", `Unknown command: ${msg.command}`);
            return;
        }
        try {
            await handler(msg.id, msg.args ?? {});
        } catch (err) {
            error(`[→ERR] id=${msg.id} ${msg.command} threw: ${(err as Error).message}`);
            this.#sendError(msg.id, "internal_error", `${(err as Error).message}`);
        }
    }

    // ─── Command Handlers ────────────────────────────────────────────────────

    async #handleStartScan(id: number): Promise<void> {
        if (!this.#noble) {
            this.#sendError(id, "bluetooth_unavailable", "Noble not initialized");
            return;
        }

        this.#lastDiscoverFingerprint.clear();
        // Remove any existing discover listeners to prevent duplicates on repeated scans
        this.#noble.removeAllListeners("discover");
        this.#noble.on("discover", (peripheral: Peripheral) => {
            // On macOS, peripheral.address is often empty — fall back to peripheral.id (UUID)
            const address = peripheral.address || peripheral.id;
            this.#discoveredPeripherals.set(address, peripheral);

            const serviceData: Record<string, string> = {};
            for (const sd of peripheral.advertisement.serviceData ?? []) {
                serviceData[sd.uuid] = Buffer.from(sd.data).toString("base64");
            }

            const name = peripheral.advertisement.localName ?? "(unnamed)";
            const connectable = peripheral.connectable ?? false;
            const serviceUuids = peripheral.advertisement.serviceUuids ?? [];

            const fingerprint: DiscoverFingerprint = {
                name,
                connectable,
                serviceUuids: serviceUuids.join(","),
                serviceData: Object.entries(serviceData)
                    .map(([uuid, data]) => `${uuid}=${data}`)
                    .sort()
                    .join("|"),
            };

            const prev = this.#lastDiscoverFingerprint.get(address);
            const changed =
                !prev ||
                prev.name !== fingerprint.name ||
                prev.connectable !== fingerprint.connectable ||
                prev.serviceUuids !== fingerprint.serviceUuids ||
                prev.serviceData !== fingerprint.serviceData;

            if (!changed) {
                return;
            }
            this.#lastDiscoverFingerprint.set(address, fingerprint);

            log(
                `[EVT] device_discovered addr=${address} name="${name}" rssi=${peripheral.rssi}` +
                    ` services=${JSON.stringify(serviceUuids)}` +
                    ` serviceData=${JSON.stringify(Object.keys(serviceData))}`,
            );

            const event: DeviceDiscoveredData = {
                address,
                name: peripheral.advertisement.localName,
                rssi: peripheral.rssi,
                connectable,
                service_data: serviceData,
                service_uuids: serviceUuids,
            };

            this.#sendEvent("device_discovered", event as unknown as Record<string, unknown>);
        });

        await this.#noble.startScanningAsync(["fff6"], true);
        log("[SCAN] BLE scan started (filter: fff6)");
        this.#sendSuccess(id);
    }

    async #handleStopScan(id: number): Promise<void> {
        await this.#noble?.stopScanningAsync();
        log("[SCAN] BLE scan stopped");
        this.#sendSuccess(id);
    }

    async #handleConnect(id: number, args: ConnectArgs): Promise<void> {
        const peripheral = this.#discoveredPeripherals.get(args.address);
        if (!peripheral) {
            error(
                `[CONN] No peripheral found for address "${args.address}". Known: ${[...this.#discoveredPeripherals.keys()].join(", ")}`,
            );
            this.#sendError(id, "device_not_found", `No device found for address ${args.address}`);
            return;
        }

        const handle = this.#nextHandle++;
        const connState: ConnectionState = {
            peripheral,
            services: new Map(),
            characteristics: new Map(),
            subscriptions: new Map(),
        };
        this.#connections.set(handle, connState);

        // Track disconnect at every stage so unexpected drops are surfaced rather than silently
        // hanging the awaiting noble promise.
        let disconnectedReason: string | undefined;
        const disconnectListener = () => {
            disconnectedReason = `peripheral disconnected (state=${peripheral.state})`;
            log(`[CONN] Peripheral handle=${handle} disconnected (state=${peripheral.state})`);
            this.#connections.delete(handle);
            this.#sendEvent("disconnected", { connection_handle: handle });
        };
        peripheral.once("disconnect", disconnectListener);

        log(`[CONN] Connecting to "${args.address}" (state=${peripheral.state})...`);
        try {
            // Pause scanning during connect + GATT discovery. On macOS, scanning concurrently
            // with `service.discoverCharacteristicsAsync` causes the CoreBluetooth delegate
            // callback to never fire; the peripheral stays connected but discovery hangs.
            log(`[SCAN] pausing scan for connect+interview...`);
            await this.#noble!.stopScanningAsync();

            await peripheral.connectAsync();
            log(`[CONN] Connected handle=${handle} state=${peripheral.state} mtu=${peripheral.mtu ?? "?"}`);

            log(`[GATT] handle=${handle} discoverServicesAsync(["fff6"])...`);
            const services = await withTimeout(
                peripheral.discoverServicesAsync(["fff6"]),
                30_000,
                "discoverServices(fff6) timed out after 30s",
            );
            log(`[GATT] handle=${handle} services: ${services.map(s => s.uuid).join(", ")} state=${peripheral.state}`);

            for (const service of services) {
                connState.services.set(service.uuid, service);
                if (service.uuid !== "fff6") continue;
                log(`[GATT] handle=${handle} discoverCharacteristicsAsync() on ${service.uuid}...`);
                const chars = await withTimeout(
                    service.discoverCharacteristicsAsync(),
                    30_000,
                    `discoverCharacteristics(${service.uuid}) timed out after 30s`,
                );
                for (const char of chars) {
                    connState.characteristics.set(char.uuid, char);
                }
                log(
                    `[GATT] handle=${handle} chars on ${service.uuid}: ${chars.map(c => c.uuid).join(", ")} state=${peripheral.state}`,
                );
            }

            const mtu = peripheral.mtu ?? 23;
            log(`[GATT] handle=${handle} ready mtu=${mtu}`);

            // Resume scanning so the server can still observe new devices and rssi updates.
            log(`[SCAN] resuming scan after connect+interview...`);
            await this.#noble!.startScanningAsync(["fff6"], true);

            this.#sendSuccess(id, { connection_handle: handle, mtu });
        } catch (err) {
            const reason = disconnectedReason ?? (err as Error).message;
            error(`[CONN] handle=${handle} failed: ${reason}`);
            if (this.#connections.has(handle)) {
                this.#connections.delete(handle);
            }
            peripheral.removeListener("disconnect", disconnectListener);
            if (peripheral.state === "connected") {
                peripheral
                    .disconnectAsync()
                    .catch(disconnectErr =>
                        warn(`[CONN] handle=${handle} cleanup disconnect failed: ${(disconnectErr as Error).message}`),
                    );
            }
            // Always try to resume scanning so subsequent connect attempts still see devices.
            this.#noble!
                .startScanningAsync(["fff6"], true)
                .catch(scanErr =>
                    warn(`[SCAN] failed to resume scanning after connect failure: ${(scanErr as Error).message}`),
                );
            this.#sendError(id, "internal_error", reason);
        }
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

        // If pre-fetch populated the cache, serve from it immediately
        if (conn.services.size > 0) {
            const uuids = [...conn.services.keys()];
            log(`[GATT] handle=${args.connection_handle} services from cache: ${uuids.join(", ")}`);
            this.#sendSuccess(id, { services: uuids.map(uuid => ({ uuid })) });
            return;
        }

        // Fallback: lazy discover
        log(`[GATT] handle=${args.connection_handle} discovering services (lazy)...`);
        const services = await withTimeout(
            conn.peripheral.discoverServicesAsync([]),
            10_000,
            "discoverServices timed out after 10s",
        );
        for (const service of services) {
            conn.services.set(service.uuid, service);
        }
        log(`[GATT] handle=${args.connection_handle} discovered services: ${services.map(s => s.uuid).join(", ")}`);

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

        // If pre-fetch populated characteristics for this service, serve from cache
        const cachedChars = service.characteristics ?? [];
        if (cachedChars.length > 0) {
            log(
                `[GATT] handle=${args.connection_handle} characteristics from cache for ${args.service_uuid}: ` +
                    cachedChars.map(c => `${c.uuid}[${c.properties.join(",")}]`).join(", "),
            );
            this.#sendSuccess(id, {
                characteristics: cachedChars.map(c => ({
                    uuid: c.uuid,
                    properties: c.properties,
                })),
            });
            return;
        }

        // Fallback: lazy discover
        log(`[GATT] handle=${args.connection_handle} discovering characteristics for ${args.service_uuid} (lazy)...`);
        const characteristics = await withTimeout(
            service.discoverCharacteristicsAsync([]),
            10_000,
            `discoverCharacteristics(${args.service_uuid}) timed out after 10s`,
        );
        for (const char of characteristics) {
            conn.characteristics.set(char.uuid, char);
        }
        log(
            `[GATT] handle=${args.connection_handle} discovered chars for ${args.service_uuid}: ` +
                characteristics.map(c => `${c.uuid}[${c.properties.join(",")}]`).join(", "),
        );

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
        log(`[GATT] read ${args.characteristic_uuid} → ${data.length} bytes`);
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
        log(`[GATT] write ${args.characteristic_uuid} ${data.length} bytes withResponse=${withResponse}`);
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
            log(`[GATT] notify ${args.characteristic_uuid} handle=${handle} ${data.length} bytes`);
            this.#sendBinaryFrame(BinaryFrameOpcode.Notification, handle, new Uint8Array(data));
        });

        await char.subscribeAsync();
        conn.subscriptions.set(args.characteristic_uuid, char);
        log(`[GATT] subscribe ${args.characteristic_uuid} handle=${handle}`);
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
        log(`[GATT] unsubscribe ${args.characteristic_uuid} handle=${args.connection_handle}`);
        this.#sendSuccess(id);
    }

    async #handleRequestMtu(id: number, connectionHandle: number, mtu: number): Promise<void> {
        const conn = this.#connections.get(connectionHandle);
        if (!conn) {
            this.#sendError(id, "not_connected", `No connection with handle ${connectionHandle}`);
            return;
        }
        // Noble doesn't have explicit MTU request - return the peripheral's MTU
        const actualMtu = conn.peripheral.mtu ?? mtu;
        log(`[GATT] request_mtu handle=${connectionHandle} requested=${mtu} actual=${actualMtu}`);
        this.#sendSuccess(id, { mtu: actualMtu });
    }

    // ─── Binary Frame Handling ───────────────────────────────────────────────

    #handleBinaryFrame(data: Buffer): void {
        const frame = decodeBinaryFrame(new Uint8Array(data));
        log(`[←BIN] opcode=${frame.opcode} handle=${frame.connectionHandle} payload=${frame.payload.length} bytes`);

        if (frame.opcode === BinaryFrameOpcode.WriteData) {
            const conn = this.#connections.get(frame.connectionHandle);
            if (!conn?.lastWriteCharacteristic) {
                warn(`[←BIN] WriteData: no lastWriteCharacteristic for handle=${frame.connectionHandle}`);
                return;
            }

            // Matter BTP writes C1 with ATT Write Request (with response). Pass withoutResponse=false.
            conn.lastWriteCharacteristic.writeAsync(Buffer.from(frame.payload), false).catch(err => {
                error("Binary write error:", err);
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
        log(`[→BIN] opcode=${opcode} handle=${connectionHandle} payload=${payload.length} bytes`);
        const frame = encodeBinaryFrame(opcode, connectionHandle, payload);
        this.#ws?.send(frame);
    }
}
