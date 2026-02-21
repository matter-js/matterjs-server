"""TimeSynchronization cluster definition (auto-generated, DO NOT edit)."""

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
class TimeSynchronization(Cluster):
    id: typing.ClassVar[int] = 0x00000038

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="utcTime", Tag=0x00000000, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="granularity", Tag=0x00000001, Type=TimeSynchronization.Enums.GranularityEnum),
                ClusterObjectFieldDescriptor(Label="timeSource", Tag=0x00000002, Type=typing.Optional[TimeSynchronization.Enums.TimeSourceEnum]),
                ClusterObjectFieldDescriptor(Label="trustedTimeSource", Tag=0x00000003, Type=typing.Union[None, Nullable, TimeSynchronization.Structs.TrustedTimeSourceStruct]),
                ClusterObjectFieldDescriptor(Label="defaultNtp", Tag=0x00000004, Type=typing.Union[None, Nullable, str]),
                ClusterObjectFieldDescriptor(Label="timeZone", Tag=0x00000005, Type=typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.TimeZoneStruct]]]),
                ClusterObjectFieldDescriptor(Label="dstOffset", Tag=0x00000006, Type=typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.DSTOffsetStruct]]]),
                ClusterObjectFieldDescriptor(Label="localTime", Tag=0x00000007, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="timeZoneDatabase", Tag=0x00000008, Type=typing.Optional[TimeSynchronization.Enums.TimeZoneDatabaseEnum]),
                ClusterObjectFieldDescriptor(Label="ntpServerAvailable", Tag=0x00000009, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="timeZoneListMaxSize", Tag=0x0000000A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="dstOffsetListMaxSize", Tag=0x0000000B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="supportsDnsResolve", Tag=0x0000000C, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    utcTime: 'typing.Union[Nullable, uint]' = NullValue
    granularity: 'TimeSynchronization.Enums.GranularityEnum' = 0
    timeSource: 'typing.Optional[TimeSynchronization.Enums.TimeSourceEnum]' = None
    trustedTimeSource: 'typing.Union[None, Nullable, TimeSynchronization.Structs.TrustedTimeSourceStruct]' = None
    defaultNtp: 'typing.Union[None, Nullable, str]' = None
    timeZone: 'typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.TimeZoneStruct]]]' = None
    dstOffset: 'typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.DSTOffsetStruct]]]' = None
    localTime: 'typing.Union[None, Nullable, uint]' = None
    timeZoneDatabase: 'typing.Optional[TimeSynchronization.Enums.TimeZoneDatabaseEnum]' = None
    ntpServerAvailable: 'typing.Optional[bool]' = None
    timeZoneListMaxSize: 'typing.Optional[uint]' = None
    dstOffsetListMaxSize: 'typing.Optional[uint]' = None
    supportsDnsResolve: 'typing.Optional[bool]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class GranularityEnum(MatterIntEnum):
            kNoTimeGranularity = 0x00
            kMinutesGranularity = 0x01
            kSecondsGranularity = 0x02
            kMillisecondsGranularity = 0x03
            kMicrosecondsGranularity = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class TimeSourceEnum(MatterIntEnum):
            kNone = 0x00
            kUnknown = 0x01
            kAdmin = 0x02
            kNodeTimeCluster = 0x03
            kNonMatterSntp = 0x04
            kNonMatterNtp = 0x05
            kMatterSntp = 0x06
            kMatterNtp = 0x07
            kMixedNtp = 0x08
            kNonMatterSntpnts = 0x09
            kNonMatterNtpnts = 0x0A
            kMatterSntpnts = 0x0B
            kMatterNtpnts = 0x0C
            kMixedNtpnts = 0x0D
            kCloudSource = 0x0E
            kPtp = 0x0F
            kGnss = 0x10
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 17

        class TimeZoneDatabaseEnum(MatterIntEnum):
            kFull = 0x00
            kPartial = 0x01
            kNone = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class StatusCodeEnum(MatterIntEnum):
            kTimeNotAccepted = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3


    class Bitmaps:
        class Feature(IntFlag):
            kTimeZone = 0x1
            kNtpClient = 0x2
            kNtpServer = 0x4
            kTimeSyncClient = 0x8


    class Structs:
        @dataclass
        class TrustedTimeSourceStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="nodeId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=2, Type=uint),
                    ])

            fabricIndex: 'uint' = 0
            nodeId: 'uint' = 0
            endpoint: 'uint' = 0

        @dataclass
        class FabricScopedTrustedTimeSourceStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="nodeId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endpoint", Tag=1, Type=uint),
                    ])

            nodeId: 'uint' = 0
            endpoint: 'uint' = 0

        @dataclass
        class TimeZoneStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="offset", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="validAt", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="name", Tag=2, Type=typing.Optional[str]),
                    ])

            offset: 'int' = 0
            validAt: 'uint' = 0
            name: 'typing.Optional[str]' = None

        @dataclass
        class DSTOffsetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="offset", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="validStarting", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="validUntil", Tag=2, Type=typing.Union[Nullable, uint]),
                    ])

            offset: 'int' = 0
            validStarting: 'uint' = 0
            validUntil: 'typing.Union[Nullable, uint]' = NullValue


    class Commands:
        @dataclass
        class SetUTCTime(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000038
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="utcTime", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="granularity", Tag=1, Type=TimeSynchronization.Enums.GranularityEnum),
                        ClusterObjectFieldDescriptor(Label="timeSource", Tag=2, Type=typing.Optional[TimeSynchronization.Enums.TimeSourceEnum]),
                    ])

            utcTime: 'uint' = 0
            granularity: 'TimeSynchronization.Enums.GranularityEnum' = 0
            timeSource: 'typing.Optional[TimeSynchronization.Enums.TimeSourceEnum]' = None

        @dataclass
        class SetTrustedTimeSource(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000038
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="trustedTimeSource", Tag=0, Type=typing.Union[Nullable, TimeSynchronization.Structs.FabricScopedTrustedTimeSourceStruct]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            trustedTimeSource: 'typing.Union[Nullable, TimeSynchronization.Structs.FabricScopedTrustedTimeSourceStruct]' = NullValue
            fabricIndex: 'uint' = 0

        @dataclass
        class SetTimeZone(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000038
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SetTimeZoneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeZone", Tag=0, Type=typing.List[typing.Optional[TimeSynchronization.Structs.TimeZoneStruct]]),
                    ])

            timeZone: 'typing.List[typing.Optional[TimeSynchronization.Structs.TimeZoneStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class SetDSTOffset(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000038
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="dstOffset", Tag=0, Type=typing.List[typing.Optional[TimeSynchronization.Structs.DSTOffsetStruct]]),
                    ])

            dstOffset: 'typing.List[typing.Optional[TimeSynchronization.Structs.DSTOffsetStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class SetDefaultNTP(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000038
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="defaultNtp", Tag=0, Type=typing.Union[Nullable, str]),
                    ])

            defaultNtp: 'typing.Union[Nullable, str]' = NullValue

        @dataclass
        class SetTimeZoneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000038
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="dstOffsetRequired", Tag=0, Type=bool),
                    ])

            dstOffsetRequired: 'bool' = False


    class Attributes:
        @dataclass
        class UtcTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class Granularity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=TimeSynchronization.Enums.GranularityEnum)

            value: 'TimeSynchronization.Enums.GranularityEnum' = 0

        @dataclass
        class TimeSource(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[TimeSynchronization.Enums.TimeSourceEnum])

            value: 'typing.Optional[TimeSynchronization.Enums.TimeSourceEnum]' = None

        @dataclass
        class TrustedTimeSource(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, TimeSynchronization.Structs.TrustedTimeSourceStruct])

            value: 'typing.Union[None, Nullable, TimeSynchronization.Structs.TrustedTimeSourceStruct]' = None

        @dataclass
        class DefaultNtp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, str])

            value: 'typing.Union[None, Nullable, str]' = None

        @dataclass
        class TimeZone(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.TimeZoneStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.TimeZoneStruct]]]' = None

        @dataclass
        class DstOffset(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.DSTOffsetStruct]]])

            value: 'typing.Optional[typing.List[typing.Optional[TimeSynchronization.Structs.DSTOffsetStruct]]]' = None

        @dataclass
        class LocalTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class TimeZoneDatabase(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[TimeSynchronization.Enums.TimeZoneDatabaseEnum])

            value: 'typing.Optional[TimeSynchronization.Enums.TimeZoneDatabaseEnum]' = None

        @dataclass
        class NtpServerAvailable(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class TimeZoneListMaxSize(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class DstOffsetListMaxSize(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SupportsDnsResolve(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

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
                return 0x00000038

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
                return 0x00000038

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
                return 0x00000038

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
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class DSTTableEmpty(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class DSTStatus(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="dstOffsetActive", Tag=0, Type=bool),
                    ])

            dstOffsetActive: 'bool' = False

        @dataclass
        class TimeZoneStatus(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="offset", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="name", Tag=1, Type=typing.Optional[str]),
                    ])

            offset: 'int' = 0
            name: 'typing.Optional[str]' = None

        @dataclass
        class TimeFailure(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class MissingTrustedTimeSource(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

