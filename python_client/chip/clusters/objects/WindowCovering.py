"""WindowCovering cluster definition (auto-generated, DO NOT edit)."""

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
class WindowCovering(Cluster):
    id: typing.ClassVar[int] = 0x00000102

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="type", Tag=0x00000000, Type=WindowCovering.Enums.TypeEnum),
                ClusterObjectFieldDescriptor(Label="physicalClosedLimitLift", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="physicalClosedLimitTilt", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="currentPositionLift", Tag=0x00000003, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="currentPositionTilt", Tag=0x00000004, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="numberOfActuationsLift", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfActuationsTilt", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="configStatus", Tag=0x00000007, Type=WindowCovering.Bitmaps.ConfigStatusBitmap),
                ClusterObjectFieldDescriptor(Label="currentPositionLiftPercentage", Tag=0x00000008, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="currentPositionTiltPercentage", Tag=0x00000009, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="operationalStatus", Tag=0x0000000A, Type=WindowCovering.Bitmaps.OperationalStatusBitmap),
                ClusterObjectFieldDescriptor(Label="targetPositionLiftPercent100ths", Tag=0x0000000B, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="targetPositionTiltPercent100ths", Tag=0x0000000C, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="endProductType", Tag=0x0000000D, Type=WindowCovering.Enums.EndProductTypeEnum),
                ClusterObjectFieldDescriptor(Label="currentPositionLiftPercent100ths", Tag=0x0000000E, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="currentPositionTiltPercent100ths", Tag=0x0000000F, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="installedOpenLimitLift", Tag=0x00000010, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installedClosedLimitLift", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installedOpenLimitTilt", Tag=0x00000012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installedClosedLimitTilt", Tag=0x00000013, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="velocityLift", Tag=0x00000014, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="accelerationTimeLift", Tag=0x00000015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="decelerationTimeLift", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="mode", Tag=0x00000017, Type=WindowCovering.Bitmaps.ModeBitmap),
                ClusterObjectFieldDescriptor(Label="intermediateSetpointsLift", Tag=0x00000018, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="intermediateSetpointsTilt", Tag=0x00000019, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="safetyStatus", Tag=0x0000001A, Type=typing.Optional[WindowCovering.Bitmaps.SafetyStatusBitmap]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    type: 'WindowCovering.Enums.TypeEnum' = 0
    physicalClosedLimitLift: 'typing.Optional[uint]' = None
    physicalClosedLimitTilt: 'typing.Optional[uint]' = None
    currentPositionLift: 'typing.Union[None, Nullable, uint]' = None
    currentPositionTilt: 'typing.Union[None, Nullable, uint]' = None
    numberOfActuationsLift: 'typing.Optional[uint]' = None
    numberOfActuationsTilt: 'typing.Optional[uint]' = None
    configStatus: 'WindowCovering.Bitmaps.ConfigStatusBitmap' = 0
    currentPositionLiftPercentage: 'typing.Union[None, Nullable, uint]' = None
    currentPositionTiltPercentage: 'typing.Union[None, Nullable, uint]' = None
    operationalStatus: 'WindowCovering.Bitmaps.OperationalStatusBitmap' = 0
    targetPositionLiftPercent100ths: 'typing.Union[None, Nullable, uint]' = None
    targetPositionTiltPercent100ths: 'typing.Union[None, Nullable, uint]' = None
    endProductType: 'WindowCovering.Enums.EndProductTypeEnum' = 0
    currentPositionLiftPercent100ths: 'typing.Union[None, Nullable, uint]' = None
    currentPositionTiltPercent100ths: 'typing.Union[None, Nullable, uint]' = None
    installedOpenLimitLift: 'typing.Optional[uint]' = None
    installedClosedLimitLift: 'typing.Optional[uint]' = None
    installedOpenLimitTilt: 'typing.Optional[uint]' = None
    installedClosedLimitTilt: 'typing.Optional[uint]' = None
    velocityLift: 'typing.Optional[uint]' = None
    accelerationTimeLift: 'typing.Optional[uint]' = None
    decelerationTimeLift: 'typing.Optional[uint]' = None
    mode: 'WindowCovering.Bitmaps.ModeBitmap' = 0
    intermediateSetpointsLift: 'typing.Optional[uint]' = None
    intermediateSetpointsTilt: 'typing.Optional[uint]' = None
    safetyStatus: 'typing.Optional[WindowCovering.Bitmaps.SafetyStatusBitmap]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class TypeEnum(MatterIntEnum):
            kRollershade = 0x00
            kRollershade2Motor = 0x01
            kRollershadeExterior = 0x02
            kRollershadeExterior2Motor = 0x03
            kDrapery = 0x04
            kAwning = 0x05
            kShutter = 0x06
            kTiltBlindTiltOnly = 0x07
            kTiltBlindLift = 0x08
            kProjectorScreen = 0x09
            kUnknown = 0xFF
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 256

        class EndProductTypeEnum(MatterIntEnum):
            kRollerShade = 0x00
            kRomanShade = 0x01
            kBalloonShade = 0x02
            kWovenWood = 0x03
            kPleatedShade = 0x04
            kCellularShade = 0x05
            kLayeredShade = 0x06
            kLayeredShade2D = 0x07
            kSheerShade = 0x08
            kTiltOnlyInteriorBlind = 0x09
            kInteriorBlind = 0x0A
            kVerticalBlindStripCurtain = 0x0B
            kInteriorVenetianBlind = 0x0C
            kExteriorVenetianBlind = 0x0D
            kLateralLeftCurtain = 0x0E
            kLateralRightCurtain = 0x0F
            kCentralCurtain = 0x10
            kRollerShutter = 0x11
            kExteriorVerticalScreen = 0x12
            kAwningTerracePatio = 0x13
            kAwningVerticalScreen = 0x14
            kTiltOnlyPergola = 0x15
            kSwingingShutter = 0x16
            kSlidingShutter = 0x17
            kUnknown = 0xFF
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 256

        class MovementStatus(MatterIntEnum):
            kStopped = 0x00
            kOpening = 0x01
            kClosing = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class Feature(IntFlag):
            kLift = 0x1
            kTilt = 0x2
            kPositionAwareLift = 0x4
            kAbsolutePosition = 0x8
            kPositionAwareTilt = 0x10

        class ConfigStatusBitmap(IntFlag):
            kOperational = 0x1
            kOnlineReserved = 0x2
            kLiftMovementReversed = 0x4
            kLiftPositionAware = 0x8
            kTiltPositionAware = 0x10
            kLiftEncoderControlled = 0x20
            kTiltEncoderControlled = 0x40

        class ModeBitmap(IntFlag):
            kMotorDirectionReversed = 0x1
            kCalibrationMode = 0x2
            kMaintenanceMode = 0x4
            kLedFeedback = 0x8

        class OperationalStatusBitmap(IntFlag):
            kGlobal = 0x1
            kLift = 0x1
            kTilt = 0x1

        class SafetyStatusBitmap(IntFlag):
            kRemoteLockout = 0x1
            kTamperDetection = 0x2
            kFailedCommunication = 0x4
            kPositionFailure = 0x8
            kThermalProtection = 0x10
            kObstacleDetected = 0x20
            kPower = 0x40
            kStopInput = 0x80
            kMotorJammed = 0x100
            kHardwareFailure = 0x200
            kManualOperation = 0x400
            kProtection = 0x800

    class Commands:
        @dataclass
        class UpOrOpen(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class DownOrClose(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
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
        class StopMotion(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class GoToLiftValue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="liftValue", Tag=0, Type=uint),
                    ])

            liftValue: 'uint' = 0

        @dataclass
        class GoToLiftPercentage(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="liftPercent100thsValue", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="ignored", Tag=1, Type=typing.Optional[uint]),
                    ])

            liftPercent100thsValue: 'uint' = 0
            ignored: 'typing.Optional[uint]' = None

        @dataclass
        class GoToTiltValue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="tiltValue", Tag=0, Type=uint),
                    ])

            tiltValue: 'uint' = 0

        @dataclass
        class GoToTiltPercentage(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000102
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="tiltPercent100thsValue", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="ignored", Tag=1, Type=typing.Optional[uint]),
                    ])

            tiltPercent100thsValue: 'uint' = 0
            ignored: 'typing.Optional[uint]' = None

    class Attributes:
        @dataclass
        class Type(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WindowCovering.Enums.TypeEnum)

            value: 'WindowCovering.Enums.TypeEnum' = 0

        @dataclass
        class PhysicalClosedLimitLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PhysicalClosedLimitTilt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class CurrentPositionLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class CurrentPositionTilt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class NumberOfActuationsLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfActuationsTilt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ConfigStatus(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WindowCovering.Bitmaps.ConfigStatusBitmap)

            value: 'WindowCovering.Bitmaps.ConfigStatusBitmap' = 0

        @dataclass
        class CurrentPositionLiftPercentage(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class CurrentPositionTiltPercentage(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class OperationalStatus(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WindowCovering.Bitmaps.OperationalStatusBitmap)

            value: 'WindowCovering.Bitmaps.OperationalStatusBitmap' = 0

        @dataclass
        class TargetPositionLiftPercent100ths(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class TargetPositionTiltPercent100ths(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class EndProductType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WindowCovering.Enums.EndProductTypeEnum)

            value: 'WindowCovering.Enums.EndProductTypeEnum' = 0

        @dataclass
        class CurrentPositionLiftPercent100ths(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class CurrentPositionTiltPercent100ths(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class InstalledOpenLimitLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class InstalledClosedLimitLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class InstalledOpenLimitTilt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class InstalledClosedLimitTilt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class VelocityLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AccelerationTimeLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class DecelerationTimeLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Mode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=WindowCovering.Bitmaps.ModeBitmap)

            value: 'WindowCovering.Bitmaps.ModeBitmap' = 0

        @dataclass
        class IntermediateSetpointsLift(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000018

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class IntermediateSetpointsTilt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000019

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SafetyStatus(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[WindowCovering.Bitmaps.SafetyStatusBitmap])

            value: 'typing.Optional[WindowCovering.Bitmaps.SafetyStatusBitmap]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000102

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
                return 0x00000102

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
                return 0x00000102

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
                return 0x00000102

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
                return 0x00000102

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
