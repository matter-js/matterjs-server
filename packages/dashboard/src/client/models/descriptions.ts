/*
 * Descriptions for SDK Objects.
 * This file is auto-generated, DO NOT edit.
 */

export interface DeviceType {
    id: number;
    label: string;
}

export interface ClusterAttributeDescription {
    id: number;
    cluster_id: number;
    label: string;
    type: string;
}

export interface ClusterDescription {
    id: number;
    label: string;
    attributes: { [attribute_id: string]: ClusterAttributeDescription };
}

export const device_types: Record<number, DeviceType> = {
    "10": {
        "id": 10,
        "label": "Door Lock"
    },
    "11": {
        "id": 11,
        "label": "Door Lock Controller"
    },
    "14": {
        "id": 14,
        "label": "Aggregator"
    },
    "15": {
        "id": 15,
        "label": "Generic Switch"
    },
    "17": {
        "id": 17,
        "label": "Power Source"
    },
    "18": {
        "id": 18,
        "label": "Ota Requestor"
    },
    "19": {
        "id": 19,
        "label": "Bridged Node"
    },
    "20": {
        "id": 20,
        "label": "Ota Provider"
    },
    "21": {
        "id": 21,
        "label": "Contact Sensor"
    },
    "22": {
        "id": 22,
        "label": "Root Node"
    },
    "23": {
        "id": 23,
        "label": "Solar Power"
    },
    "24": {
        "id": 24,
        "label": "Battery Storage"
    },
    "25": {
        "id": 25,
        "label": "Secondary Network Interface"
    },
    "34": {
        "id": 34,
        "label": "Speaker"
    },
    "35": {
        "id": 35,
        "label": "Casting Video Player"
    },
    "36": {
        "id": 36,
        "label": "Content App"
    },
    "39": {
        "id": 39,
        "label": "Mode Select"
    },
    "40": {
        "id": 40,
        "label": "Basic Video Player"
    },
    "41": {
        "id": 41,
        "label": "Casting Video Client"
    },
    "42": {
        "id": 42,
        "label": "Video Remote Control"
    },
    "43": {
        "id": 43,
        "label": "Fan"
    },
    "44": {
        "id": 44,
        "label": "Air Quality Sensor"
    },
    "45": {
        "id": 45,
        "label": "Air Purifier"
    },
    "65": {
        "id": 65,
        "label": "Water Freeze Detector"
    },
    "66": {
        "id": 66,
        "label": "Water Valve"
    },
    "67": {
        "id": 67,
        "label": "Water Leak Detector"
    },
    "68": {
        "id": 68,
        "label": "Rain Sensor"
    },
    "112": {
        "id": 112,
        "label": "Refrigerator"
    },
    "113": {
        "id": 113,
        "label": "Temperature Controlled Cabinet"
    },
    "114": {
        "id": 114,
        "label": "Room Air Conditioner"
    },
    "115": {
        "id": 115,
        "label": "Laundry Washer"
    },
    "116": {
        "id": 116,
        "label": "Robotic Vacuum Cleaner"
    },
    "117": {
        "id": 117,
        "label": "Dishwasher"
    },
    "118": {
        "id": 118,
        "label": "Smoke Co Alarm"
    },
    "119": {
        "id": 119,
        "label": "Cook Surface"
    },
    "120": {
        "id": 120,
        "label": "Cooktop"
    },
    "121": {
        "id": 121,
        "label": "Microwave Oven"
    },
    "122": {
        "id": 122,
        "label": "Extractor Hood"
    },
    "123": {
        "id": 123,
        "label": "Oven"
    },
    "124": {
        "id": 124,
        "label": "Laundry Dryer"
    },
    "144": {
        "id": 144,
        "label": "Network Infrastructure Manager"
    },
    "256": {
        "id": 256,
        "label": "On Off Light"
    },
    "257": {
        "id": 257,
        "label": "Dimmable Light"
    },
    "259": {
        "id": 259,
        "label": "On Off Light Switch"
    },
    "260": {
        "id": 260,
        "label": "Dimmer Switch"
    },
    "261": {
        "id": 261,
        "label": "Color Dimmer Switch"
    },
    "262": {
        "id": 262,
        "label": "Light Sensor"
    },
    "263": {
        "id": 263,
        "label": "Occupancy Sensor"
    },
    "266": {
        "id": 266,
        "label": "On Off Plug In Unit"
    },
    "267": {
        "id": 267,
        "label": "Dimmable Plug In Unit"
    },
    "268": {
        "id": 268,
        "label": "Color Temperature Light"
    },
    "269": {
        "id": 269,
        "label": "Extended Color Light"
    },
    "271": {
        "id": 271,
        "label": "Mounted On Off Control"
    },
    "272": {
        "id": 272,
        "label": "Mounted Dimmable Load Control"
    },
    "304": {
        "id": 304,
        "label": "Joint Fabric Administrator"
    },
    "514": {
        "id": 514,
        "label": "Window Covering"
    },
    "515": {
        "id": 515,
        "label": "Window Covering Controller"
    },
    "769": {
        "id": 769,
        "label": "Thermostat"
    },
    "770": {
        "id": 770,
        "label": "Temperature Sensor"
    },
    "771": {
        "id": 771,
        "label": "Pump"
    },
    "772": {
        "id": 772,
        "label": "Pump Controller"
    },
    "773": {
        "id": 773,
        "label": "Pressure Sensor"
    },
    "774": {
        "id": 774,
        "label": "Flow Sensor"
    },
    "775": {
        "id": 775,
        "label": "Humidity Sensor"
    },
    "777": {
        "id": 777,
        "label": "Heat Pump"
    },
    "778": {
        "id": 778,
        "label": "Thermostat Controller"
    },
    "1292": {
        "id": 1292,
        "label": "Energy Evse"
    },
    "1293": {
        "id": 1293,
        "label": "Device Energy Management"
    },
    "1295": {
        "id": 1295,
        "label": "Water Heater"
    },
    "1296": {
        "id": 1296,
        "label": "Electrical Sensor"
    },
    "2112": {
        "id": 2112,
        "label": "Control Bridge"
    },
    "2128": {
        "id": 2128,
        "label": "On Off Sensor"
    }
};

