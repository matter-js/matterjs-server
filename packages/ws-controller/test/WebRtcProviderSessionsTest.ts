/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebRtcCallbackData } from "@matter-server/ws-client";
import { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import { BasicInformation } from "@matter/main/clusters";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import { AttributeId, ClusterId, Status, StatusResponseError } from "@matter/main/types";
import { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import {
    WebRtcProviderSessions,
    type WebRtcRequestorSessions,
    type WebRtcProviderSessionRequest,
} from "../src/controller/WebRtcProviderSessions.js";
import type { WebRtcSessionKey } from "../src/controller/webRtcSessionStreams.js";
import { ServerError } from "../src/types/WebSocketMessageTypes.js";

type WebRtcSession = WebRtcTransportDefinitions.WebRtcSession;

const CAMERA = NodeId(5);
const OTHER_CAMERA = NodeId(6);
const ENDPOINT = EndpointNumber(1);
const OTHER_ENDPOINT = EndpointNumber(2);
const SERVER = NodeId(100);
const FABRIC = FabricIndex(1);
const OTHER_FABRIC = FabricIndex(2);
const REQUESTOR_ENDPOINT = EndpointNumber(3);

const OFFER = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=recvonly", ""].join("\r\n");
const CAMERA_ANSWER = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=sendrecv", ""].join("\r\n");
const NARROWED = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=sendonly", ""].join("\r\n");
const TURNS = [{ urls: ["turns:turn.example.org"] }];

const CURRENT_SESSIONS = {
    endpointId: ENDPOINT,
    clusterId: WebRtcTransportProvider.id,
    attributeId: WebRtcTransportProvider.attributes.currentSessions.id,
};

function sameKey(a: WebRtcSessionKey, b: WebRtcSessionKey): boolean {
    return a.id === b.id && a.fabricIndex === b.fabricIndex && a.peerNodeId === b.peerNodeId;
}

function trackedSession(overrides: Partial<WebRtcSession> = {}): WebRtcSession {
    return {
        id: 9,
        peerNodeId: CAMERA,
        peerEndpointId: ENDPOINT,
        streamUsage: 3,
        metadataEnabled: false,
        videoStreams: [1],
        fabricIndex: FABRIC,
        ...overrides,
    };
}

interface Fixture {
    sessions: WebRtcProviderSessions;
    events: WebRtcTransportRequestorServer.Events;
    /** The camera's `CurrentSessions` per endpoint. */
    cameraSessions: Map<EndpointNumber, { id: number; peerNodeId: NodeId }[]>;
    requestor: WebRtcSession[];
    /** `command:node/endpoint:fields` per invoke, plus `sync:node`. */
    calls: string[];
    reports: string[];
    callbacks: WebRtcCallbackData[];
    invoke: (command: string) => Promise<unknown>;
}

function fixture(): Fixture {
    const events = new WebRtcTransportRequestorServer.Events();
    const f: Omit<Fixture, "sessions"> = {
        events,
        cameraSessions: new Map([[ENDPOINT, []]]),
        requestor: new Array<WebRtcSession>(),
        calls: new Array<string>(),
        reports: new Array<string>(),
        callbacks: new Array<WebRtcCallbackData>(),
        invoke: async () => ({ webRtcSessionId: 9 }),
    };
    const requestorView: WebRtcRequestorSessions = {
        state: {
            get currentSessions() {
                return f.requestor;
            },
        },
        upsertSession: session => {
            const index = f.requestor.findIndex(tracked => sameKey(tracked, session));
            if (index === -1) f.requestor.push(session);
            else f.requestor[index] = session;
        },
        removeSession: key => {
            f.requestor = f.requestor.filter(tracked => !sameKey(tracked, key));
        },
    };
    const sessions = new WebRtcProviderSessions({
        nodes: {
            localNodeId: () => SERVER,
            providerEndpoints: () => [...f.cameraSessions.keys()],
            currentSessions: (_nodeId, endpointId) => f.cameraSessions.get(endpointId),
            providerRevision: (nodeId, endpointId) => {
                if (!f.cameraSessions.has(endpointId)) throw ServerError.invalidArguments(`no provider on ${nodeId}`);
                return 2;
            },
            invoke: async (nodeId, endpointId, command, fields) => {
                const { sdp: _sdp, ...shown } = fields;
                f.calls.push(`${command}:${nodeId}/${endpointId}:${JSON.stringify(shown)}`);
                return f.invoke(command);
            },
            syncTime: async nodeId => {
                f.calls.push(`sync:${nodeId}`);
            },
            formatNode: nodeId => `${nodeId}`,
        },
        requestor: {
            endpointId: () => REQUESTOR_ENDPOINT,
            sessions: () => f.requestor,
            act: async work => work(requestorView),
        },
        fabricIndex: FABRIC,
        reported: (nodeId, endpointId, present, restarted) => {
            f.reports.push(`${nodeId}/${endpointId} [${[...present].join(",")}] restarted=${restarted}`);
        },
    });
    sessions.attachCallbacks(events, data => f.callbacks.push(data));
    return Object.assign(f, { sessions });
}

/** The first batch end of a run reports and sweeps every provider endpoint; tests about later batches start after it. */
function pastFirstBatch(f: Fixture): void {
    f.sessions.reportCompleted(CAMERA);
    f.reports.length = 0;
}

function offer(overrides: Partial<WebRtcProviderSessionRequest> = {}): WebRtcProviderSessionRequest {
    return {
        nodeId: CAMERA,
        endpointId: ENDPOINT,
        commandName: "ProvideOffer",
        fields: { webRtcSessionId: null, sdp: OFFER, streamUsage: 3, videoStreams: [1] },
        ...overrides,
    };
}

function answerSdp(f: Fixture, session: WebRtcSession): string | undefined {
    f.events.answer.emit(session, CAMERA_ANSWER);
    const event = f.callbacks.at(-1);
    return event?.event_type === "answer" ? event.data?.sdp : undefined;
}

async function flush(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe("WebRtcProviderSessions", () => {
    describe("CurrentSessions watch", () => {
        it("reports a CurrentSessions change at the end of the report batch", () => {
            const f = fixture();
            pastFirstBatch(f);
            f.cameraSessions.set(ENDPOINT, [{ id: 3, peerNodeId: SERVER }]);
            f.requestor.push(trackedSession({ id: 3 }));

            f.sessions.attributeChanged(CAMERA, CURRENT_SESSIONS);
            expect(f.reports).to.deep.equal([]);
            f.sessions.reportCompleted(CAMERA);

            expect(f.reports).to.deep.equal(["5/1 [3] restarted=false"]);
        });

        it("ignores other attributes of the provider and the same attribute id of another cluster", () => {
            const f = fixture();
            pastFirstBatch(f);

            f.sessions.attributeChanged(CAMERA, { ...CURRENT_SESSIONS, attributeId: AttributeId(0xfffd) });
            f.sessions.attributeChanged(CAMERA, { ...CURRENT_SESSIONS, clusterId: ClusterId(0x6) });
            f.sessions.reportCompleted(CAMERA);

            expect(f.reports).to.deep.equal([]);
        });

        it("marks the report as a restart after a StartUp event, and not after another event or another cluster's event", () => {
            const f = fixture();
            pastFirstBatch(f);

            f.sessions.eventTriggered(CAMERA, {
                clusterId: BasicInformation.id,
                eventId: BasicInformation.events.shutDown.id,
            });
            f.sessions.eventTriggered(CAMERA, {
                clusterId: ClusterId(0x6),
                eventId: BasicInformation.events.startUp.id,
            });
            f.sessions.attributeChanged(CAMERA, CURRENT_SESSIONS);
            f.sessions.reportCompleted(CAMERA);
            f.sessions.eventTriggered(CAMERA, {
                clusterId: BasicInformation.id,
                eventId: BasicInformation.events.startUp.id,
            });
            f.sessions.attributeChanged(CAMERA, CURRENT_SESSIONS);
            f.sessions.reportCompleted(CAMERA);

            expect(f.reports).to.deep.equal(["5/1 [] restarted=false", "5/1 [] restarted=true"]);
        });

        it("ends a leftover session with UnknownReason, also when the requestor holds its id for another endpoint or fabric", async () => {
            const f = fixture();
            f.cameraSessions.set(ENDPOINT, [
                { id: 1, peerNodeId: SERVER },
                { id: 2, peerNodeId: SERVER },
                { id: 3, peerNodeId: SERVER },
            ]);
            f.requestor.push(trackedSession({ id: 1 }));
            f.requestor.push(trackedSession({ id: 2, peerEndpointId: OTHER_ENDPOINT }));
            f.requestor.push(trackedSession({ id: 3, fabricIndex: OTHER_FABRIC }));

            f.sessions.reportCompleted(CAMERA);
            await flush();

            const reason = WebRtcTransportDefinitions.WebRtcEndReason.UnknownReason;
            expect(f.calls).to.deep.equal([
                `endSession:5/1:{"webRtcSessionId":2,"reason":${reason}}`,
                `endSession:5/1:{"webRtcSessionId":3,"reason":${reason}}`,
            ]);
        });

        it("waits with the sweep until an offer in flight has its session in the requestor", async () => {
            const f = fixture();
            f.cameraSessions.set(ENDPOINT, [{ id: 9, peerNodeId: SERVER }]);
            let answer = () => {};
            const gate = new Promise<void>(resolve => {
                answer = resolve;
            });
            f.invoke = async () => {
                await gate;
                return { webRtcSessionId: 9 };
            };
            const establishing = f.sessions.establish(offer());

            f.sessions.reportCompleted(CAMERA);
            await flush();
            answer();
            await establishing;
            f.sessions.attributeChanged(CAMERA, CURRENT_SESSIONS);
            f.sessions.reportCompleted(CAMERA);
            await flush();

            expect(f.calls.filter(call => call.startsWith("endSession"))).to.deep.equal([]);
        });

        it("forgets a removed node: drops its requestor sessions and sweeps it anew", async () => {
            const f = fixture();
            f.sessions.reportCompleted(CAMERA);
            f.requestor.push(trackedSession({ id: 1 }));
            f.requestor.push(trackedSession({ id: 2, fabricIndex: OTHER_FABRIC }));
            f.requestor.push(trackedSession({ id: 3, peerNodeId: OTHER_CAMERA }));

            await f.sessions.nodeRemoved(CAMERA);
            f.cameraSessions.set(ENDPOINT, [{ id: 7, peerNodeId: SERVER }]);
            f.sessions.reportCompleted(CAMERA);
            await flush();

            expect(f.requestor.map(session => `${session.peerNodeId}/${session.id}`)).to.deep.equal(["5/2", "6/3"]);
            expect(f.calls.filter(call => call.startsWith('endSession:5/1:{"webRtcSessionId":7'))).to.have.length(1);
        });

        it("drops the offer of a removed node's session", async () => {
            const f = fixture();
            await f.sessions.establish(offer());

            await f.sessions.nodeRemoved(CAMERA);

            expect(answerSdp(f, trackedSession())).to.equal(CAMERA_ANSWER);
        });

        it("sweeps an added endpoint at the next batch end", async () => {
            const f = fixture();
            f.sessions.reportCompleted(CAMERA);
            f.cameraSessions.set(OTHER_ENDPOINT, [{ id: 4, peerNodeId: SERVER }]);

            f.sessions.reportCompleted(CAMERA);
            await flush();
            expect(f.calls).to.deep.equal([]);
            f.sessions.endpointAdded(CAMERA);
            f.sessions.reportCompleted(CAMERA);
            await flush();

            expect(f.calls).to.have.length(1);
            expect(f.calls[0]).to.match(/^endSession:5\/2:\{"webRtcSessionId":4,/);
        });
    });

    describe("establish", () => {
        it("stores the session with the requestor and sends the requestor endpoint as originating endpoint", async () => {
            const f = fixture();

            const response = await f.sessions.establish(offer());

            expect(response.webRtcSessionId).to.equal(9);
            expect(f.calls).to.deep.equal([
                `provideOffer:5/1:{"webRtcSessionId":null,"streamUsage":3,"videoStreams":[1],"originatingEndpointId":3}`,
            ]);
            expect(f.requestor.map(session => [session.id, session.peerEndpointId, session.fabricIndex])).to.deep.equal(
                [[9, ENDPOINT, FABRIC]],
            );
        });

        it("narrows the camera's answer to the offer it sent", async () => {
            const f = fixture();
            await f.sessions.establish(offer());

            expect(answerSdp(f, f.requestor[0])).to.equal(NARROWED);
        });

        it("records the offer under the endpoint it went to", async () => {
            const f = fixture();
            await f.sessions.establish(offer());

            expect(answerSdp(f, trackedSession({ peerEndpointId: OTHER_ENDPOINT }))).to.equal(CAMERA_ANSWER);
        });

        it("drops the offer of a session it no longer tracks", async () => {
            const f = fixture();
            await f.sessions.establish(offer());

            await f.sessions.removeTracked(9, CAMERA, ENDPOINT);

            expect(f.requestor).to.deep.equal([]);
            expect(answerSdp(f, trackedSession())).to.equal(CAMERA_ANSWER);
        });

        it("keeps the requestor's session on another endpoint when removing one", async () => {
            const f = fixture();
            f.requestor.push(trackedSession({ peerEndpointId: OTHER_ENDPOINT }));

            await f.sessions.removeTracked(9, CAMERA, ENDPOINT);

            expect(f.requestor).to.have.length(1);
        });

        it("withdraws a re-offer the requestor does not hold", async () => {
            const f = fixture();
            await f.sessions.establish(offer({ fields: { webRtcSessionId: 9, sdp: OFFER } }));
            f.requestor.push(trackedSession());

            expect(answerSdp(f, trackedSession())).to.equal(CAMERA_ANSWER);
        });

        it("keeps a re-offer of a session the requestor holds", async () => {
            const f = fixture();
            f.requestor.push(trackedSession());
            await f.sessions.establish(offer({ fields: { webRtcSessionId: 9, sdp: OFFER } }));

            expect(answerSdp(f, trackedSession())).to.equal(NARROWED);
        });

        it("keeps the requestor's entry when a re-offer restates other streams", async () => {
            const f = fixture();
            f.requestor.push(trackedSession());

            await f.sessions.establish(
                offer({ fields: { webRtcSessionId: 9, sdp: OFFER, streamUsage: 3, videoStreams: [2] } }),
            );

            expect(f.requestor.map(session => session.videoStreams)).to.deep.equal([[1]]);
        });

        it("sends nothing to an endpoint without a WebRTC provider", async () => {
            const f = fixture();
            let failure: unknown;
            try {
                await f.sessions.establish(offer({ endpointId: OTHER_ENDPOINT }));
            } catch (error) {
                failure = error;
            }

            expect(failure).to.be.instanceOf(ServerError);
            expect(f.calls).to.deep.equal([]);
        });
    });

    describe("clock for a TLS ICE server", () => {
        const newOffer = {
            fields: { webRtcSessionId: null, sdp: OFFER, streamUsage: 3, videoStreams: [1], iceServers: TURNS },
        };

        /** Refuses the first offer as INVALID_IN_STATE, accepts the rest. */
        function refuseFirstOffer(f: Fixture): void {
            let offers = 0;
            f.invoke = async () => {
                if (offers++ === 0) throw new StatusResponseError("no clock", Status.InvalidInState);
                return { webRtcSessionId: 9 };
            };
        }

        it("sends an offer the camera accepts once, with nothing before it", async () => {
            const f = fixture();

            await f.sessions.establish(offer(newOffer));

            expect(f.calls.map(call => call.split(":")[0])).to.deep.equal(["provideOffer"]);
        });

        it("pushes time and sends the offer again after an INVALID_IN_STATE refusal, then tracks the session", async () => {
            const f = fixture();
            refuseFirstOffer(f);

            await f.sessions.establish(offer(newOffer));

            expect(f.calls.map(call => call.split(":")[0])).to.deep.equal(["provideOffer", "sync", "provideOffer"]);
            expect(f.requestor.map(session => session.id)).to.deep.equal([9]);
        });

        it("does the same for a SolicitOffer", async () => {
            const f = fixture();
            refuseFirstOffer(f);

            await f.sessions.establish(
                offer({
                    commandName: "SolicitOffer",
                    fields: { streamUsage: 3, videoStreams: [1], iceServers: TURNS },
                }),
            );

            expect(f.calls.map(call => call.split(":")[0])).to.deep.equal(["solicitOffer", "sync", "solicitOffer"]);
        });

        it("does not retry a re-offer", async () => {
            const f = fixture();
            refuseFirstOffer(f);

            let failure: unknown;
            try {
                await f.sessions.establish(offer({ fields: { webRtcSessionId: 9, sdp: OFFER, iceServers: TURNS } }));
            } catch (error) {
                failure = error;
            }

            expect(failure).to.be.instanceOf(StatusResponseError);
            expect(f.calls.map(call => call.split(":")[0])).to.deep.equal(["provideOffer"]);
        });
    });

    describe("abandon", () => {
        it("stops tracking the session and ends it at the next batch end if the camera still lists it", async () => {
            const f = fixture();
            f.sessions.reportCompleted(CAMERA);
            await f.sessions.establish(offer());
            f.cameraSessions.set(ENDPOINT, [{ id: 9, peerNodeId: SERVER }]);
            f.calls.length = 0;

            await f.sessions.abandon(9, CAMERA, ENDPOINT);
            f.sessions.reportCompleted(CAMERA);
            await flush();

            expect(f.requestor).to.deep.equal([]);
            expect(f.calls).to.have.length(1);
            expect(f.calls[0]).to.match(/^endSession:5\/1:\{"webRtcSessionId":9,/);
        });
    });
});
