"""AmbientContextSensing cluster definition (auto-generated, DO NOT edit)."""

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
from .ModeSelect import ModeSelect


@dataclass
class AmbientContextSensing(Cluster):
    id: typing.ClassVar[int] = 0x00000431

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="humanActivityDetected", Tag=0x00000000, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="objectIdentified", Tag=0x00000001, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="audioContextDetected", Tag=0x00000002, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="ambientContextType", Tag=0x00000003, Type=typing.Optional[typing.List[AmbientContextSensing.Structs.AmbientContextTypeStruct]]),
                ClusterObjectFieldDescriptor(Label="ambientContextTypeSupported", Tag=0x00000004, Type=typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]]),
                ClusterObjectFieldDescriptor(Label="objectCountReached", Tag=0x00000005, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="objectCountConfig", Tag=0x00000006, Type=typing.Optional[AmbientContextSensing.Structs.ObjectCountConfigStruct]),
                ClusterObjectFieldDescriptor(Label="objectCount", Tag=0x00000007, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="simultaneousDetectionLimit", Tag=0x00000008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="holdTime", Tag=0x00000009, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="holdTimeLimits", Tag=0x0000000A, Type=typing.Optional[AmbientContextSensing.Structs.HoldTimeLimitsStruct]),
                ClusterObjectFieldDescriptor(Label="predictedActivity", Tag=0x0000000B, Type=typing.Optional[typing.List[AmbientContextSensing.Structs.PredictedActivityStruct]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    humanActivityDetected: typing.Optional[bool] = None
    objectIdentified: typing.Optional[bool] = None
    audioContextDetected: typing.Optional[bool] = None
    ambientContextType: typing.Optional[typing.List[AmbientContextSensing.Structs.AmbientContextTypeStruct]] = None
    ambientContextTypeSupported: typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]] = None
    objectCountReached: typing.Optional[bool] = None
    objectCountConfig: typing.Optional[AmbientContextSensing.Structs.ObjectCountConfigStruct] = None
    objectCount: typing.Optional[uint] = None
    simultaneousDetectionLimit: typing.Optional[uint] = None
    holdTime: typing.Optional[uint] = None
    holdTimeLimits: typing.Optional[AmbientContextSensing.Structs.HoldTimeLimitsStruct] = None
    predictedActivity: typing.Optional[typing.List[AmbientContextSensing.Structs.PredictedActivityStruct]] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Bitmaps:
        class Feature(IntFlag):
            kHumanActivity = 0x1
            kObjectCounting = 0x2
            kObjectIdentification = 0x4
            kSoundIdentification = 0x8
            kPredictedActivity = 0x10

    class Structs:
        @dataclass
        class HoldTimeLimitsStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="holdTimeMin", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="holdTimeMax", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="holdTimeDefault", Tag=2, Type=typing.Optional[uint]),
                    ])

            holdTimeMin: typing.Optional[uint] = None
            holdTimeMax: typing.Optional[uint] = None
            holdTimeDefault: typing.Optional[uint] = None

        @dataclass
        class AmbientContextTypeStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ambientContextSensed", Tag=0, Type=typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]]),
                    ])

            ambientContextSensed: typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]] = None

        @dataclass
        class ObjectCountConfigStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="countingObject", Tag=0, Type=typing.Optional[ModeSelect.Structs.SemanticTagStruct]),
                        ClusterObjectFieldDescriptor(Label="objectCountThreshold", Tag=1, Type=typing.Optional[uint]),
                    ])

            countingObject: typing.Optional[ModeSelect.Structs.SemanticTagStruct] = None
            objectCountThreshold: typing.Optional[uint] = None

        @dataclass
        class PredictedActivityStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="startTimestamp", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endTimestamp", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="ambientContextType", Tag=2, Type=typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]]),
                        ClusterObjectFieldDescriptor(Label="crowdDetected", Tag=3, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="crowdCount", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="confidence", Tag=5, Type=typing.Optional[uint]),
                    ])

            startTimestamp: typing.Optional[uint] = None
            endTimestamp: typing.Optional[uint] = None
            ambientContextType: typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]] = None
            crowdDetected: typing.Optional[bool] = None
            crowdCount: typing.Optional[uint] = None
            confidence: typing.Optional[uint] = None

    class Attributes:
        @dataclass
        class HumanActivityDetected(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class ObjectIdentified(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class AudioContextDetected(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class AmbientContextType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AmbientContextSensing.Structs.AmbientContextTypeStruct]])

            value: typing.Optional[typing.List[AmbientContextSensing.Structs.AmbientContextTypeStruct]] = None

        @dataclass
        class AmbientContextTypeSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]])

            value: typing.Optional[typing.List[ModeSelect.Structs.SemanticTagStruct]] = None

        @dataclass
        class ObjectCountReached(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class ObjectCountConfig(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AmbientContextSensing.Structs.ObjectCountConfigStruct])

            value: typing.Optional[AmbientContextSensing.Structs.ObjectCountConfigStruct] = None

        @dataclass
        class ObjectCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class SimultaneousDetectionLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class HoldTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class HoldTimeLimits(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AmbientContextSensing.Structs.HoldTimeLimitsStruct])

            value: typing.Optional[AmbientContextSensing.Structs.HoldTimeLimitsStruct] = None

        @dataclass
        class PredictedActivity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AmbientContextSensing.Structs.PredictedActivityStruct]])

            value: typing.Optional[typing.List[AmbientContextSensing.Structs.PredictedActivityStruct]] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

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
                return 0x00000431

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
                return 0x00000431

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
                return 0x00000431

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
                return 0x00000431

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
                return 0x00000431

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

    class Events:
        @dataclass
        class AmbientContextDetectStarted(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ambientContextDetected", Tag=0, Type=typing.Optional[AmbientContextSensing.Structs.AmbientContextTypeStruct]),
                        ClusterObjectFieldDescriptor(Label="objectCountReached", Tag=1, Type=typing.Optional[bool]),
                        ClusterObjectFieldDescriptor(Label="objectCount", Tag=2, Type=typing.Optional[uint]),
                    ])

            ambientContextDetected: typing.Optional[AmbientContextSensing.Structs.AmbientContextTypeStruct] = None
            objectCountReached: typing.Optional[bool] = None
            objectCount: typing.Optional[uint] = None

        @dataclass
        class AmbientContextDetectEnded(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000431

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="eventStartTime", Tag=0, Type=typing.Optional[uint]),
                    ])

            eventStartTime: typing.Optional[uint] = None
