/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates Python chip cluster definitions from the Matter.js model.
 *
 * Produces:
 *   - python_client/chip/clusters/cluster_defs/<ClusterName>.py (one per cluster)
 *   - python_client/chip/clusters/cluster_defs/__init__.py
 *   - python_client/chip/clusters/Objects.py (re-export)
 *   - python_client/matter_server/client/models/device_types.py
 *
 * Run with: npx tsx python_client/scripts/generate-python-clusters.ts
 */

import { AttributeModel, ClusterModel, CommandModel, EventModel, Matter, ValueModel } from "@matter/main/model";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Include custom cluster definitions in the model (registers them in Matter)
import "@matter-server/custom-clusters";
// Also import the class names to identify which clusters are custom
import * as CustomClusterClasses from "../../packages/custom-clusters/dist/esm/clusters/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pythonClientDir = join(__dirname, "..");
const objectsDir = join(pythonClientDir, "chip", "clusters", "cluster_defs");

// ============================================================================
// Name conversion utilities
// ============================================================================

/** Well-known acronyms that chip-clusters preserves as uppercase in class names.
 * ORDER MATTERS: entries are checked left-to-right via replace(). An acronym that
 * is a suffix of another must come AFTER the longer one, or the short form matches
 * first and leaves the remainder un-expanded. Critical ordering constraints:
 *   SNTP before NTP — "Ntp" is a suffix of "Sntp"
 *   UTC  before TC  — "Tc"  is a suffix of "Utc"
 *   PIN  before PI  — "Pi"  is a suffix of "Pin"
 */
const ACRONYMS = [
    // Compound acronyms first as a precaution
    "SNTPNTS", // e.g. kNonMatterSNTPNTS — before SNTP and NTP
    "NTPNTS",  // e.g. kNonMatterNTPNTS  — before NTP
    "BLEUWB",  // e.g. kAliroBLEUWB      — before BLE and UWB
    "HVAC",    // e.g. HVACSystemTypeConfiguration — before AC
    "ICAC",    // e.g. IcacCertificate             — before AC
    "DAC",     // e.g. kDACCertificate              — before AC
    "MAC",     // e.g. MACAddress, kMACCounts       — before AC
    "EVSE",    // e.g. kEVSEStopped                 — before EV
    "RFID",    // e.g. RfidCredential               — before RF
    "PIR",     // e.g. PIROccupiedToUnoccupiedDelay — before PI
    "IPV",     // e.g. kIPV6Failed                  — before IP
    // Standard acronyms (alphabetical within groups for readability)
    "ANSI",    // e.g. BatANSIDesignation
    // "ARL" intentionally omitted — old pkg has both CommissioningARL (needs ARL) and Arl attr (must stay Arl)
    // "ACL" intentionally omitted — chip SDK uses Acl for the AccessControl attribute (not ACL)
    "BDX",     // e.g. kBDXAsynchronous, kBDXSynchronous
    "BLE",     // e.g. kBLEFault
    "CEC",     // e.g. CEC key codes
    "CO",      // e.g. kCOAlarm
    "CSR",     // e.g. CSR elements
    "DNS",     // e.g. SupportsDNSResolve
    "DST",     // e.g. DSTOffset
    "ESA",     // e.g. ESAType, ESAState, ESACanGenerate
    "EV",      // e.g. kEVConnected, kEVStopped
    "GHG",     // e.g. kGHGEmissions
    "ICD",     // e.g. ICDCounter
    "IEC",     // e.g. BatIECDesignation
    "IP",      // e.g. kIPBindFailed, kIPV6Failed
    "LED",     // e.g. LED indicators
    "MLE",     // e.g. kMLECounts
    "NFC",     // e.g. kNFCFault
    "NOC",     // e.g. NOCStruct, kInvalidNOC
    "SNTP",    // e.g. kMatterSNTP — before NTP (NTP is a suffix of SNTP)
    "NTP",     // e.g. NTPClient, NTPServer
    "OTA",     // e.g. AnnounceOTAProvider
    "PAI",     // e.g. kPAICertificate
    // "PAN" intentionally omitted — causes regressions for PanId attrs in ThreadNetworkDiagnostics
    "PHY",     // e.g. PHYRate
    "PIN",     // e.g. kPINManagement
    "PI",      // e.g. PICoolingDemand, PIHeatingDemand
    "PV",      // e.g. kSolarPV
    "PAKE",    // e.g. PAKEPasscodeVerifier (add before any future PA entry)
    "IPK",     // e.g. IPKValue (Identity Protection Key)
    "LQI",     // e.g. LQIIn, LQIOut (Thread Link Quality Indicator)
    // BX/BY/GX/GY/RX/RY intentionally omitted from ACRONYMS — too broad (would turn "ByNumber" → "BYNumber").
    // ColorPoint coordinate attributes are handled via FIELD_NAME_OVERRIDES instead.
    "URI",     // e.g. imageURI
    "RF",      // e.g. kRFSensing
    "RMS",     // e.g. RMSCurrent, RMSVoltage, RMSPower
    "UTC",     // e.g. UTCTime — before TC (TC is a suffix of UTC)
    "TC",      // e.g. kRequiredTCNotAccepted
    "URL",     // e.g. kURLPlayback
    "UWB",     // e.g. AliroBLEUWB protocol versions
    "VID",     // e.g. VendorID
    "AC",      // e.g. ACCapacity, ACType — after HVAC, ICAC, DAC, MAC
    "ID",      // e.g. VendorID, NetworkID
];

/**
 * Overrides for specific k-values where toChipName() either over-expands or under-expands acronyms.
 * Key: matter.js PascalCase member name (as passed to toKName).
 * Value: expected PascalCase (without "k" prefix) that the chip SDK uses.
 *
 * Over-expansion cases: the chip SDK keeps TitleCase where toChipName() would uppercase.
 * Under-expansion cases: the chip SDK uppercases where toChipName() would keep TitleCase.
 */
const K_VALUE_OVERRIDES: Record<string, string> = {
    // --- Acronym over-expansion: chip SDK keeps TitleCase ---
    // PIN → Pin (standalone enum member, not mid-word like "programmingPin" → kProgrammingPIN)
    Pin: "Pin",
    PinCredential: "PinCredential",
    // RFID → Rfid (standalone)
    Rfid: "Rfid",
    RfidCredential: "RfidCredential",
    // AC → Ac (standalone, e.g. WiredCurrentTypeEnum.Ac, PowerModeEnum.Ac, WiFiVersionEnum.Ac)
    Ac: "Ac",
    // AC → Ac41e (battery designation code — chip SDK lowercases the whole code)
    Ac41E: "Ac41e",
    // PIR → Pir (standalone, OccupancySensing enum/bitmap)
    Pir: "Pir",
    // BDX → Bdx (standalone, DiagnosticLogs.TransferProtocolEnum)
    Bdx: "Bdx",
    // EVSE → Evse (standalone, DeviceEnergyManagement.ESATypeEnum)
    Evse: "Evse",
    // V2X — chip SDK uses kV2x (lowercase x) not kV2X
    V2X: "V2x",
    // ID → Id (inside NodeOperationalCertStatusEnum.InvalidNodeOpId)
    InvalidNodeOpId: "InvalidNodeOpId",
    // CSR → Csr (inside NodeOperationalCertStatusEnum.MissingCsr)
    MissingCsr: "MissingCsr",
    // WindowCovering.TypeEnum — matter.js spells these as one word ("rollershade"),
    // but chip SDK treats it as two words ("kRollerShade").
    Rollershade: "RollerShade",
    Rollershade2Motor: "RollerShade2Motor",
    RollershadeExterior: "RollerShadeExterior",
    RollershadeExterior2Motor: "RollerShadeExterior2Motor",

    // --- WiFiBandEnum: chip SDK uses all-lowercase for GHz-band names ---
    "2G4": "2g4",
    "3G65": "3g65",
    "5G": "5g",
    "6G": "6g",
    "60G": "60g",
    "1G": "1g",

    // --- PHYRateEnum: chip SDK uses lowercase g for Rate25G ---
    Rate25G: "Rate25g",

    // --- HourFormatEnum: chip SDK uses all-lowercase hr suffix ---
    "12Hr": "12hr",
    "24Hr": "24hr",

    // --- ACCapacityFormatEnum.BtUh: chip SDK expands BTU as uppercase ---
    BtUh: "BTUh",

    // --- ACRefrigerantTypeEnum: chip SDK lowercases the trailing letter of refrigerant codes ---
    R410A: "R410a",
    R407C: "R407c",

    // --- BatCommonDesignationEnum: chip SDK uses all-lowercase alphanumeric battery codes ---
    "4V5": "4v5",
    "6V0": "6v0",
    "9V0": "9v0",
    "12Aa": "12aa",
    "4Sr44": "4sr44",
    "15V0": "15v0",
    "22V5": "22v5",
    "30V0": "30v0",
    "45V0": "45v0",
    "67V5": "67v5",
    "2Cr5": "2cr5",
    Cr123A: "Cr123a",
    Rcr123A: "Rcr123a",

    // --- Acronym under-expansion: chip SDK uppercases where toChipName() does not ---
    // PAN intentionally omitted from ACRONYMS (would break PanId in ThreadNetworkDiagnostics)
    // but FeatureMap title "PanChange" must produce kPANChange
    PanChange: "PANChange",

    // --- ColorControl Feature bitmap: chip SDK uses "HueAndSaturation" not "HueSaturation" ---
    HueSaturation: "HueAndSaturation",

    // --- DoorLock Feature bitmap: chip SDK uses "CredentialsOverTheAirAccess" (with s) ---
    CredentialOverTheAirAccess: "CredentialsOverTheAirAccess",

    // --- DoorLock Feature bitmap: chip SDK uses "Unbolt" not "Unbolting" ---
    Unbolting: "Unbolt",

    // --- WindowCovering TypeEnum: chip SDK uses "TiltBlindLiftAndTilt" not "TiltBlindLift" ---
    TiltBlindLift: "TiltBlindLiftAndTilt",
};

