/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, Decorator } from "@matter/main";
import {
    Access,
    attribute,
    bool,
    cluster,
    ClusterModel,
    command,
    DatatypeModel,
    enum8,
    event,
    field,
    FieldModel,
    FieldSemantics,
    int16,
    InvalidMetadataError,
    listOf,
    mandatory,
    nullable,
    octstr,
    response,
    Semantics,
    uint8,
    uint16,
    uint32,
    ValueModel,
    writable,
} from "@matter/main/model";

// Occupancy Sensor (0x0107) splits these clusters by feature. The leader endpoint serves configuration
// plus LEADER; each zone is a child Occupancy Sensor endpoint with CHILD.

function enumeration(name: string, base: "enum8" | "enum16", values: Record<string, number>) {
    return new DatatypeModel({
        name,
        type: base,
        children: Object.entries(values).map(([fieldName, id]) => new FieldModel({ name: fieldName, id })),
    });
}

function constraint(definition: string): Decorator.PropertyCollector {
    return Decorator((_target, context) => {
        const model = FieldSemantics.of(context).mutableModel;
        if (!(model instanceof ValueModel)) {
            throw new InvalidMetadataError(`Cannot constrain ${String(context.name)}`);
        }
        model.constraint = definition;
    });
}

/** Spec access RVWM / command access M: a write or invoke requires Manage. */
function setManageAccess(_target: unknown, context: DecoratorContext) {
    const model = FieldSemantics.of(context).mutableModel;
    if (!(model instanceof ValueModel)) {
        throw new InvalidMetadataError(`Cannot set manage access on ${String(context.name)}`);
    }
    model.access = new Access({ ...model.access, writePriv: Access.Privilege.Manage });
}

const manage = Decorator<Decorator.PropertyCollector>(setManageAccess);
const manageCommand = Decorator<Decorator.MethodCollector>(setManageAccess);

/** The extension's ClusterRevision. A local copy keeps the global attribute unchanged. */
function revision(value: number): Decorator.ClassCollector {
    return Decorator((_target, context) => {
        const model = Semantics.of(context).mutableModel;
        if (!(model instanceof ClusterModel)) {
            throw new InvalidMetadataError(`Cannot set the revision of ${model.name}`);
        }
        const current = model.attributes(0xfffd);
        if (current === undefined) {
            throw new InvalidMetadataError(`${model.name} has no ClusterRevision attribute`);
        }
        const owned = current.parent === model ? current : current.clone();
        owned.default = value;
        if (owned.parent !== model) {
            model.children.push(owned);
        }
    });
}

function withFeatures(features: { code: string; bit: number; title: string }[]): Decorator.ClassCollector {
    return Decorator((_target, context) => {
        const model = Semantics.of(context).mutableModel;
        if (!(model instanceof ClusterModel)) {
            throw new InvalidMetadataError(`Cannot add features to ${model.name}`);
        }
        let featureMap = model.featureMap;
        if (featureMap.parent !== model) {
            featureMap = featureMap.clone();
            model.children.push(featureMap);
        }
        for (const feature of features) {
            featureMap.children.push(
                new FieldModel({
                    name: feature.code,
                    title: feature.title,
                    constraint: String(feature.bit),
                    conformance: "O",
                }),
            );
        }
    });
}

const InstallModeEnum = enumeration("InstallModeEnum", "enum8", {
    Unknown: 0,
    SideMount: 1,
    TopMount: 2,
});

const SideInstallEnum = enumeration("SideInstallEnum", "enum8", {
    Unknown: 0,
    Wall: 1,
    LeftCorner: 2,
    RightCorner: 3,
});

const InstallStatusEnum = enumeration("InstallStatusEnum", "enum8", {
    LevelFacingUp: 0,
    LevelTiltedFacingUp: 1,
    LevelReverseTiltedFacingUp: 2,
    SideFacingForward: 3,
    SideReverseFacingForward: 4,
    TopFacingDown: 5,
    TiltedFacingDown: 6,
    ReverseTiltedFacingDown: 7,
    Invalid: 8,
});

