"""ZoneManagement cluster definition (auto-generated, DO NOT edit)."""

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
class ZoneManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000550

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="maxUserDefinedZones", Tag=0x00000000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxZones", Tag=0x00000001, Type=uint),
                ClusterObjectFieldDescriptor(Label="zones", Tag=0x00000002, Type=typing.List[ZoneManagement.Structs.ZoneInformationStruct]),
                ClusterObjectFieldDescriptor(Label="triggers", Tag=0x00000003, Type=typing.List[ZoneManagement.Structs.ZoneTriggerControlStruct]),
                ClusterObjectFieldDescriptor(Label="sensitivityMax", Tag=0x00000004, Type=uint),
                ClusterObjectFieldDescriptor(Label="sensitivity", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="twoDCartesianMax", Tag=0x00000006, Type=typing.Optional[ZoneManagement.Structs.TwoDCartesianVertexStruct]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    maxUserDefinedZones: typing.Optional[uint] = None
    maxZones: uint = 0
    zones: typing.List[ZoneManagement.Structs.ZoneInformationStruct] = field(default_factory=lambda: [])
    triggers: typing.List[ZoneManagement.Structs.ZoneTriggerControlStruct] = field(default_factory=lambda: [])
    sensitivityMax: uint = 0
    sensitivity: typing.Optional[uint] = None
    twoDCartesianMax: typing.Optional[ZoneManagement.Structs.TwoDCartesianVertexStruct] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class ZoneTypeEnum(MatterIntEnum):
            kTwoDcartZone = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class ZoneUseEnum(MatterIntEnum):
            kMotion = 0x00
            kPrivacy = 0x01
            kFocus = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ZoneSourceEnum(MatterIntEnum):
            kMfg = 0x00
            kUser = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class ZoneEventTriggeredReasonEnum(MatterIntEnum):
            kMotion = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class ZoneEventStoppedReasonEnum(MatterIntEnum):
            kActionStopped = 0x00
            kTimeout = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

    class Bitmaps:
        class Feature(IntFlag):
            kTwoDimensionalCartesianZone = 0x1
            kPerZoneSensitivity = 0x2
            kUserDefined = 0x4
            kFocusZones = 0x8

    class Structs:
        @dataclass
        class TwoDCartesianVertexStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="x", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="y", Tag=1, Type=uint),
                    ])

            x: uint = 0
            y: uint = 0

        @dataclass
        class TwoDCartesianZoneStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="name", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="use", Tag=1, Type=ZoneManagement.Enums.ZoneUseEnum),
                        ClusterObjectFieldDescriptor(Label="vertices", Tag=2, Type=typing.List[ZoneManagement.Structs.TwoDCartesianVertexStruct]),
                        ClusterObjectFieldDescriptor(Label="color", Tag=3, Type=typing.Optional[str]),
                    ])

            name: str = ""
            use: ZoneManagement.Enums.ZoneUseEnum = 0
            vertices: typing.List[ZoneManagement.Structs.TwoDCartesianVertexStruct] = field(default_factory=lambda: [])
            color: typing.Optional[str] = None

        @dataclass
        class ZoneInformationStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="zoneType", Tag=1, Type=ZoneManagement.Enums.ZoneTypeEnum),
                        ClusterObjectFieldDescriptor(Label="zoneSource", Tag=2, Type=ZoneManagement.Enums.ZoneSourceEnum),
                        ClusterObjectFieldDescriptor(Label="twoDCartesianZone", Tag=3, Type=typing.Optional[ZoneManagement.Structs.TwoDCartesianZoneStruct]),
                    ])

            zoneID: uint = 0
            zoneType: ZoneManagement.Enums.ZoneTypeEnum = 0
            zoneSource: ZoneManagement.Enums.ZoneSourceEnum = 0
            twoDCartesianZone: typing.Optional[ZoneManagement.Structs.TwoDCartesianZoneStruct] = None

        @dataclass
        class ZoneTriggerControlStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="initialDuration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="augmentationDuration", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maxDuration", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="blindDuration", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sensitivity", Tag=5, Type=typing.Optional[uint]),
                    ])

            zoneID: uint = 0
            initialDuration: uint = 0
            augmentationDuration: uint = 0
            maxDuration: uint = 0
            blindDuration: uint = 0
            sensitivity: typing.Optional[uint] = None

    class Commands:
        @dataclass
        class CreateTwoDCartesianZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000550
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'CreateTwoDCartesianZoneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=ZoneManagement.Structs.TwoDCartesianZoneStruct),
                    ])

            zone: ZoneManagement.Structs.TwoDCartesianZoneStruct = field(default_factory=lambda: ZoneManagement.Structs.TwoDCartesianZoneStruct())

        @dataclass
        class UpdateTwoDCartesianZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000550
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="zone", Tag=1, Type=ZoneManagement.Structs.TwoDCartesianZoneStruct),
                    ])

            zoneID: uint = 0
            zone: ZoneManagement.Structs.TwoDCartesianZoneStruct = field(default_factory=lambda: ZoneManagement.Structs.TwoDCartesianZoneStruct())

        @dataclass
        class RemoveZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000550
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                    ])

            zoneID: uint = 0

        @dataclass
        class CreateOrUpdateTrigger(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000550
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="trigger", Tag=0, Type=ZoneManagement.Structs.ZoneTriggerControlStruct),
                    ])

            trigger: ZoneManagement.Structs.ZoneTriggerControlStruct = field(default_factory=lambda: ZoneManagement.Structs.ZoneTriggerControlStruct())

        @dataclass
        class RemoveTrigger(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000550
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                    ])

            zoneID: uint = 0

        @dataclass
        class CreateTwoDCartesianZoneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000550
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                    ])

            zoneID: uint = 0

    class Attributes:
        @dataclass
        class MaxUserDefinedZones(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MaxZones(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Zones(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[ZoneManagement.Structs.ZoneInformationStruct])

            value: typing.List[ZoneManagement.Structs.ZoneInformationStruct] = field(default_factory=lambda: [])

        @dataclass
        class Triggers(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[ZoneManagement.Structs.ZoneTriggerControlStruct])

            value: typing.List[ZoneManagement.Structs.ZoneTriggerControlStruct] = field(default_factory=lambda: [])

        @dataclass
        class SensitivityMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Sensitivity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class TwoDCartesianMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[ZoneManagement.Structs.TwoDCartesianVertexStruct])

            value: typing.Optional[ZoneManagement.Structs.TwoDCartesianVertexStruct] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

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
                return 0x00000550

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
                return 0x00000550

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
                return 0x00000550

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
                return 0x00000550

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
                return 0x00000550

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class ZoneTriggered(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="reason", Tag=1, Type=ZoneManagement.Enums.ZoneEventTriggeredReasonEnum),
                    ])

            zone: uint = 0
            reason: ZoneManagement.Enums.ZoneEventTriggeredReasonEnum = 0

        @dataclass
        class ZoneStopped(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000550

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="reason", Tag=1, Type=ZoneManagement.Enums.ZoneEventStoppedReasonEnum),
                    ])

            zone: uint = 0
            reason: ZoneManagement.Enums.ZoneEventStoppedReasonEnum = 0
