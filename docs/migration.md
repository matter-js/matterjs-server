# Migrating from the Python Matter Server

This server is a drop-in replacement for the [Python Matter Server](https://github.com/matter-js/python-matter-server). It reads the Python data files and migrates them on the first start.

## Before you start

> [!IMPORTANT]
> Back up your Python Matter Server data files before you start this server on them.

> [!IMPORTANT]
> Never run the Python Matter Server and this server on the same data files at the same time. Both would act as the same controller on the same fabric and send conflicting requests to the same nodes.

The Python Matter Server stores its data in two files:

- `chip.json`: the global configuration of your Matter fabric, including IDs, keys, and certificates for secure communication.
- `<long-number>.json`: the list of all nodes in the fabric and their latest data.

Prepare the host as described in the [OS requirements](os_requirements.md), especially the networking part.

## Running the server on the Python data files

### Docker

Use the same data directory and command-line arguments as for the Python Matter Server container. The [docker-compose file](../docker/matterjs-server/docker-compose.yml) maps `${HOME}/.matterjs-server` as data directory by default, so copy the Python data files there before the first start. The container of this server runs unprivileged, so the data directory needs a [permission change](docker.md#permission-issues). See [Running in Docker](docker.md) for all details.

### npm

1. Create a data directory, for example `mkdir ~/matter-data`.
2. Copy `chip.json` and `<long-number>.json` from the Python Matter Server into that directory. If the Python server runs in a Docker container (for example on Home Assistant OS, accessible via the SSH add-on):
    - Find the container with `docker ps`.
    - List the files with `docker exec -it <container-id> ls /data/`.
    - Copy them with `docker cp <container-id>:/data/chip.json ~/matter-data/` and `docker cp <container-id>:/data/<long-number>.json ~/matter-data/`.
3. Install the server as described in the [README](../README.md#manual-installation-from-npm) and start it with `npx matter-server --storage-path ~/matter-data`. If the host has several network interfaces, add `--primary-interface <interface-name>` (for example `eth0` on Linux or `en0` on macOS).

See the [CLI documentation](cli.md) for all parameters and the differences from the Python Matter Server.

## What happens on the first start

1. The server migrates `chip.json` and `<long-number>.json` into the matter.js storage format. This can take some time.
2. The server logs an error that no addresses are known for the nodes. You can ignore it: the Python data files contain no device addresses, so the server discovers them first.
3. On the first successful connection to each node, the server interviews the node completely and updates its data.

Later starts are much faster. The server reuses the last known device addresses and only requests attributes that changed while the server was stopped or the device was offline.

The server detects whether a node uses Thread or WiFi/Ethernet. For Thread devices, it limits the number of parallel requests per Thread network, so the network is not flooded with requests. With many Thread devices, it can take a while after startup until all devices are online.

## How the migration works

The server stores all data in a filesystem-based key/value store in the data directory. Do not edit files in these directories:

- `server` or `server-<fabric ID>-<vendor ID>` (IDs in hex): the controller data, one file per storage key.
- `ota`: downloaded OTA update files. To add your own OTA files, use a separate directory, see [Importing Custom OTA Firmware Files](../README.md#importing-custom-ota-firmware-files).
- `certificates`: downloaded Matter certificate chains, used to validate devices during commissioning.
- `vendors`: the downloaded list of Matter vendors.

The controller certificate authority and the fabric from `chip.json` are migrated into the controller storage (`server`, or `server-<fabric ID>-<vendor ID>`).

The node data from `<long-number>.json` are converted to the matter.js format and written into the controller node storage (`nodes.peerX.endpoints.*`). A node that is already in the storage is skipped, so a start that ended early is completed by the next one.

Once the certificate authority, the fabric and every node from `<long-number>.json` are in the storage, the server renames the Python Matter Server files, see the next section. Data that earlier versions wrote for the migration (the `credentials` context, `node-<NodeID>` data and the `commissionedNodes` list) is removed once its content is in the current layout.

A `server` directory that holds exactly the configured fabric is renamed to `server-<fabric ID>-<vendor ID>` on the next start. The data in it stays the same.

Controller storage that a matter.js controller before version 0.16 wrote is migrated too, when no Python Matter Server data for the configured fabric is present. Place it as `server-<fabric ID>-<vendor ID>` in the data directory: under the name `server`, the server would not find its fabric and would start a new storage.

## Switching back to the Python Matter Server

The server does not write changes back into the Python Matter Server data files. Once the storage holds all of the Python Matter Server data, the server renames `<long-number>.json` to `<long-number>.json.migrated`, and a `<long-number>.json.backup` to `<long-number>.json.backup.migrated`. It renames `chip.json` to `chip.json.migrated` once no other fabric in it still has a node file. Later starts do not read the renamed files.

A node you remove in this server before the files are renamed is migrated again on the next start.

To go back to the Python Matter Server, stop this server and restore the backup from before the migration. Nodes added or removed in this server since then are not in that backup.

## Troubleshooting

### Getting logs

Start the server with `--log-level debug` (Docker: `-e LOG_LEVEL=debug`) to get detailed logs. You can also change the log level at runtime in the dashboard under **Settings**. Attach the complete log when you report an issue.

In Home Assistant, the add-on page shows up to 10,000 lines of the log. For more, use the HA CLI:

```bash
ha apps logs core_matter_server -n 1000000 > /config/matter.log
```

Then download the file from the config folder, for example via the Samba or Studio Code Server add-on.

### Startup takes long

On the first start, every node is discovered and interviewed completely. With many Thread devices, the limit on parallel requests per Thread network makes them come online one after another. Wait until the first start has finished before you judge the startup time.

### The log says the Python Matter Server data is not migrated

The server does not migrate the Python Matter Server data when the storage directory already holds matter.js controller data that does not match it. This happens after a failed migration attempt, or when the server ran on this directory before the Python data files were copied in. The server keeps the existing data, leaves the Python data files unchanged and renames nothing. Restore the backup from before the first migration attempt, or start with a storage directory that holds only the Python Matter Server data files.

### Devices are not found or stay offline

Most of these issues come from the host network. Check the [OS requirements](os_requirements.md) and the [Docker troubleshooting](docker.md#troubleshooting) section.
