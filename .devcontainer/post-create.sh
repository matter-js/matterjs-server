#!/bin/bash
# @license
# Copyright 2025-2026 Open Home Foundation
# SPDX-License-Identifier: Apache-2.0

# Die on error
set -e

# Make the container's node_modules volume writable
sudo chown $USER node_modules

# Install dependencies
npm ci

# Build all packages so the environment is ready to use
npm run build
