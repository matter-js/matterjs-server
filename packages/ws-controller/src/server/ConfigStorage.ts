/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, Logger, Mutex, StorageContext, StorageManager, StorageService } from "@matter/main";

const logger = new Logger("ConfigStorage");

function incrementNodeId(value: number | bigint): number | bigint {
    return typeof value === "bigint" ? value + 1n : value + 1;
}

const SENSITIVE_KEYS: ReadonlySet<keyof ConfigData> = new Set(["wifiCredentials", "threadDataset"]);

function sanitizeForLog(key: string, value: unknown): string {
    if (SENSITIVE_KEYS.has(key as keyof ConfigData)) {
        // Fully redact sensitive values regardless of type or length.
        return "<redacted>";
    }
    return String(value);
}

interface ConfigData {
    fabricLabel: string;
    nextNodeId: number | bigint;
    wifiSsid?: string;
    wifiCredentials?: string;
    threadDataset?: string;
}

export class ConfigStorage {
    #env: Environment;
    #storageService?: StorageService;
    #storage?: StorageManager;
    #configStore?: StorageContext;
    readonly #nodeIdMutex = new Mutex(this);
    readonly #data: ConfigData = {
        nextNodeId: 1,
        fabricLabel: "HomeAssistant",
        wifiSsid: undefined,
        wifiCredentials: undefined,
        threadDataset: undefined,
    };

    static async create(env: Environment) {
        const instance = new ConfigStorage(env);
        await instance.open();
        return instance;
    }

    constructor(env: Environment) {
        this.#env = env;
    }

    get service() {
        if (this.#storageService === undefined) {
            throw new Error("Storage not open");
        }
        return this.#storageService;
    }

    async open() {
        this.#storageService = this.#env.get(StorageService);
        // Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location
        // in this directory, use --storage-clear to start with an empty storage.
        // Or Env vars like MATTER_STORAGE_PATH and MATTER_STORAGE_CLEAR
        logger.info(`Storage location: ${this.#storageService.location} (Directory)`);
        this.#storage = await this.#storageService.open("config");
        this.#configStore = this.#storage.createContext("values");

        const fabricLabel = (await this.#configStore.has("fabricLabel"))
            ? await this.#configStore.get<string>("fabricLabel")
            : (this.#env.vars.string("fabricLabel") ?? this.#data.fabricLabel);
        const nextNodeId = await this.#configStore.get<number | bigint>("nextNodeId", this.#data.nextNodeId);

        const wifiSsid = (await this.#configStore.has("wifiSsid"))
            ? await this.#configStore.get<string>("wifiSsid", "")
            : undefined;
        const wifiCredentials = (await this.#configStore.has("wifiCredentials"))
            ? await this.#configStore.get<string>("wifiCredentials", "")
            : undefined;
        const threadDataset = (await this.#configStore.has("threadDataset"))
            ? await this.#configStore.get<string>("threadDataset", "")
            : undefined;
        await this.set({ fabricLabel, nextNodeId, wifiSsid, wifiCredentials, threadDataset });
    }

    get fabricLabel() {
        return this.#data.fabricLabel;
    }
    get nextNodeId() {
        return this.#data.nextNodeId;
    }

    /**
     * Atomically allocate the next free node id and persist the advanced counter.
     *
     * The mutex serializes concurrent commissioning requests so they cannot read the same counter and collide.
     * `isInUse` lets a drifted counter skip ids already assigned on the fabric instead of colliding with them.
     */
    async allocateNodeId(isInUse: (nodeId: number | bigint) => boolean): Promise<number | bigint> {
        return this.#nodeIdMutex.produce(async () => {
            const start = this.#data.nextNodeId;
            let candidate = start;
            let skipped = 0;
            while (isInUse(candidate)) {
                candidate = incrementNodeId(candidate);
                skipped++;
            }
            if (skipped > 0) {
                logger.notice(
                    `Skipped ${skipped} node id(s) from ${start} already in use on the fabric, allocated ${candidate} instead`,
                );
            }
            await this.set({ nextNodeId: incrementNodeId(candidate) });
            return candidate;
        });
    }
    get wifiSsid() {
        return this.#data.wifiSsid;
    }
    get wifiCredentials() {
        return this.#data.wifiCredentials;
    }
    get threadDataset() {
        return this.#data.threadDataset;
    }

    async set(data: Partial<ConfigData>) {
        if (!this.#configStore) {
            throw new Error("Storage not open");
        }

        for (const key of Object.keys(data)) {
            if (!(key in this.#data)) {
                throw new Error(`Invalid key: ${key}`);
            }
            // @ts-expect-error key is a valid key and TS make sure about the type
            this.#data[key] = data[key];
            logger.info(`Set config key ${key} to ${sanitizeForLog(key, data[key as keyof ConfigData])}`);
            await this.#configStore.set(key, data[key as keyof ConfigData]);
        }
    }

    async removeWifiCredentials() {
        if (!this.#configStore) {
            throw new Error("Storage not open");
        }
        this.#data.wifiSsid = undefined;
        this.#data.wifiCredentials = undefined;
        await this.#configStore.delete("wifiSsid");
        await this.#configStore.delete("wifiCredentials");
        logger.info("Removed WiFi credentials");
    }

    async removeThreadDataset() {
        if (!this.#configStore) {
            throw new Error("Storage not open");
        }
        this.#data.threadDataset = undefined;
        await this.#configStore.delete("threadDataset");
        logger.info("Removed Thread dataset");
    }

    async close() {
        if (this.#storage) {
            await this.#storage.close();
        }
    }
}
