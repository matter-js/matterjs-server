/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import {
    mdiAccessPoint,
    mdiCeilingLight,
    mdiDoorOpen,
    mdiFan,
    mdiGauge,
    mdiHelp,
    mdiHome,
    mdiLightbulb,
    mdiLock,
    mdiMotionSensor,
    mdiPowerPlug,
    mdiRouter,
    mdiSpeaker,
    mdiTelevision,
    mdiThermometer,
    mdiToggleSwitch,
    mdiWater,
    mdiWifi,
} from "@mdi/js";
import { ThemeService } from "../../util/theme-service.js";

/**
 * Get theme-aware default icon color.
 */
function getDefaultIconColor(): string {
    return ThemeService.effectiveTheme === "dark" ? "#b0b0b0" : "#666666";
}

/**
 * Device type IDs from Matter specification (from DeviceTypeList attribute 0/29/0).
 */
const DeviceTypes = {
    // Lighting
    ON_OFF_LIGHT: 0x0100,
    DIMMABLE_LIGHT: 0x0101,
    COLOR_TEMPERATURE_LIGHT: 0x010c,
    EXTENDED_COLOR_LIGHT: 0x010d,

    // Plugs/Outlets
    ON_OFF_PLUG: 0x010a,
    DIMMABLE_PLUG: 0x010b,

    // Switches
    ON_OFF_SWITCH: 0x0103,
    DIMMER_SWITCH: 0x0104,
    COLOR_DIMMER_SWITCH: 0x0105,
    GENERIC_SWITCH: 0x000f,

    // Sensors
    CONTACT_SENSOR: 0x0015,
    OCCUPANCY_SENSOR: 0x0107,
    TEMPERATURE_SENSOR: 0x0302,
    HUMIDITY_SENSOR: 0x0307,
    LIGHT_SENSOR: 0x0106,
    PRESSURE_SENSOR: 0x0305,
    FLOW_SENSOR: 0x0306,

    // HVAC
    THERMOSTAT: 0x0301,
    FAN: 0x002b,

    // Closures
    DOOR_LOCK: 0x000a,
    WINDOW_COVERING: 0x0202,

    // Media
    SPEAKER: 0x0022,
    BASIC_VIDEO_PLAYER: 0x0028,
    TELEVISION: 0x0023,

    // Infrastructure
    ROOT_NODE: 0x0016,
    BRIDGE: 0x000e,
    AGGREGATOR: 0x000e, // Same as bridge

    // Water
    WATER_LEAK_DETECTOR: 0x0043,
    WATER_VALVE: 0x0042,
};

/**
 * Maps device type IDs to MDI icon paths.
 */
const deviceTypeToIcon: Record<number, string> = {
    // Lighting
    [DeviceTypes.ON_OFF_LIGHT]: mdiLightbulb,
    [DeviceTypes.DIMMABLE_LIGHT]: mdiLightbulb,
    [DeviceTypes.COLOR_TEMPERATURE_LIGHT]: mdiCeilingLight,
    [DeviceTypes.EXTENDED_COLOR_LIGHT]: mdiCeilingLight,

    // Plugs/Outlets
    [DeviceTypes.ON_OFF_PLUG]: mdiPowerPlug,
    [DeviceTypes.DIMMABLE_PLUG]: mdiPowerPlug,

    // Switches
    [DeviceTypes.ON_OFF_SWITCH]: mdiToggleSwitch,
    [DeviceTypes.DIMMER_SWITCH]: mdiToggleSwitch,
    [DeviceTypes.COLOR_DIMMER_SWITCH]: mdiToggleSwitch,
    [DeviceTypes.GENERIC_SWITCH]: mdiToggleSwitch,

    // Sensors
    [DeviceTypes.CONTACT_SENSOR]: mdiDoorOpen,
    [DeviceTypes.OCCUPANCY_SENSOR]: mdiMotionSensor,
    [DeviceTypes.TEMPERATURE_SENSOR]: mdiThermometer,
    [DeviceTypes.HUMIDITY_SENSOR]: mdiGauge,
    [DeviceTypes.LIGHT_SENSOR]: mdiGauge,
    [DeviceTypes.PRESSURE_SENSOR]: mdiGauge,
    [DeviceTypes.FLOW_SENSOR]: mdiGauge,

    // HVAC
    [DeviceTypes.THERMOSTAT]: mdiThermometer,
    [DeviceTypes.FAN]: mdiFan,

    // Closures
    [DeviceTypes.DOOR_LOCK]: mdiLock,
    [DeviceTypes.WINDOW_COVERING]: mdiHome,

    // Media
    [DeviceTypes.SPEAKER]: mdiSpeaker,
    [DeviceTypes.BASIC_VIDEO_PLAYER]: mdiTelevision,
    [DeviceTypes.TELEVISION]: mdiTelevision,

    // Infrastructure
    [DeviceTypes.ROOT_NODE]: mdiHome,
    [DeviceTypes.BRIDGE]: mdiRouter,
    [DeviceTypes.AGGREGATOR]: mdiRouter,

    // Water
    [DeviceTypes.WATER_LEAK_DETECTOR]: mdiWater,
    [DeviceTypes.WATER_VALVE]: mdiWater,
};

/**
 * Maps Thread routing roles to MDI icon paths.
 */
const threadRoleToIcon: Record<number, string> = {
    5: mdiRouter, // Router
    6: mdiAccessPoint, // Leader
};

/**
 * Gets the primary device type ID for a node.
 * Reads from DeviceTypeList attribute (0/29/0) on endpoint 1 or 0.
 * The data comes as { 0: deviceTypeId, 1: revision } with numeric keys.
 */
export function getPrimaryDeviceType(node: MatterNode): number | undefined {
    // Check endpoint 1 first (most common for Matter devices)
    const deviceTypeList1 = node.attributes["1/29/0"] as Array<Record<string, number>> | undefined;
    if (deviceTypeList1?.length) {
        // Device type is at key "0" (numeric key as string)
        const entry = deviceTypeList1[0];
        return entry?.["0"] ?? entry?.deviceType;
    }

    // Fall back to endpoint 0 (root node)
    const deviceTypeList0 = node.attributes["0/29/0"] as Array<Record<string, number>> | undefined;
    if (deviceTypeList0?.length) {
        const entry = deviceTypeList0[0];
        return entry?.["0"] ?? entry?.deviceType;
    }

    return undefined;
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
        if (deviceType === DeviceTypes.ROOT_NODE || deviceType === DeviceTypes.BRIDGE || node.is_bridge) {
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

    // Default icon
    return mdiHome;
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
            return mdiHome;
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
