/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume, provide } from "@lit/context";
import "@material/web/button/outlined-button";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/iconbutton/outlined-icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { isTestNodeId, MatterClient, MatterNode, toBigIntAwareJson } from "@matter-server/ws-client";
import { mdiAlertCircleOutline, mdiPencil, mdiPlay, mdiRefresh } from "@mdi/js";
import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { clientContext } from "../client/client-context.js";
import { clusters } from "../client/models/descriptions.js";
import { showAlertDialog } from "../components/dialog-box/show-dialog-box.js";
import { showAttributeWriteDialog } from "../components/dialogs/dev/show-attribute-write-dialog.js";
import { showCommandInvokeDialog } from "../components/dialogs/dev/show-command-invoke-dialog.js";
import "../components/ha-svg-icon";
import "../pages/components/node-details";
// Cluster command components (auto-register on import)
import { DevModeService } from "../util/dev-mode-service.js";
import { formatHex, formatNodeAddress, getEffectiveFabricIndex } from "../util/format_hex.js";
import { notFoundStyles } from "../util/shared-styles.js";
import { getClusterCommandsTag } from "./cluster-commands/index.js";
import { bindingContext } from "./components/context.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-cluster-view": MatterClusterView;
    }
}

// Global attribute IDs range (0xFFF0-0xFFFF)
const GLOBAL_ATTRIBUTE_MIN = 0xfff0;
const GLOBAL_ATTRIBUTE_MAX = 0xffff;

// AcceptedCommandList global attribute (lists server-supported command IDs per cluster instance)
const ACCEPTED_COMMAND_LIST_ATTR = 0xfff9;

// How long to flash the refresh icon in success state.
const REFRESH_SUCCESS_MS = 600;

