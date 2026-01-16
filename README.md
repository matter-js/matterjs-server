# Open Home Foundation Matter(.js) Server

![Matter Logo](docs/matter_logo.svg)

> [!WARNING]
> This is an Alpha version of a matter.js-based controller with a [Python Matter Server](https://github.com/matter-js/python-matter-server) compatible WebSocket interface.
> This version is not yet officially re-certified by the CSA, but will be during the current Alpha/Beta phase.
> 
> Please refer to the [Alpha/Beta testing instructions](ALPHABETATESTS.md) how to test this version.

The Open Home Foundation Matter Server serves as the foundation to provide Matter support to [Home Assistant](https://home-assistant.io) but its universal approach makes it suitable to be used in other projects too.

This project implements a Matter Controller Server over WebSockets using JavaScript Matter SDK [matter.js](https://github.com/matter-js/matter.js)
as a base and provides a server implementation.

The Open Home Foundation Matter Server software component is a project of the [Open Home Foundation](https://www.openhomefoundation.org/).

The current version of the server supports Matter 1.4.2 and is a drop-in replacement for the Python Matter Server.
The Home Assistant integration is based on the Python bindings of the Python Matter Server v8.1.2, which uses a Matter-SDK version 1.4.2 (from 30.06.2025).

This repository consists of multiple packages that are provided in the `packages` directory:
* `matter-server`: The OHF Matter Server using the below packages to provide functionality on a webserver (published to npmjs as `matter-server`)
* `ws-controller`: The WebSocket-based Matter Controller implementation using matter.js (published to npmjs as `@matter-server/ws-controller`)
* `ws-client`: A WebSocket client library for connecting to the Matter Server (usable in browser and Node.js) (published to npmjs as `@matter-server/ws-client`)
* `custom-clusters`: A set of community-provided custom Matter clusters used by the Matter Server (published to npmjs as `@matter-server/custom-clusters`)
* `dashboard`: A dashboard to interact with the Matter Server and show node detailed data (published to npmjs as `@matter-server/dashboard`)

## Alpha/Beta testing instructions

As mentioned above the enw Matter server is currently in a Testing phase.

Please see the [Alpha/Beta testing instructions](ALPHABETATESTS.md) for more information.

## Support

During the Alpha/Beta phase of the matter.js-based Matter server, we enabled issue creation for this version via GitHub issues. If you use the Python Matter server and your issue is not related to a Migration-issue from/to matter.js-Server, please use the options listed below.

For users of Home Assistant, seek support in the official Home Assistant support channels.

- The Home Assistant [Community Forum](https://community.home-assistant.io/).
- The Home Assistant [Discord Chat Server](https://discord.gg/c5DvZ4e).
- Join [the Reddit subreddit in /r/homeassistant](https://reddit.com/r/homeassistant).

- If you experience issues using Matter with Home Assistant, please open an issue
  report in the [Home Assistant Core repository](https://github.com/home-assistant/core/issues/new/choose).

Please do not create Home Assistant enduser support issues in the issue tracker of this repository.

## Development

Want to help out with development, testing, and/or documentation? Great! As both this project and Matter keeps evolving there will be a lot to improve. Reach out to us on discord if you want to help out.

[Development documentation](DEVELOPMENT.md)

## Installation / Running the Matter Server

- Endusers of Home Assistant, refer to the [Home Assistant documentation](https://www.home-assistant.io/integrations/matter/) how to run Matter in Home Assistant using the official Matter Server add-on, which is based on this project. Choose the "Beta" version if you want to test the matter.js based server (soon)

- For running the server and/or client in your development environment, see the [Development documentation](DEVELOPMENT.md).

- For running the Matter Server as a standalone docker container, see our instructions [here](docs/docker.md).

### Manual installation (from npm)
* Ensure to have Node.js 20.x, 22.x, or 24.x installed (22.x recommended)
* `npm install matter-server`
* `npx matter-server` or alternatively `cd node_modules/matter-server && npm run server`

If you want to provide more parameters when using "npm run" (not needed when using npx!) use an extra "--" to separate parameters, see below.

### Manual installation (for local development)
* clone the repository
* `npm i` in the root directory to install npm dependencies and do initial build
* (`npm run build`) if ever needed after changing code
* `npm run server` to start it

The server is started on port localhost:5580 and listens fpr WS on "/ws"

Configure the HA instance against this server and have fun :-)

### Tips
* to control the storage directory use `--storage-path data` as parameter to use local dir `data` for storage
* to limit network interfaces (especially good idea on Macs sometimes) use `--primary-interface en0`

So as example to do both use `npm run server -- --storage-path data --primary-interface en0` (note the extra "--" to pass parameters to the script).

It was in general tested with a simply slight bulb on network.

Ble and Wifi should work when server gets startes with `--ble` flag, but Wifi only will work. For Thread Mater.js currently requires a network Name which is not provided.

## Importing Custom OTA Firmware Files

The Matter Server supports importing custom OTA (Over-The-Air) firmware update files for your Matter devices. This is useful when you have manufacturer-provided firmware files that aren't available through the official DCL (Distributed Compliance Ledger).

### Requirements

To use custom OTA files, you must:

1. **Enable test-net DCL mode** using `--enable-test-net-dcl` (or env var `ENABLE_TEST_NET_DCL=true`)
2. **Specify an OTA provider directory** using `--ota-provider-dir <path>` (or env var `OTA_PROVIDER_DIR=<path>`)

Both options are required. If `--ota-provider-dir` is set but `--enable-test-net-dcl` is not enabled, custom OTA files will be ignored and a warning will be logged.

Without a own directory enabling the `--enable-test-net-dcl` flag would still check the CSA Test-DCL for updates available there.

### How It Works

1. Place your Matter OTA image files (`.ota` format) in the configured OTA provider directory
2. When the server starts, it automatically scans the directory and imports all valid OTA files
3. The server extracts metadata (vendor ID, product ID, software version) from each OTA image
4. **Important**: Successfully imported files are automatically deleted from the directory after import
5. JSON files (`.json`) in the directory are skipped and can be used for your own metadata or notes

### Example Usage

```bash
# Create a directory for OTA files
mkdir -p /path/to/ota-files

# Place your .ota files in that directory
cp device-firmware-v2.0.ota /path/to/ota-files/

# Start the server with OTA support
npx matter-server --enable-test-net-dcl --ota-provider-dir /path/to/ota-files
```

Or using environment variables (useful for Docker):
```bash
export ENABLE_TEST_NET_DCL=true
export OTA_PROVIDER_DIR=/path/to/ota-files
npx matter-server
```

### Notes

- OTA files must be in the standard Matter OTA image format
- The server stores imported OTA images internally for serving to devices
- To disable OTA functionality entirely, use `--disable-ota` (or env var `DISABLE_OTA=true`)
- Check the server logs for information about successfully imported OTA files

## Differences from Python Matter Server

This implementation aims to be API-compatible with the [Python Matter Server](https://github.com/home-assistant-libs/python-matter-server), but there are some intentional differences:

| Feature                 | Python Matter Server                                       | Matter.js Server                                                                                           |
|-------------------------|------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Test Node IDs           | `>= 900000`                                                | `>= 0xFFFF_FFFE_0000_0000` (NodeId range for temporary local NodeIds outside official operational NodeIds) |
| Fabric Label            | Accepts null/empty to clear                                | Resets to "Home" when null/empty                                                                           |
| Storage Format          | Single `chip.json` and `{fabricId}.json` file              | matter.js native storage (migration supported)                                                             |
| Attribute Subscriptions | Tracks per-node in `attribute_subscriptions`               | Always empty (handled internally)                                                                          |
| Custom OTA Files        | Allows to import them independently from the test-dcl flag | Only imports then when also test-dcl is enabled                                                            |


