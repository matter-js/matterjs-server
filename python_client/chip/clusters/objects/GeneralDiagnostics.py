"""GeneralDiagnostics cluster definition (auto-generated, DO NOT edit)."""

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
class GeneralDiagnostics(Cluster):
    id: typing.ClassVar[int] = 0x00000033

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="networkInterfaces", Tag=0x00000000, Type=typing.List[typing.Optional[GeneralDiagnostics.Structs.NetworkInterface]]),
                ClusterObjectFieldDescriptor(Label="rebootCount", Tag=0x00000001, Type=uint),
                ClusterObjectFieldDescriptor(Label="upTime", Tag=0x00000002, Type=uint),
                ClusterObjectFieldDescriptor(Label="totalOperationalHours", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="bootReason", Tag=0x00000004, Type=typing.Optional[GeneralDiagnostics.Enums.BootReasonEnum]),
                ClusterObjectFieldDescriptor(Label="activeHardwareFaults", Tag=0x00000005, Type=typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]]),
                ClusterObjectFieldDescriptor(Label="activeRadioFaults", Tag=0x00000006, Type=typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]]),
                ClusterObjectFieldDescriptor(Label="activeNetworkFaults", Tag=0x00000007, Type=typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]]),
                ClusterObjectFieldDescriptor(Label="testEventTriggersEnabled", Tag=0x00000008, Type=bool),
                ClusterObjectFieldDescriptor(Label="doNotUse", Tag=0x00000009, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    networkInterfaces: 'typing.List[typing.Optional[GeneralDiagnostics.Structs.NetworkInterface]]' = field(default_factory=lambda: [])
    rebootCount: 'uint' = 0
    upTime: 'uint' = 0
    totalOperationalHours: 'typing.Optional[uint]' = None
    bootReason: 'typing.Optional[GeneralDiagnostics.Enums.BootReasonEnum]' = None
    activeHardwareFaults: 'typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]]' = None
    activeRadioFaults: 'typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]]' = None
    activeNetworkFaults: 'typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]]' = None
    testEventTriggersEnabled: 'bool' = False
    doNotUse: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class HardwareFaultEnum(MatterIntEnum):
            kUnspecified = 0x00
            kRadio = 0x01
            kSensor = 0x02
            kResettableOverTemp = 0x03
            kNonResettableOverTemp = 0x04
            kPowerSource = 0x05
            kVisualDisplayFault = 0x06
            kAudioOutputFault = 0x07
            kUserInterfaceFault = 0x08
            kNonVolatileMemoryError = 0x09
            kTamperDetected = 0x0A
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 11

        class RadioFaultEnum(MatterIntEnum):
            kUnspecified = 0x00
            kWiFiFault = 0x01
            kCellularFault = 0x02
            kThreadFault = 0x03
            kNfcFault = 0x04
            kBleFault = 0x05
            kEthernetFault = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

        class NetworkFaultEnum(MatterIntEnum):
            kUnspecified = 0x00
            kHardwareFailure = 0x01
            kNetworkJammed = 0x02
            kConnectionFailed = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class InterfaceTypeEnum(MatterIntEnum):
            kUnspecified = 0x00
            kWiFi = 0x01
            kEthernet = 0x02
            kCellular = 0x03
            kThread = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class BootReasonEnum(MatterIntEnum):
            kUnspecified = 0x00
            kPowerOnReboot = 0x01
            kBrownOutReset = 0x02
            kSoftwareWatchdogReset = 0x03
            kHardwareWatchdogReset = 0x04
            kSoftwareUpdateCompleted = 0x05
            kSoftwareReset = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

    class Bitmaps:
        class Feature(IntFlag):
            kDataModelTest = 0x1

    class Structs:
        @dataclass
        class NetworkInterface(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="name", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="isOperational", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="offPremiseServicesReachableIPv4", Tag=2, Type=typing.Union[Nullable, bool]),
                        ClusterObjectFieldDescriptor(Label="offPremiseServicesReachableIPv6", Tag=3, Type=typing.Union[Nullable, bool]),
                        ClusterObjectFieldDescriptor(Label="hardwareAddress", Tag=4, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="iPv4Addresses", Tag=5, Type=typing.List[typing.Optional[bytes]]),
                        ClusterObjectFieldDescriptor(Label="iPv6Addresses", Tag=6, Type=typing.List[typing.Optional[bytes]]),
                        ClusterObjectFieldDescriptor(Label="type", Tag=7, Type=GeneralDiagnostics.Enums.InterfaceTypeEnum),
                    ])

            name: 'str' = ""
            isOperational: 'bool' = False
            offPremiseServicesReachableIPv4: 'typing.Union[Nullable, bool]' = NullValue
            offPremiseServicesReachableIPv6: 'typing.Union[Nullable, bool]' = NullValue
            hardwareAddress: 'bytes' = b""
            iPv4Addresses: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])
            iPv6Addresses: 'typing.List[typing.Optional[bytes]]' = field(default_factory=lambda: [])
            type: 'GeneralDiagnostics.Enums.InterfaceTypeEnum' = 0

    class Commands:
        @dataclass
        class TestEventTrigger(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000033
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="enableKey", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="eventTrigger", Tag=1, Type=uint),
                    ])

            enableKey: 'bytes' = b""
            eventTrigger: 'uint' = 0

        @dataclass
        class TimeSnapshot(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000033
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'TimeSnapshotResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class PayloadTestRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000033
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'PayloadTestResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="enableKey", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="value", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="count", Tag=2, Type=uint),
                    ])

            enableKey: 'bytes' = b""
            value: 'uint' = 0
            count: 'uint' = 0

        @dataclass
        class TimeSnapshotResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000033
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="systemTimeMs", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="posixTimeMs", Tag=1, Type=typing.Union[Nullable, uint]),
                    ])

            systemTimeMs: 'uint' = 0
            posixTimeMs: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class PayloadTestResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000033
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="payload", Tag=0, Type=bytes),
                    ])

            payload: 'bytes' = b""

    class Attributes:
        @dataclass
        class NetworkInterfaces(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[GeneralDiagnostics.Structs.NetworkInterface]])

            value: 'typing.List[typing.Optional[GeneralDiagnostics.Structs.NetworkInterface]]' = field(default_factory=lambda: [])

        @dataclass
        class RebootCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class UpTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class TotalOperationalHours(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class BootReason(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[GeneralDiagnostics.Enums.BootReasonEnum])

            value: 'typing.Optional[GeneralDiagnostics.Enums.BootReasonEnum]' = None

        @dataclass
        class ActiveHardwareFaults(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]])

            value: 'typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]]' = None

        @dataclass
        class ActiveRadioFaults(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]])

            value: 'typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]]' = None

        @dataclass
        class ActiveNetworkFaults(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]])

            value: 'typing.Optional[typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]]' = None

        @dataclass
        class TestEventTriggersEnabled(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class DoNotUse(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

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
                return 0x00000033

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
                return 0x00000033

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
                return 0x00000033

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
                return 0x00000033

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
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class HardwareFaultChange(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="current", Tag=0, Type=typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]),
                        ClusterObjectFieldDescriptor(Label="previous", Tag=1, Type=typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]),
                    ])

            current: 'typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]' = field(default_factory=lambda: [])
            previous: 'typing.List[typing.Optional[GeneralDiagnostics.Enums.HardwareFaultEnum]]' = field(default_factory=lambda: [])

        @dataclass
        class RadioFaultChange(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="current", Tag=0, Type=typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]),
                        ClusterObjectFieldDescriptor(Label="previous", Tag=1, Type=typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]),
                    ])

            current: 'typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]' = field(default_factory=lambda: [])
            previous: 'typing.List[typing.Optional[GeneralDiagnostics.Enums.RadioFaultEnum]]' = field(default_factory=lambda: [])

        @dataclass
        class NetworkFaultChange(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="current", Tag=0, Type=typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]),
                        ClusterObjectFieldDescriptor(Label="previous", Tag=1, Type=typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]),
                    ])

            current: 'typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]' = field(default_factory=lambda: [])
            previous: 'typing.List[typing.Optional[GeneralDiagnostics.Enums.NetworkFaultEnum]]' = field(default_factory=lambda: [])

        @dataclass
        class BootReason(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="bootReason", Tag=0, Type=GeneralDiagnostics.Enums.BootReasonEnum),
                    ])

            bootReason: 'GeneralDiagnostics.Enums.BootReasonEnum' = 0