type RefreshState = "idle" | "loading" | "success";

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
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @property()
    public node?: MatterNode;

    @provide({ context: bindingContext })
    @property()
    public endpoint!: number;

    @property()
    public cluster?: number;

    @state() private _devMode = DevModeService.active;

    // Per-attribute refresh state, keyed by attribute id (within the current ep/cluster)
    @state() private _refreshState: Record<number, RefreshState> = {};

    private _unsubscribeDev?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubscribeDev = DevModeService.subscribe(active => {
            this._devMode = active;
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeDev?.();
    }

    override render() {
        if (!this.node || this.endpoint == undefined || this.cluster == undefined) {
            return html`
                <dashboard-header title="Not found" .client=${this.client} backButton="#"></dashboard-header>
                <div class="not-found">
                    <ha-svg-icon .path=${mdiAlertCircleOutline}></ha-svg-icon>
                    <p>Node, endpoint, or cluster not found</p>
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

        const clusterName = clusters[this.cluster]?.label ?? "Custom/Unknown Cluster";

        return html`
            <dashboard-header
                .title=${`Node ${this.node.node_id} ${nodeHex}  |  Endpoint ${this.endpoint}  |  Cluster ${this.cluster} (${clusterName})`}
                .backButton=${`#node/${this.node.node_id}/${this.endpoint}`}
            ></dashboard-header>

            <!-- node details section -->
            <div class="container">
                <node-details .node=${this.node}></node-details>
            </div>

            <!-- Cluster commands section (if available for this cluster) -->
            ${this._renderClusterCommands()}

            <!-- Developer-mode commands panel -->
            ${this._devMode ? this._renderDevCommandsPanel() : nothing}

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
                                <div slot="end" class="row-end">
                                    ${this._devMode
                                        ? this._renderAttributeDevActions(attribute.key, attribute.value)
                                        : nothing}
                                    ${toBigIntAwareJson(attribute.value).length > 30
                                        ? html`<md-outlined-button
                                              @click=${() => {
                                                  this._showAttributeValue(attribute.value);
                                              }}
                                          >
                                              Show value
                                          </md-outlined-button>`
                                        : html`<code>${toBigIntAwareJson(attribute.value)}</code>`}
                                </div>
                            </md-list-item>
                        `,
                    )}
                </md-list>
            </div>
        `;
    }

    private _renderAttributeDevActions(attributeId: number, currentValue: unknown): TemplateResult {
        const meta = clusters[this.cluster!]?.attributes[attributeId];
        const online = this.node?.available === true;
        const state = this._refreshState[attributeId] ?? "idle";
        const refreshClasses = `dev-action refresh refresh-${state}`;

        return html`
            <span class="dev-actions">
                <md-outlined-icon-button
                    class=${refreshClasses}
                    title="Read attribute now"
                    aria-label="Read attribute now"
                    ?disabled=${!online || state === "loading"}
                    @click=${() => this._refreshAttribute(attributeId)}
                >
                    <ha-svg-icon .path=${mdiRefresh}></ha-svg-icon>
                </md-outlined-icon-button>
                ${meta?.writable
                    ? html`
                          <md-outlined-icon-button
                              class="dev-action pencil"
                              title="Write attribute…"
                              aria-label="Write attribute"
                              ?disabled=${!online}
                              @click=${() => this._openAttributeWriteDialog(attributeId, currentValue, meta.label)}
                          >
                              <ha-svg-icon .path=${mdiPencil}></ha-svg-icon>
                          </md-outlined-icon-button>
                      `
                    : nothing}
            </span>
        `;
    }

    private async _refreshAttribute(attributeId: number) {
        if (!this.node) return;
        // Snapshot the context at click time so a late-arriving response cannot leak
        // state into a different cluster view after navigation.
        const nodeId = this.node.node_id;
        const endpoint = this.endpoint;
        const cluster = this.cluster;
        const path = `${endpoint}/${cluster}/${attributeId}`;
        const isSameContext = () =>
            this.isConnected && this.node?.node_id === nodeId && this.endpoint === endpoint && this.cluster === cluster;

        this._refreshState = { ...this._refreshState, [attributeId]: "loading" };
        try {
            const result = await this.client.readAttribute(nodeId, path);
            if (!isSameContext()) return;
            // Defensive merge — attribute_updated events usually do this already.
            for (const [key, value] of Object.entries(result)) {
                this.node.attributes[key] = value;
            }
            this.requestUpdate();
            this._refreshState = { ...this._refreshState, [attributeId]: "success" };
            setTimeout(() => {
                if (!isSameContext()) return;
                if (this._refreshState[attributeId] === "success") {
                    this._refreshState = { ...this._refreshState, [attributeId]: "idle" };
                }
            }, REFRESH_SUCCESS_MS);
        } catch (err) {
            if (!isSameContext()) return;
            this._refreshState = { ...this._refreshState, [attributeId]: "idle" };
            const message = err instanceof Error ? err.message : String(err);
            showAlertDialog({ title: "Read failed", text: message });
        }
    }

    private _openAttributeWriteDialog(attributeId: number, currentValue: unknown, label: string) {
        if (!this.node || this.cluster === undefined) return;
        showAttributeWriteDialog({
            client: this.client,
            nodeId: this.node.node_id,
            endpointId: this.endpoint,
            clusterId: this.cluster,
            attributeId,
            label,
            currentValue,
        });
    }

    private _renderDevCommandsPanel(): TemplateResult {
        const clusterMeta = this.cluster !== undefined ? clusters[this.cluster] : undefined;
        const rawAcceptedList = this.node?.attributes[`${this.endpoint}/${this.cluster}/${ACCEPTED_COMMAND_LIST_ATTR}`];
        const acceptedList = Array.isArray(rawAcceptedList) ? (rawAcceptedList as number[]) : [];

        const commands = acceptedList
            .map(id => clusterMeta?.commands[id])
            .filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined)
            .sort((a, b) => a.id - b.id);

        const online = this.node?.available === true;

        return html`
            <div class="container">
                <details class="dev-commands-panel">
                    <summary>
                        <span class="dev-chip">DEV</span>
                        Commands
                    </summary>
                    <div class="dev-commands-content">
                        ${commands.length === 0
                            ? html`<p class="empty">No invokable commands for this cluster.</p>`
                            : html`
                                  <ul class="command-list">
                                      ${commands.map(
                                          cmd => html`
                                              <li class="command-row">
                                                  <div class="command-meta">
                                                      <span class="command-label">${cmd.label}</span>
                                                      <span class="command-sub"
                                                          >CommandId ${cmd.id} (${formatHex(cmd.id)}) ·
                                                          <code>${cmd.name}</code></span
                                                      >
                                                  </div>
                                                  <md-outlined-button
                                                      class="dev-invoke-button"
                                                      ?disabled=${!online}
                                                      @click=${() => this._openCommandInvokeDialog(cmd.id, cmd.name)}
                                                  >
                                                      <ha-svg-icon slot="icon" .path=${mdiPlay}></ha-svg-icon>
                                                      Invoke
                                                  </md-outlined-button>
                                              </li>
                                          `,
                                      )}
                                  </ul>
                              `}
                    </div>
                </details>
            </div>
        `;
    }

    private _openCommandInvokeDialog(commandId: number, commandName: string) {
        if (!this.node || this.cluster === undefined) return;
        showCommandInvokeDialog({
            client: this.client,
            nodeId: this.node.node_id,
            endpointId: this.endpoint,
            clusterId: this.cluster,
            commandId,
            commandName,
        });
    }

    private async _showAttributeValue(value: any) {
        showAlertDialog({
            title: "Attribute value",
            text: toBigIntAwareJson(value),
            asCodeBlock: true,
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

        // Reset per-attribute refresh state when navigating to a different cluster/endpoint.
        if (changedProperties.has("cluster") || changedProperties.has("endpoint")) {
            this._refreshState = {};
        }

        // After render, find and configure the cluster commands component
        const container = this.shadowRoot?.getElementById("cluster-commands-container");
        if (container) {
            const commandsElement = container.firstElementChild as any;
            if (commandsElement && this.node) {
                commandsElement.node = this.node;
                commandsElement.endpoint = this.endpoint;
                commandsElement.cluster = this.cluster;
            }
        }
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

            md-list-item.alternate-row {
                background-color: var(--md-sys-color-surface-container-low);
            }

            .row-end {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            /* Framed dev-mode actions, clearly separated from the value display. */
            .dev-actions {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding-right: 10px;
                margin-right: 2px;
                border-right: 1px solid var(--md-sys-color-outline-variant);
            }

            .dev-action {
                /* Compact, visible outlined frame in dev-mode accent (deep violet). */
                --md-outlined-icon-button-container-width: 32px;
                --md-outlined-icon-button-container-height: 32px;
                --md-outlined-icon-button-icon-size: 18px;
                --md-outlined-icon-button-outline-color: var(--dev-color);
                --md-outlined-icon-button-outline-width: 1px;
                --md-outlined-icon-button-icon-color: var(--dev-color);
                --md-outlined-icon-button-hover-state-layer-color: var(--dev-color);
                --md-outlined-icon-button-focus-state-layer-color: var(--dev-color);
                --md-outlined-icon-button-pressed-state-layer-color: var(--dev-color);
                --icon-primary-color: var(--dev-color);
                /* Round container kept constant so the success-fill transitions smoothly. */
                border-radius: 9999px;
                background: transparent;
                margin-right: 0;
                transition: background 300ms ease-out;
            }

            .dev-action.refresh-loading ha-svg-icon {
                animation: dev-spin 0.9s linear infinite;
            }

            .dev-action.refresh-success {
                --md-outlined-icon-button-icon-color: var(--dev-on-color);
                --icon-primary-color: var(--dev-on-color);
                background: var(--dev-color);
            }

            @keyframes dev-spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .dev-action.refresh-loading ha-svg-icon {
                    animation: none;
                }
            }

            details.dev-commands-panel {
                background-color: var(--md-sys-color-surface-container);
                border: 1px solid var(--dev-color);
                border-radius: 12px;
                overflow: hidden;
            }

            details.dev-commands-panel summary {
                padding: 14px 16px;
                font-weight: 500;
                color: var(--md-sys-color-on-surface);
                cursor: pointer;
                user-select: none;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            details.dev-commands-panel summary:hover {
                background-color: color-mix(in srgb, var(--dev-color) 8%, transparent);
            }

            details.dev-commands-panel summary::before {
                content: "▶";
                font-size: 12px;
                color: var(--dev-color);
                transition: transform 0.2s ease;
            }

            details.dev-commands-panel[open] summary::before {
                transform: rotate(90deg);
            }

            details.dev-commands-panel summary::-webkit-details-marker {
                display: none;
            }

            .dev-chip {
                font-family: var(--monospace-font);
                font-size: 0.7rem;
                font-weight: 600;
                letter-spacing: 0.08em;
                padding: 2px 6px;
                border-radius: 4px;
                background: var(--dev-color);
                color: var(--dev-on-color);
                line-height: 1;
            }

            .dev-commands-content {
                padding: 0 16px 16px 16px;
            }

            .empty {
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.9rem;
                margin: 0;
            }

            .command-list {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .command-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 8px 12px;
                background: var(--md-sys-color-surface-container-low);
                border-radius: 8px;
                transition: background 120ms ease-out;
            }

            .command-row:hover {
                background: color-mix(in srgb, var(--dev-color) 12%, var(--md-sys-color-surface-container-low));
            }

            .dev-invoke-button {
                --md-outlined-button-outline-color: var(--dev-color);
                --md-outlined-button-label-text-color: var(--dev-color);
                --md-outlined-button-hover-state-layer-color: var(--dev-color);
                --md-outlined-button-focus-state-layer-color: var(--dev-color);
                --md-outlined-button-pressed-state-layer-color: var(--dev-color);
                --md-outlined-button-icon-color: var(--dev-color);
                --md-outlined-button-hover-label-text-color: var(--dev-color);
                --md-outlined-button-focus-label-text-color: var(--dev-color);
                --md-outlined-button-pressed-label-text-color: var(--dev-color);
            }

            .command-meta {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }

            .command-label {
                font-weight: 500;
                color: var(--md-sys-color-on-surface);
            }

            .command-sub {
                font-size: 0.825rem;
                color: var(--md-sys-color-on-surface-variant);
            }

            .command-sub code {
                font-family: var(--monospace-font);
                background: var(--md-sys-color-surface-container-high);
                padding: 0 4px;
                border-radius: 3px;
            }
        `,
    ];
}
