"""AccessControl cluster definition (auto-generated, DO NOT edit)."""

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
class AccessControl(Cluster):
    id: typing.ClassVar[int] = 0x0000001F

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="aCL", Tag=0x00000000, Type=typing.List[typing.Optional[AccessControl.Structs.AccessControlEntryStruct]]),
                ClusterObjectFieldDescriptor(Label="extension", Tag=0x00000001, Type=typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessControlExtensionStruct]]]),
                ClusterObjectFieldDescriptor(Label="subjectsPerAccessControlEntry", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="targetsPerAccessControlEntry", Tag=0x00000003, Type=uint),
                ClusterObjectFieldDescriptor(Label="accessControlEntriesPerFabric", Tag=0x00000004, Type=uint),
                ClusterObjectFieldDescriptor(Label="commissioningArl", Tag=0x00000005, Type=typing.Optional[typing.List[typing.Optional[AccessControl.Structs.CommissioningAccessRestrictionEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="arl", Tag=0x00000006, Type=typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionEntryStruct]]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    aCL: 'typing.List[typing.Optional[AccessControl.Structs.AccessControlEntryStruct]]' = field(default_factory=lambda: [])
    extension: 'typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessControlExtensionStruct]]]' = None
    subjectsPerAccessControlEntry: 'uint' = 0
    targetsPerAccessControlEntry: 'uint' = 0
    accessControlEntriesPerFabric: 'uint' = 0
    commissioningArl: 'typing.Optional[typing.List[typing.Optional[AccessControl.Structs.CommissioningAccessRestrictionEntryStruct]]]' = None
    arl: 'typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionEntryStruct]]]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class ChangeTypeEnum(MatterIntEnum):
            kChanged = 0x00
            kAdded = 0x01
            kRemoved = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class AccessControlEntryPrivilegeEnum(MatterIntEnum):
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

        class AccessRestrictionTypeEnum(MatterIntEnum):
            kAttributeAccessForbidden = 0x00
            kAttributeWriteForbidden = 0x01
            kCommandForbidden = 0x02
            kEventForbidden = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class AccessControlEntryAuthModeEnum(MatterIntEnum):
            kPase = 0x01
            kCase = 0x02
            kGroup = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

    class Bitmaps:
        class Feature(IntFlag):
            kExtension = 0x1
            kManagedDevice = 0x2

    class Structs:
        @dataclass
        class AccessControlTargetStruct(ClusterObject):
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
        class AccessControlEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="privilege", Tag=1, Type=AccessControl.Enums.AccessControlEntryPrivilegeEnum),
                        ClusterObjectFieldDescriptor(Label="authMode", Tag=2, Type=AccessControl.Enums.AccessControlEntryAuthModeEnum),
                        ClusterObjectFieldDescriptor(Label="subjects", Tag=3, Type=typing.Union[Nullable, typing.List[typing.Optional[uint]]]),
                        ClusterObjectFieldDescriptor(Label="targets", Tag=4, Type=typing.Union[Nullable, typing.List[typing.Optional[AccessControl.Structs.AccessControlTargetStruct]]]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            privilege: 'AccessControl.Enums.AccessControlEntryPrivilegeEnum' = 0
            authMode: 'AccessControl.Enums.AccessControlEntryAuthModeEnum' = 0
            subjects: 'typing.Union[Nullable, typing.List[typing.Optional[uint]]]' = NullValue
            targets: 'typing.Union[Nullable, typing.List[typing.Optional[AccessControl.Structs.AccessControlTargetStruct]]]' = NullValue
            fabricIndex: 'uint' = 0

        @dataclass
        class AccessControlExtensionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="data", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            data: 'bytes' = b""
            fabricIndex: 'uint' = 0

        @dataclass
        class AccessRestrictionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="type", Tag=0, Type=AccessControl.Enums.AccessRestrictionTypeEnum),
                        ClusterObjectFieldDescriptor(Label="iD", Tag=1, Type=typing.Union[Nullable, uint]),
                    ])

            type: 'AccessControl.Enums.AccessRestrictionTypeEnum' = 0
            iD: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class AccessRestrictionEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="cluster", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="restrictions", Tag=2, Type=typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionStruct]]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            endpoint: 'uint' = 0
            cluster: 'uint' = 0
            restrictions: 'typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionStruct]]' = field(default_factory=lambda: [])
            fabricIndex: 'uint' = 0

        @dataclass
        class CommissioningAccessRestrictionEntryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="cluster", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="restrictions", Tag=2, Type=typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionStruct]]),
                    ])

            endpoint: 'uint' = 0
            cluster: 'uint' = 0
            restrictions: 'typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionStruct]]' = field(default_factory=lambda: [])

    class Commands:
        @dataclass
        class ReviewFabricRestrictions(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000001F
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ReviewFabricRestrictionsResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="arl", Tag=0, Type=typing.List[typing.Optional[AccessControl.Structs.CommissioningAccessRestrictionEntryStruct]]),
                    ])

            arl: 'typing.List[typing.Optional[AccessControl.Structs.CommissioningAccessRestrictionEntryStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class ReviewFabricRestrictionsResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000001F
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="token", Tag=0, Type=uint),
                    ])

            token: 'uint' = 0

    class Attributes:
        @dataclass
        class Acl(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[AccessControl.Structs.AccessControlEntryStruct]])

            value: 'typing.List[typing.Optional[AccessControl.Structs.AccessControlEntryStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class Extension(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessControlExtensionStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessControlExtensionStruct]]]' = None

        @dataclass
        class SubjectsPerAccessControlEntry(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class TargetsPerAccessControlEntry(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class AccessControlEntriesPerFabric(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class CommissioningArl(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[AccessControl.Structs.CommissioningAccessRestrictionEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[AccessControl.Structs.CommissioningAccessRestrictionEntryStruct]]]' = None

        @dataclass
        class Arl(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionEntryStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[AccessControl.Structs.AccessRestrictionEntryStruct]]]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

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
                return 0x0000001F

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
                return 0x0000001F

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
                return 0x0000001F

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
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class AccessControlEntryChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="adminNodeID", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="adminPasscodeID", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="changeType", Tag=3, Type=AccessControl.Enums.ChangeTypeEnum),
                        ClusterObjectFieldDescriptor(Label="latestValue", Tag=4, Type=typing.Union[Nullable, AccessControl.Structs.AccessControlEntryStruct]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            adminNodeID: 'typing.Union[Nullable, uint]' = NullValue
            adminPasscodeID: 'typing.Union[Nullable, uint]' = NullValue
            changeType: 'AccessControl.Enums.ChangeTypeEnum' = 0
            latestValue: 'typing.Union[Nullable, AccessControl.Structs.AccessControlEntryStruct]' = NullValue
            fabricIndex: 'uint' = 0

        @dataclass
        class AccessControlExtensionChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="adminNodeID", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="adminPasscodeID", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="changeType", Tag=3, Type=AccessControl.Enums.ChangeTypeEnum),
                        ClusterObjectFieldDescriptor(Label="latestValue", Tag=4, Type=typing.Union[Nullable, AccessControl.Structs.AccessControlExtensionStruct]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            adminNodeID: 'typing.Union[Nullable, uint]' = NullValue
            adminPasscodeID: 'typing.Union[Nullable, uint]' = NullValue
            changeType: 'AccessControl.Enums.ChangeTypeEnum' = 0
            latestValue: 'typing.Union[Nullable, AccessControl.Structs.AccessControlExtensionStruct]' = NullValue
            fabricIndex: 'uint' = 0

        @dataclass
        class FabricRestrictionReviewUpdate(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="token", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="instruction", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="arlRequestFlowURL", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            token: 'uint' = 0
            instruction: 'typing.Optional[str]' = None
            arlRequestFlowURL: 'typing.Optional[str]' = None
            fabricIndex: 'uint' = 0
