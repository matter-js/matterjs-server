/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, Environment, MockStorageService } from "@matter/general";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    // Reuse the default environment's Crypto service (stateless, safe to share) rather than pull in
    // a platform crypto package this workspace doesn't otherwise depend on.
    env.set(Crypto, Environment.default.get(Crypto));
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
        manager.forgetSession = (nodeId, endpointId, webRtcSessionId) => {
            forgotten.push(`${nodeId}/${endpointId}/${webRtcSessionId}`);
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
            data: { reason: 0 },
        });
        expect(forgotten).to.deep.equal(["5/1/7"]);

        await controller.stop();
    });

    it("keeps the shared callback emitting when one carries an endpoint id out of range", async () => {
        // The emit is shared with every WebSocket connection's signaling observer, and matter.js
        // rethrows an observer error, which aborts the rest of the emit.
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams;
        const forgotten = new Array<number>();
        manager.forgetSession = (_nodeId, _endpointId, webRtcSessionId) => {
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
        expect(forgotten).to.deep.equal([]);

        await controller.stop();
    });

    it("stop() waits for every open camera session to be released before closing connections", async () => {
        const controller = await MatterController.create(freshEnv(), config, {});
        const manager = controller.cameraStreams; // force construction
        const handler = controller.commandHandler; // force construction
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
