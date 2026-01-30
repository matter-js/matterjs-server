/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextProvider } from "@lit/context";
import { MatterClient, MatterError } from "@matter-server/ws-client";
import { mdiRefresh } from "@mdi/js";
import { LitElement, PropertyValueMap, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";
import "../components/ha-svg-icon";
import { clone } from "../util/clone_class.js";
import type { Route } from "../util/routing.js";
import "./components/header";
import type { ActiveView } from "./components/header.js";
import "./matter-cluster-view";
import "./matter-endpoint-view";
import "./matter-network-view";
import "./matter-node-view";
import "./matter-server-view";
import { categorizeDevices } from "./network/network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-dashboard-app": MatterDashboardApp;
    }
}

@customElement("matter-dashboard-app")
class MatterDashboardApp extends LitElement {
    @state() private _route: Route = {
        prefix: "",
        path: [],
    };

    @state() private _activeView: ActiveView = "nodes";

    @state() private _initialSelectedNodeId: number | null = null;

    public client!: MatterClient;

    @state()
    private _state: "connecting" | "connected" | "error" | "disconnected" = "connecting";

    /** Track whether nodes have been loaded at least once (to avoid redirecting before data arrives) */
    private _nodesLoaded = false;

    private provider = new ContextProvider(this, { context: clientContext, initialValue: this.client });

    /** Reference to updateRoute function so it can be called from event listeners */
    private _updateRoute?: () => void;

    protected override firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this._connect();