/**
 * Overrides for specific field names (cluster attributes, struct fields, command fields)
 * where the old chip-clusters package used a non-standard casing that differs from what
 * toChipName + toCamelCase would produce.
 * Key: PascalCase matter.js model name.
 * Value: expected Python field name.
 */
const FIELD_NAME_OVERRIDES: Record<string, string> = {
    // --- ID suffix: old chip SDK kept lowercase "Id" (not "ID") for these ---
    Id:                          "id",
    // Note: GroupId intentionally NOT overridden — most places use "groupID" (with uppercase ID).
    // Only GroupKeyManagement structs use "groupId" which is a minor inconsistency.
    PanId:                       "panId",
    ExtendedPanId:               "extendedPanId",
    LeaderRouterId:              "leaderRouterId",
    PartitionId:                 "partitionId",
    PartitionIdChangeCount:      "partitionIdChangeCount",
    RouterId:                    "routerId",
    ExtendedPanIDPresent:        "extendedPanIdPresent",
    PanIDPresent:                "panIdPresent",
    AdminVendorId:               "adminVendorId",

    // --- NOC struct: old chip SDK used fully lowercase (no acronym expansion) ---
    Icac:                        "icac",
    Noc:                         "noc",

    // --- MLE: old chip SDK kept mle lowercase in mid-word position ---
    MleFrameCounter:             "mleFrameCounter",

    // --- URL vs Url: old chip SDK kept "Url" (not "URL") for these specific fields ---
    DvbiUrl:                     "dvbiUrl",
    PosterArtUrl:                "posterArtUrl",
    ThumbnailUrl:                "thumbnailUrl",

    // --- ARL: intentionally not in ACRONYMS (breaks Arl attribute) ---
    CommissioningArl:            "commissioningARL",
    // Note: chip SDK uppercases URL here (unlike dvbiUrl/posterArtUrl which keep "Url")
    ArlRequestFlowUrl:           "ARLRequestFlowUrl",

    // --- CA: not in ACRONYMS (would conflict with ICAC/DAC/MAC handling) ---
    RootCaCertificate:           "rootCACertificate",

    // --- Watermark: matter.js spells as one word, chip SDK as two ---
    Watermark:                   "waterMark",

    // --- NOCSR: not a standalone acronym in ACRONYMS ---
    NocsrElements:               "NOCSRElements",

    // --- DraftElectricalMeasurementCluster: custom cluster uses "ac"/"rms" not "AC"/"RMS" ---
    // Ac* are safe as global overrides (only this cluster has them).
    // Rms* must be cluster-qualified because standard clusters use "RMS" (uppercase).
    AcVoltageMultiplier:         "acVoltageMultiplier",
    AcVoltageDivisor:            "acVoltageDivisor",
    AcCurrentMultiplier:         "acCurrentMultiplier",
    AcCurrentDivisor:            "acCurrentDivisor",
    AcPowerMultiplier:           "acPowerMultiplier",
    AcPowerDivisor:              "acPowerDivisor",
    "DraftElectricalMeasurementCluster.RmsVoltage":  "rmsVoltage",
    "DraftElectricalMeasurementCluster.RmsCurrent":  "rmsCurrent",

    // --- DoorLock quirks ---
    // Note: chip SDK lowercases "for" here (requirePINforRemoteOperation — not a typo)
    RequirePINForRemoteOperation: "requirePINforRemoteOperation",
    // Note: chip SDK lowercases the "f" in "format" here (ACCapacityformat — chip SDK quirk)
    AcCapacityFormat:            "ACCapacityformat",

    // --- IPv4/IPv6: old chip SDK used "IPv4"/"IPv6" (capital I, lowercase v) ---
    Ipv4Addresses:               "IPv4Addresses",
    Ipv6Addresses:               "IPv6Addresses",
    OffPremiseServicesReachableIPV4: "offPremiseServicesReachableIPv4",
    OffPremiseServicesReachableIPV6: "offPremiseServicesReachableIPv6",

    // --- ColorControl chromaticity coordinates: old chip SDK kept uppercase XY suffix ---
    ColorPointBx:                "colorPointBX",
    ColorPointBy:                "colorPointBY",
    ColorPointGx:                "colorPointGX",
    ColorPointGy:                "colorPointGY",
    ColorPointRx:                "colorPointRX",
    ColorPointRy:                "colorPointRY",
};

/**
 * Overrides for class names (attributes, commands, events, enums) where toChipName()
 * doesn't match the CHIP SDK class name.
 * Key: matter.js PascalCase model name.
 * Value: expected PascalCase class name in the CHIP SDK.
 */
const CLASS_NAME_OVERRIDES: Record<string, string> = {
    // --- ARL: not in ACRONYMS (breaks field name), but class name needs uppercase ARL ---
    CommissioningArl:            "CommissioningARL",

    // --- AdminVendorId: CHIP SDK keeps "Id" (not "ID") in the class name ---
    AdminVendorId:               "AdminVendorId",

    // --- ColorControl chromaticity coordinates: CHIP SDK keeps uppercase XY suffix ---
    ColorPointBx:                "ColorPointBX",
    ColorPointBy:                "ColorPointBY",
    ColorPointGx:                "ColorPointGX",
    ColorPointGy:                "ColorPointGY",
    ColorPointRx:                "ColorPointRX",
    ColorPointRy:                "ColorPointRY",

    // --- DoorLock: CHIP SDK keeps lowercase "for" in class name ---
    RequirePinForRemoteOperation: "RequirePINforRemoteOperation",

    // --- EnergyEvse event: CHIP SDK uses "Rfid" not "RFID" ---
    Rfid:                        "Rfid",

    // --- IcdManagement: CHIP SDK uses "BackOff" (two words) ---
    MaximumCheckInBackoff:       "MaximumCheckInBackOff",

    // --- JointFabricAdministrator commands: CHIP SDK expands ICAC+CSR ---
    IcaccsrRequest:              "ICACCSRRequest",
    IcaccsrResponse:             "ICACCSRResponse",

    // --- JointFabricDatastore: CHIP SDK expands ACL ---
    AddAclToNode:                "AddACLToNode",
    RemoveAclFromNode:           "RemoveACLFromNode",
    AnchorRootCa:                "AnchorRootCA",
    NodeAclList:                 "NodeACLList",

    // --- Thermostat: CHIP SDK uses lowercase "format" (quirk) ---
    AcCapacityFormat:            "ACCapacityformat",

    // --- ThreadNetworkDiagnostics: CHIP SDK keeps "Id" (not "ID") for these ---
    ExtendedPanId:               "ExtendedPanId",
    LeaderRouterId:              "LeaderRouterId",
    PanId:                       "PanId",
    PartitionId:                 "PartitionId",
    PartitionIdChangeCount:      "PartitionIdChangeCount",

    // --- Enum suffix stripping: CHIP SDK omits "Enum" suffix for some enum class names ---
    // Note: StatusCodeEnum is cluster-dependent (some keep suffix, some strip it).
    // Use "ClusterName.ClassName" keys for cluster-specific overrides below.
    ModeTagEnum:                 "ModeTag",
    SelectAreasStatusEnum:       "SelectAreasStatus",
    SkipAreaStatusEnum:          "SkipAreaStatus",

    // --- WindowCovering: CHIP SDK strips Enum/Bitmap suffixes ---
    TypeEnum:                    "Type",
    EndProductTypeEnum:          "EndProductType",
    ModeBitmap:                  "Mode",
    ConfigStatusBitmap:          "ConfigStatus",
    OperationalStatusBitmap:     "OperationalStatus",
    SafetyStatusBitmap:          "SafetyStatus",

    // --- DraftElectricalMeasurementCluster: custom cluster keeps "Ac"/"Rms" not "AC"/"RMS" ---
    // Ac* are safe as global overrides (only this cluster has them).
    // Rms* must be cluster-qualified because standard clusters use "RMS" (uppercase).
    AcVoltageMultiplier:         "AcVoltageMultiplier",
    AcVoltageDivisor:            "AcVoltageDivisor",
    AcCurrentMultiplier:         "AcCurrentMultiplier",
    AcCurrentDivisor:            "AcCurrentDivisor",
    AcPowerMultiplier:           "AcPowerMultiplier",
    AcPowerDivisor:              "AcPowerDivisor",
    "DraftElectricalMeasurementCluster.RmsVoltage":  "RmsVoltage",
    "DraftElectricalMeasurementCluster.RmsCurrent":  "RmsCurrent",

    // --- DoorLock: CHIP SDK uses legacy "Dl" prefixed names for some enums ---
    // Missing members for DlStatus are injected via EXTRA_ENUM_MEMBERS.
    "DoorLock.LockStateEnum":    "DlLockState",
    "DoorLock.LockTypeEnum":     "DlLockType",
    "DoorLock.StatusCodeEnum":   "DlStatus",

    // --- Cluster-specific overrides (key format: "ClusterName.ClassName") ---
    // StatusCodeEnum: stripped in some clusters, kept in others
    "AdministratorCommissioning.StatusCodeEnum": "StatusCode",
    "RvcCleanMode.StatusCodeEnum":               "StatusCode",
    "RvcRunMode.StatusCodeEnum":                  "StatusCode",
    "TimeSynchronization.StatusCodeEnum":         "StatusCode",
};

