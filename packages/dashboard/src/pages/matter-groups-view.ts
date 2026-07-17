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
import { GroupInfo, MatterClient } from "@matter-server/ws-client";
import { mdiAccountGroup, mdiChevronRight } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../components/ha-svg-icon";
import { formatHex } from "../util/format_hex.js";
import "./components/header";
import type { ActiveView } from "./components/header.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-groups-view": MatterGroupsView;
    }
}

function multicastPolicyLabel(value: number | null): string {
    switch (value) {
        case 0:
            return "PerGroupId";
        case 1:
            return "AllNodes";
        case null:
            return "—";
        default:
            return `Unknown (${value})`;
    }
}

@customElement("matter-groups-view")
class MatterGroupsView extends LitElement {
    public client!: MatterClient;

    @property() public activeView?: ActiveView;
    @property({ type: Boolean }) public hasThreadDevices?: boolean;
    @property({ type: Boolean }) public hasWifiDevices?: boolean;

    @state() private _groups: GroupInfo[] | null = null;
    @state() private _error: string | null = null;
    @state() private _loading = true;

    override connectedCallback(): void {
        super.connectedCallback();
        void this._loadGroups();
    }

    private async _loadGroups() {
        this._loading = true;
        this._error = null;
        try {
            this._groups = await this.client.getGroups();
        } catch (err) {
            this._error = err instanceof Error ? err.message : String(err);
            this._groups = [];
        } finally {
            this._loading = false;
        }
    }

    override render() {
        return html`
            <dashboard-header
                title="Groups"
                .client=${this.client}
                .activeView=${this.activeView}
                .hasThreadDevices=${this.hasThreadDevices}
                .hasWifiDevices=${this.hasWifiDevices}
            ></dashboard-header>

            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Groups configured on the controller</b>
                        </div>
                        <div slot="supporting-text">
                            ${this._loading
                                ? "Loading…"
                                : this._error
                                  ? html`<span class="status">${this._error}</span>`
                                  : `${this._groups?.length ?? 0} group(s)`}
                        </div>
                    </md-list-item>
                    ${this._groups && this._groups.length > 0
                        ? this._groups.map(
                              group => html`
                                  <md-list-item type="link" href=${`#groups/${group.group_id}`}>
                                      <ha-svg-icon
                                          slot="start"
                                          class="group-icon"
                                          .path=${mdiAccountGroup}
                                      ></ha-svg-icon>
                                      <div slot="headline">Group ${group.group_id} (${formatHex(group.group_id)})</div>
                                      <div slot="supporting-text">
                                          KeySet ${group.group_key_set_id} · Multicast policy:
                                          ${multicastPolicyLabel(group.group_key_multicast_policy)}
                                      </div>
                                      <ha-svg-icon slot="end" .path=${mdiChevronRight}></ha-svg-icon>
                                  </md-list-item>
                              `,
                          )
                        : !this._loading && !this._error
                          ? html`<md-list-item>
                                <div slot="supporting-text">
                                    No groups configured. Provide a groups configuration via
                                    <code>--groups-config</code> when starting the server.
                                </div>
                            </md-list-item>`
                          : nothing}
                </md-list>
            </div>
        `;
    }

    static override styles = css`
        :host {
            display: block;
            background-color: var(--md-sys-color-background);
        }

        .container {
            padding: 16px;
            max-width: 95%;
            margin: 0 auto;
        }

        .group-icon {
            --icon-primary-color: var(--md-sys-color-on-surface-variant, #666);
        }

        .status {
            color: var(--danger-color);
            font-weight: bold;
            font-size: 0.85em;
        }

        code {
            font-family: var(--monospace-font);
            background: var(--md-sys-color-surface-container-high);
            padding: 0 4px;
            border-radius: 3px;
        }
    `;
}
