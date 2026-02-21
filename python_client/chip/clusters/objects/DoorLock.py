"""DoorLock cluster definition (auto-generated, DO NOT edit)."""

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
class DoorLock(Cluster):
    id: typing.ClassVar[int] = 0x00000101

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="lockState", Tag=0x00000000, Type=typing.Union[Nullable, DoorLock.Enums.LockStateEnum]),
                ClusterObjectFieldDescriptor(Label="lockType", Tag=0x00000001, Type=DoorLock.Enums.LockTypeEnum),
                ClusterObjectFieldDescriptor(Label="actuatorEnabled", Tag=0x00000002, Type=bool),
                ClusterObjectFieldDescriptor(Label="doorState", Tag=0x00000003, Type=typing.Union[None, Nullable, DoorLock.Enums.DoorStateEnum]),
                ClusterObjectFieldDescriptor(Label="doorOpenEvents", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="doorClosedEvents", Tag=0x00000005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="openPeriod", Tag=0x00000006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfTotalUsersSupported", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfPinUsersSupported", Tag=0x00000012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfRfidUsersSupported", Tag=0x00000013, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfWeekDaySchedulesSupportedPerUser", Tag=0x00000014, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfYearDaySchedulesSupportedPerUser", Tag=0x00000015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfHolidaySchedulesSupported", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxPinCodeLength", Tag=0x00000017, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minPinCodeLength", Tag=0x00000018, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="maxRfidCodeLength", Tag=0x00000019, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="minRfidCodeLength", Tag=0x0000001A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="credentialRulesSupport", Tag=0x0000001B, Type=typing.Optional[DoorLock.Bitmaps.CredentialRulesBitmap]),
                ClusterObjectFieldDescriptor(Label="numberOfCredentialsSupportedPerUser", Tag=0x0000001C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="language", Tag=0x00000021, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="ledSettings", Tag=0x00000022, Type=typing.Optional[DoorLock.Enums.LEDSettingEnum]),
                ClusterObjectFieldDescriptor(Label="autoRelockTime", Tag=0x00000023, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="soundVolume", Tag=0x00000024, Type=typing.Optional[DoorLock.Enums.SoundVolumeEnum]),
                ClusterObjectFieldDescriptor(Label="operatingMode", Tag=0x00000025, Type=DoorLock.Enums.OperatingModeEnum),
                ClusterObjectFieldDescriptor(Label="supportedOperatingModes", Tag=0x00000026, Type=DoorLock.Bitmaps.OperatingModesBitmap),
                ClusterObjectFieldDescriptor(Label="defaultConfigurationRegister", Tag=0x00000027, Type=typing.Optional[DoorLock.Bitmaps.ConfigurationRegisterBitmap]),
                ClusterObjectFieldDescriptor(Label="enableLocalProgramming", Tag=0x00000028, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableOneTouchLocking", Tag=0x00000029, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enableInsideStatusLed", Tag=0x0000002A, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="enablePrivacyModeButton", Tag=0x0000002B, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="localProgrammingFeatures", Tag=0x0000002C, Type=typing.Optional[DoorLock.Bitmaps.LocalProgrammingFeaturesBitmap]),
                ClusterObjectFieldDescriptor(Label="wrongCodeEntryLimit", Tag=0x00000030, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="userCodeTemporaryDisableTime", Tag=0x00000031, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="sendPinOverTheAir", Tag=0x00000032, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="requirePinForRemoteOperation", Tag=0x00000033, Type=typing.Optional[bool]),
                ClusterObjectFieldDescriptor(Label="securityLevel", Tag=0x00000034, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="expiringUserTimeout", Tag=0x00000035, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="aliroReaderVerificationKey", Tag=0x00000080, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="aliroReaderGroupIdentifier", Tag=0x00000081, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="aliroReaderGroupSubIdentifier", Tag=0x00000082, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="aliroExpeditedTransactionSupportedProtocolVersions", Tag=0x00000083, Type=typing.Optional[typing.List[typing.Optional[bytes]]]),
                ClusterObjectFieldDescriptor(Label="aliroGroupResolvingKey", Tag=0x00000084, Type=typing.Union[None, Nullable, bytes]),
                ClusterObjectFieldDescriptor(Label="aliroSupportedBleuwbProtocolVersions", Tag=0x00000085, Type=typing.Optional[typing.List[typing.Optional[bytes]]]),
                ClusterObjectFieldDescriptor(Label="aliroBleAdvertisingVersion", Tag=0x00000086, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfAliroCredentialIssuerKeysSupported", Tag=0x00000087, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="numberOfAliroEndpointKeysSupported", Tag=0x00000088, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    lockState: 'typing.Union[Nullable, DoorLock.Enums.LockStateEnum]' = NullValue
    lockType: 'DoorLock.Enums.LockTypeEnum' = 0
    actuatorEnabled: 'bool' = False
    doorState: 'typing.Union[None, Nullable, DoorLock.Enums.DoorStateEnum]' = None
    doorOpenEvents: 'typing.Optional[uint]' = None
    doorClosedEvents: 'typing.Optional[uint]' = None
    openPeriod: 'typing.Optional[uint]' = None
    numberOfTotalUsersSupported: 'typing.Optional[uint]' = None
    numberOfPinUsersSupported: 'typing.Optional[uint]' = None
    numberOfRfidUsersSupported: 'typing.Optional[uint]' = None
    numberOfWeekDaySchedulesSupportedPerUser: 'typing.Optional[uint]' = None
    numberOfYearDaySchedulesSupportedPerUser: 'typing.Optional[uint]' = None
    numberOfHolidaySchedulesSupported: 'typing.Optional[uint]' = None
    maxPinCodeLength: 'typing.Optional[uint]' = None
    minPinCodeLength: 'typing.Optional[uint]' = None
    maxRfidCodeLength: 'typing.Optional[uint]' = None
    minRfidCodeLength: 'typing.Optional[uint]' = None
    credentialRulesSupport: 'typing.Optional[DoorLock.Bitmaps.CredentialRulesBitmap]' = None
    numberOfCredentialsSupportedPerUser: 'typing.Optional[uint]' = None
    language: 'typing.Optional[str]' = None
    ledSettings: 'typing.Optional[DoorLock.Enums.LEDSettingEnum]' = None
    autoRelockTime: 'typing.Optional[uint]' = None
    soundVolume: 'typing.Optional[DoorLock.Enums.SoundVolumeEnum]' = None
    operatingMode: 'DoorLock.Enums.OperatingModeEnum' = 0
    supportedOperatingModes: 'DoorLock.Bitmaps.OperatingModesBitmap' = 0
    defaultConfigurationRegister: 'typing.Optional[DoorLock.Bitmaps.ConfigurationRegisterBitmap]' = None
    enableLocalProgramming: 'typing.Optional[bool]' = None
    enableOneTouchLocking: 'typing.Optional[bool]' = None
    enableInsideStatusLed: 'typing.Optional[bool]' = None
    enablePrivacyModeButton: 'typing.Optional[bool]' = None
    localProgrammingFeatures: 'typing.Optional[DoorLock.Bitmaps.LocalProgrammingFeaturesBitmap]' = None
    wrongCodeEntryLimit: 'typing.Optional[uint]' = None
    userCodeTemporaryDisableTime: 'typing.Optional[uint]' = None
    sendPinOverTheAir: 'typing.Optional[bool]' = None
    requirePinForRemoteOperation: 'typing.Optional[bool]' = None
    securityLevel: 'typing.Optional[uint]' = None
    expiringUserTimeout: 'typing.Optional[uint]' = None
    aliroReaderVerificationKey: 'typing.Union[None, Nullable, bytes]' = None
    aliroReaderGroupIdentifier: 'typing.Union[None, Nullable, bytes]' = None
    aliroReaderGroupSubIdentifier: 'typing.Optional[bytes]' = None
    aliroExpeditedTransactionSupportedProtocolVersions: 'typing.Optional[typing.List[typing.Optional[bytes]]]' = None
    aliroGroupResolvingKey: 'typing.Union[None, Nullable, bytes]' = None
    aliroSupportedBleuwbProtocolVersions: 'typing.Optional[typing.List[typing.Optional[bytes]]]' = None
    aliroBleAdvertisingVersion: 'typing.Optional[uint]' = None
    numberOfAliroCredentialIssuerKeysSupported: 'typing.Optional[uint]' = None
    numberOfAliroEndpointKeysSupported: 'typing.Optional[uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class AlarmCodeEnum(MatterIntEnum):
            kLockJammed = 0x00
            kLockFactoryReset = 0x01
            kLockRadioPowerCycled = 0x03
            kWrongCodeEntryLimit = 0x04
            kFrontEsceutcheonRemoved = 0x05
            kDoorForcedOpen = 0x06
            kDoorAjar = 0x07
            kForcedUser = 0x08
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 9

        class CredentialRuleEnum(MatterIntEnum):
            kSingle = 0x00
            kDual = 0x01
            kTri = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class CredentialTypeEnum(MatterIntEnum):
            kProgrammingPin = 0x00
            kPin = 0x01
            kRfid = 0x02
            kFingerprint = 0x03
            kFingerVein = 0x04
            kFace = 0x05
            kAliroCredentialIssuerKey = 0x06
            kAliroEvictableEndpointKey = 0x07
            kAliroNonEvictableEndpointKey = 0x08
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 9

        class DataOperationTypeEnum(MatterIntEnum):
            kAdd = 0x00
            kClear = 0x01
            kModify = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class DoorStateEnum(MatterIntEnum):
            kDoorOpen = 0x00
            kDoorClosed = 0x01
            kDoorJammed = 0x02
            kDoorForcedOpen = 0x03
            kDoorUnspecifiedError = 0x04
            kDoorAjar = 0x05
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 6

        class LockDataTypeEnum(MatterIntEnum):
            kUnspecified = 0x00
            kProgrammingCode = 0x01
            kUserIndex = 0x02
            kWeekDaySchedule = 0x03
            kYearDaySchedule = 0x04
            kHolidaySchedule = 0x05
            kPin = 0x06
            kRfid = 0x07
            kFingerprint = 0x08
            kFingerVein = 0x09
            kFace = 0x0A
            kAliroCredentialIssuerKey = 0x0B
            kAliroEvictableEndpointKey = 0x0C
            kAliroNonEvictableEndpointKey = 0x0D
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 14

        class LockOperationTypeEnum(MatterIntEnum):
            kLock = 0x00
            kUnlock = 0x01
            kNonAccessUserEvent = 0x02
            kForcedUserEvent = 0x03
            kUnlatch = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class OperationErrorEnum(MatterIntEnum):
            kUnspecified = 0x00
            kInvalidCredential = 0x01
            kDisabledUserDenied = 0x02
            kRestricted = 0x03
            kInsufficientBattery = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class OperatingModeEnum(MatterIntEnum):
            kNormal = 0x00
            kVacation = 0x01
            kPrivacy = 0x02
            kNoRemoteLockUnlock = 0x03
            kPassage = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class OperationSourceEnum(MatterIntEnum):
            kUnspecified = 0x00
            kManual = 0x01
            kProprietaryRemote = 0x02
            kKeypad = 0x03
            kAuto = 0x04
            kButton = 0x05
            kSchedule = 0x06
            kRemote = 0x07
            kRfid = 0x08
            kBiometric = 0x09
            kAliro = 0x0A
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 11

        class UserStatusEnum(MatterIntEnum):
            kAvailable = 0x00
            kOccupiedEnabled = 0x01
            kOccupiedDisabled = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class UserTypeEnum(MatterIntEnum):
            kUnrestrictedUser = 0x00
            kYearDayScheduleUser = 0x01
            kWeekDayScheduleUser = 0x02
            kProgrammingUser = 0x03
            kNonAccessUser = 0x04
            kForcedUser = 0x05
            kDisposableUser = 0x06
            kExpiringUser = 0x07
            kScheduleRestrictedUser = 0x08
            kRemoteOnlyUser = 0x09
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 10

        class LockStateEnum(MatterIntEnum):
            kNotFullyLocked = 0x00
            kLocked = 0x01
            kUnlocked = 0x02
            kUnlatched = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class LockTypeEnum(MatterIntEnum):
            kDeadBolt = 0x00
            kMagnetic = 0x01
            kOther = 0x02
            kMortise = 0x03
            kRim = 0x04
            kLatchBolt = 0x05
            kCylindricalLock = 0x06
            kTubularLock = 0x07
            kInterconnectedLock = 0x08
            kDeadLatch = 0x09
            kDoorFurniture = 0x0A
            kEurocylinder = 0x0B
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 12

        class LEDSettingEnum(MatterIntEnum):
            kNoLedSignal = 0x00
            kNoLedSignalAccessAllowed = 0x01
            kLedSignalAll = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class SoundVolumeEnum(MatterIntEnum):
            kSilent = 0x00
            kLow = 0x01
            kHigh = 0x02
            kMedium = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class EventTypeEnum(MatterIntEnum):
            kOperation = 0x00
            kProgramming = 0x01
            kAlarm = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class StatusCodeEnum(MatterIntEnum):
            kDuplicate = 0x02
            kOccupied = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4


    class Bitmaps:
        class Feature(IntFlag):
            kPinCredential = 0x1
            kRfidCredential = 0x2
            kFingerCredentials = 0x4
            kWeekDayAccessSchedules = 0x10
            kDoorPositionSensor = 0x20
            kFaceCredentials = 0x40
            kCredentialOverTheAirAccess = 0x80
            kUser = 0x100
            kYearDayAccessSchedules = 0x400
            kHolidaySchedules = 0x800
            kUnbolting = 0x1000
            kAliroProvisioning = 0x2000
            kAliroBleuwb = 0x4000

        class DaysMaskBitmap(IntFlag):
            kSunday = 0x1
            kMonday = 0x2
            kTuesday = 0x4
            kWednesday = 0x8
            kThursday = 0x10
            kFriday = 0x20
            kSaturday = 0x40

        class CredentialRulesBitmap(IntFlag):
            kSingle = 0x1
            kDual = 0x2
            kTri = 0x4

        class OperatingModesBitmap(IntFlag):
            kNormal = 0x1
            kVacation = 0x2
            kPrivacy = 0x4
            kNoRemoteLockUnlock = 0x8
            kPassage = 0x10
            kAlwaysSet = 0x1

        class ConfigurationRegisterBitmap(IntFlag):
            kLocalProgramming = 0x1
            kKeypadInterface = 0x2
            kRemoteInterface = 0x4
            kSoundVolume = 0x20
            kAutoRelockTime = 0x40
            kLedSettings = 0x80

        class LocalProgrammingFeaturesBitmap(IntFlag):
            kAddUsersCredentialsSchedules = 0x1
            kModifyUsersCredentialsSchedules = 0x2
            kClearUsersCredentialsSchedules = 0x4
            kAdjustSettings = 0x8

        class AlarmMaskBitmap(IntFlag):
            kLockJammed = 0x1
            kLockFactoryReset = 0x2
            kLockRadioPowerCycled = 0x8
            kWrongCodeEntryLimit = 0x10
            kFrontEscutcheonRemoved = 0x20
            kDoorForcedOpen = 0x40


    class Structs:
        @dataclass
        class CredentialStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="credentialType", Tag=0, Type=DoorLock.Enums.CredentialTypeEnum),
                        ClusterObjectFieldDescriptor(Label="credentialIndex", Tag=1, Type=uint),
                    ])

            credentialType: 'DoorLock.Enums.CredentialTypeEnum' = 0
            credentialIndex: 'uint' = 0


    class Commands:
        @dataclass
        class LockDoor(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=0, Type=typing.Optional[bytes]),
                    ])

            pinCode: 'typing.Optional[bytes]' = None

        @dataclass
        class UnlockDoor(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=0, Type=typing.Optional[bytes]),
                    ])

            pinCode: 'typing.Optional[bytes]' = None

        @dataclass
        class Toggle(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class UnlockWithTimeout(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="timeout", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=1, Type=typing.Optional[bytes]),
                    ])

            timeout: 'uint' = 0
            pinCode: 'typing.Optional[bytes]' = None

        @dataclass
        class SetPinCode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=1, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=2, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                        ClusterObjectFieldDescriptor(Label="pin", Tag=3, Type=bytes),
                    ])

            userId: 'uint' = 0
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue
            pin: 'bytes' = b""

        @dataclass
        class GetPinCode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetPinCodeResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                    ])

            userId: 'uint' = 0

        @dataclass
        class ClearPinCode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pinSlotIndex", Tag=0, Type=uint),
                    ])

            pinSlotIndex: 'uint' = 0

        @dataclass
        class ClearAllPinCodes(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SetUserStatus(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=1, Type=DoorLock.Enums.UserStatusEnum),
                    ])

            userId: 'uint' = 0
            userStatus: 'DoorLock.Enums.UserStatusEnum' = 0

        @dataclass
        class GetUserStatus(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetUserStatusResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                    ])

            userId: 'uint' = 0

        @dataclass
        class SetWeekDaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="weekDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="daysMask", Tag=2, Type=DoorLock.Bitmaps.DaysMaskBitmap),
                        ClusterObjectFieldDescriptor(Label="startHour", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="startMinute", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endHour", Tag=5, Type=uint),
                        ClusterObjectFieldDescriptor(Label="endMinute", Tag=6, Type=uint),
                    ])

            weekDayIndex: 'uint' = 0
            userIndex: 'uint' = 0
            daysMask: 'DoorLock.Bitmaps.DaysMaskBitmap' = 0
            startHour: 'uint' = 0
            startMinute: 'uint' = 0
            endHour: 'uint' = 0
            endMinute: 'uint' = 0

        @dataclass
        class GetWeekDaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetWeekDayScheduleResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="weekDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                    ])

            weekDayIndex: 'uint' = 0
            userIndex: 'uint' = 0

        @dataclass
        class ClearWeekDaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="weekDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                    ])

            weekDayIndex: 'uint' = 0
            userIndex: 'uint' = 0

        @dataclass
        class SetYearDaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000E
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="yearDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="localStartTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="localEndTime", Tag=3, Type=uint),
                    ])

            yearDayIndex: 'uint' = 0
            userIndex: 'uint' = 0
            localStartTime: 'uint' = 0
            localEndTime: 'uint' = 0

        @dataclass
        class GetYearDaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000F
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetYearDayScheduleResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="yearDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                    ])

            yearDayIndex: 'uint' = 0
            userIndex: 'uint' = 0

        @dataclass
        class ClearYearDaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000010
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="yearDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                    ])

            yearDayIndex: 'uint' = 0
            userIndex: 'uint' = 0

        @dataclass
        class SetHolidaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000011
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="holidayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="localStartTime", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="localEndTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="operatingMode", Tag=3, Type=DoorLock.Enums.OperatingModeEnum),
                    ])

            holidayIndex: 'uint' = 0
            localStartTime: 'uint' = 0
            localEndTime: 'uint' = 0
            operatingMode: 'DoorLock.Enums.OperatingModeEnum' = 0

        @dataclass
        class GetHolidaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000012
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetHolidayScheduleResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="holidayIndex", Tag=0, Type=uint),
                    ])

            holidayIndex: 'uint' = 0

        @dataclass
        class ClearHolidaySchedule(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000013
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="holidayIndex", Tag=0, Type=uint),
                    ])

            holidayIndex: 'uint' = 0

        @dataclass
        class SetUserType(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000014
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=1, Type=DoorLock.Enums.UserTypeEnum),
                    ])

            userId: 'uint' = 0
            userType: 'DoorLock.Enums.UserTypeEnum' = 0

        @dataclass
        class GetUserType(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000015
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetUserTypeResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                    ])

            userId: 'uint' = 0

        @dataclass
        class SetRfidCode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000016
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=1, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=2, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                        ClusterObjectFieldDescriptor(Label="rfidCode", Tag=3, Type=bytes),
                    ])

            userId: 'uint' = 0
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue
            rfidCode: 'bytes' = b""

        @dataclass
        class GetRfidCode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000017
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetRfidCodeResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                    ])

            userId: 'uint' = 0

        @dataclass
        class ClearRfidCode(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000018
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rfidSlotIndex", Tag=0, Type=uint),
                    ])

            rfidSlotIndex: 'uint' = 0

        @dataclass
        class ClearAllRfidCodes(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000019
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class SetUser(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000001A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operationType", Tag=0, Type=DoorLock.Enums.DataOperationTypeEnum),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userName", Tag=2, Type=typing.Union[Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="userUniqueId", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=4, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=5, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                        ClusterObjectFieldDescriptor(Label="credentialRule", Tag=6, Type=typing.Union[Nullable, DoorLock.Enums.CredentialRuleEnum]),
                    ])

            operationType: 'DoorLock.Enums.DataOperationTypeEnum' = 0
            userIndex: 'uint' = 0
            userName: 'typing.Union[Nullable, str]' = NullValue
            userUniqueId: 'typing.Union[Nullable, uint]' = NullValue
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue
            credentialRule: 'typing.Union[Nullable, DoorLock.Enums.CredentialRuleEnum]' = NullValue

        @dataclass
        class GetUser(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000001B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetUserResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=0, Type=uint),
                    ])

            userIndex: 'uint' = 0

        @dataclass
        class ClearUser(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000001D
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=0, Type=uint),
                    ])

            userIndex: 'uint' = 0

        @dataclass
        class SetCredential(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000022
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'SetCredentialResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="operationType", Tag=0, Type=DoorLock.Enums.DataOperationTypeEnum),
                        ClusterObjectFieldDescriptor(Label="credential", Tag=1, Type=DoorLock.Structs.CredentialStruct),
                        ClusterObjectFieldDescriptor(Label="credentialData", Tag=2, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=4, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=5, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                    ])

            operationType: 'DoorLock.Enums.DataOperationTypeEnum' = 0
            credential: 'DoorLock.Structs.CredentialStruct' = field(default_factory=lambda: DoorLock.Structs.CredentialStruct())
            credentialData: 'bytes' = b""
            userIndex: 'typing.Union[Nullable, uint]' = NullValue
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue

        @dataclass
        class GetCredentialStatus(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000024
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetCredentialStatusResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="credential", Tag=0, Type=DoorLock.Structs.CredentialStruct),
                    ])

            credential: 'DoorLock.Structs.CredentialStruct' = field(default_factory=lambda: DoorLock.Structs.CredentialStruct())

        @dataclass
        class ClearCredential(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000026
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="credential", Tag=0, Type=typing.Union[Nullable, DoorLock.Structs.CredentialStruct]),
                    ])

            credential: 'typing.Union[Nullable, DoorLock.Structs.CredentialStruct]' = NullValue

        @dataclass
        class UnboltDoor(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000027
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=0, Type=typing.Optional[bytes]),
                    ])

            pinCode: 'typing.Optional[bytes]' = None

        @dataclass
        class SetAliroReaderConfig(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000028
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="signingKey", Tag=0, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="verificationKey", Tag=1, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="groupIdentifier", Tag=2, Type=bytes),
                        ClusterObjectFieldDescriptor(Label="groupResolvingKey", Tag=3, Type=typing.Optional[bytes]),
                    ])

            signingKey: 'bytes' = b""
            verificationKey: 'bytes' = b""
            groupIdentifier: 'bytes' = b""
            groupResolvingKey: 'typing.Optional[bytes]' = None

        @dataclass
        class ClearAliroReaderConfig(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000029
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                    ])

            pass

        @dataclass
        class GetPinCodeResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=1, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=2, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                        ClusterObjectFieldDescriptor(Label="pinCode", Tag=3, Type=typing.Union[Nullable, bytes]),
                    ])

            userId: 'uint' = 0
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue
            pinCode: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class GetUserStatusResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=1, Type=DoorLock.Enums.UserStatusEnum),
                    ])

            userId: 'uint' = 0
            userStatus: 'DoorLock.Enums.UserStatusEnum' = 0

        @dataclass
        class GetWeekDayScheduleResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000C
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="weekDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="status", Tag=2, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="daysMask", Tag=3, Type=typing.Optional[DoorLock.Bitmaps.DaysMaskBitmap]),
                        ClusterObjectFieldDescriptor(Label="startHour", Tag=4, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="startMinute", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endHour", Tag=6, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="endMinute", Tag=7, Type=typing.Optional[uint]),
                    ])

            weekDayIndex: 'uint' = 0
            userIndex: 'uint' = 0
            status: 'Globals.Enums.status' = 0
            daysMask: 'typing.Optional[DoorLock.Bitmaps.DaysMaskBitmap]' = None
            startHour: 'typing.Optional[uint]' = None
            startMinute: 'typing.Optional[uint]' = None
            endHour: 'typing.Optional[uint]' = None
            endMinute: 'typing.Optional[uint]' = None

        @dataclass
        class GetYearDayScheduleResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000000F
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="yearDayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="status", Tag=2, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="localStartTime", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="localEndTime", Tag=4, Type=typing.Optional[uint]),
                    ])

            yearDayIndex: 'uint' = 0
            userIndex: 'uint' = 0
            status: 'Globals.Enums.status' = 0
            localStartTime: 'typing.Optional[uint]' = None
            localEndTime: 'typing.Optional[uint]' = None

        @dataclass
        class GetHolidayScheduleResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000012
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="holidayIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="status", Tag=1, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="localStartTime", Tag=2, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="localEndTime", Tag=3, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="operatingMode", Tag=4, Type=typing.Union[None, Nullable, DoorLock.Enums.OperatingModeEnum]),
                    ])

            holidayIndex: 'uint' = 0
            status: 'Globals.Enums.status' = 0
            localStartTime: 'typing.Union[None, Nullable, uint]' = None
            localEndTime: 'typing.Union[None, Nullable, uint]' = None
            operatingMode: 'typing.Union[None, Nullable, DoorLock.Enums.OperatingModeEnum]' = None

        @dataclass
        class GetUserTypeResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000015
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=1, Type=DoorLock.Enums.UserTypeEnum),
                    ])

            userId: 'uint' = 0
            userType: 'DoorLock.Enums.UserTypeEnum' = 0

        @dataclass
        class GetRfidCodeResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000017
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=1, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=2, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                        ClusterObjectFieldDescriptor(Label="rfidCode", Tag=3, Type=typing.Union[Nullable, bytes]),
                    ])

            userId: 'uint' = 0
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue
            rfidCode: 'typing.Union[Nullable, bytes]' = NullValue

        @dataclass
        class GetUserResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x0000001C
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="userName", Tag=1, Type=typing.Union[Nullable, str]),
                        ClusterObjectFieldDescriptor(Label="userUniqueId", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="userStatus", Tag=3, Type=typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]),
                        ClusterObjectFieldDescriptor(Label="userType", Tag=4, Type=typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]),
                        ClusterObjectFieldDescriptor(Label="credentialRule", Tag=5, Type=typing.Union[Nullable, DoorLock.Enums.CredentialRuleEnum]),
                        ClusterObjectFieldDescriptor(Label="credentials", Tag=6, Type=typing.Union[Nullable, typing.List[typing.Optional[DoorLock.Structs.CredentialStruct]]]),
                        ClusterObjectFieldDescriptor(Label="creatorFabricIndex", Tag=7, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="lastModifiedFabricIndex", Tag=8, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="nextUserIndex", Tag=9, Type=typing.Union[Nullable, uint]),
                    ])

            userIndex: 'uint' = 0
            userName: 'typing.Union[Nullable, str]' = NullValue
            userUniqueId: 'typing.Union[Nullable, uint]' = NullValue
            userStatus: 'typing.Union[Nullable, DoorLock.Enums.UserStatusEnum]' = NullValue
            userType: 'typing.Union[Nullable, DoorLock.Enums.UserTypeEnum]' = NullValue
            credentialRule: 'typing.Union[Nullable, DoorLock.Enums.CredentialRuleEnum]' = NullValue
            credentials: 'typing.Union[Nullable, typing.List[typing.Optional[DoorLock.Structs.CredentialStruct]]]' = NullValue
            creatorFabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            lastModifiedFabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            nextUserIndex: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class SetCredentialResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000023
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="nextCredentialIndex", Tag=2, Type=typing.Union[None, Nullable, uint]),
                    ])

            status: 'Globals.Enums.status' = 0
            userIndex: 'typing.Union[Nullable, uint]' = NullValue
            nextCredentialIndex: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GetCredentialStatusResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000101
            command_id: typing.ClassVar[int] = 0x00000025
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="credentialExists", Tag=0, Type=bool),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="creatorFabricIndex", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="lastModifiedFabricIndex", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="nextCredentialIndex", Tag=4, Type=typing.Union[None, Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="credentialData", Tag=5, Type=typing.Union[None, Nullable, bytes]),
                    ])

            credentialExists: 'bool' = False
            userIndex: 'typing.Union[Nullable, uint]' = NullValue
            creatorFabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            lastModifiedFabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            nextCredentialIndex: 'typing.Union[None, Nullable, uint]' = None
            credentialData: 'typing.Union[None, Nullable, bytes]' = None


    class Attributes:
        @dataclass
        class LockState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, DoorLock.Enums.LockStateEnum])

            value: 'typing.Union[Nullable, DoorLock.Enums.LockStateEnum]' = NullValue

        @dataclass
        class LockType(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DoorLock.Enums.LockTypeEnum)

            value: 'DoorLock.Enums.LockTypeEnum' = 0

        @dataclass
        class ActuatorEnabled(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=bool)

            value: 'bool' = False

        @dataclass
        class DoorState(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, DoorLock.Enums.DoorStateEnum])

            value: 'typing.Union[None, Nullable, DoorLock.Enums.DoorStateEnum]' = None

        @dataclass
        class DoorOpenEvents(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class DoorClosedEvents(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class OpenPeriod(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfTotalUsersSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfPinUsersSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfRfidUsersSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfWeekDaySchedulesSupportedPerUser(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfYearDaySchedulesSupportedPerUser(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfHolidaySchedulesSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MaxPinCodeLength(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MinPinCodeLength(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000018

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MaxRfidCodeLength(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000019

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class MinRfidCodeLength(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class CredentialRulesSupport(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DoorLock.Bitmaps.CredentialRulesBitmap])

            value: 'typing.Optional[DoorLock.Bitmaps.CredentialRulesBitmap]' = None

        @dataclass
        class NumberOfCredentialsSupportedPerUser(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Language(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class LedSettings(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DoorLock.Enums.LEDSettingEnum])

            value: 'typing.Optional[DoorLock.Enums.LEDSettingEnum]' = None

        @dataclass
        class AutoRelockTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000023

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SoundVolume(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DoorLock.Enums.SoundVolumeEnum])

            value: 'typing.Optional[DoorLock.Enums.SoundVolumeEnum]' = None

        @dataclass
        class OperatingMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DoorLock.Enums.OperatingModeEnum)

            value: 'DoorLock.Enums.OperatingModeEnum' = 0

        @dataclass
        class SupportedOperatingModes(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000026

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=DoorLock.Bitmaps.OperatingModesBitmap)

            value: 'DoorLock.Bitmaps.OperatingModesBitmap' = 0

        @dataclass
        class DefaultConfigurationRegister(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000027

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DoorLock.Bitmaps.ConfigurationRegisterBitmap])

            value: 'typing.Optional[DoorLock.Bitmaps.ConfigurationRegisterBitmap]' = None

        @dataclass
        class EnableLocalProgramming(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000028

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class EnableOneTouchLocking(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000029

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class EnableInsideStatusLed(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class EnablePrivacyModeButton(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class LocalProgrammingFeatures(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[DoorLock.Bitmaps.LocalProgrammingFeaturesBitmap])

            value: 'typing.Optional[DoorLock.Bitmaps.LocalProgrammingFeaturesBitmap]' = None

        @dataclass
        class WrongCodeEntryLimit(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class UserCodeTemporaryDisableTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SendPinOverTheAir(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class RequirePinForRemoteOperation(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bool])

            value: 'typing.Optional[bool]' = None

        @dataclass
        class SecurityLevel(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000034

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ExpiringUserTimeout(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000035

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class AliroReaderVerificationKey(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000080

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: 'typing.Union[None, Nullable, bytes]' = None

        @dataclass
        class AliroReaderGroupIdentifier(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000081

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: 'typing.Union[None, Nullable, bytes]' = None

        @dataclass
        class AliroReaderGroupSubIdentifier(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000082

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: 'typing.Optional[bytes]' = None

        @dataclass
        class AliroExpeditedTransactionSupportedProtocolVersions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000083

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[bytes]]])

            value: 'typing.Optional[typing.List[typing.Optional[bytes]]]' = None

        @dataclass
        class AliroGroupResolvingKey(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000084

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, bytes])

            value: 'typing.Union[None, Nullable, bytes]' = None

        @dataclass
        class AliroSupportedBleuwbProtocolVersions(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000085

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[typing.List[typing.Optional[bytes]]])

            value: 'typing.Optional[typing.List[typing.Optional[bytes]]]' = None

        @dataclass
        class AliroBleAdvertisingVersion(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000086

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfAliroCredentialIssuerKeysSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000087

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class NumberOfAliroEndpointKeysSupported(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000088

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

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
                return 0x00000101

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
                return 0x00000101

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
                return 0x00000101

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
                return 0x00000101

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0


    class Events:
        @dataclass
        class DoorLockAlarm(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="alarmCode", Tag=0, Type=DoorLock.Enums.AlarmCodeEnum),
                    ])

            alarmCode: 'DoorLock.Enums.AlarmCodeEnum' = 0

        @dataclass
        class DoorStateChange(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="doorState", Tag=0, Type=DoorLock.Enums.DoorStateEnum),
                    ])

            doorState: 'DoorLock.Enums.DoorStateEnum' = 0

        @dataclass
        class LockOperation(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="lockOperationType", Tag=0, Type=DoorLock.Enums.LockOperationTypeEnum),
                        ClusterObjectFieldDescriptor(Label="operationSource", Tag=1, Type=DoorLock.Enums.OperationSourceEnum),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=2, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="sourceNode", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="credentials", Tag=5, Type=typing.Union[None, Nullable, typing.List[typing.Optional[DoorLock.Structs.CredentialStruct]]]),
                    ])

            lockOperationType: 'DoorLock.Enums.LockOperationTypeEnum' = 0
            operationSource: 'DoorLock.Enums.OperationSourceEnum' = 0
            userIndex: 'typing.Union[Nullable, uint]' = NullValue
            fabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            sourceNode: 'typing.Union[Nullable, uint]' = NullValue
            credentials: 'typing.Union[None, Nullable, typing.List[typing.Optional[DoorLock.Structs.CredentialStruct]]]' = None

        @dataclass
        class LockOperationError(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="lockOperationType", Tag=0, Type=DoorLock.Enums.LockOperationTypeEnum),
                        ClusterObjectFieldDescriptor(Label="operationSource", Tag=1, Type=DoorLock.Enums.OperationSourceEnum),
                        ClusterObjectFieldDescriptor(Label="operationError", Tag=2, Type=DoorLock.Enums.OperationErrorEnum),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="sourceNode", Tag=5, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="credentials", Tag=6, Type=typing.Union[None, Nullable, typing.List[typing.Optional[DoorLock.Structs.CredentialStruct]]]),
                    ])

            lockOperationType: 'DoorLock.Enums.LockOperationTypeEnum' = 0
            operationSource: 'DoorLock.Enums.OperationSourceEnum' = 0
            operationError: 'DoorLock.Enums.OperationErrorEnum' = 0
            userIndex: 'typing.Union[Nullable, uint]' = NullValue
            fabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            sourceNode: 'typing.Union[Nullable, uint]' = NullValue
            credentials: 'typing.Union[None, Nullable, typing.List[typing.Optional[DoorLock.Structs.CredentialStruct]]]' = None

        @dataclass
        class LockUserChange(ClusterEvent):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000101

            @ChipUtility.classproperty
            def event_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="lockDataType", Tag=0, Type=DoorLock.Enums.LockDataTypeEnum),
                        ClusterObjectFieldDescriptor(Label="dataOperationType", Tag=1, Type=DoorLock.Enums.DataOperationTypeEnum),
                        ClusterObjectFieldDescriptor(Label="operationSource", Tag=2, Type=DoorLock.Enums.OperationSourceEnum),
                        ClusterObjectFieldDescriptor(Label="userIndex", Tag=3, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=4, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="sourceNode", Tag=5, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="dataIndex", Tag=6, Type=typing.Union[Nullable, uint]),
                    ])

            lockDataType: 'DoorLock.Enums.LockDataTypeEnum' = 0
            dataOperationType: 'DoorLock.Enums.DataOperationTypeEnum' = 0
            operationSource: 'DoorLock.Enums.OperationSourceEnum' = 0
            userIndex: 'typing.Union[Nullable, uint]' = NullValue
            fabricIndex: 'typing.Union[Nullable, uint]' = NullValue
            sourceNode: 'typing.Union[Nullable, uint]' = NullValue
            dataIndex: 'typing.Union[Nullable, uint]' = NullValue

