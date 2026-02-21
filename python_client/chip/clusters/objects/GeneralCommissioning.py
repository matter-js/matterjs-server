"""GeneralCommissioning cluster definition (auto-generated, DO NOT edit)."""

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
class GeneralCommissioning(Cluster):
    id: typing.ClassVar[int] = 0x00000030

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=0x00000000, Type=uint),
                ClusterObjectFieldDescriptor(Label="basicCommissioningInfo", Tag=0x00000001, Type=GeneralCommissioning.Structs.BasicCommissioningInfo),
                ClusterObjectFieldDescriptor(Label="regulatoryConfig", Tag=0x00000002, Type=GeneralCommissioning.Enums.RegulatoryLocationTypeEnum),
                ClusterObjectFieldDescriptor(Label="locationCapability", Tag=0x00000003, Type=GeneralCommissioning.Enums.RegulatoryLocationTypeEnum),
                ClusterObjectFieldDescriptor(Label="supportsConcurrentConnection", Tag=0x00000004, Type=bool),
                ClusterObjectFieldDescriptor(Label="tcAcceptedVersion", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="tcMinRequiredVersion", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="tcAcknowledgements", Tag=0x00000007, Type=typing.Optional[Globals.Bitmaps.map16]),
                ClusterObjectFieldDescriptor(Label="tcAcknowledgementsRequired", Tag=0x00000008, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="tcUpdateDeadline", Tag=0x00000009, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    breadcrumb: 'uint' = 0
    basicCommissioningInfo: 'GeneralCommissioning.Structs.BasicCommissioningInfo' = field(default_factory=lambda: GeneralCommissioning.Structs.BasicCommissioningInfo())
    regulatoryConfig: 'GeneralCommissioning.Enums.RegulatoryLocationTypeEnum' = 0
    locationCapability: 'GeneralCommissioning.Enums.RegulatoryLocationTypeEnum' = 0
    supportsConcurrentConnection: 'bool' = False
    tcAcceptedVersion: 'typing.Optional[uint]' = None
    tcMinRequiredVersion: 'typing.Optional[uint]' = None
    tcAcknowledgements: 'typing.Optional[Globals.Bitmaps.map16]' = None
    tcAcknowledgementsRequired: 'typing.Optional[bool]' = None
    tcUpdateDeadline: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class CommissioningErrorEnum(MatterIntEnum):
            kOk = 0x00
            kValueOutsideRange = 0x01
            kInvalidAuthentication = 0x02
            kNoFailSafe = 0x03
            kBusyWithOtherAdmin = 0x04
            kRequiredTcNotAccepted = 0x05
            kTcAcknowledgementsNotReceived = 0x06
            kTcMinVersionNotMet = 0x07
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 8

        class RegulatoryLocationTypeEnum(MatterIntEnum):
            kIndoor = 0x00
            kOutdoor = 0x01
            kIndoorOutdoor = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class Feature(IntFlag):
            kTermsAndConditions = 0x1

    class Structs:
        @dataclass
        class BasicCommissioningInfo(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="failSafeExpiryLengthSeconds", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maxCumulativeFailsafeSeconds", Tag=1, Type=uint),
                    ])

            failSafeExpiryLengthSeconds: 'uint' = 0
            maxCumulativeFailsafeSeconds: 'uint' = 0

    class Commands:
        @dataclass
        class ArmFailSafe(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ArmFailSafeResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="expiryLengthSeconds", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=1, Type=uint),
                    ])

            expiryLengthSeconds: 'uint' = 0
            breadcrumb: 'uint' = 0

        @dataclass
        class SetRegulatoryConfig(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SetRegulatoryConfigResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="newRegulatoryConfig", Tag=0, Type=GeneralCommissioning.Enums.RegulatoryLocationTypeEnum),
                        ClusterObjectFieldDescriptor(Label="countryCode", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=2, Type=uint),
                    ])

            newRegulatoryConfig: 'GeneralCommissioning.Enums.RegulatoryLocationTypeEnum' = 0
            countryCode: 'str' = ""
            breadcrumb: 'uint' = 0

        @dataclass
        class CommissioningComplete(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'CommissioningCompleteResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SetTCAcknowledgements(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SetTCAcknowledgementsResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="tcVersion", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="tcUserResponse", Tag=1, Type=Globals.Bitmaps.map16),
                    ])

            tcVersion: 'uint' = 0
            tcUserResponse: 'Globals.Bitmaps.map16' = 0

        @dataclass
        class ArmFailSafeResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=GeneralCommissioning.Enums.CommissioningErrorEnum),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=1, Type=str),
                    ])

            errorCode: 'GeneralCommissioning.Enums.CommissioningErrorEnum' = 0
            debugText: 'str' = ""

        @dataclass
        class SetRegulatoryConfigResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=GeneralCommissioning.Enums.CommissioningErrorEnum),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=1, Type=str),
                    ])

            errorCode: 'GeneralCommissioning.Enums.CommissioningErrorEnum' = 0
            debugText: 'str' = ""

        @dataclass
        class CommissioningCompleteResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=GeneralCommissioning.Enums.CommissioningErrorEnum),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=1, Type=str),
                    ])

            errorCode: 'GeneralCommissioning.Enums.CommissioningErrorEnum' = 0
            debugText: 'str' = ""

        @dataclass
        class SetTCAcknowledgementsResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000030
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=GeneralCommissioning.Enums.CommissioningErrorEnum),
                    ])

            errorCode: 'GeneralCommissioning.Enums.CommissioningErrorEnum' = 0

    class Attributes:
        @dataclass
        class Breadcrumb(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class BasicCommissioningInfo(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=GeneralCommissioning.Structs.BasicCommissioningInfo)

            value: 'GeneralCommissioning.Structs.BasicCommissioningInfo' = field(default_factory=lambda: GeneralCommissioning.Structs.BasicCommissioningInfo())

        @dataclass
        class RegulatoryConfig(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=GeneralCommissioning.Enums.RegulatoryLocationTypeEnum)

            value: 'GeneralCommissioning.Enums.RegulatoryLocationTypeEnum' = 0

        @dataclass
        class LocationCapability(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=GeneralCommissioning.Enums.RegulatoryLocationTypeEnum)

            value: 'GeneralCommissioning.Enums.RegulatoryLocationTypeEnum' = 0

        @dataclass
        class SupportsConcurrentConnection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class TcAcceptedVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TcMinRequiredVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TcAcknowledgements(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Globals.Bitmaps.map16])

            value: 'typing.Optional[Globals.Bitmaps.map16]' = None

        @dataclass
        class TcAcknowledgementsRequired(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class TcUpdateDeadline(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000030

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
                return 0x00000030

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
                return 0x00000030

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
                return 0x00000030

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
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
