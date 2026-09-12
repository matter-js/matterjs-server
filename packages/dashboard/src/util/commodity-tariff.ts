/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber, toText } from "./attribute-shapes.js";

export const COMMODITY_TARIFF_CLUSTER_ID = 1792;

const ATTR_TARIFF_INFO = 0;
const ATTR_TARIFF_UNIT = 1;
const ATTR_START_DATE = 2;
const ATTR_DAY_ENTRIES = 3;
const ATTR_CURRENT_DAY = 7;
const ATTR_NEXT_DAY = 8;
const ATTR_CURRENT_DAY_ENTRY = 9;
const ATTR_CURRENT_DAY_ENTRY_DATE = 10;
const ATTR_NEXT_DAY_ENTRY = 11;
const ATTR_NEXT_DAY_ENTRY_DATE = 12;
const ATTR_TARIFF_COMPONENTS = 13;
const ATTR_TARIFF_PERIODS = 14;
const ATTR_CURRENT_TARIFF_COMPONENTS = 15;
const ATTR_NEXT_TARIFF_COMPONENTS = 16;
const ATTR_FEATURE_MAP = 0xfffc;

const MINUTES_PER_DAY = 24 * 60;

/** DayEntry.StartTime reaches 1499: Matter's day axis carries the extra hour of a DST fall-back day. */
const MAX_DAY_MINUTES = 1500;

/** ISO 4217 allows at most 4 minor units; toFixed rejects more than 100 digits. */
const MAX_DECIMAL_POINTS = 6;

const BLOCK_MODE_NAMES: Record<number, string> = {
    0: "No usage blocks",
    1: "Combined usage blocks",
    2: "Individual usage blocks",
};

/** Matter 1.6 §9.12.5.6: what a tariff component's Threshold field(s) actually meter. */
const BLOCK_MODE_DESCRIPTIONS: Record<number, string> = {
    0: "This tariff has no usage-based price tiers.",
    1: "Price tiers apply to total usage combined across all tariff components during the billing period.",
    2: "Price tiers apply separately to usage during each tariff component's own active period.",
};
const DAY_TYPE_NAMES: Record<number, string> = { 0: "Standard", 1: "Holiday", 2: "Dynamic", 3: "Event" };
const TARIFF_PRICE_TYPE_NAMES: Record<number, string> = {
    0: "Standard",
    1: "Critical Peak",
    2: "Virtual Power Plant",
    3: "Incentive",
    4: "Incentive Signal",
};
const TARIFF_UNIT_NAMES: Record<number, string> = { 0: "kWh", 1: "kVAh" };

/** ISO 4217 numeric currency codes; falls back to the raw code when not listed here. */
const CURRENCY_SYMBOLS: Record<number, string> = { 978: "€", 840: "$", 826: "£", 756: "CHF" };

export interface CurrencyInfo {
    code: number;
    decimalPoints: number;
    symbol?: string;
}

export interface TariffInfo {
    label?: string;
    providerName?: string;
    currency?: CurrencyInfo;
    blockMode?: string;
    blockModeDescription?: string;
}

export interface TariffPriceInfo {
    priceType: string;
    amount?: string;
    priceLevel?: number;
}

export interface TariffComponentInfo {
    id: number;
    label?: string;
    price?: TariffPriceInfo;
    threshold?: number;
}

export interface DayEntryInfo {
    id: number;
    startMinutes: number;
    durationMinutes?: number;
}

export interface TariffPeriodInfo {
    /** Position in the TariffPeriods list; identifies a period, since labels are neither unique nor mandatory. */
    index: number;
    label?: string;
    dayEntryIds: number[];
    tariffComponentIds: number[];
}

export interface DayInfo {
    date?: number;
    dayType?: string;
    dayEntryIds: number[];
}

export interface ScheduleRow {
    entryId: number;
    startMinutes: number;
    endMinutes: number;
    label?: string;
    price?: TariffPriceInfo;
}

export interface TariffRange {
    /** Epoch seconds the range starts at. */
    start: number;
    /** Epoch seconds the range ends at, when known. */
    end?: number;
}

