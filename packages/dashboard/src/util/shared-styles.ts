/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";
import { ThemeService } from "./theme-service.js";

// Cache resolved CSS var values — getComputedStyle() is called in graph render loops (per node/edge),
// so we avoid repeated style lookups and invalidate on theme change.
const cssVarCache = new Map<string, string>();
ThemeService.subscribe(() => cssVarCache.clear());

/** Read a CSS custom property value from the document body (for JS-driven rendering like vis-network). */
export function getCssVar(name: string, fallback: string = ""): string {
    let value = cssVarCache.get(name);
    if (value === undefined) {
        value = getComputedStyle(document.body).getPropertyValue(name).trim();
        cssVarCache.set(name, value);
    }
    return value || fallback;
}

export const reducedMotionStyles = css`
    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }
`;

/** Standalone `.chip-list`/`.chip` styling, reused anywhere a compact tag/label needs the same pill look. */
export const chipListStyles = css`
    .chip-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .chip {
        font-size: 0.85rem;
        color: var(--md-sys-color-on-secondary-container);
        background: var(--md-sys-color-secondary-container);
        padding: 4px 10px;
        border-radius: 8px;
    }
`;

/** Bordered panel holding one or more `.info-section` blocks, each optionally listing `.chip`s. */
export const infoPanelStyles = css`
    ${chipListStyles}

    .info-panel {
        background-color: var(--md-sys-color-surface-container);
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 12px;
        padding: 14px 16px;
    }

    .info-section + .info-section {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .info-section-header {
        font-weight: 500;
        color: var(--md-sys-color-on-surface);
        margin-bottom: 10px;
    }
`;

export const notFoundStyles = css`
    .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 16px;
        gap: 16px;
        color: var(--md-sys-color-on-surface-variant);
    }

    .not-found ha-svg-icon {
        --icon-primary-color: var(--md-sys-color-error);
        width: 48px;
        height: 48px;
    }

    .not-found p {
        margin: 0;
        font-size: 1.1rem;
    }
`;
