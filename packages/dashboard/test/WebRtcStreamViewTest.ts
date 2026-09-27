/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    type CameraSessionEndedData,
    type CameraStartStreamResult,
    type CameraStreamEvictedData,
    type MatterClient,
    ServerCommandError,
    type WebRtcCallbackData,
} from "@matter-server/ws-client";
import { WebRtcStreamView } from "../src/components/webrtc-stream-view.js";
import { capabilities } from "./CameraFixtures.js";

const NODE_ID = 10;
const ENDPOINT_ID = 5;
const SESSION_ID = 7;

interface FakeCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
}

interface FakeDescription {
    type: string;
    sdp: string;
}

class FakePeerConnection {
    static instances = new Array<FakePeerConnection>();
    /** When set, createOffer waits for it. */
    static offerGate: Promise<void> | null = null;
    transceivers = new Array<string>();
    localDescription: FakeDescription | null = null;
    remoteDescription: FakeDescription | null = null;
    signalingState = "stable";
    connectionState = "new";
    addedCandidates = new Array<FakeCandidate>();
    closed = false;
    onicecandidate: ((ev: { candidate: FakeCandidate | null }) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    ontrack: unknown = null;

    constructor() {
        FakePeerConnection.instances.push(this);
    }

    addTransceiver(kind: string) {
        this.transceivers.push(kind);
    }

    async createOffer(): Promise<FakeDescription> {
        await FakePeerConnection.offerGate;
        return { type: "offer", sdp: "offer-sdp" };
    }

    async createAnswer(): Promise<FakeDescription> {
        return { type: "answer", sdp: "browser-answer-sdp" };
    }

    async setLocalDescription(description: FakeDescription) {
        this.localDescription = description;
        this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
    }

    /** When set, setRemoteDescription stays pending until close(), which rejects it like a browser does. */
    holdRemoteDescription = false;
    #pendingRemote = new Array<(err: Error) => void>();

    async setRemoteDescription(description: FakeDescription) {
        if (this.holdRemoteDescription) {
            await new Promise<void>((_resolve, reject) => this.#pendingRemote.push(reject));
        }
        this.remoteDescription = description;
        this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
    }

    async addIceCandidate(candidate: FakeCandidate) {
        this.addedCandidates.push(candidate);
    }

    close() {
        this.closed = true;
        for (const reject of this.#pendingRemote.splice(0)) reject(new Error("InvalidStateError: closed"));
    }
}

function lastPeer(): FakePeerConnection {
    const pc = FakePeerConnection.instances.at(-1);
    if (!pc) throw new Error("no peer connection was created");
    return pc;
}

type Handler = (args: Record<string, unknown>) => unknown;

interface Call {
    command: string;
    args: Record<string, unknown>;
}

function fakeClient(handlers: Record<string, Handler> = {}) {
    const calls = new Array<Call>();
    const webrtc = new Set<(data: WebRtcCallbackData) => void>();
    const ended = new Set<(data: CameraSessionEndedData) => void>();
    const evicted = new Set<(data: CameraStreamEvictedData) => void>();
    const fake = {
        nodes: {},
        sendCommand: async (command: string, _schema: number | undefined, args: Record<string, unknown>) => {
            calls.push({ command, args });
            const handler = handlers[command];
            return handler ? handler(args) : null;
        },
        addWebRtcCallbackListener: (listener: (data: WebRtcCallbackData) => void) => {
            webrtc.add(listener);
            return () => webrtc.delete(listener);
        },
        addCameraSessionEndedListener: (listener: (data: CameraSessionEndedData) => void) => {
            ended.add(listener);
            return () => ended.delete(listener);
        },
        addCameraStreamEvictedListener: (listener: (data: CameraStreamEvictedData) => void) => {
            evicted.add(listener);
            return () => evicted.delete(listener);
        },
    };
    return {
        // The view only uses the members above; a full MatterClient needs a live connection.
        client: fake as unknown as MatterClient,
        calls,
        commands: () => calls.map(call => call.command),
        emitWebRtc: (data: WebRtcCallbackData) => [...webrtc].forEach(listener => listener(data)),
        emitEnded: (data: CameraSessionEndedData) => [...ended].forEach(listener => listener(data)),
        emitEvicted: (data: CameraStreamEvictedData) => [...evicted].forEach(listener => listener(data)),
        listenerCounts: () => ({ webrtc: webrtc.size, ended: ended.size, evicted: evicted.size }),
    };
}

function startResult(overrides: Partial<CameraStartStreamResult> = {}): CameraStartStreamResult {
    return {
        webrtc_session_id: SESSION_ID,
        mode: "provide_offer",
        video: {
            stream_id: 3,
            codec: "H264",
            resolution: { min: { width: 640, height: 480 }, max: { width: 1280, height: 720 } },
            frame_rate: { min: 15, max: 30 },
            bit_rate: { min: 10000, max: 2000000 },
            provenance: "allocated",
            degraded: false,
            watermark_enabled: false,
            osd_enabled: false,
        },
        audio: {
            stream_id: 4,
            codec: "OPUS",
            channel_count: 1,
            sample_rate: 48000,
            bit_rate: 20000,
            bit_depth: 16,
            provenance: "reused",
        },
        ...overrides,
    };
}

function answerEvent(sessionId = SESSION_ID, nodeId: number | bigint = NODE_ID): WebRtcCallbackData {
    return {
        event_type: "answer",
        webrtc_session_id: sessionId,
        node_id: nodeId,
        endpoint_id: ENDPOINT_ID,
        fabric_index: 1,
        data: { sdp: `answer-${sessionId}` },
    };
}

function createView(client: MatterClient): WebRtcStreamView {
    const view = new WebRtcStreamView();
    view.client = client;
    view.nodeId = NODE_ID;
    view.endpointId = ENDPOINT_ID;
    return view;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (err: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function recordStates(view: WebRtcStreamView) {
    const states = new Array<string>();
    view.addEventListener("streamstate", ev => {
        if (ev instanceof CustomEvent) states.push(ev.detail.state);
    });
    return states;
}

function offerEvent(sessionId = SESSION_ID): WebRtcCallbackData {
    return {
        event_type: "offer",
        webrtc_session_id: sessionId,
        node_id: NODE_ID,
        endpoint_id: ENDPOINT_ID,
        fabric_index: 1,
        data: { sdp: "camera-offer" },
    };
}

function captureConsole(method: "info" | "warn") {
    const original = console[method];
    const messages = new Array<string>();
    console[method] = (...args: unknown[]) => {
        messages.push(String(args[0]));
    };
    return { messages, restore: () => (console[method] = original) };
}

describe("WebRtcStreamView", () => {
    before(() => {
        Object.defineProperty(globalThis, "RTCPeerConnection", {
            value: FakePeerConnection,
            configurable: true,
            writable: true,
        });
    });

    after(() => {
        Reflect.deleteProperty(globalThis, "RTCPeerConnection");
    });

    beforeEach(() => {
        FakePeerConnection.instances = [];
        FakePeerConnection.offerGate = null;
    });

    describe("start", () => {
        it("reports an error state instead of throwing when live view is unsupported", async () => {
            const view = new WebRtcStreamView();
            view.liveViewSupported = false;
            const states = new Array<{ state: string; errorMessage: string | null }>();
            view.addEventListener("streamstate", ev => states.push((ev as CustomEvent).detail));

            await view.start();

            expect(view.state).to.equal("error");
            expect(states).to.deep.equal([
                { state: "error", errorMessage: "Live view is not supported on this device" },
            ]);
        });

        it("reports an error state when the browser cannot create a peer connection", async () => {
            const fake = fakeClient();
            const view = createView(fake.client);
            Object.defineProperty(globalThis, "RTCPeerConnection", {
                value: class {
                    constructor() {
                        throw new Error("WebRTC is disabled");
                    }
                },
                configurable: true,
                writable: true,
            });
            try {
                await view.start();
            } finally {
                Object.defineProperty(globalThis, "RTCPeerConnection", {
                    value: FakePeerConnection,
                    configurable: true,
                    writable: true,
                });
            }

            expect(view.state).to.equal("error");
            expect(fake.calls).to.deep.equal([]);
        });

        it("ignores a second start while one is running", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);

            await Promise.all([view.start(), view.start()]);

            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);
            expect(FakePeerConnection.instances).to.have.length(1);
        });

        it("sends no camera_start_stream when stopped while creating the offer", async () => {
            const gate = deferred<void>();
            FakePeerConnection.offerGate = gate.promise;
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);

            const starting = view.start();
            await settle();
            await view.stop();
            gate.resolve();
            await starting;

            expect(fake.commands()).to.deep.equal([]);
            expect(view.state).to.equal("idle");
        });

        it("opens the session with camera_start_stream and the picked hints", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            view.capabilities = capabilities({ features: ["Video", "Watermark"] });
            view.resolution = { width: 1280, height: 720 };
            view.watermarkEnabled = true;

            await view.start();

            expect(fake.calls[0]).to.deep.equal({
                command: "camera_start_stream",
                args: {
                    node_id: NODE_ID,
                    endpoint_id: ENDPOINT_ID,
                    stream_usage: "LiveView",
                    sdp: "offer-sdp",
                    video: { max_resolution: { width: 1280, height: 720 }, watermark_enabled: true },
                },
            });
            expect(lastPeer().transceivers).to.deep.equal(["video", "audio"]);
            expect(view.videoStreamId).to.equal(3);
        });

        it("leaves video to the server without capabilities, still offering a video track", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult({ video: null }) });
            const view = createView(fake.client);

            await view.start();

            expect(fake.calls[0].args).to.not.have.property("video");
            expect(lastPeer().transceivers).to.deep.equal(["video", "audio"]);
            expect(view.audioOnlySession).to.equal(true);
        });

