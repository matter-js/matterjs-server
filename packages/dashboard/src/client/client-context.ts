/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import type { MatterClient } from "@matter-server/ws-client";

export const clientContext = createContext<MatterClient>("client");
