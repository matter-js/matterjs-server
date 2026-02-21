"""OperationalCredentials cluster definition (auto-generated, DO NOT edit)."""

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
class OperationalCredentials(Cluster):
    id: typing.ClassVar[int] = 0x0000003E

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="nocs", Tag=0x00000000, Type=typing.List[typing.Optional[OperationalCredentials.Structs.NOCStruct]]),
                ClusterObjectFieldDescriptor(Label="fabrics", Tag=0x00000001, Type=typing.List[typing.Optional[OperationalCredentials.Structs.FabricDescriptorStruct]]),
                ClusterObjectFieldDescriptor(Label="supportedFabrics", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="commissionedFabrics", Tag=0x00000003, Type=uint),
                ClusterObjectFieldDescriptor(Label="trustedRootCertificates", Tag=0x00000004, Type=typing.List[typing.Optional[bytes]]),
                ClusterObjectFieldDescriptor(Label="currentFabricIndex", Tag=0x00000005, Type=uint),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    nocs: 'typing.List[typing.Optional[OperationalCredentials.Structs.NOCStruct]]' = field(default_factory=lambda: [])
    fabrics: 'typing.List[typing.Optional[OperationalCredentials.Structs.FabricDescriptorStruct]]' = field(default_factory=lambda: [])
    supportedFabrics: 'uint' = 0
    commissionedFabrics: 'uint' = 0
    trustedRootCertificates: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])
    currentFabricIndex: 'uint' = 0
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class CertificateChainTypeEnum(MatterIntEnum):
            kDacCertificate = 0x01
            kPaiCertificate = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class NodeOperationalCertStatusEnum(MatterIntEnum):
            kOk = 0x00
            kInvalidPublicKey = 0x01
            kInvalidNodeOpId = 0x02
            kInvalidNoc = 0x03
            kMissingCsr = 0x04
            kTableFull = 0x05
            kInvalidAdminSubject = 0x06
            kFabricConflict = 0x09
            kLabelConflict = 0x0A
            kInvalidFabricIndex = 0x0B
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 12


    class Structs:
        @dataclass
        class NOCStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="noc", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="icac", Tag=2, Type=typing.Union[Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="vvsc", Tag=3, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            noc: 'bytes' = b""
            icac: 'typing.Union[Nullable, bytes]' = NullValue
            vvsc: 'typing.Optional[bytes]' = None
            fabricIndex: 'uint' = 0

        @dataclass
        class FabricDescriptorStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rootPublicKey", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="vendorId", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricId", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nodeId", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="label", Tag=5, Type=str),
                        ClusterObjectFieldDescriptor(Label="vidVerificationStatement", Tag=6, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            rootPublicKey: 'bytes' = b""
            vendorId: 'uint' = 0
            fabricId: 'uint' = 0
            nodeId: 'uint' = 0
            label: 'str' = ""
            vidVerificationStatement: 'typing.Optional[bytes]' = None
            fabricIndex: 'uint' = 0


    class Commands:
        @dataclass
        class AttestationRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'AttestationResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="attestationNonce", Tag=0, Type=bytes),
                    ])

            attestationNonce: 'bytes' = b""

        @dataclass
        class CertificateChainRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'CertificateChainResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="certificateType", Tag=0, Type=OperationalCredentials.Enums.CertificateChainTypeEnum),
                    ])

            certificateType: 'OperationalCredentials.Enums.CertificateChainTypeEnum' = 0

        @dataclass
        class CSRRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'CSRResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="csrNonce", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="isForUpdateNoc", Tag=1, Type=typing.Optional[bool]),
                    ])

            csrNonce: 'bytes' = b""
            isForUpdateNoc: 'typing.Optional[bool]' = None

        @dataclass
        class AddNOC(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NOCResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nocValue", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="icacValue", Tag=1, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="ipkValue", Tag=2, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="caseAdminSubject", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="adminVendorId", Tag=4, Type=uint),
                    ])

            nocValue: 'bytes' = b""
            icacValue: 'typing.Optional[bytes]' = None
            ipkValue: 'bytes' = b""
            caseAdminSubject: 'uint' = 0
            adminVendorId: 'uint' = 0

        @dataclass
        class UpdateNOC(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NOCResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nocValue", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="icacValue", Tag=1, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            nocValue: 'bytes' = b""
            icacValue: 'typing.Optional[bytes]' = None
            fabricIndex: 'uint' = 0

        @dataclass
        class UpdateFabricLabel(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NOCResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="label", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            label: 'str' = ""
            fabricIndex: 'uint' = 0

        @dataclass
        class RemoveFabric(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NOCResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=0, Type=uint),
                    ])

            fabricIndex: 'uint' = 0

        @dataclass
        class AddTrustedRootCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rootCaCertificate", Tag=0, Type=bytes),
                    ])

            rootCaCertificate: 'bytes' = b""

        @dataclass
        class SetVIDVerificationStatement(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="vendorId", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="vidVerificationStatement", Tag=1, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="vvsc", Tag=2, Type=typing.Optional[bytes]),
                    ])

            vendorId: 'typing.Optional[uint]' = None
            vidVerificationStatement: 'typing.Optional[bytes]' = None
            vvsc: 'typing.Optional[bytes]' = None

        @dataclass
        class SignVIDVerificationRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x0000000D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SignVIDVerificationResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="clientChallenge", Tag=1, Type=bytes),
                    ])

            fabricIndex: 'uint' = 0
            clientChallenge: 'bytes' = b""

        @dataclass
        class AttestationResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="attestationElements", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="attestationSignature", Tag=1, Type=bytes),
                    ])

            attestationElements: 'bytes' = b""
            attestationSignature: 'bytes' = b""

        @dataclass
        class CertificateChainResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="certificate", Tag=0, Type=bytes),
                    ])

            certificate: 'bytes' = b""

        @dataclass
        class CSRResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nocsrElements", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="attestationSignature", Tag=1, Type=bytes),
                    ])

            nocsrElements: 'bytes' = b""
            attestationSignature: 'bytes' = b""

        @dataclass
        class NOCResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="statusCode", Tag=0, Type=OperationalCredentials.Enums.NodeOperationalCertStatusEnum),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=2, Type=typing.Optional[str]),
                    ])

            statusCode: 'OperationalCredentials.Enums.NodeOperationalCertStatusEnum' = 0
            fabricIndex: 'typing.Optional[uint]' = None
            debugText: 'typing.Optional[str]' = None

        @dataclass
        class SignVIDVerificationResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000003E
            command_id: typing.ClassVar[int] = 0x0000000E
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricBindingVersion", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="signature", Tag=2, Type=bytes),
                    ])

            fabricIndex: 'uint' = 0
            fabricBindingVersion: 'uint' = 0
            signature: 'bytes' = b""


    class Attributes:
        @dataclass
        class Nocs(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[OperationalCredentials.Structs.NOCStruct]])

            value: 'typing.List[typing.Optional[OperationalCredentials.Structs.NOCStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class Fabrics(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[OperationalCredentials.Structs.FabricDescriptorStruct]])

            value: 'typing.List[typing.Optional[OperationalCredentials.Structs.FabricDescriptorStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class SupportedFabrics(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class CommissionedFabrics(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class TrustedRootCertificates(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[bytes]])

            value: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])

        @dataclass
        class CurrentFabricIndex(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000003E

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
                return 0x0000003E

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
                return 0x0000003E

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
                return 0x0000003E

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
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

