/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { SoftwareUpdateManager } from "@matter/main";

/**
 * With `checkOnRequestOnly`, skips the periodic DCL update check, which also announces consented updates to the
 * devices, and with it the cleanup of stored OTA files no node needs anymore. `check_node_update` and `update_node` go
 * through `queryUpdates` and `forceUpdate`. matter.js only offers updates to a node with the server's own
 * subscription, so for any other node `check_node_update` returns `null` and `update_node` fails, unless an update was
 * found while it was subscribed.
 */
export class ServerSoftwareUpdateManager extends SoftwareUpdateManager {
    declare state: ServerSoftwareUpdateManager.State;

    override async checkForUpdates() {
        if (this.state.checkOnRequestOnly) {
            return;
        }
        await super.checkForUpdates();
    }
}

export namespace ServerSoftwareUpdateManager {
    export class State extends SoftwareUpdateManager.State {
        checkOnRequestOnly = false;
    }
}
