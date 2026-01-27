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

@customElement("dashboard-header")
export class DashboardHeader extends LitElement {
    @property() public backButton?: string;
    @property() public actions?: HeaderAction[];

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

                <div>${this.title || ""}</div>
                <div class="flex"></div>
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

        .flex {
            flex: 1;
            min-width: 0;
        }

        .actions {
            display: flex;
            flex-shrink: 0;
            align-items: center;
        }
    `;
}