const CoordinateReverseEnum = enumeration("CoordinateReverseEnum", "enum8", {
    Disabled: 0,
    Enabled: 1,
    Auto: 2,
});

const DetectionDirectionEnum = enumeration("DetectionDirectionEnum", "enum8", {
    OmniDirectional: 0,
    LeftRight: 1,
});

const ProximityDistanceLevelEnum = enumeration("ProximityDistanceLevelEnum", "enum8", {
    Far: 0,
    Medium: 1,
    Near: 2,
});

const SensitivityEnum = enumeration("SensitivityEnum", "enum8", {
    Low: 0,
    Medium: 1,
    High: 2,
});

const SensingModeEnum = enumeration("SensingModeEnum", "enum8", {
    PIROnly: 0,
    RadarOnly: 1,
    RadarPIR: 2,
});

const ZoneErrorCodeEnum = enumeration("ZoneErrorCodeEnum", "enum8", {
    Success: 0,
    InvalidArgument: 1,
    InvalidState: 2,
    ResourceExhausted: 3,
    Busy: 4,
    DuplicateZoneId: 5,
});

const ZoneTypeEnum = enumeration("ZoneTypeEnum", "enum8", {
    Other: 0x00,
    LivingRoom: 0x01,
    Balcony: 0x02,
    Bedroom: 0x03,
    DiningRoom: 0x04,
    Bathroom: 0x05,
    Kitchen: 0x06,
    MeetingRoom: 0x07,
    Office: 0x08,
    Bathroom2: 0x09,
    LivingRoomTVzone: 0x11,
    LivingRoomSofazone: 0x12,
    LivingRoomFitnesszone: 0x13,
    LivingRoomEntertainmentzone: 0x14,
    LivingRoomReadingzone: 0x15,
    LivingRoomStoragezone: 0x16,
    BalconyClothesDryingzone: 0x21,
    BalconyGreenPlantszone: 0x22,
    BalconyLeisurezone: 0x23,
    BedroomDressingTable: 0x31,
    BedroomCloakroom: 0x32,
    BedroomDesk: 0x33,
    BedroomRecliner: 0x34,
    BedroomWardrobe: 0x35,
    BedroomBed: 0x36,
    DiningRoomDiningTable: 0x41,
    DiningRoomRefrigerator: 0x42,
    DiningRoomWineCabinet: 0x43,
    BathroomShowerzone: 0x51,
    BathroomBathtubzone: 0x52,
    BathroomToilet: 0x53,
    KitchenSink: 0x61,
    KitchenCookingzone: 0x62,
    MeetingRoomConferenceTable: 0x71,
    MeetingRoomNegotiationzone: 0x72,
    OfficeWorkstation: 0x81,
    OfficeRestzone: 0x82,
    Staircase: 0x91,
    Corridor: 0x92,
    Intersection: 0x93,
});

const MotionStateEnum = enumeration("MotionStateEnum", "enum8", {
    Enter: 0x00,
    Leave: 0x01,
    LeftIn: 0x02,
    RightOut: 0x03,
    RightIn: 0x04,
    LeftOut: 0x05,
    Approach: 0x06,
    Depart: 0x07,
});

const WalkingStateEnum = enumeration("WalkingStateEnum", "enum8", { None: 0, Present: 1 });
const SittingStateEnum = enumeration("SittingStateEnum", "enum8", { None: 0, Present: 1 });
const StandingStateEnum = enumeration("StandingStateEnum", "enum8", { None: 0, Present: 1 });
const LyingStateEnum = enumeration("LyingStateEnum", "enum8", { None: 0, Present: 1 });
const LargeMotionStateEnum = enumeration("LargeMotionStateEnum", "enum8", {
    None: 0,
    Action1: 1,
    Action2: 2,
});
const FallStateEnum = enumeration("FallStateEnum", "enum8", {
    Cleared: 0,
    Fall: 1,
    SuspectedFall: 2,
});
const ActivityStateEnum = enumeration("ActivityStateEnum", "enum8", {
    Unknown: 0,
    Active: 1,
    Still: 2,
});

