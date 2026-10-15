"""UnitTestingCluster cluster definition (auto-generated, DO NOT edit)."""

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
class UnitTestingCluster(Cluster):
    id: typing.ClassVar[int] = 0xFFF1FC05

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="floatSingle", Tag=0x00000017, Type=typing.Optional[float32]),
                ClusterObjectFieldDescriptor(Label="octetString", Tag=0x00000019, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="structAttr", Tag=0x00000025, Type=typing.Optional[UnitTestingCluster.Structs.UnitTestingSimpleStruct]),
                ClusterObjectFieldDescriptor(Label="listLongOctetString", Tag=0x0000002A, Type=typing.Optional[typing.List[bytes]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    floatSingle: typing.Optional[float32] = None
    octetString: typing.Optional[bytes] = None
    structAttr: typing.Optional[UnitTestingCluster.Structs.UnitTestingSimpleStruct] = None
    listLongOctetString: typing.Optional[typing.List[bytes]] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class SimpleEnum(MatterIntEnum):
            kUnspecified = 0x00
            kValueA = 0x01
            kValueB = 0x02
            kValueC = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class TestGlobalEnum(MatterIntEnum):
            kSomeValue = 0x00
            kSomeOtherValue = 0x01
            kFinalValue = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class SimpleBitmap(IntFlag):
            kValueA = 0x1
            kValueB = 0x2
            kValueC = 0x4

    class Structs:
        @dataclass
        class UnitTestingSimpleStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="a", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="b", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="c", Tag=2, Type=UnitTestingCluster.Enums.SimpleEnum),
                        ClusterObjectFieldDescriptor(Label="d", Tag=3, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="e", Tag=4, Type=str),
                        ClusterObjectFieldDescriptor(Label="f", Tag=5, Type=UnitTestingCluster.Bitmaps.SimpleBitmap),
                        ClusterObjectFieldDescriptor(Label="g", Tag=6, Type=float32),
                        ClusterObjectFieldDescriptor(Label="h", Tag=7, Type=float),
                        ClusterObjectFieldDescriptor(Label="i", Tag=8, Type=typing.Optional[UnitTestingCluster.Enums.TestGlobalEnum]),
                    ])

            a: uint = 0
            b: bool = False
            c: UnitTestingCluster.Enums.SimpleEnum = 0
            d: bytes = b""
            e: str = ""
            f: UnitTestingCluster.Bitmaps.SimpleBitmap = 0
            g: float32 = 0.0
            h: float = 0.0
            i: typing.Optional[UnitTestingCluster.Enums.TestGlobalEnum] = None

    class Attributes:
        @dataclass
        class FloatSingle(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[float32])

            value: typing.Optional[float32] = None

        @dataclass
        class OctetString(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000019

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: typing.Optional[bytes] = None

        @dataclass
        class StructAttr(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[UnitTestingCluster.Structs.UnitTestingSimpleStruct])

            value: typing.Optional[UnitTestingCluster.Structs.UnitTestingSimpleStruct] = None

        @dataclass
        class ListLongOctetString(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[bytes]])

            value: typing.Optional[typing.List[bytes]] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC05

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
                return 0xFFF1FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC05

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
                return 0xFFF1FC05

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
                return 0xFFF1FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
