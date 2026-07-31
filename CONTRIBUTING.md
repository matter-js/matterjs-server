# Contributing to the Open Home Foundation Matter Server

Thanks for wanting to help out. This project is part of the [Open Home Foundation](https://www.openhomefoundation.org/).

## Support questions and Home Assistant Matter integration issues

This repository is the issue tracker for the Matter Server itself. If you use Matter
in Home Assistant and your problem is not specific to this server, please use the
[Home Assistant Core issue tracker](https://github.com/home-assistant/core/issues/new/choose)
or the support channels listed in the [README](README.md#support).

## Reporting issues

Use the [issue templates](https://github.com/matter-js/matterjs-server/issues/new/choose).

**A report without a complete log file is not actionable.** Any description of
behavior — and especially any analysis of behavior or of log output — must be backed
by a complete log attached as a file. Enable verbose logging (`--log-level debug` or
`LOG_LEVEL=debug`), reproduce the problem, then attach the resulting log. A few quoted
lines are not enough; we need the surrounding context to reproduce your analysis.

## Development

See the [development documentation](DEVELOPMENT.md) for environment setup, and the
[README](README.md) for how to run the server.

Before opening a pull request, run the full gate in this order:

```bash
npm run format   # rewrites files in-place — must run first
npm run lint
npm run build
npm test
```

CI enforces formatting and linting, and all other CI jobs are gated on them.

## AI policy

This project follows the [Open Home Foundation AI Policy](AI_POLICY.md). In
short: AI tools are welcome as an aid, but you must fully understand and be
able to explain every change you submit. Contributions made by autonomous
agents are not accepted.

In particular, for this repository: an AI-produced root-cause analysis is not a
substitute for the raw log it was derived from. Attach the log.
