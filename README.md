# HomeAssistant Matter.js Server

This is a WIP version of a Matter.js based controller with a Python Matter Server compatible WebSocket interface.

## How to use
* clone the repository
* `npm i` in the root directory to install npm dependencies and do initial build
* (`npm run build`) if ever needed after changing code
* `npm run server` to start it

The server is started on port localhost:5580 and listens fpr WS on "/ws".

Just configure the HA instance against this server and have fun :-)

### Tips
* to control the storage directory use `--storage-path=.ha1` as parameter to use local dir `.ha1` for storage
* to limit network interfaces (especially good idea on Macs sometimes) use  `--mdns-networkinterface=en0`

So as example to do both use `npm run server -- --storage-path=.ha1 --mdns-networkinterface=en0` (note the extra "--" to pass parameters to the script).

It was in general tested with a simply slight bulb on network.

Ble and Wifi should work when server gets startes with `--ble` flag, but Wifi only will work. For Thread Mater.js currently requires a network Name which is not provided.

## Differences from Python Matter Server

This implementation aims to be API-compatible with the [Python Matter Server](https://github.com/home-assistant-libs/python-matter-server), but there are some intentional differences:

### Test Node ID Range

Test nodes (imported via `import_test_node` command) use different ID ranges:

| Implementation | Test Node ID Range |
|----------------|-------------------|
| Python Matter Server | `>= 900000` (0xDBBA0) |
| Matter.js Server | `>= 0xFFFF_FFFE_0000_0000` |

The Matter.js implementation uses the high 64-bit range to ensure test node IDs never collide with real Matter node IDs, which can be assigned values up to 64-bit. This is a deliberate design choice for better separation between test and production nodes.

**Note**: If you're importing diagnostics dumps from a Python Matter Server instance, the test node IDs will be preserved as-is from the dump.

### Fabric Label Handling

When setting the fabric label via `set_default_fabric_label`:

| Implementation | Behavior with null/empty |
|----------------|-------------------------|
| Python Matter Server | Auto-truncates to 32 chars, accepts null/empty to clear |
| Matter.js Server | Resets to "Home" when null or empty string is passed |

The matter.js SDK requires fabric labels to be 1-32 characters, so the Matter.js server uses "Home" as the default label instead of clearing it.

### Eve Energy Custom Cluster Polling

The Python Matter Server includes a polling mechanism for older Eve Energy devices that report power consumption via a custom vendor cluster (0x130AFC01) instead of the standard `ElectricalPowerMeasurement` cluster.

| Implementation | Behavior |
|----------------|----------|
| Python Matter Server | Polls Eve energy attributes (Watt, Voltage, Current, etc.) every 30 seconds if the device is from Eve (vendor ID 4874) and lacks the standard power cluster |
| Matter.js Server | Does not implement this polling mechanism |

**Why this difference exists**: Modern Eve devices with up-to-date firmware use the standard Matter `ElectricalPowerMeasurement` cluster, which supports proper subscriptions and doesn't require polling. The polling in Python was a workaround for older firmware versions.

**Recommendation**: If you have Eve Energy devices that don't report power values correctly, update your device firmware through the Eve app. Updated firmware uses standard Matter clusters that work correctly without polling.

For complete compatibility details, see [TODO.md](TODO.md).
