/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, Logger, StorageContext, StorageManager, StorageService } from "@matter/main";

const logger = new Logger("ConfigStorage");

const SENSITIVE_KEYS: ReadonlySet<keyof ConfigData> = new Set(["wifiCredentials", "threadDataset", "haToken"]);

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
    haUrl?: string;
    haToken?: string;
}

export class ConfigStorage {
    #env: Environment;
    #storageService?: StorageService;
    #storage?: StorageManager;
    #configStore?: StorageContext;
    #nodeLabelStore?: StorageContext;
    readonly #nodeLabels = new Map<string, string>();
    readonly #data: ConfigData = {
        nextNodeId: 1,
        fabricLabel: "HomeAssistant",
        wifiSsid: undefined,
        wifiCredentials: undefined,
        threadDataset: undefined,
        haUrl: undefined,
        haToken: undefined,
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
        const haUrl = (await this.#configStore.has("haUrl"))
            ? await this.#configStore.get<string>("haUrl", "")
            : undefined;
        const haToken = (await this.#configStore.has("haToken"))
            ? await this.#configStore.get<string>("haToken", "")
            : undefined;
        await this.set({ fabricLabel, nextNodeId, wifiSsid, wifiCredentials, threadDataset, haUrl, haToken });

        // Load custom node labels
        this.#nodeLabelStore = this.#storage.createContext("node-labels");
        for (const key of await this.#nodeLabelStore.keys()) {
            const label = await this.#nodeLabelStore.get<string>(key);
            if (label) {
                this.#nodeLabels.set(key, label);
            }
        }
        if (this.#nodeLabels.size > 0) {
            logger.info(`Loaded ${this.#nodeLabels.size} custom node label(s)`);
        }
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
    get haUrl() {
        return this.#data.haUrl;
    }
    get haToken() {
        return this.#data.haToken;
    }

    /** True if HA credentials are configured (either via storage or SUPERVISOR_TOKEN env var) */
    get haConfigured(): boolean {
        return !!(this.#data.haUrl && this.#data.haToken) || !!process.env.SUPERVISOR_TOKEN;
    }

    getNodeLabel(nodeId: string): string | undefined {
        return this.#nodeLabels.get(nodeId);
    }

    async setNodeLabel(nodeId: string, label: string) {
        if (!this.#nodeLabelStore) {
            throw new Error("Storage not open");
        }
        if (label) {
            this.#nodeLabels.set(nodeId, label);
            await this.#nodeLabelStore.set(nodeId, label);
            logger.debug(`Set custom label for node ${nodeId}`);
        } else {
            this.#nodeLabels.delete(nodeId);
            await this.#nodeLabelStore.delete(nodeId);
            logger.debug(`Cleared custom label for node ${nodeId}`);
        }
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

    async close() {
        if (this.#storage) {
            await this.#storage.close();
        }
    }
}
