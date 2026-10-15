/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { UnexpectedDataError } from "@matter/main";
import {
    ManualPairingCodeCodec,
    ManualPairingData,
    QrCodeData,
    QrPairingCodeCodec,
    ValidationError,
} from "@matter/main/types";
import { ServerError, ServerErrorCode } from "../types/WebSocketMessageTypes.js";

/** A decoded onboarding payload: the payloads of a QR code, or a manual pairing code. */
export type OnboardingPayload = { type: "qr"; payloads: QrCodeData[] } | { type: "manual"; payload: ManualPairingData };

/** Whether `code` is a QR code payload; any other code is read as a manual pairing code. */
export function isQrCode(code: string): boolean {
    return code.startsWith("MT:");
}

export function decodeQrCode(code: string): QrCodeData[] {
    return decodePairingCode(() => QrPairingCodeCodec.decode(code));
}

export function decodeManualCode(code: string): ManualPairingData {
    return decodePairingCode(() => ManualPairingCodeCodec.decode(code));
}

/** Decodes `code` as commissioning reads it, without contacting any device. */
export function decodeOnboardingPayload(code: string): OnboardingPayload {
    return isQrCode(code)
        ? { type: "qr", payloads: decodeQrCode(code) }
        : { type: "manual", payload: decodeManualCode(code) };
}

function decodePairingCode<T>(decode: () => T): T {
    try {
        return decode();
    } catch (error) {
        // The decoder sees only values taken from the code, so a ValidationError also means a malformed code.
        if (error instanceof UnexpectedDataError || error instanceof ValidationError) {
            throw new ServerError(
                ServerErrorCode.InvalidArguments,
                `Invalid pairing code: ${error.message}`,
                error,
                "invalid-payload",
            );
        }
        const cause = error instanceof Error ? error : undefined;
        throw ServerError.sdkStackError(
            `Could not process the pairing code: ${cause?.message ?? String(error)}`,
            cause,
        );
    }
}
