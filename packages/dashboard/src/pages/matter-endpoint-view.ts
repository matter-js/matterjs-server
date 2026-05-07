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
import { consume } from "@lit/context";
import { MatterClient, MatterNode, isTestNodeId } from "@matter-server/ws-client";
import { mdiAlertCircleOutline, mdiChevronRight } from "@mdi/js";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { guard } from "lit/directives/guard.js";
import { clientContext } from "../client/client-context.js";
import { DeviceType, clusters, device_types } from "../client/models/descriptions.js";
import "../components/ha-svg-icon";
import { formatHex, formatNodeAddress, getEffectiveFabricIndex } from "../util/format_hex.js";
import { notFoundStyles } from "../util/shared-styles.js";

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

export function getEndpointDeviceTypes(node: MatterNode, endpoint: number): DeviceType[] {
    const rawValues = node.attributes[`${endpoint}/29/0`] as Record<string, number>[] | undefined;
    if (!rawValues) return [];
    return rawValues.map(rawValue => {
        const id = rawValue["0"] ?? rawValue["deviceType"];
        return device_types[id] ?? { id: id ?? -1, label: `Unknown Device Type (${id})`, clusters: [] };
    });
}

@customElement("matter-endpoint-view")
class MatterEndpointView extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @property()
    public node?: MatterNode;

    @property()
    public endpoint?: number;

    override render() {
        if (!this.node || this.endpoint == undefined) {
            return html`
                <dashboard-header title="Not found" .client=${this.client} backButton="#"></dashboard-header>
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
        const nodeHex = formatNodeAddress(fabricIndex, this.node.node_id);

        return html`
            <dashboard-header
                .title=${`Node ${this.node.node_id} ${nodeHex}  |  Endpoint ${this.endpoint}`}
                .backButton=${`#node/${this.node.node_id}`}
            ></dashboard-header>

            <!-- node details section -->
            <div class="container">
                <node-details .node=${this.node}></node-details>
            </div>

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
                    ${guard([this.node?.attributes.length], () =>
                        getUniqueClusters(this.node!, this.endpoint!).map(cluster => {
                            return html`
                                <md-list-item
                                    type="link"
                                    href=${`#node/${this.node!.node_id}/${this.endpoint}/${cluster}`}
                                >
                                    <div slot="headline">${clusters[cluster]?.label ?? "Custom/Unknown Cluster"}</div>
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

    static override styles = [
        notFoundStyles,
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
        `,
    ];
}
