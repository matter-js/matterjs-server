/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import {
    mdiAccessPoint,
    mdiAirConditioner,
    mdiAirFilter,
    mdiAirPurifier,
    mdiBell,
    mdiBlindsHorizontal,
    mdiBrightnessPercent,
    mdiCamera,
    mdiCast,
    mdiCctv,
    mdiChip,
    mdiDishwasher,
    mdiDoorbell,
    mdiDoorbellVideo,
    mdiDoorOpen,
    mdiEvStation,
    mdiFan,
    mdiFridge,
    mdiGauge,
    mdiHeatPump,
    mdiHelp,
    mdiHome,
    mdiLeaf,
    mdiLightbulb,
    mdiLock,
    mdiMeterElectric,
    mdiMicrowave,
    mdiMotionSensor,
    mdiPowerPlug,
    mdiPump,
    mdiRemote,
    mdiRobotVacuum,
    mdiRouter,
    mdiSmokeDetector,
    mdiSnowflakeAlert,
    mdiSolarPower,
    mdiSpeaker,
    mdiSprinkler,
    mdiStove,
    mdiTelevision,
    mdiThermometer,
    mdiToggleSwitch,
    mdiTumbleDryer,
    mdiWashingMachine,
    mdiWater,
    mdiWaterBoiler,
    mdiWaterPercent,
    mdiWeatherRainy,
    mdiWifi,
} from "@mdi/js";
import { ThemeService } from "./theme-service.js";

/**
 * Get theme-aware default icon color.
 */
function getDefaultIconColor(): string {
    return ThemeService.effectiveTheme === "dark" ? "#b0b0b0" : "#666666";
}

/**
 * Device type IDs from Matter Device Library Specification 1.5.
 * Organized by spec categories. See https://csa-iot.org/ for the full specification.
 */
