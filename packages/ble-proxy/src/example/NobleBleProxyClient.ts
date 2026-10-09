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
    BleProxyErrorCode,
    type BleProxyErrorCodeValue,
    type CommandMessage,
    type ConnectArgs,
    type DeviceDiscoveredData,
    type DiscoverCharacteristicsArgs,
    type DiscoverServicesArgs,
    type ReadCharacteristicArgs,
    type StartScanArgs,
    type SubscribeCharacteristicArgs,
    type UnsubscribeCharacteristicArgs,
    type WriteAndSubscribeArgs,
    type WriteCharacteristicArgs,
    decodeBinaryFrame,
    encodeBinaryFrame,
} from "../BleProxyProtocol.js";

/**
 * A `connect` can arrive before this process has advertised the address it names — observed at
 * 104 ms ahead of the client's own `device_discovered`.
 */
const CONNECT_DISCOVERY_TIMEOUT_MS = 5_000;

/** Bounds one noble scan call, so a wedged adapter cannot stall every later scan and connect. */
const SCAN_OPERATION_TIMEOUT_MS = 10_000;

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

/**
 * The part of noble this client drives. Structural so a test can supply a stand-in without
 * implementing the full `Noble` surface; the real instance satisfies it.
 */
export interface NobleApi {
    startScanningAsync(serviceUuids: string[], allowDuplicates: boolean): Promise<void>;
    stopScanningAsync(): Promise<void>;
    stop(): void;
    on(event: "warning" | "stateChange", listener: (value: string) => void): unknown;
    on(event: "discover", listener: (peripheral: Peripheral) => void): unknown;
    removeAllListeners(event: "discover"): unknown;
}

/**
 * The parts of noble's GATT objects this client drives. Structural for the same reason as
 * `NobleApi`: a test can supply stand-ins, and noble's own types satisfy these on assignment.
 */
export interface Characteristic {
    readonly uuid: string;
    readonly properties: string[];
    readAsync(): Promise<Buffer>;
    writeAsync(data: Buffer, withoutResponse: boolean): Promise<void>;
    subscribeAsync(): Promise<void>;
    unsubscribeAsync(): Promise<void>;
    on(event: "data", listener: NotificationListener): unknown;
    removeListener(event: "data", listener: NotificationListener): unknown;
}

export interface Service {
    readonly uuid: string;
    readonly characteristics?: Characteristic[];
    discoverCharacteristicsAsync(uuids?: string[]): Promise<Characteristic[]>;
}

export interface Peripheral {
    readonly id: string;
    readonly address: string;
    readonly rssi: number;
    readonly mtu?: number | null;
    readonly state: string;
    readonly connectable?: boolean;
    readonly advertisement: {
        localName?: string;
        serviceUuids?: string[];
        serviceData?: Array<{ uuid: string; data: Uint8Array }>;
    };
    connectAsync(): Promise<void>;
    disconnectAsync(): Promise<void>;
    discoverServicesAsync(serviceUuids: string[]): Promise<Service[]>;
    once(event: "disconnect", listener: () => void): unknown;
    removeListener(event: "disconnect", listener: () => void): unknown;
}

/** noble reuses the "data" event for read responses, and delivers a null payload on read failure. */
export type NotificationListener = (payload: Buffer | null) => void;

interface Subscription {
    characteristic: Characteristic;
    onData: NotificationListener;
}

/** The scan the server has asked for; `undefined` means it has asked for none. */
interface ScanConfig {
    serviceUuids: string[];
    reportDuplicates: boolean;
}

export interface NobleBleProxyClientOptions {
    /** Stand-in for the dynamically imported noble instance. */
    noble?: NobleApi;
    scanOperationTimeoutMs?: number;
}

/** A pending `#awaitDiscovered`, kept so shutdown can settle it and clear its timer. */
interface DiscoveryWaiter {
    resolve: (peripheral: Peripheral | undefined) => void;
    timer: ReturnType<typeof setTimeout>;
}

interface ConnectionState {
    peripheral: Peripheral;
    services: Map<string, Service>;
    characteristics: Map<string, Characteristic>;
    subscriptions: Map<string, Subscription>;
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
    #noble?: NobleApi;
    #connections = new Map<number, ConnectionState>();
    #nextHandle = 1;
    #discoveredPeripherals = new Map<string, Peripheral>();
    #discoveryWaiters = new Map<string, Set<DiscoveryWaiter>>();
    #lastDiscoverFingerprint = new Map<string, DiscoverFingerprint>();
    #desiredScan?: ScanConfig;
    #scanPauses = 0;
    #scanGeneration = 0;
    #scanOperations: Promise<unknown> = Promise.resolve();
    #discoverListenerInstalled = false;
    readonly #scanOperationTimeoutMs: number;
    #commandHandlers = new Map<BleProxyCommandName, CommandHandler>();
    #closing = false;

