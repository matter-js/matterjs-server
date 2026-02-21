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
            kRmsVoltage = 0x08
            kRmsCurrent = 0x09
            kRmsPower = 0x0A
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
            kClosure = 0x01
            kCompassDirection = 0x02
            kCompassLocation = 0x03
            kDirection = 0x04
            kLevel = 0x05
            kLocation = 0x06
            kNumber = 0x07
            kPosition = 0x08
            kElectricalMeasurement = 0x0A
            kLaundry = 0x0E
            kPowerSource = 0x0F
            kAreaNamespace = 0x10
            kLandmarkNamespace = 0x11
            kRelativePosition = 0x12
            kRefrigerator = 0x41
            kRoomAirConditioner = 0x42
            kSwitches = 0x43
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 68

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
                        ClusterObjectFieldDescriptor(Label="attributeId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="statusCode", Tag=1, Type=Globals.Enums.status),
                    ])

            attributeId: 'uint' = 0
            statusCode: 'Globals.Enums.status' = 0

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

            rangeMin: 'int' = 0
            rangeMax: 'int' = 0
            percentMax: 'typing.Optional[uint]' = None
            percentMin: 'typing.Optional[uint]' = None
            percentTypical: 'typing.Optional[uint]' = None
            fixedMax: 'typing.Optional[uint]' = None
            fixedMin: 'typing.Optional[uint]' = None
            fixedTypical: 'typing.Optional[uint]' = None

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
                        ClusterObjectFieldDescriptor(Label="accuracyRanges", Tag=4, Type=typing.List[typing.Optional[Globals.Structs.MeasurementAccuracyRangeStruct]]),
                    ])

            measurementType: 'Globals.Enums.MeasurementTypeEnum' = 0
            measured: 'bool' = False
            minMeasuredValue: 'int' = 0
            maxMeasuredValue: 'int' = 0
            accuracyRanges: 'typing.List[typing.Optional[Globals.Structs.MeasurementAccuracyRangeStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class currency(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="currency", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="decimalPoints", Tag=1, Type=uint),
                    ])

            currency: 'uint' = 0
            decimalPoints: 'uint' = 0

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

            locationName: 'str' = ""
            floorNumber: 'typing.Union[Nullable, int]' = NullValue
            areaType: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class price(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="amount", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="currency", Tag=1, Type=Globals.Structs.currency),
                    ])

            amount: 'uint' = 0
            currency: 'Globals.Structs.currency' = field(default_factory=lambda: Globals.Structs.currency())

        @dataclass
        class semtag(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mfgCode", Tag=0, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="namespaceId", Tag=1, Type=Globals.Enums.namespace),
                        ClusterObjectFieldDescriptor(Label="tag", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="label", Tag=3, Type=typing.Union[None, Nullable, str]),
                    ])

            mfgCode: 'typing.Union[Nullable, uint]' = NullValue
            namespaceId: 'Globals.Enums.namespace' = 0
            tag: 'uint' = 0
            label: 'typing.Union[None, Nullable, str]' = None

        @dataclass
        class struct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

