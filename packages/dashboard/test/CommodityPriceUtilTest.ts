/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { commodityPriceInfo, formatPriceEntry } from "../src/util/commodity-price.js";

const CP = "1/149";

const ATTRIBUTES = {
    [`${CP}/65532`]: 0b1,
    [`${CP}/0`]: 0,
    [`${CP}/1`]: { "0": 978, "1": 2 },
    [`${CP}/2`]: { "0": 1000, "1": 2000, "2": 25, "3": 2 },
    [`${CP}/3`]: [
        { "0": 2001, "1": 3000, "2": 30 },
        { "0": 3001, "1": null, "3": 4 },
    ],
};

function info(attributes: Record<string, unknown> = ATTRIBUTES) {
    return commodityPriceInfo(attributes, 1);
}

describe("commodityPriceInfo", () => {
    it("decodes unit, current price and forecast with prices scaled by the currency", () => {
        expect(info()).to.deep.equal({
            supported: true,
            tariffUnit: "kWh",
            currentPrice: { periodStart: 1000, periodEnd: 2000, price: "0.25 €", priceLevel: 2 },
            priceForecast: [
                { periodStart: 2001, periodEnd: 3000, price: "0.30 €", priceLevel: undefined },
                { periodStart: 3001, periodEnd: undefined, price: undefined, priceLevel: 4 },
            ],
        });
    });

    it("reports unsupported when the FeatureMap is absent or was removed (null)", () => {
        expect(info({}).supported).to.equal(false);
        expect(info({ [`${CP}/65532`]: null }).supported).to.equal(false);
    });

    it("leaves the current price undefined when the device cannot determine it (null)", () => {
        expect(info({ ...ATTRIBUTES, [`${CP}/2`]: null }).currentPrice).to.equal(undefined);
    });

    it("leaves the price out when the currency is unknown (null) or its scale is invalid", () => {
        expect(info({ ...ATTRIBUTES, [`${CP}/1`]: null }).currentPrice).to.deep.equal({
            periodStart: 1000,
            periodEnd: 2000,
            price: undefined,
            priceLevel: 2,
        });
        expect(info({ ...ATTRIBUTES, [`${CP}/1`]: { "0": 978, "1": 7 } }).currentPrice?.price).to.equal(undefined);
    });

    it("formats bigint and negative prices and drops a price outside the safe integer range", () => {
        const price = (value: unknown) =>
            info({ ...ATTRIBUTES, [`${CP}/2`]: { "0": 1000, "2": value } }).currentPrice?.price;
        expect(price(BigInt(25))).to.equal("0.25 €");
        expect(price(-25)).to.equal("-0.25 €");
        expect(price(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).to.equal(undefined);
    });

    it("names an unknown tariff unit by its value and treats a removed forecast as empty", () => {
        const decoded = info({ ...ATTRIBUTES, [`${CP}/0`]: 7, [`${CP}/3`]: null });
        expect(decoded.tariffUnit).to.equal("Unknown (7)");
        expect(decoded.priceForecast).to.deep.equal([]);
    });

    it("skips forecast entries without a PeriodStart", () => {
        expect(info({ ...ATTRIBUTES, [`${CP}/3`]: [{ "2": 30 }] }).priceForecast).to.deep.equal([]);
    });
});

describe("formatPriceEntry", () => {
    it("shows the price per unit, the level, or both", () => {
        expect(formatPriceEntry({ periodStart: 0, price: "0.25 €", priceLevel: 2 }, "kWh")).to.equal(
            "0.25 € / kWh, level 2",
        );
        expect(formatPriceEntry({ periodStart: 0, price: "0.25 €" }, undefined)).to.equal("0.25 €");
        expect(formatPriceEntry({ periodStart: 0, priceLevel: -1 }, "kWh")).to.equal("level -1");
        expect(formatPriceEntry({ periodStart: 0 }, "kWh")).to.equal(undefined);
    });
});
