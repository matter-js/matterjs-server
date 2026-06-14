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

export type { UdpEncapsulation } from "./tlv/meshcop/UdpEncapsulationTlv.js";
export { UdpEncapsulationTlv } from "./tlv/meshcop/UdpEncapsulationTlv.js";
export { Ip6AddressTlv } from "./tlv/meshcop/Ip6AddressTlv.js";

export {
    ALL_THREAD_NODES_REALM_LOCAL,
    ALL_THREAD_ROUTERS_REALM_LOCAL,
    deriveMeshLocalAddress,
    formatIp6,
} from "./util/meshLocalAddr.js";

export type { ConnectMeshcopOpts, DiagnosticResponse, MeshcopHandle } from "./diagnostic/index.js";
export type { DiagnosticSource, QueryMulticastHandle, QueryMulticastOptions } from "./diagnostic/index.js";
export { connectMeshcop, DefaultTlvSet, MeshCopDiagnosticSource } from "./diagnostic/index.js";

export { Pskc } from "./crypto/index.js";

export type { DtlsBackend, DtlsConnectOpts, DtlsSocket } from "./dtls/socket/index.js";
export { createDtlsBackend } from "./dtls/socket/index.js";

export { Commissioner, CommissionerRejectedError, CommissionerTimeoutError } from "./commissioner/index.js";

export type {
    OtbrDatasetHex,
    OtbrLeaderData,
    OtbrNodeInfo,
    OtbrRestCapability,
    OtbrRestClientOptions,
    OtbrRestErrorCode,
    OtbrRestErrorOptions,
} from "./otbr-rest/index.js";
export { OtbrRestClient, OtbrRestDiagnosticSource, OtbrRestError, OtbrRestProbe } from "./otbr-rest/index.js";

export { decodeStateBitmap, ExtPanIdLockManager, selectBr, selectSource } from "./selection/index.js";
export type { DecodedStateBitmap, SelectSourceOpts } from "./selection/index.js";
