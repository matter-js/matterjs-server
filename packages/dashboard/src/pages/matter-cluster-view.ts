/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { provide } from "@lit/context";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { MatterClient, MatterNode, toBigIntAwareJson } from "@matter-server/ws-client";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { clusters } from "../client/models/descriptions.js";
import { showAlertDialog } from "../components/dialog-box/show-dialog-box.js";
import "../components/ha-svg-icon";
import "../pages/components/node-details";
import { bindingContext } from "./components/context.js";
// Cluster command components (auto-register on import)
import { formatHex } from "../util/format_hex.js";
import { getClusterCommandsTag } from "./cluster-commands/index.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-cluster-view": MatterClusterView;
    }
}

// Global attribute IDs range (0xFFF0-0xFFFF)
const GLOBAL_ATTRIBUTE_MIN = 0xfff0;
const GLOBAL_ATTRIBUTE_MAX = 0xffff;

function isGlobalAttribute(id: number): boolean {
    return id >= GLOBAL_ATTRIBUTE_MIN && id <= GLOBAL_ATTRIBUTE_MAX;
}

function clusterAttributes(attributes: { [key: string]: any }, endpoint: number, cluster: number) {
    // Extract attributes and sort by ID, with global attributes (0xFFF0-0xFFFF) always last
    return Object.keys(attributes)
        .filter(key => key.startsWith(`${endpoint}/${cluster}/`))
        .map(key => {
            const attributeKey = Number(key.split("/")[2]);
            return { key: attributeKey, value: attributes[key] };
        })
        .sort((a, b) => {
            const aIsGlobal = isGlobalAttribute(a.key);
            const bIsGlobal = isGlobalAttribute(b.key);

            // If one is global and the other isn't, non-global comes first
            if (aIsGlobal !== bIsGlobal) {
                return aIsGlobal ? 1 : -1;
            }
            // Otherwise sort by ID
            return a.key - b.key;
        });
}

@customElement("matter-cluster-view")
class MatterClusterView extends LitElement {
    public client!: MatterClient;

    @property()
    public node?: MatterNode;

    @provide({ context: bindingContext })
    @property()
    public endpoint!: number;

    @property()
    public cluster?: number;

    override render() {
        if (!this.node || this.endpoint == undefined || this.cluster == undefined) {
            return html`
                <p>Node, endpoint or cluster not found!</p>
                <button @click=${this._goBack}>Back</button>
            `;
        }

        return html`
            <dashboard-header
                .title=${`Node ${this.node.node_id}  |  Endpoint ${this.endpoint}  |  Cluster ${this.cluster}`}
                .backButton=${`#node/${this.node.node_id}/${this.endpoint}`}
                .client=${this.client}
            ></dashboard-header>

            <!-- node details section -->
            <div class="container">
                <node-details .node=${this.node} .client=${this.client}></node-details>
            </div>

            <!-- Cluster commands section (if available for this cluster) -->
            ${this._renderClusterCommands()}

            <!-- Cluster attributes listing -->
            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b
                                >Attributes of ${clusters[this.cluster]?.label ?? "Custom/Unknown Cluster"} Cluster on
                                Endpoint ${this.endpoint}</b
                            >
                        </div>
                        <div slot="supporting-text">ClusterId ${this.cluster} (${formatHex(this.cluster)})</div>
                    </md-list-item>
                    <md-divider></md-divider>
                    ${clusterAttributes(this.node.attributes, this.endpoint, this.cluster).map(
                        (attribute, index) => html`
                            <md-list-item class=${index % 2 === 1 ? "alternate-row" : ""}>
                                <div slot="headline">
                                    ${clusters[this.cluster!]?.attributes[attribute.key]?.label ??
                                    "Custom/Unknown Attribute"}
                                </div>
                                <div slot="supporting-text">
                                    AttributeId: ${attribute.key} (${formatHex(attribute.key)}) - Value type:
                                    ${clusters[this.cluster!]?.attributes[attribute.key]?.type ?? "unknown"}
                                </div>
                                <div slot="end">
                                    ${toBigIntAwareJson(attribute.value).length > 20
                                        ? html`<button
                                              @click=${() => {
                                                  this._showAttributeValue(attribute.value);
                                              }}
                                          >
                                              Show value
                                          </button>`
                                        : toBigIntAwareJson(attribute.value)}
                                </div>
                            </md-list-item>
                        `,
                    )}
                </md-list>
            </div>
        `;
    }

    private async _showAttributeValue(value: any) {
        showAlertDialog({
            title: "Attribute value",
            text: toBigIntAwareJson(value),
        });
    }

    private _renderClusterCommands() {
        if (this.cluster === undefined) return html``;
        if (!this.node?.available) return html``; // Don't show commands when device is offline

        const tagName = getClusterCommandsTag(this.cluster);
        if (!tagName) return html``;

        // Dynamically render the registered cluster command component
        const componentHtml = `<${tagName}></${tagName}>`;
        const element = unsafeHTML(componentHtml);

        return html`
            <div class="container">
                <div id="cluster-commands-container">${element}</div>
            </div>
        `;
    }

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);

        // After render, find and configure the cluster commands component
        const container = this.shadowRoot?.getElementById("cluster-commands-container");
        if (container) {
            const commandsElement = container.firstElementChild as any;
            if (commandsElement && this.node && this.client) {
                commandsElement.client = this.client;
                commandsElement.node = this.node;
                commandsElement.endpoint = this.endpoint;
                commandsElement.cluster = this.cluster;
            }
        }
    }

    private _goBack() {
        history.back();
    }

    static override styles = css`
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

        md-list-item.alternate-row {
            background-color: rgba(128, 128, 128, 0.1);
        }
    `;
}
