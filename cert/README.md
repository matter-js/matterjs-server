# Certification tests

## Running

`npm run cert` (`cert/run-cert.mjs`) runs the matter.js controller certification suite (`support/chip-testing/test/cert`) against this server as the device-under-test controller. The matter.js adapter starts the server itself with a temporary storage path and a free port, so your normal storage is not touched.

```bash
npm run cert -- [--tc TC-IDM-2.1] [--matterjs-ref <ref>] [--device chip-local|matterjs] [--dry-run]
```

Steps: build this repo, clone (or fetch) matter.js into `.cert/matter.js` (git-ignored), check out the ref, `npm ci && npm run build` there, then run the tests. The exit code is the test exit code; a failing step prints its name and exits with that step's exit code, or with 1 when it was killed by a signal or could not start. An invalid argument exits with 2 before any step runs. Nested steps get your environment without the variables `npm run` sets about its own invocation (`npm_lifecycle_*`, `npm_package_*`, `npm_config_local_prefix`, `npm_config_user_agent` and a few more); your other `npm_config_*` settings pass. `PATH` keeps the `node_modules/.bin` entries `npm run` added for this repo.

- `--tc <id>`: run only `test/cert/<id>.test.ts` (default: the whole suite). The id is `TC-` followed by letters, digits, `.`, `-` or `_`, for example `TC-IDM-2.1`.
- `--matterjs-ref <ref>`: matter.js branch, tag or commit to test. Overrides the `MATTERJS_REF` environment variable. Default: the commit of the pinned `@matter/main` dev version, or the tag `v<version>` for an exact release version. A version range (`^0.17.0`) is not a valid ref and is refused; pass `--matterjs-ref` then.
- `--dry-run`: print the planned steps as one JSON object per line and run nothing. It still checks the arguments, the ref and the platform, and on macOS with `chip-local` that `MATTER_CERT_APP_DIR` is set.
- `--device <chip-local|matterjs>`: the test devices the suite commissions (default `chip-local`). `chip-local` runs the CHIP example apps; `matterjs` runs matter.js test devices and needs no CHIP apps, so neither the `cert-bins` image nor `MATTER_CERT_APP_DIR`.
- `MATTER_CERT_APP_DIR` (macOS only, required with `chip-local`): directory with the locally built CHIP example apps.
- Evidence is written to `.cert/evidence`.
- The checkout always ends detached at the current remote state of the ref (branch, tag or commit), discarding changes to tracked files in `.cert/matter.js`; untracked files stay. A ref of 7 to 40 lowercase hex characters is taken as a commit sha: all branches and tags are fetched, and tags moved upstream are updated. A short commit sha must be reachable from a remote branch or tag; only a full 40-character sha can be fetched on its own.
- `RUN_CERT_TEST_PLATFORM=linux|darwin`, `RUN_CERT_TEST_DIR`, `RUN_CERT_TEST_MATTERJS_URL`, `RUN_CERT_TEST_PACKAGE_JSON` and `RUN_CERT_TEST_SOURCE_ONLY=1` are for testing the runner only.

Prerequisites: Docker running for every cert run, for the test harness containers; on Linux with `chip-local` the CHIP binaries are also extracted from the `cert-bins` image, which exists for `linux/arm64` only, so this needs an arm64 host (`cert/run-cert.mjs` sets `MATTER_CHIP_PLATFORM=linux/arm64`). On macOS with `chip-local` the locally built CHIP apps in `MATTER_CERT_APP_DIR` run as host processes.

## Running on a Raspberry Pi or another arm64 Linux host

`chip-cert-bins` exists for `linux/arm64` only, so an arm64 Linux host runs the `chip-local` flavor with the official
CHIP apps natively, as the CI does. These steps start from a fresh Ubuntu 24.04 (arm64), for example on a Raspberry Pi
4. Use an SSD (64 GB or more: the Docker images and two `node_modules` trees are large) and a wired network: the test
devices and the server find each other over mDNS on that interface.

1. Base packages. `avahi-daemon` is required for `chip-local`, because the CHIP apps publish through the platform's
   mDNS responder.

    ```bash
    sudo apt update && sudo apt full-upgrade -y
    sudo apt install -y git curl ca-certificates build-essential python3 avahi-daemon
    sudo systemctl enable --now avahi-daemon
    ```