const TargetTypeEnum = enumeration("TargetTypeEnum", "enum8", {
    Person: 0x00,
    NotPerson: 0x01,
    Fan: 0x02,
    Pet: 0x03,
    Curtain: 0x04,
    GreenPlants: 0x05,
    Sweeper: 0x06,
    AirPurifier: 0x07,
    Child: 0x08,
    Unknown: 0xfe,
    Invalid: 0xff,
});

const PostureEnum = enumeration("PostureEnum", "enum8", {
    Walk: 0x00,
    Sit: 0x01,
    Stand: 0x02,
    Lie: 0x03,
    Fall: 0x04,
    Undefined: 0xfe,
    Invalid: 0xff,
});

/** 40-byte cell bitmask. Bit n (LSB = bit 0) is cell n, numbered 1..320. */
class AqaraZoneInfoStruct {
    @field(0x0, uint8, mandatory)
    zoneId!: number;

    @field(0x1, ZoneTypeEnum, mandatory)
    zoneType!: number;

    @constraint("40")
    @field(0x2, octstr, mandatory)
    zoneBitmask!: Bytes;

    @field(0x3, bool, mandatory)
    zoneProximityDetectionEnable!: boolean;
}

class AqaraZoneRequest {
    @field(0x0, AqaraZoneInfoStruct, mandatory)
    zone!: AqaraZoneInfoStruct;
}

class AqaraZoneIdRequest {
    @field(0x0, uint8, mandatory)
    zoneId!: number;
}

class AqaraZonesRequest {
    /** At most 20 entries so the command fits in one IPv6 MTU. An empty list removes every zone. */
    @constraint("max 20")
    @field(0x0, listOf(AqaraZoneInfoStruct), mandatory)
    zones!: AqaraZoneInfoStruct[];
}

class AqaraZoneResponse {
    @field(0x0, ZoneErrorCodeEnum, mandatory)
    errorCode!: number;
}

/**
 * Seconds, 0 to 600.
 * Non-zero starts or restarts the reporting window. Zero stops the current window and leaves every other sensing state as it is.
 */
class AqaraEdgeTimeoutRequest {
    @constraint("0 to 600")
    @field(0x0, uint16, mandatory)
    timeout!: number;
}

/**
 * Seconds, 0 to 3600.
 * Non-zero starts or restarts location reporting. Zero stops Location events for the current window and does not reset detection.
 */
class AqaraLocationTimeoutRequest {
    @constraint("0 to 3600")
    @field(0x0, uint16, mandatory)
    timeout!: number;
}

class AqaraAutoInterferenceSourceRecognitionEvent {
    @constraint("40")
    @field(0x0, octstr, nullable, mandatory)
    autoInterferenceSourceData!: Bytes | null;
}

class AqaraAutoEdgeRecognitionEvent {
    @constraint("40")
    @field(0x0, octstr, mandatory)
    autoEdgeRecognitionData!: Bytes;
}

class AqaraAiEntryExitRegionEvent {
    @constraint("40")
    @field(0x0, octstr, nullable, mandatory)
    aiEntryExitRegionData!: Bytes | null;
}

class AqaraZoneErrorEvent {
    @field(0x0, ZoneErrorCodeEnum, mandatory)
    errorCode!: number;
}

class AqaraDetectionRangeTargetPositionEvent {
    /** Hundredths of a meter. Null when no target is inside the configured range. */
    @field(0x0, uint16, nullable, mandatory)
    targetDistance!: number | null;
}

class AqaraMotionStateEvent {
    @field(0x0, MotionStateEnum, mandatory)
    state!: number;
}

class AqaraCountDeltaEvent {
    @constraint("min 1")
    @field(0x0, uint16, mandatory)
    countDelta!: number;

    /** Seconds. */
    @field(0x1, uint32, mandatory)
    observationDuration!: number;
}

