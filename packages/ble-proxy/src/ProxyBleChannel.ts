/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    Bytes,
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
import {
    type BinaryFrame,
    BinaryFrameOpcode,
    BleProxyCommand,
    BleProxyCommandError,
    BleProxyErrorCode,
    BleProxyEvent,
} from "./BleProxyProtocol.js";
import type { ProxyBleScanner } from "./ProxyBleScanner.js";

const logger = Logger.get("ProxyBleChannel");

/** BTP handshake response identification bytes (Matter spec §4.19.3.2) */
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
    const { services } = await connection.sendCommand(BleProxyCommand.DiscoverServices, {
        connection_handle: connectionHandle,
    });

    const matterService = services.find(s => MatterBle.isServiceUuid(s.uuid));
    if (!matterService) {
        throw new BleError(`Peripheral ${peripheralAddress} does not have Matter BLE service`);
    }

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

    if (c3Uuid && hasAdditionalAdvertisementData) {
        logger.debug(`Reading additional commissioning data from C3`);
        await connection.sendCommand(BleProxyCommand.ReadCharacteristic, {
            connection_handle: connectionHandle,
            characteristic_uuid: c3Uuid,
        });
    }

    return { c1Uuid, c2Uuid };
}

function releasePeripheral(connection: BleProxyConnection, connectionHandle: number, peripheralAddress: string) {
    connection
        .sendCommand(BleProxyCommand.Disconnect, { connection_handle: connectionHandle })
        .catch(error => logger.debug(`Peripheral ${peripheralAddress}: Error during connect-failure cleanup`, error));
}

/**
 * Transport implementation that opens BLE channels through the proxy WebSocket.
 * Replaces NobleBleCentralInterface from @matter/nodejs-ble.
 */
export class ProxyBleCentralInterface implements Transport {
    readonly #bleScanner: ProxyBleScanner;
    readonly #handler: BleProxyHandler;
    #onMatterMessageListener: ((socket: Channel<Bytes>, data: Bytes) => void) | undefined;
    /** Aborted by {@link close}, which also aborts the opens still in progress. */
    readonly #lifetime = new AbortController();
    readonly #channels = new Set<ProxyBleChannel>();

    constructor(bleScanner: ProxyBleScanner, handler: BleProxyHandler) {
        this.#bleScanner = bleScanner;
        this.#handler = handler;
    }

