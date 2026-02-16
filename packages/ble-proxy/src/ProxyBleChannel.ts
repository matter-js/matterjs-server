/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Bytes,
    type Channel,
    ChannelType,
    type ConnectionlessTransport,
    createPromise,
    InternalError,
    Logger,
    NetworkError,
    type ServerAddress,
    Time,
} from "@matter/main";
import {
    BLE_MATTER_C1_CHARACTERISTIC_UUID,
    BLE_MATTER_C2_CHARACTERISTIC_UUID,
    BLE_MATTER_C3_CHARACTERISTIC_UUID,
    BLE_MATTER_SERVICE_UUID,
    BLE_MATTER_SERVICE_UUID_SHORT,
    BLE_MAXIMUM_BTP_MTU,
    BleChannel,
    BleError,
    BTP_CONN_RSP_TIMEOUT,
    BTP_MAXIMUM_WINDOW_SIZE,
    BTP_SUPPORTED_VERSIONS,
    BtpCodec,
    BtpFlowError,
    BtpSessionHandler,
} from "@matter/main/protocol";
import type { BleProxyHandler } from "./BleProxyHandler.js";
import { BinaryFrameOpcode, BleProxyCommand, BleProxyEvent } from "./BleProxyProtocol.js";
import type { ProxyBleScanner } from "./ProxyBleScanner.js";

const logger = Logger.get("ProxyBleChannel");

/** BTP handshake response identification bytes (Matter spec 4.18.2.5.6) */
const BTP_HANDSHAKE_RESPONSE_OPCODE_1 = 0x65;
const BTP_HANDSHAKE_RESPONSE_OPCODE_2 = 0x6c;
const BTP_HANDSHAKE_RESPONSE_LENGTH = 6;

/**
 * ConnectionlessTransport implementation that opens BLE channels through the proxy WebSocket.
 * Replaces NobleBleCentralInterface from @matter/nodejs-ble.
 */
export class ProxyBleCentralInterface implements ConnectionlessTransport {
    readonly #bleScanner: ProxyBleScanner;
    readonly #handler: BleProxyHandler;
    #onMatterMessageListener: ((socket: Channel<Bytes>, data: Bytes) => void) | undefined;
    #closed = false;

    constructor(bleScanner: ProxyBleScanner, handler: BleProxyHandler) {
        this.#bleScanner = bleScanner;
        this.#handler = handler;
    }

