# Open Home Foundation Matter(.js) Server

![Matter Logo](https://github.com/matter-js/matterjs-server/raw/main/docs/matter_logo.svg)

This project implements a Matter Controller Server over WebSockets using JavaScript Matter SDK [matter.js](https://github.com/matter-js/matter.js)
as a base.

This project provides the following features:
* Start a Webserver on a port to choose (Default 5580)
* Serves a WebSocket endpoint that implements the OHF Matter Server API (Logic is in `@matter-server/ws-controller`)
* Serves a Dashboard to interact with the server and show the node detailed data under the same port (Dashboard is in `@matter-server/dashboard`)
* Registers a set of community-provided custom clusters (Clusters are in `@matter-server/custom-clusters`)

For building your own client applications, use the `@matter-server/ws-client` package which provides a WebSocket client library compatible with both browser and Node.js environments.

The project also contains a set of classes to ensure backward compatibility to the [OHF Python Matter Server](https://github.com/matter-js/python-matter-server), which is the previous Matter Server implementation. 

The Open Home Foundation Matter Server software component is a project of the [Open Home Foundation](https://www.openhomefoundation.org/).

Please refer to https://github.com/matter-js/matterjs-server/blob/main/README.md for more information.

## Dashboard

The dashboard will be available at [http://localhost:5010](http://localhost:5010). When you open it from localhost, it will ask you for your websocket server URL.

The websocket URL of the Home Assistant add-on will be something like `ws://homeassistant.local:5580`. If you are running the Python Matter Server locally, it will be `ws://localhost:5580`.

If you want to use the dashboard with the Python Matter Server Home Assistant add-on, you need to configure it to make the WebSocket server available on the network. Go to the [add-on info page](https://my.home-assistant.io/redirect/supervisor_addon/?addon=core_matter_server), click on Configuration. Under "Network", show disabled ports and enter the port you want to use for the WebSocket server (e.g. 5580). Then, click "save" and restart the add-on when prompted.
