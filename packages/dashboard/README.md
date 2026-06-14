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

### Understanding Node Role Badges

Thread nodes commissioned to this fabric carry a small corner badge over the device icon showing their Thread routing role:

- **Crown (amber)**: Leader — the elected coordinator of the Thread network
- **Swap arrows (blue)**: Router — forwards traffic for other nodes
- **Small dot (grey-blue)**: End Device or REED (Router-Eligible End Device)
- **Zzz / sleep (grey-blue)**: Sleepy End Device — radio off when idle to save battery
- **No badge**: Role unassigned/unspecified, or an external device whose role can't be queried

Thread Border Routers use the device icon itself to show role:

- **Crown**: this Border Router is currently the Thread Leader
- **Wireless router icon**: a Border Router that is not the Leader
- **Star badge (teal)**: the Primary Backbone Border Router (BBR). Independent of the Leader role — a node can be either, both, or neither.

Other node icons:

- **WiFi symbol**: WiFi-connected node
- **Access point (orange)**: external/unknown router-capable device
- **Question mark (orange)**: external/unknown end device

### Understanding Connection Lines

Connection lines represent the communication links between devices.

**Line style:**

- **Solid lines**: link to an online device
- **Dashed lines**: link to an offline or unknown/external device (based on last known data), **or** an asymmetric link where the peer reports no usable link back (one direction is dead)

**Line color** indicates signal quality. Thread links are scored by LQI (Link Quality Indicator, typically 0–3 on the underlying stack; higher is better); WiFi links by RSSI:

- **Green**: strong signal (LQI > 2, or RSSI > -70 dBm)
- **Orange**: medium signal (LQI = 2, or RSSI -70 to -85 dBm)
- **Red**: weak signal (LQI = 1, or RSSI ≤ -85 dBm)
- **Grey**: no usable link (LQI = 0 — stale or dead neighbor entry)

**Arrows** appear only on asymmetric links and point from the reporting node toward the node it sees:

- A link drawn with an arrow means only one side reports the other in its neighbor/route table, or the link is shown from the peer's perspective rather than the selected node's.
- A plain line (no arrow) means both nodes see each other — a healthy bidirectional link.

### Thread Network Details

When you click on a Thread device, the details panel shows network information:

- **Thread Role**: The device's role in the Thread network (Router, End Device, etc.)
- **Direct neighbors**: Number of devices in the neighbor table (direct RF neighbors)
- **Routable destinations**: Number of destinations in the route table (routers only)

#### Connection Details

Each connection shows:

- **LQI (Link Quality Indicator)**: higher is better. The Matter spec types this as 0–255, but the OpenThread stack reports 0–3 in practice. Derived from RF signal quality.
- **RSSI (Received Signal Strength)**: In dBm, closer to 0 is stronger (e.g., -50 dBm is better than -80 dBm).
- **Bidir (Bidirectional LQI)**: Average of the inbound and outbound LQI from the route table — i.e. the link quality measured in **both directions**. Only available for router connections, which maintain a route table.
- **Cost (Path Cost)**: Number of hops to reach the destination. 1 = direct link, higher = multi-hop route.

A connection may also be tagged with a direction hint:

- **← one-way**: the peer reports this node as a neighbor, but this node has no matching neighbor-table entry for the peer. This points to asymmetric (one-way) visibility — caused by range, transmit-power differences, or a stale neighbor table — rather than a healthy two-way link.
- **(reverse)**: the displayed link comes from the peer's neighbor/route table, not the selected node's. The data is real, just measured from the other end.

A connection with neither tag is bidirectional: both nodes see each other.

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

Devices that appear in neighbor or route tables but are not commissioned to your fabric are shown as "Unknown" with an orange icon. Because these tables live at the Thread mesh layer, an unknown entry is always a node on the **same** Thread network as your devices — just not reachable by us. They could be:

- **Devices on a different Matter fabric**: a single Thread network is often shared by several fabrics (e.g. Home Assistant, Apple, Google). Their nodes and Border Routers are RF neighbors of your devices, but we cannot query them.
- **Non-Matter Thread infrastructure**: Border Routers, range extenders, and other Thread devices (e.g. HomeKit-only Thread devices) that are not Matter devices and can never be commissioned.
- **A Border Router under an unstable radio MAC**: some vendors (notably Apple and Aqara) randomize their Thread radio MAC at each reboot. The same physical Border Router then shows up twice — once as the known BR (matched via its stable MeshCoP `xa` identifier) and once here as an "External Router" carrying its current radio MAC. After such a reboot the old MAC lingers until neighbor tables age out.
- **Stale entries**: a neighbor may keep listing a node that has left the network or a battery-powered (sleepy) device it has not heard from recently, until the entry ages out. Use the refresh button to re-read current tables; sometimes a device restart is needed before its tables drop the obsolete entry.

Unknown devices show as "Router (external)" or "End Device (external)" based on their radio behavior (rxOnWhenIdle). Since they're not commissioned to this fabric, we cannot query their actual Thread role (Leader, Router, etc.).

### Limitations

**Thread roles for external devices**: The Thread role (Leader, Router, End Device) can only be determined for devices commissioned to this fabric. External devices like Home Assistant's Thread Border Router will show as "Router (external)" even if they are the current Thread Leader. This is a fundamental Matter limitation - we cannot query attributes from devices on other fabrics.

**Leader role is dynamic**: In Thread networks, the Leader role can change via leader election. Any router can potentially become the Leader, so this status may change over time.

## Developer Mode

The dashboard has a built-in developer mode for raw, per-attribute and per-command interaction with a node. It is intended for people building or debugging Matter integrations — not for everyday control of devices.

### Enable / disable

- Append `?dev=on` (or any non-empty value) to the dashboard URL, or
- Open **Settings** from the header (cog icon) and toggle **Enable developer mode**.

Developer mode is browser-only and is not persisted. Reloading without the `?dev` parameter disables it. While active, a small **DEV** badge is shown in the header.

### What developer mode adds on a cluster view

- **Per-attribute Read button** — forces an immediate read of a single attribute. On success the icon briefly flashes; on failure the raw server error is shown in a popup.
- **Per-attribute Write button** — shown only for writable attributes. Opens an editor prefilled with the current value as JSON; pressing *Write* sends the exact value to the server.
- **Commands panel** (collapsed by default) — lists every command the cluster reports as supported. Each entry opens a payload editor; pressing *Invoke* sends the command and shows the server response as JSON, or the raw error if the invocation fails.

Unknown attributes (not present in the dashboard's metadata) cannot be written. Unknown commands (in the cluster's accepted list but missing from the metadata) are not listed. All server errors are shown verbatim so the exact response from the device is visible.
