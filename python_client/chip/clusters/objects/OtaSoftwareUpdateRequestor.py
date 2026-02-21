"""OtaSoftwareUpdateRequestor cluster definition (auto-generated, DO NOT edit)."""

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
class OtaSoftwareUpdateRequestor(Cluster):
    id: typing.ClassVar[int] = 0x0000002A

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="defaultOTAProviders", Tag=0x00000000, Type=typing.List[typing.Optional[OtaSoftwareUpdateRequestor.Structs.ProviderLocation]]),
                ClusterObjectFieldDescriptor(Label="updatePossible", Tag=0x00000001, Type=bool),
                ClusterObjectFieldDescriptor(Label="updateState", Tag=0x00000002, Type=OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum),
                ClusterObjectFieldDescriptor(Label="updateStateProgress", Tag=0x00000003, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    defaultOTAProviders: 'typing.List[typing.Optional[OtaSoftwareUpdateRequestor.Structs.ProviderLocation]]' = field(default_factory=lambda: [])
    updatePossible: 'bool' = False
    updateState: 'OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum' = 0
    updateStateProgress: 'typing.Union[Nullable, uint]' = NullValue
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class AnnouncementReasonEnum(MatterIntEnum):
            kSimpleAnnouncement = 0x00
            kUpdateAvailable = 0x01
            kUrgentUpdateAvailable = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class UpdateStateEnum(MatterIntEnum):
            kUnknown = 0x00
            kIdle = 0x01
            kQuerying = 0x02
            kDelayedOnQuery = 0x03
            kDownloading = 0x04
            kApplying = 0x05
            kDelayedOnApply = 0x06
            kRollingBack = 0x07
            kDelayedOnUserConsent = 0x08
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 9

        class ChangeReasonEnum(MatterIntEnum):
            kUnknown = 0x00
            kSuccess = 0x01
            kFailure = 0x02
            kTimeOut = 0x03
            kDelayByProvider = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

    class Structs:
        @dataclass
        class ProviderLocation(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="providerNodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            providerNodeID: 'uint' = 0
            endpoint: 'uint' = 0
            fabricIndex: 'uint' = 0

    class Commands:
        @dataclass
        class AnnounceOTAProvider(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000002A
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="providerNodeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="vendorID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="announcementReason", Tag=2, Type=OtaSoftwareUpdateRequestor.Enums.AnnouncementReasonEnum),
                        ClusterObjectFieldDescriptor(Label="metadataForNode", Tag=3, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            providerNodeID: 'uint' = 0
            vendorID: 'uint' = 0
            announcementReason: 'OtaSoftwareUpdateRequestor.Enums.AnnouncementReasonEnum' = 0
            metadataForNode: 'typing.Optional[bytes]' = None
            endpoint: 'uint' = 0
            fabricIndex: 'uint' = 0

    class Attributes:
        @dataclass
        class DefaultOtaProviders(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[OtaSoftwareUpdateRequestor.Structs.ProviderLocation]])

            value: 'typing.List[typing.Optional[OtaSoftwareUpdateRequestor.Structs.ProviderLocation]]' = field(default_factory=lambda: [])

        @dataclass
        class UpdatePossible(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class UpdateState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum)

            value: 'OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum' = 0

        @dataclass
        class UpdateStateProgress(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

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
                return 0x0000002A

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
                return 0x0000002A

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
                return 0x0000002A

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
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class StateTransition(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="previousState", Tag=0, Type=OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum),
                        ClusterObjectFieldDescriptor(Label="newState", Tag=1, Type=OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum),
                        ClusterObjectFieldDescriptor(Label="reason", Tag=2, Type=OtaSoftwareUpdateRequestor.Enums.ChangeReasonEnum),
                        ClusterObjectFieldDescriptor(Label="targetSoftwareVersion", Tag=3, Type=typing.Union[Nullable, uint]),
                    ])

            previousState: 'OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum' = 0
            newState: 'OtaSoftwareUpdateRequestor.Enums.UpdateStateEnum' = 0
            reason: 'OtaSoftwareUpdateRequestor.Enums.ChangeReasonEnum' = 0
            targetSoftwareVersion: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class VersionApplied(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="softwareVersion", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="productID", Tag=1, Type=uint),
                    ])

            softwareVersion: 'uint' = 0
            productID: 'uint' = 0

        @dataclass
        class DownloadError(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="softwareVersion", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="bytesDownloaded", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="progressPercent", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="platformCode", Tag=3, Type=typing.Union[Nullable, int]),
                    ])

            softwareVersion: 'uint' = 0
            bytesDownloaded: 'uint' = 0
            progressPercent: 'typing.Union[Nullable, uint]' = NullValue
            platformCode: 'typing.Union[Nullable, int]' = NullValue
