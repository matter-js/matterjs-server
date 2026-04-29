/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { mdiEyeOff, mdiFitToScreen, mdiMagnifyMinus, mdiMagnifyPlus, mdiPause, mdiPlay } from "@mdi/js";
import { css, html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import "../components/ha-svg-icon";
import { reducedMotionStyles } from "../util/shared-styles.js";
import "./components/footer";
import "./components/header";
import type { ActiveView } from "./components/header.js";
import { BorderRouterStore } from "./network/border-router-store.js";
import "./network/device-panel";
import "./network/network-details";
import "./network/thread-graph";
import type { ThreadGraph } from "./network/thread-graph.js";
import "./network/wifi-graph";
import type { WiFiGraph } from "./network/wifi-graph.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-network-view": MatterNetworkView;
    }
}

type HideOptionKey = "_hideOfflineNodes" | "_hideWeakSignalEdges" | "_hideMediumSignalEdges" | "_hideStrongSignalEdges";

const HIDE_OPTIONS: readonly { key: HideOptionKey; label: string }[] = [
    { key: "_hideOfflineNodes", label: "Offline nodes" },
    { key: "_hideWeakSignalEdges", label: "Weak signal edges" },
    { key: "_hideMediumSignalEdges", label: "Medium signal edges" },
    { key: "_hideStrongSignalEdges", label: "Strong signal edges" },
];

@customElement("matter-network-view")
class MatterNetworkView extends LitElement {
    public client!: MatterClient;

    @property({ type: Object })
    public nodes: Record<string, MatterNode> = {};

    @property()
    public activeView?: ActiveView;

    @property()
    public networkType: "thread" | "wifi" = "thread";

    /** Initial selected node ID from URL (string to avoid BigInt precision loss) */
    @property()
    public initialSelectedNodeId: string | null = null;

    @property({ type: Boolean })
    public hasThreadDevices?: boolean;

    @property({ type: Boolean })
    public hasWifiDevices?: boolean;

    @state()
    private _selectedNodeId: number | string | null = null;

    @state()
    private _physicsEnabled = true;

    @state()
    private _threadAddressSearch = "";

    @state()
    private _threadAddressSearchStatus: "idle" | "found" | "not-found" = "idle";

    @state()
    private _borderRouterStore = new BorderRouterStore();

    @state()
    private _showHideMenu = false;

    @state()
    private _hideOfflineNodes = false;

    @state()
    private _hideWeakSignalEdges = false;

    @state()
    private _hideMediumSignalEdges = false;

    @state()
    private _hideStrongSignalEdges = false;

    private _initialSelectionApplied = false;
    private _selectRetryTimer?: ReturnType<typeof setTimeout>;

    @query("thread-graph")
    private _threadGraph?: ThreadGraph;

    @query("wifi-graph")
    private _wifiGraph?: WiFiGraph;

    override willUpdate(changedProperties: Map<string, unknown>): void {
        // Apply initial selection when the property changes
        if (changedProperties.has("initialSelectedNodeId") && this.initialSelectedNodeId !== null) {
            this._selectedNodeId = this.initialSelectedNodeId;
            this._initialSelectionApplied = false;
        }
    }

    override firstUpdated(): void {
        if (this.networkType === "thread") {
            void this._refreshBorderRouters();
        }
    }

    private async _refreshBorderRouters(): Promise<void> {
        try {
            await this._borderRouterStore.refresh(this.client);
            this.requestUpdate();
        } catch (err) {
            console.warn("Failed to refresh border router store:", err);
        }
    }

    private _handleConnectionsUpdated(): void {
        // Skip the BR snapshot refresh when the user updated a WiFi node — the dialog fires
        // the same event for both network types but BR data is Thread-only.
        if (this.networkType !== "thread") return;
        void this._refreshBorderRouters();
    }

    override updated(changedProperties: Map<string, unknown>): void {
        super.updated(changedProperties);

        // Lazily refresh the BR snapshot the first time the user switches into the Thread
        // view, in case firstUpdated() fired while the WiFi view was active.
        if (changedProperties.has("networkType") && this.networkType === "thread") {
            void this._refreshBorderRouters();
        }

        // After render, select the node in the graph
        if (!this._initialSelectionApplied && this.initialSelectedNodeId !== null) {
            this._initialSelectionApplied = true;
            // Wait for the graph to be ready, then select and focus
            this._selectNodeWhenReady(this.initialSelectedNodeId);
        }
    }