class AqaraOccupancyDurationDeltaEvent {
    @constraint("min 1")
    @field(0x0, uint16, mandatory)
    durationDelta!: number;

    /** Seconds. */
    @field(0x1, uint32, mandatory)
    observationDuration!: number;
}

class AqaraWalkingDistanceDeltaEvent {
    @constraint("min 1")
    @field(0x0, uint32, mandatory)
    distanceDelta!: number;

    /** Seconds. */
    @field(0x1, uint32, mandatory)
    observationDuration!: number;
}

class AqaraTargetLocationInfoStruct {
    @field(0x0, uint8, mandatory)
    targetId!: number;

    @field(0x1, int16, mandatory)
    targetXCoordinate!: number;

    @field(0x2, int16, mandatory)
    targetYCoordinate!: number;

    @field(0x3, int16, mandatory)
    targetZCoordinate!: number;

    @field(0x4, int16, mandatory)
    targetVelocity!: number;

    @field(0x5, uint16, mandatory)
    targetSignalToNoiseRatio!: number;

    @field(0x6, TargetTypeEnum, mandatory)
    targetType!: number;

    @field(0x7, PostureEnum, mandatory)
    targetPosture!: number;

    @field(0x8, uint8)
    targetZoneId?: number;
}

class AqaraLocationEvent {
    @field(0x0, listOf(AqaraTargetLocationInfoStruct), mandatory)
    location!: AqaraTargetLocationInfoStruct[];
}

class AqaraTargetIdRequest {
    @field(0x0, uint8, mandatory)
    targetId!: number;
}

/**
 * Zone and installation configuration for an Occupancy Sensor leader endpoint.
 * Cluster 0x115FFC0A.
 */
@revision(2)
@withFeatures([
    { code: "ZONE", bit: 0, title: "ZoneManagement" },
    { code: "INSTALL", bit: 1, title: "InstallationModeSelection" },
    { code: "Fall", bit: 2, title: "FallDetection" },
    { code: "SMODE", bit: 3, title: "SensingModeSelection" },
])
@cluster(0x115ffc0a)
export class AqaraAmbientSensingConfigurationCluster {
    /** Selected installation mode. */
    @attribute(0x0000, InstallModeEnum, writable, manage)
    installModeSelection?: number;

    /** Installation modes the device supports. An empty list means none. */
    @attribute(0x0001, listOf(InstallModeEnum))
    supportedInstallModes?: number[];

    /** Selected side-mount position. */
    @attribute(0x0002, SideInstallEnum, writable, manage)
    sideInstallSelection?: number;

    /** Side-mount positions the device supports. An empty list means none. */
    @attribute(0x0003, listOf(SideInstallEnum))
    supportedSideInstallModes?: number[];

    /** Configured installation height. */
    @attribute(0x0004, uint16, writable, manage)
    installHeightSetting?: number;

    /** Lowest installation height the device accepts. */
    @attribute(0x0005, uint16)
    minInstallHeight?: number;

    /** Highest installation height the device accepts. */
    @attribute(0x0006, uint16)
    maxInstallHeight?: number;

    /** Installation orientation last measured by the device. */
    @attribute(0x0007, InstallStatusEnum)
    installStatus?: number;

    /** Installation angle last measured by the device. */
    @attribute(0x0008, uint8)
    installAngle?: number;

    /** Configured zones. Read only; zone commands change it. An empty list means none. */
    @attribute(0x0010, listOf(AqaraZoneInfoStruct))
    zones?: AqaraZoneInfoStruct[];

    /** Maximum number of detection zones. */
    @attribute(0x0011, uint8)
    maxDetectionZones?: number;

    /** Manually marked entry/exit cells. Null means none; a null write clears the marking. */
    @constraint("40")
    @attribute(0x0012, octstr, writable, manage, nullable)
    entryExitRegionBitmask?: Bytes | null;

    /** Manually marked interference-source cells. Null means none; a null write clears the marking. */
    @constraint("40")
    @attribute(0x0013, octstr, writable, manage, nullable)
    interferenceRegionBitmask?: Bytes | null;

