"""EveCluster cluster definition (auto-generated, DO NOT edit)."""

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
class EveCluster(Cluster):
    id: typing.ClassVar[int] = 0x130AFC01

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="getConfig", Tag=0x130A0000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="setConfig", Tag=0x130A0001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="loggingMetadata", Tag=0x130A0002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="loggingData", Tag=0x130A0003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="timesOpened", Tag=0x130A0006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="lastEventTime", Tag=0x130A0007, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="watt", Tag=0x130A000A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="wattAccumulated", Tag=0x130A000B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="statusFault", Tag=0x130A000C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="wattAccumulatedControlPoint", Tag=0x130A000E, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="voltage", Tag=0x130A0008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="current", Tag=0x130A0009, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="obstructionDetected", Tag=0x130A0010, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="childLock", Tag=0x130A0011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rloc16", Tag=0x130A0012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="altitude", Tag=0x130A0013, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="pressure", Tag=0x130A0014, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="weatherTrend", Tag=0x130A0015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="valvePosition", Tag=0x130A0018, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="motionSensitivity", Tag=0x130A000D, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    getConfig: 'typing.Optional[uint]' = None
    setConfig: 'typing.Optional[uint]' = None
    loggingMetadata: 'typing.Optional[uint]' = None
    loggingData: 'typing.Optional[uint]' = None
    timesOpened: 'typing.Optional[uint]' = None
    lastEventTime: 'typing.Optional[uint]' = None
    watt: 'typing.Optional[uint]' = None
    wattAccumulated: 'typing.Optional[uint]' = None
    statusFault: 'typing.Optional[uint]' = None
    wattAccumulatedControlPoint: 'typing.Optional[uint]' = None
    voltage: 'typing.Optional[uint]' = None
    current: 'typing.Optional[uint]' = None
    obstructionDetected: 'typing.Optional[uint]' = None
    childLock: 'typing.Optional[uint]' = None
    rloc16: 'typing.Optional[uint]' = None
    altitude: 'typing.Optional[uint]' = None
    pressure: 'typing.Optional[uint]' = None
    weatherTrend: 'typing.Optional[uint]' = None
    valvePosition: 'typing.Optional[uint]' = None
    motionSensitivity: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Attributes:
        @dataclass
        class getConfig(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class setConfig(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class loggingMetadata(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class loggingData(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class timesOpened(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class lastEventTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class watt(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class wattAccumulated(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class statusFault(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class wattAccumulatedControlPoint(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A000E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class voltage(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class current(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class obstructionDetected(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class childLock(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class rloc16(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class altitude(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class pressure(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class weatherTrend(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class valvePosition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A0018

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class motionSensitivity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x130A000D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x130AFC01

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
                return 0x130AFC01

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
                return 0x130AFC01

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
                return 0x130AFC01

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
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