    async openChannel(address: ServerAddress): Promise<Channel<Bytes>> {
        if (this.#closed) {
            throw new NetworkError("Network interface is closed");
        }
        if (address.type !== "ble") {
            throw new InternalError(`Unsupported address type ${address.type}.`);
        }
        if (this.#onMatterMessageListener === undefined) {
            throw new InternalError("Network Interface was not added to the system yet.");
        }

        const { peripheralAddress } = address;
        const { hasAdditionalAdvertisementData } = this.#bleScanner.getDiscoveredDevice(peripheralAddress);

        if (!this.#handler.connected) {
            throw new BleError("BLE proxy client not connected");
        }

        logger.debug(`Connecting to peripheral ${peripheralAddress} via proxy`);

        // 1. Connect
        const { connection_handle, mtu: peripheralMtu } = await this.#handler.sendCommand(BleProxyCommand.Connect, {
            address: peripheralAddress,
        });

        let mtu = peripheralMtu ?? 0;
        if (mtu > BLE_MAXIMUM_BTP_MTU) {
            mtu = BLE_MAXIMUM_BTP_MTU;
        }
        logger.debug(`Connected to ${peripheralAddress}, handle=${connection_handle}, mtu=${mtu}`);

        try {
            // 2. Discover services
            const { services } = await this.#handler.sendCommand(BleProxyCommand.DiscoverServices, {
                connection_handle,
            });

            const matterService = services.find(
                s =>
                    s.uuid.toLowerCase() === BLE_MATTER_SERVICE_UUID_SHORT ||
                    s.uuid.toUpperCase() === BLE_MATTER_SERVICE_UUID,
            );
            if (!matterService) {
                throw new BleError(`Peripheral ${peripheralAddress} does not have Matter BLE service`);
            }

            // 3. Discover characteristics
            const { characteristics } = await this.#handler.sendCommand(BleProxyCommand.DiscoverCharacteristics, {
                connection_handle,
                service_uuid: matterService.uuid,
            });

            let c1Uuid: string | undefined;
            let c2Uuid: string | undefined;
            let c3Uuid: string | undefined;

            for (const char of characteristics) {
                const uuid = char.uuid.toUpperCase();
                if (uuid === BLE_MATTER_C1_CHARACTERISTIC_UUID) {
                    c1Uuid = char.uuid;
                } else if (uuid === BLE_MATTER_C2_CHARACTERISTIC_UUID) {
                    c2Uuid = char.uuid;
                } else if (uuid === BLE_MATTER_C3_CHARACTERISTIC_UUID) {
                    c3Uuid = char.uuid;
                }
            }

            if (!c1Uuid || !c2Uuid) {
                throw new BleError(`Peripheral ${peripheralAddress} missing required Matter characteristics (C1/C2)`);
            }

            // 4. Read C3 if present and has additional data
            if (c3Uuid && hasAdditionalAdvertisementData) {
                logger.debug(`Reading additional commissioning data from C3`);
                await this.#handler.sendCommand(BleProxyCommand.ReadCharacteristic, {
                    connection_handle,
                    characteristic_uuid: c3Uuid,
                });
                // Additional commissioning data read but not used directly by the proxy -
                // it's handled by matter.js commissioning flow internally
            }

            // 5. Send BTP handshake request on C1
            const btpHandshakeRequest = BtpCodec.encodeBtpHandshakeRequest({
                versions: BTP_SUPPORTED_VERSIONS,
                attMtu: mtu,
                clientWindowSize: BTP_MAXIMUM_WINDOW_SIZE,
            });
            logger.debug(`Sending BTP handshake request on C1`);
            await this.#handler.sendCommand(BleProxyCommand.WriteCharacteristic, {
                connection_handle,
                characteristic_uuid: c1Uuid,
                value: Buffer.from(btpHandshakeRequest as ArrayBuffer).toString("base64"),
                response: false,
            });

            // 6. Subscribe to C2 for notifications
            await this.#handler.sendCommand(BleProxyCommand.SubscribeCharacteristic, {
                connection_handle,
                characteristic_uuid: c2Uuid,
            });

            // 7. Wait for BTP handshake response via binary frame
            const {
                promise: handshakePromise,
                resolver: handshakeResolver,
                rejecter: handshakeRejecter,
            } = createPromise<Uint8Array>();

            const btpHandshakeTimeout = Time.getTimer("BLE proxy handshake timeout", BTP_CONN_RSP_TIMEOUT, () => {
                handshakeRejecter(new BleError(`BTP handshake response not received from ${peripheralAddress}`));
            }).start();

            const handshakeObserver = (frame: { connectionHandle: number; opcode: number; payload: Uint8Array }) => {
                if (frame.connectionHandle === connection_handle && frame.opcode === BinaryFrameOpcode.Notification) {
                    const data = new Uint8Array(frame.payload);
                    if (
                        data[0] === BTP_HANDSHAKE_RESPONSE_OPCODE_1 &&
                        data[1] === BTP_HANDSHAKE_RESPONSE_OPCODE_2 &&
                        data.length === BTP_HANDSHAKE_RESPONSE_LENGTH
                    ) {
                        btpHandshakeTimeout.stop();
                        handshakeResolver(data);
                    }
                }
            };
            this.#handler.binaryFrameReceived.on(handshakeObserver);

            const handshakeResponse = await handshakePromise;
            this.#handler.binaryFrameReceived.off(handshakeObserver);

            // 8. Create BTP session
            // Use a ref object so closures can access the channel after it's created
            const onMatterMessageListener = this.#onMatterMessageListener;
            const channelRef: { channel?: ProxyBleChannel } = {};

            const btpSession = await BtpSessionHandler.createAsCentral(
                handshakeResponse,
                // Write callback: send binary frame to proxy client
                async (data: Bytes) => {
                    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
                    this.#handler.sendBinaryFrame(BinaryFrameOpcode.WriteData, connection_handle, bytes);
                },
                // Disconnect callback
                async () => {
                    if (!channelRef.channel?.connected) return;
                    logger.debug(`Disconnecting from ${peripheralAddress} via proxy`);
                    try {
                        await this.#handler.sendCommand(BleProxyCommand.Disconnect, { connection_handle });
                    } catch {
                        // Ignore disconnect errors
                    }
                },
                // Matter message callback
                async (data: Bytes) => {
                    if (channelRef.channel) {
                        onMatterMessageListener(channelRef.channel, data);
                    }
                },
            );

            // 9. Wire up binary frame notifications to BTP session
            const binaryObserver = (frame: { connectionHandle: number; opcode: number; payload: Uint8Array }) => {
                if (frame.connectionHandle === connection_handle && frame.opcode === BinaryFrameOpcode.Notification) {
                    void btpSession.handleIncomingBleData(new Uint8Array(frame.payload));
                }
            };
            this.#handler.binaryFrameReceived.on(binaryObserver);

            // 10. Handle unexpected disconnects from proxy client
            const eventObserver = (event: string, data: Record<string, unknown>) => {
                if (
                    event === BleProxyEvent.Disconnected &&
                    (data as { connection_handle: number }).connection_handle === connection_handle
                ) {
                    logger.info(`Peripheral ${peripheralAddress} disconnected unexpectedly`);
                    channelRef.channel?.markDisconnected();
                    void channelRef.channel?.close();
                }
            };
            this.#handler.eventReceived.on(eventObserver);

            // Cleanup function to remove observers when channel closes
            const cleanupObservers = () => {
                this.#handler.binaryFrameReceived.off(binaryObserver);
                this.#handler.eventReceived.off(eventObserver);
            };

            const proxyChannel = new ProxyBleChannel(peripheralAddress, btpSession, cleanupObservers);
            channelRef.channel = proxyChannel;
            return proxyChannel;
        } catch (error) {
            // Clean up on failure
            try {
                await this.#handler.sendCommand(BleProxyCommand.Disconnect, { connection_handle });
            } catch {
                // Ignore
            }
            throw error;
        }
    }

    onData(listener: (socket: Channel<Bytes>, data: Bytes) => void): ConnectionlessTransport.Listener {
        this.#onMatterMessageListener = listener;
        return {
            close: async () => await this.close(),
        };
    }

    async close() {
        this.#closed = true;
    }

    supports(type: ChannelType, _address?: string) {
        return type === ChannelType.BLE;
    }
}