const DeviceTypes = {
    // Utility (per Matter spec - deprioritized for icon selection)
    ROOT_NODE: 0x0016,
    POWER_SOURCE: 0x0011,
    OTA_REQUESTOR: 0x0012,
    OTA_PROVIDER: 0x0014,
    BRIDGED_NODE: 0x0013,
    ELECTRICAL_SENSOR: 0x0510,
    DEVICE_ENERGY_MANAGEMENT: 0x050d,
    SECONDARY_NETWORK_INTERFACE: 0x0019,
    JOINT_FABRIC_ADMINISTRATOR: 0x0130,

    // Lighting
    ON_OFF_LIGHT: 0x0100,
    DIMMABLE_LIGHT: 0x0101,
    COLOR_TEMPERATURE_LIGHT: 0x010c,
    EXTENDED_COLOR_LIGHT: 0x010d,

    // Smart Plugs/Outlets and Other Actuators
    ON_OFF_PLUG: 0x010a,
    DIMMABLE_PLUG: 0x010b,
    MOUNTED_ON_OFF_CONTROL: 0x010f,
    MOUNTED_DIMMABLE_LOAD_CONTROL: 0x0110,
    PUMP: 0x0303,
    WATER_VALVE: 0x0042,
    IRRIGATION_SYSTEM: 0x0040,

    // Switches and Controls
    ON_OFF_SWITCH: 0x0103,
    DIMMER_SWITCH: 0x0104,
    COLOR_DIMMER_SWITCH: 0x0105,
    CONTROL_BRIDGE: 0x0840,
    PUMP_CONTROLLER: 0x0304,
    GENERIC_SWITCH: 0x000f,

    // Sensors
    CONTACT_SENSOR: 0x0015,
    LIGHT_SENSOR: 0x0106,
    OCCUPANCY_SENSOR: 0x0107,
    TEMPERATURE_SENSOR: 0x0302,
    PRESSURE_SENSOR: 0x0305,
    FLOW_SENSOR: 0x0306,
    HUMIDITY_SENSOR: 0x0307,
    ON_OFF_SENSOR: 0x0850,
    SMOKE_CO_ALARM: 0x0076,
    AIR_QUALITY_SENSOR: 0x002c,
    WATER_FREEZE_DETECTOR: 0x0041,
    WATER_LEAK_DETECTOR: 0x0043,
    RAIN_SENSOR: 0x0044,
    SOIL_SENSOR: 0x0045,

    // Closures
    DOOR_LOCK: 0x000a,
    DOOR_LOCK_CONTROLLER: 0x000b,
    WINDOW_COVERING: 0x0202,
    WINDOW_COVERING_CONTROLLER: 0x0203,
    CLOSURE: 0x0230,
    CLOSURE_PANEL: 0x0231,
    CLOSURE_CONTROLLER: 0x023e,

    // HVAC
    THERMOSTAT: 0x0301,
    FAN: 0x002b,
    AIR_PURIFIER: 0x002d,
    THERMOSTAT_CONTROLLER: 0x030a,
    HEAT_PUMP: 0x0309,
    ROOM_AIR_CONDITIONER: 0x0072,

    // Media
    SPEAKER: 0x0022,
    CASTING_VIDEO_PLAYER: 0x0023,
    CONTENT_APP: 0x0024,
    BASIC_VIDEO_PLAYER: 0x0028,
    CASTING_VIDEO_CLIENT: 0x0029,
    VIDEO_REMOTE_CONTROL: 0x002a,

    // Generic
    AGGREGATOR: 0x000e,

    // Appliances
    REFRIGERATOR: 0x0070,
    TEMPERATURE_CONTROLLED_CABINET: 0x0071,
    LAUNDRY_WASHER: 0x0073,
    ROBOTIC_VACUUM_CLEANER: 0x0074,
    DISHWASHER: 0x0075,
    COOK_SURFACE: 0x0077,
    COOKTOP: 0x0078,
    MICROWAVE_OVEN: 0x0079,
    EXTRACTOR_HOOD: 0x007a,
    OVEN: 0x007b,
    LAUNDRY_DRYER: 0x007c,

    // Energy
    EVSE: 0x050c,
    WATER_HEATER: 0x050f,
    SOLAR_POWER: 0x0017,
    BATTERY_STORAGE: 0x0018,

    // Network Infrastructure
    NETWORK_INFRASTRUCTURE_MANAGER: 0x0090,
    THREAD_BORDER_ROUTER: 0x0091,

    // Cameras
    CAMERA: 0x0142,
    SNAPSHOT_CAMERA: 0x0145,
    VIDEO_DOORBELL: 0x0143,
    AUDIO_DOORBELL: 0x0141,
    FLOODLIGHT_CAMERA: 0x0144,
    DOORBELL: 0x0148,
    CHIME: 0x0146,
    CAMERA_CONTROLLER: 0x0147,
    INTERCOM: 0x0140,
};

/**
 * Maps device type IDs to MDI icon paths.
 */
