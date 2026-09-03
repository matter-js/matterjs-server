# matter-server as a single compiled Bun binary

Builds the `matter-server` npm package into **one self-contained executable**
with `bun build --compile`, on top of `debian:trixie-slim`. The runtime image
has no Node, no Bun, and no `node_modules` — just the binary, `curl` and
`ping`.

Written for a Raspberry Pi running Home Assistant, where the stock
`bun + node_modules` image did not comfortably fit.

```sh
podman build -f bun/Dockerfile -t matter-server-bun:latest bun/
# or: docker build -f bun/Dockerfile -t matter-server-bun:latest bun/

podman run -d --name matter-server --network host \
  -v /path/to/data:/data matter-server-bun:latest
curl http://localhost:5580/health     # -> ok
```

Pin the version at build time (it is baked into the binary, see below):

```sh
podman build --build-arg MATTER_SERVER_VERSION=1.4.0 -f bun/Dockerfile -t matter-server-bun:latest bun/
```

## Footprint

Compiling removes the Bun runtime and all 330 MB of `node_modules` from the
runtime image, and the binary starts with a smaller heap than the interpreter.

|                      | stock `bun` + `node_modules` | compiled binary |          |
| -------------------- | ---------------------------: | --------------: | -------- |
| Image                |                       507 MB |      **207 MB** | −59 %    |
| RSS, idle            |                       248 MB |      **186 MB** | −25 %    |
| `node_modules`       |                       330 MB |        **none** |          |
| Executable           |                            — |           86 MB |          |
| Time to `/health` ok |                          ~2 s |            ~2 s | no change |

Both images run the same `matter-server` 1.4.0 with the same flags
(`--disable-dashboard --disable-dcl-seed`) and no commissioned nodes. The
baseline is `oven/bun:1-slim` + `bun add matter-server`, started with
`bun run`; a `node:*` baseline would land in the same range.

<details>
<summary>How these were measured (2026-09-04)</summary>

```sh
podman build --platform linux/arm64 -f bun/Dockerfile -t bun-compiled bun/
podman run -d --name c -p 15580:5580 bun-compiled
curl -s localhost:15580/health              # {"version":"1.4.0","node_count":0}
podman exec c sh -c 'grep VmRSS /proc/1/status'
podman images --format '{{.Repository}} {{.Size}}'
```

`linux/arm64`, podman machine on macOS (5 CPUs / 2 GiB), idle with zero
commissioned nodes, three RSS samples 4 s apart after the health check passed.

Numbers move with the host: the same compiled image on a 512 MB Raspberry Pi
Zero 2 W sits closer to 141 MB RSS, because the JS heap sizes itself to
available memory. Treat the *ratio* as the durable result, not the absolute
figures.

</details>

## Why the patch

A `bun build --compile`d binary resolves `import.meta.url` to `/$bunfs/...`,
so `matter-server`'s `package.json` lookups (`cli.ts`, `version.ts`) escape to
the real filesystem root and crash at startup. `compile-patch.mjs` bakes the
pinned version string in instead.

It asserts on the exact upstream source lines it rewrites and **fails the build
loudly** if they change, rather than silently producing a broken binary. If a
version bump fails here, read the new upstream code, adjust the anchors, and
re-pin.

## Trade-offs

The `CMD` flags are not optional — do not drop them:

- `--disable-dashboard` — the dashboard assets are served from disk inside
  `node_modules`, which the compiled binary does not carry. Use Home Assistant
  (or any other client) as the UI.
- `--disable-dcl-seed` — the offline DCL seed files live on disk too. With this
  flag, vendor and certificate data is fetched from the network DCL at boot, so
  the container **needs internet on startup**.

BLE is disabled: the native `noble` postinstall steps are skipped. Commission
devices with the Home Assistant companion app (or another controller) and share
them to this server.

## Relationship to upstream

`main` on this fork tracks `matter-js/matterjs-server` unmodified; this work
lives on its own branch so upstream can be merged without conflicts. Nothing
here patches the server's own source — it installs the published npm package,
rewrites two generated lines, and compiles.
