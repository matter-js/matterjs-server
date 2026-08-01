/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import { deleteAclEntry } from "../src/components/dialogs/acl/acl-actions.js";
import { addBinding, deleteBinding } from "../src/components/dialogs/binding/binding-actions.js";
import type { BindingEntryStruct } from "../src/components/dialogs/binding/model.js";
import { writeNodeLabel } from "../src/util/node-label.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

interface Writes {
    acl: number;
    binding: number;
    lastBindings: unknown;
}

function target(fields: Partial<BindingEntryStruct>): BindingEntryStruct {
    return { node: undefined, group: undefined, endpoint: undefined, cluster: undefined, fabricIndex: 1, ...fields };
}

function writeResult(endpointId: number, clusterId: number, status: number) {
    return [{ path: { endpoint_id: endpointId, cluster_id: clusterId, attribute_id: 0 }, status }];
}

/**
 * A read that answers only the paths in `res` — a per-path failure shows up as an omitted path.
 * Writes report `writeStatus`, which is how the device reports a rejection: in the result, not as a throw.
 */
function clientReading(res: Record<string, unknown>, writeStatus = 0): { client: MatterClient; writes: Writes } {
    const writes: Writes = { acl: 0, binding: 0, lastBindings: undefined };
    const client = {
        nodes: {},
        readAttribute: async () => res,
        setACLEntry: async () => {
            writes.acl++;
            return writeResult(0, 31, writeStatus);
        },
        setNodeBinding: async (_nodeId: unknown, endpoint: number, bindings: unknown) => {
            writes.binding++;
            writes.lastBindings = bindings;
            return writeResult(endpoint, 30, writeStatus);
        },
    } as unknown as MatterClient;
    return { client, writes };
}

describe("fabric-scoped write paths", () => {
    it("deleteAclEntry refuses to write when the ACL read returned no list", async () => {
        const { client, writes } = clientReading({ "0/62/5": 1 });
        await expect(deleteAclEntry(client, 1, "whatever")).to.be.rejectedWith(/0\/31\/0/);
        expect(writes.acl).to.equal(0);
    });

    it("deleteAclEntry writes the remaining entries when the read succeeded", async () => {
        const { client, writes } = clientReading({
            "0/62/5": 1,
            "0/31/0": [{ "1": 5, "2": 2, "3": [9], "254": 1 }],
        });
        await deleteAclEntry(client, 1, "whatever");
        expect(writes.acl).to.equal(1);
    });

    it("deleteAclEntry reports a device-rejected write instead of succeeding silently", async () => {
        const { client } = clientReading(
            { "0/62/5": 1, "0/31/0": [{ "1": 5, "2": 2, "3": [9], "254": 1 }] },
            135, // ConstraintError
        );
        await expect(deleteAclEntry(client, 1, "whatever")).to.be.rejectedWith(/ConstraintError/);
    });

    it("addBinding reports a device-rejected binding write", async () => {
        const { client, writes } = clientReading(
            {
                "0/62/5": 1,
                "0/31/0": [{ "1": 3, "2": 2, "3": [1], "4": [{ "0": 6, "1": 1 }], "254": 1 }],
                "1/30/0": [],
            },
            137, // ResourceExhausted
        );
        await expect(addBinding(client, node({}, 1), 1, 2, 1, 6)).to.be.rejectedWith(
            /Writing the binding table failed.*ResourceExhausted/,
        );
        // The fixture ACL already grants the binding, so the run must fail on the binding write itself.
        expect(writes.acl).to.equal(0);
        expect(writes.binding).to.equal(1);
    });

    it("writeNodeLabel reports a device-rejected attribute write", async () => {
        const writes: string[] = [];
        const client = {
            writeAttribute: async (_nodeId: unknown, path: string) => {
                writes.push(path);
                return [{ Path: { EndpointId: 0, ClusterId: 40, AttributeId: 5 }, Status: 135 }];
            },
        } as unknown as MatterClient;
        await expect(writeNodeLabel(client, node({}, 1), "Kitchen")).to.be.rejectedWith(/ConstraintError/);
        expect(writes).to.deep.equal(["0/40/5"]);
    });

    // Guards the result-shape wiring: reading `status` off a `Status`-keyed result yields undefined,
    // which would make every accepted write throw.
    it("writeNodeLabel resolves when the device accepted the write", async () => {
        const client = {
            writeAttribute: async () => [{ Path: { EndpointId: 0, ClusterId: 40, AttributeId: 5 }, Status: 0 }],
        } as unknown as MatterClient;
        await writeNodeLabel(client, node({}, 1), "Kitchen");
    });

    it("deleteBinding refuses to write when the binding read returned no list", async () => {
        const { client, writes } = clientReading({ "0/62/5": 1 });
        await expect(deleteBinding(client, node({}), 1, target({}))).to.be.rejectedWith(/1\/30\/0/);
        expect(writes.binding).to.equal(0);
    });

    it("deleteBinding removes the entry naming the target, whatever its position", async () => {
        const { client, writes } = clientReading({
            "0/62/5": 1,
            "0/31/0": [],
            "1/30/0": [
                { "1": 7, "3": 1, "4": 6, "254": 1 },
                { "1": 2, "3": 1, "4": 8, "254": 1 },
            ],
        });
        await deleteBinding(client, node({}, 1), 1, target({ node: 2, endpoint: 1, cluster: 8 }));
        expect(writes.binding).to.equal(1);
        expect(writes.lastBindings).to.deep.equal([{ node: 7, group: null, endpoint: 1, cluster: 6 }]);
    });

    it("deleteBinding writes nothing when no entry matches", async () => {
        const { client, writes } = clientReading({
            "0/62/5": 1,
            "1/30/0": [{ "1": 7, "3": 1, "4": 6, "254": 1 }],
        });
        await deleteBinding(client, node({}, 1), 1, target({ node: 2, endpoint: 1, cluster: 8 }));
        expect(writes.binding).to.equal(0);
    });

    it("addBinding refuses to write when the binding read returned no list", async () => {
        // The target's ACL already grants Operate on 1/6, so ensureBindingAcl passes and the run
        // reaches the binding read, which answers only 0/62/5.
        const { client, writes } = clientReading({
            "0/62/5": 1,
            "0/31/0": [{ "1": 3, "2": 2, "3": [1], "4": [{ "0": 6, "1": 1 }], "254": 1 }],
        });
        await expect(addBinding(client, node({}, 1), 1, 2, 1, 6)).to.be.rejectedWith(/1\/30\/0/);
        expect(writes.acl).to.equal(0);
        expect(writes.binding).to.equal(0);
    });
});
