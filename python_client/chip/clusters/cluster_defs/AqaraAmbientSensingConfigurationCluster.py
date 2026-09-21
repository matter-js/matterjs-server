"""AqaraAmbientSensingConfigurationCluster cluster definition (auto-generated, DO NOT edit)."""

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
class AqaraAmbientSensingConfigurationCluster(Cluster):
    id: typing.ClassVar[int] = 0x115FFC0A

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="installMode", Tag=0x00000000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="supportedInstallModes", Tag=0x00000001, Type=typing.Optional[typing.List[uint]]),
                ClusterObjectFieldDescriptor(Label="sideInstall", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="supportedSideInstalls", Tag=0x00000003, Type=typing.Optional[typing.List[uint]]),
                ClusterObjectFieldDescriptor(Label="installHeight", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installHeightMin", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installHeightMax", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installStatus", Tag=0x00000007, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installAngle", Tag=0x00000008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="zones", Tag=0x00000010, Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct]]),
                ClusterObjectFieldDescriptor(Label="maxZones", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="entryExitRegionBitmask", Tag=0x00000012, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="interferenceRegionBitmask", Tag=0x00000013, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="edgeRegionBitmask", Tag=0x00000014, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="learningReportingTimeout", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="enableHumanCountDetection", Tag=0x00000023, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiHighPrecisionRecognition", Tag=0x00000029, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiAdaptiveSensitivity", Tag=0x0000002A, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiEntryExitRegionRecognition", Tag=0x0000002B, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiInterferenceSourceRecognition", Tag=0x0000002C, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="coordinateReverse", Tag=0x0000002D, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="detectionDirection", Tag=0x0000002E, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="proximityDistanceLevel", Tag=0x0000002F, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    installMode: typing.Optional[uint] = None
    supportedInstallModes: typing.Optional[typing.List[uint]] = None
    sideInstall: typing.Optional[uint] = None
    supportedSideInstalls: typing.Optional[typing.List[uint]] = None
    installHeight: typing.Optional[uint] = None
    installHeightMin: typing.Optional[uint] = None
    installHeightMax: typing.Optional[uint] = None
    installStatus: typing.Optional[uint] = None
    installAngle: typing.Optional[uint] = None
    zones: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct]] = None
    maxZones: typing.Optional[uint] = None
    entryExitRegionBitmask: typing.Optional[bytes] = None
    interferenceRegionBitmask: typing.Optional[bytes] = None
    edgeRegionBitmask: typing.Optional[bytes] = None
    learningReportingTimeout: typing.Optional[uint] = None
    enableHumanCountDetection: typing.Optional[bool] = None
    enableAiHighPrecisionRecognition: typing.Optional[bool] = None
    enableAiAdaptiveSensitivity: typing.Optional[bool] = None
    enableAiEntryExitRegionRecognition: typing.Optional[bool] = None
    enableAiInterferenceSourceRecognition: typing.Optional[bool] = None
    coordinateReverse: typing.Optional[uint] = None
    detectionDirection: typing.Optional[uint] = None
    proximityDistanceLevel: typing.Optional[uint] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Structs:
        @dataclass
        class AqaraZoneStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="zoneType", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="cells", Tag=2, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="enabled", Tag=3, Type=bool),
                    ])

            zoneID: uint = 0
            zoneType: uint = 0
            cells: bytes = b""
            enabled: bool = False

    class Commands:
        @dataclass
        class SubscribeAutoInterferenceSourceRecognitionData(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class SubscribeAutoEdgeRecognitionData(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeout", Tag=0, Type=uint),
                    ])

            timeout: uint = 0

        @dataclass
        class SubscribeAiEntryExitRegionRecognitionData(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class EnableAiSpaceBackgroundLearning(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


        @dataclass
        class AppendZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'AppendZoneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct),
                    ])

            zone: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct = field(default_factory=lambda: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct())

        @dataclass
        class UpdateZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'UpdateZoneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct),
                    ])

            zone: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct = field(default_factory=lambda: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct())

        @dataclass
        class RemoveZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'RemoveZoneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                    ])

            zoneID: uint = 0

        @dataclass
        class SetZones(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SetZonesResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zones", Tag=0, Type=typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct]),
                    ])

            zones: typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct] = field(default_factory=lambda: [])

        @dataclass
        class AppendZoneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=uint),
                    ])

            status: uint = 0

        @dataclass
        class UpdateZoneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=uint),
                    ])

            status: uint = 0

        @dataclass
        class RemoveZoneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=uint),
                    ])

            status: uint = 0

        @dataclass
        class SetZonesResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x0000000B
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
        class InstallMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class SupportedInstallModes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[uint]])

            value: typing.Optional[typing.List[uint]] = None

        @dataclass
        class SideInstall(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class SupportedSideInstalls(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[uint]])

            value: typing.Optional[typing.List[uint]] = None

        @dataclass
        class InstallHeight(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class InstallHeightMin(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class InstallHeightMax(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class InstallStatus(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class InstallAngle(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Zones(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct]])

            value: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneStruct]] = None

        @dataclass
        class MaxZones(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class EntryExitRegionBitmask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: typing.Optional[bytes] = None

        @dataclass
        class InterferenceRegionBitmask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: typing.Optional[bytes] = None

        @dataclass
        class EdgeRegionBitmask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: typing.Optional[bytes] = None

        @dataclass
        class LearningReportingTimeout(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class EnableHumanCountDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000023

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableAiHighPrecisionRecognition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000029

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableAiAdaptiveSensitivity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableAiEntryExitRegionRecognition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableAiInterferenceSourceRecognition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class CoordinateReverse(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class DetectionDirection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class ProximityDistanceLevel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

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
                return 0x115FFC0A

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
                return 0x115FFC0A

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
                return 0x115FFC0A

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
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
