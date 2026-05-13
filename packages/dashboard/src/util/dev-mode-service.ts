/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Developer-mode state backed by the `?dev` URL query parameter.
 *
 * Activation: any non-empty value (e.g. `?dev=on`, `?dev=1`). No persistence;
 * dev mode is gone when the URL is.
 */

const URL_PARAM = "dev";

class DevModeServiceImpl {
    private _listeners: Set<(active: boolean) => void> = new Set();

    get active(): boolean {
        const value = new URLSearchParams(window.location.search).get(URL_PARAM);
        return value !== null && value !== "";
    }

    setActive(on: boolean): void {
        const url = new URL(window.location.href);
        if (on) {
            url.searchParams.set(URL_PARAM, "on");
        } else {
            url.searchParams.delete(URL_PARAM);
        }
        history.replaceState(null, "", url.toString());
        const active = this.active;
        this._listeners.forEach(cb => cb(active));
    }

    subscribe(callback: (active: boolean) => void): () => void {
        this._listeners.add(callback);
        return () => {
            this._listeners.delete(callback);
        };
    }
}

export const DevModeService = new DevModeServiceImpl();
