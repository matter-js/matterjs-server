/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

interface LifecycleEvent {
    on(listener: () => void): unknown;
}

interface CommissioningLifecycleEvents {
    commissioningStarted: LifecycleEvent;
    commissioningEnded: LifecycleEvent;
}

interface ConnectGate {
    abortPendingConnects(): void;
}

/**
 * Release the BLE connect gate only when no commissioning attempt is in progress.
 *
 * BLE is used solely during commissioning, so once the last concurrent attempt ends, queued
 * connects are stale and any open channel is an orphan holding the connection slot. Ref-counting
 * the generic start/end lifecycle keeps the controller's events policy-free and ensures finishing
 * one attempt can't tear down a concurrent attempt's connect.
 */
export function wireBleConnectGate(events: CommissioningLifecycleEvents, gate: ConnectGate): void {
    let active = 0;
    events.commissioningStarted.on(() => {
        active++;
    });
    events.commissioningEnded.on(() => {
        if (active > 0 && --active === 0) {
            gate.abortPendingConnects();
        }
    });
}
