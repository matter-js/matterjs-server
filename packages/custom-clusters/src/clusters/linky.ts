/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { attribute, cluster, octstr, string, uint8, uint16, uint32, writable } from "@matter/main/model";

/** Raw TIC data of the Linky electricity meter (historic and standard mode), ZLinky. */
@cluster(0xfff1fc01)
export class LinkyCluster {
    @attribute(0xfff10000, string)
    optarif?: string;

    @attribute(0xfff10001, string)
    demain?: string;

    @attribute(0xfff10002, uint8)
    hhphc?: number;

    @attribute(0xfff10003, uint8)
    ppot?: number;

    @attribute(0xfff10004, uint8)
    pejp?: number;

    @attribute(0xfff10005, uint16)
    adps?: number;

    @attribute(0xfff10006, uint16)
    adir1?: number;

    @attribute(0xfff10007, uint16)
    adir2?: number;

    @attribute(0xfff10008, uint16)
    adir3?: number;

    @attribute(0xfff10009, string)
    motdetat?: string;

    @attribute(0xfff10010, string)
    tarifPeriod?: string;

    @attribute(0xfff10100, uint8, writable)
    periodicSend?: number;

    @attribute(0xfff10300, uint8)
    mode?: number;

    @attribute(0xfff10200, string)
    ltarf?: string;

    @attribute(0xfff10201, uint8)
    ntarf?: number;

    @attribute(0xfff10202, string)
    date?: string;

    @attribute(0xfff10225, uint8)
    njourf?: number;

    @attribute(0xfff10226, uint8)
    njourf1?: number;

    @attribute(0xfff10227, string)
    pjourf1?: string;

    @attribute(0xfff10228, string)
    ppointe?: string;

    @attribute(0xfff10218, uint8)
    dpm1?: number;

    @attribute(0xfff10219, uint8)
    fpm1?: number;

    @attribute(0xfff10220, uint8)
    dpm2?: number;

    @attribute(0xfff10221, uint8)
    fpm2?: number;

    @attribute(0xfff10222, uint8)
    dpm3?: number;

    @attribute(0xfff10223, uint8)
    fpm3?: number;

    @attribute(0xfff10203, uint32)
    easd01?: number;

    @attribute(0xfff10204, uint32)
    easd02?: number;

    @attribute(0xfff10205, uint32)
    easd03?: number;

    @attribute(0xfff10206, uint32)
    easd04?: number;

    @attribute(0xfff10207, uint16)
    sinsti?: number;

    @attribute(0xfff10208, uint16)
    smaxin?: number;

    @attribute(0xfff10209, uint16)
    smaxin1?: number;

    @attribute(0xfff10210, uint16)
    ccain?: number;

    @attribute(0xfff10211, uint16)
    ccain1?: number;

    @attribute(0xfff10212, uint16)
    smaxsn11?: number;

    @attribute(0xfff10213, uint16)
    smaxsn21?: number;

    @attribute(0xfff10214, uint16)
    smaxsn31?: number;

    @attribute(0xfff10400, uint16)
    smaxsn1?: number;

    @attribute(0xfff10215, string)
    msg1?: string;

    @attribute(0xfff10216, string)
    msg2?: string;

    @attribute(0xfff10217, octstr)
    stge?: Bytes;

    @attribute(0xfff10224, uint16)
    relais?: number;
}
