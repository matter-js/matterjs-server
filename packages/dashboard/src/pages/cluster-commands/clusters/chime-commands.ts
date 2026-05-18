/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/iconbutton/icon-button";
import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import "@material/web/switch/switch";
import { mdiPlay } from "@mdi/js";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { handleAsync, handleAsyncEvent } from "../../../util/async-handler.js";
import {
    CHIME_CLUSTER_ID,
    play as chimePlay,
    readEnabled,
    readRevision,
    readSelected,
    readSounds,
    setEnabled,
    setSelected,
} from "../../../util/chime.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("chime-cluster-commands")
class ChimeClusterCommands extends BaseClusterCommands {
    @state() private _lastPlayed: { chimeId: number; at: number } | null = null;
    @state() private _playDisabledUntil = 0;
    private _unsubscribeNodes?: () => void;
    private _unsubscribeEvents?: () => void;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has("client") && this.client && !this._unsubscribeNodes) {
            this._unsubscribeNodes = this.client.addEventListener("nodes_changed", () => {
                this.requestUpdate();
            });
            this._unsubscribeEvents = this.client.addNodeEventListener(ev => {
                if (
                    ev.cluster_id !== CHIME_CLUSTER_ID ||
                    ev.endpoint_id !== this.endpoint ||
                    String(ev.node_id) !== String(this.node.node_id) ||
                    ev.event_id !== 0
                ) {
                    return;
                }
                const raw = ev.data;
                if (raw === null || typeof raw !== "object") return;
                const d = raw as Record<string, unknown>;
                const named = d["chimeID"];
                const tagged = d["0"];
                const chimeId = typeof named === "number" ? named : typeof tagged === "number" ? tagged : null;
                if (chimeId !== null) this.onChimeStartedPlaying(chimeId);
            });
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeNodes?.();
        this._unsubscribeEvents?.();
        this._lastPlayed = null;
    }

    override render() {
        if (!this.node || this.cluster !== CHIME_CLUSTER_ID) return nothing;
        const sounds = readSounds(this.node, this.endpoint);
        const selected = readSelected(this.node, this.endpoint);
        const enabled = readEnabled(this.node, this.endpoint);
        const revision = readRevision(this.node, this.endpoint);
        const showPerRowPlay = revision >= 2;
        const showLastPlayed = revision >= 2 && this._lastPlayed !== null;
        const playLocked = Date.now() < this._playDisabledUntil;
        const lastSoundName = showLastPlayed
            ? (sounds.find(s => s.chimeId === this._lastPlayed!.chimeId)?.name ?? `#${this._lastPlayed!.chimeId}`)
            : null;

        return html`
            <details class="command-panel" open>
                <summary>Chime</summary>
                <div class="command-content">
                    <div class="top-row">
                        <label class="enabled">
                            <md-switch
                                ?selected=${enabled}
                                @change=${handleAsyncEvent((e: Event) =>
                                    setEnabled(
                                        this.client,
                                        this.node.node_id,
                                        this.endpoint,
                                        // md-switch exposes `.selected` but has no typed CustomEvent subclass
                                        (e.target as HTMLElement & { selected: boolean }).selected,
                                    ),
                                )}
                            ></md-switch>
                            <span>Enabled</span>
                        </label>
                        <div class="selected">
                            <span class="muted">Selected:</span>
                            <md-outlined-select
                                .value=${selected !== null ? String(selected) : ""}
                                ?disabled=${sounds.length === 0}
                                @change=${handleAsyncEvent((e: Event) => {
                                    const v = Number((e.target as HTMLSelectElement).value);
                                    return setSelected(this.client, this.node.node_id, this.endpoint, v);
                                })}
                            >
                                ${sounds.map(
                                    s => html`
                                        <md-select-option value=${String(s.chimeId)}>
                                            <div slot="headline">${s.name}</div>
                                        </md-select-option>
                                    `,
                                )}
                            </md-outlined-select>
                        </div>
                        <md-filled-button
                            ?disabled=${!enabled || selected === null || playLocked}
                            @click=${handleAsync(() => this._handlePlay())}
                        >
                            <ha-svg-icon slot="icon" .path=${mdiPlay}></ha-svg-icon>
                            Play
                        </md-filled-button>
                    </div>

                    <div class="sounds">
                        <div class="sounds-header">Installed sounds (${sounds.length})</div>
                        ${sounds.length === 0
                            ? html`<div class="muted empty">No sounds installed.</div>`
                            : sounds.map(
                                  s => html`
                                      <div
                                          class="sound-row ${s.chimeId === selected ? "selected" : ""}"
                                          @click=${handleAsync(() =>
                                              setSelected(this.client, this.node.node_id, this.endpoint, s.chimeId),
                                          )}
                                      >
                                          <span class="pid">#${s.chimeId}</span>
                                          <span class="pname">${s.name}</span>
                                          ${s.chimeId === selected
                                              ? html`<span class="muted">✓ selected</span>`
                                              : nothing}
                                          <span class="grow"></span>
                                          ${showPerRowPlay
                                              ? html`<md-icon-button
                                                    ?disabled=${!enabled}
                                                    @click=${handleAsyncEvent((e: Event) => {
                                                        e.stopPropagation();
                                                        return chimePlay(
                                                            this.client,
                                                            this.node.node_id,
                                                            this.endpoint,
                                                            s.chimeId,
                                                        );
                                                    })}
                                                >
                                                    <ha-svg-icon .path=${mdiPlay}></ha-svg-icon>
                                                </md-icon-button>`
                                              : nothing}
                                      </div>
                                  `,
                              )}
                    </div>

                    ${showLastPlayed
                        ? html`<div class="last-played">
                              Last played: ${lastSoundName} · ${new Date(this._lastPlayed!.at).toLocaleTimeString()}
                          </div>`
                        : nothing}
                </div>
            </details>
        `;
    }

    public onChimeStartedPlaying(chimeId: number): void {
        this._lastPlayed = { chimeId, at: Date.now() };
    }

    private async _handlePlay() {
        this._playDisabledUntil = Date.now() + 1000;
        this.requestUpdate();
        try {
            await chimePlay(this.client, this.node.node_id, this.endpoint);
        } finally {
            setTimeout(() => this.requestUpdate(), 1000);
        }
    }

    static override styles = [
        ...(Array.isArray(BaseClusterCommands.styles) ? BaseClusterCommands.styles : [BaseClusterCommands.styles]),
        css`
            .top-row {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
                padding-bottom: 12px;
            }
            .enabled {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .selected {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                min-width: 200px;
            }
            .muted {
                color: var(--md-sys-color-on-surface-variant);
            }
            .sounds {
                border-top: 1px solid var(--md-sys-color-outline-variant);
                padding-top: 8px;
            }
            .sounds-header {
                font-weight: 500;
                margin-bottom: 6px;
            }
            .sound-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 8px;
                border-radius: 4px;
                cursor: pointer;
            }
            .sound-row:hover {
                background: var(--md-sys-color-surface-container-high);
            }
            .sound-row.selected {
                background: var(--md-sys-color-secondary-container);
            }
            .pid {
                font-family: var(--monospace-font, monospace);
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.85rem;
            }
            .pname {
                font-weight: 500;
            }
            .grow {
                flex: 1;
            }
            .empty {
                font-style: italic;
            }
            .last-played {
                margin-top: 12px;
                padding-top: 8px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
                font-size: 0.85rem;
                color: var(--md-sys-color-on-surface-variant);
            }
        `,
    ];
}

registerClusterCommands(CHIME_CLUSTER_ID, "chime-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "chime-cluster-commands": ChimeClusterCommands;
    }
}
