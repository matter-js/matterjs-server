# Matter Server (matter.js) as a single compiled Bun binary.
#
# The builder installs the published matter-server npm package, bakes the pinned
# version in (see compile-patch.mjs: compiled binaries resolve import.meta.url to
# /$bunfs/..., which breaks the package.json lookups), and compiles everything
# into one executable. The final stage is plain debian slim + curl/ping - no Node,
# no Bun runtime, no node_modules. See bun/README.md for sizes and trade-offs.
#
# Build from the repository root (the healthcheck script is shared with docker/):
#   docker build -f bun/Dockerfile -t matter-server-bun .

ARG MATTERJS_SERVER_VERSION=1.4.0
ARG BUN_VERSION=1

FROM oven/bun:${BUN_VERSION}-slim AS builder

WORKDIR /build
ARG MATTERJS_SERVER_VERSION
COPY bun/compile-patch.mjs ./
RUN bun add --trust "matter-server@${MATTERJS_SERVER_VERSION}" \
    && bun ./compile-patch.mjs "${MATTERJS_SERVER_VERSION}" \
    && bun build --compile \
        node_modules/matter-server/dist/esm/MatterServer.js \
        --outfile ./matter-server \
    && ls -lh ./matter-server

FROM debian:trixie-slim

# - iputils-ping: required for node ping functionality
# - curl: healthcheck
# - libcap2-bin: provides setcap to grant ping CAP_NET_RAW (purged afterwards)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl iputils-ping libcap2-bin \
    # ping_node runs as the non-root user; CAP_NET_RAW on the binary lets it open
    # an ICMP socket regardless of the host's net.ipv4.ping_group_range.
    && setcap cap_net_raw+ep "$(command -v ping)" \
    && apt-get purge -y --auto-remove libcap2-bin \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir /data \
    && chown 1000:1000 /data

COPY --from=builder /build/matter-server /usr/local/bin/matter-server
COPY --chmod=0755 docker/matterjs-server/healthcheck.sh /usr/local/bin/healthcheck.sh

ENV LOG_LEVEL=info
ENV STORAGE_PATH=/data
# Required for the compiled binary, do NOT turn these off: the dashboard assets
# and the offline DCL seed are read from node_modules on disk, which this image
# does not contain. Set as env (not CMD) so extra CLI args don't drop them.
# With the seed disabled, vendor/cert data is fetched from the network DCL.
ENV DISABLE_DASHBOARD=true
ENV DISABLE_DCL_SEED=true

VOLUME ["/data"]

EXPOSE 5580

# Healthcheck script honours LISTEN_ADDRESS / PORT so it still works when the
# server is bound to a non-localhost address. See script for limitations.
HEALTHCHECK --interval=60s --timeout=10s --start-period=900s --start-interval=5s --retries=6 \
    CMD ["/usr/local/bin/healthcheck.sh"]

USER 1000:1000
ENTRYPOINT ["/usr/local/bin/matter-server"]
CMD []
