"""Thermostat cluster definition (auto-generated, DO NOT edit)."""

from __future__ import annotations

import typing
from dataclasses import dataclass, field
from enum import IntFlag

from ... import ChipUtility
from ...clusters.enum import MatterIntEnum
from ...tlv import float32, uint
from ..ClusterObjects import (Cluster, ClusterAttributeDescriptor, ClusterCommand, ClusterEvent, ClusterObject,
                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)
from ..Types import Nullable, NullValue
from .Globals import Globals


@dataclass
class Thermostat(Cluster):
    id: typing.ClassVar[int] = 0x00000201

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="localTemperature", Tag=0x00000000, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="outdoorTemperature", Tag=0x00000001, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="occupancy", Tag=0x00000002, Type=typing.Optional[Thermostat.Bitmaps.OccupancyBitmap]),
                ClusterObjectFieldDescriptor(Label="absMinHeatSetpointLimit", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="absMaxHeatSetpointLimit", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="absMinCoolSetpointLimit", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="absMaxCoolSetpointLimit", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="piCoolingDemand", Tag=0x00000007, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="piHeatingDemand", Tag=0x00000008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="hvacSystemTypeConfiguration", Tag=0x00000009, Type=typing.Optional[Thermostat.Bitmaps.HVACSystemTypeBitmap]),
                ClusterObjectFieldDescriptor(Label="localTemperatureCalibration", Tag=0x00000010, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="occupiedCoolingSetpoint", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="occupiedHeatingSetpoint", Tag=0x00000012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="unoccupiedCoolingSetpoint", Tag=0x00000013, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="unoccupiedHeatingSetpoint", Tag=0x00000014, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minHeatSetpointLimit", Tag=0x00000015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxHeatSetpointLimit", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minCoolSetpointLimit", Tag=0x00000017, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxCoolSetpointLimit", Tag=0x00000018, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minSetpointDeadBand", Tag=0x00000019, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="remoteSensing", Tag=0x0000001A, Type=typing.Optional[Thermostat.Bitmaps.RemoteSensingBitmap]),
                ClusterObjectFieldDescriptor(Label="controlSequenceOfOperation", Tag=0x0000001B, Type=Thermostat.Enums.ControlSequenceOfOperationEnum),
                ClusterObjectFieldDescriptor(Label="systemMode", Tag=0x0000001C, Type=Thermostat.Enums.SystemModeEnum),
                ClusterObjectFieldDescriptor(Label="thermostatRunningMode", Tag=0x0000001E, Type=typing.Optional[Thermostat.Enums.ThermostatRunningModeEnum]),
                ClusterObjectFieldDescriptor(Label="startOfWeek", Tag=0x00000020, Type=typing.Optional[Thermostat.Enums.StartOfWeekEnum]),
                ClusterObjectFieldDescriptor(Label="numberOfWeeklyTransitions", Tag=0x00000021, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfDailyTransitions", Tag=0x00000022, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="temperatureSetpointHold", Tag=0x00000023, Type=typing.Optional[Thermostat.Enums.TemperatureSetpointHoldEnum]),
                ClusterObjectFieldDescriptor(Label="temperatureSetpointHoldDuration", Tag=0x00000024, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="thermostatProgrammingOperationMode", Tag=0x00000025, Type=typing.Optional[Thermostat.Bitmaps.ProgrammingOperationModeBitmap]),
                ClusterObjectFieldDescriptor(Label="thermostatRunningState", Tag=0x00000029, Type=typing.Optional[Thermostat.Bitmaps.RelayStateBitmap]),
                ClusterObjectFieldDescriptor(Label="setpointChangeSource", Tag=0x00000030, Type=typing.Optional[Thermostat.Enums.SetpointChangeSourceEnum]),
                ClusterObjectFieldDescriptor(Label="setpointChangeAmount", Tag=0x00000031, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="setpointChangeSourceTimestamp", Tag=0x00000032, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="occupiedSetback", Tag=0x00000034, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="occupiedSetbackMin", Tag=0x00000035, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="occupiedSetbackMax", Tag=0x00000036, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="unoccupiedSetback", Tag=0x00000037, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="unoccupiedSetbackMin", Tag=0x00000038, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="unoccupiedSetbackMax", Tag=0x00000039, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="emergencyHeatDelta", Tag=0x0000003A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="acType", Tag=0x00000040, Type=typing.Optional[Thermostat.Enums.ACTypeEnum]),
                ClusterObjectFieldDescriptor(Label="acCapacity", Tag=0x00000041, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="acRefrigerantType", Tag=0x00000042, Type=typing.Optional[Thermostat.Enums.ACRefrigerantTypeEnum]),
                ClusterObjectFieldDescriptor(Label="acCompressorType", Tag=0x00000043, Type=typing.Optional[Thermostat.Enums.ACCompressorTypeEnum]),
                ClusterObjectFieldDescriptor(Label="acErrorCode", Tag=0x00000044, Type=typing.Optional[Thermostat.Bitmaps.ACErrorCodeBitmap]),
                ClusterObjectFieldDescriptor(Label="acLouverPosition", Tag=0x00000045, Type=typing.Optional[Thermostat.Enums.ACLouverPositionEnum]),
                ClusterObjectFieldDescriptor(Label="acCoilTemperature", Tag=0x00000046, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="acCapacityFormat", Tag=0x00000047, Type=typing.Optional[Thermostat.Enums.ACCapacityFormatEnum]),
                ClusterObjectFieldDescriptor(Label="presetTypes", Tag=0x00000048, Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetTypeStruct]]]),
                ClusterObjectFieldDescriptor(Label="scheduleTypes", Tag=0x00000049, Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleTypeStruct]]]),
                ClusterObjectFieldDescriptor(Label="numberOfPresets", Tag=0x0000004A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfSchedules", Tag=0x0000004B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfScheduleTransitions", Tag=0x0000004C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfScheduleTransitionPerDay", Tag=0x0000004D, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="activePresetHandle", Tag=0x0000004E, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="activeScheduleHandle", Tag=0x0000004F, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="presets", Tag=0x00000050, Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetStruct]]]),
                ClusterObjectFieldDescriptor(Label="schedules", Tag=0x00000051, Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleStruct]]]),
                ClusterObjectFieldDescriptor(Label="setpointHoldExpiryTimestamp", Tag=0x00000052, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    localTemperature: 'typing.Union[Nullable, uint]' = NullValue
    outdoorTemperature: 'typing.Union[None, Nullable, uint]' = None
    occupancy: 'typing.Optional[Thermostat.Bitmaps.OccupancyBitmap]' = None
    absMinHeatSetpointLimit: 'typing.Optional[uint]' = None
    absMaxHeatSetpointLimit: 'typing.Optional[uint]' = None
    absMinCoolSetpointLimit: 'typing.Optional[uint]' = None
    absMaxCoolSetpointLimit: 'typing.Optional[uint]' = None
    piCoolingDemand: 'typing.Optional[uint]' = None
    piHeatingDemand: 'typing.Optional[uint]' = None
    hvacSystemTypeConfiguration: 'typing.Optional[Thermostat.Bitmaps.HVACSystemTypeBitmap]' = None
    localTemperatureCalibration: 'typing.Optional[uint]' = None
    occupiedCoolingSetpoint: 'typing.Optional[uint]' = None
    occupiedHeatingSetpoint: 'typing.Optional[uint]' = None
    unoccupiedCoolingSetpoint: 'typing.Optional[uint]' = None
    unoccupiedHeatingSetpoint: 'typing.Optional[uint]' = None
    minHeatSetpointLimit: 'typing.Optional[uint]' = None
    maxHeatSetpointLimit: 'typing.Optional[uint]' = None
    minCoolSetpointLimit: 'typing.Optional[uint]' = None
    maxCoolSetpointLimit: 'typing.Optional[uint]' = None
    minSetpointDeadBand: 'typing.Optional[uint]' = None
    remoteSensing: 'typing.Optional[Thermostat.Bitmaps.RemoteSensingBitmap]' = None
    controlSequenceOfOperation: 'Thermostat.Enums.ControlSequenceOfOperationEnum' = 0
    systemMode: 'Thermostat.Enums.SystemModeEnum' = 0
    thermostatRunningMode: 'typing.Optional[Thermostat.Enums.ThermostatRunningModeEnum]' = None
    startOfWeek: 'typing.Optional[Thermostat.Enums.StartOfWeekEnum]' = None
    numberOfWeeklyTransitions: 'typing.Optional[uint]' = None
    numberOfDailyTransitions: 'typing.Optional[uint]' = None
    temperatureSetpointHold: 'typing.Optional[Thermostat.Enums.TemperatureSetpointHoldEnum]' = None
    temperatureSetpointHoldDuration: 'typing.Union[None, Nullable, uint]' = None
    thermostatProgrammingOperationMode: 'typing.Optional[Thermostat.Bitmaps.ProgrammingOperationModeBitmap]' = None
    thermostatRunningState: 'typing.Optional[Thermostat.Bitmaps.RelayStateBitmap]' = None
    setpointChangeSource: 'typing.Optional[Thermostat.Enums.SetpointChangeSourceEnum]' = None
    setpointChangeAmount: 'typing.Union[None, Nullable, uint]' = None
    setpointChangeSourceTimestamp: 'typing.Optional[uint]' = None
    occupiedSetback: 'typing.Union[None, Nullable, uint]' = None
    occupiedSetbackMin: 'typing.Union[None, Nullable, uint]' = None
    occupiedSetbackMax: 'typing.Union[None, Nullable, uint]' = None
    unoccupiedSetback: 'typing.Union[None, Nullable, uint]' = None
    unoccupiedSetbackMin: 'typing.Union[None, Nullable, uint]' = None
    unoccupiedSetbackMax: 'typing.Union[None, Nullable, uint]' = None
    emergencyHeatDelta: 'typing.Optional[uint]' = None
    acType: 'typing.Optional[Thermostat.Enums.ACTypeEnum]' = None
    acCapacity: 'typing.Optional[uint]' = None
    acRefrigerantType: 'typing.Optional[Thermostat.Enums.ACRefrigerantTypeEnum]' = None
    acCompressorType: 'typing.Optional[Thermostat.Enums.ACCompressorTypeEnum]' = None
    acErrorCode: 'typing.Optional[Thermostat.Bitmaps.ACErrorCodeBitmap]' = None
    acLouverPosition: 'typing.Optional[Thermostat.Enums.ACLouverPositionEnum]' = None
    acCoilTemperature: 'typing.Union[None, Nullable, uint]' = None
    acCapacityFormat: 'typing.Optional[Thermostat.Enums.ACCapacityFormatEnum]' = None
    presetTypes: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetTypeStruct]]]' = None
    scheduleTypes: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleTypeStruct]]]' = None
    numberOfPresets: 'typing.Optional[uint]' = None
    numberOfSchedules: 'typing.Optional[uint]' = None
    numberOfScheduleTransitions: 'typing.Optional[uint]' = None
    numberOfScheduleTransitionPerDay: 'typing.Union[None, Nullable, uint]' = None
    activePresetHandle: 'typing.Union[None, Nullable, bytes]' = None
    activeScheduleHandle: 'typing.Union[None, Nullable, bytes]' = None
    presets: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetStruct]]]' = None
    schedules: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleStruct]]]' = None
    setpointHoldExpiryTimestamp: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class ACCapacityFormatEnum(MatterIntEnum):
            kBtUh = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class ACCompressorTypeEnum(MatterIntEnum):
            kUnknown = 0x00
            kT1 = 0x01
            kT2 = 0x02
            kT3 = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ACLouverPositionEnum(MatterIntEnum):
            kClosed = 0x01
            kOpen = 0x02
            kQuarter = 0x03
            kHalf = 0x04
            kThreeQuarters = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class ACRefrigerantTypeEnum(MatterIntEnum):
            kUnknown = 0x00
            kR22 = 0x01
            kR410A = 0x02
            kR407C = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ACTypeEnum(MatterIntEnum):
            kUnknown = 0x00
            kCoolingFixed = 0x01
            kHeatPumpFixed = 0x02
            kCoolingInverter = 0x03
            kHeatPumpInverter = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class SetpointRaiseLowerModeEnum(MatterIntEnum):
            kHeat = 0x00
            kCool = 0x01
            kBoth = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ControlSequenceOfOperationEnum(MatterIntEnum):
            kCoolingOnly = 0x00
            kCoolingWithReheat = 0x01
            kHeatingOnly = 0x02
            kHeatingWithReheat = 0x03
            kCoolingAndHeating = 0x04
            kCoolingAndHeatingWithReheat = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class PresetScenarioEnum(MatterIntEnum):
            kOccupied = 0x01
            kUnoccupied = 0x02
            kSleep = 0x03
            kWake = 0x04
            kVacation = 0x05
            kGoingToSleep = 0x06
            kUserDefined = 0xFE
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 255

        class SetpointChangeSourceEnum(MatterIntEnum):
            kManual = 0x00
            kSchedule = 0x01
            kExternal = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class StartOfWeekEnum(MatterIntEnum):
            kSunday = 0x00
            kMonday = 0x01
            kTuesday = 0x02
            kWednesday = 0x03
            kThursday = 0x04
            kFriday = 0x05
            kSaturday = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

        class SystemModeEnum(MatterIntEnum):
            kOff = 0x00
            kAuto = 0x01
            kCool = 0x03
            kHeat = 0x04
            kEmergencyHeat = 0x05
            kPrecooling = 0x06
            kFanOnly = 0x07
            kDry = 0x08
            kSleep = 0x09
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 10

        class ThermostatRunningModeEnum(MatterIntEnum):
            kOff = 0x00
            kCool = 0x03
            kHeat = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class TemperatureSetpointHoldEnum(MatterIntEnum):
            kSetpointHoldOff = 0x00
            kSetpointHoldOn = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

    class Bitmaps:
        class Feature(IntFlag):
            kHeating = 0x1
            kCooling = 0x2
            kOccupancy = 0x4
            kScheduleConfiguration = 0x8
            kSetback = 0x10
            kAutoMode = 0x20
            kLocalTemperatureNotExposed = 0x40
            kMatterScheduleConfiguration = 0x80
            kPresets = 0x100

        class ACErrorCodeBitmap(IntFlag):
            kCompressorFail = 0x1
            kRoomSensorFail = 0x2
            kOutdoorSensorFail = 0x4
            kCoilSensorFail = 0x8
            kFanFail = 0x10

        class HVACSystemTypeBitmap(IntFlag):
            kCoolingStage = 0x1
            kHeatingStage = 0x1
            kHeatingIsHeatPump = 0x10
            kHeatingUsesFuel = 0x20

        class OccupancyBitmap(IntFlag):
            kOccupied = 0x1

        class PresetTypeFeaturesBitmap(IntFlag):
            kAutomatic = 0x1
            kSupportsNames = 0x2

        class ProgrammingOperationModeBitmap(IntFlag):
            kScheduleActive = 0x1
            kAutoRecovery = 0x2
            kEconomy = 0x4

        class RelayStateBitmap(IntFlag):
            kHeat = 0x1
            kCool = 0x2
            kFan = 0x4
            kHeatStage2 = 0x8
            kCoolStage2 = 0x10
            kFanStage2 = 0x20
            kFanStage3 = 0x40

        class RemoteSensingBitmap(IntFlag):
            kLocalTemperature = 0x1
            kOutdoorTemperature = 0x2
            kOccupancy = 0x4

        class ScheduleTypeFeaturesBitmap(IntFlag):
            kSupportsPresets = 0x1
            kSupportsSetpoints = 0x2
            kSupportsNames = 0x4
            kSupportsOff = 0x8

        class ScheduleDayOfWeekBitmap(IntFlag):
            kSunday = 0x1
            kMonday = 0x2
            kTuesday = 0x4
            kWednesday = 0x8
            kThursday = 0x10
            kFriday = 0x20
            kSaturday = 0x40
            kAway = 0x80

        class ScheduleModeBitmap(IntFlag):
            kHeatSetpointPresent = 0x1
            kCoolSetpointPresent = 0x2

    class Structs:
        @dataclass
        class PresetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetHandle", Tag=0, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="presetScenario", Tag=1, Type=Thermostat.Enums.PresetScenarioEnum),
                        ClusterObjectFieldDescriptor(Label="name", Tag=2, Type=typing.Union[None, Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="coolingSetpoint", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="heatingSetpoint", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="builtIn", Tag=5, Type=typing.Union[Nullable, bool]),
                    ])

            presetHandle: 'typing.Union[Nullable, bytes]' = NullValue
            presetScenario: 'Thermostat.Enums.PresetScenarioEnum' = 0
            name: 'typing.Union[None, Nullable, str]' = None
            coolingSetpoint: 'typing.Optional[uint]' = None
            heatingSetpoint: 'typing.Optional[uint]' = None
            builtIn: 'typing.Union[Nullable, bool]' = NullValue

        @dataclass
        class PresetTypeStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetScenario", Tag=0, Type=Thermostat.Enums.PresetScenarioEnum),
                        ClusterObjectFieldDescriptor(Label="numberOfPresets", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="presetTypeFeatures", Tag=2, Type=Thermostat.Bitmaps.PresetTypeFeaturesBitmap),
                    ])

            presetScenario: 'Thermostat.Enums.PresetScenarioEnum' = 0
            numberOfPresets: 'uint' = 0
            presetTypeFeatures: 'Thermostat.Bitmaps.PresetTypeFeaturesBitmap' = 0

        @dataclass
        class WeeklyScheduleTransitionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="heatSetpoint", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="coolSetpoint", Tag=2, Type=typing.Union[Nullable, uint]),
                    ])

            transitionTime: 'uint' = 0
            heatSetpoint: 'typing.Union[Nullable, uint]' = NullValue
            coolSetpoint: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class ScheduleStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="scheduleHandle", Tag=0, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="systemMode", Tag=1, Type=Thermostat.Enums.SystemModeEnum),
                        ClusterObjectFieldDescriptor(Label="name", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="presetHandle", Tag=3, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="transitions", Tag=4, Type=typing.List[typing.Optional[Thermostat.Structs.ScheduleTransitionStruct]]),
                        ClusterObjectFieldDescriptor(Label="builtIn", Tag=5, Type=typing.Union[Nullable, bool]),
                    ])

            scheduleHandle: 'typing.Union[Nullable, bytes]' = NullValue
            systemMode: 'Thermostat.Enums.SystemModeEnum' = 0
            name: 'typing.Optional[str]' = None
            presetHandle: 'typing.Optional[bytes]' = None
            transitions: 'typing.List[typing.Optional[Thermostat.Structs.ScheduleTransitionStruct]]' = field(default_factory=lambda: [])
            builtIn: 'typing.Union[Nullable, bool]' = NullValue

        @dataclass
        class ScheduleTransitionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="dayOfWeek", Tag=0, Type=Thermostat.Bitmaps.ScheduleDayOfWeekBitmap),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="presetHandle", Tag=2, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="systemMode", Tag=3, Type=typing.Optional[Thermostat.Enums.SystemModeEnum]),
                        ClusterObjectFieldDescriptor(Label="coolingSetpoint", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="heatingSetpoint", Tag=5, Type=typing.Optional[uint]),
                    ])

            dayOfWeek: 'Thermostat.Bitmaps.ScheduleDayOfWeekBitmap' = 0
            transitionTime: 'uint' = 0
            presetHandle: 'typing.Optional[bytes]' = None
            systemMode: 'typing.Optional[Thermostat.Enums.SystemModeEnum]' = None
            coolingSetpoint: 'typing.Optional[uint]' = None
            heatingSetpoint: 'typing.Optional[uint]' = None

        @dataclass
        class ScheduleTypeStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="systemMode", Tag=0, Type=Thermostat.Enums.SystemModeEnum),
                        ClusterObjectFieldDescriptor(Label="numberOfSchedules", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="scheduleTypeFeatures", Tag=2, Type=Thermostat.Bitmaps.ScheduleTypeFeaturesBitmap),
                    ])

            systemMode: 'Thermostat.Enums.SystemModeEnum' = 0
            numberOfSchedules: 'uint' = 0
            scheduleTypeFeatures: 'Thermostat.Bitmaps.ScheduleTypeFeaturesBitmap' = 0

    class Commands:
        @dataclass
        class SetpointRaiseLower(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mode", Tag=0, Type=Thermostat.Enums.SetpointRaiseLowerModeEnum),
                        ClusterObjectFieldDescriptor(Label="amount", Tag=1, Type=int),
                    ])

            mode: 'Thermostat.Enums.SetpointRaiseLowerModeEnum' = 0
            amount: 'int' = 0

        @dataclass
        class SetWeeklySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="numberOfTransitionsForSequence", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="dayOfWeekForSequence", Tag=1, Type=Thermostat.Bitmaps.ScheduleDayOfWeekBitmap),
                        ClusterObjectFieldDescriptor(Label="modeForSequence", Tag=2, Type=Thermostat.Bitmaps.ScheduleModeBitmap),
                        ClusterObjectFieldDescriptor(Label="transitions", Tag=3, Type=typing.List[typing.Optional[Thermostat.Structs.WeeklyScheduleTransitionStruct]]),
                    ])

            numberOfTransitionsForSequence: 'uint' = 0
            dayOfWeekForSequence: 'Thermostat.Bitmaps.ScheduleDayOfWeekBitmap' = 0
            modeForSequence: 'Thermostat.Bitmaps.ScheduleModeBitmap' = 0
            transitions: 'typing.List[typing.Optional[Thermostat.Structs.WeeklyScheduleTransitionStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class GetWeeklySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetWeeklyScheduleResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="daysToReturn", Tag=0, Type=Thermostat.Bitmaps.ScheduleDayOfWeekBitmap),
                        ClusterObjectFieldDescriptor(Label="modeToReturn", Tag=1, Type=Thermostat.Bitmaps.ScheduleModeBitmap),
                    ])

            daysToReturn: 'Thermostat.Bitmaps.ScheduleDayOfWeekBitmap' = 0
            modeToReturn: 'Thermostat.Bitmaps.ScheduleModeBitmap' = 0

        @dataclass
        class ClearWeeklySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SetActiveScheduleRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="scheduleHandle", Tag=0, Type=bytes),
                    ])

            scheduleHandle: 'bytes' = b""

        @dataclass
        class SetActivePresetRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetHandle", Tag=0, Type=typing.Union[Nullable, bytes]),
                    ])

            presetHandle: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class AtomicRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x000000FE
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'AtomicResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="requestType", Tag=0, Type=Globals.Enums.enum8),
                        ClusterObjectFieldDescriptor(Label="attributeRequests", Tag=1, Type=typing.List[typing.Optional[uint]]),
                        ClusterObjectFieldDescriptor(Label="timeout", Tag=2, Type=typing.Optional[uint]),
                    ])

            requestType: 'Globals.Enums.enum8' = 0
            attributeRequests: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])
            timeout: 'typing.Optional[uint]' = None

        @dataclass
        class GetWeeklyScheduleResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="numberOfTransitionsForSequence", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="dayOfWeekForSequence", Tag=1, Type=Thermostat.Bitmaps.ScheduleDayOfWeekBitmap),
                        ClusterObjectFieldDescriptor(Label="modeForSequence", Tag=2, Type=Thermostat.Bitmaps.ScheduleModeBitmap),
                        ClusterObjectFieldDescriptor(Label="transitions", Tag=3, Type=typing.List[typing.Optional[Thermostat.Structs.WeeklyScheduleTransitionStruct]]),
                    ])

            numberOfTransitionsForSequence: 'uint' = 0
            dayOfWeekForSequence: 'Thermostat.Bitmaps.ScheduleDayOfWeekBitmap' = 0
            modeForSequence: 'Thermostat.Bitmaps.ScheduleModeBitmap' = 0
            transitions: 'typing.List[typing.Optional[Thermostat.Structs.WeeklyScheduleTransitionStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class GetRelayStatusLogResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeOfDay", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="relayStatus", Tag=1, Type=Thermostat.Bitmaps.RelayStateBitmap),
                        ClusterObjectFieldDescriptor(Label="localTemperature", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="humidityInPercentage", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="setpoint", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="unreadEntries", Tag=5, Type=uint),
                    ])

            timeOfDay: 'uint' = 0
            relayStatus: 'Thermostat.Bitmaps.RelayStateBitmap' = 0
            localTemperature: 'typing.Union[Nullable, uint]' = NullValue
            humidityInPercentage: 'typing.Union[Nullable, uint]' = NullValue
            setpoint: 'uint' = 0
            unreadEntries: 'uint' = 0

        @dataclass
        class AtomicResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000201
            command_id: typing.ClassVar[int] = 0x000000FD
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="statusCode", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="attributeStatus", Tag=1, Type=typing.List[typing.Optional[Globals.Structs.struct]]),
                        ClusterObjectFieldDescriptor(Label="timeout", Tag=2, Type=typing.Optional[uint]),
                    ])

            statusCode: 'Globals.Enums.status' = 0
            attributeStatus: 'typing.List[typing.Optional[Globals.Structs.struct]]' = field(default_factory=lambda: [])
            timeout: 'typing.Optional[uint]' = None

    class Attributes:
        @dataclass
        class LocalTemperature(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class OutdoorTemperature(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Occupancy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Bitmaps.OccupancyBitmap])

            value: 'typing.Optional[Thermostat.Bitmaps.OccupancyBitmap]' = None

        @dataclass
        class AbsMinHeatSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AbsMaxHeatSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AbsMinCoolSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AbsMaxCoolSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PiCoolingDemand(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PiHeatingDemand(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class HvacSystemTypeConfiguration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Bitmaps.HVACSystemTypeBitmap])

            value: 'typing.Optional[Thermostat.Bitmaps.HVACSystemTypeBitmap]' = None

        @dataclass
        class LocalTemperatureCalibration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class OccupiedCoolingSetpoint(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class OccupiedHeatingSetpoint(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UnoccupiedCoolingSetpoint(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UnoccupiedHeatingSetpoint(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MinHeatSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MaxHeatSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MinCoolSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MaxCoolSetpointLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000018

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MinSetpointDeadBand(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000019

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RemoteSensing(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Bitmaps.RemoteSensingBitmap])

            value: 'typing.Optional[Thermostat.Bitmaps.RemoteSensingBitmap]' = None

        @dataclass
        class ControlSequenceOfOperation(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=Thermostat.Enums.ControlSequenceOfOperationEnum)

            value: 'Thermostat.Enums.ControlSequenceOfOperationEnum' = 0

        @dataclass
        class SystemMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=Thermostat.Enums.SystemModeEnum)

            value: 'Thermostat.Enums.SystemModeEnum' = 0

        @dataclass
        class ThermostatRunningMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.ThermostatRunningModeEnum])

            value: 'typing.Optional[Thermostat.Enums.ThermostatRunningModeEnum]' = None

        @dataclass
        class StartOfWeek(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000020

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.StartOfWeekEnum])

            value: 'typing.Optional[Thermostat.Enums.StartOfWeekEnum]' = None

        @dataclass
        class NumberOfWeeklyTransitions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfDailyTransitions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TemperatureSetpointHold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000023

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.TemperatureSetpointHoldEnum])

            value: 'typing.Optional[Thermostat.Enums.TemperatureSetpointHoldEnum]' = None

        @dataclass
        class TemperatureSetpointHoldDuration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ThermostatProgrammingOperationMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Bitmaps.ProgrammingOperationModeBitmap])

            value: 'typing.Optional[Thermostat.Bitmaps.ProgrammingOperationModeBitmap]' = None

        @dataclass
        class ThermostatRunningState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000029

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Bitmaps.RelayStateBitmap])

            value: 'typing.Optional[Thermostat.Bitmaps.RelayStateBitmap]' = None

        @dataclass
        class SetpointChangeSource(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.SetpointChangeSourceEnum])

            value: 'typing.Optional[Thermostat.Enums.SetpointChangeSourceEnum]' = None

        @dataclass
        class SetpointChangeAmount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class SetpointChangeSourceTimestamp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class OccupiedSetback(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000034

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class OccupiedSetbackMin(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class OccupiedSetbackMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class UnoccupiedSetback(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000037

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class UnoccupiedSetbackMin(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class UnoccupiedSetbackMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000039

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class EmergencyHeatDelta(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AcType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000040

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.ACTypeEnum])

            value: 'typing.Optional[Thermostat.Enums.ACTypeEnum]' = None

        @dataclass
        class AcCapacity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000041

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AcRefrigerantType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000042

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.ACRefrigerantTypeEnum])

            value: 'typing.Optional[Thermostat.Enums.ACRefrigerantTypeEnum]' = None

        @dataclass
        class AcCompressorType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000043

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.ACCompressorTypeEnum])

            value: 'typing.Optional[Thermostat.Enums.ACCompressorTypeEnum]' = None

        @dataclass
        class AcErrorCode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000044

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Bitmaps.ACErrorCodeBitmap])

            value: 'typing.Optional[Thermostat.Bitmaps.ACErrorCodeBitmap]' = None

        @dataclass
        class AcLouverPosition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000045

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.ACLouverPositionEnum])

            value: 'typing.Optional[Thermostat.Enums.ACLouverPositionEnum]' = None

        @dataclass
        class AcCoilTemperature(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class AcCapacityFormat(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000047

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Thermostat.Enums.ACCapacityFormatEnum])

            value: 'typing.Optional[Thermostat.Enums.ACCapacityFormatEnum]' = None

        @dataclass
        class PresetTypes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000048

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetTypeStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetTypeStruct]]]' = None

        @dataclass
        class ScheduleTypes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000049

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleTypeStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleTypeStruct]]]' = None

        @dataclass
        class NumberOfPresets(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000004A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfSchedules(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000004B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfScheduleTransitions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000004C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfScheduleTransitionPerDay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000004D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ActivePresetHandle(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000004E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: 'typing.Union[None, Nullable, bytes]' = None

        @dataclass
        class ActiveScheduleHandle(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000004F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: 'typing.Union[None, Nullable, bytes]' = None

        @dataclass
        class Presets(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000050

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.PresetStruct]]]' = None

        @dataclass
        class Schedules(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000051

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[Thermostat.Structs.ScheduleStruct]]]' = None

        @dataclass
        class SetpointHoldExpiryTimestamp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000052

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF8

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: 'typing.List[uint]' = field(default_factory=lambda: [])

        @dataclass
        class AcceptedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: 'typing.List[uint]' = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFB

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: 'typing.List[uint]' = field(default_factory=lambda: [])

        @dataclass
        class FeatureMap(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFC

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class ClusterRevision(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000201

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
