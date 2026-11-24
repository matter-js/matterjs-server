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
    ServerAddress,
    Time,
    type Transport,
} from "@matter/main";
import {
    BleChannel,
    BleDisconnectedError,
    BleError,
    BtpCodec,
    BtpSessionHandler,
    MatterBle,
} from "@matter/main/protocol";
import type { BleProxyConnection } from "./BleProxyConnection.js";
import type { BleProxyHandler } from "./BleProxyHandler.js";
import { type BinaryFrame, BinaryFrameOpcode, BleProxyCommand, BleProxyEvent } from "./BleProxyProtocol.js";
import type { ProxyBleScanner } from "./ProxyBleScanner.js";

const logger = Logger.get("ProxyBleChannel");

/** BTP handshake response identification bytes (Matter spec 4.18.2.5.6) */
const BTP_HANDSHAKE_RESPONSE_OPCODE_1 = 0x65;
const BTP_HANDSHAKE_RESPONSE_OPCODE_2 = 0x6c;
const BTP_HANDSHAKE_RESPONSE_LENGTH = 6;

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

/** Finds the Matter C1 and C2 characteristics and reads C3 when the advertisement announced additional data. */
async function discoverMatterCharacteristics(
    connection: BleProxyConnection,
    connectionHandle: number,
    peripheralAddress: string,
    hasAdditionalAdvertisementData: boolean,
) {
    // 2. Discover services
    const { services } = await connection.sendCommand(BleProxyCommand.DiscoverServices, {
        connection_handle: connectionHandle,
    });

    const matterService = services.find(s => MatterBle.isServiceUuid(s.uuid));
    if (!matterService) {
        throw new BleError(`Peripheral ${peripheralAddress} does not have Matter BLE service`);
    }

    // 3. Discover characteristics
    const { characteristics } = await connection.sendCommand(BleProxyCommand.DiscoverCharacteristics, {
        connection_handle: connectionHandle,
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
        await connection.sendCommand(BleProxyCommand.ReadCharacteristic, {
            connection_handle: connectionHandle,
            characteristic_uuid: c3Uuid,
        });
    }

    return { c1Uuid, c2Uuid };
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

    constructor(bleScanner: ProxyBleScanner, handler: BleProxyHandler) {
        this.#bleScanner = bleScanner;
        this.#handler = handler;
    }

    async openChannel(address: ServerAddress): Promise<Channel<Bytes>> {
        if (this.#closed) {
            throw new NetworkError("Network interface is closed");
        }
        if (!ServerAddress.isBle(address)) {
            throw new InternalError(`Unsupported address type for BLE channel.`);
        }
        const onMatterMessageListener = this.#onMatterMessageListener;
        if (onMatterMessageListener === undefined) {
            throw new InternalError("Network Interface was not added to the system yet.");
        }

        const { peripheralAddress } = address;

        const connection = this.#handler.getOwner(peripheralAddress);
        if (!connection) {
            throw new BleError(`No connected BLE proxy client owns peripheral ${peripheralAddress}`);
        }

        const discovered = this.#bleScanner.getDiscoveredDevice(peripheralAddress);
        const { hasAdditionalAdvertisementData } = discovered;
        const rssi = discovered.peripheral.rssi;

        logger.debug(`Connecting to peripheral ${peripheralAddress} (rssi=${rssi ?? "n/a"}) via proxy`);

        // 1. Connect
        const { connection_handle, mtu: peripheralMtu } = await connection.sendCommand(BleProxyCommand.Connect, {
            address: peripheralAddress,
        });

        const segmentSize = MatterBle.btpSegmentSizeFromAttMtu(peripheralMtu ?? 0);
        logger.info(
            `Connected to ${peripheralAddress}, handle=${connection_handle}, BTP segment size=${segmentSize} bytes (peripheral ATT_MTU up to ${peripheralMtu ?? "n/a"}), rssi=${rssi ?? "n/a"}`,
        );

        let link: ProxyPeripheralLink;
        try {
            const { c1Uuid, c2Uuid } = await discoverMatterCharacteristics(
                connection,
                connection_handle,
                peripheralAddress,
                hasAdditionalAdvertisementData,
            );
            link = { connection, connectionHandle: connection_handle, peripheralAddress, c1Uuid, c2Uuid };
        } catch (error) {
            connection
                .sendCommand(BleProxyCommand.Disconnect, { connection_handle })
                .catch(cleanupError =>
                    logger.debug(`Peripheral ${peripheralAddress}: Error during connect-failure cleanup`, cleanupError),
                );
            throw error;
        }

        return await ProxyBleChannel.open(link, onMatterMessageListener, segmentSize);
    }

    onData(listener: (socket: Channel<Bytes>, data: Bytes) => void): Transport.Listener {
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

/** The proxy-side peripheral connection a {@link ProxyBleChannel} runs its BTP sessions on. */
export interface ProxyPeripheralLink {
    readonly connection: BleProxyConnection;
    readonly connectionHandle: number;
    readonly peripheralAddress: string;
    readonly c1Uuid: string;
    readonly c2Uuid: string;
}

function isBtpHandshakeResponse(data: Uint8Array) {
    return (
        data.length === BTP_HANDSHAKE_RESPONSE_LENGTH &&
        data[0] === BTP_HANDSHAKE_RESPONSE_OPCODE_1 &&
        data[1] === BTP_HANDSHAKE_RESPONSE_OPCODE_2
    );
}

/**
 * BLE channel that communicates through the proxy WebSocket.
 * Replaces NobleBleChannel from @matter/nodejs-ble.
 *
 * The channel owns its BTP session. When the peer stalls after the handshake (see
 * {@link BtpSessionHandler.stalledAfterHandshake}), the channel establishes one new session with the minimum segment
 * size and resends the messages the peer never acknowledged, as NobleBleChannel does. Sends wait for that.
 */
export class ProxyBleChannel extends BleChannel<Bytes> {
    /**
     * Performs the BTP handshake on a connected peripheral and returns the channel. On failure the peripheral is
     * disconnected.
     *
     * @throws {BleDisconnectedError} when the peripheral or its proxy client is lost meanwhile
     * @throws {BleError} when the handshake response does not arrive in time; proxy command errors pass through
     */
    static async open(
        link: ProxyPeripheralLink,
        onMatterMessage: (socket: Channel<Bytes>, data: Bytes) => void,
        segmentSize: number,
    ): Promise<ProxyBleChannel> {
        const channel = new ProxyBleChannel(link, onMatterMessage);
        try {
            await channel.#adoptSession(await channel.#handshake(segmentSize), segmentSize);
        } catch (error) {
            const lost = !channel.#usable;
            await channel.close();
            if (lost && !(error instanceof BleDisconnectedError)) {
                throw new BleDisconnectedError(
                    `Peripheral ${link.peripheralAddress}: Lost while establishing the BTP session`,
                    { cause: error },
                );
            }
            throw error;
        }
        return channel;
    }

    readonly #link: ProxyPeripheralLink;
    readonly #onMatterMessage: (socket: Channel<Bytes>, data: Bytes) => void;
    #connected = true;
    #closing = false;
    #peripheralLinked = true;
    #btpSession?: BtpSessionHandler;
    #pendingHandshake?: { resolver: (response: Uint8Array) => void; rejecter: (error: Error) => void };
    readonly #framesBeforeSession = new Array<Uint8Array>();
    #renegotiation?: Promise<void>;
    readonly #lifetime = new AbortController();
    readonly #closeListeners = new Set<() => void>();
    #iteratorQueue = new Array<Bytes>();
    #iteratorWaiter?: (value: IteratorResult<Bytes>) => void;
    #iteratorDone = false;

    private constructor(link: ProxyPeripheralLink, onMatterMessage: (socket: Channel<Bytes>, data: Bytes) => void) {
        super();
        this.#link = link;
        this.#onMatterMessage = onMatterMessage;
        link.connection.binaryFrameReceived.on(this.#onBinaryFrame);
        link.connection.eventReceived.on(this.#onEvent);
        link.connection.closed.on(this.#onOwnerClosed);
    }

    readonly #onBinaryFrame = (frame: BinaryFrame) => {
        if (frame.connectionHandle !== this.#link.connectionHandle || frame.opcode !== BinaryFrameOpcode.Notification) {
            return;
        }
        const data = new Uint8Array(frame.payload);
        const handshake = this.#pendingHandshake;
        if (handshake !== undefined) {
            if (isBtpHandshakeResponse(data)) {
                this.#pendingHandshake = undefined;
                handshake.resolver(data);
            }
            return;
        }
        if (this.#btpSession === undefined) {
            this.#framesBeforeSession.push(data);
            return;
        }
        this.#forwardToSession(this.#btpSession, data);
    };

    readonly #onEvent = (event: string, data: Record<string, unknown>) => {
        if (event === BleProxyEvent.Disconnected && data.connection_handle === this.#link.connectionHandle) {
            this.#peripheralLost(`Peripheral ${this.#link.peripheralAddress} disconnected unexpectedly`);
        }
    };

    readonly #onOwnerClosed = () => {
        this.#peripheralLost(`Owning proxy client for ${this.#link.peripheralAddress} disconnected`);
    };

    #detachObservers() {
        const { connection } = this.#link;
        connection.binaryFrameReceived.off(this.#onBinaryFrame);
        connection.eventReceived.off(this.#onEvent);
        connection.closed.off(this.#onOwnerClosed);
    }

    #forwardToSession(session: BtpSessionHandler, data: Uint8Array) {
        session
            .handleIncomingBleData(data)
            .catch(error =>
                logger.warn(`Peripheral ${this.#link.peripheralAddress}: Error handling incoming BLE data`, error),
            );
    }

    #peripheralLost(reason: string) {
        logger.info(reason);
        this.#peripheralLinked = false;
        this.#connected = false;
        this.close().catch(error =>
            logger.debug(`Peripheral ${this.#link.peripheralAddress}: Error closing channel`, error),
        );
    }

    /** Sends the proxy a Disconnect at most once, without waiting for the reply. */
    #disconnectPeripheral() {
        if (!this.#peripheralLinked) {
            return;
        }
        this.#peripheralLinked = false;
        const { connection, connectionHandle, peripheralAddress } = this.#link;
        logger.debug(`Disconnecting from ${peripheralAddress} via proxy`);
        // Not awaited: the proxy replies only after the BLE disconnect, and PASE close waits for this
        connection
            .sendCommand(BleProxyCommand.Disconnect, { connection_handle: connectionHandle })
            .catch(error =>
                logger.debug(`Peripheral ${peripheralAddress}: Error sending Disconnect to proxy client`, error),
            );
    }

    async #handshake(segmentSize: number): Promise<Uint8Array> {
        const { connection, connectionHandle, peripheralAddress, c1Uuid, c2Uuid } = this.#link;
        this.#framesBeforeSession.length = 0;

        // The C2 indication is a separate binary frame that can beat the WriteAndSubscribe response, so the
        // handshake must be pending before the request is sent.
        const { promise, resolver, rejecter } = createPromise<Uint8Array>();
        this.#pendingHandshake = { resolver, rejecter };
        const timeout = Time.getTimer("BLE proxy handshake timeout", MatterBle.BTP_CONN_RSP_TIMEOUT, () =>
            rejecter(new BleError(`BTP handshake response not received from ${peripheralAddress}`)),
        ).start();

        const request = BtpCodec.encodeBtpHandshakeRequest({
            versions: MatterBle.BTP_SUPPORTED_VERSIONS,
            attMtu: segmentSize,
            clientWindowSize: MatterBle.BTP_MAXIMUM_WINDOW_SIZE,
        });
        logger.debug(`Sending BTP handshake request on C1 and subscribing C2 atomically`);

        try {
            // Write C1 and subscribe C2 atomically so the peripheral can't fire its indication before notifications
            // are enabled. Await both together: the handshake timer can reject while the write is still pending.
            const writeAndSubscribe = connection.sendCommand(BleProxyCommand.WriteAndSubscribe, {
                connection_handle: connectionHandle,
                write_uuid: c1Uuid,
                write_value: Buffer.from(request as ArrayBuffer).toString("base64"),
                write_response: true,
                subscribe_uuid: c2Uuid,
            });
            const [, response] = await Promise.all([writeAndSubscribe, promise]);
            return response;
        } finally {
            this.#pendingHandshake = undefined;
            timeout.stop();
        }
    }

    async #adoptSession(handshakeResponse: Uint8Array, segmentSize: number) {
        const { connection, connectionHandle, peripheralAddress } = this.#link;
        const session = await BtpSessionHandler.createAsCentral(
            handshakeResponse,
            async (data: Bytes) => {
                const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
                connection.sendBinaryFrame(BinaryFrameOpcode.WriteData, connectionHandle, bytes);
            },
            async () => this.#disconnectPeripheral(),
            async (data: Bytes) => {
                this.pushMessage(data);
                this.#onMatterMessage(this, data);
            },
            segmentSize,
        );
        if (!this.#usable) {
            session.suspend();
            throw new BleDisconnectedError(
                `Peripheral ${peripheralAddress}: Channel was lost while establishing the BTP session`,
            );
        }
        this.#btpSession = session;
        session.closed.once(() => {
            this.#connected = false;
            this.#detachObservers();
            this.#terminateIterator();
            this.emitClosed();
        });
        session.stalledAfterHandshake.once(messagesToReplay => this.#startRenegotiation(messagesToReplay));
        for (const data of this.#framesBeforeSession.splice(0)) {
            this.#forwardToSession(session, data);
        }
    }

    #startRenegotiation(messagesToReplay: readonly Bytes[]) {
        if (this.#renegotiation !== undefined) {
            return;
        }
        this.#btpSession = undefined;
        // Every send awaits this promise: it must exist before the first step runs and never settle rejected
        this.#renegotiation = Promise.resolve()
            .then(() => Abort.attempt(this.#lifetime, this.#renegotiate(messagesToReplay)))
            .catch(async error => {
                const { peripheralAddress } = this.#link;
                if (this.#closing) {
                    logger.debug(`Peripheral ${peripheralAddress}: Renegotiation ended by closing the channel`);
                    return;
                }
                if (this.#usable) {
                    logger.warn(`Peripheral ${peripheralAddress}: Renegotiating the BTP session failed`, error);
                } else {
                    logger.debug(`Peripheral ${peripheralAddress}: Renegotiation ended by disconnect`, error);
                }
                await this.close().catch(closeError =>
                    logger.debug(
                        `Peripheral ${peripheralAddress}: Error closing after a failed renegotiation`,
                        closeError,
                    ),
                );
            });
    }

    async #renegotiate(messagesToReplay: readonly Bytes[]) {
        const { connection, connectionHandle, peripheralAddress, c2Uuid } = this.#link;
        logger.info(
            `Peripheral ${peripheralAddress}: Peer did not respond to any BTP packet, retrying with a ${MatterBle.MINIMUM_ATT_MTU} byte BTP segment size`,
        );
        // §4.19.4.10: unsubscribing from C2 closes the BTP session
        await connection.sendCommand(BleProxyCommand.UnsubscribeCharacteristic, {
            connection_handle: connectionHandle,
            characteristic_uuid: c2Uuid,
        });
        this.#assertRenegotiable();
        const handshakeResponse = await this.#handshake(MatterBle.MINIMUM_ATT_MTU);
        this.#assertRenegotiable();
        await this.#adoptSession(handshakeResponse, MatterBle.MINIMUM_ATT_MTU);
        for (const message of messagesToReplay) {
            await this.#currentSession.sendMatterMessage(message);
        }
    }

    #assertRenegotiable() {
        if (!this.#usable) {
            throw new BleDisconnectedError(
                `Peripheral ${this.#link.peripheralAddress}: Channel was lost while renegotiating the BTP session`,
            );
        }
    }

    get #usable() {
        return this.#connected;
    }

    /** Absent only while a renegotiation replaces the session or after it failed, which also ends the channel. */
    get #currentSession() {
        if (this.#btpSession === undefined) {
            throw new BleDisconnectedError(`Peripheral ${this.#link.peripheralAddress}: No BTP session`);
        }
        return this.#btpSession;
    }

    get connected() {
        return this.#connected;
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
            this.#iteratorWaiter?.({ value: undefined, done: true });
            this.#iteratorWaiter = undefined;
        }
    }

    /**
     * Waits for a pending renegotiation of the BTP session.
     *
     * @throws {BleDisconnectedError} once the peripheral, the BTP session or the channel has ended
     */
    async send(data: Bytes) {
        await this.#renegotiation;
        if (!this.#usable) {
            throw new BleDisconnectedError(`Cannot send data, not connected to ${this.#link.peripheralAddress}`);
        }
        await this.#currentSession.sendMatterMessage(data);
    }

    get name() {
        return `ble-proxy://${this.#link.peripheralAddress}`;
    }

    async close() {
        if (!this.#finish()) {
            return;
        }
        this.#btpSession.closed.off(this.#onBtpSessionClosed);
        await this.#btpSession.close();
        this.emitClosed();
    }

    /** Ends the channel once, whether {@link close} or the BTP session ends it; false if it already ended. */
    #finish() {
        if (this.#closing) {
            return false;
        }
        this.#closing = true;
        this.#connected = false;
        this.#lifetime.abort();
        this.#pendingHandshake?.rejecter(
            new BleDisconnectedError(`Peripheral ${this.#link.peripheralAddress}: Channel closed`),
        );
        this.#detachObservers();
        this.#terminateIterator();
        for (const listener of this.#closeListeners) {
            listener();
        }
        await this.#btpSession?.close();
        // Covers a session that already ended or a renegotiation in progress, where no session asks for it
        this.#disconnectPeripheral();
        this.emitClosed();
    }
}
