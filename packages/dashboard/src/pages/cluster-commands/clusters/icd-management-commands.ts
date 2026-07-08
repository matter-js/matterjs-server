/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/radio/radio";
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
    decodeRegisteredClients,
    ICD_CLUSTER_ID,
    icdInfo,
    isRegisteredByUs,
    litSpecVersionOk,
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

type IcdMode = "standard" | "batterySaver";

/**
 * Command panel for the IcdManagement cluster (ID: 0x46 / 70).
 * Shows ICD features/mode and manages the LIT ("Battery Saver Mode") registration.
 */
@customElement("icd-management-cluster-commands")
export class IcdManagementClusterCommands extends BaseClusterCommands {
    @state()
    private _serverState?: IcdStateData;

    @state()
    private _selectedMode?: IcdMode;

    @state()
    private _busy = false;

    @state()
    private _busyLabel = "";

    #loadedForNode?: string;
    #flowGeneration = 0;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (!this.client || !this.node) return;
        if (this.#loadedForNode !== String(this.node.node_id)) {
            this.#loadedForNode = String(this.node.node_id);
            this.#flowGeneration++;
            this._serverState = undefined;
            this._selectedMode = undefined;
            this._busy = false;
            this._busyLabel = "";
            handleAsync(() => this._ensureLoaded())();
            return;
        }
        if (!this._busy && changedProperties.has("node") && changedProperties.get("node") !== this.node) {
            handleAsync(() => this._refreshServerState(this.node, this.endpoint))();
        }
    }

    private get _info(): IcdInfo {
        return icdInfo(this.node.attributes);
    }

    private get _actionTimeoutMs(): number {
        // The device may be asleep: allow a full idle interval + margin for delivery.
        return ((this._info.idleModeDuration ?? 60) + 30) * 1000;
    }

    private async _ensureLoaded() {
        await this._refreshServerState(this.node, this.endpoint);
    }

    private async _refreshServerState(node: MatterNode, endpoint: number) {
        let state: IcdStateData | undefined;
        try {
            state = await this.client.getIcdState(node.node_id);
        } catch {
            state = undefined;
        }
        if (!this.isSameContext(node, endpoint)) return;
        const previousMode = this._actualMode;
        this._serverState = state;
        // Passive refreshes must not discard a pending radio selection the user has not applied yet.
        if (this._selectedMode === undefined || previousMode !== this._actualMode) {
            this._resetSelectedMode();
        }
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

    /** matter.js only treats a peer as LIT-capable with LITS feature AND spec version >= 1.4.0. */
    private get _litSupported(): boolean {
        return (
            this._serverState?.lit_supported ??
            (this._info.features.longIdleTimeSupport && litSpecVersionOk(this.node.attributes))
        );
    }

    private get _actualMode(): IcdMode {
        return this._registered ? "batterySaver" : "standard";
    }

    private _resetSelectedMode() {
        this._selectedMode = this._actualMode;
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
                    ${info.features.userActiveModeTrigger ? this._renderWakeHint(info) : nothing}
                    ${info.features.longIdleTimeSupport || this._registered ? this._renderIcdManagement() : nothing}
                </div>
            </details>
        `;
    }

    private _renderWakeHint(info: IcdInfo): TemplateResult {
        const wake = wakeInstruction(info.userActiveModeTriggerHint, info.userActiveModeTriggerInstruction);
        return wake.kind === "custom"
            ? html`<p>To wake the device immediately, follow the device's instructions: "${wake.text}".</p>`
            : html`<p>To wake the device immediately: ${wake.text}.</p>`;
    }

    private _renderIcdManagement(): TemplateResult {
        const litUnsupported = this._info.features.longIdleTimeSupport && !this._litSupported;
        const notice = litUnsupported
            ? html`<p class="info-banner">
                  ICD management is available but unreliable: the device reports a Matter version below 1.4. Mode
                  management is disabled.
              </p>`
            : nothing;
        if (litUnsupported && !this._registered) return html`${notice}`;
        return html` ${notice}${this._renderModeChooser()} `;
    }

    private _renderModeChooser(): TemplateResult {
        const actualMode = this._actualMode;
        const selected = this._selectedMode ?? actualMode;
        const single = this._commissionedFabrics <= 1;
        return html`
            <h4>Response speed vs. battery life</h4>
            <div class="mode-options">
                <label class="mode-option">
                    <md-radio
                        name="icd-mode"
                        value="standard"
                        .checked=${selected === "standard"}
                        @change=${() => (this._selectedMode = "standard")}
                    ></md-radio>
                    <div class="mode-option-text">
                        <b>Standard Mode</b>
                        <p>
                            Best for faster responses, with higher battery use. The device still sleeps between short
                            check-ins, but wakes much more often — commands and reads typically reach it within seconds
                            to a few minutes (its regular polling/subscription interval). It is not permanently
                            connected.
                        </p>
                    </div>
                </label>
                <label class="mode-option">
                    <md-radio
                        name="icd-mode"
                        value="batterySaver"
                        .checked=${selected === "batterySaver"}
                        @change=${() => (this._selectedMode = "batterySaver")}
                    ></md-radio>
                    <div class="mode-option-text">
                        <b>Battery Saver Mode (Long Idle)</b>
                        <p>
                            Best for longest battery life. The device sleeps most of the time and wakes on its own
                            schedule.
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
                                <b>Every</b> ecosystem this device is paired with must support Battery Saver Mode
                                (Matter "ICD LIT"), otherwise the device will appear offline or unresponsive there.
                            </li>
                        </ul>
                    </div>
                </label>
            </div>
            <p class="info-banner">
                Every ecosystem this device is paired with must support Battery Saver Mode (Matter "ICD LIT"). You can
                switch back to Standard Mode later as long as no other ecosystem is registered for it.
                ${!single && !this._registered
                    ? html` This device is already paired with <b>${this._commissionedFabrics - 1}</b> other
                          ecosystem(s).`
                    : nothing}
            </p>
            <div class="command-row">
                <md-filled-button
                    @click=${handleAsync(() => this._changeMode())}
                    ?disabled=${this._busy || selected === actualMode}
                >
                    Change mode
                </md-filled-button>
                <md-outlined-button
                    @click=${handleAsync(() => this._resync())}
                    ?disabled=${this._busy || this.node.available}
                    title="Drops the local Battery Saver registration and reconnects from scratch. Use when the device appears stuck offline although it should be reachable."
                >
                    Resync state
                </md-outlined-button>
                ${this._busy ? html`<span class="busy">${this._busyLabel}</span>` : nothing}
            </div>
        `;
    }

    private async _changeMode() {
        const target = this._selectedMode;
        if (target === undefined || target === this._actualMode) return;
        if (target === "batterySaver") {
            await this._enable();
        } else {
            await this._disable();
        }
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
            <p>
                You can switch back to Standard Mode later as long as no other ecosystem is registered for Battery Saver
                Mode.
            </p>
        `;
    }

    private async _enable() {
        const node = this.node;
        const endpoint = this.endpoint;
        if (this._serverState !== undefined && !this._serverState.lit_supported) {
            await showAlertDialog({
                title: "Battery Saver Mode not supported",
                text: "This device advertises Battery Saver support but reports a Matter version below 1.4 — enabling is not safe and has been disabled.",
            });
            if (this.isSameContext(node, endpoint)) this._resetSelectedMode();
            return;
        }
        const confirmed = await showPromptDialog({
            title: "Enable Battery Saver Mode?",
            text: this._enableConfirmText(),
            confirmText: "Enable",
        });
        if (!confirmed) {
            if (this.isSameContext(node, endpoint)) this._resetSelectedMode();
            return;
        }
        if (!this.isSameContext(node, endpoint)) return;
        await this._runBusy(node, endpoint, "Enabling — waiting for the device to wake up…", async () => {
            try {
                await this._register(node, false);
            } catch (error) {
                if (!(await this._handleMultiAdmin(node, endpoint, error))) throw error;
            }
        });
    }

    /** Returns true when the error was a handled multi-admin rejection. */
    private async _handleMultiAdmin(node: MatterNode, endpoint: number, error: unknown): Promise<boolean> {
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
        if (!this.isSameContext(node, endpoint)) return true;
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
        if (!retry || !this.isSameContext(node, endpoint)) return true;
        await this._register(node, true);
        return true;
    }

    private async _register(node: MatterNode, allowMultiAdmin: boolean) {
        await this.client.registerIcd(node.node_id, { allowMultiAdmin }, this._actionTimeoutMs);
    }

    private async _disable() {
        const node = this.node;
        const endpoint = this.endpoint;
        await this._runBusy(node, endpoint, "Switching — waiting for the device to wake up…", async () => {
            const others = await this._otherClientCount(node, endpoint);
            if (!this.isSameContext(node, endpoint)) return;
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
            if (!confirmed || !this.isSameContext(node, endpoint)) return;
            await this.client.unregisterIcd(node.node_id, false, this._actionTimeoutMs);
        });
    }

    /** Non-fabric-filtered RegisteredClients read; counts clients on other fabrics. */
    private async _otherClientCount(node: MatterNode, endpoint: number): Promise<number> {
        const ourFabricIndexRaw = node.attributes[CURRENT_FABRIC_INDEX_PATH];
        const result = await this.client.readAttribute(
            node.node_id,
            [REGISTERED_CLIENTS_PATH, CURRENT_FABRIC_INDEX_PATH],
            this._actionTimeoutMs,
        );
        if (this.isSameContext(node, endpoint)) Object.assign(this.node.attributes, result);
        const clients = decodeRegisteredClients(result[REGISTERED_CLIENTS_PATH]);
        const ourFabricIndex = result[CURRENT_FABRIC_INDEX_PATH] ?? ourFabricIndexRaw;
        return otherFabricClientCount(clients, typeof ourFabricIndex === "number" ? ourFabricIndex : undefined);
    }

    private async _resync() {
        const node = this.node;
        const endpoint = this.endpoint;
        const confirmed = await showPromptDialog({
            title: "Resync Battery Saver state?",
            text:
                "Drops the local Battery Saver registration and reconnects from scratch. " +
                "Use when the device appears stuck offline although it should be reachable.",
            confirmText: "Resync",
        });
        if (!confirmed || !this.isSameContext(node, endpoint)) return;
        await this._runBusy(node, endpoint, "Resyncing…", async () => {
            await this.client.resyncIcd(node.node_id);
        });
    }

    private async _runBusy(node: MatterNode, endpoint: number, label: string, action: () => Promise<void>) {
        if (this._busy || !this.isSameContext(node, endpoint)) return;
        const gen = ++this.#flowGeneration;
        this._busy = true;
        this._busyLabel = label;
        try {
            await action();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (this.isSameContext(node, endpoint)) {
                await showAlertDialog({ title: "ICD operation failed", text: message });
            }
        } finally {
            if (gen === this.#flowGeneration) {
                this._busy = false;
                await this._refreshServerState(node, endpoint);
            }
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .info-banner {
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
                background-color: var(--md-sys-color-surface-variant);
                color: var(--md-sys-color-on-surface-variant);
            }
            .mode-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .mode-option {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                cursor: pointer;
            }
            .mode-option md-radio {
                flex-shrink: 0;
                margin-top: 2px;
            }
            .mode-option-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
                font-size: 14px;
            }
            .mode-option-text p {
                margin: 2px 0;
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .mode-option-text ul {
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
