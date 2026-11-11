/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import {
    POWER_SOURCE_CLUSTER_ID,
    powerSourceInfo,
    powerSourceSections,
    type PowerSourceRow,
} from "../../../util/power-source.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Read-only decoding panel for the PowerSource cluster (ID: 0x2F / 47).
 */
@customElement("power-source-cluster-commands")
export class PowerSourceClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== POWER_SOURCE_CLUSTER_ID) return nothing;
        const info = powerSourceInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;
        const sections = powerSourceSections(info);

        return html`
            <details class="command-panel" open>
                <summary>Power Source</summary>
                <div class="command-content">
                    ${this._renderRows(sections.general)}
                    ${sections.wired ? this._renderSection("Wired", sections.wired) : nothing}
                    ${sections.battery ? this._renderSection("Battery", sections.battery) : nothing}
                </div>
            </details>
        `;
    }

    private _renderSection(title: string, rows: PowerSourceRow[]): TemplateResult {
        return html`
            <div class="section-header">${title}</div>
            ${this._renderRows(rows)}
        `;
    }

    private _renderRows(rows: PowerSourceRow[]): TemplateResult | typeof nothing {
        if (rows.length === 0) return nothing;
        return html`
            <dl class="info-grid">
                ${rows.map(
                    row =>
                        html`<dt>${row.label}</dt>
                            <dd>${row.value}</dd>`,
                )}
            </dl>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .section-header {
                font-weight: 500;
                font-size: 0.85rem;
                color: var(--md-sys-color-on-surface-variant);
                margin: 12px 0 4px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 6px 16px;
                margin: 0;
            }
            .info-grid dt {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
                font-size: 13px;
            }
            .info-grid dd {
                margin: 0;
                font-weight: 500;
            }
        `,
    ];
}

registerClusterCommands(POWER_SOURCE_CLUSTER_ID, "power-source-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "power-source-cluster-commands": PowerSourceClusterCommands;
    }
}
