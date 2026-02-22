"""ElectricalEnergyMeasurement cluster definition (auto-generated, DO NOT edit)."""

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
class ElectricalEnergyMeasurement(Cluster):
    id: typing.ClassVar[int] = 0x00000091

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="accuracy", Tag=0x00000000, Type=Globals.Structs.MeasurementAccuracyStruct),
                ClusterObjectFieldDescriptor(Label="cumulativeEnergyImported", Tag=0x00000001, Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                ClusterObjectFieldDescriptor(Label="cumulativeEnergyExported", Tag=0x00000002, Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                ClusterObjectFieldDescriptor(Label="periodicEnergyImported", Tag=0x00000003, Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                ClusterObjectFieldDescriptor(Label="periodicEnergyExported", Tag=0x00000004, Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                ClusterObjectFieldDescriptor(Label="cumulativeEnergyReset", Tag=0x00000005, Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.CumulativeEnergyResetStruct]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    accuracy: 'Globals.Structs.MeasurementAccuracyStruct' = field(default_factory=lambda: Globals.Structs.MeasurementAccuracyStruct())
    cumulativeEnergyImported: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
    cumulativeEnergyExported: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
    periodicEnergyImported: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
    periodicEnergyExported: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
    cumulativeEnergyReset: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.CumulativeEnergyResetStruct]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class MeasurementTypeEnum(MatterIntEnum):
            kUnspecified = 0x00
            kVoltage = 0x01
            kActiveCurrent = 0x02
            kReactiveCurrent = 0x03
            kApparentCurrent = 0x04
            kActivePower = 0x05
            kReactivePower = 0x06
            kApparentPower = 0x07
            kRmsVoltage = 0x08
            kRmsCurrent = 0x09
            kRmsPower = 0x0A
            kFrequency = 0x0B
            kPowerFactor = 0x0C
            kNeutralCurrent = 0x0D
            kElectricalEnergy = 0x0E
            kReactiveEnergy = 0x0F
            kApparentEnergy = 0x10
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 17

    class Bitmaps:
        class Feature(IntFlag):
            kImportedEnergy = 0x1
            kExportedEnergy = 0x2
            kCumulativeEnergy = 0x4
            kPeriodicEnergy = 0x8

    class Structs:
        @dataclass
        class EnergyMeasurementStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="energy", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="startTimestamp", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endTimestamp", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="startSystime", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endSystime", Tag=4, Type=typing.Optional[uint]),
                    ])

            energy: 'uint' = 0
            startTimestamp: 'typing.Optional[uint]' = None
            endTimestamp: 'typing.Optional[uint]' = None
            startSystime: 'typing.Optional[uint]' = None
            endSystime: 'typing.Optional[uint]' = None

        @dataclass
        class CumulativeEnergyResetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="importedResetTimestamp", Tag=0, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="exportedResetTimestamp", Tag=1, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="importedResetSystime", Tag=2, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="exportedResetSystime", Tag=3, Type=typing.Union[None, Nullable, uint]),
                    ])

            importedResetTimestamp: 'typing.Union[None, Nullable, uint]' = None
            exportedResetTimestamp: 'typing.Union[None, Nullable, uint]' = None
            importedResetSystime: 'typing.Union[None, Nullable, uint]' = None
            exportedResetSystime: 'typing.Union[None, Nullable, uint]' = None

    class Attributes:
        @dataclass
        class Accuracy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=Globals.Structs.MeasurementAccuracyStruct)

            value: 'Globals.Structs.MeasurementAccuracyStruct' = field(default_factory=lambda: Globals.Structs.MeasurementAccuracyStruct())

        @dataclass
        class CumulativeEnergyImported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct])

            value: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None

        @dataclass
        class CumulativeEnergyExported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct])

            value: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None

        @dataclass
        class PeriodicEnergyImported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct])

            value: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None

        @dataclass
        class PeriodicEnergyExported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct])

            value: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None

        @dataclass
        class CumulativeEnergyReset(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.CumulativeEnergyResetStruct])

            value: 'typing.Union[None, Nullable, ElectricalEnergyMeasurement.Structs.CumulativeEnergyResetStruct]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

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
                return 0x00000091

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
                return 0x00000091

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
                return 0x00000091

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
                return 0x00000091

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class CumulativeEnergyMeasured(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="energyImported", Tag=0, Type=typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                        ClusterObjectFieldDescriptor(Label="energyExported", Tag=1, Type=typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                    ])

            energyImported: 'typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
            energyExported: 'typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None

        @dataclass
        class PeriodicEnergyMeasured(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000091

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="energyImported", Tag=0, Type=typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                        ClusterObjectFieldDescriptor(Label="energyExported", Tag=1, Type=typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]),
                    ])

            energyImported: 'typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
            energyExported: 'typing.Optional[ElectricalEnergyMeasurement.Structs.EnergyMeasurementStruct]' = None
