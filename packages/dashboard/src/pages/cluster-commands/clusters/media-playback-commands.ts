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
import { handleAsync } from "../../../util/async-handler.js";
import {
    FAST_FORWARD_COMMAND_ID,
    formatDurationMs,
    formatPlaybackState,
    MEDIA_PLAYBACK_CLUSTER_ID,
    NEXT_COMMAND_ID,
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

const DEFAULT_SKIP_MS = 10000;

@customElement("media-playback-cluster-commands")
class MediaPlaybackClusterCommands extends BaseClusterCommands {
    @state() private _skipMs = DEFAULT_SKIP_MS;

    override render() {
        if (!this.node || this.cluster !== MEDIA_PLAYBACK_CLUSTER_ID) return nothing;

        const playbackState = readCurrentState(this.node, this.endpoint);
        const positionMs = readPositionMs(this.node, this.endpoint);
        const durationMs = readDurationMs(this.node, this.endpoint);
        const speed = readPlaybackSpeed(this.node, this.endpoint);
        const online = this.node.available === true;
        const has = (commandId: number) => supportsCommand(this.node, this.endpoint, commandId);

        return html`
            <details class="command-panel" open>
                <summary>Media Playback Controls</summary>
                <div class="command-content">
                    <div class="readout">
                        <span class="state-chip ${playbackState === PlaybackState.Playing ? "playing" : ""}"
                            >${formatPlaybackState(playbackState)}</span
                        >
                        ${
                            positionMs !== null
                                ? html`<span
                                      >${formatDurationMs(positionMs)}${
                                          durationMs !== null ? html` / ${formatDurationMs(durationMs)}` : nothing
                                      }</span
                                  >`
                                : nothing
                        }
                        ${speed !== null && speed !== 1 ? html`<span class="meta">${speed}×</span>` : nothing}
                    </div>

                    <div class="transport-row">
                        ${
                            has(PREVIOUS_COMMAND_ID)
                                ? this._transportButton("Previous", mdiSkipPrevious, online, () =>
                                      this.sendCommand("Previous"),
                                  )
                                : nothing
                        }
                        ${
                            has(REWIND_COMMAND_ID)
                                ? this._transportButton("Rewind", mdiRewind, online, () => this.sendCommand("Rewind"))
                                : nothing
                        }
                        ${
                            has(PLAY_COMMAND_ID)
                                ? this._transportButton("Play", mdiPlay, online, () => this.sendCommand("Play"))
                                : nothing
                        }
                        ${
                            has(PAUSE_COMMAND_ID)
                                ? this._transportButton("Pause", mdiPause, online, () => this.sendCommand("Pause"))
                                : nothing
                        }
                        ${
                            has(STOP_COMMAND_ID)
                                ? this._transportButton("Stop", mdiStop, online, () => this.sendCommand("Stop"))
                                : nothing
                        }
                        ${
                            has(FAST_FORWARD_COMMAND_ID)
                                ? this._transportButton("Fast forward", mdiFastForward, online, () =>
                                      this.sendCommand("FastForward"),
                                  )
                                : nothing
                        }
                        ${
                            has(NEXT_COMMAND_ID)
                                ? this._transportButton("Next", mdiSkipNext, online, () => this.sendCommand("Next"))
                                : nothing
                        }
                        ${
                            has(START_OVER_COMMAND_ID)
                                ? this._transportButton("Start over", mdiRestart, online, () =>
                                      this.sendCommand("StartOver"),
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
                                          .value=${String(this._skipMs)}
                                          @input=${this._handleSkipMsChange}
                                      />
                                      ${
                                          has(SKIP_BACKWARD_COMMAND_ID)
                                              ? html`<md-outlined-button
                                                    ?disabled=${!online}
                                                    @click=${handleAsync(() => this._skipBackward())}
                                                >
                                                    <ha-svg-icon slot="icon" .path=${mdiSkipBackward}></ha-svg-icon>
                                                    Skip backward
                                                </md-outlined-button>`
                                              : nothing
                                      }
                                      ${
                                          has(SKIP_FORWARD_COMMAND_ID)
                                              ? html`<md-outlined-button
                                                    ?disabled=${!online}
                                                    @click=${handleAsync(() => this._skipForward())}
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
                @click=${handleAsync(onClick)}
            >
                <ha-svg-icon .path=${icon}></ha-svg-icon>
            </md-outlined-icon-button>
        `;
    }

    private _handleSkipMsChange(event: Event) {
        const value = Number((event.target as HTMLInputElement).value);
        this._skipMs = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_SKIP_MS;
    }

    private async _skipForward() {
        await this.sendCommand("SkipForward", { deltaPositionMilliseconds: this._skipMs });
    }

    private async _skipBackward() {
        await this.sendCommand("SkipBackward", { deltaPositionMilliseconds: this._skipMs });
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

// Register this component for the MediaPlayback cluster
registerClusterCommands(MEDIA_PLAYBACK_CLUSTER_ID, "media-playback-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "media-playback-cluster-commands": MediaPlaybackClusterCommands;
    }
}
