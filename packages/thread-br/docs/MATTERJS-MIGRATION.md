# `@matter-server/thread-br` — matter.js Monorepo Migration Audit

Readiness assessment for moving this package into the matter.js monorepo as a peer package.
This is a documentation-only audit — no refactor is included here.

---

## 1. External Dependencies

### `@noble/curves` (`^2.2.0`)

**Used for:** P-256 elliptic curve operations in the DTLS-EC-JPAKE backend:
- `SchnorrZkp.ts` — Schnorr ZKP computation (point multiply, add, scalar ops)
- `EcJpakePms.ts` — Premaster secret derivation (point operations over P-256)
- `EcJpakeRound.ts` — Round-1/2 message construction
- `NobleDtlsSocket.ts` — P-256 key-pair generation for the DTLS handshake

**matter.js equivalent:** `@matter/general`'s `Crypto` abstract class exposes `generateDhSecret`, `signEcdsa`, `ecMultiply`, and `createKeyPair` — but these operate on JWK / `PrivateKey` / `PublicKey` objects and route through WebCrypto or Node.js `crypto`. EC-JPAKE requires direct access to the P-256 group element arithmetic (point addition, scalar multiplication on arbitrary field elements, Schnorr proof construction) that the `Crypto` abstract class does not expose as a programmable surface. `@matter/general` internally pulls in `@noble/curves` itself (it is visible in `Crypto.d.ts`), so the dependency is already transitive. Whether to share that internal reference or keep our explicit dep is a packaging call, not a capability gap.

**Verdict:** Cannot be fully replaced by `Crypto` today. EC-JPAKE needs the raw curve primitives. If matter.js ever extracts a public P-256 point-arithmetic API, the dependency could be dropped; until then, it must stay or the DTLS-EC-JPAKE implementation must be replaced with an equivalent that routes through `Crypto`.

---

### `@noble/hashes` (`^2.2.0`)

**Used for:** SHA-256 in the EC-JPAKE implementation:
- `SchnorrZkp.ts` — `sha256` for the Schnorr hash-to-scalar step
- `EcJpakePms.ts` — `sha256` for premaster secret derivation (mirroring mbedTLS `ecjpake_derive_k`)

**matter.js equivalent:** `Crypto.computeHash(data)` defaults to SHA-256. This is a direct equivalent — the call is synchronous in our usage (small fixed-size inputs), and `computeHash` returns `MaybePromise<Bytes>`. Replacing requires making the two DTLS EC-JPAKE call sites async, which is straightforward since the handshake is already async. Like `@noble/curves`, `@noble/hashes` is also a transitive dep of `@matter/general`.

**Verdict:** Can be replaced by `Crypto.computeHash`, subject to making the two call sites async. Low-risk swap.

---

### `coap-packet` (`^1.1.1`)

**Used for:** CoAP message serialization and parsing in `CoapMessage.ts` (`generate` + `parse`). This is the only CoAP framing primitive used — our `CoapClient.ts` implements the RFC 7252 CON/ACK/separate-response state machine on top of it.

**matter.js equivalent:** None. No `@matter` package exposes CoAP. matter.js uses UDP for mDNS and CASE/PASE, not CoAP. The OTBR diagnostic path over CoAP is entirely Thread-specific and foreign to the matter.js core.

**Verdict:** No equivalent in matter.js. `coap-packet` must stay, or the entire `CoapMessage.ts` + `CoapClient.ts` layer must be rewritten (not blocked — the API surface is small). The dependency is legitimate and well-maintained.

---

## 2. Custom Reimplementations vs. matter.js Primitives

### DTLS-EC-JPAKE backend

**What we have:** A complete DTLS 1.2 + EC-JPAKE handshake stack:
- `src/dtls/ecjpake/` — Schnorr ZKP, EC-JPAKE rounds (1+2), premaster secret
- `src/dtls/prf/` — TLS PRF (HMAC-SHA256-based), hand-rolled to match mbedTLS
- `src/dtls/record/` — DTLS record layer: content types, cipher state (AES-CCM-8 via Node.js `crypto`), anti-replay window, record framing
- `src/dtls/handshake/` — Full DTLS client handshake: ClientHello, HelloVerifyRequest, ServerHello, ServerKeyExchange (EC-JPAKE), ClientKeyExchange, CCS, Finished, transcript hash

**matter.js equivalent:** None. matter.js implements PASE (SPAKE2+) and CASE (SIGMA/ECDH) for Matter device commissioning, not DTLS-EC-JPAKE. `@matter/general` exposes the `Crypto` abstract class (AES-CCM encrypt/decrypt, ECDH, ECDSA, PBKDF2, HKDF, HMAC), which overlaps with primitives we use internally, but there is no DTLS record layer or EC-JPAKE handshake.

**Overlap with `@matter/general`:** AES-CCM (`Crypto.encrypt`/`decrypt`) could replace our `AesCcm8.ts`; HMAC (`Crypto.signHmac`) could replace the hand-rolled PRF. These are low-risk swaps but require making the call sites async (WebCrypto constraint).

**Migration effort:** High. The EC-JPAKE math must remain (or be replaced by a future matter.js primitive). The DTLS record/handshake layer has no matter.js parallel and must stay. Refactoring the AES-CCM and PRF call sites to use `Crypto` would be a useful cleanup but not a prerequisite for the monorepo move.

---

### CoAP client and message codec

**What we have:**
- `src/coap/CoapMessage.ts` — CoAP message struct + serialize/parse via `coap-packet`
- `src/coap/CoapClient.ts` — RFC 7252 CON/ACK/separate-response state machine, token matching, listener registration, `CoapTimeoutError`

