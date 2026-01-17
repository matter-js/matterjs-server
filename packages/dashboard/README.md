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