        it("declines video and offers no video track on an audio-only camera", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult({ video: null }) });
            const view = createView(fake.client);
            view.capabilities = capabilities({ features: ["Audio"] });

            await view.start();

            expect(fake.calls[0].args.video).to.equal(false);
            expect(lastPeer().transceivers).to.deep.equal(["audio"]);
            expect(view.audioOnlySession).to.equal(true);
        });

        it("applies an answer that arrives before the camera_start_stream response", async () => {
            const fake: ReturnType<typeof fakeClient> = fakeClient({
                camera_start_stream: () => {
                    fake.emitWebRtc(answerEvent(SESSION_ID + 1));
                    fake.emitWebRtc(answerEvent(SESSION_ID, 99));
                    fake.emitWebRtc(answerEvent(SESSION_ID, BigInt(NODE_ID)));
                    return startResult();
                },
            });
            const view = createView(fake.client);

            await view.start();

            expect(lastPeer().remoteDescription).to.deep.equal({ type: "answer", sdp: `answer-${SESSION_ID}` });
            expect(view.state).to.equal("streaming");
        });

        it("ignores signalling for another session once the session is known", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitWebRtc(answerEvent(SESSION_ID + 1));
            await settle();
            expect(lastPeer().remoteDescription).to.equal(null);

            fake.emitWebRtc(answerEvent());
            await settle();
            expect(lastPeer().remoteDescription?.sdp).to.equal(`answer-${SESSION_ID}`);
        });

        it("holds local ICE candidates until the session id is known, then sends later ones directly", async () => {
            const early = { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 };
            const late = { candidate: "candidate:2", sdpMid: "0", sdpMLineIndex: 0 };
            const fake = fakeClient({
                camera_start_stream: () => {
                    lastPeer().onicecandidate?.({ candidate: early });
                    return startResult();
                },
            });
            const view = createView(fake.client);

            await view.start();
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_provide_ice_candidates"]);
            expect(fake.calls[1].args).to.deep.equal({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                webrtc_session_id: SESSION_ID,
                ice_candidates: [early],
            });

            lastPeer().onicecandidate?.({ candidate: late });
            await settle();
            expect(fake.calls[2].args.ice_candidates).to.deep.equal([late]);
        });

        it("keeps the session when sending held ICE candidates fails", async () => {
            const fake: ReturnType<typeof fakeClient> = fakeClient({
                camera_start_stream: () => {
                    lastPeer().onicecandidate?.({
                        candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
                    });
                    fake.emitWebRtc(answerEvent());
                    return startResult();
                },
                camera_provide_ice_candidates: () => {
                    throw new Error("send failed");
                },
            });
            const view = createView(fake.client);

            await view.start();
            await settle();

            expect(view.state).to.equal("streaming");
            expect(fake.commands()).to.not.include("camera_stop_stream");
        });

        it("keeps the session when a buffered camera offer cannot be applied", async () => {
            const fake: ReturnType<typeof fakeClient> = fakeClient({
                camera_start_stream: () => {
                    const pc = lastPeer();
                    const applyAnswer = pc.setRemoteDescription.bind(pc);
                    pc.setRemoteDescription = async (description: FakeDescription) => {
                        if (description.type === "offer") throw new Error("bad offer");
                        await applyAnswer(description);
                    };
                    fake.emitWebRtc(answerEvent());
                    fake.emitWebRtc({
                        event_type: "offer",
                        webrtc_session_id: SESSION_ID,
                        node_id: NODE_ID,
                        endpoint_id: ENDPOINT_ID,
                        fabric_index: 1,
                        data: { sdp: "camera-offer" },
                    });
                    return startResult();
                },
            });
            const view = createView(fake.client);

            await view.start();

            expect(view.state).to.equal("streaming");
            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);
        });

        it("adds the camera's ICE candidates to the peer connection", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();
            const candidate = { candidate: "candidate:9", sdpMid: "0", sdpMLineIndex: 0 };

            fake.emitWebRtc({
                event_type: "ice_candidates",
                webrtc_session_id: SESSION_ID,
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                fabric_index: 1,
                data: { ice_candidates: [candidate] },
            });
            await settle();

            expect(lastPeer().addedCandidates).to.deep.equal([candidate]);
        });

        it("answers a camera offer on an established session with camera_provide_answer", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();
            fake.emitWebRtc(answerEvent());
            await settle();

            fake.emitWebRtc({
                event_type: "offer",
                webrtc_session_id: SESSION_ID,
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                fabric_index: 1,
                data: { sdp: "camera-offer" },
            });
            await settle();

            expect(lastPeer().remoteDescription).to.deep.equal({ type: "offer", sdp: "camera-offer" });
            expect(fake.calls.at(-1)).to.deep.equal({
                command: "camera_provide_answer",
                args: {
                    node_id: NODE_ID,
                    endpoint_id: ENDPOINT_ID,
                    webrtc_session_id: SESSION_ID,
                    sdp: "browser-answer-sdp",
                },
            });
        });

        it("ignores a camera offer while its own offer is unanswered", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitWebRtc({
                event_type: "offer",
                webrtc_session_id: SESSION_ID,
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                fabric_index: 1,
                data: { sdp: "camera-offer" },
            });
            await settle();

            expect(lastPeer().remoteDescription).to.equal(null);
            expect(fake.commands()).to.not.include("camera_provide_answer");
        });

        it("ends the session with the error text when a camera re-offer cannot be answered", async () => {
            const fake = fakeClient({
                camera_start_stream: () => startResult(),
                camera_provide_answer: () => {
                    throw new ServerCommandError("Session is gone", 8);
                },
            });
            const view = createView(fake.client);
            await view.start();
            fake.emitWebRtc(answerEvent());
            await settle();

            fake.emitWebRtc(offerEvent());
            await settle();
            await settle();

            expect(view.state).to.equal("error");
            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_provide_answer",
                "camera_stop_stream",
                "camera_release_stream",
            ]);
            expect(lastPeer().closed).to.equal(true);
        });

        it("shows the reason of a camera error as text", async () => {
            const fake = fakeClient({
                camera_start_stream: () => {
                    throw new ServerCommandError(
                        JSON.stringify({
                            message: "Camera does not advertise the feature this request needs",
                            reason: "feature",
                            feature: "Watermark",
                            device: [],
                            requested: [],
                        }),
                        CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
                    );
                },
            });
            const view = createView(fake.client);
            const states = new Array<{ state: string; errorMessage: string | null }>();
            view.addEventListener("streamstate", ev => states.push((ev as CustomEvent).detail));

            await view.start();

            expect(view.state).to.equal("error");
            expect(states.at(-1)?.errorMessage).to.equal(
                "Camera does not advertise the feature this request needs: Watermark",
            );
            expect(lastPeer().closed).to.equal(true);
            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);
        });
    });

    describe("stop", () => {
        it("ends the session, then releases only the streams it allocated", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            await view.stop();

            expect(fake.calls.slice(1)).to.deep.equal([
                {
                    command: "camera_stop_stream",
                    args: { node_id: NODE_ID, endpoint_id: ENDPOINT_ID, webrtc_session_id: SESSION_ID },
                },
                {
                    command: "camera_release_stream",
                    args: { node_id: NODE_ID, endpoint_id: ENDPOINT_ID, kind: "video", stream_id: 3 },
                },
            ]);
            expect(lastPeer().closed).to.equal(true);
            expect(view.state).to.equal("idle");
        });

        it("still releases the next stream when one release fails", async () => {
            const fake = fakeClient({
                camera_start_stream: () =>
                    startResult({
                        audio: {
                            stream_id: 4,
                            codec: "OPUS",
                            channel_count: 1,
                            sample_rate: 48000,
                            bit_rate: 20000,
                            bit_depth: 16,
                            provenance: "allocated",
                        },
                    }),
                camera_release_stream: args => {
                    if (args.kind === "video") throw new Error("in use");
                    return null;
                },
            });
            const view = createView(fake.client);
            await view.start();

            await view.stop();

            expect(
                fake.calls.filter(call => call.command === "camera_release_stream").map(call => call.args.kind),
            ).to.deep.equal(["video", "audio"]);
        });

        it("still releases its streams when camera_stop_stream fails", async () => {
            const fake = fakeClient({
                camera_start_stream: () => startResult(),
                camera_stop_stream: () => {
                    throw new Error("camera offline");
                },
            });
            const view = createView(fake.client);
            await view.start();

            await view.stop();

            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_stop_stream",
                "camera_release_stream",
            ]);
            expect(view.state).to.equal("idle");
        });

        it("logs an expected in-use refusal at info and any other release failure as a warning", async () => {
            const fake = fakeClient({
                camera_start_stream: () =>
                    startResult({
                        audio: {
                            stream_id: 4,
                            codec: "OPUS",
                            channel_count: 1,
                            sample_rate: 48000,
                            bit_rate: 20000,
                            bit_depth: 16,
                            provenance: "allocated",
                        },
                    }),
                camera_release_stream: args => {
                    if (args.kind === "video") {
                        throw new ServerCommandError(
                            JSON.stringify({ message: "in use", stream_id: 3 }),
                            CAMERA_STREAM_IN_USE_ERROR_CODE,
                        );
                    }
                    throw new Error("connection lost");
                },
            });
            const view = createView(fake.client);
            await view.start();
            const info = captureConsole("info");
            const warn = captureConsole("warn");
            try {
                await view.stop();
            } finally {
                info.restore();
                warn.restore();
            }

            expect(info.messages.filter(m => m.includes("not released"))).to.deep.equal([
                "[webrtc-stream-view] video stream 3 not released",
            ]);
            expect(warn.messages.filter(m => m.includes("not released"))).to.deep.equal([
                "[webrtc-stream-view] audio stream 4 not released",
            ]);
        });

        it("a second stop waits for the first one to finish", async () => {
            const stopping = deferred<null>();
            const fake = fakeClient({
                camera_start_stream: () => startResult(),
                camera_stop_stream: () => stopping.promise,
            });
            const view = createView(fake.client);
            await view.start();

            const first = view.stop();
            let secondDone = false;
            const second = view.stop().then(() => (secondDone = true));
            await settle();
            expect(secondDone).to.equal(false);

            stopping.resolve(null);
            await Promise.all([first, second]);
            expect(fake.commands().at(-1)).to.equal("camera_release_stream");
        });

        it("starts again only after a pending stop finished, and that stop leaves the new session alone", async () => {
            const stopping = deferred<null>();
            let nextSession = SESSION_ID;
            const fake = fakeClient({
                camera_start_stream: () => startResult({ webrtc_session_id: nextSession++ }),
                camera_stop_stream: () => stopping.promise,
            });
            const view = createView(fake.client);
            const states = recordStates(view);
            await view.start();
            lastPeer().setRemoteDescription = async () => {
                throw new Error("bad answer");
            };
            fake.emitWebRtc(answerEvent());
            await settle();
            expect(view.state).to.equal("error");
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);

            const retry = view.start();
            await settle();
            expect(view.state).to.equal("connecting");
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);

            stopping.resolve(null);
            await retry;
            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_stop_stream",
                "camera_release_stream",
                "camera_start_stream",
            ]);
            fake.emitWebRtc(answerEvent(SESSION_ID + 1));
            await settle();

            expect(view.state).to.equal("streaming");
            expect(states.slice(-2)).to.deep.equal(["connecting", "streaming"]);
            expect(lastPeer().closed).to.equal(false);
            expect(fake.listenerCounts().webrtc).to.equal(1);
            lastPeer().onicecandidate?.({ candidate: { candidate: "candidate:3", sdpMid: "0", sdpMLineIndex: 0 } });
            await settle();
            expect(fake.calls.at(-1)?.args.webrtc_session_id).to.equal(SESSION_ID + 1);
        });

        it("starts again only after a start stopped in flight has been ended", async () => {
            const firstStart = deferred<CameraStartStreamResult>();
            let starts = 0;
            const fake = fakeClient({
                camera_start_stream: () =>
                    ++starts === 1 ? firstStart.promise : startResult({ webrtc_session_id: SESSION_ID + 1 }),
            });
            const view = createView(fake.client);

            const starting = view.start();
            await settle();
            await view.stop();
            const retry = view.start();
            await settle();
            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);

            firstStart.resolve(startResult());
            await Promise.all([starting, retry]);

            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_stop_stream",
                "camera_release_stream",
                "camera_start_stream",
            ]);
            expect(view.state).to.equal("connecting");
        });

        it("does not start when stopped again while waiting for a pending stop", async () => {
            const stopping = deferred<null>();
            const fake = fakeClient({
                camera_start_stream: () => startResult(),
                camera_stop_stream: () => stopping.promise,
            });
            const view = createView(fake.client);
            await view.start();

            const firstStop = view.stop();
            const retry = view.start();
            const secondStop = view.stop();
            stopping.resolve(null);
            await Promise.all([firstStop, retry, secondStop]);

            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_stop_stream",
                "camera_release_stream",
            ]);
            expect(FakePeerConnection.instances.map(pc => pc.closed)).to.deep.equal([true, true]);
            expect(fake.listenerCounts().webrtc).to.equal(0);
            expect(view.state).to.equal("idle");
        });

        it("forgets a stream evicted while its session is being ended", async () => {
            const stopping = deferred<null>();
            const fake = fakeClient({
                camera_start_stream: () => startResult(),
                camera_stop_stream: () => stopping.promise,
            });
            const view = createView(fake.client);
            await view.start();

            const stopped = view.stop();
            await settle();
            fake.emitEvicted({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID, kind: "video", stream_id: 3 });
            stopping.resolve(null);
            await stopped;

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);
        });

        it("starts again once a start stopped in flight fails", async () => {
            const firstStart = deferred<CameraStartStreamResult>();
            let starts = 0;
            const fake = fakeClient({
                camera_start_stream: () => (++starts === 1 ? firstStart.promise : startResult()),
            });
            const view = createView(fake.client);

            const starting = view.start();
            await settle();
            await view.stop();
            const retry = view.start();
            firstStart.reject(new Error("timed out"));
            await Promise.all([starting, retry]);

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_start_stream"]);
            expect(view.state).to.equal("connecting");
        });

        it("reports no error when stop rejects an answer still being applied", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            const states = recordStates(view);
            await view.start();
            lastPeer().holdRemoteDescription = true;

            fake.emitWebRtc(answerEvent());
            await settle();
            await view.stop();
            await settle();

            expect(view.state).to.equal("idle");
            expect(states).to.deep.equal(["connecting", "idle"]);
            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_stop_stream",
                "camera_release_stream",
            ]);
        });

        it("does not end a session the camera ended, but releases its streams", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitWebRtc({
                event_type: "end",
                webrtc_session_id: SESSION_ID,
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                fabric_index: 1,
                data: { reason: 2 },
            });
            await settle();

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_release_stream"]);
            expect(view.state).to.equal("idle");
        });

        it("stops when another connection ended its session", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitEnded({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID, webrtc_session_id: SESSION_ID + 1 });
            await settle();
            expect(view.state).to.equal("connecting");

            fake.emitEnded({ node_id: BigInt(NODE_ID), endpoint_id: ENDPOINT_ID, webrtc_session_id: SESSION_ID });
            await settle();

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_release_stream"]);
            expect(view.state).to.equal("idle");
        });

        it("forgets an evicted stream so it never releases it", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitEvicted({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID, kind: "video", stream_id: 3 });
            await view.stop();

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);
        });

        it("keeps a stream evicted on another camera or under another kind", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitEvicted({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID + 1, kind: "video", stream_id: 3 });
            fake.emitEvicted({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID, kind: "snapshot", stream_id: 3 });
            await view.stop();

            expect(fake.commands()).to.include("camera_release_stream");
        });

        it("ends and releases a session whose start completes after stop", async () => {
            let respond: (result: CameraStartStreamResult) => void = () => {};
            const fake = fakeClient({
                camera_start_stream: () =>
                    new Promise<CameraStartStreamResult>(resolve => {
                        respond = resolve;
                    }),
            });
            const view = createView(fake.client);

            const starting = view.start();
            await settle();
            await view.stop();
            expect(view.state).to.equal("idle");

            respond(startResult());
            await starting;

            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_stop_stream",
                "camera_release_stream",
            ]);
            expect(view.state).to.equal("idle");
        });

        it("stays idle when a start stopped in flight then fails", async () => {
            let fail: (err: Error) => void = () => {};
            const fake = fakeClient({
                camera_start_stream: () =>
                    new Promise((_resolve, reject) => {
                        fail = reject;
                    }),
            });
            const view = createView(fake.client);

            const starting = view.start();
            await settle();
            await view.stop();
            fail(new Error("timed out"));
            await starting;

            expect(view.state).to.equal("idle");
            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);
        });

        it("does not report streaming for an answer applied after stop", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();
            const pc = lastPeer();
            let applyAnswer: () => void = () => {};
            pc.setRemoteDescription = async (description: FakeDescription) => {
                await new Promise<void>(resolve => {
                    applyAnswer = resolve;
                });
                pc.remoteDescription = description;
            };

            fake.emitWebRtc(answerEvent());
            await settle();
            await view.stop();
            applyAnswer();
            await settle();

            expect(view.state).to.equal("idle");
        });

        it("drops buffered signalling and held ICE candidates that follow a buffered end", async () => {
            const fake: ReturnType<typeof fakeClient> = fakeClient({
                camera_start_stream: () => {
                    lastPeer().onicecandidate?.({
                        candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
                    });
                    fake.emitWebRtc({
                        event_type: "end",
                        webrtc_session_id: SESSION_ID,
                        node_id: NODE_ID,
                        endpoint_id: ENDPOINT_ID,
                        fabric_index: 1,
                        data: { reason: 2 },
                    });
                    fake.emitWebRtc(answerEvent());
                    return startResult();
                },
            });
            const view = createView(fake.client);

            await view.start();

            expect(lastPeer().remoteDescription).to.equal(null);
            expect(view.state).to.equal("idle");
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_release_stream"]);
        });

        it("tears down the session, snapshot streams and listeners when removed from the page", async () => {
            const fake = fakeClient({
                camera_start_stream: () => startResult(),
                camera_snapshot: () => ({
                    data: "AA==",
                    codec: "JPEG",
                    resolution: { width: 640, height: 480 },
                    degraded: false,
                    stream_id: 40,
                    provenance: "allocated",
                }),
            });
            const view = createView(fake.client);
            view.capabilities = capabilities();
            await view.start();
            await view.takeSnapshot();
            expect(fake.listenerCounts()).to.deep.equal({ webrtc: 1, ended: 1, evicted: 1 });

            view.disconnectedCallback();
            await settle();
            await settle();

            expect(fake.calls.slice(2).map(call => [call.command, call.args.kind])).to.deep.equal([
                ["camera_stop_stream", undefined],
                ["camera_release_stream", "video"],
                ["camera_release_stream", "snapshot"],
            ]);
            expect(fake.listenerCounts()).to.deep.equal({ webrtc: 0, ended: 0, evicted: 0 });
        });
    });

    describe("snapshots", () => {
        function snapshotClient() {
            let nextStreamId = 20;
            return fakeClient({
                camera_snapshot: () => ({
                    data: "AA==",
                    codec: "JPEG",
                    resolution: { width: 640, height: 480 },
                    degraded: true,
                    stream_id: nextStreamId++,
                    provenance: "allocated",
                }),
            });
        }

        it("captures with the picked bound and advertised overlays", async () => {
            const fake = snapshotClient();
            const view = createView(fake.client);
            view.capabilities = capabilities({ features: ["Snapshot", "OnScreenDisplay"] });
            view.snapshotResolution = { width: 1280, height: 720 };
            view.osdEnabled = true;

            const snapshot = await view.takeSnapshot();

            expect(fake.calls[0].args).to.deep.equal({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                max_resolution: { width: 1280, height: 720 },
                osd_enabled: true,
            });
            expect(snapshot).to.deep.equal({
                dataUri: "data:image/jpeg;base64,AA==",
                resolution: { width: 640, height: 480 },
                degraded: true,
            });
        });

        it("sends no bound for Auto", async () => {
            const fake = snapshotClient();
            const view = createView(fake.client);

            await view.takeSnapshot();

            expect(fake.calls[0].args).to.deep.equal({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID });
        });

        it("releases only snapshot streams its own captures allocated and the camera still has", async () => {
            const fake = snapshotClient();
            const view = createView(fake.client);
            view.capabilities = capabilities();

            await view.takeSnapshot();
            await view.takeSnapshot();
            fake.emitEvicted({ node_id: NODE_ID, endpoint_id: ENDPOINT_ID, kind: "snapshot", stream_id: 21 });
            await view.releaseSnapshotStreams();
            await view.releaseSnapshotStreams();

            expect(
                fake.calls.filter(call => call.command === "camera_release_stream").map(call => call.args),
            ).to.deep.equal([{ node_id: NODE_ID, endpoint_id: ENDPOINT_ID, kind: "snapshot", stream_id: 20 }]);
        });

        it("releases a snapshot stream its capture allocated before the capabilities loaded", async () => {
            const fake = snapshotClient();
            const view = createView(fake.client);

            await view.takeSnapshot();
            await view.releaseSnapshotStreams();

            expect(fake.commands()).to.deep.equal(["camera_snapshot", "camera_release_stream"]);
        });

        for (const provenance of ["reused", "adopted"] as const) {
            it(`never releases a snapshot stream its capture ${provenance}`, async () => {
                const fake = fakeClient({
                    camera_snapshot: () => ({
                        data: "AA==",
                        codec: "JPEG",
                        resolution: { width: 640, height: 480 },
                        degraded: false,
                        stream_id: 4,
                        provenance,
                    }),
                });
                const view = createView(fake.client);
                view.capabilities = capabilities();

                await view.takeSnapshot();
                await view.releaseSnapshotStreams();

                expect(fake.commands()).to.deep.equal(["camera_snapshot"]);
            });
        }

        it("waits for an in-flight capture before releasing", async () => {
            let finishCapture: () => void = () => {};
            const fake = fakeClient({
                camera_snapshot: () =>
                    new Promise(resolve => {
                        finishCapture = () =>
                            resolve({
                                data: "AA==",
                                codec: "JPEG",
                                resolution: { width: 640, height: 480 },
                                degraded: false,
                                stream_id: 30,
                                provenance: "allocated",
                            });
                    }),
            });
            const view = createView(fake.client);
            view.capabilities = capabilities();

            const capture = view.takeSnapshot();
            const release = view.releaseSnapshotStreams();
            await settle();
            expect(fake.commands()).to.deep.equal(["camera_snapshot"]);

            finishCapture();
            await Promise.all([capture, release]);

            expect(fake.commands()).to.deep.equal(["camera_snapshot", "camera_release_stream"]);
        });
    });
});
