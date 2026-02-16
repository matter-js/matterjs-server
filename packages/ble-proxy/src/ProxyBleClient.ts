/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { BleProxyHandler } from "./BleProxyHandler.js";
import { BleProxyCommand, BleProxyEvent, type DeviceDiscoveredData } from "./BleProxyProtocol.js";

const logger = Logger.get("ProxyBleClient");

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
            logger.debug("BLE proxy not connected, deferring scan start");
            return;
        }

        logger.debug("Start BLE scanning via proxy ...");
        await this.#handler.sendCommand(BleProxyCommand.StartScan, {
            service_uuids: ["fff6"],
            allow_duplicates: true,
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

        // Convert service_data from Record<string, base64> to Map<string, Uint8Array>
        const serviceData = new Map<string, Uint8Array>();
        if (service_data) {
            for (const [uuid, base64Value] of Object.entries(service_data)) {
                serviceData.set(uuid, Buffer.from(base64Value, "base64"));
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

        // Extract Matter service data (fff6)
        const matterServiceData = serviceData.get("fff6");
        if (matterServiceData === undefined || matterServiceData.length !== 8) {
            logger.debug(`Peripheral ${address} does not advertise valid Matter service data, ignoring`);
            return;
        }

        logger.debug(`Discovered device ${address} (${name ?? "unnamed"}) via proxy`);
        this.#discoveredPeripherals.set(address, { peripheral, matterServiceData });
        this.#deviceDiscoveredCallback?.(peripheral, matterServiceData);
    }
}
