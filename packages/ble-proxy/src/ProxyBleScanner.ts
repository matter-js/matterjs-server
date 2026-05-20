/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { BleScanner as BaseBleScanner, type DiscoveredBleDevice } from "@matter/main/protocol";
import type { ProxyBleClient, ProxyPeripheral } from "./ProxyBleClient.js";

export type { DiscoveredBleDevice } from "@matter/main/protocol";

export type DiscoveredProxyBleDevice = Omit<DiscoveredBleDevice, "peripheral"> & { peripheral: ProxyPeripheral };

/**
 * BLE scanner that discovers Matter devices through the BLE proxy.
 *
 * Extends matter.js's base `BleScanner`, which already handles the
 * `findCommissionableDevicesContinuously` waiter loop, advertisement parsing,
 * and cancellation semantics. We only narrow the `getDiscoveredDevice` return
 * type to expose the proxy-side `ProxyPeripheral` and route `closeClient`
 * through `ProxyBleClient.close()`.
 */
export class ProxyBleScanner extends BaseBleScanner {
    readonly #proxyClient: ProxyBleClient;

    constructor(proxyClient: ProxyBleClient) {
        super(proxyClient);
        this.#proxyClient = proxyClient;
    }

    override getDiscoveredDevice(address: string): DiscoveredProxyBleDevice {
        return super.getDiscoveredDevice(address) as DiscoveredProxyBleDevice;
    }

    protected override closeClient(): void {
        this.#proxyClient.close();
    }
}
