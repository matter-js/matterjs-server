import { Connection } from "./connection.js";
import { InvalidServerVersion } from "./exceptions.js";
import {
    APICommands,
    CommissionableNodeData,
    CommissioningParameters,
    ErrorResultMessage,
    EventMessage,
    MatterFabricData,
    MatterSoftwareVersion,
    NodePingResult,
    SuccessResultMessage,
} from "./models/model.js";
import { MatterNode } from "./models/node.js";

/** Union type for all incoming WebSocket messages */
type IncomingMessage = EventMessage | ErrorResultMessage | SuccessResultMessage;

/** Converts node_id to number for use as object key (bigint can't be used as index) */
function toNodeKey(nodeId: number | bigint): number {
    return typeof nodeId === "bigint" ? Number(nodeId) : nodeId;
}

export class MatterClient {
    public connection: Connection;
    public nodes: Record<number, MatterNode> = {};
    public serverBaseAddress: string;
    // Using 'unknown' for resolve since the actual types vary by command
    private _result_futures: Record<
        string,
        { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
    > = {};
    private msgId = 0;
    private eventListeners: Record<string, Array<() => void>> = {};

    constructor(
        public url: string,
        public isProduction: boolean,
    ) {
        this.url = url;
        this.isProduction = isProduction;
        this.connection = new Connection(this.url);
        this.serverBaseAddress = this.url.split("://")[1].split(":")[0] || "";
    }

    get serverInfo() {
        return this.connection.serverInfo!;
    }

    addEventListener(event: string, listener: () => void) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(listener);
        return () => {
            this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
        };
    }

    async commissionWithCode(code: string, networkOnly: boolean): Promise<MatterNode> {
        // Commission a device using a QR Code or Manual Pairing Code.
        // code: The QR Code or Manual Pairing Code for device commissioning.
        // network_only: If True, restricts device discovery to network only.
        // Returns: The NodeInfo of the commissioned device.
        return (await this.sendCommand("commission_with_code", 0, {
            code: code,
            network_only: networkOnly,
        })) as MatterNode;
    }

    async setWifiCredentials(ssid: string, credentials: string) {
        // Set WiFi credentials for commissioning to a (new) device.
        await this.sendCommand("set_wifi_credentials", 0, { ssid, credentials });
    }

    async setThreadOperationalDataset(dataset: string) {
        // Set Thread Operational dataset in the stack.
        await this.sendCommand("set_thread_dataset", 0, { dataset });
    }

    async openCommissioningWindow(
        nodeId: number | bigint,
        timeout?: number,
        iteration?: number,
        option?: number,
        discriminator?: number,
    ): Promise<CommissioningParameters> {
        // Open a commissioning window to commission a device present on this controller to another.
        // Returns code to use as discriminator.
        return (await this.sendCommand("open_commissioning_window", 0, {
            node_id: nodeId,
            timeout,
            iteration,
            option,
            discriminator,
        })) as CommissioningParameters;
    }

    async discoverCommissionableNodes(): Promise<CommissionableNodeData[]> {
        // Discover Commissionable Nodes (discovered on BLE or mDNS).
        return (await this.sendCommand("discover_commissionable_nodes", 0, {})) as CommissionableNodeData[];
    }

    async getMatterFabrics(nodeId: number | bigint): Promise<MatterFabricData[]> {
        // Get Matter fabrics from a device.
        // Returns a list of MatterFabricData objects.
        return (await this.sendCommand("get_matter_fabrics", 3, { node_id: nodeId })) as MatterFabricData[];
    }

    async removeMatterFabric(nodeId: number | bigint, fabricIndex: number) {
        // Remove a Matter fabric from a device.
        await this.sendCommand("remove_matter_fabric", 3, { node_id: nodeId, fabric_index: fabricIndex });
    }

    async pingNode(nodeId: number | bigint): Promise<NodePingResult> {
        // Ping node on the currently known IP-address(es).
        return (await this.sendCommand("ping_node", 0, { node_id: nodeId })) as NodePingResult;
    }

    async getNodeIPAddresses(nodeId: number | bigint, preferCache?: boolean, scoped?: boolean): Promise<string[]> {
        // Return the currently known (scoped) IP-address(es).
        return (await this.sendCommand("get_node_ip_addresses", 8, {
            node_id: nodeId,
            prefer_cache: preferCache,
            scoped: scoped,
        })) as string[];
    }

    async removeNode(nodeId: number | bigint) {
        // Remove a Matter node/device from the fabric.
        await this.sendCommand("remove_node", 0, { node_id: nodeId });
    }

    async interviewNode(nodeId: number | bigint) {
        // Interview a node.
        await this.sendCommand("interview_node", 0, { node_id: nodeId });
    }

    async importTestNode(dump: string) {
        // Import test node(s) from a HA or Matter server diagnostics dump.
        await this.sendCommand("import_test_node", 0, { dump });
    }

    async readAttribute(nodeId: number | bigint, attributePath: string | string[]): Promise<Record<string, unknown>> {
        // Read one or more attribute(s) on a node by specifying an attributepath.
        return await this.sendCommand("read_attribute", 0, { node_id: nodeId, attribute_path: attributePath });
    }

