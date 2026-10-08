/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** Inclusive value range a Matter enum reserves for manufacturer-specific members. */
export interface EnumRange {
    min: number;
    max: number;
}

/** ModeBase ModeTag `MfgTags`. */
export const MODE_TAG_MANUFACTURER_RANGE: EnumRange = { min: 0x8000, max: 0xbfff };

/** ModeBase ModeChangeStatus `MfgCodes`. */
export const MODE_CHANGE_STATUS_MANUFACTURER_RANGE: EnumRange = { min: 0x80, max: 0xbf };

/** OperationalState `ManufacturerStates` and ErrorState `ManufacturerError`. */
export const OPERATIONAL_MANUFACTURER_RANGE: EnumRange = { min: 0x80, max: 0xbf };

/** ClosureControl ClosureErrorEnum `ManufacturerError`. */
export const CLOSURE_ERROR_MANUFACTURER_RANGE: EnumRange = { min: 0x80, max: 0xbf };

/**
 * Label for an enum value that has no named member. Values inside the manufacturer range read
 * "Manufacturer 0x80" (hex width follows the range); anything else reads `fallback`.
 */
export function unnamedEnumLabel(
    value: number,
    manufacturerRange?: EnumRange,
    fallback = `Unknown (${value})`,
): string {
    if (manufacturerRange !== undefined && value >= manufacturerRange.min && value <= manufacturerRange.max) {
        const digits = manufacturerRange.max > 0xff ? 4 : 2;
        return `Manufacturer 0x${value.toString(16).toUpperCase().padStart(digits, "0")}`;
    }
    return fallback;
}