**matter.js equivalent:** None. CoAP is not part of matter.js.

**Migration effort:** Minimal — these files move as-is; `coap-packet` stays as a dep. No matter.js primitive to align to.

---

### Base TLV framing (`BasicTlvCodec.ts`, `TypeListTlv.ts`)

**What we have:**
- `BasicTlv.walk` / `BasicTlv.encode` — MeshCoP TLV stream framing (Thread spec §8.10: type:1, length:1+extended, value). Not the same encoding as Matter TLV (which uses a different type-length layout).
- `TypeListTlv` — encodes a list of TLV type numbers for `d/dq` / `d/dr` requests.

**matter.js equivalent:** `@matter/types` exposes a full Matter TLV schema system (`TlvObject`, `TlvNumber`, `TlvByteString`, etc.) for Matter's TLV encoding. Matter TLV and Thread MeshCoP/Network Diagnostic TLV are **different wire formats** — Thread uses a simple [type:1][length:1/3][value:N] layout while Matter TLV uses control-byte + tag + length with a richer type system. The two cannot be substituted.

**Migration effort:** None needed. `BasicTlvCodec.ts` stays as-is. It's a lightweight Thread-specific utility.

---

## 3. Package Identity

### Current vs. target

| Field | Current | Notes for matter.js move |
|---|---|---|
| Package name | `@matter-server/thread-br` | Would move to `@matter/thread-br` or a similar matter.js scope; exact name is a project decision |
| Package scope | `@matter-server/` | matter.js uses `@matter/` |
| `version` | `0.0.0-git` (monorepo-internal) | matter.js versions all packages together via changesets; adopt that scheme |
| `type` | `"module"` | Matches matter.js packages |
| `exports` | Single `.` entry with `dev-types` + `import` conditions | matter.js uses the same `dev-types` / `import` / (sometimes) `require` pattern — compatible |
| `main` | `dist/esm/index.js` | matter.js packages use this same path; compatible |

### Build tooling delta

Our build uses `@nacho-iot/js-tools` (`nacho-build`, `nacho-run`). matter.js uses its own build pipeline (TypeScript project references + esbuild). Key deltas:

- `nacho-build` emits ESM only (no CJS). matter.js packages typically emit ESM only for the newer packages; some still emit CJS — verify the target package tier before moving.
- `tsconfig.json` at the package root references `src/`, `test/`, `examples/` sub-tsconfigs (composite project references). matter.js uses the same pattern; compatible.
- `tsconfig.base.json` settings (`target: es2022`, `module: node16`, `moduleResolution: node16`, `strict`, `noUnusedLocals/Parameters`) are a close match to matter.js's shared base.
- The test runner is `matter-test` (wraps `@matter/testing` / mocha). matter.js uses the same runner internally; no change needed.

### `@license` header conformance

All `.ts` source files already carry:
```
@license
Copyright 2025-2026 Open Home Foundation
SPDX-License-Identifier: Apache-2.0
```

matter.js uses `Copyright 2022-2026 Matter.js Authors`. The copyright holder and year range would need updating to match the monorepo's conventions. SPDX identifier (`Apache-2.0`) is the same.

---

## 4. Public API Delta

The curated surface (`src/index.ts` after Track A) exports the following identifiers. Assessed against matter.js idioms:

### Compliant (follows matter.js conventions)

- **`interface X` + `namespace X { decode/encode }`** (declaration merging) — used by `OperationalDataset`, and all TLV decoders under `src/tlv/diag/` (`MacCounters`, `MleCounters`, `Connectivity`, `LeaderData`, `Mode`, `Route64`, `ChildTable`, `NetworkData`, `RouterNeighbor`, `ChildIpv6AddressList`, etc.). This is the matter.js codec idiom; compliant.
- **`Bytes` from `@matter/main`** used throughout for byte arrays — compliant.
- **`Logger` from `@matter/main`** used for structured logging — compliant.
- **`Observable` from `@matter/main`** used on `BorderRouterRegistry.events` and credential/diagnostic events — compliant.
- **`MatterError` subclasses** (via `CoapTimeoutError`, `CommissionerRejectedError`, `CommissionerTimeoutError`) — matter.js error convention is to extend `MatterError`; these use `Error` directly. This is the primary convention deviation.
- **`MdnsService` from `@matter/main/protocol`** used in `BorderRouterRegistry` — compliant dependency.

### Deviations to address before the monorepo move

| Symbol | Deviation | Fix required |
|---|---|---|
| `CoapTimeoutError`, `CommissionerRejectedError`, `CommissionerTimeoutError` | Extend plain `Error`, not `MatterError` | Extend `MatterError` from `@matter/general` |
| Package name `@matter-server/thread-br` | Wrong scope | Rename to `@matter/thread-br` (or project-chosen name) |
| Copyright header | `Open Home Foundation` vs `Matter.js Authors` | Update copyright line across all source files |
| `coap-packet` dep | External dep with no matter.js equivalent | Stays; must be declared in monorepo dep graph |
| `@noble/curves` + `@noble/hashes` | Already transitive in matter.js but not shared | Either hoist to monorepo-level dep or keep explicit |

### No remaining issues

All other public identifiers use the matter.js `Type + namespace` codec idiom, `Bytes`, `Observable`, or `Logger`. The `DtlsBackend` / `DtlsSocket` / `createDtlsBackend` extension points expose the DTLS layer as an interface for testing — a clean abstraction boundary for future replacement.
