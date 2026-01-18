/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wraps an async function to be used as an event handler.
 * Catches any errors and logs them, optionally calling an error callback.
 *
 * Usage in Lit templates:
 * ```
 * <button @click=${handleAsync(() => this._save())}>Save</button>
 * ```
 *
 * With custom error handling:
 * ```
 * <button @click=${handleAsync(() => this._save(), (e) => this._showError(e))}>Save</button>
 * ```
 *
 * @param fn - Async function to execute
 * @param onError - Optional error callback
 * @returns Event handler function
 */
export function handleAsync<T>(fn: () => Promise<T>, onError?: (error: Error) => void): () => void {
    return () => {
        fn().catch((error: Error) => {
            console.error("Async operation failed:", error);
            onError?.(error);
        });
    };
}

/**
 * Wraps an async function that takes an event parameter.
 *
 * Usage:
 * ```
 * <input @change=${handleAsyncEvent((e) => this._handleChange(e))}>
 * ```
 */
export function handleAsyncEvent<E extends Event, T>(
    fn: (event: E) => Promise<T>,
    onError?: (error: Error) => void,
): (event: E) => void {
    return (event: E) => {
        fn(event).catch((error: Error) => {
            console.error("Async operation failed:", error);
            onError?.(error);
        });
    };
}

/**
 * Fire-and-forget helper for calling async methods from sync contexts.
 * Use this when you need to call an async method but can't await it.
 *
 * Usage in lifecycle methods:
 * ```
 * connectedCallback() {
 *     super.connectedCallback();
 *     fireAndForget(this._loadData());
 * }
 * ```
 *
 * @param promise - Promise to execute
 * @param onError - Optional error callback
 */
export function fireAndForget<T>(promise: Promise<T>, onError?: (error: Error) => void): void {
    promise.catch((error: Error) => {
        console.error("Async operation failed:", error);
        onError?.(error);
    });
}
