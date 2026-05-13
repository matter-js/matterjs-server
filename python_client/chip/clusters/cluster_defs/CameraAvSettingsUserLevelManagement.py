"""CameraAvSettingsUserLevelManagement cluster definition (auto-generated, DO NOT edit)."""

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
class CameraAvSettingsUserLevelManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000552

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="mptzPosition", Tag=0x00000000, Type=typing.Optional[CameraAvSettingsUserLevelManagement.Structs.MPTZStruct]),
                ClusterObjectFieldDescriptor(Label="maxPresets", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="mptzPresets", Tag=0x00000002, Type=typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.MPTZPresetStruct]]),
                ClusterObjectFieldDescriptor(Label="dptzStreams", Tag=0x00000003, Type=typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.DPTZStruct]]),
                ClusterObjectFieldDescriptor(Label="zoomMax", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="tiltMin", Tag=0x00000005, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="tiltMax", Tag=0x00000006, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="panMin", Tag=0x00000007, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="panMax", Tag=0x00000008, Type=typing.Optional[int]),
                ClusterObjectFieldDescriptor(Label="movementState", Tag=0x00000009, Type=typing.Optional[CameraAvSettingsUserLevelManagement.Enums.PhysicalMovementEnum]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="eventList", Tag=0x0000FFFA, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    mptzPosition: typing.Optional[CameraAvSettingsUserLevelManagement.Structs.MPTZStruct] = None
    maxPresets: typing.Optional[uint] = None
    mptzPresets: typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.MPTZPresetStruct]] = None
    dptzStreams: typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.DPTZStruct]] = None
    zoomMax: typing.Optional[uint] = None
    tiltMin: typing.Optional[int] = None
    tiltMax: typing.Optional[int] = None
    panMin: typing.Optional[int] = None
    panMax: typing.Optional[int] = None
    movementState: typing.Optional[CameraAvSettingsUserLevelManagement.Enums.PhysicalMovementEnum] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    eventList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class PhysicalMovementEnum(MatterIntEnum):
            kIdle = 0x00
            kMoving = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

    class Bitmaps:
        class Feature(IntFlag):
            kDigitalPtz = 0x1
            kMechanicalPan = 0x2
            kMechanicalTilt = 0x4
            kMechanicalZoom = 0x8
            kMechanicalPresets = 0x10

    class Structs:
        @dataclass
        class DPTZStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="viewport", Tag=1, Type=Globals.Structs.ViewportStruct),
                    ])

            videoStreamID: uint = 0
            viewport: Globals.Structs.ViewportStruct = field(default_factory=lambda: Globals.Structs.ViewportStruct())

        @dataclass
        class MPTZStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pan", Tag=0, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="tilt", Tag=1, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="zoom", Tag=2, Type=typing.Optional[uint]),
                    ])

            pan: typing.Optional[int] = None
            tilt: typing.Optional[int] = None
            zoom: typing.Optional[uint] = None

        @dataclass
        class MPTZPresetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="name", Tag=1, Type=str),
                        ClusterObjectFieldDescriptor(Label="settings", Tag=2, Type=CameraAvSettingsUserLevelManagement.Structs.MPTZStruct),
                    ])

            presetID: uint = 0
            name: str = ""
            settings: CameraAvSettingsUserLevelManagement.Structs.MPTZStruct = field(default_factory=lambda: CameraAvSettingsUserLevelManagement.Structs.MPTZStruct())

    class Commands:
        @dataclass
        class MptzSetPosition(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pan", Tag=0, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="tilt", Tag=1, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="zoom", Tag=2, Type=typing.Optional[uint]),
                    ])

            pan: typing.Optional[int] = None
            tilt: typing.Optional[int] = None
            zoom: typing.Optional[uint] = None

        @dataclass
        class MptzRelativeMove(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="panDelta", Tag=0, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="tiltDelta", Tag=1, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="zoomDelta", Tag=2, Type=typing.Optional[int]),
                    ])

            panDelta: typing.Optional[int] = None
            tiltDelta: typing.Optional[int] = None
            zoomDelta: typing.Optional[int] = None

        @dataclass
        class MptzMoveToPreset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetID", Tag=0, Type=uint),
                    ])

            presetID: uint = 0

        @dataclass
        class MptzSavePreset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetID", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="name", Tag=1, Type=str),
                    ])

            presetID: typing.Optional[uint] = None
            name: str = ""

        @dataclass
        class MptzRemovePreset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="presetID", Tag=0, Type=uint),
                    ])

            presetID: uint = 0

        @dataclass
        class DptzSetViewport(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="viewport", Tag=1, Type=Globals.Structs.ViewportStruct),
                    ])

            videoStreamID: uint = 0
            viewport: Globals.Structs.ViewportStruct = field(default_factory=lambda: Globals.Structs.ViewportStruct())

        @dataclass
        class DptzRelativeMove(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000552
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="videoStreamID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="deltaX", Tag=1, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="deltaY", Tag=2, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="zoomDelta", Tag=3, Type=typing.Optional[int]),
                    ])

            videoStreamID: uint = 0
            deltaX: typing.Optional[int] = None
            deltaY: typing.Optional[int] = None
            zoomDelta: typing.Optional[int] = None

    class Attributes:
        @dataclass
        class MptzPosition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[CameraAvSettingsUserLevelManagement.Structs.MPTZStruct])

            value: typing.Optional[CameraAvSettingsUserLevelManagement.Structs.MPTZStruct] = None

        @dataclass
        class MaxPresets(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MptzPresets(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.MPTZPresetStruct]])

            value: typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.MPTZPresetStruct]] = None

        @dataclass
        class DptzStreams(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.DPTZStruct]])

            value: typing.Optional[typing.List[CameraAvSettingsUserLevelManagement.Structs.DPTZStruct]] = None

        @dataclass
        class ZoomMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class TiltMin(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class TiltMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class PanMin(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class PanMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[int])

            value: typing.Optional[int] = None

        @dataclass
        class MovementState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[CameraAvSettingsUserLevelManagement.Enums.PhysicalMovementEnum])

            value: typing.Optional[CameraAvSettingsUserLevelManagement.Enums.PhysicalMovementEnum] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000552

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
                return 0x00000552

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
                return 0x00000552

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
                return 0x00000552

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
                return 0x00000552

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
                return 0x00000552

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
