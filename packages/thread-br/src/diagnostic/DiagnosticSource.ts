/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagnosticResponse } from "./DiagnosticResponse.js";

export interface DiagnosticSource {
    readonly kind: "meshcop" | "otbr-rest";
    canQuery(extPanId: Uint8Array): boolean;
    queryUnicast(target: { rloc16?: number; ip?: string }, tlvTypes: number[]): Promise<DiagnosticResponse>;
    queryMulticast(scope: "ff03::1" | "ff03::2", tlvTypes: number[], collectMs: number): Promise<DiagnosticResponse[]>;
}
