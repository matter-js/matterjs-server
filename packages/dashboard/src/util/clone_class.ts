/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export const clone = (orig: any) => Object.assign(Object.create(Object.getPrototypeOf(orig)), orig);
