"""OperationalState cluster definition (auto-generated, DO NOT edit)."""

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
class OperationalState(Cluster):
    id: typing.ClassVar[int] = 0x00000060

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="phaseList", Tag=0x00000000, Type=typing.Union[Nullable, typing.List[typing.Optional[str]]]),
                ClusterObjectFieldDescriptor(Label="currentPhase", Tag=0x00000001, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="countdownTime", Tag=0x00000002, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="operationalStateList", Tag=0x00000003, Type=typing.List[typing.Optional[OperationalState.Structs.OperationalStateStruct]]),
                ClusterObjectFieldDescriptor(Label="operationalState", Tag=0x00000004, Type=OperationalState.Enums.OperationalStateEnum),
                ClusterObjectFieldDescriptor(Label="operationalError", Tag=0x00000005, Type=OperationalState.Structs.ErrorStateStruct),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    phaseList: 'typing.Union[Nullable, typing.List[typing.Optional[str]]]' = NullValue
    currentPhase: 'typing.Union[Nullable, uint]' = NullValue
    countdownTime: 'typing.Union[None, Nullable, uint]' = None
    operationalStateList: 'typing.List[typing.Optional[OperationalState.Structs.OperationalStateStruct]]' = field(default_factory=lambda: [])
    operationalState: 'OperationalState.Enums.OperationalStateEnum' = 0
    operationalError: 'OperationalState.Structs.ErrorStateStruct' = field(default_factory=lambda: OperationalState.Structs.ErrorStateStruct())
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class OperationalStateEnum(MatterIntEnum):
            kStopped = 0x00
            kRunning = 0x01
            kPaused = 0x02
            kError = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ErrorStateEnum(MatterIntEnum):
            kNoError = 0x00
            kUnableToStartOrResume = 0x01
            kUnableToCompleteOperation = 0x02
            kCommandInvalidInState = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4


    class Structs:
        @dataclass
        class OperationalStateStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operationalStateId", Tag=0, Type=OperationalState.Enums.OperationalStateEnum),
                        ClusterObjectFieldDescriptor(Label="operationalStateLabel", Tag=1, Type=typing.Optional[str]),
                    ])

            operationalStateId: 'OperationalState.Enums.OperationalStateEnum' = 0
            operationalStateLabel: 'typing.Optional[str]' = None

        @dataclass
        class ErrorStateStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorStateId", Tag=0, Type=OperationalState.Enums.ErrorStateEnum),
                        ClusterObjectFieldDescriptor(Label="errorStateLabel", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="errorStateDetails", Tag=2, Type=typing.Optional[str]),
                    ])

            errorStateId: 'OperationalState.Enums.ErrorStateEnum' = 0
            errorStateLabel: 'typing.Optional[str]' = None
            errorStateDetails: 'typing.Optional[str]' = None


    class Commands:
        @dataclass
        class Pause(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000060
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'OperationalCommandResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Stop(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000060
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'OperationalCommandResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Start(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000060
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'OperationalCommandResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class Resume(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000060
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'OperationalCommandResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class OperationalCommandResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000060
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="commandResponseState", Tag=0, Type=OperationalState.Structs.ErrorStateStruct),
                    ])

            commandResponseState: 'OperationalState.Structs.ErrorStateStruct' = field(default_factory=lambda: OperationalState.Structs.ErrorStateStruct())


    class Attributes:
        @dataclass
        class PhaseList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, typing.List[typing.Optional[str]]])

            value: 'typing.Union[Nullable, typing.List[typing.Optional[str]]]' = NullValue

        @dataclass
        class CurrentPhase(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class CountdownTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class OperationalStateList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[OperationalState.Structs.OperationalStateStruct]])

            value: 'typing.List[typing.Optional[OperationalState.Structs.OperationalStateStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class OperationalState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OperationalState.Enums.OperationalStateEnum)

            value: 'OperationalState.Enums.OperationalStateEnum' = 0

        @dataclass
        class OperationalError(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=OperationalState.Structs.ErrorStateStruct)

            value: 'OperationalState.Structs.ErrorStateStruct' = field(default_factory=lambda: OperationalState.Structs.ErrorStateStruct())

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

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
                return 0x00000060

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
                return 0x00000060

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
                return 0x00000060

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
                return 0x00000060

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class OperationalError(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorState", Tag=0, Type=OperationalState.Structs.ErrorStateStruct),
                    ])

            errorState: 'OperationalState.Structs.ErrorStateStruct' = field(default_factory=lambda: OperationalState.Structs.ErrorStateStruct())

        @dataclass
        class OperationCompletion(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000060

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="completionErrorCode", Tag=0, Type=Globals.Enums.enum8),
                        ClusterObjectFieldDescriptor(Label="totalOperationalTime", Tag=1, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="pausedTime", Tag=2, Type=typing.Union[None, Nullable, uint]),
                    ])

            completionErrorCode: 'Globals.Enums.enum8' = 0
            totalOperationalTime: 'typing.Union[None, Nullable, uint]' = None
            pausedTime: 'typing.Union[None, Nullable, uint]' = None

