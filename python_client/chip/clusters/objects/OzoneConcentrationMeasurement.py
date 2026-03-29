"""OzoneConcentrationMeasurement cluster definition (auto-generated, DO NOT edit)."""

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
class OzoneConcentrationMeasurement(Cluster):
    id: typing.ClassVar[int] = 0x00000415

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="measuredValue", Tag=0x00000000, Type=typing.Union[None, Nullable, float32]),
                ClusterObjectFieldDescriptor(Label="minMeasuredValue", Tag=0x00000001, Type=typing.Union[None, Nullable, float32]),
                ClusterObjectFieldDescriptor(Label="maxMeasuredValue", Tag=0x00000002, Type=typing.Union[None, Nullable, float32]),
                ClusterObjectFieldDescriptor(Label="peakMeasuredValue", Tag=0x00000003, Type=typing.Union[None, Nullable, float32]),
                ClusterObjectFieldDescriptor(Label="peakMeasuredValueWindow", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="averageMeasuredValue", Tag=0x00000005, Type=typing.Union[None, Nullable, float32]),
                ClusterObjectFieldDescriptor(Label="averageMeasuredValueWindow", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="uncertainty", Tag=0x00000007, Type=typing.Optional[float32]),
                ClusterObjectFieldDescriptor(Label="measurementUnit", Tag=0x00000008, Type=typing.Optional[OzoneConcentrationMeasurement.Enums.MeasurementUnitEnum]),
                ClusterObjectFieldDescriptor(Label="measurementMedium", Tag=0x00000009, Type=OzoneConcentrationMeasurement.Enums.MeasurementMediumEnum),
                ClusterObjectFieldDescriptor(Label="levelValue", Tag=0x0000000A, Type=typing.Optional[OzoneConcentrationMeasurement.Enums.LevelValueEnum]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    measuredValue: 'typing.Union[None, Nullable, float32]' = None
    minMeasuredValue: 'typing.Union[None, Nullable, float32]' = None
    maxMeasuredValue: 'typing.Union[None, Nullable, float32]' = None
    peakMeasuredValue: 'typing.Union[None, Nullable, float32]' = None
    peakMeasuredValueWindow: 'typing.Optional[uint]' = None
    averageMeasuredValue: 'typing.Union[None, Nullable, float32]' = None
    averageMeasuredValueWindow: 'typing.Optional[uint]' = None
    uncertainty: 'typing.Optional[float32]' = None
    measurementUnit: 'typing.Optional[OzoneConcentrationMeasurement.Enums.MeasurementUnitEnum]' = None
    measurementMedium: 'OzoneConcentrationMeasurement.Enums.MeasurementMediumEnum' = 0
    levelValue: 'typing.Optional[OzoneConcentrationMeasurement.Enums.LevelValueEnum]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class MeasurementUnitEnum(MatterIntEnum):
            kPpm = 0x00
            kPpb = 0x01
            kPpt = 0x02
            kMgm3 = 0x03
            kUgm3 = 0x04
            kNgm3 = 0x05
            kPm3 = 0x06
            kBqm3 = 0x07
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 8

        class MeasurementMediumEnum(MatterIntEnum):
            kAir = 0x00
            kWater = 0x01
            kSoil = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class LevelValueEnum(MatterIntEnum):
            kUnknown = 0x00
            kLow = 0x01
            kMedium = 0x02
            kHigh = 0x03
            kCritical = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

    class Bitmaps:
        class Feature(IntFlag):
            kNumericMeasurement = 0x1
            kLevelIndication = 0x2
            kMediumLevel = 0x4
            kCriticalLevel = 0x8
            kPeakMeasurement = 0x10
            kAverageMeasurement = 0x20

    class Attributes:
        @dataclass
        class MeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, float32])

            value: 'typing.Union[None, Nullable, float32]' = None

        @dataclass
        class MinMeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, float32])

            value: 'typing.Union[None, Nullable, float32]' = None

        @dataclass
        class MaxMeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, float32])

            value: 'typing.Union[None, Nullable, float32]' = None

        @dataclass
        class PeakMeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, float32])

            value: 'typing.Union[None, Nullable, float32]' = None

        @dataclass
        class PeakMeasuredValueWindow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AverageMeasuredValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, float32])

            value: 'typing.Union[None, Nullable, float32]' = None

        @dataclass
        class AverageMeasuredValueWindow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Uncertainty(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[float32])

            value: 'typing.Optional[float32]' = None

        @dataclass
        class MeasurementUnit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[OzoneConcentrationMeasurement.Enums.MeasurementUnitEnum])

            value: 'typing.Optional[OzoneConcentrationMeasurement.Enums.MeasurementUnitEnum]' = None

        @dataclass
        class MeasurementMedium(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OzoneConcentrationMeasurement.Enums.MeasurementMediumEnum)

            value: 'OzoneConcentrationMeasurement.Enums.MeasurementMediumEnum' = 0

        @dataclass
        class LevelValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[OzoneConcentrationMeasurement.Enums.LevelValueEnum])

            value: 'typing.Optional[OzoneConcentrationMeasurement.Enums.LevelValueEnum]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000415

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
                return 0x00000415

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
                return 0x00000415

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
                return 0x00000415

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
                return 0x00000415

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