    /** Manually marked edge cells. Null means none; a null write clears the marking. */
    @constraint("40")
    @attribute(0x0014, octstr, writable, manage, nullable)
    edgeRegionBitmask?: Bytes | null;

    /**
     * Seconds the interference-source window stays open after {@link subscribeAutoInterferenceSourceRecognitionData}.
     * The client waits at least this long for {@link autoInterferenceSourceRecognition}.
     */
    @constraint("min 1")
    @attribute(0x0015, uint16)
    interferenceSourceRecognitionReportingTimeout?: number;

    /**
     * Seconds allowed for one AI space background learning attempt after {@link enableAiSpaceBackgroundLearning}.
     * The client waits at least this long for {@link aiSpaceBackgroundLearningComplete}.
     */
    @constraint("min 1")
    @attribute(0x0016, uint16)
    aiSpaceBackgroundLearningReportingTimeout?: number;

    /** Turns posture recognition on or off. */
    @attribute(0x0021, bool, writable, manage)
    enablePostureRecognition?: boolean;

    /** Turns large-motion recognition on or off. */
    @attribute(0x0022, bool, writable, manage)
    enableLargeMotionRecognition?: boolean;

    /** Turns live human-count detection on or off. */
    @attribute(0x0023, bool, writable, manage)
    enableHumanCountDetection?: boolean;

    /** Turns visitor-count detection on or off. */
    @attribute(0x0024, bool, writable, manage)
    enableVisitorCountDetection?: boolean;

    /** Turns cumulative walking-distance detection on or off. */
    @attribute(0x0025, bool, writable, manage)
    enableWalkingDistanceDetection?: boolean;

    /** Turns traffic-flow detection on or off. */
    @attribute(0x0026, bool, writable, manage)
    enableTrafficFlowDetection?: boolean;

    /** Turns activity detection on or off. */
    @attribute(0x0027, bool, writable, manage)
    enableActivityDetection?: boolean;

    /** Turns average occupancy-duration detection on or off. */
    @attribute(0x0028, bool, writable, manage)
    enableAverageOccupancyDurationDetection?: boolean;

    /** Turns AI high-precision recognition on or off. */
    @attribute(0x0029, bool, writable, manage)
    enableAiHighPrecisionRecognition?: boolean;

    /** Turns AI adaptive sensitivity on or off. */
    @attribute(0x002a, bool, writable, manage)
    enableAiAdaptiveSensitivity?: boolean;

    /** Turns AI entry/exit region recognition on or off. */
    @attribute(0x002b, bool, writable, manage)
    enableAiEntryExitRegionRecognition?: boolean;

    /** Turns AI interference-source recognition on or off. */
    @attribute(0x002c, bool, writable, manage)
    enableAiInterferenceSourceRecognition?: boolean;

    /** Coordinate reversal: disabled, enabled, or automatic. */
    @attribute(0x002d, CoordinateReverseEnum, writable, manage)
    coordinateReverseSetting?: number;

    /** Omni-directional detection, or detection biased to the left and right. */
    @attribute(0x002e, DetectionDirectionEnum, writable, manage)
    detectionDirectionSetting?: number;

    /** Proximity distance: far, medium, or near. */
    @attribute(0x002f, ProximityDistanceLevelEnum, writable, manage)
    proximityDistanceLevelSetting?: number;

    /** Turns fall detection on or off. */
    @attribute(0x0030, bool, writable, manage)
    enableFallDetection?: boolean;

    /** Cells included in fall detection. Null means no mask; a null write clears it. */
    @constraint("40")
    @attribute(0x0031, octstr, writable, manage, nullable)
    fallMaskBitmask?: Bytes | null;

    /** Fall-detection sensitivity: low, medium, or high. */
    @attribute(0x0032, SensitivityEnum, writable, manage)
    fallDetectionSensitivity?: number;

