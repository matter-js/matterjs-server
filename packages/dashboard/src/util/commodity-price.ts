/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber } from "./attribute-shapes.js";
import { currencyInfo, formatPrice, TARIFF_UNIT_NAMES, type CurrencyInfo } from "./commodity-tariff.js";

export const COMMODITY_PRICE_CLUSTER_ID = 0x95;

const ATTR_TARIFF_UNIT = 0;
const ATTR_CURRENCY = 1;
const ATTR_CURRENT_PRICE = 2;
const ATTR_PRICE_FORECAST = 3;
const ATTR_FEATURE_MAP = 0xfffc;

/** One CommodityPriceStruct (Matter 1.6 §9.9.5.3). A device reports a price, a price level, or both. */
export interface CommodityPriceEntryInfo {
    periodStart: number;
    /** Undefined when the period has no definite end. */
    periodEnd?: number;
    price?: string;
    priceLevel?: number;
}

/**
 * Decoded CommodityPrice attributes. `currentPrice` is undefined when it is null or not decodable. A price is
 * undefined without a usable Currency, because its scale is then unknown. The Description and Components fields are
 * not decoded: the spec omits them from both attributes (§9.9.6.3, §9.9.6.4).
 */
export interface CommodityPriceInfo {
    supported: boolean;
    tariffUnit?: string;
    currentPrice?: CommodityPriceEntryInfo;
    priceForecast: CommodityPriceEntryInfo[];
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${COMMODITY_PRICE_CLUSTER_ID}/${attributeId}`];
}

function decodeEntry(value: unknown, currency: CurrencyInfo | undefined): CommodityPriceEntryInfo | undefined {
    const periodStart = toNumber(field(value, 0));
    if (periodStart === undefined) return undefined;
    return {
        periodStart,
        periodEnd: toNumber(field(value, 1)),
        price: formatPrice(field(value, 2), currency),
        priceLevel: toNumber(field(value, 3)),
    };
}

function decodeEntries(value: unknown, currency: CurrencyInfo | undefined): CommodityPriceEntryInfo[] {
    if (!Array.isArray(value)) return new Array<CommodityPriceEntryInfo>();
    return value
        .map(entry => decodeEntry(entry, currency))
        .filter((entry): entry is CommodityPriceEntryInfo => entry !== undefined);
}

export function commodityPriceInfo(attributes: Record<string, unknown>, endpoint: number): CommodityPriceInfo {
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    const tariffUnit = toNumber(attr(attributes, endpoint, ATTR_TARIFF_UNIT));
    const currencyValue = attr(attributes, endpoint, ATTR_CURRENCY);
    const currency = currencyInfo(field(currencyValue, 0), field(currencyValue, 1));

    return {
        supported: featureMap !== undefined,
        tariffUnit: tariffUnit === undefined ? undefined : (TARIFF_UNIT_NAMES[tariffUnit] ?? `Unknown (${tariffUnit})`),
        currentPrice: decodeEntry(attr(attributes, endpoint, ATTR_CURRENT_PRICE), currency),
        priceForecast: decodeEntries(attr(attributes, endpoint, ATTR_PRICE_FORECAST), currency),
    };
}

/** "0.25 € / kWh, level 2": the price per unit and the price level, whichever the entry has. */
export function formatPriceEntry(entry: CommodityPriceEntryInfo, tariffUnit: string | undefined): string | undefined {
    const parts = new Array<string>();
    if (entry.price !== undefined) {
        parts.push(tariffUnit !== undefined ? `${entry.price} / ${tariffUnit}` : entry.price);
    }
    if (entry.priceLevel !== undefined) parts.push(`level ${entry.priceLevel}`);
    return parts.length > 0 ? parts.join(", ") : undefined;
}
