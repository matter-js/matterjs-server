"""OtaSoftwareUpdateProvider cluster definition (auto-generated, DO NOT edit)."""

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
class OtaSoftwareUpdateProvider(Cluster):
    id: typing.ClassVar[int] = 0x00000029

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StatusEnum(MatterIntEnum):
            kUpdateAvailable = 0x00
            kBusy = 0x01
            kNotAvailable = 0x02
            kDownloadProtocolNotSupported = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ApplyUpdateActionEnum(MatterIntEnum):
            kProceed = 0x00
            kAwaitNextAction = 0x01
            kDiscontinue = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class DownloadProtocolEnum(MatterIntEnum):
            kBdxSynchronous = 0x00
            kBdxAsynchronous = 0x01
            kHttps = 0x02
            kVendorSpecific = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

    class Commands:
        @dataclass
        class QueryImage(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000029
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'QueryImageResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="vendorID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="productID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="softwareVersion", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="protocolsSupported", Tag=3, Type=typing.List[typing.Optional[OtaSoftwareUpdateProvider.Enums.DownloadProtocolEnum]]),
                        ClusterObjectFieldDescriptor(Label="hardwareVersion", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="location", Tag=5, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="requestorCanConsent", Tag=6, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="metadataForProvider", Tag=7, Type=typing.Optional[bytes]),
                    ])

            vendorID: 'uint' = 0
            productID: 'uint' = 0
            softwareVersion: 'uint' = 0
            protocolsSupported: 'typing.List[typing.Optional[OtaSoftwareUpdateProvider.Enums.DownloadProtocolEnum]]' = field(default_factory=lambda: [])
            hardwareVersion: 'typing.Optional[uint]' = None
            location: 'typing.Optional[str]' = None
            requestorCanConsent: 'typing.Optional[bool]' = None
            metadataForProvider: 'typing.Optional[bytes]' = None

        @dataclass
        class ApplyUpdateRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000029
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ApplyUpdateResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="updateToken", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="newVersion", Tag=1, Type=uint),
                    ])

            updateToken: 'bytes' = b""
            newVersion: 'uint' = 0

        @dataclass
        class NotifyUpdateApplied(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000029
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="updateToken", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="softwareVersion", Tag=1, Type=uint),
                    ])

            updateToken: 'bytes' = b""
            softwareVersion: 'uint' = 0

        @dataclass
        class QueryImageResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000029
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=OtaSoftwareUpdateProvider.Enums.StatusEnum),
                        ClusterObjectFieldDescriptor(Label="delayedActionTime", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="imageUri", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="softwareVersion", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="softwareVersionString", Tag=4, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="updateToken", Tag=5, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="userConsentNeeded", Tag=6, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="metadataForRequestor", Tag=7, Type=typing.Optional[bytes]),
                    ])

            status: 'OtaSoftwareUpdateProvider.Enums.StatusEnum' = 0
            delayedActionTime: 'typing.Optional[uint]' = None
            imageUri: 'typing.Optional[str]' = None
            softwareVersion: 'typing.Optional[uint]' = None
            softwareVersionString: 'typing.Optional[str]' = None
            updateToken: 'typing.Optional[bytes]' = None
            userConsentNeeded: 'typing.Optional[bool]' = None
            metadataForRequestor: 'typing.Optional[bytes]' = None

        @dataclass
        class ApplyUpdateResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000029
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="action", Tag=0, Type=OtaSoftwareUpdateProvider.Enums.ApplyUpdateActionEnum),
                        ClusterObjectFieldDescriptor(Label="delayedActionTime", Tag=1, Type=uint),
                    ])

            action: 'OtaSoftwareUpdateProvider.Enums.ApplyUpdateActionEnum' = 0
            delayedActionTime: 'uint' = 0

    class Attributes:
        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000029

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
                return 0x00000029

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
                return 0x00000029

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
                return 0x00000029

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
                return 0x00000029

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
