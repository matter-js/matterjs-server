"""
 Device type definitions.
 This file is auto-generated, DO NOT edit.
"""

from __future__ import annotations

from chip.clusters import Objects as all_clusters
from chip.clusters.ClusterObjects import Cluster


ALL_TYPES: dict[int, type[DeviceType]] = {}


class DeviceType:
    """Base class for Matter device types."""
    device_type: int = 0
    clusters: set[type[Cluster]] = set()

    def __init_subclass__(cls, **kwargs) -> None:
        super().__init_subclass__(**kwargs)
        if cls.device_type != 0:
            ALL_TYPES[cls.device_type] = cls


class Aggregator(DeviceType):
    device_type: int = 0x000E
    clusters: set[type[Cluster]] = {
        all_clusters.Actions,
        all_clusters.CommissionerControl,
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class AirPurifier(DeviceType):
    device_type: int = 0x002D
    clusters: set[type[Cluster]] = {
        all_clusters.ActivatedCarbonFilterMonitoring,
        all_clusters.Descriptor,
        all_clusters.FanControl,
        all_clusters.Groups,
        all_clusters.HepaFilterMonitoring,
        all_clusters.Identify,
        all_clusters.OnOff,
    }


class AirQualitySensor(DeviceType):
    device_type: int = 0x002C
    clusters: set[type[Cluster]] = {
        all_clusters.AirQuality,
        all_clusters.CarbonDioxideConcentrationMeasurement,
        all_clusters.CarbonMonoxideConcentrationMeasurement,
        all_clusters.Descriptor,
        all_clusters.FormaldehydeConcentrationMeasurement,
        all_clusters.Identify,
        all_clusters.NitrogenDioxideConcentrationMeasurement,
        all_clusters.OzoneConcentrationMeasurement,
        all_clusters.Pm10ConcentrationMeasurement,
        all_clusters.Pm1ConcentrationMeasurement,
        all_clusters.Pm25ConcentrationMeasurement,
        all_clusters.RadonConcentrationMeasurement,
        all_clusters.RelativeHumidityMeasurement,
        all_clusters.TemperatureMeasurement,
        all_clusters.TotalVolatileOrganicCompoundsConcentrationMeasurement,
    }


class BasicVideoPlayer(DeviceType):
    device_type: int = 0x0028
    clusters: set[type[Cluster]] = {
        all_clusters.AudioOutput,
        all_clusters.Channel,
        all_clusters.ContentControl,
        all_clusters.Descriptor,
        all_clusters.KeypadInput,
        all_clusters.LowPower,
        all_clusters.MediaInput,
        all_clusters.MediaPlayback,
        all_clusters.Messages,
        all_clusters.OnOff,
        all_clusters.TargetNavigator,
        all_clusters.WakeOnLan,
    }


class BatteryStorage(DeviceType):
    device_type: int = 0x0018
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class BridgedNode(DeviceType):
    device_type: int = 0x0013
    clusters: set[type[Cluster]] = {
        all_clusters.AdministratorCommissioning,
        all_clusters.BridgedDeviceBasicInformation,
        all_clusters.Descriptor,
        all_clusters.EcosystemInformation,
        all_clusters.PowerSource,
        all_clusters.PowerSourceConfiguration,
    }


class CastingVideoClient(DeviceType):
    device_type: int = 0x0029
    clusters: set[type[Cluster]] = {
        all_clusters.ContentAppObserver,
        all_clusters.Descriptor,
    }


class CastingVideoPlayer(DeviceType):
    device_type: int = 0x0023
    clusters: set[type[Cluster]] = {
        all_clusters.AccountLogin,
        all_clusters.ApplicationLauncher,
        all_clusters.AudioOutput,
        all_clusters.Channel,
        all_clusters.ContentControl,
        all_clusters.ContentLauncher,
        all_clusters.Descriptor,
        all_clusters.KeypadInput,
        all_clusters.LowPower,
        all_clusters.MediaInput,
        all_clusters.MediaPlayback,
        all_clusters.Messages,
        all_clusters.OnOff,
        all_clusters.TargetNavigator,
        all_clusters.WakeOnLan,
    }


class ColorDimmerSwitch(DeviceType):
    device_type: int = 0x0105
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class ColorTemperatureLight(DeviceType):
    device_type: int = 0x010C
    clusters: set[type[Cluster]] = {
        all_clusters.ColorControl,
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class ContactSensor(DeviceType):
    device_type: int = 0x0015
    clusters: set[type[Cluster]] = {
        all_clusters.BooleanState,
        all_clusters.BooleanStateConfiguration,
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class ContentApp(DeviceType):
    device_type: int = 0x0024
    clusters: set[type[Cluster]] = {
        all_clusters.AccountLogin,
        all_clusters.ApplicationBasic,
        all_clusters.ApplicationLauncher,
        all_clusters.Binding,
        all_clusters.Channel,
        all_clusters.ContentLauncher,
        all_clusters.Descriptor,
        all_clusters.KeypadInput,
        all_clusters.MediaPlayback,
        all_clusters.TargetNavigator,
    }


class ControlBridge(DeviceType):
    device_type: int = 0x0840
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class CookSurface(DeviceType):
    device_type: int = 0x0077
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.OnOff,
        all_clusters.TemperatureControl,
        all_clusters.TemperatureMeasurement,
    }


class Cooktop(DeviceType):
    device_type: int = 0x0078
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.OnOff,
    }


class DeviceEnergyManagement(DeviceType):
    device_type: int = 0x050D
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.DeviceEnergyManagement,
        all_clusters.DeviceEnergyManagementMode,
    }


