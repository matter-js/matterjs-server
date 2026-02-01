/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { isTestNodeId, MatterClient, MatterNode } from "@matter-server/ws-client";
import { mdiChevronRight, mdiGraphOutline } from "@mdi/js";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { guard } from "lit/directives/guard.js";
import "../components/ha-svg-icon";
import { formatNodeAddress, getEffectiveFabricIndex } from "../util/format_hex.js";
import "./components/header";
import "./components/node-details";
import { getEndpointDeviceTypes } from "./matter-endpoint-view.js";
import { getNetworkType } from "./network/network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-node-view": MatterNodeView;
    }
}

function getUniqueEndpoints(node: MatterNode) {
    // extract unique endpoints from the node attributes, as (sorted) array
    return Array.from(new Set(Object.keys(node.attributes).map(key => Number(key.split("/")[0])))).sort((a, b) => {
        return a - b;
    });
}

@customElement("matter-node-view")
class MatterNodeView extends LitElement {
    public client!: MatterClient;

    @property()
    public node?: MatterNode;

    override render() {
        if (!this.node) {
            return html`
                <p>Node not found!</p>
                <button @click=${this._goBack}>Back</button>
            `;
        }

        const networkType = getNetworkType(this.node);
        // Show graph button for Thread, WiFi, and Ethernet (Ethernet devices are shown in WiFi graph)
        const showGraphButton = networkType === "thread" || networkType === "wifi" || networkType === "ethernet";
        // Ethernet devices go to WiFi graph since they're displayed there
        const graphViewType = networkType === "ethernet" ? "wifi" : networkType;
        const graphUrl = showGraphButton ? `#${graphViewType}/${this.node.node_id}` : null;

        // Format node address for hex display
        const fabricIndex = getEffectiveFabricIndex(
            this.client.serverInfo.fabric_index,
            isTestNodeId(this.node.node_id),
        );
        const nodeHex = formatNodeAddress(fabricIndex, this.node.node_id);

        return html`
            <dashboard-header
                .title=${`Node ${this.node.node_id} ${nodeHex}`}
                .client=${this.client}
                backButton="#"
            ></dashboard-header>

            <!-- node details section -->
            <div class="container">
                <div class="node-title-bar">
                    <h2>Node ${this.node.node_id} <span class="node-id-hex">${nodeHex}</span></h2>
                    ${showGraphButton
                        ? html`
                              <a href=${graphUrl} class="show-in-graph-button" title="Show in ${graphViewType} graph">
                                  <ha-svg-icon .path=${mdiGraphOutline}></ha-svg-icon>
                                  <span class="button-text">Show in graph</span>
                              </a>
                          `
                        : ""}
                </div>
                <node-details .node=${this.node} .client=${this.client}></node-details>
            </div>

            <!-- Node Endpoints listing -->
            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Endpoints</b>
                        </div>
                    </md-list-item>
                    ${guard([this.node?.attributes.length], () =>
                        getUniqueEndpoints(this.node!).map(endPointId => {
                            return html`
                                <md-list-item type="link" href=${`#node/${this.node!.node_id}/${endPointId}`}>
                                    <div slot="headline">Endpoint ${endPointId}</div>
                                    <div slot="supporting-text">
                                        Device Type(s):
                                        ${getEndpointDeviceTypes(this.node!, endPointId)
                                            .map(deviceType => {
                                                return deviceType.label;
                                            })
                                            .join(" / ")}
                                    </div>
                                    <ha-svg-icon slot="end" .path=${mdiChevronRight}></ha-svg-icon>
                                </md-list-item>
                            `;
                        }),
                    )}
                </md-list>
            </div>

            <dashboard-footer />
        `;
    }

    private _goBack() {
        history.back();
    }

    static override styles = css`
        :host {
            display: flex;
            background-color: var(--md-sys-color-background);
            box-sizing: border-box;
            flex-direction: column;
            min-height: 100vh;
        }

        .container {
            padding: 16px;
            max-width: 95%;
            margin: 0 auto;
            width: 100%;
        }

        @media (max-width: 600px) {
            .container {
                padding: 16px 0;
            }
        }

        .status {
            color: var(--danger-color);
            font-weight: bold;
            font-size: 0.8em;
        }

        .node-title-bar {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
        }

        .node-title-bar h2 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 500;
            color: var(--md-sys-color-on-background, #333);
        }

        .node-id-hex {
            font-size: 0.75em;
            font-weight: 400;
            color: var(--md-sys-color-on-surface-variant, #666);
            font-family: monospace;
        }

        .show-in-graph-button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 500;
            transition: opacity 0.2s;
            white-space: nowrap;
        }

        .show-in-graph-button:hover {
            opacity: 0.9;
        }

        .show-in-graph-button ha-svg-icon {
            --icon-primary-color: var(--md-sys-color-on-primary);
            width: 16px;
            height: 16px;
        }

        @media (max-width: 768px) {
            .show-in-graph-button {
                display: none;
            }
        }

        @media (max-width: 480px) {
            .show-in-graph-button .button-text {
                display: none;
            }

            .show-in-graph-button {
                padding: 6px;
            }
        }
    `;
}
