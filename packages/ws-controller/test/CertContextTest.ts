/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeId, Bytes, ClusterId, Environment, Filesystem, GroupId, MockFilesystem, NodeId } from "@matter/main";
import { GroupKeyManagement } from "@matter/main/clusters/group-key-management";
import { OnOff } from "@matter/main/clusters/on-off";
import { Fabric, FabricAuthority, FabricManager, NoUsableGroupKeyError } from "@matter/main/protocol";
import { MATTER_EPOCH_OFFSET_US } from "@matter/main/types";
import { GroupKeyManagementServer } from "@matter/node/behaviors/group-key-management";
import {
    CERT_CONTEXT_FILE,
    CertContextError,
    loadCertContext,
    parseCertContext,
} from "../src/controller/certContext.js";
import { HandlerSite } from "./support/HandlerSite.js";

function keySet(groupKeySetId: number, key: string, start: number, extra: Record<string, unknown> = {}) {
    return {
        _comment: `key set ${groupKeySetId}`,
        groupKeySetId,
        epochKey0: `${key}0a1a2a3a4a5a6a7a8a9aaabacadaeaf`,
        epochStartTime0: start,
        epochKey1: `${key}1b1b2b3b4b5b6b7b8b9babbbcbdbebf`,
        epochStartTime1: start + 1,
        epochKey2: `${key}2c1c2c3c4c5c6c7c8c9cacbcccdcecf`,
        epochStartTime2: start + 2,
        groupKeySecurityPolicy: "CacheAndSync",
        ...extra,
    };
}

/** Same shape and values as the per-test files used in certification runs. */
function certFile(groupOneAddressPolicy?: string) {
    return {
        _comment: "per-test controller group configuration",
        keySets: [
            keySet(417, "a", 1110000),
            keySet(418, "d", 2220000),
            keySet(419, "e", 2220000),
            {
                _comment: "only epochKey0 is set",
                groupKeySetId: 420,
                epochKey0: "d0d1d2d3d4d5d6d7d8d9dadbdcdddedf",
                epochStartTime0: 0,
                epochKey1: null,
                epochStartTime1: null,
                epochKey2: null,
                epochStartTime2: null,
                groupKeySecurityPolicy: "TrustFirst",
            },
        ],
        groupKeyMap: [
            { _comment: "group 1", groupId: 257, groupKeySetId: 417 },
            { _comment: "group 2", groupId: 258, groupKeySetId: 418 },
            { _comment: "group 3", groupId: 259, groupKeySetId: 419 },
            {
                _comment: "group 1",
                groupId: 1,
                groupKeySetId: 420,
                ...(groupOneAddressPolicy !== undefined ? { addressPolicy: groupOneAddressPolicy } : {}),
            },
        ],
    };
}

const UNIX_EPOCH_FILE = {
    keySets: [
        {
            groupKeySetId: 1,
            epochKey0: "d0d1d2d3d4d5d6d7d8d9dadbdcdddedf",
            epochStartTime0: 1600000000000000,
            groupKeySecurityPolicy: "TrustFirst",
        },
    ],
    groupKeyMap: [{ groupId: 1, groupKeySetId: 1 }],
};

function parse(value: unknown) {
    return parseCertContext(JSON.stringify(value), "test.json");
}

function parseError(value: unknown) {
    try {
        parse(value);
    } catch (error) {
        expect(error).to.be.instanceOf(CertContextError);
        return error instanceof Error ? error.message : "";
    }
    return expect.fail("parse succeeded");
}

