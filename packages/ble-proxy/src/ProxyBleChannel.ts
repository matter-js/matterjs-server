/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    type Bytes,
    type Channel,
    ChannelType,
    createPromise,
    InternalError,
    Logger,
    NetworkError,
    Seconds,
    Semaphore,
    ServerAddress,
    Time,
    type Transport,
    type WorkSlot,
} from "@matter/main";
import { BleChannel, BleError, BtpCodec, BtpFlowError, BtpSessionHandler, MatterBle } from "@matter/main/protocol";
import type { BleProxyHandler } from "./BleProxyHandler.js";
import {
    BinaryFrameOpcode,
    BleProxyCommand,
    BleProxyError,
    BleProxyEvent,
    isOutOfConnectionSlotsError,
} from "./BleProxyProtocol.js";
import type { ProxyBleScanner } from "./ProxyBleScanner.js";

const logger = Logger.get("ProxyBleChannel");

/** BTP handshake response identification bytes (Matter spec 4.18.2.5.6) */
const BTP_HANDSHAKE_RESPONSE_OPCODE_1 = 0x65;
const BTP_HANDSHAKE_RESPONSE_OPCODE_2 = 0x6c;
const BTP_HANDSHAKE_RESPONSE_LENGTH = 6;

/** Safety-net bound on waiting for a connection slot. */
const MAX_QUEUE_WAIT = Seconds(20);

/**
 * Normalize any UUID form sent by a proxy client to the canonical dashed-uppercase form used by
 * Matter's MatterBle constants. Different BLE proxy clients deliver different formats:
 *   - noble: 32 lowercase hex chars, no dashes ("18ee2ef5263d4559959f4f9c429f9d11")
 *   - ESPHome / generic: dashed form, either case ("18EE2EF5-263D-4559-959F-4F9C429F9D11")
 *   - 16-/32-bit short form ("fff6", "FFF6", "0000fff6") for standard service UUIDs
 *
 * All three round-trip to a comparable canonical string so command handlers stay format-agnostic.
 */
function toCanonicalUuid(uuid: string): string {
    const upper = uuid.toUpperCase();
    if (upper.length === 32) {
        return [
            upper.substring(0, 8),
            upper.substring(8, 12),
            upper.substring(12, 16),
            upper.substring(16, 20),
            upper.substring(20, 32),
        ].join("-");
    }
    return upper;
}

/**
 * ConnectionlessTransport implementation that opens BLE channels through the proxy WebSocket.
 * Replaces NobleBleCentralInterface from @matter/nodejs-ble.
 */
export class ProxyBleCentralInterface implements Transport {
    readonly #bleScanner: ProxyBleScanner;
    readonly #handler: BleProxyHandler;
    #onMatterMessageListener: ((socket: Channel<Bytes>, data: Bytes) => void) | undefined;
    #closed = false;
    readonly #connectSemaphore = new Semaphore("ble-proxy-connect", 1);
    readonly #closeAbort = new Abort();
    /** Channels the gate has handed out and that are still open. */
    readonly #openChannels = new Set<ProxyBleChannel>();
    /** Bumped by abortPendingConnects/close so a connect that completes afterwards tears itself down. */
    #abortGeneration = 0;

    constructor(bleScanner: ProxyBleScanner, handler: BleProxyHandler) {
        this.#bleScanner = bleScanner;
        this.#handler = handler;
    }

