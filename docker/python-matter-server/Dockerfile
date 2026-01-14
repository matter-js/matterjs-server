FROM ghcr.io/home-assistant-libs/python-matter-server:8.1.2

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js latest 22.x (mimicking official node Docker image approach)
RUN set -x \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        xz-utils \
    && ARCH=$(dpkg --print-architecture) \
    && cd /tmp \
    && curl -fsSL "https://nodejs.org/dist/latest-v22.x/" | grep -oE "node-v[0-9.]+-linux-${ARCH}.tar.xz" | head -1 | xargs -I{} curl -fsSLO "https://nodejs.org/dist/latest-v22.x/{}" \
    && tar -xJf node-v*-linux-${ARCH}.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
    && rm node-v*-linux-${ARCH}.tar.xz \
    && node --version \
    && npm --version \
    && apt-get purge -y --auto-remove xz-utils \
    && rm -rf /var/lib/apt/lists/* /usr/src/*

# Install matterjs-server from npm
ARG MATTERJS_SERVER_VERSION
WORKDIR /app
RUN set -x \
    && npm install "matter-server@${MATTERJS_SERVER_VERSION}" \
    && npm cache clean --force \
    && find ./node_modules -type d -name "cjs" -path "*/@matter/*" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "cjs" -path "*/@project-chip/*" -exec rm -rf {} + 2>/dev/null || true \
    && rm -rf /tmp/* /var/tmp/* /root/.npm /root/.cache

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV MATTER_SERVER_TYPE=python

VOLUME ["/data"]
EXPOSE 5580

# Using 180s as start-period to allow for the JavaScript server to migrate the data
HEALTHCHECK --interval=60s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:5580/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["--storage-path", "/data"]
