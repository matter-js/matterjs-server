/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("dashboard-footer")
export class DashboardFooter extends LitElement {
    protected override render() {
        return html`
            <div class="footer">
                The OHF Matter Server is a project by the Open Home Foundation.
                <a href="https://www.openhomefoundation.org/structure/#support-our-work" target="_blank"
                    >Support development</a
                >
            </div>
        `;
    }

    static override styles = css`
        .footer {
            padding: 4px 16px;
            text-align: center;
            font-size: 0.75em;
            color: var(--md-sys-color-on-surface-variant);
            flex-shrink: 0;
        }

        .footer a {
            color: var(--md-sys-color-on-surface);
        }
    `;
}
