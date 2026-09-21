/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import {
    attribute,
    bool,
    cluster,
    command,
    enum8,
    event,
    field,
    int16,
    listOf,
    mandatory,
    octstr,
    response,
    uint8,
    uint16,
    writable,
} from "@matter/main/model";

// Enumerations. Declared as `const enum`s so the wire encoding stays a plain 8-bit value while the symbolic mapping
// lives alongside the cluster. Names and integer values follow the Aqara app's device model (trait definitions);
// values were confirmed against firmware 1.1.9.6.

/** {@link AqaraAmbientSensingConfigurationCluster.installMode} values (InstallMode trait). */
const enum AqaraInstallMode {
    Unknown = 0,
    SideMount = 1, // shown as "Wall" in the app
    TopMount = 2, // shown as "Ceiling" in the app
}

/** {@link AqaraAmbientSensingConfigurationCluster.sideInstall} values (SideInstall trait). */
const enum AqaraSideInstall {
    Unknown = 0,
    Wall = 1,
    LeftCorner = 2,
    RightCorner = 3,
}

/** {@link AqaraAmbientSensingConfigurationCluster.installStatus} values (InstallStatus trait, from the tilt sensor). */
const enum AqaraInstallStatus {
    LevelFacingUp = 0,
    LevelTiltedFacingUp = 1,
    LevelReverseTiltedFacingUp = 2,
    SideFacingForward = 3,
    SideReverseFacingForward = 4,
    TopFacingDown = 5,
    TiltedFacingDown = 6,
    ReverseTiltedFacingDown = 7,
    Invalid = 8,
}

/** {@link AqaraAmbientSensingConfigurationCluster.coordinateReverse} values; shown as "Mounting Direction Detection". */
const enum AqaraCoordinateReverse {
    Disabled = 0,
    Enabled = 1,
    Auto = 2,
}

/** {@link AqaraAmbientSensingConfigurationCluster.detectionDirection} values (DetectionDirectionSetting trait). */
const enum AqaraDetectionDirection {
    OmniDirectional = 0,
    LeftRight = 1,
}

/** {@link AqaraAmbientSensingConfigurationCluster.proximityDistanceLevel} values (ProximityDistanceLevel trait). */
const enum AqaraProximityDistanceLevel {
    Far = 0,
    Medium = 1,
    Near = 2,
}

/** Activity of a tracked target (ActivityState trait). */
const enum AqaraActivityState {
    Unknown = 0,
    Active = 1,
    Still = 2,
}

/** Fall state of a tracked target (FallState trait). */
const enum AqaraFallState {
    Cleared = 0,
    Fall = 1,
    SuspectedFall = 2,
}

/** {@link AqaraMotionDetectedEvent.motion} values (MotionDetected trait). */
const enum AqaraMotionEvent {
    Enter = 0,
    Left = 1,
    LeftIn = 2,
    RightOut = 3,
    RightIn = 4,
    LeftOut = 5,
    Access = 6,
    Away = 7,
}

/** {@link AqaraZoneResponse.status} values (AISpaceBackgroundLearningComplete trait). */
const enum AqaraZoneCommandStatus {
    Success = 0,
    InvalidArgument = 1,
    InvalidState = 2,
    ResourceExhausted = 3,
    Busy = 4,
    DuplicateZoneId = 5,
}

// Vendor clusters of the Aqara Spatial Multi-Sensor FP400 (vendor 0x115f / 4447, product 0x2009) in Matter/Thread
// mode. Attribute, command and event names follow the trait names of the Aqara app's device model
// (AmbientSensingConfiguration / RadarSensingUnion / OccupantLocation); the Aqara app's user interface shows
// friendlier display labels for some of these (e.g. CoordinateReverse is shown as "Mounting Direction Detection",
// EdgeRegionBitmask as "Monitoring Range"). Attribute ids, enum values and behaviour were verified against
// firmware 1.1.8.2 and 1.1.9.6 by driving the Aqara app and reading the clusters back.
//
// The sensor divides its field of view into a grid of 16 columns x 20 rows of ~50 cm cells. Cell (row, col) maps to
// bit `row * 16 + col` of a 40 byte bitmask, most significant bit first. Row 0 is nearest the sensor, column 8 is
// straight ahead and columns grow as x decreases.
//
// The device only serves these clusters to fabrics it trusts: from a fabric with vendor id 0x134b every read, write and
// command is answered with UnsupportedAttribute, while a fabric with the test vendor id 0xfff1 gets full access
// (wildcard subscriptions deliver the scalar attributes on either).

