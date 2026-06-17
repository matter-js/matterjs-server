/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccessControlTargetStruct = {
    cluster: number | undefined;
    endpoint: number | undefined;
    deviceType: number | undefined;
};

export type AccessControlEntryRawInput = {
    "1": number;
    "2": number;
    "3": (number | bigint)[];
    "4": AccessControlTargetStruct[] | undefined;
    "254": number;
};

export type AccessControlEntryStruct = {
    privilege: number;
    authMode: number;
    subjects: (number | bigint)[];
    targets: AccessControlTargetStruct[] | undefined;
    fabricIndex: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export class AccessControlTargetTransformer {
    private static readonly KEY_MAPPING: {
        [inputKey: string]: keyof AccessControlTargetStruct;
    } = {
        "0": "cluster",
        "1": "endpoint",
        "2": "deviceType",
    };

    public static transform(input: unknown): AccessControlTargetStruct {
        if (!isRecord(input)) {
            throw new Error("Invalid input: expected an object");
        }

        const result: Partial<AccessControlTargetStruct> = {};
        const keyMapping = AccessControlTargetTransformer.KEY_MAPPING;

        for (const key in input) {
            if (key in keyMapping) {
                const mappedKey = keyMapping[key];
                if (mappedKey) {
                    const value = input[key];
                    // Treat unset/wildcard fields (null or absent) as omitted, not numeric 0.
                    if (value == null) continue;
                    result[mappedKey] = Number(value);
                }
            }
        }
        return result as AccessControlTargetStruct;
    }
}

export class AccessControlEntryDataTransformer {
    private static readonly KEY_MAPPING: {
        [inputKey: string]: keyof AccessControlEntryStruct;
    } = {
        "1": "privilege",
        "2": "authMode",
        "3": "subjects",
        "4": "targets",
        "254": "fabricIndex",
    };

    public static transform(input: unknown): AccessControlEntryStruct {
        if (!isRecord(input)) {
            throw new Error("Invalid input: expected an object");
        }

        const result: Partial<AccessControlEntryStruct> = {};
        const keyMapping = AccessControlEntryDataTransformer.KEY_MAPPING;

        for (const key in input) {
            if (key in keyMapping) {
                const mappedKey = keyMapping[key];
                if (mappedKey) {
                    const value = input[key];
                    if (value == null) continue;
                    if (mappedKey === "subjects") {
                        result.subjects = Array.isArray(value) ? value : undefined;
                    } else if (mappedKey === "targets") {
                        result.targets = Array.isArray(value)
                            ? value.map(val => AccessControlTargetTransformer.transform(val))
                            : undefined;
                    } else {
                        // privilege, authMode, fabricIndex are numeric
                        result[mappedKey] = Number(value);
                    }
                }
            }
        }

        return result as AccessControlEntryStruct;
    }
}
