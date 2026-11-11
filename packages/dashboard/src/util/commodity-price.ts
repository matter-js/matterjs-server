/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber, toText } from "./attribute-shapes.js";
import { currencyInfo, type CurrencyInfo, formatPrice } from "./commodity-tariff.js";

export const COMMODITY_PRICE_CLUSTER_ID = 0x95;

const ATTR_TARIFF_UNIT = 0;
const ATTR_CURRENCY = 1;
const ATTR_CURRENT_PRICE = 2;
const ATTR_PRICE_FORECAST = 3;
const ATTR_FEATURE_MAP = 0xfffc;

const TARIFF_UNIT_NAMES: Record<number, string> = { 0: "kWh", 1: "kVAh" };
const TARIFF_PRICE_TYPE_NAMES: Record<number, string> = {
    0: "Standard",
    1: "Critical Peak",
    2: "Virtual Power Plant",
    3: "Incentive",
    4: "Incentive Signal",
};

export interface CommodityPriceComponentInfo {
    price?: string;
    source: string;
    description?: string;
}

export interface CommodityPriceEntryInfo {
    periodStart: number;
    periodEnd?: number;
    amount?: string;
    priceLevel?: number;
    description?: string;
    components: CommodityPriceComponentInfo[];
}

export interface CommodityPriceInfo {
    supported: boolean;
    tariffUnit?: string;
    currency?: CurrencyInfo;
    currentPrice?: CommodityPriceEntryInfo;
    priceForecast: CommodityPriceEntryInfo[];
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${COMMODITY_PRICE_CLUSTER_ID}/${attributeId}`];
}

function enumName(value: unknown, names: Record<number, string>): string | undefined {
    const raw = toNumber(value);
    if (raw === undefined) return undefined;
    return names[raw] ?? `Unknown (${raw})`;
}

function decodeComponent(value: unknown, currency: CurrencyInfo | undefined): CommodityPriceComponentInfo | undefined {
    const source = enumName(field(value, 1), TARIFF_PRICE_TYPE_NAMES);
    if (source === undefined) return undefined;
    return {
        price: formatPrice(field(value, 0), currency),
        source,
        description: toText(field(value, 2)),
    };
}

function decodeComponents(value: unknown, currency: CurrencyInfo | undefined): CommodityPriceComponentInfo[] {
    return Array.isArray(value)
        ? value
              .map(entry => decodeComponent(entry, currency))
              .filter((c): c is CommodityPriceComponentInfo => c !== undefined)
        : [];
}

function decodeEntry(value: unknown, currency: CurrencyInfo | undefined): CommodityPriceEntryInfo | undefined {
    const periodStart = toNumber(field(value, 0));
    if (periodStart === undefined) return undefined;
    return {
        periodStart,
        periodEnd: toNumber(field(value, 1)),
        amount: formatPrice(field(value, 2), currency),
        priceLevel: toNumber(field(value, 3)),
        description: toText(field(value, 4)),
        components: decodeComponents(field(value, 5), currency),
    };
}

function decodeEntries(value: unknown, currency: CurrencyInfo | undefined): CommodityPriceEntryInfo[] {
    return Array.isArray(value)
        ? value.map(entry => decodeEntry(entry, currency)).filter((e): e is CommodityPriceEntryInfo => e !== undefined)
        : [];
}

export function commodityPriceInfo(attributes: Record<string, unknown>, endpoint: number): CommodityPriceInfo {
    const featureMap = attr(attributes, endpoint, ATTR_FEATURE_MAP);
    const currencyValue = attr(attributes, endpoint, ATTR_CURRENCY);
    const currency = currencyInfo(field(currencyValue, 0), field(currencyValue, 1));

    return {
        supported: featureMap !== undefined,
        tariffUnit: enumName(attr(attributes, endpoint, ATTR_TARIFF_UNIT), TARIFF_UNIT_NAMES),
        currency,
        currentPrice: decodeEntry(attr(attributes, endpoint, ATTR_CURRENT_PRICE), currency),
        priceForecast: decodeEntries(attr(attributes, endpoint, ATTR_PRICE_FORECAST), currency),
    };
}
