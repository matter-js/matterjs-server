"""KeypadInput cluster definition (auto-generated, DO NOT edit)."""

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
class KeypadInput(Cluster):
    id: typing.ClassVar[int] = 0x00000509

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class StatusEnum(MatterIntEnum):
            kSuccess = 0x00
            kUnsupportedKey = 0x01
            kInvalidKeyInCurrentState = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class CECKeyCodeEnum(MatterIntEnum):
            kSelect = 0x00
            kUp = 0x01
            kDown = 0x02
            kLeft = 0x03
            kRight = 0x04
            kRightUp = 0x05
            kRightDown = 0x06
            kLeftUp = 0x07
            kLeftDown = 0x08
            kRootMenu = 0x09
            kSetupMenu = 0x0A
            kContentsMenu = 0x0B
            kFavoriteMenu = 0x0C
            kExit = 0x0D
            kMediaTopMenu = 0x10
            kMediaContextSensitiveMenu = 0x11
            kNumberEntryMode = 0x1D
            kNumber11 = 0x1E
            kNumber12 = 0x1F
            kNumber0OrNumber10 = 0x20
            kNumbers1 = 0x21
            kNumbers2 = 0x22
            kNumbers3 = 0x23
            kNumbers4 = 0x24
            kNumbers5 = 0x25
            kNumbers6 = 0x26
            kNumbers7 = 0x27
            kNumbers8 = 0x28
            kNumbers9 = 0x29
            kDot = 0x2A
            kEnter = 0x2B
            kClear = 0x2C
            kNextFavorite = 0x2F
            kChannelUp = 0x30
            kChannelDown = 0x31
            kPreviousChannel = 0x32
            kSoundSelect = 0x33
            kInputSelect = 0x34
            kDisplayInformation = 0x35
            kHelp = 0x36
            kPageUp = 0x37
            kPageDown = 0x38
            kPower = 0x40
            kVolumeUp = 0x41
            kVolumeDown = 0x42
            kMute = 0x43
            kPlay = 0x44
            kStop = 0x45
            kPause = 0x46
            kRecord = 0x47
            kRewind = 0x48
            kFastForward = 0x49
            kEject = 0x4A
            kForward = 0x4B
            kBackward = 0x4C
            kStopRecord = 0x4D
            kPauseRecord = 0x4E
            kAngle = 0x50
            kSubPicture = 0x51
            kVideoOnDemand = 0x52
            kElectronicProgramGuide = 0x53
            kTimerProgramming = 0x54
            kInitialConfiguration = 0x55
            kSelectBroadcastType = 0x56
            kSelectSoundPresentation = 0x57
            kPlayFunction = 0x60
            kPausePlayFunction = 0x61
            kRecordFunction = 0x62
            kPauseRecordFunction = 0x63
            kStopFunction = 0x64
            kMuteFunction = 0x65
            kRestoreVolumeFunction = 0x66
            kTuneFunction = 0x67
            kSelectMediaFunction = 0x68
            kSelectAvInputFunction = 0x69
            kSelectAudioInputFunction = 0x6A
            kPowerToggleFunction = 0x6B
            kPowerOffFunction = 0x6C
            kPowerOnFunction = 0x6D
            kF1Blue = 0x71
            kF2Red = 0x72
            kF3Green = 0x73
            kF4Yellow = 0x74
            kF5 = 0x75
            kData = 0x76
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 119


    class Bitmaps:
        class Feature(IntFlag):
            kNavigationKeyCodes = 0x1
            kLocationKeys = 0x2
            kNumberKeys = 0x4


    class Commands:
        @dataclass
        class SendKey(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000509
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SendKeyResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="keyCode", Tag=0, Type=KeypadInput.Enums.CECKeyCodeEnum),
                    ])

            keyCode: 'KeypadInput.Enums.CECKeyCodeEnum' = 0

        @dataclass
        class SendKeyResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000509
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=KeypadInput.Enums.StatusEnum),
                    ])

            status: 'KeypadInput.Enums.StatusEnum' = 0


    class Attributes:
        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000509

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
                return 0x00000509

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
                return 0x00000509

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
                return 0x00000509

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
                return 0x00000509

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

