# Alpha/Beta Test of the New Matter Server

## Overview of Test Phases and Their Goals

### Phase 1: Alpha Test of the New Matter Server (starts Mon 12.01.2026)

This test phase involves a separate installation of the new Matter Server and does not provide an updated Home Assistant add-on or integration. This means it requires some advanced knowledge on how to install and run the server and how to get the relevant files.
Please see detailed instructions [below](#alpha-test-instructions).

The main goals of this phase are to:
* Validate the basic functionality of the new Matter Server based on matter.js
* Ensure that the migration from the python-matter-server storage format to the matter.js format works as expected
* Verify that the server connects to all online nodes in the fabric, subscribes to all data, and works as expected
* Confirm that the dashboard shows the correct values for all nodes and works correctly, including OTA, binding setup, and device management (commission, remove nodes)
* Verify that when adding or removing nodes, the `<long-number>.json` file gets updated
* (If possible) Add the temporary server location as a Home Assistant Matter integration to a (test?) HA instance and validate functionality there too (all entities are discovered correctly, data updates, etc.)
* (If possible) After deleting/adding nodes in the Matter Server, copy back the `<long-number>.json` to the Python server, and new nodes should connect there too and show up in HA; deleted nodes should disappear from HA

### Phase 2: Official Release for all "Beta" HA Addon Users

Once we have verified the basic functionality of the new Matter Server, we will officially release the HA add-on as a beta version. All users of the HA add-on who chose "Beta" will use this as their main Matter Server. If issues occur, it can be switched back to the python-matter-server by disabling the beta version in the HA add-on.


### Phase 3: Official Release for all "Stable" HA Addon Users

After an official re-certification of the OHF Matter Server we are done :-)

## Alpha Test Instructions

### General Information

The alpha test uses the data files from the python-matter-server (`chip.json` and `<long-number>.json`). Copy the files from the python-matter-server to a directory of your choice and start the server with the `--storage-path` parameter pointing to that directory.

> [!IMPORTANT]
> Please ensure you have a backup of your storage files before switching to the matter.js-based server.

> [!IMPORTANT]
> When using the Python data files, you must ensure that the python-matter-server with these files is not running at the same time.

On the first start, the data from these configuration files will be migrated to the new storage format. This can take a bit of time, so please be patient.
Additionally, on the first start, it is expected that the server logs an error message because no addresses are known for the nodes. This can be ignored.
On the first successful device connection, the server will automatically interview all nodes and update the data files accordingly (afterward, only changed attributes are requested on reconnections). On the first connection, we also do not know the device addresses, so we need to discover them first. Subsequent connections should be much faster.

The Matter Server tries to detect the connection type (Thread vs WiFi/Ethernet) automatically and optimize the connection behavior accordingly. For Thread devices, we use an internal queue for the initial connection and also for subscriptions or other interactions with the devices. When having many Thread devices, you might see a delay on server startup until all devices are online, but in general this works better than flooding the network with data requests.

The server will update the `<long-number>.json` file whenever nodes are added or removed from the fabric, so that this stays in sync if you need to migrate back to the Python server for any reason. For new nodes, we will **not** save any attribute data into the file, so switching back to python-matter-server will require a re-interview of the added nodes, and they might report empty values until reconnected.

### OS preparations

Prepare a system (VM, extra Raspberry Pi, desktop computer), ideally Linux or macOS (Windows should work too, but troubleshooting issues may be more challenging).

Ensure you follow the networking preparation instructions in the [OS requirements](./docs/os_requirements.md) guide

### Manual Installation (No Docker)

#### Step 1: Installation Steps (Preparation)

1. Ensure you have Node.js 20.x, 22.x, or 24.x (22.x recommended) installed
2. `git clone https://github.com/matter-js/matterjs-server.git` (clone this repository)
3. `cd matterjs-server` (change directory to the repository)
4. `npm install` (install dependencies, only execute this in the repository base directory)

#### Step 2: Adding Python Matter Server Data Files

This step is optional because the server can also be started without migrating a former configuration, but the alpha phase primarily focuses on testing the migration process.

