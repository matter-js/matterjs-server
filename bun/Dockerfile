# Matter Server (matter.js) as a single compiled Bun binary.
# Builder installs the stock matter-server npm package, bakes the pinned
# version in (see matter-compile-patch.mjs - compiled binaries resolve
# import.meta.url to /$bunfs/..., breaking the package.json lookups), and
# compiles everything to one ~86MB executable. Final stage is plain debian
# slim + curl/ping - no Node, no Bun runtime, no node_modules.
#
# Verified on linux/arm64: WS /ws (server_info/get_nodes/start_listening),
# /health, clean SIGTERM shutdown. 207MB image (vs 531MB bun+node_modules),
# ~141MB RSS idle (vs ~226MB uncompiled).
#
# Trade-offs vs the uncompiled variant, do NOT just drop these flags:
# --disable-dashboard (dashboard assets live on disk in node_modules, the
#   compiled binary can't serve them - HA is the UI anyway)
# --disable-dcl-seed (offline DCL seed files live on disk too - with this flag
#   vendors/certs load from network DCL at boot, needs internet)
# BLE stays disabled (native noble postinstalls skipped); commission via HA app.
ARG MATTER_SERVER_VERSION=1.4.0
FROM oven/bun:1-slim AS builder

WORKDIR /build
ARG MATTER_SERVER_VERSION
COPY compile-patch.mjs ./
RUN bun add --trust "matter-server@${MATTER_SERVER_VERSION}" \
    && bun ./compile-patch.mjs "${MATTER_SERVER_VERSION}" \
    && bun build --compile \
        node_modules/matter-server/dist/esm/MatterServer.js \
        --outfile ./msrv \
    && rm -rf node_modules bun.lock package.json compile-patch.mjs \
    && ls -lh ./msrv

FROM debian:trixie-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl iputils-ping \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir /data \
    && chown 1000:1000 /data

COPY --from=builder /build/msrv /msrv

ENV STORAGE_PATH=/data
ENV PORT=5580
ENV LOG_LEVEL=info

VOLUME ["/data"]

EXPOSE 5580

HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --start-interval=5s --retries=6 \
    CMD curl -fsS -o /dev/null -m 5 "http://localhost:${PORT:-5580}/health" || exit 1

ENTRYPOINT ["/msrv"]
CMD ["--disable-dashboard", "--disable-dcl-seed"]