    async openChannel(address: ServerAddress, options?: Transport.OpenChannelOptions): Promise<Channel<Bytes>> {
        if (this.#closed) {
            throw new NetworkError("Network interface is closed");
        }
        if (!ServerAddress.isBle(address)) {
            throw new InternalError(`Unsupported address type for BLE channel.`);
        }
        if (this.#onMatterMessageListener === undefined) {
            throw new InternalError("Network Interface was not added to the system yet.");
        }

        const { peripheralAddress } = address;
        const { hasAdditionalAdvertisementData } = this.#bleScanner.getDiscoveredDevice(peripheralAddress);

        if (!this.#handler.connected) {
            throw new BleError("BLE proxy client not connected");
        }

        // Serialize BLE connects: a single physical device advertises rotating MAC
        // addresses, and matter.js fires one connect per address. Without this gate the
        // proxy backend's connection slots are exhausted and commissioning fails.
        const waitAbort = new Abort({ abort: [this.#closeAbort.signal, options?.abort], timeout: MAX_QUEUE_WAIT });
        let slot: WorkSlot;
        try {
            slot = await this.#connectSemaphore.obtainSlot(waitAbort.signal);
        } catch {
            throw new BleError(`BLE connect to ${peripheralAddress} aborted before a connection slot was available`);
        } finally {
            waitAbort.close();
        }

        const abortGenAtStart = this.#abortGeneration;
        let slotReleased = false;
        const releaseSlot = () => {
            if (!slotReleased) {
                slotReleased = true;
                slot.close();
            }
        };

        logger.debug(`Connecting to peripheral ${peripheralAddress} via proxy`);

        // 1. Connect
        let connection_handle: number;
        let peripheralMtu: number | undefined;
        try {
            ({ connection_handle, mtu: peripheralMtu } = await this.#handler.sendCommand(BleProxyCommand.Connect, {
                address: peripheralAddress,
            }));
        } catch (error) {
            releaseSlot();
            if (error instanceof BleProxyError && isOutOfConnectionSlotsError(error.code, error.message)) {
                throw new BleError(
                    `BLE proxy backend is out of connection slots for ${peripheralAddress} — increase connection_slots on the proxy or add more proxies`,
                );
            }
            throw error;
        }

        let mtu = peripheralMtu ?? 0;
        if (mtu > MatterBle.MAXIMUM_BTP_MTU) {
            mtu = MatterBle.MAXIMUM_BTP_MTU;
        }
        logger.debug(`Connected to ${peripheralAddress}, handle=${connection_handle}, mtu=${mtu}`);

        try {
            // 2. Discover services
            const { services } = await this.#handler.sendCommand(BleProxyCommand.DiscoverServices, {
                connection_handle,
            });

            const matterService = services.find(s => MatterBle.isServiceUuid(s.uuid));
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
                const canonical = toCanonicalUuid(char.uuid);
                if (canonical === MatterBle.C1_CHARACTERISTIC_UUID) {
                    c1Uuid = char.uuid;
                } else if (canonical === MatterBle.C2_CHARACTERISTIC_UUID) {
                    c2Uuid = char.uuid;
                } else if (canonical === MatterBle.C3_CHARACTERISTIC_UUID) {
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

            // 5. Send BTP handshake request on C1 and atomically subscribe to C2 for the
            // response indication. The combo eliminates the WebSocket round-trip between
            // Write Response and CCCD enable — without it, a peripheral that pushes the
            // handshake indication immediately after Write Response can fire before the
            // proxy client has enabled notifications, and the indication is lost.
            const btpHandshakeRequest = BtpCodec.encodeBtpHandshakeRequest({
                versions: MatterBle.BTP_SUPPORTED_VERSIONS,
                attMtu: mtu,
                clientWindowSize: MatterBle.BTP_MAXIMUM_WINDOW_SIZE,
            });
            logger.debug(`Sending BTP handshake request on C1 and subscribing C2 atomically`);
            await this.#handler.sendCommand(BleProxyCommand.WriteAndSubscribe, {
                connection_handle,
                write_uuid: c1Uuid,
                write_value: Buffer.from(btpHandshakeRequest as ArrayBuffer).toString("base64"),
                write_response: true,
                subscribe_uuid: c2Uuid,
            });

            // 6. Wait for BTP handshake response via binary frame
            const {
                promise: handshakePromise,
                resolver: handshakeResolver,
                rejecter: handshakeRejecter,
            } = createPromise<Uint8Array>();

            const btpHandshakeTimeout = Time.getTimer(
                "BLE proxy handshake timeout",
                MatterBle.BTP_CONN_RSP_TIMEOUT,
                () => {
                    handshakeRejecter(new BleError(`BTP handshake response not received from ${peripheralAddress}`));
                },
            ).start();

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

            let handshakeResponse: Uint8Array;
            try {
                handshakeResponse = await handshakePromise;
            } finally {
                this.#handler.binaryFrameReceived.off(handshakeObserver);
                btpHandshakeTimeout.stop();
            }