/**
 * BLE channel that communicates through the proxy WebSocket.
 * Replaces NobleBleChannel from @matter/nodejs-ble.
 */
export class ProxyBleChannel extends BleChannel<Bytes> {
    #connected = true;
    readonly #peripheralAddress: string;
    readonly #btpSession: BtpSessionHandler;
    readonly #cleanupObservers: () => void;

    constructor(peripheralAddress: string, btpSession: BtpSessionHandler, cleanupObservers: () => void) {
        super();
        this.#peripheralAddress = peripheralAddress;
        this.#btpSession = btpSession;
        this.#cleanupObservers = cleanupObservers;
    }

    get connected() {
        return this.#connected;
    }

    markDisconnected() {
        this.#connected = false;
    }

    async send(data: Bytes) {
        if (!this.#connected) {
            logger.debug(`Cannot send data - not connected to ${this.#peripheralAddress}`);
            return;
        }
        if (this.#btpSession === undefined) {
            throw new BtpFlowError(`Cannot send data, no BTP session initialized`);
        }
        await this.#btpSession.sendMatterMessage(data);
    }

    get name() {
        return `ble-proxy://${this.#peripheralAddress}`;
    }

    async close() {
        this.#connected = false;
        this.#cleanupObservers();
        await this.#btpSession.close();
    }
}
