/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

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
    SoftwareUpdateManager,
    Timestamp,
} from "@matter/main";
import { VendorInfo } from "@matter/main/protocol";
import { VendorId } from "@matter/main/types";
import { CommissioningController } from "@project-chip/matter.js";
import { Readable } from "node:stream";
import { ConfigStorage } from "../server/ConfigStorage.js";
import { ControllerCommandHandler } from "./ControllerCommandHandler.js";
import { LegacyDataInjector, LegacyServerData } from "./LegacyDataInjector.js";
import { resolveServerId } from "./ServerIdResolver.js";
// Register BLE
import "@matter/nodejs-ble";

const logger = Logger.get("MatterController");

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
    /** Server ID for storage. Default is "server", but may be "server-<hex(fabricId)>-<hex(vendorId)>" for multi-fabric support */
    serverId?: string;
    /** Server version string (e.g., "0.2.10" or "0.2.10-alpha.0"). Used for BasicInformation cluster. */
    serverVersion?: string;
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

    static async create(
        environment: Environment,
        config: ConfigStorage,
        options: MatterControllerOptions,
        legacyData?: LegacyServerData,
    ) {
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
        this.#config = config;
        this.#serverId = serverId;
        this.#serverVersion = options.serverVersion ?? "0.0.0";
        this.#enableTestNetDcl = options.enableTestNetDcl ?? this.#enableTestNetDcl;
        this.#disableOtaProvider = options.disableOtaProvider ?? this.#disableOtaProvider;
    }

    protected async initialize(
        vendorId?: number,
        fabricId?: number | bigint,
        legacyCommissionedDates?: Map<string, Timestamp>,
    ) {
        this.#legacyCommissionedDates = legacyCommissionedDates?.size ? legacyCommissionedDates : undefined;
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
                !this.#disableOtaProvider,
            );

            this.#commandHandler.events.started.once(async () => {
                this.#controllerInstance!.node.behaviors.require(DclBehavior, {
                    fetchTestCertificates: this.#enableTestNetDcl,
                });

                const initPromises = new Array<Promise<unknown>>();

                if (this.#legacyCommissionedDates !== undefined) {
                    initPromises.push(this.injectCommissionedDates());
                }

                // Start loading and initialization of meta data
                initPromises.push(this.vendorInfoService());
                initPromises.push(this.certificateService());

                if (!this.#disableOtaProvider && this.#enableTestNetDcl) {
                    initPromises.push(this.#enableTestOtaImages());
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
        await this.#commandHandler?.close(); // This closes also the controller instance if started
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
