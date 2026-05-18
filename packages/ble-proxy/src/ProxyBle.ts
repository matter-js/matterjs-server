/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Environment, ImplementationError, type Transport } from "@matter/main";
import { Ble, type BlePeripheralInterface, type Scanner } from "@matter/main/protocol";
import type { BleProxyHandler } from "./BleProxyHandler.js";
import { ProxyBleCentralInterface } from "./ProxyBleChannel.js";
import { ProxyBleClient } from "./ProxyBleClient.js";
import { ProxyBleScanner } from "./ProxyBleScanner.js";

/**
 * BLE implementation that proxies all operations over a WebSocket connection.
 * Replaces NodeJsBle for environments where BLE hardware is accessed through
 * a remote proxy client (e.g. Home Assistant with ESPHome BLE proxies).
 *
 * Only central (client) mode is supported. Peripheral mode throws.
 */
export class ProxyBle extends Ble {
    readonly #handler: BleProxyHandler;
    #proxyBleClient?: ProxyBleClient;
    #bleScanner?: ProxyBleScanner;
    #bleCentralInterface?: ProxyBleCentralInterface;
    #closed = false;

    constructor(handler: BleProxyHandler, environment?: Environment) {
        super();
        this.#handler = handler;
        // Register with the runtime so shutdown drives scanner.close() and clears pending
        // discovery waiters. Mirrors @matter/nodejs-ble NobleBleClient's runtime registration.
        environment?.runtime.add(this);
    }

    get peripheralInterface(): BlePeripheralInterface {
        throw new ImplementationError("BLE Proxy only supports central mode, not peripheral");
    }

    get centralInterface(): Transport {
        if (!this.#bleCentralInterface) {
            this.#bleCentralInterface = new ProxyBleCentralInterface(this.scanner as ProxyBleScanner, this.#handler);
        }
        return this.#bleCentralInterface;
    }

    get scanner(): Scanner {
        if (!this.#bleScanner) {
            if (!this.#proxyBleClient) {
                this.#proxyBleClient = new ProxyBleClient(this.#handler);
            }
            this.#bleScanner = new ProxyBleScanner(this.#proxyBleClient);
        }
        return this.#bleScanner;
    }

    async close(): Promise<void> {
        if (this.#closed) return;
        this.#closed = true;
        await this.#bleCentralInterface?.close();
        // scanner.close() also closes the underlying ProxyBleClient.
        await this.#bleScanner?.close();
    }
}
