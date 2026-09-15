/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import "@material/web/iconbutton/outlined-icon-button";
import {
    mdiFastForward,
    mdiPause,
    mdiPlay,
    mdiRestart,
    mdiRewind,
    mdiSkipBackward,
    mdiSkipForward,
    mdiSkipNext,
    mdiSkipPrevious,
    mdiStop,
} from "@mdi/js";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { showAlertDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsync } from "../../../util/async-handler.js";
import {
    FAST_FORWARD_COMMAND_ID,
    formatDurationMs,
    formatPlaybackState,
    invokeTransportCommand,
    MEDIA_PLAYBACK_CLUSTER_ID,
    NEXT_COMMAND_ID,
    parseSkipMs,
    PAUSE_COMMAND_ID,
    PlaybackState,
    PLAY_COMMAND_ID,
    PREVIOUS_COMMAND_ID,
    readCurrentState,
    readDurationMs,
    readPlaybackSpeed,
    readPositionMs,
    REWIND_COMMAND_ID,
    SKIP_BACKWARD_COMMAND_ID,
    SKIP_FORWARD_COMMAND_ID,
    START_OVER_COMMAND_ID,
    STOP_COMMAND_ID,
    supportsCommand,
} from "../../../util/media-playback.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const DEFAULT_SKIP_MS = "10000";

