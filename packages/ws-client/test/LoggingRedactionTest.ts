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

/** Distinctive enough that finding it in a logged line cannot be a coincidence. */
const SECRET = "s3cret-do-not-log";

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

    /**
     * One entry per masked field name, each written out rather than read from the source list, so
     * removing a name from that list turns exactly one of these red.
     */
    const SECRET_ARGUMENTS: Array<{ what: string; command: string; args: Record<string, unknown> }> = [
        { what: "commission_with_code's setup code", command: "commission_with_code", args: { code: SECRET } },
        {
            what: "commission_on_network's passcode",
            command: "commission_on_network",
            args: { setup_pin_code: SECRET },
        },
        {
            what: "an OpenCommissioningWindow verifier",
            command: "device_command",
            args: { payload: { pakePasscodeVerifier: SECRET } },
        },
        {
            what: "set_wifi_credentials' passphrase",
            command: "set_wifi_credentials",
            args: { ssid: "home-net", credentials: SECRET },
        },
        {
            what: "an AddOrUpdateWiFiNetwork passphrase",
            command: "device_command",
            args: { payload: { credentials: SECRET } },
        },
        { what: "set_thread_dataset's dataset", command: "set_thread_dataset", args: { dataset: SECRET } },
        {
            what: "an AddOrUpdateThreadNetwork dataset",
            command: "device_command",
            args: { payload: { operationalDataset: SECRET } },
        },
        {
            what: "a SetActiveDatasetRequest dataset",
            command: "device_command",
            args: { payload: { activeDataset: SECRET } },
        },
        {
            what: "a SetPendingDatasetRequest dataset",
            command: "device_command",
            args: { payload: { pendingDataset: SECRET } },
        },
        { what: "an ICD RegisterClient key", command: "device_command", args: { payload: { key: SECRET } } },
        {
            what: "an ICD RegisterClient verification key",
            command: "device_command",
            args: { payload: { verificationKey: SECRET } },
        },
        {
            what: "an Aliro signing key",
            command: "device_command",
            args: { payload: { signingKey: SECRET } },
        },
        {
            what: "an Aliro group resolving key",
            command: "device_command",
            args: { payload: { groupResolvingKey: SECRET } },
        },
        {
            what: "a TestEventTrigger enable key",
            command: "device_command",
            args: { payload: { enableKey: SECRET } },
        },
        {
            what: "a KeySetWrite epoch key",
            command: "device_command",
            args: { payload: { groupKeySet: { groupKeySetId: 1, epochKey0: SECRET } } },
        },
        {
            what: "a second KeySetWrite epoch key",
            command: "device_command",
            args: { payload: { groupKeySet: { epochKey1: SECRET } } },
        },
        {
            what: "a third KeySetWrite epoch key",
            command: "device_command",
            args: { payload: { groupKeySet: { epochKey2: SECRET } } },
        },
        { what: "a Content Control old PIN", command: "device_command", args: { payload: { oldPin: SECRET } } },
        { what: "a Content Control new PIN", command: "device_command", args: { payload: { newPin: SECRET } } },
        { what: "an Account Login setup PIN", command: "device_command", args: { payload: { setupPin: SECRET } } },
        {
            what: "an AddNOC identity protection key",
            command: "device_command",
            args: { payload: { ipkValue: SECRET } },
        },
    ];

    for (const { what, command, args } of SECRET_ARGUMENTS) {
        it(`masks ${what}`, () => {
            const message = { message_id: "1", command, args: { ...args, node_id: 5 } };
            const text = JSON.stringify(redactSensitiveCommandFields(message));
            expect(text).to.not.contain(SECRET);
            // A redactor that masked or dropped everything would satisfy the line above, and would
            // leave nobody able to debug the request.
            expect(text).to.contain('"node_id":5');
            expect(text).to.contain(`"command":"${command}"`);
        });
    }

    it("masks the same field under the snake_case spelling the wire uses", () => {
        const message = {
            message_id: "1",
            command: "device_command",
            args: { payload: { operational_dataset: SECRET, pin_code: SECRET } },
        };
        expect(JSON.stringify(redactSensitiveCommandFields(message))).to.not.contain(SECRET);
    });

    /**
     * Names that look like the masked ones and carry nothing secret. Over-masking is the failure the
     * Door Lock `credential` struct already demonstrated: a request the log cannot show is a request
     * nobody can debug.
     */
    it("leaves a lookalike that carries no secret in the log", () => {
        const message = {
            message_id: "1",
            command: "device_command",
            args: {
                node_id: 5,
                payload: {
                    keyCode: 13,
                    countryCode: "DE",
                    updateToken: "0xdeadbeef",
                    credentialType: 1,
                    credentialIndex: 3,
                },
            },
        };
        expect(redactSensitiveCommandFields(message)).to.equal(message);
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