    constructor(serverUrl: string, hciId?: number, options: NobleBleProxyClientOptions = {}) {
        this.#serverUrl = serverUrl;
        this.#hciId = hciId;
        this.#noble = options.noble;
        this.#scanOperationTimeoutMs = options.scanOperationTimeoutMs ?? SCAN_OPERATION_TIMEOUT_MS;
        this.#registerCommandHandlers();
    }

    /** Command names this client implements. Must cover every `BleProxyCommand` value. */
    get supportedCommands(): BleProxyCommandName[] {
        return [...this.#commandHandlers.keys()];
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

                // A throw here escapes into ws's receiver and takes the process down with it.
                let msg;
                try {
                    msg = JSON.parse(data.toString());
                } catch {
                    warn("Received invalid JSON from the server");
                    return;
                }
                // Valid JSON is not necessarily an object, and `"id" in null` throws.
                if (typeof msg !== "object" || msg === null) {
                    warn("Ignoring non-object JSON message from the server");
                    return;
                }

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
        for (const waiters of this.#discoveryWaiters.values()) {
            for (const waiter of waiters) {
                clearTimeout(waiter.timer);
                waiter.resolve(undefined);
            }
        }
        this.#discoveryWaiters.clear();
        this.#noble?.stop();
        this.#ws?.close();
    }

    async #loadNoble(): Promise<void> {
        if (this.#noble) {
            return;
        }
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
        this.#commandHandlers.set("start_scan", (id, args) => this.#handleStartScan(id, args));
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
        this.#commandHandlers.set("write_and_subscribe", (id, args) =>
            this.#handleWriteAndSubscribe(id, args as unknown as WriteAndSubscribeArgs),
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
            this.#sendError(msg.id, BleProxyErrorCode.InternalError, `Unknown command: ${msg.command}`);
            return;
        }
        try {
            await handler(msg.id, msg.args ?? {});
        } catch (err) {
            error(`[→ERR] id=${msg.id} ${msg.command} threw: ${(err as Error).message}`);
            this.#sendError(msg.id, BleProxyErrorCode.InternalError, `${(err as Error).message}`);
        }
    }

    // ─── Command Handlers ────────────────────────────────────────────────────

    async #handleStartScan(id: number, args: StartScanArgs): Promise<void> {
        if (!this.#noble) {
            this.#sendError(id, BleProxyErrorCode.BluetoothUnavailable, "Noble not initialized");
            return;
        }

        const config: ScanConfig = {
            serviceUuids: args.service_uuids ?? [],
            reportDuplicates: args.allow_duplicates ?? true,
        };
        this.#lastDiscoverFingerprint.clear();
        this.#installDiscoverListener();

        try {
            await this.#requestScan(config);
        } catch (err) {
            this.#sendError(id, BleProxyErrorCode.InternalError, (err as Error).message);
            return;
        }
        log(
            `[SCAN] BLE scan started (filter: ${config.serviceUuids.join(",") || "none"}` +
                ` allowDuplicates=${config.reportDuplicates})`,
        );
        this.#sendSuccess(id);
    }

    /** Installed once and kept: noble emits `discover` only while a scan is running. */
    #installDiscoverListener(): void {
        if (this.#discoverListenerInstalled) {
            return;
        }
        this.#discoverListenerInstalled = true;
        this.#noble!.on("discover", (peripheral: Peripheral) => {
            // On macOS, peripheral.address is often empty — fall back to peripheral.id (UUID)
            const address = peripheral.address || peripheral.id;
            this.#discoveredPeripherals.set(address, peripheral);

            const waiters = this.#discoveryWaiters.get(address);
            if (waiters) {
                this.#discoveryWaiters.delete(address);
                for (const waiter of waiters) {
                    clearTimeout(waiter.timer);
                    waiter.resolve(peripheral);
                }
            }

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

            if (!(this.#desiredScan?.reportDuplicates ?? true) && !changed) {
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
    }

    async #handleStopScan(id: number): Promise<void> {
        try {
            await this.#requestScan(undefined);
        } catch (err) {
            this.#sendError(id, BleProxyErrorCode.InternalError, (err as Error).message);
            return;
        }
        log("[SCAN] BLE scan stopped");
        this.#sendSuccess(id);
    }

    /** Resolves once `address` is advertised, or undefined once the wait times out. */
    #awaitDiscovered(address: string): Promise<Peripheral | undefined> {
        const known = this.#discoveredPeripherals.get(address);
        if (known) {
            return Promise.resolve(known);
        }

        if (!this.#desiredScan) {
            return Promise.resolve(undefined);
        }

        log(`[CONN] "${address}" not advertised yet, waiting up to ${CONNECT_DISCOVERY_TIMEOUT_MS}ms`);
        return new Promise<Peripheral | undefined>(resolve => {
            const waiters = this.#discoveryWaiters.get(address) ?? new Set();
            this.#discoveryWaiters.set(address, waiters);

            const waiter: DiscoveryWaiter = {
                resolve,
                timer: setTimeout(() => {
                    waiters.delete(waiter);
                    if (waiters.size === 0) {
                        this.#discoveryWaiters.delete(address);
                    }
                    resolve(undefined);
                }, CONNECT_DISCOVERY_TIMEOUT_MS),
            };
            waiters.add(waiter);
        });
    }

    async #handleConnect(id: number, args: ConnectArgs): Promise<void> {
        const peripheral = await this.#awaitDiscovered(args.address);
        if (!peripheral) {
            error(
                `[CONN] No peripheral found for address "${args.address}" after ${CONNECT_DISCOVERY_TIMEOUT_MS}ms.` +
                    ` Known: ${[...this.#discoveredPeripherals.keys()].join(", ")}`,
            );
            this.#sendError(id, BleProxyErrorCode.DeviceNotFound, `No device found for address ${args.address}`);
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
        let releaseScanPause: (() => Promise<void>) | undefined;
        try {
            // Pause scanning during connect + GATT discovery. On macOS, scanning concurrently
            // with `service.discoverCharacteristicsAsync` causes the CoreBluetooth delegate
            // callback to never fire; the peripheral stays connected but discovery hangs.
            log(`[SCAN] pausing scan for connect+interview...`);
            releaseScanPause = await this.#acquireScanPause();

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
            this.#sendError(id, BleProxyErrorCode.ConnectionFailed, reason);
        } finally {
            log(`[SCAN] resuming scan after connect+interview...`);
            await releaseScanPause?.().catch(scanErr =>
                warn(`[SCAN] failed to resume scanning after connect: ${(scanErr as Error).message}`),
            );
        }
    }

    async #handleDisconnect(id: number, connectionHandle: number): Promise<void> {
        const conn = this.#connections.get(connectionHandle);
        if (!conn) {
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${connectionHandle}`);
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
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
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
        let services: Service[];
        try {
            services = await withTimeout(
                conn.peripheral.discoverServicesAsync([]),
                10_000,
                "discoverServices timed out after 10s",
            );
        } catch (err) {
            this.#sendError(id, BleProxyErrorCode.DiscoveryFailed, (err as Error).message);
            return;
        }
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
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
            return;
        }

        const service = conn.services.get(args.service_uuid);
        if (!service) {
            this.#sendError(id, BleProxyErrorCode.ServiceNotFound, `Service ${args.service_uuid} not found`);
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
        let characteristics: Characteristic[];
        try {
            characteristics = await withTimeout(
                service.discoverCharacteristicsAsync([]),
                10_000,
                `discoverCharacteristics(${args.service_uuid}) timed out after 10s`,
            );
        } catch (err) {
            this.#sendError(id, BleProxyErrorCode.DiscoveryFailed, (err as Error).message);
            return;
        }
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
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = this.#findCharacteristic(conn, args.characteristic_uuid);
        if (!char) {
            this.#sendError(
                id,
                BleProxyErrorCode.CharacteristicNotFound,
                `Characteristic ${args.characteristic_uuid} not found`,
            );
            return;
        }

        let data: Buffer;
        try {
            data = await char.readAsync();
        } catch (err) {
            this.#sendError(
                id,
                BleProxyErrorCode.ReadFailed,
                `read(${args.characteristic_uuid}): ${(err as Error).message}`,
            );
            return;
        }
        log(`[GATT] read ${args.characteristic_uuid} → ${data.length} bytes`);
        this.#sendSuccess(id, { value: Buffer.from(data).toString("base64") });
    }

    async #handleWriteCharacteristic(id: number, args: WriteCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = this.#findCharacteristic(conn, args.characteristic_uuid);
        if (!char) {
            this.#sendError(
                id,
                BleProxyErrorCode.CharacteristicNotFound,
                `Characteristic ${args.characteristic_uuid} not found`,
            );
            return;
        }

        const data = Buffer.from(args.value, "base64");
        const withResponse = args.response ?? false;
        log(`[GATT] write ${args.characteristic_uuid} ${data.length} bytes withResponse=${withResponse}`);
        try {
            await char.writeAsync(data, !withResponse);
        } catch (err) {
            this.#sendError(
                id,
                BleProxyErrorCode.WriteFailed,
                `write(${args.characteristic_uuid}): ${(err as Error).message}`,
            );
            return;
        }
        conn.lastWriteCharacteristic = char;
        this.#sendSuccess(id);
    }

    async #handleSubscribeCharacteristic(id: number, args: SubscribeCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
            return;
        }

        const char = this.#findCharacteristic(conn, args.characteristic_uuid);
        if (!char) {
            this.#sendError(
                id,
                BleProxyErrorCode.CharacteristicNotFound,
                `Characteristic ${args.characteristic_uuid} not found`,
            );
            return;
        }

        const handle = args.connection_handle;
        if (!(await this.#subscribe(id, conn, handle, args.characteristic_uuid, char))) {
            return;
        }
        log(`[GATT] subscribe ${args.characteristic_uuid} handle=${handle}`);
        this.#sendSuccess(id);
    }

    /** No-op when `uuid` is already subscribed. Returns false once an error response was sent. */
    async #subscribe(
        id: number,
        conn: ConnectionState,
        handle: number,
        uuid: string,
        char: Characteristic,
    ): Promise<boolean> {
        // noble's `_notify` resolves without re-enabling CCCD when already notifying, so a
        // second "data" listener would double every forwarded notification.
        const key = NobleBleProxyClient.#subscriptionKey(uuid);
        if (conn.subscriptions.has(key)) {
            return true;
        }

        // Attached before the CCCD enable: noble drops "data" emitted with no listener attached.
        const onData = this.#notificationForwarder(handle, uuid);
        char.on("data", onData);
        try {
            await char.subscribeAsync();
        } catch (err) {
            char.removeListener("data", onData);
            this.#sendError(id, BleProxyErrorCode.SubscribeFailed, `subscribe(${uuid}): ${(err as Error).message}`);
            return false;
        }
        conn.subscriptions.set(key, { characteristic: char, onData });
        return true;
    }

    async #handleWriteAndSubscribe(id: number, args: WriteAndSubscribeArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
            return;
        }

        const writeChar = this.#findCharacteristic(conn, args.write_uuid);
        if (!writeChar) {
            this.#sendError(
                id,
                BleProxyErrorCode.CharacteristicNotFound,
                `Characteristic ${args.write_uuid} not found`,
            );
            return;
        }

        const subscribeChar = this.#findCharacteristic(conn, args.subscribe_uuid);
        if (!subscribeChar) {
            this.#sendError(
                id,
                BleProxyErrorCode.CharacteristicNotFound,
                `Characteristic ${args.subscribe_uuid} not found`,
            );
            return;
        }

        const handle = args.connection_handle;
        const value = Buffer.from(args.write_value, "base64");
        const withResponse = args.write_response ?? false;
        log(
            `[GATT] write_and_subscribe handle=${handle} write=${args.write_uuid} ${value.length} bytes` +
                ` withResponse=${withResponse} subscribe=${args.subscribe_uuid}`,
        );

        try {
            await writeChar.writeAsync(value, !withResponse);
        } catch (err) {
            this.#sendError(id, BleProxyErrorCode.WriteFailed, `write(${args.write_uuid}): ${(err as Error).message}`);
            return;
        }
        conn.lastWriteCharacteristic = writeChar;

        if (!(await this.#subscribe(id, conn, handle, args.subscribe_uuid, subscribeChar))) {
            return;
        }
        this.#sendSuccess(id);
    }

    async #handleUnsubscribeCharacteristic(id: number, args: UnsubscribeCharacteristicArgs): Promise<void> {
        const conn = this.#connections.get(args.connection_handle);
        if (!conn) {
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${args.connection_handle}`);
            return;
        }

        const key = NobleBleProxyClient.#subscriptionKey(args.characteristic_uuid);
        const subscription = conn.subscriptions.get(key);
        if (!subscription) {
            this.#sendError(id, BleProxyErrorCode.NotSubscribed, `Not subscribed to ${args.characteristic_uuid}`);
            return;
        }

        await subscription.characteristic.unsubscribeAsync();
        subscription.characteristic.removeListener("data", subscription.onData);
        conn.subscriptions.delete(key);
        log(`[GATT] unsubscribe ${args.characteristic_uuid} handle=${args.connection_handle}`);
        this.#sendSuccess(id);
    }

    async #handleRequestMtu(id: number, connectionHandle: number, mtu: number): Promise<void> {
        const conn = this.#connections.get(connectionHandle);
        if (!conn) {
            this.#sendError(id, BleProxyErrorCode.NotConnected, `No connection with handle ${connectionHandle}`);
            return;
        }
        // Noble doesn't have explicit MTU request - return the peripheral's MTU
        const actualMtu = conn.peripheral.mtu ?? mtu;
        log(`[GATT] request_mtu handle=${connectionHandle} requested=${mtu} actual=${actualMtu}`);
        this.#sendSuccess(id, { mtu: actualMtu });
    }

    // ─── Binary Frame Handling ───────────────────────────────────────────────

    #handleBinaryFrame(data: Buffer): void {
        // A throw here escapes into ws's receiver and takes the process down with it.
        let frame;
        try {
            frame = decodeBinaryFrame(new Uint8Array(data));
        } catch (err) {
            warn(`[←BIN] failed to decode binary frame: ${(err as Error).message}`);
            return;
        }
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

    /** Records the scan the server wants, then drives noble to it. Resolves once that settled. */
    #requestScan(config: ScanConfig | undefined): Promise<void> {
        this.#desiredScan = config;
        return this.#reconcileScan(++this.#scanGeneration);
    }

    /**
     * Suspends the running scan without forgetting it, so a resume restores the server's filter.
     * Counted, not a flag: `connect` commands overlap, and the first to finish must not resume a
     * scan while another is still interviewing — on macOS that reinstates the discovery hang the
     * pause exists to prevent. Returns the release, which is safe to call more than once.
     */
    async #acquireScanPause(): Promise<() => Promise<void>> {
        this.#scanPauses++;
        let released = false;
        const release = async () => {
            if (released) {
                return;
            }
            released = true;
            this.#scanPauses--;
            await this.#reconcileScan(++this.#scanGeneration);
        };

        try {
            await this.#reconcileScan(++this.#scanGeneration);
        } catch (err) {
            await release();
            throw err;
        }
        return release;
    }

    /**
     * Drives noble to the state `generation` asked for, or returns once a later request has taken
     * ownership of the outcome. noble registers each scan call's completion callback with
     * `onceExclusive`, which removes the previously registered one, so two overlapping calls leave
     * the earlier promise unsettled forever — every scan call is therefore serialized here.
     */
    #reconcileScan(generation: number): Promise<void> {
        return this.#serializeScanOperation(async () => {
            if (generation !== this.#scanGeneration) {
                return;
            }
            const target = this.#scanPauses > 0 ? undefined : this.#desiredScan;
            // The hci-socket binding returns early from startScanning while a scan is running,
            // keeping the previous service-uuid filter, so a filter change needs a stop first.
            await this.#callNoble(noble => noble.stopScanningAsync(), "stopScanning");
            if (target) {
                // Noble is always asked for duplicates; `allow_duplicates` is honoured when reporting.
                await this.#callNoble(noble => noble.startScanningAsync(target.serviceUuids, true), "startScanning");
            }
        });
    }

    #serializeScanOperation<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.#scanOperations.then(operation);
        this.#scanOperations = result.catch(() => undefined);
        return result;
    }

    async #callNoble(call: (noble: NobleApi) => Promise<void>, description: string): Promise<void> {
        const noble = this.#noble;
        if (!noble) {
            return;
        }
        const pending = call(noble);
        // Rejecting after the timeout has already won the race still needs a handler here.
        pending.catch(() => undefined);
        await withTimeout(
            pending,
            this.#scanOperationTimeoutMs,
            `${description} did not settle within ${this.#scanOperationTimeoutMs}ms`,
        );
    }

    // Forwarded regardless of noble's `isNotification`: on macOS that flag is derived from a
    // manager-wide pendingRead, so it reads false for a notification racing a read on any
    // peripheral. Safe only while no subscribed characteristic is ever read.
    #notificationForwarder(handle: number, uuid: string): NotificationListener {
        return payload => {
            if (payload === null) {
                return;
            }
            log(`[GATT] notify ${uuid} handle=${handle} ${payload.length} bytes`);
            this.#sendBinaryFrame(BinaryFrameOpcode.Notification, handle, new Uint8Array(payload));
        };
    }

    /** Subscription key; `#findCharacteristic` resolves spellings that differ only in case or dashes. */
    static #subscriptionKey(uuid: string): string {
        return uuid.replace(/-/g, "").toLowerCase();
    }

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

    #sendError(id: number, error: BleProxyErrorCodeValue, message: string): void {
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
