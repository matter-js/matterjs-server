/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import {
    ICD_MULTI_ADMIN_ERROR_CODE,
    ServerCommandError,
    type IcdStateData,
    type MatterNode,
} from "@matter-server/ws-client";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsync } from "../../../util/async-handler.js";
import { formatDuration } from "../../../util/duration.js";
import {
    ICD_CLUSTER_ID,
    icdInfo,
    isRegisteredByUs,
    otherFabricClientCount,
    parseMultiAdminDetails,
    wakeInstruction,
    type IcdInfo,
} from "../../../util/icd.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const COMMISSIONED_FABRICS_PATH = "0/62/3";
const CURRENT_FABRIC_INDEX_PATH = "0/62/5";
const REGISTERED_CLIENTS_PATH = `0/${ICD_CLUSTER_ID}/3`;

/**
 * Command panel for the IcdManagement cluster (ID: 0x46 / 70).
 * Shows ICD features/mode and manages the LIT ("Battery Saver Mode") registration.
 */
@customElement("icd-management-cluster-commands")
export class IcdManagementClusterCommands extends BaseClusterCommands {
    @state()
    private _serverState?: IcdStateData;

    @state()
    private _busy = false;

    @state()
    private _busyLabel = "";

    #loadedForNode?: string;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (this.client && this.node && this.#loadedForNode !== String(this.node.node_id)) {
            this.#loadedForNode = String(this.node.node_id);
            this._serverState = undefined;
            this._busy = false;
            this._busyLabel = "";
            handleAsync(() => this._ensureLoaded())();
        }
    }

    private get _info(): IcdInfo {
        return icdInfo(this.node.attributes);
    }

    /** Whether `this.node` is still the node a previously captured async flow started for. */
    private _isSameNode(node: MatterNode): boolean {
        return String(this.node?.node_id) === String(node.node_id);
    }

    private get _actionTimeoutMs(): number {
        // The device may be asleep: allow a full idle interval + margin for delivery.
        return ((this._info.idleModeDuration ?? 60) + 30) * 1000;
    }

    private async _ensureLoaded() {
        const node = this.node;
        try {
            const result = await this.client.readAttribute(node.node_id, [COMMISSIONED_FABRICS_PATH]);
            if (this._isSameNode(node)) Object.assign(this.node.attributes, result);
        } catch {
            // use cached values
        }
        await this._refreshServerState(node);
    }

    private async _refreshServerState(node: MatterNode) {
        let state: IcdStateData | undefined;
        try {
            state = await this.client.getIcdState(node.node_id);
        } catch {
            state = undefined;
        }
        if (!this._isSameNode(node)) return;
        this._serverState = state;
        this.requestUpdate();
    }

    private get _idleText(): string {
        const idle = this._info.idleModeDuration;
        return idle !== undefined ? formatDuration(idle) : "its idle interval";
    }

    private get _commissionedFabrics(): number {
        const value = this.node.attributes[COMMISSIONED_FABRICS_PATH];
        return typeof value === "number" ? value : 1;
    }

    private get _registered(): boolean {
        if (this._serverState !== undefined) return this._serverState.registered;
        return isRegisteredByUs(this._info.registeredClients, this.client.serverInfo?.controller_node_id);
    }

    override render() {
        if (!this.node || this.cluster !== ICD_CLUSTER_ID) return nothing;
        const info = this._info;
        if (!info.supported) return nothing;

        return html`
            <details class="command-panel" open>
                <summary>Power & Sleep (ICD)</summary>
                <div class="command-content">
                    <p>This device saves power by sleeping between short check-in windows.</p>
                    ${info.operatingMode === "LIT"
                        ? html`<p class="info-banner">
                              This device is currently in <b>Battery Saver Mode</b>: any action you trigger (commands,
                              reads, re-subscriptions) may take up to <b>${this._idleText}</b> while the device sleeps.
                              Updates reported by the device itself (e.g. sensor changes) are not delayed — the device
                              wakes up on its own to report them.
                          </p>`
                        : html`<p>
                              Current mode: <b>Standard</b> — the device sleeps between short check-ins and typically
                              reacts within seconds to a few minutes.
                          </p>`}
                    ${info.features.userActiveModeTrigger
                        ? html`<p>
                              To wake the device immediately:
                              ${wakeInstruction(info.userActiveModeTriggerHint, info.userActiveModeTriggerInstruction)}.
                          </p>`
                        : nothing}
                    ${info.features.longIdleTimeSupport ? this._renderModeChooser() : nothing}
                </div>
            </details>
        `;
    }

    private _renderModeChooser(): TemplateResult {
        const registered = this._registered;
        return html`
            <h4>Response speed vs. battery life</h4>
            <div class="mode-cards">
                <div class="mode-card ${registered ? "" : "selected"}">
                    <b>Standard Mode</b>
                    <p>
                        Best for faster responses, with higher battery use. The device still sleeps between short
                        check-ins, but wakes much more often — commands and reads typically reach it within seconds to a
                        few minutes (its regular polling/subscription interval). It is not permanently connected.
                    </p>
                </div>
                <div class="mode-card ${registered ? "selected" : ""}">
                    <b>Battery Saver Mode (Long Idle)</b>
                    <p>
                        Best for longest battery life. The device sleeps most of the time and wakes on its own schedule.
                    </p>
                    <ul>
                        <li>Commands may take up to <b>${this._idleText}</b> to be delivered while it sleeps.</li>
                        <li>
                            Updates reported by the device itself are <b>not</b> delayed (the device wakes itself to
                            report).
                        </li>
                        <li>
                            If the connection is lost (e.g. after a server restart, when no subscription is active),
                            reconnecting can also take up to <b>${this._idleText}</b>.
                        </li>
                        <li>
                            <b>Every</b> ecosystem this device is paired with must support Battery Saver Mode (Matter
                            "ICD LIT"), otherwise the device will appear offline or unresponsive there.
                        </li>
                    </ul>
                    <p>You can switch back to Standard Mode anytime.</p>
                </div>
            </div>
            ${!registered ? this._renderDisabledWarning() : nothing}
            <div class="command-row">
                ${registered
                    ? html`
                          <md-outlined-button @click=${handleAsync(() => this._disable())} ?disabled=${this._busy}>
                              Switch to Standard Mode
                          </md-outlined-button>
                          <md-outlined-button
                              @click=${handleAsync(() => this._resync())}
                              ?disabled=${this._busy || this.node.available}
                              title="Drops the local Battery Saver registration and reconnects from scratch. Use when the device appears stuck offline although it should be reachable."
                          >
                              Resync state
                          </md-outlined-button>
                      `
                    : html`
                          <md-filled-button @click=${handleAsync(() => this._enable())} ?disabled=${this._busy}>
                              Enable Battery Saver Mode
                          </md-filled-button>
                      `}
                ${this._busy ? html`<span class="busy">${this._busyLabel}</span>` : nothing}
            </div>
        `;
    }

    private _renderDisabledWarning(): TemplateResult {
        const single = this._commissionedFabrics <= 1;
        return html`<p class="warning-banner">
            ${single
                ? html`Battery Saver Mode is off. If you enable it, every ecosystem you pair this device with later must
                  support it (Matter ICD "LIT") — otherwise the device will appear offline or unresponsive there.`
                : html`Battery Saver Mode is off. This device is already paired with
                      <b>${this._commissionedFabrics - 1}</b> other ecosystem(s). If you enable it, all of them must
                      support it (Matter ICD "LIT") — otherwise the device will appear offline or unresponsive in those
                      ecosystems.`}
        </p>`;
    }

    private _enableConfirmText(): TemplateResult {
        const single = this._commissionedFabrics <= 1;
        return html`
            <p>
                The device will sleep most of the time. Commands may take up to <b>${this._idleText}</b> to reach it;
                updates from the device itself are not delayed.
            </p>
            <p>
                <b>Important:</b>
                ${single
                    ? html`every ecosystem you pair this device with later must support Battery Saver Mode (Matter ICD
                      "LIT"). In an ecosystem without support the device will appear offline or unresponsive.`
                    : html`this device is already paired with <b>${this._commissionedFabrics - 1}</b> other
                          ecosystem(s). All of them must support Battery Saver Mode (Matter ICD "LIT"), otherwise the
                          device will appear offline or unresponsive in those ecosystems.`}
            </p>
            <p>You can switch back to Standard Mode anytime.</p>
        `;
    }

    private async _enable() {
        const node = this.node;
        const confirmed = await showPromptDialog({
            title: "Enable Battery Saver Mode?",
            text: this._enableConfirmText(),
            confirmText: "Enable",
        });
        if (!confirmed || !this._isSameNode(node)) return;
        await this._runBusy(node, "Enabling — waiting for the device to wake up…", async () => {
            try {
                await this._register(node, false);
            } catch (error) {
                if (!(await this._handleMultiAdmin(node, error))) throw error;
            }
        });
    }

    /** Returns true when the error was a handled multi-admin rejection. */
    private async _handleMultiAdmin(node: MatterNode, error: unknown): Promise<boolean> {
        if (!(error instanceof ServerCommandError) || error.errorCode !== ICD_MULTI_ADMIN_ERROR_CODE) return false;
        const vendorIds = parseMultiAdminDetails(error.message) ?? new Array<number>();
        let names: string;
        if (vendorIds.length === 0) {
            names = "unknown ecosystems";
        } else {
            try {
                const lookup = await this.client.getVendorNames(vendorIds);
                names = vendorIds
                    .map(id => lookup[String(id)] ?? `Vendor 0x${id.toString(16).padStart(4, "0")}`)
                    .join(", ");
            } catch {
                names = vendorIds.map(id => `Vendor 0x${id.toString(16).padStart(4, "0")}`).join(", ");
            }
        }
        if (!this._isSameNode(node)) return true;
        const retry = await showPromptDialog({
            title: "Other ecosystems may not support Battery Saver Mode",
            text: html`
                <p>These connected ecosystems may not fully support Battery Saver Mode: <b>${names}</b>.</p>
                <p>
                    Enabling it can make the device appear offline or unresponsive in those ecosystems. Enable anyway?
                </p>
            `,
            confirmText: "Enable anyway",
        });
        if (!retry || !this._isSameNode(node)) return true;
        await this._register(node, true);
        return true;
    }

    private async _register(node: MatterNode, allowMultiAdmin: boolean) {
        await this.client.registerIcd(node.node_id, { allowMultiAdmin }, this._actionTimeoutMs);
    }

    private async _disable() {
        const node = this.node;
        await this._runBusy(node, "Switching — waiting for the device to wake up…", async () => {
            const others = await this._otherClientCount(node);
            if (!this._isSameNode(node)) return;
            if (others > 0) {
                await showAlertDialog({
                    title: "Cannot disable Battery Saver Mode",
                    text:
                        `Battery Saver Mode cannot be disabled: ${others} other controller(s) are still registered ` +
                        `with this device. Remove the device from those ecosystems (or disable Battery Saver Mode there) first.`,
                });
                return;
            }
            const confirmed = await showPromptDialog({
                title: "Switch to Standard Mode?",
                text:
                    "The device will wake much more often and respond faster, at the cost of higher battery use. " +
                    "It still sleeps briefly between check-ins — it does not become permanently connected.",
                confirmText: "Switch",
            });
            if (!confirmed || !this._isSameNode(node)) return;
            await this.client.unregisterIcd(node.node_id, false, this._actionTimeoutMs);
        });
    }

    /** Non-fabric-filtered RegisteredClients read; counts clients on other fabrics. */
    private async _otherClientCount(node: MatterNode): Promise<number> {
        const ourFabricIndexRaw = node.attributes[CURRENT_FABRIC_INDEX_PATH];
        const result = await this.client.readAttribute(
            node.node_id,
            [REGISTERED_CLIENTS_PATH, CURRENT_FABRIC_INDEX_PATH],
            this._actionTimeoutMs,
        );
        if (this._isSameNode(node)) Object.assign(this.node.attributes, result);
        const clients = result[REGISTERED_CLIENTS_PATH];
        const ourFabricIndex = result[CURRENT_FABRIC_INDEX_PATH] ?? ourFabricIndexRaw;
        return otherFabricClientCount(
            Array.isArray(clients) ? clients : new Array<never>(),
            typeof ourFabricIndex === "number" ? ourFabricIndex : undefined,
        );
    }

    private async _resync() {
        const node = this.node;
        const confirmed = await showPromptDialog({
            title: "Resync Battery Saver state?",
            text:
                "Drops the local Battery Saver registration and reconnects from scratch. " +
                "Use when the device appears stuck offline although it should be reachable.",
            confirmText: "Resync",
        });
        if (!confirmed || !this._isSameNode(node)) return;
        await this._runBusy(node, "Resyncing…", async () => {
            await this.client.resyncIcd(node.node_id);
        });
    }

    private async _runBusy(node: MatterNode, label: string, action: () => Promise<void>) {
        if (this._busy || !this._isSameNode(node)) return;
        this._busy = true;
        this._busyLabel = label;
        try {
            await action();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (this._isSameNode(node)) {
                await showAlertDialog({ title: "ICD operation failed", text: message });
            }
        } finally {
            if (this._isSameNode(node)) {
                this._busy = false;
                await this._refreshServerState(node);
            }
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .info-banner,
            .warning-banner {
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
            }
            .info-banner {
                background-color: var(--md-sys-color-surface-variant);
                color: var(--md-sys-color-on-surface-variant);
            }
            .warning-banner {
                color: var(--danger-color, #d32f2f);
                background-color: var(--md-sys-color-error-container, #fdecea);
            }
            .mode-cards {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .mode-card {
                flex: 1 1 280px;
                border: 1px solid var(--md-sys-color-outline-variant, #ccc);
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 14px;
            }
            .mode-card.selected {
                border-color: var(--md-sys-color-primary);
                border-width: 2px;
            }
            .mode-card ul {
                padding-left: 18px;
                margin: 4px 0;
            }
            .busy {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
                font-size: 14px;
                align-self: center;
            }
        `,
    ];
}

registerClusterCommands(ICD_CLUSTER_ID, "icd-management-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "icd-management-cluster-commands": IcdManagementClusterCommands;
    }
}
