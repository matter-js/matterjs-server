"""PressureMeasurement cluster definition (auto-generated, DO NOT edit)."""

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
class PressureMeasurement(Cluster):
    id: typing.ClassVar[int] = 0x00000403

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="measuredValue", Tag=0x00000000, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="minMeasuredValue", Tag=0x00000001, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="maxMeasuredValue", Tag=0x00000002, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="tolerance", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="scaledValue", Tag=0x00000010, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="minScaledValue", Tag=0x00000011, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="maxScaledValue", Tag=0x00000012, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="scaledTolerance", Tag=0x00000013, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="scale", Tag=0x00000014, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    measuredValue: 'typing.Union[Nullable, int]' = NullValue
    minMeasuredValue: 'typing.Union[Nullable, int]' = NullValue
    maxMeasuredValue: 'typing.Union[Nullable, int]' = NullValue
    tolerance: 'typing.Optional[uint]' = None
    scaledValue: 'typing.Union[None, Nullable, int]' = None
    minScaledValue: 'typing.Union[None, Nullable, int]' = None
    maxScaledValue: 'typing.Union[None, Nullable, int]' = None
    scaledTolerance: 'typing.Optional[uint]' = None
    scale: 'typing.Optional[int]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Bitmaps:
        class Feature(IntFlag):
            kExtended = 0x1

    class Attributes:
        @dataclass
        class MeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class MinMeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class MaxMeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class Tolerance(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ScaledValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MinScaledValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MaxScaledValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class ScaledTolerance(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Scale(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: 'typing.Optional[int]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000403

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
                return 0x00000403

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
                return 0x00000403

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
                return 0x00000403

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
                return 0x00000403

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
