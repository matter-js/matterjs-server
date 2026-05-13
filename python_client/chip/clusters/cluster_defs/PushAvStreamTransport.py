"""PushAvStreamTransport cluster definition (auto-generated, DO NOT edit)."""

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
class PushAvStreamTransport(Cluster):
    id: typing.ClassVar[int] = 0x00000555

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="supportedFormats", Tag=0x00000000, Type=typing.List[PushAvStreamTransport.Structs.SupportedFormatStruct]),
                ClusterObjectFieldDescriptor(Label="currentConnections", Tag=0x00000001, Type=typing.List[PushAvStreamTransport.Structs.TransportConfigurationStruct]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    supportedFormats: typing.List[PushAvStreamTransport.Structs.SupportedFormatStruct] = field(default_factory=lambda: [])
    currentConnections: typing.List[PushAvStreamTransport.Structs.TransportConfigurationStruct] = field(default_factory=lambda: [])
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class TransportTriggerTypeEnum(MatterIntEnum):
            kCommand = 0x00
            kMotion = 0x01
            kContinuous = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class TransportStatusEnum(MatterIntEnum):
            kActive = 0x00
            kInactive = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class ContainerFormatEnum(MatterIntEnum):
            kCmaf = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class IngestMethodsEnum(MatterIntEnum):
            kCmafIngest = 0x00
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 1

        class TriggerActivationReasonEnum(MatterIntEnum):
            kUserInitiated = 0x00
            kAutomation = 0x01
            kEmergency = 0x02
            kDoorbellPressed = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class CMAFInterfaceEnum(MatterIntEnum):
            kInterface1 = 0x00
            kInterface2Dash = 0x01
            kInterface2Hls = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class StatusCodeEnum(MatterIntEnum):
            kInvalidTlsEndpoint = 0x02
            kInvalidStream = 0x03
            kInvalidURL = 0x04
            kInvalidZone = 0x05
            kInvalidCombination = 0x06
            kInvalidTriggerType = 0x07
            kInvalidTransportStatus = 0x08
            kInvalidOptions = 0x09
            kInvalidStreamUsage = 0x0A
            kInvalidTime = 0x0B
            kInvalidPreRollLength = 0x0C
            kDuplicateStreamValues = 0x0D
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 14

    class Bitmaps:
        class Feature(IntFlag):
            kPerZoneSensitivity = 0x1
            kMetadata = 0x2

    class Structs:
        @dataclass
        class SupportedFormatStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="containerFormat", Tag=0, Type=PushAvStreamTransport.Enums.ContainerFormatEnum),
                        ClusterObjectFieldDescriptor(Label="ingestMethod", Tag=1, Type=PushAvStreamTransport.Enums.IngestMethodsEnum),
                    ])

            containerFormat: PushAvStreamTransport.Enums.ContainerFormatEnum = 0
            ingestMethod: PushAvStreamTransport.Enums.IngestMethodsEnum = 0

        @dataclass
        class VideoStreamStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="videoStreamName", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=1, Type=uint),
                    ])

            videoStreamName: str = ""
            videoStreamID: uint = 0

        @dataclass
        class AudioStreamStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="audioStreamName", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=1, Type=uint),
                    ])

            audioStreamName: str = ""
            audioStreamID: uint = 0

        @dataclass
        class CMAFContainerOptionsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="cmafInterface", Tag=0, Type=PushAvStreamTransport.Enums.CMAFInterfaceEnum),
                        ClusterObjectFieldDescriptor(Label="segmentDuration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="chunkDuration", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sessionGroup", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="trackName", Tag=4, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="cencKey", Tag=5, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="cencKeyID", Tag=6, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="metadataEnabled", Tag=7, Type=typing.Optional[bool]),
                    ])

            cmafInterface: PushAvStreamTransport.Enums.CMAFInterfaceEnum = 0
            segmentDuration: uint = 0
            chunkDuration: uint = 0
            sessionGroup: typing.Optional[uint] = None
            trackName: typing.Optional[str] = None
            cencKey: typing.Optional[bytes] = None
            cencKeyID: typing.Optional[bytes] = None
            metadataEnabled: typing.Optional[bool] = None

        @dataclass
        class ContainerOptionsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="containerType", Tag=0, Type=PushAvStreamTransport.Enums.ContainerFormatEnum),
                        ClusterObjectFieldDescriptor(Label="cmafContainerOptions", Tag=1, Type=typing.Optional[PushAvStreamTransport.Structs.CMAFContainerOptionsStruct]),
                    ])

            containerType: PushAvStreamTransport.Enums.ContainerFormatEnum = 0
            cmafContainerOptions: typing.Optional[PushAvStreamTransport.Structs.CMAFContainerOptionsStruct] = None

        @dataclass
        class TransportZoneOptionsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="sensitivity", Tag=1, Type=typing.Optional[uint]),
                    ])

            zone: typing.Union[Nullable, uint] = NullValue
            sensitivity: typing.Optional[uint] = None

        @dataclass
        class TransportTriggerOptionsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="triggerType", Tag=0, Type=PushAvStreamTransport.Enums.TransportTriggerTypeEnum),
                        ClusterObjectFieldDescriptor(Label="motionZones", Tag=1, Type=typing.Union[None, Nullable, typing.List[PushAvStreamTransport.Structs.TransportZoneOptionsStruct]]),
                        ClusterObjectFieldDescriptor(Label="motionSensitivity", Tag=2, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="motionTimeControl", Tag=3, Type=typing.Optional[PushAvStreamTransport.Structs.TransportMotionTriggerTimeControlStruct]),
                        ClusterObjectFieldDescriptor(Label="maxPreRollLen", Tag=4, Type=typing.Optional[uint]),
                    ])

            triggerType: PushAvStreamTransport.Enums.TransportTriggerTypeEnum = 0
            motionZones: typing.Union[None, Nullable, typing.List[PushAvStreamTransport.Structs.TransportZoneOptionsStruct]] = None
            motionSensitivity: typing.Union[None, Nullable, uint] = None
            motionTimeControl: typing.Optional[PushAvStreamTransport.Structs.TransportMotionTriggerTimeControlStruct] = None
            maxPreRollLen: typing.Optional[uint] = None

        @dataclass
        class TransportMotionTriggerTimeControlStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="initialDuration", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="augmentationDuration", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="maxDuration", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="blindDuration", Tag=3, Type=uint),
                    ])

            initialDuration: uint = 0
            augmentationDuration: uint = 0
            maxDuration: uint = 0
            blindDuration: uint = 0

        @dataclass
        class TransportOptionsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="streamUsage", Tag=0, Type=Globals.Enums.StreamUsageEnum),
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=1, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="audioStreamID", Tag=2, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="tlsEndpointID", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="URL", Tag=4, Type=str),
                        ClusterObjectFieldDescriptor(Label="triggerOptions", Tag=5, Type=PushAvStreamTransport.Structs.TransportTriggerOptionsStruct),
                        ClusterObjectFieldDescriptor(Label="ingestMethod", Tag=6, Type=PushAvStreamTransport.Enums.IngestMethodsEnum),
                        ClusterObjectFieldDescriptor(Label="containerOptions", Tag=7, Type=PushAvStreamTransport.Structs.ContainerOptionsStruct),
                        ClusterObjectFieldDescriptor(Label="expiryTime", Tag=8, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="videoStreams", Tag=9, Type=typing.Optional[typing.List[PushAvStreamTransport.Structs.VideoStreamStruct]]),
                        ClusterObjectFieldDescriptor(Label="audioStreams", Tag=10, Type=typing.Optional[typing.List[PushAvStreamTransport.Structs.AudioStreamStruct]]),
                    ])

            streamUsage: Globals.Enums.StreamUsageEnum = 0
            videoStreamID: typing.Union[None, Nullable, uint] = None
            audioStreamID: typing.Union[None, Nullable, uint] = None
            tlsEndpointID: uint = 0
            URL: str = ""
            triggerOptions: PushAvStreamTransport.Structs.TransportTriggerOptionsStruct = field(default_factory=lambda: PushAvStreamTransport.Structs.TransportTriggerOptionsStruct())
            ingestMethod: PushAvStreamTransport.Enums.IngestMethodsEnum = 0
            containerOptions: PushAvStreamTransport.Structs.ContainerOptionsStruct = field(default_factory=lambda: PushAvStreamTransport.Structs.ContainerOptionsStruct())
            expiryTime: typing.Optional[uint] = None
            videoStreams: typing.Optional[typing.List[PushAvStreamTransport.Structs.VideoStreamStruct]] = None
            audioStreams: typing.Optional[typing.List[PushAvStreamTransport.Structs.AudioStreamStruct]] = None

        @dataclass
        class TransportConfigurationStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transportStatus", Tag=1, Type=PushAvStreamTransport.Enums.TransportStatusEnum),
                        ClusterObjectFieldDescriptor(Label="transportOptions", Tag=2, Type=typing.Optional[PushAvStreamTransport.Structs.TransportOptionsStruct]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            connectionID: uint = 0
            transportStatus: PushAvStreamTransport.Enums.TransportStatusEnum = 0
            transportOptions: typing.Optional[PushAvStreamTransport.Structs.TransportOptionsStruct] = None
            fabricIndex: uint = 0

    class Commands:
        @dataclass
        class AllocatePushTransport(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'AllocatePushTransportResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="transportOptions", Tag=0, Type=PushAvStreamTransport.Structs.TransportOptionsStruct),
                    ])

            transportOptions: PushAvStreamTransport.Structs.TransportOptionsStruct = field(default_factory=lambda: PushAvStreamTransport.Structs.TransportOptionsStruct())

        @dataclass
        class DeallocatePushTransport(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=uint),
                    ])

            connectionID: uint = 0

        @dataclass
        class ModifyPushTransport(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transportOptions", Tag=1, Type=PushAvStreamTransport.Structs.TransportOptionsStruct),
                    ])

            connectionID: uint = 0
            transportOptions: PushAvStreamTransport.Structs.TransportOptionsStruct = field(default_factory=lambda: PushAvStreamTransport.Structs.TransportOptionsStruct())

        @dataclass
        class SetTransportStatus(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="transportStatus", Tag=1, Type=PushAvStreamTransport.Enums.TransportStatusEnum),
                    ])

            connectionID: typing.Union[Nullable, uint] = NullValue
            transportStatus: PushAvStreamTransport.Enums.TransportStatusEnum = 0

        @dataclass
        class ManuallyTriggerTransport(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="activationReason", Tag=1, Type=PushAvStreamTransport.Enums.TriggerActivationReasonEnum),
                        ClusterObjectFieldDescriptor(Label="timeControl", Tag=2, Type=typing.Optional[PushAvStreamTransport.Structs.TransportMotionTriggerTimeControlStruct]),
                        ClusterObjectFieldDescriptor(Label="userDefined", Tag=3, Type=typing.Optional[bytes]),
                    ])

            connectionID: uint = 0
            activationReason: PushAvStreamTransport.Enums.TriggerActivationReasonEnum = 0
            timeControl: typing.Optional[PushAvStreamTransport.Structs.TransportMotionTriggerTimeControlStruct] = None
            userDefined: typing.Optional[bytes] = None

        @dataclass
        class FindTransport(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'FindTransportResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=typing.Union[Nullable, uint]),
                    ])

            connectionID: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class AllocatePushTransportResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="transportConfiguration", Tag=0, Type=PushAvStreamTransport.Structs.TransportConfigurationStruct),
                    ])

            transportConfiguration: PushAvStreamTransport.Structs.TransportConfigurationStruct = field(default_factory=lambda: PushAvStreamTransport.Structs.TransportConfigurationStruct())

        @dataclass
        class FindTransportResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000555
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="transportConfigurations", Tag=0, Type=typing.List[PushAvStreamTransport.Structs.TransportConfigurationStruct]),
                    ])

            transportConfigurations: typing.List[PushAvStreamTransport.Structs.TransportConfigurationStruct] = field(default_factory=lambda: [])

    class Attributes:
        @dataclass
        class SupportedFormats(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000555

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[PushAvStreamTransport.Structs.SupportedFormatStruct])

            value: typing.List[PushAvStreamTransport.Structs.SupportedFormatStruct] = field(default_factory=lambda: [])

        @dataclass
        class CurrentConnections(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000555

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[PushAvStreamTransport.Structs.TransportConfigurationStruct])

            value: typing.List[PushAvStreamTransport.Structs.TransportConfigurationStruct] = field(default_factory=lambda: [])

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000555

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
                return 0x00000555

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
                return 0x00000555

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
                return 0x00000555

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
                return 0x00000555

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
                return 0x00000555

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class PushTransportBegin(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000555

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="triggerType", Tag=1, Type=PushAvStreamTransport.Enums.TransportTriggerTypeEnum),
                        ClusterObjectFieldDescriptor(Label="activationReason", Tag=2, Type=typing.Optional[PushAvStreamTransport.Enums.TriggerActivationReasonEnum]),
                        ClusterObjectFieldDescriptor(Label="containerType", Tag=3, Type=typing.Optional[PushAvStreamTransport.Enums.ContainerFormatEnum]),
                        ClusterObjectFieldDescriptor(Label="cmafSessionNumber", Tag=4, Type=typing.Optional[uint]),
                    ])

            connectionID: uint = 0
            triggerType: PushAvStreamTransport.Enums.TransportTriggerTypeEnum = 0
            activationReason: typing.Optional[PushAvStreamTransport.Enums.TriggerActivationReasonEnum] = None
            containerType: typing.Optional[PushAvStreamTransport.Enums.ContainerFormatEnum] = None
            cmafSessionNumber: typing.Optional[uint] = None

        @dataclass
        class PushTransportEnd(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000555

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="containerType", Tag=1, Type=typing.Optional[PushAvStreamTransport.Enums.ContainerFormatEnum]),
                        ClusterObjectFieldDescriptor(Label="cmafSessionNumber", Tag=2, Type=typing.Optional[uint]),
                    ])

            connectionID: uint = 0
            containerType: typing.Optional[PushAvStreamTransport.Enums.ContainerFormatEnum] = None
            cmafSessionNumber: typing.Optional[uint] = None