2. Node.js 24:

    ```bash
    sudo apt-get install -y curl
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

3. BLE (optional, the cert suite does not use it):

    ```bash
    sudo apt install -y libcap2-bin bluetooth bluez libbluetooth-dev libudev-dev make g++
    sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
    ```

4. Docker; every cert run needs it for the test harness containers:

    ```bash
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER   # then log out and in again
    docker run --rm hello-world
    ```

5. Memory. Building the matter.js monorepo peaks at about 1.4 GB, the server at about 0.8 GB. With 4 GB of RAM this
   fits; with less, add swap and set `GOMEMLIMIT` (read by the native TypeScript type checker the build runs), which
   cut the matter.js peak to about 1.1 GB in a measurement, at a slightly longer build time:

    ```bash
    sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
    sudo mkswap /swapfile && sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    export GOMEMLIMIT=1GiB
    ```

6. Check out and run, either a release tag (`git tag -l 'v*'` lists them) or `main`:

    ```bash
    git clone https://github.com/matter-js/matterjs-server.git && cd matterjs-server
    git checkout v1.5.0   # a release tag, for example; leave out to run main
    npm ci

    export MATTER_MDNS_NETWORKINTERFACE=eth0   # the interface the test devices are on
    export MATTER_CERT_TH_SERVER_APP_PATH=/official-chip-bins/chip-all-clusters-app-nlfaultinject   # TC-SC-3.5, TC-DA-1.9
    export MATTER_CERT_OTA_FAST_RETRY=1
    npm run cert -- --device chip-local
    ```

The first run pulls the images and builds matter.js and takes long; the whole suite takes about 13 minutes on the CI
arm64 runner and longer on a Raspberry Pi. No other Matter device on the network should advertise with the default
passcode or discriminator 3840, and only one cert run may be active at a time.

## Server configuration

The matter.js adapter (`support/chip-testing/src/matter-server/matter-server-process.ts`) starts the server with these
options:

| Option | Why |
| --- | --- |
| `--disable-auto-subscription` | The tests check which Read and Subscribe requests the controller sends. The server's own subscription and background traffic (polling, time synchronization, OTA checks, Border Router discovery) would add requests the test does not expect. The adapter subscribes with `subscribe` where a test step needs it. |
| `--enable-test-net-dcl` | The test devices carry test attestation certificates, which the server accepts only with this flag. |
| `--dcl-offline` | Runs do not depend on DCL availability, and attestation uses the bundled DCL seed. |
| `--log-level debug` | Many test steps are checked in the server log, so the evidence needs the full log. |
| `--storage-path <temp dir>` | Every run starts with a new fabric and leaves your normal storage untouched. |
| `--listen-address 127.0.0.1`, `--port 0` | Only the local adapter connects, and a free port avoids collisions with other servers. The adapter reads the port from the `Webserver listening on …` log line. |
| `--primary-interface <if>` | Only when the harness names one, so mDNS uses the interface the test devices are on. |

Besides `read`, `subscribe` and the commissioning commands, the adapter uses `start_listening`,
`enable_auto_subscription` and the OTA image upload endpoint `POST /ota-upload/<upload_id>`.

## CI

`.github/workflows/cert-controller.yml` runs on manual dispatch and on every release PR (`release-npm.yml`, both device
flavors, before the release is merged). By default it runs `chip-local` with the official `chip-cert-bins` apps on an
arm64 runner, because `chip-cert-bins` is published for `linux/arm64` only. Inputs:

- `matterjs-ref`: matter.js branch, tag or commit with the certification suite. Empty (default): the matter.js
  version this server uses.
- `device`: `chip-local` (default) or `matterjs`, which runs matter.js test devices on an amd64 runner.
- `chip-bins-tag`: `chip-cert-bins` image tag (`MATTER_CHIP_BINS_TAG`); empty uses the matter.js default, `latest`
  the newest published image.
- `tc`: run a single test case.

Runs with different inputs do not cancel each other. The evidence artifact is named `cert-evidence-<device>`.

`.github/workflows/matterjs-nightly-validation.yml` also calls it for both device flavors whenever a new matter.js
nightly is available: it first updates the server to that nightly and then runs that version's suite (artifact
`cert-evidence-<device>-nightly`). A manual run with `force-cert` runs the suite even when the server already uses the
newest nightly.
