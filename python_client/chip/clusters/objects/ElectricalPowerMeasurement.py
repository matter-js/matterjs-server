"""ElectricalPowerMeasurement cluster definition (auto-generated, DO NOT edit)."""

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
class ElectricalPowerMeasurement(Cluster):
    id: typing.ClassVar[int] = 0x00000090

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="powerMode", Tag=0x00000000, Type=ElectricalPowerMeasurement.Enums.PowerModeEnum),
                ClusterObjectFieldDescriptor(Label="numberOfMeasurementTypes", Tag=0x00000001, Type=uint),
                ClusterObjectFieldDescriptor(Label="accuracy", Tag=0x00000002, Type=typing.List[typing.Optional[Globals.Structs.MeasurementAccuracyStruct]]),
                ClusterObjectFieldDescriptor(Label="ranges", Tag=0x00000003, Type=typing.Optional[typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.MeasurementRangeStruct]]]),
                ClusterObjectFieldDescriptor(Label="voltage", Tag=0x00000004, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="activeCurrent", Tag=0x00000005, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="reactiveCurrent", Tag=0x00000006, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="apparentCurrent", Tag=0x00000007, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="activePower", Tag=0x00000008, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="reactivePower", Tag=0x00000009, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="apparentPower", Tag=0x0000000A, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="rmsVoltage", Tag=0x0000000B, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="rmsCurrent", Tag=0x0000000C, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="rmsPower", Tag=0x0000000D, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="frequency", Tag=0x0000000E, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="harmonicCurrents", Tag=0x0000000F, Type=typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]]),
                ClusterObjectFieldDescriptor(Label="harmonicPhases", Tag=0x00000010, Type=typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]]),
                ClusterObjectFieldDescriptor(Label="powerFactor", Tag=0x00000011, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="neutralCurrent", Tag=0x00000012, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    powerMode: 'ElectricalPowerMeasurement.Enums.PowerModeEnum' = 0
    numberOfMeasurementTypes: 'uint' = 0
    accuracy: 'typing.List[typing.Optional[Globals.Structs.MeasurementAccuracyStruct]]' = field(default_factory=lambda: [])
    ranges: 'typing.Optional[typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.MeasurementRangeStruct]]]' = None
    voltage: 'typing.Union[None, Nullable, uint]' = None
    activeCurrent: 'typing.Union[None, Nullable, uint]' = None
    reactiveCurrent: 'typing.Union[None, Nullable, uint]' = None
    apparentCurrent: 'typing.Union[None, Nullable, uint]' = None
    activePower: 'typing.Union[Nullable, uint]' = NullValue
    reactivePower: 'typing.Union[None, Nullable, uint]' = None
    apparentPower: 'typing.Union[None, Nullable, uint]' = None
    rmsVoltage: 'typing.Union[None, Nullable, uint]' = None
    rmsCurrent: 'typing.Union[None, Nullable, uint]' = None
    rmsPower: 'typing.Union[None, Nullable, uint]' = None
    frequency: 'typing.Union[None, Nullable, int]' = None
    harmonicCurrents: 'typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]]' = None
    harmonicPhases: 'typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]]' = None
    powerFactor: 'typing.Union[None, Nullable, int]' = None
    neutralCurrent: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class PowerModeEnum(MatterIntEnum):
            kUnknown = 0x00
            kDc = 0x01
            kAc = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class MeasurementTypeEnum(MatterIntEnum):
            kUnspecified = 0x00
            kVoltage = 0x01
            kActiveCurrent = 0x02
            kReactiveCurrent = 0x03
            kApparentCurrent = 0x04
            kActivePower = 0x05
            kReactivePower = 0x06
            kApparentPower = 0x07
            kRmsVoltage = 0x08
            kRmsCurrent = 0x09
            kRmsPower = 0x0A
            kFrequency = 0x0B
            kPowerFactor = 0x0C
            kNeutralCurrent = 0x0D
            kElectricalEnergy = 0x0E
            kReactiveEnergy = 0x0F
            kApparentEnergy = 0x10
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 17

    class Bitmaps:
        class Feature(IntFlag):
            kDirectCurrent = 0x1
            kAlternatingCurrent = 0x2
            kPolyphasePower = 0x4
            kHarmonics = 0x8
            kPowerQuality = 0x10

    class Structs:
        @dataclass
        class MeasurementRangeStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="measurementType", Tag=0, Type=ElectricalPowerMeasurement.Enums.MeasurementTypeEnum),
                        ClusterObjectFieldDescriptor(Label="min", Tag=1, Type=int),
                        ClusterObjectFieldDescriptor(Label="max", Tag=2, Type=int),
                        ClusterObjectFieldDescriptor(Label="startTimestamp", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endTimestamp", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="minTimestamp", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maxTimestamp", Tag=6, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="startSystime", Tag=7, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endSystime", Tag=8, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="minSystime", Tag=9, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maxSystime", Tag=10, Type=typing.Optional[uint]),
                    ])

            measurementType: 'ElectricalPowerMeasurement.Enums.MeasurementTypeEnum' = 0
            min: 'int' = 0
            max: 'int' = 0
            startTimestamp: 'typing.Optional[uint]' = None
            endTimestamp: 'typing.Optional[uint]' = None
            minTimestamp: 'typing.Optional[uint]' = None
            maxTimestamp: 'typing.Optional[uint]' = None
            startSystime: 'typing.Optional[uint]' = None
            endSystime: 'typing.Optional[uint]' = None
            minSystime: 'typing.Optional[uint]' = None
            maxSystime: 'typing.Optional[uint]' = None

        @dataclass
        class HarmonicMeasurementStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="order", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="measurement", Tag=1, Type=typing.Union[Nullable, int]),
                    ])

            order: 'uint' = 0
            measurement: 'typing.Union[Nullable, int]' = NullValue

    class Attributes:
        @dataclass
        class PowerMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=ElectricalPowerMeasurement.Enums.PowerModeEnum)

            value: 'ElectricalPowerMeasurement.Enums.PowerModeEnum' = 0

        @dataclass
        class NumberOfMeasurementTypes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class Accuracy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[Globals.Structs.MeasurementAccuracyStruct]])

            value: 'typing.List[typing.Optional[Globals.Structs.MeasurementAccuracyStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class Ranges(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.MeasurementRangeStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.MeasurementRangeStruct]]]' = None

        @dataclass
        class Voltage(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ActiveCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ReactiveCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ApparentCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ActivePower(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class ReactivePower(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ApparentPower(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class RmsVoltage(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class RmsCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class RmsPower(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Frequency(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class HarmonicCurrents(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]])

            value: 'typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]]' = None

        @dataclass
        class HarmonicPhases(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]])

            value: 'typing.Union[None, Nullable, typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.HarmonicMeasurementStruct]]]' = None

        @dataclass
        class PowerFactor(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class NeutralCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

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
                return 0x00000090

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
                return 0x00000090

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
                return 0x00000090

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
                return 0x00000090

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class MeasurementPeriodRanges(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000090

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ranges", Tag=0, Type=typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.MeasurementRangeStruct]]),
                    ])

            ranges: 'typing.List[typing.Optional[ElectricalPowerMeasurement.Structs.MeasurementRangeStruct]]' = field(default_factory=lambda: [])