    async writeAttribute(nodeId: number | bigint, attributePath: string, value: unknown) {
        // Write an attribute(value) on a target node.
        await this.sendCommand("write_attribute", 0, { node_id: nodeId, attribute_path: attributePath, value: value });
    }

    async checkNodeUpdate(nodeId: number | bigint): Promise<MatterSoftwareVersion | null> {
        // Check if there is an update for a particular node.
        // Reads the current software version and checks the DCL if there is an update
        // available. If there is an update available, the command returns the version
        // information of the latest update available.
        return await this.sendCommand("check_node_update", 10, { node_id: nodeId });
    }

    async updateNode(nodeId: number | bigint, softwareVersion: number | string) {
        // Update a node to a new software version.
        // This command checks if the requested software version is indeed still available
        // and if so, it will start the update process. The update process will be handled
        // by the built-in OTA provider. The OTA provider will download the update and
        // notify the node about the new update.
        await this.sendCommand("update_node", 10, { node_id: nodeId, software_version: softwareVersion });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async setACLEntry(nodeId: number | bigint, entry: any[]) {
        return await this.sendCommand("set_acl_entry", 0, {
            node_id: nodeId,
            entry: entry,
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async setNodeBinding(nodeId: number | bigint, endpoint: number, bindings: any[]) {
        return await this.sendCommand("set_node_binding", 0, {
            node_id: nodeId,
            endpoint: endpoint,
            bindings: bindings,
        });
    }

    async sendCommand<T extends keyof APICommands>(
        command: T,
        require_schema: number | undefined = undefined,
        args: APICommands[T]["requestArgs"],
    ): Promise<APICommands[T]["response"]> {
        if (require_schema && this.serverInfo.schema_version < require_schema) {
            throw new InvalidServerVersion(
                "Command not available due to incompatible server version. Update the Matter " +
                    `Server to a version that supports at least api schema ${require_schema}.`,
            );
        }

        const messageId = ++this.msgId;

        const message = {
            message_id: messageId.toString(),
            command,
            args,
        };

        const messagePromise = new Promise<APICommands[T]["response"]>((resolve, reject) => {
            // Type-erased storage: resolve/reject are stored as unknown handlers
            this._result_futures[messageId] = {
                resolve: resolve as (value: unknown) => void,
                reject,
            };
            this.connection.sendMessage(message);
        });

        messagePromise.finally(() => {
            delete this._result_futures[messageId];
        });

        return messagePromise;
    }

    async connect() {
        if (this.connection.connected) {
            return;
        }
        await this.connection.connect(
            msg => this._handleIncomingMessage(msg as IncomingMessage),
            () => this.fireEvent("connection_lost"),
        );
    }

    disconnect(clearStorage = true) {
        // disconnect from the server and clear the stored serveraddress
        if (this.connection && this.connection.connected) {
            this.connection.disconnect();
        }
        if (clearStorage) {
            localStorage.removeItem("matterURL");
            location.reload();
        }
    }

    async startListening() {
        await this.connect();

        const nodesArray = await this.sendCommand("start_listening", 0, {});

        const nodes: Record<number, MatterNode> = {};
        for (const node of nodesArray) {
            nodes[toNodeKey(node.node_id)] = new MatterNode(node);
        }
        this.nodes = nodes;
    }

    private _handleIncomingMessage(msg: IncomingMessage) {
        if ("event" in msg) {
            this._handleEventMessage(msg);
            return;
        }

        if ("error_code" in msg) {
            const promise = this._result_futures[msg.message_id];
            if (promise) {
                promise.reject(new Error(msg.details));
                delete this._result_futures[msg.message_id];
            }
            return;
        }

        if ("result" in msg) {
            const promise = this._result_futures[msg.message_id];
            if (promise) {
                promise.resolve(msg.result);
                delete this._result_futures[msg.message_id];
            }
            return;
        }

        console.warn("Received message with unknown format", msg);
    }

    private _handleEventMessage(event: EventMessage) {
        console.log("Incoming event", event);

        if (event.event === "node_added") {
            const node = new MatterNode(event.data);
            this.nodes = { ...this.nodes, [toNodeKey(node.node_id)]: node };
            this.fireEvent("nodes_changed");
            return;
        }
        if (event.event === "node_removed") {
            delete this.nodes[toNodeKey(event.data)];
            this.nodes = { ...this.nodes };
            this.fireEvent("nodes_changed");
            return;
        }

        if (event.event === "node_updated") {
            const node = new MatterNode(event.data);
            this.nodes = { ...this.nodes, [toNodeKey(node.node_id)]: node };
            this.fireEvent("nodes_changed");
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
                this.fireEvent("nodes_changed");
            }
            return;
        }

        if (event.event === "server_info_updated") {
            this.connection.serverInfo = event.data;
            this.fireEvent("server_info_updated");
            return;
        }
    }

    private fireEvent(event: string) {
        const listeners = this.eventListeners[event];
        if (listeners) {
            for (const listener of listeners) {
                listener();
            }
        }
    }
}
