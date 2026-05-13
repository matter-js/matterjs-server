"""TlsCertificateManagement cluster definition (auto-generated, DO NOT edit)."""

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
class TlsCertificateManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000801

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="maxRootCertificates", Tag=0x00000000, Type=uint),
                ClusterObjectFieldDescriptor(Label="provisionedRootCertificates", Tag=0x00000001, Type=typing.List[TlsCertificateManagement.Structs.TLSCertStruct]),
                ClusterObjectFieldDescriptor(Label="maxClientCertificates", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="provisionedClientCertificates", Tag=0x00000003, Type=typing.List[TlsCertificateManagement.Structs.TLSClientCertificateDetailStruct]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    maxRootCertificates: uint = 0
    provisionedRootCertificates: typing.List[TlsCertificateManagement.Structs.TLSCertStruct] = field(default_factory=lambda: [])
    maxClientCertificates: uint = 0
    provisionedClientCertificates: typing.List[TlsCertificateManagement.Structs.TLSClientCertificateDetailStruct] = field(default_factory=lambda: [])
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Structs:
        @dataclass
        class TLSCertStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="caid", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="certificate", Tag=1, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            caid: uint = 0
            certificate: typing.Optional[bytes] = None
            fabricIndex: uint = 0

        @dataclass
        class TLSClientCertificateDetailStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="clientCertificate", Tag=1, Type=typing.Union[None, Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="intermediateCertificates", Tag=2, Type=typing.Optional[typing.List[bytes]]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            ccdid: uint = 0
            clientCertificate: typing.Union[None, Nullable, bytes] = None
            intermediateCertificates: typing.Optional[typing.List[bytes]] = None
            fabricIndex: uint = 0

    class Commands:
        @dataclass
        class ProvisionRootCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ProvisionRootCertificateResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="certificate", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="caid", Tag=1, Type=typing.Union[Nullable, uint]),
                    ])

            certificate: bytes = b""
            caid: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class FindRootCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'FindRootCertificateResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="caid", Tag=0, Type=typing.Union[Nullable, uint]),
                    ])

            caid: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class LookupRootCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'LookupRootCertificateResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="fingerprint", Tag=0, Type=bytes),
                    ])

            fingerprint: bytes = b""

        @dataclass
        class RemoveRootCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="caid", Tag=0, Type=uint),
                    ])

            caid: uint = 0

        @dataclass
        class ClientCSR(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ClientCSRResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nonce", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=1, Type=typing.Union[Nullable, uint]),
                    ])

            nonce: bytes = b""
            ccdid: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class ProvisionClientCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="clientCertificate", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="intermediateCertificates", Tag=2, Type=typing.List[bytes]),
                    ])

            ccdid: uint = 0
            clientCertificate: bytes = b""
            intermediateCertificates: typing.List[bytes] = field(default_factory=lambda: [])

        @dataclass
        class FindClientCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'FindClientCertificateResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=0, Type=typing.Union[Nullable, uint]),
                    ])

            ccdid: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class LookupClientCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'LookupClientCertificateResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="fingerprint", Tag=0, Type=bytes),
                    ])

            fingerprint: bytes = b""

        @dataclass
        class RemoveClientCertificate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x0000000E
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=0, Type=uint),
                    ])

            ccdid: uint = 0

        @dataclass
        class ProvisionRootCertificateResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="caid", Tag=0, Type=uint),
                    ])

            caid: uint = 0

        @dataclass
        class FindRootCertificateResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="certificateDetails", Tag=0, Type=typing.List[TlsCertificateManagement.Structs.TLSCertStruct]),
                    ])

            certificateDetails: typing.List[TlsCertificateManagement.Structs.TLSCertStruct] = field(default_factory=lambda: [])

        @dataclass
        class LookupRootCertificateResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="caid", Tag=0, Type=uint),
                    ])

            caid: uint = 0

        @dataclass
        class ClientCSRResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="CSR", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="nonceSignature", Tag=2, Type=bytes),
                    ])

            ccdid: uint = 0
            CSR: bytes = b""
            nonceSignature: bytes = b""

        @dataclass
        class FindClientCertificateResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="certificateDetails", Tag=0, Type=typing.List[TlsCertificateManagement.Structs.TLSClientCertificateDetailStruct]),
                    ])

            certificateDetails: typing.List[TlsCertificateManagement.Structs.TLSClientCertificateDetailStruct] = field(default_factory=lambda: [])

        @dataclass
        class LookupClientCertificateResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000801
            command_id: typing.ClassVar[int] = 0x0000000D
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ccdid", Tag=0, Type=uint),
                    ])

            ccdid: uint = 0

    class Attributes:
        @dataclass
        class MaxRootCertificates(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000801

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class ProvisionedRootCertificates(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000801

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[TlsCertificateManagement.Structs.TLSCertStruct])

            value: typing.List[TlsCertificateManagement.Structs.TLSCertStruct] = field(default_factory=lambda: [])

        @dataclass
        class MaxClientCertificates(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000801

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class ProvisionedClientCertificates(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000801

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[TlsCertificateManagement.Structs.TLSClientCertificateDetailStruct])

            value: typing.List[TlsCertificateManagement.Structs.TLSClientCertificateDetailStruct] = field(default_factory=lambda: [])

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000801

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
                return 0x00000801

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
                return 0x00000801

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
                return 0x00000801

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
                return 0x00000801

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
                return 0x00000801

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
