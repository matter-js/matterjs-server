/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import type { ConfigStorage } from "./ConfigStorage.js";

const logger = Logger.get("HomeAssistantClient");

/** HA device registry entry (subset of fields we need) */
export interface HaDevice {
    id: string;
    name: string;
    name_by_user: string | null;
    identifiers: Array<[string, string]>;
}

/** Result of matching HA devices to Matter nodes */
export interface HaNodeMatch {
    /** HA device ID */
    deviceId: string;
    /** HA user-assigned name (name_by_user), or default name */
    name: string;
    /** The identifier string that matched */
    identifier: string;
}

/**
 * Stateless HTTP client for Home Assistant REST API.
 * Each call is independent — no persistent connection.
 */
export class HomeAssistantClient {
    constructor(
        private readonly baseUrl: string,
        private readonly token: string,
    ) {}

    /**
     * Create a client from the SUPERVISOR_TOKEN env var (HA add-on mode).
     * Returns undefined if not running as an add-on.
     */
    static fromSupervisor(): HomeAssistantClient | undefined {
        const token = process.env.SUPERVISOR_TOKEN;
        if (!token) return undefined;
        logger.info("Detected Home Assistant Supervisor environment");
        return new HomeAssistantClient("http://supervisor/core", token);
    }

    /**
     * Create a client from stored HA credentials in ConfigStorage.
     * Returns undefined if credentials are not configured.
     */
    static fromConfig(config: ConfigStorage): HomeAssistantClient | undefined {
        const url = config.haUrl;
        const token = config.haToken;
        if (!url || !token) return undefined;
        return new HomeAssistantClient(url, token);
    }

    /**
     * Create a client, preferring Supervisor token over stored config.
     */
    static create(config: ConfigStorage): HomeAssistantClient | undefined {
        return HomeAssistantClient.fromSupervisor() ?? HomeAssistantClient.fromConfig(config);
    }

    /**
     * Test the HA connection by fetching the API status.
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.#fetch("/api/");
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Fetch all devices from the HA device registry.
     */
    async getDeviceRegistry(): Promise<HaDevice[]> {
        const response = await this.#fetch("/api/config/device_registry/list");
        if (!response.ok) {
            throw new Error(`HA device registry request failed: ${response.status} ${response.statusText}`);
        }
        return (await response.json()) as HaDevice[];
    }

    /**
     * Update a device's user-assigned name in HA.
     */
    async updateDeviceName(deviceId: string, name: string): Promise<void> {
        const response = await this.#fetch("/api/config/device_registry/update", {
            method: "POST",
            body: JSON.stringify({
                device_id: deviceId,
                name_by_user: name || null,
            }),
        });
        if (!response.ok) {
            throw new Error(`HA device update failed: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Match HA Matter devices to matterjs node IDs.
     *
     * HA uses identifiers like ["matter", "deviceid_<compressed_fabric_id>-<node_id>-<endpoint>"].
     * We match on compressed_fabric_id and node_id, preferring endpoint 0.
     *
     * @returns Map of node_id (string) → HaNodeMatch
     */
    static matchDevicesToNodes(devices: HaDevice[], compressedFabricId: bigint): Map<string, HaNodeMatch> {
        const fabricStr = compressedFabricId.toString();
        const prefix = `deviceid_${fabricStr}-`;
        const matches = new Map<string, HaNodeMatch>();

        for (const device of devices) {
            for (const [domain, identifier] of device.identifiers) {
                if (domain !== "matter" || !identifier.startsWith(prefix)) continue;

                // Parse: deviceid_<fabric>-<node_id>-<endpoint>
                const suffix = identifier.slice(prefix.length);
                const dashIdx = suffix.indexOf("-");
                if (dashIdx === -1) continue;

                const nodeIdStr = suffix.slice(0, dashIdx);
                const endpointStr = suffix.slice(dashIdx + 1);
                const endpoint = parseInt(endpointStr, 10);

                // Prefer endpoint 0 (root), otherwise keep lowest endpoint
                const existing = matches.get(nodeIdStr);
                if (
                    !existing ||
                    endpoint === 0 ||
                    (existing.identifier.endsWith("-0")
                        ? false
                        : endpoint < parseInt(existing.identifier.split("-").pop()!, 10))
                ) {
                    matches.set(nodeIdStr, {
                        deviceId: device.id,
                        name: device.name_by_user ?? device.name,
                        identifier,
                    });
                }
            }
        }

        return matches;
    }

    async #fetch(path: string, init?: RequestInit): Promise<Response> {
        const url = `${this.baseUrl}${path}`;
        return fetch(url, {
            ...init,
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
                ...(init?.headers as Record<string, string>),
            },
        });
    }
}
