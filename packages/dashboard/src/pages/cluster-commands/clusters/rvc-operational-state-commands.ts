/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import { css, type CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import {
    ACCEPTED_COMMAND_LIST_ATTR,
    decodeAcceptedCommands,
    decodeOperationalCommandResponse,
    decodeOperationalError,
    describeOperationalState,
    OPERATIONAL_ERROR_ATTR,
    OPERATIONAL_STATE_ATTR,
    OPERATIONAL_STATE_LIST_ATTR,
    RVC_OPERATIONAL_STATE_CLUSTER_ID,
    RvcOperationalCommand,
} from "../../../util/rvc-operational-state.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = RVC_OPERATIONAL_STATE_CLUSTER_ID;

const COMMANDS: ReadonlyArray<{ name: string; label: string; id: RvcOperationalCommand }> = [
    { name: "Pause", label: "Pause", id: RvcOperationalCommand.Pause },
    { name: "Resume", label: "Resume", id: RvcOperationalCommand.Resume },
    { name: "GoHome", label: "Go Home", id: RvcOperationalCommand.GoHome },
];

@customElement("rvc-operational-state-cluster-commands")
class RvcOperationalStateClusterCommands extends BaseClusterCommands {
    @state() private _busy = false;
    @state() private _result?: { commandLabel: string; label: string; isError: boolean; details?: string };
    @state() private _error?: string;
    private _formContext?: string;
    private _invokeGeneration = 0;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._result = undefined;
            this._error = undefined;
            this._busy = false;
            this._invokeGeneration++;
        }
        this._formContext = context;
    }

    override render() {
        const operationalState = describeOperationalState(
            this.node?.attributes[`${this.endpoint}/${CLUSTER_ID}/${OPERATIONAL_STATE_ATTR}`],
            this.node?.attributes[`${this.endpoint}/${CLUSTER_ID}/${OPERATIONAL_STATE_LIST_ATTR}`],
        );
        const operationalError = decodeOperationalError(
            this.node?.attributes[`${this.endpoint}/${CLUSTER_ID}/${OPERATIONAL_ERROR_ATTR}`],
        );

        const acceptedCommands = decodeAcceptedCommands(
            this.node?.attributes[`${this.endpoint}/${CLUSTER_ID}/${ACCEPTED_COMMAND_LIST_ATTR}`],
        );
        const commands = COMMANDS.filter(command => acceptedCommands?.has(command.id) ?? true);

        const disabled = this._busy || !this.node?.available;

        return html`
            <details class="command-panel">
                <summary>RvcOperationalState Commands</summary>
                <div class="command-content">
                    ${this._renderStateInfo(operationalState, operationalError)}
                    <div class="command-row">
                        ${commands.map(
                            command =>
                                html`<md-outlined-button
                                    ?disabled=${disabled}
                                    @click=${handleAsync(() => this._invoke(command.name, command.label))}
                                >
                                    ${command.label}
                                </md-outlined-button>`,
                        )}
                    </div>
                    ${
                        this._result
                            ? html`<div
                                  class="result ${this._result.isError ? "result-error" : ""}"
                                  role=${this._result.isError ? "alert" : "status"}
                              >
                                  ${this._result.commandLabel} →
                                  ${this._result.label}${
                                      this._result.details ? html`: ${this._result.details}` : nothing
                                  }
                              </div>`
                            : nothing
                    }
                    ${this._error ? html`<div class="result result-error" role="alert">${this._error}</div>` : nothing}
                </div>
            </details>
        `;
    }

    private _renderStateInfo(
        operationalState: string | null,
        operationalError: ReturnType<typeof decodeOperationalError>,
    ) {
        if (!operationalState && !operationalError) return nothing;

        return html`
            <div class="state-info">
                ${
                    operationalState
                        ? html`
                              <div class="state-item">
                                  <span class="label">State:</span>
                                  <span class="value">${operationalState}</span>
                              </div>
                          `
                        : nothing
                }
                ${
                    operationalError
                        ? html`
                              <div class="state-item ${operationalError.isError ? "error" : ""}">
                                  <span class="label">Error:</span>
                                  <span class="value"
                                      >${operationalError.label}${
                                          operationalError.details ? html` (${operationalError.details})` : nothing
                                      }</span
                                  >
                              </div>
                          `
                        : nothing
                }
            </div>
        `;
    }

    private async _invoke(command: string, label: string) {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this._invokeGeneration;
        const isCurrent = () => this._invokeGeneration === generation && this.isSameContext(node, endpoint);
        this._busy = true;
        this._error = undefined;
        this._result = undefined;
        try {
            const response = await this.client.deviceCommand(node.node_id, endpoint, CLUSTER_ID, command, {});
            if (!isCurrent()) return;
            const outcome = decodeOperationalCommandResponse(response);
            this._result = {
                commandLabel: label,
                label: outcome.label,
                isError: outcome.isError,
                details: outcome.details,
            };
        } catch (err) {
            if (isCurrent()) this._error = `${label}: ${errorText(err)}`;
        } finally {
            if (isCurrent()) this._busy = false;
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .state-info {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
                padding: 12px;
                background-color: var(--md-sys-color-surface-container-low);
                border-radius: 8px;
                border-left: 4px solid var(--md-sys-color-primary);
            }

            .state-item {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 14px;
            }

            .state-item.error {
                border-left: 4px solid var(--md-sys-color-error);
                padding-left: 12px;
                margin-left: -12px;
            }

            .state-item .label {
                font-weight: 500;
                color: var(--md-sys-color-on-surface-variant);
                min-width: 60px;
            }

            .state-item .value {
                color: var(--md-sys-color-on-surface);
                font-family: var(--monospace-font, monospace);
                padding: 4px 8px;
                background-color: var(--md-sys-color-surface-container-high);
                border-radius: 4px;
            }

            .state-item.error .value {
                background-color: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
                color: var(--md-sys-color-error);
            }

            .result {
                margin-top: 8px;
                padding: 8px 10px;
                border-radius: 6px;
                background: color-mix(in srgb, var(--success-color) 18%, transparent);
                color: var(--success-color);
                border: 1px solid color-mix(in srgb, var(--success-color) 40%, transparent);
            }

            .result-error {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
                border: none;
            }
        `,
    ];
}

registerClusterCommands(CLUSTER_ID, "rvc-operational-state-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "rvc-operational-state-cluster-commands": RvcOperationalStateClusterCommands;
    }
}