/**
 * A detection zone. Creating a zone adds a child endpoint with an Occupancy Sensing cluster (and a
 * {@link AqaraRadarSensingUnionCluster} carrying the zone id) below the sensor endpoint.
 */
class AqaraZoneStruct {
    /** 1..8 */
    @field(0x0, uint8, mandatory)
    zoneId!: number;

    /** Zone category chosen in the app (e.g. 51 for a desk zone); 0 works as a generic zone. */
    @field(0x1, uint8, mandatory)
    zoneType!: number;

    /** 40 byte cell bitmask, see the grid description above. */
    @field(0x2, octstr, mandatory)
    cells!: Bytes;

    @field(0x3, bool, mandatory)
    enabled!: boolean;
}

class AqaraZoneRequest {
    @field(0x0, AqaraZoneStruct, mandatory)
    zone!: AqaraZoneStruct;
}

class AqaraZoneIdRequest {
    @field(0x0, uint8, mandatory)
    zoneId!: number;
}

class AqaraZonesRequest {
    @field(0x0, listOf(AqaraZoneStruct), mandatory)
    zones!: AqaraZoneStruct[];
}

class AqaraTimeoutRequest {
    /** Seconds the device keeps reporting. */
    @field(0x0, uint16, mandatory)
    timeout!: number;
}

/** Result of a zone command; see {@link AqaraZoneCommandStatus}. */
class AqaraZoneResponse {
    @field(0x0, enum8, mandatory)
    status!: AqaraZoneCommandStatus;
}

@cluster(0x115ffc0a)
export class AqaraAmbientSensingConfigurationCluster {
    /** Mounting mode; see {@link AqaraInstallMode}. */
    @attribute(0x0000, enum8, writable)
    installMode?: AqaraInstallMode;

    @attribute(0x0001, listOf(enum8))
    supportedInstallModes?: AqaraInstallMode[];

    /** Mounting orientation; see {@link AqaraSideInstall}. */
    @attribute(0x0002, enum8, writable)
    sideInstall?: AqaraSideInstall;

    @attribute(0x0003, listOf(enum8))
    supportedSideInstalls?: AqaraSideInstall[];

    /** Mounting height in mm, between installHeightMin and installHeightMax. */
    @attribute(0x0004, uint16, writable)
    installHeight?: number;

    @attribute(0x0005, uint16)
    installHeightMin?: number;

    @attribute(0x0006, uint16)
    installHeightMax?: number;

    /** Orientation measured by the built-in tilt sensor; see {@link AqaraInstallStatus}. */
    @attribute(0x0007, enum8)
    installStatus?: AqaraInstallStatus;

    /** Tilt from horizontal in degrees (unsigned). */
    @attribute(0x0008, uint8)
    installAngle?: number;

    /** Configured zones. Changed through the zone commands, not by writing. */
    @attribute(0x0010, listOf(AqaraZoneStruct))
    zones?: AqaraZoneStruct[];

    @attribute(0x0011, uint8)
    maxZones?: number;

    /** Cells recognised as entry/exit regions (40 byte bitmask). */
    @attribute(0x0012, octstr, writable)
    entryExitRegionBitmask?: Bytes;

    /** Cells recognised as interference sources (40 byte bitmask). */
    @attribute(0x0013, octstr, writable)
    interferenceRegionBitmask?: Bytes;

    /** Monitored-area boundary (40 byte bitmask); shown as "Monitoring Range" in the app. */
    @attribute(0x0014, octstr, writable)
    edgeRegionBitmask?: Bytes;

    /** Seconds; reporting timeout of the AI space background learning. */
    @attribute(0x0016, uint8)
    learningReportingTimeout?: number;

    @attribute(0x0023, bool, writable)
    enableHumanCountDetection?: boolean;

    // Attribute 0x27 (EnableActivityDetection) exists in the app's device model but is not exposed by firmware
    // 1.1.9.6 (absent from the AttributeList), so it is not declared here.
    @attribute(0x0029, bool, writable)
    enableAiHighPrecisionRecognition?: boolean;

    @attribute(0x002a, bool, writable)
    enableAiAdaptiveSensitivity?: boolean;

    @attribute(0x002b, bool, writable)
    enableAiEntryExitRegionRecognition?: boolean;

    @attribute(0x002c, bool, writable)
    enableAiInterferenceSourceRecognition?: boolean;

    /** See {@link AqaraCoordinateReverse}; shown as "Mounting Direction Detection" in the app. */
    @attribute(0x002d, enum8, writable)
    coordinateReverse?: AqaraCoordinateReverse;

