/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry } from "@matter-server/ws-client";
import { type DnsRecord, DnsRecordType, Environment, Logger, type SrvRecordValue } from "@matter/main";
import { MdnsService } from "@matter/main/protocol";

const logger = Logger.get("BorderRouterDiscovery");

const REGISTRY_MAX_ENTRIES = 256;
const MESHCOP_TYPE_QNAME = "_meshcop._udp.local";
const TREL_TYPE_QNAME = "_trel._udp.local";
const MESHCOP_SUFFIX = "._meshcop._udp.local";
const TREL_SUFFIX = "._trel._udp.local";

type Source = "meshcop" | "trel";

interface DnssdRecordLike {
    recordType: DnsRecordType;
    name: string;
    value: unknown;
}

interface DnssdNameLike {
    readonly qname: string;
    readonly parameters: Map<string, string>;
    readonly records: Iterable<DnssdRecordLike>;
    readonly isDiscovered: boolean;
    on(observer: NameObserver): void;
    off(observer: NameObserver): void;
}

interface DnssdNamesFiltersLike {
    add(filter: (record: DnsRecord) => boolean): unknown;
    delete(filter: (record: DnsRecord) => boolean): unknown;
}

interface DiscoveredObservableLike {
    on(observer: DiscoveredObserver): void;
    off(observer: DiscoveredObserver): void;
}

interface SolicitorLike {
    solicit(solicitation: { name: DnssdNameLike; recordTypes: DnsRecordType[] }): void;
}

interface DnssdNamesLike {
    readonly filters: DnssdNamesFiltersLike;
    readonly discovered: DiscoveredObservableLike;
    readonly solicitor: SolicitorLike;
    get(qname: string): DnssdNameLike;
    maybeGet(qname: string): DnssdNameLike | undefined;
}

type DiscoveredObserver = (name: DnssdNameLike) => void;
type NameObserver = (changes: { name: DnssdNameLike; updated?: unknown[]; deleted?: unknown[] }) => void;

interface InstanceTracking {
    name: DnssdNameLike;
    source: Source;
    observer: NameObserver;
    targetKey?: string;
    xaKey?: string;
}

interface TargetTracking {
    target: DnssdNameLike;
    observer: NameObserver;
    refcount: number;
}

/**
 * Passive Thread Border Router discovery via mDNS.
 *
 * Subscribes to `_meshcop._udp.local` and `_trel._udp.local`, builds a per-extended-address
 * registry, and exposes the current entries through {@link list}. Owned by {@link MatterController}.
 */
export class BorderRouterDiscovery {
    readonly #env: Environment;
    readonly #registry = new Map<string, BorderRouterEntry>();
    readonly #instanceObservers = new Map<string, InstanceTracking>();
    readonly #targetObservers = new Map<string, TargetTracking>();
    #names?: DnssdNamesLike;
    #injectedNames?: DnssdNamesLike;
    #suffixFilter?: (record: DnsRecord) => boolean;
    #discoveredObserver?: DiscoveredObserver;
    #started = false;
    #evictionWarnedThisCycle = false;

    constructor(env: Environment, names?: DnssdNamesLike) {
        this.#env = env;
        this.#injectedNames = names;
    }