            // 7. Create BTP session
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
                    } catch (error) {
                        logger.debug(
                            `Peripheral ${peripheralAddress}: Error sending Disconnect to proxy client`,
                            error,
                        );
                    }
                },
                // Matter message callback
                async (data: Bytes) => {
                    if (channelRef.channel) {
                        channelRef.channel.pushMessage(data);
                        onMatterMessageListener(channelRef.channel, data);
                    }
                },
            );

            // 8. Wire up binary frame notifications to BTP session
            const binaryObserver = (frame: { connectionHandle: number; opcode: number; payload: Uint8Array }) => {
                if (frame.connectionHandle === connection_handle && frame.opcode === BinaryFrameOpcode.Notification) {
                    btpSession
                        .handleIncomingBleData(new Uint8Array(frame.payload))
                        .catch(error =>
                            logger.warn(`Peripheral ${peripheralAddress}: Error handling incoming BLE data`, error),
                        );
                }
            };
            this.#handler.binaryFrameReceived.on(binaryObserver);

            // 9. Handle unexpected disconnects from proxy client
            const eventObserver = (event: string, data: Record<string, unknown>) => {
                if (
                    event === BleProxyEvent.Disconnected &&
                    typeof data.connection_handle === "number" &&
                    data.connection_handle === connection_handle
                ) {
                    logger.info(`Peripheral ${peripheralAddress} disconnected unexpectedly`);
                    channelRef.channel?.markDisconnected();
                    channelRef.channel
                        ?.close()
                        .catch(error => logger.debug(`Peripheral ${peripheralAddress}: Error closing channel`, error));
                }
            };
            this.#handler.eventReceived.on(eventObserver);

            // Cleanup function to remove observers when channel closes
            const cleanupObservers = () => {
                this.#handler.binaryFrameReceived.off(binaryObserver);
                this.#handler.eventReceived.off(eventObserver);
            };

            const proxyChannel = new ProxyBleChannel(peripheralAddress, btpSession, cleanupObservers, releaseSlot);
            channelRef.channel = proxyChannel;

            // If the gate was aborted (commissioning ended) or the interface closed while we were
            // connecting, matter.js has already abandoned this attempt via its own abort. Returning
            // the channel would orphan it — nobody closes it, so it would hold the single connection
            // slot forever. Tear it down instead.
            if (this.#closed || this.#abortGeneration !== abortGenAtStart) {
                await proxyChannel.close();
                try {
                    await this.#handler.sendCommand(BleProxyCommand.Disconnect, { connection_handle });
                } catch (cleanupError) {
                    logger.debug(`Peripheral ${peripheralAddress}: Error during orphan cleanup`, cleanupError);
                }
                throw new BleError(`BLE connect to ${peripheralAddress} aborted before completion`);
            }

            this.#openChannels.add(proxyChannel);
            proxyChannel.onClose(() => this.#openChannels.delete(proxyChannel));
            return proxyChannel;
        } catch (error) {
            // Clean up on failure — best-effort tear-down of the peripheral on the proxy side
            try {
                await this.#handler.sendCommand(BleProxyCommand.Disconnect, { connection_handle });
            } catch (cleanupError) {
                logger.debug(`Peripheral ${peripheralAddress}: Error during connect-failure cleanup`, cleanupError);
            }
            releaseSlot();
            throw error;
        }
    }

    onData(listener: (socket: Channel<Bytes>, data: Bytes) => void): Transport.Listener {
        this.#onMatterMessageListener = listener;
        return {
            close: async () => await this.close(),
        };
    }

    /**
     * Release the connect gate when a commissioning attempt ends. BLE is only used during
     * commissioning, so afterwards any queued connect is stale and any still-open channel is an
     * orphan holding the connection slot. Rejects queued waiters, tears down open channels, and
     * bumps the generation so an in-flight connect that completes later tears itself down too.
     */
    abortPendingConnects(): void {
        this.#abortGeneration++;
        this.#connectSemaphore.clear();
        for (const channel of [...this.#openChannels]) {
            channel.close().catch(error => logger.debug(`Error closing channel during connect abort`, error));
        }
    }

    async close() {
        this.#closed = true;
        this.#closeAbort.abort();
        this.#connectSemaphore.close();
        for (const channel of [...this.#openChannels]) {
            await channel.close().catch(error => logger.debug(`Error closing channel during interface close`, error));
        }
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
    readonly #releaseSlot: () => void;
    readonly #onBtpSessionClosed: () => void;
    readonly #closeListeners = new Set<() => void>();
    #iteratorQueue = new Array<Bytes>();
    #iteratorWaiter?: (value: IteratorResult<Bytes>) => void;
    #iteratorDone = false;

    constructor(
        peripheralAddress: string,
        btpSession: BtpSessionHandler,
        cleanupObservers: () => void,
        releaseSlot: () => void,
    ) {
        super();
        this.#peripheralAddress = peripheralAddress;
        this.#btpSession = btpSession;
        this.#cleanupObservers = cleanupObservers;
        this.#releaseSlot = releaseSlot;
        this.#onBtpSessionClosed = () => this.emitClosed();
        btpSession.closed.on(this.#onBtpSessionClosed);
    }

    get connected() {
        return this.#connected;
    }

    markDisconnected() {
        this.#connected = false;
    }

    pushMessage(data: Bytes): void {
        if (this.#iteratorWaiter) {
            const resolve = this.#iteratorWaiter;
            this.#iteratorWaiter = undefined;
            resolve({ value: data, done: false });
        } else if (!this.#iteratorDone) {
            this.#iteratorQueue.push(data);
        }
    }

    onClose(listener: () => void): Transport.Listener {
        this.#closeListeners.add(listener);
        return {
            close: async () => {
                this.#closeListeners.delete(listener);
            },
        };
    }

    [Symbol.asyncIterator](): AsyncIterator<Bytes> {
        return {
            next: () => {
                if (this.#iteratorQueue.length > 0) {
                    return Promise.resolve({ value: this.#iteratorQueue.shift()!, done: false });
                }
                if (this.#iteratorDone || !this.#connected) {
                    return Promise.resolve({ value: undefined as unknown as Bytes, done: true });
                }
                return new Promise<IteratorResult<Bytes>>(resolve => {
                    this.#iteratorWaiter = resolve;
                });
            },
        };
    }

    #terminateIterator(): void {
        if (!this.#iteratorDone) {
            this.#iteratorDone = true;
            this.#iteratorWaiter?.({ value: undefined as unknown as Bytes, done: true });
            this.#iteratorWaiter = undefined;
        }
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
        this.#releaseSlot();
        this.#cleanupObservers();
        this.#terminateIterator();
        for (const listener of this.#closeListeners) {
            listener();
        }
        this.#btpSession.closed.off(this.#onBtpSessionClosed);
        await this.#btpSession.close();
        this.emitClosed();
    }
}
