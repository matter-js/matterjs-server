/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChannelType, createPromise, Diagnostic, Duration, Logger, Millis, Time, Timer, Timespan } from "@matter/main";
import {
    BtpCodec,
    type CommissionableDevice,
    type CommissionableDeviceIdentifiers,
    type Scanner,
} from "@matter/main/protocol";
import { VendorId } from "@matter/main/types";
import type { ProxyBleClient, ProxyPeripheral } from "./ProxyBleClient.js";

const logger = Logger.get("ProxyBleScanner");

export type DiscoveredProxyBleDevice = {
    deviceData: CommissionableDeviceData;
    peripheral: ProxyPeripheral;
    hasAdditionalAdvertisementData: boolean;
};

type CommissionableDeviceData = CommissionableDevice & {
    SD: number; // Short discriminator
};

/**
 * BLE scanner that discovers Matter devices through the BLE proxy.
 * Adapted from @matter/nodejs-ble BleScanner, using ProxyPeripheral instead of Noble Peripheral.
 */
export class ProxyBleScanner implements Scanner {
    readonly type = ChannelType.BLE;

    readonly #proxyClient: ProxyBleClient;
    readonly #recordWaiters = new Map<
        string,
        {
            resolver: () => void;
            timer?: Timer;
            resolveOnUpdatedRecords: boolean;
            cancelResolver?: (value: void) => void;
        }
    >();
    readonly #discoveredMatterDevices = new Map<string, DiscoveredProxyBleDevice>();

