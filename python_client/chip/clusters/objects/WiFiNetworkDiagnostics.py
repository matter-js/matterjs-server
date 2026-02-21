"""WiFiNetworkDiagnostics cluster definition (auto-generated, DO NOT edit)."""

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
class WiFiNetworkDiagnostics(Cluster):
    id: typing.ClassVar[int] = 0x00000036

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="bssid", Tag=0x00000000, Type=typing.Union[Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="securityType", Tag=0x00000001, Type=typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.SecurityTypeEnum]),
                ClusterObjectFieldDescriptor(Label="wiFiVersion", Tag=0x00000002, Type=typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.WiFiVersionEnum]),
                ClusterObjectFieldDescriptor(Label="channelNumber", Tag=0x00000003, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="rssi", Tag=0x00000004, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="beaconLostCount", Tag=0x00000005, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="beaconRxCount", Tag=0x00000006, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="packetMulticastRxCount", Tag=0x00000007, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="packetMulticastTxCount", Tag=0x00000008, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="packetUnicastRxCount", Tag=0x00000009, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="packetUnicastTxCount", Tag=0x0000000A, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="currentMaxRate", Tag=0x0000000B, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="overrunCount", Tag=0x0000000C, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    bssid: 'typing.Union[Nullable, bytes]' = NullValue
    securityType: 'typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.SecurityTypeEnum]' = NullValue
    wiFiVersion: 'typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.WiFiVersionEnum]' = NullValue
    channelNumber: 'typing.Union[Nullable, uint]' = NullValue
    rssi: 'typing.Union[Nullable, int]' = NullValue
    beaconLostCount: 'typing.Union[None, Nullable, uint]' = None
    beaconRxCount: 'typing.Union[None, Nullable, uint]' = None
    packetMulticastRxCount: 'typing.Union[None, Nullable, uint]' = None
    packetMulticastTxCount: 'typing.Union[None, Nullable, uint]' = None
    packetUnicastRxCount: 'typing.Union[None, Nullable, uint]' = None
    packetUnicastTxCount: 'typing.Union[None, Nullable, uint]' = None
    currentMaxRate: 'typing.Union[None, Nullable, uint]' = None
    overrunCount: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class SecurityTypeEnum(MatterIntEnum):
            kUnspecified = 0x00
            kNone = 0x01
            kWep = 0x02
            kWpa = 0x03
            kWpa2 = 0x04
            kWpa3 = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class WiFiVersionEnum(MatterIntEnum):
            kA = 0x00
            kB = 0x01
            kG = 0x02
            kN = 0x03
            kAc = 0x04
            kAx = 0x05
            kAh = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

        class AssociationFailureCauseEnum(MatterIntEnum):
            kUnknown = 0x00
            kAssociationFailed = 0x01
            kAuthenticationFailed = 0x02
            kSsidNotFound = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ConnectionStatusEnum(MatterIntEnum):
            kConnected = 0x00
            kNotConnected = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

    class Bitmaps:
        class Feature(IntFlag):
            kPacketCounts = 0x1
            kErrorCounts = 0x2

    class Commands:
        @dataclass
        class ResetCounts(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000036
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

    class Attributes:
        @dataclass
        class Bssid(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, bytes])

            value: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class SecurityType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.SecurityTypeEnum])

            value: 'typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.SecurityTypeEnum]' = NullValue

        @dataclass
        class WiFiVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.WiFiVersionEnum])

            value: 'typing.Union[Nullable, WiFiNetworkDiagnostics.Enums.WiFiVersionEnum]' = NullValue

        @dataclass
        class ChannelNumber(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class Rssi(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class BeaconLostCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class BeaconRxCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class PacketMulticastRxCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class PacketMulticastTxCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class PacketUnicastRxCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class PacketUnicastTxCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class CurrentMaxRate(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class OverrunCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

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
                return 0x00000036

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
                return 0x00000036

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
                return 0x00000036

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
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class Disconnection(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="reasonCode", Tag=0, Type=uint),
                    ])

            reasonCode: 'uint' = 0

        @dataclass
        class AssociationFailure(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="associationFailureCause", Tag=0, Type=WiFiNetworkDiagnostics.Enums.AssociationFailureCauseEnum),
                        ClusterObjectFieldDescriptor(Label="status", Tag=1, Type=uint),
                    ])

            associationFailureCause: 'WiFiNetworkDiagnostics.Enums.AssociationFailureCauseEnum' = 0
            status: 'uint' = 0

        @dataclass
        class ConnectionStatus(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionStatus", Tag=0, Type=WiFiNetworkDiagnostics.Enums.ConnectionStatusEnum),
                    ])

            connectionStatus: 'WiFiNetworkDiagnostics.Enums.ConnectionStatusEnum' = 0
