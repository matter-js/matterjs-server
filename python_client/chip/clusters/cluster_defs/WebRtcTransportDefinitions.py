"""WebRtcTransportDefinitions shared datatype definitions (auto-generated, DO NOT edit)."""

from __future__ import annotations

import typing
from dataclasses import dataclass, field
from enum import IntFlag

from ... import ChipUtility
from ...clusters.enum import MatterIntEnum
from ...tlv import float32, uint
from ..ClusterObjects import (ClusterObject,
                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)
from ..Types import Nullable, NullValue
from .Globals import Globals


class WebRtcTransportDefinitions:
    class Enums:
        class WebRTCEndReasonEnum(MatterIntEnum):
            kIceFailed = 0x00
            kIceTimeout = 0x01
            kUserHangup = 0x02
            kUserBusy = 0x03
            kReplaced = 0x04
            kNoUserMedia = 0x05
            kInviteTimeout = 0x06
            kAnsweredElsewhere = 0x07
            kOutOfResources = 0x08
            kMediaTimeout = 0x09
            kLowPower = 0x0A
            kPrivacyMode = 0x0B
            kUnknownReason = 0x0C
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 13

    class Structs:
        @dataclass
        class ICEServerStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="urLs", Tag=0, Type=typing.List[str]),
                        ClusterObjectFieldDescriptor(Label="username", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="credential", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="caid", Tag=3, Type=typing.Optional[uint]),
                    ])

            urLs: typing.List[str] = field(default_factory=lambda: [])
            username: typing.Optional[str] = None
            credential: typing.Optional[str] = None
            caid: typing.Optional[uint] = None

        @dataclass
        class ICECandidateStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="candidate", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="sdpMid", Tag=1, Type=typing.Union[Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="sdpmLineIndex", Tag=2, Type=typing.Union[Nullable, uint]),
                    ])

            candidate: str = ""
            sdpMid: typing.Union[Nullable, str] = NullValue
            sdpmLineIndex: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class WebRTCSessionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="id", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="peerNodeID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="peerEndpointID", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="streamUsage", Tag=3, Type=Globals.Enums.StreamUsageEnum),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=4, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=5, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="metadataEnabled", Tag=6, Type=bool),
                        ClusterObjectFieldDescriptor(Label="videoStreams", Tag=7, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="audioStreams", Tag=8, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            id: uint = 0
            peerNodeID: uint = 0
            peerEndpointID: uint = 0
            streamUsage: Globals.Enums.StreamUsageEnum = 0
            videoStreamID: typing.Union[None, Nullable, uint] = None
            audioStreamID: typing.Union[None, Nullable, uint] = None
            metadataEnabled: bool = False
            videoStreams: typing.Optional[typing.List[uint]] = None
            audioStreams: typing.Optional[typing.List[uint]] = None
            fabricIndex: uint = 0
