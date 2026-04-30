/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @matter-server/thread-br - Thread Border Router communication.
 *
 * Public API populated incrementally per Phases 0a, 0b, 1+.
 */
export type { BorderRouterEntry } from "./discovery/index.js";
export { BorderRouterRegistry } from "./discovery/index.js";

export { MeshCopTlvType, MeshCopTlvTypeName, OperationalDataset, SecurityPolicy } from "./dataset/index.js";

export type { ThreadNetworkCredentials } from "./credentials/index.js";
export { ThreadCredentialsRegistry } from "./credentials/index.js";

export type { BasicTlvEntry } from "./tlv/BasicTlvCodec.js";
export { BasicTlv } from "./tlv/BasicTlvCodec.js";

export type { NetworkDiagnosticEntry } from "./tlv/NetworkDiagnosticTlv.js";
export { NetworkDiagnosticTlv } from "./tlv/NetworkDiagnosticTlv.js";
export { NetworkDiagTlvType, NetworkDiagTlvTypeName } from "./tlv/networkDiagTlvTypes.js";
export { TypeListTlv } from "./tlv/TypeListTlv.js";

export * as NetworkDiagnosticDecoders from "./tlv/diag/index.js";

export { DefaultTlvSet } from "./diagnostic/index.js";

export { Pskc } from "./crypto/index.js";
