"""JointFabricDatastore cluster definition (auto-generated, DO NOT edit)."""

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
class JointFabricDatastore(Cluster):
    id: typing.ClassVar[int] = 0x00000752

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="anchorRootCa", Tag=0x00000000, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="anchorNodeID", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="anchorVendorID", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="friendlyName", Tag=0x00000003, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="groupKeySetList", Tag=0x00000004, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupKeySetStruct]]]),
                ClusterObjectFieldDescriptor(Label="groupList", Tag=0x00000005, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupInformationEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="nodeList", Tag=0x00000006, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeInformationEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="adminList", Tag=0x00000007, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreAdministratorInformationEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="status", Tag=0x00000008, Type=typing.Optional[JointFabricDatastore.Structs.DatastoreStatusEntryStruct]),
                ClusterObjectFieldDescriptor(Label="endpointGroupIDList", Tag=0x00000009, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointGroupIDEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="endpointBindingList", Tag=0x0000000A, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointBindingEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="nodeKeySetList", Tag=0x0000000B, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeKeySetEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="nodeACLList", Tag=0x0000000C, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreACLEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="nodeEndpointList", Tag=0x0000000D, Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    anchorRootCa: 'typing.Optional[bytes]' = None
    anchorNodeID: 'typing.Optional[uint]' = None
    anchorVendorID: 'typing.Optional[uint]' = None
    friendlyName: 'typing.Optional[str]' = None
    groupKeySetList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupKeySetStruct]]]' = None
    groupList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupInformationEntryStruct]]]' = None
    nodeList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeInformationEntryStruct]]]' = None
    adminList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreAdministratorInformationEntryStruct]]]' = None
    status: 'typing.Optional[JointFabricDatastore.Structs.DatastoreStatusEntryStruct]' = None
    endpointGroupIDList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointGroupIDEntryStruct]]]' = None
    endpointBindingList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointBindingEntryStruct]]]' = None
    nodeKeySetList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeKeySetEntryStruct]]]' = None
    nodeACLList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreACLEntryStruct]]]' = None
    nodeEndpointList: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointEntryStruct]]]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class DatastoreStateEnum(MatterIntEnum):
            kPending = 0x00
            kCommitted = 0x01
            kDeletePending = 0x02
            kCommitFailed = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class DatastoreAccessControlEntryPrivilegeEnum(MatterIntEnum):
            kView = 0x01
            kProxyView = 0x02
            kOperate = 0x03
            kManage = 0x04
            kAdminister = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class DatastoreAccessControlEntryAuthModeEnum(MatterIntEnum):
            kPase = 0x01
            kCase = 0x02
            kGroup = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class DatastoreGroupKeySecurityPolicyEnum(MatterIntEnum):
            kTrustFirst = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class DatastoreGroupKeyMulticastPolicyEnum(MatterIntEnum):
            kPerGroupId = 0x00
            kAllNodes = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

    class Structs:
        @dataclass
        class DatastoreStatusEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="state", Tag=0, Type=JointFabricDatastore.Enums.DatastoreStateEnum),
                        ClusterObjectFieldDescriptor(Label="updateTimestamp", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="failureCode", Tag=2, Type=Globals.Enums.status),
                    ])

            state: 'JointFabricDatastore.Enums.DatastoreStateEnum' = 0
            updateTimestamp: 'uint' = 0
            failureCode: 'Globals.Enums.status' = 0

        @dataclass
        class DatastoreNodeKeySetEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupKeySetID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="statusEntry", Tag=2, Type=JointFabricDatastore.Structs.DatastoreStatusEntryStruct),
                    ])

            nodeID: 'uint' = 0
            groupKeySetID: 'uint' = 0
            statusEntry: 'JointFabricDatastore.Structs.DatastoreStatusEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreStatusEntryStruct())

        @dataclass
        class DatastoreGroupInformationEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="groupKeySetID", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupCat", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupCatVersion", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupPermission", Tag=5, Type=JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum),
                    ])

            groupID: 'uint' = 0
            friendlyName: 'str' = ""
            groupKeySetID: 'typing.Union[Nullable, uint]' = NullValue
            groupCat: 'typing.Union[Nullable, uint]' = NullValue
            groupCatVersion: 'typing.Union[Nullable, uint]' = NullValue
            groupPermission: 'JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum' = 0

        @dataclass
        class DatastoreBindingTargetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="node", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="group", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="cluster", Tag=4, Type=typing.Optional[uint]),
                    ])

            node: 'typing.Optional[uint]' = None
            group: 'typing.Optional[uint]' = None
            endpoint: 'typing.Optional[uint]' = None
            cluster: 'typing.Optional[uint]' = None

        @dataclass
        class DatastoreEndpointBindingEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="listID", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="binding", Tag=3, Type=JointFabricDatastore.Structs.DatastoreBindingTargetStruct),
                        ClusterObjectFieldDescriptor(Label="statusEntry", Tag=4, Type=JointFabricDatastore.Structs.DatastoreStatusEntryStruct),
                    ])

            nodeID: 'uint' = 0
            endpointID: 'uint' = 0
            listID: 'uint' = 0
            binding: 'JointFabricDatastore.Structs.DatastoreBindingTargetStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreBindingTargetStruct())
            statusEntry: 'JointFabricDatastore.Structs.DatastoreStatusEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreStatusEntryStruct())

        @dataclass
        class DatastoreEndpointGroupIDEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="statusEntry", Tag=3, Type=JointFabricDatastore.Structs.DatastoreStatusEntryStruct),
                    ])

            nodeID: 'uint' = 0
            endpointID: 'uint' = 0
            groupID: 'uint' = 0
            statusEntry: 'JointFabricDatastore.Structs.DatastoreStatusEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreStatusEntryStruct())

        @dataclass
        class DatastoreEndpointEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=2, Type=str),
                        ClusterObjectFieldDescriptor(Label="statusEntry", Tag=3, Type=JointFabricDatastore.Structs.DatastoreStatusEntryStruct),
                    ])

            endpointID: 'uint' = 0
            nodeID: 'uint' = 0
            friendlyName: 'str' = ""
            statusEntry: 'JointFabricDatastore.Structs.DatastoreStatusEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreStatusEntryStruct())

        @dataclass
        class DatastoreAccessControlTargetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="cluster", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="deviceType", Tag=2, Type=typing.Union[Nullable, uint]),
                    ])

            cluster: 'typing.Union[Nullable, uint]' = NullValue
            endpoint: 'typing.Union[Nullable, uint]' = NullValue
            deviceType: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class DatastoreAccessControlEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="privilege", Tag=1, Type=JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum),
                        ClusterObjectFieldDescriptor(Label="authMode", Tag=2, Type=JointFabricDatastore.Enums.DatastoreAccessControlEntryAuthModeEnum),
                        ClusterObjectFieldDescriptor(Label="subjects", Tag=3, Type=typing.Union[Nullable, typing.List[typing.Optional[uint]]]),
                        ClusterObjectFieldDescriptor(Label="targets", Tag=4, Type=typing.Union[Nullable, typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreAccessControlTargetStruct]]]),
                    ])

            privilege: 'JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum' = 0
            authMode: 'JointFabricDatastore.Enums.DatastoreAccessControlEntryAuthModeEnum' = 0
            subjects: 'typing.Union[Nullable, typing.List[typing.Optional[uint]]]' = NullValue
            targets: 'typing.Union[Nullable, typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreAccessControlTargetStruct]]]' = NullValue

        @dataclass
        class DatastoreACLEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="listID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="aCLEntry", Tag=2, Type=JointFabricDatastore.Structs.DatastoreAccessControlEntryStruct),
                        ClusterObjectFieldDescriptor(Label="statusEntry", Tag=3, Type=JointFabricDatastore.Structs.DatastoreStatusEntryStruct),
                    ])

            nodeID: 'uint' = 0
            listID: 'uint' = 0
            aCLEntry: 'JointFabricDatastore.Structs.DatastoreAccessControlEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreAccessControlEntryStruct())
            statusEntry: 'JointFabricDatastore.Structs.DatastoreStatusEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreStatusEntryStruct())

        @dataclass
        class DatastoreNodeInformationEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=2, Type=str),
                        ClusterObjectFieldDescriptor(Label="commissioningStatusEntry", Tag=3, Type=JointFabricDatastore.Structs.DatastoreStatusEntryStruct),
                    ])

            nodeID: 'uint' = 0
            friendlyName: 'str' = ""
            commissioningStatusEntry: 'JointFabricDatastore.Structs.DatastoreStatusEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreStatusEntryStruct())

        @dataclass
        class DatastoreAdministratorInformationEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=2, Type=str),
                        ClusterObjectFieldDescriptor(Label="vendorID", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="iCAC", Tag=4, Type=bytes),
                    ])

            nodeID: 'uint' = 0
            friendlyName: 'str' = ""
            vendorID: 'uint' = 0
            iCAC: 'bytes' = b""

        @dataclass
        class DatastoreGroupKeySetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySetID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupKeySecurityPolicy", Tag=1, Type=JointFabricDatastore.Enums.DatastoreGroupKeySecurityPolicyEnum),
                        ClusterObjectFieldDescriptor(Label="epochKey0", Tag=2, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="epochStartTime0", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="epochKey1", Tag=4, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="epochStartTime1", Tag=5, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="epochKey2", Tag=6, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="epochStartTime2", Tag=7, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupKeyMulticastPolicy", Tag=8, Type=typing.Optional[JointFabricDatastore.Enums.DatastoreGroupKeyMulticastPolicyEnum]),
                    ])

            groupKeySetID: 'uint' = 0
            groupKeySecurityPolicy: 'JointFabricDatastore.Enums.DatastoreGroupKeySecurityPolicyEnum' = 0
            epochKey0: 'typing.Union[Nullable, bytes]' = NullValue
            epochStartTime0: 'typing.Union[Nullable, uint]' = NullValue
            epochKey1: 'typing.Union[Nullable, bytes]' = NullValue
            epochStartTime1: 'typing.Union[Nullable, uint]' = NullValue
            epochKey2: 'typing.Union[Nullable, bytes]' = NullValue
            epochStartTime2: 'typing.Union[Nullable, uint]' = NullValue
            groupKeyMulticastPolicy: 'typing.Optional[JointFabricDatastore.Enums.DatastoreGroupKeyMulticastPolicyEnum]' = None

    class Commands:
        @dataclass
        class AddKeySet(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySet", Tag=0, Type=JointFabricDatastore.Structs.DatastoreGroupKeySetStruct),
                    ])

            groupKeySet: 'JointFabricDatastore.Structs.DatastoreGroupKeySetStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreGroupKeySetStruct())

        @dataclass
        class UpdateKeySet(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySet", Tag=0, Type=JointFabricDatastore.Structs.DatastoreGroupKeySetStruct),
                    ])

            groupKeySet: 'JointFabricDatastore.Structs.DatastoreGroupKeySetStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreGroupKeySetStruct())

        @dataclass
        class RemoveKeySet(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupKeySetID", Tag=0, Type=uint),
                    ])

            groupKeySetID: 'uint' = 0

        @dataclass
        class AddGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="groupKeySetID", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupCat", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupCatVersion", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupPermission", Tag=5, Type=JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum),
                    ])

            groupID: 'uint' = 0
            friendlyName: 'str' = ""
            groupKeySetID: 'typing.Union[Nullable, uint]' = NullValue
            groupCat: 'typing.Union[Nullable, uint]' = NullValue
            groupCatVersion: 'typing.Union[Nullable, uint]' = NullValue
            groupPermission: 'JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum' = 0

        @dataclass
        class UpdateGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=1, Type=typing.Union[Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="groupKeySetID", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupCat", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupCatVersion", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupPermission", Tag=5, Type=JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum),
                    ])

            groupID: 'uint' = 0
            friendlyName: 'typing.Union[Nullable, str]' = NullValue
            groupKeySetID: 'typing.Union[Nullable, uint]' = NullValue
            groupCat: 'typing.Union[Nullable, uint]' = NullValue
            groupCatVersion: 'typing.Union[Nullable, uint]' = NullValue
            groupPermission: 'JointFabricDatastore.Enums.DatastoreAccessControlEntryPrivilegeEnum' = 0

        @dataclass
        class RemoveGroup(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=0, Type=uint),
                    ])

            groupID: 'uint' = 0

        @dataclass
        class AddAdmin(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=2, Type=str),
                        ClusterObjectFieldDescriptor(Label="vendorID", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="iCAC", Tag=4, Type=bytes),
                    ])

            nodeID: 'uint' = 0
            friendlyName: 'str' = ""
            vendorID: 'uint' = 0
            iCAC: 'bytes' = b""

        @dataclass
        class UpdateAdmin(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=1, Type=typing.Union[Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="iCAC", Tag=2, Type=typing.Union[Nullable, bytes]),
                    ])

            nodeID: 'typing.Union[Nullable, uint]' = NullValue
            friendlyName: 'typing.Union[Nullable, str]' = NullValue
            iCAC: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class RemoveAdmin(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                    ])

            nodeID: 'uint' = 0

        @dataclass
        class AddPendingNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=1, Type=str),
                    ])

            nodeID: 'uint' = 0
            friendlyName: 'str' = ""

        @dataclass
        class RefreshNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                    ])

            nodeID: 'uint' = 0

        @dataclass
        class UpdateNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=1, Type=str),
                    ])

            nodeID: 'uint' = 0
            friendlyName: 'str' = ""

        @dataclass
        class RemoveNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                    ])

            nodeID: 'uint' = 0

        @dataclass
        class UpdateEndpointForNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x0000000D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="friendlyName", Tag=2, Type=str),
                    ])

            endpointID: 'uint' = 0
            nodeID: 'uint' = 0
            friendlyName: 'str' = ""

        @dataclass
        class AddGroupIDToEndpointForNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x0000000E
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=2, Type=uint),
                    ])

            nodeID: 'uint' = 0
            endpointID: 'uint' = 0
            groupID: 'uint' = 0

        @dataclass
        class RemoveGroupIDFromEndpointForNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x0000000F
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupID", Tag=2, Type=uint),
                    ])

            nodeID: 'uint' = 0
            endpointID: 'uint' = 0
            groupID: 'uint' = 0

        @dataclass
        class AddBindingToEndpointForNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000010
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="binding", Tag=2, Type=JointFabricDatastore.Structs.DatastoreBindingTargetStruct),
                    ])

            nodeID: 'uint' = 0
            endpointID: 'uint' = 0
            binding: 'JointFabricDatastore.Structs.DatastoreBindingTargetStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreBindingTargetStruct())

        @dataclass
        class RemoveBindingFromEndpointForNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000011
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="listID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=2, Type=uint),
                    ])

            listID: 'uint' = 0
            endpointID: 'uint' = 0
            nodeID: 'uint' = 0

        @dataclass
        class AddACLToNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000012
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="aCLEntry", Tag=1, Type=JointFabricDatastore.Structs.DatastoreAccessControlEntryStruct),
                    ])

            nodeID: 'uint' = 0
            aCLEntry: 'JointFabricDatastore.Structs.DatastoreAccessControlEntryStruct' = field(default_factory=lambda: JointFabricDatastore.Structs.DatastoreAccessControlEntryStruct())

        @dataclass
        class RemoveACLFromNode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000752
            command_id: typing.ClassVar[int] = 0x00000013
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="listID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nodeID", Tag=1, Type=uint),
                    ])

            listID: 'uint' = 0
            nodeID: 'uint' = 0

    class Attributes:
        @dataclass
        class AnchorRootCa(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: 'typing.Optional[bytes]' = None

        @dataclass
        class AnchorNodeId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AnchorVendorId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class FriendlyName(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class GroupKeySetList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupKeySetStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupKeySetStruct]]]' = None

        @dataclass
        class GroupList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupInformationEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreGroupInformationEntryStruct]]]' = None

        @dataclass
        class NodeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeInformationEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeInformationEntryStruct]]]' = None

        @dataclass
        class AdminList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreAdministratorInformationEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreAdministratorInformationEntryStruct]]]' = None

        @dataclass
        class Status(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[JointFabricDatastore.Structs.DatastoreStatusEntryStruct])

            value: 'typing.Optional[JointFabricDatastore.Structs.DatastoreStatusEntryStruct]' = None

        @dataclass
        class EndpointGroupIdList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointGroupIDEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointGroupIDEntryStruct]]]' = None

        @dataclass
        class EndpointBindingList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointBindingEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointBindingEntryStruct]]]' = None

        @dataclass
        class NodeKeySetList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeKeySetEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreNodeKeySetEntryStruct]]]' = None

        @dataclass
        class NodeAclList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreACLEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreACLEntryStruct]]]' = None

        @dataclass
        class NodeEndpointList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[JointFabricDatastore.Structs.DatastoreEndpointEntryStruct]]]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000752

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
                return 0x00000752

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
                return 0x00000752

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
                return 0x00000752

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
                return 0x00000752

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
