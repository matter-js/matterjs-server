# Logging Levels

How to choose a log level in matter-server. The goal is consistency: the same kind of event
always lands on the same level, and each level means one thing.

matter-server is an **end-user-driven** application — a Matter controller with a Home
Assistant-compatible WebSocket API and a dashboard. It wraps `@project-chip/matter.js`, whose
logs flow through this server's logger **at the levels matter.js already chose**. This scheme
is therefore **identical to matter.js's** (see its `docs/LOGGING.md`): adopting the same
levels means library logs stay coherent with ours — no remapping.

Logs are read by three audiences, mapped onto the level bands:

- **Developers** diagnosing behavior — `debug`, sometimes `info`.
- **Operators** running a deployment — `info` for the narrative, `notice`+ at reduced verbosity.
- **End users** (HA power users) — `notice` and above: the lifecycle they care about.

## The six levels

| Level    | Value | Audience      | One-line meaning                                     |
| -------- | ----- | ------------- | ---------------------------------------------------- |
| `debug`  | 0     | developer     | Full internal detail.                                |
| `info`   | 1     | developer/ops | Normal narrative + dev-relevant hints.               |
| `notice` | 2     | operator/user | Operator-significant event, within normal operation. |
| `warn`   | 3     | operator/user | Anomaly contained to a single operation.             |
| `error`  | 4     | operator/user | A whole feature/subsystem is broken.                 |
| `fatal`  | 5     | operator/user | The runtime itself cannot continue.                  |

## Two questions decide the level

**1. Audience gate — who is this for?**

- Developer reading internals → `debug`, or `info` if it is normal high-level progress worth
  seeing during active monitoring.
- Operator/user running the system → `notice` and above.

**2. Blast radius — within the user-facing band, how much is affected?**

- One operation → `warn`
- A whole feature/subsystem → `error`
- The whole runtime → `fatal`

Blast radius decides severity **within** the anomaly band; it is not affected by who must
fix it. The `notice`↔`warn` border is the exception: there the question is whether the
condition implies someone (developer / user / config) should investigate or fix it. If nobody
can — the cause is external/operational, or we auto-recover on a known schedule, and it is
handled — it is not a `warn`.

Two more levers:

- **Volume.** High-frequency or environmentally-caused conditions drop a level to avoid spam,
  unless a single occurrence explains a user-observable symptom (then `notice`, de-duplicated).
- **Audience.** `debug`/`info` are for developers; `notice`+ are seen by operators.

```
DEBUG → INFO   : pure wire/diagnostic detail  vs  worth a dev seeing on a healthy run
INFO  → NOTICE : dev-facing / high-volume     vs  operator-significant, lower-volume
NOTICE→ WARN   : nobody-can-fix, handled      vs  someone should investigate/fix
WARN  → ERROR  : single operation             vs  whole feature/subsystem
ERROR → FATAL  : a feature dead               vs  the whole runtime dead
```

## Per-level definitions

### `fatal` (5)

The server cannot continue and will stop. Reserve it — if anything keeps running it is
`error`. Examples: storage backend unwritable so nothing can persist; required port/permission
denied at startup so the service cannot run.

### `error` (4)

A whole feature or subsystem is broken and stays broken until someone (developer or operator)
acts; the server cannot fix it itself. Blast radius is a functionality, not the process.
Examples: a node fails to come up; the controller or web server fails to start; API misuse
that disables a capability. Persistent broad degradation lands here once the user is left with
a broken experience, even when the root cause is external and we keep retrying.

### `warn` (3)

Something anomalous, contained to a single operation, recovered or failed without taking down
the surrounding feature. Examples: a transient socket send failure on one message; one WS
command rejected for malformed input; a retryable timeout. Border to `error` = blast radius.
Border to `notice` = does it imply someone should investigate/fix? If nobody can and it is
handled, drop to `notice` (or `info` if high-volume / dev-diagnostic).

### `notice` (2)

An operationally significant event the operator/user should see even at reduced verbosity,
within normal operation, where no fix by us, the developer, or the user is implied — because
nothing is wrong, the cause is external/operational, or we auto-recover on a known schedule.
Use it also for a handled condition that explains a user-observable symptom. Examples: node
commissioned/decommissioned; node added/removed/available; subscription created/cancelled;
OTA update available/applied; a commissioning attempt the device legitimately rejected (wrong
passcode); server listening/shutdown-complete. **Significance- and volume-gated:**
high-frequency operational traffic (per-attribute updates, sessions establishing/ending) →
`info`/`debug`, not `notice`. **Not for internal mechanism** (retry timer, reconnect attempt)
→ `debug`/`info`; log the operator-relevant outcome at `notice`, the mechanism lower.

### `info` (1)

The normal-operation narrative plus anything a developer should see on a healthy run without
dropping to `debug`: high-level progress and lifecycle (WS client connect/disconnect,
per-command narrative, BLE peripheral discovered/connected); dev-actionable hints;
known/handled conditions we cannot fix that are too frequent for `notice`. Test: would an
operator at `notice` want every one of these? If no, but a developer watching a healthy
system would → `info`.

### `debug` (0)

Pure internal/diagnostic detail: wire traffic, state transitions, internal decisions, routine
protocol mechanics, per-attribute updates forwarded to clients, routine storage load/save, BLE
transport open/close and chunk transfer. The default home for high-volume expected noise.

## Cross-cutting practices

1. The level reflects how the code **handles** the situation, not how scary the underlying
   error looks. A transient timeout we retry is `warn`, even though "timeout" sounds bad.
2. Log where you handle/swallow, not where you throw or rethrow. No log-and-throw.
3. One event → one line at one level. Don't re-log the same failure at each stack frame.
4. Routine protocol mechanics (status responses, BUSY, retransmits, acks) are `debug`.
5. Attach the error/cause object when it adds diagnostic value; a message alone is fine when
   the cause object adds nothing.
6. Phrase for the audience. A `notice`+ line is read by users — clear, no internal jargon. A
   `debug`/`info` line may use developer shorthand.
7. Volume is a downgrade lever (drop high-frequency / environmentally-caused conditions to
   `info`/`debug` unless a single occurrence explains a user-observable symptom).
8. Shutdown path: failures while the server is intentionally shutting down are at most `warn`.

## Project level map

| Event                                                      | Level    |
| ---------------------------------------------------------- | -------- |
| Server listening / ready; shutdown complete                | `notice` |
| Node commissioned / decommissioned                         | `notice` |
| Node added / removed / became available again              | `notice` |
| OTA update available / applied for a node                  | `notice` |
| Attribute/event subscription created / cancelled           | `notice` |
| Commissioning rejected by device (wrong passcode etc.)     | `notice` |
| Storage write failed but retried on schedule               | `notice` |
| Node became unavailable / went offline                     | `warn`   |
| WS client connected / disconnected                         | `info`   |
| WS command received / dispatched (per-command narrative)   | `info`   |
| BLE peripheral discovered / connected                      | `info`   |
| Storage / config load + save (routine)                     | `debug`  |
| Per-attribute update forwarded to WS clients (high-volume) | `debug`  |
| BLE transport open/close, chunk transfer                   | `debug`  |
| One WS command rejected for malformed input                | `warn`   |
| A subsystem (controller, web server) fails to start        | `error`  |
| Server cannot start: storage unwritable, port bind denied  | `fatal`  |

## ws-client note

`packages/ws-client` is intentionally zero-dependency and uses native `console.*`, which has
no `notice`/`fatal`. Map: `console.debug` → debug, `console.log` → info, `console.warn` →
warn, `console.error` → error. Do not introduce a Logger dependency there.
