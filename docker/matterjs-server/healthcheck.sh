#!/bin/sh
# Resolves LISTEN_ADDRESS (first value if comma-separated) into a healthcheck
# URL, falling back to localhost. IPv6 literals are bracketed for the URL.
# Limitation: interface names (e.g. "eth0") cannot be resolved to an IP here,
# so the healthcheck will fail when LISTEN_ADDRESS is set to an interface name.
set -eu

port="${PORT:-5580}"
listen="${LISTEN_ADDRESS:-}"
addr="${listen%%,*}"
addr="${addr:-localhost}"

case "$addr" in
    *:*) url="http://[$addr]:${port}/health" ;;
    *)   url="http://$addr:${port}/health" ;;
esac

exec curl -fsS -o /dev/null -m 5 "$url"