    async start(): Promise<void> {
        if (this.#started) return;
        this.#started = true;
        this.#evictionWarnedThisCycle = false;

        let names: DnssdNamesLike;
        if (this.#injectedNames !== undefined) {
            names = this.#injectedNames;
        } else {
            try {
                const mdns = this.#env.get(MdnsService);
                await mdns.construction.ready;
                names = mdns.names;
            } catch (e) {
                logger.warn("MDNS service unavailable; border router discovery inactive:", e);
                this.#started = false;
                return;
            }
        }
        this.#names = names;

        const suffixFilter = ({ name }: DnsRecord): boolean => {
            const lower = name.toLowerCase();
            return lower.endsWith(MESHCOP_SUFFIX) || lower.endsWith(TREL_SUFFIX);
        };
        this.#suffixFilter = suffixFilter;
        names.filters.add(suffixFilter);

        const meshcopType = names.get(MESHCOP_TYPE_QNAME);
        const trelType = names.get(TREL_TYPE_QNAME);
        names.solicitor.solicit({ name: meshcopType, recordTypes: [DnsRecordType.PTR] });
        names.solicitor.solicit({ name: trelType, recordTypes: [DnsRecordType.PTR] });

        const observer: DiscoveredObserver = name => this.#onDiscovered(name);
        this.#discoveredObserver = observer;
        names.discovered.on(observer);
    }

    async stop(): Promise<void> {
        if (!this.#started) return;
        this.#started = false;

        const names = this.#names;
        if (names !== undefined) {
            if (this.#discoveredObserver !== undefined) {
                names.discovered.off(this.#discoveredObserver);
            }
            if (this.#suffixFilter !== undefined) {
                names.filters.delete(this.#suffixFilter);
            }
        }
        this.#discoveredObserver = undefined;
        this.#suffixFilter = undefined;

        for (const tracking of this.#instanceObservers.values()) {
            tracking.name.off(tracking.observer);
        }
        this.#instanceObservers.clear();

        for (const tracking of this.#targetObservers.values()) {
            tracking.target.off(tracking.observer);
        }
        this.#targetObservers.clear();

        this.#registry.clear();
        this.#names = undefined;
    }

    list(): BorderRouterEntry[] {
        return Array.from(this.#registry.values());
    }

    get(extAddressHex: string): BorderRouterEntry | undefined {
        return this.#registry.get(extAddressHex.toUpperCase());
    }

    #onDiscovered(name: DnssdNameLike): void {
        if (!this.#started) return;
        const lower = name.qname.toLowerCase();
        if (lower === MESHCOP_TYPE_QNAME || lower === TREL_TYPE_QNAME) {
            return;
        }
        let source: Source;
        if (lower.endsWith(MESHCOP_SUFFIX)) {
            source = "meshcop";
        } else if (lower.endsWith(TREL_SUFFIX)) {
            source = "trel";
        } else {
            return;
        }

        const key = lower;
        if (this.#instanceObservers.has(key)) {
            return;
        }

        const observer: NameObserver = () => this.#onInstanceChanged(name, source);
        this.#instanceObservers.set(key, { name, source, observer });
        name.on(observer);

        this.#parseAndUpsert(name, source);
    }

    #onInstanceChanged(name: DnssdNameLike, source: Source): void {
        if (!this.#started) return;
        try {
            this.#parseAndUpsert(name, source);
        } catch (e) {
            logger.debug("Error processing border router instance change:", e);
        }

        if (name.isDiscovered) {
            return;
        }

        const key = name.qname.toLowerCase();
        const tracking = this.#instanceObservers.get(key);
        if (tracking === undefined) {
            return;
        }
        tracking.name.off(tracking.observer);
        this.#instanceObservers.delete(key);

        if (tracking.targetKey !== undefined) {
            this.#releaseTarget(tracking.targetKey);
        }

        const xaKey = tracking.xaKey;
        if (xaKey === undefined) {
            return;
        }
        const entry = this.#registry.get(xaKey);
        if (entry === undefined) {
            return;
        }
        const idx = entry.sources.indexOf(source);
        if (idx !== -1) {
            entry.sources.splice(idx, 1);
        }
        if (source === "meshcop") {
            entry.meshcopPort = undefined;
        } else {
            entry.trelPort = undefined;
        }
        if (entry.sources.length === 0) {
            this.#registry.delete(xaKey);
        }
    }

    #onTargetChanged(target: DnssdNameLike): void {
        if (!this.#started) return;
        try {
            const targetQname = target.qname.toLowerCase();
            for (const entry of this.#registry.values()) {
                if (entry.hostname?.toLowerCase() === targetQname) {
                    entry.addresses = this.#sortAddresses(this.#collectAddresses(target));
                }
            }
        } catch (e) {
            logger.debug("Error processing border router target change:", e);
        }
    }

    #parseAndUpsert(name: DnssdNameLike, source: Source): void {
        const names = this.#names;
        if (names === undefined) return;

        try {
            const params = name.parameters;
            const xa = params.get("xa");
            if (xa === undefined || xa.length === 0) {
                return;
            }
            const xaKey = xa.toUpperCase();

            const records = Array.from(name.records);
            const srvRecord = records.find(r => r.recordType === DnsRecordType.SRV);
            let srvTarget: string | undefined;
            let srvPort: number | undefined;
            if (srvRecord !== undefined && isSrvValue(srvRecord.value)) {
                srvTarget = srvRecord.value.target;
                srvPort = srvRecord.value.port;
            }

            let addresses: string[] = [];
            if (srvTarget !== undefined) {
                const target = names.get(srvTarget);
                addresses = this.#sortAddresses(this.#collectAddresses(target));
                this.#attachTargetObserver(name, srvTarget, target);
            }

            const xp = params.get("xp")?.toUpperCase();

            const existing = this.#registry.get(xaKey);
            const meshcopWins = source === "meshcop";
            const entry: BorderRouterEntry = existing ?? {
                extAddressHex: xaKey,
                addresses: [],
                sources: [],
                lastSeen: Date.now(),
            };

            const meshcopAlreadyContributed = entry.sources.includes("meshcop");
            const canOverwrite = meshcopWins || !meshcopAlreadyContributed;

            if (xp !== undefined && canOverwrite) {
                entry.extendedPanIdHex = xp;
            }

            const previousHostname = entry.hostname;
            if (srvTarget !== undefined && canOverwrite) {
                entry.hostname = srvTarget;
            }

            if (
                source === "meshcop" &&
                srvTarget !== undefined &&
                previousHostname !== undefined &&
                previousHostname.toLowerCase() !== srvTarget.toLowerCase()
            ) {
                this.#repointTrelTargetForXa(xaKey, previousHostname, srvTarget, names);
            }

            if (addresses.length > 0 && canOverwrite) {
                entry.addresses = addresses;
            }

            if (source === "meshcop") {
                if (srvPort !== undefined) entry.meshcopPort = srvPort;
                const nn = params.get("nn");
                if (nn !== undefined) entry.networkName = nn;
                const vn = params.get("vn");
                if (vn !== undefined) entry.vendorName = vn;
                const mn = params.get("mn");
                if (mn !== undefined) entry.modelName = mn;
                const tv = params.get("tv");
                if (tv !== undefined) entry.threadVersion = tv;
                const dd = params.get("dd");
                if (dd !== undefined) entry.borderAgentIdHex = dd.toUpperCase();
                const sb = params.get("sb");
                if (sb !== undefined) entry.stateBitmapHex = sb.toUpperCase();
                const at = params.get("at");
                if (at !== undefined) entry.activeTimestampHex = at.toUpperCase();
                const pt = params.get("pt");
                if (pt !== undefined) entry.partitionIdHex = pt.toUpperCase();
                const dn = params.get("dn");
                if (dn !== undefined) entry.domainName = dn;
            } else if (source === "trel") {
                if (srvPort !== undefined) entry.trelPort = srvPort;
            }

            if (!entry.sources.includes(source)) {
                if (source === "meshcop") {
                    entry.sources.unshift(source);
                } else {
                    entry.sources.push(source);
                }
            }
            entry.lastSeen = Date.now();

            if (existing === undefined) {
                if (this.#registry.size >= REGISTRY_MAX_ENTRIES) {
                    this.#evictOldest();
                }
                this.#registry.set(xaKey, entry);
            }

            const tracking = this.#instanceObservers.get(name.qname.toLowerCase());
            if (tracking !== undefined) {
                tracking.xaKey = xaKey;
            }
        } catch (e) {
            logger.debug("Error parsing border router record:", e);
        }
    }

    #collectAddresses(target: DnssdNameLike): string[] {
        const out = new Array<string>();
        for (const record of target.records) {
            if (record.recordType !== DnsRecordType.A && record.recordType !== DnsRecordType.AAAA) continue;
            if (typeof record.value === "string") {
                out.push(record.value);
            }
        }
        return out;
    }

    #sortAddresses(addresses: string[]): string[] {
        const seen = new Set<string>();
        const unique = new Array<string>();
        for (const addr of addresses) {
            if (!seen.has(addr)) {
                seen.add(addr);
                unique.push(addr);
            }
        }
        const ipv4 = unique.filter(a => !a.includes(":"));
        const ipv6 = unique.filter(a => a.includes(":"));
        const categorize = (a: string): number => {
            const lower = a.toLowerCase();
            if (lower.startsWith("fe80:")) return 2;
            if (lower.startsWith("fc") || lower.startsWith("fd")) return 1;
            const firstChar = lower.charAt(0);
            if (firstChar === "2" || firstChar === "3") return 0;
            return 3;
        };
        ipv6.sort((a, b) => {
            const ca = categorize(a);
            const cb = categorize(b);
            if (ca !== cb) return ca - cb;
            return a.localeCompare(b);
        });
        ipv4.sort((a, b) => a.localeCompare(b));
        return [...ipv4, ...ipv6];
    }

    #attachTargetObserver(instance: DnssdNameLike, srvTarget: string, target: DnssdNameLike): void {
        const targetKey = srvTarget.toLowerCase();
        const instanceKey = instance.qname.toLowerCase();
        const instanceTracking = this.#instanceObservers.get(instanceKey);
        const previousTargetKey = instanceTracking?.targetKey;

        if (previousTargetKey === targetKey) {
            return;
        }

        if (previousTargetKey !== undefined) {
            this.#releaseTarget(previousTargetKey);
        }

        const existing = this.#targetObservers.get(targetKey);
        if (existing !== undefined) {
            existing.refcount++;
        } else {
            const observer: NameObserver = () => this.#onTargetChanged(target);
            target.on(observer);
            this.#targetObservers.set(targetKey, { target, observer, refcount: 1 });
        }
        if (instanceTracking !== undefined) {
            instanceTracking.targetKey = targetKey;
        }
    }

    #repointTrelTargetForXa(xaKey: string, previousHostname: string, newTarget: string, names: DnssdNamesLike): void {
        const previousKey = previousHostname.toLowerCase();
        for (const tracking of this.#instanceObservers.values()) {
            if (tracking.xaKey !== xaKey) continue;
            if (tracking.source !== "trel") continue;
            if (tracking.targetKey !== previousKey) continue;
            this.#attachTargetObserver(tracking.name, newTarget, names.get(newTarget));
        }
    }

