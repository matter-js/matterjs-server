"""WebRtcTransportProvider cluster definition (auto-generated, DO NOT edit)."""

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
from .WebRtcTransportDefinitions import WebRtcTransportDefinitions


@dataclass
class WebRtcTransportProvider(Cluster):
    id: typing.ClassVar[int] = 0x00000553

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="currentSessions", Tag=0x00000000, Type=typing.List[WebRtcTransportDefinitions.Structs.WebRTCSessionStruct]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    currentSessions: typing.List[WebRtcTransportDefinitions.Structs.WebRTCSessionStruct] = field(default_factory=lambda: [])
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Bitmaps:
        class Feature(IntFlag):
            kMetadata = 0x1

    class Commands:
        @dataclass
        class SolicitOffer(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SolicitOfferResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="streamUsage", Tag=0, Type=Globals.Enums.StreamUsageEnum),
                        ClusterObjectFieldDescriptor(Label="originatingEndpointID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=2, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=3, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="iceServers", Tag=4, Type=typing.Optional[typing.List[WebRtcTransportDefinitions.Structs.ICEServerStruct]]),
                        ClusterObjectFieldDescriptor(Label="iceTransportPolicy", Tag=5, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="metadataEnabled", Tag=6, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="videoStreams", Tag=8, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="audioStreams", Tag=9, Type=typing.Optional[typing.List[uint]]),
                    ])

            streamUsage: Globals.Enums.StreamUsageEnum = 0
            originatingEndpointID: uint = 0
            videoStreamID: typing.Union[None, Nullable, uint] = None
            audioStreamID: typing.Union[None, Nullable, uint] = None
            iceServers: typing.Optional[typing.List[WebRtcTransportDefinitions.Structs.ICEServerStruct]] = None
            iceTransportPolicy: typing.Optional[str] = None
            metadataEnabled: typing.Optional[bool] = None
            videoStreams: typing.Optional[typing.List[uint]] = None
            audioStreams: typing.Optional[typing.List[uint]] = None

        @dataclass
        class ProvideOffer(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ProvideOfferResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="webRtcSessionID", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="sdp", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="streamUsage", Tag=2, Type=typing.Optional[Globals.Enums.StreamUsageEnum]),
                        ClusterObjectFieldDescriptor(Label="originatingEndpointID", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=4, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=5, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="iceServers", Tag=6, Type=typing.Optional[typing.List[WebRtcTransportDefinitions.Structs.ICEServerStruct]]),
                        ClusterObjectFieldDescriptor(Label="iceTransportPolicy", Tag=7, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="metadataEnabled", Tag=8, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="videoStreams", Tag=10, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="audioStreams", Tag=11, Type=typing.Optional[typing.List[uint]]),
                    ])

            webRtcSessionID: typing.Union[Nullable, uint] = NullValue
            sdp: str = ""
            streamUsage: typing.Optional[Globals.Enums.StreamUsageEnum] = None
            originatingEndpointID: typing.Optional[uint] = None
            videoStreamID: typing.Union[None, Nullable, uint] = None
            audioStreamID: typing.Union[None, Nullable, uint] = None
            iceServers: typing.Optional[typing.List[WebRtcTransportDefinitions.Structs.ICEServerStruct]] = None
            iceTransportPolicy: typing.Optional[str] = None
            metadataEnabled: typing.Optional[bool] = None
            videoStreams: typing.Optional[typing.List[uint]] = None
            audioStreams: typing.Optional[typing.List[uint]] = None

        @dataclass
        class ProvideAnswer(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="webRtcSessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sdp", Tag=1, Type=str),
                    ])

            webRtcSessionID: uint = 0
            sdp: str = ""

        @dataclass
        class ProvideIceCandidates(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="webRtcSessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="iceCandidates", Tag=1, Type=typing.List[WebRtcTransportDefinitions.Structs.ICECandidateStruct]),
                    ])

            webRtcSessionID: uint = 0
            iceCandidates: typing.List[WebRtcTransportDefinitions.Structs.ICECandidateStruct] = field(default_factory=lambda: [])

        @dataclass
        class EndSession(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="webRtcSessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="reason", Tag=1, Type=WebRtcTransportDefinitions.Enums.WebRTCEndReasonEnum),
                    ])

            webRtcSessionID: uint = 0
            reason: WebRtcTransportDefinitions.Enums.WebRTCEndReasonEnum = 0

        @dataclass
        class SolicitOfferResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="webRtcSessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="deferredOffer", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=2, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=3, Type=typing.Union[None, Nullable, uint]),
                    ])

            webRtcSessionID: uint = 0
            deferredOffer: bool = False
            videoStreamID: typing.Union[None, Nullable, uint] = None
            audioStreamID: typing.Union[None, Nullable, uint] = None

        @dataclass
        class ProvideOfferResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000553
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="webRtcSessionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=1, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=2, Type=typing.Union[None, Nullable, uint]),
                    ])

            webRtcSessionID: uint = 0
            videoStreamID: typing.Union[None, Nullable, uint] = None
            audioStreamID: typing.Union[None, Nullable, uint] = None

    class Attributes:
        @dataclass
        class CurrentSessions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000553

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[WebRtcTransportDefinitions.Structs.WebRTCSessionStruct])

            value: typing.List[WebRtcTransportDefinitions.Structs.WebRTCSessionStruct] = field(default_factory=lambda: [])

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000553

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
                return 0x00000553

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
                return 0x00000553

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
                return 0x00000553

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
                return 0x00000553

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
                return 0x00000553

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
