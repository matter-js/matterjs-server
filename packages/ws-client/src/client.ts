/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Connection, ConnectionOptions, WebSocketFactory } from "./connection.js";
import { CommandTimeoutError, ConnectionClosedError, InvalidServerVersion, ServerCommandError } from "./exceptions.js";
import { redactIncomingMessage } from "./logging-redaction.js";
import {
    AccessControlEntry,
    AllCredentialsSummary,
    APICommands,
    BindingTarget,
    CommissionableNodeData,
    CommissioningParameters,
    ErrorResultMessage,
    EventMessage,
    IcdStateData,
    LogLevelResponse,
    SettableLogLevelString,
    MatterFabricData,
    MatterNodeEvent,
    MatterSoftwareVersion,
    NodePingResult,
    ResponseOf,
    SubscriptionReportData,
    SuccessResultMessage,
    ThreadDiagnosticsBatch,
    CameraSessionEndedData,
    CameraStreamEvictedData,
    WebRtcCallbackData,
    WebRtcProviderCommandName,
} from "./models/model.js";
import { MatterNode } from "./models/node.js";

/** Union type for all incoming WebSocket messages */
type IncomingMessage = EventMessage | ErrorResultMessage | SuccessResultMessage;

/** Schema 14 is when the server started relaying these two; the offer commands need only schema 12. */
const SIGNALLING_PROVIDER_COMMANDS: ReadonlySet<WebRtcProviderCommandName> = new Set([
    "ProvideAnswer",
    "ProvideIceCandidates",
]);

/** Converts node_id to string for use as object key (works for both number and bigint without precision loss) */
function toNodeKey(nodeId: number | bigint): string {
    return String(nodeId);
}

/**
 * HTTP URL taking the bytes of a reserved OTA upload, derived from the WebSocket URL: same origin
 * and mount point, `/ws` swapped for `/ota-upload/<upload_id>`.
 */
