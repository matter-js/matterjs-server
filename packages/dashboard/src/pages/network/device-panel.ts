/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/list/list";
import "@material/web/list/list-item";
import type { MatterNode } from "@matter-server/ws-client";
import { mdiChevronDown, mdiChevronRight, mdiEthernet, mdiRouter, mdiWifi } from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../../components/ha-svg-icon";
import { getDeviceName } from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "device-panel": DevicePanel;
    }
}

export type PanelType = "wifi" | "ethernet" | "bridges";

@customElement("device-panel")
export class DevicePanel extends LitElement {
    @property()
    public type: PanelType = "wifi";

    @property({ type: Array })
    public nodeIds: number[] = [];

    @property({ type: Object })
    public nodes: Record<string, MatterNode> = {};

    @property({ type: Boolean })
    public expanded = true;

    @state()
    private _isExpanded = true;

    override willUpdate(changedProperties: Map<string, unknown>): void {
        if (changedProperties.has("expanded")) {
            this._isExpanded = this.expanded;
        }
    }

    private _getIcon(): string {
        switch (this.type) {
            case "wifi":
                return mdiWifi;
            case "ethernet":
                return mdiEthernet;
            case "bridges":
                return mdiRouter;
        }
    }

    private _getTitle(): string {
        switch (this.type) {
            case "wifi":
                return "WiFi Devices";
            case "ethernet":
                return "Ethernet Devices";
            case "bridges":
                return "Bridges";
        }
    }

    private _toggleExpanded(): void {
        this._isExpanded = !this._isExpanded;
    }

    private _handleNodeClick(nodeId: number): void {
        this.dispatchEvent(
            new CustomEvent("node-selected", {
                detail: { nodeId },
                bubbles: true,
                composed: true,
            }),
        );
    }

    override render() {
        if (this.nodeIds.length === 0) {
            return nothing;
        }

        return html`
            <div class="panel">
                <div class="header" @click=${this._toggleExpanded}>
                    <ha-svg-icon .path=${this._getIcon()} class="type-icon"></ha-svg-icon>
                    <span class="title">${this._getTitle()}</span>
                    <span class="count">(${this.nodeIds.length})</span>
                    <ha-svg-icon
                        .path=${this._isExpanded ? mdiChevronDown : mdiChevronRight}
                        class="expand-icon"
                    ></ha-svg-icon>
                </div>
                ${
                    this._isExpanded
                        ? html`
                          <md-list class="device-list">
                              ${this.nodeIds.map(nodeId => {
                                  const node = this.nodes[nodeId.toString()];
                                  if (!node) return nothing;

                                  return html`
                                      <md-list-item type="button" @click=${() => this._handleNodeClick(nodeId)}>
                                          <div slot="headline">Node ${nodeId}</div>
                                          <div slot="supporting-text">${getDeviceName(node)}</div>
                                          <ha-svg-icon slot="end" .path=${mdiChevronRight}></ha-svg-icon>
                                      </md-list-item>
                                  `;
                              })}
                          </md-list>
                      `
                        : nothing
                }
            </div>
        `;
    }

    static override styles = css`
        :host {
            display: block;
        }

        .panel {
            background-color: var(--md-sys-color-surface, #fff);
            border-radius: 8px;
            border: 1px solid var(--md-sys-color-outline-variant, #ccc);
            overflow: hidden;
        }

        .header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            cursor: pointer;
            user-select: none;
            background-color: var(--md-sys-color-surface-container, #f5f5f5);
        }

        .header:hover {
            background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
        }

        .type-icon {
            --icon-primary-color: var(--md-sys-color-primary, #6200ee);
            margin-right: 12px;
        }

        .title {
            font-weight: 500;
            color: var(--md-sys-color-on-surface, #333);
        }

        .count {
            margin-left: 8px;
            color: var(--md-sys-color-on-surface-variant, #666);
            font-size: 0.875rem;
        }

        .expand-icon {
            margin-left: auto;
            --icon-primary-color: var(--md-sys-color-on-surface-variant, #666);
        }

        .device-list {
            --md-list-item-leading-space: 16px;
            --md-list-item-trailing-space: 16px;
        }

        md-list-item {
            --md-list-item-one-line-container-height: 48px;
        }

        md-list-item::part(focus-ring) {
            display: none;
        }
    `;
}
