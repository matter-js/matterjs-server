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

export class BindingEntryDataTransformer {
    private static readonly KEY_MAPPING: {
        [inputKey: string]: keyof BindingEntryStruct;
    } = {
        "1": "node",
        "3": "endpoint",
        "4": "cluster",
        "254": "fabricIndex",
    };

    public static transform(input: any): BindingEntryStruct {
        if (!input || typeof input !== "object") {
            throw new Error("Invalid input: expected an object");
        }

        const result: Partial<BindingEntryStruct> = {};
        const keyMapping = BindingEntryDataTransformer.KEY_MAPPING;

        for (const key in input) {
            if (key in keyMapping) {
                const mappedKey = keyMapping[key];
                if (mappedKey) {
                    const value = input[key];
                    if (value === undefined) {
                        continue;
                    }
                    if (mappedKey === "node") {
                        // Node IDs can be bigint - preserve the original type
                        result[mappedKey] = value;
                    } else if (mappedKey === "fabricIndex" || mappedKey === "endpoint" || mappedKey === "cluster") {
                        result[mappedKey] = value === undefined ? undefined : Number(value);
                    }
                }
            }
        }

        return result as BindingEntryStruct;
    }
}
