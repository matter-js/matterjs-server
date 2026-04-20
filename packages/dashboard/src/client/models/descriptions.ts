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
    writable: boolean;
}

export interface ClusterCommandDescription {
    id: number;
    cluster_id: number;
    name: string;
    label: string;
}

export interface ClusterDescription {
    id: number;
    label: string;
    attributes: { [attribute_id: string]: ClusterAttributeDescription };
    commands: { [command_id: string]: ClusterCommandDescription };
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
                "type": "uint16",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 3,
                "label": "IdentifyType",
                "type": "IdentifyTypeEnum",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 3,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 3,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 3,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 3,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 3,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 3,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 3,
                "name": "Identify",
                "label": "Identify"
            },
            "64": {
                "id": 64,
                "cluster_id": 3,
                "name": "TriggerEffect",
                "label": "Trigger Effect"
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
                "type": "NameSupportBitmap",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 4,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 4,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 4,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 4,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 4,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 4,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 4,
                "name": "AddGroup",
                "label": "Add Group"
            },
            "1": {
                "id": 1,
                "cluster_id": 4,
                "name": "ViewGroup",
                "label": "View Group"
            },
            "2": {
                "id": 2,
                "cluster_id": 4,
                "name": "GetGroupMembership",
                "label": "Get Group Membership"
            },
            "3": {
                "id": 3,
                "cluster_id": 4,
                "name": "RemoveGroup",
                "label": "Remove Group"
            },
            "4": {
                "id": 4,
                "cluster_id": 4,
                "name": "RemoveAllGroups",
                "label": "Remove All Groups"
            },
            "5": {
                "id": 5,
                "cluster_id": 4,
                "name": "AddGroupIfIdentifying",
                "label": "Add Group If Identifying"
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
                "type": "bool",
                "writable": false
            },
            "16384": {
                "id": 16384,
                "cluster_id": 6,
                "label": "GlobalSceneControl",
                "type": "Optional[bool]",
                "writable": false
            },
            "16385": {
                "id": 16385,
                "cluster_id": 6,
                "label": "OnTime",
                "type": "Optional[uint16]",
                "writable": true
            },
            "16386": {
                "id": 16386,
                "cluster_id": 6,
                "label": "OffWaitTime",
                "type": "Optional[uint16]",
                "writable": true
            },
            "16387": {
                "id": 16387,
                "cluster_id": 6,
                "label": "StartUpOnOff",
                "type": "Optional[Nullable[StartUpOnOffEnum]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 6,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 6,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 6,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 6,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 6,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 6,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 6,
                "name": "Off",
                "label": "Off"
            },
            "1": {
                "id": 1,
                "cluster_id": 6,
                "name": "On",
                "label": "On"
            },
            "2": {
                "id": 2,
                "cluster_id": 6,
                "name": "Toggle",
                "label": "Toggle"
            },
            "64": {
                "id": 64,
                "cluster_id": 6,
                "name": "OffWithEffect",
                "label": "Off With Effect"
            },
            "65": {
                "id": 65,
                "cluster_id": 6,
                "name": "OnWithRecallGlobalScene",
                "label": "On With Recall Global Scene"
            },
            "66": {
                "id": 66,
                "cluster_id": 6,
                "name": "OnWithTimedOff",
                "label": "On With Timed Off"
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
                "type": "Nullable[uint8]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 8,
                "label": "RemainingTime",
                "type": "Optional[uint16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 8,
                "label": "MinLevel",
                "type": "Optional[uint8]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 8,
                "label": "MaxLevel",
                "type": "Optional[uint8]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 8,
                "label": "CurrentFrequency",
                "type": "Optional[uint16]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 8,
                "label": "MinFrequency",
                "type": "Optional[uint16]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 8,
                "label": "MaxFrequency",
                "type": "Optional[uint16]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 8,
                "label": "Options",
                "type": "OptionsBitmap",
                "writable": true
            },
            "16": {
                "id": 16,
                "cluster_id": 8,
                "label": "OnOffTransitionTime",
                "type": "Optional[uint16]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 8,
                "label": "OnLevel",
                "type": "Nullable[uint8]",
                "writable": true
            },
            "18": {
                "id": 18,
                "cluster_id": 8,
                "label": "OnTransitionTime",
                "type": "Optional[Nullable[uint16]]",
                "writable": true
            },
            "19": {
                "id": 19,
                "cluster_id": 8,
                "label": "OffTransitionTime",
                "type": "Optional[Nullable[uint16]]",
                "writable": true
            },
            "20": {
                "id": 20,
                "cluster_id": 8,
                "label": "DefaultMoveRate",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "16384": {
                "id": 16384,
                "cluster_id": 8,
                "label": "StartUpCurrentLevel",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 8,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 8,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 8,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 8,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 8,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 8,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 8,
                "name": "MoveToLevel",
                "label": "Move To Level"
            },
            "1": {
                "id": 1,
                "cluster_id": 8,
                "name": "Move",
                "label": "Move"
            },
            "2": {
                "id": 2,
                "cluster_id": 8,
                "name": "Step",
                "label": "Step"
            },
            "3": {
                "id": 3,
                "cluster_id": 8,
                "name": "Stop",
                "label": "Stop"
            },
            "4": {
                "id": 4,
                "cluster_id": 8,
                "name": "MoveToLevelWithOnOff",
                "label": "Move To Level With On Off"
            },
            "5": {
                "id": 5,
                "cluster_id": 8,
                "name": "MoveWithOnOff",
                "label": "Move With On Off"
            },
            "6": {
                "id": 6,
                "cluster_id": 8,
                "name": "StepWithOnOff",
                "label": "Step With On Off"
            },
            "7": {
                "id": 7,
                "cluster_id": 8,
                "name": "StopWithOnOff",
                "label": "Stop With On Off"
            },
            "8": {
                "id": 8,
                "cluster_id": 8,
                "name": "MoveToClosestFrequency",
                "label": "Move To Closest Frequency"
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
                "type": "List[DeviceTypeStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 29,
                "label": "ServerList",
                "type": "List[cluster-id]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 29,
                "label": "ClientList",
                "type": "List[cluster-id]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 29,
                "label": "PartsList",
                "type": "List[endpoint-no]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 29,
                "label": "TagList",
                "type": "List[semtag]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 29,
                "label": "EndpointUniqueId",
                "type": "Optional[string]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 29,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 29,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 29,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 29,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 29,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 29,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "30": {
        "id": 30,
        "label": "Binding",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 30,
                "label": "Binding",
                "type": "List[TargetStruct]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 30,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 30,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 30,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 30,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 30,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 30,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "31": {
        "id": 31,
        "label": "AccessControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 31,
                "label": "Acl",
                "type": "List[AccessControlEntryStruct]",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 31,
                "label": "Extension",
                "type": "List[AccessControlExtensionStruct]",
                "writable": true
            },
            "2": {
                "id": 2,
                "cluster_id": 31,
                "label": "SubjectsPerAccessControlEntry",
                "type": "uint16",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 31,
                "label": "TargetsPerAccessControlEntry",
                "type": "uint16",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 31,
                "label": "AccessControlEntriesPerFabric",
                "type": "uint16",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 31,
                "label": "CommissioningArl",
                "type": "List[CommissioningAccessRestrictionEntryStruct]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 31,
                "label": "Arl",
                "type": "List[AccessRestrictionEntryStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 31,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 31,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 31,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 31,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 31,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 31,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 31,
                "name": "ReviewFabricRestrictions",
                "label": "Review Fabric Restrictions"
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
                "type": "List[ActionStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 37,
                "label": "EndpointLists",
                "type": "List[EndpointListStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 37,
                "label": "SetupUrl",
                "type": "Optional[string]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 37,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 37,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 37,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 37,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 37,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 37,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 37,
                "name": "InstantAction",
                "label": "Instant Action"
            },
            "1": {
                "id": 1,
                "cluster_id": 37,
                "name": "InstantActionWithTransition",
                "label": "Instant Action With Transition"
            },
            "2": {
                "id": 2,
                "cluster_id": 37,
                "name": "StartAction",
                "label": "Start Action"
            },
            "3": {
                "id": 3,
                "cluster_id": 37,
                "name": "StartActionWithDuration",
                "label": "Start Action With Duration"
            },
            "4": {
                "id": 4,
                "cluster_id": 37,
                "name": "StopAction",
                "label": "Stop Action"
            },
            "5": {
                "id": 5,
                "cluster_id": 37,
                "name": "PauseAction",
                "label": "Pause Action"
            },
            "6": {
                "id": 6,
                "cluster_id": 37,
                "name": "PauseActionWithDuration",
                "label": "Pause Action With Duration"
            },
            "7": {
                "id": 7,
                "cluster_id": 37,
                "name": "ResumeAction",
                "label": "Resume Action"
            },
            "8": {
                "id": 8,
                "cluster_id": 37,
                "name": "EnableAction",
                "label": "Enable Action"
            },
            "9": {
                "id": 9,
                "cluster_id": 37,
                "name": "EnableActionWithDuration",
                "label": "Enable Action With Duration"
            },
            "10": {
                "id": 10,
                "cluster_id": 37,
                "name": "DisableAction",
                "label": "Disable Action"
            },
            "11": {
                "id": 11,
                "cluster_id": 37,
                "name": "DisableActionWithDuration",
                "label": "Disable Action With Duration"
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
                "type": "uint16",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 40,
                "label": "VendorName",
                "type": "string",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 40,
                "label": "VendorId",
                "type": "vendor-id",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 40,
                "label": "ProductName",
                "type": "string",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 40,
                "label": "ProductId",
                "type": "uint16",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 40,
                "label": "NodeLabel",
                "type": "string",
                "writable": true
            },
            "6": {
                "id": 6,
                "cluster_id": 40,
                "label": "Location",
                "type": "string",
                "writable": true
            },
            "7": {
                "id": 7,
                "cluster_id": 40,
                "label": "HardwareVersion",
                "type": "uint16",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 40,
                "label": "HardwareVersionString",
                "type": "string",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 40,
                "label": "SoftwareVersion",
                "type": "uint32",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 40,
                "label": "SoftwareVersionString",
                "type": "string",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 40,
                "label": "ManufacturingDate",
                "type": "Optional[string]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 40,
                "label": "PartNumber",
                "type": "Optional[string]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 40,
                "label": "ProductUrl",
                "type": "Optional[string]",
                "writable": false
            },
            "14": {
                "id": 14,
                "cluster_id": 40,
                "label": "ProductLabel",
                "type": "Optional[string]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 40,
                "label": "SerialNumber",
                "type": "Optional[string]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 40,
                "label": "LocalConfigDisabled",
                "type": "Optional[bool]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 40,
                "label": "Reachable",
                "type": "Optional[bool]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 40,
                "label": "UniqueId",
                "type": "string",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 40,
                "label": "CapabilityMinima",
                "type": "CapabilityMinimaStruct",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 40,
                "label": "ProductAppearance",
                "type": "Optional[ProductAppearanceStruct]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 40,
                "label": "SpecificationVersion",
                "type": "uint32",
                "writable": false
            },
            "22": {
                "id": 22,
                "cluster_id": 40,
                "label": "MaxPathsPerInvoke",
                "type": "uint16",
                "writable": false
            },
            "24": {
                "id": 24,
                "cluster_id": 40,
                "label": "ConfigurationVersion",
                "type": "Optional[uint32]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 40,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 40,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 40,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 40,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 40,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 40,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "41": {
        "id": 41,
        "label": "OtaSoftwareUpdateProvider",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 41,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 41,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 41,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 41,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 41,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 41,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 41,
                "name": "QueryImage",
                "label": "Query Image"
            },
            "2": {
                "id": 2,
                "cluster_id": 41,
                "name": "ApplyUpdateRequest",
                "label": "Apply Update Request"
            },
            "4": {
                "id": 4,
                "cluster_id": 41,
                "name": "NotifyUpdateApplied",
                "label": "Notify Update Applied"
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
                "type": "List[ProviderLocation]",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 42,
                "label": "UpdatePossible",
                "type": "bool",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 42,
                "label": "UpdateState",
                "type": "UpdateStateEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 42,
                "label": "UpdateStateProgress",
                "type": "Nullable[uint8]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 42,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 42,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 42,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 42,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 42,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 42,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 42,
                "name": "AnnounceOtaProvider",
                "label": "Announce Ota Provider"
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
                "type": "string",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 43,
                "label": "SupportedLocales",
                "type": "List[string]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 43,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 43,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 43,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 43,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 43,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 43,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "44": {
        "id": 44,
        "label": "TimeFormatLocalization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 44,
                "label": "HourFormat",
                "type": "HourFormatEnum",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 44,
                "label": "ActiveCalendarType",
                "type": "Optional[CalendarTypeEnum]",
                "writable": true
            },
            "2": {
                "id": 2,
                "cluster_id": 44,
                "label": "SupportedCalendarTypes",
                "type": "List[CalendarTypeEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 44,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 44,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 44,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 44,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 44,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 44,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "45": {
        "id": 45,
        "label": "UnitLocalization",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 45,
                "label": "TemperatureUnit",
                "type": "Optional[TempUnitEnum]",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 45,
                "label": "SupportedTemperatureUnits",
                "type": "List[TempUnitEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 45,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 45,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 45,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 45,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 45,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 45,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "46": {
        "id": 46,
        "label": "PowerSourceConfiguration",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 46,
                "label": "Sources",
                "type": "List[endpoint-no]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 46,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 46,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 46,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 46,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 46,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 46,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "47": {
        "id": 47,
        "label": "PowerSource",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 47,
                "label": "Status",
                "type": "PowerSourceStatusEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 47,
                "label": "Order",
                "type": "uint8",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 47,
                "label": "Description",
                "type": "string",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 47,
                "label": "WiredAssessedInputVoltage",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 47,
                "label": "WiredAssessedInputFrequency",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 47,
                "label": "WiredCurrentType",
                "type": "Optional[WiredCurrentTypeEnum]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 47,
                "label": "WiredAssessedCurrent",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 47,
                "label": "WiredNominalVoltage",
                "type": "Optional[uint32]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 47,
                "label": "WiredMaximumCurrent",
                "type": "Optional[uint32]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 47,
                "label": "WiredPresent",
                "type": "Optional[bool]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 47,
                "label": "ActiveWiredFaults",
                "type": "List[WiredFaultEnum]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 47,
                "label": "BatVoltage",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 47,
                "label": "BatPercentRemaining",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 47,
                "label": "BatTimeRemaining",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "14": {
                "id": 14,
                "cluster_id": 47,
                "label": "BatChargeLevel",
                "type": "Optional[BatChargeLevelEnum]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 47,
                "label": "BatReplacementNeeded",
                "type": "Optional[bool]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 47,
                "label": "BatReplaceability",
                "type": "Optional[BatReplaceabilityEnum]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 47,
                "label": "BatPresent",
                "type": "Optional[bool]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 47,
                "label": "ActiveBatFaults",
                "type": "List[BatFaultEnum]",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 47,
                "label": "BatReplacementDescription",
                "type": "Optional[string]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 47,
                "label": "BatCommonDesignation",
                "type": "Optional[BatCommonDesignationEnum]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 47,
                "label": "BatAnsiDesignation",
                "type": "Optional[string]",
                "writable": false
            },
            "22": {
                "id": 22,
                "cluster_id": 47,
                "label": "BatIecDesignation",
                "type": "Optional[string]",
                "writable": false
            },
            "23": {
                "id": 23,
                "cluster_id": 47,
                "label": "BatApprovedChemistry",
                "type": "Optional[BatApprovedChemistryEnum]",
                "writable": false
            },
            "24": {
                "id": 24,
                "cluster_id": 47,
                "label": "BatCapacity",
                "type": "Optional[uint32]",
                "writable": false
            },
            "25": {
                "id": 25,
                "cluster_id": 47,
                "label": "BatQuantity",
                "type": "Optional[uint8]",
                "writable": false
            },
            "26": {
                "id": 26,
                "cluster_id": 47,
                "label": "BatChargeState",
                "type": "Optional[BatChargeStateEnum]",
                "writable": false
            },
            "27": {
                "id": 27,
                "cluster_id": 47,
                "label": "BatTimeToFullCharge",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "28": {
                "id": 28,
                "cluster_id": 47,
                "label": "BatFunctionalWhileCharging",
                "type": "Optional[bool]",
                "writable": false
            },
            "29": {
                "id": 29,
                "cluster_id": 47,
                "label": "BatChargingCurrent",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "30": {
                "id": 30,
                "cluster_id": 47,
                "label": "ActiveBatChargeFaults",
                "type": "List[BatChargeFaultEnum]",
                "writable": false
            },
            "31": {
                "id": 31,
                "cluster_id": 47,
                "label": "EndpointList",
                "type": "List[endpoint-no]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 47,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 47,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 47,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 47,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 47,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 47,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "48": {
        "id": 48,
        "label": "GeneralCommissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 48,
                "label": "Breadcrumb",
                "type": "uint64",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 48,
                "label": "BasicCommissioningInfo",
                "type": "BasicCommissioningInfo",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 48,
                "label": "RegulatoryConfig",
                "type": "RegulatoryLocationTypeEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 48,
                "label": "LocationCapability",
                "type": "RegulatoryLocationTypeEnum",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 48,
                "label": "SupportsConcurrentConnection",
                "type": "bool",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 48,
                "label": "TcAcceptedVersion",
                "type": "Optional[uint16]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 48,
                "label": "TcMinRequiredVersion",
                "type": "Optional[uint16]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 48,
                "label": "TcAcknowledgements",
                "type": "Optional[map16]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 48,
                "label": "TcAcknowledgementsRequired",
                "type": "Optional[bool]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 48,
                "label": "TcUpdateDeadline",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 48,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 48,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 48,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 48,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 48,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 48,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 48,
                "name": "ArmFailSafe",
                "label": "Arm Fail Safe"
            },
            "2": {
                "id": 2,
                "cluster_id": 48,
                "name": "SetRegulatoryConfig",
                "label": "Set Regulatory Config"
            },
            "4": {
                "id": 4,
                "cluster_id": 48,
                "name": "CommissioningComplete",
                "label": "Commissioning Complete"
            },
            "6": {
                "id": 6,
                "cluster_id": 48,
                "name": "SetTcAcknowledgements",
                "label": "Set Tc Acknowledgements"
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
                "type": "uint8",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 49,
                "label": "Networks",
                "type": "List[NetworkInfoStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 49,
                "label": "ScanMaxTimeSeconds",
                "type": "Optional[uint8]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 49,
                "label": "ConnectMaxTimeSeconds",
                "type": "Optional[uint8]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 49,
                "label": "InterfaceEnabled",
                "type": "bool",
                "writable": true
            },
            "5": {
                "id": 5,
                "cluster_id": 49,
                "label": "LastNetworkingStatus",
                "type": "Nullable[NetworkCommissioningStatusEnum]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 49,
                "label": "LastNetworkId",
                "type": "Nullable[bytes]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 49,
                "label": "LastConnectErrorValue",
                "type": "Nullable[int32]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 49,
                "label": "SupportedWiFiBands",
                "type": "List[WiFiBandEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 49,
                "label": "SupportedThreadFeatures",
                "type": "Optional[ThreadCapabilitiesBitmap]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 49,
                "label": "ThreadVersion",
                "type": "Optional[uint16]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 49,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 49,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 49,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 49,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 49,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 49,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 49,
                "name": "ScanNetworks",
                "label": "Scan Networks"
            },
            "2": {
                "id": 2,
                "cluster_id": 49,
                "name": "AddOrUpdateWiFiNetwork",
                "label": "Add Or Update Wi Fi Network"
            },
            "3": {
                "id": 3,
                "cluster_id": 49,
                "name": "AddOrUpdateThreadNetwork",
                "label": "Add Or Update Thread Network"
            },
            "4": {
                "id": 4,
                "cluster_id": 49,
                "name": "RemoveNetwork",
                "label": "Remove Network"
            },
            "6": {
                "id": 6,
                "cluster_id": 49,
                "name": "ConnectNetwork",
                "label": "Connect Network"
            },
            "8": {
                "id": 8,
                "cluster_id": 49,
                "name": "ReorderNetwork",
                "label": "Reorder Network"
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
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 50,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 50,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 50,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 50,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 50,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 50,
                "name": "RetrieveLogsRequest",
                "label": "Retrieve Logs Request"
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
                "type": "List[NetworkInterface]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 51,
                "label": "RebootCount",
                "type": "uint16",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 51,
                "label": "UpTime",
                "type": "uint64",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 51,
                "label": "TotalOperationalHours",
                "type": "Optional[uint32]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 51,
                "label": "BootReason",
                "type": "Optional[BootReasonEnum]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 51,
                "label": "ActiveHardwareFaults",
                "type": "List[HardwareFaultEnum]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 51,
                "label": "ActiveRadioFaults",
                "type": "List[RadioFaultEnum]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 51,
                "label": "ActiveNetworkFaults",
                "type": "List[NetworkFaultEnum]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 51,
                "label": "TestEventTriggersEnabled",
                "type": "bool",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 51,
                "label": "DoNotUse",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 51,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 51,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 51,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 51,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 51,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 51,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 51,
                "name": "TestEventTrigger",
                "label": "Test Event Trigger"
            },
            "1": {
                "id": 1,
                "cluster_id": 51,
                "name": "TimeSnapshot",
                "label": "Time Snapshot"
            },
            "3": {
                "id": 3,
                "cluster_id": 51,
                "name": "PayloadTestRequest",
                "label": "Payload Test Request"
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
                "type": "List[ThreadMetricsStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 52,
                "label": "CurrentHeapFree",
                "type": "Optional[uint64]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 52,
                "label": "CurrentHeapUsed",
                "type": "Optional[uint64]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 52,
                "label": "CurrentHeapHighWatermark",
                "type": "Optional[uint64]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 52,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 52,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 52,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 52,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 52,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 52,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 52,
                "name": "ResetWatermarks",
                "label": "Reset Watermarks"
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
                "type": "Nullable[uint16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 53,
                "label": "RoutingRole",
                "type": "Nullable[RoutingRoleEnum]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 53,
                "label": "NetworkName",
                "type": "Nullable[string]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 53,
                "label": "PanId",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 53,
                "label": "ExtendedPanId",
                "type": "Nullable[uint64]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 53,
                "label": "MeshLocalPrefix",
                "type": "Nullable[bytes]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 53,
                "label": "OverrunCount",
                "type": "Optional[uint64]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 53,
                "label": "NeighborTable",
                "type": "List[NeighborTableStruct]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 53,
                "label": "RouteTable",
                "type": "List[RouteTableStruct]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 53,
                "label": "PartitionId",
                "type": "Nullable[uint32]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 53,
                "label": "Weighting",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 53,
                "label": "DataVersion",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 53,
                "label": "StableDataVersion",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 53,
                "label": "LeaderRouterId",
                "type": "Nullable[uint8]",
                "writable": false
            },
            "14": {
                "id": 14,
                "cluster_id": 53,
                "label": "DetachedRoleCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 53,
                "label": "ChildRoleCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 53,
                "label": "RouterRoleCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 53,
                "label": "LeaderRoleCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 53,
                "label": "AttachAttemptCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 53,
                "label": "PartitionIdChangeCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 53,
                "label": "BetterPartitionAttachAttemptCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 53,
                "label": "ParentChangeCount",
                "type": "Optional[uint16]",
                "writable": false
            },
            "22": {
                "id": 22,
                "cluster_id": 53,
                "label": "TxTotalCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "23": {
                "id": 23,
                "cluster_id": 53,
                "label": "TxUnicastCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "24": {
                "id": 24,
                "cluster_id": 53,
                "label": "TxBroadcastCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "25": {
                "id": 25,
                "cluster_id": 53,
                "label": "TxAckRequestedCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "26": {
                "id": 26,
                "cluster_id": 53,
                "label": "TxAckedCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "27": {
                "id": 27,
                "cluster_id": 53,
                "label": "TxNoAckRequestedCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "28": {
                "id": 28,
                "cluster_id": 53,
                "label": "TxDataCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "29": {
                "id": 29,
                "cluster_id": 53,
                "label": "TxDataPollCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "30": {
                "id": 30,
                "cluster_id": 53,
                "label": "TxBeaconCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "31": {
                "id": 31,
                "cluster_id": 53,
                "label": "TxBeaconRequestCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "32": {
                "id": 32,
                "cluster_id": 53,
                "label": "TxOtherCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "33": {
                "id": 33,
                "cluster_id": 53,
                "label": "TxRetryCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "34": {
                "id": 34,
                "cluster_id": 53,
                "label": "TxDirectMaxRetryExpiryCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "35": {
                "id": 35,
                "cluster_id": 53,
                "label": "TxIndirectMaxRetryExpiryCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "36": {
                "id": 36,
                "cluster_id": 53,
                "label": "TxErrCcaCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "37": {
                "id": 37,
                "cluster_id": 53,
                "label": "TxErrAbortCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "38": {
                "id": 38,
                "cluster_id": 53,
                "label": "TxErrBusyChannelCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "39": {
                "id": 39,
                "cluster_id": 53,
                "label": "RxTotalCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "40": {
                "id": 40,
                "cluster_id": 53,
                "label": "RxUnicastCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "41": {
                "id": 41,
                "cluster_id": 53,
                "label": "RxBroadcastCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "42": {
                "id": 42,
                "cluster_id": 53,
                "label": "RxDataCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "43": {
                "id": 43,
                "cluster_id": 53,
                "label": "RxDataPollCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "44": {
                "id": 44,
                "cluster_id": 53,
                "label": "RxBeaconCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "45": {
                "id": 45,
                "cluster_id": 53,
                "label": "RxBeaconRequestCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "46": {
                "id": 46,
                "cluster_id": 53,
                "label": "RxOtherCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "47": {
                "id": 47,
                "cluster_id": 53,
                "label": "RxAddressFilteredCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "48": {
                "id": 48,
                "cluster_id": 53,
                "label": "RxDestAddrFilteredCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "49": {
                "id": 49,
                "cluster_id": 53,
                "label": "RxDuplicatedCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "50": {
                "id": 50,
                "cluster_id": 53,
                "label": "RxErrNoFrameCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "51": {
                "id": 51,
                "cluster_id": 53,
                "label": "RxErrUnknownNeighborCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "52": {
                "id": 52,
                "cluster_id": 53,
                "label": "RxErrInvalidSrcAddrCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "53": {
                "id": 53,
                "cluster_id": 53,
                "label": "RxErrSecCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "54": {
                "id": 54,
                "cluster_id": 53,
                "label": "RxErrFcsCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "55": {
                "id": 55,
                "cluster_id": 53,
                "label": "RxErrOtherCount",
                "type": "Optional[uint32]",
                "writable": false
            },
            "56": {
                "id": 56,
                "cluster_id": 53,
                "label": "ActiveTimestamp",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "57": {
                "id": 57,
                "cluster_id": 53,
                "label": "PendingTimestamp",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "58": {
                "id": 58,
                "cluster_id": 53,
                "label": "Delay",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "59": {
                "id": 59,
                "cluster_id": 53,
                "label": "SecurityPolicy",
                "type": "Nullable[SecurityPolicy]",
                "writable": false
            },
            "60": {
                "id": 60,
                "cluster_id": 53,
                "label": "ChannelPage0Mask",
                "type": "Nullable[bytes]",
                "writable": false
            },
            "61": {
                "id": 61,
                "cluster_id": 53,
                "label": "OperationalDatasetComponents",
                "type": "Nullable[OperationalDatasetComponents]",
                "writable": false
            },
            "62": {
                "id": 62,
                "cluster_id": 53,
                "label": "ActiveNetworkFaultsList",
                "type": "List[NetworkFaultEnum]",
                "writable": false
            },
            "63": {
                "id": 63,
                "cluster_id": 53,
                "label": "ExtAddress",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "64": {
                "id": 64,
                "cluster_id": 53,
                "label": "Rloc16",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 53,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 53,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 53,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 53,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 53,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 53,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 53,
                "name": "ResetCounts",
                "label": "Reset Counts"
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
                "type": "Nullable[bytes]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 54,
                "label": "SecurityType",
                "type": "Nullable[SecurityTypeEnum]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 54,
                "label": "WiFiVersion",
                "type": "Nullable[WiFiVersionEnum]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 54,
                "label": "ChannelNumber",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 54,
                "label": "Rssi",
                "type": "Nullable[int8]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 54,
                "label": "BeaconLostCount",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 54,
                "label": "BeaconRxCount",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 54,
                "label": "PacketMulticastRxCount",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 54,
                "label": "PacketMulticastTxCount",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 54,
                "label": "PacketUnicastRxCount",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 54,
                "label": "PacketUnicastTxCount",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 54,
                "label": "CurrentMaxRate",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 54,
                "label": "OverrunCount",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 54,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 54,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 54,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 54,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 54,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 54,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 54,
                "name": "ResetCounts",
                "label": "Reset Counts"
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
                "type": "Optional[Nullable[PHYRateEnum]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 55,
                "label": "FullDuplex",
                "type": "Optional[Nullable[bool]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 55,
                "label": "PacketRxCount",
                "type": "Optional[uint64]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 55,
                "label": "PacketTxCount",
                "type": "Optional[uint64]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 55,
                "label": "TxErrCount",
                "type": "Optional[uint64]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 55,
                "label": "CollisionCount",
                "type": "Optional[uint64]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 55,
                "label": "OverrunCount",
                "type": "Optional[uint64]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 55,
                "label": "CarrierDetect",
                "type": "Optional[Nullable[bool]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 55,
                "label": "TimeSinceReset",
                "type": "Optional[uint64]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 55,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 55,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 55,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 55,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 55,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 55,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 55,
                "name": "ResetCounts",
                "label": "Reset Counts"
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
                "type": "Nullable[epoch-us]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 56,
                "label": "Granularity",
                "type": "GranularityEnum",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 56,
                "label": "TimeSource",
                "type": "Optional[TimeSourceEnum]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 56,
                "label": "TrustedTimeSource",
                "type": "Optional[Nullable[TrustedTimeSourceStruct]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 56,
                "label": "DefaultNtp",
                "type": "Optional[Nullable[string]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 56,
                "label": "TimeZone",
                "type": "List[TimeZoneStruct]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 56,
                "label": "DstOffset",
                "type": "List[DSTOffsetStruct]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 56,
                "label": "LocalTime",
                "type": "Optional[Nullable[epoch-us]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 56,
                "label": "TimeZoneDatabase",
                "type": "Optional[TimeZoneDatabaseEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 56,
                "label": "NtpServerAvailable",
                "type": "Optional[bool]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 56,
                "label": "TimeZoneListMaxSize",
                "type": "Optional[uint8]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 56,
                "label": "DstOffsetListMaxSize",
                "type": "Optional[uint8]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 56,
                "label": "SupportsDnsResolve",
                "type": "Optional[bool]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 56,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 56,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 56,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 56,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 56,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 56,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 56,
                "name": "SetUtcTime",
                "label": "Set Utc Time"
            },
            "1": {
                "id": 1,
                "cluster_id": 56,
                "name": "SetTrustedTimeSource",
                "label": "Set Trusted Time Source"
            },
            "2": {
                "id": 2,
                "cluster_id": 56,
                "name": "SetTimeZone",
                "label": "Set Time Zone"
            },
            "4": {
                "id": 4,
                "cluster_id": 56,
                "name": "SetDstOffset",
                "label": "Set Dst Offset"
            },
            "5": {
                "id": 5,
                "cluster_id": 56,
                "name": "SetDefaultNtp",
                "label": "Set Default Ntp"
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
                "type": "Optional[unknown]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 57,
                "label": "VendorName",
                "type": "Optional[string]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 57,
                "label": "VendorId",
                "type": "Optional[unknown]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 57,
                "label": "ProductName",
                "type": "Optional[string]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 57,
                "label": "ProductId",
                "type": "Optional[unknown]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 57,
                "label": "NodeLabel",
                "type": "Optional[string]",
                "writable": true
            },
            "6": {
                "id": 6,
                "cluster_id": 57,
                "label": "Location",
                "type": "Optional[string]",
                "writable": true
            },
            "7": {
                "id": 7,
                "cluster_id": 57,
                "label": "HardwareVersion",
                "type": "Optional[unknown]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 57,
                "label": "HardwareVersionString",
                "type": "Optional[string]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 57,
                "label": "SoftwareVersion",
                "type": "Optional[unknown]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 57,
                "label": "SoftwareVersionString",
                "type": "Optional[string]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 57,
                "label": "ManufacturingDate",
                "type": "Optional[string]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 57,
                "label": "PartNumber",
                "type": "Optional[string]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 57,
                "label": "ProductUrl",
                "type": "Optional[string]",
                "writable": false
            },
            "14": {
                "id": 14,
                "cluster_id": 57,
                "label": "ProductLabel",
                "type": "Optional[string]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 57,
                "label": "SerialNumber",
                "type": "Optional[string]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 57,
                "label": "LocalConfigDisabled",
                "type": "Optional[bool]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 57,
                "label": "Reachable",
                "type": "bool",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 57,
                "label": "UniqueId",
                "type": "string",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 57,
                "label": "CapabilityMinima",
                "type": "Optional[unknown]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 57,
                "label": "ProductAppearance",
                "type": "Optional[unknown]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 57,
                "label": "SpecificationVersion",
                "type": "Optional[unknown]",
                "writable": false
            },
            "22": {
                "id": 22,
                "cluster_id": 57,
                "label": "MaxPathsPerInvoke",
                "type": "Optional[unknown]",
                "writable": false
            },
            "24": {
                "id": 24,
                "cluster_id": 57,
                "label": "ConfigurationVersion",
                "type": "Optional[unknown]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 57,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 57,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 57,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 57,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 57,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 57,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "128": {
                "id": 128,
                "cluster_id": 57,
                "name": "KeepActive",
                "label": "Keep Active"
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
                "type": "uint8",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 59,
                "label": "CurrentPosition",
                "type": "uint8",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 59,
                "label": "MultiPressMax",
                "type": "Optional[uint8]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 59,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 59,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 59,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 59,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 59,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 59,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "60": {
        "id": 60,
        "label": "AdministratorCommissioning",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 60,
                "label": "WindowStatus",
                "type": "CommissioningWindowStatusEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 60,
                "label": "AdminFabricIndex",
                "type": "Nullable[fabric-idx]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 60,
                "label": "AdminVendorId",
                "type": "Nullable[vendor-id]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 60,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 60,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 60,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 60,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 60,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 60,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 60,
                "name": "OpenCommissioningWindow",
                "label": "Open Commissioning Window"
            },
            "1": {
                "id": 1,
                "cluster_id": 60,
                "name": "OpenBasicCommissioningWindow",
                "label": "Open Basic Commissioning Window"
            },
            "2": {
                "id": 2,
                "cluster_id": 60,
                "name": "RevokeCommissioning",
                "label": "Revoke Commissioning"
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
                "type": "List[NOCStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 62,
                "label": "Fabrics",
                "type": "List[FabricDescriptorStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 62,
                "label": "SupportedFabrics",
                "type": "uint8",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 62,
                "label": "CommissionedFabrics",
                "type": "uint8",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 62,
                "label": "TrustedRootCertificates",
                "type": "List[octstr]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 62,
                "label": "CurrentFabricIndex",
                "type": "fabric-idx",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 62,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 62,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 62,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 62,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 62,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 62,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 62,
                "name": "AttestationRequest",
                "label": "Attestation Request"
            },
            "2": {
                "id": 2,
                "cluster_id": 62,
                "name": "CertificateChainRequest",
                "label": "Certificate Chain Request"
            },
            "4": {
                "id": 4,
                "cluster_id": 62,
                "name": "CsrRequest",
                "label": "Csr Request"
            },
            "6": {
                "id": 6,
                "cluster_id": 62,
                "name": "AddNoc",
                "label": "Add Noc"
            },
            "7": {
                "id": 7,
                "cluster_id": 62,
                "name": "UpdateNoc",
                "label": "Update Noc"
            },
            "9": {
                "id": 9,
                "cluster_id": 62,
                "name": "UpdateFabricLabel",
                "label": "Update Fabric Label"
            },
            "10": {
                "id": 10,
                "cluster_id": 62,
                "name": "RemoveFabric",
                "label": "Remove Fabric"
            },
            "11": {
                "id": 11,
                "cluster_id": 62,
                "name": "AddTrustedRootCertificate",
                "label": "Add Trusted Root Certificate"
            },
            "12": {
                "id": 12,
                "cluster_id": 62,
                "name": "SetVidVerificationStatement",
                "label": "Set Vid Verification Statement"
            },
            "13": {
                "id": 13,
                "cluster_id": 62,
                "name": "SignVidVerificationRequest",
                "label": "Sign Vid Verification Request"
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
                "type": "List[GroupKeyMapStruct]",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 63,
                "label": "GroupTable",
                "type": "List[GroupInfoMapStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 63,
                "label": "MaxGroupsPerFabric",
                "type": "uint16",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 63,
                "label": "MaxGroupKeysPerFabric",
                "type": "uint16",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 63,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 63,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 63,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 63,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 63,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 63,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 63,
                "name": "KeySetWrite",
                "label": "Key Set Write"
            },
            "1": {
                "id": 1,
                "cluster_id": 63,
                "name": "KeySetRead",
                "label": "Key Set Read"
            },
            "3": {
                "id": 3,
                "cluster_id": 63,
                "name": "KeySetRemove",
                "label": "Key Set Remove"
            },
            "4": {
                "id": 4,
                "cluster_id": 63,
                "name": "KeySetReadAllIndices",
                "label": "Key Set Read All Indices"
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
                "type": "List[LabelStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 64,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 64,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 64,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 64,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 64,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 64,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "65": {
        "id": 65,
        "label": "UserLabel",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 65,
                "label": "LabelList",
                "type": "List[LabelStruct]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 65,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 65,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 65,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 65,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 65,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 65,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "69": {
        "id": 69,
        "label": "BooleanState",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 69,
                "label": "StateValue",
                "type": "bool",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 69,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 69,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 69,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 69,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 69,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 69,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "70": {
        "id": 70,
        "label": "IcdManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 70,
                "label": "IdleModeDuration",
                "type": "uint32",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 70,
                "label": "ActiveModeDuration",
                "type": "uint32",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 70,
                "label": "ActiveModeThreshold",
                "type": "uint16",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 70,
                "label": "RegisteredClients",
                "type": "List[MonitoringRegistrationStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 70,
                "label": "IcdCounter",
                "type": "Optional[uint32]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 70,
                "label": "ClientsSupportedPerFabric",
                "type": "Optional[uint16]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 70,
                "label": "UserActiveModeTriggerHint",
                "type": "Optional[UserActiveModeTriggerBitmap]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 70,
                "label": "UserActiveModeTriggerInstruction",
                "type": "Optional[string]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 70,
                "label": "OperatingMode",
                "type": "Optional[OperatingModeEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 70,
                "label": "MaximumCheckInBackoff",
                "type": "Optional[uint32]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 70,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 70,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 70,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 70,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 70,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 70,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 70,
                "name": "RegisterClient",
                "label": "Register Client"
            },
            "2": {
                "id": 2,
                "cluster_id": 70,
                "name": "UnregisterClient",
                "label": "Unregister Client"
            },
            "3": {
                "id": 3,
                "cluster_id": 70,
                "name": "StayActiveRequest",
                "label": "Stay Active Request"
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
                "type": "List[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 72,
                "label": "CurrentPhase",
                "type": "Nullable[uint8]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 72,
                "label": "CountdownTime",
                "type": "Optional[Nullable[elapsed-s]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 72,
                "label": "OperationalStateList",
                "type": "List[OperationalStateStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 72,
                "label": "OperationalState",
                "type": "OperationalStateEnum",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 72,
                "label": "OperationalError",
                "type": "ErrorStateStruct",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 72,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 72,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 72,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 72,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 72,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 72,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 72,
                "name": "Pause",
                "label": "Pause"
            },
            "1": {
                "id": 1,
                "cluster_id": 72,
                "name": "Stop",
                "label": "Stop"
            },
            "2": {
                "id": 2,
                "cluster_id": 72,
                "name": "Start",
                "label": "Start"
            },
            "3": {
                "id": 3,
                "cluster_id": 72,
                "name": "Resume",
                "label": "Resume"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 73,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 73,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 73,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 73,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 73,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 73,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 73,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 73,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 73,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 73,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "List[DrynessLevelEnum]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 74,
                "label": "SelectedDrynessLevel",
                "type": "Nullable[DrynessLevelEnum]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 74,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 74,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 74,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 74,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 74,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 74,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "80": {
        "id": 80,
        "label": "ModeSelect",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 80,
                "label": "Description",
                "type": "string",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 80,
                "label": "StandardNamespace",
                "type": "Nullable[namespace]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 80,
                "label": "SupportedModes",
                "type": "List[ModeOptionStruct]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 80,
                "label": "CurrentMode",
                "type": "uint8",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 80,
                "label": "StartUpMode",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "5": {
                "id": 5,
                "cluster_id": 80,
                "label": "OnMode",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 80,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 80,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 80,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 80,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 80,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 80,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 80,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 81,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 81,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 81,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 81,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 81,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 81,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 81,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 81,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 81,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 81,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 82,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 82,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 82,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 82,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 82,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 82,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 82,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 82,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 82,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 82,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "List[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 83,
                "label": "SpinSpeedCurrent",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "2": {
                "id": 2,
                "cluster_id": 83,
                "label": "NumberOfRinses",
                "type": "Optional[NumberOfRinsesEnum]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 83,
                "label": "SupportedRinses",
                "type": "List[NumberOfRinsesEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 83,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 83,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 83,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 83,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 83,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 83,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "84": {
        "id": 84,
        "label": "RvcRunMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 84,
                "label": "SupportedModes",
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 84,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 84,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 84,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 84,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 84,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 84,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 84,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 84,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 84,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 84,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 85,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 85,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 85,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 85,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 85,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 85,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 85,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 85,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 85,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 85,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "Optional[temperature]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 86,
                "label": "MinTemperature",
                "type": "Optional[temperature]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 86,
                "label": "MaxTemperature",
                "type": "Optional[temperature]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 86,
                "label": "Step",
                "type": "Optional[temperature]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 86,
                "label": "SelectedTemperatureLevel",
                "type": "Optional[uint8]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 86,
                "label": "SupportedTemperatureLevels",
                "type": "List[string]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 86,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 86,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 86,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 86,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 86,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 86,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 86,
                "name": "SetTemperature",
                "label": "Set Temperature"
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
                "type": "AlarmBitmap",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 87,
                "label": "Latch",
                "type": "Optional[AlarmBitmap]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 87,
                "label": "State",
                "type": "AlarmBitmap",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 87,
                "label": "Supported",
                "type": "AlarmBitmap",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 87,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 87,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 87,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 87,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 87,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 87,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 87,
                "name": "Reset",
                "label": "Reset"
            },
            "1": {
                "id": 1,
                "cluster_id": 87,
                "name": "ModifyEnabledAlarms",
                "label": "Modify Enabled Alarms"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 89,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 89,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 89,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 89,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 89,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 89,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 89,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 89,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 89,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 89,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "AirQualityEnum",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 91,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 91,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 91,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 91,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 91,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 91,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "92": {
        "id": 92,
        "label": "SmokeCoAlarm",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 92,
                "label": "ExpressedState",
                "type": "ExpressedStateEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 92,
                "label": "SmokeState",
                "type": "Optional[AlarmStateEnum]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 92,
                "label": "CoState",
                "type": "Optional[AlarmStateEnum]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 92,
                "label": "BatteryAlert",
                "type": "AlarmStateEnum",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 92,
                "label": "DeviceMuted",
                "type": "Optional[MuteStateEnum]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 92,
                "label": "TestInProgress",
                "type": "bool",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 92,
                "label": "HardwareFaultAlert",
                "type": "bool",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 92,
                "label": "EndOfServiceAlert",
                "type": "EndOfServiceEnum",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 92,
                "label": "InterconnectSmokeAlarm",
                "type": "Optional[AlarmStateEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 92,
                "label": "InterconnectCoAlarm",
                "type": "Optional[AlarmStateEnum]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 92,
                "label": "ContaminationState",
                "type": "Optional[ContaminationStateEnum]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 92,
                "label": "SmokeSensitivityLevel",
                "type": "Optional[SensitivityEnum]",
                "writable": true
            },
            "12": {
                "id": 12,
                "cluster_id": 92,
                "label": "ExpiryDate",
                "type": "Optional[epoch-s]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 92,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 92,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 92,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 92,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 92,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 92,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 92,
                "name": "SelfTestRequest",
                "label": "Self Test Request"
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
                "type": "AlarmBitmap",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 93,
                "label": "Latch",
                "type": "Optional[AlarmBitmap]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 93,
                "label": "State",
                "type": "AlarmBitmap",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 93,
                "label": "Supported",
                "type": "AlarmBitmap",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 93,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 93,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 93,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 93,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 93,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 93,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 93,
                "name": "Reset",
                "label": "Reset"
            },
            "1": {
                "id": 1,
                "cluster_id": 93,
                "name": "ModifyEnabledAlarms",
                "label": "Modify Enabled Alarms"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 94,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 94,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 94,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 94,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 94,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 94,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 94,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 94,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 94,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 94,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "elapsed-s",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 95,
                "label": "MaxCookTime",
                "type": "elapsed-s",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 95,
                "label": "PowerSetting",
                "type": "Optional[uint8]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 95,
                "label": "MinPower",
                "type": "Optional[uint8]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 95,
                "label": "MaxPower",
                "type": "Optional[uint8]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 95,
                "label": "PowerStep",
                "type": "Optional[uint8]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 95,
                "label": "SupportedWatts",
                "type": "List[uint16]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 95,
                "label": "SelectedWattIndex",
                "type": "Optional[uint8]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 95,
                "label": "WattRating",
                "type": "Optional[uint16]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 95,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 95,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 95,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 95,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 95,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 95,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 95,
                "name": "SetCookingParameters",
                "label": "Set Cooking Parameters"
            },
            "1": {
                "id": 1,
                "cluster_id": 95,
                "name": "AddMoreTime",
                "label": "Add More Time"
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
                "type": "List[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 96,
                "label": "CurrentPhase",
                "type": "Nullable[uint8]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 96,
                "label": "CountdownTime",
                "type": "Optional[Nullable[elapsed-s]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 96,
                "label": "OperationalStateList",
                "type": "List[OperationalStateStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 96,
                "label": "OperationalState",
                "type": "OperationalStateEnum",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 96,
                "label": "OperationalError",
                "type": "ErrorStateStruct",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 96,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 96,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 96,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 96,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 96,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 96,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 96,
                "name": "Pause",
                "label": "Pause"
            },
            "1": {
                "id": 1,
                "cluster_id": 96,
                "name": "Stop",
                "label": "Stop"
            },
            "2": {
                "id": 2,
                "cluster_id": 96,
                "name": "Start",
                "label": "Start"
            },
            "3": {
                "id": 3,
                "cluster_id": 96,
                "name": "Resume",
                "label": "Resume"
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
                "type": "List[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 97,
                "label": "CurrentPhase",
                "type": "Nullable[uint8]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 97,
                "label": "CountdownTime",
                "type": "Optional[Nullable[elapsed-s]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 97,
                "label": "OperationalStateList",
                "type": "List[OperationalStateStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 97,
                "label": "OperationalState",
                "type": "OperationalStateEnum",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 97,
                "label": "OperationalError",
                "type": "ErrorStateStruct",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 97,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 97,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 97,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 97,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 97,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 97,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 97,
                "name": "Pause",
                "label": "Pause"
            },
            "1": {
                "id": 1,
                "cluster_id": 97,
                "name": "Stop",
                "label": "Stop"
            },
            "2": {
                "id": 2,
                "cluster_id": 97,
                "name": "Start",
                "label": "Start"
            },
            "3": {
                "id": 3,
                "cluster_id": 97,
                "name": "Resume",
                "label": "Resume"
            },
            "128": {
                "id": 128,
                "cluster_id": 97,
                "name": "GoHome",
                "label": "Go Home"
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
                "type": "Optional[unknown]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 98,
                "label": "SceneTableSize",
                "type": "uint16",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 98,
                "label": "FabricSceneInfo",
                "type": "List[SceneInfoStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 98,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 98,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 98,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 98,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 98,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 98,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 98,
                "name": "AddScene",
                "label": "Add Scene"
            },
            "1": {
                "id": 1,
                "cluster_id": 98,
                "name": "ViewScene",
                "label": "View Scene"
            },
            "2": {
                "id": 2,
                "cluster_id": 98,
                "name": "RemoveScene",
                "label": "Remove Scene"
            },
            "3": {
                "id": 3,
                "cluster_id": 98,
                "name": "RemoveAllScenes",
                "label": "Remove All Scenes"
            },
            "4": {
                "id": 4,
                "cluster_id": 98,
                "name": "StoreScene",
                "label": "Store Scene"
            },
            "5": {
                "id": 5,
                "cluster_id": 98,
                "name": "RecallScene",
                "label": "Recall Scene"
            },
            "6": {
                "id": 6,
                "cluster_id": 98,
                "name": "GetSceneMembership",
                "label": "Get Scene Membership"
            },
            "64": {
                "id": 64,
                "cluster_id": 98,
                "name": "CopyScene",
                "label": "Copy Scene"
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
                "type": "Optional[percent]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 113,
                "label": "DegradationDirection",
                "type": "Optional[DegradationDirectionEnum]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 113,
                "label": "ChangeIndication",
                "type": "ChangeIndicationEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 113,
                "label": "InPlaceIndicator",
                "type": "Optional[bool]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 113,
                "label": "LastChangedTime",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": true
            },
            "5": {
                "id": 5,
                "cluster_id": 113,
                "label": "ReplacementProductList",
                "type": "List[ReplacementProductStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 113,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 113,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 113,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 113,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 113,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 113,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 113,
                "name": "ResetCondition",
                "label": "Reset Condition"
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
                "type": "Optional[percent]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 114,
                "label": "DegradationDirection",
                "type": "Optional[DegradationDirectionEnum]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 114,
                "label": "ChangeIndication",
                "type": "ChangeIndicationEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 114,
                "label": "InPlaceIndicator",
                "type": "Optional[bool]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 114,
                "label": "LastChangedTime",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": true
            },
            "5": {
                "id": 5,
                "cluster_id": 114,
                "label": "ReplacementProductList",
                "type": "List[ReplacementProductStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 114,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 114,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 114,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 114,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 114,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 114,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 114,
                "name": "ResetCondition",
                "label": "Reset Condition"
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
                "type": "Optional[percent]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 121,
                "label": "DegradationDirection",
                "type": "Optional[DegradationDirectionEnum]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 121,
                "label": "ChangeIndication",
                "type": "ChangeIndicationEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 121,
                "label": "InPlaceIndicator",
                "type": "Optional[bool]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 121,
                "label": "LastChangedTime",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": true
            },
            "5": {
                "id": 5,
                "cluster_id": 121,
                "label": "ReplacementProductList",
                "type": "List[ReplacementProductStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 121,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 121,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 121,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 121,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 121,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 121,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 121,
                "name": "ResetCondition",
                "label": "Reset Condition"
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
                "type": "Optional[uint8]",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 128,
                "label": "SupportedSensitivityLevels",
                "type": "Optional[uint8]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 128,
                "label": "DefaultSensitivityLevel",
                "type": "Optional[uint8]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 128,
                "label": "AlarmsActive",
                "type": "Optional[AlarmModeBitmap]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 128,
                "label": "AlarmsSuppressed",
                "type": "Optional[AlarmModeBitmap]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 128,
                "label": "AlarmsEnabled",
                "type": "Optional[AlarmModeBitmap]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 128,
                "label": "AlarmsSupported",
                "type": "Optional[AlarmModeBitmap]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 128,
                "label": "SensorFault",
                "type": "Optional[SensorFaultBitmap]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 128,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 128,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 128,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 128,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 128,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 128,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 128,
                "name": "SuppressAlarm",
                "label": "Suppress Alarm"
            },
            "1": {
                "id": 1,
                "cluster_id": 128,
                "name": "EnableDisableAlarm",
                "label": "Enable Disable Alarm"
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
                "type": "Nullable[elapsed-s]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 129,
                "label": "DefaultOpenDuration",
                "type": "Nullable[elapsed-s]",
                "writable": true
            },
            "2": {
                "id": 2,
                "cluster_id": 129,
                "label": "AutoCloseTime",
                "type": "Optional[Nullable[epoch-us]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 129,
                "label": "RemainingDuration",
                "type": "Nullable[elapsed-s]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 129,
                "label": "CurrentState",
                "type": "Nullable[ValveStateEnum]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 129,
                "label": "TargetState",
                "type": "Nullable[ValveStateEnum]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 129,
                "label": "CurrentLevel",
                "type": "Optional[Nullable[percent]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 129,
                "label": "TargetLevel",
                "type": "Optional[Nullable[percent]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 129,
                "label": "DefaultOpenLevel",
                "type": "Optional[percent]",
                "writable": true
            },
            "9": {
                "id": 9,
                "cluster_id": 129,
                "label": "ValveFault",
                "type": "Optional[ValveFaultBitmap]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 129,
                "label": "LevelStep",
                "type": "Optional[uint8]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 129,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 129,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 129,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 129,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 129,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 129,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 129,
                "name": "Open",
                "label": "Open"
            },
            "1": {
                "id": 1,
                "cluster_id": 129,
                "name": "Close",
                "label": "Close"
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
                "type": "PowerModeEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 144,
                "label": "NumberOfMeasurementTypes",
                "type": "uint8",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 144,
                "label": "Accuracy",
                "type": "List[MeasurementAccuracyStruct]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 144,
                "label": "Ranges",
                "type": "List[MeasurementRangeStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 144,
                "label": "Voltage",
                "type": "Optional[Nullable[voltage-mV]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 144,
                "label": "ActiveCurrent",
                "type": "Optional[Nullable[amperage-mA]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 144,
                "label": "ReactiveCurrent",
                "type": "Optional[Nullable[amperage-mA]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 144,
                "label": "ApparentCurrent",
                "type": "Optional[Nullable[amperage-mA]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 144,
                "label": "ActivePower",
                "type": "Nullable[power-mW]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 144,
                "label": "ReactivePower",
                "type": "Optional[Nullable[power-mVAR]]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 144,
                "label": "ApparentPower",
                "type": "Optional[Nullable[power-mVA]]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 144,
                "label": "RmsVoltage",
                "type": "Optional[Nullable[voltage-mV]]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 144,
                "label": "RmsCurrent",
                "type": "Optional[Nullable[amperage-mA]]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 144,
                "label": "RmsPower",
                "type": "Optional[Nullable[power-mW]]",
                "writable": false
            },
            "14": {
                "id": 14,
                "cluster_id": 144,
                "label": "Frequency",
                "type": "Optional[Nullable[int64]]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 144,
                "label": "HarmonicCurrents",
                "type": "List[HarmonicMeasurementStruct]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 144,
                "label": "HarmonicPhases",
                "type": "List[HarmonicMeasurementStruct]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 144,
                "label": "PowerFactor",
                "type": "Optional[Nullable[int64]]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 144,
                "label": "NeutralCurrent",
                "type": "Optional[Nullable[amperage-mA]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 144,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 144,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 144,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 144,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 144,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 144,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "145": {
        "id": 145,
        "label": "ElectricalEnergyMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 145,
                "label": "Accuracy",
                "type": "MeasurementAccuracyStruct",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 145,
                "label": "CumulativeEnergyImported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 145,
                "label": "CumulativeEnergyExported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 145,
                "label": "PeriodicEnergyImported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 145,
                "label": "PeriodicEnergyExported",
                "type": "Optional[Nullable[EnergyMeasurementStruct]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 145,
                "label": "CumulativeEnergyReset",
                "type": "Optional[Nullable[CumulativeEnergyResetStruct]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 145,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 145,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 145,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 145,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 145,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 145,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "148": {
        "id": 148,
        "label": "WaterHeaterManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 148,
                "label": "HeaterTypes",
                "type": "WaterHeaterHeatSourceBitmap",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 148,
                "label": "HeatDemand",
                "type": "WaterHeaterHeatSourceBitmap",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 148,
                "label": "TankVolume",
                "type": "Optional[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 148,
                "label": "EstimatedHeatRequired",
                "type": "Optional[energy-mWh]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 148,
                "label": "TankPercentage",
                "type": "Optional[percent]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 148,
                "label": "BoostState",
                "type": "BoostStateEnum",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 148,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 148,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 148,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 148,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 148,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 148,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 148,
                "name": "Boost",
                "label": "Boost"
            },
            "1": {
                "id": 1,
                "cluster_id": 148,
                "name": "CancelBoost",
                "label": "Cancel Boost"
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
                "type": "List[MessageStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 151,
                "label": "ActiveMessageIDs",
                "type": "List[MessageID]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 151,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 151,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 151,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 151,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 151,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 151,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 151,
                "name": "PresentMessagesRequest",
                "label": "Present Messages Request"
            },
            "1": {
                "id": 1,
                "cluster_id": 151,
                "name": "CancelMessagesRequest",
                "label": "Cancel Messages Request"
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
                "type": "ESATypeEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 152,
                "label": "EsaCanGenerate",
                "type": "bool",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 152,
                "label": "EsaState",
                "type": "ESAStateEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 152,
                "label": "AbsMinPower",
                "type": "power-mW",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 152,
                "label": "AbsMaxPower",
                "type": "power-mW",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 152,
                "label": "PowerAdjustmentCapability",
                "type": "Optional[Nullable[PowerAdjustCapabilityStruct]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 152,
                "label": "Forecast",
                "type": "Optional[Nullable[ForecastStruct]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 152,
                "label": "OptOutState",
                "type": "Optional[OptOutStateEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 152,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 152,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 152,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 152,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 152,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 152,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 152,
                "name": "PowerAdjustRequest",
                "label": "Power Adjust Request"
            },
            "1": {
                "id": 1,
                "cluster_id": 152,
                "name": "CancelPowerAdjustRequest",
                "label": "Cancel Power Adjust Request"
            },
            "2": {
                "id": 2,
                "cluster_id": 152,
                "name": "StartTimeAdjustRequest",
                "label": "Start Time Adjust Request"
            },
            "3": {
                "id": 3,
                "cluster_id": 152,
                "name": "PauseRequest",
                "label": "Pause Request"
            },
            "4": {
                "id": 4,
                "cluster_id": 152,
                "name": "ResumeRequest",
                "label": "Resume Request"
            },
            "5": {
                "id": 5,
                "cluster_id": 152,
                "name": "ModifyForecastRequest",
                "label": "Modify Forecast Request"
            },
            "6": {
                "id": 6,
                "cluster_id": 152,
                "name": "RequestConstraintBasedForecast",
                "label": "Request Constraint Based Forecast"
            },
            "7": {
                "id": 7,
                "cluster_id": 152,
                "name": "CancelRequest",
                "label": "Cancel Request"
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
                "type": "Nullable[StateEnum]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 153,
                "label": "SupplyState",
                "type": "SupplyStateEnum",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 153,
                "label": "FaultState",
                "type": "FaultStateEnum",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 153,
                "label": "ChargingEnabledUntil",
                "type": "Nullable[epoch-s]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 153,
                "label": "DischargingEnabledUntil",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 153,
                "label": "CircuitCapacity",
                "type": "amperage-mA",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 153,
                "label": "MinimumChargeCurrent",
                "type": "amperage-mA",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 153,
                "label": "MaximumChargeCurrent",
                "type": "amperage-mA",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 153,
                "label": "MaximumDischargeCurrent",
                "type": "Optional[amperage-mA]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 153,
                "label": "UserMaximumChargeCurrent",
                "type": "Optional[amperage-mA]",
                "writable": true
            },
            "10": {
                "id": 10,
                "cluster_id": 153,
                "label": "RandomizationDelayWindow",
                "type": "Optional[elapsed-s]",
                "writable": true
            },
            "35": {
                "id": 35,
                "cluster_id": 153,
                "label": "NextChargeStartTime",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": false
            },
            "36": {
                "id": 36,
                "cluster_id": 153,
                "label": "NextChargeTargetTime",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": false
            },
            "37": {
                "id": 37,
                "cluster_id": 153,
                "label": "NextChargeRequiredEnergy",
                "type": "Optional[Nullable[energy-mWh]]",
                "writable": false
            },
            "38": {
                "id": 38,
                "cluster_id": 153,
                "label": "NextChargeTargetSoC",
                "type": "Optional[Nullable[percent]]",
                "writable": false
            },
            "39": {
                "id": 39,
                "cluster_id": 153,
                "label": "ApproximateEvEfficiency",
                "type": "Optional[Nullable[uint16]]",
                "writable": true
            },
            "48": {
                "id": 48,
                "cluster_id": 153,
                "label": "StateOfCharge",
                "type": "Optional[Nullable[percent]]",
                "writable": false
            },
            "49": {
                "id": 49,
                "cluster_id": 153,
                "label": "BatteryCapacity",
                "type": "Optional[Nullable[energy-mWh]]",
                "writable": false
            },
            "50": {
                "id": 50,
                "cluster_id": 153,
                "label": "VehicleId",
                "type": "Optional[Nullable[string]]",
                "writable": false
            },
            "64": {
                "id": 64,
                "cluster_id": 153,
                "label": "SessionId",
                "type": "Nullable[uint32]",
                "writable": false
            },
            "65": {
                "id": 65,
                "cluster_id": 153,
                "label": "SessionDuration",
                "type": "Nullable[elapsed-s]",
                "writable": false
            },
            "66": {
                "id": 66,
                "cluster_id": 153,
                "label": "SessionEnergyCharged",
                "type": "Nullable[energy-mWh]",
                "writable": false
            },
            "67": {
                "id": 67,
                "cluster_id": 153,
                "label": "SessionEnergyDischarged",
                "type": "Optional[Nullable[energy-mWh]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 153,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 153,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 153,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 153,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 153,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 153,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "1": {
                "id": 1,
                "cluster_id": 153,
                "name": "Disable",
                "label": "Disable"
            },
            "2": {
                "id": 2,
                "cluster_id": 153,
                "name": "EnableCharging",
                "label": "Enable Charging"
            },
            "3": {
                "id": 3,
                "cluster_id": 153,
                "name": "EnableDischarging",
                "label": "Enable Discharging"
            },
            "4": {
                "id": 4,
                "cluster_id": 153,
                "name": "StartDiagnostics",
                "label": "Start Diagnostics"
            },
            "5": {
                "id": 5,
                "cluster_id": 153,
                "name": "SetTargets",
                "label": "Set Targets"
            },
            "6": {
                "id": 6,
                "cluster_id": 153,
                "name": "GetTargets",
                "label": "Get Targets"
            },
            "7": {
                "id": 7,
                "cluster_id": 153,
                "name": "ClearTargets",
                "label": "Clear Targets"
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
                "type": "List[BalanceStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 155,
                "label": "CurrentEnergyBalance",
                "type": "Optional[uint8]",
                "writable": true
            },
            "2": {
                "id": 2,
                "cluster_id": 155,
                "label": "EnergyPriorities",
                "type": "List[EnergyPriorityEnum]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 155,
                "label": "LowPowerModeSensitivities",
                "type": "List[BalanceStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 155,
                "label": "CurrentLowPowerModeSensitivity",
                "type": "Optional[uint8]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 155,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 155,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 155,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 155,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 155,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 155,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "156": {
        "id": 156,
        "label": "PowerTopology",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 156,
                "label": "AvailableEndpoints",
                "type": "List[endpoint-no]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 156,
                "label": "ActiveEndpoints",
                "type": "List[endpoint-no]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 156,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 156,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 156,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 156,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 156,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 156,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "157": {
        "id": 157,
        "label": "EnergyEvseMode",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 157,
                "label": "SupportedModes",
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 157,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 157,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 157,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 157,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 157,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 157,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 157,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 157,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 157,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 157,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 158,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 158,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 158,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 158,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 158,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 158,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 158,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 158,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 158,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 158,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "unknown",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 159,
                "label": "CurrentMode",
                "type": "unknown",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 159,
                "label": "StartUpMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 159,
                "label": "OnMode",
                "type": "Optional[Nullable[unknown]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 159,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 159,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 159,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 159,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 159,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 159,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 159,
                "name": "ChangeToMode",
                "label": "Change To Mode"
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
                "type": "Nullable[LockStateEnum]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 257,
                "label": "LockType",
                "type": "LockTypeEnum",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 257,
                "label": "ActuatorEnabled",
                "type": "bool",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 257,
                "label": "DoorState",
                "type": "Optional[Nullable[DoorStateEnum]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 257,
                "label": "DoorOpenEvents",
                "type": "Optional[uint32]",
                "writable": true
            },
            "5": {
                "id": 5,
                "cluster_id": 257,
                "label": "DoorClosedEvents",
                "type": "Optional[uint32]",
                "writable": true
            },
            "6": {
                "id": 6,
                "cluster_id": 257,
                "label": "OpenPeriod",
                "type": "Optional[uint16]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 257,
                "label": "NumberOfTotalUsersSupported",
                "type": "Optional[uint16]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 257,
                "label": "NumberOfPinUsersSupported",
                "type": "Optional[uint16]",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 257,
                "label": "NumberOfRfidUsersSupported",
                "type": "Optional[uint16]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 257,
                "label": "NumberOfWeekDaySchedulesSupportedPerUser",
                "type": "Optional[uint8]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 257,
                "label": "NumberOfYearDaySchedulesSupportedPerUser",
                "type": "Optional[uint8]",
                "writable": false
            },
            "22": {
                "id": 22,
                "cluster_id": 257,
                "label": "NumberOfHolidaySchedulesSupported",
                "type": "Optional[uint8]",
                "writable": false
            },
            "23": {
                "id": 23,
                "cluster_id": 257,
                "label": "MaxPinCodeLength",
                "type": "Optional[uint8]",
                "writable": false
            },
            "24": {
                "id": 24,
                "cluster_id": 257,
                "label": "MinPinCodeLength",
                "type": "Optional[uint8]",
                "writable": false
            },
            "25": {
                "id": 25,
                "cluster_id": 257,
                "label": "MaxRfidCodeLength",
                "type": "Optional[uint8]",
                "writable": false
            },
            "26": {
                "id": 26,
                "cluster_id": 257,
                "label": "MinRfidCodeLength",
                "type": "Optional[uint8]",
                "writable": false
            },
            "27": {
                "id": 27,
                "cluster_id": 257,
                "label": "CredentialRulesSupport",
                "type": "Optional[CredentialRulesBitmap]",
                "writable": false
            },
            "28": {
                "id": 28,
                "cluster_id": 257,
                "label": "NumberOfCredentialsSupportedPerUser",
                "type": "Optional[uint8]",
                "writable": false
            },
            "33": {
                "id": 33,
                "cluster_id": 257,
                "label": "Language",
                "type": "Optional[string]",
                "writable": true
            },
            "34": {
                "id": 34,
                "cluster_id": 257,
                "label": "LedSettings",
                "type": "Optional[LEDSettingEnum]",
                "writable": true
            },
            "35": {
                "id": 35,
                "cluster_id": 257,
                "label": "AutoRelockTime",
                "type": "Optional[uint32]",
                "writable": true
            },
            "36": {
                "id": 36,
                "cluster_id": 257,
                "label": "SoundVolume",
                "type": "Optional[SoundVolumeEnum]",
                "writable": true
            },
            "37": {
                "id": 37,
                "cluster_id": 257,
                "label": "OperatingMode",
                "type": "OperatingModeEnum",
                "writable": true
            },
            "38": {
                "id": 38,
                "cluster_id": 257,
                "label": "SupportedOperatingModes",
                "type": "OperatingModesBitmap",
                "writable": false
            },
            "39": {
                "id": 39,
                "cluster_id": 257,
                "label": "DefaultConfigurationRegister",
                "type": "Optional[ConfigurationRegisterBitmap]",
                "writable": false
            },
            "40": {
                "id": 40,
                "cluster_id": 257,
                "label": "EnableLocalProgramming",
                "type": "Optional[bool]",
                "writable": true
            },
            "41": {
                "id": 41,
                "cluster_id": 257,
                "label": "EnableOneTouchLocking",
                "type": "Optional[bool]",
                "writable": true
            },
            "42": {
                "id": 42,
                "cluster_id": 257,
                "label": "EnableInsideStatusLed",
                "type": "Optional[bool]",
                "writable": true
            },
            "43": {
                "id": 43,
                "cluster_id": 257,
                "label": "EnablePrivacyModeButton",
                "type": "Optional[bool]",
                "writable": true
            },
            "44": {
                "id": 44,
                "cluster_id": 257,
                "label": "LocalProgrammingFeatures",
                "type": "Optional[LocalProgrammingFeaturesBitmap]",
                "writable": true
            },
            "48": {
                "id": 48,
                "cluster_id": 257,
                "label": "WrongCodeEntryLimit",
                "type": "Optional[uint8]",
                "writable": true
            },
            "49": {
                "id": 49,
                "cluster_id": 257,
                "label": "UserCodeTemporaryDisableTime",
                "type": "Optional[uint8]",
                "writable": true
            },
            "50": {
                "id": 50,
                "cluster_id": 257,
                "label": "SendPinOverTheAir",
                "type": "Optional[bool]",
                "writable": true
            },
            "51": {
                "id": 51,
                "cluster_id": 257,
                "label": "RequirePinForRemoteOperation",
                "type": "Optional[bool]",
                "writable": true
            },
            "52": {
                "id": 52,
                "cluster_id": 257,
                "label": "SecurityLevel",
                "type": "Optional[unknown]",
                "writable": false
            },
            "53": {
                "id": 53,
                "cluster_id": 257,
                "label": "ExpiringUserTimeout",
                "type": "Optional[uint16]",
                "writable": true
            },
            "128": {
                "id": 128,
                "cluster_id": 257,
                "label": "AliroReaderVerificationKey",
                "type": "Optional[Nullable[bytes]]",
                "writable": false
            },
            "129": {
                "id": 129,
                "cluster_id": 257,
                "label": "AliroReaderGroupIdentifier",
                "type": "Optional[Nullable[bytes]]",
                "writable": false
            },
            "130": {
                "id": 130,
                "cluster_id": 257,
                "label": "AliroReaderGroupSubIdentifier",
                "type": "Optional[bytes]",
                "writable": false
            },
            "131": {
                "id": 131,
                "cluster_id": 257,
                "label": "AliroExpeditedTransactionSupportedProtocolVersions",
                "type": "List[octstr]",
                "writable": false
            },
            "132": {
                "id": 132,
                "cluster_id": 257,
                "label": "AliroGroupResolvingKey",
                "type": "Optional[Nullable[bytes]]",
                "writable": false
            },
            "133": {
                "id": 133,
                "cluster_id": 257,
                "label": "AliroSupportedBleuwbProtocolVersions",
                "type": "List[octstr]",
                "writable": false
            },
            "134": {
                "id": 134,
                "cluster_id": 257,
                "label": "AliroBleAdvertisingVersion",
                "type": "Optional[uint8]",
                "writable": false
            },
            "135": {
                "id": 135,
                "cluster_id": 257,
                "label": "NumberOfAliroCredentialIssuerKeysSupported",
                "type": "Optional[uint16]",
                "writable": false
            },
            "136": {
                "id": 136,
                "cluster_id": 257,
                "label": "NumberOfAliroEndpointKeysSupported",
                "type": "Optional[uint16]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 257,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 257,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 257,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 257,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 257,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 257,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 257,
                "name": "LockDoor",
                "label": "Lock Door"
            },
            "1": {
                "id": 1,
                "cluster_id": 257,
                "name": "UnlockDoor",
                "label": "Unlock Door"
            },
            "2": {
                "id": 2,
                "cluster_id": 257,
                "name": "Toggle",
                "label": "Toggle"
            },
            "3": {
                "id": 3,
                "cluster_id": 257,
                "name": "UnlockWithTimeout",
                "label": "Unlock With Timeout"
            },
            "5": {
                "id": 5,
                "cluster_id": 257,
                "name": "SetPinCode",
                "label": "Set Pin Code"
            },
            "6": {
                "id": 6,
                "cluster_id": 257,
                "name": "GetPinCode",
                "label": "Get Pin Code"
            },
            "7": {
                "id": 7,
                "cluster_id": 257,
                "name": "ClearPinCode",
                "label": "Clear Pin Code"
            },
            "8": {
                "id": 8,
                "cluster_id": 257,
                "name": "ClearAllPinCodes",
                "label": "Clear All Pin Codes"
            },
            "9": {
                "id": 9,
                "cluster_id": 257,
                "name": "SetUserStatus",
                "label": "Set User Status"
            },
            "10": {
                "id": 10,
                "cluster_id": 257,
                "name": "GetUserStatus",
                "label": "Get User Status"
            },
            "11": {
                "id": 11,
                "cluster_id": 257,
                "name": "SetWeekDaySchedule",
                "label": "Set Week Day Schedule"
            },
            "12": {
                "id": 12,
                "cluster_id": 257,
                "name": "GetWeekDaySchedule",
                "label": "Get Week Day Schedule"
            },
            "13": {
                "id": 13,
                "cluster_id": 257,
                "name": "ClearWeekDaySchedule",
                "label": "Clear Week Day Schedule"
            },
            "14": {
                "id": 14,
                "cluster_id": 257,
                "name": "SetYearDaySchedule",
                "label": "Set Year Day Schedule"
            },
            "15": {
                "id": 15,
                "cluster_id": 257,
                "name": "GetYearDaySchedule",
                "label": "Get Year Day Schedule"
            },
            "16": {
                "id": 16,
                "cluster_id": 257,
                "name": "ClearYearDaySchedule",
                "label": "Clear Year Day Schedule"
            },
            "17": {
                "id": 17,
                "cluster_id": 257,
                "name": "SetHolidaySchedule",
                "label": "Set Holiday Schedule"
            },
            "18": {
                "id": 18,
                "cluster_id": 257,
                "name": "GetHolidaySchedule",
                "label": "Get Holiday Schedule"
            },
            "19": {
                "id": 19,
                "cluster_id": 257,
                "name": "ClearHolidaySchedule",
                "label": "Clear Holiday Schedule"
            },
            "20": {
                "id": 20,
                "cluster_id": 257,
                "name": "SetUserType",
                "label": "Set User Type"
            },
            "21": {
                "id": 21,
                "cluster_id": 257,
                "name": "GetUserType",
                "label": "Get User Type"
            },
            "22": {
                "id": 22,
                "cluster_id": 257,
                "name": "SetRfidCode",
                "label": "Set Rfid Code"
            },
            "23": {
                "id": 23,
                "cluster_id": 257,
                "name": "GetRfidCode",
                "label": "Get Rfid Code"
            },
            "24": {
                "id": 24,
                "cluster_id": 257,
                "name": "ClearRfidCode",
                "label": "Clear Rfid Code"
            },
            "25": {
                "id": 25,
                "cluster_id": 257,
                "name": "ClearAllRfidCodes",
                "label": "Clear All Rfid Codes"
            },
            "26": {
                "id": 26,
                "cluster_id": 257,
                "name": "SetUser",
                "label": "Set User"
            },
            "27": {
                "id": 27,
                "cluster_id": 257,
                "name": "GetUser",
                "label": "Get User"
            },
            "29": {
                "id": 29,
                "cluster_id": 257,
                "name": "ClearUser",
                "label": "Clear User"
            },
            "34": {
                "id": 34,
                "cluster_id": 257,
                "name": "SetCredential",
                "label": "Set Credential"
            },
            "36": {
                "id": 36,
                "cluster_id": 257,
                "name": "GetCredentialStatus",
                "label": "Get Credential Status"
            },
            "38": {
                "id": 38,
                "cluster_id": 257,
                "name": "ClearCredential",
                "label": "Clear Credential"
            },
            "39": {
                "id": 39,
                "cluster_id": 257,
                "name": "UnboltDoor",
                "label": "Unbolt Door"
            },
            "40": {
                "id": 40,
                "cluster_id": 257,
                "name": "SetAliroReaderConfig",
                "label": "Set Aliro Reader Config"
            },
            "41": {
                "id": 41,
                "cluster_id": 257,
                "name": "ClearAliroReaderConfig",
                "label": "Clear Aliro Reader Config"
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
                "type": "TypeEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 258,
                "label": "PhysicalClosedLimitLift",
                "type": "Optional[uint16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 258,
                "label": "PhysicalClosedLimitTilt",
                "type": "Optional[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 258,
                "label": "CurrentPositionLift",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 258,
                "label": "CurrentPositionTilt",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 258,
                "label": "NumberOfActuationsLift",
                "type": "Optional[uint16]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 258,
                "label": "NumberOfActuationsTilt",
                "type": "Optional[uint16]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 258,
                "label": "ConfigStatus",
                "type": "ConfigStatusBitmap",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 258,
                "label": "CurrentPositionLiftPercentage",
                "type": "Optional[Nullable[percent]]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 258,
                "label": "CurrentPositionTiltPercentage",
                "type": "Optional[Nullable[percent]]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 258,
                "label": "OperationalStatus",
                "type": "OperationalStatusBitmap",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 258,
                "label": "TargetPositionLiftPercent100ths",
                "type": "Optional[Nullable[percent100ths]]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 258,
                "label": "TargetPositionTiltPercent100ths",
                "type": "Optional[Nullable[percent100ths]]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 258,
                "label": "EndProductType",
                "type": "EndProductTypeEnum",
                "writable": false
            },
            "14": {
                "id": 14,
                "cluster_id": 258,
                "label": "CurrentPositionLiftPercent100ths",
                "type": "Optional[Nullable[percent100ths]]",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 258,
                "label": "CurrentPositionTiltPercent100ths",
                "type": "Optional[Nullable[percent100ths]]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 258,
                "label": "InstalledOpenLimitLift",
                "type": "Optional[uint16]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 258,
                "label": "InstalledClosedLimitLift",
                "type": "Optional[uint16]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 258,
                "label": "InstalledOpenLimitTilt",
                "type": "Optional[uint16]",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 258,
                "label": "InstalledClosedLimitTilt",
                "type": "Optional[uint16]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 258,
                "label": "VelocityLift",
                "type": "Optional[unknown]",
                "writable": true
            },
            "21": {
                "id": 21,
                "cluster_id": 258,
                "label": "AccelerationTimeLift",
                "type": "Optional[unknown]",
                "writable": true
            },
            "22": {
                "id": 22,
                "cluster_id": 258,
                "label": "DecelerationTimeLift",
                "type": "Optional[unknown]",
                "writable": true
            },
            "23": {
                "id": 23,
                "cluster_id": 258,
                "label": "Mode",
                "type": "ModeBitmap",
                "writable": true
            },
            "24": {
                "id": 24,
                "cluster_id": 258,
                "label": "IntermediateSetpointsLift",
                "type": "Optional[unknown]",
                "writable": true
            },
            "25": {
                "id": 25,
                "cluster_id": 258,
                "label": "IntermediateSetpointsTilt",
                "type": "Optional[unknown]",
                "writable": true
            },
            "26": {
                "id": 26,
                "cluster_id": 258,
                "label": "SafetyStatus",
                "type": "Optional[SafetyStatusBitmap]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 258,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 258,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 258,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 258,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 258,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 258,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 258,
                "name": "UpOrOpen",
                "label": "Up Or Open"
            },
            "1": {
                "id": 1,
                "cluster_id": 258,
                "name": "DownOrClose",
                "label": "Down Or Close"
            },
            "2": {
                "id": 2,
                "cluster_id": 258,
                "name": "StopMotion",
                "label": "Stop Motion"
            },
            "4": {
                "id": 4,
                "cluster_id": 258,
                "name": "GoToLiftValue",
                "label": "Go To Lift Value"
            },
            "5": {
                "id": 5,
                "cluster_id": 258,
                "name": "GoToLiftPercentage",
                "label": "Go To Lift Percentage"
            },
            "7": {
                "id": 7,
                "cluster_id": 258,
                "name": "GoToTiltValue",
                "label": "Go To Tilt Value"
            },
            "8": {
                "id": 8,
                "cluster_id": 258,
                "name": "GoToTiltPercentage",
                "label": "Go To Tilt Percentage"
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
                "type": "List[AreaStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 336,
                "label": "SupportedMaps",
                "type": "List[MapStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 336,
                "label": "SelectedAreas",
                "type": "List[uint32]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 336,
                "label": "CurrentArea",
                "type": "Optional[Nullable[uint32]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 336,
                "label": "EstimatedEndTime",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 336,
                "label": "Progress",
                "type": "List[ProgressStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 336,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 336,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 336,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 336,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 336,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 336,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 336,
                "name": "SelectAreas",
                "label": "Select Areas"
            },
            "2": {
                "id": 2,
                "cluster_id": 336,
                "name": "SkipArea",
                "label": "Skip Area"
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
                "type": "Nullable[int16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 512,
                "label": "MaxSpeed",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 512,
                "label": "MaxFlow",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 512,
                "label": "MinConstPressure",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 512,
                "label": "MaxConstPressure",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 512,
                "label": "MinCompPressure",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 512,
                "label": "MaxCompPressure",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 512,
                "label": "MinConstSpeed",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 512,
                "label": "MaxConstSpeed",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 512,
                "label": "MinConstFlow",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 512,
                "label": "MaxConstFlow",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 512,
                "label": "MinConstTemp",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 512,
                "label": "MaxConstTemp",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 512,
                "label": "PumpStatus",
                "type": "Optional[PumpStatusBitmap]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 512,
                "label": "EffectiveOperationMode",
                "type": "OperationModeEnum",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 512,
                "label": "EffectiveControlMode",
                "type": "ControlModeEnum",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 512,
                "label": "Capacity",
                "type": "Nullable[int16]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 512,
                "label": "Speed",
                "type": "Optional[Nullable[uint16]]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 512,
                "label": "LifetimeRunningHours",
                "type": "Optional[Nullable[uint24]]",
                "writable": true
            },
            "22": {
                "id": 22,
                "cluster_id": 512,
                "label": "Power",
                "type": "Optional[Nullable[uint24]]",
                "writable": false
            },
            "23": {
                "id": 23,
                "cluster_id": 512,
                "label": "LifetimeEnergyConsumed",
                "type": "Optional[Nullable[uint32]]",
                "writable": true
            },
            "32": {
                "id": 32,
                "cluster_id": 512,
                "label": "OperationMode",
                "type": "OperationModeEnum",
                "writable": true
            },
            "33": {
                "id": 33,
                "cluster_id": 512,
                "label": "ControlMode",
                "type": "Optional[ControlModeEnum]",
                "writable": true
            },
            "34": {
                "id": 34,
                "cluster_id": 512,
                "label": "AlarmMask",
                "type": "Optional[uint16]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 512,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 512,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 512,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 512,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 512,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 512,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "513": {
        "id": 513,
        "label": "Thermostat",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 513,
                "label": "LocalTemperature",
                "type": "Nullable[temperature]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 513,
                "label": "OutdoorTemperature",
                "type": "Optional[Nullable[temperature]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 513,
                "label": "Occupancy",
                "type": "Optional[OccupancyBitmap]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 513,
                "label": "AbsMinHeatSetpointLimit",
                "type": "Optional[temperature]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 513,
                "label": "AbsMaxHeatSetpointLimit",
                "type": "Optional[temperature]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 513,
                "label": "AbsMinCoolSetpointLimit",
                "type": "Optional[temperature]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 513,
                "label": "AbsMaxCoolSetpointLimit",
                "type": "Optional[temperature]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 513,
                "label": "PiCoolingDemand",
                "type": "Optional[uint8]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 513,
                "label": "PiHeatingDemand",
                "type": "Optional[uint8]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 513,
                "label": "HvacSystemTypeConfiguration",
                "type": "Optional[HVACSystemTypeBitmap]",
                "writable": true
            },
            "16": {
                "id": 16,
                "cluster_id": 513,
                "label": "LocalTemperatureCalibration",
                "type": "Optional[SignedTemperature]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 513,
                "label": "OccupiedCoolingSetpoint",
                "type": "Optional[temperature]",
                "writable": true
            },
            "18": {
                "id": 18,
                "cluster_id": 513,
                "label": "OccupiedHeatingSetpoint",
                "type": "Optional[temperature]",
                "writable": true
            },
            "19": {
                "id": 19,
                "cluster_id": 513,
                "label": "UnoccupiedCoolingSetpoint",
                "type": "Optional[temperature]",
                "writable": true
            },
            "20": {
                "id": 20,
                "cluster_id": 513,
                "label": "UnoccupiedHeatingSetpoint",
                "type": "Optional[temperature]",
                "writable": true
            },
            "21": {
                "id": 21,
                "cluster_id": 513,
                "label": "MinHeatSetpointLimit",
                "type": "Optional[temperature]",
                "writable": true
            },
            "22": {
                "id": 22,
                "cluster_id": 513,
                "label": "MaxHeatSetpointLimit",
                "type": "Optional[temperature]",
                "writable": true
            },
            "23": {
                "id": 23,
                "cluster_id": 513,
                "label": "MinCoolSetpointLimit",
                "type": "Optional[temperature]",
                "writable": true
            },
            "24": {
                "id": 24,
                "cluster_id": 513,
                "label": "MaxCoolSetpointLimit",
                "type": "Optional[temperature]",
                "writable": true
            },
            "25": {
                "id": 25,
                "cluster_id": 513,
                "label": "MinSetpointDeadBand",
                "type": "Optional[SignedTemperature]",
                "writable": true
            },
            "26": {
                "id": 26,
                "cluster_id": 513,
                "label": "RemoteSensing",
                "type": "Optional[RemoteSensingBitmap]",
                "writable": true
            },
            "27": {
                "id": 27,
                "cluster_id": 513,
                "label": "ControlSequenceOfOperation",
                "type": "ControlSequenceOfOperationEnum",
                "writable": true
            },
            "28": {
                "id": 28,
                "cluster_id": 513,
                "label": "SystemMode",
                "type": "SystemModeEnum",
                "writable": true
            },
            "30": {
                "id": 30,
                "cluster_id": 513,
                "label": "ThermostatRunningMode",
                "type": "Optional[ThermostatRunningModeEnum]",
                "writable": false
            },
            "32": {
                "id": 32,
                "cluster_id": 513,
                "label": "StartOfWeek",
                "type": "Optional[StartOfWeekEnum]",
                "writable": false
            },
            "33": {
                "id": 33,
                "cluster_id": 513,
                "label": "NumberOfWeeklyTransitions",
                "type": "Optional[uint8]",
                "writable": false
            },
            "34": {
                "id": 34,
                "cluster_id": 513,
                "label": "NumberOfDailyTransitions",
                "type": "Optional[uint8]",
                "writable": false
            },
            "35": {
                "id": 35,
                "cluster_id": 513,
                "label": "TemperatureSetpointHold",
                "type": "Optional[TemperatureSetpointHoldEnum]",
                "writable": true
            },
            "36": {
                "id": 36,
                "cluster_id": 513,
                "label": "TemperatureSetpointHoldDuration",
                "type": "Optional[Nullable[uint16]]",
                "writable": true
            },
            "37": {
                "id": 37,
                "cluster_id": 513,
                "label": "ThermostatProgrammingOperationMode",
                "type": "Optional[ProgrammingOperationModeBitmap]",
                "writable": true
            },
            "41": {
                "id": 41,
                "cluster_id": 513,
                "label": "ThermostatRunningState",
                "type": "Optional[RelayStateBitmap]",
                "writable": false
            },
            "48": {
                "id": 48,
                "cluster_id": 513,
                "label": "SetpointChangeSource",
                "type": "Optional[SetpointChangeSourceEnum]",
                "writable": false
            },
            "49": {
                "id": 49,
                "cluster_id": 513,
                "label": "SetpointChangeAmount",
                "type": "Optional[Nullable[TemperatureDifference]]",
                "writable": false
            },
            "50": {
                "id": 50,
                "cluster_id": 513,
                "label": "SetpointChangeSourceTimestamp",
                "type": "Optional[epoch-s]",
                "writable": false
            },
            "52": {
                "id": 52,
                "cluster_id": 513,
                "label": "OccupiedSetback",
                "type": "Optional[Nullable[UnsignedTemperature]]",
                "writable": true
            },
            "53": {
                "id": 53,
                "cluster_id": 513,
                "label": "OccupiedSetbackMin",
                "type": "Optional[Nullable[UnsignedTemperature]]",
                "writable": false
            },
            "54": {
                "id": 54,
                "cluster_id": 513,
                "label": "OccupiedSetbackMax",
                "type": "Optional[Nullable[UnsignedTemperature]]",
                "writable": false
            },
            "55": {
                "id": 55,
                "cluster_id": 513,
                "label": "UnoccupiedSetback",
                "type": "Optional[Nullable[UnsignedTemperature]]",
                "writable": true
            },
            "56": {
                "id": 56,
                "cluster_id": 513,
                "label": "UnoccupiedSetbackMin",
                "type": "Optional[Nullable[UnsignedTemperature]]",
                "writable": false
            },
            "57": {
                "id": 57,
                "cluster_id": 513,
                "label": "UnoccupiedSetbackMax",
                "type": "Optional[Nullable[UnsignedTemperature]]",
                "writable": false
            },
            "58": {
                "id": 58,
                "cluster_id": 513,
                "label": "EmergencyHeatDelta",
                "type": "Optional[UnsignedTemperature]",
                "writable": true
            },
            "64": {
                "id": 64,
                "cluster_id": 513,
                "label": "AcType",
                "type": "Optional[ACTypeEnum]",
                "writable": true
            },
            "65": {
                "id": 65,
                "cluster_id": 513,
                "label": "AcCapacity",
                "type": "Optional[uint16]",
                "writable": true
            },
            "66": {
                "id": 66,
                "cluster_id": 513,
                "label": "AcRefrigerantType",
                "type": "Optional[ACRefrigerantTypeEnum]",
                "writable": true
            },
            "67": {
                "id": 67,
                "cluster_id": 513,
                "label": "AcCompressorType",
                "type": "Optional[ACCompressorTypeEnum]",
                "writable": true
            },
            "68": {
                "id": 68,
                "cluster_id": 513,
                "label": "AcErrorCode",
                "type": "Optional[ACErrorCodeBitmap]",
                "writable": true
            },
            "69": {
                "id": 69,
                "cluster_id": 513,
                "label": "AcLouverPosition",
                "type": "Optional[ACLouverPositionEnum]",
                "writable": true
            },
            "70": {
                "id": 70,
                "cluster_id": 513,
                "label": "AcCoilTemperature",
                "type": "Optional[Nullable[temperature]]",
                "writable": false
            },
            "71": {
                "id": 71,
                "cluster_id": 513,
                "label": "AcCapacityFormat",
                "type": "Optional[ACCapacityFormatEnum]",
                "writable": true
            },
            "72": {
                "id": 72,
                "cluster_id": 513,
                "label": "PresetTypes",
                "type": "List[PresetTypeStruct]",
                "writable": false
            },
            "73": {
                "id": 73,
                "cluster_id": 513,
                "label": "ScheduleTypes",
                "type": "List[ScheduleTypeStruct]",
                "writable": false
            },
            "74": {
                "id": 74,
                "cluster_id": 513,
                "label": "NumberOfPresets",
                "type": "Optional[uint8]",
                "writable": false
            },
            "75": {
                "id": 75,
                "cluster_id": 513,
                "label": "NumberOfSchedules",
                "type": "Optional[uint8]",
                "writable": false
            },
            "76": {
                "id": 76,
                "cluster_id": 513,
                "label": "NumberOfScheduleTransitions",
                "type": "Optional[uint8]",
                "writable": false
            },
            "77": {
                "id": 77,
                "cluster_id": 513,
                "label": "NumberOfScheduleTransitionPerDay",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "78": {
                "id": 78,
                "cluster_id": 513,
                "label": "ActivePresetHandle",
                "type": "Optional[Nullable[bytes]]",
                "writable": false
            },
            "79": {
                "id": 79,
                "cluster_id": 513,
                "label": "ActiveScheduleHandle",
                "type": "Optional[Nullable[bytes]]",
                "writable": false
            },
            "80": {
                "id": 80,
                "cluster_id": 513,
                "label": "Presets",
                "type": "List[PresetStruct]",
                "writable": true
            },
            "81": {
                "id": 81,
                "cluster_id": 513,
                "label": "Schedules",
                "type": "List[ScheduleStruct]",
                "writable": true
            },
            "82": {
                "id": 82,
                "cluster_id": 513,
                "label": "SetpointHoldExpiryTimestamp",
                "type": "Optional[Nullable[epoch-s]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 513,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 513,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 513,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 513,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 513,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 513,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 513,
                "name": "SetpointRaiseLower",
                "label": "Setpoint Raise Lower"
            },
            "1": {
                "id": 1,
                "cluster_id": 513,
                "name": "SetWeeklySchedule",
                "label": "Set Weekly Schedule"
            },
            "2": {
                "id": 2,
                "cluster_id": 513,
                "name": "GetWeeklySchedule",
                "label": "Get Weekly Schedule"
            },
            "3": {
                "id": 3,
                "cluster_id": 513,
                "name": "ClearWeeklySchedule",
                "label": "Clear Weekly Schedule"
            },
            "5": {
                "id": 5,
                "cluster_id": 513,
                "name": "SetActiveScheduleRequest",
                "label": "Set Active Schedule Request"
            },
            "6": {
                "id": 6,
                "cluster_id": 513,
                "name": "SetActivePresetRequest",
                "label": "Set Active Preset Request"
            },
            "254": {
                "id": 254,
                "cluster_id": 513,
                "name": "AtomicRequest",
                "label": "Atomic Request"
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
                "type": "FanModeEnum",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 514,
                "label": "FanModeSequence",
                "type": "FanModeSequenceEnum",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 514,
                "label": "PercentSetting",
                "type": "Nullable[percent]",
                "writable": true
            },
            "3": {
                "id": 3,
                "cluster_id": 514,
                "label": "PercentCurrent",
                "type": "percent",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 514,
                "label": "SpeedMax",
                "type": "Optional[uint8]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 514,
                "label": "SpeedSetting",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "6": {
                "id": 6,
                "cluster_id": 514,
                "label": "SpeedCurrent",
                "type": "Optional[uint8]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 514,
                "label": "RockSupport",
                "type": "Optional[RockBitmap]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 514,
                "label": "RockSetting",
                "type": "Optional[RockBitmap]",
                "writable": true
            },
            "9": {
                "id": 9,
                "cluster_id": 514,
                "label": "WindSupport",
                "type": "Optional[WindBitmap]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 514,
                "label": "WindSetting",
                "type": "Optional[WindBitmap]",
                "writable": true
            },
            "11": {
                "id": 11,
                "cluster_id": 514,
                "label": "AirflowDirection",
                "type": "Optional[AirflowDirectionEnum]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 514,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 514,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 514,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 514,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 514,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 514,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 514,
                "name": "Step",
                "label": "Step"
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
                "type": "TemperatureDisplayModeEnum",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 516,
                "label": "KeypadLockout",
                "type": "KeypadLockoutEnum",
                "writable": true
            },
            "2": {
                "id": 2,
                "cluster_id": 516,
                "label": "ScheduleProgrammingVisibility",
                "type": "Optional[ScheduleProgrammingVisibilityEnum]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 516,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 516,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 516,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 516,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 516,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 516,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "768": {
        "id": 768,
        "label": "ColorControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 768,
                "label": "CurrentHue",
                "type": "Optional[uint8]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 768,
                "label": "CurrentSaturation",
                "type": "Optional[uint8]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 768,
                "label": "RemainingTime",
                "type": "Optional[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 768,
                "label": "CurrentX",
                "type": "Optional[uint16]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 768,
                "label": "CurrentY",
                "type": "Optional[uint16]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 768,
                "label": "DriftCompensation",
                "type": "Optional[DriftCompensationEnum]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 768,
                "label": "CompensationText",
                "type": "Optional[string]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 768,
                "label": "ColorTemperatureMireds",
                "type": "Optional[uint16]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 768,
                "label": "ColorMode",
                "type": "ColorModeEnum",
                "writable": false
            },
            "15": {
                "id": 15,
                "cluster_id": 768,
                "label": "Options",
                "type": "OptionsBitmap",
                "writable": true
            },
            "16": {
                "id": 16,
                "cluster_id": 768,
                "label": "NumberOfPrimaries",
                "type": "Nullable[uint8]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 768,
                "label": "Primary1X",
                "type": "Optional[uint16]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 768,
                "label": "Primary1Y",
                "type": "Optional[uint16]",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 768,
                "label": "Primary1Intensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "21": {
                "id": 21,
                "cluster_id": 768,
                "label": "Primary2X",
                "type": "Optional[uint16]",
                "writable": false
            },
            "22": {
                "id": 22,
                "cluster_id": 768,
                "label": "Primary2Y",
                "type": "Optional[uint16]",
                "writable": false
            },
            "23": {
                "id": 23,
                "cluster_id": 768,
                "label": "Primary2Intensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "25": {
                "id": 25,
                "cluster_id": 768,
                "label": "Primary3X",
                "type": "Optional[uint16]",
                "writable": false
            },
            "26": {
                "id": 26,
                "cluster_id": 768,
                "label": "Primary3Y",
                "type": "Optional[uint16]",
                "writable": false
            },
            "27": {
                "id": 27,
                "cluster_id": 768,
                "label": "Primary3Intensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "32": {
                "id": 32,
                "cluster_id": 768,
                "label": "Primary4X",
                "type": "Optional[uint16]",
                "writable": false
            },
            "33": {
                "id": 33,
                "cluster_id": 768,
                "label": "Primary4Y",
                "type": "Optional[uint16]",
                "writable": false
            },
            "34": {
                "id": 34,
                "cluster_id": 768,
                "label": "Primary4Intensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "36": {
                "id": 36,
                "cluster_id": 768,
                "label": "Primary5X",
                "type": "Optional[uint16]",
                "writable": false
            },
            "37": {
                "id": 37,
                "cluster_id": 768,
                "label": "Primary5Y",
                "type": "Optional[uint16]",
                "writable": false
            },
            "38": {
                "id": 38,
                "cluster_id": 768,
                "label": "Primary5Intensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "40": {
                "id": 40,
                "cluster_id": 768,
                "label": "Primary6X",
                "type": "Optional[uint16]",
                "writable": false
            },
            "41": {
                "id": 41,
                "cluster_id": 768,
                "label": "Primary6Y",
                "type": "Optional[uint16]",
                "writable": false
            },
            "42": {
                "id": 42,
                "cluster_id": 768,
                "label": "Primary6Intensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "48": {
                "id": 48,
                "cluster_id": 768,
                "label": "WhitePointX",
                "type": "Optional[uint16]",
                "writable": true
            },
            "49": {
                "id": 49,
                "cluster_id": 768,
                "label": "WhitePointY",
                "type": "Optional[uint16]",
                "writable": true
            },
            "50": {
                "id": 50,
                "cluster_id": 768,
                "label": "ColorPointRx",
                "type": "Optional[uint16]",
                "writable": true
            },
            "51": {
                "id": 51,
                "cluster_id": 768,
                "label": "ColorPointRy",
                "type": "Optional[uint16]",
                "writable": true
            },
            "52": {
                "id": 52,
                "cluster_id": 768,
                "label": "ColorPointRIntensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "54": {
                "id": 54,
                "cluster_id": 768,
                "label": "ColorPointGx",
                "type": "Optional[uint16]",
                "writable": true
            },
            "55": {
                "id": 55,
                "cluster_id": 768,
                "label": "ColorPointGy",
                "type": "Optional[uint16]",
                "writable": true
            },
            "56": {
                "id": 56,
                "cluster_id": 768,
                "label": "ColorPointGIntensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "58": {
                "id": 58,
                "cluster_id": 768,
                "label": "ColorPointBx",
                "type": "Optional[uint16]",
                "writable": true
            },
            "59": {
                "id": 59,
                "cluster_id": 768,
                "label": "ColorPointBy",
                "type": "Optional[uint16]",
                "writable": true
            },
            "60": {
                "id": 60,
                "cluster_id": 768,
                "label": "ColorPointBIntensity",
                "type": "Optional[Nullable[uint8]]",
                "writable": true
            },
            "16384": {
                "id": 16384,
                "cluster_id": 768,
                "label": "EnhancedCurrentHue",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16385": {
                "id": 16385,
                "cluster_id": 768,
                "label": "EnhancedColorMode",
                "type": "EnhancedColorModeEnum",
                "writable": false
            },
            "16386": {
                "id": 16386,
                "cluster_id": 768,
                "label": "ColorLoopActive",
                "type": "Optional[enum8]",
                "writable": false
            },
            "16387": {
                "id": 16387,
                "cluster_id": 768,
                "label": "ColorLoopDirection",
                "type": "Optional[ColorLoopDirectionEnum]",
                "writable": false
            },
            "16388": {
                "id": 16388,
                "cluster_id": 768,
                "label": "ColorLoopTime",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16389": {
                "id": 16389,
                "cluster_id": 768,
                "label": "ColorLoopStartEnhancedHue",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16390": {
                "id": 16390,
                "cluster_id": 768,
                "label": "ColorLoopStoredEnhancedHue",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16394": {
                "id": 16394,
                "cluster_id": 768,
                "label": "ColorCapabilities",
                "type": "map16",
                "writable": false
            },
            "16395": {
                "id": 16395,
                "cluster_id": 768,
                "label": "ColorTempPhysicalMinMireds",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16396": {
                "id": 16396,
                "cluster_id": 768,
                "label": "ColorTempPhysicalMaxMireds",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16397": {
                "id": 16397,
                "cluster_id": 768,
                "label": "CoupleColorTempToLevelMinMireds",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16400": {
                "id": 16400,
                "cluster_id": 768,
                "label": "StartUpColorTemperatureMireds",
                "type": "Optional[Nullable[uint16]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 768,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 768,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 768,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 768,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 768,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 768,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 768,
                "name": "MoveToHue",
                "label": "Move To Hue"
            },
            "1": {
                "id": 1,
                "cluster_id": 768,
                "name": "MoveHue",
                "label": "Move Hue"
            },
            "2": {
                "id": 2,
                "cluster_id": 768,
                "name": "StepHue",
                "label": "Step Hue"
            },
            "3": {
                "id": 3,
                "cluster_id": 768,
                "name": "MoveToSaturation",
                "label": "Move To Saturation"
            },
            "4": {
                "id": 4,
                "cluster_id": 768,
                "name": "MoveSaturation",
                "label": "Move Saturation"
            },
            "5": {
                "id": 5,
                "cluster_id": 768,
                "name": "StepSaturation",
                "label": "Step Saturation"
            },
            "6": {
                "id": 6,
                "cluster_id": 768,
                "name": "MoveToHueAndSaturation",
                "label": "Move To Hue And Saturation"
            },
            "7": {
                "id": 7,
                "cluster_id": 768,
                "name": "MoveToColor",
                "label": "Move To Color"
            },
            "8": {
                "id": 8,
                "cluster_id": 768,
                "name": "MoveColor",
                "label": "Move Color"
            },
            "9": {
                "id": 9,
                "cluster_id": 768,
                "name": "StepColor",
                "label": "Step Color"
            },
            "10": {
                "id": 10,
                "cluster_id": 768,
                "name": "MoveToColorTemperature",
                "label": "Move To Color Temperature"
            },
            "64": {
                "id": 64,
                "cluster_id": 768,
                "name": "EnhancedMoveToHue",
                "label": "Enhanced Move To Hue"
            },
            "65": {
                "id": 65,
                "cluster_id": 768,
                "name": "EnhancedMoveHue",
                "label": "Enhanced Move Hue"
            },
            "66": {
                "id": 66,
                "cluster_id": 768,
                "name": "EnhancedStepHue",
                "label": "Enhanced Step Hue"
            },
            "67": {
                "id": 67,
                "cluster_id": 768,
                "name": "EnhancedMoveToHueAndSaturation",
                "label": "Enhanced Move To Hue And Saturation"
            },
            "68": {
                "id": 68,
                "cluster_id": 768,
                "name": "ColorLoopSet",
                "label": "Color Loop Set"
            },
            "71": {
                "id": 71,
                "cluster_id": 768,
                "name": "StopMoveStep",
                "label": "Stop Move Step"
            },
            "75": {
                "id": 75,
                "cluster_id": 768,
                "name": "MoveColorTemperature",
                "label": "Move Color Temperature"
            },
            "76": {
                "id": 76,
                "cluster_id": 768,
                "name": "StepColorTemperature",
                "label": "Step Color Temperature"
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
                "type": "Nullable[uint16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1024,
                "label": "MinMeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1024,
                "label": "MaxMeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1024,
                "label": "Tolerance",
                "type": "Optional[uint16]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1024,
                "label": "LightSensorType",
                "type": "Optional[Nullable[uint8]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1024,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1024,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1024,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1024,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1024,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1024,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1026": {
        "id": 1026,
        "label": "TemperatureMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1026,
                "label": "MeasuredValue",
                "type": "Nullable[temperature]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1026,
                "label": "MinMeasuredValue",
                "type": "Nullable[temperature]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1026,
                "label": "MaxMeasuredValue",
                "type": "Nullable[temperature]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1026,
                "label": "Tolerance",
                "type": "Optional[uint16]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1026,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1026,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1026,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1026,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1026,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1026,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1027": {
        "id": 1027,
        "label": "PressureMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1027,
                "label": "MeasuredValue",
                "type": "Nullable[int16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1027,
                "label": "MinMeasuredValue",
                "type": "Nullable[int16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1027,
                "label": "MaxMeasuredValue",
                "type": "Nullable[int16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1027,
                "label": "Tolerance",
                "type": "Optional[uint16]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 1027,
                "label": "ScaledValue",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "17": {
                "id": 17,
                "cluster_id": 1027,
                "label": "MinScaledValue",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "18": {
                "id": 18,
                "cluster_id": 1027,
                "label": "MaxScaledValue",
                "type": "Optional[Nullable[int16]]",
                "writable": false
            },
            "19": {
                "id": 19,
                "cluster_id": 1027,
                "label": "ScaledTolerance",
                "type": "Optional[uint16]",
                "writable": false
            },
            "20": {
                "id": 20,
                "cluster_id": 1027,
                "label": "Scale",
                "type": "Optional[int8]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1027,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1027,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1027,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1027,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1027,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1027,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1028": {
        "id": 1028,
        "label": "FlowMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1028,
                "label": "MeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1028,
                "label": "MinMeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1028,
                "label": "MaxMeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1028,
                "label": "Tolerance",
                "type": "Optional[uint16]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1028,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1028,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1028,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1028,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1028,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1028,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1029": {
        "id": 1029,
        "label": "RelativeHumidityMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1029,
                "label": "MeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1029,
                "label": "MinMeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1029,
                "label": "MaxMeasuredValue",
                "type": "Nullable[uint16]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1029,
                "label": "Tolerance",
                "type": "Optional[uint16]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1029,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1029,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1029,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1029,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1029,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1029,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1030": {
        "id": 1030,
        "label": "OccupancySensing",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1030,
                "label": "Occupancy",
                "type": "OccupancyBitmap",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1030,
                "label": "OccupancySensorType",
                "type": "OccupancySensorTypeEnum",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1030,
                "label": "OccupancySensorTypeBitmap",
                "type": "OccupancySensorTypeBitmap",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1030,
                "label": "HoldTime",
                "type": "Optional[uint16]",
                "writable": true
            },
            "4": {
                "id": 4,
                "cluster_id": 1030,
                "label": "HoldTimeLimits",
                "type": "Optional[HoldTimeLimitsStruct]",
                "writable": false
            },
            "16": {
                "id": 16,
                "cluster_id": 1030,
                "label": "PirOccupiedToUnoccupiedDelay",
                "type": "Optional[uint16]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 1030,
                "label": "PirUnoccupiedToOccupiedDelay",
                "type": "Optional[uint16]",
                "writable": true
            },
            "18": {
                "id": 18,
                "cluster_id": 1030,
                "label": "PirUnoccupiedToOccupiedThreshold",
                "type": "Optional[uint8]",
                "writable": true
            },
            "32": {
                "id": 32,
                "cluster_id": 1030,
                "label": "UltrasonicOccupiedToUnoccupiedDelay",
                "type": "Optional[uint16]",
                "writable": true
            },
            "33": {
                "id": 33,
                "cluster_id": 1030,
                "label": "UltrasonicUnoccupiedToOccupiedDelay",
                "type": "Optional[uint16]",
                "writable": true
            },
            "34": {
                "id": 34,
                "cluster_id": 1030,
                "label": "UltrasonicUnoccupiedToOccupiedThreshold",
                "type": "Optional[uint8]",
                "writable": true
            },
            "48": {
                "id": 48,
                "cluster_id": 1030,
                "label": "PhysicalContactOccupiedToUnoccupiedDelay",
                "type": "Optional[uint16]",
                "writable": true
            },
            "49": {
                "id": 49,
                "cluster_id": 1030,
                "label": "PhysicalContactUnoccupiedToOccupiedDelay",
                "type": "Optional[uint16]",
                "writable": true
            },
            "50": {
                "id": 50,
                "cluster_id": 1030,
                "label": "PhysicalContactUnoccupiedToOccupiedThreshold",
                "type": "Optional[uint8]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1030,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1030,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1030,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1030,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1030,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1030,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1036": {
        "id": 1036,
        "label": "CarbonMonoxideConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1036,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1036,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1036,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1036,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1036,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1036,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1036,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1036,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1036,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1036,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1036,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1036,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1036,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1036,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1036,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1036,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1036,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1037": {
        "id": 1037,
        "label": "CarbonDioxideConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1037,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1037,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1037,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1037,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1037,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1037,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1037,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1037,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1037,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1037,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1037,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1037,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1037,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1037,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1037,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1037,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1037,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1043": {
        "id": 1043,
        "label": "NitrogenDioxideConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1043,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1043,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1043,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1043,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1043,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1043,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1043,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1043,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1043,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1043,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1043,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1043,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1043,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1043,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1043,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1043,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1043,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1045": {
        "id": 1045,
        "label": "OzoneConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1045,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1045,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1045,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1045,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1045,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1045,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1045,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1045,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1045,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1045,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1045,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1045,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1045,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1045,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1045,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1045,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1045,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1066": {
        "id": 1066,
        "label": "Pm25ConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1066,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1066,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1066,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1066,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1066,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1066,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1066,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1066,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1066,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1066,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1066,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1066,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1066,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1066,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1066,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1066,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1066,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1067": {
        "id": 1067,
        "label": "FormaldehydeConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1067,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1067,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1067,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1067,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1067,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1067,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1067,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1067,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1067,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1067,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1067,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1067,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1067,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1067,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1067,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1067,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1067,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1068": {
        "id": 1068,
        "label": "Pm1ConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1068,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1068,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1068,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1068,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1068,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1068,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1068,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1068,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1068,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1068,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1068,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1068,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1068,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1068,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1068,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1068,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1068,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1069": {
        "id": 1069,
        "label": "Pm10ConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1069,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1069,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1069,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1069,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1069,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1069,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1069,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1069,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1069,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1069,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1069,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1069,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1069,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1069,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1069,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1069,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1069,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1070": {
        "id": 1070,
        "label": "TotalVolatileOrganicCompoundsConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1070,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1070,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1070,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1070,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1070,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1070,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1070,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1070,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1070,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1070,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1070,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1070,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1070,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1070,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1070,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1070,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1070,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1071": {
        "id": 1071,
        "label": "RadonConcentrationMeasurement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1071,
                "label": "MeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1071,
                "label": "MinMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1071,
                "label": "MaxMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1071,
                "label": "PeakMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1071,
                "label": "PeakMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1071,
                "label": "AverageMeasuredValue",
                "type": "Optional[Nullable[single]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1071,
                "label": "AverageMeasuredValueWindow",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1071,
                "label": "Uncertainty",
                "type": "Optional[single]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1071,
                "label": "MeasurementUnit",
                "type": "Optional[MeasurementUnitEnum]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1071,
                "label": "MeasurementMedium",
                "type": "MeasurementMediumEnum",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1071,
                "label": "LevelValue",
                "type": "Optional[LevelValueEnum]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1071,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1071,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1071,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1071,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1071,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1071,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1105": {
        "id": 1105,
        "label": "WiFiNetworkManagement",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1105,
                "label": "Ssid",
                "type": "Nullable[bytes]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1105,
                "label": "PassphraseSurrogate",
                "type": "Nullable[uint64]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1105,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1105,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1105,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1105,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1105,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1105,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1105,
                "name": "NetworkPassphraseRequest",
                "label": "Network Passphrase Request"
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
                "type": "string",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1106,
                "label": "BorderAgentId",
                "type": "bytes",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1106,
                "label": "ThreadVersion",
                "type": "uint16",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1106,
                "label": "InterfaceEnabled",
                "type": "bool",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1106,
                "label": "ActiveDatasetTimestamp",
                "type": "Nullable[uint64]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1106,
                "label": "PendingDatasetTimestamp",
                "type": "Nullable[uint64]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1106,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1106,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1106,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1106,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1106,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1106,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1106,
                "name": "GetActiveDatasetRequest",
                "label": "Get Active Dataset Request"
            },
            "1": {
                "id": 1,
                "cluster_id": 1106,
                "name": "GetPendingDatasetRequest",
                "label": "Get Pending Dataset Request"
            },
            "3": {
                "id": 3,
                "cluster_id": 1106,
                "name": "SetActiveDatasetRequest",
                "label": "Set Active Dataset Request"
            },
            "4": {
                "id": 4,
                "cluster_id": 1106,
                "name": "SetPendingDatasetRequest",
                "label": "Set Pending Dataset Request"
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
                "type": "Nullable[bytes]",
                "writable": true
            },
            "1": {
                "id": 1,
                "cluster_id": 1107,
                "label": "ThreadNetworks",
                "type": "List[ThreadNetworkStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1107,
                "label": "ThreadNetworkTableSize",
                "type": "uint8",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1107,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1107,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1107,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1107,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1107,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1107,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1107,
                "name": "AddNetwork",
                "label": "Add Network"
            },
            "1": {
                "id": 1,
                "cluster_id": 1107,
                "name": "RemoveNetwork",
                "label": "Remove Network"
            },
            "2": {
                "id": 2,
                "cluster_id": 1107,
                "name": "GetOperationalDataset",
                "label": "Get Operational Dataset"
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
                "type": "Optional[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1283,
                "label": "LinkLocalAddress",
                "type": "Optional[bytes]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1283,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1283,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1283,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1283,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1283,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1283,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1284": {
        "id": 1284,
        "label": "Channel",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1284,
                "label": "ChannelList",
                "type": "List[ChannelInfoStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1284,
                "label": "Lineup",
                "type": "Optional[Nullable[LineupInfoStruct]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1284,
                "label": "CurrentChannel",
                "type": "Optional[Nullable[ChannelInfoStruct]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1284,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1284,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1284,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1284,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1284,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1284,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1284,
                "name": "ChangeChannel",
                "label": "Change Channel"
            },
            "2": {
                "id": 2,
                "cluster_id": 1284,
                "name": "ChangeChannelByNumber",
                "label": "Change Channel By Number"
            },
            "3": {
                "id": 3,
                "cluster_id": 1284,
                "name": "SkipChannel",
                "label": "Skip Channel"
            },
            "4": {
                "id": 4,
                "cluster_id": 1284,
                "name": "GetProgramGuide",
                "label": "Get Program Guide"
            },
            "6": {
                "id": 6,
                "cluster_id": 1284,
                "name": "RecordProgram",
                "label": "Record Program"
            },
            "7": {
                "id": 7,
                "cluster_id": 1284,
                "name": "CancelRecordProgram",
                "label": "Cancel Record Program"
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
                "type": "List[TargetInfoStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1285,
                "label": "CurrentTarget",
                "type": "Optional[uint8]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1285,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1285,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1285,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1285,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1285,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1285,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1285,
                "name": "NavigateTarget",
                "label": "Navigate Target"
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
                "type": "PlaybackStateEnum",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1286,
                "label": "StartTime",
                "type": "Optional[Nullable[epoch-us]]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1286,
                "label": "Duration",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1286,
                "label": "SampledPosition",
                "type": "Optional[Nullable[PlaybackPositionStruct]]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1286,
                "label": "PlaybackSpeed",
                "type": "Optional[single]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1286,
                "label": "SeekRangeEnd",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1286,
                "label": "SeekRangeStart",
                "type": "Optional[Nullable[uint64]]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1286,
                "label": "ActiveAudioTrack",
                "type": "Optional[Nullable[TrackStruct]]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1286,
                "label": "AvailableAudioTracks",
                "type": "List[TrackStruct]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1286,
                "label": "ActiveTextTrack",
                "type": "Optional[Nullable[TrackStruct]]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1286,
                "label": "AvailableTextTracks",
                "type": "List[TrackStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1286,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1286,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1286,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1286,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1286,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1286,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1286,
                "name": "Play",
                "label": "Play"
            },
            "1": {
                "id": 1,
                "cluster_id": 1286,
                "name": "Pause",
                "label": "Pause"
            },
            "2": {
                "id": 2,
                "cluster_id": 1286,
                "name": "Stop",
                "label": "Stop"
            },
            "3": {
                "id": 3,
                "cluster_id": 1286,
                "name": "StartOver",
                "label": "Start Over"
            },
            "4": {
                "id": 4,
                "cluster_id": 1286,
                "name": "Previous",
                "label": "Previous"
            },
            "5": {
                "id": 5,
                "cluster_id": 1286,
                "name": "Next",
                "label": "Next"
            },
            "6": {
                "id": 6,
                "cluster_id": 1286,
                "name": "Rewind",
                "label": "Rewind"
            },
            "7": {
                "id": 7,
                "cluster_id": 1286,
                "name": "FastForward",
                "label": "Fast Forward"
            },
            "8": {
                "id": 8,
                "cluster_id": 1286,
                "name": "SkipForward",
                "label": "Skip Forward"
            },
            "9": {
                "id": 9,
                "cluster_id": 1286,
                "name": "SkipBackward",
                "label": "Skip Backward"
            },
            "11": {
                "id": 11,
                "cluster_id": 1286,
                "name": "Seek",
                "label": "Seek"
            },
            "12": {
                "id": 12,
                "cluster_id": 1286,
                "name": "ActivateAudioTrack",
                "label": "Activate Audio Track"
            },
            "13": {
                "id": 13,
                "cluster_id": 1286,
                "name": "ActivateTextTrack",
                "label": "Activate Text Track"
            },
            "14": {
                "id": 14,
                "cluster_id": 1286,
                "name": "DeactivateTextTrack",
                "label": "Deactivate Text Track"
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
                "type": "List[InputInfoStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1287,
                "label": "CurrentInput",
                "type": "uint8",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1287,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1287,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1287,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1287,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1287,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1287,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1287,
                "name": "SelectInput",
                "label": "Select Input"
            },
            "1": {
                "id": 1,
                "cluster_id": 1287,
                "name": "ShowInputStatus",
                "label": "Show Input Status"
            },
            "2": {
                "id": 2,
                "cluster_id": 1287,
                "name": "HideInputStatus",
                "label": "Hide Input Status"
            },
            "3": {
                "id": 3,
                "cluster_id": 1287,
                "name": "RenameInput",
                "label": "Rename Input"
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
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1288,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1288,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1288,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1288,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1288,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1288,
                "name": "Sleep",
                "label": "Sleep"
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
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1289,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1289,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1289,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1289,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1289,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1289,
                "name": "SendKey",
                "label": "Send Key"
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
                "type": "List[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1290,
                "label": "SupportedStreamingProtocols",
                "type": "Optional[SupportedProtocolsBitmap]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1290,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1290,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1290,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1290,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1290,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1290,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1290,
                "name": "LaunchContent",
                "label": "Launch Content"
            },
            "1": {
                "id": 1,
                "cluster_id": 1290,
                "name": "LaunchUrl",
                "label": "Launch Url"
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
                "type": "List[OutputInfoStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1291,
                "label": "CurrentOutput",
                "type": "uint8",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1291,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1291,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1291,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1291,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1291,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1291,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1291,
                "name": "SelectOutput",
                "label": "Select Output"
            },
            "1": {
                "id": 1,
                "cluster_id": 1291,
                "name": "RenameOutput",
                "label": "Rename Output"
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
                "type": "List[uint16]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1292,
                "label": "CurrentApp",
                "type": "Optional[Nullable[ApplicationEPStruct]]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1292,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1292,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1292,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1292,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1292,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1292,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1292,
                "name": "LaunchApp",
                "label": "Launch App"
            },
            "1": {
                "id": 1,
                "cluster_id": 1292,
                "name": "StopApp",
                "label": "Stop App"
            },
            "2": {
                "id": 2,
                "cluster_id": 1292,
                "name": "HideApp",
                "label": "Hide App"
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
                "type": "Optional[string]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1293,
                "label": "VendorId",
                "type": "Optional[vendor-id]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1293,
                "label": "ApplicationName",
                "type": "string",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1293,
                "label": "ProductId",
                "type": "Optional[uint16]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1293,
                "label": "Application",
                "type": "ApplicationStruct",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1293,
                "label": "Status",
                "type": "ApplicationStatusEnum",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1293,
                "label": "ApplicationVersion",
                "type": "string",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1293,
                "label": "AllowedVendorList",
                "type": "List[vendor-id]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1293,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1293,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1293,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1293,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1293,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1293,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1294": {
        "id": 1294,
        "label": "AccountLogin",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 1294,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1294,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1294,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1294,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1294,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1294,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1294,
                "name": "GetSetupPin",
                "label": "Get Setup Pin"
            },
            "2": {
                "id": 2,
                "cluster_id": 1294,
                "name": "Login",
                "label": "Login"
            },
            "3": {
                "id": 3,
                "cluster_id": 1294,
                "name": "Logout",
                "label": "Logout"
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
                "type": "bool",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1295,
                "label": "OnDemandRatings",
                "type": "List[RatingNameStruct]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1295,
                "label": "OnDemandRatingThreshold",
                "type": "Optional[string]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1295,
                "label": "ScheduledContentRatings",
                "type": "List[RatingNameStruct]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1295,
                "label": "ScheduledContentRatingThreshold",
                "type": "Optional[string]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1295,
                "label": "ScreenDailyTime",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1295,
                "label": "RemainingScreenTime",
                "type": "Optional[elapsed-s]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1295,
                "label": "BlockUnrated",
                "type": "Optional[bool]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1295,
                "label": "BlockChannelList",
                "type": "List[BlockChannelStruct]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1295,
                "label": "BlockApplicationList",
                "type": "List[AppInfoStruct]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1295,
                "label": "BlockContentTimeWindow",
                "type": "List[TimeWindowStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1295,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1295,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1295,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1295,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1295,
                "label": "FeatureMap",
                "type": "FeatureMap",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1295,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1295,
                "name": "UpdatePin",
                "label": "Update Pin"
            },
            "1": {
                "id": 1,
                "cluster_id": 1295,
                "name": "ResetPin",
                "label": "Reset Pin"
            },
            "3": {
                "id": 3,
                "cluster_id": 1295,
                "name": "Enable",
                "label": "Enable"
            },
            "4": {
                "id": 4,
                "cluster_id": 1295,
                "name": "Disable",
                "label": "Disable"
            },
            "5": {
                "id": 5,
                "cluster_id": 1295,
                "name": "AddBonusTime",
                "label": "Add Bonus Time"
            },
            "6": {
                "id": 6,
                "cluster_id": 1295,
                "name": "SetScreenDailyTime",
                "label": "Set Screen Daily Time"
            },
            "7": {
                "id": 7,
                "cluster_id": 1295,
                "name": "BlockUnratedContent",
                "label": "Block Unrated Content"
            },
            "8": {
                "id": 8,
                "cluster_id": 1295,
                "name": "UnblockUnratedContent",
                "label": "Unblock Unrated Content"
            },
            "9": {
                "id": 9,
                "cluster_id": 1295,
                "name": "SetOnDemandRatingThreshold",
                "label": "Set On Demand Rating Threshold"
            },
            "10": {
                "id": 10,
                "cluster_id": 1295,
                "name": "SetScheduledContentRatingThreshold",
                "label": "Set Scheduled Content Rating Threshold"
            },
            "11": {
                "id": 11,
                "cluster_id": 1295,
                "name": "AddBlockChannels",
                "label": "Add Block Channels"
            },
            "12": {
                "id": 12,
                "cluster_id": 1295,
                "name": "RemoveBlockChannels",
                "label": "Remove Block Channels"
            },
            "13": {
                "id": 13,
                "cluster_id": 1295,
                "name": "AddBlockApplications",
                "label": "Add Block Applications"
            },
            "14": {
                "id": 14,
                "cluster_id": 1295,
                "name": "RemoveBlockApplications",
                "label": "Remove Block Applications"
            },
            "15": {
                "id": 15,
                "cluster_id": 1295,
                "name": "SetBlockContentTimeWindow",
                "label": "Set Block Content Time Window"
            },
            "16": {
                "id": 16,
                "cluster_id": 1295,
                "name": "RemoveBlockContentTimeWindow",
                "label": "Remove Block Content Time Window"
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
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1296,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1296,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1296,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1296,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1296,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1296,
                "name": "ContentAppMessage",
                "label": "Content App Message"
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
                "type": "List[EcosystemDeviceStruct]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1872,
                "label": "LocationDirectory",
                "type": "List[EcosystemLocationStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1872,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1872,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1872,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1872,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1872,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1872,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {}
    },
    "1873": {
        "id": 1873,
        "label": "CommissionerControl",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 1873,
                "label": "SupportedDeviceCategories",
                "type": "SupportedDeviceCategoryBitmap",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1873,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1873,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1873,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1873,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1873,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1873,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1873,
                "name": "RequestCommissioningApproval",
                "label": "Request Commissioning Approval"
            },
            "1": {
                "id": 1,
                "cluster_id": 1873,
                "name": "CommissionNode",
                "label": "Commission Node"
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
                "type": "Optional[bytes]",
                "writable": false
            },
            "1": {
                "id": 1,
                "cluster_id": 1874,
                "label": "AnchorNodeId",
                "type": "Optional[node-id]",
                "writable": false
            },
            "2": {
                "id": 2,
                "cluster_id": 1874,
                "label": "AnchorVendorId",
                "type": "Optional[vendor-id]",
                "writable": false
            },
            "3": {
                "id": 3,
                "cluster_id": 1874,
                "label": "FriendlyName",
                "type": "Optional[string]",
                "writable": false
            },
            "4": {
                "id": 4,
                "cluster_id": 1874,
                "label": "GroupKeySetList",
                "type": "List[DatastoreGroupKeySetStruct]",
                "writable": false
            },
            "5": {
                "id": 5,
                "cluster_id": 1874,
                "label": "GroupList",
                "type": "List[DatastoreGroupInformationEntryStruct]",
                "writable": false
            },
            "6": {
                "id": 6,
                "cluster_id": 1874,
                "label": "NodeList",
                "type": "List[DatastoreNodeInformationEntryStruct]",
                "writable": false
            },
            "7": {
                "id": 7,
                "cluster_id": 1874,
                "label": "AdminList",
                "type": "List[DatastoreAdministratorInformationEntryStruct]",
                "writable": false
            },
            "8": {
                "id": 8,
                "cluster_id": 1874,
                "label": "Status",
                "type": "Optional[DatastoreStatusEntryStruct]",
                "writable": false
            },
            "9": {
                "id": 9,
                "cluster_id": 1874,
                "label": "EndpointGroupIdList",
                "type": "List[DatastoreEndpointGroupIDEntryStruct]",
                "writable": false
            },
            "10": {
                "id": 10,
                "cluster_id": 1874,
                "label": "EndpointBindingList",
                "type": "List[DatastoreEndpointBindingEntryStruct]",
                "writable": false
            },
            "11": {
                "id": 11,
                "cluster_id": 1874,
                "label": "NodeKeySetList",
                "type": "List[DatastoreNodeKeySetEntryStruct]",
                "writable": false
            },
            "12": {
                "id": 12,
                "cluster_id": 1874,
                "label": "NodeAclList",
                "type": "List[DatastoreACLEntryStruct]",
                "writable": false
            },
            "13": {
                "id": 13,
                "cluster_id": 1874,
                "label": "NodeEndpointList",
                "type": "List[DatastoreEndpointEntryStruct]",
                "writable": false
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1874,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1874,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1874,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1874,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1874,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1874,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1874,
                "name": "AddKeySet",
                "label": "Add Key Set"
            },
            "1": {
                "id": 1,
                "cluster_id": 1874,
                "name": "UpdateKeySet",
                "label": "Update Key Set"
            },
            "2": {
                "id": 2,
                "cluster_id": 1874,
                "name": "RemoveKeySet",
                "label": "Remove Key Set"
            },
            "3": {
                "id": 3,
                "cluster_id": 1874,
                "name": "AddGroup",
                "label": "Add Group"
            },
            "4": {
                "id": 4,
                "cluster_id": 1874,
                "name": "UpdateGroup",
                "label": "Update Group"
            },
            "5": {
                "id": 5,
                "cluster_id": 1874,
                "name": "RemoveGroup",
                "label": "Remove Group"
            },
            "6": {
                "id": 6,
                "cluster_id": 1874,
                "name": "AddAdmin",
                "label": "Add Admin"
            },
            "7": {
                "id": 7,
                "cluster_id": 1874,
                "name": "UpdateAdmin",
                "label": "Update Admin"
            },
            "8": {
                "id": 8,
                "cluster_id": 1874,
                "name": "RemoveAdmin",
                "label": "Remove Admin"
            },
            "9": {
                "id": 9,
                "cluster_id": 1874,
                "name": "AddPendingNode",
                "label": "Add Pending Node"
            },
            "10": {
                "id": 10,
                "cluster_id": 1874,
                "name": "RefreshNode",
                "label": "Refresh Node"
            },
            "11": {
                "id": 11,
                "cluster_id": 1874,
                "name": "UpdateNode",
                "label": "Update Node"
            },
            "12": {
                "id": 12,
                "cluster_id": 1874,
                "name": "RemoveNode",
                "label": "Remove Node"
            },
            "13": {
                "id": 13,
                "cluster_id": 1874,
                "name": "UpdateEndpointForNode",
                "label": "Update Endpoint For Node"
            },
            "14": {
                "id": 14,
                "cluster_id": 1874,
                "name": "AddGroupIdToEndpointForNode",
                "label": "Add Group Id To Endpoint For Node"
            },
            "15": {
                "id": 15,
                "cluster_id": 1874,
                "name": "RemoveGroupIdFromEndpointForNode",
                "label": "Remove Group Id From Endpoint For Node"
            },
            "16": {
                "id": 16,
                "cluster_id": 1874,
                "name": "AddBindingToEndpointForNode",
                "label": "Add Binding To Endpoint For Node"
            },
            "17": {
                "id": 17,
                "cluster_id": 1874,
                "name": "RemoveBindingFromEndpointForNode",
                "label": "Remove Binding From Endpoint For Node"
            },
            "18": {
                "id": 18,
                "cluster_id": 1874,
                "name": "AddAclToNode",
                "label": "Add Acl To Node"
            },
            "19": {
                "id": 19,
                "cluster_id": 1874,
                "name": "RemoveAclFromNode",
                "label": "Remove Acl From Node"
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
                "type": "Optional[Nullable[fabric-idx]]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 1875,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 1875,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 1875,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 1875,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 1875,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 1875,
                "label": "ClusterRevision",
                "type": "ClusterRevision",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 1875,
                "name": "IcaccsrRequest",
                "label": "Icaccsr Request"
            },
            "2": {
                "id": 2,
                "cluster_id": 1875,
                "name": "AddIcac",
                "label": "Add Icac"
            },
            "4": {
                "id": 4,
                "cluster_id": 1875,
                "name": "OpenJointCommissioningWindow",
                "label": "Open Joint Commissioning Window"
            },
            "5": {
                "id": 5,
                "cluster_id": 1875,
                "name": "TransferAnchorRequest",
                "label": "Transfer Anchor Request"
            },
            "7": {
                "id": 7,
                "cluster_id": 1875,
                "name": "TransferAnchorComplete",
                "label": "Transfer Anchor Complete"
            },
            "8": {
                "id": 8,
                "cluster_id": 1875,
                "name": "AnnounceJointFabricAdministrator",
                "label": "Announce Joint Fabric Administrator"
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
                "type": "Optional[unknown]",
                "writable": true
            },
            "1288": {
                "id": 1288,
                "cluster_id": 2820,
                "label": "RmsCurrent",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1291": {
                "id": 1291,
                "cluster_id": 2820,
                "label": "ActivePower",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1536": {
                "id": 1536,
                "cluster_id": 2820,
                "label": "AcVoltageMultiplier",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1537": {
                "id": 1537,
                "cluster_id": 2820,
                "label": "AcVoltageDivisor",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1538": {
                "id": 1538,
                "cluster_id": 2820,
                "label": "AcCurrentMultiplier",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1539": {
                "id": 1539,
                "cluster_id": 2820,
                "label": "AcCurrentDivisor",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1540": {
                "id": 1540,
                "cluster_id": 2820,
                "label": "AcPowerMultiplier",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1541": {
                "id": 1541,
                "cluster_id": 2820,
                "label": "AcPowerDivisor",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 2820,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 2820,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 2820,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 2820,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 2820,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 2820,
                "label": "ClusterRevision",
                "type": "uint16",
                "writable": false
            }
        },
        "commands": {}
    },
    "302775297": {
        "id": 302775297,
        "label": "HeimanCluster",
        "attributes": {
            "16": {
                "id": 16,
                "cluster_id": 302775297,
                "label": "TamperAlarm",
                "type": "Optional[unknown]",
                "writable": true
            },
            "17": {
                "id": 17,
                "cluster_id": 302775297,
                "label": "PreheatingState",
                "type": "Optional[unknown]",
                "writable": true
            },
            "18": {
                "id": 18,
                "cluster_id": 302775297,
                "label": "NoDisturbingState",
                "type": "Optional[unknown]",
                "writable": true
            },
            "19": {
                "id": 19,
                "cluster_id": 302775297,
                "label": "SensorType",
                "type": "Optional[unknown]",
                "writable": true
            },
            "20": {
                "id": 20,
                "cluster_id": 302775297,
                "label": "SirenActive",
                "type": "Optional[unknown]",
                "writable": true
            },
            "21": {
                "id": 21,
                "cluster_id": 302775297,
                "label": "AlarmMute",
                "type": "Optional[unknown]",
                "writable": true
            },
            "22": {
                "id": 22,
                "cluster_id": 302775297,
                "label": "LowPowerMode",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 302775297,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 302775297,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 302775297,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 302775297,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 302775297,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 302775297,
                "label": "ClusterRevision",
                "type": "uint16",
                "writable": false
            }
        },
        "commands": {
            "0": {
                "id": 0,
                "cluster_id": 302775297,
                "name": "mutingSensor",
                "label": "Muting Sensor"
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
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 305134641,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 305134641,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 305134641,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 305134641,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 305134641,
                "label": "ClusterRevision",
                "type": "uint16",
                "writable": false
            },
            "305070177": {
                "id": 305070177,
                "cluster_id": 305134641,
                "label": "LedIndicatorIntensityOn",
                "type": "Optional[unknown]",
                "writable": true
            },
            "305070178": {
                "id": 305070178,
                "cluster_id": 305134641,
                "label": "LedIndicatorIntensityOff",
                "type": "Optional[unknown]",
                "writable": true
            },
            "305070342": {
                "id": 305070342,
                "cluster_id": 305134641,
                "label": "ClearNotificationWithConfigDoubleTap",
                "type": "Optional[bool]",
                "writable": true
            }
        },
        "commands": {}
    },
    "308149265": {
        "id": 308149265,
        "label": "NeoCluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 308149265,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 308149265,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 308149265,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 308149265,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 308149265,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 308149265,
                "label": "ClusterRevision",
                "type": "uint16",
                "writable": false
            },
            "308084769": {
                "id": 308084769,
                "cluster_id": 308149265,
                "label": "WattAccumulated",
                "type": "Optional[unknown]",
                "writable": true
            },
            "308084770": {
                "id": 308084770,
                "cluster_id": 308149265,
                "label": "Current",
                "type": "Optional[unknown]",
                "writable": true
            },
            "308084771": {
                "id": 308084771,
                "cluster_id": 308149265,
                "label": "Watt",
                "type": "Optional[unknown]",
                "writable": true
            },
            "308084772": {
                "id": 308084772,
                "cluster_id": 308149265,
                "label": "Voltage",
                "type": "Optional[unknown]",
                "writable": true
            }
        },
        "commands": {}
    },
    "319486977": {
        "id": 319486977,
        "label": "EveCluster",
        "attributes": {
            "65528": {
                "id": 65528,
                "cluster_id": 319486977,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 319486977,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 319486977,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 319486977,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 319486977,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 319486977,
                "label": "ClusterRevision",
                "type": "uint16",
                "writable": false
            },
            "319422464": {
                "id": 319422464,
                "cluster_id": 319486977,
                "label": "GetConfig",
                "type": "Optional[bytes]",
                "writable": true
            },
            "319422465": {
                "id": 319422465,
                "cluster_id": 319486977,
                "label": "SetConfig",
                "type": "Optional[bytes]",
                "writable": true
            },
            "319422466": {
                "id": 319422466,
                "cluster_id": 319486977,
                "label": "LoggingMetadata",
                "type": "Optional[bytes]",
                "writable": true
            },
            "319422467": {
                "id": 319422467,
                "cluster_id": 319486977,
                "label": "LoggingData",
                "type": "Optional[bytes]",
                "writable": true
            },
            "319422470": {
                "id": 319422470,
                "cluster_id": 319486977,
                "label": "TimesOpened",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422471": {
                "id": 319422471,
                "cluster_id": 319486977,
                "label": "LastEventTime",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422472": {
                "id": 319422472,
                "cluster_id": 319486977,
                "label": "Voltage",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422473": {
                "id": 319422473,
                "cluster_id": 319486977,
                "label": "Current",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422474": {
                "id": 319422474,
                "cluster_id": 319486977,
                "label": "Watt",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422475": {
                "id": 319422475,
                "cluster_id": 319486977,
                "label": "WattAccumulated",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422476": {
                "id": 319422476,
                "cluster_id": 319486977,
                "label": "StatusFault",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422477": {
                "id": 319422477,
                "cluster_id": 319486977,
                "label": "MotionSensitivity",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422478": {
                "id": 319422478,
                "cluster_id": 319486977,
                "label": "WattAccumulatedControlPoint",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422480": {
                "id": 319422480,
                "cluster_id": 319486977,
                "label": "ObstructionDetected",
                "type": "Optional[bool]",
                "writable": true
            },
            "319422481": {
                "id": 319422481,
                "cluster_id": 319486977,
                "label": "ChildLock",
                "type": "Optional[bool]",
                "writable": true
            },
            "319422482": {
                "id": 319422482,
                "cluster_id": 319486977,
                "label": "Rloc16",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422483": {
                "id": 319422483,
                "cluster_id": 319486977,
                "label": "Altitude",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422484": {
                "id": 319422484,
                "cluster_id": 319486977,
                "label": "Pressure",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422485": {
                "id": 319422485,
                "cluster_id": 319486977,
                "label": "WeatherTrend",
                "type": "Optional[unknown]",
                "writable": true
            },
            "319422488": {
                "id": 319422488,
                "cluster_id": 319486977,
                "label": "ValvePosition",
                "type": "Optional[unknown]",
                "writable": true
            }
        },
        "commands": {}
    },
    "319683586": {
        "id": 319683586,
        "label": "ThirdRealityMeteringCluster",
        "attributes": {
            "0": {
                "id": 0,
                "cluster_id": 319683586,
                "label": "CurrentSummationDelivered",
                "type": "Optional[unknown]",
                "writable": true
            },
            "769": {
                "id": 769,
                "cluster_id": 319683586,
                "label": "Multiplier",
                "type": "Optional[unknown]",
                "writable": true
            },
            "770": {
                "id": 770,
                "cluster_id": 319683586,
                "label": "Divisor",
                "type": "Optional[unknown]",
                "writable": true
            },
            "1024": {
                "id": 1024,
                "cluster_id": 319683586,
                "label": "InstantaneousDemand",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65528": {
                "id": 65528,
                "cluster_id": 319683586,
                "label": "GeneratedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65529": {
                "id": 65529,
                "cluster_id": 319683586,
                "label": "AcceptedCommandList",
                "type": "List[command-id]",
                "writable": false
            },
            "65530": {
                "id": 65530,
                "cluster_id": 319683586,
                "label": "EventList",
                "type": "Optional[unknown]",
                "writable": true
            },
            "65531": {
                "id": 65531,
                "cluster_id": 319683586,
                "label": "AttributeList",
                "type": "List[attrib-id]",
                "writable": false
            },
            "65532": {
                "id": 65532,
                "cluster_id": 319683586,
                "label": "FeatureMap",
                "type": "map32",
                "writable": false
            },
            "65533": {
                "id": 65533,
                "cluster_id": 319683586,
                "label": "ClusterRevision",
                "type": "uint16",
                "writable": false
            }
        },
        "commands": {}
    }
};
