"""Groups cluster definition (auto-generated, DO NOT edit)."""

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
class Groups(Cluster):
    id: typing.ClassVar[int] = 0x00000004

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="nameSupport", Tag=0x00000000, Type=Groups.Bitmaps.NameSupportBitmap),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    nameSupport: 'Groups.Bitmaps.NameSupportBitmap' = 0
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Bitmaps:
        class Feature(IntFlag):
            kGroupNames = 0x1

        class NameSupportBitmap(IntFlag):
            kGroupNames = 0x80

    class Commands:
        @dataclass
        class AddGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'AddGroupResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupName", Tag=1, Type=str),
                    ])

            groupId: 'uint' = 0
            groupName: 'str' = ""

        @dataclass
        class ViewGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ViewGroupResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                    ])

            groupId: 'uint' = 0

        @dataclass
        class GetGroupMembership(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetGroupMembershipResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupList", Tag=0, Type=typing.List[typing.Optional[uint]]),
                    ])

            groupList: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])

        @dataclass
        class RemoveGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'RemoveGroupResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                    ])

            groupId: 'uint' = 0

        @dataclass
        class RemoveAllGroups(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class AddGroupIfIdentifying(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupName", Tag=1, Type=str),
                    ])

            groupId: 'uint' = 0
            groupName: 'str' = ""

        @dataclass
        class AddGroupResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0

        @dataclass
        class ViewGroupResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupName", Tag=2, Type=str),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0
            groupName: 'str' = ""

        @dataclass
        class GetGroupMembershipResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="capacity", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupList", Tag=1, Type=typing.List[typing.Optional[uint]]),
                    ])

            capacity: 'typing.Union[Nullable, uint]' = NullValue
            groupList: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])

        @dataclass
        class RemoveGroupResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000004
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0

    class Attributes:
        @dataclass
        class NameSupport(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=Groups.Bitmaps.NameSupportBitmap)

            value: 'Groups.Bitmaps.NameSupportBitmap' = 0

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000004

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
                return 0x00000004

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
                return 0x00000004

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
                return 0x00000004

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
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
