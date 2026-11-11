/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import {
    COMMODITY_PRICE_CLUSTER_ID,
    type CommodityPriceEntryInfo,
    commodityPriceInfo,
} from "../../../util/commodity-price.js";
import { formatEpochTime } from "../../../util/time.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Read-only decoding panel for the CommodityPrice cluster (ID: 0x95 / 149).
 */
@customElement("commodity-price-cluster-commands")
export class CommodityPriceClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== COMMODITY_PRICE_CLUSTER_ID) return nothing;
        const info = commodityPriceInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;

        return html`
            <details class="command-panel" open>
                <summary>Commodity Price</summary>
                <div class="command-content">
                    ${this._renderCurrentPrice(info.currentPrice)} ${this._renderForecast(info.priceForecast)}

                    <dl class="info-grid">
                        ${
                            info.tariffUnit !== undefined
                                ? html`<dt>Unit</dt>
                                      <dd>${info.tariffUnit}</dd>`
                                : nothing
                        }
                    </dl>
                </div>
            </details>
        `;
    }

    private _renderCurrentPrice(entry: CommodityPriceEntryInfo | undefined): TemplateResult | typeof nothing {
        if (!entry) return nothing;
        return html`
            <div class="now-next">
                <div class="price-row current">
                    <span class="tag">Now</span>
                    <span class="text">${entry.amount ?? entry.description ?? "Unknown price"}</span>
                    <span class="range">${this._renderRange(entry)}</span>
                </div>
                ${this._renderComponents(entry.components)}
            </div>
        `;
    }

    private _renderRange(entry: CommodityPriceEntryInfo): TemplateResult {
        return html`${formatEpochTime(entry.periodStart)}${
            entry.periodEnd !== undefined ? html`–${formatEpochTime(entry.periodEnd)}` : nothing
        }`;
    }

    private _renderComponents(components: CommodityPriceEntryInfo["components"]): TemplateResult | typeof nothing {
        if (components.length === 0) return nothing;
        return html`
            <table class="price-components">
                <tbody>
                    ${components.map(
                        component => html`
                            <tr>
                                <td>${component.source}</td>
                                <td>${component.description ?? "—"}</td>
                                <td>${component.price ?? "—"}</td>
                            </tr>
                        `,
                    )}
                </tbody>
            </table>
        `;
    }

    private _renderForecast(entries: CommodityPriceEntryInfo[]): TemplateResult | typeof nothing {
        if (entries.length === 0) return nothing;
        return html`
            <details class="schedule">
                <summary>Forecast</summary>
                <table class="price-forecast">
                    <thead>
                        <tr>
                            <th>Period</th>
                            <th>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.map(
                            entry => html`
                                <tr>
                                    <td>${this._renderRange(entry)}</td>
                                    <td>${entry.amount ?? "—"}</td>
                                </tr>
                            `,
                        )}
                    </tbody>
                </table>
            </details>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .command-content {
                font-size: 14px;
            }
            .now-next {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 12px;
            }
            .price-row {
                display: flex;
                align-items: baseline;
                gap: 8px;
            }
            .price-row.current {
                font-weight: 700;
            }
            .price-row .tag {
                min-width: 40px;
                text-transform: uppercase;
                opacity: 0.6;
                font-weight: 500;
            }
            .price-row .range {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
                font-weight: 400;
            }
            details.schedule {
                margin-bottom: 12px;
            }
            details.schedule summary {
                cursor: pointer;
                color: var(--md-sys-color-primary);
            }
            .price-components,
            .price-forecast {
                width: 100%;
                border-collapse: collapse;
                margin-top: 8px;
            }
            .price-forecast th {
                text-align: left;
                text-transform: uppercase;
                opacity: 0.6;
                padding: 6px 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
            }
            .price-components td,
            .price-forecast td {
                padding: 6px 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
            }
            .info-grid {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 6px 16px;
                margin: 0;
            }
            .info-grid dt {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .info-grid dd {
                margin: 0;
                font-weight: 500;
            }
        `,
    ];
}

registerClusterCommands(COMMODITY_PRICE_CLUSTER_ID, "commodity-price-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "commodity-price-cluster-commands": CommodityPriceClusterCommands;
    }
}
