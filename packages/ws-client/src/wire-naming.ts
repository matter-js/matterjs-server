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
 * ORDER MATTERS: a shorter acronym that is a suffix of a longer one must come AFTER it
 * (SNTP before NTP, UTC before TC, PIN before PI). */
export const ACRONYMS = [
    "SNTPNTS",
    "NTPNTS",
    "BLEUWB",
    "HVAC",
    "ICAC",
    "DAC",
    "MAC",
    "EVSE",
    "RFID",
    "PIR",
    "IPV",
    "ANSI",
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
    "SNTP",
    "NTP",
    "OTA",
    "PAI",
    "PHY",
    "PIN",
    "PI",
    "PV",
    "PAKE",
    "IPK",
    "LQI",
    "URI",
    "RF",
    "RMS",
    "UTC",
    "TC",
    "URL",
    "UWB",
    "VID",
    "AC",
    "ID",
] as const;

export const FIELD_NAME_OVERRIDES: Record<string, string> = {
    Id: "id",
    PanId: "panId",
    ExtendedPanId: "extendedPanId",
    LeaderRouterId: "leaderRouterId",
    PartitionId: "partitionId",
    PartitionIdChangeCount: "partitionIdChangeCount",
    RouterId: "routerId",
    ExtendedPanIdPresent: "extendedPanIdPresent",
    PanIdPresent: "panIdPresent",
    AdminVendorId: "adminVendorId",
    Icac: "icac",
    Noc: "noc",
    MleFrameCounter: "mleFrameCounter",
    DvbiUrl: "dvbiUrl",
    PosterArtUrl: "posterArtUrl",
    ThumbnailUrl: "thumbnailUrl",
    CommissioningArl: "commissioningARL",
    ArlRequestFlowUrl: "ARLRequestFlowUrl",
    Lqi: "lqi",
    RootCaCertificate: "rootCACertificate",
    Watermark: "waterMark",
    NocsrElements: "NOCSRElements",
    AcVoltageMultiplier: "acVoltageMultiplier",
    AcVoltageDivisor: "acVoltageDivisor",
    AcCurrentMultiplier: "acCurrentMultiplier",
    AcCurrentDivisor: "acCurrentDivisor",
    AcPowerMultiplier: "acPowerMultiplier",
    AcPowerDivisor: "acPowerDivisor",
    "DraftElectricalMeasurementCluster.RmsVoltage": "rmsVoltage",
    "DraftElectricalMeasurementCluster.RmsCurrent": "rmsCurrent",
    RequirePinForRemoteOperation: "requirePINforRemoteOperation",
    AcCapacityFormat: "ACCapacityformat",
    IPv4Addresses: "IPv4Addresses",
    IPv6Addresses: "IPv6Addresses",
    OffPremiseServicesReachableIPv4: "offPremiseServicesReachableIPv4",
    OffPremiseServicesReachableIPv6: "offPremiseServicesReachableIPv6",
    ColorPointBx: "colorPointBX",
    ColorPointBy: "colorPointBY",
    ColorPointGx: "colorPointGX",
    ColorPointGy: "colorPointGY",
    ColorPointRx: "colorPointRX",
    ColorPointRy: "colorPointRY",
};

/** Convert a PascalCase matter.js name to chip-clusters PascalCase (acronym-preserving). */
export function toChipName(name: string): string {
    let result = name;
    for (const acr of ACRONYMS) {
        const titleCase = acr.charAt(0) + acr.slice(1).toLowerCase();
        const regex = new RegExp(`${titleCase}(?=[A-Z]|$|[^a-zA-Z]|s(?=[A-Z]|$|[^a-zA-Z]))`, "g");
        result = result.replace(regex, acr);
    }
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
