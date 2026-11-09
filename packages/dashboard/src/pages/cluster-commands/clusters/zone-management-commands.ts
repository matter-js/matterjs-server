/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/iconbutton/outlined-icon-button";
import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import "@material/web/textfield/outlined-text-field";
import { mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import {
    createOrUpdateTrigger,
    createTwoDCartesianZone,
    formatVertices,
    parseDurationSeconds,
    parseVertices,
    parseZoneColor,
    removeTrigger,
    removeZone,
    updateTwoDCartesianZone,
    zoneLabel,
    zoneManagementInfo,
    ZONE_MANAGEMENT_CLUSTER_ID,
    ZONE_SOURCE_LABELS,
    ZONE_USE_LABELS,
    ZoneSource,
    type TriggerInfo,
    type ZoneInfo,
    type ZoneManagementInfo,
} from "../../../util/zone-management.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = ZONE_MANAGEMENT_CLUSTER_ID;

@customElement("zone-management-cluster-commands")
class ZoneManagementClusterCommands extends BaseClusterCommands {
    @state() private _busy = false;
    @state() private _editingZoneId: number | null = null;
    @state() private _zoneName = "";
    @state() private _zoneUse = "0";
    @state() private _zoneVertices = "";
    @state() private _zoneColor = "";
    @state() private _triggerZoneId = "";
    @state() private _triggerInitial = "";
    @state() private _triggerAugmentation = "";
    @state() private _triggerMax = "";
    @state() private _triggerBlind = "";
    @state() private _triggerSensitivity = "";
    private _formContext?: string;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._busy = false;
            this._cancelZoneForm();
            this._resetTriggerForm();
        }
        this._formContext = context;
    }

    private _failureReporter(title: string) {
        const node = this.node;
        const endpoint = this.endpoint;
        return (err: Error) => {
            if (!this.isSameContext(node, endpoint)) {
                console.error(`${title} (panel moved on)`, err);
                return;
            }
            showAlertDialog({ title, text: errorText(err) }).catch(dialogErr =>
                console.error("Failed to show the ZoneManagement command error", dialogErr),
            );
        };
    }

    private _startCreateZone() {
        this._editingZoneId = -1;
        this._zoneName = "";
        this._zoneUse = "0";
        this._zoneVertices = "";
        this._zoneColor = "";
    }

    private _startEditZone(zone: ZoneInfo) {
        this._editingZoneId = zone.zoneId;
        this._zoneName = zone.twoDCartesianZone?.name ?? "";
        this._zoneUse = String(zone.twoDCartesianZone?.use ?? 0);
        this._zoneVertices = formatVertices(zone.twoDCartesianZone?.vertices ?? []);
        this._zoneColor = zone.twoDCartesianZone?.color ?? "";
    }

    private _cancelZoneForm() {
        this._editingZoneId = null;
        this._zoneName = "";
        this._zoneUse = "0";
        this._zoneVertices = "";
        this._zoneColor = "";
    }

    private async _submitZoneForm() {
        const node = this.node;
        const endpoint = this.endpoint;
        const vertices = parseVertices(this._zoneVertices);
        const color = parseZoneColor(this._zoneColor);
        if (vertices === null || color === null || this._editingZoneId === null) return;
        const zone = { name: this._zoneName.trim(), use: Number(this._zoneUse), vertices, color };

        this._busy = true;
        try {
            if (this._editingZoneId === -1) {
                await createTwoDCartesianZone(this.client, node.node_id, endpoint, zone);
            } else {
                await updateTwoDCartesianZone(this.client, node.node_id, endpoint, this._editingZoneId, zone);
            }
            if (this.isSameContext(node, endpoint)) this._cancelZoneForm();
        } catch (err) {
            this._failureReporter(this._editingZoneId === -1 ? "Create zone failed" : "Update zone failed")(
                err as Error,
            );
        } finally {
            if (this.isSameContext(node, endpoint)) this._busy = false;
        }
    }

    private async _removeZone(zone: ZoneInfo) {
        const node = this.node;
        const endpoint = this.endpoint;
        const confirmed = await showPromptDialog({
            title: "Remove zone",
            text: `Remove "${zoneLabel(zone)}" (ZoneID ${zone.zoneId})? Any trigger defined for it will stop applying.`,
            confirmText: "Remove",
        });
        if (!confirmed || !this.isSameContext(node, endpoint)) return;
        this._busy = true;
        try {
            await removeZone(this.client, node.node_id, endpoint, zone.zoneId);
        } catch (err) {
            this._failureReporter("Remove zone failed")(err as Error);
        } finally {
            if (this.isSameContext(node, endpoint)) this._busy = false;
        }
    }

    private _resetTriggerForm(defaultZoneId?: number) {
        this._triggerZoneId = defaultZoneId !== undefined ? String(defaultZoneId) : "";
        this._triggerInitial = "";
        this._triggerAugmentation = "";
        this._triggerMax = "";
        this._triggerBlind = "";
        this._triggerSensitivity = "";
    }

    private _startEditTrigger(trigger: TriggerInfo) {
        this._triggerZoneId = String(trigger.zoneId);
        this._triggerInitial = String(trigger.initialDuration);
        this._triggerAugmentation = String(trigger.augmentationDuration);
        this._triggerMax = String(trigger.maxDuration);
        this._triggerBlind = String(trigger.blindDuration);
        this._triggerSensitivity = trigger.sensitivity !== undefined ? String(trigger.sensitivity) : "";
    }

    private async _submitTrigger(perZoneSensitivity: boolean) {
        const node = this.node;
        const endpoint = this.endpoint;
        const zoneId = Number(this._triggerZoneId);
        const initialDuration = parseDurationSeconds(this._triggerInitial);
        const augmentationDuration = parseDurationSeconds(this._triggerAugmentation);
        const maxDuration = parseDurationSeconds(this._triggerMax);
        const blindDuration = parseDurationSeconds(this._triggerBlind);
        if (
            this._triggerZoneId === "" ||
            initialDuration === null ||
            augmentationDuration === null ||
            maxDuration === null ||
            blindDuration === null
        ) {
            return;
        }
        const sensitivity =
            perZoneSensitivity && this._triggerSensitivity.trim() !== ""
                ? parseDurationSeconds(this._triggerSensitivity)
                : undefined;
        if (perZoneSensitivity && this._triggerSensitivity.trim() !== "" && sensitivity === null) return;

        this._busy = true;
        try {
            await createOrUpdateTrigger(this.client, node.node_id, endpoint, {
                zoneId,
                initialDuration,
                augmentationDuration,
                maxDuration,
                blindDuration,
                sensitivity: sensitivity ?? undefined,
            });
            if (this.isSameContext(node, endpoint)) this._resetTriggerForm();
        } catch (err) {
            this._failureReporter("Create/update trigger failed")(err as Error);
        } finally {
            if (this.isSameContext(node, endpoint)) this._busy = false;
        }
    }

    private async _removeTriggerFor(zoneId: number) {
        const node = this.node;
        const endpoint = this.endpoint;
        this._busy = true;
        try {
            await removeTrigger(this.client, node.node_id, endpoint, zoneId);
        } catch (err) {
            this._failureReporter("Remove trigger failed")(err as Error);
        } finally {
            if (this.isSameContext(node, endpoint)) this._busy = false;
        }
    }

    override render() {
        if (!this.node || this.cluster !== CLUSTER_ID) return nothing;
        const info = zoneManagementInfo(this.node.attributes, this.endpoint);
        const online = this.node.available === true;
        const canCreateOrEditZones = info.features.twoDCartesian && info.features.userDefined;
        const atZoneCapacity = info.maxZones !== undefined && info.zones.length >= info.maxZones;

        return html`
            <details class="command-panel" open>
                <summary>Zone Management</summary>
                <div class="command-content">
                    ${this._renderStaticInfo(info)}
                    ${this._renderZones(info, online, canCreateOrEditZones, atZoneCapacity)}
                    ${this._renderTriggers(info, online)}
                </div>
            </details>
        `;
    }

    private _renderStaticInfo(info: ZoneManagementInfo): TemplateResult {
        const rows: Array<[string, string]> = [];
        if (info.maxZones !== undefined) rows.push(["Max zones", String(info.maxZones)]);
        if (info.maxUserDefinedZones !== undefined) {
            rows.push(["Max user-defined zones", String(info.maxUserDefinedZones)]);
        }
        if (info.sensitivityMax !== undefined) rows.push(["Sensitivity levels", String(info.sensitivityMax)]);
        if (info.sensitivity !== undefined) rows.push(["Sensitivity", String(info.sensitivity)]);
        if (info.twoDCartesianMax !== undefined) {
            rows.push(["TwoD Cartesian max", `${info.twoDCartesianMax.x}, ${info.twoDCartesianMax.y}`]);
        }
        if (rows.length === 0) return html``;
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
                                      ${info.zones.map(zone => this._renderZoneRow(zone, online, canCreateOrEditZones))}
                                  </tbody>
                              </table>
                          `
                }
                ${
                    canCreateOrEditZones
                        ? this._editingZoneId !== null
                            ? this._renderZoneForm(online)
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

    private _renderZoneRow(zone: ZoneInfo, online: boolean, canCreateOrEditZones: boolean): TemplateResult {
        const zoneData = zone.twoDCartesianZone;
        const isUserZone = zone.zoneSource === ZoneSource.User;
        return html`
            <tr>
                <td>${zone.zoneId}</td>
                <td>${zoneData?.name || "—"}</td>
                <td>${ZONE_USE_LABELS[zoneData?.use ?? -1] ?? "—"}</td>
                <td>${ZONE_SOURCE_LABELS[zone.zoneSource] ?? zone.zoneSource}</td>
                <td>${zoneData ? zoneData.vertices.length : "—"}</td>
                <td>
                    ${
                        zoneData?.color
                            ? html`<span
                                  class="swatch"
                                  style="background:${zoneData.color.length === 9 ? zoneData.color.slice(0, 7) : zoneData.color}"
                                  title=${zoneData.color}
                              ></span>`
                            : "—"
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
                                  @click=${handleAsync(() => this._removeZone(zone))}
                              >
                                  <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                              </md-outlined-icon-button>`
                            : nothing
                    }
                </td>
            </tr>
        `;
    }

    private _renderZoneForm(online: boolean): TemplateResult {
        const vertices = parseVertices(this._zoneVertices);
        const color = parseZoneColor(this._zoneColor);
        const isValid = this._zoneName.trim() !== "" && vertices !== null && color !== null;
        const creating = this._editingZoneId === -1;

        return html`
            <div class="zone-form">
                <div class="zone-form-header">${creating ? "New zone" : `Edit zone ${this._editingZoneId}`}</div>
                <md-outlined-text-field
                    label="Name"
                    .value=${this._zoneName}
                    @input=${(e: Event) => {
                        this._zoneName = (e.target as HTMLInputElement).value;
                    }}
                ></md-outlined-text-field>
                <md-outlined-select
                    label="Use"
                    .value=${this._zoneUse}
                    @change=${(e: Event) => {
                        this._zoneUse = (e.target as HTMLSelectElement).value;
                    }}
                >
                    ${Object.entries(ZONE_USE_LABELS).map(
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
                    label="Vertices (one 'x,y' pair per line, at least 3)"
                    .value=${this._zoneVertices}
                    @input=${(e: Event) => {
                        this._zoneVertices = (e.target as HTMLTextAreaElement).value;
                    }}
                ></md-outlined-text-field>
                <md-outlined-text-field
                    label="Color (optional, e.g. #00FFFF)"
                    .value=${this._zoneColor}
                    @input=${(e: Event) => {
                        this._zoneColor = (e.target as HTMLInputElement).value;
                    }}
                ></md-outlined-text-field>
                <div class="zone-form-actions">
                    <md-filled-button
                        ?disabled=${this._busy || !online || !isValid}
                        @click=${handleAsync(() => this._submitZoneForm())}
                    >
                        ${creating ? "Create" : "Update"}
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
                        @click=${handleAsync(() => this._removeTriggerFor(trigger.zoneId))}
                    >
                        <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                    </md-outlined-icon-button>
                </td>
            </tr>
        `;
    }

    private _renderTriggerForm(info: ZoneManagementInfo, online: boolean): TemplateResult {
        const initialDuration = parseDurationSeconds(this._triggerInitial);
        const augmentationDuration = parseDurationSeconds(this._triggerAugmentation);
        const maxDuration = parseDurationSeconds(this._triggerMax);
        const blindDuration = parseDurationSeconds(this._triggerBlind);
        const sensitivityText = this._triggerSensitivity.trim();
        const sensitivityValid = sensitivityText === "" || parseDurationSeconds(sensitivityText) !== null;
        const isValid =
            this._triggerZoneId !== "" &&
            initialDuration !== null &&
            augmentationDuration !== null &&
            maxDuration !== null &&
            blindDuration !== null &&
            sensitivityValid;

        return html`
            <div class="zone-form">
                <div class="zone-form-header">Create or update trigger</div>
                <md-outlined-select
                    label="Zone"
                    .value=${this._triggerZoneId}
                    @change=${(e: Event) => {
                        this._triggerZoneId = (e.target as HTMLSelectElement).value;
                    }}
                >
                    ${info.zones
                        .filter(zone => zone.twoDCartesianZone === undefined || zone.twoDCartesianZone.use === 0)
                        .map(
                        zone => html`
                            <md-select-option value=${String(zone.zoneId)}>
                                <div slot="headline">${zoneLabel(zone)} (${zone.zoneId})</div>
                            </md-select-option>
                        `,
                    )}
                </md-outlined-select>
                <md-outlined-text-field
                    type="number"
                    label="Initial duration (s)"
                    min="0"
                    .value=${this._triggerInitial}
                    @input=${(e: Event) => {
                        this._triggerInitial = (e.target as HTMLInputElement).value;
                    }}
                ></md-outlined-text-field>
                <md-outlined-text-field
                    type="number"
                    label="Augmentation duration (s)"
                    min="0"
                    .value=${this._triggerAugmentation}
                    @input=${(e: Event) => {
                        this._triggerAugmentation = (e.target as HTMLInputElement).value;
                    }}
                ></md-outlined-text-field>
                <md-outlined-text-field
                    type="number"
                    label="Max duration (s)"
                    min="0"
                    .value=${this._triggerMax}
                    @input=${(e: Event) => {
                        this._triggerMax = (e.target as HTMLInputElement).value;
                    }}
                ></md-outlined-text-field>
                <md-outlined-text-field
                    type="number"
                    label="Blind duration (s)"
                    min="0"
                    .value=${this._triggerBlind}
                    @input=${(e: Event) => {
                        this._triggerBlind = (e.target as HTMLInputElement).value;
                    }}
                ></md-outlined-text-field>
                ${
                    info.features.perZoneSensitivity
                        ? html`<md-outlined-text-field
                              type="number"
                              label="Sensitivity (optional)"
                              min="0"
                              max=${info.sensitivityMax !== undefined ? info.sensitivityMax : nothing}
                              .value=${this._triggerSensitivity}
                              @input=${(e: Event) => {
                                  this._triggerSensitivity = (e.target as HTMLInputElement).value;
                              }}
                          ></md-outlined-text-field>`
                        : nothing
                }
                <div class="zone-form-actions">
                    <md-filled-button
                        ?disabled=${this._busy || !online || !isValid}
                        @click=${handleAsync(() => this._submitTrigger(info.features.perZoneSensitivity))}
                    >
                        Create / Update
                    </md-filled-button>
                    <md-outlined-button ?disabled=${this._busy} @click=${() => this._resetTriggerForm()}>
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
            .zone-form-actions {
                display: flex;
                gap: 8px;
            }
        `,
    ];
}

registerClusterCommands(CLUSTER_ID, "zone-management-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "zone-management-cluster-commands": ZoneManagementClusterCommands;
    }
}
