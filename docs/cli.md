# Matter Server CLI

Matter Controller Server using WebSockets.

## Usage

```bash
# Start server with defaults
npm run server

# With options
npm run server -- --port 5580 --storage-path ~/.matter_server

# Bind to specific interface
npm run server -- --listen-address 192.168.1.100

# Enable BLE commissioning (Linux with bluetooth adapter)
npm run server -- --bluetooth-adapter 0
```

When the server is installed from npm, `npx matter-server` takes the same options without the extra `--`, for example `npx matter-server --port 5580`.

---

## Complete Argument Specification

| Argument                     | Type         | Default          | Required | Description                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------ | ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| --vendorid                   | integer      | 0xFFF1 (65521)   | No       | Vendor ID for the Fabric                                                                                                                                                                                                                                             |
| --fabricid                   | integer      | (random)         | No       | Fabric ID for the Fabric (random if not specified)                                                                                                                                                                                                                   |
| --storage-path               | string       | ~/.matter_server | No       | Storage path to keep persistent data                                                                                                                                                                                                                                 |
| --port                       | integer      | 5580             | No       | TCP Port for WebSocket server. `0` binds a free port chosen by the OS (shared by all `--listen-address` TCP listeners); the bound port is in the `Webserver listening on …` log line                                                                                |
| --listen-address             | string[]     | null (bind all)  | No       | IP address(es), interface name(s) or absolute unix socket path(s) to bind WebSocket server. Repeatable — env `LISTEN_ADDRESS` (comma-separated).                                                                                                                                                                                                                 |
| --log-level                  | enum         | "info"           | No       | Global logging level                                                                                                                                                                                                                                                 |
| --log-file                   | string       | null             | No       | Log file path incl. filename, e.g. `/data/matter-server.log`                                                                                                                                                                                                         |
| --primary-interface          | string       | null             | No       | Primary network interface for link-local addresses                                                                                                                                                                                                                   |
| --default-fabric-label       | string       | null             | No       | Pin the fabric label to this value and ignore `set_default_fabric_label` WebSocket requests — env `DEFAULT_FABRIC_LABEL`. Prevents multiple clients from overwriting each other's label.                                                                             |
| --enable-test-net-dcl        | boolean flag | false            | No       | Enable test-net DCL to check for certificates and OTA-updates additionally to the production DCL                                                                                                                                                                     |
| --disable-dcl-seed           | boolean flag | false            | No       | Disable bundled offline DCL seed (PAA roots, CD signers, vendors); rely on network DCL only                                                                                                                                                                          |
| --dcl-offline                | boolean flag | false            | No       | Never contact the DCL: attestation trusts the bundled DCL seed (PAA roots, CD signers) and certificates stored by earlier runs and skips DCL revocation checks (sets from `--revocation-sets-dir` still apply), vendor names come from the seed and storage, and OTA update checks do not query the DCL. Cannot be combined with `--disable-dcl-seed` |
| --revocation-sets-dir        | string       | null             | No       | Directory with device attestation revocation sets, installed at every start before commissioning is possible — env `REVOCATION_SETS_DIR`. Reads every `*.json` file: a JSON array of entries as CHIP's `credentials/generate_revocation_set.py` writes them (`issuer_subject_key_id` hex, `issuer_name` base64 DER, `revoked_serial_numbers` hex list; `crl_signer_cert` and `crl_signer_delegator` are ignored). An invalid file is skipped with an error. Works with and without `--dcl-offline`. See [Installing Device Attestation Revocation Sets](../README.md#installing-device-attestation-revocation-sets) |
| --certificates-dir           | string       | null             | No       | Directory with PAA certificates to import at every start — env `CERTIFICATES_DIR`. Reads `*.paa.der` and `*.paa.pem` files and deletes each file after import; a file that fails stays. Imported as test certificates (trusted only with `--enable-test-net-dcl`), as production certificates when the name ends in `.prod.paa.der` or `.prod.paa.pem`. See [Importing Custom PAA Certificates](../README.md#importing-custom-paa-certificates) |
| --bluetooth-adapter          | integer      | null             | No       | Bluetooth adapter HCI ID (e.g., 0 for hci0). On Windows and macOS the ID is optional. Mutually exclusive with `--ble-proxy`.                                                                                                                                         |
| --ble-proxy                  | boolean flag | false            | No       | Expose `/ble` WebSocket endpoint for a remote BLE proxy client. Mutually exclusive with `--bluetooth-adapter` (--ble-proxy wins).                                                                                                                                    |
| --disable-ota                | boolean flag | false            | No       | Disable OTA update functionality                                                                                                                                                                                                                                     |
| --ota-provider-dir           | string       | null             | No       | Directory for OTA Provider files                                                                                                                                                                                                                                     |
| --ota-upload-max-in-flight   | integer      | 5                | No       | Maximum number of OTA firmware uploads (`POST /ota-upload/<upload_id>`, schema 13+) that may be reserved or transferring at once — env `OTA_UPLOAD_MAX_IN_FLIGHT`                                                                                                     |
| --ota-upload-max-size-mb     | integer      | 64               | No       | Maximum size in MB of an uploaded OTA firmware image — env `OTA_UPLOAD_MAX_SIZE_MB`. Uploads are staged in an `ota-uploads` subdirectory of `--ota-provider-dir` (or of `--storage-path` when that is not set) and deleted after import                               |
| --disable-dashboard          | boolean flag | false            | No       | Disable the web dashboard                                                                                                                                                                                                                                            |
| --production-mode            | boolean flag | false            | No       | Force dashboard production mode (for reverse proxy)                                                                                                                                                                                                                  |
| --disable-thread-diagnostics | boolean flag | false            | No       | Disable the Thread Network diagnostics feature (Border Router mDNS discovery, REST/CoAP probing and diagnostic queries, plus the periodic refresh of node neighbor/route tables) — env `DISABLE_THREAD_DIAGNOSTICS`. Matter-over-Thread commissioning is unaffected. |
| --thread-rest-probe-port     | integer      | 8081             | No       | TCP port of the OTBR REST API probed on discovered Thread Border Routers — env `THREAD_REST_PROBE_PORT`. Set it when the Border Router exposes its REST API on another port (e.g. `8080`). A wrong port costs probe time on every discovered Border Router before the probe gives up and the network falls back to CoAP. |
| --enable-time-sync           | boolean flag | false            | No       | Enables automatic time synchronization for devices that support it (env `ENABLE_TIME_SYNC`). Only enable when the host clock is reliably synced (e.g., NTP); pushes UTC time + time zone / DST.                                                                      |
| --custom-cluster-poll-interval | integer    | 60               | No       | Interval in seconds for polling custom cluster attributes that do not support Matter subscriptions (legacy Eve Energy devices) — env `CUSTOM_CLUSTER_POLL_INTERVAL`. Accepts 60 to 86400; raise it (e.g. `300`, `600`) to cut periodic Thread traffic on networks with many such devices, at the cost of less current energy readings. |
| --disable-auto-subscription  | boolean flag | false            | No       | Do not subscribe to nodes automatically, neither after commissioning nor on start, and stop the subscriptions of already commissioned nodes — env `DISABLE_AUTO_SUBSCRIPTION`. You are responsible for subscribing as needed (WebSocket `subscribe`/`unsubscribe` and the per-node `enable_auto_subscription`/`disable_auto_subscription` are only available with it); only recommended for very special use cases. See [Disabled auto subscription](#disabled-auto-subscription). |

> **Log rotation:** `--log-file` must be a full file path including the filename. The log is rotated
> every 24 hours, and on each startup: backups are shifted (`.6`→`.7`, …, `.1`→`.2`, current→`.1`),
> keeping up to seven daily backup files (≈ 7 days of history). No further cleanup is performed.

> [!WARNING]
> **Security:** By default the WebSocket server binds to **all network interfaces**, making it
> reachable by any host on your network. You are responsible for securing access according to your
> requirements and use-case. Use `--listen-address` to restrict binding to a specific interface
> (e.g. `--listen-address 127.0.0.1` for localhost-only), and use `--primary-interface` to control
> which interface Matter mDNS announcements and communication use (e.g. `--primary-interface eth0`).
> Additionally consider firewall rules, VPN, or reverse-proxy authentication in front of the server.

### Disabled auto subscription

With `--disable-auto-subscription` the server never sends a Subscribe request on its own. Commissioning still
reads the full node once, so `commission_with_code` / `commission_on_network` return a complete node, and
`interview_node` still performs a full read. Otherwise node data only changes through the reads you issue. What
a fabric-filtered read such as `interview_node` returns is applied to the node, so `get_node` and
`attribute_updated` events reflect it, including endpoints the read discovered.

The WebSocket commands `subscribe`, `unsubscribe`, `enable_auto_subscription` and `disable_auto_subscription` are
only available with this setting; `read` works in both modes. `enable_auto_subscription` switches the server's own
subscription to one node on until the next start and returns once that subscription is active, so reports,
connection state and `register_icd` work for that node as without this setting; `subscribe` is then refused for
that node.

Without the server's own subscription matter.js never reports a node as connected; a subscription a client opens
with `subscribe` does not change that. Such a node stays `available` unless the server finds it unreachable.
`remove_node` always tries to tell the device to remove the fabric, also for a node switched on with
`enable_auto_subscription`, and removes the node only locally when that fails, so removing an unreachable node
takes the full discovery and retry time before it returns. The server's background jobs stay off for all nodes,
also for those switched on with `enable_auto_subscription`:

- fabric label changes are not pushed to the device; matter.js itself still updates a stale label once when the
  server's subscription to a node first comes up
- time synchronization, custom cluster polling and the Thread neighbor/route refresh do not run
- the OTA provider does not check the DCL for updates on its own (otherwise 5 to 10 minutes after the start and
  then every 24 hours); matter.js only offers updates to nodes with the server's own subscription, so for other nodes
  `check_node_update` returns `null` and `update_node` fails, unless an update was found while the node was still
  subscribed. Stored OTA files that no node needs anymore are not deleted either, because that cleanup runs with the
  update check.
- Thread Border Routers are not discovered and probed for a REST API until a client sends
  `get_thread_border_routers`, `get_thread_diagnostics` or `get_network_topology`; from then on discovery keeps
  running and every newly found Border Router is probed

Devices can still contact the server on their own, for example to ask the OTA provider for an update.

For a node without the server's own subscription:

- `register_icd` fails, because matter.js only registers while the server's own subscription is active
- `resync_icd` only drops the local ICD registration; a LIT device re-registers only once the server's own
  subscription is active again, through `enable_auto_subscription` or with the setting turned off

The setting is applied to every stored node on each start, which also switches off every node enabled with
`enable_auto_subscription`. Starting again without it restores the automatic subscriptions.

### Readiness line

Each TCP or unix socket listener logs one line once it accepts WebSocket connections on `/ws`:

```
Webserver listening on http://<host>:<port>
Webserver listening on unix socket <path>
```

`<port>` is the bound port, also with `--port 0`. Tools may wait for this line and read the port from the text after
the last `:` (IPv6 hosts are not bracketed). Its wording is a contract: a change to it is a breaking change. The line
is logged at level `notice`, so a tool waiting for it needs `--log-level` at `notice` or a lower level.

### Behavioral Differences from Python Matter Server

| Option     | Python Default | Matter.js Default | Notes                                                   |
| ---------- | -------------- | ----------------- | ------------------------------------------------------- |
| --fabricid | 1              | (random)          | Matter.js generates a random fabric ID if not specified |

### Deprecated Options (were used in Python Matter Server)

The following Python Matter Server options are **not supported** in the Matter.js implementation:

| Option                        | Reason Not Applicable                                    |
| ----------------------------- | -------------------------------------------------------- |
| --log-level-sdk               | Matter.js uses unified logging (use --log-level instead) |
| --paa-root-cert-dir           | DCL certificates are handled internally by matter.js; import own PAA certificates with `--certificates-dir` |
| --log-node-ids                | Not supported in matter.js logging infrastructure        |
| --disable-server-interactions | Not applicable to matter.js architecture                 |

## Advanced matter.js Configuration

The underlying matter.js library exposes additional configuration options via `MATTER_*` environment
variables. These follow the pattern `MATTER_<KEY>` where the key maps to a dot-notation config path
(e.g. `MATTER_LOG_LEVEL` → `log.level`). Some settings overlap with the CLI options documented above,
so you should ideally use the CLI options instead.

A useful example is specifying a self-hosted node of the Matter CSA Device Certificate Ledger (DCL) for professional use:

```bash
MATTER_DCL_PRODUCTIONURL=https://on-ledger.dcl.my-company.example
```

For the full list of supported variables refer to the
[matter.js `NodeJsEnvironment` source](https://github.com/project-chip/matter.js/blob/main/packages/nodejs/src/environment/NodeJsEnvironment.ts)
and the
[matter.js `VariableService` source](https://github.com/project-chip/matter.js/blob/main/packages/general/src/environment/VariableService.ts)
(contains the base set of variables available in all environments).

---

## Enum Values

**--log-level** (case-insensitive):

- critical
- error
- warning
- info (default)
- debug
- verbose

---

## Multi-Value Arguments

**--listen-address** - Repeatable flag pattern:

```bash
npm run server -- --listen-address 192.168.1.100 --listen-address "::1"
```

The `LISTEN_ADDRESS` environment variable takes the same addresses as a comma-separated list (`LISTEN_ADDRESS=192.168.1.100,::1`).

A value starting with `/` is a unix socket path (Linux and macOS, at most 107 bytes on Linux and 103 on macOS). `--port` does not apply to it, and the socket file is created with the process umask, so only users with write permission on it can connect. A socket file left behind by an unclean shutdown is removed on the next start. A socket that still accepts connections, or any other file at that path, makes startup fail.

```bash
npm run server -- --listen-address 127.0.0.1 --listen-address /run/matter-server/ws.sock
```

The Python client connects with the server URL `unix:///run/matter-server/ws.sock`. Other clients need a WebSocket library with unix socket support, for example the Node.js `ws` package with `ws+unix:///run/matter-server/ws.sock:/ws`. The OTA upload of `@matter-server/ws-client` does not work over a unix socket. The BLE proxy endpoint (`--ble-proxy`) is not usable through a unix socket from Home Assistant: it derives the `/ble` URL only from a `ws://…/ws` server URL, and `matter-ble-proxy` connects over TCP. Keep a TCP listen address next to the socket when you need the BLE proxy.

---

## Bluetooth Adapter (BLE Commissioning)

The `--bluetooth-adapter` option enables BLE commissioning for Matter devices. It expects the **HCI ID** (integer) of your Bluetooth adapter, not a device path.

Windows and macOS have no HCI IDs, so there `--bluetooth-adapter` can be given without a value to enable BLE, or set as `BLUETOOTH_ADAPTER=true` in the environment. The server then uses the system's Bluetooth adapter. `BLUETOOTH_ADAPTER=false` or an empty value leaves BLE off on every platform.

### Finding Your HCI ID

On Linux, list available Bluetooth adapters:

```bash
# Using hciconfig
hciconfig -a

# Or check sysfs
ls /sys/class/bluetooth/
# Output: hci0  hci1  ...
```

The number after `hci` is the ID to use:

- `hci0` → `--bluetooth-adapter 0`
- `hci1` → `--bluetooth-adapter 1`

### Example

```bash
# Enable BLE commissioning with the first Bluetooth adapter (hci0)
npm run server -- --bluetooth-adapter 0
```

### Note

This is different from Thread Border Routers which use serial device paths (e.g., `/dev/ttyUSB0`). On Linux, BLE commissioning uses the system's Bluetooth HCI interface. On Windows and macOS it uses the operating system's Bluetooth API.

---

## Storage Format

Matter.js uses its own native storage format but supports migration from Python Matter Server.

On startup, legacy Python storage files are read and migrated when needed:

- `chip.json` - Chip configuration (fabric credentials)
- `{fabricId}.json` - Node data and vendor info

`{fabricId}.json` is updated when nodes are added or removed, so you can switch back to the Python Matter Server with the same storage path.

See the [migration guide](migration.md) for backups, the first start, switching back, and troubleshooting.
