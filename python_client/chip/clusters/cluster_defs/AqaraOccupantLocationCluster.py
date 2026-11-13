"""AqaraOccupantLocationCluster cluster definition (auto-generated, DO NOT edit)."""

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
class AqaraOccupantLocationCluster(Cluster):
    id: typing.ClassVar[int] = 0x115FFC0C

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="maxDetectionTargets", Tag=0x00000000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="walkingState", Tag=0x00000001, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.WalkingStateEnum]),
                ClusterObjectFieldDescriptor(Label="sittingState", Tag=0x00000002, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.SittingStateEnum]),
                ClusterObjectFieldDescriptor(Label="standingState", Tag=0x00000003, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.StandingStateEnum]),
                ClusterObjectFieldDescriptor(Label="lyingState", Tag=0x00000004, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.LyingStateEnum]),
                ClusterObjectFieldDescriptor(Label="largeMotionState", Tag=0x00000005, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.LargeMotionStateEnum]),
                ClusterObjectFieldDescriptor(Label="fallState", Tag=0x00000006, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.FallStateEnum]),
                ClusterObjectFieldDescriptor(Label="activityState", Tag=0x00000007, Type=typing.Optional[AqaraOccupantLocationCluster.Enums.ActivityStateEnum]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    maxDetectionTargets: typing.Optional[uint] = None
    walkingState: typing.Optional[AqaraOccupantLocationCluster.Enums.WalkingStateEnum] = None
    sittingState: typing.Optional[AqaraOccupantLocationCluster.Enums.SittingStateEnum] = None
    standingState: typing.Optional[AqaraOccupantLocationCluster.Enums.StandingStateEnum] = None
    lyingState: typing.Optional[AqaraOccupantLocationCluster.Enums.LyingStateEnum] = None
    largeMotionState: typing.Optional[AqaraOccupantLocationCluster.Enums.LargeMotionStateEnum] = None
    fallState: typing.Optional[AqaraOccupantLocationCluster.Enums.FallStateEnum] = None
    activityState: typing.Optional[AqaraOccupantLocationCluster.Enums.ActivityStateEnum] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class WalkingStateEnum(MatterIntEnum):
            kNone = 0x00
            kPresent = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class SittingStateEnum(MatterIntEnum):
            kNone = 0x00
            kPresent = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class StandingStateEnum(MatterIntEnum):
            kNone = 0x00
            kPresent = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class LyingStateEnum(MatterIntEnum):
            kNone = 0x00
            kPresent = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class LargeMotionStateEnum(MatterIntEnum):
            kNone = 0x00
            kAction1 = 0x01
            kAction2 = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class FallStateEnum(MatterIntEnum):
            kCleared = 0x00
            kFall = 0x01
            kSuspectedFall = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ActivityStateEnum(MatterIntEnum):
            kUnknown = 0x00
            kActive = 0x01
            kStill = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class TargetTypeEnum(MatterIntEnum):
            kPerson = 0x00
            kNotPerson = 0x01
            kFan = 0x02
            kPet = 0x03
            kCurtain = 0x04
            kGreenPlants = 0x05
            kSweeper = 0x06
            kAirPurifier = 0x07
            kChild = 0x08
            kUnknown = 0xFE
            kInvalid = 0xFF
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 256

        class PostureEnum(MatterIntEnum):
            kWalk = 0x00
            kSit = 0x01
            kStand = 0x02
            kLie = 0x03
            kFall = 0x04
            kUndefined = 0xFE
            kInvalid = 0xFF
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 256

    class Bitmaps:
        class Feature(IntFlag):
            kLeader = 0x1
            kChild = 0x2

    class Structs:
        @dataclass
        class AqaraTargetLocationInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="targetID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="targetXCoordinate", Tag=1, Type=int),
                        ClusterObjectFieldDescriptor(Label="targetYCoordinate", Tag=2, Type=int),
                        ClusterObjectFieldDescriptor(Label="targetZCoordinate", Tag=3, Type=int),
                        ClusterObjectFieldDescriptor(Label="targetVelocity", Tag=4, Type=int),
                        ClusterObjectFieldDescriptor(Label="targetSignalToNoiseRatio", Tag=5, Type=uint),
                        ClusterObjectFieldDescriptor(Label="targetType", Tag=6, Type=AqaraOccupantLocationCluster.Enums.TargetTypeEnum),
                        ClusterObjectFieldDescriptor(Label="targetPosture", Tag=7, Type=AqaraOccupantLocationCluster.Enums.PostureEnum),
                        ClusterObjectFieldDescriptor(Label="targetZoneID", Tag=8, Type=typing.Optional[uint]),
                    ])

            targetID: uint = 0
            targetXCoordinate: int = 0
            targetYCoordinate: int = 0
            targetZCoordinate: int = 0
            targetVelocity: int = 0
            targetSignalToNoiseRatio: uint = 0
            targetType: AqaraOccupantLocationCluster.Enums.TargetTypeEnum = 0
            targetPosture: AqaraOccupantLocationCluster.Enums.PostureEnum = 0
            targetZoneID: typing.Optional[uint] = None

    class Commands:
        @dataclass
        class SubscribeLocationData(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0C
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeout", Tag=0, Type=uint),
                    ])

            timeout: uint = 0

        @dataclass
        class RemoveDetectionTarget(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0C
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="targetID", Tag=0, Type=uint),
                    ])

            targetID: uint = 0

    class Attributes:
        @dataclass
        class MaxDetectionTargets(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class WalkingState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.WalkingStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.WalkingStateEnum] = None

        @dataclass
        class SittingState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.SittingStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.SittingStateEnum] = None

        @dataclass
        class StandingState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.StandingStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.StandingStateEnum] = None

        @dataclass
        class LyingState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.LyingStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.LyingStateEnum] = None

        @dataclass
        class LargeMotionState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.LargeMotionStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.LargeMotionStateEnum] = None

        @dataclass
        class FallState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.FallStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.FallStateEnum] = None

        @dataclass
        class ActivityState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraOccupantLocationCluster.Enums.ActivityStateEnum])

            value: typing.Optional[AqaraOccupantLocationCluster.Enums.ActivityStateEnum] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

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
                return 0x115FFC0C

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
                return 0x115FFC0C

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
                return 0x115FFC0C

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
                return 0x115FFC0C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class Location(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="location", Tag=0, Type=typing.List[AqaraOccupantLocationCluster.Structs.AqaraTargetLocationInfoStruct]),
                    ])

            location: typing.List[AqaraOccupantLocationCluster.Structs.AqaraTargetLocationInfoStruct] = field(default_factory=lambda: [])
