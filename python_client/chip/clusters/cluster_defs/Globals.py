"""Global datatypes shared across clusters (auto-generated, DO NOT edit)."""

from __future__ import annotations

import typing
from dataclasses import dataclass, field
from enum import IntFlag

from ... import ChipUtility
from ...clusters.enum import MatterIntEnum
from ...tlv import float32, uint
from ..ClusterObjects import (ClusterObject,
                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)
from ..Types import Nullable, NullValue


class Globals:
    class Enums:
        class AtomicRequestTypeEnum(MatterIntEnum):
            kBeginWrite = 0x00
            kCommitWrite = 0x01
            kRollbackWrite = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class MeasurementTypeEnum(MatterIntEnum):
            kUnspecified = 0x00
            kVoltage = 0x01
            kActiveCurrent = 0x02
            kReactiveCurrent = 0x03
            kApparentCurrent = 0x04
            kActivePower = 0x05
            kReactivePower = 0x06
            kApparentPower = 0x07
            kRMSVoltage = 0x08
            kRMSCurrent = 0x09
            kRMSPower = 0x0A
            kFrequency = 0x0B
            kPowerFactor = 0x0C
            kNeutralCurrent = 0x0D
            kElectricalEnergy = 0x0E
            kReactiveEnergy = 0x0F
            kApparentEnergy = 0x10
            kSoilMoisture = 0x11
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 18

        class PowerThresholdSourceEnum(MatterIntEnum):
            kContract = 0x00
            kRegulator = 0x01
            kEquipment = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class SoftwareVersionCertificationStatusEnum(MatterIntEnum):
            kDevTest = 0x00
            kProvisional = 0x01
            kCertified = 0x02
            kRevoked = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class StreamUsageEnum(MatterIntEnum):
            kInternal = 0x00
            kRecording = 0x01
            kAnalysis = 0x02
            kLiveView = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class TariffPriceTypeEnum(MatterIntEnum):
            kStandard = 0x00
            kCritical = 0x01
            kVirtual = 0x02
            kIncentive = 0x03
            kIncentiveSignal = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class TariffUnitEnum(MatterIntEnum):
            kKWh = 0x00
            kKVAh = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

        class ThreeLevelAutoEnum(MatterIntEnum):
            kAuto = 0x00
            kLow = 0x01
            kMedium = 0x02
            kHigh = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class enum16(MatterIntEnum):
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 0

        class enum8(MatterIntEnum):
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 0

        class namespace(MatterIntEnum):
            kCommonClosure = 0x01
            kCommonCompassDirection = 0x02
            kCommonCompassLocation = 0x03
            kCommonDirection = 0x04
            kCommonLevel = 0x05
            kCommonLocation = 0x06
            kCommonNumber = 0x07
            kCommonPosition = 0x08
            kElectricalMeasurement = 0x0A
            kCommodityTariffChronology = 0x0B
            kCommodityTariffCommodity = 0x0D
            kLaundry = 0x0E
            kPowerSource = 0x0F
            kCommonAreaNamespace = 0x10
            kCommonLandmarkNamespace = 0x11
            kCommonRelativePosition = 0x12
            kCommodityTariffFlow = 0x13
            kRefrigerator = 0x41
            kRoomAirConditioner = 0x42
            kSwitches = 0x43
            kClosure = 0x44
            kClosurePanel = 0x45
            kClosureCovering = 0x46
            kClosureWindow = 0x47
            kClosureCabinet = 0x48
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 73

        class priority(MatterIntEnum):
            kDebug = 0x00
            kInfo = 0x01
            kCritical = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class status(MatterIntEnum):
            kSuccess = 0x00
            kFailure = 0x01
            kInvalidSubscription = 0x7D
            kUnsupportedAccess = 0x7E
            kUnsupportedEndpoint = 0x7F
            kInvalidAction = 0x80
            kUnsupportedCommand = 0x81
            kInvalidCommand = 0x85
            kUnsupportedAttribute = 0x86
            kConstraintError = 0x87
            kUnsupportedWrite = 0x88
            kResourceExhausted = 0x89
            kNotFound = 0x8B
            kUnreportableAttribute = 0x8C
            kInvalidDataType = 0x8D
            kUnsupportedRead = 0x8F
            kDataVersionMismatch = 0x92
            kTimeout = 0x94
            kUnsupportedNode = 0x9B
            kBusy = 0x9C
            kAccessRestricted = 0x9D
            kUnsupportedCluster = 0xC3
            kNoUpstreamSubscription = 0xC5
            kNeedsTimedInteraction = 0xC6
            kUnsupportedEvent = 0xC7
            kPathsExhausted = 0xC8
            kTimedRequestMismatch = 0xC9
            kFailsafeRequired = 0xCA
            kInvalidInState = 0xCB
            kNoCommandResponse = 0xCC
            kTermsAndConditionsChanged = 0xCD
            kMaintenanceRequired = 0xCE
            kDynamicConstraintError = 0xCF
            kAlreadyExists = 0xD0
            kInvalidTransportType = 0xD1
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 210


    class Bitmaps:
        class WildcardPathFlagsBitmap(IntFlag):
            kWildcardSkipRootNode = 0x1
            kWildcardSkipGlobalAttributes = 0x2
            kWildcardSkipAttributeList = 0x4
            kDoNotUse = 0x8
            kWildcardSkipCommandLists = 0x10
            kWildcardSkipCustomElements = 0x20
            kWildcardSkipFixedAttributes = 0x40
            kWildcardSkipChangesOmittedAttributes = 0x80
            kWildcardSkipDiagnosticsClusters = 0x100

        class map16(IntFlag):
            pass

        class map32(IntFlag):
            pass

        class map64(IntFlag):
            pass

        class map8(IntFlag):
            pass


    class Structs:
        @dataclass
        class AtomicAttributeStatusStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="attributeID", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="statusCode", Tag=1, Type=Globals.Enums.status),
                    ])

            attributeID: uint = 0
            statusCode: Globals.Enums.status = 0

        @dataclass
        class MeasurementAccuracyRangeStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rangeMin", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="rangeMax", Tag=1, Type=int),
                        ClusterObjectFieldDescriptor(Label="percentMax", Tag=2, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="percentMin", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="percentTypical", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="fixedMax", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="fixedMin", Tag=6, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="fixedTypical", Tag=7, Type=typing.Optional[uint]),
                    ])

            rangeMin: int = 0
            rangeMax: int = 0
            percentMax: typing.Optional[uint] = None
            percentMin: typing.Optional[uint] = None
            percentTypical: typing.Optional[uint] = None
            fixedMax: typing.Optional[uint] = None
            fixedMin: typing.Optional[uint] = None
            fixedTypical: typing.Optional[uint] = None

        @dataclass
        class MeasurementAccuracyStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="measurementType", Tag=0, Type=Globals.Enums.MeasurementTypeEnum),
                        ClusterObjectFieldDescriptor(Label="measured", Tag=1, Type=bool),
                        ClusterObjectFieldDescriptor(Label="minMeasuredValue", Tag=2, Type=int),
                        ClusterObjectFieldDescriptor(Label="maxMeasuredValue", Tag=3, Type=int),
                        ClusterObjectFieldDescriptor(Label="accuracyRanges", Tag=4, Type=typing.List[Globals.Structs.MeasurementAccuracyRangeStruct]),
                    ])

            measurementType: Globals.Enums.MeasurementTypeEnum = 0
            measured: bool = False
            minMeasuredValue: int = 0
            maxMeasuredValue: int = 0
            accuracyRanges: typing.List[Globals.Structs.MeasurementAccuracyRangeStruct] = field(default_factory=lambda: [])

        @dataclass
        class PowerThresholdStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="powerThreshold", Tag=0, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="apparentPowerThreshold", Tag=1, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="powerThresholdSource", Tag=2, Type=typing.Union[Nullable, Globals.Enums.PowerThresholdSourceEnum]),
                    ])

            powerThreshold: typing.Optional[int] = None
            apparentPowerThreshold: typing.Optional[int] = None
            powerThresholdSource: typing.Union[Nullable, Globals.Enums.PowerThresholdSourceEnum] = NullValue

        @dataclass
        class ViewportStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="x1", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="y1", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="x2", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="y2", Tag=3, Type=uint),
                    ])

            x1: uint = 0
            y1: uint = 0
            x2: uint = 0
            y2: uint = 0

        @dataclass
        class currency(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="currency", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="decimalPoints", Tag=1, Type=uint),
                    ])

            currency: uint = 0
            decimalPoints: uint = 0

        @dataclass
        class locationdesc(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="locationName", Tag=0, Type=str),
                        ClusterObjectFieldDescriptor(Label="floorNumber", Tag=1, Type=typing.Union[Nullable, int]),
                        ClusterObjectFieldDescriptor(Label="areaType", Tag=2, Type=typing.Union[Nullable, uint]),
                    ])

            locationName: str = ""
            floorNumber: typing.Union[Nullable, int] = NullValue
            areaType: typing.Union[Nullable, uint] = NullValue

        @dataclass
        class price(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="amount", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="currency", Tag=1, Type=Globals.Structs.currency),
                    ])

            amount: int = 0
            currency: Globals.Structs.currency = field(default_factory=lambda: Globals.Structs.currency())

        @dataclass
        class semtag(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mfgCode", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="namespaceID", Tag=1, Type=Globals.Enums.namespace),
                        ClusterObjectFieldDescriptor(Label="tag", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="label", Tag=3, Type=typing.Union[None, Nullable, str]),
                    ])

            mfgCode: typing.Union[Nullable, uint] = NullValue
            namespaceID: Globals.Enums.namespace = 0
            tag: uint = 0
            label: typing.Union[None, Nullable, str] = None

        @dataclass
        class struct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])


