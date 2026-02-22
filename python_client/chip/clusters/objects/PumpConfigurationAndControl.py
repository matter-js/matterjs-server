"""PumpConfigurationAndControl cluster definition (auto-generated, DO NOT edit)."""

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
class PumpConfigurationAndControl(Cluster):
    id: typing.ClassVar[int] = 0x00000200

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="maxPressure", Tag=0x00000000, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="maxSpeed", Tag=0x00000001, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="maxFlow", Tag=0x00000002, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="minConstPressure", Tag=0x00000003, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="maxConstPressure", Tag=0x00000004, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="minCompPressure", Tag=0x00000005, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="maxCompPressure", Tag=0x00000006, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="minConstSpeed", Tag=0x00000007, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="maxConstSpeed", Tag=0x00000008, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="minConstFlow", Tag=0x00000009, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="maxConstFlow", Tag=0x0000000A, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="minConstTemp", Tag=0x0000000B, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="maxConstTemp", Tag=0x0000000C, Type=typing.Union[None, Nullable, int]),
                ClusterObjectFieldDescriptor(Label="pumpStatus", Tag=0x00000010, Type=typing.Optional[PumpConfigurationAndControl.Bitmaps.PumpStatusBitmap]),
                ClusterObjectFieldDescriptor(Label="effectiveOperationMode", Tag=0x00000011, Type=PumpConfigurationAndControl.Enums.OperationModeEnum),
                ClusterObjectFieldDescriptor(Label="effectiveControlMode", Tag=0x00000012, Type=PumpConfigurationAndControl.Enums.ControlModeEnum),
                ClusterObjectFieldDescriptor(Label="capacity", Tag=0x00000013, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="speed", Tag=0x00000014, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="lifetimeRunningHours", Tag=0x00000015, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="power", Tag=0x00000016, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="lifetimeEnergyConsumed", Tag=0x00000017, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="operationMode", Tag=0x00000020, Type=PumpConfigurationAndControl.Enums.OperationModeEnum),
                ClusterObjectFieldDescriptor(Label="controlMode", Tag=0x00000021, Type=typing.Optional[PumpConfigurationAndControl.Enums.ControlModeEnum]),
                ClusterObjectFieldDescriptor(Label="alarmMask", Tag=0x00000022, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    maxPressure: 'typing.Union[Nullable, int]' = NullValue
    maxSpeed: 'typing.Union[Nullable, uint]' = NullValue
    maxFlow: 'typing.Union[Nullable, uint]' = NullValue
    minConstPressure: 'typing.Union[None, Nullable, int]' = None
    maxConstPressure: 'typing.Union[None, Nullable, int]' = None
    minCompPressure: 'typing.Union[None, Nullable, int]' = None
    maxCompPressure: 'typing.Union[None, Nullable, int]' = None
    minConstSpeed: 'typing.Union[None, Nullable, uint]' = None
    maxConstSpeed: 'typing.Union[None, Nullable, uint]' = None
    minConstFlow: 'typing.Union[None, Nullable, uint]' = None
    maxConstFlow: 'typing.Union[None, Nullable, uint]' = None
    minConstTemp: 'typing.Union[None, Nullable, int]' = None
    maxConstTemp: 'typing.Union[None, Nullable, int]' = None
    pumpStatus: 'typing.Optional[PumpConfigurationAndControl.Bitmaps.PumpStatusBitmap]' = None
    effectiveOperationMode: 'PumpConfigurationAndControl.Enums.OperationModeEnum' = 0
    effectiveControlMode: 'PumpConfigurationAndControl.Enums.ControlModeEnum' = 0
    capacity: 'typing.Union[Nullable, int]' = NullValue
    speed: 'typing.Union[None, Nullable, uint]' = None
    lifetimeRunningHours: 'typing.Union[None, Nullable, uint]' = None
    power: 'typing.Union[None, Nullable, uint]' = None
    lifetimeEnergyConsumed: 'typing.Union[None, Nullable, uint]' = None
    operationMode: 'PumpConfigurationAndControl.Enums.OperationModeEnum' = 0
    controlMode: 'typing.Optional[PumpConfigurationAndControl.Enums.ControlModeEnum]' = None
    alarmMask: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class OperationModeEnum(MatterIntEnum):
            kNormal = 0x00
            kMinimum = 0x01
            kMaximum = 0x02
            kLocal = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ControlModeEnum(MatterIntEnum):
            kConstantSpeed = 0x00
            kConstantPressure = 0x01
            kProportionalPressure = 0x02
            kConstantFlow = 0x03
            kConstantTemperature = 0x05
            kAutomatic = 0x07
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 8

    class Bitmaps:
        class Feature(IntFlag):
            kConstantPressure = 0x1
            kCompensatedPressure = 0x2
            kConstantFlow = 0x4
            kConstantSpeed = 0x8
            kConstantTemperature = 0x10
            kAutomatic = 0x20
            kLocalOperation = 0x40

        class PumpStatusBitmap(IntFlag):
            kDeviceFault = 0x1
            kSupplyFault = 0x2
            kSpeedLow = 0x4
            kSpeedHigh = 0x8
            kLocalOverride = 0x10
            kRunning = 0x20
            kRemotePressure = 0x40
            kRemoteFlow = 0x80
            kRemoteTemperature = 0x100

    class Attributes:
        @dataclass
        class MaxPressure(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class MaxSpeed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class MaxFlow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class MinConstPressure(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MaxConstPressure(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MinCompPressure(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MaxCompPressure(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MinConstSpeed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class MaxConstSpeed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class MinConstFlow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class MaxConstFlow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class MinConstTemp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class MaxConstTemp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, int])

            value: 'typing.Union[None, Nullable, int]' = None

        @dataclass
        class PumpStatus(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[PumpConfigurationAndControl.Bitmaps.PumpStatusBitmap])

            value: 'typing.Optional[PumpConfigurationAndControl.Bitmaps.PumpStatusBitmap]' = None

        @dataclass
        class EffectiveOperationMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=PumpConfigurationAndControl.Enums.OperationModeEnum)

            value: 'PumpConfigurationAndControl.Enums.OperationModeEnum' = 0

        @dataclass
        class EffectiveControlMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=PumpConfigurationAndControl.Enums.ControlModeEnum)

            value: 'PumpConfigurationAndControl.Enums.ControlModeEnum' = 0

        @dataclass
        class Capacity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class Speed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class LifetimeRunningHours(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Power(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class LifetimeEnergyConsumed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class OperationMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000020

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=PumpConfigurationAndControl.Enums.OperationModeEnum)

            value: 'PumpConfigurationAndControl.Enums.OperationModeEnum' = 0

        @dataclass
        class ControlMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[PumpConfigurationAndControl.Enums.ControlModeEnum])

            value: 'typing.Optional[PumpConfigurationAndControl.Enums.ControlModeEnum]' = None

        @dataclass
        class AlarmMask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

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
                return 0x00000200

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
                return 0x00000200

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
                return 0x00000200

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
                return 0x00000200

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class SupplyVoltageLow(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SupplyVoltageHigh(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class PowerMissingPhase(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SystemPressureLow(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SystemPressureHigh(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class DryRunning(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class MotorTemperatureHigh(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class PumpMotorFatalFailure(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class ElectronicTemperatureHigh(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class PumpBlocked(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SensorFailure(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class ElectronicNonFatalFailure(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class ElectronicFatalFailure(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class GeneralFault(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000D

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Leakage(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000E

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class AirDetection(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000F

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class TurbineOperation(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000200

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass
