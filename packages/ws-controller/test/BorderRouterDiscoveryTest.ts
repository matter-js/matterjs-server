/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DnsRecord, DnsRecordClass, DnsRecordType, Environment, Seconds } from "@matter/main";
import { BorderRouterDiscovery } from "../src/controller/BorderRouterDiscovery.js";

describe("BorderRouterDiscovery", () => {
    let env: Environment;
    let discovery: BorderRouterDiscovery;

    beforeEach(() => {
        env = new Environment("test");
        discovery = new BorderRouterDiscovery(env);
    });

    afterEach(async () => {
        await discovery.stop();
    });

    it("starts with an empty registry", () => {
        expect(discovery.list()).to.deep.equal([]);
    });

    it("stop() before start() is a no-op", async () => {
        await discovery.stop();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("start() is callable without errors", async () => {
        await discovery.start();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("start() is idempotent", async () => {
        await discovery.start();
        await discovery.start();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("stop() after start() is a no-op when registry is empty", async () => {
        await discovery.start();
        await discovery.stop();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("stop() is idempotent", async () => {
        await discovery.start();
        await discovery.stop();
        await discovery.stop();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("get() returns undefined when xa is unknown", () => {
        expect(discovery.get("AABBCCDDEEFF0011")).to.equal(undefined);
    });

    it("get() normalizes lowercase xa to uppercase", () => {
        expect(discovery.get("aabbccddeeff0011")).to.equal(undefined);
    });

    describe("on mDNS discovery", () => {
        let stub: StubDnssdNames;
        let disc: BorderRouterDiscovery;

        beforeEach(() => {
            stub = new StubDnssdNames();
            disc = new BorderRouterDiscovery(new Environment("test"), stub);
        });

        afterEach(async () => {
            await disc.stop();
        });

        it("creates a meshcop entry with parsed fields and sorted addresses", async () => {
            await disc.start();
            stub.makeTarget("Kuche.local.", ["192.168.1.10", "fd00::1", "2001:db8::5", "fe80::abcd"]);
            const inst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: {
                    xa: "aabbccddeeff0011",
                    xp: "1122334455667788",
                    nn: "MyNetwork",
                    vn: "ACME",
                    mn: "BR-100",
                    tv: "1.3.0",
                    dd: "deadbeef",
                    sb: "00000010",
                    at: "0000000000000001",
                    pt: "12345678",
                    dn: "domain.example",
                },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(inst);

            const list = disc.list();
            expect(list.length).to.equal(1);
            const e = list[0];
            expect(e.extAddressHex).to.equal("AABBCCDDEEFF0011");
            expect(e.extendedPanIdHex).to.equal("1122334455667788");
            expect(e.networkName).to.equal("MyNetwork");
            expect(e.vendorName).to.equal("ACME");
            expect(e.modelName).to.equal("BR-100");
            expect(e.threadVersion).to.equal("1.3.0");
            expect(e.borderAgentIdHex).to.equal("DEADBEEF");
            expect(e.stateBitmapHex).to.equal("00000010");
            expect(e.activeTimestampHex).to.equal("0000000000000001");
            expect(e.partitionIdHex).to.equal("12345678");
            expect(e.domainName).to.equal("domain.example");
            expect(e.hostname).to.equal("Kuche.local.");
            expect(e.meshcopPort).to.equal(49154);
            expect(e.trelPort).to.equal(undefined);
            expect(e.sources).to.deep.equal(["meshcop"]);
            expect(e.addresses).to.deep.equal(["192.168.1.10", "2001:db8::5", "fd00::1", "fe80::abcd"]);
        });

        it("creates a trel-only entry without naming fields", async () => {
            await disc.start();
            stub.makeTarget("br.local.", ["10.0.0.5"]);
            const inst = stub.makeInstance("aabbccddeeff0011._trel._udp.local", {
                txt: { xa: "aabbccddeeff0011" },
                srvTarget: "br.local.",
                srvPort: 12345,
            });
            stub.discover(inst);

            const e = disc.get("AABBCCDDEEFF0011");
            expect(e).to.not.equal(undefined);
            expect(e!.trelPort).to.equal(12345);
            expect(e!.meshcopPort).to.equal(undefined);
            expect(e!.networkName).to.equal(undefined);
            expect(e!.sources).to.deep.equal(["trel"]);
            expect(e!.addresses).to.deep.equal(["10.0.0.5"]);
        });

        it("merges meshcop and trel for the same xa", async () => {
            await disc.start();
            stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            stub.makeTarget("br.local.", ["10.0.0.5"]);
            const meshcopInst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", xp: "1111111111111111", nn: "MyNet", vn: "ACME" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(meshcopInst);
            const trelInst = stub.makeInstance("aabbccddeeff0011._trel._udp.local", {
                txt: { xa: "aabbccddeeff0011", xp: "1111111111111111" },
                srvTarget: "br.local.",
                srvPort: 12345,
            });
            stub.discover(trelInst);

            const e = disc.get("AABBCCDDEEFF0011");
            expect(e).to.not.equal(undefined);
            expect(e!.networkName).to.equal("MyNet");
            expect(e!.vendorName).to.equal("ACME");
            expect(e!.meshcopPort).to.equal(49154);
            expect(e!.trelPort).to.equal(12345);
            expect(e!.hostname).to.equal("Kuche.local.");
            expect(e!.sources).to.deep.equal(["meshcop", "trel"]);
        });

        it("meshcop wins when xp conflicts with trel", async () => {
            await disc.start();
            stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            stub.makeTarget("br.local.", ["10.0.0.5"]);
            const meshcopInst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", xp: "AAAAAAAAAAAAAAAA", nn: "MyNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(meshcopInst);
            const trelInst = stub.makeInstance("aabbccddeeff0011._trel._udp.local", {
                txt: { xa: "aabbccddeeff0011", xp: "BBBBBBBBBBBBBBBB" },
                srvTarget: "br.local.",
                srvPort: 12345,
            });
            stub.discover(trelInst);

            const e = disc.get("AABBCCDDEEFF0011");
            expect(e!.extendedPanIdHex).to.equal("AAAAAAAAAAAAAAAA");
        });

        it("removes a source when an instance becomes undiscovered, deletes entry when last source", async () => {
            await disc.start();
            stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            stub.makeTarget("br.local.", ["10.0.0.5"]);
            const meshcopInst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(meshcopInst);
            const trelInst = stub.makeInstance("aabbccddeeff0011._trel._udp.local", {
                txt: { xa: "aabbccddeeff0011" },
                srvTarget: "br.local.",
                srvPort: 12345,
            });
            stub.discover(trelInst);

            expect(disc.get("AABBCCDDEEFF0011")!.sources).to.deep.equal(["meshcop", "trel"]);

            trelInst.setDiscovered(false);
            trelInst.emit({ name: trelInst });

            const after = disc.get("AABBCCDDEEFF0011");
            expect(after).to.not.equal(undefined);
            expect(after!.sources).to.deep.equal(["meshcop"]);
            expect(after!.trelPort).to.equal(undefined);
            expect(stub.targetByKey("br.local.")!.observerCount()).to.equal(0);

            meshcopInst.setDiscovered(false);
            meshcopInst.emit({ name: meshcopInst });
            expect(disc.get("AABBCCDDEEFF0011")).to.equal(undefined);
            expect(stub.targetByKey("kuche.local.")!.observerCount()).to.equal(0);
        });

        it("populates addresses retroactively when target's A/AAAA arrive later", async () => {
            await disc.start();
            const target = stub.makeTarget("Kuche.local.", []);
            const inst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(inst);
            expect(disc.get("AABBCCDDEEFF0011")!.addresses).to.deep.equal([]);

            target.setAddresses(["192.168.1.10", "fd00::1"]);
            target.emit({ name: target });

            const e = disc.get("AABBCCDDEEFF0011");
            expect(e!.addresses).to.deep.equal(["192.168.1.10", "fd00::1"]);
        });

        it("replaces addresses when the target changes its A records", async () => {
            await disc.start();
            const target = stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            const inst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(inst);
            expect(disc.get("AABBCCDDEEFF0011")!.addresses).to.deep.equal(["192.168.1.10"]);

            target.setAddresses(["192.168.2.20", "fe80::cafe"]);
            target.emit({ name: target });

            const e = disc.get("AABBCCDDEEFF0011");
            expect(e!.addresses).to.deep.equal(["192.168.2.20", "fe80::cafe"]);
        });

        it("skips records missing an xa TXT key", async () => {
            await disc.start();
            stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            const inst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { nn: "OrphanNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(inst);
            expect(disc.list()).to.deep.equal([]);
        });

        it("evicts oldest entry when registry exceeds 256", async () => {
            await disc.start();
            const oldestXa = makeXa(0);
            for (let i = 0; i < 256; i++) {
                const xa = makeXa(i);
                const host = `host${i}.local.`;
                stub.makeTarget(host, [`10.0.${(i >> 8) & 0xff}.${i & 0xff}`]);
                const inst = stub.makeInstance(`${xa.toLowerCase()}._meshcop._udp.local`, {
                    txt: { xa: xa.toLowerCase(), nn: `Net${i}` },
                    srvTarget: host,
                    srvPort: 49154 + i,
                });
                stub.discover(inst);
                disc.get(xa)!.lastSeen = 1000 + i;
            }

            const xa257 = makeXa(257);
            stub.makeTarget(`host257.local.`, [`10.1.0.0`]);
            const inst257 = stub.makeInstance(`${xa257.toLowerCase()}._meshcop._udp.local`, {
                txt: { xa: xa257.toLowerCase(), nn: "Net257" },
                srvTarget: `host257.local.`,
                srvPort: 50000,
            });
            stub.discover(inst257);

            expect(disc.list().length).to.equal(256);
            expect(disc.get(oldestXa)).to.equal(undefined);
            expect(disc.get(xa257)).to.not.equal(undefined);
        });

        it("issues a one-shot solicit for both service-type qnames on start", async () => {
            await disc.start();
            const qnames = stub.solicitedQnames();
            expect(qnames).to.include("_meshcop._udp.local");
            expect(qnames).to.include("_trel._udp.local");
        });

        it("re-discovers after eviction without leaking instance observers", async () => {
            await disc.start();
            for (let i = 0; i < 256; i++) {
                const xa = makeXa(i);
                const host = `host${i}.local.`;
                stub.makeTarget(host, [`10.0.${(i >> 8) & 0xff}.${i & 0xff}`]);
                const inst = stub.makeInstance(`${xa.toLowerCase()}._meshcop._udp.local`, {
                    txt: { xa: xa.toLowerCase(), nn: `Net${i}` },
                    srvTarget: host,
                    srvPort: 49154 + i,
                });
                stub.discover(inst);
                disc.get(xa)!.lastSeen = 1000 + i;
            }
            const evictedXa = makeXa(0);
            const evictedQname = `${evictedXa.toLowerCase()}._meshcop._udp.local`;
            const evictedInstance = stub.targetByKey(evictedQname)!;
            const evictedHost = stub.targetByKey("host0.local.")!;
            expect(disc.get(evictedXa)).to.not.equal(undefined);
            expect(evictedInstance.observerCount()).to.equal(1);
            expect(evictedHost.observerCount()).to.equal(1);

            const xa257 = makeXa(257);
            stub.makeTarget("host257.local.", ["10.1.0.0"]);
            const inst257 = stub.makeInstance(`${xa257.toLowerCase()}._meshcop._udp.local`, {
                txt: { xa: xa257.toLowerCase(), nn: "Net257" },
                srvTarget: "host257.local.",
                srvPort: 50000,
            });
            stub.discover(inst257);

            expect(disc.get(evictedXa)).to.equal(undefined);
            expect(evictedInstance.observerCount()).to.equal(0);
            expect(evictedHost.observerCount()).to.equal(0);

            const reHost = stub.makeTarget("host0-re.local.", ["10.9.9.9"]);
            const reInstance = stub.makeInstance(evictedQname, {
                txt: { xa: evictedXa.toLowerCase(), nn: "NetRe" },
                srvTarget: "host0-re.local.",
                srvPort: 60000,
            });
            stub.discover(reInstance);

            const e = disc.get(evictedXa);
            expect(e).to.not.equal(undefined);
            expect(e!.networkName).to.equal("NetRe");
            expect(e!.hostname).to.equal("host0-re.local.");
            expect(reInstance.observerCount()).to.equal(1);
            expect(reHost.observerCount()).to.equal(1);
            expect(disc.list().length).to.equal(256);
        });

        it("releases trel's old target observer when meshcop overwrites the hostname", async () => {
            await disc.start();
            const targetA = stub.makeTarget("brA.local.", ["10.0.0.1"]);
            const trelInst = stub.makeInstance("aabbccddeeff0011._trel._udp.local", {
                txt: { xa: "aabbccddeeff0011" },
                srvTarget: "brA.local.",
                srvPort: 12345,
            });
            stub.discover(trelInst);
            expect(targetA.observerCount()).to.equal(1);

            const targetB = stub.makeTarget("brB.local.", ["10.0.0.2"]);
            const meshcopInst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "brB.local.",
                srvPort: 49154,
            });
            stub.discover(meshcopInst);

            expect(targetA.observerCount()).to.equal(0);
            expect(targetB.observerCount()).to.equal(1);
            const e = disc.get("AABBCCDDEEFF0011")!;
            expect(e.hostname).to.equal("brB.local.");
            expect(e.addresses).to.deep.equal(["10.0.0.2"]);
        });

        it("keeps meshcop's target intact when trel arrives later with a different hostname", async () => {
            await disc.start();
            const targetA = stub.makeTarget("brA.local.", ["10.0.0.1"]);
            const meshcopInst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "brA.local.",
                srvPort: 49154,
            });
            stub.discover(meshcopInst);

            const targetC = stub.makeTarget("brC.local.", ["10.0.0.3"]);
            const trelInst = stub.makeInstance("aabbccddeeff0011._trel._udp.local", {
                txt: { xa: "aabbccddeeff0011" },
                srvTarget: "brC.local.",
                srvPort: 12345,
            });
            stub.discover(trelInst);

            expect(targetA.observerCount()).to.equal(1);
            expect(targetC.observerCount()).to.equal(1);
            const e = disc.get("AABBCCDDEEFF0011")!;
            expect(e.hostname).to.equal("brA.local.");
            expect(e.addresses).to.deep.equal(["10.0.0.1"]);
        });

        it("does not attach observers when a discovered event fires after stop", async () => {
            await disc.start();
            const observers = stub.discovered.snapshot();
            expect(observers.length).to.equal(1);
            const inflight = observers[0];

            await disc.stop();
            expect(stub.discoveredObserverCount()).to.equal(0);

            stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            const inst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            inflight(inst);

            expect(inst.observerCount()).to.equal(0);
            expect(disc.list()).to.deep.equal([]);
        });

        it("resets the eviction-warned flag across stop/start cycles", async () => {
            await disc.start();
            for (let i = 0; i < 257; i++) {
                const xa = makeXa(i);
                const host = `host${i}.local.`;
                stub.makeTarget(host, [`10.0.${(i >> 8) & 0xff}.${i & 0xff}`]);
                const inst = stub.makeInstance(`${xa.toLowerCase()}._meshcop._udp.local`, {
                    txt: { xa: xa.toLowerCase(), nn: `Net${i}` },
                    srvTarget: host,
                    srvPort: 49154 + i,
                });
                stub.discover(inst);
                if (i < 256) disc.get(xa)!.lastSeen = 1000 + i;
            }
            expect(disc.list().length).to.equal(256);

            await disc.stop();
            await disc.start();

            for (let i = 0; i < 257; i++) {
                const xa = makeXa(1000 + i);
                const host = `cycle2-host${i}.local.`;
                stub.makeTarget(host, [`11.0.${(i >> 8) & 0xff}.${i & 0xff}`]);
                const inst = stub.makeInstance(`${xa.toLowerCase()}._meshcop._udp.local`, {
                    txt: { xa: xa.toLowerCase(), nn: `Cycle2Net${i}` },
                    srvTarget: host,
                    srvPort: 51000 + i,
                });
                stub.discover(inst);
                if (i < 256) disc.get(xa)!.lastSeen = 5000 + i;
            }
            expect(disc.list().length).to.equal(256);
        });

        it("clears registry, removes filter, and detaches observers on stop", async () => {
            await disc.start();
            const target = stub.makeTarget("Kuche.local.", ["192.168.1.10"]);
            const inst = stub.makeInstance("Kuche._meshcop._udp.local", {
                txt: { xa: "aabbccddeeff0011", nn: "MyNet" },
                srvTarget: "Kuche.local.",
                srvPort: 49154,
            });
            stub.discover(inst);
            expect(disc.list().length).to.equal(1);
            expect(target.observerCount()).to.equal(1);
            expect(inst.observerCount()).to.equal(1);
            expect(stub.filterCount()).to.equal(1);
            expect(stub.discoveredObserverCount()).to.equal(1);

            await disc.stop();

            expect(disc.list()).to.deep.equal([]);
            expect(target.observerCount()).to.equal(0);
            expect(inst.observerCount()).to.equal(0);
            expect(stub.filterCount()).to.equal(0);
            expect(stub.discoveredObserverCount()).to.equal(0);
        });
    });
});

function makeXa(i: number): string {
    return i.toString(16).toUpperCase().padStart(16, "0");
}

class StubObservable<Args extends unknown[]> {
    readonly #observers = new Set<(...args: Args) => void>();

    on(observer: (...args: Args) => void): void {
        this.#observers.add(observer);
    }

    off(observer: (...args: Args) => void): void {
        this.#observers.delete(observer);
    }

    emit(...args: Args): void {
        for (const observer of [...this.#observers]) {
            observer(...args);
        }
    }

    count(): number {
        return this.#observers.size;
    }

    snapshot(): ((...args: Args) => void)[] {
        return [...this.#observers];
    }
}

class StubDnssdName {
    readonly parameters = new Map<string, string>();
    #records: DnsRecord[] = [];
    #observable = new StubObservable<[changes: { name: StubDnssdName }]>();
    #isDiscovered = true;

    constructor(readonly qname: string) {}

    get records(): IterableIterator<DnsRecord> {
        return this.#records[Symbol.iterator]();
    }

    setRecords(records: DnsRecord[]): void {
        this.#records = records;
    }

    get isDiscovered(): boolean {
        return this.#isDiscovered;
    }

    setDiscovered(value: boolean): void {
        this.#isDiscovered = value;
    }

    on(observer: (changes: { name: StubDnssdName }) => void): void {
        this.#observable.on(observer);
    }

    off(observer: (changes: { name: StubDnssdName }) => void): void {
        this.#observable.off(observer);
    }

    emit(changes: { name: StubDnssdName }): void {
        this.#observable.emit(changes);
    }

    observerCount(): number {
        return this.#observable.count();
    }

    setAddresses(addresses: string[]): void {
        const records: DnsRecord[] = addresses.map(addr => ({
            recordType: addr.includes(":") ? DnsRecordType.AAAA : DnsRecordType.A,
            recordClass: DnsRecordClass.IN,
            name: this.qname,
            ttl: Seconds(120),
            value: addr,
        }));
        this.#records = records;
    }
}

interface InstanceDescriptor {
    txt: Record<string, string>;
    srvTarget?: string;
    srvPort?: number;
}

class StubDnssdNames {
    readonly filters = new StubFilters();
    readonly discovered = new StubObservable<[StubDnssdName]>();
    readonly solicitor: StubSolicitor = new StubSolicitor();
    readonly #names = new Map<string, StubDnssdName>();

    get(qname: string): StubDnssdName {
        const key = qname.toLowerCase();
        let name = this.#names.get(key);
        if (name === undefined) {
            name = new StubDnssdName(qname);
            this.#names.set(key, name);
        }
        return name;
    }

    maybeGet(qname: string): StubDnssdName | undefined {
        return this.#names.get(qname.toLowerCase());
    }

    makeInstance(qname: string, descriptor: InstanceDescriptor): StubDnssdName {
        const name = this.get(qname);
        for (const [k, v] of Object.entries(descriptor.txt)) {
            name.parameters.set(k, BINARY_TXT_KEYS.has(k) ? hexToBytesString(v) : v);
        }
        const records: DnsRecord[] = [];
        if (descriptor.srvTarget !== undefined && descriptor.srvPort !== undefined) {
            records.push({
                recordType: DnsRecordType.SRV,
                recordClass: DnsRecordClass.IN,
                name: qname,
                ttl: Seconds(120),
                value: { priority: 0, weight: 0, port: descriptor.srvPort, target: descriptor.srvTarget },
            });
        }
        name.setRecords(records);
        return name;
    }

    makeTarget(qname: string, addresses: string[]): StubDnssdName {
        const name = this.get(qname);
        name.setAddresses(addresses);
        return name;
    }

    discover(name: StubDnssdName): void {
        this.discovered.emit(name);
    }

    targetByKey(key: string): StubDnssdName | undefined {
        return this.#names.get(key);
    }

    filterCount(): number {
        return this.filters.count();
    }

    discoveredObserverCount(): number {
        return this.discovered.count();
    }

    solicitedQnames(): string[] {
        return this.solicitor.solicited.map(s => s.name.qname);
    }
}

class StubFilters {
    readonly #filters = new Set<(record: DnsRecord) => boolean>();

    add(filter: (record: DnsRecord) => boolean): void {
        this.#filters.add(filter);
    }

    delete(filter: (record: DnsRecord) => boolean): boolean {
        return this.#filters.delete(filter);
    }

    count(): number {
        return this.#filters.size;
    }
}

class StubSolicitor {
    readonly solicited: { name: StubDnssdName; recordTypes: DnsRecordType[] }[] = [];

    solicit(solicitation: { name: StubDnssdName; recordTypes: DnsRecordType[] }): void {
        this.solicited.push(solicitation);
    }
}

const BINARY_TXT_KEYS = new Set(["xa", "xp", "at", "pt", "dd", "sb"]);

function hexToBytesString(hex: string): string {
    let out = "";
    for (let i = 0; i < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    return out;
}