describe("certContext", () => {
    describe("parseCertContext", () => {
        it("parses the per-test file with an IANA group", () => {
            const context = parse(certFile("IanaAddr"));

            expect(context.keySets.map(({ groupKeySetId }) => groupKeySetId)).to.deep.equal([417, 418, 419, 420]);
            const [first, , , last] = context.keySets;
            expect(Bytes.toHex(first.epochKey0)).to.equal("a0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
            expect(first.epochStartTime0).to.equal(MATTER_EPOCH_OFFSET_US + 1110000n);
            expect(first.epochStartTime2).to.equal(MATTER_EPOCH_OFFSET_US + 1110002n);
            expect(first.groupKeySecurityPolicy).to.equal(GroupKeyManagement.GroupKeySecurityPolicy.CacheAndSync);
            expect(last.epochStartTime0).to.equal(MATTER_EPOCH_OFFSET_US);
            expect(last.epochKey1).to.equal(null);
            expect(last.epochStartTime2).to.equal(null);
            expect(last.groupKeySecurityPolicy).to.equal(GroupKeyManagement.GroupKeySecurityPolicy.TrustFirst);

            expect(context.groupKeyMap).to.deep.equal([
                { groupId: 257, groupKeySetId: 417 },
                { groupId: 258, groupKeySetId: 418 },
                { groupId: 259, groupKeySetId: 419 },
                { groupId: 1, groupKeySetId: 420, addressPolicy: "ianaAddr" },
            ]);
        });

        it("keeps start times from 2000-01-01 on as Unix epoch microseconds", () => {
            expect(parse(UNIX_EPOCH_FILE).keySets[0].epochStartTime0).to.equal(1600000000000000n);
        });

        it("parses the per-test file without an address policy", () => {
            const context = parse(certFile());
            expect(context.groupKeyMap[3]).to.deep.equal({ groupId: 1, groupKeySetId: 420 });
        });

        it("refuses invalid JSON", () => {
            expect(() => parseCertContext("{", "test.json")).to.throw(
                CertContextError,
                "Invalid group key configuration test.json: file is not valid JSON",
            );
        });

        it("parses absent optional epochs and a label", () => {
            const context = parse({
                keySets: [
                    {
                        groupKeySetId: 5,
                        label: "x",
                        epochKey0: "00112233445566778899aabbccddeeff",
                        epochStartTime0: 1,
                        groupKeySecurityPolicy: "TrustFirst",
                    },
                ],
                groupKeyMap: [{ groupId: 5, groupKeySetId: 5, addressPolicy: "PerGroupId", label: "y" }],
            });
            expect(context.keySets[0].epochKey1).to.equal(null);
            expect(context.groupKeyMap[0].addressPolicy).to.equal("perGroupId");
        });

        const malformed: Array<[string, (file: ReturnType<typeof certFile>) => unknown, string]> = [
            ["a non-object file", () => [], "file must be an object"],
            ["an unknown top-level field", file => ({ ...file, keysets: [] }), "file.keysets is not a known field"],
            ["a missing keySets list", ({ groupKeyMap }) => ({ groupKeyMap }), "keySets must be an array"],
            [
                "a multicast policy on a key set",
                file => ({ ...file, keySets: [{ ...file.keySets[0], groupKeyMulticastPolicy: "IanaAddr" }] }),
                "keySets[0].groupKeyMulticastPolicy is not a known field",
            ],
            [
                "a missing epochKey0",
                file => {
                    const { epochKey0: _key, ...rest } = file.keySets[0];
                    return { ...file, keySets: [rest] };
                },
                "keySets[0].epochKey0 must be a 32 digit hex string",
            ],
            [
                "an epoch key of the wrong length",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochKey1: "a0a1a2" }] }),
                "keySets[0].epochKey1 must be a 32 digit hex string",
            ],
            [
                "an epoch key that is not hex",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochKey0: "zz".repeat(16) }] }),
                "keySets[0].epochKey0 must be a 32 digit hex string",
            ],
            [
                "key set 0",
                file => ({ ...file, keySets: [{ ...file.keySets[0], groupKeySetId: 0 }] }),
                "keySets[0].groupKeySetId must not be 0",
            ],
            [
                "an unknown security policy",
                file => ({ ...file, keySets: [{ ...file.keySets[0], groupKeySecurityPolicy: "TrustLast" }] }),
                "keySets[0].groupKeySecurityPolicy must be one of TrustFirst, CacheAndSync",
            ],
            [
                "an unknown address policy",
                file => ({ ...file, groupKeyMap: [{ groupId: 1, groupKeySetId: 420, addressPolicy: "Iana" }] }),
                "groupKeyMap[0].addressPolicy must be one of IanaAddr, PerGroupId",
            ],
            [
                "a group bound to an unknown key set",
                file => ({ ...file, groupKeyMap: [{ groupId: 1, groupKeySetId: 421 }] }),
                "groupKeyMap[0].groupKeySetId references key set 421",
            ],
            [
                "an epoch key without its start time",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochStartTime1: null }] }),
                "keySets[0].epochKey1 and epochStartTime1 must be set together",
            ],
            [
                "a third epoch key without a second",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochKey1: null, epochStartTime1: null }] }),
                "keySets[0].epochKey2 needs epochKey1",
            ],
            [
                "start times out of order",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochStartTime1: 1110000 }] }),
                "keySets[0].epochStartTime1 must be greater than epochStartTime0",
            ],
            [
                "a negative start time",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochStartTime0: -1 }] }),
                "keySets[0].epochStartTime0 must be an integer",
            ],
            [
                "a group bound to key set 0",
                file => ({ ...file, groupKeyMap: [{ groupId: 1, groupKeySetId: 0 }] }),
                "groupKeyMap[0].groupKeySetId must not be 0",
            ],
            [
                "third start time out of order",
                file => ({ ...file, keySets: [{ ...file.keySets[0], epochStartTime2: 1110001 }] }),
                "keySets[0].epochStartTime2 must be greater than epochStartTime1",
            ],
            [
                "a duplicate key set",
                file => ({ ...file, keySets: [file.keySets[0], file.keySets[0]] }),
                "keySets[1].groupKeySetId duplicates key set 417",
            ],
            [
                "a duplicate group",
                file => ({ ...file, groupKeyMap: [file.groupKeyMap[0], file.groupKeyMap[0]] }),
                "groupKeyMap[1].groupId duplicates group 257",
            ],
            [
                "a group id outside the application range",
                file => ({ ...file, groupKeyMap: [{ groupId: 0xff00, groupKeySetId: 417 }] }),
                "groupKeyMap[0].groupId must be an application group id",
            ],
        ];
        for (const [name, mutate, message] of malformed) {
            it(`refuses ${name}`, () => {
                const error = parseError(mutate(certFile("IanaAddr")));
                expect(error).to.contain("test.json");
                expect(error).to.contain(message);
            });
        }
    });

    describe("loadCertContext", () => {
        let fs: MockFilesystem;
        let env: Environment;

        beforeEach(() => {
            fs = new MockFilesystem();
            env = new Environment("cert-context-test");
            env.set(Filesystem, fs);
        });

        async function loadError(disableAutoSubscription: boolean) {
            return loadCertContext(env, disableAutoSubscription).then(
                () => undefined,
                (e: unknown) => e,
            );
        }

        it("returns nothing without a filesystem", async () => {
            expect(await loadCertContext(new Environment("no-fs"), true)).to.equal(undefined);
        });

        it("returns nothing without a file", async () => {
            expect(await loadCertContext(env, true)).to.equal(undefined);
        });

        it("ignores the file while the server subscribes on its own", async () => {
            await fs.file(CERT_CONTEXT_FILE).write(JSON.stringify(certFile("IanaAddr")));
            expect(await loadCertContext(env, false)).to.equal(undefined);
        });

        it("loads the file with auto subscription disabled", async () => {
            await fs.file(CERT_CONTEXT_FILE).write(JSON.stringify(certFile("IanaAddr")));
            const context = await loadCertContext(env, true);
            expect(context?.keySets.length).to.equal(4);
            expect(context?.groupKeyMap.length).to.equal(4);
        });

        it("fails when the file cannot be read, naming it", async () => {
            await fs.directory(CERT_CONTEXT_FILE).mkdir();
            const error = await loadError(true);
            expect(error).to.be.instanceOf(CertContextError);
            expect(error instanceof Error ? error.message : "").to.contain(
                `Cannot read group key configuration ${CERT_CONTEXT_FILE}`,
            );
        });

        it("does not read the file while the server subscribes on its own", async () => {
            await fs.directory(CERT_CONTEXT_FILE).mkdir();
            expect(await loadCertContext(env, false)).to.equal(undefined);
        });

        it("fails on a malformed file, naming it", async () => {
            await fs
                .file(CERT_CONTEXT_FILE)
                .write(JSON.stringify({ keySets: [{ groupKeySetId: 1 }], groupKeyMap: [] }));
            const error = await loadError(true);
            expect(error).to.be.instanceOf(CertContextError);
            expect(error instanceof Error ? error.message : "").to.contain(
                `Invalid group key configuration ${CERT_CONTEXT_FILE}`,
            );
        });
    });

    describe("installed into a running controller", () => {
        let site: HandlerSite;
        const file = JSON.stringify(certFile("IanaAddr"));

        beforeEach(() => {
            site = new HandlerSite();
        });

        afterEach(async () => {
            await site.close();
        });

        function groupWrite(groupId: number) {
            return MockTime.resolve(
                site.handler.handleGroupWriteAttribute({
                    nodeId: NodeId.fromGroupId(GroupId(groupId)),
                    clusterId: ClusterId(OnOff.Cluster.id),
                    attributeId: AttributeId(OnOff.Cluster.attributes.onTime.id),
                    value: 5,
                }),
                { macrotasks: true },
            );
        }

        async function groupWriteError(groupId: number) {
            return groupWrite(groupId).then(
                () => undefined,
                (e: unknown) => e,
            );
        }

        /** The fabric object the send path resolves, which a NOC rotation replaces. */
        function currentFabric() {
            const { node, fabric } = site.controller;
            return node.env.get(FabricManager).for(fabric.fabricIndex);
        }

        function expectNothingPersisted() {
            const state = site.controller.node.stateOf(GroupKeyManagementServer);
            expect(state.groupKeySets.length, "persisted key sets").to.equal(0);
            expect(state.groupKeyMap.length, "persisted group map").to.equal(0);
        }

        function expectInstalled(fabric: Fabric) {
            const { groups } = fabric;
            for (const id of [417, 418, 419, 420]) {
                expect(groups.keySets.forId(id), `key set ${id}`).to.not.equal(undefined);
            }
            expect([...groups.groupKeyIdMap.entries()]).to.have.deep.members([
                [257, 417],
                [258, 418],
                [259, 419],
                [1, 420],
            ]);
            expect(groups.multicastAddressFor(GroupId(1))).to.equal("ff05::fa");
            expect(groups.multicastAddressFor(GroupId(259))).to.match(/^ff35:/);
        }

        it("installs the file into the fabric the send path uses and persists nothing", async () => {
            await site.startController(true, { certContextFile: file });

            expect(currentFabric()).to.equal(site.controller.fabric);
            expectInstalled(currentFabric());
            expectNothingPersisted();
            await groupWrite(259);
            await groupWrite(1);
        });

        it("cannot groupcast to a group the file does not define", async () => {
            await site.startController(true, { certContextFile: file });
            expect(await groupWriteError(260)).to.be.instanceOf(NoUsableGroupKeyError);
        });

        it("installs nothing while the server subscribes on its own", async () => {
            await site.startController(false, { certContextFile: file });
            expect(currentFabric().groups.keySets.forId(417)).to.equal(undefined);
            expect(await groupWriteError(259)).to.be.instanceOf(NoUsableGroupKeyError);
            expectNothingPersisted();
        });

        it("is not bound by the device limits of the GroupKeyManagement cluster", async () => {
            const keySets = Array.from({ length: 25 }, (_, index) => ({
                groupKeySetId: index + 1,
                epochKey0: (index + 0x10).toString(16).repeat(16),
                epochStartTime0: 1,
                groupKeySecurityPolicy: "TrustFirst",
            }));
            const groupKeyMap = Array.from({ length: 30 }, (_, index) => ({
                groupId: index + 1,
                groupKeySetId: (index % 25) + 1,
            }));
            await site.startController(true, { certContextFile: JSON.stringify({ keySets, groupKeyMap }) });

            expect(currentFabric().groups.keySets.forId(25)).to.not.equal(undefined);
            expect(currentFabric().groups.groupKeyIdMap.size).to.equal(30);
            await groupWrite(30);
            await groupWrite(25);
        });

        // Characterization: a fabric update that keeps the fabric object.
        it("keeps everything when the fabric is updated", async () => {
            await site.startController(true, { certContextFile: file });
            await MockTime.resolve(site.controller.fabric.persist(), { macrotasks: true });
            expectInstalled(currentFabric());
        });

        it("keeps everything when a NOC rotation replaces the fabric", async () => {
            await site.startController(true, { certContextFile: file });
            const { node, fabric } = site.controller;
            await MockTime.resolve(
                node.env
                    .get(FabricAuthority)
                    .defaultFabric({ adminFabricLabel: "TestFabric", adminNodeId: NodeId(112233) }),
                { macrotasks: true },
            );

            const current = currentFabric();
            expect(current).to.not.equal(fabric);
            expectInstalled(current);
            expectNothingPersisted();
            await groupWrite(1);
            await groupWrite(259);
        });

        it("starts from the next file only and groupcasts with a Unix epoch start time", async () => {
            await site.startController(true, { certContextFile: file });
            await site.stopController();
            await site.startController(true, { certContextFile: JSON.stringify(UNIX_EPOCH_FILE) });

            const { groups } = currentFabric();
            expect(groups.keySets.forId(417)).to.equal(undefined);
            expect([...groups.groupKeyIdMap.entries()]).to.deep.equal([[1, 1]]);
            expect(groups.multicastAddressFor(GroupId(1))).to.match(/^ff35:/);
            expectNothingPersisted();

            await groupWrite(1);
            expect(await groupWriteError(259)).to.be.instanceOf(NoUsableGroupKeyError);
        });

        it("keeps nothing after a start without the file", async () => {
            await site.startController(true, { certContextFile: file });
            await site.stopController();
            await site.startController(true);

            expect(currentFabric().groups.keySets.forId(417)).to.equal(undefined);
            expect(await groupWriteError(259)).to.be.instanceOf(NoUsableGroupKeyError);
        });
    });
});
