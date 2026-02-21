"""Messages cluster definition (auto-generated, DO NOT edit)."""

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
class Messages(Cluster):
    id: typing.ClassVar[int] = 0x00000097

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="messages", Tag=0x00000000, Type=typing.List[typing.Optional[Messages.Structs.MessageStruct]]),
                ClusterObjectFieldDescriptor(Label="activeMessageIDs", Tag=0x00000001, Type=typing.List[typing.Optional[bytes]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    messages: 'typing.List[typing.Optional[Messages.Structs.MessageStruct]]' = field(default_factory=lambda: [])
    activeMessageIDs: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class FutureMessagePreferenceEnum(MatterIntEnum):
            kAllowed = 0x00
            kIncreased = 0x01
            kReduced = 0x02
            kDisallowed = 0x03
            kBanned = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class MessagePriorityEnum(MatterIntEnum):
            kLow = 0x00
            kMedium = 0x01
            kHigh = 0x02
            kCritical = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

    class Bitmaps:
        class Feature(IntFlag):
            kReceivedConfirmation = 0x1
            kConfirmationResponse = 0x2
            kConfirmationReply = 0x4
            kProtectedMessages = 0x8

        class MessageControlBitmap(IntFlag):
            kConfirmationRequired = 0x1
            kResponseRequired = 0x2
            kReplyMessage = 0x4
            kMessageConfirmed = 0x8
            kMessageProtected = 0x10

    class Structs:
        @dataclass
        class MessageStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageID", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="priority", Tag=1, Type=Messages.Enums.MessagePriorityEnum),
                        ClusterObjectFieldDescriptor(Label="messageControl", Tag=2, Type=Messages.Bitmaps.MessageControlBitmap),
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="messageText", Tag=5, Type=str),
                        ClusterObjectFieldDescriptor(Label="responses", Tag=6, Type=typing.Optional[typing.List[typing.Optional[Messages.Structs.MessageResponseOptionStruct]]]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            messageID: 'bytes' = b""
            priority: 'Messages.Enums.MessagePriorityEnum' = 0
            messageControl: 'Messages.Bitmaps.MessageControlBitmap' = 0
            startTime: 'typing.Union[Nullable, uint]' = NullValue
            duration: 'typing.Union[Nullable, uint]' = NullValue
            messageText: 'str' = ""
            responses: 'typing.Optional[typing.List[typing.Optional[Messages.Structs.MessageResponseOptionStruct]]]' = None
            fabricIndex: 'uint' = 0

        @dataclass
        class MessageResponseOptionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageResponseID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="label", Tag=1, Type=str),
                    ])

            messageResponseID: 'uint' = 0
            label: 'str' = ""

    class Commands:
        @dataclass
        class PresentMessagesRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000097
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageID", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="priority", Tag=1, Type=Messages.Enums.MessagePriorityEnum),
                        ClusterObjectFieldDescriptor(Label="messageControl", Tag=2, Type=Messages.Bitmaps.MessageControlBitmap),
                        ClusterObjectFieldDescriptor(Label="startTime", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="messageText", Tag=5, Type=str),
                        ClusterObjectFieldDescriptor(Label="responses", Tag=6, Type=typing.Optional[typing.List[typing.Optional[Messages.Structs.MessageResponseOptionStruct]]]),
                    ])

            messageID: 'bytes' = b""
            priority: 'Messages.Enums.MessagePriorityEnum' = 0
            messageControl: 'Messages.Bitmaps.MessageControlBitmap' = 0
            startTime: 'typing.Union[Nullable, uint]' = NullValue
            duration: 'typing.Union[Nullable, uint]' = NullValue
            messageText: 'str' = ""
            responses: 'typing.Optional[typing.List[typing.Optional[Messages.Structs.MessageResponseOptionStruct]]]' = None

        @dataclass
        class CancelMessagesRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000097
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageIDs", Tag=0, Type=typing.List[typing.Optional[bytes]]),
                    ])

            messageIDs: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])

    class Attributes:
        @dataclass
        class Messages(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000097

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[Messages.Structs.MessageStruct]])

            value: 'typing.List[typing.Optional[Messages.Structs.MessageStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class ActiveMessageIDs(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000097

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[bytes]])

            value: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000097

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
                return 0x00000097

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
                return 0x00000097

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
                return 0x00000097

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
                return 0x00000097

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class MessageQueued(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000097

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageID", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            messageID: 'bytes' = b""
            fabricIndex: 'uint' = 0

        @dataclass
        class MessagePresented(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000097

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageID", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            messageID: 'bytes' = b""
            fabricIndex: 'uint' = 0

        @dataclass
        class MessageComplete(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000097

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="messageID", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="responseID", Tag=1, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="reply", Tag=2, Type=typing.Union[None, Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="futureMessagesPreference", Tag=3, Type=typing.Union[Nullable, Messages.Enums.FutureMessagePreferenceEnum]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            messageID: 'bytes' = b""
            responseID: 'typing.Union[None, Nullable, uint]' = None
            reply: 'typing.Union[None, Nullable, str]' = None
            futureMessagesPreference: 'typing.Union[Nullable, Messages.Enums.FutureMessagePreferenceEnum]' = NullValue
            fabricIndex: 'uint' = 0
