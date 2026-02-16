/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ConnectionlessTransport, ImplementationError } from "@matter/main";
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

    constructor(handler: BleProxyHandler) {
        super();
        this.#handler = handler;
    }

    get peripheralInterface(): BlePeripheralInterface {
        throw new ImplementationError("BLE Proxy only supports central mode, not peripheral");
    }

    get centralInterface(): ConnectionlessTransport {
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
}
