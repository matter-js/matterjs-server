/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { SharedEnvironmentServices, Timestamp } from "@matter/general";
import {
    Bytes,
    CommissioningClient,
    Crypto,
    Environment,
    FabricId,
    GlobalFabricId,
    Logger,
    NodeId,
    SoftwareUpdateManager,
} from "@matter/main";
import { DclOtaUpdateService, DclVendorInfoService, VendorInfo } from "@matter/main/protocol";
import { VendorId } from "@matter/main/types";
import { CommissioningController } from "@project-chip/matter.js";
import { Readable } from "node:stream";
import { ConfigStorage } from "../server/ConfigStorage.js";
import { ControllerCommandHandler } from "./ControllerCommandHandler.js";
import { LegacyDataInjector, LegacyServerData } from "./LegacyDataInjector.js";

const logger = Logger.get("MatterController");

export async function computeCompressedNodeId(
    crypto: Crypto,
    fabricId: number | bigint,
    caKey: Bytes,
): Promise<string> {
    return (await GlobalFabricId.compute(crypto, FabricId(fabricId), caKey)).toString();
}

// Storage ID used for the Matter server
const MATTER_SERVER_ID = "server";

export class MatterController {
    #env: Environment;
    #services?: SharedEnvironmentServices;
    #controllerInstance?: CommissioningController;
    #commandHandler?: ControllerCommandHandler;
    #config: ConfigStorage;
    #legacyCommissionedDates?: Map<string, Timestamp>;

    static async create(environment: Environment, config: ConfigStorage, legacyData?: LegacyServerData) {
        const instance = new MatterController(environment, config);

        const commissionedDates = new Map<string, Timestamp>();
        if (legacyData !== undefined) {
            const crypto = environment.get(Crypto);
            const baseStorage = await config.service.open(MATTER_SERVER_ID);
            if (legacyData.credentials && legacyData.fabricId) {
                await LegacyDataInjector.injectCredentials(
                    baseStorage.createContext("credentials"),
                    crypto,
                    legacyData.credentials,
                    legacyData.fabric,
                );
            }
            if (
                (await LegacyDataInjector.injectNodeData(baseStorage, legacyData.nodeData)) &&
                legacyData.nodeData !== undefined
            ) {
                for (const [nodeIdStr, data] of Object.entries(legacyData.nodeData.nodes)) {
                    const { date_commissioned: commissionedAt } = data;
                    commissionedDates.set(nodeIdStr, Timestamp(new Date(commissionedAt).getTime()));
                }
            }
            await baseStorage.close();
        }

        await instance.initialize(legacyData?.vendorId, legacyData?.fabricId, commissionedDates);
        return instance;
    }

    constructor(environment: Environment, config: ConfigStorage) {
        this.#env = environment;
        this.#config = config;
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
                id: MATTER_SERVER_ID,
            },
            autoConnect: false, // Do not auto-connect to the commissioned nodes
            adminFabricLabel: this.#config.fabricLabel,
            adminVendorId: vendorId !== undefined ? VendorId(vendorId) : undefined,
            adminFabricId: fabricId !== undefined ? FabricId(fabricId) : undefined,
            enableOtaProvider: true,
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
            );
        }

        if (this.#legacyCommissionedDates !== undefined) {
            this.#commandHandler.events.started.once(() => this.injectCommissionedDates());
        }

        return this.#commandHandler;
    }

    /**
     * Get the shared environment services instance.
     */
    get services(): SharedEnvironmentServices {
        if (this.#services === undefined) {
            this.#services = this.#env.asDependent();
        }
        return this.#services;
    }

    /**
     * Get the DCL vendor info service instance.
     * Lazily initializes the service if not already present.
     */
    get vendorInfoService(): DclVendorInfoService {
        if (!this.#env.has(DclVendorInfoService)) {
            new DclVendorInfoService(this.#env);
        }
        return this.services.get(DclVendorInfoService);
    }

    /**
     * Get vendor information by vendor ID.
     * Returns undefined if the vendor is not found.
     */
    async getVendorInfo(vendorId: number): Promise<VendorInfo | undefined> {
        await this.vendorInfoService.construction;
        return this.vendorInfoService.infoFor(vendorId);
    }

    /**
     * Get all vendor information from the DCL service.
     */
    async getAllVendors(): Promise<ReadonlyMap<number, VendorInfo>> {
        await this.vendorInfoService.construction;
        return this.vendorInfoService.vendors;
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
                    logger.info(`Injected commissioned date for node ${nodeIdStr}`);
                }
            } catch (error) {
                logger.warn(`Error injecting commissioned date for node ${nodeIdStr}`, error);
            }
        }
    }

    async stop() {
        await this.#commandHandler?.close(); // This closes also the controller instance if started
        await this.#services?.close();
    }

    /**
     * Enable test OTA images (test-net DCL).
     * Must be called after the controller is started.
     */
    async enableTestOtaImages() {
        if (this.#controllerInstance === undefined) {
            throw new Error("Controller not initialized");
        }
        await this.#controllerInstance.node.setStateOf(SoftwareUpdateManager, { allowTestOtaImages: true });
        logger.info("Enabled test OTA images (test-net DCL)");
    }

    /**
     * Store an OTA image file from a file path.
     * @param filePath - Path to the OTA file
     * @param isProduction - Whether this is a production image (default: false for custom files)
     * @returns true if stored successfully
     */
    async storeOtaImageFromFile(filePath: string, isProduction = false): Promise<boolean> {
        const { createReadStream } = await import("node:fs");
        const { pathToFileURL } = await import("node:url");
        const otaService = this.services.get(DclOtaUpdateService);

        // Convert file path to file:// URL for the OTA service
        const fileUrl = pathToFileURL(filePath).href;

        // Read file twice - once for info, once for storage
        const infoStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
        const updateInfo = await otaService.updateInfoFromStream(infoStream, fileUrl);

        logger.info(
            `Storing OTA image from ${filePath}: vendorId=0x${updateInfo.vid.toString(16)}, productId=0x${updateInfo.pid.toString(16)}, version=${updateInfo.softwareVersion} (${updateInfo.softwareVersionString})`,
        );

        const storeStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
        await otaService.store(storeStream, updateInfo, isProduction);
        return true;
    }

    /**
     * Close the services when shutting down.
     */
    async closeServices() {
        await this.#services?.close();
    }
}
