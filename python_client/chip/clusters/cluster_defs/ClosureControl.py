"""ClosureControl cluster definition (auto-generated, DO NOT edit)."""

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
class ClosureControl(Cluster):
    id: typing.ClassVar[int] = 0x00000104

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="countdownTime", Tag=0x00000000, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="mainState", Tag=0x00000001, Type=ClosureControl.Enums.MainStateEnum),
                ClusterObjectFieldDescriptor(Label="currentErrorList", Tag=0x00000002, Type=typing.List[ClosureControl.Enums.ClosureErrorEnum]),
                ClusterObjectFieldDescriptor(Label="overallCurrentState", Tag=0x00000003, Type=typing.Union[Nullable, ClosureControl.Structs.OverallCurrentStateStruct]),
                ClusterObjectFieldDescriptor(Label="overallTargetState", Tag=0x00000004, Type=typing.Union[Nullable, ClosureControl.Structs.OverallTargetStateStruct]),
                ClusterObjectFieldDescriptor(Label="latchControlModes", Tag=0x00000005, Type=typing.Optional[ClosureControl.Bitmaps.LatchControlModesBitmap]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    countdownTime: typing.Union[None, Nullable, uint] = None
    mainState: ClosureControl.Enums.MainStateEnum = 0
    currentErrorList: typing.List[ClosureControl.Enums.ClosureErrorEnum] = field(default_factory=lambda: [])
    overallCurrentState: typing.Union[Nullable, ClosureControl.Structs.OverallCurrentStateStruct] = NullValue
    overallTargetState: typing.Union[Nullable, ClosureControl.Structs.OverallTargetStateStruct] = NullValue
    latchControlModes: typing.Optional[ClosureControl.Bitmaps.LatchControlModesBitmap] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class CurrentPositionEnum(MatterIntEnum):
            kFullyClosed = 0x00
            kFullyOpened = 0x01
            kPartiallyOpened = 0x02
            kOpenedForPedestrian = 0x03
            kOpenedForVentilation = 0x04
            kOpenedAtSignature = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class TargetPositionEnum(MatterIntEnum):
            kMoveToFullyClosed = 0x00
            kMoveToFullyOpen = 0x01
            kMoveToPedestrianPosition = 0x02
            kMoveToVentilationPosition = 0x03
            kMoveToSignaturePosition = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class MainStateEnum(MatterIntEnum):
            kStopped = 0x00
            kMoving = 0x01
            kWaitingForMotion = 0x02
            kError = 0x03
            kCalibrating = 0x04
            kProtected = 0x05
            kDisengaged = 0x06
            kSetupRequired = 0x07
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 8

        class ClosureErrorEnum(MatterIntEnum):
            kPhysicallyBlocked = 0x00
            kBlockedBySensor = 0x01
            kTemperatureLimited = 0x02
            kMaintenanceRequired = 0x03
            kInternalInterference = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

    class Bitmaps:
        class Feature(IntFlag):
            kPositioning = 0x1
            kMotionLatching = 0x2
            kInstantaneous = 0x4
            kSpeed = 0x8
            kVentilation = 0x10
            kPedestrian = 0x20
            kCalibration = 0x40
            kProtection = 0x80
            kManuallyOperable = 0x100

        class LatchControlModesBitmap(IntFlag):
            kRemoteLatching = 0x1
            kRemoteUnlatching = 0x2

    class Structs:
        @dataclass
        class OverallCurrentStateStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="position", Tag=0, Type=typing.Union[None, Nullable, ClosureControl.Enums.CurrentPositionEnum]),
                        ClusterObjectFieldDescriptor(Label="latch", Tag=1, Type=typing.Union[None, Nullable, bool]),
                        ClusterObjectFieldDescriptor(Label="speed", Tag=2, Type=typing.Optional[Globals.Enums.ThreeLevelAutoEnum]),
                        ClusterObjectFieldDescriptor(Label="secureState", Tag=3, Type=typing.Union[Nullable, bool]),
                    ])

            position: typing.Union[None, Nullable, ClosureControl.Enums.CurrentPositionEnum] = None
            latch: typing.Union[None, Nullable, bool] = None
            speed: typing.Optional[Globals.Enums.ThreeLevelAutoEnum] = None
            secureState: typing.Union[Nullable, bool] = NullValue

        @dataclass
        class OverallTargetStateStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="position", Tag=0, Type=typing.Union[None, Nullable, ClosureControl.Enums.TargetPositionEnum]),
                        ClusterObjectFieldDescriptor(Label="latch", Tag=1, Type=typing.Union[None, Nullable, bool]),
                        ClusterObjectFieldDescriptor(Label="speed", Tag=2, Type=typing.Optional[Globals.Enums.ThreeLevelAutoEnum]),
                    ])

            position: typing.Union[None, Nullable, ClosureControl.Enums.TargetPositionEnum] = None
            latch: typing.Union[None, Nullable, bool] = None
            speed: typing.Optional[Globals.Enums.ThreeLevelAutoEnum] = None

    class Commands:
        @dataclass
        class Stop(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000104
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class MoveTo(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000104
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def must_use_timed_invoke(cls) -> bool:
                return True

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="position", Tag=0, Type=typing.Optional[ClosureControl.Enums.TargetPositionEnum]),
                        ClusterObjectFieldDescriptor(Label="latch", Tag=1, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="speed", Tag=2, Type=typing.Optional[Globals.Enums.ThreeLevelAutoEnum]),
                    ])

            position: typing.Optional[ClosureControl.Enums.TargetPositionEnum] = None
            latch: typing.Optional[bool] = None
            speed: typing.Optional[Globals.Enums.ThreeLevelAutoEnum] = None

        @dataclass
        class Calibrate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000104
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def must_use_timed_invoke(cls) -> bool:
                return True

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


    class Attributes:
        @dataclass
        class CountdownTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: typing.Union[None, Nullable, uint] = None

        @dataclass
        class MainState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=ClosureControl.Enums.MainStateEnum)

            value: ClosureControl.Enums.MainStateEnum = 0

        @dataclass
        class CurrentErrorList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[ClosureControl.Enums.ClosureErrorEnum])

            value: typing.List[ClosureControl.Enums.ClosureErrorEnum] = field(default_factory=lambda: [])

        @dataclass
        class OverallCurrentState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, ClosureControl.Structs.OverallCurrentStateStruct])

            value: typing.Union[Nullable, ClosureControl.Structs.OverallCurrentStateStruct] = NullValue

        @dataclass
        class OverallTargetState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, ClosureControl.Structs.OverallTargetStateStruct])

            value: typing.Union[Nullable, ClosureControl.Structs.OverallTargetStateStruct] = NullValue

        @dataclass
        class LatchControlModes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[ClosureControl.Bitmaps.LatchControlModesBitmap])

            value: typing.Optional[ClosureControl.Bitmaps.LatchControlModesBitmap] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

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
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class EventList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFA

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

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
                return 0x00000104

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
                return 0x00000104

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class OperationalError(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorState", Tag=0, Type=typing.List[ClosureControl.Enums.ClosureErrorEnum]),
                    ])

            errorState: typing.List[ClosureControl.Enums.ClosureErrorEnum] = field(default_factory=lambda: [])

        @dataclass
        class MovementCompleted(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class EngageStateChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="engageValue", Tag=0, Type=bool),
                    ])

            engageValue: bool = False

        @dataclass
        class SecureStateChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000104

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="secureValue", Tag=0, Type=bool),
                    ])

            secureValue: bool = False
