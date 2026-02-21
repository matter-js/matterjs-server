"""Actions cluster definition (auto-generated, DO NOT edit)."""

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
class Actions(Cluster):
    id: typing.ClassVar[int] = 0x00000025

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="actionList", Tag=0x00000000, Type=typing.List[typing.Optional[Actions.Structs.ActionStruct]]),
                ClusterObjectFieldDescriptor(Label="endpointLists", Tag=0x00000001, Type=typing.List[typing.Optional[Actions.Structs.EndpointListStruct]]),
                ClusterObjectFieldDescriptor(Label="setupUrl", Tag=0x00000002, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    actionList: 'typing.List[typing.Optional[Actions.Structs.ActionStruct]]' = field(default_factory=lambda: [])
    endpointLists: 'typing.List[typing.Optional[Actions.Structs.EndpointListStruct]]' = field(default_factory=lambda: [])
    setupUrl: 'typing.Optional[str]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class ActionTypeEnum(MatterIntEnum):
            kOther = 0x00
            kScene = 0x01
            kSequence = 0x02
            kAutomation = 0x03
            kException = 0x04
            kNotification = 0x05
            kAlarm = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

        class ActionStateEnum(MatterIntEnum):
            kInactive = 0x00
            kActive = 0x01
            kPaused = 0x02
            kDisabled = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ActionErrorEnum(MatterIntEnum):
            kUnknown = 0x00
            kInterrupted = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class EndpointListTypeEnum(MatterIntEnum):
            kOther = 0x00
            kRoom = 0x01
            kZone = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

    class Bitmaps:
        class CommandBits(IntFlag):
            kInstantAction = 0x1
            kInstantActionWithTransition = 0x2
            kStartAction = 0x4
            kStartActionWithDuration = 0x8
            kStopAction = 0x10
            kPauseAction = 0x20
            kPauseActionWithDuration = 0x40
            kResumeAction = 0x80
            kEnableAction = 0x100
            kEnableActionWithDuration = 0x200
            kDisableAction = 0x400
            kDisableActionWithDuration = 0x800

    class Structs:
        @dataclass
        class ActionStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="name", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="type", Tag=2, Type=Actions.Enums.ActionTypeEnum),
                        ClusterObjectFieldDescriptor(Label="endpointListId", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="supportedCommands", Tag=4, Type=Actions.Bitmaps.CommandBits),
                        ClusterObjectFieldDescriptor(Label="state", Tag=5, Type=Actions.Enums.ActionStateEnum),
                    ])

            actionId: 'uint' = 0
            name: 'str' = ""
            type: 'Actions.Enums.ActionTypeEnum' = 0
            endpointListId: 'uint' = 0
            supportedCommands: 'Actions.Bitmaps.CommandBits' = 0
            state: 'Actions.Enums.ActionStateEnum' = 0

        @dataclass
        class EndpointListStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="endpointListId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="name", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="type", Tag=2, Type=Actions.Enums.EndpointListTypeEnum),
                        ClusterObjectFieldDescriptor(Label="endpoints", Tag=3, Type=typing.List[typing.Optional[uint]]),
                    ])

            endpointListId: 'uint' = 0
            name: 'str' = ""
            type: 'Actions.Enums.EndpointListTypeEnum' = 0
            endpoints: 'typing.List[typing.Optional[uint]]' = field(default_factory=lambda: [])

    class Commands:
        @dataclass
        class InstantAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class InstantActionWithTransition(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None
            transitionTime: 'uint' = 0

        @dataclass
        class StartAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class StartActionWithDuration(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=2, Type=uint),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None
            duration: 'uint' = 0

        @dataclass
        class StopAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class PauseAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class PauseActionWithDuration(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=2, Type=uint),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None
            duration: 'uint' = 0

        @dataclass
        class ResumeAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class EnableAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class EnableActionWithDuration(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=2, Type=uint),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None
            duration: 'uint' = 0

        @dataclass
        class DisableAction(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None

        @dataclass
        class DisableActionWithDuration(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000025
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="duration", Tag=2, Type=uint),
                    ])

            actionId: 'uint' = 0
            invokeId: 'typing.Optional[uint]' = None
            duration: 'uint' = 0

    class Attributes:
        @dataclass
        class ActionList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[Actions.Structs.ActionStruct]])

            value: 'typing.List[typing.Optional[Actions.Structs.ActionStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class EndpointLists(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[Actions.Structs.EndpointListStruct]])

            value: 'typing.List[typing.Optional[Actions.Structs.EndpointListStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class SetupUrl(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000025

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
                return 0x00000025

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
                return 0x00000025

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
                return 0x00000025

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
                return 0x00000025

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
                return 0x00000025

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="newState", Tag=2, Type=Actions.Enums.ActionStateEnum),
                    ])

            actionId: 'uint' = 0
            invokeId: 'uint' = 0
            newState: 'Actions.Enums.ActionStateEnum' = 0

        @dataclass
        class ActionFailed(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="actionId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="invokeId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="newState", Tag=2, Type=Actions.Enums.ActionStateEnum),
                        ClusterObjectFieldDescriptor(Label="error", Tag=3, Type=Actions.Enums.ActionErrorEnum),
                    ])

            actionId: 'uint' = 0
            invokeId: 'uint' = 0
            newState: 'Actions.Enums.ActionStateEnum' = 0
            error: 'Actions.Enums.ActionErrorEnum' = 0
