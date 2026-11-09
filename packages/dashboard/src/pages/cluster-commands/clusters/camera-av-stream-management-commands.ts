/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import "@material/web/switch/switch";
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
import { showAlertDialog } from "../../../components/dialog-box/show-dialog-box.js";
import "../../../components/ha-svg-icon.js";
import { handleAsyncEvent } from "../../../util/async-handler.js";
import {
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    hasHighDynamicRangeFeature,
    hasNightVisionFeature,
    hasPrivacyFeature,
    hasSnapshotFeature,
    hasSpeakerFeature,
    hasAudioFeature,
    hasVideoFeature,
    NIGHT_VISION_LABELS,
    readAllocatedAudioStreamCount,
    readAllocatedSnapshotStreamCount,
    readAllocatedVideoStreamCount,
    readHardPrivacyModeOn,
    readHdrModeEnabled,
    readMicrophoneMuted,
    readNightVision,
    readSoftLivestreamPrivacyModeEnabled,
    readSoftRecordingPrivacyModeEnabled,
    readSpeakerMuted,
    readStatusLightEnabled,
    setHdrModeEnabled,
    setMicrophoneMuted,
    setNightVision,
    setSoftLivestreamPrivacyModeEnabled,
    setSoftRecordingPrivacyModeEnabled,
    setSpeakerMuted,
    setStatusLightEnabled,
} from "../../../util/camera-av-stream-management.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Status panel for the CameraAvStreamManagement cluster (ID: 0x0551 / 1361).
 * Surfaces the mute/privacy/image settings that are plain attribute writes; stream allocation and
 * live view/snapshot capture are handled by the dedicated camera overlay (see util/camera.ts).
 */
@customElement("camera-av-stream-management-cluster-commands")
class CameraAvStreamManagementClusterCommands extends BaseClusterCommands {
    private _reportWriteFailure(err: Error) {
        this.requestUpdate();
        showAlertDialog({ title: "Camera write failed", text: err.message }).catch(dialogErr =>
            console.error("Failed to show the camera write error", dialogErr),
        );
    }

    private _renderSwitch(args: {
        label: string;
        iconOn: string;
        iconOff: string;
        on: boolean | null;
        onToggle: (next: boolean) => Promise<void>;
    }) {
        const { label, iconOn, iconOff, on, onToggle } = args;
        return html`
            <label class="toggle-row">
                <ha-svg-icon .path=${on === true ? iconOn : iconOff}></ha-svg-icon>
                <span>${label}</span>
                <md-switch
                    ?selected=${on === true}
                    @change=${handleAsyncEvent(
                        (e: Event) => onToggle((e.target as HTMLElement & { selected: boolean }).selected),
                        err => this._reportWriteFailure(err),
                    )}
                ></md-switch>
            </label>
        `;
    }

