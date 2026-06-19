/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export type InputType = {
    [key: string]: number | number[] | undefined;
};

export interface BindingEntryStruct {
    node: number | bigint | undefined;
    group: number | undefined;
    endpoint: number | undefined;
    cluster: number | undefined;
    fabricIndex: number | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export class BindingEntryDataTransformer {
    private static readonly KEY_MAPPING: {
        [inputKey: string]: keyof BindingEntryStruct;
    } = {
        "1": "node",
        "2": "group",
        "3": "endpoint",
        "4": "cluster",
        "254": "fabricIndex",
    };

    public static transform(input: unknown): BindingEntryStruct {
        if (!isRecord(input)) {
            throw new Error("Invalid input: expected an object");
        }

        const result: Partial<BindingEntryStruct> = {};
        const keyMapping = BindingEntryDataTransformer.KEY_MAPPING;

        for (const key in input) {
            if (key in keyMapping) {
                const mappedKey = keyMapping[key];
                if (mappedKey) {
                    const value = input[key];
                    // Treat unset/wildcard fields (null or absent) as omitted, not numeric 0.
                    if (value == null) {
                        continue;
                    }
                    if (mappedKey === "node") {
                        // Node IDs can be bigint - preserve the original type
                        if (typeof value === "number" || typeof value === "bigint") {
                            result.node = value;
                        }
                    } else {
                        // group, endpoint, cluster, fabricIndex are all numeric
                        result[mappedKey] = Number(value);
                    }
                }
            }
        }

        return result as BindingEntryStruct;
    }
}
