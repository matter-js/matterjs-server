/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { MatterClient } from "@matter-server/ws-client";
import { mdiArrowLeft, mdiLogout } from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../../components/ha-svg-icon";

interface HeaderAction {
    label: string;
    icon: string;
    action: void;
}

@customElement("dashboard-header")
export class DashboardHeader extends LitElement {
    @property() public backButton?: string;
    @property() public actions?: HeaderAction[];

    public client?: MatterClient;

    protected override render() {
        return html`
            <div class="header">
                <!-- optional back button -->
                ${this.backButton
                    ? html` <a .href=${this.backButton}>
                          <md-icon-button>
                              <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
                          </md-icon-button>
                      </a>`
                    : ""}

                <div>${this.title || ""}</div>
                <div class="flex"></div>
                <div class="actions">
                    ${this.actions?.map(action => {
                        return html`
                            <md-icon-button @click=${action.action} .title=${action.label}>
                                <ha-svg-icon .path=${action.icon}></ha-svg-icon>
                            </md-icon-button>
                        `;
                    })}
                    <!-- optional logout button -->
                    ${this.client?.isProduction
                        ? nothing
                        : html`
                              <md-icon-button @click=${this.client?.disconnect}>
                                  <ha-svg-icon .path=${mdiLogout}></ha-svg-icon>
                              </md-icon-button>
                          `}
                </div>
            </div>
        `;
    }

    static override styles = css`
        .header {
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            --icon-primary-color: var(--md-sys-color-on-primary);
            font-weight: 400;
            display: flex;
            align-items: center;
            padding-left: 18px;
            padding-right: 8px;
            height: 48px;
        }

        md-icon-button {
            margin-right: 8px;
        }

        .flex {
            flex: 1;
        }
    `;
}
