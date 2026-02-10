# Setting up your development environment

> [!IMPORTANT]
> This document is not yet fully updated to the matter.js version of the server and so relevant for the Python one.

**For enabling Matter support within Home Assistant, please refer to the Home Assistant documentation. These instructions are for development only!**

Development is only possible on a (recent) Linux or MacOS machine. Other operating systems are **not supported**. See [here](docs/os_requirements.md) for a full list of requirements to the OS and network, especially if you plan on communicating with Thread-based devices.

## Native Development

- Download/clone the repo to your local machine.
- Set-up the development environment: Run `npm install` in the base directory of the repository.
- Create the `/data` directory if it does not exist with permissions for the user running the python-matter-server.

## Dev Container

A preconfigured [dev container](https://code.visualstudio.com/docs/devcontainers/containers) is provided in `.devcontainer/` for a consistent development environment. The dev container includes [Claude Code](https://claude.ai/code) with a network firewall for AI-assisted development.

> [!NOTE]
> You do not need to use a dev container. Native development works fine. However, the dev container is useful for local testing because it allows the server to connect to other components running in Docker.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- VS Code with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
- Docker Desktop settings (macOS): Enable "Use kernel networking for UDP" and "Enable host networking". Set default containers to dual IPv4/IPv6.

### Getting Started

1. Open the repository in VS Code
2. When prompted, click **"Reopen in Container"** (or use Command Palette: `Cmd+Shift+P` / `Ctrl+Shift+P` → "Remote-Containers: Reopen in Container")
3. Wait for the container to build and initialize. The post-create step runs `npm ci` and `npm run build` automatically.
4. The server port `5580` is forwarded to your host automatically.

### What's Included

- **Node.js 24** with all project dependencies installed and built
- **Claude Code**: AI-assisted development with [Claude Code](https://code.claude.com) pre-installed
- **Security firewall**: Network access restricted to only necessary services (npm, GitHub, Claude API, VS Code marketplace, Docker registries). The firewall allows running `claude --dangerously-skip-permissions` for unattended operation. See the [Claude Code devcontainer documentation](https://code.claude.com/docs/en/devcontainer) for details on the security model.
- **Developer tools**: ZSH with fzf, git-delta for better diffs, GitHub CLI (`gh`)
- **VS Code extensions**: Claude Code, ESLint, Prettier, GitLens, Rewrap
- **Docker-in-Docker**: Build and run Docker images inside the dev container
- **Session persistence**: Command history and Claude Code configuration persist across container restarts

### Networking Limitations

Due to Docker networking on macOS, Matter devices running in the dev container may not be discoverable outside the container. The dev container is connected to a Docker network with IPv6 enabled, which is suitable for testing with other containerized services but not for direct device communication on the host network.

> [!WARNING]
> The dev container requires IPv6 networking support. GitHub Codespaces does not support IPv6, so the dev container will not work in Codespaces.

## Start Matter server

You can check out the [example script](/scripts/example.py) in the scripts folder for generic directions to run the client and server.

- To run the server in `info` log-level, you can run: `python -m matter_server.server`
- To start the server in `debug` log-level, you can run: `python -m matter_server.server --log-level debug`
- To start the server with SDK in `progress` log-level, you can run: `python -m matter_server.server --log-level-sdk progress`. This will display more information from the Matter SDK (C++) side of the Matter Server.

Use `--help` to get a list of possible log levels and other command line arguments.

The server runs a Matter Controller and includes all logic for storing node information, interviews and subscriptions. To interact with this controller we've created a small Websockets API with an RPC-like interface. The library contains a client as reference implementation which in turn is used by Home Assistant. Splitting the server from the client allows the scenario where multiple consumers can communicate to the same Matter fabric and the Matter fabric can keep running while the consumer (e.g. Home Assistant is down).

If you happen to get `OSError: [Errno 105] No buffer space available.`, increase the IPv4 group limits with:
```
echo "net.ipv4.igmp_max_memberships=1024" | sudo tee -a /etc/sysctl.d/local.conf
sudo service procps force-reload
```

## Python client library only

There is also a Python client library hosted in this repository (used by Home Assistant), which consumes the Websockets API published from the server.

The client library has a dependency on the chip/matter clusters package which contains all (Cluster) models and this package is os/platform independent. The server library depends on the Matter Core SDK (still named CHIP) which is architecture and OS specific. We build (and publish) wheels for Linux (amd64 and aarch64) to pypi but for other platforms (like Macos) you will need to build those wheels yourself using the exact same version of the SDK as we use for the clusters package. Take a look at our build script for directions: https://github.com/home-assistant-libs/chip-wheels/blob/main/.github/workflows/build.yaml

To only install the client part: `pip install python-matter-server`

## Send Command Utility

A simple CLI script is available for sending WebSocket commands to the server. Useful for testing and debugging.

```bash
# Usage
npm run send-command -- <url> <command> [args-json]

# Examples
npm run send-command -- ws://localhost:5580/ws server_info
npm run send-command -- ws://localhost:5580/ws get_node '{"node_id": 1}'
npm run send-command -- ws://localhost:5580/ws start_listening
npm run send-command -- ws://localhost:5580/ws device_command '{"node_id": 1, "endpoint_id": 1, "cluster_id": 6, "command_name": "toggle", "payload": {}}'
```

The script connects to the server, sends the command, and keeps the connection open to log all incoming messages (results and events). Press `Ctrl+C` to disconnect.

## Websocket commands

[Websocket documentation](/docs/websockets_api.md)