    /**
     * An abort during the open disconnects the peripheral, including one the proxy connects after the abort.
     *
     * @throws {NetworkError} when the interface is closed, also while the open is in progress
     * @throws {BleDisconnectedError} when the peripheral or its proxy client is lost during the open
     * @throws {BleError} when no proxy client owns the peripheral, it lacks the Matter characteristics, a proxy command
     *     fails or the BTP handshake response does not arrive in time
     * @throws {BtpProtocolError} when the peripheral answers with an unsupported BTP version
     * @throws {InternalError} when the address is not a BLE address or no data listener is installed
     * @throws the abort reason when `options.abort` fires
     */
    async openChannel(address: ServerAddress, options?: Transport.OpenChannelOptions): Promise<ProxyBleChannel> {
        const abort =
            options?.abort === undefined
                ? this.#lifetime.signal
                : AbortSignal.any([this.#lifetime.signal, options.abort]);
        abort.throwIfAborted();
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

        const connecting = connection.sendCommand(BleProxyCommand.Connect, { address: peripheralAddress });
        let connected: Awaited<typeof connecting>;
        try {
            connected = await Abort.attempt(abort, connecting);
        } catch (error) {
            if (abort.aborted) {
                connecting.then(
                    ({ connection_handle }) => releasePeripheral(connection, connection_handle, peripheralAddress),
                    () => {},
                );
            }
            throw error;
        }
        const { connection_handle, mtu: peripheralMtu } = connected;

        const segmentSize = MatterBle.btpSegmentSizeFromAttMtu(peripheralMtu ?? 0);
        logger.info(
            `Connected to ${peripheralAddress}, handle=${connection_handle}, BTP segment size=${segmentSize} bytes (peripheral ATT_MTU up to ${peripheralMtu ?? "n/a"}), rssi=${rssi ?? "n/a"}`,
        );

        let link: ProxyPeripheralLink;
        try {
            const { c1Uuid, c2Uuid } = await Abort.attempt(
                abort,
                discoverMatterCharacteristics(
                    connection,
                    connection_handle,
                    peripheralAddress,
                    hasAdditionalAdvertisementData,
                ),
            );
            link = { connection, connectionHandle: connection_handle, peripheralAddress, c1Uuid, c2Uuid };
        } catch (error) {
            releasePeripheral(connection, connection_handle, peripheralAddress);
            throw asLinkError(error, peripheralAddress);
        }

        const channel = await ProxyBleChannel.open(link, onMatterMessageListener, segmentSize, abort);
        this.#channels.add(channel);
        channel.closed.once(() => {
            this.#channels.delete(channel);
        });
        return channel;
    }

    onData(listener: (socket: Channel<Bytes>, data: Bytes) => void): Transport.Listener {
        this.#onMatterMessageListener = listener;
        return {
            close: async () => await this.close(),
        };
    }

    /** Stops new opens, aborts the ones in progress and closes the open channels, which disconnects their peripherals. */
    async close() {
        this.#lifetime.abort(new NetworkError("Network interface is closed"));
        await Promise.all([...this.#channels].map(channel => channel.close()));
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

/** A proxy reply saying the peripheral is not connected means the BLE link is gone. */
function asLinkError(error: unknown, peripheralAddress: string) {
    if (error instanceof BleProxyCommandError && error.code === BleProxyErrorCode.NotConnected) {
        return new BleDisconnectedError(`Peripheral ${peripheralAddress}: ${error.detail}`, { cause: error });
    }
    return error;
}

/**
 * Lifecycle of a {@link ProxyBleChannel}:
 *
 * ```
 * opening ──handshake──▶ open ──stall──▶ retrying ──handshake, resend──▶ open
 *    └───────────── close / peripheral lost / session end ─────────────▶ closed
 * ```
 *
 * Each state except `closed` is a new object, and an async step changes the state only from the object it started with (see
 * `#transition`), so a step that resumes after the channel closed cannot reopen it. Sends wait for `done` while
 * `retrying`.
 */
type ChannelState =
    | { readonly kind: "opening" }
    | { readonly kind: "open"; readonly session: BtpSessionHandler }
    | { readonly kind: "retrying"; readonly done: Promise<void> }
    | { readonly kind: "closed" };

const CLOSED: ChannelState = { kind: "closed" };

/**
 * BLE channel that communicates through the proxy WebSocket.
 * Replaces NobleBleChannel from @matter/nodejs-ble.
 *
 * The channel owns at most one BTP session at a time and suspends it when the channel closes, so no session outlives
 * the channel. When the peer stalls after the first handshake (see {@link BtpSessionHandler.stalledAfterHandshake}),
 * the channel establishes one new session with the minimum segment size and resends the messages the peer never
 * acknowledged, as NobleBleChannel does.
 */
export class ProxyBleChannel extends BleChannel<Bytes> {
    /**
     * Performs the BTP handshake on a connected peripheral and returns the channel. On failure or abort the peripheral
     * is disconnected.
     *
     * @throws {BleDisconnectedError} when the peripheral or its proxy client is lost meanwhile
     * @throws {BleError} when the handshake response does not arrive in time, or a proxy command fails
     * @throws {BtpProtocolError} when the peripheral answers with an unsupported BTP version
     * @throws the abort reason when `abort` fires
     */
    static async open(
        link: ProxyPeripheralLink,
        onMatterMessage: (socket: Channel<Bytes>, data: Bytes) => void,
        segmentSize: number,
        abort?: AbortSignal,
    ): Promise<ProxyBleChannel> {
        const channel = new ProxyBleChannel(link, onMatterMessage);
        const opening = channel.#state;
        try {
            const session = await Abort.attempt(
                abort,
                Abort.attempt(channel.#lifetime, channel.#establish(segmentSize)),
            );
            const open: ChannelState = { kind: "open", session };
            if (!channel.#transition(opening, open)) {
                throw new BleDisconnectedError(`Peripheral ${link.peripheralAddress}: Channel closed`);
            }
            session.stalledAfterHandshake.once(messagesToReplay => channel.#startRetry(open, messagesToReplay));
        } catch (error) {
            const lost = channel.#state.kind === "closed";
            channel.#end();
            if (lost && !(error instanceof BleDisconnectedError)) {
                throw new BleDisconnectedError(
                    `Peripheral ${link.peripheralAddress}: Lost while establishing the BTP session`,
                    { cause: error },
                );
            }
            throw asLinkError(error, link.peripheralAddress);
        }
        return channel;
    }

    readonly #link: ProxyPeripheralLink;
    readonly #onMatterMessage: (socket: Channel<Bytes>, data: Bytes) => void;
    #state: ChannelState = { kind: "opening" };
    /** The session the channel owns and feeds incoming frames to; none during a handshake and once closed. */
    #session?: BtpSessionHandler;
    /** Cleared once the proxy no longer holds the BLE link for us, so Disconnect is sent at most once. */
    #peripheralLinked = true;
    #pendingHandshake?: { resolver: (response: Uint8Array) => void; rejecter: (error: Error) => void };
    readonly #framesBeforeSession = new Array<Uint8Array>();
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
        link.connection.closed.once(this.#onOwnerClosed);
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
        if (this.#session === undefined) {
            this.#framesBeforeSession.push(data);
            return;
        }
        this.#forwardToSession(this.#session, data);
    };

    readonly #onEvent = (event: string, data: Record<string, unknown>) => {
        if (event === BleProxyEvent.Disconnected && data.connection_handle === this.#link.connectionHandle) {
            this.#peripheralLost(`Peripheral ${this.#link.peripheralAddress} disconnected unexpectedly`);
        }
    };

    readonly #onOwnerClosed = () => {
        this.#peripheralLost(`Owning proxy client for ${this.#link.peripheralAddress} disconnected`);
    };

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
        // Runs inside the proxy connection's shared emit: a throw here would starve the other channels
        try {
            this.#end();
        } catch (error) {
            logger.warn(`Peripheral ${this.#link.peripheralAddress}: Error closing channel`, error);
        }
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

    /** Replaces the state unless it changed since `from` was read. A refused step must stop. */
    #transition(from: ChannelState, to: ChannelState) {
        if (this.#state !== from) {
            return false;
        }
        this.#state = to;
        return true;
    }

    #throwIfClosed() {
        if (this.#state.kind === "closed") {
            throw new BleDisconnectedError(`Peripheral ${this.#link.peripheralAddress}: Channel closed`);
        }
    }

    /**
     * Runs a BTP handshake and makes the resulting session the one the channel owns.
     *
     * @throws {BleDisconnectedError} when the channel closed meanwhile; no session is left running then
     */
    async #establish(segmentSize: number) {
        const handshakeResponse = await this.#handshake(segmentSize);
        const { connection, connectionHandle } = this.#link;
        const session = await BtpSessionHandler.createAsCentral(
            handshakeResponse,
            async (data: Bytes) => {
                connection.sendBinaryFrame(BinaryFrameOpcode.WriteData, connectionHandle, Bytes.of(data));
            },
            async () => this.#disconnectPeripheral(),
            async (data: Bytes) => {
                this.pushMessage(data);
                this.#onMatterMessage(this, data);
            },
            segmentSize,
        );
        if (this.#state.kind === "closed") {
            session.suspend();
            this.#throwIfClosed();
        }
        this.#session = session;
        session.closed.once(() => this.#end());
        for (const data of this.#framesBeforeSession.splice(0)) {
            this.#forwardToSession(session, data);
        }
        return session;
    }

    async #handshake(segmentSize: number): Promise<Uint8Array> {
        this.#throwIfClosed();
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
                write_value: Buffer.from(Bytes.of(request)).toString("base64"),
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

    /** Called by the first session after it suspended itself; a failed retry closes the channel. */
    #startRetry(from: ChannelState, messagesToReplay: readonly Bytes[]) {
        const { promise: done, resolver } = createPromise<void>();
        const retrying: ChannelState = { kind: "retrying", done };
        if (!this.#transition(from, retrying)) {
            resolver();
            return;
        }
        this.#session = undefined;
        const { peripheralAddress } = this.#link;
        Abort.attempt(this.#lifetime, this.#retry(retrying, messagesToReplay))
            .catch(error => {
                if (this.#state.kind === "closed") {
                    logger.debug(`Peripheral ${peripheralAddress}: Retry ended by closing the channel`, error);
                    return;
                }
                logger.warn(`Peripheral ${peripheralAddress}: Retrying the BTP session failed`, error);
                this.#end();
            })
            .finally(resolver);
    }

    /** The new session has no stall observer, so a stall of it closes the session and with it the channel. */
    async #retry(retrying: ChannelState, messagesToReplay: readonly Bytes[]) {
        const { connection, connectionHandle, peripheralAddress, c2Uuid } = this.#link;
        logger.info(
            `Peripheral ${peripheralAddress}: Peer did not respond to any BTP packet, retrying with a ${MatterBle.MINIMUM_ATT_MTU} byte BTP segment size`,
        );
        // §4.19.4.10: unsubscribing from C2 closes the BTP session
        await connection.sendCommand(BleProxyCommand.UnsubscribeCharacteristic, {
            connection_handle: connectionHandle,
            characteristic_uuid: c2Uuid,
        });
        const session = await this.#establish(MatterBle.MINIMUM_ATT_MTU);
        for (const message of messagesToReplay) {
            await session.sendMatterMessage(message);
        }
        this.#transition(retrying, { kind: "open", session });
    }

    get connected() {
        const { kind } = this.#state;
        return kind === "open" || kind === "retrying";
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
                if (this.#iteratorDone) {
                    return Promise.resolve({ value: undefined as unknown as Bytes, done: true });
                }
                return new Promise<IteratorResult<Bytes>>(resolve => {
                    this.#iteratorWaiter = resolve;
                });
            },
        };
    }

    /** Detaches from the proxy connection, ends the iterator and notifies the close listeners. */
    #release() {
        const { connection, peripheralAddress } = this.#link;
        connection.binaryFrameReceived.off(this.#onBinaryFrame);
        connection.eventReceived.off(this.#onEvent);
        connection.closed.off(this.#onOwnerClosed);
        if (!this.#iteratorDone) {
            this.#iteratorDone = true;
            this.#iteratorWaiter?.({ value: undefined, done: true });
            this.#iteratorWaiter = undefined;
        }
        for (const listener of this.#closeListeners) {
            try {
                listener();
            } catch (error) {
                logger.warn(`Peripheral ${peripheralAddress}: Close listener failed`, error);
            }
        }
    }

    /**
     * Waits while the BTP session is being retried with the minimum segment size.
     *
     * @throws {BleDisconnectedError} once the peripheral, the BTP session or the channel has ended
     */
    async send(data: Bytes) {
        const state = this.#state;
        if (state.kind === "retrying") {
            await state.done;
        }
        const current = this.#state;
        if (current.kind !== "open") {
            throw new BleDisconnectedError(`Cannot send data, not connected to ${this.#link.peripheralAddress}`);
        }
        await current.session.sendMatterMessage(data);
    }

    get name() {
        return `ble-proxy://${this.#link.peripheralAddress}`;
    }

    async close() {
        this.#end();
    }

    #end() {
        if (this.#state.kind === "closed") {
            return;
        }
        this.#state = CLOSED;
        this.#lifetime.abort();
        this.#pendingHandshake?.rejecter(
            new BleDisconnectedError(`Peripheral ${this.#link.peripheralAddress}: Channel closed`),
        );
        this.#session?.suspend();
        this.#session = undefined;
        this.#release();
        this.#disconnectPeripheral();
        this.emitClosed();
    }
}
