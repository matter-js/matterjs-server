/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Crypto,
    Entropy,
    Environment,
    MemoryStorageDriver,
    MockCrypto,
    MockStorageService,
    Network,
    NetworkSimulator,
    Seconds,
    SupportedStorageTypes,
    Time,
} from "@matter/general";
import { Endpoint, EndpointNumber, FabricIndex, NodeId, ServerNode } from "@matter/main";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import { Status, StatusResponseError, StreamUsage } from "@matter/main/types";
import { TimeSynchronizationServer } from "@matter/node/behaviors/time-synchronization";
import { WebRtcTransportProviderServer } from "@matter/node/behaviors/web-rtc-transport-provider";
import { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { deviceStatusOf } from "../src/camera/deviceStatus.js";
import { ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { ControllerNode, createControllerNode } from "../src/controller/ControllerNode.js";
import { usesTlsIceServer } from "../src/controller/iceServerClock.js";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

const NODE_ID = NodeId(42n);
const CAMERA_ENDPOINT = EndpointNumber(1);

const deviceLog = new Array<string>();

/** The simulated camera's refusals: §11.5.6.3.12 for a null UTCTime, and INVALID_IN_STATE for every offer. */
const cameraState = { clockSet: true, refuseEveryOffer: false };

class RecordingTimeSynchronizationServer extends TimeSynchronizationServer {
    override setUtcTime() {
        deviceLog.push("setUtcTime");
        cameraState.clockSet = true;
    }
}

class RecordingWebRtcProviderServer extends WebRtcTransportProviderServer {
    override provideOffer(request: WebRtcTransportProvider.ProvideOfferRequest) {
        const refused =
            cameraState.refuseEveryOffer ||
            (request.webRtcSessionId === null && !cameraState.clockSet && usesTlsIceServer(request.iceServers));
        deviceLog.push(`provideOffer:${request.webRtcSessionId}${refused ? " refused" : ""}`);
        if (refused) throw new StatusResponseError("refused", Status.InvalidInState);
        return { webRtcSessionId: 11 };
    }

    override endSession(request: WebRtcTransportProvider.EndSessionRequest) {
        deviceLog.push(`endSession:${request.webRtcSessionId}`);
    }
}

const CameraEndpoint = OnOffLightDevice.with(RecordingWebRtcProviderServer);

describe("WebRTC provider sessions against a simulated camera", () => {
    let simulator: NetworkSimulator;
    let storage: Record<string, Record<string, Record<string, SupportedStorageTypes>>>;
    let nextHost: number;
    let device: ServerNode;
    let camera: Endpoint<typeof CameraEndpoint>;
    let deviceCrypto: MockCrypto;
    let stop: (() => Promise<void>) | undefined;

    function environment(id: string) {
        const index = nextHost++;
        const env = new Environment(`${id}-${index}`);
        const crypto = MockCrypto(index);
        env.set(Entropy, crypto);
        env.set(Crypto, crypto);
        env.set(Network, simulator.addHost(index));
        storage[id] ??= {};
        const record = storage[id];
        new MockStorageService(env, () => new MemoryStorageDriver(record));
        env.vars.set("dcl.productionurl", "http://127.0.0.1:1/");
        env.vars.set("dcl.testurl", "http://127.0.0.1:1/");
        env.vars.set("dcl.fetchgithubcertificates", false);
        return { env, crypto };
    }

    beforeEach(async () => {
        MockTime.reset();
        simulator = new NetworkSimulator();
        storage = {};
        nextHost = 1;
        deviceLog.length = 0;
        cameraState.clockSet = true;
        cameraState.refuseEveryOffer = false;
        stop = undefined;

        const { env, crypto } = environment("device");
        deviceCrypto = crypto;
        device = new ServerNode(ServerNode.RootEndpoint.with(RecordingTimeSynchronizationServer), {
            id: "device",
            environment: env,
            // The WebRTC provider's offer commands are large messages, which travel over TCP only.
            network: { tcp: true },
        });
        camera = await device.add(CameraEndpoint, { id: "camera" });
        await device.start();
    });

    afterEach(async () => {
        await stop?.();
        await MockTime.resolve(device.close(), { macrotasks: true });
    });

    async function settle() {
        await MockTime.resolve(Time.sleep("settle", Seconds(60)), { macrotasks: true });
    }

    async function startHandler(): Promise<{ handler: ControllerCommandHandler; resources: ControllerNode }> {
        const { env, crypto } = environment("controller");
        const resources = await createControllerNode({
            environment: env,
            id: "controller",
            adminFabricLabel: "TestFabric",
            serverVersion: "1.0.0",
            enableOtaProvider: false,
            peerSettingsRepair: { hasRepairedPeerSettings: () => true, markPeerSettingsRepaired: async () => {} },
            disableAutoSubscription: false,
        });
        const handler = new ControllerCommandHandler(resources, {
            bleEnabled: false,
            bleProxyEnabled: false,
            otaEnabled: false,
        });
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        stop = async () => {
            stop = undefined;
            await MockTime.resolve(handler.close(), { macrotasks: true });
            await MockTime.resolve(resources.close(), { macrotasks: true });
        };
        await commission(handler, crypto);
        return { handler, resources };
    }

    async function commission(handler: ControllerCommandHandler, crypto: MockCrypto) {
        // Session ids collide without entropy while pairing.
        crypto.entropic = deviceCrypto.entropic = true;
        try {
            const { passcode, discriminator } = device.state.commissioning;
            await MockTime.resolve(
                handler.commissionNode({ nodeId: NODE_ID, passcode, longDiscriminator: discriminator }),
                { macrotasks: true },
            );
        } finally {
            crypto.entropic = deviceCrypto.entropic = false;
        }
        await settle();
    }

    function recordReports(handler: ControllerCommandHandler): string[] {
        const reports = new Array<string>();
        handler.events.webRtcProviderSessionsReported.on((nodeId, endpointId, present, restarted) => {
            reports.push(`${nodeId}/${endpointId} [${[...present].join(",")}] restarted=${restarted}`);
        });
        return reports;
    }

    function newOffer() {
        return {
            nodeId: NODE_ID,
            endpointId: CAMERA_ENDPOINT,
            commandName: "ProvideOffer" as const,
            fields: { webRtcSessionId: null, sdp: "v=0", streamUsage: StreamUsage.LiveView, videoStreams: [1] },
        };
    }

    function cameraSession(id: number, peerNodeId: NodeId) {
        return {
            id,
            peerNodeId,
            peerEndpointId: EndpointNumber(1),
            streamUsage: StreamUsage.LiveView,
            videoStreams: [1],
            metadataEnabled: false,
            fabricIndex: FabricIndex(1),
        };
    }

    it("reports the camera's CurrentSessions change at the end of the report", async () => {
        const { handler } = await startHandler();
        const reports = recordReports(handler);

        await camera.set({ webRtcTransportProvider: { currentSessions: [cameraSession(3, handler.localNodeId)] } });
        await settle();

        expect(reports).to.deep.equal(["42/1 [3] restarted=false"]);
    });

    it("marks the report as a restart when the camera reported StartUp in the same report", async () => {
        const { handler } = await startHandler();
        const reports = recordReports(handler);

        await device.act(agent => {
            agent.basicInformation.events.startUp.emit({ softwareVersion: 1 }, agent.context);
        });
        await camera.set({ webRtcTransportProvider: { currentSessions: [cameraSession(3, handler.localNodeId)] } });
        await settle();

        expect(reports).to.deep.equal(["42/1 [3] restarted=true"]);
    });

    it("ends the sessions the camera holds for this server from an earlier run at the first report", async () => {
        const first = await startHandler();
        const localNodeId = first.handler.localNodeId;
        await camera.set({
            webRtcTransportProvider: {
                currentSessions: [cameraSession(3, localNodeId), cameraSession(4, NodeId(999))],
            },
        });
        await settle();
        expect(deviceLog).to.deep.equal([]);
        await stop?.();

        const { env } = environment("controller");
        const resources = await createControllerNode({
            environment: env,
            id: "controller",
            adminFabricLabel: "TestFabric",
            serverVersion: "1.0.0",
            enableOtaProvider: false,
            peerSettingsRepair: { hasRepairedPeerSettings: () => true, markPeerSettingsRepaired: async () => {} },
            disableAutoSubscription: false,
        });
        const handler = new ControllerCommandHandler(resources, {
            bleEnabled: false,
            bleProxyEnabled: false,
            otaEnabled: false,
        });
        stop = async () => {
            stop = undefined;
            await MockTime.resolve(handler.close(), { macrotasks: true });
            await MockTime.resolve(resources.close(), { macrotasks: true });
        };
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await settle();

        expect(deviceLog).to.deep.equal(["endSession:3"]);
    });

    it("relays the camera's answer narrowed to the offer this server sent", async () => {
        const { handler, resources } = await startHandler();
        const answers = new Array<string>();
        handler.events.webRtcCallback.on(data => {
            if (data.event_type === "answer" && data.data !== null) answers.push(data.data.sdp);
        });
        const offerSdp = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=recvonly", ""].join("\r\n");
        await MockTime.resolve(
            handler.invokeWebRtcProviderCommand({ ...newOffer(), fields: { ...newOffer().fields, sdp: offerSdp } }),
            { macrotasks: true },
        );

        await resources.webRtcRequestor.act(agent => {
            const requestor = agent.get(WebRtcTransportRequestorServer);
            requestor.events.answer.emit(requestor.state.currentSessions[0], offerSdp.replace("recvonly", "sendrecv"));
        });

        expect(answers).to.deep.equal([offerSdp.replace("recvonly", "sendonly")]);
    });

    it("drops the requestor's sessions of a removed node", async () => {
        const { handler, resources } = await startHandler();
        await MockTime.resolve(handler.invokeWebRtcProviderCommand(newOffer()), { macrotasks: true });
        const tracked = () => resources.webRtcRequestor.stateOf(WebRtcTransportRequestorServer).currentSessions;
        expect(tracked().map(session => session.id)).to.deep.equal([11]);

        await MockTime.resolve(handler.decommissionNode(NODE_ID), { macrotasks: true });
        await settle();

        expect(tracked()).to.deep.equal([]);
    });

    it("ends a leftover session on a camera endpoint the node adds later", async () => {
        const { handler } = await startHandler();
        const added = await device.add(CameraEndpoint, { id: "camera2" });
        await added.set({ webRtcTransportProvider: { currentSessions: [cameraSession(8, handler.localNodeId)] } });
        await settle();

        expect(deviceLog).to.deep.equal(["endSession:8"]);
    });

    describe("clock for an offer with a turns: ICE server", () => {
        const offer = (webRtcSessionId: number | null) => ({
            nodeId: NODE_ID,
            endpointId: CAMERA_ENDPOINT,
            commandName: "ProvideOffer" as const,
            fields: {
                webRtcSessionId,
                sdp: "v=0",
                streamUsage: StreamUsage.LiveView,
                videoStreams: [1],
                iceServers: [{ urls: ["turns:turn.example.org"] }],
            },
        });

        async function send(handler: ControllerCommandHandler, webRtcSessionId: number | null): Promise<unknown> {
            try {
                await MockTime.resolve(handler.invokeWebRtcProviderCommand(offer(webRtcSessionId)), {
                    macrotasks: true,
                });
                return undefined;
            } catch (error) {
                return error;
            }
        }

        it("pushes time and sends the offer again when the camera refuses it for its missing clock", async () => {
            const { handler, resources } = await startHandler();
            cameraState.clockSet = false;
            deviceLog.length = 0;

            expect(await send(handler, null)).to.equal(undefined);

            expect(deviceLog).to.deep.equal(["provideOffer:null refused", "setUtcTime", "provideOffer:null"]);
            const tracked = resources.webRtcRequestor.stateOf(WebRtcTransportRequestorServer).currentSessions;
            expect(tracked.map(session => session.id)).to.deep.equal([11]);
        });

        it("sends an offer the camera accepts once, with no request before it", async () => {
            const { handler } = await startHandler();
            deviceLog.length = 0;

            expect(await send(handler, null)).to.equal(undefined);

            expect(deviceLog).to.deep.equal(["provideOffer:null"]);
        });

        it("hands the camera's second INVALID_IN_STATE refusal to the caller", async () => {
            const { handler } = await startHandler();
            cameraState.refuseEveryOffer = true;
            deviceLog.length = 0;

            const failure = await send(handler, null);

            expect(deviceStatusOf(failure)).to.equal(Status.InvalidInState);
            expect(deviceLog).to.deep.equal(["provideOffer:null refused", "setUtcTime", "provideOffer:null refused"]);
        });

        it("does not retry a re-offer", async () => {
            const { handler } = await startHandler();
            cameraState.refuseEveryOffer = true;
            deviceLog.length = 0;

            const failure = await send(handler, 11);

            expect(deviceStatusOf(failure)).to.equal(Status.InvalidInState);
            expect(deviceLog).to.deep.equal(["provideOffer:11 refused"]);
        });
    });

    it("hands a camera's session report to the camera manager", async () => {
        const { env, crypto } = environment("controller");
        const config = await ConfigStorage.create(env);
        const controller = await MatterController.create(env, config, {
            serverId: "controller",
            disableThreadDiagnostics: true,
            enableTestNetDcl: true,
            dclOffline: true,
        });
        stop = async () => {
            stop = undefined;
            await MockTime.resolve(controller.stop(), { macrotasks: true });
        };
        const handler = controller.commandHandler;
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await commission(handler, crypto);
        const manager = controller.cameraStreams;
        const reports = new Array<string>();
        const original = manager.sessionsReported.bind(manager);
        manager.sessionsReported = (nodeId, endpointId, present, restarted) => {
            reports.push(`${nodeId}/${endpointId} [${[...present].join(",")}] restarted=${restarted}`);
            return original(nodeId, endpointId, present, restarted);
        };

        await camera.set({ webRtcTransportProvider: { currentSessions: [cameraSession(5, handler.localNodeId)] } });
        await settle();

        expect(reports).to.deep.equal(["42/1 [5] restarted=false"]);
    });
});
