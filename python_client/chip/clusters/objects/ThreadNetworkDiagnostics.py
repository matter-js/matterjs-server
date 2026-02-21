"""ThreadNetworkDiagnostics cluster definition (auto-generated, DO NOT edit)."""

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
class ThreadNetworkDiagnostics(Cluster):
    id: typing.ClassVar[int] = 0x00000035

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="channel", Tag=0x00000000, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="routingRole", Tag=0x00000001, Type=typing.Union[Nullable, ThreadNetworkDiagnostics.Enums.RoutingRoleEnum]),
                ClusterObjectFieldDescriptor(Label="networkName", Tag=0x00000002, Type=typing.Union[Nullable, str]),
                ClusterObjectFieldDescriptor(Label="panId", Tag=0x00000003, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="extendedPanId", Tag=0x00000004, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="meshLocalPrefix", Tag=0x00000005, Type=typing.Union[Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="overrunCount", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="neighborTable", Tag=0x00000007, Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.NeighborTableStruct]]),
                ClusterObjectFieldDescriptor(Label="routeTable", Tag=0x00000008, Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.RouteTableStruct]]),
                ClusterObjectFieldDescriptor(Label="partitionId", Tag=0x00000009, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="weighting", Tag=0x0000000A, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="dataVersion", Tag=0x0000000B, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="stableDataVersion", Tag=0x0000000C, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="leaderRouterId", Tag=0x0000000D, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="detachedRoleCount", Tag=0x0000000E, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="childRoleCount", Tag=0x0000000F, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="routerRoleCount", Tag=0x00000010, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="leaderRoleCount", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="attachAttemptCount", Tag=0x00000012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="partitionIdChangeCount", Tag=0x00000013, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="betterPartitionAttachAttemptCount", Tag=0x00000014, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="parentChangeCount", Tag=0x00000015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txTotalCount", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txUnicastCount", Tag=0x00000017, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txBroadcastCount", Tag=0x00000018, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txAckRequestedCount", Tag=0x00000019, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txAckedCount", Tag=0x0000001A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txNoAckRequestedCount", Tag=0x0000001B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txDataCount", Tag=0x0000001C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txDataPollCount", Tag=0x0000001D, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txBeaconCount", Tag=0x0000001E, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txBeaconRequestCount", Tag=0x0000001F, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txOtherCount", Tag=0x00000020, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txRetryCount", Tag=0x00000021, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txDirectMaxRetryExpiryCount", Tag=0x00000022, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txIndirectMaxRetryExpiryCount", Tag=0x00000023, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txErrCcaCount", Tag=0x00000024, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txErrAbortCount", Tag=0x00000025, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="txErrBusyChannelCount", Tag=0x00000026, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxTotalCount", Tag=0x00000027, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxUnicastCount", Tag=0x00000028, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxBroadcastCount", Tag=0x00000029, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxDataCount", Tag=0x0000002A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxDataPollCount", Tag=0x0000002B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxBeaconCount", Tag=0x0000002C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxBeaconRequestCount", Tag=0x0000002D, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxOtherCount", Tag=0x0000002E, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxAddressFilteredCount", Tag=0x0000002F, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxDestAddrFilteredCount", Tag=0x00000030, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxDuplicatedCount", Tag=0x00000031, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxErrNoFrameCount", Tag=0x00000032, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxErrUnknownNeighborCount", Tag=0x00000033, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxErrInvalidSrcAddrCount", Tag=0x00000034, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxErrSecCount", Tag=0x00000035, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxErrFcsCount", Tag=0x00000036, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="rxErrOtherCount", Tag=0x00000037, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="activeTimestamp", Tag=0x00000038, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="pendingTimestamp", Tag=0x00000039, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="delay", Tag=0x0000003A, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="securityPolicy", Tag=0x0000003B, Type=typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.SecurityPolicy]),
                ClusterObjectFieldDescriptor(Label="channelPage0Mask", Tag=0x0000003C, Type=typing.Union[Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="operationalDatasetComponents", Tag=0x0000003D, Type=typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.OperationalDatasetComponents]),
                ClusterObjectFieldDescriptor(Label="activeNetworkFaultsList", Tag=0x0000003E, Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]),
                ClusterObjectFieldDescriptor(Label="extAddress", Tag=0x0000003F, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="rloc16", Tag=0x00000040, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    channel: 'typing.Union[Nullable, uint]' = NullValue
    routingRole: 'typing.Union[Nullable, ThreadNetworkDiagnostics.Enums.RoutingRoleEnum]' = NullValue
    networkName: 'typing.Union[Nullable, str]' = NullValue
    panId: 'typing.Union[Nullable, uint]' = NullValue
    extendedPanId: 'typing.Union[Nullable, uint]' = NullValue
    meshLocalPrefix: 'typing.Union[Nullable, bytes]' = NullValue
    overrunCount: 'typing.Optional[uint]' = None
    neighborTable: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.NeighborTableStruct]]' = field(default_factory=lambda: [])
    routeTable: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.RouteTableStruct]]' = field(default_factory=lambda: [])
    partitionId: 'typing.Union[Nullable, uint]' = NullValue
    weighting: 'typing.Union[Nullable, uint]' = NullValue
    dataVersion: 'typing.Union[Nullable, uint]' = NullValue
    stableDataVersion: 'typing.Union[Nullable, uint]' = NullValue
    leaderRouterId: 'typing.Union[Nullable, uint]' = NullValue
    detachedRoleCount: 'typing.Optional[uint]' = None
    childRoleCount: 'typing.Optional[uint]' = None
    routerRoleCount: 'typing.Optional[uint]' = None
    leaderRoleCount: 'typing.Optional[uint]' = None
    attachAttemptCount: 'typing.Optional[uint]' = None
    partitionIdChangeCount: 'typing.Optional[uint]' = None
    betterPartitionAttachAttemptCount: 'typing.Optional[uint]' = None
    parentChangeCount: 'typing.Optional[uint]' = None
    txTotalCount: 'typing.Optional[uint]' = None
    txUnicastCount: 'typing.Optional[uint]' = None
    txBroadcastCount: 'typing.Optional[uint]' = None
    txAckRequestedCount: 'typing.Optional[uint]' = None
    txAckedCount: 'typing.Optional[uint]' = None
    txNoAckRequestedCount: 'typing.Optional[uint]' = None
    txDataCount: 'typing.Optional[uint]' = None
    txDataPollCount: 'typing.Optional[uint]' = None
    txBeaconCount: 'typing.Optional[uint]' = None
    txBeaconRequestCount: 'typing.Optional[uint]' = None
    txOtherCount: 'typing.Optional[uint]' = None
    txRetryCount: 'typing.Optional[uint]' = None
    txDirectMaxRetryExpiryCount: 'typing.Optional[uint]' = None
    txIndirectMaxRetryExpiryCount: 'typing.Optional[uint]' = None
    txErrCcaCount: 'typing.Optional[uint]' = None
    txErrAbortCount: 'typing.Optional[uint]' = None
    txErrBusyChannelCount: 'typing.Optional[uint]' = None
    rxTotalCount: 'typing.Optional[uint]' = None
    rxUnicastCount: 'typing.Optional[uint]' = None
    rxBroadcastCount: 'typing.Optional[uint]' = None
    rxDataCount: 'typing.Optional[uint]' = None
    rxDataPollCount: 'typing.Optional[uint]' = None
    rxBeaconCount: 'typing.Optional[uint]' = None
    rxBeaconRequestCount: 'typing.Optional[uint]' = None
    rxOtherCount: 'typing.Optional[uint]' = None
    rxAddressFilteredCount: 'typing.Optional[uint]' = None
    rxDestAddrFilteredCount: 'typing.Optional[uint]' = None
    rxDuplicatedCount: 'typing.Optional[uint]' = None
    rxErrNoFrameCount: 'typing.Optional[uint]' = None
    rxErrUnknownNeighborCount: 'typing.Optional[uint]' = None
    rxErrInvalidSrcAddrCount: 'typing.Optional[uint]' = None
    rxErrSecCount: 'typing.Optional[uint]' = None
    rxErrFcsCount: 'typing.Optional[uint]' = None
    rxErrOtherCount: 'typing.Optional[uint]' = None
    activeTimestamp: 'typing.Union[None, Nullable, uint]' = None
    pendingTimestamp: 'typing.Union[None, Nullable, uint]' = None
    delay: 'typing.Union[None, Nullable, uint]' = None
    securityPolicy: 'typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.SecurityPolicy]' = NullValue
    channelPage0Mask: 'typing.Union[Nullable, bytes]' = NullValue
    operationalDatasetComponents: 'typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.OperationalDatasetComponents]' = NullValue
    activeNetworkFaultsList: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]' = field(default_factory=lambda: [])
    extAddress: 'typing.Union[None, Nullable, uint]' = None
    rloc16: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class NetworkFaultEnum(MatterIntEnum):
            kUnspecified = 0x00
            kLinkDown = 0x01
            kHardwareFailure = 0x02
            kNetworkJammed = 0x03
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

        class RoutingRoleEnum(MatterIntEnum):
            kUnspecified = 0x00
            kUnassigned = 0x01
            kSleepyEndDevice = 0x02
            kEndDevice = 0x03
            kReed = 0x04
            kRouter = 0x05
            kLeader = 0x06
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 7

    class Bitmaps:
        class Feature(IntFlag):
            kPacketCounts = 0x1
            kErrorCounts = 0x2
            kMleCounts = 0x4
            kMacCounts = 0x8

    class Structs:
        @dataclass
        class NeighborTableStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="extAddress", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="age", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="rloc16", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="linkFrameCounter", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="mleFrameCounter", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="lqi", Tag=5, Type=uint),
                        ClusterObjectFieldDescriptor(Label="averageRssi", Tag=6, Type=typing.Union[Nullable, int]),
                        ClusterObjectFieldDescriptor(Label="lastRssi", Tag=7, Type=typing.Union[Nullable, int]),
                        ClusterObjectFieldDescriptor(Label="frameErrorRate", Tag=8, Type=uint),
                        ClusterObjectFieldDescriptor(Label="messageErrorRate", Tag=9, Type=uint),
                        ClusterObjectFieldDescriptor(Label="rxOnWhenIdle", Tag=10, Type=bool),
                        ClusterObjectFieldDescriptor(Label="fullThreadDevice", Tag=11, Type=bool),
                        ClusterObjectFieldDescriptor(Label="fullNetworkData", Tag=12, Type=bool),
                        ClusterObjectFieldDescriptor(Label="isChild", Tag=13, Type=bool),
                    ])

            extAddress: 'uint' = 0
            age: 'uint' = 0
            rloc16: 'uint' = 0
            linkFrameCounter: 'uint' = 0
            mleFrameCounter: 'uint' = 0
            lqi: 'uint' = 0
            averageRssi: 'typing.Union[Nullable, int]' = NullValue
            lastRssi: 'typing.Union[Nullable, int]' = NullValue
            frameErrorRate: 'uint' = 0
            messageErrorRate: 'uint' = 0
            rxOnWhenIdle: 'bool' = False
            fullThreadDevice: 'bool' = False
            fullNetworkData: 'bool' = False
            isChild: 'bool' = False

        @dataclass
        class RouteTableStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="extAddress", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="rloc16", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="routerId", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nextHop", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="pathCost", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="lqiIn", Tag=5, Type=uint),
                        ClusterObjectFieldDescriptor(Label="lqiOut", Tag=6, Type=uint),
                        ClusterObjectFieldDescriptor(Label="age", Tag=7, Type=uint),
                        ClusterObjectFieldDescriptor(Label="allocated", Tag=8, Type=bool),
                        ClusterObjectFieldDescriptor(Label="linkEstablished", Tag=9, Type=bool),
                    ])

            extAddress: 'uint' = 0
            rloc16: 'uint' = 0
            routerId: 'uint' = 0
            nextHop: 'uint' = 0
            pathCost: 'uint' = 0
            lqiIn: 'uint' = 0
            lqiOut: 'uint' = 0
            age: 'uint' = 0
            allocated: 'bool' = False
            linkEstablished: 'bool' = False

        @dataclass
        class SecurityPolicy(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rotationTime", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="flags", Tag=1, Type=uint),
                    ])

            rotationTime: 'uint' = 0
            flags: 'uint' = 0

        @dataclass
        class OperationalDatasetComponents(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="activeTimestampPresent", Tag=0, Type=bool),
                        ClusterObjectFieldDescriptor(Label="pendingTimestampPresent", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="masterKeyPresent", Tag=2, Type=bool),
                        ClusterObjectFieldDescriptor(Label="networkNamePresent", Tag=3, Type=bool),
                        ClusterObjectFieldDescriptor(Label="extendedPanIdPresent", Tag=4, Type=bool),
                        ClusterObjectFieldDescriptor(Label="meshLocalPrefixPresent", Tag=5, Type=bool),
                        ClusterObjectFieldDescriptor(Label="delayPresent", Tag=6, Type=bool),
                        ClusterObjectFieldDescriptor(Label="panIdPresent", Tag=7, Type=bool),
                        ClusterObjectFieldDescriptor(Label="channelPresent", Tag=8, Type=bool),
                        ClusterObjectFieldDescriptor(Label="pskcPresent", Tag=9, Type=bool),
                        ClusterObjectFieldDescriptor(Label="securityPolicyPresent", Tag=10, Type=bool),
                        ClusterObjectFieldDescriptor(Label="channelMaskPresent", Tag=11, Type=bool),
                    ])

            activeTimestampPresent: 'bool' = False
            pendingTimestampPresent: 'bool' = False
            masterKeyPresent: 'bool' = False
            networkNamePresent: 'bool' = False
            extendedPanIdPresent: 'bool' = False
            meshLocalPrefixPresent: 'bool' = False
            delayPresent: 'bool' = False
            panIdPresent: 'bool' = False
            channelPresent: 'bool' = False
            pskcPresent: 'bool' = False
            securityPolicyPresent: 'bool' = False
            channelMaskPresent: 'bool' = False

    class Commands:
        @dataclass
        class ResetCounts(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000035
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
        class Channel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class RoutingRole(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, ThreadNetworkDiagnostics.Enums.RoutingRoleEnum])

            value: 'typing.Union[Nullable, ThreadNetworkDiagnostics.Enums.RoutingRoleEnum]' = NullValue

        @dataclass
        class NetworkName(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, str])

            value: 'typing.Union[Nullable, str]' = NullValue

        @dataclass
        class PanId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class ExtendedPanId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class MeshLocalPrefix(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, bytes])

            value: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class OverrunCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NeighborTable(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.NeighborTableStruct]])

            value: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.NeighborTableStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class RouteTable(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.RouteTableStruct]])

            value: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Structs.RouteTableStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class PartitionId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class Weighting(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class DataVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class StableDataVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class LeaderRouterId(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class DetachedRoleCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ChildRoleCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RouterRoleCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class LeaderRoleCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AttachAttemptCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class PartitionIdChangeCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class BetterPartitionAttachAttemptCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ParentChangeCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxTotalCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxUnicastCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxBroadcastCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000018

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxAckRequestedCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000019

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxAckedCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxNoAckRequestedCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxDataCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxDataPollCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxBeaconCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxBeaconRequestCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxOtherCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000020

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxRetryCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxDirectMaxRetryExpiryCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxIndirectMaxRetryExpiryCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000023

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxErrCcaCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxErrAbortCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class TxErrBusyChannelCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000026

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxTotalCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000027

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxUnicastCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000028

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxBroadcastCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000029

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxDataCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxDataPollCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxBeaconCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxBeaconRequestCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxOtherCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxAddressFilteredCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxDestAddrFilteredCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxDuplicatedCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxErrNoFrameCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxErrUnknownNeighborCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxErrInvalidSrcAddrCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000034

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxErrSecCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxErrFcsCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RxErrOtherCount(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000037

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ActiveTimestamp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class PendingTimestamp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000039

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Delay(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class SecurityPolicy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.SecurityPolicy])

            value: 'typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.SecurityPolicy]' = NullValue

        @dataclass
        class ChannelPage0Mask(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, bytes])

            value: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class OperationalDatasetComponents(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.OperationalDatasetComponents])

            value: 'typing.Union[Nullable, ThreadNetworkDiagnostics.Structs.OperationalDatasetComponents]' = NullValue

        @dataclass
        class ActiveNetworkFaultsList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]])

            value: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]' = field(default_factory=lambda: [])

        @dataclass
        class ExtAddress(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Rloc16(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000040

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

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
                return 0x00000035

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
                return 0x00000035

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
                return 0x00000035

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
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

    class Events:
        @dataclass
        class ConnectionStatus(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="connectionStatus", Tag=0, Type=ThreadNetworkDiagnostics.Enums.ConnectionStatusEnum),
                    ])

            connectionStatus: 'ThreadNetworkDiagnostics.Enums.ConnectionStatusEnum' = 0

        @dataclass
        class NetworkFaultChange(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="current", Tag=0, Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]),
                        ClusterObjectFieldDescriptor(Label="previous", Tag=1, Type=typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]),
                    ])

            current: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]' = field(default_factory=lambda: [])
            previous: 'typing.List[typing.Optional[ThreadNetworkDiagnostics.Enums.NetworkFaultEnum]]' = field(default_factory=lambda: [])