class DimmableLight(DeviceType):
    device_type: int = 0x0101
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class DimmablePlugInUnit(DeviceType):
    device_type: int = 0x010B
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class DimmerSwitch(DeviceType):
    device_type: int = 0x0104
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class Dishwasher(DeviceType):
    device_type: int = 0x0075
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.DishwasherAlarm,
        all_clusters.DishwasherMode,
        all_clusters.Identify,
        all_clusters.OnOff,
        all_clusters.OperationalState,
        all_clusters.TemperatureControl,
    }


class DoorLockController(DeviceType):
    device_type: int = 0x000B
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.TimeSynchronization,
    }


class DoorLock(DeviceType):
    device_type: int = 0x000A
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.DoorLock,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.ScenesManagement,
    }


class ElectricalSensor(DeviceType):
    device_type: int = 0x0510
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.ElectricalEnergyMeasurement,
        all_clusters.ElectricalPowerMeasurement,
        all_clusters.PowerTopology,
    }


class EnergyEvse(DeviceType):
    device_type: int = 0x050C
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.EnergyEvse,
        all_clusters.EnergyEvseMode,
        all_clusters.Identify,
        all_clusters.TemperatureMeasurement,
    }


class ExtendedColorLight(DeviceType):
    device_type: int = 0x010D
    clusters: set[type[Cluster]] = {
        all_clusters.ColorControl,
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class ExtractorHood(DeviceType):
    device_type: int = 0x007A
    clusters: set[type[Cluster]] = {
        all_clusters.ActivatedCarbonFilterMonitoring,
        all_clusters.Descriptor,
        all_clusters.FanControl,
        all_clusters.HepaFilterMonitoring,
        all_clusters.Identify,
    }


class Fan(DeviceType):
    device_type: int = 0x002B
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.FanControl,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.OnOff,
    }


class FlowSensor(DeviceType):
    device_type: int = 0x0306
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.FlowMeasurement,
        all_clusters.Identify,
    }


class GenericSwitch(DeviceType):
    device_type: int = 0x000F
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.Switch,
    }


class HeatPump(DeviceType):
    device_type: int = 0x0309
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class HumiditySensor(DeviceType):
    device_type: int = 0x0307
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.RelativeHumidityMeasurement,
    }


