/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The decode ceiling a codec level states, in the units {@link VideoCodecLimits} uses. These are hard
 * bounds, like an explicit `max-fs`. `maxBitRate` is absent where no bit rate is read from the level.
 */
export interface CodecLevelLimits {
    readonly maxPixels: number;
    readonly maxPixelsPerSecond: number;
    readonly maxBitRate?: number;
}

/** A macroblock is 16x16 luma samples, which is how H.264 states MaxFS and MaxMBPS. */
export const PIXELS_PER_MACROBLOCK = 256;
/** H.264 Table A-1 states MaxBR in units of 1000 bits per second. */
const BITS_PER_KILOBIT = 1000;

/**
 * ITU-T H.264 (V15, 08/2021) Annex A, Table A-1 "Level limits": MaxMBPS (macroblocks per second),
 * MaxFS (macroblocks) and MaxBR (kbit/s).
 *
 * MaxBR is the Baseline/Main/Extended value (`cpbBrVclFactor` 1000). High profiles allow 1.25x, so
 * this is the tighter bound, which is the safe side.
 */
const H264_LEVEL_LIMITS = new Map<string, { maxMbps: number; maxFs: number; maxBr: number }>([
    ["1", { maxMbps: 1485, maxFs: 99, maxBr: 64 }],
    ["1b", { maxMbps: 1485, maxFs: 99, maxBr: 128 }],
    ["1.1", { maxMbps: 3000, maxFs: 396, maxBr: 192 }],
    ["1.2", { maxMbps: 6000, maxFs: 396, maxBr: 384 }],
    ["1.3", { maxMbps: 11880, maxFs: 396, maxBr: 768 }],
    ["2", { maxMbps: 11880, maxFs: 396, maxBr: 2000 }],
    ["2.1", { maxMbps: 19800, maxFs: 792, maxBr: 4000 }],
    ["2.2", { maxMbps: 20250, maxFs: 1620, maxBr: 4000 }],
    ["3", { maxMbps: 40500, maxFs: 1620, maxBr: 10000 }],
    ["3.1", { maxMbps: 108000, maxFs: 3600, maxBr: 14000 }],
    ["3.2", { maxMbps: 216000, maxFs: 5120, maxBr: 20000 }],
    ["4", { maxMbps: 245760, maxFs: 8192, maxBr: 20000 }],
    ["4.1", { maxMbps: 245760, maxFs: 8192, maxBr: 50000 }],
    ["4.2", { maxMbps: 522240, maxFs: 8704, maxBr: 50000 }],
    ["5", { maxMbps: 589824, maxFs: 22080, maxBr: 135000 }],
    ["5.1", { maxMbps: 983040, maxFs: 36864, maxBr: 240000 }],
    ["5.2", { maxMbps: 2073600, maxFs: 36864, maxBr: 240000 }],
    ["6", { maxMbps: 4177920, maxFs: 139264, maxBr: 240000 }],
    ["6.1", { maxMbps: 8355840, maxFs: 139264, maxBr: 480000 }],
    ["6.2", { maxMbps: 16711680, maxFs: 139264, maxBr: 800000 }],
]);

/**
 * `level_idc` -> Table A-1 level. 11 is missing because it means 1.1 or 1b depending on the profile;
 * 9 is the other spelling of 1b (H.264 §A.3.1).
 */
const H264_LEVEL_IDC_NAMES = new Map<number, string>([
    [9, "1b"],
    [10, "1"],
    [12, "1.2"],
    [13, "1.3"],
    [20, "2"],
    [21, "2.1"],
    [22, "2.2"],
    [30, "3"],
    [31, "3.1"],
    [32, "3.2"],
    [40, "4"],
    [41, "4.1"],
    [42, "4.2"],
    [50, "5"],
    [51, "5.1"],
    [52, "5.2"],
    [60, "6"],
    [61, "6.1"],
    [62, "6.2"],
]);

