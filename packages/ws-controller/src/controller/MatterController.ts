/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { cdSigners, paaRoots, vendors } from "@matter/dcl-data/node";
import {
    Bytes,
    CommissioningClient,
    Crypto,
    DclBehavior,
    Environment,
    FabricId,
    GlobalFabricId,
    Logger,
    MatterAggregateError,
    NodeId,
    SharedEnvironmentServices,
    SoftwareUpdateManager,
    Timestamp,
} from "@matter/main";
import { VendorInfo, DclCertificateService, DclVendorInfoService, OperationalDataset } from "@matter/main/protocol";
import { VendorId } from "@matter/main/types";
import { Endpoint } from "@matter/node";
import { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { CameraControllerDevice } from "@matter/node/devices/camera-controller";
import {
    BorderRouterRegistry,
    connectMeshcop,
    OtbrRestClient,
    OtbrRestDiagnosticSource,
    ThreadCredentialsRegistry,
} from "@matter/thread-br-client";
import { CommissioningController } from "@project-chip/matter.js";
import { Readable } from "node:stream";
import { ConfigStorage } from "../server/ConfigStorage.js";
import { ControllerCommandHandler } from "./ControllerCommandHandler.js";
import { LegacyDataInjector, LegacyServerData } from "./LegacyDataInjector.js";
import { resolveServerId } from "./ServerIdResolver.js";
import { ThreadDiagnosticsService } from "./ThreadDiagnosticsService.js";

const logger = Logger.get("MatterController");

let bleSupportLoaded: Promise<void> | undefined;

// Lazy-load the optional `@matter/nodejs-ble` so a missing install only fails when BLE is enabled.
// In BLE proxy mode the proxy provides its own Ble implementation and the host does not
// need a local BLE adapter or `@matter/nodejs-ble` — skip the import entirely.
async function loadBleSupport(environment: Environment, bleProxyEnabled: boolean): Promise<void> {
    if (!environment.vars.get("ble.enable", false)) return;
    if (bleProxyEnabled) return;
    if (bleSupportLoaded === undefined) {
        bleSupportLoaded = (async () => {
            try {
                await import("@matter/nodejs-ble");
            } catch (error) {
                logger.error(
                    `Failed to load '@matter/nodejs-ble'. Disable BLE or ensure the package is installed.`,
                    error,
                );
                throw error;
            }
        })();
    }
    return bleSupportLoaded;
}

export async function computeCompressedNodeId(
    crypto: Crypto,
    fabricId: number | bigint,
    caKey: Bytes,
): Promise<string> {
    return (await GlobalFabricId.compute(crypto, FabricId(fabricId), caKey)).toString();
}

export interface MatterControllerOptions {
    enableTestNetDcl?: boolean;
    disableOtaProvider?: boolean;
    /** Disable bundled offline DCL seed data (PAA roots, CD signers, vendors). When true, only network DCL is used. */
    disableDclSeed?: boolean;
    /** Server ID for storage. Default is "server", but may be "server-<hex(fabricId)>-<hex(vendorId)>" for multi-fabric support */
    serverId?: string;
    /** Server version string (e.g., "0.2.10" or "0.2.10-alpha.0"). Used for BasicInformation cluster. */
    serverVersion?: string;
    /** BLE proxy mode: skip the `@matter/nodejs-ble` import; caller supplies the Ble implementation. */
    bleProxyEnabled?: boolean;
    /** Enable time synchronization for nodes with the TimeSynchronization cluster. Only enable when host NTP is reliable. */
    enableTimeSync?: boolean;
    /** Detect silently-dead node subscriptions and force a resubscribe. Defaults to true. */
    subscriptionWatchdog?: boolean;
    /**
     * Disable the Thread Border Router subsystem: no mDNS BR discovery, no REST/CoAP
     * probing or diagnostics. Matter-over-Thread commissioning (which reads the stored
     * dataset from config) is unaffected. Defaults to false.
     */
    disableThreadDiagnostics?: boolean;
}

/**
 * Parse a version string into a numeric version in MMmmpp format.
 * For alpha/beta versions, only the base version (major.minor.patch) is used.
 * @param version Version string like "0.2.10" or "0.2.10-alpha.0"
 * @returns Numeric version like 210 for "0.2.10"
 */
function parseVersionToNumber(version: string): number {
    // Extract base version (before any -alpha, -beta, etc.)
    const baseVersion = version.split("-")[0];
    const parts = baseVersion.split(".");
    const major = parseInt(parts[0] ?? "0", 10);
    const minor = parseInt(parts[1] ?? "0", 10);
    const patch = parseInt(parts[2] ?? "0", 10);
    // Format: MMmmpp (2 digits each)
    return major * 10000 + minor * 100 + patch;
}

/**
 * Decode a stored Thread operational dataset hex string and register the resulting
 * credentials. Logs the public extPanId + network name; never logs `pskc` or
 * `networkKey`. Empty / undefined input is a no-op. Errors are caught and warned —
 * the registry is best-effort so a malformed hex blob in storage doesn't block boot
 * or block a successful storage write in the WS path.
 *
 * Returns the parsed {@link OperationalDataset} on success so callers that need
 * downstream fields (e.g. extPanId for reconciliation) can avoid a second decode.
 */
export function registerThreadCredentialsFromHex(
    credentials: ThreadCredentialsRegistry,
    hex: string | undefined,
    source: string,
): OperationalDataset | undefined {
    if (hex === undefined || hex === "") return undefined;
    try {
        const ds = OperationalDataset.decode(hex);
        credentials.register(ds);
        logger.info(`Registered Thread credentials from ${source} (${formatDatasetForLog(ds)})`);
        return ds;
    } catch (e) {
        logger.warn(`Could not register Thread credentials from ${source}: ${e}`);
        return undefined;
    }
}

function formatDatasetForLog(ds: OperationalDataset): string {
    const fields = new Array<string>();
    fields.push(`xp=${ds.extPanId === undefined ? "?" : Bytes.toHex(ds.extPanId).toUpperCase()}`);
    fields.push(`network="${ds.networkName ?? ""}"`);
    if (ds.channel !== undefined) fields.push(`ch=${ds.channel}`);
    if (ds.panId !== undefined) fields.push(`panId=0x${ds.panId.toString(16).padStart(4, "0").toUpperCase()}`);
    if (ds.meshLocalPrefix !== undefined) fields.push(`mlPrefix=${Bytes.toHex(ds.meshLocalPrefix).toUpperCase()}`);
    if (ds.activeTimestamp !== undefined) fields.push(`activeTs=${Bytes.toHex(ds.activeTimestamp).toUpperCase()}`);
    if (ds.pendingTimestamp !== undefined) fields.push(`pendingTs=${Bytes.toHex(ds.pendingTimestamp).toUpperCase()}`);
    fields.push(`pskc=${ds.pskc !== undefined ? "set" : "missing"}`);
    fields.push(`networkKey=${ds.networkKey !== undefined ? "set" : "missing"}`);
    if (ds.securityPolicy !== undefined) {
        fields.push(
            `secPolicy=rotation${ds.securityPolicy.rotationTime}h/flags=0x${ds.securityPolicy.flags.toString(16).padStart(4, "0").toUpperCase()}`,
        );
    }
    if (ds.unknownTlvs.length > 0) fields.push(`unknownTlvs=${ds.unknownTlvs.length}`);
    return fields.join(", ");
}

/**
 * Split an `OtbrRestCapability.baseUrl` (e.g. `http://[fd00::1]:8081`) into the
 * host + port the {@link OtbrRestClient} constructor expects. Square-bracketed
 * IPv6 hosts are stripped — the client wraps them again itself.
 */
function parseRestBaseUrl(baseUrl: string): { host: string; port: number } {
    const url = new URL(baseUrl);
    let host = url.hostname;
    if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    const port = url.port === "" ? 8081 : Number(url.port);
    return { host, port };
}

export class MatterController {
    #env: Environment;
    #controllerInstance?: CommissioningController;
    #commandHandler?: ControllerCommandHandler;
    #config: ConfigStorage;
    #serverId: string;
    #serverVersion: string;
    #legacyCommissionedDates?: Map<string, Timestamp>;
    #enableTestNetDcl = false;
    #disableOtaProvider = true;
    #disableDclSeed = false;
    #bleProxyEnabled = false;
    #enableTimeSync = false;
    #subscriptionWatchdog = true;
    #threadDiagnosticsDisabled = false;
    readonly #borderRouterRegistry: BorderRouterRegistry;
    readonly #credentials = new ThreadCredentialsRegistry();
    readonly #threadDiagnostics: ThreadDiagnosticsService;
    #webRtcRequestor?: Endpoint<typeof CameraControllerDevice>;
    #services: SharedEnvironmentServices;

    static async create(
        environment: Environment,
        config: ConfigStorage,
        options: MatterControllerOptions,
        legacyData?: LegacyServerData,
    ) {
        await loadBleSupport(environment, options.bleProxyEnabled ?? false);

        // Resolve the server ID to use
        const serverId = await resolveServerId(
            environment,
            config,
            options,
            legacyData?.vendorId,
            legacyData?.fabricId,
        );

        const instance = new MatterController(environment, config, options, serverId);

        const commissionedDates = new Map<string, Timestamp>();
        if (legacyData !== undefined) {
            const crypto = environment.get(Crypto);
            const baseStorage = await config.service.open(serverId);
            try {
                if (legacyData.credentials && legacyData.fabricId) {
                    await LegacyDataInjector.injectCredentials(
                        baseStorage.createContext("credentials"),
                        baseStorage.createContext("fabrics"),
                        crypto,
                        legacyData.credentials,
                        legacyData.fabric,
                    );
                }
                if (
                    (await LegacyDataInjector.injectNodeData(
                        baseStorage,
                        legacyData.nodeData,
                        legacyData.fabric?.fabricIndex,
                    )) &&
                    legacyData.nodeData !== undefined
                ) {
                    for (const [nodeIdStr, data] of Object.entries(legacyData.nodeData.nodes)) {
                        const { date_commissioned: commissionedAt } = data;
                        commissionedDates.set(nodeIdStr, Timestamp(new Date(commissionedAt).getTime()));
                    }
                }

                // Check if the nextNodeId needs to be updated based on legacy data
                const lastNodeId = legacyData.nodeData?.last_node_id;
                if (typeof lastNodeId === "number" || typeof lastNodeId === "bigint") {
                    // Compare as BigInt to safely handle both number and bigint types
                    if (BigInt(config.nextNodeId) <= BigInt(lastNodeId)) {
                        const newNextNodeId = BigInt(lastNodeId) + 10n;
                        logger.info(
                            `Updating nextNodeId from ${config.nextNodeId} to ${newNextNodeId} (legacy last_node_id: ${lastNodeId})`,
                        );
                        await config.set({ nextNodeId: newNextNodeId });
                    }
                }
            } finally {
                await baseStorage.close();
            }
        }

        await instance.initialize(legacyData?.vendorId, legacyData?.fabricId, commissionedDates);
        return instance;
    }

    constructor(environment: Environment, config: ConfigStorage, options: MatterControllerOptions, serverId: string) {
        this.#env = environment;
        this.#borderRouterRegistry = new BorderRouterRegistry(this.#env);
        this.#config = config;
        this.#serverId = serverId;
        this.#serverVersion = options.serverVersion ?? "0.0.0";
        this.#enableTestNetDcl = options.enableTestNetDcl ?? this.#enableTestNetDcl;
        this.#disableOtaProvider = options.disableOtaProvider ?? this.#disableOtaProvider;
        this.#disableDclSeed = options.disableDclSeed ?? this.#disableDclSeed;
        this.#bleProxyEnabled = options.bleProxyEnabled ?? this.#bleProxyEnabled;
        this.#enableTimeSync = options.enableTimeSync ?? this.#enableTimeSync;
        this.#subscriptionWatchdog = options.subscriptionWatchdog ?? this.#subscriptionWatchdog;
        this.#threadDiagnosticsDisabled = options.disableThreadDiagnostics ?? this.#threadDiagnosticsDisabled;
        this.#services = this.#env.asDependent();
        this.#threadDiagnostics = new ThreadDiagnosticsService({
            enabled: !this.#threadDiagnosticsDisabled,
            borderRouters: this.#borderRouterRegistry,
            credentials: this.#credentials,
            makeRestSource: cap => {
                const { host, port } = parseRestBaseUrl(cap.baseUrl);
                return new OtbrRestDiagnosticSource(new OtbrRestClient({ host, port }), cap);
            },
            makeMeshcopSource: (creds, br) => connectMeshcop({ environment: this.#env, creds, br }),
            bootstrapCredentialsFromRest: async cap => {
                const { host, port } = parseRestBaseUrl(cap.baseUrl);
                const ds = await new OtbrRestClient({ host, port }).getActiveDataset();
                if (ds === undefined) return;
                this.#credentials.register(ds);
                logger.info(`Registered Thread credentials from rest:${cap.baseUrl} (${formatDatasetForLog(ds)})`);
            },
        });
    }

    protected async initialize(
        vendorId?: number,
        fabricId?: number | bigint,
        legacyCommissionedDates?: Map<string, Timestamp>,
    ) {
        this.#legacyCommissionedDates = legacyCommissionedDates?.size ? legacyCommissionedDates : undefined;

        // Mimic Dcl configuration from DCL Behavior override settings
        const dclConfig = this.#env.vars.has("dcl.productionurl")
            ? { url: this.#env.vars.string("dcl.productionurl") }
            : undefined;
        const testDclConfig = this.#env.vars.has("dcl.testurl")
            ? { url: this.#env.vars.string("dcl.testurl") }
            : undefined;
        const fetchTestCertificates = this.#env.vars.get("dcl.fetchtestcertificates", true);
        const fetchGithubCertificates = this.#env.vars.get("dcl.fetchgithubcertificates", true);

        // Register DCL services on the root environment; DclBehavior picks them up.
        // When seeding is enabled (default), pre-populate from the bundled offline snapshot so
        // commissioning works without internet access.
        //
        // Test PAA roots/CD signers are always loaded (fetchTestCertificates, unless turned off by ENV
        // variables). Trust is gated separately via acceptTestCertificates: a test device is only
        // commissioned when enableTestNetDcl is set; otherwise the attestation validator reports
        // TrustedAsTestCertificate and onAttestationFailure rejects with an actionable hint instead of
        // an opaque PaaNotTrusted.
        const trustTestCertificates = this.#enableTestNetDcl;
        if (this.#disableDclSeed) {
            new DclCertificateService(this.#env.root, {
                dclConfig,
                testDclConfig,
                fetchTestCertificates,
                fetchGithubCertificates,
                acceptTestCertificates: trustTestCertificates,
            });
        } else {
            new DclCertificateService(this.#env.root, {
                dclConfig,
                testDclConfig,
                fetchTestCertificates,
                fetchGithubCertificates,
                acceptTestCertificates: trustTestCertificates,
                seed: {
                    paaRoots: paaRoots({ includeTest: true }),
                    cdSigners: cdSigners({ includeTest: true }),
                },
            });
            new DclVendorInfoService(this.#env.root, {
                dclConfig,
                seed: { vendors: vendors({ includeTest: trustTestCertificates }) },
            });
            this.#services.get(DclVendorInfoService);
        }
        this.#services.get(DclCertificateService);

        this.#controllerInstance = new CommissioningController({
            environment: {
                environment: this.#env,
                id: this.#serverId,
            },
            autoConnect: false, // Do not auto-connect to the commissioned nodes
            adminFabricLabel: this.#config.fabricLabel,
            adminVendorId: vendorId !== undefined ? VendorId(vendorId) : undefined,
            adminFabricId: fabricId !== undefined ? FabricId(fabricId) : undefined,
            rootNodeId: NodeId(112233), // TODO Remove when we switch to random IDs
            enableOtaProvider: !this.#disableOtaProvider,
            tcp: true,
            transportPreference: "tcp",
            basicInformation: {
                vendorName: "Open Home Foundation",
                productName: "OHF Matter Server",
                productId: 1,
                hardwareVersion: 1,
                hardwareVersionString: "1.0",
                softwareVersion: parseVersionToNumber(this.#serverVersion) || 1,
                softwareVersionString: this.#serverVersion.split("-")[0], // Base version without alpha/beta suffix
            },
        });
    }

    get commandHandler() {
        if (this.#controllerInstance === undefined) {
            throw new Error("Controller not initialized");
        }
        if (this.#commandHandler === undefined) {
            this.#commandHandler = new ControllerCommandHandler(
                this.#controllerInstance,
                this.#env.vars.get("ble.enable", false),
                this.#bleProxyEnabled,
                !this.#disableOtaProvider,
                this.#enableTimeSync,
                this.#subscriptionWatchdog,
            );

            this.#commandHandler.events.started.once(async () => {
                this.#controllerInstance!.node.behaviors.require(DclBehavior);
                await this.#controllerInstance!.node.setStateOf(DclBehavior, {
                    fetchTestCertificates: true,
                    acceptTestCertificates: this.#enableTestNetDcl,
                });

                const initPromises = new Array<Promise<unknown>>();

                if (this.#legacyCommissionedDates !== undefined) {
                    initPromises.push(this.injectCommissionedDates());
                }

                // Start loading and initialization of meta data
                initPromises.push(this.vendorInfoService());
                // initPromises.push(this.certificateService()); // postponed to commissioning needs

                if (!this.#disableOtaProvider && this.#enableTestNetDcl) {
                    initPromises.push(this.#enableTestOtaImages());
                }

                initPromises.push(this.#enableWebRtcRequestor());

                if (!this.#threadDiagnosticsDisabled) {
                    initPromises.push(this.#borderRouterRegistry.start());
                    this.#registerStoredThreadCredentials();
                }

                try {
                    await MatterAggregateError.allSettled(initPromises);
                } catch (error) {
                    logger.error("Error initializing controller additional services", error);
                }
            });
        }

        return this.#commandHandler;
    }

    get borderRouters(): BorderRouterRegistry {
        return this.#borderRouterRegistry;
    }

    get credentials(): ThreadCredentialsRegistry {
        return this.#credentials;
    }

    /** False when the Thread BR subsystem is disabled via `disableThreadDiagnostics`. */
    get threadDiagnosticsEnabled(): boolean {
        return !this.#threadDiagnosticsDisabled;
    }

    get threadDiagnostics(): ThreadDiagnosticsService {
        return this.#threadDiagnostics;
    }

    #registerStoredThreadCredentials(): void {
        for (const entry of this.#config.listThreadCredentials()) {
            registerThreadCredentialsFromHex(this.#credentials, entry.dataset, `stored:${entry.id}`);
        }
    }

    get webRtcRequestor(): Endpoint<typeof CameraControllerDevice> {
        if (!this.#webRtcRequestor) {
            throw new Error("WebRTC requestor endpoint not initialized");
        }
        return this.#webRtcRequestor;
    }

    async #enableWebRtcRequestor(): Promise<void> {
        if (!this.#controllerInstance) {
            throw new Error("Controller not started");
        }
        const node = this.#controllerInstance.node;
        if (node.endpoints.has("camera-controller")) {
            this.#webRtcRequestor = node.endpoints.for("camera-controller") as Endpoint<typeof CameraControllerDevice>;
            return;
        }
        this.#webRtcRequestor = await node.add(
            new Endpoint(CameraControllerDevice.with(WebRtcTransportRequestorServer), { id: "camera-controller" }),
        );
    }

    /**
     * Get the DCL vendor info service instance.
     * Lazily initializes the service if not already present.
     */
    async vendorInfoService() {
        if (this.#controllerInstance === undefined) {
            throw new Error("Controller not initialized");
        }
        const service = await this.#controllerInstance.node.act(agent => agent.get(DclBehavior).vendorInfoService);
        await service.construction;
        return service;
    }

    /**
     * Get the DCL certificate service instance
     * Lazily initializes the service if not already present.
     */
    async certificateService() {
        if (this.#controllerInstance === undefined) {
            throw new Error("Controller not initialized");
        }
        const service = await this.#controllerInstance.node.act(agent => agent.get(DclBehavior).certificateService);
        await service.construction;
        return service;
    }

    /**
     * Get the DCL OTA update service instance
     * Lazily initializes the service if not already present.
     */
    async otaUpdateService() {
        if (this.#controllerInstance === undefined) {
            throw new Error("Controller not initialized");
        }
        const service = await this.#controllerInstance.node.act(agent => agent.get(DclBehavior).otaUpdateService);
        await service.construction;
        return service;
    }

    /**
     * Get vendor information by vendor ID.
     * Returns undefined if the vendor is not found.
     */
    async getVendorInfo(vendorId: number): Promise<VendorInfo | undefined> {
        return (await this.vendorInfoService()).infoFor(vendorId);
    }

    /**
     * Get all vendor information from the DCL service.
     */
    async getAllVendors(): Promise<ReadonlyMap<number, VendorInfo>> {
        return (await this.vendorInfoService()).vendors;
    }

    async injectCommissionedDates() {
        if (this.#controllerInstance === undefined || this.#legacyCommissionedDates === undefined) {
            return;
        }
        for (const [nodeIdStr, commissionedAt] of this.#legacyCommissionedDates) {
            try {
                const peerAddress = this.#controllerInstance.fabric.addressOf(NodeId(BigInt(nodeIdStr)));
                const node = await this.#controllerInstance.node.peers.forAddress(peerAddress);
                const commissioningState = node.maybeStateOf(CommissioningClient);
                if (commissioningState !== undefined && commissioningState.commissionedAt === undefined) {
                    await node.setStateOf(CommissioningClient, { commissionedAt });
                }
            } catch (error) {
                logger.warn(`Error injecting commissioned date for node ${nodeIdStr}`, error);
            }
        }
    }

    async stop() {
        if (!this.#threadDiagnosticsDisabled) {
            await this.#threadDiagnostics.stop();
            await this.#borderRouterRegistry.stop();
        }
        await this.#commandHandler?.close(); // This closes also the controller instance if started
        await this.#services.close();
    }

    /**
     * Enable test OTA images (test-net DCL).
     * Must be called after the controller is started.
     */
    async #enableTestOtaImages() {
        if (this.#controllerInstance === undefined) {
            throw new Error("Controller not initialized");
        }
        await this.#controllerInstance.otaProvider.setStateOf(SoftwareUpdateManager, {
            allowTestOtaImages: true,
        });
        logger.info("Enabled test OTA images (test-net DCL)");
    }

    /**
     * Store an OTA image file from a file path.
     * @param filePath - Path to the OTA file
     * @returns true if stored successfully
     */
    async storeOtaImageFromFile(filePath: string): Promise<boolean> {
        const { createReadStream } = await import("node:fs");
        const { pathToFileURL } = await import("node:url");
        const otaService = await this.otaUpdateService();

        // Convert file path to file:// URL for the OTA service
        const fileUrl = pathToFileURL(filePath).href;

        // Read the file twice - once for info, once for storage
        const infoStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
        const updateInfo = await otaService.updateInfoFromStream(infoStream, fileUrl);

        logger.info(
            `Storing OTA image from ${filePath}: vendorId=0x${updateInfo.vid.toString(16)}, productId=0x${updateInfo.pid.toString(16)}, version=${updateInfo.softwareVersion} (${updateInfo.softwareVersionString})`,
        );

        const storeStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
        await otaService.store(storeStream, updateInfo, "local");
        return true;
    }
}
