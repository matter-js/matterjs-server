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

export interface WifiCredentialEntry {
    id: string;
    ssid: string;
    credentials: string;
}

export interface ThreadCredentialEntry {
    id: string;
    dataset: string;
}

const DEFAULT_CREDENTIAL_ID = "default";
const RESERVED_CREDENTIAL_IDS: ReadonlySet<string> = new Set([DEFAULT_CREDENTIAL_ID, "delete"]);

const SENSITIVE_KEYS: ReadonlySet<keyof ConfigData> = new Set(["wifiCredentials", "threadDataset"]);

const SENSITIVE_LIST_KEYS = new Set(["additionalWifiCredentials", "additionalThreadCredentials"]);

function sanitizeForLog(key: string, value: unknown): string {
    if (SENSITIVE_KEYS.has(key as keyof ConfigData) || SENSITIVE_LIST_KEYS.has(key)) {
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
    #additionalWifiCredentials: WifiCredentialEntry[] = new Array<WifiCredentialEntry>();
    #additionalThreadCredentials: ThreadCredentialEntry[] = new Array<ThreadCredentialEntry>();

    // Stored as plain string-record arrays so they satisfy SupportedStorageTypes.
    static #toStoredWifi(list: WifiCredentialEntry[]): Array<Record<string, string>> {
        return list.map(({ id, ssid, credentials }) => ({ id, ssid, credentials }));
    }
    static #toStoredThread(list: ThreadCredentialEntry[]): Array<Record<string, string>> {
        return list.map(({ id, dataset }) => ({ id, dataset }));
    }
    static #fromStoredWifi(raw: Array<Record<string, string>>): WifiCredentialEntry[] {
        return raw.map(r => ({ id: r.id ?? "", ssid: r.ssid ?? "", credentials: r.credentials ?? "" }));
    }
    static #fromStoredThread(raw: Array<Record<string, string>>): ThreadCredentialEntry[] {
        return raw.map(r => ({ id: r.id ?? "", dataset: r.dataset ?? "" }));
    }

    static readonly DEFAULT_CREDENTIAL_ID = DEFAULT_CREDENTIAL_ID;

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

        if (await this.#configStore.has("additionalWifiCredentials")) {
            const raw = await this.#configStore.get<Array<Record<string, string>>>(
                "additionalWifiCredentials",
                new Array<Record<string, string>>(),
            );
            this.#additionalWifiCredentials = ConfigStorage.#fromStoredWifi(raw);
        }
        if (await this.#configStore.has("additionalThreadCredentials")) {
            const raw = await this.#configStore.get<Array<Record<string, string>>>(
                "additionalThreadCredentials",
                new Array<Record<string, string>>(),
            );
            this.#additionalThreadCredentials = ConfigStorage.#fromStoredThread(raw);
        }
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

    listWifiCredentials(): WifiCredentialEntry[] {
        const out = new Array<WifiCredentialEntry>();
        if (this.#data.wifiSsid !== undefined && this.#data.wifiCredentials !== undefined) {
            out.push({
                id: DEFAULT_CREDENTIAL_ID,
                ssid: this.#data.wifiSsid,
                credentials: this.#data.wifiCredentials,
            });
        }
        for (const e of this.#additionalWifiCredentials) out.push({ ...e });
        return out;
    }

    listThreadCredentials(): ThreadCredentialEntry[] {
        const out = new Array<ThreadCredentialEntry>();
        if (this.#data.threadDataset !== undefined) {
            out.push({ id: DEFAULT_CREDENTIAL_ID, dataset: this.#data.threadDataset });
        }
        for (const e of this.#additionalThreadCredentials) out.push({ ...e });
        return out;
    }

    getWifiCredentials(id: string): { ssid: string; credentials: string } | undefined {
        const e = this.listWifiCredentials().find(c => c.id.toLowerCase() === id.trim().toLowerCase());
        return e === undefined ? undefined : { ssid: e.ssid, credentials: e.credentials };
    }

    getThreadCredentials(id: string): { dataset: string } | undefined {
        const e = this.listThreadCredentials().find(c => c.id.toLowerCase() === id.trim().toLowerCase());
        return e === undefined ? undefined : { dataset: e.dataset };
    }

    async setWifiCredentials(id: string, ssid: string, credentials?: string): Promise<void> {
        const canonical = this.#validateCredentialId(id);
        if (canonical === DEFAULT_CREDENTIAL_ID) {
            const secret = this.#keepOrReplaceSecret(credentials, this.#data.wifiCredentials);
            await this.set({ wifiSsid: ssid, wifiCredentials: secret });
            return;
        }
        const list = [...this.#additionalWifiCredentials];
        const idx = list.findIndex(e => e.id.toLowerCase() === canonical.toLowerCase());
        this.#assertNoCaseClash(id, list);
        const secret = this.#keepOrReplaceSecret(credentials, idx >= 0 ? list[idx].credentials : undefined);
        const entry: WifiCredentialEntry = { id: id.trim(), ssid, credentials: secret };
        if (idx >= 0) list[idx] = entry;
        else list.push(entry);
        await this.#saveAdditionalWifiCredentials(list);
    }

    async setThreadCredentials(id: string, dataset: string): Promise<void> {
        const canonical = this.#validateCredentialId(id);
        if (canonical === DEFAULT_CREDENTIAL_ID) {
            await this.set({ threadDataset: dataset });
            return;
        }
        const list = [...this.#additionalThreadCredentials];
        const idx = list.findIndex(e => e.id.toLowerCase() === canonical.toLowerCase());
        this.#assertNoCaseClash(id, list);
        const entry: ThreadCredentialEntry = { id: id.trim(), dataset };
        if (idx >= 0) list[idx] = entry;
        else list.push(entry);
        await this.#saveAdditionalThreadCredentials(list);
    }

    async removeWifiCredentials(id: string = DEFAULT_CREDENTIAL_ID): Promise<void> {
        if (id.trim().toLowerCase() === DEFAULT_CREDENTIAL_ID) {
            this.#data.wifiSsid = undefined;
            this.#data.wifiCredentials = undefined;
            await this.#configStore?.delete("wifiSsid");
            await this.#configStore?.delete("wifiCredentials");
            logger.info("Removed WiFi credentials");
            return;
        }
        const list = this.#additionalWifiCredentials.filter(e => e.id.toLowerCase() !== id.trim().toLowerCase());
        await this.#saveAdditionalWifiCredentials(list);
    }

    async removeThreadCredentials(id: string = DEFAULT_CREDENTIAL_ID): Promise<void> {
        if (id.trim().toLowerCase() === DEFAULT_CREDENTIAL_ID) {
            this.#data.threadDataset = undefined;
            await this.#configStore?.delete("threadDataset");
            return;
        }
        const list = this.#additionalThreadCredentials.filter(e => e.id.toLowerCase() !== id.trim().toLowerCase());
        await this.#saveAdditionalThreadCredentials(list);
    }

    async removeThreadDataset() {
        await this.removeThreadCredentials(DEFAULT_CREDENTIAL_ID);
        logger.info("Removed Thread dataset");
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

    #keepOrReplaceSecret(provided: string | undefined, existing: string | undefined): string {
        if (provided !== undefined && provided !== "") return provided;
        if (existing !== undefined) return existing;
        return "";
    }

    #validateCredentialId(id: string): string {
        const trimmed = id.trim();
        if (trimmed === "") throw new Error("invalid-credential-id: id must be non-empty");
        const lower = trimmed.toLowerCase();
        if (lower === DEFAULT_CREDENTIAL_ID) return DEFAULT_CREDENTIAL_ID;
        if (RESERVED_CREDENTIAL_IDS.has(lower)) {
            throw new Error(`invalid-credential-id: '${trimmed}' is reserved`);
        }
        return trimmed;
    }

    #assertNoCaseClash(id: string, list: ReadonlyArray<{ id: string }>): void {
        const lower = id.trim().toLowerCase();
        const clash = list.find(e => e.id.toLowerCase() === lower && e.id !== id.trim());
        if (clash !== undefined) {
            throw new Error(`invalid-credential-id: '${id.trim()}' duplicates existing '${clash.id}'`);
        }
    }

    async #saveAdditionalWifiCredentials(list: WifiCredentialEntry[]): Promise<void> {
        if (!this.#configStore) {
            throw new Error("Storage not open");
        }
        this.#additionalWifiCredentials = list;
        logger.info(`Set config key additionalWifiCredentials to ${sanitizeForLog("additionalWifiCredentials", list)}`);
        await this.#configStore.set("additionalWifiCredentials", ConfigStorage.#toStoredWifi(list));
    }

    async #saveAdditionalThreadCredentials(list: ThreadCredentialEntry[]): Promise<void> {
        if (!this.#configStore) {
            throw new Error("Storage not open");
        }
        this.#additionalThreadCredentials = list;
        logger.info(
            `Set config key additionalThreadCredentials to ${sanitizeForLog("additionalThreadCredentials", list)}`,
        );
        await this.#configStore.set("additionalThreadCredentials", ConfigStorage.#toStoredThread(list));
    }

    async close() {
        if (this.#storage) {
            await this.#storage.close();
        }
    }
}
