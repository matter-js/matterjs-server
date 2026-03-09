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

---

## Complete Argument Specification

| Argument              | Type         | Default          | Required | Description                                                  |
|-----------------------|--------------|------------------|----------|--------------------------------------------------------------|
| --vendorid            | integer      | 0xFFF1 (65521)   | No       | Vendor ID for the Fabric                                     |
| --fabricid            | integer      | (random)         | No       | Fabric ID for the Fabric (random if not specified)           |
| --storage-path        | string       | ~/.matter_server | No       | Storage path to keep persistent data                         |
| --port                | integer      | 5580             | No       | TCP Port for WebSocket server                                |
| --listen-address      | string[]     | null (bind all)  | No       | IP address(es) to bind WebSocket server. Repeatable.         |
| --log-level           | enum         | "info"           | No       | Global logging level                                         |
| --log-file            | string       | null             | No       | Log file path incl. filename, e.g. `/data/matter-server.log` |
| --primary-interface   | string       | null             | No       | Primary network interface for link-local addresses           |
| --enable-test-net-dcl | boolean flag | false            | No       | Enable test-net DCL certificates                             |
| --bluetooth-adapter   | integer      | null             | No       | Bluetooth adapter HCI ID (e.g., 0 for hci0)                  |
| --disable-ota         | boolean flag | false            | No       | Disable OTA update functionality                             |
| --ota-provider-dir    | string       | null             | No       | Directory for OTA Provider files                             |
| --disable-dashboard   | boolean flag | false            | No       | Disable the web dashboard                                    |
| --production-mode     | boolean flag | false            | No       | Force dashboard production mode (for reverse proxy)          |

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

### Behavioral Differences from Python Matter Server

| Option     | Python Default | Matter.js Default | Notes                                                   |
|------------|----------------|-------------------|---------------------------------------------------------|
| --fabricid | 1              | (random)          | Matter.js generates a random fabric ID if not specified |

### Deprecated Options (were used in Python Matter Server)

The following Python Matter Server options are **not supported** in the Matter.js implementation:

| Option                        | Reason Not Applicable                                         |
|-------------------------------|---------------------------------------------------------------|
| --log-level-sdk               | Matter.js uses unified logging (use --log-level instead)      |
| --paa-root-cert-dir           | Handled internally by matter.js DCL client                    |
| --log-node-ids                | Not supported in matter.js logging infrastructure             |
| --disable-server-interactions | Not applicable to matter.js architecture                      |

### Advanced matter.js Configuration

The underlying matter.js library exposes additional configuration options via `MATTER_*` environment
variables. These follow the pattern `MATTER_<KEY>` where the key maps to a dot-notation config path
(e.g. `MATTER_LOG_LEVEL` → `log.level`). Some settings overlap with the CLI options documented above,
so you should ideally use the CLI options instead.

A useful example is specifying a self-hosted node of the Matter CSA Device Certificate Ledger (DCL) for professional use:

```bash
MATTER_DCL_PRODUCTION_URL=https://on-ledger.dcl.my-company.example
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

---

## Bluetooth Adapter (BLE Commissioning)

The `--bluetooth-adapter` option enables BLE commissioning for Matter devices. It expects the **HCI ID** (integer) of your Bluetooth adapter, not a device path.

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

This is different from Thread Border Routers which use serial device paths (e.g., `/dev/ttyUSB0`). BLE commissioning uses the system's Bluetooth HCI interface.

---
## Storage Format

Matter.js uses its own native storage format but supports migration from Python Matter Server.

On startup, legacy Python storage files are read and migrated when needed:
- `chip.json` - Chip configuration (fabric credentials)
- `{fabricId}.json` - Node data and vendor info

Legacy files are kept updated for rollback compatibility - you can switch back to Python Matter Server with the same storage path.

> [!IMPORTANT]
> Please ensure you have a backup of your storage files before switching to Matter.js.
> Additionally, when using the python data files, you must ensure that the python-matter-server with these files is not running at the same time.

The `{fabricId}.json` is also updated when nodes are added or removed, so reflect the changes when you switch back to python.
