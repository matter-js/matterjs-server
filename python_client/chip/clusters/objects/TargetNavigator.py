"""TargetNavigator cluster definition (auto-generated, DO NOT edit)."""

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
class TargetNavigator(Cluster):
    id: typing.ClassVar[int] = 0x00000505

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="targetList", Tag=0x00000000, Type=typing.List[typing.Optional[TargetNavigator.Structs.TargetInfoStruct]]),
                ClusterObjectFieldDescriptor(Label="currentTarget", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    targetList: 'typing.List[typing.Optional[TargetNavigator.Structs.TargetInfoStruct]]' = field(default_factory=lambda: [])
    currentTarget: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StatusEnum(MatterIntEnum):
            kSuccess = 0x00
            kTargetNotFound = 0x01
            kNotAllowed = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Structs:
        @dataclass
        class TargetInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="identifier", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="name", Tag=1, Type=str),
                    ])

            identifier: 'uint' = 0
            name: 'str' = ""

    class Commands:
        @dataclass
        class NavigateTarget(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000505
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NavigateTargetResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="target", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="data", Tag=1, Type=typing.Optional[str]),
                    ])

            target: 'uint' = 0
            data: 'typing.Optional[str]' = None

        @dataclass
        class NavigateTargetResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000505
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=TargetNavigator.Enums.StatusEnum),
                        ClusterObjectFieldDescriptor(Label="data", Tag=1, Type=typing.Optional[str]),
                    ])

            status: 'TargetNavigator.Enums.StatusEnum' = 0
            data: 'typing.Optional[str]' = None

    class Attributes:
        @dataclass
        class TargetList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000505

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[TargetNavigator.Structs.TargetInfoStruct]])

            value: 'typing.List[typing.Optional[TargetNavigator.Structs.TargetInfoStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class CurrentTarget(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000505

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000505

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
                return 0x00000505

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
                return 0x00000505

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
                return 0x00000505

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
                return 0x00000505

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class TargetUpdated(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000505

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="targetList", Tag=0, Type=typing.Optional[typing.List[typing.Optional[TargetNavigator.Structs.TargetInfoStruct]]]),
                        ClusterObjectFieldDescriptor(Label="currentTarget", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="data", Tag=2, Type=typing.Optional[bytes]),
                    ])

            targetList: 'typing.Optional[typing.List[typing.Optional[TargetNavigator.Structs.TargetInfoStruct]]]' = None
            currentTarget: 'typing.Optional[uint]' = None
            data: 'typing.Optional[bytes]' = None
