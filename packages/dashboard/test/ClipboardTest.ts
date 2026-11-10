/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyText, type TextClipboard } from "../src/util/clipboard.js";

class FakeClipboard implements TextClipboard {
    written = new Array<string>();

    constructor(private readonly error?: Error) {}

    async writeText(text: string) {
        if (this.error !== undefined) {
            throw this.error;
        }
        this.written.push(text);
    }
}

class FakeFallback {
    copied = new Array<string>();

    constructor(private readonly works = true) {}

    readonly copy = (text: string) => {
        this.copied.push(text);
        return this.works;
    };
}

async function copyError(...args: Parameters<typeof copyText>): Promise<Error> {
    try {
        await copyText(...args);
    } catch (error) {
        if (error instanceof Error) {
            return error;
        }
        throw error;
    }
    throw new Error("copyText resolved");
}

describe("copyText", () => {
    it("uses navigator.clipboard when no clipboard is passed", async () => {
        const clipboard = new FakeClipboard();
        const fallback = new FakeFallback();
        const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
        Object.defineProperty(globalThis, "navigator", { value: { clipboard }, configurable: true });
        try {
            await copyText("15988629651", fallback.copy);
        } finally {
            if (original) Object.defineProperty(globalThis, "navigator", original);
            else Reflect.deleteProperty(globalThis, "navigator");
        }
        expect(clipboard.written).to.deep.equal(["15988629651"]);
        expect(fallback.copied).to.deep.equal([]);
    });

    it("uses the clipboard and skips the fallback when writeText succeeds", async () => {
        const clipboard = new FakeClipboard();
        const fallback = new FakeFallback();
        await copyText("15988629651", fallback.copy, clipboard);
        expect(clipboard.written).to.deep.equal(["15988629651"]);
        expect(fallback.copied).to.deep.equal([]);
    });

    it("uses the fallback when there is no clipboard", async () => {
        const fallback = new FakeFallback();
        await copyText("15988629651", fallback.copy, null);
        expect(fallback.copied).to.deep.equal(["15988629651"]);
    });

    it("runs the fallback within the call when there is no clipboard", async () => {
        const fallback = new FakeFallback();
        const copied = copyText("15988629651", fallback.copy, null);
        expect(fallback.copied).to.deep.equal(["15988629651"]);
        await copied;
    });

    it("uses the fallback when writeText rejects", async () => {
        const fallback = new FakeFallback();
        await copyText("15988629651", fallback.copy, new FakeClipboard(new Error("NotAllowedError")));
        expect(fallback.copied).to.deep.equal(["15988629651"]);
    });

    it("rejects with the clipboard error as cause when the fallback also fails", async () => {
        const clipboardError = new Error("NotAllowedError");
        const error = await copyError("15988629651", new FakeFallback(false).copy, new FakeClipboard(clipboardError));
        expect(error.cause).to.equal(clipboardError);
    });

    it("rejects when there is no clipboard and the fallback fails", async () => {
        const error = await copyError("15988629651", new FakeFallback(false).copy, null);
        expect(error.message).to.equal("Copying to the clipboard failed");
        expect(error.cause).to.equal(undefined);
    });
});
