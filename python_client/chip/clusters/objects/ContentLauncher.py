"""ContentLauncher cluster definition (auto-generated, DO NOT edit)."""

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
from .MediaPlayback import MediaPlayback


@dataclass
class ContentLauncher(Cluster):
    id: typing.ClassVar[int] = 0x0000050A

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="acceptHeader", Tag=0x00000000, Type=typing.Optional[typing.List[typing.Optional[str]]]),
                ClusterObjectFieldDescriptor(Label="supportedStreamingProtocols", Tag=0x00000001, Type=typing.Optional[ContentLauncher.Bitmaps.SupportedProtocolsBitmap]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    acceptHeader: 'typing.Optional[typing.List[typing.Optional[str]]]' = None
    supportedStreamingProtocols: 'typing.Optional[ContentLauncher.Bitmaps.SupportedProtocolsBitmap]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StatusEnum(MatterIntEnum):
            kSuccess = 0x00
            kUrlNotAvailable = 0x01
            kAuthFailed = 0x02
            kTextTrackNotAvailable = 0x03
            kAudioTrackNotAvailable = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class ParameterEnum(MatterIntEnum):
            kActor = 0x00
            kChannel = 0x01
            kCharacter = 0x02
            kDirector = 0x03
            kEvent = 0x04
            kFranchise = 0x05
            kGenre = 0x06
            kLeague = 0x07
            kPopularity = 0x08
            kProvider = 0x09
            kSport = 0x0A
            kSportsTeam = 0x0B
            kType = 0x0C
            kVideo = 0x0D
            kSeason = 0x0E
            kEpisode = 0x0F
            kAny = 0x10
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 17

        class MetricTypeEnum(MatterIntEnum):
            kPixels = 0x00
            kPercentage = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2


    class Bitmaps:
        class Feature(IntFlag):
            kContentSearch = 0x1
            kUrlPlayback = 0x2
            kAdvancedSeek = 0x4
            kTextTracks = 0x8
            kAudioTracks = 0x10

        class SupportedProtocolsBitmap(IntFlag):
            kDash = 0x1
            kHls = 0x2


    class Structs:
        @dataclass
        class AdditionalInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="name", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="value", Tag=1, Type=str),
                    ])

            name: 'str' = ""
            value: 'str' = ""

        @dataclass
        class ParameterStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="type", Tag=0, Type=ContentLauncher.Enums.ParameterEnum),
                        ClusterObjectFieldDescriptor(Label="value", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="externalIdList", Tag=2, Type=typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]),
                    ])

            type: 'ContentLauncher.Enums.ParameterEnum' = 0
            value: 'str' = ""
            externalIdList: 'typing.Optional[typing.List[typing.Optional[ContentLauncher.Structs.AdditionalInfoStruct]]]' = None

        @dataclass
        class ContentSearchStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="parameterList", Tag=0, Type=typing.List[typing.Optional[ContentLauncher.Structs.ParameterStruct]]),
                    ])

            parameterList: 'typing.List[typing.Optional[ContentLauncher.Structs.ParameterStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class DimensionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="width", Tag=0, Type=float),
                        ClusterObjectFieldDescriptor(Label="height", Tag=1, Type=float),
                        ClusterObjectFieldDescriptor(Label="metric", Tag=2, Type=ContentLauncher.Enums.MetricTypeEnum),
                    ])

            width: 'float' = 0.0
            height: 'float' = 0.0
            metric: 'ContentLauncher.Enums.MetricTypeEnum' = 0

        @dataclass
        class StyleInformationStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="imageUrl", Tag=0, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="color", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="size", Tag=2, Type=typing.Optional[ContentLauncher.Structs.DimensionStruct]),
                    ])

            imageUrl: 'typing.Optional[str]' = None
            color: 'typing.Optional[str]' = None
            size: 'typing.Optional[ContentLauncher.Structs.DimensionStruct]' = None

        @dataclass
        class BrandingInformationStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="providerName", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="background", Tag=1, Type=typing.Optional[ContentLauncher.Structs.StyleInformationStruct]),
                        ClusterObjectFieldDescriptor(Label="logo", Tag=2, Type=typing.Optional[ContentLauncher.Structs.StyleInformationStruct]),
                        ClusterObjectFieldDescriptor(Label="progressBar", Tag=3, Type=typing.Optional[ContentLauncher.Structs.StyleInformationStruct]),
                        ClusterObjectFieldDescriptor(Label="splash", Tag=4, Type=typing.Optional[ContentLauncher.Structs.StyleInformationStruct]),
                        ClusterObjectFieldDescriptor(Label="watermark", Tag=5, Type=typing.Optional[ContentLauncher.Structs.StyleInformationStruct]),
                    ])

            providerName: 'str' = ""
            background: 'typing.Optional[ContentLauncher.Structs.StyleInformationStruct]' = None
            logo: 'typing.Optional[ContentLauncher.Structs.StyleInformationStruct]' = None
            progressBar: 'typing.Optional[ContentLauncher.Structs.StyleInformationStruct]' = None
            splash: 'typing.Optional[ContentLauncher.Structs.StyleInformationStruct]' = None
            watermark: 'typing.Optional[ContentLauncher.Structs.StyleInformationStruct]' = None

        @dataclass
        class PlaybackPreferencesStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="playbackPosition", Tag=0, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="textTrack", Tag=1, Type=typing.Union[None, Nullable, ContentLauncher.Structs.TrackPreferenceStruct]),
                        ClusterObjectFieldDescriptor(Label="audioTracks", Tag=2, Type=typing.Union[None, Nullable, typing.List[typing.Optional[ContentLauncher.Structs.TrackPreferenceStruct]]]),
                    ])

            playbackPosition: 'typing.Union[None, Nullable, uint]' = None
            textTrack: 'typing.Union[None, Nullable, ContentLauncher.Structs.TrackPreferenceStruct]' = None
            audioTracks: 'typing.Union[None, Nullable, typing.List[typing.Optional[ContentLauncher.Structs.TrackPreferenceStruct]]]' = None

        @dataclass
        class TrackPreferenceStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="languageCode", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="characteristics", Tag=1, Type=typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Enums.CharacteristicEnum]]]),
                        ClusterObjectFieldDescriptor(Label="audioOutputIndex", Tag=2, Type=typing.Union[None, Nullable, uint]),
                    ])

            languageCode: 'str' = ""
            characteristics: 'typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Enums.CharacteristicEnum]]]' = None
            audioOutputIndex: 'typing.Union[None, Nullable, uint]' = None


    class Commands:
        @dataclass
        class LaunchContent(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050A
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'LauncherResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="search", Tag=0, Type=ContentLauncher.Structs.ContentSearchStruct),
                        ClusterObjectFieldDescriptor(Label="autoPlay", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="data", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="playbackPreferences", Tag=3, Type=typing.Optional[ContentLauncher.Structs.PlaybackPreferencesStruct]),
                        ClusterObjectFieldDescriptor(Label="useCurrentContext", Tag=4, Type=typing.Optional[bool]),
                    ])

            search: 'ContentLauncher.Structs.ContentSearchStruct' = field(default_factory=lambda: ContentLauncher.Structs.ContentSearchStruct())
            autoPlay: 'bool' = False
            data: 'typing.Optional[str]' = None
            playbackPreferences: 'typing.Optional[ContentLauncher.Structs.PlaybackPreferencesStruct]' = None
            useCurrentContext: 'typing.Optional[bool]' = None

        @dataclass
        class LaunchUrl(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050A
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'LauncherResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="contentUrl", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="displayString", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="brandingInformation", Tag=2, Type=typing.Optional[ContentLauncher.Structs.BrandingInformationStruct]),
                        ClusterObjectFieldDescriptor(Label="playbackPreferences", Tag=3, Type=typing.Optional[ContentLauncher.Structs.PlaybackPreferencesStruct]),
                    ])

            contentUrl: 'str' = ""
            displayString: 'typing.Optional[str]' = None
            brandingInformation: 'typing.Optional[ContentLauncher.Structs.BrandingInformationStruct]' = None
            playbackPreferences: 'typing.Optional[ContentLauncher.Structs.PlaybackPreferencesStruct]' = None

        @dataclass
        class LauncherResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000050A
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=ContentLauncher.Enums.StatusEnum),
                        ClusterObjectFieldDescriptor(Label="data", Tag=1, Type=typing.Optional[str]),
                    ])

            status: 'ContentLauncher.Enums.StatusEnum' = 0
            data: 'typing.Optional[str]' = None


    class Attributes:
        @dataclass
        class AcceptHeader(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[str]]])

            value: 'typing.Optional[typing.List[typing.Optional[str]]]' = None

        @dataclass
        class SupportedStreamingProtocols(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[ContentLauncher.Bitmaps.SupportedProtocolsBitmap])

            value: 'typing.Optional[ContentLauncher.Bitmaps.SupportedProtocolsBitmap]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000050A

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
                return 0x0000050A

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
                return 0x0000050A

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
                return 0x0000050A

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
                return 0x0000050A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

