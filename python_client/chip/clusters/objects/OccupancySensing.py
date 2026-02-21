"""OccupancySensing cluster definition (auto-generated, DO NOT edit)."""

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
class OccupancySensing(Cluster):
    id: typing.ClassVar[int] = 0x00000406

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="occupancy", Tag=0x00000000, Type=OccupancySensing.Bitmaps.OccupancyBitmap),
                ClusterObjectFieldDescriptor(Label="occupancySensorType", Tag=0x00000001, Type=OccupancySensing.Enums.OccupancySensorTypeEnum),
                ClusterObjectFieldDescriptor(Label="occupancySensorTypeBitmap", Tag=0x00000002, Type=OccupancySensing.Bitmaps.OccupancySensorTypeBitmap),
                ClusterObjectFieldDescriptor(Label="holdTime", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="holdTimeLimits", Tag=0x00000004, Type=typing.Optional[OccupancySensing.Structs.HoldTimeLimitsStruct]),
                ClusterObjectFieldDescriptor(Label="pirOccupiedToUnoccupiedDelay", Tag=0x00000010, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="pirUnoccupiedToOccupiedDelay", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="pirUnoccupiedToOccupiedThreshold", Tag=0x00000012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ultrasonicOccupiedToUnoccupiedDelay", Tag=0x00000020, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ultrasonicUnoccupiedToOccupiedDelay", Tag=0x00000021, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ultrasonicUnoccupiedToOccupiedThreshold", Tag=0x00000022, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="physicalContactOccupiedToUnoccupiedDelay", Tag=0x00000030, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="physicalContactUnoccupiedToOccupiedDelay", Tag=0x00000031, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="physicalContactUnoccupiedToOccupiedThreshold", Tag=0x00000032, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    occupancy: 'OccupancySensing.Bitmaps.OccupancyBitmap' = 0
    occupancySensorType: 'OccupancySensing.Enums.OccupancySensorTypeEnum' = 0
    occupancySensorTypeBitmap: 'OccupancySensing.Bitmaps.OccupancySensorTypeBitmap' = 0
    holdTime: 'typing.Optional[uint]' = None
    holdTimeLimits: 'typing.Optional[OccupancySensing.Structs.HoldTimeLimitsStruct]' = None
    pirOccupiedToUnoccupiedDelay: 'typing.Optional[uint]' = None
    pirUnoccupiedToOccupiedDelay: 'typing.Optional[uint]' = None
    pirUnoccupiedToOccupiedThreshold: 'typing.Optional[uint]' = None
    ultrasonicOccupiedToUnoccupiedDelay: 'typing.Optional[uint]' = None
    ultrasonicUnoccupiedToOccupiedDelay: 'typing.Optional[uint]' = None
    ultrasonicUnoccupiedToOccupiedThreshold: 'typing.Optional[uint]' = None
    physicalContactOccupiedToUnoccupiedDelay: 'typing.Optional[uint]' = None
    physicalContactUnoccupiedToOccupiedDelay: 'typing.Optional[uint]' = None
    physicalContactUnoccupiedToOccupiedThreshold: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class OccupancySensorTypeEnum(MatterIntEnum):
            kPir = 0x00
            kUltrasonic = 0x01
            kPirAndUltrasonic = 0x02
            kPhysicalContact = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

    class Bitmaps:
        class Feature(IntFlag):
            kOther = 0x1
            kPassiveInfrared = 0x2
            kUltrasonic = 0x4
            kPhysicalContact = 0x8
            kActiveInfrared = 0x10
            kRadar = 0x20
            kRfSensing = 0x40
            kVision = 0x80

        class OccupancyBitmap(IntFlag):
            kOccupied = 0x1

        class OccupancySensorTypeBitmap(IntFlag):
            kPir = 0x1
            kUltrasonic = 0x2
            kPhysicalContact = 0x4

    class Structs:
        @dataclass
        class HoldTimeLimitsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="holdTimeMin", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="holdTimeMax", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="holdTimeDefault", Tag=2, Type=uint),
                    ])

            holdTimeMin: 'uint' = 0
            holdTimeMax: 'uint' = 0
            holdTimeDefault: 'uint' = 0

    class Attributes:
        @dataclass
        class Occupancy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OccupancySensing.Bitmaps.OccupancyBitmap)

            value: 'OccupancySensing.Bitmaps.OccupancyBitmap' = 0

        @dataclass
        class OccupancySensorType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OccupancySensing.Enums.OccupancySensorTypeEnum)

            value: 'OccupancySensing.Enums.OccupancySensorTypeEnum' = 0

        @dataclass
        class OccupancySensorTypeBitmap(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OccupancySensing.Bitmaps.OccupancySensorTypeBitmap)

            value: 'OccupancySensing.Bitmaps.OccupancySensorTypeBitmap' = 0

        @dataclass
        class HoldTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class HoldTimeLimits(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[OccupancySensing.Structs.HoldTimeLimitsStruct])

            value: 'typing.Optional[OccupancySensing.Structs.HoldTimeLimitsStruct]' = None

        @dataclass
        class PirOccupiedToUnoccupiedDelay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PirUnoccupiedToOccupiedDelay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PirUnoccupiedToOccupiedThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UltrasonicOccupiedToUnoccupiedDelay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000020

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UltrasonicUnoccupiedToOccupiedDelay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UltrasonicUnoccupiedToOccupiedThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PhysicalContactOccupiedToUnoccupiedDelay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PhysicalContactUnoccupiedToOccupiedDelay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PhysicalContactUnoccupiedToOccupiedThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

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
                return 0x00000406

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
                return 0x00000406

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
                return 0x00000406

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
                return 0x00000406

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class OccupancyChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000406

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="occupancy", Tag=0, Type=OccupancySensing.Bitmaps.OccupancyBitmap),
                    ])

            occupancy: 'OccupancySensing.Bitmaps.OccupancyBitmap' = 0
