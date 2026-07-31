/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { consume } from "@lit/context";
import { isTestNodeId, MatterClient, MatterNode } from "@matter-server/ws-client";
import { mdiChevronRight } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { clientContext, tickContext } from "../client/client-context.js";
import "../components/ha-svg-icon";
import { getDeviceIcon } from "../util/device-icons.js";
import { formatNodeAddress } from "../util/format_hex.js";
import { ICD_CLUSTER_ID, icdBadge } from "../util/icd.js";
import "./components/footer";
import "./components/header";
import type { ActiveView } from "./components/header.js";
import "./components/server-details";

declare global {
    interface HTMLElementTagNameMap {
        "matter-server-view": MatterServerView;
    }
}

@customElement("matter-server-view")
class MatterServerView extends LitElement {
    @consume({ context: clientContext })
    public client!: MatterClient;

    @consume({ context: tickContext, subscribe: true })
    protected _tick = 0;

    @property()
    public nodes!: MatterClient["nodes"];

    @property()
    public activeView?: ActiveView;

    @property({ type: Boolean })
    public hasThreadDevices?: boolean;

    @property({ type: Boolean })
    public hasWifiDevices?: boolean;

    private _cachedNodes?: MatterClient["nodes"];
    private _cachedNodeEntries?: [string, MatterNode][];

    private getNodeEntries(nodes: MatterClient["nodes"]): [string, MatterNode][] {
        if (nodes !== this._cachedNodes) {
            this._cachedNodes = nodes;
            this._cachedNodeEntries = Object.entries(nodes);
        }
        return this._cachedNodeEntries!;
    }

    override render() {
        const nodes = this.getNodeEntries(this.nodes);

        return html`
            <dashboard-header
                title="Open Home Foundation Matter Server"
                .activeView=${this.activeView}
                .hasThreadDevices=${this.hasThreadDevices}
                .hasWifiDevices=${this.hasWifiDevices}
            ></dashboard-header>

            <!-- server details section -->
            <div class="container">
                <server-details></server-details>
            </div>

            <!-- Nodes listing -->
            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Nodes</b>
                        </div>
                    </md-list-item>
                    ${nodes.map(([_id, node]) => {
                        const badge = icdBadge(node.attributes, node.available);
                        return html`
                            <md-list-item type="link" href=${`#node/${node.node_id}`}>
                                <ha-svg-icon
                                    slot="start"
                                    class="device-icon"
                                    .path=${getDeviceIcon(node)}
                                ></ha-svg-icon>
                                <div slot="headline">
                                    Node ${node.node_id}
                                    <span class="hex-id"
                                        >(${formatNodeAddress(
                                            isTestNodeId(node.node_id) ||
                                                this.client.serverInfo.fabric_index === undefined
                                                ? undefined
                                                : this.client.serverInfo.fabric_index,
                                            node.node_id,
                                        )})</span
                                    >
                                    ${node.available ? "" : html` <span class="status">OFFLINE</span>`}
                                    ${badge
                                        ? html`<a
                                              class="icd-badge icd-${badge.state}"
                                              href="#node/${node.node_id}/0/${ICD_CLUSTER_ID}"
                                              title=${badge.hint}
                                              @click=${(e: Event) => e.stopPropagation()}
                                              >ICD</a
                                          >`
                                        : ""}
                                </div>
                                <div slot="supporting-text">
                                    ${node.nodeLabel ? `${node.nodeLabel} | ` : nothing} ${node.vendorName} |
                                    ${node.productName}
                                </div>
                                <ha-svg-icon slot="end" .path=${mdiChevronRight}></ha-svg-icon>
                            </md-list-item>
                        `;
                    })}
                </md-list>
            </div>
            <dashboard-footer />
        `;
    }

    static override styles = css`
        :host {
            display: flex;
            background-color: var(--md-sys-color-background);
            box-sizing: border-box;
            flex-direction: column;
        }

        .container {
            padding: 16px;
            max-width: 95%;
            margin: 0 auto;
            flex: 1;
            width: 100%;
        }

        @media (max-width: 600px) {
            .container {
                padding: 16px 0;
            }
        }

        .device-icon {
            --icon-primary-color: var(--md-sys-color-on-surface-variant, #666);
        }

        span[slot="start"] {
            width: 40px;
            text-align: center;
        }

        .status {
            color: var(--danger-color);
            font-weight: bold;
            font-size: 0.8em;
            margin-left: 8px;
        }

        .icd-badge {
            margin-left: 4px;
            padding: 0 4px;
            border: 1px solid;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.8em;
            text-decoration: none;
        }

        .icd-badge.icd-offline {
            color: var(--danger-color);
            border-color: var(--danger-color);
        }

        .icd-badge.icd-lit {
            color: var(--success-color);
            border-color: var(--success-color);
        }

        .icd-badge.icd-sit {
            color: var(--text-color);
            border-color: var(--text-color);
        }

        .hex-id {
            color: var(--text-color, rgba(0, 0, 0, 0.6));
            font-size: 0.85em;
            word-break: break-all;
        }

        @media (max-width: 400px) {
            .hex-id {
                display: block;
                margin-top: 2px;
            }
        }
    `;
}
