/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import type { CameraSessionEnded, ManagedSession } from "../src/camera/cameraTypes.js";
import { CameraSessionRegistry } from "../src/camera/sessionRegistry.js";

const NODE = NodeId(5);
const ENDPOINT = EndpointNumber(1);
const OTHER_NODE = NodeId(6);
const OTHER_ENDPOINT = EndpointNumber(2);

function sessionOf(
    webRtcSessionId: number,
    connectionId: string,
    clientSessionKey?: string,
    nodeId: NodeId = NODE,
    endpointId: EndpointNumber = ENDPOINT,
): ManagedSession {
    return {
        webRtcSessionId,
        nodeId,
        endpointId,
        connectionId,
        ...(clientSessionKey === undefined ? {} : { clientSessionKey }),
        videoStreamIds: [],
        audioStreamIds: [],
    };
}

describe("CameraSessionRegistry client session keys", () => {
    it("finds the tracked entry, not its registration, between track and finish", () => {
        const registry = new CameraSessionRegistry(
            () => {},
            () => {},
        );
        const pending = registry.begin(NODE, ENDPOINT, "conn-1", "key-a");
        registry.establishing(pending, 42);
        const session = sessionOf(42, "conn-1", "key-a");
        expect(registry.track(pending, session)).to.equal(undefined);

        expect(registry.byClientKey(NODE, ENDPOINT, "conn-1", "key-a")).to.deep.equal({ session });
        registry.finish(pending);
        expect(registry.byClientKey(NODE, ENDPOINT, "conn-1", "key-a")).to.deep.equal({ session });
    });

    it("keeps a release claim when the owner also stops the start", async () => {
        const registry = new CameraSessionRegistry(
            () => {},
            () => {},
        );
        const pending = registry.begin(NODE, ENDPOINT, "conn-1", "key-a");
        const claimed = registry.claim(() => true);
        const stopped = registry.cancel(pending);

        expect(registry.claimRefusal(pending)).to.equal("claimed");
        registry.finish(pending);
        await Promise.all(claimed.starting);
        expect(await stopped).to.equal(false);
    });

    it("answers with the EndSession outcome of the cancelled start once it finished", async () => {
        const registry = new CameraSessionRegistry(
            () => {},
            () => {},
        );
        const pending = registry.begin(NODE, ENDPOINT, "conn-1", "key-a");
        const stopped = registry.cancel(pending);
        registry.establishing(pending, 42);

        expect(registry.track(pending, sessionOf(42, "conn-1", "key-a"))).to.equal("stopped");
        registry.ending(pending, Promise.resolve(true));
        registry.finish(pending);
        expect(await stopped).to.equal(true);
        expect(registry.clientSessionKeyInUse("conn-1", "key-a")).to.equal(false);
    });

    it("answers false for a cancelled start that ended no session", async () => {
        const registry = new CameraSessionRegistry(
            () => {},
            () => {},
        );
        const pending = registry.begin(NODE, ENDPOINT, "conn-1", "key-a");
        const stopped = registry.cancel(pending);
        registry.establishing(pending, 42);
        registry.finish(pending);
        expect(await stopped).to.equal(false);
    });

    it("announces a reissued id's old entry with the old key", () => {
        const announced = new Array<CameraSessionEnded>();
        const registry = new CameraSessionRegistry(
            ended => announced.push(ended),
            () => {},
        );
        const old = registry.begin(NODE, ENDPOINT, "conn-1", "key-old");
        registry.establishing(old, 42);
        registry.track(old, sessionOf(42, "conn-1", "key-old"));
        registry.finish(old);

        const next = registry.begin(NODE, ENDPOINT, "conn-1", "key-new");
        registry.establishing(next, 42);

        expect(announced.map(ended => [ended.cause, ended.clientSessionKey])).to.deep.equal([
            ["camera_restarted", "key-old"],
        ]);
        expect(registry.signallingOwner(NODE, ENDPOINT, 42)).to.deep.equal({
            connectionId: "conn-1",
            clientSessionKey: "key-new",
        });
    });

    it("finds a key only on the node and endpoint it was used on", () => {
        const registry = new CameraSessionRegistry(
            () => {},
            () => {},
        );
        const pending = registry.begin(NODE, ENDPOINT, "conn-1", "key-a");
        expect(registry.byClientKey(NODE, ENDPOINT, "conn-1", "key-a")).to.deep.equal({ pending });
        expect(registry.byClientKey(OTHER_NODE, ENDPOINT, "conn-1", "key-a")).to.equal(undefined);
        expect(registry.byClientKey(NODE, OTHER_ENDPOINT, "conn-1", "key-a")).to.equal(undefined);

        registry.establishing(pending, 42);
        const session = sessionOf(42, "conn-1", "key-a");
        registry.track(pending, session);
        expect(registry.byClientKey(NODE, ENDPOINT, "conn-1", "key-a")).to.deep.equal({ session });
        expect(registry.byClientKey(OTHER_NODE, ENDPOINT, "conn-1", "key-a")).to.equal(undefined);
        expect(registry.byClientKey(NODE, OTHER_ENDPOINT, "conn-1", "key-a")).to.equal(undefined);
    });

    it("refuses a claim check for a registration that is already finished", () => {
        const registry = new CameraSessionRegistry(
            () => {},
            () => {},
        );
        const pending = registry.begin(NODE, ENDPOINT, "conn-1");
        expect(registry.claimRefusal(pending)).to.equal(undefined);
        registry.finish(pending);
        expect(registry.claimRefusal(pending)).to.equal("claimed");
    });

    describe("an id issued to another route", () => {
        it("supersedes the registration holding the id on the same node and endpoint", () => {
            const registry = new CameraSessionRegistry(
                () => {},
                () => {},
            );
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.issued(NODE, ENDPOINT, 42);
            expect(registry.signallingOwner(NODE, ENDPOINT, 42)).to.equal(undefined);
            expect(registry.track(waiting, sessionOf(42, "conn-1"))).to.equal("superseded");
        });

        it("keeps a superseded registration superseded when it is also claimed, ended by peer or report, or its node removed", async () => {
            const registry = new CameraSessionRegistry(
                () => {},
                () => {},
            );
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.issued(NODE, ENDPOINT, 42);
            registry.peerEnded(NODE, ENDPOINT, 42);
            registry.reconcile(NODE, ENDPOINT, new Set<number>(), "camera_dropped");
            registry.forgetNode(NODE);
            const claimed = registry.claim(() => true);
            expect(registry.track(waiting, sessionOf(42, "conn-1"))).to.equal("superseded");
            registry.finish(waiting);
            await Promise.all(claimed.starting);
        });

        it("leaves a registration on another endpoint holding the same id", () => {
            const registry = new CameraSessionRegistry(
                () => {},
                () => {},
            );
            const waiting = registry.begin(NODE, OTHER_ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.issued(NODE, ENDPOINT, 42);
            expect(registry.track(waiting, sessionOf(42, "conn-1", undefined, NODE, OTHER_ENDPOINT))).to.equal(
                undefined,
            );
        });

        it("leaves a registration on another node holding the same id", () => {
            const registry = new CameraSessionRegistry(
                () => {},
                () => {},
            );
            const waiting = registry.begin(OTHER_NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.issued(NODE, ENDPOINT, 42);
            expect(registry.track(waiting, sessionOf(42, "conn-1", undefined, OTHER_NODE, ENDPOINT))).to.equal(
                undefined,
            );
        });
    });

    describe("a CurrentSessions report during establishment", () => {
        function vanishingRegistry(): { registry: CameraSessionRegistry; vanished: number[] } {
            const vanished = new Array<number>();
            const registry = new CameraSessionRegistry(
                () => {},
                session => vanished.push(session.webRtcSessionId),
            );
            return { registry, vanished };
        }

        it("counts a listing between establishing and track, so a later report without the id ends it", () => {
            const { registry, vanished } = vanishingRegistry();
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.reconcile(NODE, ENDPOINT, new Set([42]), "camera_dropped");
            registry.track(waiting, sessionOf(42, "conn-1"));
            expect(vanished).to.deep.equal([]);

            registry.reconcile(NODE, ENDPOINT, new Set<number>(), "camera_dropped");
            expect(vanished).to.deep.equal([42]);
        });

        it("ignores a listing on another endpoint or node", () => {
            const { registry, vanished } = vanishingRegistry();
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.reconcile(NODE, OTHER_ENDPOINT, new Set([42]), "camera_dropped");
            registry.reconcile(OTHER_NODE, ENDPOINT, new Set([42]), "camera_dropped");
            registry.track(waiting, sessionOf(42, "conn-1"));

            registry.reconcile(NODE, ENDPOINT, new Set<number>(), "camera_dropped");
            expect(vanished).to.deep.equal([]);
        });

        it("ignores a listing before the camera gave the registration its id", () => {
            const { registry, vanished } = vanishingRegistry();
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.reconcile(NODE, ENDPOINT, new Set([42]), "camera_dropped");
            registry.establishing(waiting, 42);
            registry.track(waiting, sessionOf(42, "conn-1"));

            registry.reconcile(NODE, ENDPOINT, new Set<number>(), "camera_dropped");
            expect(vanished).to.deep.equal([]);
        });

        it("refuses to track a registration a report listed and a later one no longer did", () => {
            const { registry } = vanishingRegistry();
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.reconcile(NODE, ENDPOINT, new Set([42]), "camera_dropped");
            registry.reconcile(NODE, ENDPOINT, new Set<number>(), "camera_dropped");

            expect(registry.track(waiting, sessionOf(42, "conn-1"))).to.equal("already_ended");
            expect(registry.get(NODE, ENDPOINT, 42)).to.equal(undefined);
        });

        it("keeps superseded ahead of an end a report recorded", () => {
            const { registry } = vanishingRegistry();
            const waiting = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(waiting, 42);
            registry.reconcile(NODE, ENDPOINT, new Set([42]), "camera_dropped");
            registry.reconcile(NODE, ENDPOINT, new Set<number>(), "camera_dropped");
            registry.issued(NODE, ENDPOINT, 42);

            expect(registry.track(waiting, sessionOf(42, "conn-1"))).to.equal("superseded");
        });
    });

    describe("forgetNode", () => {
        it("ends the registrations of the removed node only", () => {
            const registry = new CameraSessionRegistry(
                () => {},
                () => {},
            );
            const removed = registry.begin(NODE, ENDPOINT, "conn-1");
            registry.establishing(removed, 42);
            const kept = registry.begin(OTHER_NODE, ENDPOINT, "conn-1");
            registry.establishing(kept, 43);

            registry.forgetNode(NODE);

            expect(registry.track(removed, sessionOf(42, "conn-1"))).to.equal("already_ended");
            expect(registry.track(kept, sessionOf(43, "conn-1", undefined, OTHER_NODE, ENDPOINT))).to.equal(undefined);
        });
    });
});