1. Create a directory for the data files, e.g., `mkdir ~/matter-data` or `mkdir ./.matter-data`
2. Get the python-matter-server data files (`chip.json` and `<long-number>.json`) from your Home Assistant installation or python-matter-server installation
   * If you run Home Assistant OS or Supervised, you can use the SSH add-on to get access to the filesystem
   * Find the running Docker container for the python-matter-server (`docker ps`), list the files in the container (`docker exec -it <container-id> ls /data/`) and copy them to your host (`docker cp <container-id>:/data/chip.json ./chip.json` and `docker cp <container-id>:/data/<long-number>.json ./<long-number>.json`)
3. Copy the files to the created directory

#### Step 3: Starting the Server

In the repository base directory, execute `npm run server -- --storage-path ~/matter-data --log-level debug` (adjust the path to your data directory). Please note the extra `--` to separate parameters for npm and the script.
If your host has multiple network interfaces, you might want to limit the used interface with `--primary-interface <interface-name>` (e.g., `en0` on macOS or `eth0` on Linux).
See `npm run server -- --help` or the [CLI documentation](./docs/cli.md) for all available parameters and also potential differences from the python-matter-server.

> [!Note]
> Please use the debug log flag for the alpha test phase to get more detailed logs and also provide these when asking questions.

### Docker Installation (from Docker Hub)

Use the [docker-compose](./docker/matterjs-server/docker-compose.yml) file to start the server. This will fetch the `latest` version of the server from Docker Hub. If needed, adjust this to `dev` to use the latest development version.

By default, the data directory is mapped to `${HOME}/.matterjs-server`.

