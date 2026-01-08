/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, Logger, StorageContext, StorageManager, StorageService } from "@matter/main";

const logger = new Logger("ConfigStorage");

interface ConfigData {
    fabricLabel: string;
    nextNodeId: number; // formally wrong, should be bigint
    wifiSsid?: string;
    wifiCredentials?: string;
    threadDataset?: string;
}

export class ConfigStorage {
    #env: Environment;
    #storageService?: StorageService;
    #storage?: StorageManager;
    #configStore?: StorageContext;
    readonly #data: ConfigData = {
        nextNodeId: 2, // 2 because controller is Node Id 1
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
        const nextNodeId = await this.#configStore.get<number>("nextNodeId", this.#data.nextNodeId);

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
            logger.info(`Set config key ${key} to ${data[key as keyof ConfigData]}`);
            await this.#configStore.set(key, data[key as keyof ConfigData]);
        }
    }

    async close() {
        if (this.#storage) {
            await this.#storage.close();
        }
    }
}
