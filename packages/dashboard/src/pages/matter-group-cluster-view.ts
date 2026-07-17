/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/iconbutton/outlined-icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { MatterClient } from "@matter-server/ws-client";
import { mdiAlertCircleOutline, mdiPencil, mdiPlay } from "@mdi/js";
import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ClusterAttributeDescription, ClusterCommandDescription, clusters } from "../client/models/descriptions.js";
import { showAttributeWriteDialog } from "../components/dialogs/dev/show-attribute-write-dialog.js";
import { showCommandInvokeDialog } from "../components/dialogs/dev/show-command-invoke-dialog.js";
import "../components/ha-svg-icon";
import { formatHex } from "../util/format_hex.js";
import { notFoundStyles } from "../util/shared-styles.js";

declare global {
    interface HTMLElementTagNameMap {
        "matter-group-cluster-view": MatterGroupClusterView;
    }
}

/**
 * Build a Matter group-cast NodeId from a 16-bit GroupId.
 *
 * Why: matter.js uses `NodeId.fromGroupId()` to address groupcast writes/invokes;
 * its layout is `0xFFFF_FFFF_FFFF_<groupId>` (high 48 bits set, low 16 bits = group).
 * BigInt is required because the value exceeds Number.MAX_SAFE_INTEGER.
 */
function groupCastNodeId(groupId: number): bigint {
    const groupHex = (groupId & 0xffff).toString(16).padStart(4, "0");
    return BigInt("0xFFFFFFFFFFFF" + groupHex);
}

@customElement("matter-group-cluster-view")
class MatterGroupClusterView extends LitElement {
    public client!: MatterClient;

    @property({ type: Number }) public groupId?: number;
    @property({ type: Number }) public cluster?: number;

    private _writableAttributes(clusterId: number): ClusterAttributeDescription[] {
        const meta = clusters[clusterId];
        if (!meta) return [];
        return Object.values(meta.attributes)
            .filter(a => a.writable)
            .sort((a, b) => a.id - b.id);
    }

    private _commands(clusterId: number): ClusterCommandDescription[] {
        const meta = clusters[clusterId];
        if (!meta) return [];
        return Object.values(meta.commands).sort((a, b) => a.id - b.id);
    }

    private _openWrite(attribute: ClusterAttributeDescription) {
        if (this.groupId === undefined || this.cluster === undefined) return;
        showAttributeWriteDialog({
            client: this.client,
            nodeId: groupCastNodeId(this.groupId),
            // No endpointId — triggers group-cast (wildcard endpoint) on the server.
            clusterId: this.cluster,
            attributeId: attribute.id,
            label: attribute.label,
            currentValue: null,
        });
    }

    private _openInvoke(command: ClusterCommandDescription) {
        if (this.groupId === undefined || this.cluster === undefined) return;
        showCommandInvokeDialog({
            client: this.client,
            nodeId: groupCastNodeId(this.groupId),
            // No endpointId — triggers group-cast invoke (suppressed response).
            clusterId: this.cluster,
            commandId: command.id,
            commandName: command.name,
        });
    }

    override render() {
        if (this.groupId === undefined || this.cluster === undefined) {
            return html`
                <dashboard-header title="Not found" .client=${this.client} backButton="#groups"></dashboard-header>
                <div class="not-found">
                    <ha-svg-icon .path=${mdiAlertCircleOutline}></ha-svg-icon>
                    <p>Group or cluster not specified</p>
                </div>
            `;
        }

        const meta = clusters[this.cluster];
        const writable = this._writableAttributes(this.cluster);
        const commands = this._commands(this.cluster);

        const clusterName = meta?.label ?? "Custom/Unknown Cluster";

        return html`
            <dashboard-header
                .title=${`Group ${this.groupId} (${formatHex(this.groupId)}) | Cluster ${this.cluster} (${clusterName})`}
                .backButton=${`#groups/${this.groupId}`}
                .client=${this.client}
            ></dashboard-header>

            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>${meta?.label ?? "Custom/Unknown Cluster"}</b>
                        </div>
                        <div slot="supporting-text">
                            ClusterId ${this.cluster} (${formatHex(this.cluster)}) · Group-cast — writes use a group
                            node ID and no endpoint.
                        </div>
                    </md-list-item>
                </md-list>
            </div>

            <!-- Commands panel -->
            <div class="container">
                <details open class="dev-commands-panel">
                    <summary>
                        <span class="dev-chip">DEV</span>
                        Commands (group-cast)
                    </summary>
                    <div class="dev-commands-content">
                        ${commands.length === 0
                            ? html`<p class="empty">No commands defined for this cluster.</p>`
                            : html`
                                  <ul class="command-list">
                                      ${commands.map(
                                          cmd => html`
                                              <li class="command-row">
                                                  <div class="command-meta">
                                                      <span class="command-label">${cmd.label}</span>
                                                      <span class="command-sub">
                                                          CommandId ${cmd.id} (${formatHex(cmd.id)}) ·
                                                          <code>${cmd.name}</code>
                                                      </span>
                                                  </div>
                                                  <md-outlined-button
                                                      class="dev-invoke-button"
                                                      @click=${() => this._openInvoke(cmd)}
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

            <!-- Writable attributes -->
            <div class="container">
                <md-list>
                    <md-list-item>
                        <div slot="headline">
                            <b>Writable attributes</b>
                        </div>
                        <div slot="supporting-text">
                            Group-cast writes are sent suppressed-response. Values are not read back.
                        </div>
                    </md-list-item>
                    <md-divider></md-divider>
                    ${writable.length === 0
                        ? html`<md-list-item>
                              <div slot="supporting-text">No writable attributes defined for this cluster.</div>
                          </md-list-item>`
                        : writable.map(
                              (attribute, index) => html`
                                  <md-list-item class=${index % 2 === 1 ? "alternate-row" : ""}>
                                      <div slot="headline">${attribute.label}</div>
                                      <div slot="supporting-text">
                                          AttributeId ${attribute.id} (${formatHex(attribute.id)}) · Type:
                                          ${attribute.type}
                                      </div>
                                      <div slot="end" class="row-end">${this._renderWriteButton(attribute)}</div>
                                  </md-list-item>
                              `,
                          )}
                </md-list>
            </div>
            ${nothing}
        `;
    }

    private _renderWriteButton(attribute: ClusterAttributeDescription): TemplateResult {
        return html`
            <span class="dev-actions">
                <md-outlined-icon-button
                    class="dev-action pencil"
                    title="Group write attribute…"
                    aria-label="Group write attribute"
                    @click=${() => this._openWrite(attribute)}
                >
                    <ha-svg-icon .path=${mdiPencil}></ha-svg-icon>
                </md-outlined-icon-button>
            </span>
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

            md-list-item.alternate-row {
                background-color: var(--md-sys-color-surface-container-low);
            }

            .row-end {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .dev-actions {
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .dev-action {
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
                border-radius: 9999px;
                background: transparent;
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
                --md-outlined-button-icon-color: var(--dev-color);
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