export interface CommodityTariffInfo {
    supported: boolean;
    tariffInfo?: TariffInfo;
    tariffUnit?: string;
    startDate?: number;
    currentComponent?: TariffComponentInfo;
    nextComponent?: TariffComponentInfo;
    currentRange?: TariffRange;
    nextRange?: TariffRange;
    todayType?: string;
    tomorrowType?: string;
    todaySchedule: ScheduleRow[];
    tomorrowSchedule: ScheduleRow[];
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${COMMODITY_TARIFF_CLUSTER_ID}/${attributeId}`];
}

function numberList(value: unknown): number[] {
    return Array.isArray(value)
        ? value.map(toNumber).filter((v): v is number => v !== undefined && Number.isFinite(v))
        : [];
}

function enumName(value: unknown, names: Record<number, string>): string | undefined {
    const raw = toNumber(value);
    if (raw === undefined) return undefined;
    return names[raw] ?? `Unknown (${raw})`;
}

function decodeCurrency(value: unknown): CurrencyInfo | undefined {
    const code = toNumber(field(value, 0));
    const decimalPoints = toNumber(field(value, 1));
    if (code === undefined || decimalPoints === undefined) return undefined;
    if (decimalPoints < 0 || decimalPoints > MAX_DECIMAL_POINTS) return undefined;
    return { code, decimalPoints, symbol: CURRENCY_SYMBOLS[code] };
}

/**
 * Formats a raw tariff price integer using the currency's decimal point scale (e.g. 1579 @ 4dp -> "0.1579 €").
 * Without a currency the scale is unknown, and a raw integer would read as a price it is not.
 */
export function formatPrice(price: unknown, currency: CurrencyInfo | undefined): string | undefined {
    const raw = toNumber(price);
    if (raw === undefined || currency === undefined) return undefined;
    const amount = (raw / 10 ** currency.decimalPoints).toFixed(currency.decimalPoints);
    return currency.symbol ? `${amount} ${currency.symbol}` : `${amount} (ISO 4217 #${currency.code})`;
}

function decodeTariffInfo(value: unknown): TariffInfo | undefined {
    const blockMode = toNumber(field(value, 3));
    const present = [0, 1, 2].some(tag => field(value, tag) !== undefined) || blockMode !== undefined;
    if (!present) return undefined;
    return {
        label: toText(field(value, 0)),
        providerName: toText(field(value, 1)),
        currency: decodeCurrency(field(value, 2)),
        blockMode: enumName(blockMode, BLOCK_MODE_NAMES),
        blockModeDescription: blockMode !== undefined ? BLOCK_MODE_DESCRIPTIONS[blockMode] : undefined,
    };
}

function decodeTariffPrice(value: unknown, currency: CurrencyInfo | undefined): TariffPriceInfo | undefined {
    const priceType = toNumber(field(value, 0));
    const price = field(value, 1);
    if (priceType === undefined && price === undefined) return undefined;
    return {
        priceType: enumName(priceType, TARIFF_PRICE_TYPE_NAMES) ?? "Unknown",
        amount: formatPrice(price, currency),
        priceLevel: toNumber(field(value, 2)),
    };
}

function decodeTariffComponent(value: unknown, currency: CurrencyInfo | undefined): TariffComponentInfo | undefined {
    const id = toNumber(field(value, 0));
    if (id === undefined) return undefined;
    return {
        id,
        label: toText(field(value, 7)),
        price: decodeTariffPrice(field(value, 1), currency),
        threshold: toNumber(field(value, 6)),
    };
}

function decodeTariffComponents(value: unknown, currency: CurrencyInfo | undefined): TariffComponentInfo[] {
    return Array.isArray(value)
        ? value
              .map(entry => decodeTariffComponent(entry, currency))
              .filter((c): c is TariffComponentInfo => c !== undefined)
        : [];
}

function decodeDayEntry(value: unknown): DayEntryInfo | undefined {
    const id = toNumber(field(value, 0));
    const startMinutes = toNumber(field(value, 1));
    if (id === undefined || startMinutes === undefined) return undefined;
    return { id, startMinutes, durationMinutes: toNumber(field(value, 2)) };
}

function decodeDayEntries(value: unknown): DayEntryInfo[] {
    return Array.isArray(value) ? value.map(decodeDayEntry).filter((e): e is DayEntryInfo => e !== undefined) : [];
}

function decodeTariffPeriods(value: unknown): TariffPeriodInfo[] {
    return Array.isArray(value)
        ? value.map((entry, index) => ({
              index,
              label: toText(field(entry, 0)),
              dayEntryIds: numberList(field(entry, 1)),
              tariffComponentIds: numberList(field(entry, 2)),
          }))
        : [];
}

function decodeDay(value: unknown): DayInfo | undefined {
    const dayEntryIds = numberList(field(value, 2));
    const date = toNumber(field(value, 0));
    const dayType = enumName(field(value, 1), DAY_TYPE_NAMES);
    if (dayEntryIds.length === 0 && date === undefined && dayType === undefined) return undefined;
    return { date, dayType, dayEntryIds };
}

/** The day's entries in time order; ids the DayEntries attribute doesn't describe are dropped. */
function orderedDayEntries(day: DayInfo | undefined, dayEntries: DayEntryInfo[]): DayEntryInfo[] {
    if (!day) return [];
    return day.dayEntryIds
        .map(id => dayEntries.find(entry => entry.id === id))
        .filter((entry): entry is DayEntryInfo => entry !== undefined)
        .sort((a, b) => a.startMinutes - b.startMinutes);
}

/** A day entry may appear in several periods, each contributing its own components. */
function periodsOf(entryId: number, tariffPeriods: TariffPeriodInfo[]): TariffPeriodInfo[] {
    return tariffPeriods.filter(period => period.dayEntryIds.includes(entryId));
}

/** Periods list every component that applies (price, friendly credit, thresholds); price is what a panel shows. */
function resolveComponent(
    periods: TariffPeriodInfo[],
    tariffComponents: TariffComponentInfo[],
): TariffComponentInfo | undefined {
    const ids = new Set(periods.flatMap(period => period.tariffComponentIds));
    return pickPricedComponent(tariffComponents.filter(component => ids.has(component.id)));
}

function pickPricedComponent(components: TariffComponentInfo[]): TariffComponentInfo | undefined {
    return components.find(component => component.price !== undefined) ?? components[0];
}

/** The set of periods an entry belongs to, since one period changing is what starts a new price range. */
function periodKey(periods: TariffPeriodInfo[]): string | undefined {
    return periods.length > 0 ? periods.map(period => period.index).join(",") : undefined;
}

/** A day that uses the 25th hour spans further than midnight. */
function daySpanMinutes(entries: DayEntryInfo[]): number {
    const lastStart = entries[entries.length - 1]?.startMinutes ?? 0;
    return lastStart >= MINUTES_PER_DAY ? MAX_DAY_MINUTES : MINUTES_PER_DAY;
}

interface TimelineSlot {
    entryId: number;
    /** Minutes since the start of the timeline's first day, so a slot on the following day is >= that day's span. */
    startMinutes: number;
    periodKey?: string;
}

/**
 * Lays consecutive days' entries onto one minute axis. A period active at day-end and resumed at day-start
 * (e.g. an off-peak block spanning midnight) is modeled as two DayEntry records because DayEntry.startTime
 * can't cross midnight, so spotting where a period really ends needs the following day's entries too.
 */
function buildTimeline(
    days: (DayInfo | undefined)[],
    dayEntries: DayEntryInfo[],
    tariffPeriods: TariffPeriodInfo[],
): TimelineSlot[] {
    const timeline = new Array<TimelineSlot>();
    let dayStartMinutes = 0;
    for (const day of days) {
        const entries = orderedDayEntries(day, dayEntries);
        for (const entry of entries) {
            timeline.push({
                entryId: entry.id,
                startMinutes: entry.startMinutes + dayStartMinutes,
                periodKey: periodKey(periodsOf(entry.id, tariffPeriods)),
            });
        }
        dayStartMinutes += daySpanMinutes(entries);
    }
    return timeline;
}

function findSlot(timeline: TimelineSlot[], entryId: number, afterPosition: number): number {
    return timeline.findIndex((slot, position) => position > afterPosition && slot.entryId === entryId);
}

/**
 * Epoch seconds at which the period starting at `position` gives way to another one, or undefined when the
 * timeline doesn't reach that far. Offsets are wall-clock minutes, so a DST change inside the range shifts
 * the computed end by an hour.
 */
function rangeEnd(startEpochSeconds: number, timeline: TimelineSlot[], position: number): number | undefined {
    const from = timeline[position];
    if (from === undefined) return undefined;
    for (const slot of timeline.slice(position + 1)) {
        if (slot.startMinutes <= from.startMinutes) continue;
        if (slot.periodKey !== from.periodKey) {
            return startEpochSeconds + (slot.startMinutes - from.startMinutes) * 60;
        }
    }
    return undefined;
}

/** Resolves a day's entry ids into time-ordered rows, each showing the period label and price active during it. */
function buildDailySchedule(
    day: DayInfo | undefined,
    dayEntries: DayEntryInfo[],
    tariffPeriods: TariffPeriodInfo[],
    tariffComponents: TariffComponentInfo[],
): ScheduleRow[] {
    const entries = orderedDayEntries(day, dayEntries);
    const dayEnd = daySpanMinutes(entries);
    return entries.map((entry, index) => {
        const nextStart = entries[index + 1]?.startMinutes ?? dayEnd;
        const periods = periodsOf(entry.id, tariffPeriods);
        const component = resolveComponent(periods, tariffComponents);
        return {
            entryId: entry.id,
            startMinutes: entry.startMinutes,
            endMinutes:
                entry.durationMinutes !== undefined
                    ? Math.min(entry.startMinutes + entry.durationMinutes, Math.max(nextStart, entry.startMinutes))
                    : Math.max(nextStart, entry.startMinutes),
            label: periods.find(period => period.label !== undefined)?.label ?? component?.label,
            price: component?.price,
        };
    });
}

/** Formats minutes on Matter's day axis as "HH:MM"; the hours past midnight of a 25-hour day read as 24:xx. */
export function formatMinutesOfDay(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function commodityTariffInfo(attributes: Record<string, unknown>, endpoint: number): CommodityTariffInfo {
    const featureMap = attr(attributes, endpoint, ATTR_FEATURE_MAP);
    const tariffInfo = decodeTariffInfo(attr(attributes, endpoint, ATTR_TARIFF_INFO));
    const currency = tariffInfo?.currency;
    const dayEntries = decodeDayEntries(attr(attributes, endpoint, ATTR_DAY_ENTRIES));
    const tariffPeriods = decodeTariffPeriods(attr(attributes, endpoint, ATTR_TARIFF_PERIODS));
    const tariffComponents = decodeTariffComponents(attr(attributes, endpoint, ATTR_TARIFF_COMPONENTS), currency);
    const currentComponents = decodeTariffComponents(
        attr(attributes, endpoint, ATTR_CURRENT_TARIFF_COMPONENTS),
        currency,
    );
    const nextComponents = decodeTariffComponents(attr(attributes, endpoint, ATTR_NEXT_TARIFF_COMPONENTS), currency);
    const today = decodeDay(attr(attributes, endpoint, ATTR_CURRENT_DAY));
    const tomorrow = decodeDay(attr(attributes, endpoint, ATTR_NEXT_DAY));

    const timeline = buildTimeline([today, tomorrow], dayEntries, tariffPeriods);
    const currentDayEntry = decodeDayEntry(attr(attributes, endpoint, ATTR_CURRENT_DAY_ENTRY));
    const currentPosition = currentDayEntry !== undefined ? findSlot(timeline, currentDayEntry.id, -1) : -1;
    const nextDayEntry = decodeDayEntry(attr(attributes, endpoint, ATTR_NEXT_DAY_ENTRY));
    const nextPosition = nextDayEntry !== undefined ? findSlot(timeline, nextDayEntry.id, currentPosition) : -1;
    const currentDayEntryDate = toNumber(attr(attributes, endpoint, ATTR_CURRENT_DAY_ENTRY_DATE));
    const nextDayEntryDate = toNumber(attr(attributes, endpoint, ATTR_NEXT_DAY_ENTRY_DATE));

    return {
        supported: featureMap !== undefined,
        tariffInfo,
        tariffUnit: enumName(attr(attributes, endpoint, ATTR_TARIFF_UNIT), TARIFF_UNIT_NAMES),
        startDate: toNumber(attr(attributes, endpoint, ATTR_START_DATE)),
        currentComponent: pickPricedComponent(currentComponents),
        nextComponent: pickPricedComponent(nextComponents),
        currentRange:
            currentDayEntryDate !== undefined
                ? { start: currentDayEntryDate, end: rangeEnd(currentDayEntryDate, timeline, currentPosition) }
                : undefined,
        nextRange:
            nextDayEntryDate !== undefined
                ? { start: nextDayEntryDate, end: rangeEnd(nextDayEntryDate, timeline, nextPosition) }
                : undefined,
        todayType: today?.dayType,
        tomorrowType: tomorrow?.dayType,
        todaySchedule: buildDailySchedule(today, dayEntries, tariffPeriods, tariffComponents),
        tomorrowSchedule: buildDailySchedule(tomorrow, dayEntries, tariffPeriods, tariffComponents),
    };
}