    /** See {@link AqaraDetectionDirection}. */
    @attribute(0x002e, enum8, writable)
    detectionDirection?: AqaraDetectionDirection;

    /** See {@link AqaraProximityDistanceLevel}. */
    @attribute(0x002f, enum8, writable)
    proximityDistanceLevel?: AqaraProximityDistanceLevel;

    @command(0x00)
    subscribeAutoInterferenceSourceRecognitionData(): void {}

    @command(0x01, AqaraTimeoutRequest)
    subscribeAutoEdgeRecognitionData(_request: AqaraTimeoutRequest): void {}

    @command(0x02)
    subscribeAiEntryExitRegionRecognitionData(): void {}

    @command(0x03)
    enableAiSpaceBackgroundLearning(): void {}

    /** Adds a zone, or replaces the zone with the same id. */
    @command(0x04, AqaraZoneRequest, response(0x05, AqaraZoneResponse))
    appendZone(_request: AqaraZoneRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    @command(0x06, AqaraZoneRequest, response(0x07, AqaraZoneResponse))
    updateZone(_request: AqaraZoneRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    @command(0x08, AqaraZoneIdRequest, response(0x09, AqaraZoneResponse))
    removeZone(_request: AqaraZoneIdRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    /** Replaces all zones; an empty list removes every zone. */
    @command(0x0a, AqaraZonesRequest, response(0x0b, AqaraZoneResponse))
    setZones(_request: AqaraZonesRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }
}

/** Motion event payload; see {@link AqaraMotionEvent}. */
class AqaraMotionDetectedEvent {
    @field(0x0, enum8, mandatory)
    motion!: AqaraMotionEvent;
}

@cluster(0x115ffc0b)
export class AqaraRadarSensingUnionCluster {
    /** Endpoint ids of the zone child endpoints (present on the sensor endpoint). */
    @attribute(0x0000, listOf(uint16))
    childEndpointList?: number[];

    /** Id of the zone this endpoint represents (present on zone endpoints). */
    @attribute(0x0001, uint8)
    zoneId?: number;

    @attribute(0x0002, uint8)
    currentHumanCount?: number;

    @event(0x00, AqaraMotionDetectedEvent)
    motionDetected!: AqaraMotionDetectedEvent;
}

/** One tracked person. */
class AqaraTargetStruct {
    @field(0x0, uint8, mandatory)
    targetId!: number;

    /** Sideways position in cm, negative to the left. */
    @field(0x1, int16, mandatory)
    x!: number;

    /** Distance from the sensor in cm. */
    @field(0x2, int16, mandatory)
    y!: number;

    /** Grid cell as `row << 8 | column`. */
    @field(0x3, uint16, mandatory)
    cell!: number;

    /** See {@link AqaraActivityState}. */
    @field(0x4, enum8, mandatory)
    activityState!: AqaraActivityState;

    /** See {@link AqaraFallState}. */
    @field(0x5, enum8, mandatory)
    fallState!: AqaraFallState;

    @field(0x6, uint8, mandatory)
    postureState!: number;

    /** Always observed as 255. */
    @field(0x7, uint8, mandatory)
    zoneId!: number;

    /** Id of the zone the target is in. Only present while the target is inside a zone. */
    @field(0x8, uint8)
    inZoneId?: number;
}

class AqaraLocationInfoEvent {
    @field(0x0, listOf(AqaraTargetStruct), mandatory)
    targets!: AqaraTargetStruct[];
}

class AqaraTargetIdRequest {
    @field(0x0, uint8, mandatory)
    targetId!: number;
}

@cluster(0x115ffc0c)
export class AqaraOccupantLocationCluster {
    @attribute(0x0000, uint8)
    maxDetectionTargets?: number;

    /** See {@link AqaraActivityState}. */
    @attribute(0x0007, enum8)
    activityState?: AqaraActivityState;

    /**
     * Streams {@link locationInfo} events (~7 per second while people move) for the given number of seconds
     * (max 3600). Without a subscription the event is only emitted when a target appears or disappears.
     */
    @command(0x00, AqaraTimeoutRequest)
    subscribeLocationData(_request: AqaraTimeoutRequest): void {}

    @command(0x01, AqaraTargetIdRequest)
    removeDetectionTarget(_request: AqaraTargetIdRequest): void {}

    @event(0x00, AqaraLocationInfoEvent)
    locationInfo!: AqaraLocationInfoEvent;
}
