"""SmokeCoAlarm cluster definition (auto-generated, DO NOT edit)."""

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
class SmokeCoAlarm(Cluster):
    id: typing.ClassVar[int] = 0x0000005C

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="expressedState", Tag=0x00000000, Type=SmokeCoAlarm.Enums.ExpressedStateEnum),
                ClusterObjectFieldDescriptor(Label="smokeState", Tag=0x00000001, Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]),
                ClusterObjectFieldDescriptor(Label="coState", Tag=0x00000002, Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]),
                ClusterObjectFieldDescriptor(Label="batteryAlert", Tag=0x00000003, Type=SmokeCoAlarm.Enums.AlarmStateEnum),
                ClusterObjectFieldDescriptor(Label="deviceMuted", Tag=0x00000004, Type=typing.Optional[SmokeCoAlarm.Enums.MuteStateEnum]),
                ClusterObjectFieldDescriptor(Label="testInProgress", Tag=0x00000005, Type=bool),
                ClusterObjectFieldDescriptor(Label="hardwareFaultAlert", Tag=0x00000006, Type=bool),
                ClusterObjectFieldDescriptor(Label="endOfServiceAlert", Tag=0x00000007, Type=SmokeCoAlarm.Enums.EndOfServiceEnum),
                ClusterObjectFieldDescriptor(Label="interconnectSmokeAlarm", Tag=0x00000008, Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]),
                ClusterObjectFieldDescriptor(Label="interconnectCoAlarm", Tag=0x00000009, Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]),
                ClusterObjectFieldDescriptor(Label="contaminationState", Tag=0x0000000A, Type=typing.Optional[SmokeCoAlarm.Enums.ContaminationStateEnum]),
                ClusterObjectFieldDescriptor(Label="smokeSensitivityLevel", Tag=0x0000000B, Type=typing.Optional[SmokeCoAlarm.Enums.SensitivityEnum]),
                ClusterObjectFieldDescriptor(Label="expiryDate", Tag=0x0000000C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    expressedState: 'SmokeCoAlarm.Enums.ExpressedStateEnum' = 0
    smokeState: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None
    coState: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None
    batteryAlert: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0
    deviceMuted: 'typing.Optional[SmokeCoAlarm.Enums.MuteStateEnum]' = None
    testInProgress: 'bool' = False
    hardwareFaultAlert: 'bool' = False
    endOfServiceAlert: 'SmokeCoAlarm.Enums.EndOfServiceEnum' = 0
    interconnectSmokeAlarm: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None
    interconnectCoAlarm: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None
    contaminationState: 'typing.Optional[SmokeCoAlarm.Enums.ContaminationStateEnum]' = None
    smokeSensitivityLevel: 'typing.Optional[SmokeCoAlarm.Enums.SensitivityEnum]' = None
    expiryDate: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class AlarmStateEnum(MatterIntEnum):
            kNormal = 0x00
            kWarning = 0x01
            kCritical = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class SensitivityEnum(MatterIntEnum):
            kHigh = 0x00
            kStandard = 0x01
            kLow = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ExpressedStateEnum(MatterIntEnum):
            kNormal = 0x00
            kSmokeAlarm = 0x01
            kCoAlarm = 0x02
            kBatteryAlert = 0x03
            kTesting = 0x04
            kHardwareFault = 0x05
            kEndOfService = 0x06
            kInterconnectSmoke = 0x07
            kInterconnectCo = 0x08
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 9

        class MuteStateEnum(MatterIntEnum):
            kNotMuted = 0x00
            kMuted = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class EndOfServiceEnum(MatterIntEnum):
            kNormal = 0x00
            kExpired = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class ContaminationStateEnum(MatterIntEnum):
            kNormal = 0x00
            kLow = 0x01
            kWarning = 0x02
            kCritical = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4


    class Bitmaps:
        class Feature(IntFlag):
            kSmokeAlarm = 0x1
            kCoAlarm = 0x2


    class Commands:
        @dataclass
        class SelfTestRequest(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x0000005C
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
        class ExpressedState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=SmokeCoAlarm.Enums.ExpressedStateEnum)

            value: 'SmokeCoAlarm.Enums.ExpressedStateEnum' = 0

        @dataclass
        class SmokeState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None

        @dataclass
        class CoState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None

        @dataclass
        class BatteryAlert(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=SmokeCoAlarm.Enums.AlarmStateEnum)

            value: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0

        @dataclass
        class DeviceMuted(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.MuteStateEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.MuteStateEnum]' = None

        @dataclass
        class TestInProgress(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class HardwareFaultAlert(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class EndOfServiceAlert(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=SmokeCoAlarm.Enums.EndOfServiceEnum)

            value: 'SmokeCoAlarm.Enums.EndOfServiceEnum' = 0

        @dataclass
        class InterconnectSmokeAlarm(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None

        @dataclass
        class InterconnectCoAlarm(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.AlarmStateEnum]' = None

        @dataclass
        class ContaminationState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.ContaminationStateEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.ContaminationStateEnum]' = None

        @dataclass
        class SmokeSensitivityLevel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[SmokeCoAlarm.Enums.SensitivityEnum])

            value: 'typing.Optional[SmokeCoAlarm.Enums.SensitivityEnum]' = None

        @dataclass
        class ExpiryDate(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

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
                return 0x0000005C

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
                return 0x0000005C

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
                return 0x0000005C

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
                return 0x0000005C

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class SmokeAlarm(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmSeverityLevel", Tag=0, Type=SmokeCoAlarm.Enums.AlarmStateEnum),
                    ])

            alarmSeverityLevel: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0

        @dataclass
        class COAlarm(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmSeverityLevel", Tag=0, Type=SmokeCoAlarm.Enums.AlarmStateEnum),
                    ])

            alarmSeverityLevel: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0

        @dataclass
        class LowBattery(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmSeverityLevel", Tag=0, Type=SmokeCoAlarm.Enums.AlarmStateEnum),
                    ])

            alarmSeverityLevel: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0

        @dataclass
        class HardwareFault(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

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
        class EndOfService(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SelfTestComplete(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class AlarmMuted(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class MuteEnded(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class InterconnectSmokeAlarm(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmSeverityLevel", Tag=0, Type=SmokeCoAlarm.Enums.AlarmStateEnum),
                    ])

            alarmSeverityLevel: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0

        @dataclass
        class InterconnectCOAlarm(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000009

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmSeverityLevel", Tag=0, Type=SmokeCoAlarm.Enums.AlarmStateEnum),
                    ])

            alarmSeverityLevel: 'SmokeCoAlarm.Enums.AlarmStateEnum' = 0

        @dataclass
        class AllClear(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x0000005C

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x0000000A

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

