"""IcdManagement cluster definition (auto-generated, DO NOT edit)."""

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
class IcdManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000046

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="idleModeDuration", Tag=0x00000000, Type=uint),
                ClusterObjectFieldDescriptor(Label="activeModeDuration", Tag=0x00000001, Type=uint),
                ClusterObjectFieldDescriptor(Label="activeModeThreshold", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="registeredClients", Tag=0x00000003, Type=typing.Optional[typing.List[typing.Optional[IcdManagement.Structs.MonitoringRegistrationStruct]]]),
                ClusterObjectFieldDescriptor(Label="icdCounter", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="clientsSupportedPerFabric", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="userActiveModeTriggerHint", Tag=0x00000006, Type=typing.Optional[IcdManagement.Bitmaps.UserActiveModeTriggerBitmap]),
                ClusterObjectFieldDescriptor(Label="userActiveModeTriggerInstruction", Tag=0x00000007, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="operatingMode", Tag=0x00000008, Type=typing.Optional[IcdManagement.Enums.OperatingModeEnum]),
                ClusterObjectFieldDescriptor(Label="maximumCheckInBackoff", Tag=0x00000009, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    idleModeDuration: 'uint' = 0
    activeModeDuration: 'uint' = 0
    activeModeThreshold: 'uint' = 0
    registeredClients: 'typing.Optional[typing.List[typing.Optional[IcdManagement.Structs.MonitoringRegistrationStruct]]]' = None
    icdCounter: 'typing.Optional[uint]' = None
    clientsSupportedPerFabric: 'typing.Optional[uint]' = None
    userActiveModeTriggerHint: 'typing.Optional[IcdManagement.Bitmaps.UserActiveModeTriggerBitmap]' = None
    userActiveModeTriggerInstruction: 'typing.Optional[str]' = None
    operatingMode: 'typing.Optional[IcdManagement.Enums.OperatingModeEnum]' = None
    maximumCheckInBackoff: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class ClientTypeEnum(MatterIntEnum):
            kPermanent = 0x00
            kEphemeral = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class OperatingModeEnum(MatterIntEnum):
            kSit = 0x00
            kLit = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2


    class Bitmaps:
        class Feature(IntFlag):
            kCheckInProtocolSupport = 0x1
            kUserActiveModeTrigger = 0x2
            kLongIdleTimeSupport = 0x4
            kDynamicSitLitSupport = 0x8

        class UserActiveModeTriggerBitmap(IntFlag):
            kPowerCycle = 0x1
            kSettingsMenu = 0x2
            kCustomInstruction = 0x4
            kDeviceManual = 0x8
            kActuateSensor = 0x10
            kActuateSensorSeconds = 0x20
            kActuateSensorTimes = 0x40
            kActuateSensorLightsBlink = 0x80
            kResetButton = 0x100
            kResetButtonLightsBlink = 0x200
            kResetButtonSeconds = 0x400
            kResetButtonTimes = 0x800
            kSetupButton = 0x1000
            kSetupButtonSeconds = 0x2000
            kSetupButtonLightsBlink = 0x4000
            kSetupButtonTimes = 0x8000
            kAppDefinedButton = 0x10000


    class Structs:
        @dataclass
        class MonitoringRegistrationStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="checkInNodeId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="monitoredSubject", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="key", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="clientType", Tag=4, Type=IcdManagement.Enums.ClientTypeEnum),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            checkInNodeId: 'uint' = 0
            monitoredSubject: 'uint' = 0
            key: 'typing.Optional[uint]' = None
            clientType: 'IcdManagement.Enums.ClientTypeEnum' = 0
            fabricIndex: 'uint' = 0


    class Commands:
        @dataclass
        class RegisterClient(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000046
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'RegisterClientResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="checkInNodeId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="monitoredSubject", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="key", Tag=2, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="verificationKey", Tag=3, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="clientType", Tag=4, Type=IcdManagement.Enums.ClientTypeEnum),
                    ])

            checkInNodeId: 'uint' = 0
            monitoredSubject: 'uint' = 0
            key: 'bytes' = b""
            verificationKey: 'typing.Optional[bytes]' = None
            clientType: 'IcdManagement.Enums.ClientTypeEnum' = 0

        @dataclass
        class UnregisterClient(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000046
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="checkInNodeId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="verificationKey", Tag=1, Type=typing.Optional[bytes]),
                    ])

            checkInNodeId: 'uint' = 0
            verificationKey: 'typing.Optional[bytes]' = None

        @dataclass
        class StayActiveRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000046
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'StayActiveResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="stayActiveDuration", Tag=0, Type=uint),
                    ])

            stayActiveDuration: 'uint' = 0

        @dataclass
        class RegisterClientResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000046
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="icdCounter", Tag=0, Type=uint),
                    ])

            icdCounter: 'uint' = 0

        @dataclass
        class StayActiveResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000046
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="promisedActiveDuration", Tag=0, Type=uint),
                    ])

            promisedActiveDuration: 'uint' = 0


    class Attributes:
        @dataclass
        class IdleModeDuration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class ActiveModeDuration(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class ActiveModeThreshold(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class RegisteredClients(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[IcdManagement.Structs.MonitoringRegistrationStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[IcdManagement.Structs.MonitoringRegistrationStruct]]]' = None

        @dataclass
        class IcdCounter(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ClientsSupportedPerFabric(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UserActiveModeTriggerHint(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[IcdManagement.Bitmaps.UserActiveModeTriggerBitmap])

            value: 'typing.Optional[IcdManagement.Bitmaps.UserActiveModeTriggerBitmap]' = None

        @dataclass
        class UserActiveModeTriggerInstruction(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class OperatingMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[IcdManagement.Enums.OperatingModeEnum])

            value: 'typing.Optional[IcdManagement.Enums.OperatingModeEnum]' = None

        @dataclass
        class MaximumCheckInBackoff(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000046

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
                return 0x00000046

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
                return 0x00000046

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
                return 0x00000046

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
                return 0x00000046

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

