/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/progress/circular-progress";
import "@material/web/textfield/outlined-text-field";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import { LitElement, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clientContext } from "../../../client/client-context.js";
import { MatterClient } from "../../../client/client.js";
import { fireEvent } from "../../../util/fire_event.js";

@customElement("commission-node-thread")
export class CommissionNodeThread extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @state()
    private _loading: boolean = false;

    @query("md-outlined-text-field[label='Thread dataset']")
    private _datasetField!: MdOutlinedTextField;
    @query("md-outlined-text-field[label='Pairing code']")
    private _pairingCodeField!: MdOutlinedTextField;

    protected override render() {
        if (!this.client.serverInfo.thread_credentials_set) {
            return html`<md-outlined-text-field label="Thread dataset" .disabled="${this._loading}">
                </md-outlined-text-field>
                <br />
                <br />
                <md-outlined-button @click=${this._setThreadDataset} .disabled="${this._loading}"
                    >Set Thread Dataset</md-outlined-button
                >${this._loading ? html`<md-circular-progress indeterminate></md-circular-progress>` : nothing}`;
        }
        return html`<md-outlined-text-field label="Pairing code" .disabled="${this._loading}"> </md-outlined-text-field>
            <br />
            <br />
            <md-outlined-button @click=${this._commissionNode} .disabled="${this._loading}"
                >Commission</md-outlined-button
            >${this._loading ? html`<md-circular-progress indeterminate></md-circular-progress>` : nothing}`;
    }

    private async _setThreadDataset() {
        const dataset = this._datasetField.value;
        if (!dataset) {
            alert("Dataset is required");
            return;
        }
        this._loading = true;
        try {
            await this.client.setThreadOperationalDataset(dataset);
        } catch (err) {
            alert(`Error setting Thread dataset: ${(err as Error).message}`);
        } finally {
            this._loading = false;
        }
    }

    private async _commissionNode() {
        this._loading = true;
        try {
            const node = await this.client.commissionWithCode(this._pairingCodeField.value, false);
            fireEvent(this, "node-commissioned", node);
        } catch (err) {
            alert(`Error commissioning node: ${(err as Error).message}`);
        } finally {
            this._loading = false;
        }
    }
}