        // Handle history changes
        this._updateRoute = () => {
            const hash = location.hash.substring(1);
            const pathParts = hash.split("/");

            // Reset initial selected node
            this._initialSelectedNodeId = null;

            // Get device counts for conditional navigation
            const { hasThreadDevices, hasWifiDevices } = this._getDeviceCounts();

            // Determine active view from hash
            if (pathParts[0] === "thread") {
                // Only redirect if nodes have been loaded (avoid redirecting on initial load before data arrives)
                if (this._nodesLoaded && !hasThreadDevices) {
                    location.hash = "#nodes";
                    return;
                }
                this._activeView = "thread";
                // Check for node ID: #thread/123
                if (pathParts.length > 1 && pathParts[1]) {
                    const nodeId = parseInt(pathParts[1], 10);
                    if (!isNaN(nodeId)) {
                        this._initialSelectedNodeId = nodeId;
                    }
                }
            } else if (pathParts[0] === "wifi") {
                // Only redirect if nodes have been loaded (avoid redirecting on initial load before data arrives)
                if (this._nodesLoaded && !hasWifiDevices) {
                    location.hash = "#nodes";
                    return;
                }
                this._activeView = "wifi";
                // Check for node ID: #wifi/123
                if (pathParts.length > 1 && pathParts[1]) {
                    const nodeId = parseInt(pathParts[1], 10);
                    if (!isNaN(nodeId)) {
                        this._initialSelectedNodeId = nodeId;
                    }
                }
            } else if (hash === "nodes" || hash === "" || pathParts[0] === "node") {
                this._activeView = "nodes";
            }

            this._route = {
                prefix: pathParts.length == 1 ? "" : pathParts[0],
                path: pathParts.length == 1 ? pathParts : pathParts.slice(1),
            };
        };
        window.addEventListener("hashchange", this._updateRoute);
        this._updateRoute();
    }

    private _connect() {
        this.client.startListening().then(
            () => {
                this._state = "connected";
                this._setupEventListeners();
            },
            (_err: MatterError) => {
                this._state = "error";
            },
        );
    }

    private _setupEventListeners() {
        this.client.addEventListener("nodes_changed", () => {
            // Mark nodes as loaded and re-evaluate route (for redirect logic)
            const wasFirstLoad = !this._nodesLoaded;
            this._nodesLoaded = true;
            if (wasFirstLoad && this._updateRoute) {
                // Re-run route check now that nodes are available
                this._updateRoute();
            }
            this.requestUpdate();
            this.provider.setValue(clone(this.client));
        });
        this.client.addEventListener("server_info_updated", () => {
            this.provider.setValue(clone(this.client));
        });
        this.client.addEventListener("connection_lost", () => {
            this._state = "disconnected";
        });
    }

    private _reconnect = () => {
        this._state = "connecting";
        this._connect();
    };

    /**
     * Get device counts for Thread and WiFi networks.
     */
    private _getDeviceCounts(): { hasThreadDevices: boolean; hasWifiDevices: boolean } {
        if (!this.client?.nodes) {
            return { hasThreadDevices: false, hasWifiDevices: false };
        }
        const categorized = categorizeDevices(this.client.nodes);
        return {
            hasThreadDevices: categorized.thread.length > 0,
            hasWifiDevices: categorized.wifi.length > 0 || categorized.ethernet.length > 0,
        };
    }

    override render() {
        if (this._state === "connecting") {
            return html`
                <dashboard-header title="Matter Server"></dashboard-header>
                <div class="status-page">
                    <p class="status-message">Connecting...</p>
                </div>
            `;
        }
        if (this._state === "disconnected") {
            return html`
                <dashboard-header title="Matter Server"></dashboard-header>
                <div class="status-page">
                    <p class="status-message error">Connection lost</p>
                    <p class="status-hint">
                        The connection to the Matter Server was lost. Please check if the server is running.
                    </p>
                    <button class="retry-button" @click=${this._reconnect}>
                        <ha-svg-icon .path=${mdiRefresh}></ha-svg-icon>
                        Reconnect
                    </button>
                </div>
            `;
        }
        if (this._state === "error") {
            return html`
                <dashboard-header title="Matter Server"></dashboard-header>
                <div class="status-page">
                    <p class="status-message error">No connection</p>
                    <p class="status-hint">
                        Unable to connect to the Matter Server. Please check if the server is running.
                    </p>
                    <button class="retry-button" @click=${this._reconnect}>
                        <ha-svg-icon .path=${mdiRefresh}></ha-svg-icon>
                        Reconnect
                    </button>
                </div>
            `;
        }
        if (this._route.prefix === "node" && this._route.path.length == 3) {
            // cluster level
            return html`
                <matter-cluster-view
                    .client=${this.client}
                    .node=${this.client.nodes[this._route.path[0]]}
                    .endpoint=${parseInt(this._route.path[1], 10)}
                    .cluster=${parseInt(this._route.path[2], 10)}
                ></matter-cluster-view>
            `;
        }
        if (this._route.prefix === "node" && this._route.path.length == 2) {
            // endpoint level
            return html`
                <matter-endpoint-view
                    .client=${this.client}
                    .node=${this.client.nodes[this._route.path[0]]}
                    .endpoint=${parseInt(this._route.path[1], 10)}
                ></matter-endpoint-view>
            `;
        }
        if (this._route.prefix === "node") {
            // node level
            return html`
                <matter-node-view
                    .client=${this.client}
                    .node=${this.client.nodes[this._route.path[0]]}
                ></matter-node-view>
            `;
        }
        // Get device counts for conditional navigation
        const { hasThreadDevices, hasWifiDevices } = this._getDeviceCounts();

        // Check for Thread view (#thread or #thread/123)
        if (this._route.prefix === "thread" || this._route.path[0] === "thread") {
            return html`<matter-network-view
                .client=${this.client}
                .nodes=${this.client.nodes}
                .activeView=${this._activeView}
                .initialSelectedNodeId=${this._initialSelectedNodeId}
                .hasThreadDevices=${hasThreadDevices}
                .hasWifiDevices=${hasWifiDevices}
                networkType="thread"
            ></matter-network-view>`;
        }
        // Check for WiFi view (#wifi or #wifi/123)
        if (this._route.prefix === "wifi" || this._route.path[0] === "wifi") {
            return html`<matter-network-view
                .client=${this.client}
                .nodes=${this.client.nodes}
                .activeView=${this._activeView}
                .initialSelectedNodeId=${this._initialSelectedNodeId}
                .hasThreadDevices=${hasThreadDevices}
                .hasWifiDevices=${hasWifiDevices}
                networkType="wifi"
            ></matter-network-view>`;
        }
        // root level: server overview (nodes view)
        return html`<matter-server-view
            .client=${this.client}
            .nodes=${this.client.nodes}
            .route=${this._route}
            .activeView=${this._activeView}
            .hasThreadDevices=${hasThreadDevices}
            .hasWifiDevices=${hasWifiDevices}
        ></matter-server-view>`;
    }

    static override styles = css`
        :host {
            display: block;
            min-height: 100vh;
            background-color: var(--md-sys-color-background);
        }

        .status-page {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px 24px;
            text-align: center;
        }

        .status-message {
            font-size: 1.5rem;
            color: var(--md-sys-color-on-background);
            margin: 0 0 16px 0;
        }

        .status-message.error {
            color: var(--danger-color);
        }

        .status-hint {
            font-size: 1rem;
            color: var(--md-sys-color-on-surface-variant);
            margin: 0;
            max-width: 400px;
        }

        .retry-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 24px;
            padding: 12px 24px;
            font-size: 1rem;
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            --icon-primary-color: var(--md-sys-color-on-primary);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .retry-button:hover {
            opacity: 0.9;
        }

        .retry-button ha-svg-icon {
            width: 20px;
            height: 20px;
        }
    `;
}
