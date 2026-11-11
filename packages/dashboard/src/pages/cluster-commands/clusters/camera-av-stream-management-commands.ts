/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdOutlinedSelect } from "@material/web/select/outlined-select.js";
import "@material/web/select/select-option";
import { MdSwitch } from "@material/web/switch/switch.js";
import type { MatterNode } from "@matter-server/ws-client";
import {
    mdiCctv,
    mdiEyeOff,
    mdiHdr,
    mdiLightbulbOff,
    mdiLightbulbOn,
    mdiMicrophone,
    mdiMicrophoneOff,
    mdiShieldLock,
    mdiVolumeHigh,
    mdiVolumeOff,
    mdiWeatherNight,
} from "@mdi/js";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { showAlertDialog } from "../../../components/dialog-box/show-dialog-box.js";
import "../../../components/ha-svg-icon.js";
import {
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    cameraAvStreamManagementInfo,
    cameraSwitches,
    NIGHT_VISION_NAMES,
    switchWriteValue,
    writeCameraSetting,
    type CameraSetting,
    type CameraSettingValues,
    type CameraSwitch,
    type CameraSwitchSetting,
} from "../../../util/camera-av-stream-management.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const SWITCH_ICONS: Record<CameraSwitchSetting, { on: string; off: string }> = {
    microphoneMuted: { on: mdiMicrophone, off: mdiMicrophoneOff },
    speakerMuted: { on: mdiVolumeHigh, off: mdiVolumeOff },
    hdrModeEnabled: { on: mdiHdr, off: mdiHdr },
    statusLightEnabled: { on: mdiLightbulbOn, off: mdiLightbulbOff },
    softRecordingPrivacyModeEnabled: { on: mdiEyeOff, off: mdiEyeOff },
    softLivestreamPrivacyModeEnabled: { on: mdiEyeOff, off: mdiEyeOff },
};

/**
 * Settings panel for the CameraAvStreamManagement cluster (ID: 0x0551 / 1361) covering the settings that are plain
 * attribute writes. Stream allocation, live view and snapshots belong to the camera overlay (util/camera.ts).
 */
@customElement("camera-av-stream-management-cluster-commands")
export class CameraAvStreamManagementClusterCommands extends BaseClusterCommands {
    /**
     * Re-renders so every control shows the reported value again, then shows the error. `node` and `endpoint` are the
     * values captured when the write started: the cluster view reuses this panel across same-cluster navigation, so a
     * late rejection must not show its dialog on another camera's panel.
     */
    private _reportWriteFailure(err: Error, node: MatterNode, endpoint: number) {
        this.requestUpdate();
        if (!this.isSameContext(node, endpoint)) {
            console.error("Camera write failed (panel moved on)", err);
            return;
        }
        showAlertDialog({ title: "Camera write failed", text: err.message }).catch(dialogErr =>
            console.error("Failed to show the camera write error", dialogErr),
        );
    }

    private _write<K extends CameraSetting>(setting: K, value: CameraSettingValues[K]) {
        const { node, endpoint, client } = this;
        if (!node) return;
        writeCameraSetting(client, node.node_id, endpoint, setting, value).catch((err: Error) =>
            this._reportWriteFailure(err, node, endpoint),
        );
    }

    private _renderSwitch(cameraSwitch: CameraSwitch) {
        const icons = SWITCH_ICONS[cameraSwitch.setting];
        return html`
            <label class="toggle-row">
                <ha-svg-icon .path=${cameraSwitch.on === true ? icons.on : icons.off}></ha-svg-icon>
                <span>${cameraSwitch.label}</span>
                <md-switch
                    .selected=${live(cameraSwitch.on === true)}
                    ?disabled=${cameraSwitch.on === undefined}
                    @change=${(e: Event) => {
                        if (e.target instanceof MdSwitch) {
                            this._write(cameraSwitch.setting, switchWriteValue(cameraSwitch, e.target.selected));
                        }
                    }}
                ></md-switch>
            </label>
        `;
    }