@customElement("media-playback-cluster-commands")
class MediaPlaybackClusterCommands extends BaseClusterCommands {
    @state() private _skipMs = DEFAULT_SKIP_MS;
    private _formContext?: string;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._skipMs = DEFAULT_SKIP_MS;
        }
        this._formContext = context;
    }

    override render() {
        if (!this.node || this.cluster !== MEDIA_PLAYBACK_CLUSTER_ID) return nothing;

        const playbackState = readCurrentState(this.node, this.endpoint);
        const positionMs = readPositionMs(this.node, this.endpoint);
        const durationMs = readDurationMs(this.node, this.endpoint);
        const speed = readPlaybackSpeed(this.node, this.endpoint);
        const online = this.node.available === true;
        const has = (commandId: number) => supportsCommand(this.node, this.endpoint, commandId);
        const skipMs = parseSkipMs(this._skipMs);
        const anyCommandAdvertised = [
            PREVIOUS_COMMAND_ID,
            REWIND_COMMAND_ID,
            PLAY_COMMAND_ID,
            PAUSE_COMMAND_ID,
            STOP_COMMAND_ID,
            FAST_FORWARD_COMMAND_ID,
            NEXT_COMMAND_ID,
            START_OVER_COMMAND_ID,
            SKIP_BACKWARD_COMMAND_ID,
            SKIP_FORWARD_COMMAND_ID,
        ].some(has);

        return html`
            <details class="command-panel" open>
                <summary>Media Playback Controls</summary>
                <div class="command-content">
                    <div class="readout">
                        <span class="state-chip ${playbackState === PlaybackState.Playing ? "playing" : ""}"
                            >${formatPlaybackState(playbackState)}</span
                        >
                        ${
                            positionMs !== null || durationMs !== null
                                ? html`<span
                                      >${positionMs !== null ? formatDurationMs(positionMs) : "—"}${
                                          durationMs !== null ? html` / ${formatDurationMs(durationMs)}` : nothing
                                      }</span
                                  >`
                                : nothing
                        }
                        ${speed !== null && speed !== 1 ? html`<span class="meta">${speed}×</span>` : nothing}
                    </div>

                    ${
                        anyCommandAdvertised
                            ? nothing
                            : html`<div class="meta">
                                  This device advertises none of the transport commands this panel offers. Its
                                  AcceptedCommandList may not have been read yet, or it may support only commands
                                  handled elsewhere, such as Seek or track selection.
                              </div>`
                    }

                    <div class="transport-row">
                        ${
                            has(PREVIOUS_COMMAND_ID)
                                ? this._transportButton("Previous", mdiSkipPrevious, online, () =>
                                      this._invoke("Previous"),
                                  )
                                : nothing
                        }
                        ${
                            has(REWIND_COMMAND_ID)
                                ? this._transportButton("Rewind", mdiRewind, online, () => this._invoke("Rewind"))
                                : nothing
                        }
                        ${
                            has(PLAY_COMMAND_ID)
                                ? this._transportButton("Play", mdiPlay, online, () => this._invoke("Play"))
                                : nothing
                        }
                        ${
                            has(PAUSE_COMMAND_ID)
                                ? this._transportButton("Pause", mdiPause, online, () => this._invoke("Pause"))
                                : nothing
                        }
                        ${
                            has(STOP_COMMAND_ID)
                                ? this._transportButton("Stop", mdiStop, online, () => this._invoke("Stop"))
                                : nothing
                        }
                        ${
                            has(FAST_FORWARD_COMMAND_ID)
                                ? this._transportButton("Fast forward", mdiFastForward, online, () =>
                                      this._invoke("FastForward"),
                                  )
                                : nothing
                        }
                        ${
                            has(NEXT_COMMAND_ID)
                                ? this._transportButton("Next", mdiSkipNext, online, () => this._invoke("Next"))
                                : nothing
                        }
                        ${
                            has(START_OVER_COMMAND_ID)
                                ? this._transportButton("Start over", mdiRestart, online, () =>
                                      this._invoke("StartOver"),
                                  )
                                : nothing
                        }
                    </div>

                    ${
                        has(SKIP_BACKWARD_COMMAND_ID) || has(SKIP_FORWARD_COMMAND_ID)
                            ? html`
                                  <div class="command-row">
                                      <label for="skipMs">Skip (ms):</label>
                                      <input
                                          id="skipMs"
                                          type="number"
                                          min="1"
                                          .value=${this._skipMs}
                                          @input=${(event: Event) => {
                                              this._skipMs = (event.target as HTMLInputElement).value;
                                          }}
                                      />
                                      ${
                                          has(SKIP_BACKWARD_COMMAND_ID)
                                              ? html`<md-outlined-button
                                                    ?disabled=${!online || skipMs === null}
                                                    @click=${handleAsync(
                                                        () => this._skipBackward(),
                                                        this._failureReporter(),
                                                    )}
                                                >
                                                    <ha-svg-icon slot="icon" .path=${mdiSkipBackward}></ha-svg-icon>
                                                    Skip backward
                                                </md-outlined-button>`
                                              : nothing
                                      }
                                      ${
                                          has(SKIP_FORWARD_COMMAND_ID)
                                              ? html`<md-outlined-button
                                                    ?disabled=${!online || skipMs === null}
                                                    @click=${handleAsync(
                                                        () => this._skipForward(),
                                                        this._failureReporter(),
                                                    )}
                                                >
                                                    <ha-svg-icon slot="icon" .path=${mdiSkipForward}></ha-svg-icon>
                                                    Skip forward
                                                </md-outlined-button>`
                                              : nothing
                                      }
                                  </div>
                              `
                            : nothing
                    }
                </div>
            </details>
        `;
    }

    private _transportButton(label: string, icon: string, online: boolean, onClick: () => Promise<void>) {
        return html`
            <md-outlined-icon-button
                title=${label}
                aria-label=${label}
                ?disabled=${!online}
                @click=${handleAsync(onClick, this._failureReporter())}
            >
                <ha-svg-icon .path=${icon}></ha-svg-icon>
            </md-outlined-icon-button>
        `;
    }

    private async _invoke(command: string, payload?: Record<string, unknown>) {
        await invokeTransportCommand(this.client, this.node.node_id, this.endpoint, command, payload);
    }

    private async _skipForward() {
        const deltaPositionMilliseconds = parseSkipMs(this._skipMs);
        if (deltaPositionMilliseconds === null) return;
        await this._invoke("SkipForward", { deltaPositionMilliseconds });
    }

    private async _skipBackward() {
        const deltaPositionMilliseconds = parseSkipMs(this._skipMs);
        if (deltaPositionMilliseconds === null) return;
        await this._invoke("SkipBackward", { deltaPositionMilliseconds });
    }

    /** Captures the panel's context at render time; a reused panel must not raise the old device's error. */
    private _failureReporter() {
        const node = this.node;
        const endpoint = this.endpoint;
        return (err: Error) => {
            if (!this.isSameContext(node, endpoint)) return;
            showAlertDialog({ title: "Media Playback command failed", text: err.message }).catch(dialogErr =>
                console.error("Failed to show the MediaPlayback command error", dialogErr),
            );
        };
    }

    static override styles = [
        ...(Array.isArray(BaseClusterCommands.styles) ? BaseClusterCommands.styles : [BaseClusterCommands.styles]),
        css`
            .readout {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
                font-family: var(--monospace-font, monospace);
                font-size: 0.85rem;
                padding: 4px 0 12px;
            }

            .state-chip {
                padding: 2px 8px;
                border-radius: 4px;
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
                font-size: 0.75rem;
            }

            .state-chip.playing {
                background: var(--md-sys-color-primary-container);
                color: var(--md-sys-color-on-primary-container);
            }

            .meta {
                color: var(--md-sys-color-on-surface-variant);
            }

            .transport-row {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 12px;
                padding: 4px 0 16px;
                flex-wrap: wrap;
            }
        `,
    ];
}

registerClusterCommands(MEDIA_PLAYBACK_CLUSTER_ID, "media-playback-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "media-playback-cluster-commands": MediaPlaybackClusterCommands;
    }
}
