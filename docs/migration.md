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

- `server`: all node data, one file per storage key.
- `ota`: downloaded OTA update files. To add your own OTA files, use a separate directory, see [Importing Custom OTA Firmware Files](../README.md#importing-custom-ota-firmware-files).
- `certificates`: downloaded Matter certificate chains, used to validate devices during commissioning.
- `vendors`: the downloaded list of Matter vendors.

The fabric configuration from `chip.json` is migrated into the matter.js storage.

The node data from `<long-number>.json` are converted to the matter.js format. On a first start with empty storage, the server writes them directly into the controller node storage (`nodes.peerX.endpoints.*`). If the storage already contains nodes, the server writes each node that is not yet known as `node-<NodeID>.*` files in the `server` directory and imports them into the controller node on start. Only the `nodes.peerX.endpoints.*` data are updated and used afterwards.

The migration runs once per node in `<long-number>.json`. It is skipped for a node that already has data in the `server` directory.

## Switching back to the Python Matter Server

The server keeps `<long-number>.json` up to date when nodes are added or removed, so the Python Matter Server can be started again on the same data files. Stop this server first. Nodes removed in this server are gone there too.

For nodes added in this server, no attribute data are written into `<long-number>.json`. The Python Matter Server has to interview them again, and they can show empty values until they reconnect.

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

### Devices are not found or stay offline

Most of these issues come from the host network. Check the [OS requirements](os_requirements.md) and the [Docker troubleshooting](docker.md#troubleshooting) section.