/**
 * Extra enum members to inject that are present in the CHIP SDK but missing from the
 * Matter.js model. Key: "ClusterName.EnumModelName" (using Matter.js model name).
 * Value: array of { kName, value } entries to add.
 */
const EXTRA_ENUM_MEMBERS: Record<string, Array<{ kName: string; value: number }>> = {
    // DoorLock.StatusCodeEnum (DlStatus in CHIP SDK) — Matter.js only has Duplicate(2)
    // and Occupied(3), but the CHIP SDK includes general status codes.
    "DoorLock.StatusCodeEnum": [
        { kName: "kSuccess", value: 0x00 },
        { kName: "kFailure", value: 0x01 },
        { kName: "kInvalidField", value: 0x85 },
        { kName: "kResourceExhausted", value: 0x89 },
        { kName: "kNotFound", value: 0x8B },
    ],
};

/**
 * Extra bitmaps to inject that are present in the CHIP SDK but missing from the
 * Matter.js model. Key: cluster name. Value: array of bitmap definitions.
 */
const EXTRA_BITMAPS: Record<string, Array<{ name: string; members: Array<{ kName: string; value: number }> }>> = {
    ColorControl: [
        {
            name: "ColorCapabilitiesBitmap",
            members: [
                { kName: "kHueSaturation", value: 0x1 },
                { kName: "kEnhancedHue", value: 0x2 },
                { kName: "kColorLoop", value: 0x4 },
                { kName: "kXy", value: 0x8 },
                { kName: "kColorTemperature", value: 0x10 },
            ],
        },
    ],
};

/**
 * Convert a PascalCase name from Matter.js to chip-clusters-compatible PascalCase.
 * Matter.js uses standard PascalCase (e.g., "AnnounceOtaProvider"),
 * chip-clusters preserves known acronyms (e.g., "AnnounceOTAProvider").
 */
function toChipName(name: string): string {
    let result = name;
    for (const acr of ACRONYMS) {
        // Match the title-case version of the acronym at a PascalCase word boundary.
        // The acronym must be followed by an uppercase letter (next word), end-of-string,
        // or a non-alpha character — NOT a lowercase letter (which means it's mid-word).
        // Also match when followed by a plural 's' that is itself at a word boundary
        // (e.g., "Nocs" → "NOCs").
        const titleCase = acr.charAt(0) + acr.slice(1).toLowerCase();
        const regex = new RegExp(`${titleCase}(?=[A-Z]|$|[^a-zA-Z]|s(?=[A-Z]|$|[^a-zA-Z]))`, "g");
        result = result.replace(regex, acr);
    }
    return result;
}

/**
 * Strip a trailing "Enum" suffix from an enum type name.
 * Matter.js appends "Enum" to most enum names; the old chip-clusters package (≤2024.11.4)
 * KEEPS the suffix in generated class names (e.g. LockStateEnum, AlarmCodeEnum).
 * This function is used only for datatype registry lookup aliases so that attribute
 * type references that omit the suffix (as Matter.js sometimes does internally) can
 * still resolve. Do NOT use it to rename enum classes in generated output.
 */
function stripEnumSuffix(name: string): string {
    return name.endsWith("Enum") ? name.slice(0, -4) : name;
}

/** Convert camelCase enum member name to kPascalCase with acronym preservation. */
function toKName(name: string): string {
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    if (pascal in K_VALUE_OVERRIDES) {
        return "k" + K_VALUE_OVERRIDES[pascal];
    }
    return "k" + toChipName(pascal);
}

/** Convert PascalCase name to camelCase (for attribute/field labels).
 *  If clusterName is provided, checks for cluster-qualified overrides first. */
function toCamelCase(name: string, clusterName?: string): string {
    // Check cluster-qualified override first (e.g., "DraftElectricalMeasurementCluster.RmsVoltage")
    if (clusterName) {
        const qualifiedKey = `${clusterName}.${name}`;
        if (qualifiedKey in FIELD_NAME_OVERRIDES) {
            return FIELD_NAME_OVERRIDES[qualifiedKey];
        }
    }
    // Check per-name overrides (covers chip SDK inconsistencies)
    if (name in FIELD_NAME_OVERRIDES) {
        return FIELD_NAME_OVERRIDES[name];
    }
    const chipName = toChipName(name);
    // If toChipName produced 2+ consecutive uppercase letters at the start,
    // chip SDK keeps the acronym uppercase in field names too.
    // e.g. "ESAType" stays "ESAType" (not "eSAType"), "ACCapacity" → "ACCapacity".
    // Single-uppercase starts (e.g. "SoftwareVersion") still lowercase to "softwareVersion".
    if (/^[A-Z]{2}/.test(chipName)) {
        return chipName;
    }
    return chipName.charAt(0).toLowerCase() + chipName.slice(1);
}

/** Convert a PascalCase name to chip-SDK class name, checking CLASS_NAME_OVERRIDES first.
 *  If clusterName is provided, checks for cluster-qualified overrides ("Cluster.Name") first. */
function toChipClassName(name: string, clusterName?: string): string {
    // Check cluster-qualified override first (e.g., "AdministratorCommissioning.StatusCodeEnum")
    if (clusterName) {
        const qualifiedKey = `${clusterName}.${name}`;
        if (qualifiedKey in CLASS_NAME_OVERRIDES) {
            return CLASS_NAME_OVERRIDES[qualifiedKey];
        }
    }
    // Then check unqualified override
    if (name in CLASS_NAME_OVERRIDES) {
        return CLASS_NAME_OVERRIDES[name];
    }
    return toChipName(name);
}

/** Pad a hex number to 8 hex digits with 0x prefix. */
function hex8(n: number): string {
    return "0x" + n.toString(16).toUpperCase().padStart(8, "0");
}

/** Pad a hex number to 2 hex digits with 0x prefix. */
function hex2(n: number): string {
    return "0x" + n.toString(16).toUpperCase().padStart(2, "0");
}

// ============================================================================
// Type resolution
// ============================================================================

interface PythonType {
    /** The type annotation string (e.g., "uint", "bool", "typing.List[uint]") */
    annotation: string;
    /** The default value string (e.g., "0", "False", 'b""') */
    defaultValue: string;
    /** Whether the default needs field(default_factory=...) */
    needsFactory: boolean;
}

/**
 * Resolve a Matter.js ValueModel to its Python type, taking into account
 * nullable/optional qualifiers, lists, enums, structs, etc.
 */