const deviceTypeToIcon: Record<number, string> = {
    // Utility
    [DeviceTypes.ROOT_NODE]: mdiHome,
    [DeviceTypes.ELECTRICAL_SENSOR]: mdiMeterElectric,
    [DeviceTypes.DEVICE_ENERGY_MANAGEMENT]: mdiMeterElectric,

    // Lighting
    [DeviceTypes.ON_OFF_LIGHT]: mdiLightbulb,
    [DeviceTypes.DIMMABLE_LIGHT]: mdiLightbulb,
    [DeviceTypes.COLOR_TEMPERATURE_LIGHT]: mdiLightbulb,
    [DeviceTypes.EXTENDED_COLOR_LIGHT]: mdiLightbulb,

    // Smart Plugs/Outlets and Other Actuators
    [DeviceTypes.ON_OFF_PLUG]: mdiPowerPlug,
    [DeviceTypes.DIMMABLE_PLUG]: mdiPowerPlug,
    [DeviceTypes.MOUNTED_ON_OFF_CONTROL]: mdiPowerPlug,
    [DeviceTypes.MOUNTED_DIMMABLE_LOAD_CONTROL]: mdiPowerPlug,
    [DeviceTypes.PUMP]: mdiPump,
    [DeviceTypes.WATER_VALVE]: mdiWater,
    [DeviceTypes.IRRIGATION_SYSTEM]: mdiSprinkler,

    // Switches and Controls
    [DeviceTypes.ON_OFF_SWITCH]: mdiToggleSwitch,
    [DeviceTypes.DIMMER_SWITCH]: mdiToggleSwitch,
    [DeviceTypes.COLOR_DIMMER_SWITCH]: mdiToggleSwitch,
    [DeviceTypes.CONTROL_BRIDGE]: mdiRouter,
    [DeviceTypes.PUMP_CONTROLLER]: mdiPump,
    [DeviceTypes.GENERIC_SWITCH]: mdiToggleSwitch,

    // Sensors
    [DeviceTypes.CONTACT_SENSOR]: mdiDoorOpen,
    [DeviceTypes.LIGHT_SENSOR]: mdiBrightnessPercent,
    [DeviceTypes.OCCUPANCY_SENSOR]: mdiMotionSensor,
    [DeviceTypes.TEMPERATURE_SENSOR]: mdiThermometer,
    [DeviceTypes.PRESSURE_SENSOR]: mdiGauge,
    [DeviceTypes.FLOW_SENSOR]: mdiWater,
    [DeviceTypes.HUMIDITY_SENSOR]: mdiWaterPercent,
    [DeviceTypes.ON_OFF_SENSOR]: mdiMotionSensor,
    [DeviceTypes.SMOKE_CO_ALARM]: mdiSmokeDetector,
    [DeviceTypes.AIR_QUALITY_SENSOR]: mdiAirFilter,
    [DeviceTypes.WATER_FREEZE_DETECTOR]: mdiSnowflakeAlert,
    [DeviceTypes.WATER_LEAK_DETECTOR]: mdiWater,
    [DeviceTypes.RAIN_SENSOR]: mdiWeatherRainy,
    [DeviceTypes.SOIL_SENSOR]: mdiLeaf,

    // Closures
    [DeviceTypes.DOOR_LOCK]: mdiLock,
    [DeviceTypes.DOOR_LOCK_CONTROLLER]: mdiLock,
    [DeviceTypes.WINDOW_COVERING]: mdiBlindsHorizontal,
    [DeviceTypes.WINDOW_COVERING_CONTROLLER]: mdiBlindsHorizontal,
    [DeviceTypes.CLOSURE]: mdiDoorOpen,
    [DeviceTypes.CLOSURE_PANEL]: mdiDoorOpen,
    [DeviceTypes.CLOSURE_CONTROLLER]: mdiDoorOpen,

    // HVAC
    [DeviceTypes.THERMOSTAT]: mdiThermometer,
    [DeviceTypes.FAN]: mdiFan,
    [DeviceTypes.AIR_PURIFIER]: mdiAirPurifier,
    [DeviceTypes.THERMOSTAT_CONTROLLER]: mdiThermometer,
    [DeviceTypes.HEAT_PUMP]: mdiHeatPump,
    [DeviceTypes.ROOM_AIR_CONDITIONER]: mdiAirConditioner,

    // Media
    [DeviceTypes.SPEAKER]: mdiSpeaker,
    [DeviceTypes.CASTING_VIDEO_PLAYER]: mdiTelevision,
    [DeviceTypes.CONTENT_APP]: mdiTelevision,
    [DeviceTypes.BASIC_VIDEO_PLAYER]: mdiTelevision,
    [DeviceTypes.CASTING_VIDEO_CLIENT]: mdiCast,
    [DeviceTypes.VIDEO_REMOTE_CONTROL]: mdiRemote,

    // Generic
    [DeviceTypes.AGGREGATOR]: mdiRouter,

    // Appliances
    [DeviceTypes.REFRIGERATOR]: mdiFridge,
    [DeviceTypes.TEMPERATURE_CONTROLLED_CABINET]: mdiFridge,
    [DeviceTypes.LAUNDRY_WASHER]: mdiWashingMachine,
    [DeviceTypes.ROBOTIC_VACUUM_CLEANER]: mdiRobotVacuum,
    [DeviceTypes.DISHWASHER]: mdiDishwasher,
    [DeviceTypes.COOK_SURFACE]: mdiStove,
    [DeviceTypes.COOKTOP]: mdiStove,
    [DeviceTypes.MICROWAVE_OVEN]: mdiMicrowave,
    [DeviceTypes.EXTRACTOR_HOOD]: mdiFan,
    [DeviceTypes.OVEN]: mdiStove,
    [DeviceTypes.LAUNDRY_DRYER]: mdiTumbleDryer,

    // Energy
    [DeviceTypes.EVSE]: mdiEvStation,
    [DeviceTypes.WATER_HEATER]: mdiWaterBoiler,
    [DeviceTypes.SOLAR_POWER]: mdiSolarPower,
    [DeviceTypes.BATTERY_STORAGE]: mdiMeterElectric,

    // Network Infrastructure
    [DeviceTypes.NETWORK_INFRASTRUCTURE_MANAGER]: mdiRouter,
    [DeviceTypes.THREAD_BORDER_ROUTER]: mdiAccessPoint,

    // Cameras
    [DeviceTypes.CAMERA]: mdiCamera,
    [DeviceTypes.SNAPSHOT_CAMERA]: mdiCamera,
    [DeviceTypes.VIDEO_DOORBELL]: mdiDoorbellVideo,
    [DeviceTypes.AUDIO_DOORBELL]: mdiDoorbell,
    [DeviceTypes.FLOODLIGHT_CAMERA]: mdiCctv,
    [DeviceTypes.DOORBELL]: mdiDoorbell,
    [DeviceTypes.CHIME]: mdiBell,
    [DeviceTypes.CAMERA_CONTROLLER]: mdiCamera,
    [DeviceTypes.INTERCOM]: mdiDoorbell,
};

