"""DeviceEnergyManagement cluster definition (auto-generated, DO NOT edit)."""

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
class DeviceEnergyManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000098

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="esaType", Tag=0x00000000, Type=DeviceEnergyManagement.Enums.ESATypeEnum),
                ClusterObjectFieldDescriptor(Label="esaCanGenerate", Tag=0x00000001, Type=bool),
                ClusterObjectFieldDescriptor(Label="esaState", Tag=0x00000002, Type=DeviceEnergyManagement.Enums.ESAStateEnum),
                ClusterObjectFieldDescriptor(Label="absMinPower", Tag=0x00000003, Type=uint),
                ClusterObjectFieldDescriptor(Label="absMaxPower", Tag=0x00000004, Type=uint),
                ClusterObjectFieldDescriptor(Label="powerAdjustmentCapability", Tag=0x00000005, Type=typing.Union[None, Nullable, DeviceEnergyManagement.Structs.PowerAdjustCapabilityStruct]),
                ClusterObjectFieldDescriptor(Label="forecast", Tag=0x00000006, Type=typing.Union[None, Nullable, DeviceEnergyManagement.Structs.ForecastStruct]),
                ClusterObjectFieldDescriptor(Label="optOutState", Tag=0x00000007, Type=typing.Optional[DeviceEnergyManagement.Enums.OptOutStateEnum]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    esaType: 'DeviceEnergyManagement.Enums.ESATypeEnum' = 0
    esaCanGenerate: 'bool' = False
    esaState: 'DeviceEnergyManagement.Enums.ESAStateEnum' = 0
    absMinPower: 'uint' = 0
    absMaxPower: 'uint' = 0
    powerAdjustmentCapability: 'typing.Union[None, Nullable, DeviceEnergyManagement.Structs.PowerAdjustCapabilityStruct]' = None
    forecast: 'typing.Union[None, Nullable, DeviceEnergyManagement.Structs.ForecastStruct]' = None
    optOutState: 'typing.Optional[DeviceEnergyManagement.Enums.OptOutStateEnum]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class CostTypeEnum(MatterIntEnum):
            kFinancial = 0x00
            kGhgEmissions = 0x01
            kComfort = 0x02
            kTemperature = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ESATypeEnum(MatterIntEnum):
            kEvse = 0x00
            kSpaceHeating = 0x01
            kWaterHeating = 0x02
            kSpaceCooling = 0x03
            kSpaceHeatingCooling = 0x04
            kBatteryStorage = 0x05
            kSolarPv = 0x06
            kFridgeFreezer = 0x07
            kWashingMachine = 0x08
            kDishwasher = 0x09
            kCooking = 0x0A
            kHomeWaterPump = 0x0B
            kIrrigationWaterPump = 0x0C
            kPoolPump = 0x0D
            kOther = 0xFF
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 256

        class ESAStateEnum(MatterIntEnum):
            kOffline = 0x00
            kOnline = 0x01
            kFault = 0x02
            kPowerAdjustActive = 0x03
            kPaused = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class OptOutStateEnum(MatterIntEnum):
            kNoOptOut = 0x00
            kLocalOptOut = 0x01
            kGridOptOut = 0x02
            kOptOut = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class CauseEnum(MatterIntEnum):
            kNormalCompletion = 0x00
            kOffline = 0x01
            kFault = 0x02
            kUserOptOut = 0x03
            kCancelled = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class AdjustmentCauseEnum(MatterIntEnum):
            kLocalOptimization = 0x00
            kGridOptimization = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class ForecastUpdateReasonEnum(MatterIntEnum):
            kInternalOptimization = 0x00
            kLocalOptimization = 0x01
            kGridOptimization = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class PowerAdjustReasonEnum(MatterIntEnum):
            kNoAdjustment = 0x00
            kLocalOptimizationAdjustment = 0x01
            kGridOptimizationAdjustment = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class Feature(IntFlag):
            kPowerAdjustment = 0x1
            kPowerForecastReporting = 0x2
            kStateForecastReporting = 0x4
            kStartTimeAdjustment = 0x8
            kPausable = 0x10
            kForecastAdjustment = 0x20
            kConstraintBasedAdjustment = 0x40

    class Structs:
        @dataclass
        class CostStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="costType", Tag=0, Type=DeviceEnergyManagement.Enums.CostTypeEnum),
                        ClusterObjectFieldDescriptor(Label="value", Tag=1, Type=int),
                        ClusterObjectFieldDescriptor(Label="decimalPoints", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="currency", Tag=3, Type=typing.Optional[uint]),
                    ])

            costType: 'DeviceEnergyManagement.Enums.CostTypeEnum' = 0
            value: 'int' = 0
            decimalPoints: 'uint' = 0
            currency: 'typing.Optional[uint]' = None

        @dataclass
        class PowerAdjustStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="minPower", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maxPower", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="minDuration", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maxDuration", Tag=3, Type=uint),
                    ])

            minPower: 'uint' = 0
            maxPower: 'uint' = 0
            minDuration: 'uint' = 0
            maxDuration: 'uint' = 0

        @dataclass
        class PowerAdjustCapabilityStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="powerAdjustCapability", Tag=0, Type=typing.Union[Nullable, typing.List[typing.Optional[DeviceEnergyManagement.Structs.PowerAdjustStruct]]]),
                        ClusterObjectFieldDescriptor(Label="cause", Tag=1, Type=DeviceEnergyManagement.Enums.PowerAdjustReasonEnum),
                    ])

            powerAdjustCapability: 'typing.Union[Nullable, typing.List[typing.Optional[DeviceEnergyManagement.Structs.PowerAdjustStruct]]]' = NullValue
            cause: 'DeviceEnergyManagement.Enums.PowerAdjustReasonEnum' = 0

        @dataclass
        class ForecastStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="forecastId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="activeSlotNumber", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endTime", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="earliestStartTime", Tag=4, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="latestEndTime", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="isPausable", Tag=6, Type=bool),
                        ClusterObjectFieldDescriptor(Label="slots", Tag=7, Type=typing.List[typing.Optional[DeviceEnergyManagement.Structs.SlotStruct]]),
                        ClusterObjectFieldDescriptor(Label="forecastUpdateReason", Tag=8, Type=DeviceEnergyManagement.Enums.ForecastUpdateReasonEnum),
                    ])

            forecastId: 'uint' = 0
            activeSlotNumber: 'typing.Union[Nullable, uint]' = NullValue
            startTime: 'uint' = 0
            endTime: 'uint' = 0
            earliestStartTime: 'typing.Union[None, Nullable, uint]' = None
            latestEndTime: 'typing.Optional[uint]' = None
            isPausable: 'bool' = False
            slots: 'typing.List[typing.Optional[DeviceEnergyManagement.Structs.SlotStruct]]' = field(default_factory=lambda: [])
            forecastUpdateReason: 'DeviceEnergyManagement.Enums.ForecastUpdateReasonEnum' = 0

        @dataclass
        class SlotStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="minDuration", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maxDuration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="defaultDuration", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="elapsedSlotTime", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="remainingSlotTime", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="slotIsPausable", Tag=5, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="minPauseDuration", Tag=6, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maxPauseDuration", Tag=7, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="manufacturerEsaState", Tag=8, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="nominalPower", Tag=9, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="minPower", Tag=10, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maxPower", Tag=11, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="nominalEnergy", Tag=12, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="costs", Tag=13, Type=typing.Optional[typing.List[typing.Optional[DeviceEnergyManagement.Structs.CostStruct]]]),
                        ClusterObjectFieldDescriptor(Label="minPowerAdjustment", Tag=14, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maxPowerAdjustment", Tag=15, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="minDurationAdjustment", Tag=16, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maxDurationAdjustment", Tag=17, Type=typing.Optional[uint]),
                    ])

            minDuration: 'uint' = 0
            maxDuration: 'uint' = 0
            defaultDuration: 'uint' = 0
            elapsedSlotTime: 'uint' = 0
            remainingSlotTime: 'uint' = 0
            slotIsPausable: 'typing.Optional[bool]' = None
            minPauseDuration: 'typing.Optional[uint]' = None
            maxPauseDuration: 'typing.Optional[uint]' = None
            manufacturerEsaState: 'typing.Optional[uint]' = None
            nominalPower: 'typing.Optional[uint]' = None
            minPower: 'typing.Optional[uint]' = None
            maxPower: 'typing.Optional[uint]' = None
            nominalEnergy: 'typing.Optional[uint]' = None
            costs: 'typing.Optional[typing.List[typing.Optional[DeviceEnergyManagement.Structs.CostStruct]]]' = None
            minPowerAdjustment: 'typing.Optional[uint]' = None
            maxPowerAdjustment: 'typing.Optional[uint]' = None
            minDurationAdjustment: 'typing.Optional[uint]' = None
            maxDurationAdjustment: 'typing.Optional[uint]' = None

        @dataclass
        class SlotAdjustmentStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="slotIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nominalPower", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=2, Type=uint),
                    ])

            slotIndex: 'uint' = 0
            nominalPower: 'typing.Optional[uint]' = None
            duration: 'uint' = 0

        @dataclass
        class ConstraintsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nominalPower", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="maximumEnergy", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="loadControl", Tag=4, Type=typing.Optional[int]),
                    ])

            startTime: 'uint' = 0
            duration: 'uint' = 0
            nominalPower: 'typing.Optional[uint]' = None
            maximumEnergy: 'typing.Optional[uint]' = None
            loadControl: 'typing.Optional[int]' = None

    class Commands:
        @dataclass
        class PowerAdjustRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="power", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="cause", Tag=2, Type=DeviceEnergyManagement.Enums.AdjustmentCauseEnum),
                    ])

            power: 'uint' = 0
            duration: 'uint' = 0
            cause: 'DeviceEnergyManagement.Enums.AdjustmentCauseEnum' = 0

        @dataclass
        class CancelPowerAdjustRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class StartTimeAdjustRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="requestedStartTime", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="cause", Tag=1, Type=DeviceEnergyManagement.Enums.AdjustmentCauseEnum),
                    ])

            requestedStartTime: 'uint' = 0
            cause: 'DeviceEnergyManagement.Enums.AdjustmentCauseEnum' = 0

        @dataclass
        class PauseRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="duration", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="cause", Tag=1, Type=DeviceEnergyManagement.Enums.AdjustmentCauseEnum),
                    ])

            duration: 'uint' = 0
            cause: 'DeviceEnergyManagement.Enums.AdjustmentCauseEnum' = 0

        @dataclass
        class ResumeRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class ModifyForecastRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="forecastId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="slotAdjustments", Tag=1, Type=typing.List[typing.Optional[DeviceEnergyManagement.Structs.SlotAdjustmentStruct]]),
                        ClusterObjectFieldDescriptor(Label="cause", Tag=2, Type=DeviceEnergyManagement.Enums.AdjustmentCauseEnum),
                    ])

            forecastId: 'uint' = 0
            slotAdjustments: 'typing.List[typing.Optional[DeviceEnergyManagement.Structs.SlotAdjustmentStruct]]' = field(default_factory=lambda: [])
            cause: 'DeviceEnergyManagement.Enums.AdjustmentCauseEnum' = 0

        @dataclass
        class RequestConstraintBasedForecast(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="constraints", Tag=0, Type=typing.List[typing.Optional[DeviceEnergyManagement.Structs.ConstraintsStruct]]),
                        ClusterObjectFieldDescriptor(Label="cause", Tag=1, Type=DeviceEnergyManagement.Enums.AdjustmentCauseEnum),
                    ])

            constraints: 'typing.List[typing.Optional[DeviceEnergyManagement.Structs.ConstraintsStruct]]' = field(default_factory=lambda: [])
            cause: 'DeviceEnergyManagement.Enums.AdjustmentCauseEnum' = 0

        @dataclass
        class CancelRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000098
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

    class Attributes:
        @dataclass
        class EsaType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DeviceEnergyManagement.Enums.ESATypeEnum)

            value: 'DeviceEnergyManagement.Enums.ESATypeEnum' = 0

        @dataclass
        class EsaCanGenerate(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class EsaState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DeviceEnergyManagement.Enums.ESAStateEnum)

            value: 'DeviceEnergyManagement.Enums.ESAStateEnum' = 0

        @dataclass
        class AbsMinPower(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class AbsMaxPower(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class PowerAdjustmentCapability(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, DeviceEnergyManagement.Structs.PowerAdjustCapabilityStruct])

            value: 'typing.Union[None, Nullable, DeviceEnergyManagement.Structs.PowerAdjustCapabilityStruct]' = None

        @dataclass
        class Forecast(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, DeviceEnergyManagement.Structs.ForecastStruct])

            value: 'typing.Union[None, Nullable, DeviceEnergyManagement.Structs.ForecastStruct]' = None

        @dataclass
        class OptOutState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DeviceEnergyManagement.Enums.OptOutStateEnum])

            value: 'typing.Optional[DeviceEnergyManagement.Enums.OptOutStateEnum]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

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
                return 0x00000098

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
                return 0x00000098

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
                return 0x00000098

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
                return 0x00000098

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class PowerAdjustStart(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

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
        class PowerAdjustEnd(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="cause", Tag=0, Type=DeviceEnergyManagement.Enums.CauseEnum),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="energyUse", Tag=2, Type=uint),
                    ])

            cause: 'DeviceEnergyManagement.Enums.CauseEnum' = 0
            duration: 'uint' = 0
            energyUse: 'uint' = 0

        @dataclass
        class Paused(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

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
        class Resumed(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000098

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="cause", Tag=0, Type=DeviceEnergyManagement.Enums.CauseEnum),
                    ])

            cause: 'DeviceEnergyManagement.Enums.CauseEnum' = 0
