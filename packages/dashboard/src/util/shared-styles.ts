/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

/** Read a CSS custom property value from the document body (for JS-driven rendering like vis-network). */
export function getCssVar(name: string, fallback: string = ""): string {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
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
