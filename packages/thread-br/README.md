# Open Home Foundation Matter(.js) Server - Thread Border Router

![Matter Logo](https://github.com/matter-js/matterjs-server/raw/main/docs/matter_logo.svg)

Thread Border Router communication for the [OHF Matter Server](https://github.com/matter-js/matterjs-server/blob/main/README.md): mDNS BR discovery, dataset codec, MeshCoP/CoAP/DTLS-EC-JPAKE diagnostic queries, and OpenThread Border Router (OTBR) REST adapter.

This package is consumed internally by `@matter-server/ws-controller` to feed Thread BR-perspective routing, link-quality, child-table, and vendor data into the Matter Server dashboard for the entire Thread mesh — including non-Matter nodes.

## Development

Examples and integration scripts target a local OpenThread CLI simulator:

```bash
brew install openthread
```

The Open Home Foundation Matter Server software component is a project of the [Open Home Foundation](https://www.openhomefoundation.org/).

Please refer to https://github.com/matter-js/matterjs-server/blob/main/README.md for more information.
