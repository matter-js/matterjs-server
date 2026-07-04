"""Groupcast cluster definition (auto-generated, DO NOT edit)."""

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
class Groupcast(Cluster):
    id: typing.ClassVar[int] = 0x00000065

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="membership", Tag=0x00000000, Type=typing.Optional[typing.List[Groupcast.Structs.MembershipStruct]]),
                ClusterObjectFieldDescriptor(Label="maxMembershipCount", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxMcastAddrCount", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="usedMcastAddrCount", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="fabricUnderTest", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    membership: typing.Optional[typing.List[Groupcast.Structs.MembershipStruct]] = None
    maxMembershipCount: typing.Optional[uint] = None
    maxMcastAddrCount: typing.Optional[uint] = None
    usedMcastAddrCount: typing.Optional[uint] = None
    fabricUnderTest: typing.Optional[uint] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class MulticastAddrPolicyEnum(MatterIntEnum):
            kIanaAddr = 0x00
            kPerGroup = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class GroupcastTestingEnum(MatterIntEnum):
            kDisableTesting = 0x00
            kEnableListenerTesting = 0x01
            kEnableSenderTesting = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class GroupcastTestResultEnum(MatterIntEnum):
            kSuccess = 0x00
            kGeneralError = 0x01
            kMessageReplay = 0x02
            kFailedAuth = 0x03
            kNoAvailableKey = 0x04
            kSendFailure = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

    class Bitmaps:
        class Feature(IntFlag):
            kListener = 0x1
            kSender = 0x2
            kPerGroup = 0x4

    class Structs:
        @dataclass
        class MembershipStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoints", Tag=1, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="keySetID", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="hasAuxiliaryAcl", Tag=3, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="mcastAddrPolicy", Tag=4, Type=Groupcast.Enums.MulticastAddrPolicyEnum),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            groupID: uint = 0
            endpoints: typing.Optional[typing.List[uint]] = None
            keySetID: uint = 0
            hasAuxiliaryAcl: typing.Optional[bool] = None
            mcastAddrPolicy: Groupcast.Enums.MulticastAddrPolicyEnum = 0
            fabricIndex: uint = 0

    class Commands:
        @dataclass
        class JoinGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000065
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoints", Tag=1, Type=typing.List[uint]),
                        ClusterObjectFieldDescriptor(Label="keySetID", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="key", Tag=3, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="useAuxiliaryAcl", Tag=4, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="replaceEndpoints", Tag=5, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="mcastAddrPolicy", Tag=6, Type=typing.Optional[Groupcast.Enums.MulticastAddrPolicyEnum]),
                    ])

            groupID: uint = 0
            endpoints: typing.List[uint] = field(default_factory=lambda: [])
            keySetID: uint = 0
            key: typing.Optional[bytes] = None
            useAuxiliaryAcl: typing.Optional[bool] = None
            replaceEndpoints: typing.Optional[bool] = None
            mcastAddrPolicy: typing.Optional[Groupcast.Enums.MulticastAddrPolicyEnum] = None

        @dataclass
        class LeaveGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000065
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'LeaveGroupResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoints", Tag=1, Type=typing.Optional[typing.List[uint]]),
                    ])

            groupID: uint = 0
            endpoints: typing.Optional[typing.List[uint]] = None

        @dataclass
        class UpdateGroupKey(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000065
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="keySetID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="key", Tag=2, Type=typing.Optional[bytes]),
                    ])

            groupID: uint = 0
            keySetID: uint = 0
            key: typing.Optional[bytes] = None

        @dataclass
        class ConfigureAuxiliaryAcl(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000065
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="useAuxiliaryAcl", Tag=1, Type=bool),
                    ])

            groupID: uint = 0
            useAuxiliaryAcl: bool = False

        @dataclass
        class GroupcastTesting(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000065
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="testOperation", Tag=0, Type=Groupcast.Enums.GroupcastTestingEnum),
                        ClusterObjectFieldDescriptor(Label="durationSeconds", Tag=1, Type=typing.Optional[uint]),
                    ])

            testOperation: Groupcast.Enums.GroupcastTestingEnum = 0
            durationSeconds: typing.Optional[uint] = None

        @dataclass
        class LeaveGroupResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000065
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoints", Tag=1, Type=typing.List[uint]),
                    ])

            groupID: uint = 0
            endpoints: typing.List[uint] = field(default_factory=lambda: [])

    class Attributes:
        @dataclass
        class Membership(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[Groupcast.Structs.MembershipStruct]])

            value: typing.Optional[typing.List[Groupcast.Structs.MembershipStruct]] = None

        @dataclass
        class MaxMembershipCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MaxMcastAddrCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class UsedMcastAddrCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class FabricUnderTest(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

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
                return 0x00000065

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
                return 0x00000065

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
                return 0x00000065

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
                return 0x00000065

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
                return 0x00000065

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class GroupcastTesting(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000065

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sourceIPAddress", Tag=0, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="destinationIPAddress", Tag=1, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="clusterID", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="elementID", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="accessAllowed", Tag=6, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="groupcastTestResult", Tag=7, Type=Groupcast.Enums.GroupcastTestResultEnum),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            sourceIPAddress: typing.Optional[bytes] = None
            destinationIPAddress: typing.Optional[bytes] = None
            groupID: typing.Optional[uint] = None
            endpointID: typing.Optional[uint] = None
            clusterID: typing.Optional[uint] = None
            elementID: typing.Optional[uint] = None
            accessAllowed: typing.Optional[bool] = None
            groupcastTestResult: Groupcast.Enums.GroupcastTestResultEnum = 0
            fabricIndex: uint = 0