export function otaUploadUrl(wsUrl: string, uploadId: string): string {
    const url = new URL(wsUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    const mountPoint = url.pathname.replace(/\/ws\/?$/, "").replace(/\/$/, "");
    url.pathname = `${mountPoint}/ota-upload/${uploadId}`;
    url.search = "";
    url.hash = "";
    return url.href;
}

/** Default timeout for WebSocket commands in milliseconds (5 minutes) */
export const DEFAULT_COMMAND_TIMEOUT = 5 * 60 * 1000;

/** Options for {@link MatterClient.commissionWithCode}. */
export interface CommissionWithCodeOptions {
    /** Stored WiFi credential id to use (schema 12; omit for the reserved `default` entry). */
    wifiCredentialsId?: string;
    /** Stored Thread dataset id to use (schema 12; omit for the reserved `default` entry). */
    threadDatasetId?: string;
    /**
     * Schema 14. Seconds the server looks for the device and sets up PASE; see the API docs for the limit. The call
     * still ends after `timeout`, so a long value needs a larger `timeout` too.
     */
    discoveryTimeoutS?: number;
    /** Per-call command timeout in ms (overrides {@link MatterClient.commandTimeout}). */
    timeout?: number;
}

/** Options for {@link MatterClient.commissionOnNetwork}. */
export interface CommissionOnNetworkOptions {
    /** Discovery filter type: 0=None, 1=ShortDiscriminator, 2=LongDiscriminator, 3=VendorId, 4=DeviceType. */
    filterType?: number;
    /** Filter value (discriminator, vendor ID or device type depending on `filterType`). */
    filter?: number;
    /** Direct IP address of the device (schema 6). */
    ipAddr?: string;
    /**
     * Schema 14. Seconds the server looks for the device and sets up PASE; see the API docs for the limit. The call
     * still ends after `timeout`, so a long value needs a larger `timeout` too.
     */
    discoveryTimeoutS?: number;
    /** Per-call command timeout in ms (overrides {@link MatterClient.commandTimeout}). */
    timeout?: number;
}

/** Options for {@link MatterClient.deviceCommand}. */
export interface DeviceCommandOptions {
    /** Timeout for timed interactions, as required by some commands (door lock). */
    timedRequestTimeoutMs?: number;
    /** Time the device may take to process the command. */
    interactionTimeoutMs?: number;
    /** Per-call command timeout in ms (overrides {@link MatterClient.commandTimeout}). */
    timeout?: number;
}

/** One command of {@link MatterClient.batchedDeviceCommands}. */
export interface BatchedDeviceCommand {
    endpointId: number;
    clusterId: number;
    commandName: string;
    payload?: Record<string, unknown>;
}

/** Options for {@link MatterClient.batchedDeviceCommands}. */
export interface BatchedDeviceCommandsOptions {
    /** Sends the batch after one Timed Request with this timeout (0 to 65535 ms). */
    timedRequestTimeoutMs?: number;
    /** Time the device may take to process the batch. */
    interactionTimeoutMs?: number;
    /** Per-call command timeout in ms (overrides {@link MatterClient.commandTimeout}). */
    timeout?: number;
}

/** Options for {@link MatterClient.writeAttribute}. */
export interface WriteAttributeOptions {
    /** Schema 14. Sends the write as a timed write with this timeout (0 to 65535 ms). */
    timedRequestTimeoutMs?: number;
    /** Per-call command timeout in ms (overrides {@link MatterClient.commandTimeout}). */
    timeout?: number;
}

/** Options for the credential set/remove commands. */
export interface CredentialCommandOptions {
    /** Named credential entry id (schema 12); omit for the reserved `default` entry. */
    id?: string;
    /** Per-call command timeout in ms (overrides {@link MatterClient.commandTimeout}). */
    timeout?: number;
}

/** Subscription ids are assigned by each device, so only node and id together name one subscription. */
function subscriptionKey(nodeId: number | bigint, subscriptionId: number) {
    return `${nodeId}/${subscriptionId}`;
}

/**
 * Says which node a `nodes_changed` event concerns and why it fired. `nodeId` is a bigint for large ids, so compare
 * it via `String()`.
 */
export type NodesChangedDetail =
    | { reason: "node_added" | "node_removed" | "node_updated"; nodeId: number | bigint }
    | {
          reason: "attribute_updated";
          nodeId: number | bigint;
          /** `endpoint/cluster/attribute` of the changed attribute. */
          attributeKey: string;
      };

/** Listener arguments for each event name that {@link MatterClient.addEventListener} accepts. */
export interface ClientEventMap {
    nodes_changed: [detail: NodesChangedDetail];
    server_info_updated: [];
    server_shutdown: [];
    connection_lost: [];
    thread_diagnostics_updated: [];
}

type ClientEventListeners = { [E in keyof ClientEventMap]: Array<(...args: ClientEventMap[E]) => void> };

/** Receives the events of one subscription opened with {@link MatterClient.subscribe}. */
export interface SubscriptionListener {
    /** A report after the first one, which the `subscribe` result carries. */
    report(data: SubscriptionReportData): void;
    /** The subscription ended without `unsubscribe`, the connection to the server was lost, or {@link MatterClient.disconnect} was called. */
    ended?(): void;
}

export class MatterClient {
    public connection: Connection;
    public nodes: Record<string, MatterNode> = {};
    /**
     * Latest Thread diagnostic batch per network, keyed by 16-char uppercase extPanId hex.
     * Replaced (not mutated) on every update so consumers passing this map as a Lit
     * @property() detect the snapshot change via the default `===` identity compare.
     */
    public threadDiagnostics: ReadonlyMap<string, ThreadDiagnosticsBatch> = new Map();
    public serverBaseAddress: string;
    /** Whether this client is connected to a production server (optional, for UI purposes) */
    public isProduction: boolean = false;
    /** Default timeout for commands in milliseconds. Set to 0 to disable timeouts. */
    public commandTimeout: number = DEFAULT_COMMAND_TIMEOUT;
    // Using 'unknown' for resolve since the actual types vary by command
    private result_futures: Record<
        string,
        {
            resolve: (value: unknown) => void;
            reject: (reason?: unknown) => void;
            timeoutId?: ReturnType<typeof setTimeout>;
        }
    > = {};
    /** Keyed by {@link subscriptionKey}. */
    private subscriptionListeners = new Map<string, SubscriptionListener>();
    // Start with random offset for defense-in-depth and easier debugging across sessions
    private msgId = Math.floor(Math.random() * 0x7fffffff);
    private eventListeners: ClientEventListeners = {
        nodes_changed: [],
        server_info_updated: [],
        server_shutdown: [],
        connection_lost: [],
        thread_diagnostics_updated: [],
    };
    private webrtcCallbackListeners: Array<(data: WebRtcCallbackData) => void> = [];
    private cameraSessionEndedListeners: Array<(data: CameraSessionEndedData) => void> = [];
    private cameraStreamEvictedListeners: Array<(data: CameraStreamEvictedData) => void> = [];
    private threadDiagnosticsListeners: Array<(batch: ThreadDiagnosticsBatch) => void> = [];
    private nodeEventListeners: Array<(event: MatterNodeEvent) => void> = [];

    /**
     * Create a new MatterClient.
     * @param url WebSocket URL to connect to
     * @param options The {@link ConnectionOptions}, or only a {@link WebSocketFactory}.
     *                For Node.js, pass a factory: (url) => new WebSocket(url) from the 'ws' package.
     *                For browser, leave the factory undefined to use native WebSocket.
     */
    constructor(
        public url: string,
        options?: WebSocketFactory | ConnectionOptions,
    ) {
        this.url = url;
        this.connection = new Connection(this.url, options);
        this.serverBaseAddress = this.url.split("://")[1].split(":")[0] ?? "";
    }

    get serverInfo() {
        return this.connection.serverInfo!;
    }

    /**
     * Listen for a client event. `nodes_changed` passes a {@link NodesChangedDetail} naming the node it
     * concerns, so a listener interested in one node can ignore the rest; other events pass nothing.
     * Returns an unsubscribe function.
     */
    addEventListener<E extends keyof ClientEventMap>(event: E, listener: (...args: ClientEventMap[E]) => void) {
        const listeners = this.eventListeners[event];
        // Wrapper per registration: the same listener added twice must unsubscribe separately
        const entry = (...args: ClientEventMap[E]) => listener(...args);
        listeners.push(entry);
        return () => {
            const index = listeners.indexOf(entry);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        };
    }

    /**
     * Subscribe to webrtc_callback events with the typed payload.
     * Returns an unsubscribe function.
     */
    addWebRtcCallbackListener(listener: (data: WebRtcCallbackData) => void): () => void {
        this.webrtcCallbackListeners.push(listener);
        return () => {
            this.webrtcCallbackListeners = this.webrtcCallbackListeners.filter(l => l !== listener);
        };
    }

    /**
     * Subscribe to camera_session_ended events. Returns an unsubscribe function.
     *
     * The server sends them only to a connection that has issued a camera command.
     */
    addCameraSessionEndedListener(listener: (data: CameraSessionEndedData) => void): () => void {
        this.cameraSessionEndedListeners.push(listener);
        return () => {
            this.cameraSessionEndedListeners = this.cameraSessionEndedListeners.filter(l => l !== listener);
        };
    }

    /** Subscribe to camera_stream_evicted events. Returns an unsubscribe function. */
    addCameraStreamEvictedListener(listener: (data: CameraStreamEvictedData) => void): () => void {
        this.cameraStreamEvictedListeners.push(listener);
        return () => {
            this.cameraStreamEvictedListeners = this.cameraStreamEvictedListeners.filter(l => l !== listener);
        };
    }

    /**
     * Subscribe to thread_diagnostics_updated with the batch that arrived.
     *
     * {@link threadDiagnostics} accumulates batches for the life of the connection and drops one
     * only when the whole map is reset, so a consumer that rebuilds its own state from that map
     * reinstates batches the server has since stopped serving. Take the batch from here.
     */
    addThreadDiagnosticsListener(listener: (batch: ThreadDiagnosticsBatch) => void): () => void {
        this.threadDiagnosticsListeners.push(listener);
        return () => {
            this.threadDiagnosticsListeners = this.threadDiagnosticsListeners.filter(l => l !== listener);
        };
    }

    addNodeEventListener(listener: (event: MatterNodeEvent) => void): () => void {
        this.nodeEventListeners.push(listener);
        return () => {
            this.nodeEventListeners = this.nodeEventListeners.filter(l => l !== listener);
        };
    }

    commissionWithCode(code: string, networkOnly?: boolean, options?: CommissionWithCodeOptions): Promise<MatterNode>;
    /** @deprecated Pass the timeout via the options object (`{ timeout }`) instead. */
    commissionWithCode(code: string, networkOnly: boolean, timeout: number): Promise<MatterNode>;
    async commissionWithCode(
        code: string,
        networkOnly = true,
        optsOrTimeout?: number | CommissionWithCodeOptions,
    ): Promise<MatterNode> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        const usesIds = opts.wifiCredentialsId !== undefined || opts.threadDatasetId !== undefined;
        const data = await this.sendCommand(
            "commission_with_code",
            opts.discoveryTimeoutS !== undefined ? 14 : usesIds ? 12 : 0,
            {
                code,
                network_only: networkOnly,
                wifi_credentials_id: opts.wifiCredentialsId,
                thread_dataset_id: opts.threadDatasetId,
                discovery_timeout_s: opts.discoveryTimeoutS,
            },
            opts.timeout,
        );
        return new MatterNode(data);
    }

    /** Commissions a device that is already on the network, found by setup PIN code and optional filter or IP. */
    async commissionOnNetwork(setupPinCode: number, options: CommissionOnNetworkOptions = {}): Promise<MatterNode> {
        const data = await this.sendCommand(
            "commission_on_network",
            // An older server ignores filter type 4 and commissions any device with the setup code.
            options.discoveryTimeoutS !== undefined || options.filterType === 4
                ? 14
                : options.ipAddr !== undefined
                  ? 6
                  : 0,
            {
                setup_pin_code: setupPinCode,
                filter_type: options.filterType,
                filter: options.filter,
                ip_addr: options.ipAddr,
                discovery_timeout_s: options.discoveryTimeoutS,
            },
            options.timeout,
        );
        return new MatterNode(data);
    }

    setWifiCredentials(ssid: string, credentials: string, options?: CredentialCommandOptions): Promise<void>;
    /** @deprecated Pass the timeout via the options object (`{ timeout }`) instead. */
    setWifiCredentials(ssid: string, credentials: string, timeout: number): Promise<void>;
    async setWifiCredentials(
        ssid: string,
        credentials: string,
        optsOrTimeout?: number | CredentialCommandOptions,
    ): Promise<void> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        await this.sendCommand(
            "set_wifi_credentials",
            opts.id === undefined || opts.id === "default" ? 0 : 12,
            { ssid, credentials, id: opts.id },
            opts.timeout,
        );
    }

    setThreadOperationalDataset(dataset: string, options?: CredentialCommandOptions): Promise<void>;
    /** @deprecated Pass the timeout via the options object (`{ timeout }`) instead. */
    setThreadOperationalDataset(dataset: string, timeout: number): Promise<void>;
    async setThreadOperationalDataset(
        dataset: string,
        optsOrTimeout?: number | CredentialCommandOptions,
    ): Promise<void> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        await this.sendCommand(
            "set_thread_dataset",
            opts.id === undefined || opts.id === "default" ? 0 : 12,
            { dataset, id: opts.id },
            opts.timeout,
        );
    }

    removeWifiCredentials(options?: CredentialCommandOptions): Promise<void>;
    /** @deprecated Pass the timeout via the options object (`{ timeout }`) instead. */
    removeWifiCredentials(timeout: number): Promise<void>;
    async removeWifiCredentials(optsOrTimeout?: number | CredentialCommandOptions): Promise<void> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        await this.sendCommand(
            "remove_wifi_credentials",
            opts.id === undefined || opts.id === "default" ? 0 : 12,
            { id: opts.id },
            opts.timeout,
        );
    }

    removeThreadDataset(options?: CredentialCommandOptions): Promise<void>;
    /** @deprecated Pass the timeout via the options object (`{ timeout }`) instead. */
    removeThreadDataset(timeout: number): Promise<void>;
    async removeThreadDataset(optsOrTimeout?: number | CredentialCommandOptions): Promise<void> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        await this.sendCommand(
            "remove_thread_dataset",
            opts.id === undefined || opts.id === "default" ? 0 : 12,
            { id: opts.id },
            opts.timeout,
        );
    }

    async getAllCredentials(timeout?: number): Promise<AllCredentialsSummary> {
        return this.sendCommand("get_all_credentials", 12, {}, timeout);
    }

    async openCommissioningWindow(
        nodeId: number | bigint,
        windowTimeout?: number,
        iteration?: number,
        option?: 0 | 1,
        discriminator?: number,
        timeout?: number,
    ): Promise<CommissioningParameters> {
        // Open a commissioning window to commission a device present on this controller to another.
        // windowTimeout: How long to keep the commissioning window open (in seconds).
        // timeout: Optional command timeout in milliseconds.
        // Returns code to use as discriminator.
        return await this.sendCommand(
            "open_commissioning_window",
            0,
            {
                node_id: nodeId,
                timeout: windowTimeout,
                iteration,
                option,
                discriminator,
            },
            timeout,
        );
    }

    async discoverCommissionableNodes(timeout?: number): Promise<CommissionableNodeData[]> {
        // Discover Commissionable Nodes (discovered on BLE or mDNS).
        return await this.sendCommand("discover_commissionable_nodes", 0, {}, timeout);
    }

    async getMatterFabrics(nodeId: number | bigint, timeout?: number): Promise<MatterFabricData[]> {
        // Get Matter fabrics from a device.
        // Returns a list of MatterFabricData objects.
        return await this.sendCommand("get_matter_fabrics", 3, { node_id: nodeId }, timeout);
    }

    async removeMatterFabric(nodeId: number | bigint, fabricIndex: number, timeout?: number): Promise<void> {
        // Remove a Matter fabric from a device.
        await this.sendCommand("remove_matter_fabric", 3, { node_id: nodeId, fabric_index: fabricIndex }, timeout);
    }

    async pingNode(nodeId: number | bigint, attempts = 1, timeout?: number): Promise<NodePingResult> {
        // Ping node on the currently known IP-address(es).
        return await this.sendCommand("ping_node", 0, { node_id: nodeId, attempts }, timeout);
    }

    async getNodeIPAddresses(
        nodeId: number | bigint,
        preferCache?: boolean,
        scoped?: boolean,
        timeout?: number,
    ): Promise<string[]> {
        // Return the currently known (scoped) IP-address(es).
        return await this.sendCommand(
            "get_node_ip_addresses",
            8,
            {
                node_id: nodeId,
                prefer_cache: preferCache,
                scoped: scoped,
            },
            timeout,
        );
    }

    async removeNode(nodeId: number | bigint, timeout?: number): Promise<void> {
        // Remove a Matter node/device from the fabric.
        await this.sendCommand("remove_node", 0, { node_id: nodeId }, timeout);
    }

    async interviewNode(nodeId: number | bigint, timeout?: number): Promise<void> {
        // Interview a node.
        await this.sendCommand("interview_node", 0, { node_id: nodeId }, timeout);
    }

    async registerIcd(
        nodeId: number | bigint,
        options?: { allowMultiAdmin?: boolean; ignoredVendors?: number[] },
        timeout?: number,
    ): Promise<IcdStateData> {
        return this.sendCommand(
            "register_icd",
            0,
            {
                node_id: nodeId,
                allow_multi_admin: options?.allowMultiAdmin,
                ignored_vendors: options?.ignoredVendors,
            },
            timeout,
        );
    }

    async unregisterIcd(nodeId: number | bigint, force?: boolean, timeout?: number): Promise<IcdStateData> {
        return this.sendCommand("unregister_icd", 0, { node_id: nodeId, force }, timeout);
    }

    async resyncIcd(nodeId: number | bigint): Promise<null> {
        return this.sendCommand("resync_icd", 0, { node_id: nodeId });
    }

    async getIcdState(nodeId: number | bigint, timeout?: number): Promise<IcdStateData> {
        return this.sendCommand("get_icd_state", 0, { node_id: nodeId }, timeout);
    }

    async importTestNode(dump: string, timeout?: number): Promise<void> {
        // Import test node(s) from a HA or Matter server diagnostics dump.
        await this.sendCommand("import_test_node", 0, { dump }, timeout);
    }

    async readAttribute(
        nodeId: number | bigint,
        attributePath: string | string[],
        timeout?: number,
        fabricFiltered = false,
    ): Promise<Record<string, unknown>> {
        return await this.sendCommand(
            "read_attribute",
            0,
            { node_id: nodeId, attribute_path: attributePath, fabric_filtered: fabricFiltered },
            timeout,
        );
    }

    /** Schema 14. A Matter Read with full control over the request. */
    async read(args: APICommands["read"]["requestArgs"], timeout?: number): Promise<ResponseOf<"read">> {
        return await this.sendCommand("read", 14, args, timeout);
    }

    /**
     * Schema 14. Opens a Matter subscription owned by this connection. The result carries the first report; later
     * reports and the end go to `listener` until {@link unsubscribe}.
     */
    async subscribe(
        args: APICommands["subscribe"]["requestArgs"],
        listener: SubscriptionListener,
        timeout = this.commandTimeout,
    ): Promise<ResponseOf<"subscribe">> {
        let timedOut = false;
        // Registered when the response is handled, because a report can arrive in the same socket read.
        const response = this.sendCommand("subscribe", 14, args, 0, ({ subscription_id }) => {
            if (timedOut) {
                // The caller never learned this id, so nobody else can end the subscription.
                this.unsubscribe(args.node_id, subscription_id).catch(error =>
                    this.connection.logger.warn(
                        `Could not end subscription ${subscription_id} after its subscribe timed out`,
                        () => error,
                    ),
                );
                return;
            }
            this.subscriptionListeners.set(subscriptionKey(args.node_id, subscription_id), listener);
        });
        if (timeout <= 0) {
            return await response;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                response,
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => {
                        timedOut = true;
                        reject(new CommandTimeoutError("subscribe", timeout));
                    }, timeout);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    /** Schema 14. Ends a subscription opened with {@link subscribe}; its listener gets no further calls. */
    async unsubscribe(nodeId: number | bigint, subscriptionId: number, timeout?: number): Promise<void> {
        this.subscriptionListeners.delete(subscriptionKey(nodeId, subscriptionId));
        await this.sendCommand("unsubscribe", 14, { node_id: nodeId, subscription_id: subscriptionId }, timeout);
    }

    /**
     * Schema 14. Switches the server's own subscription to the node on; see the API docs for when this fails. Only
     * available with the server running with auto subscription disabled.
     */
    async enableAutoSubscription(nodeId: number | bigint, timeout?: number): Promise<void> {
        await this.sendCommand("enable_auto_subscription", 14, { node_id: nodeId }, timeout);
    }

    /** Schema 14. Decodes a QR code payload (`MT:…`) or a manual pairing code without contacting any device. */
    async parseOnboardingPayload(code: string, timeout?: number): Promise<ResponseOf<"parse_onboarding_payload">> {
        return await this.sendCommand("parse_onboarding_payload", 14, { code }, timeout);
    }

    /** Schema 14. Switches the server's own subscription to the node off. Only available with auto subscription disabled. */
    async disableAutoSubscription(nodeId: number | bigint, timeout?: number): Promise<void> {
        await this.sendCommand("disable_auto_subscription", 14, { node_id: nodeId }, timeout);
    }

    /** Writes an attribute; `*` as the endpoint writes every endpoint of the node that has it (schema 14). */
    async writeAttribute(
        nodeId: number | bigint,
        attributePath: string,
        value: unknown,
        optsOrTimeout?: number | WriteAttributeOptions,
    ): Promise<ResponseOf<"write_attribute">> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        return await this.sendCommand(
            "write_attribute",
            opts.timedRequestTimeoutMs !== undefined ? 14 : 0,
            {
                node_id: nodeId,
                attribute_path: attributePath,
                value: value,
                timed_request_timeout_ms: opts.timedRequestTimeoutMs,
            },
            opts.timeout,
        );
    }

    async checkNodeUpdate(nodeId: number | bigint, timeout?: number): Promise<MatterSoftwareVersion | null> {
        // Check if there is an update for a particular node.
        // Reads the current software version and checks the DCL if there is an update
        // available. If there is an update available, the command returns the version
        // information of the latest update available.
        return await this.sendCommand("check_node_update", 10, { node_id: nodeId }, timeout);
    }

    async updateNode(nodeId: number | bigint, softwareVersion: number | string, timeout?: number): Promise<void> {
        // Update a node to a new software version.
        // This command checks if the requested software version is indeed still available
        // and if so, it will start the update process. The update process will be handled
        // by the built-in OTA provider. The OTA provider will download the update and
        // notify the node about the new update.
        await this.sendCommand("update_node", 10, { node_id: nodeId, software_version: softwareVersion }, timeout);
    }

    /**
     * Store a locally-uploaded .ota firmware file in the server's OTA image store.
     *
     * Two steps: the WebSocket session authorizes the upload and reserves a slot, then the bytes go
     * over HTTP against the returned single-use id.
     */
    async uploadOtaFile(file: Blob, timeout?: number): Promise<MatterSoftwareVersion> {
        // An oversized image is rejected by the server (413) rather than here: a reservation holds
        // one of the server's few upload slots for a minute, and there is no way to hand it back.
        const ticket = await this.sendCommand("initiate_ota_upload", 13, {}, timeout);

        const response = await fetch(otaUploadUrl(this.url, ticket.upload_id), {
            method: "POST",
            body: file,
            signal: timeout ? AbortSignal.timeout(timeout) : undefined,
        });

        // A proxy in front of the server can answer with HTML, so the status is the only thing that
        // can be trusted to be there.
        let body: MatterSoftwareVersion & { error?: string; message?: string };
        try {
            body = await response.json();
        } catch {
            if (!response.ok) {
                throw new Error(`Firmware upload failed: HTTP ${response.status} ${response.statusText}`);
            }
            throw new Error("Firmware upload returned a response that is no JSON");
        }
        if (!response.ok) {
            throw new Error(body.message ?? body.error ?? `HTTP ${response.status} ${response.statusText}`);
        }
        return body;
    }

    async setACLEntry(nodeId: number | bigint, entry: AccessControlEntry[], timeout?: number) {
        return await this.sendCommand(
            "set_acl_entry",
            0,
            {
                node_id: nodeId,
                entry: entry,
            },
            timeout,
        );
    }

    async setNodeBinding(nodeId: number | bigint, endpoint: number, bindings: BindingTarget[], timeout?: number) {
        return await this.sendCommand(
            "set_node_binding",
            0,
            {
                node_id: nodeId,
                endpoint: endpoint,
                bindings: bindings,
            },
            timeout,
        );
    }

    async deviceCommand(
        nodeId: number | bigint,
        endpointId: number,
        clusterId: number,
        commandName: string,
        payload?: Record<string, unknown>,
        optsOrTimeout?: number | DeviceCommandOptions,
    ): Promise<unknown> {
        const opts = typeof optsOrTimeout === "number" ? { timeout: optsOrTimeout } : (optsOrTimeout ?? {});
        return await this.sendCommand(
            "device_command",
            0,
            {
                node_id: nodeId,
                endpoint_id: endpointId,
                cluster_id: clusterId,
                command_name: commandName,
                payload: payload ?? {},
                response_type: null,
                timed_request_timeout_ms: opts.timedRequestTimeoutMs,
                interaction_timeout_ms: opts.interactionTimeoutMs,
            },
            opts.timeout,
        );
    }

    /**
     * Schema 14. Sends all commands to the node in one InvokeRequest, in order, never split and never combined with
     * other commands. Answers one entry per command; one command failing does not fail the others.
     */
    async batchedDeviceCommands(
        nodeId: number | bigint,
        commands: BatchedDeviceCommand[],
        opts: BatchedDeviceCommandsOptions = {},
    ): Promise<ResponseOf<"batched_device_commands">> {
        return await this.sendCommand(
            "batched_device_commands",
            14,
            {
                node_id: nodeId,
                commands: commands.map(({ endpointId, clusterId, commandName, payload }) => ({
                    endpoint_id: endpointId,
                    cluster_id: clusterId,
                    command_name: commandName,
                    payload: payload ?? {},
                })),
                timed_request_timeout_ms: opts.timedRequestTimeoutMs,
                interaction_timeout_ms: opts.interactionTimeoutMs,
            },
            opts.timeout,
        );
    }

    async sendWebRtcProviderCommand(
        nodeId: number | bigint,
        endpointId: number,
        commandName: WebRtcProviderCommandName,
        payload: Record<string, unknown>,
        timeout?: number,
    ): Promise<unknown> {
        return await this.sendCommand(
            "send_webrtc_provider_command",
            SIGNALLING_PROVIDER_COMMANDS.has(commandName) ? 14 : 12,
            { node_id: nodeId, endpoint_id: endpointId, command_name: commandName, payload },
            timeout,
        );
    }

    async getNodes(onlyAvailable = false, timeout?: number): Promise<MatterNode[]> {
        const data = await this.sendCommand("get_nodes", 0, { only_available: onlyAvailable }, timeout);
        return data.map(n => new MatterNode(n));
    }

    async getNode(nodeId: number | bigint, timeout?: number): Promise<MatterNode> {
        const data = await this.sendCommand("get_node", 0, { node_id: nodeId }, timeout);
        return new MatterNode(data);
    }

    async getVendorNames(filterVendors?: number[], timeout?: number): Promise<Record<string, string>> {
        return await this.sendCommand("get_vendor_names", 0, { filter_vendors: filterVendors }, timeout);
    }

    async fetchServerInfo(timeout?: number) {
        return await this.sendCommand("server_info", 0, {}, timeout);
    }

    async setDefaultFabricLabel(label: string | null, timeout?: number): Promise<void> {
        await this.sendCommand("set_default_fabric_label", 0, { label }, timeout);
    }

    async getFabricLabel(timeout?: number): Promise<string | null> {
        const { fabric_label } = await this.sendCommand("get_fabric_label", 12, {}, timeout);
        return fabric_label;
    }

    /**
     * Get the current log levels for console and file logging.
     * @param timeout Optional command timeout in milliseconds
     * @returns The current log level configuration
     */
    async getLogLevel(timeout?: number): Promise<LogLevelResponse> {
        return await this.sendCommand("get_loglevel", 0, {}, timeout);
    }

    /**
     * Set the log level for console and/or file logging.
     * Changes are temporary and will be reset when the server restarts.
     * @param consoleLoglevel Console log level to set (optional)
     * @param fileLoglevel File log level to set, only applied if file logging is enabled (optional)
     * @param timeout Optional command timeout in milliseconds
     * @returns The log level configuration after the change
     */
    async setLogLevel(
        consoleLoglevel?: SettableLogLevelString,
        fileLoglevel?: SettableLogLevelString,
        timeout?: number,
    ): Promise<LogLevelResponse> {
        return await this.sendCommand(
            "set_loglevel",
            0,
            {
                console_loglevel: consoleLoglevel,
                file_loglevel: fileLoglevel,
            },
            timeout,
        );
    }

    /**
     * Send a command to the Matter server.
     * @param command The command name
     * @param require_schema Minimum schema version required (0 for any version)
     * @param args Command arguments
     * @param timeout Optional timeout in milliseconds. Defaults to `commandTimeout`. Set to 0 to disable.
     * @param onResult Called with the result while the response message is handled, before the next message
     * @returns Promise that resolves with the command result
     * @throws Error if the command times out or fails
     */
    sendCommand<T extends keyof APICommands>(
        command: T,
        require_schema: number | undefined = undefined,
        args: APICommands[T]["requestArgs"],
        timeout = this.commandTimeout,
        onResult?: (result: APICommands[T]["response"]) => void,
    ): Promise<APICommands[T]["response"]> {
        if (require_schema && this.serverInfo.schema_version < require_schema) {
            throw new InvalidServerVersion(
                "Command not available due to incompatible server version. Update the Matter " +
                    `Server to a version that supports at least api schema ${require_schema}.`,
            );
        }

        // Reset counter before overflow to maintain precision
        if (this.msgId >= Number.MAX_SAFE_INTEGER) {
            this.msgId = 0;
        }
        const messageId = String(++this.msgId);

        const message = {
            message_id: messageId,
            command,
            args,
        };

        return new Promise<APICommands[T]["response"]>((resolve, reject) => {
            // Set up timeout if enabled
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    // Check if still pending (not already resolved/rejected)
                    const pending = this.result_futures[messageId];
                    if (pending) {
                        // Clear timeout and delete entry BEFORE rejecting to prevent double resolution
                        if (pending.timeoutId) {
                            clearTimeout(pending.timeoutId);
                        }
                        delete this.result_futures[messageId];
                        reject(new CommandTimeoutError(command, timeout));
                    }
                }, timeout);
            }

            // Type-erased storage: resolve/reject are stored as unknown handlers
            this.result_futures[messageId] = {
                resolve:
                    onResult === undefined
                        ? resolve
                        : result => {
                              onResult(result);
                              resolve(result);
                          },
                reject,
                timeoutId,
            };
            this.connection.sendMessage(message);
        });
    }

    /**
     * Safely resolve a pending command, ensuring it's only resolved once.
     * Clears timeout and removes from pending futures before resolving.
     */
    private _resolvePendingCommand(messageId: string, result: unknown): void {
        const pending = this.result_futures[messageId];
        if (pending) {
            // Clear timeout and delete entry BEFORE resolving to prevent double resolution
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            delete this.result_futures[messageId];
            pending.resolve(result);
        }
    }

    /**
     * Safely reject a pending command, ensuring it's only rejected once.
     * Clears timeout and removes from pending futures before rejecting.
     */
    private _rejectPendingCommand(messageId: string, error: Error): void {
        const pending = this.result_futures[messageId];
        if (pending) {
            // Clear timeout and delete entry BEFORE rejecting to prevent double resolution
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            delete this.result_futures[messageId];
            pending.reject(error);
        }
    }

    /** The server ends every subscription of a connection when it closes, without a `subscription_ended`. */
    private _endAllSubscriptions(): void {
        const listeners = [...this.subscriptionListeners.values()];
        this.subscriptionListeners.clear();
        for (const listener of listeners) {
            // Runs inside disconnect and the connection-lost handling, which must complete.
            try {
                listener.ended?.();
            } catch (error) {
                this.connection.logger.error("Subscription listener failed on end", () => error);
            }
        }
    }

    /**
     * Reject all pending commands with a ConnectionClosedError.
     * Called when the connection is closed or lost.
     */
    private _rejectAllPendingCommands(): void {
        const error = new ConnectionClosedError();
        const pendingIds = Object.keys(this.result_futures);
        for (const messageId of pendingIds) {
            this._rejectPendingCommand(messageId, error);
        }
    }

    async connect() {
        if (this.connection.connected) {
            return;
        }
        await this.connection.connect(
            msg => this._handleIncomingMessage(msg as IncomingMessage),
            () => {
                this._rejectAllPendingCommands();
                this._endAllSubscriptions();
                this.fireEvent("connection_lost");
            },
        );
    }

    disconnect(clearStorage = false) {
        // Reject all pending commands before disconnecting
        this._rejectAllPendingCommands();
        this._endAllSubscriptions();
        // disconnect from the server
        if (this.connection && this.connection.connected) {
            this.connection.disconnect();
        }
        if (clearStorage && typeof localStorage !== "undefined") {
            localStorage.removeItem("matterURL");
            location.reload();
        }
    }

    async startListening() {
        await this.connect();

        const nodesArray = await this.sendCommand("start_listening", 0, {});

        const nodes: Record<string, MatterNode> = {};
        for (const node of nodesArray) {
            nodes[toNodeKey(node.node_id)] = new MatterNode(node);
        }
        this.nodes = nodes;

        // Reset diagnostics on every (re)start so a server restart doesn't leave batches for networks
        // the server no longer knows; fresh batches arrive via the thread_diagnostics_updated event.
        this.threadDiagnostics = new Map();
    }

    private _handleIncomingMessage(msg: IncomingMessage) {
        if ("event" in msg) {
            this._handleEventMessage(msg);
            return;
        }

        if ("error_code" in msg) {
            const details = msg.details ?? "";
            this._rejectPendingCommand(
                msg.message_id,
                new ServerCommandError(details !== "" ? details : `Server error ${msg.error_code}`, msg.error_code, {
                    status: msg.status,
                    clusterStatus: msg.cluster_status,
                    reason: msg.reason,
                }),
            );
            return;
        }

        if ("result" in msg) {
            this._resolvePendingCommand(msg.message_id, msg.result);
            return;
        }

        this.connection.logger.warn("Received message with unknown format", () => redactIncomingMessage(msg));
    }

    private _handleEventMessage(event: EventMessage) {
        // Allow subclasses to hook into raw events (for testing)
        this.onRawEvent(event);

        if (event.event === "node_added") {
            const node = new MatterNode(event.data);
            this.nodes = { ...this.nodes, [toNodeKey(node.node_id)]: node };
            this.fireEvent("nodes_changed", { reason: "node_added", nodeId: node.node_id });
            return;
        }
        if (event.event === "node_removed") {
            delete this.nodes[toNodeKey(event.data)];
            this.nodes = { ...this.nodes };
            this.fireEvent("nodes_changed", { reason: "node_removed", nodeId: event.data });
            return;
        }

        if (event.event === "node_updated") {
            const node = new MatterNode(event.data);
            this.nodes = { ...this.nodes, [toNodeKey(node.node_id)]: node };
            this.fireEvent("nodes_changed", { reason: "node_updated", nodeId: node.node_id });
            return;
        }

        if (event.event === "attribute_updated") {
            const [nodeId, attributeKey, attributeValue] = event.data;
            const nodeKey = toNodeKey(nodeId);
            const existingNode = this.nodes[nodeKey];
            if (existingNode) {
                const node = new MatterNode(existingNode.data);
                node.attributes[attributeKey] = attributeValue;
                this.nodes = { ...this.nodes, [nodeKey]: node };
                this.fireEvent("nodes_changed", { reason: "attribute_updated", nodeId, attributeKey });
            }
            return;
        }

        if (event.event === "server_info_updated") {
            this.connection.serverInfo = event.data;
            this.fireEvent("server_info_updated");
            return;
        }

        if (event.event === "server_shutdown") {
            this.fireEvent("server_shutdown");
            this.disconnect();
            return;
        }

        if (event.event === "thread_diagnostics_updated") {
            const next = new Map(this.threadDiagnostics);
            next.set(event.data.extPanIdHex.toUpperCase(), event.data);
            this.threadDiagnostics = next;
            for (const listener of this.threadDiagnosticsListeners) {
                listener(event.data);
            }
            this.fireEvent("thread_diagnostics_updated");
            return;
        }

        if (event.event === "webrtc_callback") {
            for (const listener of this.webrtcCallbackListeners) {
                listener(event.data);
            }
            return;
        }

        if (event.event === "camera_session_ended") {
            for (const listener of this.cameraSessionEndedListeners) {
                listener(event.data);
            }
            return;
        }

        if (event.event === "camera_stream_evicted") {
            for (const listener of this.cameraStreamEvictedListeners) {
                listener(event.data);
            }
            return;
        }

        if (event.event === "node_event") {
            for (const listener of this.nodeEventListeners) {
                listener(event.data);
            }
            return;
        }

        if (event.event === "subscription_report") {
            this.subscriptionListeners
                .get(subscriptionKey(event.data.node_id, event.data.subscription_id))
                ?.report(event.data);
            return;
        }

        if (event.event === "subscription_ended") {
            const key = subscriptionKey(event.data.node_id, event.data.subscription_id);
            const listener = this.subscriptionListeners.get(key);
            this.subscriptionListeners.delete(key);
            listener?.ended?.();
            return;
        }
    }

    private fireEvent<E extends keyof ClientEventMap>(event: E, ...args: ClientEventMap[E]) {
        // Copy: a listener unsubscribing mid-loop must not make the loop skip the next one
        for (const listener of [...this.eventListeners[event]]) {
            listener(...args);
        }
    }

    /**
     * Hook for subclasses to receive raw events.
     * Override this method to intercept all incoming events.
     * @param event The raw event message
     */
    protected onRawEvent(_event: EventMessage): void {
        // Default implementation does nothing
        // Subclasses can override to collect or process raw events
    }
}
