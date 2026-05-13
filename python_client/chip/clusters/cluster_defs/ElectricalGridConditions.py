"""ElectricalGridConditions cluster definition (auto-generated, DO NOT edit)."""

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
class ElectricalGridConditions(Cluster):
    id: typing.ClassVar[int] = 0x000000A0

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="localGenerationAvailable", Tag=0x00000000, Type=typing.Union[Nullable, bool]),
                ClusterObjectFieldDescriptor(Label="currentConditions", Tag=0x00000001, Type=typing.Union[Nullable, ElectricalGridConditions.Structs.ElectricalGridConditionsStruct]),
                ClusterObjectFieldDescriptor(Label="forecastConditions", Tag=0x00000002, Type=typing.Optional[typing.List[ElectricalGridConditions.Structs.ElectricalGridConditionsStruct]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    localGenerationAvailable: typing.Union[Nullable, bool] = NullValue
    currentConditions: typing.Union[Nullable, ElectricalGridConditions.Structs.ElectricalGridConditionsStruct] = NullValue
    forecastConditions: typing.Optional[typing.List[ElectricalGridConditions.Structs.ElectricalGridConditionsStruct]] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class ThreeLevelEnum(MatterIntEnum):
            kLow = 0x00
            kMedium = 0x01
            kHigh = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class Feature(IntFlag):
            kForecasting = 0x1

    class Structs:
        @dataclass
        class ElectricalGridConditionsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="periodStart", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="periodEnd", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="gridCarbonIntensity", Tag=2, Type=int),
                        ClusterObjectFieldDescriptor(Label="gridCarbonLevel", Tag=3, Type=ElectricalGridConditions.Enums.ThreeLevelEnum),
                        ClusterObjectFieldDescriptor(Label="localCarbonIntensity", Tag=4, Type=int),
                        ClusterObjectFieldDescriptor(Label="localCarbonLevel", Tag=5, Type=ElectricalGridConditions.Enums.ThreeLevelEnum),
                    ])

            periodStart: uint = 0
            periodEnd: typing.Union[Nullable, uint] = NullValue
            gridCarbonIntensity: int = 0
            gridCarbonLevel: ElectricalGridConditions.Enums.ThreeLevelEnum = 0
            localCarbonIntensity: int = 0
            localCarbonLevel: ElectricalGridConditions.Enums.ThreeLevelEnum = 0

    class Attributes:
        @dataclass
        class LocalGenerationAvailable(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, bool])

            value: typing.Union[Nullable, bool] = NullValue

        @dataclass
        class CurrentConditions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, ElectricalGridConditions.Structs.ElectricalGridConditionsStruct])

            value: typing.Union[Nullable, ElectricalGridConditions.Structs.ElectricalGridConditionsStruct] = NullValue

        @dataclass
        class ForecastConditions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[ElectricalGridConditions.Structs.ElectricalGridConditionsStruct]])

            value: typing.Optional[typing.List[ElectricalGridConditions.Structs.ElectricalGridConditionsStruct]] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF8

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AcceptedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class EventList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFA

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFB

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class FeatureMap(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFC

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class ClusterRevision(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class CurrentConditionsChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x000000A0

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="currentConditions", Tag=0, Type=typing.Union[Nullable, ElectricalGridConditions.Structs.ElectricalGridConditionsStruct]),
                    ])

            currentConditions: typing.Union[Nullable, ElectricalGridConditions.Structs.ElectricalGridConditionsStruct] = NullValue
