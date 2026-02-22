"""BooleanStateConfiguration cluster definition (auto-generated, DO NOT edit)."""

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
class BooleanStateConfiguration(Cluster):
    id: typing.ClassVar[int] = 0x00000080

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="currentSensitivityLevel", Tag=0x00000000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="supportedSensitivityLevels", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="defaultSensitivityLevel", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="alarmsActive", Tag=0x00000003, Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]),
                ClusterObjectFieldDescriptor(Label="alarmsSuppressed", Tag=0x00000004, Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]),
                ClusterObjectFieldDescriptor(Label="alarmsEnabled", Tag=0x00000005, Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]),
                ClusterObjectFieldDescriptor(Label="alarmsSupported", Tag=0x00000006, Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]),
                ClusterObjectFieldDescriptor(Label="sensorFault", Tag=0x00000007, Type=typing.Optional[BooleanStateConfiguration.Bitmaps.SensorFaultBitmap]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    currentSensitivityLevel: 'typing.Optional[uint]' = None
    supportedSensitivityLevels: 'typing.Optional[uint]' = None
    defaultSensitivityLevel: 'typing.Optional[uint]' = None
    alarmsActive: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None
    alarmsSuppressed: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None
    alarmsEnabled: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None
    alarmsSupported: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None
    sensorFault: 'typing.Optional[BooleanStateConfiguration.Bitmaps.SensorFaultBitmap]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Bitmaps:
        class Feature(IntFlag):
            kVisual = 0x1
            kAudible = 0x2
            kAlarmSuppress = 0x4
            kSensitivityLevel = 0x8

        class AlarmModeBitmap(IntFlag):
            kVisual = 0x1
            kAudible = 0x2

        class SensorFaultBitmap(IntFlag):
            kGeneralFault = 0x1

    class Commands:
        @dataclass
        class SuppressAlarm(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000080
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmsToSuppress", Tag=0, Type=BooleanStateConfiguration.Bitmaps.AlarmModeBitmap),
                    ])

            alarmsToSuppress: 'BooleanStateConfiguration.Bitmaps.AlarmModeBitmap' = 0

        @dataclass
        class EnableDisableAlarm(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000080
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmsToEnableDisable", Tag=0, Type=BooleanStateConfiguration.Bitmaps.AlarmModeBitmap),
                    ])

            alarmsToEnableDisable: 'BooleanStateConfiguration.Bitmaps.AlarmModeBitmap' = 0

    class Attributes:
        @dataclass
        class CurrentSensitivityLevel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SupportedSensitivityLevels(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class DefaultSensitivityLevel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AlarmsActive(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap])

            value: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None

        @dataclass
        class AlarmsSuppressed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap])

            value: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None

        @dataclass
        class AlarmsEnabled(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap])

            value: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None

        @dataclass
        class AlarmsSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap])

            value: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None

        @dataclass
        class SensorFault(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[BooleanStateConfiguration.Bitmaps.SensorFaultBitmap])

            value: 'typing.Optional[BooleanStateConfiguration.Bitmaps.SensorFaultBitmap]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

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
                return 0x00000080

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
                return 0x00000080

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
                return 0x00000080

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
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class AlarmsStateChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmsActive", Tag=0, Type=BooleanStateConfiguration.Bitmaps.AlarmModeBitmap),
                        ClusterObjectFieldDescriptor(Label="alarmsSuppressed", Tag=1, Type=typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]),
                    ])

            alarmsActive: 'BooleanStateConfiguration.Bitmaps.AlarmModeBitmap' = 0
            alarmsSuppressed: 'typing.Optional[BooleanStateConfiguration.Bitmaps.AlarmModeBitmap]' = None

        @dataclass
        class SensorFault(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sensorFault", Tag=0, Type=BooleanStateConfiguration.Bitmaps.SensorFaultBitmap),
                    ])

            sensorFault: 'BooleanStateConfiguration.Bitmaps.SensorFaultBitmap' = 0