    private _renderNightVision(nightVision: number | undefined) {
        return html`
            <div class="night-vision-row">
                <ha-svg-icon .path=${mdiWeatherNight}></ha-svg-icon>
                <span>Night vision</span>
                ${
                    nightVision === undefined
                        ? html`<span class="meta-inline">Unknown</span>`
                        : html`
                              <md-outlined-select
                                  aria-label="Night vision"
                                  .value=${live(String(nightVision))}
                                  @change=${(e: Event) => {
                                      if (e.target instanceof MdOutlinedSelect) {
                                          this._write("nightVision", Number(e.target.value));
                                      }
                                  }}
                              >
                                  ${Object.entries(NIGHT_VISION_NAMES).map(
                                      ([value, label]) => html`
                                          <md-select-option value=${value}>
                                              <div slot="headline">${label}</div>
                                          </md-select-option>
                                      `,
                                  )}
                              </md-outlined-select>
                          `
                }
            </div>
        `;
    }

    override render() {
        if (!this.node || this.cluster !== CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID) return nothing;
        const info = cameraAvStreamManagementInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;
        const switches = cameraSwitches(info);
        const generalSwitches = switches.filter(entry => entry.section === "general");
        const privacySwitches = switches.filter(entry => entry.section === "privacy");

        const streamCounts = [
            info.allocatedStreams.video !== undefined ? `${info.allocatedStreams.video} video` : undefined,
            info.allocatedStreams.audio !== undefined ? `${info.allocatedStreams.audio} audio` : undefined,
            info.allocatedStreams.snapshot !== undefined ? `${info.allocatedStreams.snapshot} snapshot` : undefined,
        ].filter(entry => entry !== undefined);

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${mdiCctv}></ha-svg-icon>
                    Camera AV Stream Management
                </summary>
                <div class="command-content">
                    ${
                        generalSwitches.length > 0
                            ? html`<div class="toggle-grid">
                                  ${generalSwitches.map(entry => this._renderSwitch(entry))}
                              </div>`
                            : nothing
                    }
                    ${info.features.nightVision ? this._renderNightVision(info.nightVision) : nothing}
                    ${
                        info.hardPrivacyModeOn !== undefined || privacySwitches.length > 0
                            ? html`
                                  <div class="privacy-section">
                                      ${
                                          info.hardPrivacyModeOn !== undefined
                                              ? html`
                                                    <div class="hard-privacy-row">
                                                        <ha-svg-icon .path=${mdiShieldLock}></ha-svg-icon>
                                                        <span>Hard privacy (physical switch)</span>
                                                        <span
                                                            class="state-chip ${info.hardPrivacyModeOn ? "active" : ""}"
                                                        >
                                                            ${info.hardPrivacyModeOn ? "On" : "Off"}
                                                        </span>
                                                    </div>
                                                `
                                              : nothing
                                      }
                                      ${
                                          privacySwitches.length > 0
                                              ? html`<div class="toggle-grid">
                                                    ${privacySwitches.map(entry => this._renderSwitch(entry))}
                                                </div>`
                                              : nothing
                                      }
                                  </div>
                              `
                            : nothing
                    }
                    ${
                        streamCounts.length > 0
                            ? html`<div class="meta">Allocated streams: ${streamCounts.join(" · ")}</div>`
                            : nothing
                    }
                </div>
            </details>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .toggle-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px 20px;
            }

            .toggle-row {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }

            .night-vision-row,
            .hard-privacy-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 12px;
            }

            .privacy-section {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
            }

            .privacy-section .toggle-grid {
                margin-top: 12px;
            }

            .state-chip {
                padding: 2px 10px;
                border-radius: 8px;
                font-weight: 500;
                background: var(--md-sys-color-surface-container-highest);
                color: var(--md-sys-color-on-surface);
            }

            .state-chip.active {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }

            .meta-inline {
                color: var(--md-sys-color-on-surface-variant);
            }

            .meta {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
                font-size: 0.85rem;
                color: var(--md-sys-color-on-surface-variant);
            }
        `,
    ];
}

registerClusterCommands(CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID, "camera-av-stream-management-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "camera-av-stream-management-cluster-commands": CameraAvStreamManagementClusterCommands;
    }
}
