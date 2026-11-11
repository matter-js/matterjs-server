/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { type EnterKeyEvent, onEnter } from "../src/util/on-enter.js";

const IME_PROCESS_KEY_CODE = 229;

class FakeKeyEvent implements EnterKeyEvent {
    defaultPrevented = false;

    constructor(
        readonly key: string,
        readonly options: { isComposing?: boolean; repeat?: boolean; keyCode?: number } = {},
    ) {}

    get isComposing() {
        return this.options.isComposing ?? false;
    }

    get repeat() {
        return this.options.repeat ?? false;
    }

    get keyCode() {
        return this.options.keyCode ?? (this.key === "Enter" ? 13 : 0);
    }

    preventDefault() {
        this.defaultPrevented = true;
    }
}

function expectIgnored(event: FakeKeyEvent) {
    let calls = 0;
    onEnter(() => calls++)(event);
    expect(calls).to.equal(0);
    expect(event.defaultPrevented).to.equal(false);
}

describe("onEnter", () => {
    it("runs the action and prevents the default on Enter", () => {
        let calls = 0;
        const event = new FakeKeyEvent("Enter");
        onEnter(() => calls++)(event);
        expect(calls).to.equal(1);
        expect(event.defaultPrevented).to.equal(true);
    });

    it("ignores other keys", () => {
        expectIgnored(new FakeKeyEvent("a"));
    });

    it("ignores Enter that confirms an IME composition", () => {
        expectIgnored(new FakeKeyEvent("Enter", { isComposing: true }));
    });

    it("ignores the Safari IME commit Enter that reports isComposing=false", () => {
        expectIgnored(new FakeKeyEvent("Enter", { keyCode: IME_PROCESS_KEY_CODE }));
    });

    it("ignores auto-repeat from a held Enter key", () => {
        expectIgnored(new FakeKeyEvent("Enter", { repeat: true }));
    });
});
