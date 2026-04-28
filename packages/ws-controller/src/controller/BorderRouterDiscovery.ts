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
    readonly parameters: ReadonlyMap<string, string>;
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
interface PendingMeshcop {
    networkName?: string;
    vendorName?: string;
    modelName?: string;
    threadVersion?: string;
    domainName?: string;
    meshcopPort?: number;
    addresses: string[];
}

export class BorderRouterDiscovery {
    readonly #env: Environment;
    readonly #registry = new Map<string, BorderRouterEntry>();
    readonly #instanceObservers = new Map<string, InstanceTracking>();
    readonly #targetObservers = new Map<string, TargetTracking>();
    /**
     * Meshcop fields seen before a matching trel record (which carries the canonical xa hex
     * in its qname). Keyed by lowercased hostname (SRV target). Drained when a trel record
     * arrives whose target matches.
     */
    readonly #pendingMeshcopByHostname = new Map<string, PendingMeshcop>();
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

        logger.info(`Border router discovery active (${MESHCOP_TYPE_QNAME} + ${TREL_TYPE_QNAME})`);
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
        this.#pendingMeshcopByHostname.clear();
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
            logger.info(`Border router removed [xa=${xaKey}] (last source ${source} expired)`);
        } else {
            logger.info(
                `Border router source dropped [xa=${xaKey} source=${source}], remaining=${entry.sources.join(",")}`,
            );
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

            if (source === "trel") {
                this.#upsertFromTrel(name, srvTarget, srvPort, addresses);
            } else {
                this.#upsertFromMeshcop(name, srvTarget, srvPort, addresses);
            }
        } catch (e) {
            logger.debug("Error parsing border router record:", e);
        }
    }

    #upsertFromTrel(
        name: DnssdNameLike,
        srvTarget: string | undefined,
        srvPort: number | undefined,
        addresses: string[],
    ): void {
        const xaKey = parseTrelXaFromQname(name.qname);
        if (xaKey === undefined) return;

        const existing = this.#registry.get(xaKey);
        const entry: BorderRouterEntry = existing ?? {
            extAddressHex: xaKey,
            addresses: [],
            sources: [],
            lastSeen: Date.now(),
        };

        if (srvTarget !== undefined && entry.hostname === undefined) {
            entry.hostname = srvTarget;
        }
        if (addresses.length > 0 && entry.addresses.length === 0) {
            entry.addresses = addresses;
        }
        if (srvPort !== undefined) entry.trelPort = srvPort;
        if (!entry.sources.includes("trel")) entry.sources.push("trel");
        entry.lastSeen = Date.now();

        if (srvTarget !== undefined) {
            const pending = this.#pendingMeshcopByHostname.get(srvTarget.toLowerCase());
            if (pending !== undefined) {
                this.#applyPendingMeshcop(entry, pending);
                this.#pendingMeshcopByHostname.delete(srvTarget.toLowerCase());
            }
        }

        if (existing === undefined) {
            if (this.#registry.size >= REGISTRY_MAX_ENTRIES) this.#evictOldest();
            this.#registry.set(xaKey, entry);
        }
        this.#trackXaOnInstance(name, xaKey);

        const verb = existing === undefined ? "discovered" : "updated";
        logger.info(`Border router ${verb} via trel [xa=${xaKey} qname=${name.qname}]: ${JSON.stringify(entry)}`);
    }

    /**
     * Meshcop TXT values for binary fields (xa, xp, at, pt, sb, dd) are mangled to U+FFFD by
     * matter.js's UTF-8 TXT decoder, so we cannot recover xa from meshcop alone. We merge
     * meshcop string-only fields (nn, vn, mn, tv, dn, hostname, ports, addresses) into the
     * trel-keyed entry by matching SRV target. If the trel record hasn't arrived yet we stash
     * by hostname; the trel parse path drains the pending entry when its target matches.
     */
    #upsertFromMeshcop(
        name: DnssdNameLike,
        srvTarget: string | undefined,
        srvPort: number | undefined,
        addresses: string[],
    ): void {
        if (srvTarget === undefined) return;
        const params = name.parameters;
        const fields: PendingMeshcop = {
            networkName: params.get("nn") ?? undefined,
            vendorName: params.get("vn") ?? undefined,
            modelName: params.get("mn") ?? undefined,
            threadVersion: params.get("tv") ?? undefined,
            domainName: params.get("dn") ?? undefined,
            meshcopPort: srvPort,
            addresses,
        };

        const targetKey = srvTarget.toLowerCase();
        const matchingEntry = this.#findEntryByHostname(targetKey);
        if (matchingEntry !== undefined) {
            this.#applyPendingMeshcop(matchingEntry, fields);
            if (matchingEntry.hostname === undefined) matchingEntry.hostname = srvTarget;
            if (!matchingEntry.sources.includes("meshcop")) matchingEntry.sources.unshift("meshcop");
            matchingEntry.lastSeen = Date.now();
            this.#trackXaOnInstance(name, matchingEntry.extAddressHex);
            logger.info(
                `Border router updated via meshcop [xa=${matchingEntry.extAddressHex} qname=${name.qname}]: ${JSON.stringify(matchingEntry)}`,
            );
        } else {
            this.#pendingMeshcopByHostname.set(targetKey, fields);
            logger.info(
                `Border router meshcop pending (no trel xa yet) [hostname=${srvTarget} qname=${name.qname}]: ${JSON.stringify(fields)}`,
            );
        }
    }

    #findEntryByHostname(lowerHostname: string): BorderRouterEntry | undefined {
        for (const entry of this.#registry.values()) {
            if (entry.hostname?.toLowerCase() === lowerHostname) return entry;
        }
        return undefined;
    }

    #applyPendingMeshcop(entry: BorderRouterEntry, fields: PendingMeshcop): void {
        if (fields.networkName !== undefined) entry.networkName = fields.networkName;
        if (fields.vendorName !== undefined) entry.vendorName = fields.vendorName;
        if (fields.modelName !== undefined) entry.modelName = fields.modelName;
        if (fields.threadVersion !== undefined) entry.threadVersion = fields.threadVersion;
        if (fields.domainName !== undefined) entry.domainName = fields.domainName;
        if (fields.meshcopPort !== undefined) entry.meshcopPort = fields.meshcopPort;
        if (fields.addresses.length > 0 && entry.addresses.length === 0) entry.addresses = fields.addresses;
    }

    #trackXaOnInstance(name: DnssdNameLike, xaKey: string): void {
        const tracking = this.#instanceObservers.get(name.qname.toLowerCase());
        if (tracking !== undefined) tracking.xaKey = xaKey;
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

/**
 * The `_trel._udp.local` instance qname is the lowercase hex form of the 8-byte extended
 * address (xa). matter.js's TXT decoder mangles binary `xa` values to U+FFFD, but the qname
 * survives intact, so this is the only reliable source of the canonical xa hex.
 */
function parseTrelXaFromQname(qname: string): string | undefined {
    const lower = qname.toLowerCase();
    const idx = lower.indexOf("." + TREL_TYPE_QNAME);
    if (idx !== 16 && idx !== -1) {
        // Instance qname must start with exactly 16 hex chars before the type suffix.
        return undefined;
    }
    if (idx === -1) return undefined;
    const prefix = lower.slice(0, 16);
    if (!/^[0-9a-f]{16}$/.test(prefix)) return undefined;
    return prefix.toUpperCase();
}