class JointFabricAdministrator(DeviceType):
    device_type: int = 0x0130
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.JointFabricAdministrator,
        all_clusters.JointFabricDatastore,
    }


class LaundryDryer(DeviceType):
    device_type: int = 0x007C
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.LaundryDryerControls,
        all_clusters.LaundryWasherMode,
        all_clusters.OnOff,
        all_clusters.OperationalState,
        all_clusters.TemperatureControl,
    }


class LaundryWasher(DeviceType):
    device_type: int = 0x0073
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.LaundryWasherControls,
        all_clusters.LaundryWasherMode,
        all_clusters.OnOff,
        all_clusters.OperationalState,
        all_clusters.TemperatureControl,
    }


class LightSensor(DeviceType):
    device_type: int = 0x0106
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.IlluminanceMeasurement,
    }


class MicrowaveOven(DeviceType):
    device_type: int = 0x0079
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.FanControl,
        all_clusters.Identify,
        all_clusters.MicrowaveOvenControl,
        all_clusters.MicrowaveOvenMode,
        all_clusters.OperationalState,
    }


class ModeSelect(DeviceType):
    device_type: int = 0x0027
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.ModeSelect,
    }


class MountedDimmableLoadControl(DeviceType):
    device_type: int = 0x0110
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class MountedOnOffControl(DeviceType):
    device_type: int = 0x010F
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class NetworkInfrastructureManager(DeviceType):
    device_type: int = 0x0090
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.ThreadBorderRouterManagement,
        all_clusters.ThreadNetworkDiagnostics,
        all_clusters.ThreadNetworkDirectory,
        all_clusters.WiFiNetworkManagement,
    }


class OccupancySensor(DeviceType):
    device_type: int = 0x0107
    clusters: set[type[Cluster]] = {
        all_clusters.BooleanStateConfiguration,
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.OccupancySensing,
    }


class OnOffLight(DeviceType):
    device_type: int = 0x0100
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class OnOffLightSwitch(DeviceType):
    device_type: int = 0x0103
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class OnOffPlugInUnit(DeviceType):
    device_type: int = 0x010A
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.ScenesManagement,
    }


class OnOffSensor(DeviceType):
    device_type: int = 0x0850
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class OtaProvider(DeviceType):
    device_type: int = 0x0014
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.OtaSoftwareUpdateProvider,
    }


class OtaRequestor(DeviceType):
    device_type: int = 0x0012
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.OtaSoftwareUpdateRequestor,
    }


class Oven(DeviceType):
    device_type: int = 0x007B
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class PowerSource(DeviceType):
    device_type: int = 0x0011
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.PowerSource,
    }


class PressureSensor(DeviceType):
    device_type: int = 0x0305
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.PressureMeasurement,
    }


class PumpController(DeviceType):
    device_type: int = 0x0304
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class Pump(DeviceType):
    device_type: int = 0x0303
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.FlowMeasurement,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.LevelControl,
        all_clusters.OnOff,
        all_clusters.PressureMeasurement,
        all_clusters.PumpConfigurationAndControl,
        all_clusters.ScenesManagement,
        all_clusters.TemperatureMeasurement,
    }


class RainSensor(DeviceType):
    device_type: int = 0x0044
    clusters: set[type[Cluster]] = {
        all_clusters.BooleanState,
        all_clusters.BooleanStateConfiguration,
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class Refrigerator(DeviceType):
    device_type: int = 0x0070
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.RefrigeratorAlarm,
        all_clusters.RefrigeratorAndTemperatureControlledCabinetMode,
    }


class RoboticVacuumCleaner(DeviceType):
    device_type: int = 0x0074
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.RvcCleanMode,
        all_clusters.RvcOperationalState,
        all_clusters.RvcRunMode,
        all_clusters.ServiceArea,
    }


class RoomAirConditioner(DeviceType):
    device_type: int = 0x0072
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.FanControl,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.OnOff,
        all_clusters.RelativeHumidityMeasurement,
        all_clusters.ScenesManagement,
        all_clusters.TemperatureMeasurement,
        all_clusters.Thermostat,
        all_clusters.ThermostatUserInterfaceConfiguration,
    }