/**
 * Maps Thread routing roles to MDI icon paths.
 */
const threadRoleToIcon: Record<number, string> = {
    5: mdiRouter, // Router
    6: mdiAccessPoint, // Leader
};

/**
 * Utility device types (per Matter spec) deprioritized when selecting the primary type for icon display.
 * These are commonly reported alongside the actual application type (e.g., a light also reports as
 * OTA Requestor + Root Node + Electrical Sensor). Their icons are only used if no application type is found.
 */
const UTILITY_TYPES = new Set([
    DeviceTypes.ROOT_NODE,
    DeviceTypes.POWER_SOURCE,
    DeviceTypes.OTA_REQUESTOR,
    DeviceTypes.OTA_PROVIDER,
    DeviceTypes.BRIDGED_NODE,
    DeviceTypes.ELECTRICAL_SENSOR,
    DeviceTypes.DEVICE_ENERGY_MANAGEMENT,
    DeviceTypes.SECONDARY_NETWORK_INTERFACE,
    DeviceTypes.JOINT_FABRIC_ADMINISTRATOR,
]);

/**
 * Extracts the device type ID from a DeviceTypeList entry.
 * The data comes as { 0: deviceTypeId, 1: revision } with numeric keys.
 */
function extractDeviceType(entry: Record<string, number>): number | undefined {
    return entry?.["0"] ?? entry?.deviceType;
}

/**
 * Gets the primary device type ID for a node.
 * Scans all endpoints for DeviceTypeList attribute (x/29/0) and prefers
 * the first explicitly-mapped, non-infrastructure type. Falls back to
 * the first type found on any endpoint.
 */
export function getPrimaryDeviceType(node: MatterNode): number | undefined {
    // Collect all endpoints that have a DeviceTypeList (cluster 29, attribute 0)
    const endpoints: number[] = [];
    for (const key of Object.keys(node.attributes)) {
        const match = key.match(/^(\d+)\/29\/0$/);
        if (match) {
            endpoints.push(Number(match[1]));
        }
    }
    // Sort: application endpoints first (1+), then root (0)
    endpoints.sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));

    let firstFound: number | undefined;

    for (const ep of endpoints) {
        const deviceTypeList = node.attributes[`${ep}/29/0`] as Array<Record<string, number>> | undefined;
        if (!deviceTypeList?.length) continue;

        for (const entry of deviceTypeList) {
            const deviceType = extractDeviceType(entry);
            if (deviceType === undefined) continue;

            // Remember the very first device type as fallback
            firstFound ??= deviceType;

            // Prefer a mapped, non-infrastructure type
            if (deviceTypeToIcon[deviceType] && !UTILITY_TYPES.has(deviceType)) {
                return deviceType;
            }
        }
    }

    return firstFound;
}

