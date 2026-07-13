/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import qrcode from "qrcode-generator";

/**
 * Format a Matter manual pairing code for display. The 11-digit short code is
 * grouped as `XXXX-XXX-XXXX` per the Matter spec; other lengths are returned
 * with digits only.
 */
export function formatManualPairingCode(code: string): string {
    const digits = code.replace(/\D/g, "");
    if (digits.length === 11) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
    return digits || code;
}

/**
 * Render a Matter QR pairing payload (the `MT:...` string) as an SVG QR code.
 * Modules are drawn black on a transparent background, so callers must place it
 * on a light surface to stay scannable in dark mode.
 */
export function renderPairingQrCodeSvg(qrPayload: string, cellSize = 5, margin = 4): string {
    const qr = qrcode(0, "M");
    qr.addData(qrPayload);
    qr.make();
    return qr.createSvgTag(cellSize, margin);
}
