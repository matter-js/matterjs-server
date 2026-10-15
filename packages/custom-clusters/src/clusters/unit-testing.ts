/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import {
    attribute,
    bool,
    cluster,
    DatatypeModel,
    double,
    field,
    FieldModel,
    listOf,
    mandatory,
    octstr,
    single,
    string,
    uint8,
    writable,
} from "@matter/main/model";

function datatype(name: string, type: string, values: Record<string, number>, valueKey: "id" | "constraint") {
    return new DatatypeModel({
        name,
        type,
        children: Object.entries(values).map(
            ([fieldName, value]) => new FieldModel({ name: fieldName, [valueKey]: value }),
        ),
    });
}

const SimpleEnum = datatype("SimpleEnum", "enum8", { Unspecified: 0, ValueA: 1, ValueB: 2, ValueC: 3 }, "id");
const SimpleBitmap = datatype("SimpleBitmap", "map8", { ValueA: 0, ValueB: 1, ValueC: 2 }, "constraint");
const TestGlobalEnum = datatype("TestGlobalEnum", "enum8", { SomeValue: 0, SomeOtherValue: 1, FinalValue: 2 }, "id");

/** `SimpleStruct` of CHIP's UnitTesting cluster (`test-cluster.xml`). */
class UnitTestingSimpleStruct {
    @field(0x0, uint8, mandatory)
    a!: number;

    @field(0x1, bool, mandatory)
    b!: boolean;

    @field(0x2, SimpleEnum, mandatory)
    c!: number;

    @field(0x3, octstr, mandatory)
    d!: Bytes;

    @field(0x4, string, mandatory)
    e!: string;

    @field(0x5, SimpleBitmap, mandatory)
    f!: number;

    @field(0x6, single, mandatory)
    g!: number;

    @field(0x7, double, mandatory)
    h!: number;

    @field(0x8, TestGlobalEnum)
    i?: number;
}

/**
 * CHIP's UnitTesting cluster, which the CHIP example apps (all-clusters-app) expose on endpoint 1. Only the attributes
 * of data types no standard cluster has, which the controller certification suite writes and subscribes to.
 */
@cluster(0xfff1fc05)
export class UnitTestingCluster {
    @attribute(0x0017, single, writable)
    floatSingle?: number;

    @attribute(0x0019, octstr, writable)
    octetString?: Bytes;

    @attribute(0x0025, UnitTestingSimpleStruct, writable)
    structAttr?: UnitTestingSimpleStruct;

    @attribute(0x002a, listOf(octstr), writable)
    listLongOctetString?: Bytes[];
}
