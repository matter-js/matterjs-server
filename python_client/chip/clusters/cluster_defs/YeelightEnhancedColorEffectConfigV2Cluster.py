"""YeelightEnhancedColorEffectConfigV2Cluster cluster definition (auto-generated, DO NOT edit)."""

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
class YeelightEnhancedColorEffectConfigV2Cluster(Cluster):
    id: typing.ClassVar[int] = 0x1312FC05

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="effectID", Tag=0x13120000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="customID", Tag=0x13120001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    effectID: typing.Optional[uint] = None
    customID: typing.Optional[uint] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Structs:
        @dataclass
        class YeelightEffectStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="effectID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="customID", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="effectParams", Tag=2, Type=typing.Optional[typing.List[YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectConfig]]),
                    ])

            effectID: uint = 0
            customID: typing.Optional[uint] = None
            effectParams: typing.Optional[typing.List[YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectConfig]] = None

        @dataclass
        class YeelightEffectConfig(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="start", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="end", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="onoff", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="mode", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="intensity", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="speed", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="color", Tag=6, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="data", Tag=7, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="mixer", Tag=8, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="direction", Tag=9, Type=typing.Optional[uint]),
                    ])

            start: typing.Optional[uint] = None
            end: typing.Optional[uint] = None
            onoff: typing.Optional[uint] = None
            mode: uint = 0
            intensity: typing.Optional[uint] = None
            speed: typing.Optional[uint] = None
            color: typing.Optional[typing.List[uint]] = None
            data: typing.Optional[bytes] = None
            mixer: typing.Optional[uint] = None
            direction: typing.Optional[uint] = None

        @dataclass
        class YeelightEffectSnapshot(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="effectID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="customID", Tag=1, Type=uint),
                    ])

            effectID: uint = 0
            customID: uint = 0

    class Commands:
        @dataclass
        class SetEffect(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="apply", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="effect", Tag=1, Type=YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct),
                    ])

            apply: typing.Optional[uint] = None
            effect: YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct = field(default_factory=lambda: YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct())

        @dataclass
        class SetRate(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rate", Tag=0, Type=uint),
                    ])

            rate: uint = 0

        @dataclass
        class SetMixer(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mixer", Tag=0, Type=uint),
                    ])

            mixer: uint = 0

        @dataclass
        class SetData(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="data", Tag=0, Type=bytes),
                    ])

            data: bytes = b""

        @dataclass
        class SetDirection(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="direction", Tag=0, Type=uint),
                    ])

            direction: uint = 0

        @dataclass
        class ResetEffect(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class UpdatePersistEffectList(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x1312000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="index", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="effect", Tag=1, Type=YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct),
                    ])

            index: uint = 0
            effect: YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct = field(default_factory=lambda: YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct())

        @dataclass
        class GetPersistEffectList(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x1312000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetPersistEffectListResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class GetCurrentEffect(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x1312000D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetCurrentEffectResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class SetPresetsEffect(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x1312000E
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="apply", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="effectID", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="onoff", Tag=2, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="intensity", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="rate", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="color", Tag=5, Type=typing.Optional[typing.List[uint]]),
                        ClusterObjectFieldDescriptor(Label="direction", Tag=6, Type=typing.Optional[uint]),
                    ])

            apply: typing.Optional[uint] = None
            effectID: uint = 0
            onoff: typing.Optional[typing.List[uint]] = None
            intensity: typing.Optional[uint] = None
            rate: typing.Optional[uint] = None
            color: typing.Optional[typing.List[uint]] = None
            direction: typing.Optional[uint] = None

        @dataclass
        class SendGifDataFragment(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x1312000F
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SendGifDataFragmentResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="data", Tag=0, Type=bytes),
                    ])

            data: bytes = b""

        @dataclass
        class GetPersistEffectListResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="effectList", Tag=0, Type=typing.List[YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectSnapshot]),
                    ])

            effectList: typing.List[YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectSnapshot] = field(default_factory=lambda: [])

        @dataclass
        class GetCurrentEffectResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="effect", Tag=0, Type=YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct),
                    ])

            effect: YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct = field(default_factory=lambda: YeelightEnhancedColorEffectConfigV2Cluster.Structs.YeelightEffectStruct())

        @dataclass
        class SendGifDataFragmentResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x1312FC05
            command_id: typing.ClassVar[int] = 0x13120004
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=uint),
                    ])

            status: uint = 0

    class Attributes:
        @dataclass
        class EffectID(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x1312FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x13120000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class CustomID(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x1312FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x13120001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x1312FC05

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
                return 0x1312FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x1312FC05

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
                return 0x1312FC05

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
                return 0x1312FC05

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
