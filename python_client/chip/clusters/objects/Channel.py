"""Channel cluster definition (auto-generated, DO NOT edit)."""

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
from .ContentLauncher import ContentLauncher


@dataclass
class Channel(Cluster):
    id: typing.ClassVar[int] = 0x00000504

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="channelList", Tag=0x00000000, Type=typing.Optional[typing.List[typing.Optional[Channel.Structs.ChannelInfoStruct]]]),
                ClusterObjectFieldDescriptor(Label="lineup", Tag=0x00000001, Type=typing.Union[None, Nullable, Channel.Structs.LineupInfoStruct]),
                ClusterObjectFieldDescriptor(Label="currentChannel", Tag=0x00000002, Type=typing.Union[None, Nullable, Channel.Structs.ChannelInfoStruct]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    channelList: 'typing.Optional[typing.List[typing.Optional[Channel.Structs.ChannelInfoStruct]]]' = None
    lineup: 'typing.Union[None, Nullable, Channel.Structs.LineupInfoStruct]' = None
    currentChannel: 'typing.Union[None, Nullable, Channel.Structs.ChannelInfoStruct]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class LineupInfoTypeEnum(MatterIntEnum):
            kMso = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class StatusEnum(MatterIntEnum):
            kSuccess = 0x00
            kMultipleMatches = 0x01
            kNoMatches = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ChannelTypeEnum(MatterIntEnum):
            kSatellite = 0x00
            kCable = 0x01
            kTerrestrial = 0x02
            kOtt = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4


    class Bitmaps:
        class Feature(IntFlag):
            kChannelList = 0x1
            kLineupInfo = 0x2
            kElectronicGuide = 0x4
            kRecordProgram = 0x8

        class RecordingFlagBitmap(IntFlag):
            kScheduled = 0x1
            kRecordSeries = 0x2
            kRecorded = 0x4


    class Structs:
        @dataclass
        class ChannelInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="majorNumber", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="minorNumber", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="name", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="callSign", Tag=3, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="affiliateCallSign", Tag=4, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="identifier", Tag=5, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="type", Tag=6, Type=typing.Optional[Channel.Enums.ChannelTypeEnum]),
                    ])

            majorNumber: 'uint' = 0
            minorNumber: 'uint' = 0
            name: 'typing.Optional[str]' = None
            callSign: 'typing.Optional[str]' = None
            affiliateCallSign: 'typing.Optional[str]' = None
            identifier: 'typing.Optional[str]' = None
            type: 'typing.Optional[Channel.Enums.ChannelTypeEnum]' = None

        @dataclass
        class LineupInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operatorName", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="lineupName", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="postalCode", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="lineupInfoType", Tag=3, Type=Channel.Enums.LineupInfoTypeEnum),
                    ])

            operatorName: 'str' = ""
            lineupName: 'typing.Optional[str]' = None
            postalCode: 'typing.Optional[str]' = None
            lineupInfoType: 'Channel.Enums.LineupInfoTypeEnum' = 0

        @dataclass
        class ProgramStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="identifier", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="channel", Tag=1, Type=Channel.Structs.ChannelInfoStruct),
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endTime", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="title", Tag=4, Type=str),
                        ClusterObjectFieldDescriptor(Label="subtitle", Tag=5, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="description", Tag=6, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="audioLanguages", Tag=7, Type=typing.Optional[typing.List[typing.Optional[str]]]),
                        ClusterObjectFieldDescriptor(Label="ratings", Tag=8, Type=typing.Optional[typing.List[typing.Optional[str]]]),
                        ClusterObjectFieldDescriptor(Label="thumbnailUrl", Tag=9, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="posterArtUrl", Tag=10, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="dvbiUrl", Tag=11, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="releaseDate", Tag=12, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="parentalGuidanceText", Tag=13, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="recordingFlag", Tag=14, Type=typing.Optional[Channel.Bitmaps.RecordingFlagBitmap]),
                        ClusterObjectFieldDescriptor(Label="seriesInfo", Tag=15, Type=typing.Union[None, Nullable, Channel.Structs.SeriesInfoStruct]),
                        ClusterObjectFieldDescriptor(Label="categoryList", Tag=16, Type=typing.Optional[typing.List[typing.Optional[Channel.Structs.ProgramCategoryStruct]]]),
                        ClusterObjectFieldDescriptor(Label="castList", Tag=17, Type=typing.Optional[typing.List[typing.Optional[Channel.Structs.ProgramCastStruct]]]),
                        ClusterObjectFieldDescriptor(Label="externalIdList", Tag=18, Type=typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]),
                    ])

            identifier: 'str' = ""
            channel: 'Channel.Structs.ChannelInfoStruct' = field(default_factory=lambda: Channel.Structs.ChannelInfoStruct())
            startTime: 'uint' = 0
            endTime: 'uint' = 0
            title: 'str' = ""
            subtitle: 'typing.Optional[str]' = None
            description: 'typing.Optional[str]' = None
            audioLanguages: 'typing.Optional[typing.List[typing.Optional[str]]]' = None
            ratings: 'typing.Optional[typing.List[typing.Optional[str]]]' = None
            thumbnailUrl: 'typing.Optional[str]' = None
            posterArtUrl: 'typing.Optional[str]' = None
            dvbiUrl: 'typing.Optional[str]' = None
            releaseDate: 'typing.Optional[str]' = None
            parentalGuidanceText: 'typing.Optional[str]' = None
            recordingFlag: 'typing.Optional[Channel.Bitmaps.RecordingFlagBitmap]' = None
            seriesInfo: 'typing.Union[None, Nullable, Channel.Structs.SeriesInfoStruct]' = None
            categoryList: 'typing.Optional[typing.List[typing.Optional[Channel.Structs.ProgramCategoryStruct]]]' = None
            castList: 'typing.Optional[typing.List[typing.Optional[Channel.Structs.ProgramCastStruct]]]' = None
            externalIdList: 'typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]' = None

        @dataclass
        class ProgramCategoryStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="category", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="subCategory", Tag=1, Type=typing.Optional[str]),
                    ])

            category: 'str' = ""
            subCategory: 'typing.Optional[str]' = None

        @dataclass
        class SeriesInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="season", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="episode", Tag=1, Type=str),
                    ])

            season: 'str' = ""
            episode: 'str' = ""

        @dataclass
        class ProgramCastStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="name", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="role", Tag=1, Type=str),
                    ])

            name: 'str' = ""
            role: 'str' = ""

        @dataclass
        class PageTokenStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="limit", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="after", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="before", Tag=2, Type=typing.Optional[str]),
                    ])

            limit: 'typing.Optional[uint]' = None
            after: 'typing.Optional[str]' = None
            before: 'typing.Optional[str]' = None

        @dataclass
        class ChannelPagingStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="previousToken", Tag=0, Type=typing.Union[None, Nullable, Channel.Structs.PageTokenStruct]),
                        ClusterObjectFieldDescriptor(Label="nextToken", Tag=1, Type=typing.Union[None, Nullable, Channel.Structs.PageTokenStruct]),
                    ])

            previousToken: 'typing.Union[None, Nullable, Channel.Structs.PageTokenStruct]' = None
            nextToken: 'typing.Union[None, Nullable, Channel.Structs.PageTokenStruct]' = None


    class Commands:
        @dataclass
        class ChangeChannel(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ChangeChannelResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="match", Tag=0, Type=str),
                    ])

            match: 'str' = ""

        @dataclass
        class ChangeChannelByNumber(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="majorNumber", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="minorNumber", Tag=1, Type=uint),
                    ])

            majorNumber: 'uint' = 0
            minorNumber: 'uint' = 0

        @dataclass
        class SkipChannel(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="count", Tag=0, Type=int),
                    ])

            count: 'int' = 0

        @dataclass
        class GetProgramGuide(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ProgramGuideResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endTime", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="channelList", Tag=2, Type=typing.Optional[typing.List[typing.Optional[Channel.Structs.ChannelInfoStruct]]]),
                        ClusterObjectFieldDescriptor(Label="pageToken", Tag=3, Type=typing.Union[None, Nullable, Channel.Structs.PageTokenStruct]),
                        ClusterObjectFieldDescriptor(Label="recordingFlag", Tag=5, Type=typing.Union[None, Nullable, Channel.Bitmaps.RecordingFlagBitmap]),
                        ClusterObjectFieldDescriptor(Label="externalIdList", Tag=6, Type=typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]),
                        ClusterObjectFieldDescriptor(Label="data", Tag=7, Type=typing.Optional[bytes]),
                    ])

            startTime: 'uint' = 0
            endTime: 'uint' = 0
            channelList: 'typing.Optional[typing.List[typing.Optional[Channel.Structs.ChannelInfoStruct]]]' = None
            pageToken: 'typing.Union[None, Nullable, Channel.Structs.PageTokenStruct]' = None
            recordingFlag: 'typing.Union[None, Nullable, Channel.Bitmaps.RecordingFlagBitmap]' = None
            externalIdList: 'typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]' = None
            data: 'typing.Optional[bytes]' = None

        @dataclass
        class RecordProgram(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="programIdentifier", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="shouldRecordSeries", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="externalIdList", Tag=2, Type=typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]),
                        ClusterObjectFieldDescriptor(Label="data", Tag=3, Type=typing.Optional[bytes]),
                    ])

            programIdentifier: 'str' = ""
            shouldRecordSeries: 'bool' = False
            externalIdList: 'typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]' = None
            data: 'typing.Optional[bytes]' = None

        @dataclass
        class CancelRecordProgram(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="programIdentifier", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="shouldRecordSeries", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="externalIdList", Tag=2, Type=typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]),
                        ClusterObjectFieldDescriptor(Label="data", Tag=3, Type=typing.Optional[bytes]),
                    ])

            programIdentifier: 'str' = ""
            shouldRecordSeries: 'bool' = False
            externalIdList: 'typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]' = None
            data: 'typing.Optional[bytes]' = None

        @dataclass
        class ChangeChannelResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Channel.Enums.StatusEnum),
                        ClusterObjectFieldDescriptor(Label="data", Tag=1, Type=typing.Optional[str]),
                    ])

            status: 'Channel.Enums.StatusEnum' = 0
            data: 'typing.Optional[str]' = None

        @dataclass
        class ProgramGuideResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000504
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="paging", Tag=0, Type=Channel.Structs.ChannelPagingStruct),
                        ClusterObjectFieldDescriptor(Label="programList", Tag=1, Type=typing.List[typing.Optional[Channel.Structs.ProgramStruct]]),
                    ])

            paging: 'Channel.Structs.ChannelPagingStruct' = field(default_factory=lambda: Channel.Structs.ChannelPagingStruct())
            programList: 'typing.List[typing.Optional[Channel.Structs.ProgramStruct]]' = field(default_factory=lambda: [])


    class Attributes:
        @dataclass
        class ChannelList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000504

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[Channel.Structs.ChannelInfoStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[Channel.Structs.ChannelInfoStruct]]]' = None

        @dataclass
        class Lineup(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000504

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, Channel.Structs.LineupInfoStruct])

            value: 'typing.Union[None, Nullable, Channel.Structs.LineupInfoStruct]' = None

        @dataclass
        class CurrentChannel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000504

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, Channel.Structs.ChannelInfoStruct])

            value: 'typing.Union[None, Nullable, Channel.Structs.ChannelInfoStruct]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000504

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
                return 0x00000504

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
                return 0x00000504

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
                return 0x00000504

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
                return 0x00000504

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

