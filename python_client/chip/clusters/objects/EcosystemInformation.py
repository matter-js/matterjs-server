"""EcosystemInformation cluster definition (auto-generated, DO NOT edit)."""

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
class EcosystemInformation(Cluster):
    id: typing.ClassVar[int] = 0x00000750

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="deviceDirectory", Tag=0x00000000, Type=typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemDeviceStruct]]),
                ClusterObjectFieldDescriptor(Label="locationDirectory", Tag=0x00000001, Type=typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemLocationStruct]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    deviceDirectory: 'typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemDeviceStruct]]' = field(default_factory=lambda: [])
    locationDirectory: 'typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemLocationStruct]]' = field(default_factory=lambda: [])
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Structs:
        @dataclass
        class DeviceTypeStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="deviceType", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="revision", Tag=1, Type=uint),
                    ])

            deviceType: 'uint' = 0
            revision: 'uint' = 0

        @dataclass
        class EcosystemDeviceStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="deviceName", Tag=0, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="deviceNameLastEdit", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="bridgedEndpoint", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="originalEndpoint", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="deviceTypes", Tag=4, Type=typing.List[typing.Optional[EcosystemInformation.Structs.DeviceTypeStruct]]),
                        ClusterObjectFieldDescriptor(Label="uniqueLocationIDs", Tag=5, Type=typing.List[typing.Optional[str]]),
                        ClusterObjectFieldDescriptor(Label="uniqueLocationIDsLastEdit", Tag=6, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            deviceName: 'typing.Optional[str]' = None
            deviceNameLastEdit: 'typing.Optional[uint]' = None
            bridgedEndpoint: 'typing.Optional[uint]' = None
            originalEndpoint: 'typing.Optional[uint]' = None
            deviceTypes: 'typing.List[typing.Optional[EcosystemInformation.Structs.DeviceTypeStruct]]' = field(default_factory=lambda: [])
            uniqueLocationIDs: 'typing.List[typing.Optional[str]]' = field(default_factory=lambda: [])
            uniqueLocationIDsLastEdit: 'uint' = 0
            fabricIndex: 'uint' = 0

        @dataclass
        class EcosystemLocationStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="uniqueLocationId", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="locationDescriptor", Tag=1, Type=Globals.Structs.locationdesc),
                        ClusterObjectFieldDescriptor(Label="locationDescriptorLastEdit", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            uniqueLocationId: 'str' = ""
            locationDescriptor: 'Globals.Structs.locationdesc' = field(default_factory=lambda: Globals.Structs.locationdesc())
            locationDescriptorLastEdit: 'uint' = 0
            fabricIndex: 'uint' = 0


    class Attributes:
        @dataclass
        class DeviceDirectory(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000750

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemDeviceStruct]])

            value: 'typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemDeviceStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class LocationDirectory(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000750

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemLocationStruct]])

            value: 'typing.List[typing.Optional[EcosystemInformation.Structs.EcosystemLocationStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000750

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
                return 0x00000750

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
                return 0x00000750

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
                return 0x00000750

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
                return 0x00000750

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

