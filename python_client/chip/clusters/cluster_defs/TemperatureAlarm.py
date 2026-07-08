"""TemperatureAlarm cluster definition (auto-generated, DO NOT edit)."""

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
class TemperatureAlarm(Cluster):
    id: typing.ClassVar[int] = 0x00000064

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="mask", Tag=0x00000000, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                ClusterObjectFieldDescriptor(Label="latch", Tag=0x00000001, Type=typing.Optional[TemperatureAlarm.Bitmaps.AlarmBitmap]),
                ClusterObjectFieldDescriptor(Label="state", Tag=0x00000002, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                ClusterObjectFieldDescriptor(Label="supported", Tag=0x00000003, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                ClusterObjectFieldDescriptor(Label="criticalOverTemperatureThreshold", Tag=0x00000080, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="majorOverTemperatureThreshold", Tag=0x00000081, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="minorOverTemperatureThreshold", Tag=0x00000082, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="minorUnderTemperatureThreshold", Tag=0x00000083, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="majorUnderTemperatureThreshold", Tag=0x00000084, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="criticalUnderTemperatureThreshold", Tag=0x00000085, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    mask: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
    latch: typing.Optional[TemperatureAlarm.Bitmaps.AlarmBitmap] = None
    state: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
    supported: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
    criticalOverTemperatureThreshold: typing.Optional[int] = None
    majorOverTemperatureThreshold: typing.Optional[int] = None
    minorOverTemperatureThreshold: typing.Optional[int] = None
    minorUnderTemperatureThreshold: typing.Optional[int] = None
    majorUnderTemperatureThreshold: typing.Optional[int] = None
    criticalUnderTemperatureThreshold: typing.Optional[int] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Bitmaps:
        class Feature(IntFlag):
            kOverTemperature = 0x100000
            kUnderTemperature = 0x200000
            kMajorThreshold = 0x400000
            kMinorThreshold = 0x800000
            kOverCriticalAdjustable = 0x1000000
            kOverMajorAdjustable = 0x2000000
            kOverMinorAdjustable = 0x4000000
            kUnderMinorAdjustable = 0x8000000
            kUnderMajorAdjustable = 0x10000000
            kUnderCriticalAdjustable = 0x20000000
            kReset = 0x1

        class AlarmBitmap(IntFlag):
            kCriticalOverTemperatureAlarm = 0x1
            kMajorOverTemperatureAlarm = 0x2
            kMinorOverTemperatureAlarm = 0x4
            kMinorUnderTemperatureAlarm = 0x8
            kMajorUnderTemperatureAlarm = 0x10
            kCriticalUnderTemperatureAlarm = 0x20

    class Commands:
        @dataclass
        class SetTemperatureAlarmThresholds(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000064
            command_id: typing.ClassVar[int] = 0x00000080
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="criticalOverTemperatureThreshold", Tag=0, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="majorOverTemperatureThreshold", Tag=1, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="minorOverTemperatureThreshold", Tag=2, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="minorUnderTemperatureThreshold", Tag=3, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="majorUnderTemperatureThreshold", Tag=4, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="criticalUnderTemperatureThreshold", Tag=5, Type=typing.Optional[int]),
                    ])

            criticalOverTemperatureThreshold: typing.Optional[int] = None
            majorOverTemperatureThreshold: typing.Optional[int] = None
            minorOverTemperatureThreshold: typing.Optional[int] = None
            minorUnderTemperatureThreshold: typing.Optional[int] = None
            majorUnderTemperatureThreshold: typing.Optional[int] = None
            criticalUnderTemperatureThreshold: typing.Optional[int] = None

        @dataclass
        class Reset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000064
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarms", Tag=0, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                    ])

            alarms: TemperatureAlarm.Bitmaps.AlarmBitmap = 0

        @dataclass
        class ModifyEnabledAlarms(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000064
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mask", Tag=0, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                    ])

            mask: TemperatureAlarm.Bitmaps.AlarmBitmap = 0

    class Attributes:
        @dataclass
        class Mask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=TemperatureAlarm.Bitmaps.AlarmBitmap)

            value: TemperatureAlarm.Bitmaps.AlarmBitmap = 0

        @dataclass
        class Latch(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[TemperatureAlarm.Bitmaps.AlarmBitmap])

            value: typing.Optional[TemperatureAlarm.Bitmaps.AlarmBitmap] = None

        @dataclass
        class State(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=TemperatureAlarm.Bitmaps.AlarmBitmap)

            value: TemperatureAlarm.Bitmaps.AlarmBitmap = 0

        @dataclass
        class Supported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=TemperatureAlarm.Bitmaps.AlarmBitmap)

            value: TemperatureAlarm.Bitmaps.AlarmBitmap = 0

        @dataclass
        class CriticalOverTemperatureThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class MajorOverTemperatureThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000081

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class MinorOverTemperatureThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000082

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class MinorUnderTemperatureThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000083

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class MajorUnderTemperatureThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000084

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class CriticalUnderTemperatureThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000085

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

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
                return 0x00000064

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
                return 0x00000064

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
                return 0x00000064

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
                return 0x00000064

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
                return 0x00000064

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class Notify(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000064

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="active", Tag=0, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                        ClusterObjectFieldDescriptor(Label="inactive", Tag=1, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                        ClusterObjectFieldDescriptor(Label="state", Tag=2, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                        ClusterObjectFieldDescriptor(Label="mask", Tag=3, Type=TemperatureAlarm.Bitmaps.AlarmBitmap),
                    ])

            active: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
            inactive: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
            state: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
            mask: TemperatureAlarm.Bitmaps.AlarmBitmap = 0
