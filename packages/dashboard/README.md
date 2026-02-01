# Open Home Foundation Matter(.js) Server - Dashboard

![Matter Logo](https://github.com/matter-js/matterjs-server/raw/main/docs/matter_logo.svg)

This package implements a web-based Dashboard for the [OHF Matter Server](https://github.com/matter-js/matterjs-server/blob/main/README.md) project. It is meant to be used for debugging and testing Matter devices.

The dashboard uses the `@matter-server/ws-client` package to connect to the Matter Server via WebSocket.

The Open Home Foundation Matter Server software component is a project of the [Open Home Foundation](https://www.openhomefoundation.org/).

Please refer to https://github.com/matter-js/matterjs-server/blob/main/README.md for more information.

## Theme Support

The dashboard supports light and dark modes with three options:
- **Light** - Light theme
- **Dark** - Dark theme
- **System** - Automatically follows your operating system's theme preference

Click the theme icon in the header to cycle through the modes. Your preference is saved in the browser's localStorage.

You can also set the theme via URL query parameter:
- `?theme=light` - Switch to light mode
- `?theme=dark` - Switch to dark mode
- `?theme=system` - Switch to system auto-detect

The query parameter will override and save the preference to localStorage.

## Network Visualization

The Network page displays a visual graph of your Matter network topology, showing Thread and WiFi connections between devices.

### Understanding Node Colors

Node colors indicate device status:

- **Grey**: Online device (commissioned to this fabric)
- **Blue**: Currently selected node
- **Red**: Offline device (not responding)
- **Orange**: Unknown/external device (not commissioned to this fabric, detected in neighbor tables)

### Understanding Connection Lines

Connection lines represent the communication links between devices:

- **Solid lines**: Connections to online devices
- **Dashed lines**: Connections to offline or unknown devices (based on last known data)
- **Line colors** indicate signal quality:
  - **Green**: Strong signal (RSSI > -60 dBm or LQI > 200)
  - **Yellow/Orange**: Medium signal (RSSI > -75 dBm or LQI > 100)
  - **Red**: Weak signal

### Thread Network Details

When you click on a Thread device, the details panel shows network information:

- **Thread Role**: The device's role in the Thread network (Router, End Device, etc.)
- **Direct neighbors**: Number of devices in the neighbor table (direct RF neighbors)
- **Routable destinations**: Number of destinations in the route table (routers only)

#### Connection Details

Each connection shows:

- **LQI (Link Quality Indicator)**: 0-255, higher is better. Derived from RF signal quality.
- **RSSI (Received Signal Strength)**: In dBm, closer to 0 is stronger (e.g., -50 dBm is better than -80 dBm).
- **Bidir (Bidirectional LQI)**: Average of inbound and outbound LQI from the route table. Only available for router connections.
- **Cost (Path Cost)**: Number of hops to reach the destination. 1 = direct link, higher = multi-hop route.

#### Data Sources

Thread devices maintain two tables:

1. **Neighbor Table** (0/53/7): Direct RF neighbors visible to the device. All Thread devices have this.
2. **Route Table** (0/53/8): Routing paths to other nodes. Only routers maintain this table.

The visualization combines both tables directly from the devices to provide the most complete picture of your network.

### Update Connections

Click the refresh button in the device details panel to update network data:

- **Online devices**: Refreshes neighbor and route tables from the selected device
- **Include neighbors**: Optionally refresh data from connected online neighbors too
- **Offline devices**: Updates data from online neighbors that can see the offline device

This is useful when network topology changes or when you want the latest signal quality readings.

### Unknown Devices

Devices that appear in neighbor tables but are not commissioned to your fabric are shown as "Unknown" with an orange icon. These could be:

- Devices commissioned to a different fabric (e.g., Home Assistant's Thread Border Router)
- Border routers from other Thread networks
- Thread devices in pairing mode

Unknown devices show as "Router (external)" or "End Device (external)" based on their radio behavior (rxOnWhenIdle). Since they're not commissioned to this fabric, we cannot query their actual Thread role (Leader, Router, etc.).

### Limitations

**Thread roles for external devices**: The Thread role (Leader, Router, End Device) can only be determined for devices commissioned to this fabric. External devices like Home Assistant's Thread Border Router will show as "Router (external)" even if they are the current Thread Leader. This is a fundamental Matter limitation - we cannot query attributes from devices on other fabrics.

**Leader role is dynamic**: In Thread networks, the Leader role can change via leader election. Any router can potentially become the Leader, so this status may change over time.
