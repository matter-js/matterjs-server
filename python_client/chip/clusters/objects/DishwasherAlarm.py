"""DishwasherAlarm cluster definition (auto-generated, DO NOT edit)."""

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
class DishwasherAlarm(Cluster):
    id: typing.ClassVar[int] = 0x0000005D

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="mask", Tag=0x00000000, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                ClusterObjectFieldDescriptor(Label="latch", Tag=0x00000001, Type=typing.Optional[DishwasherAlarm.Bitmaps.AlarmBitmap]),
                ClusterObjectFieldDescriptor(Label="state", Tag=0x00000002, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                ClusterObjectFieldDescriptor(Label="supported", Tag=0x00000003, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    mask: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0
    latch: 'typing.Optional[DishwasherAlarm.Bitmaps.AlarmBitmap]' = None
    state: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0
    supported: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Bitmaps:
        class Feature(IntFlag):
            kReset = 0x1

        class AlarmBitmap(IntFlag):
            kInflowError = 0x1
            kDrainError = 0x2
            kDoorError = 0x4
            kTempTooLow = 0x8
            kTempTooHigh = 0x10
            kWaterLevelError = 0x20


    class Commands:
        @dataclass
        class Reset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000005D
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarms", Tag=0, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                    ])

            alarms: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0

        @dataclass
        class ModifyEnabledAlarms(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000005D
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mask", Tag=0, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                    ])

            mask: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0


    class Attributes:
        @dataclass
        class Mask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005D

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DishwasherAlarm.Bitmaps.AlarmBitmap)

            value: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0

        @dataclass
        class Latch(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005D

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DishwasherAlarm.Bitmaps.AlarmBitmap])

            value: 'typing.Optional[DishwasherAlarm.Bitmaps.AlarmBitmap]' = None

        @dataclass
        class State(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005D

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DishwasherAlarm.Bitmaps.AlarmBitmap)

            value: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0

        @dataclass
        class Supported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005D

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DishwasherAlarm.Bitmaps.AlarmBitmap)

            value: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005D

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
                return 0x0000005D

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
                return 0x0000005D

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
                return 0x0000005D

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
                return 0x0000005D

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class Notify(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005D

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="active", Tag=0, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                        ClusterObjectFieldDescriptor(Label="inactive", Tag=1, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                        ClusterObjectFieldDescriptor(Label="state", Tag=2, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                        ClusterObjectFieldDescriptor(Label="mask", Tag=3, Type=DishwasherAlarm.Bitmaps.AlarmBitmap),
                    ])

            active: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0
            inactive: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0
            state: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0
            mask: 'DishwasherAlarm.Bitmaps.AlarmBitmap' = 0

