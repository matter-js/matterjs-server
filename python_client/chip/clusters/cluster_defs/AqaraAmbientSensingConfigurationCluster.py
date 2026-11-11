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
                ClusterObjectFieldDescriptor(Label="installModeSelection", Tag=0x00000000, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum]),
                ClusterObjectFieldDescriptor(Label="supportedInstallModes", Tag=0x00000001, Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum]]),
                ClusterObjectFieldDescriptor(Label="sideInstallSelection", Tag=0x00000002, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum]),
                ClusterObjectFieldDescriptor(Label="supportedSideInstallModes", Tag=0x00000003, Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum]]),
                ClusterObjectFieldDescriptor(Label="installHeightSetting", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minInstallHeight", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxInstallHeight", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="installStatus", Tag=0x00000007, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallStatusEnum]),
                ClusterObjectFieldDescriptor(Label="installAngle", Tag=0x00000008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="zones", Tag=0x00000010, Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct]]),
                ClusterObjectFieldDescriptor(Label="maxDetectionZones", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="entryExitRegionBitmask", Tag=0x00000012, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="interferenceRegionBitmask", Tag=0x00000013, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="edgeRegionBitmask", Tag=0x00000014, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="interferenceSourceRecognitionReportingTimeout", Tag=0x00000015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="aiSpaceBackgroundLearningReportingTimeout", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="enablePostureRecognition", Tag=0x00000021, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableLargeMotionRecognition", Tag=0x00000022, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableHumanCountDetection", Tag=0x00000023, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableVisitorCountDetection", Tag=0x00000024, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableWalkingDistanceDetection", Tag=0x00000025, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableTrafficFlowDetection", Tag=0x00000026, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableActivityDetection", Tag=0x00000027, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAverageOccupancyDurationDetection", Tag=0x00000028, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiHighPrecisionRecognition", Tag=0x00000029, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiAdaptiveSensitivity", Tag=0x0000002A, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiEntryExitRegionRecognition", Tag=0x0000002B, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableAiInterferenceSourceRecognition", Tag=0x0000002C, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="coordinateReverseSetting", Tag=0x0000002D, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.CoordinateReverseEnum]),
                ClusterObjectFieldDescriptor(Label="detectionDirectionSetting", Tag=0x0000002E, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.DetectionDirectionEnum]),
                ClusterObjectFieldDescriptor(Label="proximityDistanceLevelSetting", Tag=0x0000002F, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.ProximityDistanceLevelEnum]),
                ClusterObjectFieldDescriptor(Label="enableFallDetection", Tag=0x00000030, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="fallMaskBitmask", Tag=0x00000031, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="fallDetectionSensitivity", Tag=0x00000032, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensitivityEnum]),
                ClusterObjectFieldDescriptor(Label="bedHeightSetting", Tag=0x00000033, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minBedHeight", Tag=0x00000034, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxBedHeight", Tag=0x00000035, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="fallDelayTimeSetting", Tag=0x00000036, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minFallDelayTime", Tag=0x00000037, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxFallDelayTime", Tag=0x00000038, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="detectionRangeBitmask", Tag=0x00000040, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="minDetectionRange", Tag=0x00000041, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxDetectionRange", Tag=0x00000042, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="detectionRangeStep", Tag=0x00000043, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="sensingMode", Tag=0x00000050, Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum]),
                ClusterObjectFieldDescriptor(Label="supportedSensingModes", Tag=0x00000051, Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum]]),
                ClusterObjectFieldDescriptor(Label="pirDetectionTimeSetting", Tag=0x00000052, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minPIRDetectionTime", Tag=0x00000053, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxPIRDetectionTime", Tag=0x00000054, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    installModeSelection: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum] = None
    supportedInstallModes: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum]] = None
    sideInstallSelection: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum] = None
    supportedSideInstallModes: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum]] = None
    installHeightSetting: typing.Optional[uint] = None
    minInstallHeight: typing.Optional[uint] = None
    maxInstallHeight: typing.Optional[uint] = None
    installStatus: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallStatusEnum] = None
    installAngle: typing.Optional[uint] = None
    zones: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct]] = None
    maxDetectionZones: typing.Optional[uint] = None
    entryExitRegionBitmask: typing.Union[None, Nullable, bytes] = None
    interferenceRegionBitmask: typing.Union[None, Nullable, bytes] = None
    edgeRegionBitmask: typing.Union[None, Nullable, bytes] = None
    interferenceSourceRecognitionReportingTimeout: typing.Optional[uint] = None
    aiSpaceBackgroundLearningReportingTimeout: typing.Optional[uint] = None
    enablePostureRecognition: typing.Optional[bool] = None
    enableLargeMotionRecognition: typing.Optional[bool] = None
    enableHumanCountDetection: typing.Optional[bool] = None
    enableVisitorCountDetection: typing.Optional[bool] = None
    enableWalkingDistanceDetection: typing.Optional[bool] = None
    enableTrafficFlowDetection: typing.Optional[bool] = None
    enableActivityDetection: typing.Optional[bool] = None
    enableAverageOccupancyDurationDetection: typing.Optional[bool] = None
    enableAiHighPrecisionRecognition: typing.Optional[bool] = None
    enableAiAdaptiveSensitivity: typing.Optional[bool] = None
    enableAiEntryExitRegionRecognition: typing.Optional[bool] = None
    enableAiInterferenceSourceRecognition: typing.Optional[bool] = None
    coordinateReverseSetting: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.CoordinateReverseEnum] = None
    detectionDirectionSetting: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.DetectionDirectionEnum] = None
    proximityDistanceLevelSetting: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.ProximityDistanceLevelEnum] = None
    enableFallDetection: typing.Optional[bool] = None
    fallMaskBitmask: typing.Union[None, Nullable, bytes] = None
    fallDetectionSensitivity: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensitivityEnum] = None
    bedHeightSetting: typing.Optional[uint] = None
    minBedHeight: typing.Optional[uint] = None
    maxBedHeight: typing.Optional[uint] = None
    fallDelayTimeSetting: typing.Optional[uint] = None
    minFallDelayTime: typing.Optional[uint] = None
    maxFallDelayTime: typing.Optional[uint] = None
    detectionRangeBitmask: typing.Union[None, Nullable, bytes] = None
    minDetectionRange: typing.Optional[uint] = None
    maxDetectionRange: typing.Optional[uint] = None
    detectionRangeStep: typing.Optional[uint] = None
    sensingMode: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum] = None
    supportedSensingModes: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum]] = None
    pirDetectionTimeSetting: typing.Optional[uint] = None
    minPIRDetectionTime: typing.Optional[uint] = None
    maxPIRDetectionTime: typing.Optional[uint] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Enums:
        class InstallModeEnum(MatterIntEnum):
            kUnknown = 0x00
            kSideMount = 0x01
            kTopMount = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class SideInstallEnum(MatterIntEnum):
            kUnknown = 0x00
            kWall = 0x01
            kLeftCorner = 0x02
            kRightCorner = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class InstallStatusEnum(MatterIntEnum):
            kLevelFacingUp = 0x00
            kLevelTiltedFacingUp = 0x01
            kLevelReverseTiltedFacingUp = 0x02
            kSideFacingForward = 0x03
            kSideReverseFacingForward = 0x04
            kTopFacingDown = 0x05
            kTiltedFacingDown = 0x06
            kReverseTiltedFacingDown = 0x07
            kInvalid = 0x08
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 9

        class ZoneTypeEnum(MatterIntEnum):
            kOther = 0x00
            kLivingRoom = 0x01
            kBalcony = 0x02
            kBedroom = 0x03
            kDiningRoom = 0x04
            kBathroom = 0x05
            kKitchen = 0x06
            kMeetingRoom = 0x07
            kOffice = 0x08
            kBathroom2 = 0x09
            kLivingRoomTVzone = 0x11
            kLivingRoomSofazone = 0x12
            kLivingRoomFitnesszone = 0x13
            kLivingRoomEntertainmentzone = 0x14
            kLivingRoomReadingzone = 0x15
            kLivingRoomStoragezone = 0x16
            kBalconyClothesDryingzone = 0x21
            kBalconyGreenPlantszone = 0x22
            kBalconyLeisurezone = 0x23
            kBedroomDressingTable = 0x31
            kBedroomCloakroom = 0x32
            kBedroomDesk = 0x33
            kBedroomRecliner = 0x34
            kBedroomWardrobe = 0x35
            kBedroomBed = 0x36
            kDiningRoomDiningTable = 0x41
            kDiningRoomRefrigerator = 0x42
            kDiningRoomWineCabinet = 0x43
            kBathroomShowerzone = 0x51
            kBathroomBathtubzone = 0x52
            kBathroomToilet = 0x53
            kKitchenSink = 0x61
            kKitchenCookingzone = 0x62
            kMeetingRoomConferenceTable = 0x71
            kMeetingRoomNegotiationzone = 0x72
            kOfficeWorkstation = 0x81
            kOfficeRestzone = 0x82
            kStaircase = 0x91
            kCorridor = 0x92
            kIntersection = 0x93
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 148

        class CoordinateReverseEnum(MatterIntEnum):
            kDisabled = 0x00
            kEnabled = 0x01
            kAuto = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class DetectionDirectionEnum(MatterIntEnum):
            kOmniDirectional = 0x00
            kLeftRight = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class ProximityDistanceLevelEnum(MatterIntEnum):
            kFar = 0x00
            kMedium = 0x01
            kNear = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class SensitivityEnum(MatterIntEnum):
            kLow = 0x00
            kMedium = 0x01
            kHigh = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class SensingModeEnum(MatterIntEnum):
            kPIROnly = 0x00
            kRadarOnly = 0x01
            kRadarPIR = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ZoneErrorCodeEnum(MatterIntEnum):
            kSuccess = 0x00
            kInvalidArgument = 0x01
            kInvalidState = 0x02
            kResourceExhausted = 0x03
            kBusy = 0x04
            kDuplicateZoneID = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

    class Bitmaps:
        class Feature(IntFlag):
            kZoneManagement = 0x1
            kInstallationModeSelection = 0x2
            kFallDetection = 0x4
            kSensingModeSelection = 0x8

    class Structs:
        @dataclass
        class AqaraZoneInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="zoneID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="zoneType", Tag=1, Type=AqaraAmbientSensingConfigurationCluster.Enums.ZoneTypeEnum),
                        ClusterObjectFieldDescriptor(Label="zoneBitmask", Tag=2, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="zoneProximityDetectionEnable", Tag=3, Type=bool),
                    ])

            zoneID: uint = 0
            zoneType: AqaraAmbientSensingConfigurationCluster.Enums.ZoneTypeEnum = 0
            zoneBitmask: bytes = b""
            zoneProximityDetectionEnable: bool = False

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
        class SubscribeAiEntryExitRegionData(ClusterCommand):
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
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct),
                    ])

            zone: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct = field(default_factory=lambda: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct())

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
                        ClusterObjectFieldDescriptor(Label="zone", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct),
                    ])

            zone: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct = field(default_factory=lambda: AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct())

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
                        ClusterObjectFieldDescriptor(Label="zones", Tag=0, Type=typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct]),
                    ])

            zones: typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct] = field(default_factory=lambda: [])

        @dataclass
        class SubscribeDetectionRangeTargetPosition(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x0000000C
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
        class AppendZoneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x115FFC0A
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum),
                    ])

            errorCode: AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum = 0

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
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum),
                    ])

            errorCode: AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum = 0

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
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum),
                    ])

            errorCode: AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum = 0

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
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum),
                    ])

            errorCode: AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum = 0

    class Attributes:
        @dataclass
        class InstallModeSelection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum] = None

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
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum]])

            value: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.InstallModeEnum]] = None

        @dataclass
        class SideInstallSelection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum] = None

        @dataclass
        class SupportedSideInstallModes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum]])

            value: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SideInstallEnum]] = None

        @dataclass
        class InstallHeightSetting(ClusterAttributeDescriptor):
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
        class MinInstallHeight(ClusterAttributeDescriptor):
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
        class MaxInstallHeight(ClusterAttributeDescriptor):
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
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallStatusEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.InstallStatusEnum] = None

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
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct]])

            value: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Structs.AqaraZoneInfoStruct]] = None

        @dataclass
        class MaxDetectionZones(ClusterAttributeDescriptor):
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
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: typing.Union[None, Nullable, bytes] = None

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
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: typing.Union[None, Nullable, bytes] = None

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
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: typing.Union[None, Nullable, bytes] = None

        @dataclass
        class InterferenceSourceRecognitionReportingTimeout(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class AiSpaceBackgroundLearningReportingTimeout(ClusterAttributeDescriptor):
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
        class EnablePostureRecognition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableLargeMotionRecognition(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

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
        class EnableVisitorCountDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableWalkingDistanceDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableTrafficFlowDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000026

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableActivityDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000027

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class EnableAverageOccupancyDurationDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000028

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
        class CoordinateReverseSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.CoordinateReverseEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.CoordinateReverseEnum] = None

        @dataclass
        class DetectionDirectionSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.DetectionDirectionEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.DetectionDirectionEnum] = None

        @dataclass
        class ProximityDistanceLevelSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.ProximityDistanceLevelEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.ProximityDistanceLevelEnum] = None

        @dataclass
        class EnableFallDetection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: typing.Optional[bool] = None

        @dataclass
        class FallMaskBitmask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: typing.Union[None, Nullable, bytes] = None

        @dataclass
        class FallDetectionSensitivity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensitivityEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensitivityEnum] = None

        @dataclass
        class BedHeightSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MinBedHeight(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000034

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MaxBedHeight(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class FallDelayTimeSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MinFallDelayTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000037

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MaxFallDelayTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class DetectionRangeBitmask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000040

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: typing.Union[None, Nullable, bytes] = None

        @dataclass
        class MinDetectionRange(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000041

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MaxDetectionRange(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000042

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class DetectionRangeStep(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000043

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class SensingMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000050

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum])

            value: typing.Optional[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum] = None

        @dataclass
        class SupportedSensingModes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000051

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum]])

            value: typing.Optional[typing.List[AqaraAmbientSensingConfigurationCluster.Enums.SensingModeEnum]] = None

        @dataclass
        class PIRDetectionTimeSetting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000052

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MinPIRDetectionTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000053

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class MaxPIRDetectionTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000054

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

    class Events:
        @dataclass
        class AutoInterferenceSourceRecognition(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="autoInterferenceSourceData", Tag=0, Type=typing.Union[Nullable, bytes]),
                    ])

            autoInterferenceSourceData: typing.Union[Nullable, bytes] = NullValue

        @dataclass
        class AutoEdgeRecognition(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="autoEdgeRecognitionData", Tag=0, Type=bytes),
                    ])

            autoEdgeRecognitionData: bytes = b""

        @dataclass
        class AiEntryExitRegion(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="aiEntryExitRegionData", Tag=0, Type=typing.Union[Nullable, bytes]),
                    ])

            aiEntryExitRegionData: typing.Union[Nullable, bytes] = NullValue

        @dataclass
        class AiSpaceBackgroundLearningComplete(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="errorCode", Tag=0, Type=AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum),
                    ])

            errorCode: AqaraAmbientSensingConfigurationCluster.Enums.ZoneErrorCodeEnum = 0

        @dataclass
        class DetectionRangeTargetPosition(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x115FFC0A

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="targetDistance", Tag=0, Type=typing.Union[Nullable, uint]),
                    ])

            targetDistance: typing.Union[Nullable, uint] = NullValue