Please get the Python Matter Server data files **before** the first start as [described above](#step-2-adding-python-matter-server-data-files).

## Replacing the Matter Addon Docker Image (Home Assistant OS)

If you're running Home Assistant OS, you can replace the official Matter Server addon with the Matter.js-based variant by swapping the Docker image directly.

> [!NOTE]
> This manual process is only needed if you want to test now.
> Soon, the Matter Server addon will include a setting to switch between the Python-based and Matter.js-based server directly.
>
> After replacing the image, there won't be any visual indication that you're using the new addon. The settings UI will still reference the Python variant and the version will still show as 8.1.2.

### Steps

1. Access the Home Assistant OS CLI (via SSH or console)
2. Enter `login` to get a root shell
3. Pull and tag the replacement image:

   **For AMD64 systems:**
   ```bash
   docker pull thejulianjes/amd64-addon-matter-server:8.2.0
   docker tag thejulianjes/amd64-addon-matter-server:8.2.0 homeassistant/amd64-addon-matter-server:8.1.2
   ```

   **For ARM64 systems (e.g., Raspberry Pi 4/5):**
   ```bash
   docker pull thejulianjes/aarch64-addon-matter-server:8.2.0
   docker tag thejulianjes/aarch64-addon-matter-server:8.2.0 homeassistant/aarch64-addon-matter-server:8.1.2
   ```

4. In Home Assistant, go to Settings → Add-ons → Matter Server
5. Enable the "Beta" flag in the addon configuration
6. Restart the addon
7. (Optional) Monitor the Matter Server addon logs to observe the Node.js installation, Matter Server installation, and migration process, which can take a few minutes

### Reverting to the Original Addon

To revert to the official Python-based Matter Server addon, simply wait until the next Matter Server addon update, which will pull the original image again (and will include Matter.js for the beta anyway).

## Migrating an Existing Home Assistant Instance

If you want to test the new Matter Server with your existing Home Assistant instance instead of setting up a parallel test environment, you can migrate your Home Assistant Matter integration to use an external new Matter Server instance.

> [!WARNING]
> This procedure is experimental and should only be performed on test instances or with proper backups in place.
> 
> This manual migration process is only needed if you want to test now.
> Soon, the Matter Server addon will include a setting to switch between the Python-based and Matter.js-based server directly.


### Prerequisites

1. The Matter.js Server must already be running with the Python Matter Server data files (see [Manual Installation](#manual-installation-no-docker) above)
2. Back up your Home Assistant instance

### Migration Steps

1. Disable the Matter integration in Home Assistant (Settings → Devices & Services → Matter → three dots → Disable)
2. Edit the Home Assistant configuration storage:
   * Navigate to the `/config` directory in your Home Assistant installation
   * Go into the hidden `.storage` directory
   * Edit the `core.config_entries` file
3. Modify the Matter integration entry:
   * Search for `"domain":"matter"` in the file
   * Change `"use_addon":true` to `"use_addon":false`
   * Change `"integration_created_addon":true` to `"integration_created_addon":false`
   * Change the `"url"` value from the addon URL to your external new Matter Server URL (e.g., `ws://192.168.20.11:5580/ws`)

   Example - Original entry:
   ```json
   {"created_at":"1970-01-01T00:00:00+00:00","data":{"integration_created_addon":true,"url":"ws://core-matter-server:5580/ws","use_addon":true},"disabled_by":"user","discovery_keys":{},"domain":"matter","entry_id":"c0d8dd88f94f8cdc9186c1b47655c5a0","minor_version":1,"modified_at":"1970-01-01T00:00:00+00:00","options":{},"pref_disable_new_entities":false,"pref_disable_polling":false,"source":"user","subentries":[],"title":"Matter","unique_id":null,"version":1},
   ```

   Example - Modified entry:
   ```json
   {"created_at":"1970-01-01T00:00:00+00:00","data":{"integration_created_addon":false,"url":"ws://192.168.20.11:5580/ws","use_addon":false},"disabled_by":"user","discovery_keys":{},"domain":"matter","entry_id":"c0d8dd88f94f8cdc9186c1b47655c5a0","minor_version":1,"modified_at":"1970-01-01T00:00:00+00:00","options":{},"pref_disable_new_entities":false,"pref_disable_polling":false,"source":"user","subentries":[],"title":"Matter","unique_id":null,"version":1},
   ```

4. Restart Home Assistant
5. Re-enable the Matter integration (Settings → Devices & Services → Matter → three dots → Enable)

### Switching Back to the Matter Addon

To switch back to using the Python-based Matter addon, revert the changes made to the `core.config_entries` file (restore `"use_addon":true`, `"integration_created_addon":true`, and the original addon URL), then restart Home Assistant.

## FAQ

### What is expected to happen when using the python-matter-server data files?

The expectation is that the server starts, migrates, and imports all fabric configuration and nodes, including all node data. The server then connects to all online nodes, interviews them, and updates the data accordingly. The dashboard should show all nodes and their data correctly.

The very first start might take a bit longer because the server needs to discover all nodes and their addresses and re-interview them completely to update the internal data structures.

Subsequent starts should be much faster because we will reuse the last known device addresses and only request attributes that changed since we stopped the server or lost the connection to a device.

### What is the "matter.js storage format"?

matter.js uses a filesystem-based key/value store to persist all data.

The following directories will be created in the `data` directory you specify and should not be accessed directly:

* `server`: All node data is stored in files in this directory – one file per storage key. This allows the OS to best optimize data access and I/O operations.
* `ota`: The OTA update files are stored in this directory using a specific naming scheme. Please do not store your own files there; see the [CLI documentation](./docs/cli.md) for instructions and use your own directory to add custom OTA files. They will automatically be imported from there.
* `certificates`: Downloaded Matter certificate chains used to validate devices when commissioning them.
* `vendors`: Downloaded list of Matter vendors

### How does the migration work exactly?

The two files you copy from the python-matter-server are the `chip.json` and `<long-number>.json` files.

The `chip.json` file contains the global configuration of your Matter fabric, including IDs, keys, and certificates for secure communication. This file will be read and the data will be migrated to the matter.js storage format.

The `<long-number>.json` file contains the list and latest data of all nodes in the fabric. This file will be read and the data will be migrated to the matter.js storage format. These data will be written initially as `node-<NodeID>.*` files in the `server` directory. The values are taken from the `<long-number>.json` file initially and converted to the matter.js format on the fly.

When you first start the server, these initial node data will be imported into the started Matter Controller node (`nodes.peerX.endpoints.*`).
The current version keeps both variants of the data files, but only the `nodes.peerX.endpoints.*` data are updated and used for reconnections and restarts. In future versions, we will clean up the old files.

The migration will only happen once per node contained in the `<long-number>.json` file and is skipped when existing data is found in the `server` directory for that node.
