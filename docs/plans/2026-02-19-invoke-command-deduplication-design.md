# Invoke Command Deduplication

## Problem

Clients (Home Assistant, dashboard) sometimes send identical `device_command` (invoke) requests in parallel — e.g., two rapid taps on a toggle button. Each duplicate hits the Matter protocol independently, wasting radio bandwidth and causing unpredictable device behavior.

## Solution

Track in-flight invoke commands in `ControllerCommandHandler`. When a duplicate arrives before the first completes, coalesce it with the existing request and return the same result (or error) to all waiters.

## Decisions

- **Scope:** Cross-connection. One `ControllerCommandHandler` instance serves all WebSocket connections, so dedup is automatic.
- **Commands covered:** `device_command` (invoke) only. Reads are side-effect-free; writes are rare and fast.
- **Error propagation:** Duplicates receive the same error as the original. Callers can retry if they choose.
- **Placement:** Inside `ControllerCommandHandler.handleInvoke()`, after validation and data conversion, before `#invokeCommand`.

## Design

### Dedup key

A deterministic string:

```
${nodeId}:${endpointId}:${clusterId}:${commandName}:${serializedData}
```

- `commandData` is serialized with `toBigIntAwareJson` (handles BigInt values)
- `undefined` data serializes as empty string
- Key is built after data conversion so identical payloads always match

### Data structure

```typescript
readonly #inFlightInvokes = new Map<string, Promise<unknown>>();
```

### Flow

1. Validate command exists (existing logic)
2. Convert `commandData` (existing logic)
3. Build dedup key
4. Check `#inFlightInvokes`:
   - **Hit:** Log warning, return existing promise
   - **Miss:** Create promise via `#invokeCommand`, store in map, remove on settlement via `.finally()`
5. Return result

### Warning log

```
Duplicate invoke detected for node <nodeId> endpoint <endpointId> cluster <clusterName> command <commandName> - coalescing with in-flight request
```

### Cleanup

`.finally()` on the stored promise removes the map entry, guaranteeing cleanup on both success and error.

### No TTL

No artificial timeout. The map entry lives exactly as long as the Matter protocol invoke is pending. Matter.js has its own interaction timeouts.

## Files changed

1. `packages/ws-controller/src/controller/ControllerCommandHandler.ts` — add `#inFlightInvokes` map, modify `handleInvoke()`

## Not in scope

- Deduplication of `read_attribute` or `write_attribute`
- Per-connection dedup (cross-connection covers this)
- Rate limiting or throttling
