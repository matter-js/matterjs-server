/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import "@material/web/list/list-item";
import { MatterClient } from "@matter-server/ws-client";
import { mdiArrowLeft, mdiBrightnessAuto, mdiCog, mdiLogout, mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { showLogLevelDialog } from "../../components/dialogs/settings/show-log-level-dialog.js";
import "../../components/ha-svg-icon";
import { EffectiveTheme, ThemePreference, ThemeService } from "../../util/theme-service.js";

interface HeaderAction {
    label: string;
    icon: string;
    action: void;
}

export type ActiveView = "nodes" | "thread" | "wifi";

@customElement("dashboard-header")
export class DashboardHeader extends LitElement {
    @property() public backButton?: string;
    @property() public actions?: HeaderAction[];
    @property() public activeView?: ActiveView;
    @property({ type: Boolean }) public hasThreadDevices?: boolean;
    @property({ type: Boolean }) public hasWifiDevices?: boolean;

    public client?: MatterClient;

    @state() private _themePreference: ThemePreference = ThemeService.preference;
    @state() private _effectiveTheme: EffectiveTheme = ThemeService.effectiveTheme;

    private _unsubscribeTheme?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubscribeTheme = ThemeService.subscribe(theme => {
            this._effectiveTheme = theme;
            this._themePreference = ThemeService.preference;
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeTheme?.();
    }

    private _cycleTheme() {
        ThemeService.cycleTheme();
    }

    private _openSettings() {
        if (this.client) {
            showLogLevelDialog(this.client);
        }
    }

    private _getThemeIcon(): string {
        switch (this._themePreference) {
            case "light":
                return mdiWeatherSunny;
            case "dark":
                return mdiWeatherNight;
            case "system":
                return mdiBrightnessAuto;
        }
    }

    private _getThemeTooltip(): string {
        switch (this._themePreference) {
            case "light":
                return "Theme: Light";
            case "dark":
                return "Theme: Dark";
            case "system":
                return `Theme: System (${this._effectiveTheme})`;
        }
    }

    private _renderNavTabs() {
        if (this.activeView === undefined) {
            return nothing;
        }

        // Only show tabs if at least one network type has devices
        const showThreadTab = this.hasThreadDevices === true;
        const showWifiTab = this.hasWifiDevices === true;

        // Don't show nav tabs if no network devices exist
        if (!showThreadTab && !showWifiTab) {
            return nothing;
        }

        return html`
            <nav class="nav-tabs" role="tablist" aria-label="View navigation">
                <a
                    href="#nodes"
                    class="nav-tab ${this.activeView === "nodes" ? "active" : ""}"
                    role="tab"
                    aria-selected=${this.activeView === "nodes"}
                    >Nodes</a
                >
                ${showThreadTab
                    ? html`<a
                          href="#thread"
                          class="nav-tab ${this.activeView === "thread" ? "active" : ""}"
                          role="tab"
                          aria-selected=${this.activeView === "thread"}
                          >Thread</a
                      >`
                    : nothing}
                ${showWifiTab
                    ? html`<a
                          href="#wifi"
                          class="nav-tab ${this.activeView === "wifi" ? "active" : ""}"
                          role="tab"
                          aria-selected=${this.activeView === "wifi"}
                          >WiFi</a
                      >`
                    : nothing}
            </nav>
        `;
    }

    protected override render() {
        return html`
            <div class="header">
                <!-- optional back button -->
                ${this.backButton
                    ? html` <a .href=${this.backButton}>
                          <md-icon-button>
                              <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
                          </md-icon-button>
                      </a>`
                    : ""}

                <div class="title">${this.title ?? ""}</div>
                ${this._renderNavTabs()}
                <div class="actions">
                    ${this.actions?.map(action => {
                        return html`
                            <md-icon-button @click=${action.action} .title=${action.label}>
                                <ha-svg-icon .path=${action.icon}></ha-svg-icon>
                            </md-icon-button>
                        `;
                    })}
                    <!-- settings button (only when connected) -->
                    ${this.client
                        ? html`
                              <md-icon-button @click=${this._openSettings} title="Server Settings">
                                  <ha-svg-icon .path=${mdiCog}></ha-svg-icon>
                              </md-icon-button>
                          `
                        : nothing}
                    <!-- theme toggle button -->
                    <md-icon-button @click=${this._cycleTheme} .title=${this._getThemeTooltip()}>
                        <ha-svg-icon .path=${this._getThemeIcon()}></ha-svg-icon>
                    </md-icon-button>
                    <!-- optional logout button (only when client exists and not in production) -->
                    ${this.client && !this.client.isProduction
                        ? html`
                              <md-icon-button @click=${this.client.disconnect}>
                                  <ha-svg-icon .path=${mdiLogout}></ha-svg-icon>
                              </md-icon-button>
                          `
                        : nothing}
                </div>
            </div>
        `;
    }

    static override styles = css`
        .header {
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            --icon-primary-color: var(--md-sys-color-on-primary);
            font-weight: 400;
            display: flex;
            align-items: center;
            padding-left: 18px;
            padding-right: 8px;
            min-height: 48px;
        }

        md-icon-button {
            margin-right: 8px;
        }

        .title {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .actions {
            display: flex;
            max-width: 100%;
            align-items: center;
        }

        .nav-tabs {
            display: flex;
            margin-left: 24px;
            gap: 4px;
        }

        .nav-tab {
            padding: 8px 16px;
            color: var(--md-sys-color-on-primary);
            text-decoration: none;
            font-size: 0.875rem;
            font-weight: 500;
            border-radius: 4px 4px 0 0;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        .nav-tab:hover {
            opacity: 0.9;
        }

        .nav-tab.active {
            opacity: 1;
            background-color: rgba(255, 255, 255, 0.15);
            border-bottom: 2px solid var(--md-sys-color-on-primary);
        }

        @media (max-width: 768px) {
            .nav-tabs {
                display: none;
            }
        }
    `;
}
