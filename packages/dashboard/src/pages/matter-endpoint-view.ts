/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { provide } from "@lit/context";
import "@material/web/button/outlined-button";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { consume } from "@lit/context";
import { MatterClient, MatterNode, isTestNodeId } from "@matter-server/ws-client";
import { mdiAlertCircleOutline, mdiChevronRight } from "@mdi/js";
import { LitElement, type TemplateResult, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { guard } from "lit/directives/guard.js";
import "./cluster-commands/clusters/binding-commands.js";
import { clientContext, tickContext } from "../client/client-context.js";
import { clusters } from "../client/models/descriptions.js";
import "../components/ha-svg-icon";
import { BINDING_CLUSTER_ID, boundClientClusterIds, sourceClientClusters } from "../util/binding.js";
import { getEndpointDeviceTypes } from "../util/endpoints.js";
import { formatHex, formatNodeAddress, getEffectiveFabricIndex } from "../util/format_hex.js";
import { infoPanelStyles, notFoundStyles } from "../util/shared-styles.js";
import { bindingContext } from "./components/context.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-endpoint-view": MatterEndpointView;
    }
}

function getUniqueClusters(node: MatterNode, endpoint: number) {
    return Array.from(
        new Set(
            Object.keys(node.attributes)
                .filter(key => key.startsWith(`${endpoint.toString()}/`))
                .map(key => Number(key.split("/")[1])),
        ),
    ).sort((a, b) => {
        return a - b;
    });
}

export { getEndpointDeviceTypes };

@customElement("matter-endpoint-view")
class MatterEndpointView extends LitElement {
    @consume({ context: clientContext })
    public client!: MatterClient;

    @consume({ context: tickContext, subscribe: true })
    protected _tick = 0;

    @property()
    public node?: MatterNode;

    @provide({ context: bindingContext })
    @property()
    public endpoint!: number;

    override render() {
        if (!this.node || this.endpoint == undefined) {
            return html`
                <dashboard-header title="Not found" backButton="#"></dashboard-header>
                <div class="not-found">
                    <ha-svg-icon .path=${mdiAlertCircleOutline}></ha-svg-icon>
                    <p>Node or endpoint not found</p>
                    <md-outlined-button @click=${this._goBack}>Back</md-outlined-button>
                </div>
            `;
        }

        // Format node address for hex display
        const fabricIndex = getEffectiveFabricIndex(
            this.client.serverInfo.fabric_index,
            isTestNodeId(this.node.node_id),
        );
        const nodeId = this.node.node_id;
        const nodeHex = formatNodeAddress(fabricIndex, nodeId);
        const endpointClusters = getUniqueClusters(this.node, this.endpoint);
        const hasBindingCluster = endpointClusters.includes(BINDING_CLUSTER_ID);

        return html`
            <dashboard-header
                .title=${`Node ${this.node.node_id} ${nodeHex}  |  Endpoint ${this.endpoint}`}
                .backButton=${`#node/${this.node.node_id}`}
            ></dashboard-header>

            <!-- node details section -->
            <div class="container">
                <node-details .node=${this.node}></node-details>
            </div>

            ${hasBindingCluster ? this._renderClientClustersSection(this.node) : nothing}

            <!-- Binding editor (when this endpoint has a Binding cluster) -->
            ${
                hasBindingCluster
                    ? html`<div class="container">
                          <binding-cluster-commands
                              .node=${this.node}
                              .endpoint=${this.endpoint}
                              .cluster=${BINDING_CLUSTER_ID}
                          ></binding-cluster-commands>
                      </div>`
                    : nothing
            }

            <!-- Endpoint clusters listing -->
            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Clusters on Endpoint ${this.endpoint}</b>
                        </div>
                        <div slot="supporting-text">
                            Device Type(s):
                            ${getEndpointDeviceTypes(this.node, this.endpoint)
                                .map(deviceType => {
                                    return deviceType.label;
                                })
                                .join(" / ")}
                        </div>
                    </md-list-item>
                    ${guard(
                        // Must name the rendered set itself; anything derived from the attribute
                        // cache depends on how that cache mutates and can go stale.
                        [nodeId, this.endpoint, endpointClusters.join(",")],
                        () =>
                            endpointClusters.map(cluster => {
                                return html`
                                    <md-list-item type="link" href=${`#node/${nodeId}/${this.endpoint}/${cluster}`}>
                                        <div slot="headline">
                                            ${clusters[cluster]?.label ?? "Custom/Unknown Cluster"}
                                        </div>
                                        <div slot="supporting-text">ClusterId ${cluster} (${formatHex(cluster)})</div>
                                        <ha-svg-icon slot="end" .path=${mdiChevronRight}></ha-svg-icon>
                                    </md-list-item>
                                `;
                            }),
                    )}
                </md-list>
            </div>
        `;
    }

    private _goBack() {
        history.back();
    }

    private _renderClientClustersSection(node: MatterNode): TemplateResult | typeof nothing {
        const clientClusters = sourceClientClusters(node, this.endpoint);
        if (clientClusters.length === 0) return nothing;
        const boundClusterIds = boundClientClusterIds(node, this.endpoint);

        return html`
            <div class="container">
                <div class="info-panel">
                    <div class="info-section">
                        <div class="info-section-header">Client Clusters</div>
                        <ul class="chip-list" role="list">
                            ${clientClusters.map(id => {
                                const bound = boundClusterIds.has(id);
                                return html`
                                    <li class=${bound ? "chip chip-bound" : "chip"}>
                                        ${clusters[id]?.label ?? "Custom/Unknown Cluster"} ${formatHex(id)}
                                        ${bound ? html`<span class="chip-state">Bound</span>` : nothing}
                                    </li>
                                `;
                            })}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    static override styles = [
        notFoundStyles,
        infoPanelStyles,
        css`
            :host {
                display: block;
                background-color: var(--md-sys-color-background);
            }

            .header {
                background-color: var(--md-sys-color-primary);
                color: var(--md-sys-color-on-primary);
                --icon-primary-color: var(--md-sys-color-on-primary);
                font-weight: 400;
                display: flex;
                align-items: center;
                padding-right: 8px;
                height: 48px;
            }

            md-icon-button {
                margin-right: 8px;
            }

            .flex {
                flex: 1;
            }

            .container {
                padding: 16px;
                max-width: 95%;
                margin: 0 auto;
            }

            .status {
                color: var(--danger-color);
                font-weight: bold;
                font-size: 0.8em;
            }

            .chip.chip-bound {
                color: var(--md-sys-color-on-primary-container);
                background: var(--md-sys-color-primary-container);
            }

            .chip-state {
                font-weight: 500;
                margin-left: 8px;
                padding-left: 8px;
                border-left: 1px solid currentcolor;
            }
        `,
    ];
}
