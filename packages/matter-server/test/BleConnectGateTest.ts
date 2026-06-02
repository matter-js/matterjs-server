/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { wireBleConnectGate } from "../src/bleConnectGate.js";

function makeEvent() {
    const listeners = new Array<() => void>();
    return {
        on(listener: () => void) {
            listeners.push(listener);
            return { close() {} };
        },
        emit() {
            for (const listener of listeners) listener();
        },
    };
}

describe("wireBleConnectGate", () => {
    it("releases the gate when the only commission ends", () => {
        const commissioningStarted = makeEvent();
        const commissioningEnded = makeEvent();
        let aborts = 0;
        wireBleConnectGate({ commissioningStarted, commissioningEnded }, { abortPendingConnects: () => aborts++ });

        commissioningStarted.emit();
        expect(aborts).to.equal(0);
        commissioningEnded.emit();
        expect(aborts).to.equal(1);
    });

    it("releases only after the last concurrent commission ends", () => {
        const commissioningStarted = makeEvent();
        const commissioningEnded = makeEvent();
        let aborts = 0;
        wireBleConnectGate({ commissioningStarted, commissioningEnded }, { abortPendingConnects: () => aborts++ });

        commissioningStarted.emit();
        commissioningStarted.emit();
        commissioningEnded.emit();
        expect(aborts).to.equal(0); // one attempt still running
        commissioningEnded.emit();
        expect(aborts).to.equal(1);
    });

    it("ignores an unbalanced end and stays correct afterwards", () => {
        const commissioningStarted = makeEvent();
        const commissioningEnded = makeEvent();
        let aborts = 0;
        wireBleConnectGate({ commissioningStarted, commissioningEnded }, { abortPendingConnects: () => aborts++ });

        commissioningEnded.emit(); // no matching start
        expect(aborts).to.equal(0);

        commissioningStarted.emit();
        commissioningEnded.emit();
        expect(aborts).to.equal(1);
    });
});
