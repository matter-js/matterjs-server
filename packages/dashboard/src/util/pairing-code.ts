/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import qrcode from "qrcode-generator";

/**
 * Format a Matter manual pairing code for display. The 11-digit short code is
 * grouped as `XXXX-XXX-XXXX` per the Matter spec; codes of any other length are
 * returned stripped to their digits, or unchanged when they contain no digits.
 */
export function formatManualPairingCode(code: string): string {
    const digits = code.replace(/\D/g, "");
    if (digits.length === 11) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
    return digits || code;
}

/**
 * Render a Matter QR pairing payload (the `MT:...` string) as an SVG data URI.
 * The generated SVG carries an opaque white background, so the code stays
 * scannable regardless of the surrounding theme.
 */
export function renderPairingQrCodeDataUri(qrPayload: string, cellSize = 5, margin = 4): string {
    const qr = qrcode(0, "M");
    qr.addData(qrPayload);
    qr.make();
    return `data:image/svg+xml,${encodeURIComponent(qr.createSvgTag(cellSize, margin))}`;
}
