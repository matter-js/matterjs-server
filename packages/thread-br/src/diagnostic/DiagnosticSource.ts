/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Observable } from "@matter/main";
import type { DiagnosticResponse } from "./DiagnosticResponse.js";

export interface QueryMulticastOptions {
    tlvTypes: number[];
    /** Total window during which responses are accepted. Default 20_000 ms. */
    windowMs?: number;
}

/**
 * Live handle for a streaming multicast diagnostic query.
 *
 * Implementations emit one `onNode` event per decoded response and resolve
 * `done` once the collection window closes (or `close()` is called). The
 * consumer is free to act on each arrival immediately and may accumulate a
 * snapshot at any time.
 */
export interface QueryMulticastHandle {
    /** Fired once per parsed `DiagnosticResponse`. */
    readonly onNode: Observable<[DiagnosticResponse]>;
    /** Transport-level errors that did not abort the handle (e.g. one decode failure). */
    readonly onError: Observable<[Error]>;
    /** Resolves when the window has fully elapsed or `close()` completed. */
    readonly done: Promise<void>;
    /** Tear down the underlying listener/DTLS session early. Idempotent. */
    close(): Promise<void>;
}

export interface DiagnosticSource {
    readonly kind: "meshcop" | "otbr-rest";
    canQuery(extPanId: Uint8Array): boolean;
    queryUnicast(target: { rloc16?: number; ip?: string }, tlvTypes: number[]): Promise<DiagnosticResponse>;
    /**
     * Issue a multicast diagnostic query (DIAG_GET for MeshCoP, /diagnostics
     * snapshot for REST) and stream parsed responses through the returned
     * handle. The handle remains open for `opts.windowMs` (default 20_000)
     * unless closed explicitly.
     */
    queryMulticast(scope: "ff03::1" | "ff03::2", opts: QueryMulticastOptions): QueryMulticastHandle;
}