    /** Bed height used to suppress false falls from someone lying on the bed. */
    @attribute(0x0033, uint16, writable, manage)
    bedHeightSetting?: number;

    /** Lowest bed height the device accepts. */
    @attribute(0x0034, uint16)
    minBedHeight?: number;

    /** Highest bed height the device accepts. */
    @attribute(0x0035, uint16)
    maxBedHeight?: number;

    /** Delay before a fall is reported. */
    @attribute(0x0036, uint16, writable, manage)
    fallDelayTimeSetting?: number;

    /** Shortest fall delay the device accepts. */
    @attribute(0x0037, uint16)
    minFallDelayTime?: number;

    /** Longest fall delay the device accepts. */
    @attribute(0x0038, uint16)
    maxFallDelayTime?: number;

    /**
     * Selected radar range cells, in steps of {@link detectionRangeStep} from {@link minDetectionRange}.
     * Distances are hundredths of a meter. Null clears the range. At least one cell must stay selected.
     */
    @constraint("max 6")
    @attribute(0x0040, octstr, writable, manage, nullable)
    detectionRangeBitmask?: Bytes | null;

    /** Nearest detection distance the device supports, in hundredths of a meter. */
    @attribute(0x0041, uint16)
    minDetectionRange?: number;

    /** Farthest detection distance the device supports, in hundredths of a meter. */
    @attribute(0x0042, uint16)
    maxDetectionRange?: number;

    /** Width of one detection-range cell, in hundredths of a meter. */
    @attribute(0x0043, uint16)
    detectionRangeStep?: number;

    /** Selected sensing mode for a PIR and radar device. */
    @attribute(0x0050, SensingModeEnum, writable, manage)
    sensingMode?: number;

    /** Sensing modes the device supports. An empty list means none. */
    @attribute(0x0051, listOf(SensingModeEnum))
    supportedSensingModes?: number[];

    /** Seconds the PIR sensor keeps reporting presence after motion. */
    @attribute(0x0052, uint8, writable, manage)
    pirDetectionTimeSetting?: number;

    /** Shortest PIR presence time the device accepts, in seconds. */
    @attribute(0x0053, uint8)
    minPirDetectionTime?: number;

    /** Longest PIR presence time the device accepts, in seconds. */
    @attribute(0x0054, uint8)
    maxPirDetectionTime?: number;

    /**
     * Starts or restarts interference-source recognition.
     * The window length is {@link interferenceSourceRecognitionReportingTimeout}.
     * When it ends, the server emits exactly one {@link autoInterferenceSourceRecognition}.
     */
    @command(0x00, manageCommand)
    subscribeAutoInterferenceSourceRecognitionData(): void {}

    /**
     * Starts, restarts, or stops edge recognition. See {@link AqaraEdgeTimeoutRequest}.
     * A non-zero timeout emits {@link autoEdgeRecognition} once immediately, then again only when the edge data changes.
     */
    @command(0x01, AqaraEdgeTimeoutRequest, manageCommand)
    subscribeAutoEdgeRecognitionData(_request: AqaraEdgeTimeoutRequest): void {}

    /**
     * Asks for the current AI entry/exit region.
     * Each invoke makes the server emit exactly one {@link aiEntryExitRegion} immediately.
     */
    @command(0x02, manageCommand)
    subscribeAiEntryExitRegionData(): void {}

    /**
     * Starts or restarts AI space background learning.
     * The server emits exactly one {@link aiSpaceBackgroundLearningComplete} when the attempt finishes.
     * Wait at least {@link aiSpaceBackgroundLearningReportingTimeout} seconds before treating that event as missing.
     */
    @command(0x03, manageCommand)
    enableAiSpaceBackgroundLearning(): void {}

