/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/iconbutton/outlined-icon-button";
import { MdOutlinedSelect } from "@material/web/select/outlined-select.js";
import "@material/web/select/select-option";
import { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import type { MatterNode } from "@matter-server/ws-client";
import { mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import "../../../components/ha-svg-icon.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import {
    createOrUpdateTrigger,
    createTwoDCartesianZone,
    formatVertices,
    parseTriggerForm,
    parseZoneForm,
    removeTrigger,
    removeZone,
    updateTwoDCartesianZone,
    ZONE_MANAGEMENT_CLUSTER_ID,
    ZONE_SOURCE_LABELS,
    ZONE_USE_LABELS,
    zoneCapacityReached,
    zoneLabel,
    zoneManagementInfo,
    ZoneSource,
    zoneSwatchColor,
    ZoneUse,
    type TriggerForm,
    type TriggerInfo,
    type ZoneForm,
    type ZoneInfo,
    type ZoneManagementInfo,
} from "../../../util/zone-management.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const EMPTY_ZONE_FORM: ZoneForm = { name: "", use: String(ZoneUse.Motion), vertices: "", color: "" };
const EMPTY_TRIGGER_FORM: TriggerForm = {
    zoneId: "",
    initialDuration: "",
    augmentationDuration: "",
    maxDuration: "",
    blindDuration: "",
    sensitivity: "",
};

/** The zone form's target: a new zone, or the user-defined zone with this id. */
type ZoneEditTarget = { create: true } | { create: false; zoneId: number };

function contextKey(node: MatterNode, endpoint: number): string {
    return `${String(node.node_id)}/${endpoint}`;
}

/** Text of the Material text field or select that fired the event; undefined for any other target. */
function fieldValue(e: Event): string | undefined {
    const target = e.target;
    return target instanceof MdOutlinedTextField || target instanceof MdOutlinedSelect ? target.value : undefined;
}

@customElement("zone-management-cluster-commands")
export class ZoneManagementClusterCommands extends BaseClusterCommands {
    /** `node/endpoint` keys with a command in flight, so returning to a node while its command runs keeps it busy. */
    @state() private _busyContexts = new Set<string>();
    @state() private _zoneTarget?: ZoneEditTarget;
    @state() private _zoneForm: ZoneForm = EMPTY_ZONE_FORM;
    @state() private _triggerForm: TriggerForm = EMPTY_TRIGGER_FORM;
    private _formContext?: string;

    private get _busy(): boolean {
        return this.node !== undefined && this._busyContexts.has(contextKey(this.node, this.endpoint));
    }

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${contextKey(this.node, this.endpoint)}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._zoneTarget = undefined;
            this._zoneForm = EMPTY_ZONE_FORM;
            this._triggerForm = EMPTY_TRIGGER_FORM;
        }
        this._formContext = context;

        const target = this._zoneTarget;
        if (target !== undefined && !target.create) {
            const zones = zoneManagementInfo(this.node.attributes, this.endpoint).zones;
            if (!zones.some(zone => zone.zoneId === target.zoneId)) this._cancelZoneForm();
        }
    }

    /**
     * Runs one command with the panel marked busy. `node` and `endpoint` are captured before the await: the cluster
     * view reuses this panel across same-cluster navigation, so a late result must not touch another node's panel.
     */
    private async _run(failureTitle: string, command: (node: MatterNode, endpoint: number) => Promise<void>) {
        const { node, endpoint } = this;
        if (!node) return;
        const key = contextKey(node, endpoint);
        this._busyContexts = new Set(this._busyContexts).add(key);
        try {
            await command(node, endpoint);
        } catch (err) {
            if (!this.isSameContext(node, endpoint)) {
                console.error(`${failureTitle} (panel moved on)`, err);
                return;
            }
            showAlertDialog({ title: failureTitle, text: errorText(err) }).catch(dialogErr =>
                console.error("Failed to show the ZoneManagement command error", dialogErr),
            );
        } finally {
            const busyContexts = new Set(this._busyContexts);
            busyContexts.delete(key);
            this._busyContexts = busyContexts;
        }
    }

    private _startCreateZone() {
        this._zoneTarget = { create: true };
        this._zoneForm = EMPTY_ZONE_FORM;
    }

    private _startEditZone(zone: ZoneInfo) {
        const data = zone.twoDCartesianZone;
        this._zoneTarget = { create: false, zoneId: zone.zoneId };
        this._zoneForm = {
            name: data?.name ?? "",
            use: String(data?.use ?? ZoneUse.Motion),
            vertices: formatVertices(data?.vertices ?? []),
            color: data?.color ?? "",
        };
    }

    private _cancelZoneForm() {
        this._zoneTarget = undefined;
        this._zoneForm = EMPTY_ZONE_FORM;
    }

    private async _submitZoneForm(info: ZoneManagementInfo) {
        const target = this._zoneTarget;
        if (target === undefined) return;
        const zone = parseZoneForm(this._zoneForm, info, target.create).value;
        if (zone === undefined) return;
        await this._run(target.create ? "Create zone failed" : "Update zone failed", async (node, endpoint) => {
            if (target.create) {
                await createTwoDCartesianZone(this.client, node.node_id, endpoint, zone);
            } else {
                await updateTwoDCartesianZone(this.client, node.node_id, endpoint, target.zoneId, zone);
            }
            if (this.isSameContext(node, endpoint)) this._cancelZoneForm();
        });
    }

    private async _removeZone(zone: ZoneInfo, hasTrigger: boolean) {
        const { node, endpoint } = this;
        if (!node) return;
        if (hasTrigger) {
            showAlertDialog({
                title: "Remove zone",
                text: `"${zoneLabel(zone)}" (ZoneID ${zone.zoneId}) has a trigger. The device refuses to remove a zone that a trigger uses, so remove the trigger first.`,
            }).catch(err => console.error("Failed to show the ZoneManagement command error", err));
            return;
        }
        const confirmed = await showPromptDialog({
            title: "Remove zone",
            text: `Remove "${zoneLabel(zone)}" (ZoneID ${zone.zoneId})?`,
            confirmText: "Remove",
        });
        if (!confirmed || !this.isSameContext(node, endpoint)) return;
        await this._run("Remove zone failed", (node, endpoint) =>
            removeZone(this.client, node.node_id, endpoint, zone.zoneId),
        );
    }

    private _startEditTrigger(trigger: TriggerInfo) {
        this._triggerForm = {
            zoneId: String(trigger.zoneId),
            initialDuration: String(trigger.initialDuration),
            augmentationDuration: String(trigger.augmentationDuration),
            maxDuration: String(trigger.maxDuration),
            blindDuration: String(trigger.blindDuration),
            sensitivity: trigger.sensitivity !== undefined ? String(trigger.sensitivity) : "",
        };
    }

    private async _submitTrigger(info: ZoneManagementInfo) {
        const trigger = parseTriggerForm(this._triggerForm, info).value;
        if (trigger === undefined) return;
        await this._run("Create/update trigger failed", async (node, endpoint) => {
            await createOrUpdateTrigger(this.client, node.node_id, endpoint, trigger);
            if (this.isSameContext(node, endpoint)) this._triggerForm = EMPTY_TRIGGER_FORM;
        });
    }

    private async _removeTriggerFor(info: ZoneManagementInfo, zoneId: number) {
        const { node, endpoint } = this;
        if (!node) return;
        const zone = info.zones.find(entry => entry.zoneId === zoneId);
        const confirmed = await showPromptDialog({
            title: "Remove trigger",
            text: `Remove the trigger of "${zone ? zoneLabel(zone) : `Zone ${zoneId}`}" (ZoneID ${zoneId})?`,
            confirmText: "Remove",
        });
        if (!confirmed || !this.isSameContext(node, endpoint)) return;
        await this._run("Remove trigger failed", (node, endpoint) =>
            removeTrigger(this.client, node.node_id, endpoint, zoneId),
        );
    }

    private _setZoneField(field: keyof ZoneForm, e: Event) {
        const value = fieldValue(e);
        if (value !== undefined) this._zoneForm = { ...this._zoneForm, [field]: value };
    }

    private _setTriggerField(field: keyof TriggerForm, e: Event) {
        const value = fieldValue(e);
        if (value !== undefined) this._triggerForm = { ...this._triggerForm, [field]: value };
    }

    override render() {
        if (!this.node || this.cluster !== ZONE_MANAGEMENT_CLUSTER_ID) return nothing;
        const info = zoneManagementInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;
        const online = this.node.available === true;
        const canCreateOrEditZones = info.features.twoDCartesian && info.features.userDefined;

        return html`
            <details class="command-panel" open>
                <summary>Zone Management</summary>
                <div class="command-content">
                    ${this._renderStaticInfo(info)}
                    ${this._renderZones(info, online, canCreateOrEditZones, zoneCapacityReached(info))}
                    ${this._renderTriggers(info, online)}
                </div>
            </details>
        `;
    }

    private _renderStaticInfo(info: ZoneManagementInfo): TemplateResult | typeof nothing {
        const rows = new Array<[string, string]>();
        if (info.maxZones !== undefined) rows.push(["Max zones", String(info.maxZones)]);
        if (info.maxUserDefinedZones !== undefined) {
            rows.push(["Max user-defined zones", String(info.maxUserDefinedZones)]);
        }
        if (info.sensitivityMax !== undefined) rows.push(["Sensitivity levels", String(info.sensitivityMax)]);
        if (info.sensitivity !== undefined) rows.push(["Sensitivity", String(info.sensitivity)]);
        if (info.twoDCartesianMax !== undefined) {
            rows.push(["TwoD Cartesian max", `${info.twoDCartesianMax.x}, ${info.twoDCartesianMax.y}`]);
        }
        if (rows.length === 0) return nothing;
        return html`
            <div class="static-info">
                ${rows.map(
                    ([label, value]) => html`
                        <div class="static-info-row">
                            <span class="muted">${label}:</span>
                            <span>${value}</span>
                        </div>
                    `,
                )}
            </div>
        `;
    }

    private _renderZones(
        info: ZoneManagementInfo,
        online: boolean,
        canCreateOrEditZones: boolean,
        atZoneCapacity: boolean,
    ): TemplateResult {
        return html`
            <div class="section">
                <div class="section-header">Zones (${info.zones.length})</div>
                ${
                    info.zones.length === 0
                        ? html`<p class="empty">No zones defined.</p>`
                        : html`
                              <table class="zm-table">
                                  <thead>
                                      <tr>
                                          <th>ID</th>
                                          <th>Name</th>
                                          <th>Use</th>
                                          <th>Source</th>
                                          <th>Vertices</th>
                                          <th>Color</th>
                                          <th></th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      ${info.zones.map(zone =>
                                          this._renderZoneRow(
                                              zone,
                                              online,
                                              canCreateOrEditZones,
                                              info.triggers.some(trigger => trigger.zoneId === zone.zoneId),
                                          ),
                                      )}
                                  </tbody>
                              </table>
                          `
                }
                ${
                    canCreateOrEditZones
                        ? this._zoneTarget !== undefined
                            ? this._renderZoneForm(info, online, this._zoneTarget)
                            : html`<md-outlined-button
                                  ?disabled=${this._busy || !online || atZoneCapacity}
                                  title=${atZoneCapacity ? "Zone capacity reached" : ""}
                                  @click=${() => this._startCreateZone()}
                              >
                                  <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
                                  Add zone
                              </md-outlined-button>`
                        : nothing
                }
            </div>
        `;
    }

    private _renderZoneRow(
        zone: ZoneInfo,
        online: boolean,
        canCreateOrEditZones: boolean,
        hasTrigger: boolean,
    ): TemplateResult {
        const zoneData = zone.twoDCartesianZone;
        const isUserZone = zone.zoneSource === ZoneSource.User;
        const swatch = zoneSwatchColor(zoneData?.color);
        return html`
            <tr>
                <td>${zone.zoneId}</td>
                <td>${zoneData?.name || "—"}</td>
                <td>${zoneData ? (ZONE_USE_LABELS[zoneData.use] ?? zoneData.use) : "—"}</td>
                <td>${ZONE_SOURCE_LABELS[zone.zoneSource] ?? zone.zoneSource}</td>
                <td>${zoneData ? zoneData.vertices.length : "—"}</td>
                <td>
                    ${
                        swatch !== undefined
                            ? html`<span
                                  class="swatch"
                                  style="background:${swatch}"
                                  title=${zoneData?.color ?? ""}
                              ></span>`
                            : (zoneData?.color ?? "—")
                    }
                </td>
                <td class="row-actions">
                    ${
                        isUserZone && canCreateOrEditZones
                            ? html`<md-outlined-icon-button
                                  title="Edit zone"
                                  aria-label="Edit zone"
                                  ?disabled=${this._busy || !online}
                                  @click=${() => this._startEditZone(zone)}
                              >
                                  <ha-svg-icon .path=${mdiPencilOutline}></ha-svg-icon>
                              </md-outlined-icon-button>`
                            : nothing
                    }
                    ${
                        isUserZone
                            ? html`<md-outlined-icon-button
                                  title="Remove zone"
                                  aria-label="Remove zone"
                                  ?disabled=${this._busy || !online}
                                  @click=${handleAsync(() => this._removeZone(zone, hasTrigger))}
                              >
                                  <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                              </md-outlined-icon-button>`
                            : nothing
                    }
                </td>
            </tr>
        `;
    }

    private _renderZoneForm(info: ZoneManagementInfo, online: boolean, target: ZoneEditTarget): TemplateResult {
        const { error } = parseZoneForm(this._zoneForm, info, target.create);

        return html`
            <div class="zone-form">
                <div class="zone-form-header">${target.create ? "New zone" : `Edit zone ${target.zoneId}`}</div>
                <md-outlined-text-field
                    label="Name"
                    .value=${this._zoneForm.name}
                    @input=${(e: Event) => this._setZoneField("name", e)}
                ></md-outlined-text-field>
                <md-outlined-select
                    label="Use"
                    .value=${this._zoneForm.use}
                    @change=${(e: Event) => this._setZoneField("use", e)}
                >
                    ${Object.entries(ZONE_USE_LABELS)
                        .filter(([id]) => Number(id) !== ZoneUse.Focus || info.features.focusZones)
                        .map(
                            ([id, label]) => html`
                                <md-select-option value=${id}>
                                    <div slot="headline">${label}</div>
                                </md-select-option>
                            `,
                        )}
                </md-outlined-select>
                <md-outlined-text-field
                    type="textarea"
                    rows="4"
                    label="Vertices (one 'x,y' pair per line, 3 to 12)"
                    .value=${this._zoneForm.vertices}
                    @input=${(e: Event) => this._setZoneField("vertices", e)}
                ></md-outlined-text-field>
                <md-outlined-text-field
                    label="Color (optional, e.g. #00FFFF)"
                    .value=${this._zoneForm.color}
                    @input=${(e: Event) => this._setZoneField("color", e)}
                ></md-outlined-text-field>
                ${error !== undefined ? html`<div class="form-error">${error}</div>` : nothing}
                <div class="zone-form-actions">
                    <md-filled-button
                        ?disabled=${this._busy || !online || error !== undefined}
                        @click=${handleAsync(() => this._submitZoneForm(info))}
                    >
                        ${target.create ? "Create" : "Update"}
                    </md-filled-button>
                    <md-outlined-button ?disabled=${this._busy} @click=${() => this._cancelZoneForm()}>
                        Cancel
                    </md-outlined-button>
                </div>
            </div>
        `;
    }

    private _renderTriggers(info: ZoneManagementInfo, online: boolean): TemplateResult {
        return html`
            <div class="section">
                <div class="section-header">Triggers (${info.triggers.length})</div>
                ${
                    info.triggers.length === 0
                        ? html`<p class="empty">No triggers defined.</p>`
                        : html`
                              <table class="zm-table">
                                  <thead>
                                      <tr>
                                          <th>Zone</th>
                                          <th>Initial</th>
                                          <th>Augmentation</th>
                                          <th>Max</th>
                                          <th>Blind</th>
                                          ${info.features.perZoneSensitivity ? html`<th>Sensitivity</th>` : nothing}
                                          <th></th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      ${info.triggers.map(trigger => this._renderTriggerRow(info, trigger, online))}
                                  </tbody>
                              </table>
                          `
                }
                ${this._renderTriggerForm(info, online)}
            </div>
        `;
    }

    private _renderTriggerRow(info: ZoneManagementInfo, trigger: TriggerInfo, online: boolean): TemplateResult {
        const zone = info.zones.find(z => z.zoneId === trigger.zoneId);
        return html`
            <tr>
                <td>${zone ? zoneLabel(zone) : `Zone ${trigger.zoneId}`}</td>
                <td>${trigger.initialDuration}s</td>
                <td>${trigger.augmentationDuration}s</td>
                <td>${trigger.maxDuration}s</td>
                <td>${trigger.blindDuration}s</td>
                ${info.features.perZoneSensitivity ? html`<td>${trigger.sensitivity ?? "—"}</td>` : nothing}
                <td class="row-actions">
                    <md-outlined-icon-button
                        title="Edit trigger"
                        aria-label="Edit trigger"
                        ?disabled=${this._busy || !online}
                        @click=${() => this._startEditTrigger(trigger)}
                    >
                        <ha-svg-icon .path=${mdiPencilOutline}></ha-svg-icon>
                    </md-outlined-icon-button>
                    <md-outlined-icon-button
                        title="Remove trigger"
                        aria-label="Remove trigger"
                        ?disabled=${this._busy || !online}
                        @click=${handleAsync(() => this._removeTriggerFor(info, trigger.zoneId))}
                    >
                        <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                    </md-outlined-icon-button>
                </td>
            </tr>
        `;
    }

    private _renderTriggerForm(info: ZoneManagementInfo, online: boolean): TemplateResult {
        const { error } = parseTriggerForm(this._triggerForm, info);
        const field = (key: keyof TriggerForm, label: string, min: number) => html`
            <md-outlined-text-field
                type="number"
                label=${label}
                min=${min}
                .value=${this._triggerForm[key]}
                @input=${(e: Event) => this._setTriggerField(key, e)}
            ></md-outlined-text-field>
        `;

        return html`
            <div class="zone-form">
                <div class="zone-form-header">Create or update trigger</div>
                <md-outlined-select
                    label="Zone"
                    .value=${this._triggerForm.zoneId}
                    @change=${(e: Event) => this._setTriggerField("zoneId", e)}
                >
                    ${info.zones
                        .filter(
                            zone =>
                                zone.twoDCartesianZone === undefined ||
                                zone.twoDCartesianZone.use === ZoneUse.Motion ||
                                String(zone.zoneId) === this._triggerForm.zoneId,
                        )
                        .map(
                            zone => html`
                                <md-select-option value=${String(zone.zoneId)}>
                                    <div slot="headline">${zoneLabel(zone)} (${zone.zoneId})</div>
                                </md-select-option>
                            `,
                        )}
                </md-outlined-select>
                ${field("initialDuration", "Initial duration (s)", 1)}
                ${field("augmentationDuration", "Augmentation duration (s)", 0)}
                ${field("maxDuration", "Max duration (s)", 1)} ${field("blindDuration", "Blind duration (s)", 0)}
                ${
                    info.features.perZoneSensitivity
                        ? html`<md-outlined-text-field
                              type="number"
                              label="Sensitivity"
                              min="1"
                              max=${info.sensitivityMax ?? nothing}
                              .value=${this._triggerForm.sensitivity}
                              @input=${(e: Event) => this._setTriggerField("sensitivity", e)}
                          ></md-outlined-text-field>`
                        : nothing
                }
                ${
                    error !== undefined && this._triggerForm.zoneId !== ""
                        ? html`<div class="form-error">${error}</div>`
                        : nothing
                }
                <div class="zone-form-actions">
                    <md-filled-button
                        ?disabled=${this._busy || !online || error !== undefined}
                        @click=${handleAsync(() => this._submitTrigger(info))}
                    >
                        Create / Update
                    </md-filled-button>
                    <md-outlined-button
                        ?disabled=${this._busy}
                        @click=${() => {
                            this._triggerForm = EMPTY_TRIGGER_FORM;
                        }}
                    >
                        Clear
                    </md-outlined-button>
                </div>
            </div>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .muted {
                color: var(--md-sys-color-on-surface-variant);
            }
            .empty {
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.9rem;
                margin: 0 0 8px 0;
            }
            .static-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                padding-bottom: 12px;
                margin-bottom: 12px;
            }
            .static-info-row {
                display: flex;
                gap: 6px;
            }
            .section {
                margin-bottom: 16px;
            }
            .section-header {
                font-weight: 500;
                margin-bottom: 8px;
            }
            .zm-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
            }
            .zm-table th {
                text-align: left;
                font-size: 11px;
                text-transform: uppercase;
                opacity: 0.6;
                padding: 8px 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
            }
            .zm-table td {
                padding: 8px 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                vertical-align: middle;
            }
            .row-actions {
                display: flex;
                gap: 4px;
                justify-content: flex-end;
            }
            .swatch {
                display: inline-block;
                width: 16px;
                height: 16px;
                border-radius: 4px;
                border: 1px solid var(--md-sys-color-outline-variant);
                vertical-align: middle;
            }
            .zone-form {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 12px;
                background: var(--md-sys-color-surface-container-highest);
                border-radius: 8px;
                max-width: 420px;
            }
            .zone-form-header {
                font-weight: 500;
            }
            .form-error {
                color: var(--danger-color);
                font-size: 0.85rem;
            }
            .zone-form-actions {
                display: flex;
                gap: 8px;
            }
        `,
    ];
}

registerClusterCommands(ZONE_MANAGEMENT_CLUSTER_ID, "zone-management-cluster-commands", { renderWhenOffline: true });

declare global {
    interface HTMLElementTagNameMap {
        "zone-management-cluster-commands": ZoneManagementClusterCommands;
    }
}
