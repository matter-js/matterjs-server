"""WaterHeaterManagement cluster definition (auto-generated, DO NOT edit)."""

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
class WaterHeaterManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000094

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="heaterTypes", Tag=0x00000000, Type=WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap),
                ClusterObjectFieldDescriptor(Label="heatDemand", Tag=0x00000001, Type=WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap),
                ClusterObjectFieldDescriptor(Label="tankVolume", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="estimatedHeatRequired", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="tankPercentage", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="boostState", Tag=0x00000005, Type=WaterHeaterManagement.Enums.BoostStateEnum),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    heaterTypes: 'WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap' = 0
    heatDemand: 'WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap' = 0
    tankVolume: 'typing.Optional[uint]' = None
    estimatedHeatRequired: 'typing.Optional[uint]' = None
    tankPercentage: 'typing.Optional[uint]' = None
    boostState: 'WaterHeaterManagement.Enums.BoostStateEnum' = 0
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class BoostStateEnum(MatterIntEnum):
            kInactive = 0x00
            kActive = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2


    class Bitmaps:
        class Feature(IntFlag):
            kEnergyManagement = 0x1
            kTankPercent = 0x2

        class WaterHeaterHeatSourceBitmap(IntFlag):
            kImmersionElement1 = 0x1
            kImmersionElement2 = 0x2
            kHeatPump = 0x4
            kBoiler = 0x8
            kOther = 0x10


    class Structs:
        @dataclass
        class WaterHeaterBoostInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="duration", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="oneShot", Tag=1, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="emergencyBoost", Tag=2, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="temporarySetpoint", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="targetPercentage", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="targetReheat", Tag=5, Type=typing.Optional[uint]),
                    ])

            duration: 'uint' = 0
            oneShot: 'typing.Optional[bool]' = None
            emergencyBoost: 'typing.Optional[bool]' = None
            temporarySetpoint: 'typing.Optional[uint]' = None
            targetPercentage: 'typing.Optional[uint]' = None
            targetReheat: 'typing.Optional[uint]' = None


    class Commands:
        @dataclass
        class Boost(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000094
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="boostInfo", Tag=0, Type=WaterHeaterManagement.Structs.WaterHeaterBoostInfoStruct),
                    ])

            boostInfo: 'WaterHeaterManagement.Structs.WaterHeaterBoostInfoStruct' = field(default_factory=lambda: WaterHeaterManagement.Structs.WaterHeaterBoostInfoStruct())

        @dataclass
        class CancelBoost(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000094
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass


    class Attributes:
        @dataclass
        class HeaterTypes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap)

            value: 'WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap' = 0

        @dataclass
        class HeatDemand(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap)

            value: 'WaterHeaterManagement.Bitmaps.WaterHeaterHeatSourceBitmap' = 0

        @dataclass
        class TankVolume(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class EstimatedHeatRequired(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TankPercentage(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class BoostState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WaterHeaterManagement.Enums.BoostStateEnum)

            value: 'WaterHeaterManagement.Enums.BoostStateEnum' = 0

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

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
                return 0x00000094

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
                return 0x00000094

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
                return 0x00000094

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
                return 0x00000094

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class BoostStarted(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="boostInfo", Tag=0, Type=WaterHeaterManagement.Structs.WaterHeaterBoostInfoStruct),
                    ])

            boostInfo: 'WaterHeaterManagement.Structs.WaterHeaterBoostInfoStruct' = field(default_factory=lambda: WaterHeaterManagement.Structs.WaterHeaterBoostInfoStruct())

        @dataclass
        class BoostEnded(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000094

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

