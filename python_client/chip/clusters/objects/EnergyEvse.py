"""EnergyEvse cluster definition (auto-generated, DO NOT edit)."""

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
class EnergyEvse(Cluster):
    id: typing.ClassVar[int] = 0x00000099

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="state", Tag=0x00000000, Type=typing.Union[Nullable, EnergyEvse.Enums.StateEnum]),
                ClusterObjectFieldDescriptor(Label="supplyState", Tag=0x00000001, Type=EnergyEvse.Enums.SupplyStateEnum),
                ClusterObjectFieldDescriptor(Label="faultState", Tag=0x00000002, Type=EnergyEvse.Enums.FaultStateEnum),
                ClusterObjectFieldDescriptor(Label="chargingEnabledUntil", Tag=0x00000003, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="dischargingEnabledUntil", Tag=0x00000004, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="circuitCapacity", Tag=0x00000005, Type=uint),
                ClusterObjectFieldDescriptor(Label="minimumChargeCurrent", Tag=0x00000006, Type=uint),
                ClusterObjectFieldDescriptor(Label="maximumChargeCurrent", Tag=0x00000007, Type=uint),
                ClusterObjectFieldDescriptor(Label="maximumDischargeCurrent", Tag=0x00000008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="userMaximumChargeCurrent", Tag=0x00000009, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="randomizationDelayWindow", Tag=0x0000000A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="nextChargeStartTime", Tag=0x00000023, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="nextChargeTargetTime", Tag=0x00000024, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="nextChargeRequiredEnergy", Tag=0x00000025, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="nextChargeTargetSoC", Tag=0x00000026, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="approximateEVEfficiency", Tag=0x00000027, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="stateOfCharge", Tag=0x00000030, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="batteryCapacity", Tag=0x00000031, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="vehicleID", Tag=0x00000032, Type=typing.Union[None, Nullable, str]),
                ClusterObjectFieldDescriptor(Label="sessionID", Tag=0x00000040, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="sessionDuration", Tag=0x00000041, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="sessionEnergyCharged", Tag=0x00000042, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="sessionEnergyDischarged", Tag=0x00000043, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    state: 'typing.Union[Nullable, EnergyEvse.Enums.StateEnum]' = NullValue
    supplyState: 'EnergyEvse.Enums.SupplyStateEnum' = 0
    faultState: 'EnergyEvse.Enums.FaultStateEnum' = 0
    chargingEnabledUntil: 'typing.Union[Nullable, uint]' = NullValue
    dischargingEnabledUntil: 'typing.Union[None, Nullable, uint]' = None
    circuitCapacity: 'uint' = 0
    minimumChargeCurrent: 'uint' = 0
    maximumChargeCurrent: 'uint' = 0
    maximumDischargeCurrent: 'typing.Optional[uint]' = None
    userMaximumChargeCurrent: 'typing.Optional[uint]' = None
    randomizationDelayWindow: 'typing.Optional[uint]' = None
    nextChargeStartTime: 'typing.Union[None, Nullable, uint]' = None
    nextChargeTargetTime: 'typing.Union[None, Nullable, uint]' = None
    nextChargeRequiredEnergy: 'typing.Union[None, Nullable, uint]' = None
    nextChargeTargetSoC: 'typing.Union[None, Nullable, uint]' = None
    approximateEVEfficiency: 'typing.Union[None, Nullable, uint]' = None
    stateOfCharge: 'typing.Union[None, Nullable, uint]' = None
    batteryCapacity: 'typing.Union[None, Nullable, uint]' = None
    vehicleID: 'typing.Union[None, Nullable, str]' = None
    sessionID: 'typing.Union[Nullable, uint]' = NullValue
    sessionDuration: 'typing.Union[Nullable, uint]' = NullValue
    sessionEnergyCharged: 'typing.Union[Nullable, uint]' = NullValue
    sessionEnergyDischarged: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StateEnum(MatterIntEnum):
            kNotPluggedIn = 0x00
            kPluggedInNoDemand = 0x01
            kPluggedInDemand = 0x02
            kPluggedInCharging = 0x03
            kPluggedInDischarging = 0x04
            kSessionEnding = 0x05
            kFault = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

        class SupplyStateEnum(MatterIntEnum):
            kDisabled = 0x00
            kChargingEnabled = 0x01
            kDischargingEnabled = 0x02
            kDisabledError = 0x03
            kDisabledDiagnostics = 0x04
            kEnabled = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class FaultStateEnum(MatterIntEnum):
            kNoError = 0x00
            kMeterFailure = 0x01
            kOverVoltage = 0x02
            kUnderVoltage = 0x03
            kOverCurrent = 0x04
            kContactWetFailure = 0x05
            kContactDryFailure = 0x06
            kGroundFault = 0x07
            kPowerLoss = 0x08
            kPowerQuality = 0x09
            kPilotShortCircuit = 0x0A
            kEmergencyStop = 0x0B
            kEvDisconnected = 0x0C
            kWrongPowerSupply = 0x0D
            kLiveNeutralSwap = 0x0E
            kOverTemperature = 0x0F
            kOther = 0xFF
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 256

        class EnergyTransferStoppedReasonEnum(MatterIntEnum):
            kEvStopped = 0x00
            kEvseStopped = 0x01
            kOther = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class Feature(IntFlag):
            kChargingPreferences = 0x1
            kSoCReporting = 0x2
            kPlugAndCharge = 0x4
            kRfid = 0x8
            kV2X = 0x10

        class TargetDayOfWeekBitmap(IntFlag):
            kSunday = 0x1
            kMonday = 0x2
            kTuesday = 0x4
            kWednesday = 0x8
            kThursday = 0x10
            kFriday = 0x20
            kSaturday = 0x40

    class Structs:
        @dataclass
        class ChargingTargetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="targetTimeMinutesPastMidnight", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="targetSoC", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="addedEnergy", Tag=2, Type=typing.Optional[uint]),
                    ])

            targetTimeMinutesPastMidnight: 'uint' = 0
            targetSoC: 'typing.Optional[uint]' = None
            addedEnergy: 'typing.Optional[uint]' = None

        @dataclass
        class ChargingTargetScheduleStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="dayOfWeekForSequence", Tag=0, Type=EnergyEvse.Bitmaps.TargetDayOfWeekBitmap),
                        ClusterObjectFieldDescriptor(Label="chargingTargets", Tag=1, Type=typing.List[typing.Optional[EnergyEvse.Structs.ChargingTargetStruct]]),
                    ])

            dayOfWeekForSequence: 'EnergyEvse.Bitmaps.TargetDayOfWeekBitmap' = 0
            chargingTargets: 'typing.List[typing.Optional[EnergyEvse.Structs.ChargingTargetStruct]]' = field(default_factory=lambda: [])

    class Commands:
        @dataclass
        class Disable(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
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
        class EnableCharging(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="chargingEnabledUntil", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="minimumChargeCurrent", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maximumChargeCurrent", Tag=2, Type=uint),
                    ])

            chargingEnabledUntil: 'typing.Union[Nullable, uint]' = NullValue
            minimumChargeCurrent: 'uint' = 0
            maximumChargeCurrent: 'uint' = 0

        @dataclass
        class EnableDischarging(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="dischargingEnabledUntil", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="maximumDischargeCurrent", Tag=1, Type=uint),
                    ])

            dischargingEnabledUntil: 'typing.Union[Nullable, uint]' = NullValue
            maximumDischargeCurrent: 'uint' = 0

        @dataclass
        class StartDiagnostics(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
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
        class SetTargets(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="chargingTargetSchedules", Tag=0, Type=typing.List[typing.Optional[EnergyEvse.Structs.ChargingTargetScheduleStruct]]),
                    ])

            chargingTargetSchedules: 'typing.List[typing.Optional[EnergyEvse.Structs.ChargingTargetScheduleStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class GetTargets(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetTargetsResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class ClearTargets(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class GetTargetsResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000099
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="chargingTargetSchedules", Tag=0, Type=typing.List[typing.Optional[EnergyEvse.Structs.ChargingTargetScheduleStruct]]),
                    ])

            chargingTargetSchedules: 'typing.List[typing.Optional[EnergyEvse.Structs.ChargingTargetScheduleStruct]]' = field(default_factory=lambda: [])

    class Attributes:
        @dataclass
        class State(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, EnergyEvse.Enums.StateEnum])

            value: 'typing.Union[Nullable, EnergyEvse.Enums.StateEnum]' = NullValue

        @dataclass
        class SupplyState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=EnergyEvse.Enums.SupplyStateEnum)

            value: 'EnergyEvse.Enums.SupplyStateEnum' = 0

        @dataclass
        class FaultState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=EnergyEvse.Enums.FaultStateEnum)

            value: 'EnergyEvse.Enums.FaultStateEnum' = 0

        @dataclass
        class ChargingEnabledUntil(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class DischargingEnabledUntil(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class CircuitCapacity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class MinimumChargeCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class MaximumChargeCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class MaximumDischargeCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UserMaximumChargeCurrent(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RandomizationDelayWindow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NextChargeStartTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000023

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class NextChargeTargetTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class NextChargeRequiredEnergy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class NextChargeTargetSoC(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000026

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ApproximateEvEfficiency(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000027

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class StateOfCharge(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class BatteryCapacity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class VehicleId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, str])

            value: 'typing.Union[None, Nullable, str]' = None

        @dataclass
        class SessionId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000040

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class SessionDuration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000041

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class SessionEnergyCharged(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000042

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class SessionEnergyDischarged(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000043

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

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
                return 0x00000099

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
                return 0x00000099

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
                return 0x00000099

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
                return 0x00000099

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class EVConnected(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sessionID", Tag=0, Type=uint),
                    ])

            sessionID: 'uint' = 0

        @dataclass
        class EVNotDetected(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="state", Tag=1, Type=EnergyEvse.Enums.StateEnum),
                        ClusterObjectFieldDescriptor(Label="sessionDuration", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sessionEnergyCharged", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sessionEnergyDischarged", Tag=4, Type=typing.Optional[uint]),
                    ])

            sessionID: 'uint' = 0
            state: 'EnergyEvse.Enums.StateEnum' = 0
            sessionDuration: 'uint' = 0
            sessionEnergyCharged: 'uint' = 0
            sessionEnergyDischarged: 'typing.Optional[uint]' = None

        @dataclass
        class EnergyTransferStarted(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="state", Tag=1, Type=EnergyEvse.Enums.StateEnum),
                        ClusterObjectFieldDescriptor(Label="maximumCurrent", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maximumDischargeCurrent", Tag=3, Type=typing.Optional[uint]),
                    ])

            sessionID: 'uint' = 0
            state: 'EnergyEvse.Enums.StateEnum' = 0
            maximumCurrent: 'uint' = 0
            maximumDischargeCurrent: 'typing.Optional[uint]' = None

        @dataclass
        class EnergyTransferStopped(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="state", Tag=1, Type=EnergyEvse.Enums.StateEnum),
                        ClusterObjectFieldDescriptor(Label="reason", Tag=2, Type=EnergyEvse.Enums.EnergyTransferStoppedReasonEnum),
                        ClusterObjectFieldDescriptor(Label="energyTransferred", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="energyDischarged", Tag=5, Type=typing.Optional[uint]),
                    ])

            sessionID: 'uint' = 0
            state: 'EnergyEvse.Enums.StateEnum' = 0
            reason: 'EnergyEvse.Enums.EnergyTransferStoppedReasonEnum' = 0
            energyTransferred: 'uint' = 0
            energyDischarged: 'typing.Optional[uint]' = None

        @dataclass
        class Fault(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sessionID", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="state", Tag=1, Type=EnergyEvse.Enums.StateEnum),
                        ClusterObjectFieldDescriptor(Label="faultStatePreviousState", Tag=2, Type=EnergyEvse.Enums.FaultStateEnum),
                        ClusterObjectFieldDescriptor(Label="faultStateCurrentState", Tag=4, Type=EnergyEvse.Enums.FaultStateEnum),
                    ])

            sessionID: 'typing.Union[Nullable, uint]' = NullValue
            state: 'EnergyEvse.Enums.StateEnum' = 0
            faultStatePreviousState: 'EnergyEvse.Enums.FaultStateEnum' = 0
            faultStateCurrentState: 'EnergyEvse.Enums.FaultStateEnum' = 0

        @dataclass
        class RFID(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000099

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="uid", Tag=0, Type=bytes),
                    ])

            uid: 'bytes' = b""
