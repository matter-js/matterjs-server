/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import { savePreset } from "../src/util/avsum.js";

function recordingClient() {
    const payloads = new Array<unknown>();
    const client = {
        deviceCommand: async (...args: unknown[]) => {
            payloads.push(args[4]);
        },
    } as unknown as MatterClient;
    return { client, payloads };
}

describe("savePreset", () => {
    it("sends a name of exactly 32 bytes", async () => {
        const { client, payloads } = recordingClient();
        await savePreset(client, 1, 1, "Einfahrt Süd Garage Wäschelein");
        expect(payloads).to.deep.equal([{ name: "Einfahrt Süd Garage Wäschelein" }]);
    });

    it("refuses a name of 31 characters but 33 bytes without sending the command", async () => {
        const { client, payloads } = recordingClient();
        await expect(savePreset(client, 1, 1, "Einfahrt Süd Garage Wäscheleine")).to.be.rejectedWith(
            /33 bytes long, the maximum is 32/,
        );
        expect(payloads).to.deep.equal([]);
    });
});
