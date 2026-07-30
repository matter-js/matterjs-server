/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Field-name transform shared by the Python client generator and the WebSocket
 * server, so generated Python labels and wire keys come from one function.
 * Pure strings — no matter.js dependency.
 */

/** Well-known acronyms chip-clusters preserves as uppercase.
 * ORDER MATTERS: entries are checked left-to-right via replace(). An acronym that is a
 * suffix of another must come AFTER the longer one, or the short form matches first and
 * leaves the remainder un-expanded. Critical ordering constraints:
 *   SNTP before NTP — "Ntp" is a suffix of "Sntp"
 *   UTC before TC — "Tc" is a suffix of "Utc"
 *   PIN before PI — "Pi" is a suffix of "Pin"
 */
export const ACRONYMS = [
    // Compound acronyms first as a precaution
    "SNTPNTS", // before SNTP and NTP
    "NTPNTS", // before NTP
    "BLEUWB", // before BLE and UWB
    "HVAC", // before AC
    "ICAC", // before AC
    "DAC", // before AC
    "MAC", // before AC
    "EVSE", // before EV
    "RFID", // before RF
    "PIR", // before PI
    "IPV", // before IP
    "ANSI",
    // "ARL" intentionally omitted — old pkg has both CommissioningARL (needs ARL) and Arl attr (must stay Arl)
    // "ACL" intentionally omitted — chip SDK uses Acl for the AccessControl attribute (not ACL)
    "BDX",
    "BLE",
    "CEC",
    "CO",
    "CSR",
    "DNS",
    "DST",
    "ESA",
    "EV",
    "GHG",
    "ICD",
    "IEC",
    "IP",
    "LED",
    "MLE",
    "NFC",
    "NOC",
    "SNTP", // before NTP (NTP is a suffix of SNTP)
    "NTP",
    "OTA",
    "PAI",
    // "PAN" intentionally omitted — causes regressions for PanId attrs in ThreadNetworkDiagnostics
    "PHY",
    "PIN",
    "PI",
    "PV",
    "PAKE",
    "IPK",
    "LQI",
    // BX/BY/GX/GY/RX/RY intentionally omitted — too broad (would turn "ByNumber" → "BYNumber").
    // ColorPoint coordinate attributes are handled via FIELD_NAME_OVERRIDES instead.
    "URI",
    "RF",
    "RMS",
    "UTC", // before TC (TC is a suffix of UTC)
    "TC",
    "URL",
    "UWB",
    "VID",
    "AC", // after HVAC, ICAC, DAC, MAC
    "ID",
] as const;

/** Key: matter.js PascalCase model name (pre-toChipName transform), optionally cluster-qualified
 * as "ClusterName.Name". Value: expected wire/Python field name.
 *
 * Cluster-qualified keys ("Cluster.Field") resolve against the cluster the value is
 * observed under. For a struct shared across clusters the WebSocket converter keys on the
 * top-level cluster while the Python generator keys on the defining cluster — so a qualified
 * override on a shared/global struct field would make the two diverge. Only add qualified
 * overrides for fields owned by a single cluster. */