/**
 * Gets the appropriate MDI icon path for a node.
 * Considers device type and Thread role.
 */
export function getDeviceIcon(node: MatterNode, threadRole?: number): string {
    // For Thread routers/leaders, show network infrastructure icons
    if (threadRole !== undefined && threadRoleToIcon[threadRole]) {
        // But only if the device is primarily an infrastructure device
        const deviceType = getPrimaryDeviceType(node);
        if (deviceType === DeviceTypes.ROOT_NODE || deviceType === DeviceTypes.AGGREGATOR || node.is_bridge) {
            return threadRoleToIcon[threadRole];
        }
    }

    // Check for bridge first
    if (node.is_bridge) {
        return mdiRouter;
    }

    // Look up by device type
    const deviceType = getPrimaryDeviceType(node);
    if (deviceType !== undefined && deviceTypeToIcon[deviceType]) {
        return deviceTypeToIcon[deviceType];
    }

    // Default icon for unmapped device types
    return mdiChip;
}

/**
 * Gets the appropriate MDI icon path for a network type.
 */
export function getNetworkTypeIcon(networkType: string): string {
    switch (networkType) {
        case "thread":
            return mdiAccessPoint;
        case "wifi":
            return mdiWifi;
        case "ethernet":
            return mdiRouter;
        default:
            return mdiChip;
    }
}

/**
 * Creates an SVG data URL from an MDI icon path for use in vis.js.
 * @param iconPath - The MDI icon path
 * @param color - The icon color (CSS color string)
 * @param size - The icon size in pixels
 * @returns A data URL containing the SVG
 */
export function createIconDataUrl(iconPath: string, color: string, size: number = 48): string {
    // MDI icons use a 24x24 viewBox
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
            <circle cx="12" cy="12" r="11" fill="white" stroke="${color}" stroke-width="1"/>
            <path d="${iconPath}" fill="${color}" transform="scale(0.6) translate(8,8)"/>
        </svg>
    `.trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Creates an SVG data URL for a network graph node.
 * @param node - The Matter node
 * @param threadRole - Optional Thread routing role
 * @param isSelected - Whether the node is selected
 * @param isOffline - Whether the node is offline
 * @returns A data URL containing the SVG
 */
export function createNodeIconDataUrl(
    node: MatterNode,
    threadRole?: number,
    isSelected: boolean = false,
    isOffline: boolean = false,
): string {
    const iconPath = getDeviceIcon(node, threadRole);
    let color: string;
    if (isSelected) {
        color = isOffline ? "#b71c1c" : "#1976d2"; // Dark red for selected+offline, blue for selected
    } else if (isOffline) {
        color = "#d32f2f"; // Red for offline
    } else {
        color = getDefaultIconColor(); // Theme-aware default
    }
    return createIconDataUrl(iconPath, color);
}

/**
 * Creates an SVG data URL for an unknown Thread device (question mark).
 * @param isRouter - Whether the device appears to be a router
 * @param isSelected - Whether the node is selected
 * @returns A data URL containing the SVG
 */
export function createUnknownDeviceIconDataUrl(isRouter: boolean = false, isSelected: boolean = false): string {
    const iconPath = isRouter ? mdiAccessPoint : mdiHelp;
    const color = isSelected ? "#1976d2" : "#ff9800"; // Orange for unknown
    return createIconDataUrl(iconPath, color);
}

/**
 * Creates an SVG data URL for a WiFi access point/router.
 * @param isSelected - Whether the node is selected
 * @returns A data URL containing the SVG
 */
export function createWiFiRouterIconDataUrl(isSelected: boolean = false): string {
    const color = isSelected ? "#1976d2" : "#ff9800"; // Orange for external infrastructure (same as Thread unknown)
    return createIconDataUrl(mdiWifi, color);
}