    override connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener("click", this._documentClickHandler);
        document.addEventListener("keydown", this._documentKeyHandler);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener("click", this._documentClickHandler);
        document.removeEventListener("keydown", this._documentKeyHandler);
        if (this._selectRetryTimer) {
            clearTimeout(this._selectRetryTimer);
        }
    }

    /**
     * Tries to select a node in the graph, retrying until the graph is ready.
     */
    private _selectNodeWhenReady(nodeId: string | number, retries: number = 10): void {
        const graph = this.networkType === "thread" ? this._threadGraph : this._wifiGraph;

        if (graph?.isReady()) {
            graph.selectNode(nodeId);
        } else if (retries > 0) {
            // Graph not ready yet, retry after a short delay
            this._selectRetryTimer = setTimeout(() => this._selectNodeWhenReady(nodeId, retries - 1), 100);
        }
    }

    private _handleNodeSelected(event: CustomEvent<{ nodeId: number | string | null }>): void {
        this._selectedNodeId = event.detail.nodeId;
    }

    private _handleDetailsClose(): void {
        this._selectedNodeId = null;
        // Tell the graph to deselect and clear highlights
        if (this.networkType === "thread") {
            this._threadGraph?.deselectAll();
        } else {
            this._wifiGraph?.deselectAll();
        }
    }

    private _handleSelectNode(event: CustomEvent<{ nodeId: number | string }>): void {
        const nodeId = event.detail.nodeId;
        this._selectedNodeId = nodeId;
        // Select the node in the graph
        if (this.networkType === "thread") {
            this._threadGraph?.selectNode(nodeId);
        } else {
            this._wifiGraph?.selectNode(nodeId);
        }
    }

    private _handleFitToScreen(): void {
        if (this.networkType === "thread") {
            this._threadGraph?.fit();
        } else {
            this._wifiGraph?.fit();
        }
    }

    private _handleZoomIn(): void {
        if (this.networkType === "thread") {
            this._threadGraph?.zoomIn();
        } else {
            this._wifiGraph?.zoomIn();
        }
    }

    private _handleZoomOut(): void {
        if (this.networkType === "thread") {
            this._threadGraph?.zoomOut();
        } else {
            this._wifiGraph?.zoomOut();
        }
    }

    private _handleToggleHideMenu(): void {
        this._showHideMenu = !this._showHideMenu;
    }

    private readonly _documentClickHandler = (event: MouseEvent): void => {
        const path = event.composedPath();
        if (!path.some(el => el instanceof HTMLElement && el.classList.contains("hide-menu-container"))) {
            this._showHideMenu = false;
        }
    };

    private readonly _documentKeyHandler = (event: KeyboardEvent): void => {
        if (event.key === "Escape" && this._showHideMenu) {
            this._showHideMenu = false;
        }
    };

    private _handleToggleHideOption(option: HideOptionKey): void {
        this[option] = !this[option];
    }

    private _isAnyHideOptionActive(): boolean {
        return HIDE_OPTIONS.some(option => this[option.key]);
    }

    private _handleTogglePhysics(): void {
        const newState = !this._physicsEnabled;
        this._physicsEnabled = newState;
        // Keep both graphs in sync so switching between Thread and WiFi
        // does not cause a mismatch between the UI button and graph state
        this._threadGraph?.setPhysicsEnabled(newState);
        this._wifiGraph?.setPhysicsEnabled(newState);
    }

    private _handlePhysicsChanged(event: CustomEvent<{ enabled: boolean }>): void {
        // Update UI state when graph auto-freezes and keep both graphs in sync
        this._physicsEnabled = event.detail.enabled;
        this._threadGraph?.setPhysicsEnabled(event.detail.enabled);
        this._wifiGraph?.setPhysicsEnabled(event.detail.enabled);
    }

    private _handleThreadAddressSearchInput(event: Event): void {
        this._threadAddressSearch = (event.target as HTMLInputElement).value;
        this._threadAddressSearchStatus = "idle";
    }

    private _handleThreadAddressSearchSubmit(event: Event): void {
        event.preventDefault();

        const searchValue = this._threadAddressSearch.trim();
        if (!searchValue) {
            this._threadAddressSearchStatus = "idle";
            return;
        }

        this._searchThreadAddressWhenReady(searchValue);
    }

    private _searchThreadAddressWhenReady(searchValue: string, retries: number = 10): void {
        const graph = this._threadGraph;

        if (!graph?.isReady()) {
            if (retries > 0) {
                this._selectRetryTimer = setTimeout(
                    () => this._searchThreadAddressWhenReady(searchValue, retries - 1),
                    100,
                );
            } else {
                this._threadAddressSearchStatus = "not-found";
            }
            return;
        }

        const found = graph.selectByExtendedAddress(searchValue);
        this._threadAddressSearchStatus = found ? "found" : "not-found";
    }

    private _renderThreadView() {
        return html`
            <div class="graph-section">
                <div class="graph-header">
                    <h2>Thread Network Mesh</h2>
                    <div class="graph-actions">
                        <form class="thread-search" @submit=${this._handleThreadAddressSearchSubmit}>
                            <input
                                type="text"
                                .value=${this._threadAddressSearch}
                                @input=${this._handleThreadAddressSearchInput}
                                placeholder="Search extended address"
                                title="Find device by Thread extended address (EUI-64)"
                            />
                            <button type="submit" class="search-button">Find</button>
                        </form>
                        <div class="graph-controls">
                            <button class="control-button" @click=${this._handleZoomIn} title="Zoom in">
                                <ha-svg-icon .path=${mdiMagnifyPlus}></ha-svg-icon>
                            </button>
                            <button class="control-button" @click=${this._handleZoomOut} title="Zoom out">
                                <ha-svg-icon .path=${mdiMagnifyMinus}></ha-svg-icon>
                            </button>
                            <button class="control-button" @click=${this._handleFitToScreen} title="Fit to screen">
                                <ha-svg-icon .path=${mdiFitToScreen}></ha-svg-icon>
                            </button>
                            <div class="hide-menu-container">
                                <button
                                    class="control-button ${this._isAnyHideOptionActive() ? "active" : ""}"
                                    @click=${this._handleToggleHideMenu}
                                    title="Hide options"
                                    aria-haspopup="true"
                                    aria-expanded=${this._showHideMenu}
                                    aria-controls="hide-options-menu"
                                >
                                    <ha-svg-icon .path=${mdiEyeOff}></ha-svg-icon>
                                </button>
                                ${this._showHideMenu
                                    ? html`
                                          <div
                                              id="hide-options-menu"
                                              class="hide-dropdown"
                                              role="group"
                                              aria-label="Hide options"
                                          >
                                              ${HIDE_OPTIONS.map(
                                                  option => html`
                                                      <label class="hide-option">
                                                          <input
                                                              type="checkbox"
                                                              .checked=${this[option.key]}
                                                              @change=${() => this._handleToggleHideOption(option.key)}
                                                          />
                                                          <span>${option.label}</span>
                                                      </label>
                                                  `,
                                              )}
                                          </div>
                                      `
                                    : ""}
                            </div>
                            <button
                                class="control-button ${this._physicsEnabled ? "" : "active"}"
                                @click=${this._handleTogglePhysics}
                                title="${this._physicsEnabled ? "Freeze layout" : "Unfreeze layout"}"
                            >
                                <ha-svg-icon .path=${this._physicsEnabled ? mdiPause : mdiPlay}></ha-svg-icon>
                            </button>
                        </div>
                    </div>
                </div>
                ${this._threadAddressSearchStatus === "idle"
                    ? ""
                    : html`<div class="thread-search-status ${this._threadAddressSearchStatus}">
                          ${this._threadAddressSearchStatus === "found"
                              ? "Node highlighted."
                              : "No matching extended address found."}
                      </div>`}
                <thread-graph
                    .nodes=${this.nodes}
                    .borderRouters=${this._borderRouterStore.entries}
                    .hideOfflineNodes=${this._hideOfflineNodes}
                    .hideWeakSignalEdges=${this._hideWeakSignalEdges}
                    .hideMediumSignalEdges=${this._hideMediumSignalEdges}
                    .hideStrongSignalEdges=${this._hideStrongSignalEdges}
                    @node-selected=${this._handleNodeSelected}
                    @physics-changed=${this._handlePhysicsChanged}
                ></thread-graph>
            </div>
        `;
    }

    private _renderWifiView() {
        return html`
            <div class="graph-section">
                <div class="graph-header">
                    <h2>WiFi Network</h2>
                    <div class="graph-controls">
                        <button class="control-button" @click=${this._handleZoomIn} title="Zoom in">
                            <ha-svg-icon .path=${mdiMagnifyPlus}></ha-svg-icon>
                        </button>
                        <button class="control-button" @click=${this._handleZoomOut} title="Zoom out">
                            <ha-svg-icon .path=${mdiMagnifyMinus}></ha-svg-icon>
                        </button>
                        <button class="control-button" @click=${this._handleFitToScreen} title="Fit to screen">
                            <ha-svg-icon .path=${mdiFitToScreen}></ha-svg-icon>
                        </button>
                        <button
                            class="control-button ${this._physicsEnabled ? "" : "active"}"
                            @click=${this._handleTogglePhysics}
                            title="${this._physicsEnabled ? "Freeze layout" : "Unfreeze layout"}"
                        >
                            <ha-svg-icon .path=${this._physicsEnabled ? mdiPause : mdiPlay}></ha-svg-icon>
                        </button>
                    </div>
                </div>
                <wifi-graph
                    .nodes=${this.nodes}
                    @node-selected=${this._handleNodeSelected}
                    @physics-changed=${this._handlePhysicsChanged}
                ></wifi-graph>
            </div>
        `;
    }

    override render() {
        const showSidebar = this._selectedNodeId !== null;
        const unknownDevices = this._threadGraph?.unknownDevicesMap ?? new Map();
        const wifiAccessPoints = this._wifiGraph?.wifiAccessPointsMap ?? new Map();
        const threadEdgePairs = this._threadGraph?.edgePairs ?? new Map();

        return html`
            <dashboard-header
                title="Open Home Foundation Matter Server"
                .client=${this.client}
                .activeView=${this.activeView}
                .hasThreadDevices=${this.hasThreadDevices}
                .hasWifiDevices=${this.hasWifiDevices}
            ></dashboard-header>

            <div class="content">
                <div class="main-area">
                    ${this.networkType === "thread" ? this._renderThreadView() : this._renderWifiView()}
                </div>

                <aside class="details-sidebar ${showSidebar ? "visible" : ""}">
                    <network-details
                        .selectedNodeId=${this._selectedNodeId}
                        .nodes=${this.nodes}
                        .unknownDevices=${unknownDevices}
                        .borderRouters=${this._borderRouterStore.entries}
                        .wifiAccessPoints=${wifiAccessPoints}
                        .threadEdgePairs=${threadEdgePairs}
                        .hideOfflineNodes=${this._hideOfflineNodes}
                        .hideWeakSignalEdges=${this._hideWeakSignalEdges}
                        .hideMediumSignalEdges=${this._hideMediumSignalEdges}
                        .hideStrongSignalEdges=${this._hideStrongSignalEdges}
                        @close=${this._handleDetailsClose}
                        @select-node=${this._handleSelectNode}
                        @connections-updated=${this._handleConnectionsUpdated}
                    ></network-details>
                </aside>
            </div>

            <dashboard-footer></dashboard-footer>
        `;
    }

    static override styles = [
        reducedMotionStyles,
        css`
            :host {
                display: flex;
                flex-direction: column;
                height: 100vh;
                height: 100dvh; /* dynamic viewport height - fallback above for older browsers */
                overflow: hidden;
                background-color: var(--md-sys-color-background, #fafafa);
            }

            .content {
                display: flex;
                flex: 1 1 0;
                padding: 8px 16px;
                gap: 8px;
                max-width: 1600px;
                margin: 0 auto;
                width: 100%;
                box-sizing: border-box;
                min-height: 0;
                overflow: hidden;
            }

            .main-area {
                flex: 1 1 0;
                display: flex;
                flex-direction: column;
                min-width: 0;
                min-height: 0;
                overflow: hidden;
            }

            .graph-section {
                flex: 1 1 0;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .graph-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;
                flex-shrink: 0;
            }

            .graph-header h2 {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 500;
                color: var(--md-sys-color-on-background, #333);
            }

            .graph-controls {
                display: flex;
                gap: 4px;
            }

            .graph-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }

            .thread-search {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .thread-search input {
                width: 260px;
                max-width: 45vw;
                padding: 6px 8px;
                border: 1px solid var(--md-sys-color-outline-variant, #ccc);
                border-radius: 4px;
                background-color: var(--md-sys-color-surface, #fff);
                color: var(--md-sys-color-on-surface, #1c1b1f);
                font: inherit;
            }

            .thread-search input:focus {
                outline: 2px solid var(--md-sys-color-primary, #6750a4);
                outline-offset: 1px;
            }

            .search-button {
                padding: 6px 10px;
                border: 1px solid var(--md-sys-color-outline-variant, #ccc);
                border-radius: 4px;
                background-color: var(--md-sys-color-surface, #fff);
                color: var(--md-sys-color-on-surface, #1c1b1f);
                cursor: pointer;
                font: inherit;
            }

            .search-button:hover {
                background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
            }

            .search-button:focus-visible {
                outline: 2px solid var(--md-sys-color-primary);
                outline-offset: 1px;
            }

            .thread-search-status {
                margin: 0 0 6px;
                font-size: 0.85rem;
                color: var(--md-sys-color-on-surface-variant, #666);
            }

            .thread-search-status.found {
                color: var(--signal-color-strong);
            }

            .thread-search-status.not-found {
                color: var(--md-sys-color-error);
            }

            .control-button {
                background: none;
                border: 1px solid var(--md-sys-color-outline-variant, #ccc);
                border-radius: 4px;
                padding: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition:
                    background-color 0.2s,
                    border-color 0.2s;
            }

            .control-button:hover {
                background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
            }

            .control-button.active {
                background-color: var(--md-sys-color-primary-container, #e8def8);
                border-color: var(--md-sys-color-primary, #6750a4);
            }

            .control-button ha-svg-icon {
                --icon-primary-color: var(--md-sys-color-on-surface-variant, #666);
            }

            .control-button.active ha-svg-icon {
                --icon-primary-color: var(--md-sys-color-on-primary-container, #21005d);
            }

            .hide-menu-container {
                position: relative;
            }

            .hide-dropdown {
                position: absolute;
                top: calc(100% + 4px);
                right: 0;
                background: var(--md-sys-color-surface-container, #fff);
                border: 1px solid var(--md-sys-color-outline-variant, #ccc);
                border-radius: 4px;
                box-shadow: var(--md-sys-elevation-level2, 0 2px 6px var(--md-sys-color-shadow, rgba(0, 0, 0, 0.15)));
                min-width: 150px;
                z-index: 100;
                padding: 4px 0;
            }

            .hide-option {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                cursor: pointer;
                color: var(--md-sys-color-on-surface, #1c1b1f);
                font-size: 0.9rem;
                user-select: none;
            }

            .hide-option:hover {
                background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
            }

            .hide-option input[type="checkbox"] {
                cursor: pointer;
                margin: 0;
            }

            .hide-option span {
                flex: 1;
            }

            .graph-section thread-graph,
            .graph-section wifi-graph {
                flex: 1 1 0;
                min-height: 0;
            }

            .wifi-section {
                display: flex;
                flex-direction: column;
                gap: 16px;
                overflow-y: auto;
            }

            .wifi-section h2 {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 500;
                color: var(--md-sys-color-on-background, #333);
            }

            .wifi-section device-panel {
                flex-shrink: 0;
            }

            .details-sidebar {
                width: 320px;
                flex-shrink: 0;
                display: none;
                min-height: 0;
                overflow-y: auto;
            }

            .details-sidebar.visible {
                display: block;
            }

            @media (max-width: 1024px) {
                .content {
                    flex-direction: column;
                }

                .details-sidebar {
                    width: 100%;
                    max-height: 300px;
                }

                .details-sidebar.visible {
                    display: block;
                }
            }

            @media (max-width: 600px) {
                .content {
                    padding: 8px;
                }

                .graph-header {
                    align-items: flex-start;
                    gap: 6px;
                }

                .graph-actions {
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }

                .thread-search {
                    width: 100%;
                }

                .thread-search input {
                    flex: 1 1 auto;
                    width: auto;
                    max-width: none;
                }

                .graph-controls {
                    justify-content: flex-end;
                }
            }
        `,
    ];
}
