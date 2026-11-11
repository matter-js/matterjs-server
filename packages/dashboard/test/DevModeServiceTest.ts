/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { DevModeService } from "../src/util/dev-mode-service.js";

function withLocation(href: string, action: () => void) {
    const original = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { value: { location: { href } }, configurable: true });
    try {
        action();
    } finally {
        if (original) Object.defineProperty(globalThis, "window", original);
        else Reflect.deleteProperty(globalThis, "window");
    }
}

describe("DevModeService.activeUrl", () => {
    it("adds dev=on and keeps path, other parameters and hash", () => {
        withLocation("http://192.168.1.2:5580/dashboard/?theme=dark#/node/5", () => {
            expect(DevModeService.activeUrl).to.equal("http://192.168.1.2:5580/dashboard/?theme=dark&dev=on#/node/5");
        });
    });

    it("replaces another dev value", () => {
        withLocation("http://192.168.1.2:5580/?dev=1", () => {
            expect(DevModeService.activeUrl).to.equal("http://192.168.1.2:5580/?dev=on");
        });
    });
});
