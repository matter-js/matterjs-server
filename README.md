# Open Home Foundation Matter(.js) Server

![Matter Logo](docs/matter_logo.svg)

> [!IMPORTANT]
> This is an Alpha version of a matter.js-based controller with a [Python Matter Server](https://github.com/matter-js/python-matter-server) compatible WebSocket interface.
> This version is not yet officially re-certified by the CS, but will be during the current Alpha/Beta phase.

The Open Home Foundation Matter Server serves as the foundation to provide Matter support to [Home Assistant](https://home-assistant.io) but its universal approach makes it suitable to be used in other projects too.

This project implements a Matter Controller Server over WebSockets using JavaScript Matter SDK [matter.js](https://github.com/matter-js/matter.js)
as a base and provides a server implementation.

The Open Home Foundation Matter Server software component is a project of the [Open Home Foundation](https://www.openhomefoundation.org/).

This repository consists of multiple packages that are provided in the `packages` directory:
* `matter-server`: The OHF Matter Server using the below packages to provide functionality on a webserver
* `ws-controller`: The WebSocket-based Matter Controller implementation using matter.js
* `ws-client`: A WebSocket client library for connecting to the Matter Server (usable in browser and Node.js)
* `custom-clusters`: A set of community-provided custom Matter clusters used by the Matter Server
* `dashboard`: A dashboard to interact with the Matter Server and show node detailed data

## Support

During the Alpha/Beta phase of the matter.js-based Matter server, we enabled issue creation for this version via GitHub issues. If you use the Python Matter server and your issue is not related to a Migration-issue from/to matter.js-Server, please use the options listed below.

For users of Home Assistant, seek support in the official Home Assistant support channels.

- The Home Assistant [Community Forum](https://community.home-assistant.io/).
- The Home Assistant [Discord Chat Server](https://discord.gg/c5DvZ4e).
- Join [the Reddit subreddit in /r/homeassistant](https://reddit.com/r/homeassistant).

- If you experience issues using Matter with Home Assistant, please open an issue
  report in the [Home Assistant Core repository](https://github.com/home-assistant/core/issues/new/choose).

Please do not create Home Assistant enduser support issues in the issue tracker of this repository.

## Alpha test instructions

The alpha test uses the data files from the python-matter-server (`chip.json` and `{fabricId}.json`). Simply copy the files from the python-matter-server to a directory of your choice and start the server with the `--storage-path` parameter pointing to that directory.

> [!IMPORTANT]
> Please ensure you have a backup of your storage files before switching to Matter.js.

> [!IMPORTANT]
> When using the python data files, you must ensure that the python-matter-server with these files is not running at the same time.

On the first start, the data from these configuration files will be migrated to the new storage format. This can take a bit time, so please be patient.
Additionally, on the first start, it is expected that the server logs an error message because no addresses are known for all nodes. This can be ignored. 
On the first successful device connection, the server will automatically interview all nodes and update the data files accordingly (afterwards only changed attributes are requested on reconnections).

The server will update the `{fabricId}.json` file whenever nodes are added or removed from the fabric, so das this is in sync if you need to migrate back to the python server for any reason. For new nodes we will **not** sfe any attribute data into the file, so switching back to python-matter-server will require a re-interview of the added nodes and they might report empty values until reconnected.

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
* to control the storage directory use `--storage-path=.ha1` as parameter to use local dir `.ha1` for storage
* to limit network interfaces (especially good idea on Macs sometimes) use  `--mdns-networkinterface=en0`

So as example to do both use `npm run server -- --storage-path=.ha1 --mdns-networkinterface=en0` (note the extra "--" to pass parameters to the script).

It was in general tested with a simply slight bulb on network.

Ble and Wifi should work when server gets startes with `--ble` flag, but Wifi only will work. For Thread Mater.js currently requires a network Name which is not provided.

## Differences from Python Matter Server

This implementation aims to be API-compatible with the [Python Matter Server](https://github.com/home-assistant-libs/python-matter-server), but there are some intentional differences:

| Feature                 | Python Matter Server                          | Matter.js Server                                                                                           |
|-------------------------|-----------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Fabric ID Default       | `--fabricid` defaults to 1                    | Random if not specified                                                                                    |
| Test Node IDs           | `>= 900000`                                   | `>= 0xFFFF_FFFE_0000_0000` (NodeId range for temporary local NodeIds outside official operational NodeIds) |
| Fabric Label            | Accepts null/empty to clear                   | Resets to "Home" when null/empty                                                                           |
| Storage Format          | Single `chip.json` and `{fabricId}.json` file | matter.js native storage (migration supported)                                                             |
| Attribute Subscriptions | Tracks per-node in `attribute_subscriptions`  | Always empty (handled internally)                                                                          |
| Eve Energy Polling      | Polls custom eve cluster every 30s            | Not implemented (use updated firmware)                                                                     |


