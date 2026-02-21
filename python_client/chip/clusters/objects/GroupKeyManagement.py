"""GroupKeyManagement cluster definition (auto-generated, DO NOT edit)."""

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
class GroupKeyManagement(Cluster):
    id: typing.ClassVar[int] = 0x0000003F

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="groupKeyMap", Tag=0x00000000, Type=typing.List[typing.Optional[GroupKeyManagement.Structs.GroupKeyMapStruct]]),
                ClusterObjectFieldDescriptor(Label="groupTable", Tag=0x00000001, Type=typing.List[typing.Optional[GroupKeyManagement.Structs.GroupInfoMapStruct]]),
                ClusterObjectFieldDescriptor(Label="maxGroupsPerFabric", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="maxGroupKeysPerFabric", Tag=0x00000003, Type=uint),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    groupKeyMap: 'typing.List[typing.Optional[GroupKeyManagement.Structs.GroupKeyMapStruct]]' = field(default_factory=lambda: [])
    groupTable: 'typing.List[typing.Optional[GroupKeyManagement.Structs.GroupInfoMapStruct]]' = field(default_factory=lambda: [])
    maxGroupsPerFabric: 'uint' = 0
    maxGroupKeysPerFabric: 'uint' = 0
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class GroupKeySecurityPolicyEnum(MatterIntEnum):
            kTrustFirst = 0x00
            kCacheAndSync = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class GroupKeyMulticastPolicyEnum(MatterIntEnum):
            kPerGroupId = 0x00
            kAllNodes = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2


    class Bitmaps:
        class Feature(IntFlag):
            kCacheAndSync = 0x1


    class Structs:
        @dataclass
        class GroupKeyMapStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupKeySetId", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            groupId: 'uint' = 0
            groupKeySetId: 'uint' = 0
            fabricIndex: 'uint' = 0

        @dataclass
        class GroupKeySetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySetId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupKeySecurityPolicy", Tag=1, Type=GroupKeyManagement.Enums.GroupKeySecurityPolicyEnum),
                        ClusterObjectFieldDescriptor(Label="epochKey0", Tag=2, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="epochStartTime0", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="epochKey1", Tag=4, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="epochStartTime1", Tag=5, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="epochKey2", Tag=6, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="epochStartTime2", Tag=7, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupKeyMulticastPolicy", Tag=8, Type=typing.Optional[GroupKeyManagement.Enums.GroupKeyMulticastPolicyEnum]),
                    ])

            groupKeySetId: 'uint' = 0
            groupKeySecurityPolicy: 'GroupKeyManagement.Enums.GroupKeySecurityPolicyEnum' = 0
            epochKey0: 'typing.Union[Nullable, bytes]' = NullValue
            epochStartTime0: 'typing.Union[Nullable, uint]' = NullValue
            epochKey1: 'typing.Union[Nullable, bytes]' = NullValue
            epochStartTime1: 'typing.Union[Nullable, uint]' = NullValue
            epochKey2: 'typing.Union[Nullable, bytes]' = NullValue
            epochStartTime2: 'typing.Union[Nullable, uint]' = NullValue
            groupKeyMulticastPolicy: 'typing.Optional[GroupKeyManagement.Enums.GroupKeyMulticastPolicyEnum]' = None

        @dataclass
        class GroupInfoMapStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoints", Tag=2, Type=typing.List[typing.Optional[uint]]),
                        ClusterObjectFieldDescriptor(Label="groupName", Tag=3, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            groupId: 'uint' = 0
            endpoints: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])
            groupName: 'typing.Optional[str]' = None
            fabricIndex: 'uint' = 0


    class Commands:
        @dataclass
        class KeySetWrite(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003F
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySet", Tag=0, Type=GroupKeyManagement.Structs.GroupKeySetStruct),
                    ])

            groupKeySet: 'GroupKeyManagement.Structs.GroupKeySetStruct' = field(default_factory=lambda: GroupKeyManagement.Structs.GroupKeySetStruct())

        @dataclass
        class KeySetRead(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003F
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'KeySetReadResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySetId", Tag=0, Type=uint),
                    ])

            groupKeySetId: 'uint' = 0

        @dataclass
        class KeySetRemove(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003F
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySetId", Tag=0, Type=uint),
                    ])

            groupKeySetId: 'uint' = 0

        @dataclass
        class KeySetReadAllIndices(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003F
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'KeySetReadAllIndicesResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="doNotUse", Tag=0, Type=typing.Optional[uint]),
                    ])

            doNotUse: 'typing.Optional[uint]' = None

        @dataclass
        class KeySetReadResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003F
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySet", Tag=0, Type=GroupKeyManagement.Structs.GroupKeySetStruct),
                    ])

            groupKeySet: 'GroupKeyManagement.Structs.GroupKeySetStruct' = field(default_factory=lambda: GroupKeyManagement.Structs.GroupKeySetStruct())

        @dataclass
        class KeySetReadAllIndicesResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003F
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySetIDs", Tag=0, Type=typing.List[typing.Optional[uint]]),
                    ])

            groupKeySetIDs: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])


    class Attributes:
        @dataclass
        class GroupKeyMap(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[GroupKeyManagement.Structs.GroupKeyMapStruct]])

            value: 'typing.List[typing.Optional[GroupKeyManagement.Structs.GroupKeyMapStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class GroupTable(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[GroupKeyManagement.Structs.GroupInfoMapStruct]])

            value: 'typing.List[typing.Optional[GroupKeyManagement.Structs.GroupInfoMapStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class MaxGroupsPerFabric(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class MaxGroupKeysPerFabric(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003F

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
                return 0x0000003F

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
                return 0x0000003F

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
                return 0x0000003F

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
                return 0x0000003F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

