#!/bin/sh
# Resolves LISTEN_ADDRESS (first non-empty entry of the comma-separated list,
# trimmed like the server does) into a healthcheck URL, falling back to
# localhost. IPv6 literals are bracketed for the URL.
# Limitation: interface names (e.g. "eth0") cannot be resolved to an IP here,
# so the healthcheck will fail when LISTEN_ADDRESS is set to an interface name.
set -euf

port="${PORT:-5580}"
addr=""
IFS=,
for entry in ${LISTEN_ADDRESS:-}; do
    entry=$(printf '%s' "$entry" | tr -d '[:space:]')
    if [ -n "$entry" ]; then
        addr="$entry"
        break
    fi
done
unset IFS
addr="${addr:-localhost}"

case "$addr" in
    *:*) url="http://[$addr]:${port}/health" ;;
    *)   url="http://$addr:${port}/health" ;;
esac

exec curl -fsS -o /dev/null -m 5 "$url"
