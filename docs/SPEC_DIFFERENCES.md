# Chip-Clusters vs Generated Clusters: Spec Version Differences

These differences exist because `home-assistant-chip-clusters==2024.11.4` was
generated from the Matter spec ~1.2/1.3, while this project uses Matter.js which
implements spec 1.4. They are **not bugs** in the generator.

Home Assistant must be updated separately to handle each item.

---

## Clusters absent from generated output (in old chip SDK, not in 1.4 model)

| Cluster | Notes |
|---------|-------|
| BallastConfiguration | Not in Matter.js 1.4 standard model |
| Chime | Not in Matter.js 1.4 standard model |
| DemandResponseLoadControl | Not in Matter.js 1.4 standard model |
| FaultInjection | SDK-internal test cluster |
| ProxyConfiguration | Not in Matter.js 1.4 standard model |
| ProxyDiscovery | Not in Matter.js 1.4 standard model |
| ProxyValid | Not in Matter.js 1.4 standard model |
| PulseWidthModulation | Not in Matter.js 1.4 standard model |
| SampleMei | SDK-internal test cluster |
| Timer | Not in Matter.js 1.4 standard model |
| UnitTesting | SDK-internal test cluster |
| WebRTCTransportProvider | Not in Matter.js 1.4 standard model |

## DoorLock — legacy `Dl*` names removed in spec 1.3+

The old chip SDK had a large set of `Dl`-prefixed bitmaps and enums that were
renamed or removed in spec 1.3. Our output uses the 1.4 names.

| Old name | New name |
|----------|----------|
| Bitmaps.DlCredentialRuleMask | Bitmaps.CredentialRulesBitmap |
| Bitmaps.DlCredentialRulesSupport | Bitmaps.CredentialRulesBitmap |
| Bitmaps.DlDefaultConfigurationRegister | Bitmaps.ConfigurationRegisterBitmap |
| Bitmaps.DlKeypadOperationEventMask | (removed) |
| Bitmaps.DlKeypadProgrammingEventMask | (removed) |
| Bitmaps.DlLocalProgrammingFeatures | Bitmaps.LocalProgrammingFeaturesBitmap |
| Bitmaps.DlManualOperationEventMask | (removed) |
| Bitmaps.DlRFIDOperationEventMask | (removed) |
| Bitmaps.DlRFIDProgrammingEventMask | (removed) |
| Bitmaps.DlRemoteOperationEventMask | (removed) |
| Bitmaps.DlRemoteProgrammingEventMask | (removed) |
| Bitmaps.DlSupportedOperatingModes | Bitmaps.OperatingModesBitmap |
| Bitmaps.DoorLockDayOfWeek | Bitmaps.DaysMaskBitmap |
| Enums.DlLockState | Enums.LockStateEnum |
| Enums.DlLockType | Enums.LockTypeEnum |
| Enums.DlStatus | Enums.StatusCodeEnum |
| Enums.DoorLockOperationEventCode | (removed) |
| Enums.DoorLockProgrammingEventCode | (removed) |
| Enums.DoorLockSetPinOrIdStatus | (removed) |
| Enums.DoorLockUserStatus | (removed) |
| Enums.DoorLockUserType | (removed) |
| Commands.ClearAllPINCodes | (removed in 1.3) |
| Commands.ClearAllRFIDCodes | (removed in 1.3) |
| Commands.ClearPINCode | (removed in 1.3) |
| Commands.ClearRFIDCode | (removed in 1.3) |
| Commands.GetPINCode / GetPINCodeResponse | (removed in 1.3) |
| Commands.GetRFIDCode / GetRFIDCodeResponse | (removed in 1.3) |
| Commands.GetUserStatus / GetUserStatusResponse | (removed in 1.3) |
| Commands.GetUserType / GetUserTypeResponse | (removed in 1.3) |
| Commands.SetPINCode | (removed in 1.3) |
| Commands.SetRFIDCode | (removed in 1.3) |
| Commands.SetUserStatus | (removed in 1.3) |
| Commands.SetUserType | (removed in 1.3) |
| Commands.Toggle | (removed in 1.3) |

## WindowCovering — enum class names

Old chip SDK used names without `Enum` suffix for these two enums only:

| Old name | New name |
|----------|----------|
| Enums.Type | Enums.TypeEnum |
| Enums.EndProductType | Enums.EndProductTypeEnum |
| Bitmaps.ConfigStatus | Bitmaps.ConfigStatusBitmap |
| Bitmaps.Mode | Bitmaps.ModeBitmap |
| Bitmaps.OperationalStatus | Bitmaps.OperationalStatusBitmap |
| Bitmaps.SafetyStatus | Bitmaps.SafetyStatusBitmap |

## PowerSource — struct type changes

| Old | New |
|-----|-----|
| Structs.BatChargeFaultChangeType | (promoted to event struct, different structure) |
| Structs.BatFaultChangeType | (same) |
| Structs.WiredFaultChangeType | (same) |

## Various clusters — `StatusCode` → `StatusCodeEnum`

Spec 1.4 adds `Enum` suffix consistently:
AdministratorCommissioning, RvcCleanMode, RvcRunMode, TimeSynchronization

## Various clusters — spec 1.4 new attributes/commands/events

These are additions in spec 1.4 that do not exist in the old SDK:
- BasicInformation: ConfigurationVersion
- BridgedDeviceBasicInformation: 7 new attributes
- ContentControl: block channel/app/time window features
- DoorLock: SecurityLevel, new 1.4 enums
- GeneralCommissioning: TC* attributes (Terms and Conditions acknowledgement)
- NetworkCommissioning: QueryIdentity, PDC features
- OperationalCredentials: VID verification commands
- RvcCleanMode / RvcRunMode: OnMode, StartUpMode
- MicrowaveOvenMode / OvenMode / WaterHeaterMode: mode-change support