/** `constraint_set3_flag`, the fourth flag in the `profile_iop` byte (H.264 §7.3.2.1.1). */
const CONSTRAINT_SET3_FLAG = 0x10;

/**
 * RFC 6184 §8.1: for `profile_idc` 66 (Baseline), 77 (Main) and 88 (Extended), `level_idc` 11 with
 * `constraint_set3_flag` set is level 1b. For any other profile it is 1.1.
 */
const H264_LEVEL_1B_PROFILES = new Set<number>([66, 77, 88]);

/**
 * The limits H.264's `profile-level-id` (RFC 6184 §8.1) states, or `undefined` when it maps to no row
 * of Table A-1. `undefined` means unreadable, not unlimited.
 */
export function h264ProfileLevelIdLimits(profileLevelId: string): CodecLevelLimits | undefined {
    if (!/^[0-9a-fA-F]{6}$/.test(profileLevelId)) return undefined;
    const profileIdc = Number.parseInt(profileLevelId.slice(0, 2), 16);
    const profileIop = Number.parseInt(profileLevelId.slice(2, 4), 16);
    const levelIdc = Number.parseInt(profileLevelId.slice(4, 6), 16);
    const level =
        levelIdc === 11
            ? (profileIop & CONSTRAINT_SET3_FLAG) !== 0 && H264_LEVEL_1B_PROFILES.has(profileIdc)
                ? "1b"
                : "1.1"
            : H264_LEVEL_IDC_NAMES.get(levelIdc);
    const limits = level === undefined ? undefined : H264_LEVEL_LIMITS.get(level);
    if (limits === undefined) return undefined;
    return {
        maxPixels: limits.maxFs * PIXELS_PER_MACROBLOCK,
        maxPixelsPerSecond: limits.maxMbps * PIXELS_PER_MACROBLOCK,
        maxBitRate: limits.maxBr * BITS_PER_KILOBIT,
    };
}

/**
 * ITU-T H.265 (V5, 02/2018) Annex A: MaxLumaPs from Table A.8 and MaxLumaSr from Table A.9, keyed by
 * `general_level_idc` (thirty times the level number).
 *
 * No bit rate: H.265 states MaxBR per tier, and offers often leave the tier out.
 */
const H265_LEVEL_LIMITS = new Map<number, { maxLumaPs: number; maxLumaSr: number }>([
    [30, { maxLumaPs: 36864, maxLumaSr: 552960 }],
    [60, { maxLumaPs: 122880, maxLumaSr: 3686400 }],
    [63, { maxLumaPs: 245760, maxLumaSr: 7372800 }],
    [90, { maxLumaPs: 552960, maxLumaSr: 16588800 }],
    [93, { maxLumaPs: 983040, maxLumaSr: 33177600 }],
    [120, { maxLumaPs: 2228224, maxLumaSr: 66846720 }],
    [123, { maxLumaPs: 2228224, maxLumaSr: 133693440 }],
    [150, { maxLumaPs: 8912896, maxLumaSr: 267386880 }],
    [153, { maxLumaPs: 8912896, maxLumaSr: 534773760 }],
    [156, { maxLumaPs: 8912896, maxLumaSr: 1069547520 }],
    [180, { maxLumaPs: 35651584, maxLumaSr: 1069547520 }],
    [183, { maxLumaPs: 35651584, maxLumaSr: 2139095040 }],
    [186, { maxLumaPs: 35651584, maxLumaSr: 4278190080 }],
]);

/**
 * The limits H.265's `level-id` (`general_level_idc`, RFC 7798 §7.1) states, or `undefined` when it
 * names no row of the level tables. `undefined` means unreadable, not unlimited.
 */
export function h265LevelIdLimits(levelId: string): CodecLevelLimits | undefined {
    if (!/^\d{1,3}$/.test(levelId)) return undefined;
    const limits = H265_LEVEL_LIMITS.get(Number(levelId));
    if (limits === undefined) return undefined;
    return { maxPixels: limits.maxLumaPs, maxPixelsPerSecond: limits.maxLumaSr };
}