function resolvePythonType(
    model: ValueModel,
    clusterName: string,
    knownDatatypes: Map<string, { metatype: string; clusterName: string }>,
): PythonType {
    const type = (model as any).type as string | undefined;
    const metatype = model.effectiveMetatype;
    const isNullable = model.effectiveQuality?.nullable === true;
    const isOptional = !model.effectiveConformance?.isMandatory;

    let baseType: PythonType;

    if (type === "list" || metatype === "array") {
        // List type - get the entry type
        const entryModel = model.children?.[0] as ValueModel | undefined;
        let entryType = "uint";
        if (entryModel) {
            // Resolve the base scalar type directly for list entries.
            // CHIP SDK does NOT wrap list element types in Optional/Nullable.
            const entryScalarType = (entryModel as any).type as string | undefined;
            const entryMetatype = entryModel.effectiveMetatype;
            const entryPy = resolveScalarType(entryScalarType, entryMetatype, clusterName, knownDatatypes);
            entryType = entryPy.annotation;
        }
        baseType = {
            annotation: `typing.List[${entryType}]`,
            defaultValue: "field(default_factory=lambda: [])",
            needsFactory: true,
        };
    } else {
        baseType = resolveScalarType(type, metatype, clusterName, knownDatatypes);
    }

    // Apply nullable/optional wrappers
    if (isOptional && isNullable) {
        return {
            annotation: `typing.Union[None, Nullable, ${baseType.annotation}]`,
            defaultValue: "None",
            needsFactory: false,
        };
    } else if (isNullable) {
        return {
            annotation: `typing.Union[Nullable, ${baseType.annotation}]`,
            defaultValue: "NullValue",
            needsFactory: false,
        };
    } else if (isOptional) {
        if (baseType.needsFactory) {
            // Optional list
            return {
                annotation: `typing.Optional[${baseType.annotation}]`,
                defaultValue: "None",
                needsFactory: false,
            };
        }
        return {
            annotation: `typing.Optional[${baseType.annotation}]`,
            defaultValue: "None",
            needsFactory: false,
        };
    }

    return baseType;
}

/** Resolve a scalar (non-list, non-nullable/optional wrapper) type. */
function resolveScalarType(
    type: string | undefined,
    metatype: string | undefined,
    clusterName: string,
    knownDatatypes: Map<string, { metatype: string; clusterName: string }>,
): PythonType {
    if (!type) {
        // No explicit type — fall back to metatype if available
        switch (metatype) {
            case "boolean":
                return { annotation: "bool", defaultValue: "False", needsFactory: false };
            case "string":
                return { annotation: "str", defaultValue: '""', needsFactory: false };
            case "bytes":
                return { annotation: "bytes", defaultValue: 'b""', needsFactory: false };
            case "float":
                return { annotation: "float32", defaultValue: "0.0", needsFactory: false };
            default:
                return { annotation: "uint", defaultValue: "0", needsFactory: false };
        }
    }

    // Check if it's a reference to a known datatype (enum, bitmap, struct)
    // Could be "EnumName" (local) or "OtherCluster.EnumName" (cross-cluster)
    if (type.includes(".")) {
        // Cross-cluster reference
        const [otherCluster, dtName] = type.split(".");
        const key = `${otherCluster}.${dtName}`;
        const info = knownDatatypes.get(key);
        if (info) {
            const qualifiedName = `${otherCluster}.${getCategoryForMetatype(info.metatype)}.${toChipClassName(dtName, otherCluster)}`;
            return typeForCategory(info.metatype, qualifiedName);
        }
        // Fallback - assume enum
        return { annotation: `${otherCluster}.Enums.${toChipClassName(dtName, otherCluster)}`, defaultValue: "0", needsFactory: false };
    }

    // Check if it's a local datatype reference
    const localInfo = knownDatatypes.get(`${clusterName}.${type}`);
    if (localInfo) {
        const qualifiedName = `${clusterName}.${getCategoryForMetatype(localInfo.metatype)}.${toChipClassName(type, clusterName)}`;
        return typeForCategory(localInfo.metatype, qualifiedName);
    }

    // Check global datatypes
    const globalInfo = knownDatatypes.get(`Globals.${type}`);
    if (globalInfo) {
        const qualifiedName = `Globals.${getCategoryForMetatype(globalInfo.metatype)}.${toChipClassName(type, "Globals")}`;
        return typeForCategory(globalInfo.metatype, qualifiedName);
    }

    // Primitive type mapping
    switch (metatype) {
        case "boolean":
            return { annotation: "bool", defaultValue: "False", needsFactory: false };
        case "string":
            return { annotation: "str", defaultValue: '""', needsFactory: false };
        case "bytes":
            return { annotation: "bytes", defaultValue: 'b""', needsFactory: false };
        case "float":
            if (type === "single") {
                return { annotation: "float32", defaultValue: "0.0", needsFactory: false };
            }
            return { annotation: "float", defaultValue: "0.0", needsFactory: false };
        case "integer":
            if (type.startsWith("int")) {
                return { annotation: "int", defaultValue: "0", needsFactory: false };
            }
            return { annotation: "uint", defaultValue: "0", needsFactory: false };
        default:
            // For base primitive types by name
            return resolvePrimitiveByName(type);
    }
}

function resolvePrimitiveByName(type: string): PythonType {
    switch (type) {
        case "bool":
            return { annotation: "bool", defaultValue: "False", needsFactory: false };
        case "string":
        case "locationdesc":
            return { annotation: "str", defaultValue: '""', needsFactory: false };
        case "octstr":
        case "hwadr":
        case "ipv4adr":
        case "ipv6adr":
        case "ipv6pre":
        case "ipadr":
            return { annotation: "bytes", defaultValue: 'b""', needsFactory: false };
        case "single":
            return { annotation: "float32", defaultValue: "0.0", needsFactory: false };
        case "double":
            return { annotation: "float", defaultValue: "0.0", needsFactory: false };
        default:
            // Assume unsigned integer (uint8, uint16, uint32, uint64, etc.)
            return { annotation: "uint", defaultValue: "0", needsFactory: false };
    }
}

function getCategoryForMetatype(metatype: string): string {
    switch (metatype) {
        case "enum": return "Enums";
        case "bitmap": return "Bitmaps";
        case "object": return "Structs";
        default: return "Enums";
    }
}

function typeForCategory(metatype: string, qualifiedName: string): PythonType {
    switch (metatype) {
        case "enum":
            return { annotation: qualifiedName, defaultValue: "0", needsFactory: false };
        case "bitmap":
            return { annotation: qualifiedName, defaultValue: "0", needsFactory: false };
        case "object":
            return { annotation: qualifiedName, defaultValue: `field(default_factory=lambda: ${qualifiedName}())`, needsFactory: true };
        default:
            return { annotation: qualifiedName, defaultValue: "0", needsFactory: false };
    }
}

// ============================================================================
// Cluster inheritance resolution
// ============================================================================

/**
 * For derived clusters (those with `.type`), collect children from the base cluster
 * that are not already overridden locally. The chip-clusters package duplicates all
 * inherited members into derived clusters, so we must do the same.
 */
function resolveClusterChildren(cluster: ClusterModel): {
    datatypes: ValueModel[];
    commands: CommandModel[];
    attributes: ValueModel[];
    events: EventModel[];
} {
    // Collect local children first
    const localDatatypeNames = new Set(
        cluster.children.filter(c => c.tag === "datatype").map(c => c.name),
    );
    const localCommandNames = new Set(
        cluster.children.filter(c => c.tag === "command").map(c => c.name),
    );
    const localAttrNames = new Set(
        cluster.children.filter(c => c.tag === "attribute").map(c => c.name),
    );
    const localEventNames = new Set(
        cluster.children.filter(c => c.tag === "event").map(c => c.name),
    );

    const datatypes = [...cluster.children.filter(c => c.tag === "datatype")] as ValueModel[];
    const commands: CommandModel[] = [...cluster.children.filter(c => c.tag === "command")] as CommandModel[];
    const attributes = [...cluster.children.filter(c => c.tag === "attribute")] as ValueModel[];
    const events: EventModel[] = [...cluster.children.filter(c => c.tag === "event")] as EventModel[];

    // If cluster derives from a base, merge in missing children from the base
    if (cluster.type) {
        const baseCluster = Matter.clusters.find(c => c.name === cluster.type);
        if (baseCluster) {
            for (const child of baseCluster.children) {
                switch (child.tag) {
                    case "datatype":
                        if (!localDatatypeNames.has(child.name)) {
                            datatypes.push(child);
                        }
                        break;
                    case "command":
                        if (!localCommandNames.has(child.name)) {
                            commands.push(child);
                        } else {
                            // Local override exists but may be missing properties (e.g., direction).
                            // Replace it with the base version to get full metadata.
                            const idx = commands.findIndex(c => c.name === child.name);
                            if (idx >= 0 && commands[idx].direction === undefined) {
                                commands[idx] = child;
                            }
                        }
                        break;
                    case "attribute":
                        if (!localAttrNames.has(child.name)) {
                            attributes.push(child);
                        } else {
                            // Local override exists but may be an empty stub (no type/children).
                            // Replace it with the base version to get full type info.
                            const idx = attributes.findIndex(c => c.name === child.name);
                            if (idx >= 0 && !(attributes[idx] as any).type && (child as any).type) {
                                attributes[idx] = child;
                            }
                        }
                        break;
                    case "event":
                        if (!localEventNames.has(child.name)) {
                            events.push(child);
                        }
                        break;
                }
            }
        }
    }

    return { datatypes, commands, attributes, events };
}

