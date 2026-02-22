"""ThreadNetworkDirectory cluster definition (auto-generated, DO NOT edit)."""

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
class ThreadNetworkDirectory(Cluster):
    id: typing.ClassVar[int] = 0x00000453

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="preferredExtendedPanID", Tag=0x00000000, Type=typing.Union[Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="threadNetworks", Tag=0x00000001, Type=typing.List[typing.Optional[ThreadNetworkDirectory.Structs.ThreadNetworkStruct]]),
                ClusterObjectFieldDescriptor(Label="threadNetworkTableSize", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    preferredExtendedPanID: 'typing.Union[Nullable, bytes]' = NullValue
    threadNetworks: 'typing.List[typing.Optional[ThreadNetworkDirectory.Structs.ThreadNetworkStruct]]' = field(default_factory=lambda: [])
    threadNetworkTableSize: 'uint' = 0
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Structs:
        @dataclass
        class ThreadNetworkStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="extendedPanID", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="networkName", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="channel", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="activeTimestamp", Tag=3, Type=uint),
                    ])

            extendedPanID: 'bytes' = b""
            networkName: 'str' = ""
            channel: 'uint' = 0
            activeTimestamp: 'uint' = 0

    class Commands:
        @dataclass
        class AddNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000453
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operationalDataset", Tag=0, Type=bytes),
                    ])

            operationalDataset: 'bytes' = b""

        @dataclass
        class RemoveNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000453
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="extendedPanID", Tag=0, Type=bytes),
                    ])

            extendedPanID: 'bytes' = b""

        @dataclass
        class GetOperationalDataset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000453
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'OperationalDatasetResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="extendedPanID", Tag=0, Type=bytes),
                    ])

            extendedPanID: 'bytes' = b""

        @dataclass
        class OperationalDatasetResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000453
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operationalDataset", Tag=0, Type=bytes),
                    ])

            operationalDataset: 'bytes' = b""

    class Attributes:
        @dataclass
        class PreferredExtendedPanId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000453

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, bytes])

            value: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class ThreadNetworks(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000453

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[ThreadNetworkDirectory.Structs.ThreadNetworkStruct]])

            value: 'typing.List[typing.Optional[ThreadNetworkDirectory.Structs.ThreadNetworkStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class ThreadNetworkTableSize(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000453

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000453

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
                return 0x00000453

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
                return 0x00000453

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
                return 0x00000453

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
                return 0x00000453

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