    constructor(proxyClient: ProxyBleClient) {
        this.#proxyClient = proxyClient;
        this.#proxyClient.setDiscoveryCallback((peripheral, matterServiceData) =>
            this.#handleDiscoveredDevice(peripheral, matterServiceData),
        );
    }

    getDiscoveredDevice(address: string): DiscoveredProxyBleDevice {
        const device = this.#discoveredMatterDevices.get(address);
        if (device === undefined) {
            throw new Error(`No device found for address ${address}`);
        }
        return device;
    }

    async #registerWaiterPromise(
        queryId: string,
        timeout?: Duration,
        resolveOnUpdatedRecords = true,
        cancelResolver?: (value: void) => void,
    ) {
        const { promise, resolver } = createPromise<void>();
        let timer;
        if (timeout) {
            timer = Time.getTimer("BLE proxy query timeout", timeout, () => {
                cancelResolver?.();
                this.#finishWaiter(queryId, true);
            }).start();
        }
        this.#recordWaiters.set(queryId, { resolver, timer, resolveOnUpdatedRecords, cancelResolver });
        logger.debug(
            `Registered waiter for query ${queryId} with timeout ${timeout === undefined ? "(none)" : Duration.format(timeout)} ${
                resolveOnUpdatedRecords ? "" : " (not resolving on updated records)"
            }`,
        );
        await promise;
    }

    #finishWaiter(queryId: string, resolvePromise: boolean, isUpdatedRecord = false) {
        const waiter = this.#recordWaiters.get(queryId);
        if (waiter === undefined) return;
        const { timer, resolver, resolveOnUpdatedRecords } = waiter;
        if (isUpdatedRecord && !resolveOnUpdatedRecords) return;
        logger.debug(`Finishing waiter for query ${queryId}, resolving: ${resolvePromise}`);
        timer?.stop();
        if (resolvePromise) {
            resolver();
        }
        this.#recordWaiters.delete(queryId);
    }

    cancelCommissionableDeviceDiscovery(identifier: CommissionableDeviceIdentifiers, resolvePromise = true) {
        const queryKey = this.#buildCommissionableQueryIdentifier(identifier);
        const { cancelResolver } = this.#recordWaiters.get(queryKey) ?? {};
        cancelResolver?.();
        this.#finishWaiter(queryKey, resolvePromise);
    }

    #handleDiscoveredDevice(peripheral: ProxyPeripheral, manufacturerServiceData: Uint8Array) {
        const address = peripheral.address;

        try {
            const { discriminator, vendorId, productId, hasAdditionalAdvertisementData } =
                BtpCodec.decodeBleAdvertisementServiceData(new Uint8Array(manufacturerServiceData));

            const deviceData: CommissionableDeviceData = {
                deviceIdentifier: address,
                D: discriminator,
                SD: (discriminator >> 8) & 0x0f,
                VP: `${vendorId}+${productId}`,
                CM: 1,
                addresses: [{ type: "ble", peripheralAddress: address }],
            };
            const deviceExisting = this.#discoveredMatterDevices.has(address);

            logger.debug(
                `${deviceExisting ? "Re-" : ""}Discovered device ${address} data: ${Diagnostic.json(deviceData)}`,
            );

            this.#discoveredMatterDevices.set(address, {
                deviceData,
                peripheral,
                hasAdditionalAdvertisementData,
            });

            const queryKey = this.#findCommissionableQueryIdentifier(deviceData);
            if (queryKey !== undefined) {
                this.#finishWaiter(queryKey, true, deviceExisting);
            }
        } catch (error) {
            logger.debug(`Discovered device ${address} does not seem to be a valid Matter device: ${error}`);
        }
    }

    #findCommissionableQueryIdentifier(record: CommissionableDeviceData) {
        const longDiscriminatorQueryId = this.#buildCommissionableQueryIdentifier({ longDiscriminator: record.D });
        if (this.#recordWaiters.has(longDiscriminatorQueryId)) {
            return longDiscriminatorQueryId;
        }

        const shortDiscriminatorQueryId = this.#buildCommissionableQueryIdentifier({ shortDiscriminator: record.SD });
        if (this.#recordWaiters.has(shortDiscriminatorQueryId)) {
            return shortDiscriminatorQueryId;
        }

        if (record.VP !== undefined) {
            const [vendorIdStr, productIdStr] = record.VP.split("+");
            if (vendorIdStr) {
                const vendorIdQueryId = this.#buildCommissionableQueryIdentifier({
                    vendorId: VendorId(parseInt(vendorIdStr)),
                });
                if (this.#recordWaiters.has(vendorIdQueryId)) {
                    return vendorIdQueryId;
                }
            }
            if (productIdStr) {
                const productIdQueryId = this.#buildCommissionableQueryIdentifier({
                    productId: parseInt(productIdStr),
                });
                if (this.#recordWaiters.has(productIdQueryId)) {
                    return productIdQueryId;
                }
            }
        }

        if (this.#recordWaiters.has("*")) {
            return "*";
        }

        return undefined;
    }

    #buildCommissionableQueryIdentifier(identifier: CommissionableDeviceIdentifiers) {
        if ("longDiscriminator" in identifier) {
            return `D:${identifier.longDiscriminator}`;
        } else if ("shortDiscriminator" in identifier) {
            return `SD:${identifier.shortDiscriminator}`;
        } else if ("vendorId" in identifier) {
            return `V:${identifier.vendorId}`;
        } else if ("productId" in identifier) {
            return `P:${identifier.productId}`;
        } else return "*";
    }

    #getCommissionableDevices(identifier: CommissionableDeviceIdentifiers) {
        const storedRecords = Array.from(this.#discoveredMatterDevices.values());

        const foundRecords = new Array<DiscoveredProxyBleDevice>();
        if ("longDiscriminator" in identifier) {
            foundRecords.push(...storedRecords.filter(({ deviceData: { D } }) => D === identifier.longDiscriminator));
        } else if ("shortDiscriminator" in identifier) {
            foundRecords.push(
                ...storedRecords.filter(({ deviceData: { SD } }) => SD === identifier.shortDiscriminator),
            );
        } else if ("vendorId" in identifier) {
            foundRecords.push(
                ...storedRecords.filter(
                    ({ deviceData: { VP } }) =>
                        VP === `${identifier.vendorId}` || VP?.startsWith(`${identifier.vendorId}+`),
                ),
            );
        } else if ("productId" in identifier) {
            foundRecords.push(
                ...storedRecords.filter(({ deviceData: { VP } }) => VP?.endsWith(`+${identifier.productId}`)),
            );
        } else {
            foundRecords.push(...storedRecords.filter(({ deviceData: { CM } }) => CM === 1 || CM === 2));
        }

        return foundRecords;
    }

    async findCommissionableDevicesContinuously(
        identifier: CommissionableDeviceIdentifiers,
        callback: (device: CommissionableDevice) => void,
        timeout?: Duration,
        cancelSignal?: Promise<void>,
    ): Promise<CommissionableDevice[]> {
        const discoveredDevices = new Set<string>();

        const discoveryEndTime = timeout ? Time.nowMs + timeout : undefined;
        const queryKey = this.#buildCommissionableQueryIdentifier(identifier);
        await this.#proxyClient.startScanning();

        let queryResolver: ((value: void) => void) | undefined;
        if (cancelSignal === undefined) {
            const created = createPromise<void>();
            cancelSignal = created.promise;
            queryResolver = created.resolver;
        }

        let canceled = false;
        cancelSignal?.then(
            () => {
                canceled = true;
                if (queryResolver === undefined) {
                    this.#finishWaiter(queryKey, true);
                }
            },
            cause => {
                logger.error("Unexpected error canceling commissioning", cause);
            },
        );

        while (!canceled) {
            this.#getCommissionableDevices(identifier).forEach(({ deviceData }) => {
                const { deviceIdentifier } = deviceData;
                if (!discoveredDevices.has(deviceIdentifier)) {
                    discoveredDevices.add(deviceIdentifier);
                    callback(deviceData);
                }
            });

            let remainingTime;
            if (discoveryEndTime !== undefined) {
                remainingTime = Millis.ceil(Timespan(Time.nowMs, discoveryEndTime).duration);
                if (remainingTime <= 0) {
                    break;
                }
            }

            await this.#registerWaiterPromise(queryKey, remainingTime, false, queryResolver);
        }
        await this.#proxyClient.stopScanning();
        return this.#getCommissionableDevices(identifier).map(({ deviceData }) => deviceData);
    }

    getDiscoveredCommissionableDevices(identifier: CommissionableDeviceIdentifiers): CommissionableDevice[] {
        return this.#getCommissionableDevices(identifier).map(({ deviceData }) => deviceData);
    }

    async close() {
        this.#proxyClient.close();
        const queryIds = [...this.#recordWaiters.keys()];

        // The discovery loop reads `canceled` flipped by cancelSignal.then(...), itself a
        // microtask. If we finished the waiter in the same tick the awaiter could resume FIRST,
        // see canceled=false, and re-arm a fresh waiter — hanging shutdown forever. Fire all
        // cancelResolvers first, yield a microtask so each cancelSignal.then handler runs and
        // sets canceled=true, THEN unblock the awaiters.
        for (const queryId of queryIds) {
            this.#recordWaiters.get(queryId)?.cancelResolver?.();
        }
        await Promise.resolve();
        for (const queryId of queryIds) {
            this.#finishWaiter(queryId, true);
        }
    }
}