// ============================================================================
// Build the global datatype registry
// ============================================================================

function buildDatatypeRegistry(): Map<string, { metatype: string; clusterName: string }> {
    const registry = new Map<string, { metatype: string; clusterName: string }>();

    // Global datatypes
    for (const dt of Matter.children.filter(c => c.tag === "datatype")) {
        const vm = dt as ValueModel;
        const metatype = vm.effectiveMetatype;
        if (metatype === "enum" || metatype === "bitmap" || metatype === "object") {
            registry.set(`Globals.${dt.name}`, { metatype, clusterName: "Globals" });
            if (dt.name.endsWith("Enum") && metatype === "enum") {
                registry.set(`Globals.${stripEnumSuffix(dt.name)}`, { metatype, clusterName: "Globals" });
            }
        }
    }

    // Per-cluster datatypes (including inherited ones from base clusters)
    for (const cluster of Matter.clusters) {
        if (cluster.id === undefined) continue;
        const { datatypes } = resolveClusterChildren(cluster);
        for (const dt of datatypes) {
            const metatype = dt.effectiveMetatype;
            if (metatype === "enum" || metatype === "bitmap" || metatype === "object") {
                registry.set(`${cluster.name}.${dt.name}`, { metatype, clusterName: cluster.name });
                if (dt.name.endsWith("Enum") && metatype === "enum") {
                    registry.set(`${cluster.name}.${stripEnumSuffix(dt.name)}`, { metatype, clusterName: cluster.name });
                }
            }
        }
    }

    return registry;
}

// ============================================================================
// Code generation helpers
// ============================================================================

class PythonWriter {
    private lines: string[] = [];
    private indent = 0;

    pushIndent(): void { this.indent++; }
    popIndent(): void { this.indent--; }

    line(text = ""): void {
        if (text === "") {
            this.lines.push("");
        } else {
            this.lines.push("    ".repeat(this.indent) + text);
        }
    }

    blankLine(): void {
        this.lines.push("");
    }

    toString(): string {
        return this.lines.join("\n") + "\n";
    }
}

// ============================================================================
// Cluster file generation
// ============================================================================

interface ClusterGenResult {
    fileName: string;
    className: string;
    content: string;
    crossClusterImports: Set<string>;
}

