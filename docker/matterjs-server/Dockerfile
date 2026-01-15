FROM node:22-bookworm-slim

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /app

# Install required system dependencies
# - iputils-ping: Required for node ping functionality
# - curl: For health checks and general utility
RUN \
    set -x \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        iputils-ping \
        curl \
    && apt-get purge -y --auto-remove \
    && rm -rf \
        /var/lib/apt/lists/* \
        /usr/src/*

# Version of matter-server to install from npm
ARG MATTERJS_SERVER_VERSION

# Install matter-server from npm and optimize image size
RUN \
    set -x \
    && npm install "matter-server@${MATTERJS_SERVER_VERSION}" \
    # Remove corepack (not needed at runtime)
    && npm uninstall -g corepack \
    # Clean npm cache
    && npm cache clean --force \
    # Remove CJS builds from Matter packages (we use ESM only)
    && find ./node_modules -type d -name "cjs" \
        -path "*/@matter/*" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "cjs" \
        -path "*/@project-chip/*" -exec rm -rf {} + 2>/dev/null || true \
    # Remove development/documentation files
    && find ./node_modules -type d -name ".github" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name ".vscode" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -name "*.md" -delete 2>/dev/null || true \
    && find ./node_modules -name "LICENSE*" -delete 2>/dev/null || true \
    && find ./node_modules -name "CHANGELOG*" -delete 2>/dev/null || true \
    # Clean temp directories
    && rm -rf /tmp/* /var/tmp/* /root/.npm /root/.cache

# Environment variables with defaults (all CLI options can be set via env vars)
# See docs/docker.md for full list of available environment variables
ENV LOG_LEVEL=info
ENV STORAGE_PATH=/data

# Data volume for persistent storage
VOLUME ["/data"]

# WebSocket API port
EXPOSE 5580

# Health check - verify the server is responding
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5580/ || exit 1

# Run the matter server directly (all config via environment variables)
ENTRYPOINT ["node", "--enable-source-maps", "/app/node_modules/matter-server/dist/esm/MatterServer.js"]
CMD []
