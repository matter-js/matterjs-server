"""FanControl cluster definition (auto-generated, DO NOT edit)."""

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


@dataclass
class FanControl(Cluster):
    id: typing.ClassVar[int] = 0x00000202

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="fanMode", Tag=0x00000000, Type=FanControl.Enums.FanModeEnum),
                ClusterObjectFieldDescriptor(Label="fanModeSequence", Tag=0x00000001, Type=FanControl.Enums.FanModeSequenceEnum),
                ClusterObjectFieldDescriptor(Label="percentSetting", Tag=0x00000002, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="percentCurrent", Tag=0x00000003, Type=uint),
                ClusterObjectFieldDescriptor(Label="speedMax", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="speedSetting", Tag=0x00000005, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="speedCurrent", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rockSupport", Tag=0x00000007, Type=typing.Optional[FanControl.Bitmaps.RockBitmap]),
                ClusterObjectFieldDescriptor(Label="rockSetting", Tag=0x00000008, Type=typing.Optional[FanControl.Bitmaps.RockBitmap]),
                ClusterObjectFieldDescriptor(Label="windSupport", Tag=0x00000009, Type=typing.Optional[FanControl.Bitmaps.WindBitmap]),
                ClusterObjectFieldDescriptor(Label="windSetting", Tag=0x0000000A, Type=typing.Optional[FanControl.Bitmaps.WindBitmap]),
                ClusterObjectFieldDescriptor(Label="airflowDirection", Tag=0x0000000B, Type=typing.Optional[FanControl.Enums.AirflowDirectionEnum]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    fanMode: 'FanControl.Enums.FanModeEnum' = 0
    fanModeSequence: 'FanControl.Enums.FanModeSequenceEnum' = 0
    percentSetting: 'typing.Union[Nullable, uint]' = NullValue
    percentCurrent: 'uint' = 0
    speedMax: 'typing.Optional[uint]' = None
    speedSetting: 'typing.Union[None, Nullable, uint]' = None
    speedCurrent: 'typing.Optional[uint]' = None
    rockSupport: 'typing.Optional[FanControl.Bitmaps.RockBitmap]' = None
    rockSetting: 'typing.Optional[FanControl.Bitmaps.RockBitmap]' = None
    windSupport: 'typing.Optional[FanControl.Bitmaps.WindBitmap]' = None
    windSetting: 'typing.Optional[FanControl.Bitmaps.WindBitmap]' = None
    airflowDirection: 'typing.Optional[FanControl.Enums.AirflowDirectionEnum]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StepDirectionEnum(MatterIntEnum):
            kIncrease = 0x00
            kDecrease = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class AirflowDirectionEnum(MatterIntEnum):
            kForward = 0x00
            kReverse = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class FanModeEnum(MatterIntEnum):
            kOff = 0x00
            kLow = 0x01
            kMedium = 0x02
            kHigh = 0x03
            kOn = 0x04
            kAuto = 0x05
            kSmart = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

        class FanModeSequenceEnum(MatterIntEnum):
            kOffLowMedHigh = 0x00
            kOffLowHigh = 0x01
            kOffLowMedHighAuto = 0x02
            kOffLowHighAuto = 0x03
            kOffHighAuto = 0x04
            kOffHigh = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6


    class Bitmaps:
        class Feature(IntFlag):
            kMultiSpeed = 0x1
            kAuto = 0x2
            kRocking = 0x4
            kWind = 0x8
            kStep = 0x10
            kAirflowDirection = 0x20

        class RockBitmap(IntFlag):
            kRockLeftRight = 0x1
            kRockUpDown = 0x2
            kRockRound = 0x4

        class WindBitmap(IntFlag):
            kSleepWind = 0x1
            kNaturalWind = 0x2


    class Commands:
        @dataclass
        class Step(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000202
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="direction", Tag=0, Type=FanControl.Enums.StepDirectionEnum),
                        ClusterObjectFieldDescriptor(Label="wrap", Tag=1, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="lowestOff", Tag=2, Type=typing.Optional[bool]),
                    ])

            direction: 'FanControl.Enums.StepDirectionEnum' = 0
            wrap: 'typing.Optional[bool]' = None
            lowestOff: 'typing.Optional[bool]' = None


    class Attributes:
        @dataclass
        class FanMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=FanControl.Enums.FanModeEnum)

            value: 'FanControl.Enums.FanModeEnum' = 0

        @dataclass
        class FanModeSequence(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=FanControl.Enums.FanModeSequenceEnum)

            value: 'FanControl.Enums.FanModeSequenceEnum' = 0

        @dataclass
        class PercentSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class PercentCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class SpeedMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SpeedSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class SpeedCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RockSupport(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[FanControl.Bitmaps.RockBitmap])

            value: 'typing.Optional[FanControl.Bitmaps.RockBitmap]' = None

        @dataclass
        class RockSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[FanControl.Bitmaps.RockBitmap])

            value: 'typing.Optional[FanControl.Bitmaps.RockBitmap]' = None

        @dataclass
        class WindSupport(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[FanControl.Bitmaps.WindBitmap])

            value: 'typing.Optional[FanControl.Bitmaps.WindBitmap]' = None

        @dataclass
        class WindSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[FanControl.Bitmaps.WindBitmap])

            value: 'typing.Optional[FanControl.Bitmaps.WindBitmap]' = None

        @dataclass
        class AirflowDirection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[FanControl.Enums.AirflowDirectionEnum])

            value: 'typing.Optional[FanControl.Enums.AirflowDirectionEnum]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000202

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
                return 0x00000202

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
                return 0x00000202

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
                return 0x00000202

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
                return 0x00000202

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

