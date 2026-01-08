/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextProvider } from "@lit/context";
import { MatterClient, MatterError } from "@matter-server/ws-client";
import { LitElement, PropertyValueMap, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";
import { clone } from "../util/clone_class.js";
import type { Route } from "../util/routing.js";
import "./matter-cluster-view";
import "./matter-endpoint-view";
import "./matter-node-view";
import "./matter-server-view";

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

    public client!: MatterClient;

    @state()
    private _state: "connecting" | "connected" | "error" | "disconnected" = "connecting";

    private _error: string | undefined;

    private provider = new ContextProvider(this, { context: clientContext, initialValue: this.client });

    protected override firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.client.startListening().then(
            () => {
                this._state = "connected";
                this.client.addEventListener("nodes_changed", () => {
                    this.requestUpdate();
                    this.provider.setValue(clone(this.client));
                });
                this.client.addEventListener("server_info_updated", () => {
                    this.provider.setValue(clone(this.client));
                });
                this.client.addEventListener("connection_lost", () => {
                    this._state = "disconnected";
                });
            },
            (err: MatterError) => {
                this._state = "error";
                this._error = err.message;
            },
        );

        // Handle history changes
        const updateRoute = () => {
            const pathParts = location.hash.substring(1).split("/");
            this._route = {
                prefix: pathParts.length == 1 ? "" : pathParts[0],
                path: pathParts.length == 1 ? pathParts : pathParts.slice(1),
            };
        };
        window.addEventListener("hashchange", updateRoute);
        updateRoute();
    }

    override render() {
        if (this._state === "connecting") {
            return html`<p>Connecting...</p>`;
        }
        if (this._state === "disconnected") {
            return html`<p>Connection lost</p>`;
        }
        if (this._state === "error") {
            return html`
                <p>Error: ${this._error}</p>
                <button @click=${this.client.disconnect}>Clear stored URL</button>
            `;
        }
        if (this._route.prefix === "node" && this._route.path.length == 3) {
            // cluster level
            return html`
                <matter-cluster-view
                    .client=${this.client}
                    .node=${this.client.nodes[parseInt(this._route.path[0], 10)]}
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
                    .node=${this.client.nodes[parseInt(this._route.path[0], 10)]}
                    .endpoint=${parseInt(this._route.path[1], 10)}
                ></matter-endpoint-view>
            `;
        }
        if (this._route.prefix === "node") {
            // node level
            return html`
                <matter-node-view
                    .client=${this.client}
                    .node=${this.client.nodes[parseInt(this._route.path[0], 10)]}
                ></matter-node-view>
            `;
        }
        // root level: server overview
        return html`<matter-server-view
            .client=${this.client}
            .nodes=${this.client.nodes}
            .route=${this._route}
        ></matter-server-view>`;
    }
}
