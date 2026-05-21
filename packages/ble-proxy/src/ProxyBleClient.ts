/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPromise, Logger, Seconds, withTimeout } from "@matter/main";
import { BleError, MatterBle } from "@matter/main/protocol";
import type { BleProxyHandler } from "./BleProxyHandler.js";
import { BleProxyCommand, BleProxyEvent, type DeviceDiscoveredData } from "./BleProxyProtocol.js";

const logger = Logger.get("ProxyBleClient");

/**
 * Bounded wait for a proxy client to attach before starting a scan. Long enough
 * that "start matter-server, then connect proxy" works, short enough that a
 * misconfigured deployment surfaces a clear error instead of an opaque
 * scan-never-returns hang on the caller side.
 */
const SCAN_CONNECT_WAIT = Seconds(30);

/**
 * Represents a BLE peripheral discovered through the proxy.
 * Replaces Noble's Peripheral type - stores the data received from the proxy client.
 */
export interface ProxyPeripheral {
    address: string;
    name?: string;
    rssi?: number;
    connectable: boolean;
    serviceData: Map<string, Uint8Array>;
    mtu?: number;
}

/**
 * BLE client that communicates over the BLE proxy WebSocket protocol.
 * Replaces NobleBleClient - instead of using Noble directly, sends scan commands
 * to the proxy client and receives device_discovered events.
 */
export class ProxyBleClient {
    readonly #handler: BleProxyHandler;
    readonly #discoveredPeripherals = new Map<string, { peripheral: ProxyPeripheral; matterServiceData: Uint8Array }>();
    #deviceDiscoveredCallback: ((peripheral: ProxyPeripheral, matterServiceData: Uint8Array) => void) | undefined;
    #isScanning = false;

    readonly #eventObserver = (event: string, data: Record<string, unknown>) => {
        if (event === BleProxyEvent.DeviceDiscovered) {
            this.#handleDeviceDiscovered(data as unknown as DeviceDiscoveredData);
        } else if (event === BleProxyEvent.ScanStopped) {
            logger.info(`Scan stopped by proxy client: ${(data as { reason?: string }).reason ?? "unknown"}`);
            this.#isScanning = false;
        }
    };

    constructor(handler: BleProxyHandler) {
        this.#handler = handler;
        this.#handler.eventReceived.on(this.#eventObserver);
    }

    setDiscoveryCallback(callback: (peripheral: ProxyPeripheral, matterServiceData: Uint8Array) => void): void {
        this.#deviceDiscoveredCallback = callback;
        for (const { peripheral, matterServiceData } of this.#discoveredPeripherals.values()) {
            this.#deviceDiscoveredCallback(peripheral, matterServiceData);
        }
    }

    async startScanning(): Promise<void> {
        if (this.#isScanning) {
            return;
        }

        if (!this.#handler.connected) {
            logger.info(`BLE proxy not connected, waiting up to ${SCAN_CONNECT_WAIT}ms for client`);
            const { promise, resolver } = createPromise<void>();
            const onConnect = () => resolver();
            this.#handler.connectionEstablished.on(onConnect);
            try {
                await withTimeout(SCAN_CONNECT_WAIT, promise);
            } catch {
                throw new BleError(
                    `BLE proxy client did not connect within ${SCAN_CONNECT_WAIT}ms — cannot start scan`,
                );
            } finally {
                this.#handler.connectionEstablished.off(onConnect);
            }
        }

        logger.debug("Start BLE scanning via proxy ...");
        // Matter discovery only needs one event per state change; opt out of the spec's
        // default true so a 10 Hz peripheral advertise doesn't flood the WebSocket.
        await this.#handler.sendCommand(BleProxyCommand.StartScan, {
            service_uuids: ["fff6"],
            allow_duplicates: false,
        });
        this.#isScanning = true;
    }

    async stopScanning(): Promise<void> {
        if (!this.#isScanning) {
            return;
        }

        if (!this.#handler.connected) {
            this.#isScanning = false;
            return;
        }

        logger.debug("Stop BLE scanning via proxy ...");
        await this.#handler.sendCommand(BleProxyCommand.StopScan);
        this.#isScanning = false;
    }

    close(): void {
        this.#isScanning = false;
        this.#handler.eventReceived.off(this.#eventObserver);
    }

    #handleDeviceDiscovered(data: DeviceDiscoveredData): void {
        const { address, name, rssi, connectable, service_data } = data;

        // service_data keys may arrive in any UUID form the proxy client chose: noble's compact
        // 32-char form, ESPHome's dashed form, or the 16-bit short form "fff6"/"FFF6". Accept all.
        const serviceData = new Map<string, Uint8Array>();
        let matterServiceData: Uint8Array | undefined;
        if (service_data) {
            for (const [uuid, base64Value] of Object.entries(service_data)) {
                const bytes = Buffer.from(base64Value, "base64");
                serviceData.set(uuid, bytes);
                if (MatterBle.isServiceUuid(uuid)) {
                    matterServiceData = bytes;
                }
            }
        }

        const peripheral: ProxyPeripheral = {
            address,
            name,
            rssi,
            connectable,
            serviceData,
        };

        if (!connectable) {
            logger.debug(`Peripheral ${address} is not connectable, ignoring`);
            return;
        }

        if (matterServiceData === undefined || matterServiceData.length !== 8) {
            logger.debug(`Peripheral ${address} does not advertise valid Matter service data, ignoring`);
            return;
        }

        logger.debug(`Discovered device ${address} (${name ?? "unnamed"}) via proxy`);
        this.#discoveredPeripherals.set(address, { peripheral, matterServiceData });
        this.#deviceDiscoveredCallback?.(peripheral, matterServiceData);
    }
}
