"""MediaPlayback cluster definition (auto-generated, DO NOT edit)."""

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
class MediaPlayback(Cluster):
    id: typing.ClassVar[int] = 0x00000506

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="currentState", Tag=0x00000000, Type=MediaPlayback.Enums.PlaybackStateEnum),
                ClusterObjectFieldDescriptor(Label="startTime", Tag=0x00000001, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="duration", Tag=0x00000002, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="sampledPosition", Tag=0x00000003, Type=typing.Union[None, Nullable, MediaPlayback.Structs.PlaybackPositionStruct]),
                ClusterObjectFieldDescriptor(Label="playbackSpeed", Tag=0x00000004, Type=typing.Optional[float32]),
                ClusterObjectFieldDescriptor(Label="seekRangeEnd", Tag=0x00000005, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="seekRangeStart", Tag=0x00000006, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="activeAudioTrack", Tag=0x00000007, Type=typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct]),
                ClusterObjectFieldDescriptor(Label="availableAudioTracks", Tag=0x00000008, Type=typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]]),
                ClusterObjectFieldDescriptor(Label="activeTextTrack", Tag=0x00000009, Type=typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct]),
                ClusterObjectFieldDescriptor(Label="availableTextTracks", Tag=0x0000000A, Type=typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    currentState: 'MediaPlayback.Enums.PlaybackStateEnum' = 0
    startTime: 'typing.Union[None, Nullable, uint]' = None
    duration: 'typing.Union[None, Nullable, uint]' = None
    sampledPosition: 'typing.Union[None, Nullable, MediaPlayback.Structs.PlaybackPositionStruct]' = None
    playbackSpeed: 'typing.Optional[float32]' = None
    seekRangeEnd: 'typing.Union[None, Nullable, uint]' = None
    seekRangeStart: 'typing.Union[None, Nullable, uint]' = None
    activeAudioTrack: 'typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct]' = None
    availableAudioTracks: 'typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]]' = None
    activeTextTrack: 'typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct]' = None
    availableTextTracks: 'typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class PlaybackStateEnum(MatterIntEnum):
            kPlaying = 0x00
            kPaused = 0x01
            kNotPlaying = 0x02
            kBuffering = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class StatusEnum(MatterIntEnum):
            kSuccess = 0x00
            kInvalidStateForCommand = 0x01
            kNotAllowed = 0x02
            kNotActive = 0x03
            kSpeedOutOfRange = 0x04
            kSeekOutOfRange = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class CharacteristicEnum(MatterIntEnum):
            kForcedSubtitles = 0x00
            kDescribesVideo = 0x01
            kEasyToRead = 0x02
            kFrameBased = 0x03
            kMainProgram = 0x04
            kOriginalContent = 0x05
            kVoiceOverTranslation = 0x06
            kCaption = 0x07
            kSubtitle = 0x08
            kAlternate = 0x09
            kSupplementary = 0x0A
            kCommentary = 0x0B
            kDubbedTranslation = 0x0C
            kDescription = 0x0D
            kMetadata = 0x0E
            kEnhancedAudioIntelligibility = 0x0F
            kEmergency = 0x10
            kKaraoke = 0x11
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 18

    class Bitmaps:
        class Feature(IntFlag):
            kAdvancedSeek = 0x1
            kVariableSpeed = 0x2
            kTextTracks = 0x4
            kAudioTracks = 0x8
            kAudioAdvance = 0x10

    class Structs:
        @dataclass
        class PlaybackPositionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="updatedAt", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="position", Tag=1, Type=typing.Union[Nullable, uint]),
                    ])

            updatedAt: 'uint' = 0
            position: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class TrackStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="iD", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="trackAttributes", Tag=1, Type=MediaPlayback.Structs.TrackAttributesStruct),
                    ])

            iD: 'str' = ""
            trackAttributes: 'MediaPlayback.Structs.TrackAttributesStruct' = field(default_factory=lambda: MediaPlayback.Structs.TrackAttributesStruct())

        @dataclass
        class TrackAttributesStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="languageCode", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="characteristics", Tag=1, Type=typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Enums.CharacteristicEnum]]]),
                        ClusterObjectFieldDescriptor(Label="displayName", Tag=2, Type=typing.Union[None, Nullable, str]),
                    ])

            languageCode: 'str' = ""
            characteristics: 'typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Enums.CharacteristicEnum]]]' = None
            displayName: 'typing.Union[None, Nullable, str]' = None

    class Commands:
        @dataclass
        class Play(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Pause(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Stop(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class StartOver(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Previous(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Next(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Rewind(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="audioAdvanceUnmuted", Tag=0, Type=typing.Optional[bool]),
                    ])

            audioAdvanceUnmuted: 'typing.Optional[bool]' = None

        @dataclass
        class FastForward(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="audioAdvanceUnmuted", Tag=0, Type=typing.Optional[bool]),
                    ])

            audioAdvanceUnmuted: 'typing.Optional[bool]' = None

        @dataclass
        class SkipForward(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="deltaPositionMilliseconds", Tag=0, Type=uint),
                    ])

            deltaPositionMilliseconds: 'uint' = 0

        @dataclass
        class SkipBackward(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="deltaPositionMilliseconds", Tag=0, Type=uint),
                    ])

            deltaPositionMilliseconds: 'uint' = 0

        @dataclass
        class Seek(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PlaybackResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="position", Tag=0, Type=uint),
                    ])

            position: 'uint' = 0

        @dataclass
        class ActivateAudioTrack(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="trackID", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="audioOutputIndex", Tag=1, Type=typing.Union[None, Nullable, uint]),
                    ])

            trackID: 'str' = ""
            audioOutputIndex: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ActivateTextTrack(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x0000000D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="trackID", Tag=0, Type=str),
                    ])

            trackID: 'str' = ""

        @dataclass
        class DeactivateTextTrack(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x0000000E
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class PlaybackResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000506
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=MediaPlayback.Enums.StatusEnum),
                        ClusterObjectFieldDescriptor(Label="data", Tag=1, Type=typing.Optional[str]),
                    ])

            status: 'MediaPlayback.Enums.StatusEnum' = 0
            data: 'typing.Optional[str]' = None

    class Attributes:
        @dataclass
        class CurrentState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=MediaPlayback.Enums.PlaybackStateEnum)

            value: 'MediaPlayback.Enums.PlaybackStateEnum' = 0

        @dataclass
        class StartTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Duration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class SampledPosition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, MediaPlayback.Structs.PlaybackPositionStruct])

            value: 'typing.Union[None, Nullable, MediaPlayback.Structs.PlaybackPositionStruct]' = None

        @dataclass
        class PlaybackSpeed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[float32])

            value: 'typing.Optional[float32]' = None

        @dataclass
        class SeekRangeEnd(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class SeekRangeStart(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ActiveAudioTrack(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct])

            value: 'typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct]' = None

        @dataclass
        class AvailableAudioTracks(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]])

            value: 'typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]]' = None

        @dataclass
        class ActiveTextTrack(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct])

            value: 'typing.Union[None, Nullable, MediaPlayback.Structs.TrackStruct]' = None

        @dataclass
        class AvailableTextTracks(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]])

            value: 'typing.Union[None, Nullable, typing.List[typing.Optional[MediaPlayback.Structs.TrackStruct]]]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

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
                return 0x00000506

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
                return 0x00000506

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
                return 0x00000506

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
                return 0x00000506

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class StateChanged(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000506

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="currentState", Tag=0, Type=MediaPlayback.Enums.PlaybackStateEnum),
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="sampledPosition", Tag=3, Type=typing.Optional[MediaPlayback.Structs.PlaybackPositionStruct]),
                        ClusterObjectFieldDescriptor(Label="playbackSpeed", Tag=4, Type=typing.Optional[float32]),
                        ClusterObjectFieldDescriptor(Label="seekRangeEnd", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="seekRangeStart", Tag=6, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="data", Tag=7, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="audioAdvanceUnmuted", Tag=8, Type=typing.Optional[bool]),
                    ])

            currentState: 'MediaPlayback.Enums.PlaybackStateEnum' = 0
            startTime: 'typing.Optional[uint]' = None
            duration: 'typing.Optional[uint]' = None
            sampledPosition: 'typing.Optional[MediaPlayback.Structs.PlaybackPositionStruct]' = None
            playbackSpeed: 'typing.Optional[float32]' = None
            seekRangeEnd: 'typing.Optional[uint]' = None
            seekRangeStart: 'typing.Optional[uint]' = None
            data: 'typing.Optional[bytes]' = None
            audioAdvanceUnmuted: 'typing.Optional[bool]' = None