    /**
     * Adds one zone. A ZoneID that already exists returns DuplicateZoneId and adds nothing.
     * Success creates one child endpoint for that zone.
     */
    @command(0x04, AqaraZoneRequest, response(0x05, AqaraZoneResponse), manageCommand)
    appendZone(_request: AqaraZoneRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    /** Replaces the definition of the zone with this ZoneID. */
    @command(0x06, AqaraZoneRequest, response(0x07, AqaraZoneResponse), manageCommand)
    updateZone(_request: AqaraZoneRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    /** Removes one zone and its child endpoint. */
    @command(0x08, AqaraZoneIdRequest, response(0x09, AqaraZoneResponse), manageCommand)
    removeZone(_request: AqaraZoneIdRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    /**
     * Replaces every zone. An empty list removes them all.
     * A repeated ZoneID, or more zones than {@link maxDetectionZones} or 20, is rejected and the current zones stay.
     */
    @command(0x0a, AqaraZonesRequest, response(0x0b, AqaraZoneResponse), manageCommand)
    setZones(_request: AqaraZonesRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    /**
     * Starts, restarts, or stops detection-range target reporting. See {@link AqaraEdgeTimeoutRequest}.
     * A non-zero timeout emits {@link detectionRangeTargetPosition} once immediately, then again only when that distance changes.
     */
    @command(0x0c, AqaraEdgeTimeoutRequest, manageCommand)
    subscribeDetectionRangeTargetPosition(_request: AqaraEdgeTimeoutRequest): void {}

    /**
     * One result for an interference-source window opened by {@link subscribeAutoInterferenceSourceRecognitionData}.
     * Emitted when the window ends. Null data means no result.
     */
    @event(0x00, AqaraAutoInterferenceSourceRecognitionEvent)
    autoInterferenceSourceRecognition!: AqaraAutoInterferenceSourceRecognitionEvent;

    /**
     * Edge bitmap during a window opened by {@link subscribeAutoEdgeRecognitionData}.
     * One event at the start, then another only when the bitmap changes.
     */
    @event(0x01, AqaraAutoEdgeRecognitionEvent)
    autoEdgeRecognition!: AqaraAutoEdgeRecognitionEvent;

    /**
     * Current AI entry/exit bitmap, emitted once for each {@link subscribeAiEntryExitRegionData}.
     * Null data means no result.
     */
    @event(0x02, AqaraAiEntryExitRegionEvent)
    aiEntryExitRegion!: AqaraAiEntryExitRegionEvent;

    /**
     * Outcome of one learning attempt started by {@link enableAiSpaceBackgroundLearning}.
     * Emitted once, when the attempt finishes. Success is the only successful code.
     */
    @event(0x03, AqaraZoneErrorEvent)
    aiSpaceBackgroundLearningComplete!: AqaraZoneErrorEvent;

    /**
     * Nearest target during a window opened by {@link subscribeDetectionRangeTargetPosition}.
     * One event at the start, then another only when the distance changes. Null means no target in range.
     */
    @event(0x04, AqaraDetectionRangeTargetPositionEvent)
    detectionRangeTargetPosition!: AqaraDetectionRangeTargetPositionEvent;
}

/**
 * Aggregated ambient sensing for an Occupancy Sensor.
 * Cluster 0x115FFC0B. LEADER on the leader endpoint carries ChildEndpointList;
 * CHILD on each zone endpoint carries ZoneID.
 */
@revision(2)
@withFeatures([
    { code: "LEADER", bit: 0, title: "Leader" },
    { code: "CHILD", bit: 1, title: "Child" },
])
@cluster(0x115ffc0b)
export class AqaraAmbientSensingUnionCluster {
    /** Child endpoint ids owned by the leader. An empty list means none. */
    @attribute(0x0000, listOf(uint16))
    childEndpointList?: number[];

    /** Zone id of this child endpoint. */
    @attribute(0x0001, uint8)
    zoneId?: number;

    /** People currently detected. Null while the count is unavailable. */
    @attribute(0x0002, uint16, nullable)
    currentHumanCount?: number | null;

    /** Emitted when motion state changes. The leader reports the whole area; a child reports its zone. */
    @event(0x00, AqaraMotionStateEvent)
    motionState!: AqaraMotionStateEvent;

    /** Visitors since the previous event, not a running total. countDelta is at least 1. Duration is seconds. */
    @event(0x01, AqaraCountDeltaEvent)
    visitCountDelta!: AqaraCountDeltaEvent;

    /** Occupancy time accumulated since the previous event, in seconds. durationDelta is at least 1. */
    @event(0x02, AqaraOccupancyDurationDeltaEvent)
    occupancyDurationDelta!: AqaraOccupancyDurationDeltaEvent;

    /** Walking distance accumulated since the previous event. The extension uses meters. distanceDelta is at least 1. */
    @event(0x03, AqaraWalkingDistanceDeltaEvent)
    walkingDistanceDelta!: AqaraWalkingDistanceDeltaEvent;

    /** Entries since the previous event, not a running total. Leader only. countDelta is at least 1. */
    @event(0x04, AqaraCountDeltaEvent)
    humanEntryCountDelta!: AqaraCountDeltaEvent;

    /** Exits since the previous event, not a running total. Leader only. countDelta is at least 1. */
    @event(0x05, AqaraCountDeltaEvent)
    humanExitCountDelta!: AqaraCountDeltaEvent;
}

/**
 * Occupant location for an Occupancy Sensor.
 * Cluster 0x115FFC0C. Location reporting and target removal are leader commands;
 * child endpoints report the zone-scoped state attributes.
 */
@revision(2)
@withFeatures([
    { code: "LEADER", bit: 0, title: "Leader" },
    { code: "CHILD", bit: 1, title: "Child" },
])
@cluster(0x115ffc0c)
export class AqaraOccupantLocationCluster {
    /** Maximum number of targets the device can track. */
    @attribute(0x0000, uint8)
    maxDetectionTargets?: number;

    /** Whether any target is walking. */
    @attribute(0x0001, WalkingStateEnum)
    walkingState?: number;

    /** Whether any target is sitting. */
    @attribute(0x0002, SittingStateEnum)
    sittingState?: number;

    /** Whether any target is standing. */
    @attribute(0x0003, StandingStateEnum)
    standingState?: number;

    /** Whether any target is lying. */
    @attribute(0x0004, LyingStateEnum)
    lyingState?: number;

    /** Large-motion classification: none, action 1, or action 2. */
    @attribute(0x0005, LargeMotionStateEnum)
    largeMotionState?: number;

    /**
     * Fall, suspected fall, or cleared.
     * Any fall forces Fall. After that fall clears, a remaining suspected target keeps the state at SuspectedFall.
     */
    @attribute(0x0006, FallStateEnum)
    fallState?: number;

    /** Active when any target is active. Still only when every target is still. */
    @attribute(0x0007, ActivityStateEnum)
    activityState?: number;

    /**
     * Starts, restarts, or stops occupant location reporting. See {@link AqaraLocationTimeoutRequest}.
     * A non-zero timeout emits {@link location} once immediately, then again only when the reported targets change.
     */
    @command(0x00, AqaraLocationTimeoutRequest, manageCommand)
    subscribeLocationData(_request: AqaraLocationTimeoutRequest): void {}

    /** Drops the tracked target with this id. */
    @command(0x01, AqaraTargetIdRequest, manageCommand)
    removeDetectionTarget(_request: AqaraTargetIdRequest): void {}

    /**
     * Targets during a window opened by {@link subscribeLocationData}.
     * One event at the start, then another only when the list changes. An empty list means no target.
     */
    @event(0x00, AqaraLocationEvent)
    location!: AqaraLocationEvent;
}

const enum AqaraMusicSyncEffect {
    Stretch = 1,
    Pulse = 2,
    Dash = 3,
    Flash = 4,
}

@cluster(0x115ffc0f)
export class AqaraLedStripCluster {
    @attribute(0x0013, bool, writable)
    musicSyncEnabled?: boolean;

    @attribute(0x0015, enum8, writable)
    musicSyncEffect?: AqaraMusicSyncEffect;

    @attribute(0x0016, uint8, writable)
    musicSyncSensitivity?: number;
}
