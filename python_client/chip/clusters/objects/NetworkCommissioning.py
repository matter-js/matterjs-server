"""NetworkCommissioning cluster definition (auto-generated, DO NOT edit)."""

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
class NetworkCommissioning(Cluster):
    id: typing.ClassVar[int] = 0x00000031

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="maxNetworks", Tag=0x00000000, Type=uint),
                ClusterObjectFieldDescriptor(Label="networks", Tag=0x00000001, Type=typing.List[typing.Optional[NetworkCommissioning.Structs.NetworkInfoStruct]]),
                ClusterObjectFieldDescriptor(Label="scanMaxTimeSeconds", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="connectMaxTimeSeconds", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="interfaceEnabled", Tag=0x00000004, Type=bool),
                ClusterObjectFieldDescriptor(Label="lastNetworkingStatus", Tag=0x00000005, Type=typing.Union[Nullable, NetworkCommissioning.Enums.NetworkCommissioningStatusEnum]),
                ClusterObjectFieldDescriptor(Label="lastNetworkId", Tag=0x00000006, Type=typing.Union[Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="lastConnectErrorValue", Tag=0x00000007, Type=typing.Union[Nullable, int]),
                ClusterObjectFieldDescriptor(Label="supportedWiFiBands", Tag=0x00000008, Type=typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Enums.WiFiBandEnum]]]),
                ClusterObjectFieldDescriptor(Label="supportedThreadFeatures", Tag=0x00000009, Type=typing.Optional[NetworkCommissioning.Bitmaps.ThreadCapabilitiesBitmap]),
                ClusterObjectFieldDescriptor(Label="threadVersion", Tag=0x0000000A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    maxNetworks: 'uint' = 0
    networks: 'typing.List[typing.Optional[NetworkCommissioning.Structs.NetworkInfoStruct]]' = field(default_factory=lambda: [])
    scanMaxTimeSeconds: 'typing.Optional[uint]' = None
    connectMaxTimeSeconds: 'typing.Optional[uint]' = None
    interfaceEnabled: 'bool' = False
    lastNetworkingStatus: 'typing.Union[Nullable, NetworkCommissioning.Enums.NetworkCommissioningStatusEnum]' = NullValue
    lastNetworkId: 'typing.Union[Nullable, bytes]' = NullValue
    lastConnectErrorValue: 'typing.Union[Nullable, int]' = NullValue
    supportedWiFiBands: 'typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Enums.WiFiBandEnum]]]' = None
    supportedThreadFeatures: 'typing.Optional[NetworkCommissioning.Bitmaps.ThreadCapabilitiesBitmap]' = None
    threadVersion: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class WiFiBandEnum(MatterIntEnum):
            k2G4 = 0x00
            k3G65 = 0x01
            k5G = 0x02
            k6G = 0x03
            k60G = 0x04
            k1G = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class NetworkCommissioningStatusEnum(MatterIntEnum):
            kSuccess = 0x00
            kOutOfRange = 0x01
            kBoundsExceeded = 0x02
            kNetworkIdNotFound = 0x03
            kDuplicateNetworkId = 0x04
            kNetworkNotFound = 0x05
            kRegulatoryError = 0x06
            kAuthFailure = 0x07
            kUnsupportedSecurity = 0x08
            kOtherConnectionFailure = 0x09
            kIpv6Failed = 0x0A
            kIpBindFailed = 0x0B
            kUnknownError = 0x0C
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 13


    class Bitmaps:
        class Feature(IntFlag):
            kWiFiNetworkInterface = 0x1
            kThreadNetworkInterface = 0x2
            kEthernetNetworkInterface = 0x4

        class WiFiSecurityBitmap(IntFlag):
            kUnencrypted = 0x1
            kWep = 0x2
            kWpaPersonal = 0x4
            kWpa2Personal = 0x8
            kWpa3Personal = 0x10

        class ThreadCapabilitiesBitmap(IntFlag):
            kIsBorderRouterCapable = 0x1
            kIsRouterCapable = 0x2
            kIsSleepyEndDeviceCapable = 0x4
            kIsFullThreadDevice = 0x8
            kIsSynchronizedSleepyEndDeviceCapable = 0x10


    class Structs:
        @dataclass
        class NetworkInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkId", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="connected", Tag=1, Type=bool),
                    ])

            networkId: 'bytes' = b""
            connected: 'bool' = False

        @dataclass
        class WiFiInterfaceScanResultStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="security", Tag=0, Type=typing.Optional[NetworkCommissioning.Bitmaps.WiFiSecurityBitmap]),
                        ClusterObjectFieldDescriptor(Label="ssid", Tag=1, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="bssid", Tag=2, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="channel", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="wiFiBand", Tag=4, Type=typing.Optional[NetworkCommissioning.Enums.WiFiBandEnum]),
                        ClusterObjectFieldDescriptor(Label="rssi", Tag=5, Type=typing.Optional[int]),
                    ])

            security: 'typing.Optional[NetworkCommissioning.Bitmaps.WiFiSecurityBitmap]' = None
            ssid: 'typing.Optional[bytes]' = None
            bssid: 'typing.Optional[bytes]' = None
            channel: 'typing.Optional[uint]' = None
            wiFiBand: 'typing.Optional[NetworkCommissioning.Enums.WiFiBandEnum]' = None
            rssi: 'typing.Optional[int]' = None

        @dataclass
        class ThreadInterfaceScanResultStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="panId", Tag=0, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="extendedPanId", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="networkName", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="channel", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="version", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="extendedAddress", Tag=5, Type=typing.Optional[bytes]),
                        ClusterObjectFieldDescriptor(Label="rssi", Tag=6, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="lqi", Tag=7, Type=typing.Optional[uint]),
                    ])

            panId: 'typing.Optional[uint]' = None
            extendedPanId: 'typing.Optional[uint]' = None
            networkName: 'typing.Optional[str]' = None
            channel: 'typing.Optional[uint]' = None
            version: 'typing.Optional[uint]' = None
            extendedAddress: 'typing.Optional[bytes]' = None
            rssi: 'typing.Optional[int]' = None
            lqi: 'typing.Optional[uint]' = None


    class Commands:
        @dataclass
        class ScanNetworks(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ScanNetworksResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ssid", Tag=0, Type=typing.Union[None, Nullable, bytes]),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=1, Type=typing.Optional[uint]),
                    ])

            ssid: 'typing.Union[None, Nullable, bytes]' = None
            breadcrumb: 'typing.Optional[uint]' = None

        @dataclass
        class AddOrUpdateWiFiNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NetworkConfigResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="ssid", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="credentials", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=2, Type=typing.Optional[uint]),
                    ])

            ssid: 'bytes' = b""
            credentials: 'bytes' = b""
            breadcrumb: 'typing.Optional[uint]' = None

        @dataclass
        class AddOrUpdateThreadNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NetworkConfigResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operationalDataset", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=1, Type=typing.Optional[uint]),
                    ])

            operationalDataset: 'bytes' = b""
            breadcrumb: 'typing.Optional[uint]' = None

        @dataclass
        class RemoveNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NetworkConfigResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkId", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=1, Type=typing.Optional[uint]),
                    ])

            networkId: 'bytes' = b""
            breadcrumb: 'typing.Optional[uint]' = None

        @dataclass
        class ConnectNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ConnectNetworkResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkId", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=1, Type=typing.Optional[uint]),
                    ])

            networkId: 'bytes' = b""
            breadcrumb: 'typing.Optional[uint]' = None

        @dataclass
        class ReorderNetwork(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'NetworkConfigResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkId", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="networkIndex", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="breadcrumb", Tag=2, Type=typing.Optional[uint]),
                    ])

            networkId: 'bytes' = b""
            networkIndex: 'uint' = 0
            breadcrumb: 'typing.Optional[uint]' = None

        @dataclass
        class ScanNetworksResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkingStatus", Tag=0, Type=NetworkCommissioning.Enums.NetworkCommissioningStatusEnum),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="wiFiScanResults", Tag=2, Type=typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Structs.WiFiInterfaceScanResultStruct]]]),
                        ClusterObjectFieldDescriptor(Label="threadScanResults", Tag=3, Type=typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Structs.ThreadInterfaceScanResultStruct]]]),
                    ])

            networkingStatus: 'NetworkCommissioning.Enums.NetworkCommissioningStatusEnum' = 0
            debugText: 'typing.Optional[str]' = None
            wiFiScanResults: 'typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Structs.WiFiInterfaceScanResultStruct]]]' = None
            threadScanResults: 'typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Structs.ThreadInterfaceScanResultStruct]]]' = None

        @dataclass
        class NetworkConfigResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkingStatus", Tag=0, Type=NetworkCommissioning.Enums.NetworkCommissioningStatusEnum),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="networkIndex", Tag=2, Type=typing.Optional[uint]),
                    ])

            networkingStatus: 'NetworkCommissioning.Enums.NetworkCommissioningStatusEnum' = 0
            debugText: 'typing.Optional[str]' = None
            networkIndex: 'typing.Optional[uint]' = None

        @dataclass
        class ConnectNetworkResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000031
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="networkingStatus", Tag=0, Type=NetworkCommissioning.Enums.NetworkCommissioningStatusEnum),
                        ClusterObjectFieldDescriptor(Label="debugText", Tag=1, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="errorValue", Tag=2, Type=typing.Union[Nullable, int]),
                    ])

            networkingStatus: 'NetworkCommissioning.Enums.NetworkCommissioningStatusEnum' = 0
            debugText: 'typing.Optional[str]' = None
            errorValue: 'typing.Union[Nullable, int]' = NullValue


    class Attributes:
        @dataclass
        class MaxNetworks(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class Networks(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[NetworkCommissioning.Structs.NetworkInfoStruct]])

            value: 'typing.List[typing.Optional[NetworkCommissioning.Structs.NetworkInfoStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class ScanMaxTimeSeconds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ConnectMaxTimeSeconds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class InterfaceEnabled(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class LastNetworkingStatus(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, NetworkCommissioning.Enums.NetworkCommissioningStatusEnum])

            value: 'typing.Union[Nullable, NetworkCommissioning.Enums.NetworkCommissioningStatusEnum]' = NullValue

        @dataclass
        class LastNetworkId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, bytes])

            value: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class LastConnectErrorValue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, int])

            value: 'typing.Union[Nullable, int]' = NullValue

        @dataclass
        class SupportedWiFiBands(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Enums.WiFiBandEnum]]])

            value: 'typing.Optional[typing.List[typing.Optional[NetworkCommissioning.Enums.WiFiBandEnum]]]' = None

        @dataclass
        class SupportedThreadFeatures(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[NetworkCommissioning.Bitmaps.ThreadCapabilitiesBitmap])

            value: 'typing.Optional[NetworkCommissioning.Bitmaps.ThreadCapabilitiesBitmap]' = None

        @dataclass
        class ThreadVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000031

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
                return 0x00000031

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
                return 0x00000031

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
                return 0x00000031

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
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

