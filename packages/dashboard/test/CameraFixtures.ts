/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraCapabilitiesResult } from "@matter-server/ws-client";

export function capabilities(overrides: Partial<CameraCapabilitiesResult> = {}): CameraCapabilitiesResult {
    return {
        features: ["Audio", "Video", "Snapshot"],
        privacy: {},
        video: { rate_distortion_points: [], codecs: ["H264"] },
        audio: { codecs: ["OPUS"], sample_rates: [48000], bit_depths: [16] },
        snapshot: { capabilities: [] },
        limits: { supported_stream_usages: ["LiveView"], stream_usage_priorities: ["LiveView"] },
        allocated: { video: [], audio: [], snapshot: [] },
        sessions: [],
        ...overrides,
    };
}
