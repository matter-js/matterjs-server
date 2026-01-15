/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterClient, MatterNode } from "@matter-server/ws-client";
import { LitElement, css } from "lit";
import { property } from "lit/decorators.js";

/**
 * Base class for cluster-specific command panels.
 * Provides shared properties, styling, and helper methods for sending commands.
 */
export abstract class BaseClusterCommands extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @property({ attribute: false })
    public node!: MatterNode;

    @property({ type: Number })
    public endpoint!: number;

    @property({ type: Number })
    public cluster!: number;

    /**
     * Send a command to the device.
     * @param command - The command name (PascalCase, e.g., "On", "Off", "MoveToLevel")
     * @param payload - Optional command payload
     */
    protected async sendCommand(command: string, payload?: Record<string, unknown>): Promise<void> {
        try {
            await this.client.deviceCommand(this.node.node_id, this.endpoint, this.cluster, command, payload ?? {});
        } catch (error) {
            console.error(`Failed to send command ${command}:`, error);
            // Could dispatch an event here for error handling in parent
        }
    }

    static override styles = css`
        :host {
            display: block;
        }

        details.command-panel {
            background-color: var(--md-sys-color-surface-container);
            border-radius: 12px;
            overflow: hidden;
        }

        details.command-panel summary {
            padding: 16px;
            font-weight: 500;
            color: var(--md-sys-color-on-surface);
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        details.command-panel summary:hover {
            background-color: var(--md-sys-color-surface-container-high);
        }

        details.command-panel summary::before {
            content: "▶";
            font-size: 12px;
            transition: transform 0.2s ease;
        }

        details.command-panel[open] summary::before {
            transform: rotate(90deg);
        }

        details.command-panel summary::-webkit-details-marker {
            display: none;
        }

        .command-content {
            padding: 0 16px 16px 16px;
        }

        .command-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .command-row label {
            font-size: 14px;
            color: var(--md-sys-color-on-surface-variant);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .command-row input[type="number"] {
            width: 70px;
            padding: 8px;
            border: 1px solid var(--md-sys-color-outline);
            border-radius: 4px;
            background: var(--md-sys-color-surface);
            color: var(--md-sys-color-on-surface);
        }

        .command-row input[type="checkbox"] {
            width: 16px;
            height: 16px;
            margin: 0;
        }

        md-filled-button,
        md-outlined-button {
            --md-filled-button-container-height: 36px;
            --md-outlined-button-container-height: 36px;
        }
    `;
}
