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
                "label": "IdentifyTime",
                "type": "uint16"
            },
            "1": {
                "id": 1,
                "cluster_id": 3,
                "label": "IdentifyType",
                "type": "IdentifyTypeEnum"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 3,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 3,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 3,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 3,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 3,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 3,
                "label": "ClusterRevision",
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
                "label": "NameSupport",
                "type": "NameSupportBitmap"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 4,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 4,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 4,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 4,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 4,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 4,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "6": {
        "id": 6,
        "label": "OnOff",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 6,
                "label": "OnOff",
                "type": "bool"
            },
            "16384": {
                "id": 16384,
                "cluster_id": 6,
                "label": "GlobalSceneControl",
                "type": "Optional[bool]"
            },
            "16385": {
                "id": 16385,
                "cluster_id": 6,
                "label": "OnTime",
                "type": "Optional[uint16]"
            },
            "16386": {
                "id": 16386,
                "cluster_id": 6,
                "label": "OffWaitTime",
                "type": "Optional[uint16]"
            },
            "16387": {
                "id": 16387,
                "cluster_id": 6,
                "label": "StartUpOnOff",
                "type": "Optional[Nullable[StartUpOnOffEnum]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 6,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 6,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 6,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 6,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 6,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 6,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "8": {
        "id": 8,
        "label": "LevelControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 8,
                "label": "CurrentLevel",
                "type": "Nullable[uint8]"
            },
            "1": {
                "id": 1,
                "cluster_id": 8,
                "label": "RemainingTime",
                "type": "Optional[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 8,
                "label": "MinLevel",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 8,
                "label": "MaxLevel",
                "type": "Optional[uint8]"
            },
            "4": {
                "id": 4,
                "cluster_id": 8,
                "label": "CurrentFrequency",
                "type": "Optional[uint16]"
            },
            "5": {
                "id": 5,
                "cluster_id": 8,
                "label": "MinFrequency",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 8,
                "label": "MaxFrequency",
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
                "label": "OnOffTransitionTime",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 8,
                "label": "OnLevel",
                "type": "Nullable[uint8]"
            },
            "18": {
                "id": 18,
                "cluster_id": 8,
                "label": "OnTransitionTime",
                "type": "Optional[Nullable[uint16]]"
            },
            "19": {
                "id": 19,
                "cluster_id": 8,
                "label": "OffTransitionTime",
                "type": "Optional[Nullable[uint16]]"
            },
            "20": {
                "id": 20,
                "cluster_id": 8,
                "label": "DefaultMoveRate",
                "type": "Optional[Nullable[uint8]]"
            },
            "16384": {
                "id": 16384,
                "cluster_id": 8,
                "label": "StartUpCurrentLevel",
                "type": "Optional[Nullable[uint8]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 8,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 8,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 8,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 8,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 8,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 8,
                "label": "ClusterRevision",
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
                "label": "DeviceTypeList",
                "type": "List[DeviceTypeStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 29,
                "label": "ServerList",
                "type": "List[cluster-id]"
            },
            "2": {
                "id": 2,
                "cluster_id": 29,
                "label": "ClientList",
                "type": "List[cluster-id]"
            },
            "3": {
                "id": 3,
                "cluster_id": 29,
                "label": "PartsList",
                "type": "List[endpoint-no]"
            },
            "4": {
                "id": 4,
                "cluster_id": 29,
                "label": "TagList",
                "type": "List[semtag]"
            },
            "5": {
                "id": 5,
                "cluster_id": 29,
                "label": "EndpointUniqueId",
                "type": "Optional[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 29,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 29,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 29,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 29,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 29,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 29,
                "label": "ClusterRevision",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 30,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 30,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 30,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 30,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 30,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "31": {
        "id": 31,
        "label": "AccessControl",
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
                "label": "SubjectsPerAccessControlEntry",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 31,
                "label": "TargetsPerAccessControlEntry",
                "type": "uint16"
            },
            "4": {
                "id": 4,
                "cluster_id": 31,
                "label": "AccessControlEntriesPerFabric",
                "type": "uint16"
            },
            "5": {
                "id": 5,
                "cluster_id": 31,
                "label": "CommissioningArl",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 31,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 31,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 31,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 31,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 31,
                "label": "ClusterRevision",
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
                "label": "ActionList",
                "type": "List[ActionStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 37,
                "label": "EndpointLists",
                "type": "List[EndpointListStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 37,
                "label": "SetupUrl",
                "type": "Optional[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 37,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 37,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 37,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 37,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 37,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 37,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "40": {
        "id": 40,
        "label": "BasicInformation",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 40,
                "label": "DataModelRevision",
                "type": "uint16"
            },
            "1": {
                "id": 1,
                "cluster_id": 40,
                "label": "VendorName",
                "type": "string"
            },
            "2": {
                "id": 2,
                "cluster_id": 40,
                "label": "VendorId",
                "type": "vendor-id"
            },
            "3": {
                "id": 3,
                "cluster_id": 40,
                "label": "ProductName",
                "type": "string"
            },
            "4": {
                "id": 4,
                "cluster_id": 40,
                "label": "ProductId",
                "type": "uint16"
            },
            "5": {
                "id": 5,
                "cluster_id": 40,
                "label": "NodeLabel",
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
                "label": "HardwareVersion",
                "type": "uint16"
            },
            "8": {
                "id": 8,
                "cluster_id": 40,
                "label": "HardwareVersionString",
                "type": "string"
            },
            "9": {
                "id": 9,
                "cluster_id": 40,
                "label": "SoftwareVersion",
                "type": "uint32"
            },
            "10": {
                "id": 10,
                "cluster_id": 40,
                "label": "SoftwareVersionString",
                "type": "string"
            },
            "11": {
                "id": 11,
                "cluster_id": 40,
                "label": "ManufacturingDate",
                "type": "Optional[string]"
            },
            "12": {
                "id": 12,
                "cluster_id": 40,
                "label": "PartNumber",
                "type": "Optional[string]"
            },
            "13": {
                "id": 13,
                "cluster_id": 40,
                "label": "ProductUrl",
                "type": "Optional[string]"
            },
            "14": {
                "id": 14,
                "cluster_id": 40,
                "label": "ProductLabel",
                "type": "Optional[string]"
            },
            "15": {
                "id": 15,
                "cluster_id": 40,
                "label": "SerialNumber",
                "type": "Optional[string]"
            },
            "16": {
                "id": 16,
                "cluster_id": 40,
                "label": "LocalConfigDisabled",
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
                "label": "UniqueId",
                "type": "string"
            },
            "19": {
                "id": 19,
                "cluster_id": 40,
                "label": "CapabilityMinima",
                "type": "CapabilityMinimaStruct"
            },
            "20": {
                "id": 20,
                "cluster_id": 40,
                "label": "ProductAppearance",
                "type": "Optional[ProductAppearanceStruct]"
            },
            "21": {
                "id": 21,
                "cluster_id": 40,
                "label": "SpecificationVersion",
                "type": "uint32"
            },
            "22": {
                "id": 22,
                "cluster_id": 40,
                "label": "MaxPathsPerInvoke",
                "type": "uint16"
            },
            "24": {
                "id": 24,
                "cluster_id": 40,
                "label": "ConfigurationVersion",
                "type": "Optional[uint32]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 40,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 40,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 40,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 40,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 40,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 40,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "41": {
        "id": 41,
        "label": "OtaSoftwareUpdateProvider",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 41,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 41,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 41,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 41,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 41,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 41,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "42": {
        "id": 42,
        "label": "OtaSoftwareUpdateRequestor",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 42,
                "label": "DefaultOtaProviders",
                "type": "List[ProviderLocation]"
            },
            "1": {
                "id": 1,
                "cluster_id": 42,
                "label": "UpdatePossible",
                "type": "bool"
            },
            "2": {
                "id": 2,
                "cluster_id": 42,
                "label": "UpdateState",
                "type": "UpdateStateEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 42,
                "label": "UpdateStateProgress",
                "type": "Nullable[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 42,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 42,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 42,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 42,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 42,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 42,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "43": {
        "id": 43,
        "label": "LocalizationConfiguration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 43,
                "label": "ActiveLocale",
                "type": "string"
            },
            "1": {
                "id": 1,
                "cluster_id": 43,
                "label": "SupportedLocales",
                "type": "List[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 43,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 43,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 43,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 43,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 43,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 43,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "44": {
        "id": 44,
        "label": "TimeFormatLocalization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 44,
                "label": "HourFormat",
                "type": "HourFormatEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 44,
                "label": "ActiveCalendarType",
                "type": "Optional[CalendarTypeEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 44,
                "label": "SupportedCalendarTypes",
                "type": "List[CalendarTypeEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 44,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 44,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 44,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 44,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 44,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 44,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "45": {
        "id": 45,
        "label": "UnitLocalization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 45,
                "label": "TemperatureUnit",
                "type": "Optional[TempUnitEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 45,
                "label": "SupportedTemperatureUnits",
                "type": "List[TempUnitEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 45,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 45,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 45,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 45,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 45,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 45,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "46": {
        "id": 46,
        "label": "PowerSourceConfiguration",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 46,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 46,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 46,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 46,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 46,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "47": {
        "id": 47,
        "label": "PowerSource",
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
                "label": "WiredAssessedInputVoltage",
                "type": "Optional[Nullable[uint32]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 47,
                "label": "WiredAssessedInputFrequency",
                "type": "Optional[Nullable[uint16]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 47,
                "label": "WiredCurrentType",
                "type": "Optional[WiredCurrentTypeEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 47,
                "label": "WiredAssessedCurrent",
                "type": "Optional[Nullable[uint32]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 47,
                "label": "WiredNominalVoltage",
                "type": "Optional[uint32]"
            },
            "8": {
                "id": 8,
                "cluster_id": 47,
                "label": "WiredMaximumCurrent",
                "type": "Optional[uint32]"
            },
            "9": {
                "id": 9,
                "cluster_id": 47,
                "label": "WiredPresent",
                "type": "Optional[bool]"
            },
            "10": {
                "id": 10,
                "cluster_id": 47,
                "label": "ActiveWiredFaults",
                "type": "List[WiredFaultEnum]"
            },
            "11": {
                "id": 11,
                "cluster_id": 47,
                "label": "BatVoltage",
                "type": "Optional[Nullable[uint32]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 47,
                "label": "BatPercentRemaining",
                "type": "Optional[Nullable[uint8]]"
            },
            "13": {
                "id": 13,
                "cluster_id": 47,
                "label": "BatTimeRemaining",
                "type": "Optional[Nullable[uint32]]"
            },
            "14": {
                "id": 14,
                "cluster_id": 47,
                "label": "BatChargeLevel",
                "type": "Optional[BatChargeLevelEnum]"
            },
            "15": {
                "id": 15,
                "cluster_id": 47,
                "label": "BatReplacementNeeded",
                "type": "Optional[bool]"
            },
            "16": {
                "id": 16,
                "cluster_id": 47,
                "label": "BatReplaceability",
                "type": "Optional[BatReplaceabilityEnum]"
            },
            "17": {
                "id": 17,
                "cluster_id": 47,
                "label": "BatPresent",
                "type": "Optional[bool]"
            },
            "18": {
                "id": 18,
                "cluster_id": 47,
                "label": "ActiveBatFaults",
                "type": "List[BatFaultEnum]"
            },
            "19": {
                "id": 19,
                "cluster_id": 47,
                "label": "BatReplacementDescription",
                "type": "Optional[string]"
            },
            "20": {
                "id": 20,
                "cluster_id": 47,
                "label": "BatCommonDesignation",
                "type": "Optional[BatCommonDesignationEnum]"
            },
            "21": {
                "id": 21,
                "cluster_id": 47,
                "label": "BatAnsiDesignation",
                "type": "Optional[string]"
            },
            "22": {
                "id": 22,
                "cluster_id": 47,
                "label": "BatIecDesignation",
                "type": "Optional[string]"
            },
            "23": {
                "id": 23,
                "cluster_id": 47,
                "label": "BatApprovedChemistry",
                "type": "Optional[BatApprovedChemistryEnum]"
            },
            "24": {
                "id": 24,
                "cluster_id": 47,
                "label": "BatCapacity",
                "type": "Optional[uint32]"
            },
            "25": {
                "id": 25,
                "cluster_id": 47,
                "label": "BatQuantity",
                "type": "Optional[uint8]"
            },
            "26": {
                "id": 26,
                "cluster_id": 47,
                "label": "BatChargeState",
                "type": "Optional[BatChargeStateEnum]"
            },
            "27": {
                "id": 27,
                "cluster_id": 47,
                "label": "BatTimeToFullCharge",
                "type": "Optional[Nullable[uint32]]"
            },
            "28": {
                "id": 28,
                "cluster_id": 47,
                "label": "BatFunctionalWhileCharging",
                "type": "Optional[bool]"
            },
            "29": {
                "id": 29,
                "cluster_id": 47,
                "label": "BatChargingCurrent",
                "type": "Optional[Nullable[uint32]]"
            },
            "30": {
                "id": 30,
                "cluster_id": 47,
                "label": "ActiveBatChargeFaults",
                "type": "List[BatChargeFaultEnum]"
            },
            "31": {
                "id": 31,
                "cluster_id": 47,
                "label": "EndpointList",
                "type": "List[endpoint-no]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 47,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 47,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 47,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 47,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 47,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 47,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "48": {
        "id": 48,
        "label": "GeneralCommissioning",
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
                "label": "BasicCommissioningInfo",
                "type": "BasicCommissioningInfo"
            },
            "2": {
                "id": 2,
                "cluster_id": 48,
                "label": "RegulatoryConfig",
                "type": "RegulatoryLocationTypeEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 48,
                "label": "LocationCapability",
                "type": "RegulatoryLocationTypeEnum"
            },
            "4": {
                "id": 4,
                "cluster_id": 48,
                "label": "SupportsConcurrentConnection",
                "type": "bool"
            },
            "5": {
                "id": 5,
                "cluster_id": 48,
                "label": "TcAcceptedVersion",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 48,
                "label": "TcMinRequiredVersion",
                "type": "Optional[uint16]"
            },
            "7": {
                "id": 7,
                "cluster_id": 48,
                "label": "TcAcknowledgements",
                "type": "Optional[map16]"
            },
            "8": {
                "id": 8,
                "cluster_id": 48,
                "label": "TcAcknowledgementsRequired",
                "type": "Optional[bool]"
            },
            "9": {
                "id": 9,
                "cluster_id": 48,
                "label": "TcUpdateDeadline",
                "type": "Optional[Nullable[uint32]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 48,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 48,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 48,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 48,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 48,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 48,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "49": {
        "id": 49,
        "label": "NetworkCommissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 49,
                "label": "MaxNetworks",
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
                "label": "ScanMaxTimeSeconds",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 49,
                "label": "ConnectMaxTimeSeconds",
                "type": "Optional[uint8]"
            },
            "4": {
                "id": 4,
                "cluster_id": 49,
                "label": "InterfaceEnabled",
                "type": "bool"
            },
            "5": {
                "id": 5,
                "cluster_id": 49,
                "label": "LastNetworkingStatus",
                "type": "Nullable[NetworkCommissioningStatusEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 49,
                "label": "LastNetworkId",
                "type": "Nullable[bytes]"
            },
            "7": {
                "id": 7,
                "cluster_id": 49,
                "label": "LastConnectErrorValue",
                "type": "Nullable[int32]"
            },
            "8": {
                "id": 8,
                "cluster_id": 49,
                "label": "SupportedWiFiBands",
                "type": "List[WiFiBandEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 49,
                "label": "SupportedThreadFeatures",
                "type": "Optional[ThreadCapabilitiesBitmap]"
            },
            "10": {
                "id": 10,
                "cluster_id": 49,
                "label": "ThreadVersion",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 49,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 49,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 49,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 49,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 49,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 49,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "50": {
        "id": 50,
        "label": "DiagnosticLogs",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 50,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 50,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 50,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 50,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 50,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 50,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "51": {
        "id": 51,
        "label": "GeneralDiagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 51,
                "label": "NetworkInterfaces",
                "type": "List[NetworkInterface]"
            },
            "1": {
                "id": 1,
                "cluster_id": 51,
                "label": "RebootCount",
                "type": "uint16"
            },
            "2": {
                "id": 2,
                "cluster_id": 51,
                "label": "UpTime",
                "type": "uint64"
            },
            "3": {
                "id": 3,
                "cluster_id": 51,
                "label": "TotalOperationalHours",
                "type": "Optional[uint32]"
            },
            "4": {
                "id": 4,
                "cluster_id": 51,
                "label": "BootReason",
                "type": "Optional[BootReasonEnum]"
            },
            "5": {
                "id": 5,
                "cluster_id": 51,
                "label": "ActiveHardwareFaults",
                "type": "List[HardwareFaultEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 51,
                "label": "ActiveRadioFaults",
                "type": "List[RadioFaultEnum]"
            },
            "7": {
                "id": 7,
                "cluster_id": 51,
                "label": "ActiveNetworkFaults",
                "type": "List[NetworkFaultEnum]"
            },
            "8": {
                "id": 8,
                "cluster_id": 51,
                "label": "TestEventTriggersEnabled",
                "type": "bool"
            },
            "9": {
                "id": 9,
                "cluster_id": 51,
                "label": "DoNotUse",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 51,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 51,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 51,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 51,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 51,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 51,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "52": {
        "id": 52,
        "label": "SoftwareDiagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 52,
                "label": "ThreadMetrics",
                "type": "List[ThreadMetricsStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 52,
                "label": "CurrentHeapFree",
                "type": "Optional[uint64]"
            },
            "2": {
                "id": 2,
                "cluster_id": 52,
                "label": "CurrentHeapUsed",
                "type": "Optional[uint64]"
            },
            "3": {
                "id": 3,
                "cluster_id": 52,
                "label": "CurrentHeapHighWatermark",
                "type": "Optional[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 52,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 52,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 52,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 52,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 52,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 52,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "53": {
        "id": 53,
        "label": "ThreadNetworkDiagnostics",
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
                "label": "RoutingRole",
                "type": "Nullable[RoutingRoleEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 53,
                "label": "NetworkName",
                "type": "Nullable[string]"
            },
            "3": {
                "id": 3,
                "cluster_id": 53,
                "label": "PanId",
                "type": "Nullable[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 53,
                "label": "ExtendedPanId",
                "type": "Nullable[uint64]"
            },
            "5": {
                "id": 5,
                "cluster_id": 53,
                "label": "MeshLocalPrefix",
                "type": "Nullable[bytes]"
            },
            "6": {
                "id": 6,
                "cluster_id": 53,
                "label": "OverrunCount",
                "type": "Optional[uint64]"
            },
            "7": {
                "id": 7,
                "cluster_id": 53,
                "label": "NeighborTable",
                "type": "List[NeighborTableStruct]"
            },
            "8": {
                "id": 8,
                "cluster_id": 53,
                "label": "RouteTable",
                "type": "List[RouteTableStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 53,
                "label": "PartitionId",
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
                "label": "DataVersion",
                "type": "Nullable[uint16]"
            },
            "12": {
                "id": 12,
                "cluster_id": 53,
                "label": "StableDataVersion",
                "type": "Nullable[uint16]"
            },
            "13": {
                "id": 13,
                "cluster_id": 53,
                "label": "LeaderRouterId",
                "type": "Nullable[uint8]"
            },
            "14": {
                "id": 14,
                "cluster_id": 53,
                "label": "DetachedRoleCount",
                "type": "Optional[uint16]"
            },
            "15": {
                "id": 15,
                "cluster_id": 53,
                "label": "ChildRoleCount",
                "type": "Optional[uint16]"
            },
            "16": {
                "id": 16,
                "cluster_id": 53,
                "label": "RouterRoleCount",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 53,
                "label": "LeaderRoleCount",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 53,
                "label": "AttachAttemptCount",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 53,
                "label": "PartitionIdChangeCount",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 53,
                "label": "BetterPartitionAttachAttemptCount",
                "type": "Optional[uint16]"
            },
            "21": {
                "id": 21,
                "cluster_id": 53,
                "label": "ParentChangeCount",
                "type": "Optional[uint16]"
            },
            "22": {
                "id": 22,
                "cluster_id": 53,
                "label": "TxTotalCount",
                "type": "Optional[uint32]"
            },
            "23": {
                "id": 23,
                "cluster_id": 53,
                "label": "TxUnicastCount",
                "type": "Optional[uint32]"
            },
            "24": {
                "id": 24,
                "cluster_id": 53,
                "label": "TxBroadcastCount",
                "type": "Optional[uint32]"
            },
            "25": {
                "id": 25,
                "cluster_id": 53,
                "label": "TxAckRequestedCount",
                "type": "Optional[uint32]"
            },
            "26": {
                "id": 26,
                "cluster_id": 53,
                "label": "TxAckedCount",
                "type": "Optional[uint32]"
            },
            "27": {
                "id": 27,
                "cluster_id": 53,
                "label": "TxNoAckRequestedCount",
                "type": "Optional[uint32]"
            },
            "28": {
                "id": 28,
                "cluster_id": 53,
                "label": "TxDataCount",
                "type": "Optional[uint32]"
            },
            "29": {
                "id": 29,
                "cluster_id": 53,
                "label": "TxDataPollCount",
                "type": "Optional[uint32]"
            },
            "30": {
                "id": 30,
                "cluster_id": 53,
                "label": "TxBeaconCount",
                "type": "Optional[uint32]"
            },
            "31": {
                "id": 31,
                "cluster_id": 53,
                "label": "TxBeaconRequestCount",
                "type": "Optional[uint32]"
            },
            "32": {
                "id": 32,
                "cluster_id": 53,
                "label": "TxOtherCount",
                "type": "Optional[uint32]"
            },
            "33": {
                "id": 33,
                "cluster_id": 53,
                "label": "TxRetryCount",
                "type": "Optional[uint32]"
            },
            "34": {
                "id": 34,
                "cluster_id": 53,
                "label": "TxDirectMaxRetryExpiryCount",
                "type": "Optional[uint32]"
            },
            "35": {
                "id": 35,
                "cluster_id": 53,
                "label": "TxIndirectMaxRetryExpiryCount",
                "type": "Optional[uint32]"
            },
            "36": {
                "id": 36,
                "cluster_id": 53,
                "label": "TxErrCcaCount",
                "type": "Optional[uint32]"
            },
            "37": {
                "id": 37,
                "cluster_id": 53,
                "label": "TxErrAbortCount",
                "type": "Optional[uint32]"
            },
            "38": {
                "id": 38,
                "cluster_id": 53,
                "label": "TxErrBusyChannelCount",
                "type": "Optional[uint32]"
            },
            "39": {
                "id": 39,
                "cluster_id": 53,
                "label": "RxTotalCount",
                "type": "Optional[uint32]"
            },
            "40": {
                "id": 40,
                "cluster_id": 53,
                "label": "RxUnicastCount",
                "type": "Optional[uint32]"
            },
            "41": {
                "id": 41,
                "cluster_id": 53,
                "label": "RxBroadcastCount",
                "type": "Optional[uint32]"
            },
            "42": {
                "id": 42,
                "cluster_id": 53,
                "label": "RxDataCount",
                "type": "Optional[uint32]"
            },
            "43": {
                "id": 43,
                "cluster_id": 53,
                "label": "RxDataPollCount",
                "type": "Optional[uint32]"
            },
            "44": {
                "id": 44,
                "cluster_id": 53,
                "label": "RxBeaconCount",
                "type": "Optional[uint32]"
            },
            "45": {
                "id": 45,
                "cluster_id": 53,
                "label": "RxBeaconRequestCount",
                "type": "Optional[uint32]"
            },
            "46": {
                "id": 46,
                "cluster_id": 53,
                "label": "RxOtherCount",
                "type": "Optional[uint32]"
            },
            "47": {
                "id": 47,
                "cluster_id": 53,
                "label": "RxAddressFilteredCount",
                "type": "Optional[uint32]"
            },
            "48": {
                "id": 48,
                "cluster_id": 53,
                "label": "RxDestAddrFilteredCount",
                "type": "Optional[uint32]"
            },
            "49": {
                "id": 49,
                "cluster_id": 53,
                "label": "RxDuplicatedCount",
                "type": "Optional[uint32]"
            },
            "50": {
                "id": 50,
                "cluster_id": 53,
                "label": "RxErrNoFrameCount",
                "type": "Optional[uint32]"
            },
            "51": {
                "id": 51,
                "cluster_id": 53,
                "label": "RxErrUnknownNeighborCount",
                "type": "Optional[uint32]"
            },
            "52": {
                "id": 52,
                "cluster_id": 53,
                "label": "RxErrInvalidSrcAddrCount",
                "type": "Optional[uint32]"
            },
            "53": {
                "id": 53,
                "cluster_id": 53,
                "label": "RxErrSecCount",
                "type": "Optional[uint32]"
            },
            "54": {
                "id": 54,
                "cluster_id": 53,
                "label": "RxErrFcsCount",
                "type": "Optional[uint32]"
            },
            "55": {
                "id": 55,
                "cluster_id": 53,
                "label": "RxErrOtherCount",
                "type": "Optional[uint32]"
            },
            "56": {
                "id": 56,
                "cluster_id": 53,
                "label": "ActiveTimestamp",
                "type": "Optional[Nullable[uint64]]"
            },
            "57": {
                "id": 57,
                "cluster_id": 53,
                "label": "PendingTimestamp",
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
                "label": "SecurityPolicy",
                "type": "Nullable[SecurityPolicy]"
            },
            "60": {
                "id": 60,
                "cluster_id": 53,
                "label": "ChannelPage0Mask",
                "type": "Nullable[bytes]"
            },
            "61": {
                "id": 61,
                "cluster_id": 53,
                "label": "OperationalDatasetComponents",
                "type": "Nullable[OperationalDatasetComponents]"
            },
            "62": {
                "id": 62,
                "cluster_id": 53,
                "label": "ActiveNetworkFaultsList",
                "type": "List[NetworkFaultEnum]"
            },
            "63": {
                "id": 63,
                "cluster_id": 53,
                "label": "ExtAddress",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 53,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 53,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 53,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 53,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 53,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "54": {
        "id": 54,
        "label": "WiFiNetworkDiagnostics",
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
                "label": "SecurityType",
                "type": "Nullable[SecurityTypeEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 54,
                "label": "WiFiVersion",
                "type": "Nullable[WiFiVersionEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 54,
                "label": "ChannelNumber",
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
                "label": "BeaconLostCount",
                "type": "Optional[Nullable[uint32]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 54,
                "label": "BeaconRxCount",
                "type": "Optional[Nullable[uint32]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 54,
                "label": "PacketMulticastRxCount",
                "type": "Optional[Nullable[uint32]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 54,
                "label": "PacketMulticastTxCount",
                "type": "Optional[Nullable[uint32]]"
            },
            "9": {
                "id": 9,
                "cluster_id": 54,
                "label": "PacketUnicastRxCount",
                "type": "Optional[Nullable[uint32]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 54,
                "label": "PacketUnicastTxCount",
                "type": "Optional[Nullable[uint32]]"
            },
            "11": {
                "id": 11,
                "cluster_id": 54,
                "label": "CurrentMaxRate",
                "type": "Optional[Nullable[uint64]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 54,
                "label": "OverrunCount",
                "type": "Optional[Nullable[uint64]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 54,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 54,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 54,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 54,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 54,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 54,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "55": {
        "id": 55,
        "label": "EthernetNetworkDiagnostics",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 55,
                "label": "PhyRate",
                "type": "Optional[Nullable[PHYRateEnum]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 55,
                "label": "FullDuplex",
                "type": "Optional[Nullable[bool]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 55,
                "label": "PacketRxCount",
                "type": "Optional[uint64]"
            },
            "3": {
                "id": 3,
                "cluster_id": 55,
                "label": "PacketTxCount",
                "type": "Optional[uint64]"
            },
            "4": {
                "id": 4,
                "cluster_id": 55,
                "label": "TxErrCount",
                "type": "Optional[uint64]"
            },
            "5": {
                "id": 5,
                "cluster_id": 55,
                "label": "CollisionCount",
                "type": "Optional[uint64]"
            },
            "6": {
                "id": 6,
                "cluster_id": 55,
                "label": "OverrunCount",
                "type": "Optional[uint64]"
            },
            "7": {
                "id": 7,
                "cluster_id": 55,
                "label": "CarrierDetect",
                "type": "Optional[Nullable[bool]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 55,
                "label": "TimeSinceReset",
                "type": "Optional[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 55,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 55,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 55,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 55,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 55,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 55,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "56": {
        "id": 56,
        "label": "TimeSynchronization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 56,
                "label": "UtcTime",
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
                "label": "TimeSource",
                "type": "Optional[TimeSourceEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 56,
                "label": "TrustedTimeSource",
                "type": "Optional[Nullable[TrustedTimeSourceStruct]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 56,
                "label": "DefaultNtp",
                "type": "Optional[Nullable[string]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 56,
                "label": "TimeZone",
                "type": "List[TimeZoneStruct]"
            },
            "6": {
                "id": 6,
                "cluster_id": 56,
                "label": "DstOffset",
                "type": "List[DSTOffsetStruct]"
            },
            "7": {
                "id": 7,
                "cluster_id": 56,
                "label": "LocalTime",
                "type": "Optional[Nullable[epoch-us]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 56,
                "label": "TimeZoneDatabase",
                "type": "Optional[TimeZoneDatabaseEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 56,
                "label": "NtpServerAvailable",
                "type": "Optional[bool]"
            },
            "10": {
                "id": 10,
                "cluster_id": 56,
                "label": "TimeZoneListMaxSize",
                "type": "Optional[uint8]"
            },
            "11": {
                "id": 11,
                "cluster_id": 56,
                "label": "DstOffsetListMaxSize",
                "type": "Optional[uint8]"
            },
            "12": {
                "id": 12,
                "cluster_id": 56,
                "label": "SupportsDnsResolve",
                "type": "Optional[bool]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 56,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 56,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 56,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 56,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 56,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 56,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "57": {
        "id": 57,
        "label": "BridgedDeviceBasicInformation",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 57,
                "label": "DataModelRevision",
                "type": "Optional[unknown]"
            },
            "1": {
                "id": 1,
                "cluster_id": 57,
                "label": "VendorName",
                "type": "Optional[string]"
            },
            "2": {
                "id": 2,
                "cluster_id": 57,
                "label": "VendorId",
                "type": "Optional[unknown]"
            },
            "3": {
                "id": 3,
                "cluster_id": 57,
                "label": "ProductName",
                "type": "Optional[string]"
            },
            "4": {
                "id": 4,
                "cluster_id": 57,
                "label": "ProductId",
                "type": "Optional[unknown]"
            },
            "5": {
                "id": 5,
                "cluster_id": 57,
                "label": "NodeLabel",
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
                "label": "HardwareVersion",
                "type": "Optional[unknown]"
            },
            "8": {
                "id": 8,
                "cluster_id": 57,
                "label": "HardwareVersionString",
                "type": "Optional[string]"
            },
            "9": {
                "id": 9,
                "cluster_id": 57,
                "label": "SoftwareVersion",
                "type": "Optional[unknown]"
            },
            "10": {
                "id": 10,
                "cluster_id": 57,
                "label": "SoftwareVersionString",
                "type": "Optional[string]"
            },
            "11": {
                "id": 11,
                "cluster_id": 57,
                "label": "ManufacturingDate",
                "type": "Optional[string]"
            },
            "12": {
                "id": 12,
                "cluster_id": 57,
                "label": "PartNumber",
                "type": "Optional[string]"
            },
            "13": {
                "id": 13,
                "cluster_id": 57,
                "label": "ProductUrl",
                "type": "Optional[string]"
            },
            "14": {
                "id": 14,
                "cluster_id": 57,
                "label": "ProductLabel",
                "type": "Optional[string]"
            },
            "15": {
                "id": 15,
                "cluster_id": 57,
                "label": "SerialNumber",
                "type": "Optional[string]"
            },
            "16": {
                "id": 16,
                "cluster_id": 57,
                "label": "LocalConfigDisabled",
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
                "label": "UniqueId",
                "type": "string"
            },
            "19": {
                "id": 19,
                "cluster_id": 57,
                "label": "CapabilityMinima",
                "type": "Optional[unknown]"
            },
            "20": {
                "id": 20,
                "cluster_id": 57,
                "label": "ProductAppearance",
                "type": "Optional[unknown]"
            },
            "21": {
                "id": 21,
                "cluster_id": 57,
                "label": "SpecificationVersion",
                "type": "Optional[unknown]"
            },
            "22": {
                "id": 22,
                "cluster_id": 57,
                "label": "MaxPathsPerInvoke",
                "type": "Optional[unknown]"
            },
            "24": {
                "id": 24,
                "cluster_id": 57,
                "label": "ConfigurationVersion",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 57,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 57,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 57,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 57,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 57,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 57,
                "label": "ClusterRevision",
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
                "label": "NumberOfPositions",
                "type": "uint8"
            },
            "1": {
                "id": 1,
                "cluster_id": 59,
                "label": "CurrentPosition",
                "type": "uint8"
            },
            "2": {
                "id": 2,
                "cluster_id": 59,
                "label": "MultiPressMax",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 59,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 59,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 59,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 59,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 59,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 59,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "60": {
        "id": 60,
        "label": "AdministratorCommissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 60,
                "label": "WindowStatus",
                "type": "CommissioningWindowStatusEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 60,
                "label": "AdminFabricIndex",
                "type": "Nullable[fabric-idx]"
            },
            "2": {
                "id": 2,
                "cluster_id": 60,
                "label": "AdminVendorId",
                "type": "Nullable[vendor-id]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 60,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 60,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 60,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 60,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 60,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 60,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "62": {
        "id": 62,
        "label": "OperationalCredentials",
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
                "label": "SupportedFabrics",
                "type": "uint8"
            },
            "3": {
                "id": 3,
                "cluster_id": 62,
                "label": "CommissionedFabrics",
                "type": "uint8"
            },
            "4": {
                "id": 4,
                "cluster_id": 62,
                "label": "TrustedRootCertificates",
                "type": "List[octstr]"
            },
            "5": {
                "id": 5,
                "cluster_id": 62,
                "label": "CurrentFabricIndex",
                "type": "fabric-idx"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 62,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 62,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 62,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 62,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 62,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 62,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "63": {
        "id": 63,
        "label": "GroupKeyManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 63,
                "label": "GroupKeyMap",
                "type": "List[GroupKeyMapStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 63,
                "label": "GroupTable",
                "type": "List[GroupInfoMapStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 63,
                "label": "MaxGroupsPerFabric",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 63,
                "label": "MaxGroupKeysPerFabric",
                "type": "uint16"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 63,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 63,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 63,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 63,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 63,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 63,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "64": {
        "id": 64,
        "label": "FixedLabel",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 64,
                "label": "LabelList",
                "type": "List[LabelStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 64,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 64,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 64,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 64,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 64,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 64,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "65": {
        "id": 65,
        "label": "UserLabel",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 65,
                "label": "LabelList",
                "type": "List[LabelStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 65,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 65,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 65,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 65,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 65,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 65,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "69": {
        "id": 69,
        "label": "BooleanState",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 69,
                "label": "StateValue",
                "type": "bool"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 69,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 69,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 69,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 69,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 69,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 69,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "70": {
        "id": 70,
        "label": "IcdManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 70,
                "label": "IdleModeDuration",
                "type": "uint32"
            },
            "1": {
                "id": 1,
                "cluster_id": 70,
                "label": "ActiveModeDuration",
                "type": "uint32"
            },
            "2": {
                "id": 2,
                "cluster_id": 70,
                "label": "ActiveModeThreshold",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 70,
                "label": "RegisteredClients",
                "type": "List[MonitoringRegistrationStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 70,
                "label": "IcdCounter",
                "type": "Optional[uint32]"
            },
            "5": {
                "id": 5,
                "cluster_id": 70,
                "label": "ClientsSupportedPerFabric",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 70,
                "label": "UserActiveModeTriggerHint",
                "type": "Optional[UserActiveModeTriggerBitmap]"
            },
            "7": {
                "id": 7,
                "cluster_id": 70,
                "label": "UserActiveModeTriggerInstruction",
                "type": "Optional[string]"
            },
            "8": {
                "id": 8,
                "cluster_id": 70,
                "label": "OperatingMode",
                "type": "Optional[OperatingModeEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 70,
                "label": "MaximumCheckInBackoff",
                "type": "Optional[uint32]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 70,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 70,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 70,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 70,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 70,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 70,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "72": {
        "id": 72,
        "label": "OvenCavityOperationalState",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 72,
                "label": "PhaseList",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 72,
                "label": "CurrentPhase",
                "type": "Nullable[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 72,
                "label": "CountdownTime",
                "type": "Optional[Nullable[elapsed-s]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 72,
                "label": "OperationalStateList",
                "type": "List[OperationalStateStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 72,
                "label": "OperationalState",
                "type": "OperationalStateEnum"
            },
            "5": {
                "id": 5,
                "cluster_id": 72,
                "label": "OperationalError",
                "type": "ErrorStateStruct"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 72,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 72,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 72,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 72,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 72,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 72,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "73": {
        "id": 73,
        "label": "OvenMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 73,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 73,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 73,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 73,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 73,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 73,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 73,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 73,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 73,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 73,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "74": {
        "id": 74,
        "label": "LaundryDryerControls",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 74,
                "label": "SupportedDrynessLevels",
                "type": "List[DrynessLevelEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 74,
                "label": "SelectedDrynessLevel",
                "type": "Nullable[DrynessLevelEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 74,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 74,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 74,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 74,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 74,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 74,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "80": {
        "id": 80,
        "label": "ModeSelect",
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
                "label": "StandardNamespace",
                "type": "Nullable[namespace]"
            },
            "2": {
                "id": 2,
                "cluster_id": 80,
                "label": "SupportedModes",
                "type": "List[ModeOptionStruct]"
            },
            "3": {
                "id": 3,
                "cluster_id": 80,
                "label": "CurrentMode",
                "type": "uint8"
            },
            "4": {
                "id": 4,
                "cluster_id": 80,
                "label": "StartUpMode",
                "type": "Optional[Nullable[uint8]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 80,
                "label": "OnMode",
                "type": "Optional[Nullable[uint8]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 80,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 80,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 80,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 80,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 80,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 80,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "81": {
        "id": 81,
        "label": "LaundryWasherMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 81,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 81,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 81,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 81,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 81,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 81,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 81,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 81,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 81,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 81,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "82": {
        "id": 82,
        "label": "RefrigeratorAndTemperatureControlledCabinetMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 82,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 82,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 82,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 82,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 82,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 82,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 82,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 82,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 82,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 82,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "83": {
        "id": 83,
        "label": "LaundryWasherControls",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 83,
                "label": "SpinSpeeds",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 83,
                "label": "SpinSpeedCurrent",
                "type": "Optional[Nullable[uint8]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 83,
                "label": "NumberOfRinses",
                "type": "Optional[NumberOfRinsesEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 83,
                "label": "SupportedRinses",
                "type": "List[NumberOfRinsesEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 83,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 83,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 83,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 83,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 83,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 83,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "84": {
        "id": 84,
        "label": "RvcRunMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 84,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 84,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 84,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 84,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 84,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 84,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 84,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 84,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 84,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 84,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "85": {
        "id": 85,
        "label": "RvcCleanMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 85,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 85,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 85,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 85,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 85,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 85,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 85,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 85,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 85,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 85,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "86": {
        "id": 86,
        "label": "TemperatureControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 86,
                "label": "TemperatureSetpoint",
                "type": "Optional[temperature]"
            },
            "1": {
                "id": 1,
                "cluster_id": 86,
                "label": "MinTemperature",
                "type": "Optional[temperature]"
            },
            "2": {
                "id": 2,
                "cluster_id": 86,
                "label": "MaxTemperature",
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
                "label": "SelectedTemperatureLevel",
                "type": "Optional[uint8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 86,
                "label": "SupportedTemperatureLevels",
                "type": "List[string]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 86,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 86,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 86,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 86,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 86,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 86,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "87": {
        "id": 87,
        "label": "RefrigeratorAlarm",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 87,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 87,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 87,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 87,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 87,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "89": {
        "id": 89,
        "label": "DishwasherMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 89,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 89,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 89,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 89,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 89,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 89,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 89,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 89,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 89,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 89,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "91": {
        "id": 91,
        "label": "AirQuality",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 91,
                "label": "AirQuality",
                "type": "AirQualityEnum"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 91,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 91,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 91,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 91,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 91,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 91,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "92": {
        "id": 92,
        "label": "SmokeCoAlarm",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 92,
                "label": "ExpressedState",
                "type": "ExpressedStateEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 92,
                "label": "SmokeState",
                "type": "Optional[AlarmStateEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 92,
                "label": "CoState",
                "type": "Optional[AlarmStateEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 92,
                "label": "BatteryAlert",
                "type": "AlarmStateEnum"
            },
            "4": {
                "id": 4,
                "cluster_id": 92,
                "label": "DeviceMuted",
                "type": "Optional[MuteStateEnum]"
            },
            "5": {
                "id": 5,
                "cluster_id": 92,
                "label": "TestInProgress",
                "type": "bool"
            },
            "6": {
                "id": 6,
                "cluster_id": 92,
                "label": "HardwareFaultAlert",
                "type": "bool"
            },
            "7": {
                "id": 7,
                "cluster_id": 92,
                "label": "EndOfServiceAlert",
                "type": "EndOfServiceEnum"
            },
            "8": {
                "id": 8,
                "cluster_id": 92,
                "label": "InterconnectSmokeAlarm",
                "type": "Optional[AlarmStateEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 92,
                "label": "InterconnectCoAlarm",
                "type": "Optional[AlarmStateEnum]"
            },
            "10": {
                "id": 10,
                "cluster_id": 92,
                "label": "ContaminationState",
                "type": "Optional[ContaminationStateEnum]"
            },
            "11": {
                "id": 11,
                "cluster_id": 92,
                "label": "SmokeSensitivityLevel",
                "type": "Optional[SensitivityEnum]"
            },
            "12": {
                "id": 12,
                "cluster_id": 92,
                "label": "ExpiryDate",
                "type": "Optional[epoch-s]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 92,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 92,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 92,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 92,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 92,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 92,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "93": {
        "id": 93,
        "label": "DishwasherAlarm",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 93,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 93,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 93,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 93,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 93,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "94": {
        "id": 94,
        "label": "MicrowaveOvenMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 94,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 94,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 94,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 94,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 94,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 94,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 94,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 94,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 94,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 94,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "95": {
        "id": 95,
        "label": "MicrowaveOvenControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 95,
                "label": "CookTime",
                "type": "elapsed-s"
            },
            "1": {
                "id": 1,
                "cluster_id": 95,
                "label": "MaxCookTime",
                "type": "elapsed-s"
            },
            "2": {
                "id": 2,
                "cluster_id": 95,
                "label": "PowerSetting",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 95,
                "label": "MinPower",
                "type": "Optional[uint8]"
            },
            "4": {
                "id": 4,
                "cluster_id": 95,
                "label": "MaxPower",
                "type": "Optional[uint8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 95,
                "label": "PowerStep",
                "type": "Optional[uint8]"
            },
            "6": {
                "id": 6,
                "cluster_id": 95,
                "label": "SupportedWatts",
                "type": "List[uint16]"
            },
            "7": {
                "id": 7,
                "cluster_id": 95,
                "label": "SelectedWattIndex",
                "type": "Optional[uint8]"
            },
            "8": {
                "id": 8,
                "cluster_id": 95,
                "label": "WattRating",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 95,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 95,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 95,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 95,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 95,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 95,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "96": {
        "id": 96,
        "label": "OperationalState",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 96,
                "label": "PhaseList",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 96,
                "label": "CurrentPhase",
                "type": "Nullable[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 96,
                "label": "CountdownTime",
                "type": "Optional[Nullable[elapsed-s]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 96,
                "label": "OperationalStateList",
                "type": "List[OperationalStateStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 96,
                "label": "OperationalState",
                "type": "OperationalStateEnum"
            },
            "5": {
                "id": 5,
                "cluster_id": 96,
                "label": "OperationalError",
                "type": "ErrorStateStruct"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 96,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 96,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 96,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 96,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 96,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 96,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "97": {
        "id": 97,
        "label": "RvcOperationalState",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 97,
                "label": "PhaseList",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 97,
                "label": "CurrentPhase",
                "type": "Nullable[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 97,
                "label": "CountdownTime",
                "type": "Optional[Nullable[elapsed-s]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 97,
                "label": "OperationalStateList",
                "type": "List[OperationalStateStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 97,
                "label": "OperationalState",
                "type": "OperationalStateEnum"
            },
            "5": {
                "id": 5,
                "cluster_id": 97,
                "label": "OperationalError",
                "type": "ErrorStateStruct"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 97,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 97,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 97,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 97,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 97,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 97,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "98": {
        "id": 98,
        "label": "ScenesManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 98,
                "label": "DoNotUse",
                "type": "Optional[unknown]"
            },
            "1": {
                "id": 1,
                "cluster_id": 98,
                "label": "SceneTableSize",
                "type": "uint16"
            },
            "2": {
                "id": 2,
                "cluster_id": 98,
                "label": "FabricSceneInfo",
                "type": "List[SceneInfoStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 98,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 98,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 98,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 98,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 98,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 98,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "113": {
        "id": 113,
        "label": "HepaFilterMonitoring",
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
                "label": "DegradationDirection",
                "type": "Optional[DegradationDirectionEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 113,
                "label": "ChangeIndication",
                "type": "ChangeIndicationEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 113,
                "label": "InPlaceIndicator",
                "type": "Optional[bool]"
            },
            "4": {
                "id": 4,
                "cluster_id": 113,
                "label": "LastChangedTime",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 113,
                "label": "ReplacementProductList",
                "type": "List[ReplacementProductStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 113,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 113,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 113,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 113,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 113,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 113,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "114": {
        "id": 114,
        "label": "ActivatedCarbonFilterMonitoring",
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
                "label": "DegradationDirection",
                "type": "Optional[DegradationDirectionEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 114,
                "label": "ChangeIndication",
                "type": "ChangeIndicationEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 114,
                "label": "InPlaceIndicator",
                "type": "Optional[bool]"
            },
            "4": {
                "id": 4,
                "cluster_id": 114,
                "label": "LastChangedTime",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 114,
                "label": "ReplacementProductList",
                "type": "List[ReplacementProductStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 114,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 114,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 114,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 114,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 114,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 114,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "121": {
        "id": 121,
        "label": "WaterTankLevelMonitoring",
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
                "label": "DegradationDirection",
                "type": "Optional[DegradationDirectionEnum]"
            },
            "2": {
                "id": 2,
                "cluster_id": 121,
                "label": "ChangeIndication",
                "type": "ChangeIndicationEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 121,
                "label": "InPlaceIndicator",
                "type": "Optional[bool]"
            },
            "4": {
                "id": 4,
                "cluster_id": 121,
                "label": "LastChangedTime",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 121,
                "label": "ReplacementProductList",
                "type": "List[ReplacementProductStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 121,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 121,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 121,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 121,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 121,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 121,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "128": {
        "id": 128,
        "label": "BooleanStateConfiguration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 128,
                "label": "CurrentSensitivityLevel",
                "type": "Optional[uint8]"
            },
            "1": {
                "id": 1,
                "cluster_id": 128,
                "label": "SupportedSensitivityLevels",
                "type": "Optional[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 128,
                "label": "DefaultSensitivityLevel",
                "type": "Optional[uint8]"
            },
            "3": {
                "id": 3,
                "cluster_id": 128,
                "label": "AlarmsActive",
                "type": "Optional[AlarmModeBitmap]"
            },
            "4": {
                "id": 4,
                "cluster_id": 128,
                "label": "AlarmsSuppressed",
                "type": "Optional[AlarmModeBitmap]"
            },
            "5": {
                "id": 5,
                "cluster_id": 128,
                "label": "AlarmsEnabled",
                "type": "Optional[AlarmModeBitmap]"
            },
            "6": {
                "id": 6,
                "cluster_id": 128,
                "label": "AlarmsSupported",
                "type": "Optional[AlarmModeBitmap]"
            },
            "7": {
                "id": 7,
                "cluster_id": 128,
                "label": "SensorFault",
                "type": "Optional[SensorFaultBitmap]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 128,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 128,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 128,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 128,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 128,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 128,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "129": {
        "id": 129,
        "label": "ValveConfigurationAndControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 129,
                "label": "OpenDuration",
                "type": "Nullable[elapsed-s]"
            },
            "1": {
                "id": 1,
                "cluster_id": 129,
                "label": "DefaultOpenDuration",
                "type": "Nullable[elapsed-s]"
            },
            "2": {
                "id": 2,
                "cluster_id": 129,
                "label": "AutoCloseTime",
                "type": "Optional[Nullable[epoch-us]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 129,
                "label": "RemainingDuration",
                "type": "Nullable[elapsed-s]"
            },
            "4": {
                "id": 4,
                "cluster_id": 129,
                "label": "CurrentState",
                "type": "Nullable[ValveStateEnum]"
            },
            "5": {
                "id": 5,
                "cluster_id": 129,
                "label": "TargetState",
                "type": "Nullable[ValveStateEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 129,
                "label": "CurrentLevel",
                "type": "Optional[Nullable[percent]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 129,
                "label": "TargetLevel",
                "type": "Optional[Nullable[percent]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 129,
                "label": "DefaultOpenLevel",
                "type": "Optional[percent]"
            },
            "9": {
                "id": 9,
                "cluster_id": 129,
                "label": "ValveFault",
                "type": "Optional[ValveFaultBitmap]"
            },
            "10": {
                "id": 10,
                "cluster_id": 129,
                "label": "LevelStep",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 129,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 129,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 129,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 129,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 129,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 129,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "144": {
        "id": 144,
        "label": "ElectricalPowerMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 144,
                "label": "PowerMode",
                "type": "PowerModeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 144,
                "label": "NumberOfMeasurementTypes",
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
                "label": "ActiveCurrent",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 144,
                "label": "ReactiveCurrent",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 144,
                "label": "ApparentCurrent",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 144,
                "label": "ActivePower",
                "type": "Nullable[power-mW]"
            },
            "9": {
                "id": 9,
                "cluster_id": 144,
                "label": "ReactivePower",
                "type": "Optional[Nullable[power-mVAR]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 144,
                "label": "ApparentPower",
                "type": "Optional[Nullable[power-mVA]]"
            },
            "11": {
                "id": 11,
                "cluster_id": 144,
                "label": "RmsVoltage",
                "type": "Optional[Nullable[voltage-mV]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 144,
                "label": "RmsCurrent",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "13": {
                "id": 13,
                "cluster_id": 144,
                "label": "RmsPower",
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
                "label": "HarmonicCurrents",
                "type": "List[HarmonicMeasurementStruct]"
            },
            "16": {
                "id": 16,
                "cluster_id": 144,
                "label": "HarmonicPhases",
                "type": "List[HarmonicMeasurementStruct]"
            },
            "17": {
                "id": 17,
                "cluster_id": 144,
                "label": "PowerFactor",
                "type": "Optional[Nullable[int64]]"
            },
            "18": {
                "id": 18,
                "cluster_id": 144,
                "label": "NeutralCurrent",
                "type": "Optional[Nullable[amperage-mA]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 144,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 144,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 144,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 144,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 144,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 144,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "145": {
        "id": 145,
        "label": "ElectricalEnergyMeasurement",
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
                "label": "CumulativeEnergyImported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 145,
                "label": "CumulativeEnergyExported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 145,
                "label": "PeriodicEnergyImported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 145,
                "label": "PeriodicEnergyExported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 145,
                "label": "CumulativeEnergyReset",
                "type": "Optional[Nullable[CumulativeEnergyResetStruct]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 145,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 145,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 145,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 145,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 145,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 145,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "148": {
        "id": 148,
        "label": "WaterHeaterManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 148,
                "label": "HeaterTypes",
                "type": "WaterHeaterHeatSourceBitmap"
            },
            "1": {
                "id": 1,
                "cluster_id": 148,
                "label": "HeatDemand",
                "type": "WaterHeaterHeatSourceBitmap"
            },
            "2": {
                "id": 2,
                "cluster_id": 148,
                "label": "TankVolume",
                "type": "Optional[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 148,
                "label": "EstimatedHeatRequired",
                "type": "Optional[energy-mWh]"
            },
            "4": {
                "id": 4,
                "cluster_id": 148,
                "label": "TankPercentage",
                "type": "Optional[percent]"
            },
            "5": {
                "id": 5,
                "cluster_id": 148,
                "label": "BoostState",
                "type": "BoostStateEnum"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 148,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 148,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 148,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 148,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 148,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 148,
                "label": "ClusterRevision",
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
                "label": "ActiveMessageIDs",
                "type": "List[MessageID]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 151,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 151,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 151,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 151,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 151,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 151,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "152": {
        "id": 152,
        "label": "DeviceEnergyManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 152,
                "label": "EsaType",
                "type": "ESATypeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 152,
                "label": "EsaCanGenerate",
                "type": "bool"
            },
            "2": {
                "id": 2,
                "cluster_id": 152,
                "label": "EsaState",
                "type": "ESAStateEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 152,
                "label": "AbsMinPower",
                "type": "power-mW"
            },
            "4": {
                "id": 4,
                "cluster_id": 152,
                "label": "AbsMaxPower",
                "type": "power-mW"
            },
            "5": {
                "id": 5,
                "cluster_id": 152,
                "label": "PowerAdjustmentCapability",
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
                "label": "OptOutState",
                "type": "Optional[OptOutStateEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 152,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 152,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 152,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 152,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 152,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 152,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "153": {
        "id": 153,
        "label": "EnergyEvse",
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
                "label": "SupplyState",
                "type": "SupplyStateEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 153,
                "label": "FaultState",
                "type": "FaultStateEnum"
            },
            "3": {
                "id": 3,
                "cluster_id": 153,
                "label": "ChargingEnabledUntil",
                "type": "Nullable[epoch-s]"
            },
            "4": {
                "id": 4,
                "cluster_id": 153,
                "label": "DischargingEnabledUntil",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 153,
                "label": "CircuitCapacity",
                "type": "amperage-mA"
            },
            "6": {
                "id": 6,
                "cluster_id": 153,
                "label": "MinimumChargeCurrent",
                "type": "amperage-mA"
            },
            "7": {
                "id": 7,
                "cluster_id": 153,
                "label": "MaximumChargeCurrent",
                "type": "amperage-mA"
            },
            "8": {
                "id": 8,
                "cluster_id": 153,
                "label": "MaximumDischargeCurrent",
                "type": "Optional[amperage-mA]"
            },
            "9": {
                "id": 9,
                "cluster_id": 153,
                "label": "UserMaximumChargeCurrent",
                "type": "Optional[amperage-mA]"
            },
            "10": {
                "id": 10,
                "cluster_id": 153,
                "label": "RandomizationDelayWindow",
                "type": "Optional[elapsed-s]"
            },
            "35": {
                "id": 35,
                "cluster_id": 153,
                "label": "NextChargeStartTime",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "36": {
                "id": 36,
                "cluster_id": 153,
                "label": "NextChargeTargetTime",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "37": {
                "id": 37,
                "cluster_id": 153,
                "label": "NextChargeRequiredEnergy",
                "type": "Optional[Nullable[energy-mWh]]"
            },
            "38": {
                "id": 38,
                "cluster_id": 153,
                "label": "NextChargeTargetSoC",
                "type": "Optional[Nullable[percent]]"
            },
            "39": {
                "id": 39,
                "cluster_id": 153,
                "label": "ApproximateEvEfficiency",
                "type": "Optional[Nullable[uint16]]"
            },
            "48": {
                "id": 48,
                "cluster_id": 153,
                "label": "StateOfCharge",
                "type": "Optional[Nullable[percent]]"
            },
            "49": {
                "id": 49,
                "cluster_id": 153,
                "label": "BatteryCapacity",
                "type": "Optional[Nullable[energy-mWh]]"
            },
            "50": {
                "id": 50,
                "cluster_id": 153,
                "label": "VehicleId",
                "type": "Optional[Nullable[string]]"
            },
            "64": {
                "id": 64,
                "cluster_id": 153,
                "label": "SessionId",
                "type": "Nullable[uint32]"
            },
            "65": {
                "id": 65,
                "cluster_id": 153,
                "label": "SessionDuration",
                "type": "Nullable[elapsed-s]"
            },
            "66": {
                "id": 66,
                "cluster_id": 153,
                "label": "SessionEnergyCharged",
                "type": "Nullable[energy-mWh]"
            },
            "67": {
                "id": 67,
                "cluster_id": 153,
                "label": "SessionEnergyDischarged",
                "type": "Optional[Nullable[energy-mWh]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 153,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 153,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 153,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 153,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 153,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 153,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "155": {
        "id": 155,
        "label": "EnergyPreference",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 155,
                "label": "EnergyBalances",
                "type": "List[BalanceStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 155,
                "label": "CurrentEnergyBalance",
                "type": "Optional[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 155,
                "label": "EnergyPriorities",
                "type": "List[EnergyPriorityEnum]"
            },
            "3": {
                "id": 3,
                "cluster_id": 155,
                "label": "LowPowerModeSensitivities",
                "type": "List[BalanceStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 155,
                "label": "CurrentLowPowerModeSensitivity",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 155,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 155,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 155,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 155,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 155,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 155,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "156": {
        "id": 156,
        "label": "PowerTopology",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 156,
                "label": "AvailableEndpoints",
                "type": "List[endpoint-no]"
            },
            "1": {
                "id": 1,
                "cluster_id": 156,
                "label": "ActiveEndpoints",
                "type": "List[endpoint-no]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 156,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 156,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 156,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 156,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 156,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 156,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "157": {
        "id": 157,
        "label": "EnergyEvseMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 157,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 157,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 157,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 157,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 157,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 157,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 157,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 157,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 157,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 157,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "158": {
        "id": 158,
        "label": "WaterHeaterMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 158,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 158,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 158,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 158,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 158,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 158,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 158,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 158,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 158,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 158,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "159": {
        "id": 159,
        "label": "DeviceEnergyManagementMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 159,
                "label": "SupportedModes",
                "type": "unknown"
            },
            "1": {
                "id": 1,
                "cluster_id": 159,
                "label": "CurrentMode",
                "type": "unknown"
            },
            "2": {
                "id": 2,
                "cluster_id": 159,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 159,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 159,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 159,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 159,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 159,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 159,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 159,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "257": {
        "id": 257,
        "label": "DoorLock",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 257,
                "label": "LockState",
                "type": "Nullable[LockStateEnum]"
            },
            "1": {
                "id": 1,
                "cluster_id": 257,
                "label": "LockType",
                "type": "LockTypeEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 257,
                "label": "ActuatorEnabled",
                "type": "bool"
            },
            "3": {
                "id": 3,
                "cluster_id": 257,
                "label": "DoorState",
                "type": "Optional[Nullable[DoorStateEnum]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 257,
                "label": "DoorOpenEvents",
                "type": "Optional[uint32]"
            },
            "5": {
                "id": 5,
                "cluster_id": 257,
                "label": "DoorClosedEvents",
                "type": "Optional[uint32]"
            },
            "6": {
                "id": 6,
                "cluster_id": 257,
                "label": "OpenPeriod",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 257,
                "label": "NumberOfTotalUsersSupported",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 257,
                "label": "NumberOfPinUsersSupported",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 257,
                "label": "NumberOfRfidUsersSupported",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 257,
                "label": "NumberOfWeekDaySchedulesSupportedPerUser",
                "type": "Optional[uint8]"
            },
            "21": {
                "id": 21,
                "cluster_id": 257,
                "label": "NumberOfYearDaySchedulesSupportedPerUser",
                "type": "Optional[uint8]"
            },
            "22": {
                "id": 22,
                "cluster_id": 257,
                "label": "NumberOfHolidaySchedulesSupported",
                "type": "Optional[uint8]"
            },
            "23": {
                "id": 23,
                "cluster_id": 257,
                "label": "MaxPinCodeLength",
                "type": "Optional[uint8]"
            },
            "24": {
                "id": 24,
                "cluster_id": 257,
                "label": "MinPinCodeLength",
                "type": "Optional[uint8]"
            },
            "25": {
                "id": 25,
                "cluster_id": 257,
                "label": "MaxRfidCodeLength",
                "type": "Optional[uint8]"
            },
            "26": {
                "id": 26,
                "cluster_id": 257,
                "label": "MinRfidCodeLength",
                "type": "Optional[uint8]"
            },
            "27": {
                "id": 27,
                "cluster_id": 257,
                "label": "CredentialRulesSupport",
                "type": "Optional[CredentialRulesBitmap]"
            },
            "28": {
                "id": 28,
                "cluster_id": 257,
                "label": "NumberOfCredentialsSupportedPerUser",
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
                "label": "LedSettings",
                "type": "Optional[LEDSettingEnum]"
            },
            "35": {
                "id": 35,
                "cluster_id": 257,
                "label": "AutoRelockTime",
                "type": "Optional[uint32]"
            },
            "36": {
                "id": 36,
                "cluster_id": 257,
                "label": "SoundVolume",
                "type": "Optional[SoundVolumeEnum]"
            },
            "37": {
                "id": 37,
                "cluster_id": 257,
                "label": "OperatingMode",
                "type": "OperatingModeEnum"
            },
            "38": {
                "id": 38,
                "cluster_id": 257,
                "label": "SupportedOperatingModes",
                "type": "OperatingModesBitmap"
            },
            "39": {
                "id": 39,
                "cluster_id": 257,
                "label": "DefaultConfigurationRegister",
                "type": "Optional[ConfigurationRegisterBitmap]"
            },
            "40": {
                "id": 40,
                "cluster_id": 257,
                "label": "EnableLocalProgramming",
                "type": "Optional[bool]"
            },
            "41": {
                "id": 41,
                "cluster_id": 257,
                "label": "EnableOneTouchLocking",
                "type": "Optional[bool]"
            },
            "42": {
                "id": 42,
                "cluster_id": 257,
                "label": "EnableInsideStatusLed",
                "type": "Optional[bool]"
            },
            "43": {
                "id": 43,
                "cluster_id": 257,
                "label": "EnablePrivacyModeButton",
                "type": "Optional[bool]"
            },
            "44": {
                "id": 44,
                "cluster_id": 257,
                "label": "LocalProgrammingFeatures",
                "type": "Optional[LocalProgrammingFeaturesBitmap]"
            },
            "48": {
                "id": 48,
                "cluster_id": 257,
                "label": "WrongCodeEntryLimit",
                "type": "Optional[uint8]"
            },
            "49": {
                "id": 49,
                "cluster_id": 257,
                "label": "UserCodeTemporaryDisableTime",
                "type": "Optional[uint8]"
            },
            "50": {
                "id": 50,
                "cluster_id": 257,
                "label": "SendPinOverTheAir",
                "type": "Optional[bool]"
            },
            "51": {
                "id": 51,
                "cluster_id": 257,
                "label": "RequirePinForRemoteOperation",
                "type": "Optional[bool]"
            },
            "52": {
                "id": 52,
                "cluster_id": 257,
                "label": "SecurityLevel",
                "type": "Optional[unknown]"
            },
            "53": {
                "id": 53,
                "cluster_id": 257,
                "label": "ExpiringUserTimeout",
                "type": "Optional[uint16]"
            },
            "128": {
                "id": 128,
                "cluster_id": 257,
                "label": "AliroReaderVerificationKey",
                "type": "Optional[Nullable[bytes]]"
            },
            "129": {
                "id": 129,
                "cluster_id": 257,
                "label": "AliroReaderGroupIdentifier",
                "type": "Optional[Nullable[bytes]]"
            },
            "130": {
                "id": 130,
                "cluster_id": 257,
                "label": "AliroReaderGroupSubIdentifier",
                "type": "Optional[bytes]"
            },
            "131": {
                "id": 131,
                "cluster_id": 257,
                "label": "AliroExpeditedTransactionSupportedProtocolVersions",
                "type": "List[octstr]"
            },
            "132": {
                "id": 132,
                "cluster_id": 257,
                "label": "AliroGroupResolvingKey",
                "type": "Optional[Nullable[bytes]]"
            },
            "133": {
                "id": 133,
                "cluster_id": 257,
                "label": "AliroSupportedBleuwbProtocolVersions",
                "type": "List[octstr]"
            },
            "134": {
                "id": 134,
                "cluster_id": 257,
                "label": "AliroBleAdvertisingVersion",
                "type": "Optional[uint8]"
            },
            "135": {
                "id": 135,
                "cluster_id": 257,
                "label": "NumberOfAliroCredentialIssuerKeysSupported",
                "type": "Optional[uint16]"
            },
            "136": {
                "id": 136,
                "cluster_id": 257,
                "label": "NumberOfAliroEndpointKeysSupported",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 257,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 257,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 257,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 257,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 257,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 257,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "258": {
        "id": 258,
        "label": "WindowCovering",
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
                "label": "PhysicalClosedLimitLift",
                "type": "Optional[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 258,
                "label": "PhysicalClosedLimitTilt",
                "type": "Optional[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 258,
                "label": "CurrentPositionLift",
                "type": "Optional[Nullable[uint16]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 258,
                "label": "CurrentPositionTilt",
                "type": "Optional[Nullable[uint16]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 258,
                "label": "NumberOfActuationsLift",
                "type": "Optional[uint16]"
            },
            "6": {
                "id": 6,
                "cluster_id": 258,
                "label": "NumberOfActuationsTilt",
                "type": "Optional[uint16]"
            },
            "7": {
                "id": 7,
                "cluster_id": 258,
                "label": "ConfigStatus",
                "type": "ConfigStatusBitmap"
            },
            "8": {
                "id": 8,
                "cluster_id": 258,
                "label": "CurrentPositionLiftPercentage",
                "type": "Optional[Nullable[percent]]"
            },
            "9": {
                "id": 9,
                "cluster_id": 258,
                "label": "CurrentPositionTiltPercentage",
                "type": "Optional[Nullable[percent]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 258,
                "label": "OperationalStatus",
                "type": "OperationalStatusBitmap"
            },
            "11": {
                "id": 11,
                "cluster_id": 258,
                "label": "TargetPositionLiftPercent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 258,
                "label": "TargetPositionTiltPercent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "13": {
                "id": 13,
                "cluster_id": 258,
                "label": "EndProductType",
                "type": "EndProductTypeEnum"
            },
            "14": {
                "id": 14,
                "cluster_id": 258,
                "label": "CurrentPositionLiftPercent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "15": {
                "id": 15,
                "cluster_id": 258,
                "label": "CurrentPositionTiltPercent100ths",
                "type": "Optional[Nullable[percent100ths]]"
            },
            "16": {
                "id": 16,
                "cluster_id": 258,
                "label": "InstalledOpenLimitLift",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 258,
                "label": "InstalledClosedLimitLift",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 258,
                "label": "InstalledOpenLimitTilt",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 258,
                "label": "InstalledClosedLimitTilt",
                "type": "Optional[uint16]"
            },
            "20": {
                "id": 20,
                "cluster_id": 258,
                "label": "VelocityLift",
                "type": "Optional[unknown]"
            },
            "21": {
                "id": 21,
                "cluster_id": 258,
                "label": "AccelerationTimeLift",
                "type": "Optional[unknown]"
            },
            "22": {
                "id": 22,
                "cluster_id": 258,
                "label": "DecelerationTimeLift",
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
                "label": "IntermediateSetpointsLift",
                "type": "Optional[unknown]"
            },
            "25": {
                "id": 25,
                "cluster_id": 258,
                "label": "IntermediateSetpointsTilt",
                "type": "Optional[unknown]"
            },
            "26": {
                "id": 26,
                "cluster_id": 258,
                "label": "SafetyStatus",
                "type": "Optional[SafetyStatusBitmap]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 258,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 258,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 258,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 258,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 258,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 258,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "336": {
        "id": 336,
        "label": "ServiceArea",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 336,
                "label": "SupportedAreas",
                "type": "List[AreaStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 336,
                "label": "SupportedMaps",
                "type": "List[MapStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 336,
                "label": "SelectedAreas",
                "type": "List[uint32]"
            },
            "3": {
                "id": 3,
                "cluster_id": 336,
                "label": "CurrentArea",
                "type": "Optional[Nullable[uint32]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 336,
                "label": "EstimatedEndTime",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 336,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 336,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 336,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 336,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 336,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "512": {
        "id": 512,
        "label": "PumpConfigurationAndControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 512,
                "label": "MaxPressure",
                "type": "Nullable[int16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 512,
                "label": "MaxSpeed",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 512,
                "label": "MaxFlow",
                "type": "Nullable[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 512,
                "label": "MinConstPressure",
                "type": "Optional[Nullable[int16]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 512,
                "label": "MaxConstPressure",
                "type": "Optional[Nullable[int16]]"
            },
            "5": {
                "id": 5,
                "cluster_id": 512,
                "label": "MinCompPressure",
                "type": "Optional[Nullable[int16]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 512,
                "label": "MaxCompPressure",
                "type": "Optional[Nullable[int16]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 512,
                "label": "MinConstSpeed",
                "type": "Optional[Nullable[uint16]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 512,
                "label": "MaxConstSpeed",
                "type": "Optional[Nullable[uint16]]"
            },
            "9": {
                "id": 9,
                "cluster_id": 512,
                "label": "MinConstFlow",
                "type": "Optional[Nullable[uint16]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 512,
                "label": "MaxConstFlow",
                "type": "Optional[Nullable[uint16]]"
            },
            "11": {
                "id": 11,
                "cluster_id": 512,
                "label": "MinConstTemp",
                "type": "Optional[Nullable[int16]]"
            },
            "12": {
                "id": 12,
                "cluster_id": 512,
                "label": "MaxConstTemp",
                "type": "Optional[Nullable[int16]]"
            },
            "16": {
                "id": 16,
                "cluster_id": 512,
                "label": "PumpStatus",
                "type": "Optional[PumpStatusBitmap]"
            },
            "17": {
                "id": 17,
                "cluster_id": 512,
                "label": "EffectiveOperationMode",
                "type": "OperationModeEnum"
            },
            "18": {
                "id": 18,
                "cluster_id": 512,
                "label": "EffectiveControlMode",
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
                "label": "LifetimeRunningHours",
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
                "label": "LifetimeEnergyConsumed",
                "type": "Optional[Nullable[uint32]]"
            },
            "32": {
                "id": 32,
                "cluster_id": 512,
                "label": "OperationMode",
                "type": "OperationModeEnum"
            },
            "33": {
                "id": 33,
                "cluster_id": 512,
                "label": "ControlMode",
                "type": "Optional[ControlModeEnum]"
            },
            "34": {
                "id": 34,
                "cluster_id": 512,
                "label": "AlarmMask",
                "type": "Optional[uint16]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 512,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 512,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 512,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 512,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 512,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 512,
                "label": "ClusterRevision",
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
                "label": "LocalTemperature",
                "type": "Nullable[temperature]"
            },
            "1": {
                "id": 1,
                "cluster_id": 513,
                "label": "OutdoorTemperature",
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
                "label": "AbsMinHeatSetpointLimit",
                "type": "Optional[temperature]"
            },
            "4": {
                "id": 4,
                "cluster_id": 513,
                "label": "AbsMaxHeatSetpointLimit",
                "type": "Optional[temperature]"
            },
            "5": {
                "id": 5,
                "cluster_id": 513,
                "label": "AbsMinCoolSetpointLimit",
                "type": "Optional[temperature]"
            },
            "6": {
                "id": 6,
                "cluster_id": 513,
                "label": "AbsMaxCoolSetpointLimit",
                "type": "Optional[temperature]"
            },
            "7": {
                "id": 7,
                "cluster_id": 513,
                "label": "PiCoolingDemand",
                "type": "Optional[uint8]"
            },
            "8": {
                "id": 8,
                "cluster_id": 513,
                "label": "PiHeatingDemand",
                "type": "Optional[uint8]"
            },
            "9": {
                "id": 9,
                "cluster_id": 513,
                "label": "HvacSystemTypeConfiguration",
                "type": "Optional[HVACSystemTypeBitmap]"
            },
            "16": {
                "id": 16,
                "cluster_id": 513,
                "label": "LocalTemperatureCalibration",
                "type": "Optional[SignedTemperature]"
            },
            "17": {
                "id": 17,
                "cluster_id": 513,
                "label": "OccupiedCoolingSetpoint",
                "type": "Optional[temperature]"
            },
            "18": {
                "id": 18,
                "cluster_id": 513,
                "label": "OccupiedHeatingSetpoint",
                "type": "Optional[temperature]"
            },
            "19": {
                "id": 19,
                "cluster_id": 513,
                "label": "UnoccupiedCoolingSetpoint",
                "type": "Optional[temperature]"
            },
            "20": {
                "id": 20,
                "cluster_id": 513,
                "label": "UnoccupiedHeatingSetpoint",
                "type": "Optional[temperature]"
            },
            "21": {
                "id": 21,
                "cluster_id": 513,
                "label": "MinHeatSetpointLimit",
                "type": "Optional[temperature]"
            },
            "22": {
                "id": 22,
                "cluster_id": 513,
                "label": "MaxHeatSetpointLimit",
                "type": "Optional[temperature]"
            },
            "23": {
                "id": 23,
                "cluster_id": 513,
                "label": "MinCoolSetpointLimit",
                "type": "Optional[temperature]"
            },
            "24": {
                "id": 24,
                "cluster_id": 513,
                "label": "MaxCoolSetpointLimit",
                "type": "Optional[temperature]"
            },
            "25": {
                "id": 25,
                "cluster_id": 513,
                "label": "MinSetpointDeadBand",
                "type": "Optional[SignedTemperature]"
            },
            "26": {
                "id": 26,
                "cluster_id": 513,
                "label": "RemoteSensing",
                "type": "Optional[RemoteSensingBitmap]"
            },
            "27": {
                "id": 27,
                "cluster_id": 513,
                "label": "ControlSequenceOfOperation",
                "type": "ControlSequenceOfOperationEnum"
            },
            "28": {
                "id": 28,
                "cluster_id": 513,
                "label": "SystemMode",
                "type": "SystemModeEnum"
            },
            "30": {
                "id": 30,
                "cluster_id": 513,
                "label": "ThermostatRunningMode",
                "type": "Optional[ThermostatRunningModeEnum]"
            },
            "32": {
                "id": 32,
                "cluster_id": 513,
                "label": "StartOfWeek",
                "type": "Optional[StartOfWeekEnum]"
            },
            "33": {
                "id": 33,
                "cluster_id": 513,
                "label": "NumberOfWeeklyTransitions",
                "type": "Optional[uint8]"
            },
            "34": {
                "id": 34,
                "cluster_id": 513,
                "label": "NumberOfDailyTransitions",
                "type": "Optional[uint8]"
            },
            "35": {
                "id": 35,
                "cluster_id": 513,
                "label": "TemperatureSetpointHold",
                "type": "Optional[TemperatureSetpointHoldEnum]"
            },
            "36": {
                "id": 36,
                "cluster_id": 513,
                "label": "TemperatureSetpointHoldDuration",
                "type": "Optional[Nullable[uint16]]"
            },
            "37": {
                "id": 37,
                "cluster_id": 513,
                "label": "ThermostatProgrammingOperationMode",
                "type": "Optional[ProgrammingOperationModeBitmap]"
            },
            "41": {
                "id": 41,
                "cluster_id": 513,
                "label": "ThermostatRunningState",
                "type": "Optional[RelayStateBitmap]"
            },
            "48": {
                "id": 48,
                "cluster_id": 513,
                "label": "SetpointChangeSource",
                "type": "Optional[SetpointChangeSourceEnum]"
            },
            "49": {
                "id": 49,
                "cluster_id": 513,
                "label": "SetpointChangeAmount",
                "type": "Optional[Nullable[TemperatureDifference]]"
            },
            "50": {
                "id": 50,
                "cluster_id": 513,
                "label": "SetpointChangeSourceTimestamp",
                "type": "Optional[epoch-s]"
            },
            "52": {
                "id": 52,
                "cluster_id": 513,
                "label": "OccupiedSetback",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "53": {
                "id": 53,
                "cluster_id": 513,
                "label": "OccupiedSetbackMin",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "54": {
                "id": 54,
                "cluster_id": 513,
                "label": "OccupiedSetbackMax",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "55": {
                "id": 55,
                "cluster_id": 513,
                "label": "UnoccupiedSetback",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "56": {
                "id": 56,
                "cluster_id": 513,
                "label": "UnoccupiedSetbackMin",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "57": {
                "id": 57,
                "cluster_id": 513,
                "label": "UnoccupiedSetbackMax",
                "type": "Optional[Nullable[UnsignedTemperature]]"
            },
            "58": {
                "id": 58,
                "cluster_id": 513,
                "label": "EmergencyHeatDelta",
                "type": "Optional[UnsignedTemperature]"
            },
            "64": {
                "id": 64,
                "cluster_id": 513,
                "label": "AcType",
                "type": "Optional[ACTypeEnum]"
            },
            "65": {
                "id": 65,
                "cluster_id": 513,
                "label": "AcCapacity",
                "type": "Optional[uint16]"
            },
            "66": {
                "id": 66,
                "cluster_id": 513,
                "label": "AcRefrigerantType",
                "type": "Optional[ACRefrigerantTypeEnum]"
            },
            "67": {
                "id": 67,
                "cluster_id": 513,
                "label": "AcCompressorType",
                "type": "Optional[ACCompressorTypeEnum]"
            },
            "68": {
                "id": 68,
                "cluster_id": 513,
                "label": "AcErrorCode",
                "type": "Optional[ACErrorCodeBitmap]"
            },
            "69": {
                "id": 69,
                "cluster_id": 513,
                "label": "AcLouverPosition",
                "type": "Optional[ACLouverPositionEnum]"
            },
            "70": {
                "id": 70,
                "cluster_id": 513,
                "label": "AcCoilTemperature",
                "type": "Optional[Nullable[temperature]]"
            },
            "71": {
                "id": 71,
                "cluster_id": 513,
                "label": "AcCapacityFormat",
                "type": "Optional[ACCapacityFormatEnum]"
            },
            "72": {
                "id": 72,
                "cluster_id": 513,
                "label": "PresetTypes",
                "type": "List[PresetTypeStruct]"
            },
            "73": {
                "id": 73,
                "cluster_id": 513,
                "label": "ScheduleTypes",
                "type": "List[ScheduleTypeStruct]"
            },
            "74": {
                "id": 74,
                "cluster_id": 513,
                "label": "NumberOfPresets",
                "type": "Optional[uint8]"
            },
            "75": {
                "id": 75,
                "cluster_id": 513,
                "label": "NumberOfSchedules",
                "type": "Optional[uint8]"
            },
            "76": {
                "id": 76,
                "cluster_id": 513,
                "label": "NumberOfScheduleTransitions",
                "type": "Optional[uint8]"
            },
            "77": {
                "id": 77,
                "cluster_id": 513,
                "label": "NumberOfScheduleTransitionPerDay",
                "type": "Optional[Nullable[uint8]]"
            },
            "78": {
                "id": 78,
                "cluster_id": 513,
                "label": "ActivePresetHandle",
                "type": "Optional[Nullable[bytes]]"
            },
            "79": {
                "id": 79,
                "cluster_id": 513,
                "label": "ActiveScheduleHandle",
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
                "label": "SetpointHoldExpiryTimestamp",
                "type": "Optional[Nullable[epoch-s]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 513,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 513,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 513,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 513,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 513,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 513,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "514": {
        "id": 514,
        "label": "FanControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 514,
                "label": "FanMode",
                "type": "FanModeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 514,
                "label": "FanModeSequence",
                "type": "FanModeSequenceEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 514,
                "label": "PercentSetting",
                "type": "Nullable[percent]"
            },
            "3": {
                "id": 3,
                "cluster_id": 514,
                "label": "PercentCurrent",
                "type": "percent"
            },
            "4": {
                "id": 4,
                "cluster_id": 514,
                "label": "SpeedMax",
                "type": "Optional[uint8]"
            },
            "5": {
                "id": 5,
                "cluster_id": 514,
                "label": "SpeedSetting",
                "type": "Optional[Nullable[uint8]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 514,
                "label": "SpeedCurrent",
                "type": "Optional[uint8]"
            },
            "7": {
                "id": 7,
                "cluster_id": 514,
                "label": "RockSupport",
                "type": "Optional[RockBitmap]"
            },
            "8": {
                "id": 8,
                "cluster_id": 514,
                "label": "RockSetting",
                "type": "Optional[RockBitmap]"
            },
            "9": {
                "id": 9,
                "cluster_id": 514,
                "label": "WindSupport",
                "type": "Optional[WindBitmap]"
            },
            "10": {
                "id": 10,
                "cluster_id": 514,
                "label": "WindSetting",
                "type": "Optional[WindBitmap]"
            },
            "11": {
                "id": 11,
                "cluster_id": 514,
                "label": "AirflowDirection",
                "type": "Optional[AirflowDirectionEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 514,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 514,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 514,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 514,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 514,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 514,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "516": {
        "id": 516,
        "label": "ThermostatUserInterfaceConfiguration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 516,
                "label": "TemperatureDisplayMode",
                "type": "TemperatureDisplayModeEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 516,
                "label": "KeypadLockout",
                "type": "KeypadLockoutEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 516,
                "label": "ScheduleProgrammingVisibility",
                "type": "Optional[ScheduleProgrammingVisibilityEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 516,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 516,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 516,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 516,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 516,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 516,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "768": {
        "id": 768,
        "label": "ColorControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 768,
                "label": "CurrentHue",
                "type": "Optional[uint8]"
            },
            "1": {
                "id": 1,
                "cluster_id": 768,
                "label": "CurrentSaturation",
                "type": "Optional[uint8]"
            },
            "2": {
                "id": 2,
                "cluster_id": 768,
                "label": "RemainingTime",
                "type": "Optional[uint16]"
            },
            "3": {
                "id": 3,
                "cluster_id": 768,
                "label": "CurrentX",
                "type": "Optional[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 768,
                "label": "CurrentY",
                "type": "Optional[uint16]"
            },
            "5": {
                "id": 5,
                "cluster_id": 768,
                "label": "DriftCompensation",
                "type": "Optional[DriftCompensationEnum]"
            },
            "6": {
                "id": 6,
                "cluster_id": 768,
                "label": "CompensationText",
                "type": "Optional[string]"
            },
            "7": {
                "id": 7,
                "cluster_id": 768,
                "label": "ColorTemperatureMireds",
                "type": "Optional[uint16]"
            },
            "8": {
                "id": 8,
                "cluster_id": 768,
                "label": "ColorMode",
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
                "label": "NumberOfPrimaries",
                "type": "Nullable[uint8]"
            },
            "17": {
                "id": 17,
                "cluster_id": 768,
                "label": "Primary1X",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 768,
                "label": "Primary1Y",
                "type": "Optional[uint16]"
            },
            "19": {
                "id": 19,
                "cluster_id": 768,
                "label": "Primary1Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "21": {
                "id": 21,
                "cluster_id": 768,
                "label": "Primary2X",
                "type": "Optional[uint16]"
            },
            "22": {
                "id": 22,
                "cluster_id": 768,
                "label": "Primary2Y",
                "type": "Optional[uint16]"
            },
            "23": {
                "id": 23,
                "cluster_id": 768,
                "label": "Primary2Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "25": {
                "id": 25,
                "cluster_id": 768,
                "label": "Primary3X",
                "type": "Optional[uint16]"
            },
            "26": {
                "id": 26,
                "cluster_id": 768,
                "label": "Primary3Y",
                "type": "Optional[uint16]"
            },
            "27": {
                "id": 27,
                "cluster_id": 768,
                "label": "Primary3Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "32": {
                "id": 32,
                "cluster_id": 768,
                "label": "Primary4X",
                "type": "Optional[uint16]"
            },
            "33": {
                "id": 33,
                "cluster_id": 768,
                "label": "Primary4Y",
                "type": "Optional[uint16]"
            },
            "34": {
                "id": 34,
                "cluster_id": 768,
                "label": "Primary4Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "36": {
                "id": 36,
                "cluster_id": 768,
                "label": "Primary5X",
                "type": "Optional[uint16]"
            },
            "37": {
                "id": 37,
                "cluster_id": 768,
                "label": "Primary5Y",
                "type": "Optional[uint16]"
            },
            "38": {
                "id": 38,
                "cluster_id": 768,
                "label": "Primary5Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "40": {
                "id": 40,
                "cluster_id": 768,
                "label": "Primary6X",
                "type": "Optional[uint16]"
            },
            "41": {
                "id": 41,
                "cluster_id": 768,
                "label": "Primary6Y",
                "type": "Optional[uint16]"
            },
            "42": {
                "id": 42,
                "cluster_id": 768,
                "label": "Primary6Intensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "48": {
                "id": 48,
                "cluster_id": 768,
                "label": "WhitePointX",
                "type": "Optional[uint16]"
            },
            "49": {
                "id": 49,
                "cluster_id": 768,
                "label": "WhitePointY",
                "type": "Optional[uint16]"
            },
            "50": {
                "id": 50,
                "cluster_id": 768,
                "label": "ColorPointRx",
                "type": "Optional[uint16]"
            },
            "51": {
                "id": 51,
                "cluster_id": 768,
                "label": "ColorPointRy",
                "type": "Optional[uint16]"
            },
            "52": {
                "id": 52,
                "cluster_id": 768,
                "label": "ColorPointRIntensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "54": {
                "id": 54,
                "cluster_id": 768,
                "label": "ColorPointGx",
                "type": "Optional[uint16]"
            },
            "55": {
                "id": 55,
                "cluster_id": 768,
                "label": "ColorPointGy",
                "type": "Optional[uint16]"
            },
            "56": {
                "id": 56,
                "cluster_id": 768,
                "label": "ColorPointGIntensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "58": {
                "id": 58,
                "cluster_id": 768,
                "label": "ColorPointBx",
                "type": "Optional[uint16]"
            },
            "59": {
                "id": 59,
                "cluster_id": 768,
                "label": "ColorPointBy",
                "type": "Optional[uint16]"
            },
            "60": {
                "id": 60,
                "cluster_id": 768,
                "label": "ColorPointBIntensity",
                "type": "Optional[Nullable[uint8]]"
            },
            "16384": {
                "id": 16384,
                "cluster_id": 768,
                "label": "EnhancedCurrentHue",
                "type": "Optional[uint16]"
            },
            "16385": {
                "id": 16385,
                "cluster_id": 768,
                "label": "EnhancedColorMode",
                "type": "EnhancedColorModeEnum"
            },
            "16386": {
                "id": 16386,
                "cluster_id": 768,
                "label": "ColorLoopActive",
                "type": "Optional[enum8]"
            },
            "16387": {
                "id": 16387,
                "cluster_id": 768,
                "label": "ColorLoopDirection",
                "type": "Optional[ColorLoopDirectionEnum]"
            },
            "16388": {
                "id": 16388,
                "cluster_id": 768,
                "label": "ColorLoopTime",
                "type": "Optional[uint16]"
            },
            "16389": {
                "id": 16389,
                "cluster_id": 768,
                "label": "ColorLoopStartEnhancedHue",
                "type": "Optional[uint16]"
            },
            "16390": {
                "id": 16390,
                "cluster_id": 768,
                "label": "ColorLoopStoredEnhancedHue",
                "type": "Optional[uint16]"
            },
            "16394": {
                "id": 16394,
                "cluster_id": 768,
                "label": "ColorCapabilities",
                "type": "map16"
            },
            "16395": {
                "id": 16395,
                "cluster_id": 768,
                "label": "ColorTempPhysicalMinMireds",
                "type": "Optional[uint16]"
            },
            "16396": {
                "id": 16396,
                "cluster_id": 768,
                "label": "ColorTempPhysicalMaxMireds",
                "type": "Optional[uint16]"
            },
            "16397": {
                "id": 16397,
                "cluster_id": 768,
                "label": "CoupleColorTempToLevelMinMireds",
                "type": "Optional[uint16]"
            },
            "16400": {
                "id": 16400,
                "cluster_id": 768,
                "label": "StartUpColorTemperatureMireds",
                "type": "Optional[Nullable[uint16]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 768,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 768,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 768,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 768,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 768,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 768,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1024": {
        "id": 1024,
        "label": "IlluminanceMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1024,
                "label": "MeasuredValue",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1024,
                "label": "MinMeasuredValue",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1024,
                "label": "MaxMeasuredValue",
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
                "label": "LightSensorType",
                "type": "Optional[Nullable[uint8]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1024,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1024,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1024,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1024,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1024,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1024,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1026": {
        "id": 1026,
        "label": "TemperatureMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1026,
                "label": "MeasuredValue",
                "type": "Nullable[temperature]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1026,
                "label": "MinMeasuredValue",
                "type": "Nullable[temperature]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1026,
                "label": "MaxMeasuredValue",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1026,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1026,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1026,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1026,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1026,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1027": {
        "id": 1027,
        "label": "PressureMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1027,
                "label": "MeasuredValue",
                "type": "Nullable[int16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1027,
                "label": "MinMeasuredValue",
                "type": "Nullable[int16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1027,
                "label": "MaxMeasuredValue",
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
                "label": "ScaledValue",
                "type": "Optional[Nullable[int16]]"
            },
            "17": {
                "id": 17,
                "cluster_id": 1027,
                "label": "MinScaledValue",
                "type": "Optional[Nullable[int16]]"
            },
            "18": {
                "id": 18,
                "cluster_id": 1027,
                "label": "MaxScaledValue",
                "type": "Optional[Nullable[int16]]"
            },
            "19": {
                "id": 19,
                "cluster_id": 1027,
                "label": "ScaledTolerance",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1027,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1027,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1027,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1027,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1027,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1028": {
        "id": 1028,
        "label": "FlowMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1028,
                "label": "MeasuredValue",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1028,
                "label": "MinMeasuredValue",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1028,
                "label": "MaxMeasuredValue",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1028,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1028,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1028,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1028,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1028,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1029": {
        "id": 1029,
        "label": "RelativeHumidityMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1029,
                "label": "MeasuredValue",
                "type": "Nullable[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1029,
                "label": "MinMeasuredValue",
                "type": "Nullable[uint16]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1029,
                "label": "MaxMeasuredValue",
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
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1029,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1029,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1029,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1029,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1029,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1030": {
        "id": 1030,
        "label": "OccupancySensing",
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
                "label": "OccupancySensorType",
                "type": "OccupancySensorTypeEnum"
            },
            "2": {
                "id": 2,
                "cluster_id": 1030,
                "label": "OccupancySensorTypeBitmap",
                "type": "OccupancySensorTypeBitmap"
            },
            "3": {
                "id": 3,
                "cluster_id": 1030,
                "label": "HoldTime",
                "type": "Optional[uint16]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1030,
                "label": "HoldTimeLimits",
                "type": "Optional[HoldTimeLimitsStruct]"
            },
            "16": {
                "id": 16,
                "cluster_id": 1030,
                "label": "PirOccupiedToUnoccupiedDelay",
                "type": "Optional[uint16]"
            },
            "17": {
                "id": 17,
                "cluster_id": 1030,
                "label": "PirUnoccupiedToOccupiedDelay",
                "type": "Optional[uint16]"
            },
            "18": {
                "id": 18,
                "cluster_id": 1030,
                "label": "PirUnoccupiedToOccupiedThreshold",
                "type": "Optional[uint8]"
            },
            "32": {
                "id": 32,
                "cluster_id": 1030,
                "label": "UltrasonicOccupiedToUnoccupiedDelay",
                "type": "Optional[uint16]"
            },
            "33": {
                "id": 33,
                "cluster_id": 1030,
                "label": "UltrasonicUnoccupiedToOccupiedDelay",
                "type": "Optional[uint16]"
            },
            "34": {
                "id": 34,
                "cluster_id": 1030,
                "label": "UltrasonicUnoccupiedToOccupiedThreshold",
                "type": "Optional[uint8]"
            },
            "48": {
                "id": 48,
                "cluster_id": 1030,
                "label": "PhysicalContactOccupiedToUnoccupiedDelay",
                "type": "Optional[uint16]"
            },
            "49": {
                "id": 49,
                "cluster_id": 1030,
                "label": "PhysicalContactUnoccupiedToOccupiedDelay",
                "type": "Optional[uint16]"
            },
            "50": {
                "id": 50,
                "cluster_id": 1030,
                "label": "PhysicalContactUnoccupiedToOccupiedThreshold",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1030,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1030,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1030,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1030,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1030,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1030,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1036": {
        "id": 1036,
        "label": "CarbonMonoxideConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1036,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1036,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1036,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1036,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1036,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1036,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1036,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1036,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1036,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1036,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1036,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1036,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1036,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1036,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1036,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1037": {
        "id": 1037,
        "label": "CarbonDioxideConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1037,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1037,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1037,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1037,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1037,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1037,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1037,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1037,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1037,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1037,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1037,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1037,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1037,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1037,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1037,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1043": {
        "id": 1043,
        "label": "NitrogenDioxideConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1043,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1043,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1043,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1043,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1043,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1043,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1043,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1043,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1043,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1043,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1043,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1043,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1043,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1043,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1043,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1045": {
        "id": 1045,
        "label": "OzoneConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1045,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1045,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1045,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1045,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1045,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1045,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1045,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1045,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1045,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1045,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1045,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1045,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1045,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1045,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1045,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1066": {
        "id": 1066,
        "label": "Pm25ConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1066,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1066,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1066,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1066,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1066,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1066,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1066,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1066,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1066,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1066,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1066,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1066,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1066,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1066,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1066,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1067": {
        "id": 1067,
        "label": "FormaldehydeConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1067,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1067,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1067,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1067,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1067,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1067,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1067,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1067,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1067,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1067,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1067,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1067,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1067,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1067,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1067,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1068": {
        "id": 1068,
        "label": "Pm1ConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1068,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1068,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1068,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1068,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1068,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1068,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1068,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1068,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1068,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1068,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1068,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1068,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1068,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1068,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1068,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1069": {
        "id": 1069,
        "label": "Pm10ConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1069,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1069,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1069,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1069,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1069,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1069,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1069,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1069,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1069,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1069,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1069,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1069,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1069,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1069,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1069,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1070": {
        "id": 1070,
        "label": "TotalVolatileOrganicCompoundsConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1070,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1070,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1070,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1070,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1070,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1070,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1070,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1070,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1070,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1070,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1070,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1070,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1070,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1070,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1070,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1071": {
        "id": 1071,
        "label": "RadonConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1071,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1071,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1071,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1071,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1071,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1071,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1071,
                "label": "AverageMeasuredValueWindow",
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
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1071,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum"
            },
            "10": {
                "id": 10,
                "cluster_id": 1071,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1071,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1071,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1071,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1071,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1071,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1071,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1105": {
        "id": 1105,
        "label": "WiFiNetworkManagement",
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
                "label": "PassphraseSurrogate",
                "type": "Nullable[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1105,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1105,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1105,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1105,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1105,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1105,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1106": {
        "id": 1106,
        "label": "ThreadBorderRouterManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1106,
                "label": "BorderRouterName",
                "type": "string"
            },
            "1": {
                "id": 1,
                "cluster_id": 1106,
                "label": "BorderAgentId",
                "type": "bytes"
            },
            "2": {
                "id": 2,
                "cluster_id": 1106,
                "label": "ThreadVersion",
                "type": "uint16"
            },
            "3": {
                "id": 3,
                "cluster_id": 1106,
                "label": "InterfaceEnabled",
                "type": "bool"
            },
            "4": {
                "id": 4,
                "cluster_id": 1106,
                "label": "ActiveDatasetTimestamp",
                "type": "Nullable[uint64]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1106,
                "label": "PendingDatasetTimestamp",
                "type": "Nullable[uint64]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1106,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1106,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1106,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1106,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1106,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1106,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1107": {
        "id": 1107,
        "label": "ThreadNetworkDirectory",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1107,
                "label": "PreferredExtendedPanId",
                "type": "Nullable[bytes]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1107,
                "label": "ThreadNetworks",
                "type": "List[ThreadNetworkStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1107,
                "label": "ThreadNetworkTableSize",
                "type": "uint8"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1107,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1107,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1107,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1107,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1107,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1107,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1283": {
        "id": 1283,
        "label": "WakeOnLan",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1283,
                "label": "MacAddress",
                "type": "Optional[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1283,
                "label": "LinkLocalAddress",
                "type": "Optional[bytes]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1283,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1283,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1283,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1283,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1283,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1283,
                "label": "ClusterRevision",
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
                "label": "ChannelList",
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
                "label": "CurrentChannel",
                "type": "Optional[Nullable[ChannelInfoStruct]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1284,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1284,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1284,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1284,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1284,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1284,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1285": {
        "id": 1285,
        "label": "TargetNavigator",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1285,
                "label": "TargetList",
                "type": "List[TargetInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1285,
                "label": "CurrentTarget",
                "type": "Optional[uint8]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1285,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1285,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1285,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1285,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1285,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1285,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1286": {
        "id": 1286,
        "label": "MediaPlayback",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1286,
                "label": "CurrentState",
                "type": "PlaybackStateEnum"
            },
            "1": {
                "id": 1,
                "cluster_id": 1286,
                "label": "StartTime",
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
                "label": "SampledPosition",
                "type": "Optional[Nullable[PlaybackPositionStruct]]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1286,
                "label": "PlaybackSpeed",
                "type": "Optional[single]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1286,
                "label": "SeekRangeEnd",
                "type": "Optional[Nullable[uint64]]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1286,
                "label": "SeekRangeStart",
                "type": "Optional[Nullable[uint64]]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1286,
                "label": "ActiveAudioTrack",
                "type": "Optional[Nullable[TrackStruct]]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1286,
                "label": "AvailableAudioTracks",
                "type": "List[TrackStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1286,
                "label": "ActiveTextTrack",
                "type": "Optional[Nullable[TrackStruct]]"
            },
            "10": {
                "id": 10,
                "cluster_id": 1286,
                "label": "AvailableTextTracks",
                "type": "List[TrackStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1286,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1286,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1286,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1286,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1286,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1286,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1287": {
        "id": 1287,
        "label": "MediaInput",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1287,
                "label": "InputList",
                "type": "List[InputInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1287,
                "label": "CurrentInput",
                "type": "uint8"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1287,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1287,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1287,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1287,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1287,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1287,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1288": {
        "id": 1288,
        "label": "LowPower",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1288,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1288,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1288,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1288,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1288,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1288,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1289": {
        "id": 1289,
        "label": "KeypadInput",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1289,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1289,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1289,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1289,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1289,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1289,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1290": {
        "id": 1290,
        "label": "ContentLauncher",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1290,
                "label": "AcceptHeader",
                "type": "List[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1290,
                "label": "SupportedStreamingProtocols",
                "type": "Optional[SupportedProtocolsBitmap]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1290,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1290,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1290,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1290,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1290,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1290,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1291": {
        "id": 1291,
        "label": "AudioOutput",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1291,
                "label": "OutputList",
                "type": "List[OutputInfoStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1291,
                "label": "CurrentOutput",
                "type": "uint8"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1291,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1291,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1291,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1291,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1291,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1291,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1292": {
        "id": 1292,
        "label": "ApplicationLauncher",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1292,
                "label": "CatalogList",
                "type": "List[uint16]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1292,
                "label": "CurrentApp",
                "type": "Optional[Nullable[ApplicationEPStruct]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1292,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1292,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1292,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1292,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1292,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1292,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1293": {
        "id": 1293,
        "label": "ApplicationBasic",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1293,
                "label": "VendorName",
                "type": "Optional[string]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1293,
                "label": "VendorId",
                "type": "Optional[vendor-id]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1293,
                "label": "ApplicationName",
                "type": "string"
            },
            "3": {
                "id": 3,
                "cluster_id": 1293,
                "label": "ProductId",
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
                "label": "ApplicationVersion",
                "type": "string"
            },
            "7": {
                "id": 7,
                "cluster_id": 1293,
                "label": "AllowedVendorList",
                "type": "List[vendor-id]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1293,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1293,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1293,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1293,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1293,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1293,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1294": {
        "id": 1294,
        "label": "AccountLogin",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1294,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1294,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1294,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1294,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1294,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1294,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1295": {
        "id": 1295,
        "label": "ContentControl",
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
                "label": "OnDemandRatings",
                "type": "List[RatingNameStruct]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1295,
                "label": "OnDemandRatingThreshold",
                "type": "Optional[string]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1295,
                "label": "ScheduledContentRatings",
                "type": "List[RatingNameStruct]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1295,
                "label": "ScheduledContentRatingThreshold",
                "type": "Optional[string]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1295,
                "label": "ScreenDailyTime",
                "type": "Optional[elapsed-s]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1295,
                "label": "RemainingScreenTime",
                "type": "Optional[elapsed-s]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1295,
                "label": "BlockUnrated",
                "type": "Optional[bool]"
            },
            "8": {
                "id": 8,
                "cluster_id": 1295,
                "label": "BlockChannelList",
                "type": "List[BlockChannelStruct]"
            },
            "9": {
                "id": 9,
                "cluster_id": 1295,
                "label": "BlockApplicationList",
                "type": "List[AppInfoStruct]"
            },
            "10": {
                "id": 10,
                "cluster_id": 1295,
                "label": "BlockContentTimeWindow",
                "type": "List[TimeWindowStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1295,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1295,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1295,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1295,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1295,
                "label": "FeatureMap",
                "type": "FeatureMap"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1295,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1296": {
        "id": 1296,
        "label": "ContentAppObserver",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1296,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1296,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1296,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1296,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1296,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1296,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1872": {
        "id": 1872,
        "label": "EcosystemInformation",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1872,
                "label": "DeviceDirectory",
                "type": "List[EcosystemDeviceStruct]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1872,
                "label": "LocationDirectory",
                "type": "List[EcosystemLocationStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1872,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1872,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1872,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1872,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1872,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1872,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1873": {
        "id": 1873,
        "label": "CommissionerControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1873,
                "label": "SupportedDeviceCategories",
                "type": "SupportedDeviceCategoryBitmap"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1873,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1873,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1873,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1873,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1873,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1873,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1874": {
        "id": 1874,
        "label": "JointFabricDatastore",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1874,
                "label": "AnchorRootCa",
                "type": "Optional[bytes]"
            },
            "1": {
                "id": 1,
                "cluster_id": 1874,
                "label": "AnchorNodeId",
                "type": "Optional[node-id]"
            },
            "2": {
                "id": 2,
                "cluster_id": 1874,
                "label": "AnchorVendorId",
                "type": "Optional[vendor-id]"
            },
            "3": {
                "id": 3,
                "cluster_id": 1874,
                "label": "FriendlyName",
                "type": "Optional[string]"
            },
            "4": {
                "id": 4,
                "cluster_id": 1874,
                "label": "GroupKeySetList",
                "type": "List[DatastoreGroupKeySetStruct]"
            },
            "5": {
                "id": 5,
                "cluster_id": 1874,
                "label": "GroupList",
                "type": "List[DatastoreGroupInformationEntryStruct]"
            },
            "6": {
                "id": 6,
                "cluster_id": 1874,
                "label": "NodeList",
                "type": "List[DatastoreNodeInformationEntryStruct]"
            },
            "7": {
                "id": 7,
                "cluster_id": 1874,
                "label": "AdminList",
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
                "label": "EndpointGroupIdList",
                "type": "List[DatastoreEndpointGroupIDEntryStruct]"
            },
            "10": {
                "id": 10,
                "cluster_id": 1874,
                "label": "EndpointBindingList",
                "type": "List[DatastoreEndpointBindingEntryStruct]"
            },
            "11": {
                "id": 11,
                "cluster_id": 1874,
                "label": "NodeKeySetList",
                "type": "List[DatastoreNodeKeySetEntryStruct]"
            },
            "12": {
                "id": 12,
                "cluster_id": 1874,
                "label": "NodeAclList",
                "type": "List[DatastoreACLEntryStruct]"
            },
            "13": {
                "id": 13,
                "cluster_id": 1874,
                "label": "NodeEndpointList",
                "type": "List[DatastoreEndpointEntryStruct]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1874,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1874,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1874,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1874,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1874,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1874,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "1875": {
        "id": 1875,
        "label": "JointFabricAdministrator",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1875,
                "label": "AdministratorFabricIndex",
                "type": "Optional[Nullable[fabric-idx]]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1875,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1875,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1875,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1875,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1875,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1875,
                "label": "ClusterRevision",
                "type": "ClusterRevision"
            }
        }
    },
    "2820": {
        "id": 2820,
        "label": "DraftElectricalMeasurementCluster",
        "attributes": {
            "1285": {
                "id": 1285,
                "cluster_id": 2820,
                "label": "RmsVoltage",
                "type": "Optional[unknown]"
            },
            "1288": {
                "id": 1288,
                "cluster_id": 2820,
                "label": "RmsCurrent",
                "type": "Optional[unknown]"
            },
            "1291": {
                "id": 1291,
                "cluster_id": 2820,
                "label": "ActivePower",
                "type": "Optional[unknown]"
            },
            "1536": {
                "id": 1536,
                "cluster_id": 2820,
                "label": "AcVoltageMultiplier",
                "type": "Optional[unknown]"
            },
            "1537": {
                "id": 1537,
                "cluster_id": 2820,
                "label": "AcVoltageDivisor",
                "type": "Optional[unknown]"
            },
            "1538": {
                "id": 1538,
                "cluster_id": 2820,
                "label": "AcCurrentMultiplier",
                "type": "Optional[unknown]"
            },
            "1539": {
                "id": 1539,
                "cluster_id": 2820,
                "label": "AcCurrentDivisor",
                "type": "Optional[unknown]"
            },
            "1540": {
                "id": 1540,
                "cluster_id": 2820,
                "label": "AcPowerMultiplier",
                "type": "Optional[unknown]"
            },
            "1541": {
                "id": 1541,
                "cluster_id": 2820,
                "label": "AcPowerDivisor",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 2820,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 2820,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 2820,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 2820,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 2820,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 2820,
                "label": "ClusterRevision",
                "type": "uint16"
            }
        }
    },
    "302775297": {
        "id": 302775297,
        "label": "HeimanCluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 302775297,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 302775297,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 302775297,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 302775297,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 302775297,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 302775297,
                "label": "ClusterRevision",
                "type": "uint16"
            },
            "302710800": {
                "id": 302710800,
                "cluster_id": 302775297,
                "label": "TamperAlarm",
                "type": "Optional[unknown]"
            },
            "302710801": {
                "id": 302710801,
                "cluster_id": 302775297,
                "label": "PreheatingState",
                "type": "Optional[unknown]"
            },
            "302710802": {
                "id": 302710802,
                "cluster_id": 302775297,
                "label": "NoDisturbingState",
                "type": "Optional[unknown]"
            },
            "302710803": {
                "id": 302710803,
                "cluster_id": 302775297,
                "label": "SensorType",
                "type": "Optional[unknown]"
            },
            "302710804": {
                "id": 302710804,
                "cluster_id": 302775297,
                "label": "SirenActive",
                "type": "Optional[unknown]"
            },
            "302710805": {
                "id": 302710805,
                "cluster_id": 302775297,
                "label": "AlarmMute",
                "type": "Optional[unknown]"
            },
            "302710806": {
                "id": 302710806,
                "cluster_id": 302775297,
                "label": "LowPowerMode",
                "type": "Optional[unknown]"
            }
        }
    },
    "305134641": {
        "id": 305134641,
        "label": "InovelliCluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 305134641,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 305134641,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 305134641,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 305134641,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 305134641,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 305134641,
                "label": "ClusterRevision",
                "type": "uint16"
            },
            "305070177": {
                "id": 305070177,
                "cluster_id": 305134641,
                "label": "LedIndicatorIntensityOn",
                "type": "Optional[unknown]"
            },
            "305070178": {
                "id": 305070178,
                "cluster_id": 305134641,
                "label": "LedIndicatorIntensityOff",
                "type": "Optional[unknown]"
            },
            "305070342": {
                "id": 305070342,
                "cluster_id": 305134641,
                "label": "ClearNotificationWithConfigDoubleTap",
                "type": "Optional[bool]"
            }
        }
    },
    "308149265": {
        "id": 308149265,
        "label": "NeoCluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 308149265,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 308149265,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 308149265,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 308149265,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 308149265,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 308149265,
                "label": "ClusterRevision",
                "type": "uint16"
            },
            "308084769": {
                "id": 308084769,
                "cluster_id": 308149265,
                "label": "WattAccumulated",
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
        "label": "EveCluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 319486977,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 319486977,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 319486977,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 319486977,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 319486977,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 319486977,
                "label": "ClusterRevision",
                "type": "uint16"
            },
            "319422470": {
                "id": 319422470,
                "cluster_id": 319486977,
                "label": "TimesOpened",
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
                "label": "WattAccumulated",
                "type": "Optional[unknown]"
            },
            "319422477": {
                "id": 319422477,
                "cluster_id": 319486977,
                "label": "MotionSensitivity",
                "type": "Optional[unknown]"
            },
            "319422478": {
                "id": 319422478,
                "cluster_id": 319486977,
                "label": "WattAccumulatedControlPoint",
                "type": "Optional[unknown]"
            },
            "319422480": {
                "id": 319422480,
                "cluster_id": 319486977,
                "label": "ObstructionDetected",
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
                "label": "WeatherTrend",
                "type": "Optional[unknown]"
            },
            "319422488": {
                "id": 319422488,
                "cluster_id": 319486977,
                "label": "ValvePosition",
                "type": "Optional[unknown]"
            }
        }
    },
    "319683586": {
        "id": 319683586,
        "label": "ThirdRealityMeteringCluster",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 319683586,
                "label": "CurrentSummationDelivered",
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
                "label": "InstantaneousDemand",
                "type": "Optional[unknown]"
            },
            "65528": {
                "id": 65528,
                "cluster_id": 319683586,
                "label": "GeneratedCommandList",
                "type": "List[command-id]"
            },
            "65529": {
                "id": 65529,
                "cluster_id": 319683586,
                "label": "AcceptedCommandList",
                "type": "List[command-id]"
            },
            "65530": {
                "id": 65530,
                "cluster_id": 319683586,
                "label": "EventList",
                "type": "Optional[unknown]"
            },
            "65531": {
                "id": 65531,
                "cluster_id": 319683586,
                "label": "AttributeList",
                "type": "List[attrib-id]"
            },
            "65532": {
                "id": 65532,
                "cluster_id": 319683586,
                "label": "FeatureMap",
                "type": "map32"
            },
            "65533": {
                "id": 65533,
                "cluster_id": 319683586,
                "label": "ClusterRevision",
                "type": "uint16"
            }
        }
    }
};