class RootNode(DeviceType):
    device_type: int = 0x0016
    clusters: set[type[Cluster]] = {
        all_clusters.AccessControl,
        all_clusters.AdministratorCommissioning,
        all_clusters.BasicInformation,
        all_clusters.Descriptor,
        all_clusters.DiagnosticLogs,
        all_clusters.EthernetNetworkDiagnostics,
        all_clusters.GeneralCommissioning,
        all_clusters.GeneralDiagnostics,
        all_clusters.GroupKeyManagement,
        all_clusters.IcdManagement,
        all_clusters.LocalizationConfiguration,
        all_clusters.NetworkCommissioning,
        all_clusters.OperationalCredentials,
        all_clusters.PowerSourceConfiguration,
        all_clusters.SoftwareDiagnostics,
        all_clusters.ThreadNetworkDiagnostics,
        all_clusters.TimeFormatLocalization,
        all_clusters.TimeSynchronization,
        all_clusters.UnitLocalization,
        all_clusters.WiFiNetworkDiagnostics,
    }


class SecondaryNetworkInterface(DeviceType):
    device_type: int = 0x0019
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.EthernetNetworkDiagnostics,
        all_clusters.NetworkCommissioning,
        all_clusters.ThreadNetworkDiagnostics,
        all_clusters.WiFiNetworkDiagnostics,
    }


class SmokeCoAlarm(DeviceType):
    device_type: int = 0x0076
    clusters: set[type[Cluster]] = {
        all_clusters.CarbonMonoxideConcentrationMeasurement,
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.RelativeHumidityMeasurement,
        all_clusters.SmokeCoAlarm,
        all_clusters.TemperatureMeasurement,
    }


class SolarPower(DeviceType):
    device_type: int = 0x0017
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class Speaker(DeviceType):
    device_type: int = 0x0022
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.LevelControl,
        all_clusters.OnOff,
    }


class TemperatureControlledCabinet(DeviceType):
    device_type: int = 0x0071
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.OvenCavityOperationalState,
        all_clusters.OvenMode,
        all_clusters.RefrigeratorAndTemperatureControlledCabinetMode,
        all_clusters.TemperatureControl,
        all_clusters.TemperatureMeasurement,
    }


class TemperatureSensor(DeviceType):
    device_type: int = 0x0302
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.TemperatureMeasurement,
    }


class ThermostatController(DeviceType):
    device_type: int = 0x030A
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
    }


class Thermostat(DeviceType):
    device_type: int = 0x0301
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.EnergyPreference,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.Thermostat,
        all_clusters.ThermostatUserInterfaceConfiguration,
    }


class VideoRemoteControl(DeviceType):
    device_type: int = 0x002A
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
    }


class WaterFreezeDetector(DeviceType):
    device_type: int = 0x0041
    clusters: set[type[Cluster]] = {
        all_clusters.BooleanState,
        all_clusters.BooleanStateConfiguration,
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class WaterHeater(DeviceType):
    device_type: int = 0x050F
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
        all_clusters.Thermostat,
        all_clusters.WaterHeaterManagement,
        all_clusters.WaterHeaterMode,
    }


class WaterLeakDetector(DeviceType):
    device_type: int = 0x0043
    clusters: set[type[Cluster]] = {
        all_clusters.BooleanState,
        all_clusters.BooleanStateConfiguration,
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class WaterValve(DeviceType):
    device_type: int = 0x0042
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.FlowMeasurement,
        all_clusters.Identify,
        all_clusters.ValveConfigurationAndControl,
    }


class WindowCoveringController(DeviceType):
    device_type: int = 0x0203
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Identify,
    }


class WindowCovering(DeviceType):
    device_type: int = 0x0202
    clusters: set[type[Cluster]] = {
        all_clusters.Descriptor,
        all_clusters.Groups,
        all_clusters.Identify,
        all_clusters.WindowCovering,
    }
