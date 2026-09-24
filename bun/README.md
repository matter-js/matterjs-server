# matter-server as a single compiled Bun binary

Builds the published `matter-server` npm package into **one self-contained executable** with `bun build --compile`, on
top of `debian:trixie-slim`. The runtime image has no Node, no Bun and no `node_modules`: just the binary, `curl` and
`ping`.

It is meant for small hosts such as a Raspberry Pi running Home Assistant, where image size matters. It is an
alternative to `docker/matterjs-server/Dockerfile`, not a replacement, and it comes with the limitations listed under
[Trade-offs](#trade-offs).

## Usage

Build from the repository root, because the image reuses `docker/matterjs-server/healthcheck.sh`:

```sh
docker build -f bun/Dockerfile -t matter-server-bun .

docker run -d --name matter-server --network host \
  -v /path/to/data:/data matter-server-bun
curl http://localhost:5580/health     # -> {"version":"1.4.0","node_count":0}
```

Configuration works the same as for the regular image. Use environment variables or append CLI arguments, for example
`docker run ... matter-server-bun --primary-interface eth0`. See [docs/docker.md](../docs/docker.md) for all options.

The server version is baked into the binary at build time. To pin it, use:

```sh
docker build --build-arg MATTERJS_SERVER_VERSION=1.4.0 -f bun/Dockerfile -t matter-server-bun .
```

As in the regular image, the process runs as UID/GID `1000`, so a bind-mounted data directory must be writable by
that user.

## Footprint

|                      | Node 22 | `bun` + `node_modules` | compiled binary |
| -------------------- | ------: | ---------------------: | --------------: |
| Image                |  615 MB |                 507 MB |      **207 MB** |
| RSS, idle            |  185 MB |                 248 MB |          186 MB |
| `node_modules`       |  330 MB |                 330 MB |        **none** |
| Executable           |       — |                      — |           88 MB |
| Time to `/health` ok |    ~2 s |                   ~2 s |            ~2 s |

**Disk:** the compiled image is about a third the size of the Node image (−66 %) and about 40 % of the uncompiled Bun
image (−59 %). It ships as a single file with nothing to resolve at startup.

**Memory:** there is no real difference from Node (186 vs 185 MB). Compiling only removes Bun's own interpreter
overhead: uncompiled Bun idles about 60 MB above both. If you are on Node today and want to save RAM, this will not
help. The reasons to use it are image size, a single-file deploy, and having no runtime or `node_modules` in the image.

<details>
<summary>How these were measured</summary>

All three variants run the same `matter-server` 1.4.0 with the dashboard and DCL seed disabled and no commissioned
nodes. The baselines are `node:22-slim` + `npm install` (Node v22.23.2) and `oven/bun:1-slim` + `bun add`. Each
installs `matter-server@1.4.0` and starts `node_modules/matter-server/dist/esm/MatterServer.js` with its own
runtime.

```sh
docker build --platform linux/arm64 -f bun/Dockerfile -t bun-compiled .
docker run -d --name c -p 15580:5580 bun-compiled
curl -s localhost:15580/health
docker exec c grep VmRSS /proc/1/status
docker images

# node_modules size, on the baselines only
docker run --rm --entrypoint du <baseline-image> -sh /app/node_modules
```

The platform was `linux/arm64` on a macOS VM (5 CPUs / 2 GiB), with three RSS samples taken 4 s apart after the
health check passed. Absolute numbers depend on the host because the JS heap sizes itself to the available memory.
For example, the compiled image idles at about 141 MB RSS on a 512 MB Raspberry Pi Zero 2 W. Rely on the ratios more
than the absolute values.

</details>

## Why the patch

A binary built with `bun build --compile` resolves `import.meta.url` to `/$bunfs/...`. As a result, the `package.json`
lookups in `cli.js` and `version.js` resolve to `/package.json` on the real filesystem, and the unpatched binary
crashes on startup:

```
ENOENT: no such file or directory, open '/package.json'
      at /$bunfs/root/matter-server:101745:42
```

`compile-patch.mjs` replaces those two lookups with the pinned version string. It requires each exact source line to
appear exactly once. If an upstream change breaks that, the **build fails** instead of producing a broken binary. In
that case, read the new upstream code, adjust the anchors, and re-pin the version.

## Trade-offs

The compiled binary contains only JavaScript. Anything `matter-server` reads from `node_modules` on disk at runtime is
missing, so the image sets these defaults:

- `DISABLE_DASHBOARD=true`: the dashboard assets are not available. Use Home Assistant or another client as the UI.
- `DISABLE_DCL_SEED=true`: the bundled offline DCL seed is not available. Vendor and certificate data is fetched from
  the network DCL instead, so the container **needs internet access at startup**.

Both are set as environment variables, not CLI arguments, so they stay in effect when you pass extra arguments to
`docker run`. Do not override them.

BLE is not supported because the native `noble` bindings are not built. Commission devices with the Home Assistant
companion app or another controller, then share them to this server.
