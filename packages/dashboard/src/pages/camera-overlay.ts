/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/button/filled-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import type { CameraCapabilitiesResult, CameraResolution, MatterClient } from "@matter-server/ws-client";
import { mdiCamera, mdiClose, mdiVolumeHigh, mdiVolumeOff } from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { clientContext } from "../client/client-context.js";
import "../components/avsum-ptz-strip.js";
import "../components/ha-svg-icon.js";
import "../components/webrtc-stream-view.js";
import type { WebRtcStreamView } from "../components/webrtc-stream-view.js";
import { hasAvsumOnEndpoint } from "../util/avsum.js";
import {
    cameraErrorText,
    type CameraQualityBadge,
    hasCameraFeature,
    parseResolutionOption,
    resolutionOption,
    snapshotResolutionOptions,
    videoResolutionOptions,
} from "../util/camera-api.js";
import { supportsLiveView, supportsSnapshot } from "../util/camera.js";

type StreamState = "idle" | "connecting" | "streaming" | "error";

function snapshotExtension(dataUri: string): string {
    const mime = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUri)?.[1]?.toLowerCase();
    return mime === "heic" ? "heic" : "jpg";
}

@customElement("camera-overlay")
export class CameraOverlay extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    client?: MatterClient;

    @property({ attribute: false }) nodeId!: number | bigint;
    @property({ type: Number }) endpointId!: number;

    @state() private _state: StreamState = "idle";
    @state() private _errorMessage: string | null = null;
    @state() private _snapshotDataUri: string | null = null;
    @state() private _snapshotResolution: CameraResolution | null = null;
    @state() private _snapshotDegraded = false;
    @state() private _snapshotBusy = false;
    @state() private _snapshotError: string | null = null;
    @state() private _capabilities: CameraCapabilitiesResult | null = null;
    @state() private _capabilitiesError: string | null = null;
    @state() private _capabilitiesLoading = true;
    /** null is "Auto": no resolution hint. */
    @state() private _selectedResolution: CameraResolution | null = null;
    @state() private _selectedSnapshotResolution: CameraResolution | null = null;
    @state() private _closing = false;
    @state() private _activeVideoStreamId: number | null = null;
    @state() private _qualityBadges = new Array<CameraQualityBadge>();
    @state() private _muted = true;
    @state() private _watermarkEnabled = false;
    @state() private _osdEnabled = false;

    private get _liveViewSupported(): boolean {
        const node = this.client?.nodes[String(this.nodeId)];
        return node ? supportsLiveView(node, this.endpointId) : false;
    }

    private get _snapshotSupported(): boolean {
        const node = this.client?.nodes[String(this.nodeId)];
        return node ? supportsSnapshot(node, this.endpointId) : false;
    }

    private _streamViewRef = createRef<WebRtcStreamView>();

    override firstUpdated(): void {
        this._loadCapabilities().catch(err => console.warn("[camera-overlay] loading capabilities failed", err));
    }

    private async _loadCapabilities(): Promise<void> {
        const client = this.client;
        try {
            if (!client) return;
            this._capabilities = await client.sendCommand("camera_get_capabilities", 14, {
                node_id: this.nodeId,
                endpoint_id: this.endpointId,
            });
        } catch (err) {
            this._capabilitiesError = cameraErrorText(err);
        } finally {
            this._capabilitiesLoading = false;
        }
    }

    private _onSnapshotResolutionChange(ev: Event): void {
        this._selectedSnapshotResolution = parseResolutionOption((ev.target as HTMLSelectElement).value);
    }

    private _avsumPresent(): boolean {
        const node = this.client?.nodes[String(this.nodeId)];
        if (!node) return false;
        return hasAvsumOnEndpoint(node, this.endpointId);
    }

    private async _close(): Promise<void> {
        const view = this._streamViewRef.value;
        if (view) {
            this._closing = true;
            try {
                await view.stop();
                await view.releaseSnapshotStreams();
            } finally {
                this._closing = false;
            }
        }
        this.remove();
    }

    private _onStreamState(ev: CustomEvent<{ state: StreamState; errorMessage: string | null }>): void {
        this._state = ev.detail.state;
        this._errorMessage = ev.detail.errorMessage;
        // Only expose the underlying VideoStreamID to the AVSUM strip while actively
        // streaming. Other states would surface a stale id (during error/idle the
        // stream is being torn down) or a not-yet-allocated null (during connecting).
        const view = this._streamViewRef.value;
        const streaming = ev.detail.state === "streaming";
        this._activeVideoStreamId = streaming ? (view?.videoStreamId ?? null) : null;
        this._qualityBadges = streaming ? (view?.qualityBadges ?? []) : [];

        // Audio-only "Listen" sessions have no video; starting muted would defeat the feature, so
        // unmute on stream start. Started from the user's Start click, so autoplay policy allows it.
        if (streaming && view?.audioOnlySession) {
            view.setMuted(false);
            this._muted = false;
        }
    }

    private _start(): void {
        this._streamViewRef.value
            ?.start()
            .catch(err => console.warn("[camera-overlay] starting the stream failed", err));
    }

    private _stop(): void {
        this._streamViewRef.value
            ?.stop()
            .catch(err => console.warn("[camera-overlay] stopping the stream failed", err));
    }

    private _toggleMute(): void {
        const view = this._streamViewRef.value;
        if (!view) return;
        const next = !this._muted;
        view.setMuted(next);
        this._muted = next;
    }

    private async _onSnapshot(): Promise<void> {
        const view = this._streamViewRef.value;
        if (!view) return;
        this._snapshotBusy = true;
        this._snapshotError = null;
        try {
            const { dataUri, resolution, degraded } = await view.takeSnapshot();
            this._snapshotDataUri = dataUri;
            this._snapshotResolution = resolution;
            this._snapshotDegraded = degraded;
        } catch (e) {
            this._snapshotError = cameraErrorText(e);
        } finally {
            this._snapshotBusy = false;
        }
    }

    private _downloadSnapshot(): void {
        if (!this._snapshotDataUri) return;
        const a = document.createElement("a");
        a.href = this._snapshotDataUri;
        a.download = `snapshot-node${this.nodeId}-ep${this.endpointId}-${Date.now()}.${snapshotExtension(
            this._snapshotDataUri,
        )}`;
        a.click();
    }

    private _onResolutionChange(ev: Event): void {
        this._selectedResolution = parseResolutionOption((ev.target as HTMLSelectElement).value);
    }

    private _renderResolutionSelect(args: {
        label: string;
        autoLabel: string;
        options: CameraResolution[];
        optionLabel: (resolution: CameraResolution) => string;
        selected: CameraResolution | null;
        onChange: (ev: Event) => void;
    }) {
        if (args.options.length === 0) return nothing;
        return html`
            <md-outlined-select label=${args.label} .value=${resolutionOption(args.selected)} @change=${args.onChange}>
                <md-select-option value=${resolutionOption(null)}>
                    <div slot="headline">${args.autoLabel}</div>
                </md-select-option>
                ${args.options.map(
                    r => html`
                        <md-select-option value=${resolutionOption(r)}>
                            <div slot="headline">${args.optionLabel(r)}</div>
                        </md-select-option>
                    `,
                )}
            </md-outlined-select>
        `;
    }

    private _renderOverlayToggles() {
        return html`
            ${
                hasCameraFeature(this._capabilities, "Watermark")
                    ? html`<label class="overlay-toggle">
                          <input
                              type="checkbox"
                              ?checked=${this._watermarkEnabled}
                              @change=${(e: Event) => (this._watermarkEnabled = (e.target as HTMLInputElement).checked)}
                          />
                          Watermark
                      </label>`
                    : nothing
            }
            ${
                hasCameraFeature(this._capabilities, "OnScreenDisplay")
                    ? html`<label class="overlay-toggle">
                          <input
                              type="checkbox"
                              ?checked=${this._osdEnabled}
                              @change=${(e: Event) => (this._osdEnabled = (e.target as HTMLInputElement).checked)}
                          />
                          OSD
                      </label>`
                    : nothing
            }
        `;
    }

    override render() {
        const liveViewSupported = this._liveViewSupported;
        const idleOrError = this._state === "idle" || this._state === "error";
        const canStart = liveViewSupported && idleOrError;

        return html`
            <div class="backdrop" @click=${this._closing ? undefined : this._close}></div>
            <div class="frame" @click=${(e: Event) => e.stopPropagation()}>
                <header>
                    <md-icon-button @click=${this._close} ?disabled=${this._closing} aria-label="Close">
                        <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                    </md-icon-button>
                    <span>Node ${this.nodeId} • Endpoint ${this.endpointId}</span>
                </header>
                ${
                    this._avsumPresent()
                        ? html`<avsum-ptz-strip
                              .nodeId=${this.nodeId}
                              .endpointId=${this.endpointId}
                              .activeVideoStreamId=${this._activeVideoStreamId}
                              .sensorSize=${this._capabilities?.video.sensor ?? null}
                          ></avsum-ptz-strip>`
                        : nothing
                }
                <main>
                    ${
                        this.client
                            ? html`<webrtc-stream-view
                                  ${ref(this._streamViewRef)}
                                  .nodeId=${this.nodeId}
                                  .endpointId=${this.endpointId}
                                  .liveViewSupported=${liveViewSupported}
                                  .capabilities=${this._capabilities}
                                  .resolution=${this._selectedResolution}
                                  .watermarkEnabled=${this._watermarkEnabled}
                                  .osdEnabled=${this._osdEnabled}
                                  .snapshotResolution=${this._selectedSnapshotResolution}
                                  @streamstate=${this._onStreamState}
                              ></webrtc-stream-view>`
                            : html`<div class="status error">No Matter client available.</div>`
                    }
                    ${
                        this._snapshotDataUri
                            ? html`
                                  <div class="snapshot-preview">
                                      <img
                                          src=${this._snapshotDataUri}
                                          @click=${this._downloadSnapshot}
                                          title="Click to download${
                                              this._snapshotResolution
                                                  ? ` (${this._snapshotResolution.width}×${this._snapshotResolution.height})`
                                                  : ""
                                          }"
                                          alt="Snapshot"
                                      />
                                      <md-icon-button
                                          @click=${() => {
                                              this._snapshotDataUri = null;
                                          }}
                                          aria-label="Close snapshot"
                                      >
                                          <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                                      </md-icon-button>
                                      ${
                                          this._snapshotDegraded
                                              ? html`<span
                                                    class="quality-badge"
                                                    title="Smaller than the requested bounds allow, because no encoder was free"
                                                    >Degraded</span
                                                >`
                                              : nothing
                                      }
                                  </div>
                              `
                            : nothing
                    }
                    ${this._snapshotError ? html`<div class="snapshot-error">${this._snapshotError}</div>` : nothing}
                </main>
                <footer>
                    ${this._closing ? html`<span class="footer-status">Closing…</span>` : nothing}
                    ${
                        !this._closing && this._state === "connecting"
                            ? html`<span class="footer-status">Waiting for camera response…</span>`
                            : nothing
                    }
                    ${
                        !this._closing && this._state === "error" && this._errorMessage
                            ? html`<span class="footer-status error">${this._errorMessage}</span>`
                            : nothing
                    }
                    ${
                        !this._closing && this._state === "idle" && this._capabilitiesError
                            ? html`<span class="footer-status error"
                                  >Camera capabilities unavailable: ${this._capabilitiesError}</span
                              >`
                            : nothing
                    }
                    ${
                        this._state === "streaming" && this._qualityBadges.length > 0
                            ? html`<span class="footer-status">
                                  ${this._qualityBadges.map(
                                      badge =>
                                          html`<span class="quality-badge" title=${badge.detail}>${badge.label}</span>`,
                                  )}
                              </span>`
                            : nothing
                    }
                    ${
                        canStart
                            ? this._renderResolutionSelect({
                                  label: "Resolution",
                                  autoLabel: "Auto (best)",
                                  options: videoResolutionOptions(this._capabilities),
                                  optionLabel: r => `Up to ${r.width}×${r.height}`,
                                  selected: this._selectedResolution,
                                  onChange: this._onResolutionChange,
                              })
                            : nothing
                    }
                    ${
                        idleOrError && this._snapshotSupported
                            ? this._renderResolutionSelect({
                                  label: "Snapshot",
                                  autoLabel: "Auto",
                                  options: snapshotResolutionOptions(this._capabilities),
                                  optionLabel: r => `${r.width}×${r.height}`,
                                  selected: this._selectedSnapshotResolution,
                                  onChange: this._onSnapshotResolutionChange,
                              })
                            : nothing
                    }
                    ${idleOrError ? this._renderOverlayToggles() : nothing}
                    ${
                        canStart
                            ? html`<md-filled-button
                                  @click=${this._start}
                                  ?disabled=${!this.client || this._capabilitiesLoading}
                              >
                                  ${this._state === "error" ? "Retry" : "Start"}
                              </md-filled-button>`
                            : nothing
                    }
                    ${
                        this._state === "connecting"
                            ? html`<md-filled-button @click=${this._stop}>End</md-filled-button>`
                            : nothing
                    }
                    ${
                        this._state === "streaming"
                            ? html`<md-filled-button @click=${this._stop}>End</md-filled-button>
                                  <md-text-button
                                      @click=${this._toggleMute}
                                      aria-label=${this._muted ? "Unmute" : "Mute"}
                                  >
                                      <ha-svg-icon
                                          slot="icon"
                                          .path=${this._muted ? mdiVolumeOff : mdiVolumeHigh}
                                      ></ha-svg-icon>
                                      ${this._muted ? "Unmute" : "Mute"}
                                  </md-text-button>`
                            : nothing
                    }
                    ${
                        this._snapshotSupported
                            ? html`<md-text-button
                                  @click=${this._onSnapshot}
                                  ?disabled=${this._snapshotBusy || !this.client}
                                  aria-label="Take snapshot"
                              >
                                  <ha-svg-icon .path=${mdiCamera} slot="icon"></ha-svg-icon>
                                  ${this._snapshotBusy ? "Capturing…" : "Snapshot"}
                              </md-text-button>`
                            : nothing
                    }
                    <md-text-button @click=${this._close} ?disabled=${this._closing}>Close</md-text-button>
                </footer>
            </div>
        `;
    }

    static override styles = css`
        :host {
            position: fixed;
            inset: 0;
            display: grid;
            place-items: center;
            z-index: 9999;
        }
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
        }
        .frame {
            position: relative;
            width: min(80vw, 1200px);
            height: min(80vh, 800px);
            background: var(--md-sys-color-surface);
            color: var(--md-sys-color-on-surface);
            display: grid;
            grid-template-rows: auto auto 1fr auto;
            grid-template-areas: "header" "strip" "main" "footer";
            border-radius: 8px;
            overflow: hidden;
        }
        header {
            grid-area: header;
        }
        avsum-ptz-strip {
            grid-area: strip;
        }
        main {
            grid-area: main;
        }
        footer {
            grid-area: footer;
        }
        header {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            gap: 12px;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
        }
        main {
            display: flex;
            flex-direction: column;
            background: black;
            position: relative;
            overflow: hidden;
            min-height: 0;
        }
        webrtc-stream-view {
            flex: 1 1 0;
            min-height: 0;
            width: 100%;
        }
        .status.error {
            color: var(--danger-color);
            text-align: center;
            padding: 16px;
        }
        .overlay-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.85rem;
            color: var(--md-sys-color-on-surface-variant);
            user-select: none;
            cursor: pointer;
        }
        .overlay-toggle input[type="checkbox"] {
            accent-color: var(--md-sys-color-primary);
            margin: 0;
        }
        .snapshot-preview {
            position: absolute;
            top: 8px;
            right: 8px;
            max-width: 200px;
            background: var(--md-sys-color-surface-container);
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 4px;
            padding: 4px;
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: start;
            gap: 4px;
            z-index: 10;
        }
        .snapshot-preview img {
            max-width: 100%;
            cursor: pointer;
            display: block;
            border-radius: 2px;
        }
        .snapshot-preview .quality-badge {
            grid-column: 1 / -1;
            justify-self: start;
        }
        .snapshot-error {
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            color: var(--danger-color);
            background: var(--md-sys-color-surface-container);
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 0.875rem;
            z-index: 10;
            white-space: nowrap;
        }
        footer {
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
        }
        .footer-status {
            margin-right: auto;
            color: var(--md-sys-color-on-surface-variant);
            font-style: italic;
        }
        .quality-badge {
            display: inline-block;
            margin-right: 6px;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 0.75rem;
            font-style: normal;
            background: var(--md-sys-color-tertiary-container);
            color: var(--md-sys-color-on-tertiary-container);
            cursor: help;
        }
        .footer-status.error {
            color: var(--danger-color);
            font-style: normal;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "camera-overlay": CameraOverlay;
    }
}