    override render() {
        if (!this.node || this.cluster !== CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID) return nothing;
        const { node, endpoint, client } = this;

        const micMuted = readMicrophoneMuted(node, endpoint);
        const speakerMuted = readSpeakerMuted(node, endpoint);
        const hdrEnabled = readHdrModeEnabled(node, endpoint);
        const statusLightEnabled = readStatusLightEnabled(node, endpoint);
        const hardPrivacy = readHardPrivacyModeOn(node, endpoint);
        const recordingPrivacy = readSoftRecordingPrivacyModeEnabled(node, endpoint);
        const livestreamPrivacy = readSoftLivestreamPrivacyModeEnabled(node, endpoint);
        const nightVision = readNightVision(node, endpoint);

        const videoStreams = hasVideoFeature(node, endpoint) ? readAllocatedVideoStreamCount(node, endpoint) : null;
        const audioStreams = hasAudioFeature(node, endpoint) ? readAllocatedAudioStreamCount(node, endpoint) : null;
        const snapshotStreams = hasSnapshotFeature(node, endpoint)
            ? readAllocatedSnapshotStreamCount(node, endpoint)
            : null;
        const streamCounts = [
            videoStreams !== null ? `${videoStreams} video` : null,
            audioStreams !== null ? `${audioStreams} audio` : null,
            snapshotStreams !== null ? `${snapshotStreams} snapshot` : null,
        ].filter((entry): entry is string => entry !== null);

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${mdiCctv}></ha-svg-icon>
                    Camera AV Stream Management
                </summary>
                <div class="command-content">
                    <div class="toggle-grid">
                        ${
                            hasAudioFeature(node, endpoint)
                                ? this._renderSwitch({
                                      label: "Microphone",
                                      iconOn: mdiMicrophone,
                                      iconOff: mdiMicrophoneOff,
                                      on: micMuted === null ? null : !micMuted,
                                      onToggle: next => setMicrophoneMuted(client, node.node_id, endpoint, !next),
                                  })
                                : nothing
                        }
                        ${
                            hasSpeakerFeature(node, endpoint)
                                ? this._renderSwitch({
                                      label: "Speaker",
                                      iconOn: mdiVolumeHigh,
                                      iconOff: mdiVolumeOff,
                                      on: speakerMuted === null ? null : !speakerMuted,
                                      onToggle: next => setSpeakerMuted(client, node.node_id, endpoint, !next),
                                  })
                                : nothing
                        }
                        ${
                            hasHighDynamicRangeFeature(node, endpoint)
                                ? this._renderSwitch({
                                      label: "HDR",
                                      iconOn: mdiHdr,
                                      iconOff: mdiHdr,
                                      on: hdrEnabled,
                                      onToggle: next => setHdrModeEnabled(client, node.node_id, endpoint, next),
                                  })
                                : nothing
                        }
                        ${
                            statusLightEnabled !== null
                                ? this._renderSwitch({
                                      label: "Status light",
                                      iconOn: mdiLightbulbOn,
                                      iconOff: mdiLightbulbOff,
                                      on: statusLightEnabled,
                                      onToggle: next => setStatusLightEnabled(client, node.node_id, endpoint, next),
                                  })
                                : nothing
                        }
                    </div>

                    ${
                        hasNightVisionFeature(node, endpoint)
                            ? html`
                                  <div class="night-vision-row">
                                      <ha-svg-icon .path=${mdiWeatherNight}></ha-svg-icon>
                                      <span>Night vision</span>
                                      <md-outlined-select
                                          aria-label="Night vision"
                                          .value=${nightVision !== null ? String(nightVision) : ""}
                                          @change=${handleAsyncEvent(
                                              (e: Event) =>
                                                  setNightVision(
                                                      client,
                                                      node.node_id,
                                                      endpoint,
                                                      Number((e.target as HTMLSelectElement).value),
                                                  ),
                                              err => this._reportWriteFailure(err),
                                          )}
                                      >
                                          ${Object.entries(NIGHT_VISION_LABELS).map(
                                              ([value, label]) => html`
                                                  <md-select-option value=${value}>
                                                      <div slot="headline">${label}</div>
                                                  </md-select-option>
                                              `,
                                          )}
                                      </md-outlined-select>
                                  </div>
                              `
                            : nothing
                    }
                    ${
                        hardPrivacy !== null || hasPrivacyFeature(node, endpoint)
                            ? html`
                                  <div class="privacy-section">
                                      ${
                                          hardPrivacy !== null
                                              ? html`
                                                    <div class="hard-privacy-row">
                                                        <ha-svg-icon .path=${mdiShieldLock}></ha-svg-icon>
                                                        <span>Hard privacy (physical switch)</span>
                                                        <span class="state-chip ${hardPrivacy ? "active" : ""}">
                                                            ${hardPrivacy ? "On" : "Off"}
                                                        </span>
                                                    </div>
                                                `
                                              : nothing
                                      }
                                      ${
                                          hasPrivacyFeature(node, endpoint)
                                              ? html`
                                                    <div class="toggle-grid">
                                                        ${this._renderSwitch({
                                                            label: "Recording privacy",
                                                            iconOn: mdiEyeOff,
                                                            iconOff: mdiEyeOff,
                                                            on: recordingPrivacy,
                                                            onToggle: next =>
                                                                setSoftRecordingPrivacyModeEnabled(
                                                                    client,
                                                                    node.node_id,
                                                                    endpoint,
                                                                    next,
                                                                ),
                                                        })}
                                                        ${this._renderSwitch({
                                                            label: "Live view privacy",
                                                            iconOn: mdiEyeOff,
                                                            iconOff: mdiEyeOff,
                                                            on: livestreamPrivacy,
                                                            onToggle: next =>
                                                                setSoftLivestreamPrivacyModeEnabled(
                                                                    client,
                                                                    node.node_id,
                                                                    endpoint,
                                                                    next,
                                                                ),
                                                        })}
                                                    </div>
                                                `
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