function generateClusterFile(
    cluster: ClusterModel,
    datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
): ClusterGenResult {
    const w = new PythonWriter();
    const clusterName = cluster.name;
    const clusterId = cluster.id!;
    const crossClusterImports = new Set<string>();

    // Resolve all children including inherited ones from base clusters
    const resolved = resolveClusterChildren(cluster);

    // Collect datatypes
    const enums: ValueModel[] = [];
    const bitmaps: ValueModel[] = [];
    const structs: ValueModel[] = [];
    for (const dt of resolved.datatypes) {
        switch (dt.effectiveMetatype) {
            case "enum": enums.push(dt); break;
            case "bitmap": bitmaps.push(dt); break;
            case "object": structs.push(dt); break;
        }
    }

    // Collect Feature bitmap from FeatureMap attribute
    const features = (cluster as any).features || [];

    // Collect commands (from resolved, which includes inherited)
    const requestCommands = resolved.commands.filter(c => c.direction === "request");
    const responseCommands = resolved.commands.filter(c => c.direction === "response");
    const allCommands = [...requestCommands, ...responseCommands];

    // Collect attributes (excluding global ones that we add ourselves, deduplicating by id)
    // Sort by attribute ID to match CHIP SDK ordering.
    const globalAttrIds = new Set([65528, 65529, 65530, 65531, 65532, 65533]);
    const seenAttrIds = new Set<number>();
    const clusterSpecificAttrs = resolved.attributes.filter(c => {
        if (c.id === undefined || globalAttrIds.has(c.id)) return false;
        if (seenAttrIds.has(c.id)) return false;
        seenAttrIds.add(c.id);
        return true;
    }).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    // Collect events (from resolved, which includes inherited)
    const events = resolved.events;

    // Helper to resolve type and track cross-cluster imports
    function resolveType(model: ValueModel): PythonType {
        const result = resolvePythonType(model, clusterName, datatypeRegistry);
        // Check for cross-cluster references in the annotation
        trackCrossClusterImport(result.annotation);
        return result;
    }

    function trackCrossClusterImport(annotation: string) {
        // Match patterns like "OtherCluster.Enums.SomeName" or "OtherCluster.Structs.SomeName"
        const match = annotation.match(/^(\w+)\.(?:Enums|Structs|Bitmaps)\./);
        if (match && match[1] !== clusterName) {
            crossClusterImports.add(match[1]);
        }
        // Also check inside typing wrappers
        const innerMatch = annotation.match(/(?:typing\.(?:List|Optional|Union)\[.*?)(\w+)\.(?:Enums|Structs|Bitmaps)\./g);
        if (innerMatch) {
            for (const m of innerMatch) {
                const nameMatch = m.match(/(\w+)\.(?:Enums|Structs|Bitmaps)\./);
                if (nameMatch && nameMatch[1] !== clusterName) {
                    crossClusterImports.add(nameMatch[1]);
                }
            }
        }
    }

    // ---- Header / imports ----
    w.line(`"""${clusterName} cluster definition (auto-generated, DO NOT edit)."""`);
    w.blankLine();
    w.line("from __future__ import annotations");
    w.blankLine();
    w.line("import typing");
    w.line("from dataclasses import dataclass, field");
    w.line("from enum import IntFlag");
    w.blankLine();
    w.line("from ... import ChipUtility");
    w.line("from ...clusters.enum import MatterIntEnum");
    w.line("from ...tlv import float32, uint");
    w.line("from ..ClusterObjects import (Cluster, ClusterAttributeDescriptor, ClusterCommand, ClusterEvent, ClusterObject,");
    w.line("                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)");
    w.line("from ..Types import Nullable, NullValue");

    // We'll add cross-cluster imports after generating the body
    // (placeholder — will be inserted later)
    const importInsertionPoint = "# CROSS_CLUSTER_IMPORTS_PLACEHOLDER";
    w.line(importInsertionPoint);
    w.blankLine();

    // ---- Cluster class ----
    w.blankLine();
    w.line("@dataclass");
    w.line(`class ${clusterName}(Cluster):`);
    w.pushIndent();
    w.line(`id: typing.ClassVar[int] = ${hex8(clusterId)}`);
    w.blankLine();

    // Descriptor with all attribute fields
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    // Cluster-specific attributes
    for (const attr of clusterSpecificAttrs) {
        const pyType = resolveType(attr);
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(attr.name, clusterName)}", Tag=${hex8(attr.id!)}, Type=${pyType.annotation}),`);
    }
    // Global attributes (always present)
    w.line(`ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),`);
    w.line(`ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),`);
    w.line(`ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),`);

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Top-level attribute fields
    for (const attr of clusterSpecificAttrs) {
        const pyType = resolveType(attr);
        const label = toCamelCase(attr.name, clusterName);
        if (pyType.needsFactory) {
            w.line(`${label}: ${pyType.annotation} = ${pyType.defaultValue}`);
        } else {
            w.line(`${label}: ${pyType.annotation} = ${pyType.defaultValue}`);
        }
    }
    // Global attribute fields
    w.line(`generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])`);
    w.line(`acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])`);
    w.line(`eventList: typing.List[uint] = field(default_factory=lambda: [])`);
    w.line(`attributeList: typing.List[uint] = field(default_factory=lambda: [])`);
    w.line(`featureMap: uint = 0`);
    w.line(`clusterRevision: uint = 0`);

    // ---- Enums section ----
    if (enums.length > 0) {
        w.blankLine();
        w.line("class Enums:");
        w.pushIndent();
        for (let i = 0; i < enums.length; i++) {
            generateEnum(w, enums[i], clusterName);
            if (i < enums.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Bitmaps section ----
    const extraBitmaps = EXTRA_BITMAPS[clusterName] || [];
    const hasBitmaps = bitmaps.length > 0 || features.length > 0 || extraBitmaps.length > 0;
    if (hasBitmaps) {
        w.blankLine();
        w.line("class Bitmaps:");
        w.pushIndent();

        // Feature bitmap
        if (features.length > 0) {
            w.line("class Feature(IntFlag):");
            w.pushIndent();
            for (const f of features) {
                const bitIndex = Number(f.constraint?.value ?? f.constraint?.definition ?? 0);
                const flagValue = 1 << bitIndex;
                w.line(`${toKName(f.title || f.name)} = 0x${flagValue.toString(16).toUpperCase()}`);
            }
            w.popIndent();
            if (bitmaps.length > 0) {
                w.blankLine();
            }
        }

        for (let i = 0; i < bitmaps.length; i++) {
            generateBitmap(w, bitmaps[i]);
            if (i < bitmaps.length - 1 || extraBitmaps.length > 0) {
                w.blankLine();
            }
        }

        // Inject extra bitmaps not in the Matter.js model
        for (let i = 0; i < extraBitmaps.length; i++) {
            const eb = extraBitmaps[i];
            w.line(`class ${eb.name}(IntFlag):`);
            w.pushIndent();
            for (const m of eb.members) {
                w.line(`${m.kName} = 0x${m.value.toString(16).toUpperCase()}`);
            }
            w.popIndent();
            if (i < extraBitmaps.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Structs section ----
    if (structs.length > 0) {
        w.blankLine();
        w.line("class Structs:");
        w.pushIndent();
        for (let i = 0; i < structs.length; i++) {
            generateStruct(w, structs[i], clusterName, datatypeRegistry, resolveType);
            if (i < structs.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Commands section ----
    if (allCommands.length > 0) {
        w.blankLine();
        w.line("class Commands:");
        w.pushIndent();
        for (let i = 0; i < allCommands.length; i++) {
            generateCommand(w, allCommands[i], clusterName, clusterId, datatypeRegistry, resolveType, responseCommands);
            if (i < allCommands.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    // ---- Attributes section ----
    w.blankLine();
    w.line("class Attributes:");
    w.pushIndent();

    for (let i = 0; i < clusterSpecificAttrs.length; i++) {
        generateAttribute(w, clusterSpecificAttrs[i] as AttributeModel, clusterName, clusterId, datatypeRegistry, resolveType);
        if (i < clusterSpecificAttrs.length - 1) {
            w.blankLine();
        }
    }

    // Global attributes
    if (clusterSpecificAttrs.length > 0) {
        w.blankLine();
    }
    generateGlobalAttribute(w, "GeneratedCommandList", 0xFFF8, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "AcceptedCommandList", 0xFFF9, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "EventList", 0xFFFA, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "AttributeList", 0xFFFB, "typing.List[uint]", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "FeatureMap", 0xFFFC, "uint", clusterId);
    w.blankLine();
    generateGlobalAttribute(w, "ClusterRevision", 0xFFFD, "uint", clusterId);

    w.popIndent();

    // ---- Events section ----
    if (events.length > 0) {
        w.blankLine();
        w.line("class Events:");
        w.pushIndent();
        for (let i = 0; i < events.length; i++) {
            generateEvent(w, events[i], clusterName, clusterId, datatypeRegistry, resolveType);
            if (i < events.length - 1) {
                w.blankLine();
            }
        }
        w.popIndent();
    }

    w.popIndent(); // end of cluster class

    // Now resolve cross-cluster imports and insert them
    let content = w.toString();
    if (crossClusterImports.size > 0) {
        const importLines = Array.from(crossClusterImports).sort().map(
            name => `from .${name} import ${name}`
        ).join("\n");
        content = content.replace(importInsertionPoint, importLines);
    } else {
        content = content.replace(importInsertionPoint + "\n", "");
    }

    return {
        fileName: `${clusterName}.py`,
        className: clusterName,
        content,
        crossClusterImports,
    };
}

// ============================================================================
// Enum generation
// ============================================================================

function generateEnum(w: PythonWriter, model: ValueModel, clusterName?: string): void {
    w.line(`class ${toChipClassName(model.name, clusterName)}(MatterIntEnum):`);
    w.pushIndent();

    const members = model.children || [];
    let maxValue = -1;
    const usedValues = new Set<number>();

    for (const m of members) {
        const value = m.id ?? 0;
        usedValues.add(value);
        if (value > maxValue) maxValue = value;
        w.line(`${toKName(m.name)} = ${hex2(value)}`);
    }

    // Inject extra members from EXTRA_ENUM_MEMBERS (for CHIP SDK compat)
    const extraKey = clusterName ? `${clusterName}.${model.name}` : undefined;
    const extras = extraKey ? EXTRA_ENUM_MEMBERS[extraKey] : undefined;
    if (extras) {
        for (const extra of extras) {
            if (!usedValues.has(extra.value)) {
                usedValues.add(extra.value);
                if (extra.value > maxValue) maxValue = extra.value;
                w.line(`${extra.kName} = ${hex2(extra.value)}`);
            }
        }
    }

    // Find the kUnknownEnumValue - first unused value after the last defined value
    let unknownValue = maxValue + 1;
    while (usedValues.has(unknownValue)) unknownValue++;

    w.line("# All received enum values that are not listed above will be mapped");
    w.line("# to kUnknownEnumValue. This is a helper enum value that should only");
    w.line("# be used by code to process how it handles receiving an unknown");
    w.line("# enum value. This specific value should never be transmitted.");
    w.line(`kUnknownEnumValue = ${unknownValue}`);

    w.popIndent();
}

// ============================================================================
// Bitmap generation
// ============================================================================

function generateBitmap(w: PythonWriter, model: ValueModel): void {
    w.line(`class ${toChipClassName(model.name)}(IntFlag):`);
    w.pushIndent();

    const members = model.children || [];
    if (members.length === 0) {
        w.line("pass");
    } else {
        for (const m of members) {
            const constraint = (m as ValueModel).constraint;
            let flagValue: number;
            if (constraint && constraint.min !== undefined && constraint.max !== undefined) {
                // Multi-bit field (range constraint): compute mask covering all bits
                let mask = 0;
                for (let bit = Number(constraint.min); bit <= Number(constraint.max); bit++) {
                    mask |= 1 << bit;
                }
                flagValue = mask;
            } else {
                const bitIndex = Number(constraint?.value ?? constraint?.definition ?? 0);
                flagValue = 1 << bitIndex;
            }
            w.line(`${toKName(m.name)} = 0x${flagValue.toString(16).toUpperCase()}`);
        }
    }

    w.popIndent();
}

// ============================================================================
// Struct generation
// ============================================================================

function generateStruct(
    w: PythonWriter,
    model: ValueModel,
    _clusterName: string,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
): void {
    w.line("@dataclass");
    w.line(`class ${toChipClassName(model.name)}(ClusterObject):`);
    w.pushIndent();

    // Descriptor
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    // Use model.members (not model.children) so that structs that inherit their
    // fields from a base type (e.g. ModeOptionStruct in Mode clusters) include
    // the inherited fields. For structs with direct children, members == children.
    const members = [...(model.members as Iterable<any>)];
    for (const m of members) {
        const vm = m as ValueModel;
        const pyType = resolveType(vm);
        const tag = m.id ?? 0;
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(m.name)}", Tag=${tag}, Type=${pyType.annotation}),`);
    }

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Fields
    for (const m of members) {
        const vm = m as ValueModel;
        const pyType = resolveType(vm);
        const label = toCamelCase(m.name);
        w.line(`${label}: ${pyType.annotation} = ${pyType.defaultValue}`);
    }

    // No need for pass - the descriptor classproperty is always present

    w.popIndent();
}

// ============================================================================
// Command generation
// ============================================================================

function generateCommand(
    w: PythonWriter,
    model: CommandModel,
    _clusterName: string,
    clusterId: number,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
    _responseCommands: CommandModel[],
): void {
    const isClient = model.direction === "request";
    const commandId = model.id ?? 0;

    // Determine response_type
    let responseType = "None";
    if (isClient && model.response && model.response !== "status") {
        responseType = `'${toChipClassName(model.response)}'`;
    }

    w.line("@dataclass");
    w.line(`class ${toChipClassName(model.name)}(ClusterCommand):`);
    w.pushIndent();

    w.line(`cluster_id: typing.ClassVar[int] = ${hex8(clusterId)}`);
    w.line(`command_id: typing.ClassVar[int] = ${hex8(commandId)}`);
    w.line(`is_client: typing.ClassVar[bool] = ${isClient ? "True" : "False"}`);
    w.line(`response_type: typing.ClassVar[typing.Optional[str]] = ${responseType}`);
    w.blankLine();

    if ((model.access as any)?.timed === true) {
        w.line("@ChipUtility.classproperty");
        w.line("def must_use_timed_invoke(cls) -> bool:");
        w.pushIndent();
        w.line("return True");
        w.popIndent();
        w.blankLine();
    }

    // Descriptor - use model.members (not model.children) so that commands that inherit
    // their fields from a base command include the inherited fields (like structs do).
    const fields = [...(model.members as Iterable<any>)];
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(f.name)}", Tag=${f.id ?? 0}, Type=${pyType.annotation}),`);
    }

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Fields
    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`${toCamelCase(f.name)}: ${pyType.annotation} = ${pyType.defaultValue}`);
    }

    // No need for pass - the descriptor method is already present

    w.popIndent();
}

// ============================================================================
// Attribute generation
// ============================================================================

function generateAttribute(
    w: PythonWriter,
    model: AttributeModel,
    clusterName: string,
    clusterId: number,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
): void {
    const attrId = model.id ?? 0;
    const pyType = resolveType(model);
    // Attribute class names must be PascalCase (chip SDK convention).
    // Standard clusters already have PascalCase model names; custom clusters use
    // camelCase TypeScript field names that need to be capitalized.
    const attrClassName = toChipClassName(model.name.charAt(0).toUpperCase() + model.name.slice(1), clusterName);

    w.line("@dataclass");
    w.line(`class ${attrClassName}(ClusterAttributeDescriptor):`);
    w.pushIndent();

    w.line("@ChipUtility.classproperty");
    w.line("def cluster_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(clusterId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(attrId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_type(cls) -> ClusterObjectFieldDescriptor:");
    w.pushIndent();
    w.line(`return ClusterObjectFieldDescriptor(Type=${pyType.annotation})`);
    w.popIndent();
    w.blankLine();

    w.line(`value: ${pyType.annotation} = ${pyType.defaultValue}`);

    w.popIndent();
}

function generateGlobalAttribute(
    w: PythonWriter,
    name: string,
    attrId: number,
    typeStr: string,
    clusterId: number,
): void {
    const isListType = typeStr.startsWith("typing.List");
    const defaultValue = isListType ? "field(default_factory=lambda: [])" : "0";

    w.line("@dataclass");
    w.line(`class ${name}(ClusterAttributeDescriptor):`);
    w.pushIndent();

    w.line("@ChipUtility.classproperty");
    w.line("def cluster_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(clusterId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(attrId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def attribute_type(cls) -> ClusterObjectFieldDescriptor:");
    w.pushIndent();
    w.line(`return ClusterObjectFieldDescriptor(Type=${typeStr})`);
    w.popIndent();
    w.blankLine();

    w.line(`value: ${typeStr} = ${defaultValue}`);

    w.popIndent();
}

// ============================================================================
// Event generation
// ============================================================================

function generateEvent(
    w: PythonWriter,
    model: EventModel,
    _clusterName: string,
    clusterId: number,
    _datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
    resolveType: (m: ValueModel) => PythonType,
): void {
    const eventId = model.id ?? 0;

    w.line("@dataclass");
    w.line(`class ${toChipClassName(model.name)}(ClusterEvent):`);
    w.pushIndent();

    w.line("@ChipUtility.classproperty");
    w.line("def cluster_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(clusterId)}`);
    w.popIndent();
    w.blankLine();

    w.line("@ChipUtility.classproperty");
    w.line("def event_id(cls) -> int:");
    w.pushIndent();
    w.line(`return ${hex8(eventId)}`);
    w.popIndent();
    w.blankLine();

    // Descriptor - use model.members (not model.children) so that events that inherit
    // their fields from a base event include the inherited fields.
    const fields = [...(model.members as Iterable<any>)];
    w.line("@ChipUtility.classproperty");
    w.line("def descriptor(cls) -> ClusterObjectDescriptor:");
    w.pushIndent();
    w.line("return ClusterObjectDescriptor(");
    w.pushIndent();
    w.line("Fields=[");
    w.pushIndent();

    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`ClusterObjectFieldDescriptor(Label="${toCamelCase(f.name)}", Tag=${f.id ?? 0}, Type=${pyType.annotation}),`);
    }

    w.popIndent();
    w.line("])");
    w.popIndent();
    w.popIndent();
    w.blankLine();

    // Fields
    for (const f of fields) {
        const vm = f as ValueModel;
        const pyType = resolveType(vm);
        w.line(`${toCamelCase(f.name)}: ${pyType.annotation} = ${pyType.defaultValue}`);
    }

    // No need for pass - cluster_id, event_id, and descriptor classpropertys are always present

    w.popIndent();
}

// ============================================================================
// Globals generation (non-Cluster class for global types)
// ============================================================================

function generateGlobalsFile(
    datatypeRegistry: Map<string, { metatype: string; clusterName: string }>,
): string {
    const w = new PythonWriter();

    w.line('"""Global datatypes shared across clusters (auto-generated, DO NOT edit)."""');
    w.blankLine();
    w.line("from __future__ import annotations");
    w.blankLine();
    w.line("import typing");
    w.line("from dataclasses import dataclass, field");
    w.line("from enum import IntFlag");
    w.blankLine();
    w.line("from ... import ChipUtility");
    w.line("from ...clusters.enum import MatterIntEnum");
    w.line("from ...tlv import float32, uint");
    w.line("from ..ClusterObjects import (ClusterObject,");
    w.line("                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)");
    w.line("from ..Types import Nullable, NullValue");
    w.blankLine();
    w.blankLine();

    w.line("class Globals:");
    w.pushIndent();

    // Global enums
    const globalEnums = Matter.children.filter(c => c.tag === "datatype" && (c as ValueModel).effectiveMetatype === "enum");
    if (globalEnums.length > 0) {
        w.line("class Enums:");
        w.pushIndent();
        for (const e of globalEnums) {
            generateEnum(w, e as ValueModel);
            w.blankLine();
        }
        w.popIndent();
    }

    // Global bitmaps
    const globalBitmaps = Matter.children.filter(c => c.tag === "datatype" && (c as ValueModel).effectiveMetatype === "bitmap");
    if (globalBitmaps.length > 0) {
        w.blankLine();
        w.line("class Bitmaps:");
        w.pushIndent();
        for (const b of globalBitmaps) {
            generateBitmap(w, b as ValueModel);
            w.blankLine();
        }
        w.popIndent();
    }

    // Global structs
    const globalStructs = Matter.children.filter(c => c.tag === "datatype" && (c as ValueModel).effectiveMetatype === "object");
    if (globalStructs.length > 0) {
        w.blankLine();
        w.line("class Structs:");
        w.pushIndent();
        for (const s of globalStructs) {
            const resolveType = (m: ValueModel) => resolvePythonType(m, "Globals", datatypeRegistry);
            generateStruct(w, s as ValueModel, "Globals", datatypeRegistry, resolveType);
            w.blankLine();
        }
        w.popIndent();
    }

    w.popIndent();

    return w.toString();
}

// ============================================================================
// Objects.py re-export file
// ============================================================================

function generateObjectsReexport(_clusterNames: string[]): string {
    const w = new PythonWriter();

    w.line('"""');
    w.line(" Cluster object definitions.");
    w.line(" This file is auto-generated, DO NOT edit.");
    w.line(' Users can import chip.clusters.Objects to get all cluster definitions.');
    w.line('"""');
    w.blankLine();
    w.line("# Re-export all cluster classes from per-cluster files");
    w.line("from chip.clusters.cluster_defs import *  # noqa: F401,F403");
    w.blankLine();
    w.line("# Also re-export base classes and primitive types for backward compatibility");
    w.line("from chip.clusters.ClusterObjects import (  # noqa: F401");
    w.line("    Cluster,");
    w.line("    ClusterAttributeDescriptor,");
    w.line("    ClusterCommand,");
    w.line("    ClusterEvent,");
    w.line("    ClusterObject,");
    w.line("    ClusterObjectDescriptor,");
    w.line("    ClusterObjectFieldDescriptor,");
    w.line(")");
    w.line("from chip.clusters.Types import NullValue, Nullable  # noqa: F401");
    w.line("from chip.tlv import float32, uint  # noqa: F401");

    return w.toString();
}

// ============================================================================
// cluster_defs/__init__.py
// ============================================================================

function generateObjectsInit(clusterNames: string[]): string {
    const w = new PythonWriter();

    w.line('"""Auto-generated cluster imports (DO NOT edit)."""');
    w.blankLine();

    for (const name of clusterNames) {
        w.line(`from .${name} import ${name}`);
    }

    w.blankLine();
    w.line("__all__ = [");
    w.pushIndent();
    for (const name of clusterNames) {
        w.line(`"${name}",`);
    }
    w.popIndent();
    w.line("]");
    w.blankLine();

    return w.toString();
}

// ============================================================================
// device_types.py generation
// ============================================================================

function generateDeviceTypes(): string {
    const w = new PythonWriter();

    w.line('"""');
    w.line("Device type definitions.");
    w.blankLine();
    w.line("This file is auto-generated, DO NOT edit.");
    w.line('"""');
    w.blankLine();
    w.line("from __future__ import annotations");
    w.blankLine();
    w.line("from chip.clusters import Objects as all_clusters");
    w.line("from chip.clusters.ClusterObjects import Cluster");
    w.blankLine();

    // Collect cluster names for lookup
    const clustersByName = new Map<string, ClusterModel>();
    for (const c of Matter.clusters) {
        if (c.id !== undefined) clustersByName.set(c.name, c);
    }

    w.line("ALL_TYPES: dict[int, type[DeviceType]] = {}");
    w.blankLine();
    w.blankLine();

    w.line("class DeviceType:");
    w.pushIndent();
    w.line('"""Base class for Matter device types."""');
    w.blankLine();
    w.line("device_type: int = 0");
    w.line("clusters: set[type[Cluster]] = set()");
    w.blankLine();
    w.line("def __init_subclass__(cls, **kwargs: object) -> None:");
    w.pushIndent();
    w.line("super().__init_subclass__(**kwargs)");
    w.line("if cls.device_type != 0:");
    w.pushIndent();
    w.line("ALL_TYPES[cls.device_type] = cls");
    w.popIndent();
    w.popIndent();
    w.popIndent();
    w.blankLine();
    w.blankLine();

    // Generate device type classes
    const deviceTypesList = Matter.deviceTypes.filter(dt => dt.id !== undefined);
    for (let idx = 0; idx < deviceTypesList.length; idx++) {
        const dt = deviceTypesList[idx];
        const name = dt.name;

        // Get required server clusters
        const requirements = dt.children.filter(c =>
            c.tag === "requirement" && (c as any).element === "serverCluster"
        );

        const clusterRefs: string[] = [];
        for (const req of requirements) {
            const clusterName = req.name;
            if (clustersByName.has(clusterName)) {
                clusterRefs.push(`all_clusters.${clusterName}`);
            }
        }

        w.line(`class ${name}(DeviceType):`);
        w.pushIndent();
        w.line(`device_type: int = 0x${dt.id.toString(16).toUpperCase().padStart(4, "0")}`);

        if (clusterRefs.length === 0) {
            w.line("clusters: set[type[Cluster]] = set()");
        } else {
            w.line("clusters: set[type[Cluster]] = {");
            w.pushIndent();
            for (const ref of clusterRefs.sort()) {
                w.line(`${ref},`);
            }
            w.popIndent();
            w.line("}");
        }

        w.popIndent();
        if (idx < deviceTypesList.length - 1) {
            w.blankLine();
            w.blankLine();
        }
    }

    // Append extra device types that exist in the original hand-maintained
    // device_types.py but are not in the Matter.js model.
    const extraDeviceTypes: Array<{ name: string; id: number; clusters: string[] }> = [
        {
            name: "HeatingCoolingUnit",
            id: 0x0300,
            clusters: [
                "all_clusters.Identify",
                "all_clusters.Descriptor",
                "all_clusters.Binding",
                "all_clusters.Groups",
                "all_clusters.ScenesManagement",
                "all_clusters.FanControl",
                "all_clusters.LevelControl",
                "all_clusters.OnOff",
            ],
        },
    ];

    for (const extra of extraDeviceTypes) {
        // Skip if already generated from the Matter.js model
        if (deviceTypesList.some(dt => dt.id === extra.id)) continue;
        w.blankLine();
        w.blankLine();
        w.line(`class ${extra.name}(DeviceType):`);
        w.pushIndent();
        w.line(`device_type: int = 0x${extra.id.toString(16).toUpperCase().padStart(4, "0")}`);
        w.line("clusters: set[type[Cluster]] = {");
        w.pushIndent();
        for (const ref of extra.clusters.sort()) {
            w.line(`${ref},`);
        }
        w.popIndent();
        w.line("}");
        w.popIndent();
    }

    return w.toString();
}

// ============================================================================
// Main
// ============================================================================

// Names of custom cluster classes exported from @matter-server/custom-clusters
const customClusterNames = new Set(Object.keys(CustomClusterClasses));

function main(): void {
    console.log("Building datatype registry...");
    const datatypeRegistry = buildDatatypeRegistry();

    // Ensure output directory exists
    if (!existsSync(objectsDir)) {
        mkdirSync(objectsDir, { recursive: true });
    }

    // Generate Globals file
    console.log("Generating Globals.py...");
    const globalsContent = generateGlobalsFile(datatypeRegistry);
    writeFileSync(join(objectsDir, "Globals.py"), globalsContent);

    // Generate per-cluster files
    const results: ClusterGenResult[] = [];
    const clusters = Matter.clusters.filter(c => c.id !== undefined);

    console.log(`Generating ${clusters.length} cluster files...`);
    for (const cluster of clusters) {
        try {
            const result = generateClusterFile(cluster, datatypeRegistry);
            results.push(result);
            writeFileSync(join(objectsDir, result.fileName), result.content);
        } catch (e) {
            console.error(`Error generating ${cluster.name}:`, e);
        }
    }

    // Generate cluster_defs/__init__.py
    const allNames = ["Globals", ...results.map(r => r.className).sort()];
    const initContent = generateObjectsInit(allNames);
    writeFileSync(join(objectsDir, "__init__.py"), initContent);

    // Generate Objects.py re-export
    const objectsContent = generateObjectsReexport(allNames);
    writeFileSync(join(pythonClientDir, "chip", "clusters", "Objects.py"), objectsContent);

    // Generate device_types.py
    console.log("Generating device_types.py...");
    const deviceTypesContent = generateDeviceTypes();
    writeFileSync(join(pythonClientDir, "matter_server", "client", "models", "device_types.py"), deviceTypesContent);

    // Generate matter_server/common/custom_clusters.py — a single re-export shim over
    // chip/clusters/objects/* that maintains the HA-compatible import path.
    // The actual cluster definitions live in chip/clusters/objects/ (generated above).
    console.log("Generating custom_clusters.py...");

    // Remove legacy custom_clusters/ directory if present (replaced by single file)
    const legacyDir = join(pythonClientDir, "matter_server", "common", "custom_clusters");
    if (existsSync(legacyDir)) {
        rmSync(legacyDir, { recursive: true });
        console.log("  Removed legacy custom_clusters/ directory");
    }

    // Custom clusters from results (only those whose class name is in customClusterNames)
    const customResults = results.filter(r => customClusterNames.has(r.className));
    // Sort by class name for deterministic output
    customResults.sort((a, b) => a.className.localeCompare(b.className));

    const customLines: string[] = [
        '"""Custom (vendor-specific) cluster re-exports (auto-generated, DO NOT edit)."""',
        "",
    ];
    for (const r of customResults) {
        customLines.push(`from chip.clusters.cluster_defs.${r.className} import ${r.className}`);
    }
    customLines.push("");
    customLines.push("ALL_CUSTOM_CLUSTERS: dict = {");
    for (const r of customResults) {
        customLines.push(`    ${r.className}.id: ${r.className},`);
    }
    customLines.push("}");
    customLines.push("");
    customLines.push("__all__ = [");
    customLines.push('    "ALL_CUSTOM_CLUSTERS",');
    for (const r of customResults) {
        customLines.push(`    "${r.className}",`);
    }
    customLines.push("]");
    customLines.push("");

    writeFileSync(
        join(pythonClientDir, "matter_server", "common", "custom_clusters.py"),
        customLines.join("\n"),
    );
    console.log(`  Generated custom_clusters.py with ${customResults.length} cluster re-exports`);

    console.log(`Done! Generated ${results.length} cluster files + Globals + Objects.py + device_types.py + custom_clusters.py`);
}

main();
