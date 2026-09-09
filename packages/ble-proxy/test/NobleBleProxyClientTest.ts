/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { BleProxyCommand } from "../src/BleProxyProtocol.js";
import { NobleBleProxyClient } from "../src/example/NobleBleProxyClient.js";

describe("NobleBleProxyClient", () => {
    describe("protocol coverage", () => {
        it("implements every protocol command", () => {
            const client = new NobleBleProxyClient("ws://localhost:5580/ble");
            const implemented = new Set(client.supportedCommands);
            const missing = Object.values(BleProxyCommand).filter(command => !implemented.has(command));

            expect(missing).to.deep.equal([]);
        });
    });
});
