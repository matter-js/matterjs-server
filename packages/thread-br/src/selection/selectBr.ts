/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry } from "../discovery/BorderRouterEntry.js";

/**
 * Decoded subset of the MeshCoP `_meshcop` TXT `sb` (state bitmap) field that
 * matters for BR selection. Layout per OpenThread's `border_agent_txt_data.hpp`:
 *   bit 7  BBR Active
 *   bit 8  BBR Is Primary (only meaningful when BBR Active)
 */
export interface DecodedStateBitmap {
    bbrActive: boolean;
    bbrPrimary: boolean;
}

/**
 * Decode the BBR-relevant bits from a 4-byte state bitmap hex string.
 *
 * Returns `{ bbrActive: false, bbrPrimary: false }` for missing or malformed
 * input — selection treats absence and "no BBR role" as equivalent.
 */
export function decodeStateBitmap(hex: string | undefined): DecodedStateBitmap {
    if (hex === undefined || !/^[0-9a-fA-F]{1,8}$/.test(hex)) {
        return { bbrActive: false, bbrPrimary: false };
    }
    const value = parseInt(hex, 16);
    if (!Number.isFinite(value)) {
        return { bbrActive: false, bbrPrimary: false };
    }
    return {
        bbrActive: ((value >> 7) & 0x1) === 1,
        bbrPrimary: ((value >> 8) & 0x1) === 1,
    };
}

function hasLinkLocal(addresses: ReadonlyArray<string>): boolean {
    for (const addr of addresses) {
        if (addr.toLowerCase().startsWith("fe80:")) return true;
    }
    return false;
}

function scoreOf(br: BorderRouterEntry): number {
    const { bbrActive, bbrPrimary } = decodeStateBitmap(br.stateBitmapHex);
    const stateScore = bbrActive && bbrPrimary ? 2 : 0;
    const llScore = hasLinkLocal(br.addresses) ? 1 : 0;
    return stateScore + llScore;
}

/**
 * Pick the best BR per spec FR-12 priority:
 *   1. State bitmap "BBR Active + Primary" (bits 7 and 8) wins.
 *   2. Among equals: BR with at least one IPv6 link-local (`fe80:`) address wins.
 *   3. Among equals: alphabetical `extAddressHex` ascending (deterministic tie-break).
 */
export function selectBr(brs: ReadonlyArray<BorderRouterEntry>): BorderRouterEntry | undefined {
    if (brs.length === 0) return undefined;

    let best = brs[0];
    let bestScore = scoreOf(best);
    for (let i = 1; i < brs.length; i++) {
        const candidate = brs[i];
        const candidateScore = scoreOf(candidate);
        if (candidateScore > bestScore) {
            best = candidate;
            bestScore = candidateScore;
            continue;
        }
        if (candidateScore === bestScore && candidate.extAddressHex < best.extAddressHex) {
            best = candidate;
        }
    }
    return best;
}