export const clusters: Record<number, ClusterDescription> = {
    "3": {
        "id": 3,
        "label": "Identify",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 3,
                "label": "Identify Time",
                "type": "uint16"
            },
            "1": {
                "id": 1,
                "cluster_id": 3,
                "label": "Identify Type",
                "type": "IdentifyTypeEnum"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 3,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 3,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 3,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 3,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 3,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 3,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "4": {
        "id": 4,
        "label": "Groups",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 4,
                "label": "Name Support",
                "type": "NameSupportBitmap"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 4,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 4,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 4,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 4,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 4,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 4,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "6": {
        "id": 6,
        "label": "On Off",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 6,
                "label": "On Off",
                "type": "bool"
            },
            "16384": {
                "id": 16384,
                "cluster_id": 6,
                "label": "Global Scene Control",
                "type": "Optional[bool]"
            },
            "16385": {
                "id": 16385,
                "cluster_id": 6,
                "label": "On Time",
                "type": "Optional[uint16]"
            },
            "16386": {
                "id": 16386,
                "cluster_id": 6,
                "label": "Off Wait Time",
                "type": "Optional[uint16]"
            },
            "16387": {
                "id": 16387,
                "cluster_id": 6,
                "label": "Start Up On Off",
                "type": "Optional[Nullable[StartUpOnOffEnum]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 6,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 6,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 6,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 6,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 6,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 6,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "8": {
        "id": 8,
        "label": "Level Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 8,
                "label": "Current Level",
                "type": "Nullable[uint8]"
            },
            "1": {
                "id": 1,
                "cluster_id": 8,
                "label": "Remaining Time",
                "type": "Optional[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 8,
                "label": "Min Level",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 8,
                "label": "Max Level",
                "type": "Optional[uint8]"
            },
            "4": {
                "id": 4,
                "cluster_id": 8,
                "label": "Current Frequency",
                "type": "Optional[uint16]"
            },
            "5": {
                "id": 5,
                "cluster_id": 8,
                "label": "Min Frequency",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 8,
                "label": "Max Frequency",
                "type": "Optional[uint16]"
            },
            "15": {
                "id": 15,
                "cluster_id": 8,
                "label": "Options",
                "type": "OptionsBitmap"
            },
            "16": {
                "id": 16,
                "cluster_id": 8,
                "label": "On Off Transition Time",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 8,
                "label": "On Level",
                "type": "Nullable[uint8]"
            },
            "18": {
                "id": 18,
                "cluster_id": 8,
                "label": "On Transition Time",
                "type": "Optional[Nullable[uint16]]"
            },
            "19": {
                "id": 19,
                "cluster_id": 8,
                "label": "Off Transition Time",
                "type": "Optional[Nullable[uint16]]"
            },
            "20": {
                "id": 20,
                "cluster_id": 8,
                "label": "Default Move Rate",
                "type": "Optional[Nullable[uint8]]"
            },
            "16384": {
                "id": 16384,
                "cluster_id": 8,
                "label": "Start Up Current Level",
                "type": "Optional[Nullable[uint8]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 8,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 8,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 8,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 8,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 8,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 8,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "29": {
        "id": 29,
        "label": "Descriptor",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 29,
                "label": "Device Type List",
                "type": "List[DeviceTypeStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 29,
                "label": "Server List",
                "type": "List[cluster-id]"
            },
            "2": {
                "id": 2,
                "cluster_id": 29,
                "label": "Client List",
                "type": "List[cluster-id]"
            },
            "3": {
                "id": 3,
                "cluster_id": 29,
                "label": "Parts List",
                "type": "List[endpoint-no]"
            },
            "4": {
                "id": 4,
                "cluster_id": 29,
                "label": "Tag List",
                "type": "List[semtag]"
            },
            "5": {
                "id": 5,
                "cluster_id": 29,
                "label": "Endpoint Unique Id",
                "type": "Optional[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 29,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 29,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 29,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 29,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 29,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 29,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "30": {
        "id": 30,
        "label": "Binding",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 30,
                "label": "Binding",
                "type": "List[TargetStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 30,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 30,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 30,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 30,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 30,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 30,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "31": {
        "id": 31,
        "label": "Access Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 31,
                "label": "Acl",
                "type": "List[AccessControlEntryStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 31,
                "label": "Extension",
                "type": "List[AccessControlExtensionStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 31,
                "label": "Subjects Per Access Control Entry",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 31,
                "label": "Targets Per Access Control Entry",
                "type": "uint16"
            },
            "4": {
                "id": 4,
                "cluster_id": 31,
                "label": "Access Control Entries Per Fabric",
                "type": "uint16"
            },
            "5": {
                "id": 5,
                "cluster_id": 31,
                "label": "Commissioning Arl",
                "type": "List[CommissioningAccessRestrictionEntryStruct]"
            },
            "6": {
                "id": 6,
                "cluster_id": 31,
                "label": "Arl",
                "type": "List[AccessRestrictionEntryStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 31,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 31,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 31,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 31,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 31,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 31,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "37": {
        "id": 37,
        "label": "Actions",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 37,
                "label": "Action List",
                "type": "List[ActionStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 37,
                "label": "Endpoint Lists",
                "type": "List[EndpointListStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 37,
                "label": "Setup Url",
                "type": "Optional[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 37,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 37,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 37,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 37,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 37,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 37,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "40": {
        "id": 40,
        "label": "Basic Information",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 40,
                "label": "Data Model Revision",
                "type": "uint16"
            },
            "1": {
                "id": 1,
                "cluster_id": 40,
                "label": "Vendor Name",
                "type": "string"
            },
            "2": {
                "id": 2,
                "cluster_id": 40,
                "label": "Vendor Id",
                "type": "vendor-id"
            },
            "3": {
                "id": 3,
                "cluster_id": 40,
                "label": "Product Name",
                "type": "string"
            },
            "4": {
                "id": 4,
                "cluster_id": 40,
                "label": "Product Id",
                "type": "uint16"
            },
            "5": {
                "id": 5,
                "cluster_id": 40,
                "label": "Node Label",
                "type": "string"
            },
            "6": {
                "id": 6,
                "cluster_id": 40,
                "label": "Location",
                "type": "string"
            },
            "7": {
                "id": 7,
                "cluster_id": 40,
                "label": "Hardware Version",
                "type": "uint16"
            },
            "8": {
                "id": 8,
                "cluster_id": 40,
                "label": "Hardware Version String",
                "type": "string"
            },
            "9": {
                "id": 9,
                "cluster_id": 40,
                "label": "Software Version",
                "type": "uint32"
            },
            "10": {
                "id": 10,
                "cluster_id": 40,
                "label": "Software Version String",
                "type": "string"
            },
            "11": {
                "id": 11,
                "cluster_id": 40,
                "label": "Manufacturing Date",
                "type": "Optional[string]"
            },
            "12": {
                "id": 12,
                "cluster_id": 40,
                "label": "Part Number",
                "type": "Optional[string]"
            },
            "13": {
                "id": 13,
                "cluster_id": 40,
                "label": "Product Url",
                "type": "Optional[string]"
            },
            "14": {
                "id": 14,
                "cluster_id": 40,
                "label": "Product Label",
                "type": "Optional[string]"
            },
            "15": {
                "id": 15,
                "cluster_id": 40,
                "label": "Serial Number",
                "type": "Optional[string]"
            },
            "16": {
                "id": 16,
                "cluster_id": 40,
                "label": "Local Config Disabled",
                "type": "Optional[bool]"
            },
            "17": {
                "id": 17,
                "cluster_id": 40,
                "label": "Reachable",
                "type": "Optional[bool]"
            },
            "18": {
                "id": 18,
                "cluster_id": 40,
                "label": "Unique Id",
                "type": "string"
            },
            "19": {
                "id": 19,
                "cluster_id": 40,
                "label": "Capability Minima",
                "type": "CapabilityMinimaStruct"
            },
            "20": {
                "id": 20,
                "cluster_id": 40,
                "label": "Product Appearance",
                "type": "Optional[ProductAppearanceStruct]"
            },
            "21": {
                "id": 21,
                "cluster_id": 40,
                "label": "Specification Version",
                "type": "uint32"
            },
            "22": {
                "id": 22,
                "cluster_id": 40,
                "label": "Max Paths Per Invoke",
                "type": "uint16"
            },
            "24": {
                "id": 24,
                "cluster_id": 40,
                "label": "Configuration Version",
                "type": "Optional[uint32]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 40,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 40,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 40,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 40,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 40,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 40,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "41": {
        "id": 41,
        "label": "Ota Software Update Provider",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 41,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 41,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 41,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 41,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 41,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 41,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "42": {
        "id": 42,
        "label": "Ota Software Update Requestor",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 42,
                "label": "Default Ota Providers",
                "type": "List[ProviderLocation]"
            },
            "1": {
                "id": 1,
                "cluster_id": 42,
                "label": "Update Possible",
                "type": "bool"
            },
            "2": {
                "id": 2,
                "cluster_id": 42,
                "label": "Update State",
                "type": "UpdateStateEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 42,
                "label": "Update State Progress",
                "type": "Nullable[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 42,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 42,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 42,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 42,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 42,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 42,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "43": {
        "id": 43,
        "label": "Localization Configuration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 43,
                "label": "Active Locale",
                "type": "string"
            },
            "1": {
                "id": 1,
                "cluster_id": 43,
                "label": "Supported Locales",
                "type": "List[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 43,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 43,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 43,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 43,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 43,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 43,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "44": {
        "id": 44,
        "label": "Time Format Localization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 44,
                "label": "Hour Format",
                "type": "HourFormatEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 44,
                "label": "Active Calendar Type",
                "type": "Optional[CalendarTypeEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 44,
                "label": "Supported Calendar Types",
                "type": "List[CalendarTypeEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 44,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 44,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 44,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 44,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 44,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 44,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "45": {
        "id": 45,
        "label": "Unit Localization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 45,
                "label": "Temperature Unit",
                "type": "Optional[TempUnitEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 45,
                "label": "Supported Temperature Units",
                "type": "List[TempUnitEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 45,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 45,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 45,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 45,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 45,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 45,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "46": {
        "id": 46,
        "label": "Power Source Configuration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 46,
                "label": "Sources",
                "type": "List[endpoint-no]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 46,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 46,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 46,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 46,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 46,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 46,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "47": {
        "id": 47,
        "label": "Power Source",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 47,
                "label": "Status",
                "type": "PowerSourceStatusEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 47,
                "label": "Order",
                "type": "uint8"
            },
            "2": {
                "id": 2,
                "cluster_id": 47,
                "label": "Description",
                "type": "string"
            },
            "3": {
                "id": 3,
                "cluster_id": 47,
                "label": "Wired Assessed Input Voltage",
                "type": "Optional[Nullable[uint32]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 47,
                "label": "Wired Assessed Input Frequency",
                "type": "Optional[Nullable[uint16]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 47,
                "label": "Wired Current Type",
                "type": "Optional[WiredCurrentTypeEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 47,
                "label": "Wired Assessed Current",
                "type": "Optional[Nullable[uint32]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 47,
                "label": "Wired Nominal Voltage",
                "type": "Optional[uint32]"
            },
            "8": {
                "id": 8,
                "cluster_id": 47,
                "label": "Wired Maximum Current",
                "type": "Optional[uint32]"
            },
            "9": {
                "id": 9,
                "cluster_id": 47,
                "label": "Wired Present",
                "type": "Optional[bool]"
            },
            "10": {
                "id": 10,
                "cluster_id": 47,
                "label": "Active Wired Faults",
                "type": "List[WiredFaultEnum]"
            },
            "11": {
                "id": 11,
                "cluster_id": 47,
                "label": "Bat Voltage",
                "type": "Optional[Nullable[uint32]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 47,
                "label": "Bat Percent Remaining",
                "type": "Optional[Nullable[uint8]]"
            },
            "13": {
                "id": 13,
                "cluster_id": 47,
                "label": "Bat Time Remaining",
                "type": "Optional[Nullable[uint32]]"
            },
            "14": {
                "id": 14,
                "cluster_id": 47,
                "label": "Bat Charge Level",
                "type": "Optional[BatChargeLevelEnum]"
            },
            "15": {
                "id": 15,
                "cluster_id": 47,
                "label": "Bat Replacement Needed",
                "type": "Optional[bool]"
            },
            "16": {
                "id": 16,
                "cluster_id": 47,
                "label": "Bat Replaceability",
                "type": "Optional[BatReplaceabilityEnum]"
            },
            "17": {
                "id": 17,
                "cluster_id": 47,
                "label": "Bat Present",
                "type": "Optional[bool]"
            },
            "18": {
                "id": 18,
                "cluster_id": 47,
                "label": "Active Bat Faults",
                "type": "List[BatFaultEnum]"
            },
            "19": {
                "id": 19,
                "cluster_id": 47,
                "label": "Bat Replacement Description",
                "type": "Optional[string]"
            },
            "20": {
                "id": 20,
                "cluster_id": 47,
                "label": "Bat Common Designation",
                "type": "Optional[BatCommonDesignationEnum]"
            },
            "21": {
                "id": 21,
                "cluster_id": 47,
                "label": "Bat Ansi Designation",
                "type": "Optional[string]"
            },
            "22": {
                "id": 22,
                "cluster_id": 47,
                "label": "Bat Iec Designation",
                "type": "Optional[string]"
            },
            "23": {
                "id": 23,
                "cluster_id": 47,
                "label": "Bat Approved Chemistry",
                "type": "Optional[BatApprovedChemistryEnum]"
            },
            "24": {
                "id": 24,
                "cluster_id": 47,
                "label": "Bat Capacity",
                "type": "Optional[uint32]"
            },
            "25": {
                "id": 25,
                "cluster_id": 47,
                "label": "Bat Quantity",
                "type": "Optional[uint8]"
            },
            "26": {
                "id": 26,
                "cluster_id": 47,
                "label": "Bat Charge State",
                "type": "Optional[BatChargeStateEnum]"
            },
            "27": {
                "id": 27,
                "cluster_id": 47,
                "label": "Bat Time To Full Charge",
                "type": "Optional[Nullable[uint32]]"
            },
            "28": {
                "id": 28,
                "cluster_id": 47,
                "label": "Bat Functional While Charging",
                "type": "Optional[bool]"
            },
            "29": {
                "id": 29,
                "cluster_id": 47,
                "label": "Bat Charging Current",
                "type": "Optional[Nullable[uint32]]"
            },
            "30": {
                "id": 30,
                "cluster_id": 47,
                "label": "Active Bat Charge Faults",
                "type": "List[BatChargeFaultEnum]"
            },
            "31": {
                "id": 31,
                "cluster_id": 47,
                "label": "Endpoint List",
                "type": "List[endpoint-no]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 47,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 47,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 47,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 47,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 47,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 47,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "48": {
        "id": 48,
        "label": "General Commissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 48,
                "label": "Breadcrumb",
                "type": "uint64"
            },
            "1": {
                "id": 1,
                "cluster_id": 48,
                "label": "Basic Commissioning Info",
                "type": "BasicCommissioningInfo"
            },
            "2": {
                "id": 2,
                "cluster_id": 48,
                "label": "Regulatory Config",
                "type": "RegulatoryLocationTypeEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 48,
                "label": "Location Capability",
                "type": "RegulatoryLocationTypeEnum"
            },
            "4": {
                "id": 4,
                "cluster_id": 48,
                "label": "Supports Concurrent Connection",
                "type": "bool"
            },
            "5": {
                "id": 5,
                "cluster_id": 48,
                "label": "Tc Accepted Version",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 48,
                "label": "Tc Min Required Version",
                "type": "Optional[uint16]"
            },
            "7": {
                "id": 7,
                "cluster_id": 48,
                "label": "Tc Acknowledgements",
                "type": "Optional[map16]"
            },
            "8": {
                "id": 8,
                "cluster_id": 48,
                "label": "Tc Acknowledgements Required",
                "type": "Optional[bool]"
            },
            "9": {
                "id": 9,
                "cluster_id": 48,
                "label": "Tc Update Deadline",
                "type": "Optional[Nullable[uint32]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 48,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 48,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 48,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 48,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 48,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 48,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "49": {
        "id": 49,
        "label": "Network Commissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 49,
                "label": "Max Networks",
                "type": "uint8"
            },
            "1": {
                "id": 1,
                "cluster_id": 49,
                "label": "Networks",
                "type": "List[NetworkInfoStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 49,
                "label": "Scan Max Time Seconds",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 49,
                "label": "Connect Max Time Seconds",
                "type": "Optional[uint8]"
            },
            "4": {
                "id": 4,
                "cluster_id": 49,
                "label": "Interface Enabled",
                "type": "bool"
            },
            "5": {
                "id": 5,
                "cluster_id": 49,
                "label": "Last Networking Status",
                "type": "Nullable[NetworkCommissioningStatusEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 49,
                "label": "Last Network Id",
                "type": "Nullable[bytes]"
            },
            "7": {
                "id": 7,
                "cluster_id": 49,
                "label": "Last Connect Error Value",
                "type": "Nullable[int32]"
            },
            "8": {
                "id": 8,
                "cluster_id": 49,
                "label": "Supported Wi Fi Bands",
                "type": "List[WiFiBandEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 49,
                "label": "Supported Thread Features",
                "type": "Optional[ThreadCapabilitiesBitmap]"
            },
            "10": {
                "id": 10,
                "cluster_id": 49,
                "label": "Thread Version",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 49,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 49,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 49,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 49,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 49,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 49,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "50": {
        "id": 50,
        "label": "Diagnostic Logs",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 50,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 50,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 50,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 50,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 50,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 50,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "51": {
        "id": 51,
        "label": "General Diagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 51,
                "label": "Network Interfaces",
                "type": "List[NetworkInterface]"
            },
            "1": {
                "id": 1,
                "cluster_id": 51,
                "label": "Reboot Count",
                "type": "uint16"
            },
            "2": {
                "id": 2,
                "cluster_id": 51,
                "label": "Up Time",
                "type": "uint64"
            },
            "3": {
                "id": 3,
                "cluster_id": 51,
                "label": "Total Operational Hours",
                "type": "Optional[uint32]"
            },
            "4": {
                "id": 4,
                "cluster_id": 51,
                "label": "Boot Reason",
                "type": "Optional[BootReasonEnum]"
            },
            "5": {
                "id": 5,
                "cluster_id": 51,
                "label": "Active Hardware Faults",
                "type": "List[HardwareFaultEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 51,
                "label": "Active Radio Faults",
                "type": "List[RadioFaultEnum]"
            },
            "7": {
                "id": 7,
                "cluster_id": 51,
                "label": "Active Network Faults",
                "type": "List[NetworkFaultEnum]"
            },
            "8": {
                "id": 8,
                "cluster_id": 51,
                "label": "Test Event Triggers Enabled",
                "type": "bool"
            },
            "9": {
                "id": 9,
                "cluster_id": 51,
                "label": "Do Not Use",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 51,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 51,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 51,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 51,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 51,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 51,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "52": {
        "id": 52,
        "label": "Software Diagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 52,
                "label": "Thread Metrics",
                "type": "List[ThreadMetricsStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 52,
                "label": "Current Heap Free",
                "type": "Optional[uint64]"
            },
            "2": {
                "id": 2,
                "cluster_id": 52,
                "label": "Current Heap Used",
                "type": "Optional[uint64]"
            },
            "3": {
                "id": 3,
                "cluster_id": 52,
                "label": "Current Heap High Watermark",
                "type": "Optional[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 52,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 52,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 52,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 52,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 52,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 52,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "53": {
        "id": 53,
        "label": "Thread Network Diagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 53,
                "label": "Channel",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 53,
                "label": "Routing Role",
                "type": "Nullable[RoutingRoleEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 53,
                "label": "Network Name",
                "type": "Nullable[string]"
            },
            "3": {
                "id": 3,
                "cluster_id": 53,
                "label": "Pan Id",
                "type": "Nullable[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 53,
                "label": "Extended Pan Id",
                "type": "Nullable[uint64]"
            },
            "5": {
                "id": 5,
                "cluster_id": 53,
                "label": "Mesh Local Prefix",
                "type": "Nullable[bytes]"
            },
            "6": {
                "id": 6,
                "cluster_id": 53,
                "label": "Overrun Count",
                "type": "Optional[uint64]"
            },
            "7": {
                "id": 7,
                "cluster_id": 53,
                "label": "Neighbor Table",
                "type": "List[NeighborTableStruct]"
            },
            "8": {
                "id": 8,
                "cluster_id": 53,
                "label": "Route Table",
                "type": "List[RouteTableStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 53,
                "label": "Partition Id",
                "type": "Nullable[uint32]"
            },
            "10": {
                "id": 10,
                "cluster_id": 53,
                "label": "Weighting",
                "type": "Nullable[uint16]"
            },
            "11": {
                "id": 11,
                "cluster_id": 53,
                "label": "Data Version",
                "type": "Nullable[uint16]"
            },
            "12": {
                "id": 12,
                "cluster_id": 53,
                "label": "Stable Data Version",
                "type": "Nullable[uint16]"
            },
            "13": {
                "id": 13,
                "cluster_id": 53,
                "label": "Leader Router Id",
                "type": "Nullable[uint8]"
            },
            "14": {
                "id": 14,
                "cluster_id": 53,
                "label": "Detached Role Count",
                "type": "Optional[uint16]"
            },
            "15": {
                "id": 15,
                "cluster_id": 53,
                "label": "Child Role Count",
                "type": "Optional[uint16]"
            },
            "16": {
                "id": 16,
                "cluster_id": 53,
                "label": "Router Role Count",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 53,
                "label": "Leader Role Count",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 53,
                "label": "Attach Attempt Count",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 53,
                "label": "Partition Id Change Count",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 53,
                "label": "Better Partition Attach Attempt Count",
                "type": "Optional[uint16]"
            },
            "21": {
                "id": 21,
                "cluster_id": 53,
                "label": "Parent Change Count",
                "type": "Optional[uint16]"
            },
            "22": {
                "id": 22,
                "cluster_id": 53,
                "label": "Tx Total Count",
                "type": "Optional[uint32]"
            },
            "23": {
                "id": 23,
                "cluster_id": 53,
                "label": "Tx Unicast Count",
                "type": "Optional[uint32]"
            },
            "24": {
                "id": 24,
                "cluster_id": 53,
                "label": "Tx Broadcast Count",
                "type": "Optional[uint32]"
            },
            "25": {
                "id": 25,
                "cluster_id": 53,
                "label": "Tx Ack Requested Count",
                "type": "Optional[uint32]"
            },
            "26": {
                "id": 26,
                "cluster_id": 53,
                "label": "Tx Acked Count",
                "type": "Optional[uint32]"
            },
            "27": {
                "id": 27,
                "cluster_id": 53,
                "label": "Tx No Ack Requested Count",
                "type": "Optional[uint32]"
            },
            "28": {
                "id": 28,
                "cluster_id": 53,
                "label": "Tx Data Count",
                "type": "Optional[uint32]"
            },
            "29": {
                "id": 29,
                "cluster_id": 53,
                "label": "Tx Data Poll Count",
                "type": "Optional[uint32]"
            },
            "30": {
                "id": 30,
                "cluster_id": 53,
                "label": "Tx Beacon Count",
                "type": "Optional[uint32]"
            },
            "31": {
                "id": 31,
                "cluster_id": 53,
                "label": "Tx Beacon Request Count",
                "type": "Optional[uint32]"
            },
            "32": {
                "id": 32,
                "cluster_id": 53,
                "label": "Tx Other Count",
                "type": "Optional[uint32]"
            },
            "33": {
                "id": 33,
                "cluster_id": 53,
                "label": "Tx Retry Count",
                "type": "Optional[uint32]"
            },
            "34": {
                "id": 34,
                "cluster_id": 53,
                "label": "Tx Direct Max Retry Expiry Count",
                "type": "Optional[uint32]"
            },
            "35": {
                "id": 35,
                "cluster_id": 53,
                "label": "Tx Indirect Max Retry Expiry Count",
                "type": "Optional[uint32]"
            },
            "36": {
                "id": 36,
                "cluster_id": 53,
                "label": "Tx Err Cca Count",
                "type": "Optional[uint32]"
            },
            "37": {
                "id": 37,
                "cluster_id": 53,
                "label": "Tx Err Abort Count",
                "type": "Optional[uint32]"
            },
            "38": {
                "id": 38,
                "cluster_id": 53,
                "label": "Tx Err Busy Channel Count",
                "type": "Optional[uint32]"
            },
            "39": {
                "id": 39,
                "cluster_id": 53,
                "label": "Rx Total Count",
                "type": "Optional[uint32]"
            },
            "40": {
                "id": 40,
                "cluster_id": 53,
                "label": "Rx Unicast Count",
                "type": "Optional[uint32]"
            },
            "41": {
                "id": 41,
                "cluster_id": 53,
                "label": "Rx Broadcast Count",
                "type": "Optional[uint32]"
            },
            "42": {
                "id": 42,
                "cluster_id": 53,
                "label": "Rx Data Count",
                "type": "Optional[uint32]"
            },
            "43": {
                "id": 43,
                "cluster_id": 53,
                "label": "Rx Data Poll Count",
                "type": "Optional[uint32]"
            },
            "44": {
                "id": 44,
                "cluster_id": 53,
                "label": "Rx Beacon Count",
                "type": "Optional[uint32]"
            },
            "45": {
                "id": 45,
                "cluster_id": 53,
                "label": "Rx Beacon Request Count",
                "type": "Optional[uint32]"
            },
            "46": {
                "id": 46,
                "cluster_id": 53,
                "label": "Rx Other Count",
                "type": "Optional[uint32]"
            },
            "47": {
                "id": 47,
                "cluster_id": 53,
                "label": "Rx Address Filtered Count",
                "type": "Optional[uint32]"
            },
            "48": {
                "id": 48,
                "cluster_id": 53,
                "label": "Rx Dest Addr Filtered Count",
                "type": "Optional[uint32]"
            },
            "49": {
                "id": 49,
                "cluster_id": 53,
                "label": "Rx Duplicated Count",
                "type": "Optional[uint32]"
            },
            "50": {
                "id": 50,
                "cluster_id": 53,
                "label": "Rx Err No Frame Count",
                "type": "Optional[uint32]"
            },
            "51": {
                "id": 51,
                "cluster_id": 53,
                "label": "Rx Err Unknown Neighbor Count",
                "type": "Optional[uint32]"
            },
            "52": {
                "id": 52,
                "cluster_id": 53,
                "label": "Rx Err Invalid Src Addr Count",
                "type": "Optional[uint32]"
            },
            "53": {
                "id": 53,
                "cluster_id": 53,
                "label": "Rx Err Sec Count",
                "type": "Optional[uint32]"
            },
            "54": {
                "id": 54,
                "cluster_id": 53,
                "label": "Rx Err Fcs Count",
                "type": "Optional[uint32]"
            },
            "55": {
                "id": 55,
                "cluster_id": 53,
                "label": "Rx Err Other Count",
                "type": "Optional[uint32]"
            },
            "56": {
                "id": 56,
                "cluster_id": 53,
                "label": "Active Timestamp",
                "type": "Optional[Nullable[uint64]]"
            },
            "57": {
                "id": 57,
                "cluster_id": 53,
                "label": "Pending Timestamp",
                "type": "Optional[Nullable[uint64]]"
            },
            "58": {
                "id": 58,
                "cluster_id": 53,
                "label": "Delay",
                "type": "Optional[Nullable[uint32]]"
            },
            "59": {
                "id": 59,
                "cluster_id": 53,
                "label": "Security Policy",
                "type": "Nullable[SecurityPolicy]"
            },
            "60": {
                "id": 60,
                "cluster_id": 53,
                "label": "Channel Page0 Mask",
                "type": "Nullable[bytes]"
            },
            "61": {
                "id": 61,
                "cluster_id": 53,
                "label": "Operational Dataset Components",
                "type": "Nullable[OperationalDatasetComponents]"
            },
            "62": {
                "id": 62,
                "cluster_id": 53,
                "label": "Active Network Faults List",
                "type": "List[NetworkFaultEnum]"
            },
            "63": {
                "id": 63,
                "cluster_id": 53,
                "label": "Ext Address",
                "type": "Optional[Nullable[uint64]]"
            },
            "64": {
                "id": 64,
                "cluster_id": 53,
                "label": "Rloc16",
                "type": "Optional[Nullable[uint16]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 53,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 53,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 53,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 53,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 53,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 53,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "54": {
        "id": 54,
        "label": "Wi Fi Network Diagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 54,
                "label": "Bssid",
                "type": "Nullable[bytes]"
            },
            "1": {
                "id": 1,
                "cluster_id": 54,
                "label": "Security Type",
                "type": "Nullable[SecurityTypeEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 54,
                "label": "Wi Fi Version",
                "type": "Nullable[WiFiVersionEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 54,
                "label": "Channel Number",
                "type": "Nullable[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 54,
                "label": "Rssi",
                "type": "Nullable[int8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 54,
                "label": "Beacon Lost Count",
                "type": "Optional[Nullable[uint32]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 54,
                "label": "Beacon Rx Count",
                "type": "Optional[Nullable[uint32]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 54,
                "label": "Packet Multicast Rx Count",
                "type": "Optional[Nullable[uint32]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 54,
                "label": "Packet Multicast Tx Count",
                "type": "Optional[Nullable[uint32]]"
            },
            "9": {
                "id": 9,
                "cluster_id": 54,
                "label": "Packet Unicast Rx Count",
                "type": "Optional[Nullable[uint32]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 54,
                "label": "Packet Unicast Tx Count",
                "type": "Optional[Nullable[uint32]]"
            },
            "11": {
                "id": 11,
                "cluster_id": 54,
                "label": "Current Max Rate",
                "type": "Optional[Nullable[uint64]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 54,
                "label": "Overrun Count",
                "type": "Optional[Nullable[uint64]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 54,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 54,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 54,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 54,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 54,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 54,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "55": {
        "id": 55,
        "label": "Ethernet Network Diagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 55,
                "label": "Phy Rate",
                "type": "Optional[Nullable[PHYRateEnum]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 55,
                "label": "Full Duplex",
                "type": "Optional[Nullable[bool]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 55,
                "label": "Packet Rx Count",
                "type": "Optional[uint64]"
            },
            "3": {
                "id": 3,
                "cluster_id": 55,
                "label": "Packet Tx Count",
                "type": "Optional[uint64]"
            },
            "4": {
                "id": 4,
                "cluster_id": 55,
                "label": "Tx Err Count",
                "type": "Optional[uint64]"
            },
            "5": {
                "id": 5,
                "cluster_id": 55,
                "label": "Collision Count",
                "type": "Optional[uint64]"
            },
            "6": {
                "id": 6,
                "cluster_id": 55,
                "label": "Overrun Count",
                "type": "Optional[uint64]"
            },
            "7": {
                "id": 7,
                "cluster_id": 55,
                "label": "Carrier Detect",
                "type": "Optional[Nullable[bool]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 55,
                "label": "Time Since Reset",
                "type": "Optional[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 55,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 55,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 55,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 55,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 55,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 55,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "56": {
        "id": 56,
        "label": "Time Synchronization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 56,
                "label": "Utc Time",
                "type": "Nullable[epoch-us]"
            },
            "1": {
                "id": 1,
                "cluster_id": 56,
                "label": "Granularity",
                "type": "GranularityEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 56,
                "label": "Time Source",
                "type": "Optional[TimeSourceEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 56,
                "label": "Trusted Time Source",
                "type": "Optional[Nullable[TrustedTimeSourceStruct]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 56,
                "label": "Default Ntp",
                "type": "Optional[Nullable[string]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 56,
                "label": "Time Zone",
                "type": "List[TimeZoneStruct]"
            },
            "6": {
                "id": 6,
                "cluster_id": 56,
                "label": "Dst Offset",
                "type": "List[DSTOffsetStruct]"
            },
            "7": {
                "id": 7,
                "cluster_id": 56,
                "label": "Local Time",
                "type": "Optional[Nullable[epoch-us]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 56,
                "label": "Time Zone Database",
                "type": "Optional[TimeZoneDatabaseEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 56,
                "label": "Ntp Server Available",
                "type": "Optional[bool]"
            },
            "10": {
                "id": 10,
                "cluster_id": 56,
                "label": "Time Zone List Max Size",
                "type": "Optional[uint8]"
            },
            "11": {
                "id": 11,
                "cluster_id": 56,
                "label": "Dst Offset List Max Size",
                "type": "Optional[uint8]"
            },
            "12": {
                "id": 12,
                "cluster_id": 56,
                "label": "Supports Dns Resolve",
                "type": "Optional[bool]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 56,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 56,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 56,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 56,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 56,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 56,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "57": {
        "id": 57,
        "label": "Bridged Device Basic Information",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 57,
                "label": "Data Model Revision",
                "type": "Optional[unknown]"
            },
            "1": {
                "id": 1,
                "cluster_id": 57,
                "label": "Vendor Name",
                "type": "Optional[string]"
            },
            "2": {
                "id": 2,
                "cluster_id": 57,
                "label": "Vendor Id",
                "type": "Optional[unknown]"
            },
            "3": {
                "id": 3,
                "cluster_id": 57,
                "label": "Product Name",
                "type": "Optional[string]"
            },
            "4": {
                "id": 4,
                "cluster_id": 57,
                "label": "Product Id",
                "type": "Optional[unknown]"
            },
            "5": {
                "id": 5,
                "cluster_id": 57,
                "label": "Node Label",
                "type": "Optional[string]"
            },
            "6": {
                "id": 6,
                "cluster_id": 57,
                "label": "Location",
                "type": "Optional[string]"
            },
            "7": {
                "id": 7,
                "cluster_id": 57,
                "label": "Hardware Version",
                "type": "Optional[unknown]"
            },
            "8": {
                "id": 8,
                "cluster_id": 57,
                "label": "Hardware Version String",
                "type": "Optional[string]"
            },
            "9": {
                "id": 9,
                "cluster_id": 57,
                "label": "Software Version",
                "type": "Optional[unknown]"
            },
            "10": {
                "id": 10,
                "cluster_id": 57,
                "label": "Software Version String",
                "type": "Optional[string]"
            },
            "11": {
                "id": 11,
                "cluster_id": 57,
                "label": "Manufacturing Date",
                "type": "Optional[string]"
            },
            "12": {
                "id": 12,
                "cluster_id": 57,
                "label": "Part Number",
                "type": "Optional[string]"
            },
            "13": {
                "id": 13,
                "cluster_id": 57,
                "label": "Product Url",
                "type": "Optional[string]"
            },
            "14": {
                "id": 14,
                "cluster_id": 57,
                "label": "Product Label",
                "type": "Optional[string]"
            },
            "15": {
                "id": 15,
                "cluster_id": 57,
                "label": "Serial Number",
                "type": "Optional[string]"
            },
            "16": {
                "id": 16,
                "cluster_id": 57,
                "label": "Local Config Disabled",
                "type": "Optional[bool]"
            },
            "17": {
                "id": 17,
                "cluster_id": 57,
                "label": "Reachable",
                "type": "bool"
            },
            "18": {
                "id": 18,
                "cluster_id": 57,
                "label": "Unique Id",
                "type": "string"
            },
            "19": {
                "id": 19,
                "cluster_id": 57,
                "label": "Capability Minima",
                "type": "Optional[unknown]"
            },
            "20": {
                "id": 20,
                "cluster_id": 57,
                "label": "Product Appearance",
                "type": "Optional[unknown]"
            },
            "21": {
                "id": 21,
                "cluster_id": 57,
                "label": "Specification Version",
                "type": "Optional[unknown]"
            },
            "22": {
                "id": 22,
                "cluster_id": 57,
                "label": "Max Paths Per Invoke",
                "type": "Optional[unknown]"
            },
            "24": {
                "id": 24,
                "cluster_id": 57,
                "label": "Configuration Version",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 57,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 57,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 57,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 57,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 57,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 57,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "59": {
        "id": 59,
        "label": "Switch",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 59,
                "label": "Number Of Positions",
                "type": "uint8"
            },
            "1": {
                "id": 1,
                "cluster_id": 59,
                "label": "Current Position",
                "type": "uint8"
            },
            "2": {
                "id": 2,
                "cluster_id": 59,
                "label": "Multi Press Max",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 59,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 59,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 59,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 59,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 59,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 59,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "60": {
        "id": 60,
        "label": "Administrator Commissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 60,
                "label": "Window Status",
                "type": "CommissioningWindowStatusEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 60,
                "label": "Admin Fabric Index",
                "type": "Nullable[fabric-idx]"
            },
            "2": {
                "id": 2,
                "cluster_id": 60,
                "label": "Admin Vendor Id",
                "type": "Nullable[vendor-id]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 60,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 60,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 60,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 60,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 60,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 60,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "62": {
        "id": 62,
        "label": "Operational Credentials",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 62,
                "label": "Nocs",
                "type": "List[NOCStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 62,
                "label": "Fabrics",
                "type": "List[FabricDescriptorStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 62,
                "label": "Supported Fabrics",
                "type": "uint8"
            },
            "3": {
                "id": 3,
                "cluster_id": 62,
                "label": "Commissioned Fabrics",
                "type": "uint8"
            },
            "4": {
                "id": 4,
                "cluster_id": 62,
                "label": "Trusted Root Certificates",
                "type": "List[octstr]"
            },
            "5": {
                "id": 5,
                "cluster_id": 62,
                "label": "Current Fabric Index",
                "type": "fabric-idx"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 62,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 62,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 62,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 62,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 62,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 62,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "63": {
        "id": 63,
        "label": "Group Key Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 63,
                "label": "Group Key Map",
                "type": "List[GroupKeyMapStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 63,
                "label": "Group Table",
                "type": "List[GroupInfoMapStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 63,
                "label": "Max Groups Per Fabric",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 63,
                "label": "Max Group Keys Per Fabric",
                "type": "uint16"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 63,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 63,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 63,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 63,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 63,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 63,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "64": {
        "id": 64,
        "label": "Fixed Label",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 64,
                "label": "Label List",
                "type": "List[LabelStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 64,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 64,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 64,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 64,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 64,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 64,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "65": {
        "id": 65,
        "label": "User Label",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 65,
                "label": "Label List",
                "type": "List[LabelStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 65,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 65,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 65,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 65,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 65,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 65,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "69": {
        "id": 69,
        "label": "Boolean State",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 69,
                "label": "State Value",
                "type": "bool"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 69,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 69,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 69,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 69,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 69,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 69,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "70": {
        "id": 70,
        "label": "Icd Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 70,
                "label": "Idle Mode Duration",
                "type": "uint32"
            },
            "1": {
                "id": 1,
                "cluster_id": 70,
                "label": "Active Mode Duration",
                "type": "uint32"
            },
            "2": {
                "id": 2,
                "cluster_id": 70,
                "label": "Active Mode Threshold",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 70,
                "label": "Registered Clients",
                "type": "List[MonitoringRegistrationStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 70,
                "label": "Icd Counter",
                "type": "Optional[uint32]"
            },
            "5": {
                "id": 5,
                "cluster_id": 70,
                "label": "Clients Supported Per Fabric",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 70,
                "label": "User Active Mode Trigger Hint",
                "type": "Optional[UserActiveModeTriggerBitmap]"
            },
            "7": {
                "id": 7,
                "cluster_id": 70,
                "label": "User Active Mode Trigger Instruction",
                "type": "Optional[string]"
            },
            "8": {
                "id": 8,
                "cluster_id": 70,
                "label": "Operating Mode",
                "type": "Optional[OperatingModeEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 70,
                "label": "Maximum Check In Backoff",
                "type": "Optional[uint32]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 70,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 70,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 70,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 70,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 70,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 70,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "72": {
        "id": 72,
        "label": "Oven Cavity Operational State",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 72,
                "label": "Phase List",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 72,
                "label": "Current Phase",
                "type": "Nullable[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 72,
                "label": "Countdown Time",
                "type": "Optional[Nullable[elapsed-s]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 72,
                "label": "Operational State List",
                "type": "List[OperationalStateStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 72,
                "label": "Operational State",
                "type": "OperationalStateEnum"
            },
            "5": {
                "id": 5,
                "cluster_id": 72,
                "label": "Operational Error",
                "type": "ErrorStateStruct"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 72,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 72,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 72,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 72,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 72,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 72,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "73": {
        "id": 73,
        "label": "Oven Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 73,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 73,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 73,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 73,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 73,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 73,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 73,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 73,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 73,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 73,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "74": {
        "id": 74,
        "label": "Laundry Dryer Controls",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 74,
                "label": "Supported Dryness Levels",
                "type": "List[DrynessLevelEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 74,
                "label": "Selected Dryness Level",
                "type": "Nullable[DrynessLevelEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 74,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 74,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 74,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 74,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 74,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 74,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "80": {
        "id": 80,
        "label": "Mode Select",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 80,
                "label": "Description",
                "type": "string"
            },
            "1": {
                "id": 1,
                "cluster_id": 80,
                "label": "Standard Namespace",
                "type": "Nullable[namespace]"
            },
            "2": {
                "id": 2,
                "cluster_id": 80,
                "label": "Supported Modes",
                "type": "List[ModeOptionStruct]"
            },
            "3": {
                "id": 3,
                "cluster_id": 80,
                "label": "Current Mode",
                "type": "uint8"
            },
            "4": {
                "id": 4,
                "cluster_id": 80,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[uint8]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 80,
                "label": "On Mode",
                "type": "Optional[Nullable[uint8]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 80,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 80,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 80,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 80,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 80,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 80,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "81": {
        "id": 81,
        "label": "Laundry Washer Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 81,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 81,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 81,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 81,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 81,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 81,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 81,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 81,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 81,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 81,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "82": {
        "id": 82,
        "label": "Refrigerator And Temperature Controlled Cabinet Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 82,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 82,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 82,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 82,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 82,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 82,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 82,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 82,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 82,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 82,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "83": {
        "id": 83,
        "label": "Laundry Washer Controls",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 83,
                "label": "Spin Speeds",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 83,
                "label": "Spin Speed Current",
                "type": "Optional[Nullable[uint8]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 83,
                "label": "Number Of Rinses",
                "type": "Optional[NumberOfRinsesEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 83,
                "label": "Supported Rinses",
                "type": "List[NumberOfRinsesEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 83,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 83,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 83,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 83,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 83,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 83,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "84": {
        "id": 84,
        "label": "Rvc Run Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 84,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 84,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 84,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 84,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 84,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 84,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 84,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 84,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 84,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 84,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "85": {
        "id": 85,
        "label": "Rvc Clean Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 85,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 85,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 85,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 85,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 85,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 85,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 85,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 85,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 85,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 85,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "86": {
        "id": 86,
        "label": "Temperature Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 86,
                "label": "Temperature Setpoint",
                "type": "Optional[temperature]"
            },
            "1": {
                "id": 1,
                "cluster_id": 86,
                "label": "Min Temperature",
                "type": "Optional[temperature]"
            },
            "2": {
                "id": 2,
                "cluster_id": 86,
                "label": "Max Temperature",
                "type": "Optional[temperature]"
            },
            "3": {
                "id": 3,
                "cluster_id": 86,
                "label": "Step",
                "type": "Optional[temperature]"
            },
            "4": {
                "id": 4,
                "cluster_id": 86,
                "label": "Selected Temperature Level",
                "type": "Optional[uint8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 86,
                "label": "Supported Temperature Levels",
                "type": "List[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 86,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 86,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 86,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 86,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 86,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 86,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "87": {
        "id": 87,
        "label": "Refrigerator Alarm",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 87,
                "label": "Mask",
                "type": "AlarmBitmap"
            },
            "1": {
                "id": 1,
                "cluster_id": 87,
                "label": "Latch",
                "type": "Optional[AlarmBitmap]"
            },
            "2": {
                "id": 2,
                "cluster_id": 87,
                "label": "State",
                "type": "AlarmBitmap"
            },
            "3": {
                "id": 3,
                "cluster_id": 87,
                "label": "Supported",
                "type": "AlarmBitmap"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 87,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 87,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 87,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 87,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 87,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 87,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "89": {
        "id": 89,
        "label": "Dishwasher Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 89,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 89,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 89,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 89,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 89,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 89,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 89,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 89,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 89,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 89,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "91": {
        "id": 91,
        "label": "Air Quality",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 91,
                "label": "Air Quality",
                "type": "AirQualityEnum"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 91,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 91,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 91,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 91,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 91,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 91,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "92": {
        "id": 92,
        "label": "Smoke Co Alarm",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 92,
                "label": "Expressed State",
                "type": "ExpressedStateEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 92,
                "label": "Smoke State",
                "type": "Optional[AlarmStateEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 92,
                "label": "Co State",
                "type": "Optional[AlarmStateEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 92,
                "label": "Battery Alert",
                "type": "AlarmStateEnum"
            },
            "4": {
                "id": 4,
                "cluster_id": 92,
                "label": "Device Muted",
                "type": "Optional[MuteStateEnum]"
            },
            "5": {
                "id": 5,
                "cluster_id": 92,
                "label": "Test In Progress",
                "type": "bool"
            },
            "6": {
                "id": 6,
                "cluster_id": 92,
                "label": "Hardware Fault Alert",
                "type": "bool"
            },
            "7": {
                "id": 7,
                "cluster_id": 92,
                "label": "End Of Service Alert",
                "type": "EndOfServiceEnum"
            },
            "8": {
                "id": 8,
                "cluster_id": 92,
                "label": "Interconnect Smoke Alarm",
                "type": "Optional[AlarmStateEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 92,
                "label": "Interconnect Co Alarm",
                "type": "Optional[AlarmStateEnum]"
            },
            "10": {
                "id": 10,
                "cluster_id": 92,
                "label": "Contamination State",
                "type": "Optional[ContaminationStateEnum]"
            },
            "11": {
                "id": 11,
                "cluster_id": 92,
                "label": "Smoke Sensitivity Level",
                "type": "Optional[SensitivityEnum]"
            },
            "12": {
                "id": 12,
                "cluster_id": 92,
                "label": "Expiry Date",
                "type": "Optional[epoch-s]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 92,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 92,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 92,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 92,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 92,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 92,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "93": {
        "id": 93,
        "label": "Dishwasher Alarm",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 93,
                "label": "Mask",
                "type": "AlarmBitmap"
            },
            "1": {
                "id": 1,
                "cluster_id": 93,
                "label": "Latch",
                "type": "Optional[AlarmBitmap]"
            },
            "2": {
                "id": 2,
                "cluster_id": 93,
                "label": "State",
                "type": "AlarmBitmap"
            },
            "3": {
                "id": 3,
                "cluster_id": 93,
                "label": "Supported",
                "type": "AlarmBitmap"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 93,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 93,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 93,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 93,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 93,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 93,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "94": {
        "id": 94,
        "label": "Microwave Oven Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 94,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 94,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 94,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 94,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 94,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 94,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 94,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 94,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 94,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 94,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "95": {
        "id": 95,
        "label": "Microwave Oven Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 95,
                "label": "Cook Time",
                "type": "elapsed-s"
            },
            "1": {
                "id": 1,
                "cluster_id": 95,
                "label": "Max Cook Time",
                "type": "elapsed-s"
            },
            "2": {
                "id": 2,
                "cluster_id": 95,
                "label": "Power Setting",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 95,
                "label": "Min Power",
                "type": "Optional[uint8]"
            },
            "4": {
                "id": 4,
                "cluster_id": 95,
                "label": "Max Power",
                "type": "Optional[uint8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 95,
                "label": "Power Step",
                "type": "Optional[uint8]"
            },
            "6": {
                "id": 6,
                "cluster_id": 95,
                "label": "Supported Watts",
                "type": "List[uint16]"
            },
            "7": {
                "id": 7,
                "cluster_id": 95,
                "label": "Selected Watt Index",
                "type": "Optional[uint8]"
            },
            "8": {
                "id": 8,
                "cluster_id": 95,
                "label": "Watt Rating",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 95,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 95,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 95,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 95,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 95,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 95,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "96": {
        "id": 96,
        "label": "Operational State",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 96,
                "label": "Phase List",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 96,
                "label": "Current Phase",
                "type": "Nullable[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 96,
                "label": "Countdown Time",
                "type": "Optional[Nullable[elapsed-s]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 96,
                "label": "Operational State List",
                "type": "List[OperationalStateStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 96,
                "label": "Operational State",
                "type": "OperationalStateEnum"
            },
            "5": {
                "id": 5,
                "cluster_id": 96,
                "label": "Operational Error",
                "type": "ErrorStateStruct"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 96,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 96,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 96,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 96,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 96,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 96,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "97": {
        "id": 97,
        "label": "Rvc Operational State",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 97,
                "label": "Phase List",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 97,
                "label": "Current Phase",
                "type": "Nullable[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 97,
                "label": "Countdown Time",
                "type": "Optional[Nullable[elapsed-s]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 97,
                "label": "Operational State List",
                "type": "List[OperationalStateStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 97,
                "label": "Operational State",
                "type": "OperationalStateEnum"
            },
            "5": {
                "id": 5,
                "cluster_id": 97,
                "label": "Operational Error",
                "type": "ErrorStateStruct"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 97,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 97,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 97,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 97,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 97,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 97,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "98": {
        "id": 98,
        "label": "Scenes Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 98,
                "label": "Do Not Use",
                "type": "Optional[unknown]"
            },
            "1": {
                "id": 1,
                "cluster_id": 98,
                "label": "Scene Table Size",
                "type": "uint16"
            },
            "2": {
                "id": 2,
                "cluster_id": 98,
                "label": "Fabric Scene Info",
                "type": "List[SceneInfoStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 98,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 98,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 98,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 98,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 98,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 98,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "113": {
        "id": 113,
        "label": "Hepa Filter Monitoring",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 113,
                "label": "Condition",
                "type": "Optional[percent]"
            },
            "1": {
                "id": 1,
                "cluster_id": 113,
                "label": "Degradation Direction",
                "type": "Optional[DegradationDirectionEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 113,
                "label": "Change Indication",
                "type": "ChangeIndicationEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 113,
                "label": "In Place Indicator",
                "type": "Optional[bool]"
            },
            "4": {
                "id": 4,
                "cluster_id": 113,
                "label": "Last Changed Time",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 113,
                "label": "Replacement Product List",
                "type": "List[ReplacementProductStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 113,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 113,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 113,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 113,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 113,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 113,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "114": {
        "id": 114,
        "label": "Activated Carbon Filter Monitoring",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 114,
                "label": "Condition",
                "type": "Optional[percent]"
            },
            "1": {
                "id": 1,
                "cluster_id": 114,
                "label": "Degradation Direction",
                "type": "Optional[DegradationDirectionEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 114,
                "label": "Change Indication",
                "type": "ChangeIndicationEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 114,
                "label": "In Place Indicator",
                "type": "Optional[bool]"
            },
            "4": {
                "id": 4,
                "cluster_id": 114,
                "label": "Last Changed Time",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 114,
                "label": "Replacement Product List",
                "type": "List[ReplacementProductStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 114,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 114,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 114,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 114,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 114,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 114,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "121": {
        "id": 121,
        "label": "Water Tank Level Monitoring",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 121,
                "label": "Condition",
                "type": "Optional[percent]"
            },
            "1": {
                "id": 1,
                "cluster_id": 121,
                "label": "Degradation Direction",
                "type": "Optional[DegradationDirectionEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 121,
                "label": "Change Indication",
                "type": "ChangeIndicationEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 121,
                "label": "In Place Indicator",
                "type": "Optional[bool]"
            },
            "4": {
                "id": 4,
                "cluster_id": 121,
                "label": "Last Changed Time",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 121,
                "label": "Replacement Product List",
                "type": "List[ReplacementProductStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 121,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 121,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 121,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 121,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 121,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 121,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "128": {
        "id": 128,
        "label": "Boolean State Configuration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 128,
                "label": "Current Sensitivity Level",
                "type": "Optional[uint8]"
            },
            "1": {
                "id": 1,
                "cluster_id": 128,
                "label": "Supported Sensitivity Levels",
                "type": "Optional[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 128,
                "label": "Default Sensitivity Level",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 128,
                "label": "Alarms Active",
                "type": "Optional[AlarmModeBitmap]"
            },
            "4": {
                "id": 4,
                "cluster_id": 128,
                "label": "Alarms Suppressed",
                "type": "Optional[AlarmModeBitmap]"
            },
            "5": {
                "id": 5,
                "cluster_id": 128,
                "label": "Alarms Enabled",
                "type": "Optional[AlarmModeBitmap]"
            },
            "6": {
                "id": 6,
                "cluster_id": 128,
                "label": "Alarms Supported",
                "type": "Optional[AlarmModeBitmap]"
            },
            "7": {
                "id": 7,
                "cluster_id": 128,
                "label": "Sensor Fault",
                "type": "Optional[SensorFaultBitmap]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 128,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 128,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 128,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 128,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 128,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 128,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "129": {
        "id": 129,
        "label": "Valve Configuration And Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 129,
                "label": "Open Duration",
                "type": "Nullable[elapsed-s]"
            },
            "1": {
                "id": 1,
                "cluster_id": 129,
                "label": "Default Open Duration",
                "type": "Nullable[elapsed-s]"
            },
            "2": {
                "id": 2,
                "cluster_id": 129,
                "label": "Auto Close Time",
                "type": "Optional[Nullable[epoch-us]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 129,
                "label": "Remaining Duration",
                "type": "Nullable[elapsed-s]"
            },
            "4": {
                "id": 4,
                "cluster_id": 129,
                "label": "Current State",
                "type": "Nullable[ValveStateEnum]"
            },
            "5": {
                "id": 5,
                "cluster_id": 129,
                "label": "Target State",
                "type": "Nullable[ValveStateEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 129,
                "label": "Current Level",
                "type": "Optional[Nullable[percent]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 129,
                "label": "Target Level",
                "type": "Optional[Nullable[percent]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 129,
                "label": "Default Open Level",
                "type": "Optional[percent]"
            },
            "9": {
                "id": 9,
                "cluster_id": 129,
                "label": "Valve Fault",
                "type": "Optional[ValveFaultBitmap]"
            },
            "10": {
                "id": 10,
                "cluster_id": 129,
                "label": "Level Step",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 129,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 129,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 129,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 129,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 129,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 129,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "144": {
        "id": 144,
        "label": "Electrical Power Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 144,
                "label": "Power Mode",
                "type": "PowerModeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 144,
                "label": "Number Of Measurement Types",
                "type": "uint8"
            },
            "2": {
                "id": 2,
                "cluster_id": 144,
                "label": "Accuracy",
                "type": "List[MeasurementAccuracyStruct]"
            },
            "3": {
                "id": 3,
                "cluster_id": 144,
                "label": "Ranges",
                "type": "List[MeasurementRangeStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 144,
                "label": "Voltage",
                "type": "Optional[Nullable[voltage-mV]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 144,
                "label": "Active Current",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 144,
                "label": "Reactive Current",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 144,
                "label": "Apparent Current",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 144,
                "label": "Active Power",
                "type": "Nullable[power-mW]"
            },
            "9": {
                "id": 9,
                "cluster_id": 144,
                "label": "Reactive Power",
                "type": "Optional[Nullable[power-mVAR]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 144,
                "label": "Apparent Power",
                "type": "Optional[Nullable[power-mVA]]"
            },
            "11": {
                "id": 11,
                "cluster_id": 144,
                "label": "Rms Voltage",
                "type": "Optional[Nullable[voltage-mV]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 144,
                "label": "Rms Current",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "13": {
                "id": 13,
                "cluster_id": 144,
                "label": "Rms Power",
                "type": "Optional[Nullable[power-mW]]"
            },
            "14": {
                "id": 14,
                "cluster_id": 144,
                "label": "Frequency",
                "type": "Optional[Nullable[int64]]"
            },
            "15": {
                "id": 15,
                "cluster_id": 144,
                "label": "Harmonic Currents",
                "type": "List[HarmonicMeasurementStruct]"
            },
            "16": {
                "id": 16,
                "cluster_id": 144,
                "label": "Harmonic Phases",
                "type": "List[HarmonicMeasurementStruct]"
            },
            "17": {
                "id": 17,
                "cluster_id": 144,
                "label": "Power Factor",
                "type": "Optional[Nullable[int64]]"
            },
            "18": {
                "id": 18,
                "cluster_id": 144,
                "label": "Neutral Current",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 144,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 144,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 144,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 144,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 144,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 144,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "145": {
        "id": 145,
        "label": "Electrical Energy Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 145,
                "label": "Accuracy",
                "type": "MeasurementAccuracyStruct"
            },
            "1": {
                "id": 1,
                "cluster_id": 145,
                "label": "Cumulative Energy Imported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 145,
                "label": "Cumulative Energy Exported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 145,
                "label": "Periodic Energy Imported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 145,
                "label": "Periodic Energy Exported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 145,
                "label": "Cumulative Energy Reset",
                "type": "Optional[Nullable[CumulativeEnergyResetStruct]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 145,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 145,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 145,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 145,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 145,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 145,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "148": {
        "id": 148,
        "label": "Water Heater Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 148,
                "label": "Heater Types",
                "type": "WaterHeaterHeatSourceBitmap"
            },
            "1": {
                "id": 1,
                "cluster_id": 148,
                "label": "Heat Demand",
                "type": "WaterHeaterHeatSourceBitmap"
            },
            "2": {
                "id": 2,
                "cluster_id": 148,
                "label": "Tank Volume",
                "type": "Optional[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 148,
                "label": "Estimated Heat Required",
                "type": "Optional[energy-mWh]"
            },
            "4": {
                "id": 4,
                "cluster_id": 148,
                "label": "Tank Percentage",
                "type": "Optional[percent]"
            },
            "5": {
                "id": 5,
                "cluster_id": 148,
                "label": "Boost State",
                "type": "BoostStateEnum"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 148,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 148,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 148,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 148,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 148,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 148,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "151": {
        "id": 151,
        "label": "Messages",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 151,
                "label": "Messages",
                "type": "List[MessageStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 151,
                "label": "Active Message Ids",
                "type": "List[MessageID]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 151,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 151,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 151,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 151,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 151,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 151,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "152": {
        "id": 152,
        "label": "Device Energy Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 152,
                "label": "Esa Type",
                "type": "ESATypeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 152,
                "label": "Esa Can Generate",
                "type": "bool"
            },
            "2": {
                "id": 2,
                "cluster_id": 152,
                "label": "Esa State",
                "type": "ESAStateEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 152,
                "label": "Abs Min Power",
                "type": "power-mW"
            },
            "4": {
                "id": 4,
                "cluster_id": 152,
                "label": "Abs Max Power",
                "type": "power-mW"
            },
            "5": {
                "id": 5,
                "cluster_id": 152,
                "label": "Power Adjustment Capability",
                "type": "Optional[Nullable[PowerAdjustCapabilityStruct]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 152,
                "label": "Forecast",
                "type": "Optional[Nullable[ForecastStruct]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 152,
                "label": "Opt Out State",
                "type": "Optional[OptOutStateEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 152,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 152,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 152,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 152,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 152,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 152,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "153": {
        "id": 153,
        "label": "Energy Evse",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 153,
                "label": "State",
                "type": "Nullable[StateEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 153,
                "label": "Supply State",
                "type": "SupplyStateEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 153,
                "label": "Fault State",
                "type": "FaultStateEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 153,
                "label": "Charging Enabled Until",
                "type": "Nullable[epoch-s]"
            },
            "4": {
                "id": 4,
                "cluster_id": 153,
                "label": "Discharging Enabled Until",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 153,
                "label": "Circuit Capacity",
                "type": "amperage-mA"
            },
            "6": {
                "id": 6,
                "cluster_id": 153,
                "label": "Minimum Charge Current",
                "type": "amperage-mA"
            },
            "7": {
                "id": 7,
                "cluster_id": 153,
                "label": "Maximum Charge Current",
                "type": "amperage-mA"
            },
            "8": {
                "id": 8,
                "cluster_id": 153,
                "label": "Maximum Discharge Current",
                "type": "Optional[amperage-mA]"
            },
            "9": {
                "id": 9,
                "cluster_id": 153,
                "label": "User Maximum Charge Current",
                "type": "Optional[amperage-mA]"
            },
            "10": {
                "id": 10,
                "cluster_id": 153,
                "label": "Randomization Delay Window",
                "type": "Optional[elapsed-s]"
            },
            "35": {
                "id": 35,
                "cluster_id": 153,
                "label": "Next Charge Start Time",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "36": {
                "id": 36,
                "cluster_id": 153,
                "label": "Next Charge Target Time",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "37": {
                "id": 37,
                "cluster_id": 153,
                "label": "Next Charge Required Energy",
                "type": "Optional[Nullable[energy-mWh]]"
            },
            "38": {
                "id": 38,
                "cluster_id": 153,
                "label": "Next Charge Target So C",
                "type": "Optional[Nullable[percent]]"
            },
            "39": {
                "id": 39,
                "cluster_id": 153,
                "label": "Approximate Ev Efficiency",
                "type": "Optional[Nullable[uint16]]"
            },
            "48": {
                "id": 48,
                "cluster_id": 153,
                "label": "State Of Charge",
                "type": "Optional[Nullable[percent]]"
            },
            "49": {
                "id": 49,
                "cluster_id": 153,
                "label": "Battery Capacity",
                "type": "Optional[Nullable[energy-mWh]]"
            },
            "50": {
                "id": 50,
                "cluster_id": 153,
                "label": "Vehicle Id",
                "type": "Optional[Nullable[string]]"
            },
            "64": {
                "id": 64,
                "cluster_id": 153,
                "label": "Session Id",
                "type": "Nullable[uint32]"
            },
            "65": {
                "id": 65,
                "cluster_id": 153,
                "label": "Session Duration",
                "type": "Nullable[elapsed-s]"
            },
            "66": {
                "id": 66,
                "cluster_id": 153,
                "label": "Session Energy Charged",
                "type": "Nullable[energy-mWh]"
            },
            "67": {
                "id": 67,
                "cluster_id": 153,
                "label": "Session Energy Discharged",
                "type": "Optional[Nullable[energy-mWh]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 153,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 153,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 153,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 153,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 153,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 153,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "155": {
        "id": 155,
        "label": "Energy Preference",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 155,
                "label": "Energy Balances",
                "type": "List[BalanceStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 155,
                "label": "Current Energy Balance",
                "type": "Optional[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 155,
                "label": "Energy Priorities",
                "type": "List[EnergyPriorityEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 155,
                "label": "Low Power Mode Sensitivities",
                "type": "List[BalanceStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 155,
                "label": "Current Low Power Mode Sensitivity",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 155,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 155,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 155,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 155,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 155,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 155,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "156": {
        "id": 156,
        "label": "Power Topology",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 156,
                "label": "Available Endpoints",
                "type": "List[endpoint-no]"
            },
            "1": {
                "id": 1,
                "cluster_id": 156,
                "label": "Active Endpoints",
                "type": "List[endpoint-no]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 156,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 156,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 156,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 156,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 156,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 156,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "157": {
        "id": 157,
        "label": "Energy Evse Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 157,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 157,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 157,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 157,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 157,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 157,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 157,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 157,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 157,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 157,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "158": {
        "id": 158,
        "label": "Water Heater Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 158,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 158,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 158,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 158,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 158,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 158,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 158,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 158,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 158,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 158,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "159": {
        "id": 159,
        "label": "Device Energy Management Mode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 159,
                "label": "Supported Modes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 159,
                "label": "Current Mode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 159,
                "label": "Start Up Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 159,
                "label": "On Mode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 159,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 159,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 159,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 159,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 159,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 159,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "257": {
        "id": 257,
        "label": "Door Lock",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 257,
                "label": "Lock State",
                "type": "Nullable[LockStateEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 257,
                "label": "Lock Type",
                "type": "LockTypeEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 257,
                "label": "Actuator Enabled",
                "type": "bool"
            },
            "3": {
                "id": 3,
                "cluster_id": 257,
                "label": "Door State",
                "type": "Optional[Nullable[DoorStateEnum]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 257,
                "label": "Door Open Events",
                "type": "Optional[uint32]"
            },
            "5": {
                "id": 5,
                "cluster_id": 257,
                "label": "Door Closed Events",
                "type": "Optional[uint32]"
            },
            "6": {
                "id": 6,
                "cluster_id": 257,
                "label": "Open Period",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 257,
                "label": "Number Of Total Users Supported",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 257,
                "label": "Number Of Pin Users Supported",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 257,
                "label": "Number Of Rfid Users Supported",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 257,
                "label": "Number Of Week Day Schedules Supported Per User",
                "type": "Optional[uint8]"
            },
            "21": {
                "id": 21,
                "cluster_id": 257,
                "label": "Number Of Year Day Schedules Supported Per User",
                "type": "Optional[uint8]"
            },
            "22": {
                "id": 22,
                "cluster_id": 257,
                "label": "Number Of Holiday Schedules Supported",
                "type": "Optional[uint8]"
            },
            "23": {
                "id": 23,
                "cluster_id": 257,
                "label": "Max Pin Code Length",
                "type": "Optional[uint8]"
            },
            "24": {
                "id": 24,
                "cluster_id": 257,
                "label": "Min Pin Code Length",
                "type": "Optional[uint8]"
            },
            "25": {
                "id": 25,
                "cluster_id": 257,
                "label": "Max Rfid Code Length",
                "type": "Optional[uint8]"
            },
            "26": {
                "id": 26,
                "cluster_id": 257,
                "label": "Min Rfid Code Length",
                "type": "Optional[uint8]"
            },
            "27": {
                "id": 27,
                "cluster_id": 257,
                "label": "Credential Rules Support",
                "type": "Optional[CredentialRulesBitmap]"
            },
            "28": {
                "id": 28,
                "cluster_id": 257,
                "label": "Number Of Credentials Supported Per User",
                "type": "Optional[uint8]"
            },
            "33": {
                "id": 33,
                "cluster_id": 257,
                "label": "Language",
                "type": "Optional[string]"
            },
            "34": {
                "id": 34,
                "cluster_id": 257,
                "label": "Led Settings",
                "type": "Optional[LEDSettingEnum]"
            },
            "35": {
                "id": 35,
                "cluster_id": 257,
                "label": "Auto Relock Time",
                "type": "Optional[uint32]"
            },
            "36": {
                "id": 36,
                "cluster_id": 257,
                "label": "Sound Volume",
                "type": "Optional[SoundVolumeEnum]"
            },
            "37": {
                "id": 37,
                "cluster_id": 257,
                "label": "Operating Mode",
                "type": "OperatingModeEnum"
            },
            "38": {
                "id": 38,
                "cluster_id": 257,
                "label": "Supported Operating Modes",
                "type": "OperatingModesBitmap"
            },
            "39": {
                "id": 39,
                "cluster_id": 257,
                "label": "Default Configuration Register",
                "type": "Optional[ConfigurationRegisterBitmap]"
            },
            "40": {
                "id": 40,
                "cluster_id": 257,
                "label": "Enable Local Programming",
                "type": "Optional[bool]"
            },
            "41": {
                "id": 41,
                "cluster_id": 257,
                "label": "Enable One Touch Locking",
                "type": "Optional[bool]"
            },
            "42": {
                "id": 42,
                "cluster_id": 257,
                "label": "Enable Inside Status Led",
                "type": "Optional[bool]"
            },
            "43": {
                "id": 43,
                "cluster_id": 257,
                "label": "Enable Privacy Mode Button",
                "type": "Optional[bool]"
            },
            "44": {
                "id": 44,
                "cluster_id": 257,
                "label": "Local Programming Features",
                "type": "Optional[LocalProgrammingFeaturesBitmap]"
            },
            "48": {
                "id": 48,
                "cluster_id": 257,
                "label": "Wrong Code Entry Limit",
                "type": "Optional[uint8]"
            },
            "49": {
                "id": 49,
                "cluster_id": 257,
                "label": "User Code Temporary Disable Time",
                "type": "Optional[uint8]"
            },
            "50": {
                "id": 50,
                "cluster_id": 257,
                "label": "Send Pin Over The Air",
                "type": "Optional[bool]"
            },
            "51": {
                "id": 51,
                "cluster_id": 257,
                "label": "Require Pin For Remote Operation",
                "type": "Optional[bool]"
            },
            "52": {
                "id": 52,
                "cluster_id": 257,
                "label": "Security Level",
                "type": "Optional[unknown]"
            },
            "53": {
                "id": 53,
                "cluster_id": 257,
                "label": "Expiring User Timeout",
                "type": "Optional[uint16]"
            },
            "128": {
                "id": 128,
                "cluster_id": 257,
                "label": "Aliro Reader Verification Key",
                "type": "Optional[Nullable[bytes]]"
            },
            "129": {
                "id": 129,
                "cluster_id": 257,
                "label": "Aliro Reader Group Identifier",
                "type": "Optional[Nullable[bytes]]"
            },
            "130": {
                "id": 130,
                "cluster_id": 257,
                "label": "Aliro Reader Group Sub Identifier",
                "type": "Optional[bytes]"
            },
            "131": {
                "id": 131,
                "cluster_id": 257,
                "label": "Aliro Expedited Transaction Supported Protocol Versions",
                "type": "List[octstr]"
            },
            "132": {
                "id": 132,
                "cluster_id": 257,
                "label": "Aliro Group Resolving Key",
                "type": "Optional[Nullable[bytes]]"
            },
            "133": {
                "id": 133,
                "cluster_id": 257,
                "label": "Aliro Supported Bleuwb Protocol Versions",
                "type": "List[octstr]"
            },
            "134": {
                "id": 134,
                "cluster_id": 257,
                "label": "Aliro Ble Advertising Version",
                "type": "Optional[uint8]"
            },
            "135": {
                "id": 135,
                "cluster_id": 257,
                "label": "Number Of Aliro Credential Issuer Keys Supported",
                "type": "Optional[uint16]"
            },
            "136": {
                "id": 136,
                "cluster_id": 257,
                "label": "Number Of Aliro Endpoint Keys Supported",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 257,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 257,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 257,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 257,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 257,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 257,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "258": {
        "id": 258,
        "label": "Window Covering",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 258,
                "label": "Type",
                "type": "TypeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 258,
                "label": "Physical Closed Limit Lift",
                "type": "Optional[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 258,
                "label": "Physical Closed Limit Tilt",
                "type": "Optional[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 258,
                "label": "Current Position Lift",
                "type": "Optional[Nullable[uint16]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 258,
                "label": "Current Position Tilt",
                "type": "Optional[Nullable[uint16]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 258,
                "label": "Number Of Actuations Lift",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 258,
                "label": "Number Of Actuations Tilt",
                "type": "Optional[uint16]"
            },
            "7": {
                "id": 7,
                "cluster_id": 258,
                "label": "Config Status",
                "type": "ConfigStatusBitmap"
            },
            "8": {
                "id": 8,
                "cluster_id": 258,
                "label": "Current Position Lift Percentage",
                "type": "Optional[Nullable[percent]]"
            },
            "9": {
                "id": 9,
                "cluster_id": 258,
                "label": "Current Position Tilt Percentage",
                "type": "Optional[Nullable[percent]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 258,
                "label": "Operational Status",
                "type": "OperationalStatusBitmap"
            },
            "11": {
                "id": 11,
                "cluster_id": 258,
                "label": "Target Position Lift Percent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 258,
                "label": "Target Position Tilt Percent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "13": {
                "id": 13,
                "cluster_id": 258,
                "label": "End Product Type",
                "type": "EndProductTypeEnum"
            },
            "14": {
                "id": 14,
                "cluster_id": 258,
                "label": "Current Position Lift Percent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "15": {
                "id": 15,
                "cluster_id": 258,
                "label": "Current Position Tilt Percent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "16": {
                "id": 16,
                "cluster_id": 258,
                "label": "Installed Open Limit Lift",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 258,
                "label": "Installed Closed Limit Lift",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 258,
                "label": "Installed Open Limit Tilt",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 258,
                "label": "Installed Closed Limit Tilt",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 258,
                "label": "Velocity Lift",
                "type": "Optional[unknown]"
            },
            "21": {
                "id": 21,
                "cluster_id": 258,
                "label": "Acceleration Time Lift",
                "type": "Optional[unknown]"
            },
            "22": {
                "id": 22,
                "cluster_id": 258,
                "label": "Deceleration Time Lift",
                "type": "Optional[unknown]"
            },
            "23": {
                "id": 23,
                "cluster_id": 258,
                "label": "Mode",
                "type": "ModeBitmap"
            },
            "24": {
                "id": 24,
                "cluster_id": 258,
                "label": "Intermediate Setpoints Lift",
                "type": "Optional[unknown]"
            },
            "25": {
                "id": 25,
                "cluster_id": 258,
                "label": "Intermediate Setpoints Tilt",
                "type": "Optional[unknown]"
            },
            "26": {
                "id": 26,
                "cluster_id": 258,
                "label": "Safety Status",
                "type": "Optional[SafetyStatusBitmap]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 258,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 258,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 258,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 258,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 258,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 258,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "336": {
        "id": 336,
        "label": "Service Area",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 336,
                "label": "Supported Areas",
                "type": "List[AreaStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 336,
                "label": "Supported Maps",
                "type": "List[MapStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 336,
                "label": "Selected Areas",
                "type": "List[uint32]"
            },
            "3": {
                "id": 3,
                "cluster_id": 336,
                "label": "Current Area",
                "type": "Optional[Nullable[uint32]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 336,
                "label": "Estimated End Time",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 336,
                "label": "Progress",
                "type": "List[ProgressStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 336,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 336,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 336,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 336,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 336,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 336,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "512": {
        "id": 512,
        "label": "Pump Configuration And Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 512,
                "label": "Max Pressure",
                "type": "Nullable[int16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 512,
                "label": "Max Speed",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 512,
                "label": "Max Flow",
                "type": "Nullable[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 512,
                "label": "Min Const Pressure",
                "type": "Optional[Nullable[int16]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 512,
                "label": "Max Const Pressure",
                "type": "Optional[Nullable[int16]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 512,
                "label": "Min Comp Pressure",
                "type": "Optional[Nullable[int16]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 512,
                "label": "Max Comp Pressure",
                "type": "Optional[Nullable[int16]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 512,
                "label": "Min Const Speed",
                "type": "Optional[Nullable[uint16]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 512,
                "label": "Max Const Speed",
                "type": "Optional[Nullable[uint16]]"
            },
            "9": {
                "id": 9,
                "cluster_id": 512,
                "label": "Min Const Flow",
                "type": "Optional[Nullable[uint16]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 512,
                "label": "Max Const Flow",
                "type": "Optional[Nullable[uint16]]"
            },
            "11": {
                "id": 11,
                "cluster_id": 512,
                "label": "Min Const Temp",
                "type": "Optional[Nullable[int16]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 512,
                "label": "Max Const Temp",
                "type": "Optional[Nullable[int16]]"
            },
            "16": {
                "id": 16,
                "cluster_id": 512,
                "label": "Pump Status",
                "type": "Optional[PumpStatusBitmap]"
            },
            "17": {
                "id": 17,
                "cluster_id": 512,
                "label": "Effective Operation Mode",
                "type": "OperationModeEnum"
            },
            "18": {
                "id": 18,
                "cluster_id": 512,
                "label": "Effective Control Mode",
                "type": "ControlModeEnum"
            },
            "19": {
                "id": 19,
                "cluster_id": 512,
                "label": "Capacity",
                "type": "Nullable[int16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 512,
                "label": "Speed",
                "type": "Optional[Nullable[uint16]]"
            },
            "21": {
                "id": 21,
                "cluster_id": 512,
                "label": "Lifetime Running Hours",
                "type": "Optional[Nullable[uint24]]"
            },
            "22": {
                "id": 22,
                "cluster_id": 512,
                "label": "Power",
                "type": "Optional[Nullable[uint24]]"
            },
            "23": {
                "id": 23,
                "cluster_id": 512,
                "label": "Lifetime Energy Consumed",
                "type": "Optional[Nullable[uint32]]"
            },
            "32": {
                "id": 32,
                "cluster_id": 512,
                "label": "Operation Mode",
                "type": "OperationModeEnum"
            },
            "33": {
                "id": 33,
                "cluster_id": 512,
                "label": "Control Mode",
                "type": "Optional[ControlModeEnum]"
            },
            "34": {
                "id": 34,
                "cluster_id": 512,
                "label": "Alarm Mask",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 512,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 512,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 512,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 512,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 512,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 512,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "513": {
        "id": 513,
        "label": "Thermostat",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 513,
                "label": "Local Temperature",
                "type": "Nullable[temperature]"
            },
            "1": {
                "id": 1,
                "cluster_id": 513,
                "label": "Outdoor Temperature",
                "type": "Optional[Nullable[temperature]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 513,
                "label": "Occupancy",
                "type": "Optional[OccupancyBitmap]"
            },
            "3": {
                "id": 3,
                "cluster_id": 513,
                "label": "Abs Min Heat Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "4": {
                "id": 4,
                "cluster_id": 513,
                "label": "Abs Max Heat Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "5": {
                "id": 5,
                "cluster_id": 513,
                "label": "Abs Min Cool Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "6": {
                "id": 6,
                "cluster_id": 513,
                "label": "Abs Max Cool Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "7": {
                "id": 7,
                "cluster_id": 513,
                "label": "Pi Cooling Demand",
                "type": "Optional[uint8]"
            },
            "8": {
                "id": 8,
                "cluster_id": 513,
                "label": "Pi Heating Demand",
                "type": "Optional[uint8]"
            },
            "9": {
                "id": 9,
                "cluster_id": 513,
                "label": "Hvac System Type Configuration",
                "type": "Optional[HVACSystemTypeBitmap]"
            },
            "16": {
                "id": 16,
                "cluster_id": 513,
                "label": "Local Temperature Calibration",
                "type": "Optional[SignedTemperature]"
            },
            "17": {
                "id": 17,
                "cluster_id": 513,
                "label": "Occupied Cooling Setpoint",
                "type": "Optional[temperature]"
            },
            "18": {
                "id": 18,
                "cluster_id": 513,
                "label": "Occupied Heating Setpoint",
                "type": "Optional[temperature]"
            },
            "19": {
                "id": 19,
                "cluster_id": 513,
                "label": "Unoccupied Cooling Setpoint",
                "type": "Optional[temperature]"
            },
            "20": {
                "id": 20,
                "cluster_id": 513,
                "label": "Unoccupied Heating Setpoint",
                "type": "Optional[temperature]"
            },
            "21": {
                "id": 21,
                "cluster_id": 513,
                "label": "Min Heat Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "22": {
                "id": 22,
                "cluster_id": 513,
                "label": "Max Heat Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "23": {
                "id": 23,
                "cluster_id": 513,
                "label": "Min Cool Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "24": {
                "id": 24,
                "cluster_id": 513,
                "label": "Max Cool Setpoint Limit",
                "type": "Optional[temperature]"
            },
            "25": {
                "id": 25,
                "cluster_id": 513,
                "label": "Min Setpoint Dead Band",
                "type": "Optional[SignedTemperature]"
            },
            "26": {
                "id": 26,
                "cluster_id": 513,
                "label": "Remote Sensing",
                "type": "Optional[RemoteSensingBitmap]"
            },
            "27": {
                "id": 27,
                "cluster_id": 513,
                "label": "Control Sequence Of Operation",
                "type": "ControlSequenceOfOperationEnum"
            },
            "28": {
                "id": 28,
                "cluster_id": 513,
                "label": "System Mode",
                "type": "SystemModeEnum"
            },
            "30": {
                "id": 30,
                "cluster_id": 513,
                "label": "Thermostat Running Mode",
                "type": "Optional[ThermostatRunningModeEnum]"
            },
            "32": {
                "id": 32,
                "cluster_id": 513,
                "label": "Start Of Week",
                "type": "Optional[StartOfWeekEnum]"
            },
            "33": {
                "id": 33,
                "cluster_id": 513,
                "label": "Number Of Weekly Transitions",
                "type": "Optional[uint8]"
            },
            "34": {
                "id": 34,
                "cluster_id": 513,
                "label": "Number Of Daily Transitions",
                "type": "Optional[uint8]"
            },
            "35": {
                "id": 35,
                "cluster_id": 513,
                "label": "Temperature Setpoint Hold",
                "type": "Optional[TemperatureSetpointHoldEnum]"
            },
            "36": {
                "id": 36,
                "cluster_id": 513,
                "label": "Temperature Setpoint Hold Duration",
                "type": "Optional[Nullable[uint16]]"
            },
            "37": {
                "id": 37,
                "cluster_id": 513,
                "label": "Thermostat Programming Operation Mode",
                "type": "Optional[ProgrammingOperationModeBitmap]"
            },
            "41": {
                "id": 41,
                "cluster_id": 513,
                "label": "Thermostat Running State",
                "type": "Optional[RelayStateBitmap]"
            },
            "48": {
                "id": 48,
                "cluster_id": 513,
                "label": "Setpoint Change Source",
                "type": "Optional[SetpointChangeSourceEnum]"
            },
            "49": {
                "id": 49,
                "cluster_id": 513,
                "label": "Setpoint Change Amount",
                "type": "Optional[Nullable[TemperatureDifference]]"
            },
            "50": {
                "id": 50,
                "cluster_id": 513,
                "label": "Setpoint Change Source Timestamp",
                "type": "Optional[epoch-s]"
            },
            "52": {
                "id": 52,
                "cluster_id": 513,
                "label": "Occupied Setback",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "53": {
                "id": 53,
                "cluster_id": 513,
                "label": "Occupied Setback Min",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "54": {
                "id": 54,
                "cluster_id": 513,
                "label": "Occupied Setback Max",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "55": {
                "id": 55,
                "cluster_id": 513,
                "label": "Unoccupied Setback",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "56": {
                "id": 56,
                "cluster_id": 513,
                "label": "Unoccupied Setback Min",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "57": {
                "id": 57,
                "cluster_id": 513,
                "label": "Unoccupied Setback Max",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "58": {
                "id": 58,
                "cluster_id": 513,
                "label": "Emergency Heat Delta",
                "type": "Optional[UnsignedTemperature]"
            },
            "64": {
                "id": 64,
                "cluster_id": 513,
                "label": "Ac Type",
                "type": "Optional[ACTypeEnum]"
            },
            "65": {
                "id": 65,
                "cluster_id": 513,
                "label": "Ac Capacity",
                "type": "Optional[uint16]"
            },
            "66": {
                "id": 66,
                "cluster_id": 513,
                "label": "Ac Refrigerant Type",
                "type": "Optional[ACRefrigerantTypeEnum]"
            },
            "67": {
                "id": 67,
                "cluster_id": 513,
                "label": "Ac Compressor Type",
                "type": "Optional[ACCompressorTypeEnum]"
            },
            "68": {
                "id": 68,
                "cluster_id": 513,
                "label": "Ac Error Code",
                "type": "Optional[ACErrorCodeBitmap]"
            },
            "69": {
                "id": 69,
                "cluster_id": 513,
                "label": "Ac Louver Position",
                "type": "Optional[ACLouverPositionEnum]"
            },
            "70": {
                "id": 70,
                "cluster_id": 513,
                "label": "Ac Coil Temperature",
                "type": "Optional[Nullable[temperature]]"
            },
            "71": {
                "id": 71,
                "cluster_id": 513,
                "label": "Ac Capacity Format",
                "type": "Optional[ACCapacityFormatEnum]"
            },
            "72": {
                "id": 72,
                "cluster_id": 513,
                "label": "Preset Types",
                "type": "List[PresetTypeStruct]"
            },
            "73": {
                "id": 73,
                "cluster_id": 513,
                "label": "Schedule Types",
                "type": "List[ScheduleTypeStruct]"
            },
            "74": {
                "id": 74,
                "cluster_id": 513,
                "label": "Number Of Presets",
                "type": "Optional[uint8]"
            },
            "75": {
                "id": 75,
                "cluster_id": 513,
                "label": "Number Of Schedules",
                "type": "Optional[uint8]"
            },
            "76": {
                "id": 76,
                "cluster_id": 513,
                "label": "Number Of Schedule Transitions",
                "type": "Optional[uint8]"
            },
            "77": {
                "id": 77,
                "cluster_id": 513,
                "label": "Number Of Schedule Transition Per Day",
                "type": "Optional[Nullable[uint8]]"
            },
            "78": {
                "id": 78,
                "cluster_id": 513,
                "label": "Active Preset Handle",
                "type": "Optional[Nullable[bytes]]"
            },
            "79": {
                "id": 79,
                "cluster_id": 513,
                "label": "Active Schedule Handle",
                "type": "Optional[Nullable[bytes]]"
            },
            "80": {
                "id": 80,
                "cluster_id": 513,
                "label": "Presets",
                "type": "List[PresetStruct]"
            },
            "81": {
                "id": 81,
                "cluster_id": 513,
                "label": "Schedules",
                "type": "List[ScheduleStruct]"
            },
            "82": {
                "id": 82,
                "cluster_id": 513,
                "label": "Setpoint Hold Expiry Timestamp",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 513,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 513,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 513,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 513,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 513,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 513,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "514": {
        "id": 514,
        "label": "Fan Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 514,
                "label": "Fan Mode",
                "type": "FanModeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 514,
                "label": "Fan Mode Sequence",
                "type": "FanModeSequenceEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 514,
                "label": "Percent Setting",
                "type": "Nullable[percent]"
            },
            "3": {
                "id": 3,
                "cluster_id": 514,
                "label": "Percent Current",
                "type": "percent"
            },
            "4": {
                "id": 4,
                "cluster_id": 514,
                "label": "Speed Max",
                "type": "Optional[uint8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 514,
                "label": "Speed Setting",
                "type": "Optional[Nullable[uint8]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 514,
                "label": "Speed Current",
                "type": "Optional[uint8]"
            },
            "7": {
                "id": 7,
                "cluster_id": 514,
                "label": "Rock Support",
                "type": "Optional[RockBitmap]"
            },
            "8": {
                "id": 8,
                "cluster_id": 514,
                "label": "Rock Setting",
                "type": "Optional[RockBitmap]"
            },
            "9": {
                "id": 9,
                "cluster_id": 514,
                "label": "Wind Support",
                "type": "Optional[WindBitmap]"
            },
            "10": {
                "id": 10,
                "cluster_id": 514,
                "label": "Wind Setting",
                "type": "Optional[WindBitmap]"
            },
            "11": {
                "id": 11,
                "cluster_id": 514,
                "label": "Airflow Direction",
                "type": "Optional[AirflowDirectionEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 514,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 514,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 514,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 514,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 514,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 514,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "516": {
        "id": 516,
        "label": "Thermostat User Interface Configuration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 516,
                "label": "Temperature Display Mode",
                "type": "TemperatureDisplayModeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 516,
                "label": "Keypad Lockout",
                "type": "KeypadLockoutEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 516,
                "label": "Schedule Programming Visibility",
                "type": "Optional[ScheduleProgrammingVisibilityEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 516,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 516,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 516,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 516,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 516,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 516,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "768": {
        "id": 768,
        "label": "Color Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 768,
                "label": "Current Hue",
                "type": "Optional[uint8]"
            },
            "1": {
                "id": 1,
                "cluster_id": 768,
                "label": "Current Saturation",
                "type": "Optional[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 768,
                "label": "Remaining Time",
                "type": "Optional[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 768,
                "label": "Current X",
                "type": "Optional[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 768,
                "label": "Current Y",
                "type": "Optional[uint16]"
            },
            "5": {
                "id": 5,
                "cluster_id": 768,
                "label": "Drift Compensation",
                "type": "Optional[DriftCompensationEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 768,
                "label": "Compensation Text",
                "type": "Optional[string]"
            },
            "7": {
                "id": 7,
                "cluster_id": 768,
                "label": "Color Temperature Mireds",
                "type": "Optional[uint16]"
            },
            "8": {
                "id": 8,
                "cluster_id": 768,
                "label": "Color Mode",
                "type": "ColorModeEnum"
            },
            "15": {
                "id": 15,
                "cluster_id": 768,
                "label": "Options",
                "type": "OptionsBitmap"
            },
            "16": {
                "id": 16,
                "cluster_id": 768,
                "label": "Number Of Primaries",
                "type": "Nullable[uint8]"
            },
            "17": {
                "id": 17,
                "cluster_id": 768,
                "label": "Primary1 X",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 768,
                "label": "Primary1 Y",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 768,
                "label": "Primary1 Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "21": {
                "id": 21,
                "cluster_id": 768,
                "label": "Primary2 X",
                "type": "Optional[uint16]"
            },
            "22": {
                "id": 22,
                "cluster_id": 768,
                "label": "Primary2 Y",
                "type": "Optional[uint16]"
            },
            "23": {
                "id": 23,
                "cluster_id": 768,
                "label": "Primary2 Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "25": {
                "id": 25,
                "cluster_id": 768,
                "label": "Primary3 X",
                "type": "Optional[uint16]"
            },
            "26": {
                "id": 26,
                "cluster_id": 768,
                "label": "Primary3 Y",
                "type": "Optional[uint16]"
            },
            "27": {
                "id": 27,
                "cluster_id": 768,
                "label": "Primary3 Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "32": {
                "id": 32,
                "cluster_id": 768,
                "label": "Primary4 X",
                "type": "Optional[uint16]"
            },
            "33": {
                "id": 33,
                "cluster_id": 768,
                "label": "Primary4 Y",
                "type": "Optional[uint16]"
            },
            "34": {
                "id": 34,
                "cluster_id": 768,
                "label": "Primary4 Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "36": {
                "id": 36,
                "cluster_id": 768,
                "label": "Primary5 X",
                "type": "Optional[uint16]"
            },
            "37": {
                "id": 37,
                "cluster_id": 768,
                "label": "Primary5 Y",
                "type": "Optional[uint16]"
            },
            "38": {
                "id": 38,
                "cluster_id": 768,
                "label": "Primary5 Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "40": {
                "id": 40,
                "cluster_id": 768,
                "label": "Primary6 X",
                "type": "Optional[uint16]"
            },
            "41": {
                "id": 41,
                "cluster_id": 768,
                "label": "Primary6 Y",
                "type": "Optional[uint16]"
            },
            "42": {
                "id": 42,
                "cluster_id": 768,
                "label": "Primary6 Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "48": {
                "id": 48,
                "cluster_id": 768,
                "label": "White Point X",
                "type": "Optional[uint16]"
            },
            "49": {
                "id": 49,
                "cluster_id": 768,
                "label": "White Point Y",
                "type": "Optional[uint16]"
            },
            "50": {
                "id": 50,
                "cluster_id": 768,
                "label": "Color Point Rx",
                "type": "Optional[uint16]"
            },
            "51": {
                "id": 51,
                "cluster_id": 768,
                "label": "Color Point Ry",
                "type": "Optional[uint16]"
            },
            "52": {
                "id": 52,
                "cluster_id": 768,
                "label": "Color Point Rintensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "54": {
                "id": 54,
                "cluster_id": 768,
                "label": "Color Point Gx",
                "type": "Optional[uint16]"
            },
            "55": {
                "id": 55,
                "cluster_id": 768,
                "label": "Color Point Gy",
                "type": "Optional[uint16]"
            },
            "56": {
                "id": 56,
                "cluster_id": 768,
                "label": "Color Point Gintensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "58": {
                "id": 58,
                "cluster_id": 768,
                "label": "Color Point Bx",
                "type": "Optional[uint16]"
            },
            "59": {
                "id": 59,
                "cluster_id": 768,
                "label": "Color Point By",
                "type": "Optional[uint16]"
            },
            "60": {
                "id": 60,
                "cluster_id": 768,
                "label": "Color Point Bintensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "16384": {
                "id": 16384,
                "cluster_id": 768,
                "label": "Enhanced Current Hue",
                "type": "Optional[uint16]"
            },
            "16385": {
                "id": 16385,
                "cluster_id": 768,
                "label": "Enhanced Color Mode",
                "type": "EnhancedColorModeEnum"
            },
            "16386": {
                "id": 16386,
                "cluster_id": 768,
                "label": "Color Loop Active",
                "type": "Optional[enum8]"
            },
            "16387": {
                "id": 16387,
                "cluster_id": 768,
                "label": "Color Loop Direction",
                "type": "Optional[ColorLoopDirectionEnum]"
            },
            "16388": {
                "id": 16388,
                "cluster_id": 768,
                "label": "Color Loop Time",
                "type": "Optional[uint16]"
            },
            "16389": {
                "id": 16389,
                "cluster_id": 768,
                "label": "Color Loop Start Enhanced Hue",
                "type": "Optional[uint16]"
            },
            "16390": {
                "id": 16390,
                "cluster_id": 768,
                "label": "Color Loop Stored Enhanced Hue",
                "type": "Optional[uint16]"
            },
            "16394": {
                "id": 16394,
                "cluster_id": 768,
                "label": "Color Capabilities",
                "type": "map16"
            },
            "16395": {
                "id": 16395,
                "cluster_id": 768,
                "label": "Color Temp Physical Min Mireds",
                "type": "Optional[uint16]"
            },
            "16396": {
                "id": 16396,
                "cluster_id": 768,
                "label": "Color Temp Physical Max Mireds",
                "type": "Optional[uint16]"
            },
            "16397": {
                "id": 16397,
                "cluster_id": 768,
                "label": "Couple Color Temp To Level Min Mireds",
                "type": "Optional[uint16]"
            },
            "16400": {
                "id": 16400,
                "cluster_id": 768,
                "label": "Start Up Color Temperature Mireds",
                "type": "Optional[Nullable[uint16]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 768,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 768,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 768,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 768,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 768,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 768,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1024": {
        "id": 1024,
        "label": "Illuminance Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1024,
                "label": "Measured Value",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1024,
                "label": "Min Measured Value",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1024,
                "label": "Max Measured Value",
                "type": "Nullable[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1024,
                "label": "Tolerance",
                "type": "Optional[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1024,
                "label": "Light Sensor Type",
                "type": "Optional[Nullable[uint8]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1024,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1024,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1024,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1024,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1024,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1024,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1026": {
        "id": 1026,
        "label": "Temperature Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1026,
                "label": "Measured Value",
                "type": "Nullable[temperature]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1026,
                "label": "Min Measured Value",
                "type": "Nullable[temperature]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1026,
                "label": "Max Measured Value",
                "type": "Nullable[temperature]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1026,
                "label": "Tolerance",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1026,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1026,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1026,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1026,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1026,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1026,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1027": {
        "id": 1027,
        "label": "Pressure Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1027,
                "label": "Measured Value",
                "type": "Nullable[int16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1027,
                "label": "Min Measured Value",
                "type": "Nullable[int16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1027,
                "label": "Max Measured Value",
                "type": "Nullable[int16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1027,
                "label": "Tolerance",
                "type": "Optional[uint16]"
            },
            "16": {
                "id": 16,
                "cluster_id": 1027,
                "label": "Scaled Value",
                "type": "Optional[Nullable[int16]]"
            },
            "17": {
                "id": 17,
                "cluster_id": 1027,
                "label": "Min Scaled Value",
                "type": "Optional[Nullable[int16]]"
            },
            "18": {
                "id": 18,
                "cluster_id": 1027,
                "label": "Max Scaled Value",
                "type": "Optional[Nullable[int16]]"
            },
            "19": {
                "id": 19,
                "cluster_id": 1027,
                "label": "Scaled Tolerance",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 1027,
                "label": "Scale",
                "type": "Optional[int8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1027,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1027,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1027,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1027,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1027,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1027,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1028": {
        "id": 1028,
        "label": "Flow Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1028,
                "label": "Measured Value",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1028,
                "label": "Min Measured Value",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1028,
                "label": "Max Measured Value",
                "type": "Nullable[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1028,
                "label": "Tolerance",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1028,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1028,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1028,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1028,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1028,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1028,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1029": {
        "id": 1029,
        "label": "Relative Humidity Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1029,
                "label": "Measured Value",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1029,
                "label": "Min Measured Value",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1029,
                "label": "Max Measured Value",
                "type": "Nullable[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1029,
                "label": "Tolerance",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1029,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1029,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1029,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1029,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1029,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1029,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1030": {
        "id": 1030,
        "label": "Occupancy Sensing",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1030,
                "label": "Occupancy",
                "type": "OccupancyBitmap"
            },
            "1": {
                "id": 1,
                "cluster_id": 1030,
                "label": "Occupancy Sensor Type",
                "type": "OccupancySensorTypeEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 1030,
                "label": "Occupancy Sensor Type Bitmap",
                "type": "OccupancySensorTypeBitmap"
            },
            "3": {
                "id": 3,
                "cluster_id": 1030,
                "label": "Hold Time",
                "type": "Optional[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1030,
                "label": "Hold Time Limits",
                "type": "Optional[HoldTimeLimitsStruct]"
            },
            "16": {
                "id": 16,
                "cluster_id": 1030,
                "label": "Pir Occupied To Unoccupied Delay",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 1030,
                "label": "Pir Unoccupied To Occupied Delay",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 1030,
                "label": "Pir Unoccupied To Occupied Threshold",
                "type": "Optional[uint8]"
            },
            "32": {
                "id": 32,
                "cluster_id": 1030,
                "label": "Ultrasonic Occupied To Unoccupied Delay",
                "type": "Optional[uint16]"
            },
            "33": {
                "id": 33,
                "cluster_id": 1030,
                "label": "Ultrasonic Unoccupied To Occupied Delay",
                "type": "Optional[uint16]"
            },
            "34": {
                "id": 34,
                "cluster_id": 1030,
                "label": "Ultrasonic Unoccupied To Occupied Threshold",
                "type": "Optional[uint8]"
            },
            "48": {
                "id": 48,
                "cluster_id": 1030,
                "label": "Physical Contact Occupied To Unoccupied Delay",
                "type": "Optional[uint16]"
            },
            "49": {
                "id": 49,
                "cluster_id": 1030,
                "label": "Physical Contact Unoccupied To Occupied Delay",
                "type": "Optional[uint16]"
            },
            "50": {
                "id": 50,
                "cluster_id": 1030,
                "label": "Physical Contact Unoccupied To Occupied Threshold",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1030,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1030,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1030,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1030,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1030,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1030,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1036": {
        "id": 1036,
        "label": "Carbon Monoxide Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1036,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1036,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1036,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1036,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1036,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1036,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1036,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1036,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1036,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1036,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1036,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1036,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1036,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1036,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1036,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1036,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1036,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1037": {
        "id": 1037,
        "label": "Carbon Dioxide Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1037,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1037,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1037,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1037,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1037,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1037,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1037,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1037,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1037,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1037,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1037,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1037,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1037,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1037,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1037,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1037,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1037,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1043": {
        "id": 1043,
        "label": "Nitrogen Dioxide Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1043,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1043,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1043,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1043,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1043,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1043,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1043,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1043,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1043,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1043,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1043,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1043,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1043,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1043,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1043,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1043,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1043,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1045": {
        "id": 1045,
        "label": "Ozone Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1045,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1045,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1045,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1045,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1045,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1045,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1045,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1045,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1045,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1045,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1045,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1045,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1045,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1045,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1045,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1045,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1045,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1066": {
        "id": 1066,
        "label": "Pm25 Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1066,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1066,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1066,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1066,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1066,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1066,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1066,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1066,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1066,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1066,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1066,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1066,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1066,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1066,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1066,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1066,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1066,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1067": {
        "id": 1067,
        "label": "Formaldehyde Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1067,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1067,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1067,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1067,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1067,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1067,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1067,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1067,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1067,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1067,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1067,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1067,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1067,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1067,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1067,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1067,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1067,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1068": {
        "id": 1068,
        "label": "Pm1 Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1068,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1068,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1068,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1068,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1068,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1068,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1068,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1068,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1068,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1068,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1068,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1068,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1068,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1068,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1068,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1068,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1068,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1069": {
        "id": 1069,
        "label": "Pm10 Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1069,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1069,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1069,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1069,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1069,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1069,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1069,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1069,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1069,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1069,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1069,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1069,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1069,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1069,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1069,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1069,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1069,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1070": {
        "id": 1070,
        "label": "Total Volatile Organic Compounds Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1070,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1070,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1070,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1070,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1070,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1070,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1070,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1070,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1070,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1070,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1070,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1070,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1070,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1070,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1070,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1070,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1070,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1071": {
        "id": 1071,
        "label": "Radon Concentration Measurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1071,
                "label": "Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1071,
                "label": "Min Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1071,
                "label": "Max Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1071,
                "label": "Peak Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1071,
                "label": "Peak Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1071,
                "label": "Average Measured Value",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1071,
                "label": "Average Measured Value Window",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1071,
                "label": "Uncertainty",
                "type": "Optional[single]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1071,
                "label": "Measurement Unit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1071,
                "label": "Measurement Medium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1071,
                "label": "Level Value",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1071,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1071,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1071,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1071,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1071,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1071,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1105": {
        "id": 1105,
        "label": "Wi Fi Network Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1105,
                "label": "Ssid",
                "type": "Nullable[bytes]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1105,
                "label": "Passphrase Surrogate",
                "type": "Nullable[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1105,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1105,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1105,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1105,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1105,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1105,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1106": {
        "id": 1106,
        "label": "Thread Border Router Management",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1106,
                "label": "Border Router Name",
                "type": "string"
            },
            "1": {
                "id": 1,
                "cluster_id": 1106,
                "label": "Border Agent Id",
                "type": "bytes"
            },
            "2": {
                "id": 2,
                "cluster_id": 1106,
                "label": "Thread Version",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 1106,
                "label": "Interface Enabled",
                "type": "bool"
            },
            "4": {
                "id": 4,
                "cluster_id": 1106,
                "label": "Active Dataset Timestamp",
                "type": "Nullable[uint64]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1106,
                "label": "Pending Dataset Timestamp",
                "type": "Nullable[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1106,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1106,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1106,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1106,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1106,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1106,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1107": {
        "id": 1107,
        "label": "Thread Network Directory",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1107,
                "label": "Preferred Extended Pan Id",
                "type": "Nullable[bytes]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1107,
                "label": "Thread Networks",
                "type": "List[ThreadNetworkStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1107,
                "label": "Thread Network Table Size",
                "type": "uint8"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1107,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1107,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1107,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1107,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1107,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1107,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1283": {
        "id": 1283,
        "label": "Wake On Lan",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1283,
                "label": "Mac Address",
                "type": "Optional[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1283,
                "label": "Link Local Address",
                "type": "Optional[bytes]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1283,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1283,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1283,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1283,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1283,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1283,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1284": {
        "id": 1284,
        "label": "Channel",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1284,
                "label": "Channel List",
                "type": "List[ChannelInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1284,
                "label": "Lineup",
                "type": "Optional[Nullable[LineupInfoStruct]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1284,
                "label": "Current Channel",
                "type": "Optional[Nullable[ChannelInfoStruct]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1284,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1284,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1284,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1284,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1284,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1284,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1285": {
        "id": 1285,
        "label": "Target Navigator",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1285,
                "label": "Target List",
                "type": "List[TargetInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1285,
                "label": "Current Target",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1285,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1285,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1285,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1285,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1285,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1285,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1286": {
        "id": 1286,
        "label": "Media Playback",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1286,
                "label": "Current State",
                "type": "PlaybackStateEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 1286,
                "label": "Start Time",
                "type": "Optional[Nullable[epoch-us]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1286,
                "label": "Duration",
                "type": "Optional[Nullable[uint64]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1286,
                "label": "Sampled Position",
                "type": "Optional[Nullable[PlaybackPositionStruct]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1286,
                "label": "Playback Speed",
                "type": "Optional[single]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1286,
                "label": "Seek Range End",
                "type": "Optional[Nullable[uint64]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1286,
                "label": "Seek Range Start",
                "type": "Optional[Nullable[uint64]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1286,
                "label": "Active Audio Track",
                "type": "Optional[Nullable[TrackStruct]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1286,
                "label": "Available Audio Tracks",
                "type": "List[TrackStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1286,
                "label": "Active Text Track",
                "type": "Optional[Nullable[TrackStruct]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 1286,
                "label": "Available Text Tracks",
                "type": "List[TrackStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1286,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1286,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1286,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1286,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1286,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1286,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1287": {
        "id": 1287,
        "label": "Media Input",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1287,
                "label": "Input List",
                "type": "List[InputInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1287,
                "label": "Current Input",
                "type": "uint8"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1287,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1287,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1287,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1287,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1287,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1287,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1288": {
        "id": 1288,
        "label": "Low Power",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1288,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1288,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1288,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1288,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1288,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1288,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1289": {
        "id": 1289,
        "label": "Keypad Input",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1289,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1289,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1289,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1289,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1289,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1289,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1290": {
        "id": 1290,
        "label": "Content Launcher",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1290,
                "label": "Accept Header",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1290,
                "label": "Supported Streaming Protocols",
                "type": "Optional[SupportedProtocolsBitmap]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1290,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1290,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1290,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1290,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1290,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1290,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1291": {
        "id": 1291,
        "label": "Audio Output",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1291,
                "label": "Output List",
                "type": "List[OutputInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1291,
                "label": "Current Output",
                "type": "uint8"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1291,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1291,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1291,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1291,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1291,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1291,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1292": {
        "id": 1292,
        "label": "Application Launcher",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1292,
                "label": "Catalog List",
                "type": "List[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1292,
                "label": "Current App",
                "type": "Optional[Nullable[ApplicationEPStruct]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1292,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1292,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1292,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1292,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1292,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1292,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1293": {
        "id": 1293,
        "label": "Application Basic",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1293,
                "label": "Vendor Name",
                "type": "Optional[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1293,
                "label": "Vendor Id",
                "type": "Optional[vendor-id]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1293,
                "label": "Application Name",
                "type": "string"
            },
            "3": {
                "id": 3,
                "cluster_id": 1293,
                "label": "Product Id",
                "type": "Optional[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1293,
                "label": "Application",
                "type": "ApplicationStruct"
            },
            "5": {
                "id": 5,
                "cluster_id": 1293,
                "label": "Status",
                "type": "ApplicationStatusEnum"
            },
            "6": {
                "id": 6,
                "cluster_id": 1293,
                "label": "Application Version",
                "type": "string"
            },
            "7": {
                "id": 7,
                "cluster_id": 1293,
                "label": "Allowed Vendor List",
                "type": "List[vendor-id]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1293,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1293,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1293,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1293,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1293,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1293,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1294": {
        "id": 1294,
        "label": "Account Login",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1294,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1294,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1294,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1294,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1294,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1294,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1295": {
        "id": 1295,
        "label": "Content Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1295,
                "label": "Enabled",
                "type": "bool"
            },
            "1": {
                "id": 1,
                "cluster_id": 1295,
                "label": "On Demand Ratings",
                "type": "List[RatingNameStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1295,
                "label": "On Demand Rating Threshold",
                "type": "Optional[string]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1295,
                "label": "Scheduled Content Ratings",
                "type": "List[RatingNameStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1295,
                "label": "Scheduled Content Rating Threshold",
                "type": "Optional[string]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1295,
                "label": "Screen Daily Time",
                "type": "Optional[elapsed-s]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1295,
                "label": "Remaining Screen Time",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1295,
                "label": "Block Unrated",
                "type": "Optional[bool]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1295,
                "label": "Block Channel List",
                "type": "List[BlockChannelStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1295,
                "label": "Block Application List",
                "type": "List[AppInfoStruct]"
            },
            "10": {
                "id": 10,
                "cluster_id": 1295,
                "label": "Block Content Time Window",
                "type": "List[TimeWindowStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1295,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1295,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1295,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1295,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1295,
                "label": "Feature Map",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1295,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1296": {
        "id": 1296,
        "label": "Content App Observer",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1296,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1296,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1296,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1296,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1296,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1296,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1872": {
        "id": 1872,
        "label": "Ecosystem Information",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1872,
                "label": "Device Directory",
                "type": "List[EcosystemDeviceStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1872,
                "label": "Location Directory",
                "type": "List[EcosystemLocationStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1872,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1872,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1872,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1872,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1872,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1872,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1873": {
        "id": 1873,
        "label": "Commissioner Control",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1873,
                "label": "Supported Device Categories",
                "type": "SupportedDeviceCategoryBitmap"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1873,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1873,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1873,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1873,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1873,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1873,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1874": {
        "id": 1874,
        "label": "Joint Fabric Datastore",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1874,
                "label": "Anchor Root Ca",
                "type": "Optional[bytes]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1874,
                "label": "Anchor Node Id",
                "type": "Optional[node-id]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1874,
                "label": "Anchor Vendor Id",
                "type": "Optional[vendor-id]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1874,
                "label": "Friendly Name",
                "type": "Optional[string]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1874,
                "label": "Group Key Set List",
                "type": "List[DatastoreGroupKeySetStruct]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1874,
                "label": "Group List",
                "type": "List[DatastoreGroupInformationEntryStruct]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1874,
                "label": "Node List",
                "type": "List[DatastoreNodeInformationEntryStruct]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1874,
                "label": "Admin List",
                "type": "List[DatastoreAdministratorInformationEntryStruct]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1874,
                "label": "Status",
                "type": "Optional[DatastoreStatusEntryStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1874,
                "label": "Endpoint Group Id List",
                "type": "List[DatastoreEndpointGroupIDEntryStruct]"
            },
            "10": {
                "id": 10,
                "cluster_id": 1874,
                "label": "Endpoint Binding List",
                "type": "List[DatastoreEndpointBindingEntryStruct]"
            },
            "11": {
                "id": 11,
                "cluster_id": 1874,
                "label": "Node Key Set List",
                "type": "List[DatastoreNodeKeySetEntryStruct]"
            },
            "12": {
                "id": 12,
                "cluster_id": 1874,
                "label": "Node Acl List",
                "type": "List[DatastoreACLEntryStruct]"
            },
            "13": {
                "id": 13,
                "cluster_id": 1874,
                "label": "Node Endpoint List",
                "type": "List[DatastoreEndpointEntryStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1874,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1874,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1874,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1874,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1874,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1874,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "1875": {
        "id": 1875,
        "label": "Joint Fabric Administrator",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1875,
                "label": "Administrator Fabric Index",
                "type": "Optional[Nullable[fabric-idx]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1875,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1875,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1875,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1875,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1875,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1875,
                "label": "Cluster Revision",
                "type": "ClusterRevision"
            }
        }
    },
    "2820": {
        "id": 2820,
        "label": "Draft Electrical Measurement Cluster",
        "attributes": {
            "1285": {
                "id": 1285,
                "cluster_id": 2820,
                "label": "Rms Voltage",
                "type": "Optional[unknown]"
            },
            "1288": {
                "id": 1288,
                "cluster_id": 2820,
                "label": "Rms Current",
                "type": "Optional[unknown]"
            },
            "1291": {
                "id": 1291,
                "cluster_id": 2820,
                "label": "Active Power",
                "type": "Optional[unknown]"
            },
            "1536": {
                "id": 1536,
                "cluster_id": 2820,
                "label": "Ac Voltage Multiplier",
                "type": "Optional[unknown]"
            },
            "1537": {
                "id": 1537,
                "cluster_id": 2820,
                "label": "Ac Voltage Divisor",
                "type": "Optional[unknown]"
            },
            "1538": {
                "id": 1538,
                "cluster_id": 2820,
                "label": "Ac Current Multiplier",
                "type": "Optional[unknown]"
            },
            "1539": {
                "id": 1539,
                "cluster_id": 2820,
                "label": "Ac Current Divisor",
                "type": "Optional[unknown]"
            },
            "1540": {
                "id": 1540,
                "cluster_id": 2820,
                "label": "Ac Power Multiplier",
                "type": "Optional[unknown]"
            },
            "1541": {
                "id": 1541,
                "cluster_id": 2820,
                "label": "Ac Power Divisor",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 2820,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 2820,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 2820,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 2820,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 2820,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 2820,
                "label": "Cluster Revision",
                "type": "uint16"
            }
        }
    },
    "302775297": {
        "id": 302775297,
        "label": "Heiman Cluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 302775297,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 302775297,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 302775297,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 302775297,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 302775297,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 302775297,
                "label": "Cluster Revision",
                "type": "uint16"
            },
            "302710800": {
                "id": 302710800,
                "cluster_id": 302775297,
                "label": "Tamper Alarm",
                "type": "Optional[unknown]"
            },
            "302710801": {
                "id": 302710801,
                "cluster_id": 302775297,
                "label": "Preheating State",
                "type": "Optional[unknown]"
            },
            "302710802": {
                "id": 302710802,
                "cluster_id": 302775297,
                "label": "No Disturbing State",
                "type": "Optional[unknown]"
            },
            "302710803": {
                "id": 302710803,
                "cluster_id": 302775297,
                "label": "Sensor Type",
                "type": "Optional[unknown]"
            },
            "302710804": {
                "id": 302710804,
                "cluster_id": 302775297,
                "label": "Siren Active",
                "type": "Optional[unknown]"
            },
            "302710805": {
                "id": 302710805,
                "cluster_id": 302775297,
                "label": "Alarm Mute",
                "type": "Optional[unknown]"
            },
            "302710806": {
                "id": 302710806,
                "cluster_id": 302775297,
                "label": "Low Power Mode",
                "type": "Optional[unknown]"
            }
        }
    },
    "305134641": {
        "id": 305134641,
        "label": "Inovelli Cluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 305134641,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 305134641,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 305134641,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 305134641,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 305134641,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 305134641,
                "label": "Cluster Revision",
                "type": "uint16"
            },
            "305070177": {
                "id": 305070177,
                "cluster_id": 305134641,
                "label": "Led Indicator Intensity On",
                "type": "Optional[unknown]"
            },
            "305070178": {
                "id": 305070178,
                "cluster_id": 305134641,
                "label": "Led Indicator Intensity Off",
                "type": "Optional[unknown]"
            },
            "305070342": {
                "id": 305070342,
                "cluster_id": 305134641,
                "label": "Clear Notification With Config Double Tap",
                "type": "Optional[bool]"
            }
        }
    },
    "308149265": {
        "id": 308149265,
        "label": "Neo Cluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 308149265,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 308149265,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 308149265,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 308149265,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 308149265,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 308149265,
                "label": "Cluster Revision",
                "type": "uint16"
            },
            "308084769": {
                "id": 308084769,
                "cluster_id": 308149265,
                "label": "Watt Accumulated",
                "type": "Optional[unknown]"
            },
            "308084770": {
                "id": 308084770,
                "cluster_id": 308149265,
                "label": "Current",
                "type": "Optional[unknown]"
            },
            "308084771": {
                "id": 308084771,
                "cluster_id": 308149265,
                "label": "Watt",
                "type": "Optional[unknown]"
            },
            "308084772": {
                "id": 308084772,
                "cluster_id": 308149265,
                "label": "Voltage",
                "type": "Optional[unknown]"
            }
        }
    },
    "319486977": {
        "id": 319486977,
        "label": "Eve Cluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 319486977,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 319486977,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 319486977,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 319486977,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 319486977,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 319486977,
                "label": "Cluster Revision",
                "type": "uint16"
            },
            "319422470": {
                "id": 319422470,
                "cluster_id": 319486977,
                "label": "Times Opened",
                "type": "Optional[unknown]"
            },
            "319422472": {
                "id": 319422472,
                "cluster_id": 319486977,
                "label": "Voltage",
                "type": "Optional[unknown]"
            },
            "319422473": {
                "id": 319422473,
                "cluster_id": 319486977,
                "label": "Current",
                "type": "Optional[unknown]"
            },
            "319422474": {
                "id": 319422474,
                "cluster_id": 319486977,
                "label": "Watt",
                "type": "Optional[unknown]"
            },
            "319422475": {
                "id": 319422475,
                "cluster_id": 319486977,
                "label": "Watt Accumulated",
                "type": "Optional[unknown]"
            },
            "319422477": {
                "id": 319422477,
                "cluster_id": 319486977,
                "label": "Motion Sensitivity",
                "type": "Optional[unknown]"
            },
            "319422478": {
                "id": 319422478,
                "cluster_id": 319486977,
                "label": "Watt Accumulated Control Point",
                "type": "Optional[unknown]"
            },
            "319422480": {
                "id": 319422480,
                "cluster_id": 319486977,
                "label": "Obstruction Detected",
                "type": "Optional[bool]"
            },
            "319422483": {
                "id": 319422483,
                "cluster_id": 319486977,
                "label": "Altitude",
                "type": "Optional[unknown]"
            },
            "319422484": {
                "id": 319422484,
                "cluster_id": 319486977,
                "label": "Pressure",
                "type": "Optional[unknown]"
            },
            "319422485": {
                "id": 319422485,
                "cluster_id": 319486977,
                "label": "Weather Trend",
                "type": "Optional[unknown]"
            },
            "319422488": {
                "id": 319422488,
                "cluster_id": 319486977,
                "label": "Valve Position",
                "type": "Optional[unknown]"
            }
        }
    },
    "319683586": {
        "id": 319683586,
        "label": "Third Reality Metering Cluster",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 319683586,
                "label": "Current Summation Delivered",
                "type": "Optional[unknown]"
            },
            "769": {
                "id": 769,
                "cluster_id": 319683586,
                "label": "Multiplier",
                "type": "Optional[unknown]"
            },
            "770": {
                "id": 770,
                "cluster_id": 319683586,
                "label": "Divisor",
                "type": "Optional[unknown]"
            },
            "1024": {
                "id": 1024,
                "cluster_id": 319683586,
                "label": "Instantaneous Demand",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 319683586,
                "label": "Generated Command List",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 319683586,
                "label": "Accepted Command List",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 319683586,
                "label": "Event List",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 319683586,
                "label": "Attribute List",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 319683586,
                "label": "Feature Map",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 319683586,
                "label": "Cluster Revision",
                "type": "uint16"
            }
        }
    }
};
