# Running Matter.js Server in Docker

For testing/evaluation purposes or as a guideline for application developers that want to run the Matter.js Server, we provide an [official Docker container image](https://github.com/matter-js/matterjs-server/pkgs/container/matterjs-server). Make sure that the underlying operating system on which you intend to run the Docker container matches the [requirements needed for Matter and Thread](os_requirements.md).

> [!NOTE]
> **Attention Home Assistant users:** The Docker image is provided as-is and without official support (due to all the complex requirements to the underlying host/OS). Use it at your own risk if you know what you're doing.

We strongly recommend using Home Assistant OS along with the official Matter Server add-on to use Matter with Home Assistant. The Matter integration automatically installs the Matter Server as an add-on. Please refer to the [Home Assistant documentation](https://www.home-assistant.io/integrations/matter/).

Home Assistant OS has been tested and tuned to be used with Matter and Thread, which makes this combination the best tested and largely worry-free environment.

If you still prefer a self-managed container installation, you might experience communication issues with Matter devices, especially Thread-based devices. This is mostly because the container installation uses host networking, and relies on the networking managed by your operating system.

## Available Docker image Tags

| Tag      | Description                                      |
|----------|--------------------------------------------------|
| `stable` | Latest stable release                            |
| `latest` | Same as `stable`                                 |
| `dev`    | Latest development/nightly (pre-release) version |
| `X.Y.Z`  | Specific version (e.g., `1.0.0`)                 |
| `X.Y`    | Latest patch of minor version (e.g., `1.0`)      |
| `X`      | Latest version of major release (e.g., `1`)      |

## Running using Docker Compose

A Docker Compose file is provided in the repository at [docker/matterjs-server/docker-compose.yml](../docker/matterjs-server/docker-compose.yml):

To use it:

```bash
# Navigate to the docker compose directory or copy the file
cd docker/matterjs-server

# Start the server
docker compose up -d

# View logs
docker compose logs -f

# Stop the server
docker compose down
```

## Running the Matter.js Server using a container image

With the following command you can run the Matter.js Server in a container using Docker. The Matter network data (fabric information) are stored in a newly created directory `data` in the current directory. Adjust the command to choose another location instead.

```bash
mkdir data
docker run -d \
  --name matterjs-server \
  --restart=unless-stopped \
  -v $(pwd)/data:/data \
  --network=host \
  ghcr.io/matter-js/matterjs-server:stable
```

> [!NOTE]
> The container uses environment variables for configuration by default (`STORAGE_PATH=/data`). You can override any setting using environment variables or CLI arguments.

### Command Line Options

You can also pass CLI arguments directly (these override environment variables):

```bash
docker run -d \
  --name matterjs-server \
  --restart=unless-stopped \
  -v $(pwd)/data:/data \
  --network=host \
  ghcr.io/matter-js/matterjs-server:stable \
  --storage-path /data \
  --primary-interface eth0
```

Common options:
- `--storage-path <path>`: Path to store Matter fabric data (default: `/data`)
- `--port <port>`: WebSocket server port (default: `5580`)
- `--primary-interface <interface>`: Primary network interface for mDNS and Matter communication

For all available options, see the [CLI documentation](cli.md).

### Environment Variables

All CLI options can be configured via environment variables, making it easy to configure the server without passing command-line arguments.

| Variable              | Description                                          | Default              | Values / Notes                                           |
|-----------------------|------------------------------------------------------|----------------------|----------------------------------------------------------|
| `STORAGE_PATH`        | Path to store Matter fabric data                     | `/data`              | Any valid path                                           |
| `PORT`                | WebSocket server port                                | `5580`               | Any valid port number                                    |
| `LISTEN_ADDRESS`      | IP address to bind WebSocket server                  | (all interfaces)     | Single IP address (use CLI for multiple)                 |
| `LOG_LEVEL`           | Server logging verbosity                             | `info`               | `critical`, `error`, `warning`, `info`, `debug`, `verbose` |
| `LOG_FILE`            | Log file path                                        | (none)               | Any valid file path                                      |
| `PRIMARY_INTERFACE`   | Primary network interface for mDNS                   | (auto-detect)        | e.g., `eth0`, `en0`                                      |
| `ENABLE_TEST_NET_DCL` | Enable test-net DCL certificates                     | `false`              | `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`          |
| `BLUETOOTH_ADAPTER`   | Bluetooth adapter HCI ID                             | (none)               | e.g., `0` for `hci0`                                     |
| `DISABLE_OTA`         | Disable OTA update functionality                     | `false`              | `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`          |
| `OTA_PROVIDER_DIR`    | Directory for OTA Provider files                     | (none)               | Any valid directory path                                 |
| `DISABLE_DASHBOARD`   | Disable the web dashboard                            | `false`              | `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`          |
| `PRODUCTION_MODE`     | Force dashboard production mode (reverse proxy)      | `false`              | `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`          |
| `VENDOR_ID`           | Vendor ID for the Fabric                             | `0xfff1`             | Any valid vendor ID                                      |
| `FABRIC_ID`           | Fabric ID for the Fabric                             | `1`                  | Any valid fabric ID                                      |

> [!NOTE]
> The `LISTEN_ADDRESS` environment variable only supports a single address. Use the CLI `--listen-address` option (repeatable) to bind to multiple addresses.

Example with environment variables:

```bash
docker run -d \
  --name matterjs-server \
  --restart=unless-stopped \
  -v $(pwd)/data:/data \
  --network=host \
  -e LOG_LEVEL=debug \
  -e PRIMARY_INTERFACE=eth0 \
  ghcr.io/matter-js/matterjs-server:stable
```

## Building the Docker Image Locally

If you want to build the Docker image yourself:

```bash
cd docker/matterjs-server

# Build with a specific version from npm
docker build \
  --build-arg MATTERJS_SERVER_VERSION=1.0.0 \
  -t matterjs-server:local \
  .

# Run the locally built image
docker run -d \
  --name matterjs-server \
  --restart=unless-stopped \
  -v $(pwd)/data:/data \
  --network=host \
  matterjs-server:local
```

## Building for Development

For development, use `Dockerfile.dev` which builds from the local source code instead of npm:

```bash
# From the repository root
docker build \
  -f docker/matterjs-server/Dockerfile.dev \
  -t matterjs-server:dev \
  .

# Run the development image
docker run -d \
  --name matterjs-server-dev \
  --restart=unless-stopped \
  -v $(pwd)/data:/data \
  --network=host \
  matterjs-server:dev
```

This builds the entire monorepo from source, which is useful for:
- Testing local changes in a container environment
- Debugging container-specific issues
- Verifying the build process works in a clean environment

## Accessing the Server

Once running, the Matter.js Server exposes:

- **WebSocket API**: `ws://localhost:5580/ws` - Python Matter Server compatible API
- **Web Dashboard**: `http://localhost:5580/` - Browser-based management interface

## Health Check

The container includes a built-in health check that verifies the server is responding. You can check the container health status with:

```bash
docker inspect --format='{{.State.Health.Status}}' matterjs-server
```

## Troubleshooting

### mDNS/Device Discovery Issues

If devices are not being discovered, ensure:
1. Host networking is enabled (`--network=host`)
2. mDNS is working on the host system
3. The correct network interface is specified with `--primary-interface` if needed

### Permission Issues

If you encounter permission issues with the data volume:
```bash
# Ensure the data directory is writable
chmod 755 data
```

### Viewing Logs

```bash
# Docker
docker logs -f matterjs-server

# Docker Compose
docker compose logs -f
```
