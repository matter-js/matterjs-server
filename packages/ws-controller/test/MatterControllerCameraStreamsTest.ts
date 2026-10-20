/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, Entropy, Environment, MockStorageService, Network, NetworkSimulator } from "@matter/general";
import { EndpointNumber, NodeId } from "@matter/main";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

const simulator = new NetworkSimulator();
let hostIndex = 0;

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    // Crypto is stateless, so the default environment's instance is safe to share.
    const crypto = Environment.default.get(Crypto);
    env.set(Entropy, crypto);
    env.set(Crypto, crypto);
    env.set(Network, simulator.addHost(++hostIndex));
    // stop() waits for an in-flight DCL download, so a real DCL makes the test as slow as the internet.
    env.vars.set("dcl.productionurl", "http://127.0.0.1:1/");
    env.vars.set("dcl.testurl", "http://127.0.0.1:1/");
    env.vars.set("dcl.fetchgithubcertificates", false);
    return env;
}

describe("MatterController.cameraStreamsIfCreated", () => {
    let config: ConfigStorage;

    beforeEach(async () => {
        config = await ConfigStorage.create(freshEnv());
    });

    it("is undefined until cameraStreams is first accessed", () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        expect(controller.cameraStreamsIfCreated).to.equal(undefined);
    });

    it("does not throw once the controller is stopped if cameraStreams was never accessed", async () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        await controller.stop();
        expect(controller.cameraStreamsIfCreated).to.equal(undefined);
    });

    it("the cameraStreams getter itself still fails typed once stopped", async () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        await controller.stop();
        const readCameraStreams = () => controller.cameraStreams;
        let thrown: unknown;
        try {
            readCameraStreams();
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
    });

    it("the cameraStreams getter fails typed on a controller that was never started", () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        const readCameraStreams = () => controller.cameraStreams;
        let thrown: unknown;
        try {
            readCameraStreams();
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
    });

    it("fails typed on every getter that needs a started controller", async () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        let thrown: unknown;
        try {
            await controller.vendorInfoService();
        } catch (error) {
            thrown = error;
        }
        expect(thrown).to.be.instanceOf(ServerError);
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
    });

    it("drops the camera registry entry when the peer ends a session", async () => {
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams;
        const forgotten = new Array<string>();
        manager.endedByPeer = (nodeId, endpointId, webRtcSessionId, reason) => {
            forgotten.push(`${nodeId}/${endpointId}/${webRtcSessionId} reason ${reason}`);
            return true;
        };

        controller.commandHandler.events.webRtcCallback.emit({
            event_type: "answer",
            webrtc_session_id: 7,
            node_id: 5n,
            endpoint_id: 1,
            fabric_index: 1,
            data: { sdp: "v=0" },
        });
        expect(forgotten).to.deep.equal([]);

        controller.commandHandler.events.webRtcCallback.emit({
            event_type: "end",
            webrtc_session_id: 7,
            node_id: 5n,
            endpoint_id: 1,
            fabric_index: 1,
            data: { reason: 9 },
        });
        // Observers behind this one still need the entry to find the session's owner, so the drop runs after the emit.
        expect(forgotten).to.deep.equal([]);
        await Promise.resolve();
        expect(forgotten).to.deep.equal(["5/1/7 reason 9"]);

        await controller.stop();
    });

    it("keeps the shared callback emitting when one carries an endpoint id out of range", async () => {
        // matter.js rethrows an observer error, which would abort the shared emit for every other connection.
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams;
        const forgotten = new Array<number>();
        manager.endedByPeer = (_nodeId, _endpointId, webRtcSessionId) => {
            forgotten.push(webRtcSessionId);
            return true;
        };
        const reached = new Array<string>();
        controller.commandHandler.events.webRtcCallback.on(data => {
            reached.push(data.event_type);
        });

        controller.commandHandler.events.webRtcCallback.emit({
            event_type: "end",
            webrtc_session_id: 7,
            node_id: 5n,
            endpoint_id: 70000,
            fabric_index: 1,
            data: { reason: 0 },
        });

        expect(reached).to.deep.equal(["end"]);
        await Promise.resolve();
        expect(forgotten).to.deep.equal([]);

        await controller.stop();
    });

    it("applies a camera's session report and drops the requestor tracking of each session that vanished", async () => {
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams;
        const handler = controller.commandHandler;
        const reports = new Array<string>();
        manager.sessionsReported = (nodeId, endpointId, present, restarted) => {
            reports.push(`${nodeId}/${endpointId} [${[...present].join(",")}] restarted=${restarted}`);
            manager.events.sessionVanished.emit({
                webRtcSessionId: 7,
                nodeId,
                endpointId,
                connectionId: "conn-1",
                videoStreamIds: new Array<number>(),
                audioStreamIds: new Array<number>(),
            });
        };
        const dropped = new Array<string>();
        handler.removeTrackedWebRtcSession = async (webRtcSessionId, nodeId, endpointId) => {
            dropped.push(`${nodeId}/${endpointId}/${webRtcSessionId}`);
        };

        handler.events.webRtcProviderSessionsReported.emit(NodeId(5), EndpointNumber(1), new Set([3]), true);

        expect(reports).to.deep.equal(["5/1 [3] restarted=true"]);
        expect(dropped).to.deep.equal(["5/1/7"]);
        await controller.stop();
    });

    it("drops the camera sessions of a node removed from the fabric", async () => {
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams;
        const removed = new Array<NodeId>();
        manager.nodeRemoved = nodeId => {
            removed.push(nodeId);
        };

        controller.commandHandler.events.nodeDecommissioned.emit(NodeId(5));

        expect(removed).to.deep.equal([NodeId(5)]);
        await controller.stop();
    });

    it("stop() waits for every open camera session to be released before closing connections", async () => {
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams;
        const handler = controller.commandHandler;
        const order = new Array<string>();
        manager.stopAll = async () => {
            order.push("stopAll entered");
            // EndSession needs the connection close() tears down, so the release finishes first.
            await Promise.resolve();
            order.push("stopAll returned");
        };
        const originalClose = handler.close.bind(handler);
        handler.close = async () => {
            order.push("close");
            return originalClose();
        };

        await controller.stop();

        expect(order).to.deep.equal(["stopAll entered", "stopAll returned", "close"]);
    });
});