    #releaseTarget(targetKey: string): void {
        const tracking = this.#targetObservers.get(targetKey);
        if (tracking === undefined) return;
        tracking.refcount--;
        if (tracking.refcount <= 0) {
            tracking.target.off(tracking.observer);
            this.#targetObservers.delete(targetKey);
        }
    }

    #evictOldest(): void {
        let oldestKey: string | undefined;
        let oldestSeen = Number.POSITIVE_INFINITY;
        for (const [xa, entry] of this.#registry) {
            if (entry.lastSeen < oldestSeen) {
                oldestSeen = entry.lastSeen;
                oldestKey = xa;
            }
        }
        if (oldestKey === undefined) return;

        this.#registry.delete(oldestKey);

        let releasedObservers = 0;
        for (const [instanceKey, tracking] of [...this.#instanceObservers]) {
            if (tracking.xaKey !== oldestKey) continue;
            tracking.name.off(tracking.observer);
            if (tracking.targetKey !== undefined) {
                this.#releaseTarget(tracking.targetKey);
            }
            this.#instanceObservers.delete(instanceKey);
            releasedObservers++;
        }

        if (!this.#evictionWarnedThisCycle) {
            this.#evictionWarnedThisCycle = true;
            logger.warn(
                `Border router registry exceeded ${REGISTRY_MAX_ENTRIES} entries; evicting oldest (released ${releasedObservers} instance observer${releasedObservers === 1 ? "" : "s"})`,
            );
        } else {
            logger.debug(`Evicted border router xa=${oldestKey}; released ${releasedObservers} instance observers`);
        }
    }
}

function isSrvValue(value: unknown): value is SrvRecordValue {
    return (
        typeof value === "object" &&
        value !== null &&
        "target" in value &&
        typeof value.target === "string" &&
        "port" in value &&
        typeof value.port === "number"
    );
}