export const FIELD_NAME_OVERRIDES: Record<string, string> = {
    // --- ID suffix: old chip SDK kept lowercase "Id" (not "ID") for these ---
    Id: "id",
    // Note: GroupId intentionally NOT overridden — most places use "groupID" (with uppercase ID).
    // Only GroupKeyManagement structs use "groupId" which is a minor inconsistency.
    PanId: "panId",
    ExtendedPanId: "extendedPanId",
    LeaderRouterId: "leaderRouterId",
    PartitionId: "partitionId",
    PartitionIdChangeCount: "partitionIdChangeCount",
    RouterId: "routerId",
    ExtendedPanIdPresent: "extendedPanIdPresent",
    PanIdPresent: "panIdPresent",
    AdminVendorId: "adminVendorId",
    // --- NOC struct: old chip SDK used fully lowercase (no acronym expansion) ---
    Icac: "icac",
    Noc: "noc",
    // --- MLE: old chip SDK kept mle lowercase in mid-word position ---
    MleFrameCounter: "mleFrameCounter",
    // --- URL vs Url: old chip SDK kept "Url" (not "URL") for these specific fields ---
    DvbiUrl: "dvbiUrl",
    PosterArtUrl: "posterArtUrl",
    ThumbnailUrl: "thumbnailUrl",
    // --- ARL: intentionally not in ACRONYMS (breaks Arl attribute) ---
    CommissioningArl: "commissioningARL",
    // Note: chip SDK uppercases URL here (unlike dvbiUrl/posterArtUrl which keep "Url")
    ArlRequestFlowUrl: "ARLRequestFlowUrl",
    // --- LQI: CHIP SDK keeps lowercase "lqi" in struct fields ---
    Lqi: "lqi",
    // --- CA: not in ACRONYMS (would conflict with ICAC/DAC/MAC handling) ---
    RootCaCertificate: "rootCACertificate",
    // --- Watermark: matter.js spells as one word, chip SDK as two ---
    Watermark: "waterMark",
    // --- NOCSR: not a standalone acronym in ACRONYMS ---
    NocsrElements: "NOCSRElements",
    // --- DraftElectricalMeasurementCluster: custom cluster uses "ac"/"rms" not "AC"/"RMS" ---
    // Ac* are safe as global overrides (only this cluster has them).
    // Rms* must be cluster-qualified because standard clusters use "RMS" (uppercase).
    AcVoltageMultiplier: "acVoltageMultiplier",
    AcVoltageDivisor: "acVoltageDivisor",
    AcCurrentMultiplier: "acCurrentMultiplier",
    AcCurrentDivisor: "acCurrentDivisor",
    AcPowerMultiplier: "acPowerMultiplier",
    AcPowerDivisor: "acPowerDivisor",
    "DraftElectricalMeasurementCluster.RmsVoltage": "rmsVoltage",
    "DraftElectricalMeasurementCluster.RmsCurrent": "rmsCurrent",
    // --- DoorLock quirks ---
    // Note: chip SDK lowercases "for" here (requirePINforRemoteOperation — not a typo)
    // Key must match the Matter.js model name (RequirePinForRemoteOperation), not the
    // post-toChipName version (RequirePINForRemoteOperation).
    RequirePinForRemoteOperation: "requirePINforRemoteOperation",
    // Note: chip SDK lowercases the "f" in "format" here (ACCapacityformat — chip SDK quirk)
    AcCapacityFormat: "ACCapacityformat",
    // --- IPv4/IPv6: old chip SDK used "IPv4"/"IPv6" (capital I, lowercase v) ---
    // Key must match the Matter.js model name (IPv4Addresses), not post-toChipName
    IPv4Addresses: "IPv4Addresses",
    IPv6Addresses: "IPv6Addresses",
    OffPremiseServicesReachableIPv4: "offPremiseServicesReachableIPv4",
    OffPremiseServicesReachableIPv6: "offPremiseServicesReachableIPv6",
    // --- ColorControl chromaticity coordinates: old chip SDK kept uppercase XY suffix ---
    ColorPointBx: "colorPointBX",
    ColorPointBy: "colorPointBY",
    ColorPointGx: "colorPointGX",
    ColorPointGy: "colorPointGY",
    ColorPointRx: "colorPointRX",
    ColorPointRy: "colorPointRY",
};

const chipNameCache = new Map<string, string>();

/** Convert a PascalCase matter.js name to chip-clusters PascalCase (acronym-preserving). */
export function toChipName(name: string): string {
    const cached = chipNameCache.get(name);
    if (cached !== undefined) return cached;
    let result = name;
    for (const acr of ACRONYMS) {
        const titleCase = acr.charAt(0) + acr.slice(1).toLowerCase();
        const regex = new RegExp(`${titleCase}(?=[A-Z]|$|[^a-zA-Z]|s(?=[A-Z]|$|[^a-zA-Z]))`, "g");
        result = result.replace(regex, acr);
    }
    chipNameCache.set(name, result);
    return result;
}

/** Convert a matter.js struct-member name to its wire field name (acronym-preserving camelCase).
 *  Checks cluster-qualified then per-name overrides before the generic transform. */
export function matterNameToWireField(name: string, clusterName?: string): string {
    if (clusterName) {
        const qualifiedKey = `${clusterName}.${name}`;
        if (qualifiedKey in FIELD_NAME_OVERRIDES) return FIELD_NAME_OVERRIDES[qualifiedKey];
    }
    if (name in FIELD_NAME_OVERRIDES) return FIELD_NAME_OVERRIDES[name];
    const chipName = toChipName(name);
    if (/^[A-Z]{2}/.test(chipName)) return chipName;
    return chipName.charAt(0).toLowerCase() + chipName.slice(1);
}
