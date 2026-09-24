/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { redactSensitiveCommandFields } from "../src/logging-redaction.js";

/** The redacted message's `args.payload`, which is what every masking case asserts against. */
function redactedPayload(message: unknown): Record<string, unknown> {
    const { args } = redactSensitiveCommandFields(message) as { args: { payload: Record<string, unknown> } };
    return args.payload;
}

describe("redactSensitiveCommandFields", () => {
    it("redacts credentialData in a device_command SetCredential payload", () => {
        const message = {
            message_id: "1",
            command: "device_command",
            args: { payload: { credentialData: "MTIzNA==", credential: { credentialType: 1, credentialIndex: 3 } } },
        };
        const payload = redactedPayload(message);
        expect(payload.credentialData).to.equal("[redacted]");
        expect(payload.credential).to.deep.equal({ credentialType: 1, credentialIndex: 3 });
    });

    it("redacts pinCode in a LockDoor/UnlockDoor payload", () => {
        const message = { message_id: "1", command: "device_command", args: { payload: { pinCode: "MTIzNA==" } } };
        expect(redactedPayload(message).pinCode).to.equal("[redacted]");
    });

    it("leaves the original message untouched", () => {
        const message = { message_id: "1", command: "device_command", args: { payload: { pinCode: "MTIzNA==" } } };
        redactSensitiveCommandFields(message);
        expect(message.args.payload.pinCode).to.equal("MTIzNA==");
    });

    it("redacts the PINCode spelling the Python Matter Server clients send", () => {
        const message = { message_id: "1", command: "device_command", args: { payload: { PINCode: "MTIzNA==" } } };
        expect(redactedPayload(message).PINCode).to.equal("[redacted]");
    });

    it("redacts CredentialData regardless of its casing", () => {
        const message = {
            message_id: "1",
            command: "device_command",
            args: { payload: { CredentialData: "MTIzNA==", userIndex: 3 } },
        };
        const payload = redactedPayload(message);
        expect(payload.CredentialData).to.equal("[redacted]");
        expect(payload.userIndex).to.equal(3);
    });

    it("redacts the TURN username and credential of a camera_start_stream ICE server", () => {
        const message = {
            message_id: "1",
            command: "camera_start_stream",
            args: {
                node_id: 5,
                ice_servers: [
                    { urls: "stun:stun.example.org:3478" },
                    { urls: "turn:turn.example.org:3478", username: "1758700000:user", credential: "turn-secret" },
                ],
            },
        };
        const { args } = redactSensitiveCommandFields(message) as {
            args: { node_id: number; ice_servers: Array<Record<string, unknown>> };
        };
        expect(args.ice_servers[1]).to.deep.equal({
            urls: "turn:turn.example.org:3478",
            username: "[redacted]",
            credential: "[redacted]",
        });
        // Everything that is not a secret still reaches the log, or the log cannot be debugged with.
        expect(args.ice_servers[0]).to.deep.equal({ urls: "stun:stun.example.org:3478" });
        expect(args.node_id).to.equal(5);
    });

    it("redacts an ICE server that uses the older singular url spelling", () => {
        const message = {
            message_id: "1",
            command: "camera_start_stream",
            args: { ice_servers: [{ url: "turn:turn.example.org:3478", username: "u", credential: "turn-secret" }] },
        };
        const { args } = redactSensitiveCommandFields(message) as { args: { ice_servers: Array<object> } };
        expect(args.ice_servers[0]).to.deep.equal({
            url: "turn:turn.example.org:3478",
            username: "[redacted]",
            credential: "[redacted]",
        });
    });

    it("masks structure nested deeper than the walk goes", () => {
        let nested: Record<string, unknown> = { urls: "turn:turn.example.org:3478", credential: "turn-secret" };
        for (let level = 0; level < 10; level++) nested = { nested };
        const { args } = redactSensitiveCommandFields({
            message_id: "1",
            command: "camera_start_stream",
            args: nested,
        }) as { args: Record<string, unknown> };
        expect(JSON.stringify(args)).to.not.contain("turn-secret");
    });

    it("keeps a __proto__ member in the logged copy and off its prototype", () => {
        const message = JSON.parse(
            '{"command":"device_command","args":{"payload":{"pinCode":"AA","__proto__":{"a":1}}}}',
        );
        const { args } = redactSensitiveCommandFields(message) as { args: { payload: Record<string, unknown> } };
        expect(Object.keys(args.payload)).to.deep.equal(["pinCode", "__proto__"]);
        expect(Object.getPrototypeOf(args.payload)).to.equal(Object.prototype);
    });

    it("leaves the original ICE server entry untouched", () => {
        const entry = { urls: "turn:turn.example.org:3478", credential: "turn-secret" };
        redactSensitiveCommandFields({
            message_id: "1",
            command: "camera_start_stream",
            args: { ice_servers: [entry] },
        });
        expect(entry.credential).to.equal("turn-secret");
    });

    it("returns the same message when there is nothing sensitive to redact", () => {
        const message = { message_id: "1", command: "get_nodes", args: undefined };
        expect(redactSensitiveCommandFields(message)).to.equal(message);

        const withPayload = { message_id: "1", command: "device_command", args: { payload: { userIndex: 3 } } };
        expect(redactSensitiveCommandFields(withPayload)).to.equal(withPayload);
    });

    it("passes through a message whose shape is not a command payload", () => {
        for (const message of [null, undefined, "not an object", 42, { args: null }, { args: { payload: null } }]) {
            expect(redactSensitiveCommandFields(message)).to.equal(message);
        }
    });
});
