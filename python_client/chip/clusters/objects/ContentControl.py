"""ContentControl cluster definition (auto-generated, DO NOT edit)."""

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
class ContentControl(Cluster):
    id: typing.ClassVar[int] = 0x0000050F

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="enabled", Tag=0x00000000, Type=bool),
                ClusterObjectFieldDescriptor(Label="onDemandRatings", Tag=0x00000001, Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]]),
                ClusterObjectFieldDescriptor(Label="onDemandRatingThreshold", Tag=0x00000002, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="scheduledContentRatings", Tag=0x00000003, Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]]),
                ClusterObjectFieldDescriptor(Label="scheduledContentRatingThreshold", Tag=0x00000004, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="screenDailyTime", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="remainingScreenTime", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="blockUnrated", Tag=0x00000007, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="blockChannelList", Tag=0x00000008, Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.BlockChannelStruct]]]),
                ClusterObjectFieldDescriptor(Label="blockApplicationList", Tag=0x00000009, Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]]),
                ClusterObjectFieldDescriptor(Label="blockContentTimeWindow", Tag=0x0000000A, Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.TimeWindowStruct]]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    enabled: 'bool' = False
    onDemandRatings: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]]' = None
    onDemandRatingThreshold: 'typing.Optional[str]' = None
    scheduledContentRatings: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]]' = None
    scheduledContentRatingThreshold: 'typing.Optional[str]' = None
    screenDailyTime: 'typing.Optional[uint]' = None
    remainingScreenTime: 'typing.Optional[uint]' = None
    blockUnrated: 'typing.Optional[bool]' = None
    blockChannelList: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.BlockChannelStruct]]]' = None
    blockApplicationList: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]]' = None
    blockContentTimeWindow: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.TimeWindowStruct]]]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StatusCodeEnum(MatterIntEnum):
            kInvalidPinCode = 0x02
            kInvalidRating = 0x03
            kInvalidChannel = 0x04
            kChannelAlreadyExist = 0x05
            kChannelNotExist = 0x06
            kUnidentifiableApplication = 0x07
            kApplicationAlreadyExist = 0x08
            kApplicationNotExist = 0x09
            kTimeWindowAlreadyExist = 0x0A
            kTimeWindowNotExist = 0x0B
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 12


    class Bitmaps:
        class Feature(IntFlag):
            kScreenTime = 0x1
            kPinManagement = 0x2
            kBlockUnrated = 0x4
            kOnDemandContentRating = 0x8
            kScheduledContentRating = 0x10
            kBlockChannels = 0x20
            kBlockApplications = 0x40
            kBlockContentTimeWindow = 0x80

        class DayOfWeekBitmap(IntFlag):
            kSunday = 0x1
            kMonday = 0x2
            kTuesday = 0x4
            kWednesday = 0x8
            kThursday = 0x10
            kFriday = 0x20
            kSaturday = 0x40


    class Structs:
        @dataclass
        class RatingNameStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ratingName", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="ratingNameDesc", Tag=1, Type=typing.Optional[str]),
                    ])

            ratingName: 'str' = ""
            ratingNameDesc: 'typing.Optional[str]' = None

        @dataclass
        class BlockChannelStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="blockChannelIndex", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="majorNumber", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="minorNumber", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="identifier", Tag=3, Type=typing.Optional[str]),
                    ])

            blockChannelIndex: 'typing.Union[Nullable, uint]' = NullValue
            majorNumber: 'uint' = 0
            minorNumber: 'uint' = 0
            identifier: 'typing.Optional[str]' = None

        @dataclass
        class AppInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="catalogVendorId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="applicationId", Tag=1, Type=str),
                    ])

            catalogVendorId: 'uint' = 0
            applicationId: 'str' = ""

        @dataclass
        class TimeWindowStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeWindowIndex", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="dayOfWeek", Tag=1, Type=ContentControl.Bitmaps.DayOfWeekBitmap),
                        ClusterObjectFieldDescriptor(Label="timePeriod", Tag=2, Type=typing.List[typing.Optional[ContentControl.Structs.TimePeriodStruct]]),
                    ])

            timeWindowIndex: 'typing.Union[Nullable, uint]' = NullValue
            dayOfWeek: 'ContentControl.Bitmaps.DayOfWeekBitmap' = 0
            timePeriod: 'typing.List[typing.Optional[ContentControl.Structs.TimePeriodStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class TimePeriodStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="startHour", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="startMinute", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endHour", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endMinute", Tag=3, Type=uint),
                    ])

            startHour: 'uint' = 0
            startMinute: 'uint' = 0
            endHour: 'uint' = 0
            endMinute: 'uint' = 0


    class Commands:
        @dataclass
        class UpdatePIN(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="oldPin", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="newPin", Tag=1, Type=str),
                    ])

            oldPin: 'str' = ""
            newPin: 'str' = ""

        @dataclass
        class ResetPIN(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ResetPINResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Enable(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Disable(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
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
        class AddBonusTime(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=0, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="bonusTime", Tag=1, Type=uint),
                    ])

            pinCode: 'typing.Optional[str]' = None
            bonusTime: 'uint' = 0

        @dataclass
        class SetScreenDailyTime(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="screenTime", Tag=0, Type=uint),
                    ])

            screenTime: 'uint' = 0

        @dataclass
        class BlockUnratedContent(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
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
        class UnblockUnratedContent(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SetOnDemandRatingThreshold(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rating", Tag=0, Type=str),
                    ])

            rating: 'str' = ""

        @dataclass
        class SetScheduledContentRatingThreshold(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rating", Tag=0, Type=str),
                    ])

            rating: 'str' = ""

        @dataclass
        class AddBlockChannels(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="channels", Tag=0, Type=typing.List[typing.Optional[ContentControl.Structs.BlockChannelStruct]]),
                    ])

            channels: 'typing.List[typing.Optional[ContentControl.Structs.BlockChannelStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class RemoveBlockChannels(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="channelIndexes", Tag=0, Type=typing.List[typing.Optional[uint]]),
                    ])

            channelIndexes: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])

        @dataclass
        class AddBlockApplications(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x0000000D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="applications", Tag=0, Type=typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]),
                    ])

            applications: 'typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class RemoveBlockApplications(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x0000000E
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="applications", Tag=0, Type=typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]),
                    ])

            applications: 'typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class SetBlockContentTimeWindow(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x0000000F
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeWindow", Tag=0, Type=ContentControl.Structs.TimeWindowStruct),
                    ])

            timeWindow: 'ContentControl.Structs.TimeWindowStruct' = field(default_factory=lambda: ContentControl.Structs.TimeWindowStruct())

        @dataclass
        class RemoveBlockContentTimeWindow(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000010
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeWindowIndexes", Tag=0, Type=typing.List[typing.Optional[uint]]),
                    ])

            timeWindowIndexes: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])

        @dataclass
        class ResetPINResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050F
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=0, Type=str),
                    ])

            pinCode: 'str' = ""


    class Attributes:
        @dataclass
        class Enabled(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class OnDemandRatings(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]]' = None

        @dataclass
        class OnDemandRatingThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class ScheduledContentRatings(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.RatingNameStruct]]]' = None

        @dataclass
        class ScheduledContentRatingThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class ScreenDailyTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RemainingScreenTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class BlockUnrated(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class BlockChannelList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.BlockChannelStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.BlockChannelStruct]]]' = None

        @dataclass
        class BlockApplicationList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.AppInfoStruct]]]' = None

        @dataclass
        class BlockContentTimeWindow(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[ContentControl.Structs.TimeWindowStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[ContentControl.Structs.TimeWindowStruct]]]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

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
                return 0x0000050F

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
                return 0x0000050F

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
                return 0x0000050F

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
                return 0x0000050F

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class RemainingScreenTimeExpired(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

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
        class EnteringBlockContentTimeWindow(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050F

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

