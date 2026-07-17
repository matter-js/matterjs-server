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
import { mdiAlertCircleOutline, mdiChevronRight } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ClusterDescription, clusters } from "../client/models/descriptions.js";
import "../components/ha-svg-icon";
import { formatHex } from "../util/format_hex.js";
import { notFoundStyles } from "../util/shared-styles.js";
import "./components/header";

declare global {
    interface HTMLElementTagNameMap {
        "matter-group-view": MatterGroupView;
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

@customElement("matter-group-view")
class MatterGroupView extends LitElement {
    public client!: MatterClient;

    @property({ type: Number }) public groupId?: number;

    @state() private _group: GroupInfo | null = null;
    @state() private _error: string | null = null;
    @state() private _loading = true;

    override updated(changed: Map<string, unknown>): void {
        if (changed.has("groupId") && this.groupId !== undefined) {
            void this._loadGroup();
        }
    }

    private async _loadGroup() {
        this._loading = true;
        this._error = null;
        try {
            const all = await this.client.getGroups();
            this._group = all.find(g => g.group_id === this.groupId) ?? null;
            if (this._group === null) {
                this._error = `Group ${this.groupId} not configured on the controller`;
            }
        } catch (err) {
            this._error = err instanceof Error ? err.message : String(err);
            this._group = null;
        } finally {
            this._loading = false;
        }
    }

    private _allClustersSorted(): ClusterDescription[] {
        const list = Object.values(clusters);
        return list.sort((a, b) => a.id - b.id);
    }

    override render() {
        if (this.groupId === undefined) {
            return html`
                <dashboard-header
                    title="Group not found"
                    .client=${this.client}
                    backButton="#groups"
                ></dashboard-header>
                <div class="not-found">
                    <ha-svg-icon .path=${mdiAlertCircleOutline}></ha-svg-icon>
                    <p>Group ID missing</p>
                </div>
            `;
        }

        const allClusters = this._allClustersSorted();

        return html`
            <dashboard-header
                .title=${`Group ${this.groupId} (${formatHex(this.groupId)})`}
                .backButton=${"#groups"}
                .client=${this.client}
            ></dashboard-header>

            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Group ${this.groupId}</b>
                        </div>
                        <div slot="supporting-text">
                            ${this._loading
                                ? "Loading…"
                                : this._error
                                  ? html`<span class="status">${this._error}</span>`
                                  : this._group
                                    ? html`KeySet ${this._group.group_key_set_id} · Multicast policy:
                                      ${multicastPolicyLabel(this._group.group_key_multicast_policy)}`
                                    : nothing}
                        </div>
                    </md-list-item>
                </md-list>
            </div>

            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Clusters</b>
                        </div>
                        <div slot="supporting-text">
                            All clusters from the metadata. Pick one to send a group-cast write or invoke.
                        </div>
                    </md-list-item>
                    <md-divider></md-divider>
                    ${allClusters.map(
                        cluster => html`
                            <md-list-item type="link" href=${`#groups/${this.groupId}/${cluster.id}`}>
                                <div slot="headline">${cluster.label}</div>
                                <div slot="supporting-text">ClusterId ${cluster.id} (${formatHex(cluster.id)})</div>
                                <ha-svg-icon slot="end" .path=${mdiChevronRight}></ha-svg-icon>
                            </md-list-item>
                        `,
                    )}
                </md-list>
            </div>
        `;
    }

    static override styles = [
        notFoundStyles,
        css`
            :host {
                display: block;
                background-color: var(--md-sys-color-background);
            }

            .container {
                padding: 16px;
                max-width: 95%;
                margin: 0 auto;
            }

            .status {
                color: var(--danger-color);
                font-weight: bold;
                font-size: 0.85em;
            }
        `,
    ];
}
