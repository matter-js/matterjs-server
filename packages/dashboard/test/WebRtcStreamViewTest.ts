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
import { MICROPHONE_NEEDS_SECURE_CONTEXT } from "../src/util/camera-api.js";
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

const DIRECTIONS = ["sendrecv", "sendonly", "recvonly", "inactive"];

function sectionDirection(section: string[]): string {
    return section.find(line => DIRECTIONS.includes(line.slice(2)))?.slice(2) ?? "sendrecv";
}

function mediaSectionsOf(sdp: string): string[][] {
    const sections = new Array<string[]>();
    for (const line of sdp.split("\r\n")) {
        if (line.startsWith("m=")) sections.push([line]);
        else sections.at(-1)?.push(line);
    }
    return sections;
}

/** The direction a browser settles on for its side, given its own direction and the remote's (RFC 3264 §6.1). */
function negotiatedDirection(local: string, remote: string): string {
    const send = (local === "sendrecv" || local === "sendonly") && (remote === "sendrecv" || remote === "recvonly");
    const recv = (local === "sendrecv" || local === "recvonly") && (remote === "sendrecv" || remote === "sendonly");
    return send && recv ? "sendrecv" : send ? "sendonly" : recv ? "recvonly" : "inactive";
}

interface FakeTransceiver {
    kind: string;
    direction: string;
    currentDirection: string | null;
    sender: { replaceTrack: (track: unknown) => Promise<void> };
}

class FakePeerConnection {
    static instances = new Array<FakePeerConnection>();
    /** When set, createOffer waits for it. */
    static offerGate: Promise<void> | null = null;
    /** When set, the offer has one m-section per transceiver instead of a placeholder. */
    static sdpFromTransceivers = false;
    /** Candidates found as soon as the local offer is set, which is before camera_start_stream is sent. */
    static candidatesOnLocalOffer = new Array<FakeCandidate>();
    transceivers = new Array<string>();
    audioTransceiver: FakeTransceiver | null = null;
    #transceivers = new Array<FakeTransceiver>();
    directions = new Array<string | undefined>();
    /** Tracks passed to the audio sender's replaceTrack, in call order. */
    replacedTracks = new Array<unknown>();
    /** When set, replaceTrack rejects with it. */
    replaceTrackError: Error | null = null;
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

    addTransceiver(kind: string, init?: { direction?: string }) {
        this.transceivers.push(kind);
        this.directions.push(init?.direction);
        const transceiver: FakeTransceiver = {
            kind,
            direction: init?.direction ?? "sendrecv",
            currentDirection: null,
            sender: {
                replaceTrack: async (track: unknown) => {
                    if (kind !== "audio") throw new Error(`a microphone on the ${kind} sender`);
                    if (this.replaceTrackError) throw this.replaceTrackError;
                    this.replacedTracks.push(track);
                },
            },
        };
        this.#transceivers.push(transceiver);
        if (kind === "audio") this.audioTransceiver = transceiver;
        return transceiver;
    }

    async createOffer(): Promise<FakeDescription> {
        await FakePeerConnection.offerGate;
        if (!FakePeerConnection.sdpFromTransceivers) return { type: "offer", sdp: "offer-sdp" };
        const lines = ["v=0"];
        this.#transceivers.forEach((transceiver, index) => {
            lines.push(`m=${transceiver.kind} 9 UDP/TLS/RTP/SAVPF 96`, `a=mid:${index}`, `a=${transceiver.direction}`);
        });
        return { type: "offer", sdp: lines.join("\r\n") };
    }

    /** Sets each transceiver's currentDirection from the remote SDP, as applying an answer does. */
    #negotiate(remoteSdp: string) {
        const sections = mediaSectionsOf(remoteSdp);
        this.#transceivers.forEach((transceiver, index) => {
            const section = sections[index];
            transceiver.currentDirection = section
                ? negotiatedDirection(transceiver.direction, sectionDirection(section))
                : transceiver.direction;
        });
    }

    async createAnswer(): Promise<FakeDescription> {
        return { type: "answer", sdp: "browser-answer-sdp" };
    }

    async setLocalDescription(description: FakeDescription) {
        this.localDescription = description;
        this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
        if (description.type === "answer") this.#negotiate(this.remoteDescription?.sdp ?? "");
        if (description.type === "offer") {
            for (const candidate of FakePeerConnection.candidatesOnLocalOffer) this.onicecandidate?.({ candidate });
        }
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
        if (description.type === "answer") this.#negotiate(description.sdp);
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
    /** The key the latest `camera_start_stream` named its session with, as the server echoes it. */
    const latestKey = () => {
        const key = calls.filter(call => call.command === "camera_start_stream").at(-1)?.args.client_session_key;
        return typeof key === "string" ? { client_session_key: key } : {};
    };
    return {
        // The view only uses the members above; a full MatterClient needs a live connection.
        client: fake as unknown as MatterClient,
        calls,
        commands: () => calls.map(call => call.command),
        latestKey,
        /** Carries the latest start's key unless `data` names one. */
        emitWebRtc: (data: WebRtcCallbackData) =>
            [...webrtc].forEach(listener => listener({ ...latestKey(), ...data })),
        emitEnded: (data: CameraSessionEndedData) =>
            [...ended].forEach(listener => listener({ ...latestKey(), ...data })),
        emitEvicted: (data: CameraStreamEvictedData) => [...evicted].forEach(listener => listener(data)),
        listenerCounts: () => ({ webrtc: webrtc.size, ended: ended.size, evicted: evicted.size }),
    };
}

function startResult(overrides: Partial<CameraStartStreamResult> = {}): CameraStartStreamResult {
    return {
        webrtc_session_id: SESSION_ID,
        mode: "provide_offer",
        talkback: false,
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

async function expectRejection(promise: Promise<unknown>, message: string): Promise<void> {
    let error: unknown;
    try {
        await promise;
    } catch (err) {
        error = err;
    }
    expect(error).to.be.instanceOf(Error);
    expect(error instanceof Error ? error.message : undefined).to.equal(message);
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
        FakePeerConnection.sdpFromTransceivers = false;
        FakePeerConnection.candidatesOnLocalOffer = [];
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
                    ...fake.latestKey(),
                },
            });
            expect(fake.latestKey().client_session_key).to.be.a("string");
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

        it("applies its session's signalling by key, also before the camera_start_stream response is handled", async () => {
            const fake: ReturnType<typeof fakeClient> = fakeClient({
                camera_start_stream: () => {
                    fake.emitWebRtc(answerEvent());
                    return startResult();
                },
            });
            const view = createView(fake.client);

            await view.start();
            await settle();
            expect(lastPeer().remoteDescription).to.deep.equal({ type: "answer", sdp: `answer-${SESSION_ID}` });
            expect(view.state).to.equal("streaming");
        });

        it("names each attempt's session with its own key", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();
            const first = fake.latestKey().client_session_key;
            await view.stop();
            await view.start();
            expect(fake.latestKey().client_session_key).to.not.equal(first);
        });

        it("ignores another node's signalling and matches its own node id as a bigint", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitWebRtc(answerEvent(SESSION_ID, 99));
            await settle();
            expect(lastPeer().remoteDescription).to.equal(null);

            fake.emitWebRtc(answerEvent(SESSION_ID, BigInt(NODE_ID)));
            await settle();
            expect(lastPeer().remoteDescription).to.deep.equal({ type: "answer", sdp: `answer-${SESSION_ID}` });
        });

        it("ignores signalling of a session with another key or none", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitWebRtc({ ...answerEvent(), client_session_key: "another-key" });
            fake.emitWebRtc({ ...answerEvent(), client_session_key: undefined });
            await settle();
            expect(lastPeer().remoteDescription).to.equal(null);

            fake.emitWebRtc(answerEvent());
            await settle();
            expect(lastPeer().remoteDescription?.sdp).to.equal(`answer-${SESSION_ID}`);
        });

        it("sends local ICE candidates by key, holding only those found before camera_start_stream is sent", async () => {
            const before = { candidate: "candidate:0", sdpMid: "0", sdpMLineIndex: 0 };
            const during = { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 };
            const late = { candidate: "candidate:2", sdpMid: "0", sdpMLineIndex: 0 };
            FakePeerConnection.candidatesOnLocalOffer = [before];
            const fake = fakeClient({
                camera_start_stream: () => {
                    lastPeer().onicecandidate?.({ candidate: during });
                    return startResult();
                },
            });
            const view = createView(fake.client);

            await view.start();
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_provide_ice_candidates"]);
            expect(fake.calls[1].args).to.deep.equal({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                ...fake.latestKey(),
                ice_candidates: [before, during],
            });

            lastPeer().onicecandidate?.({ candidate: late });
            await settle();
            expect(fake.commands()).to.deep.equal([
                "camera_start_stream",
                "camera_provide_ice_candidates",
                "camera_provide_ice_candidates",
            ]);
            expect(fake.calls[2].args.ice_candidates).to.deep.equal([late]);
        });

        it("names the session with a client_session_key on camera_start_stream", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);

            await view.start();

            const key = fake.calls[0].args.client_session_key;
            expect(key).to.be.a("string");
            expect(key).to.not.equal("");
        });

        it("keeps the session when sending held ICE candidates fails", async () => {
            const fake: ReturnType<typeof fakeClient> = fakeClient({
                camera_start_stream: () => {
                    lastPeer().onicecandidate?.({
                        candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 },
                    });
                    return startResult();
                },
                camera_provide_ice_candidates: () => {
                    throw new Error("send failed");
                },
            });
            const view = createView(fake.client);

            await view.start();
            fake.emitWebRtc(answerEvent());
            await settle();

            expect(view.state).to.equal("streaming");
            expect(fake.commands()).to.not.include("camera_stop_stream");
        });

        it("keeps the session when a camera offer cannot be applied", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();
            const pc = lastPeer();
            const applyAnswer = pc.setRemoteDescription.bind(pc);
            pc.setRemoteDescription = async (description: FakeDescription) => {
                if (description.type === "offer") throw new Error("bad offer");
                await applyAnswer(description);
            };

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
                    args: { node_id: NODE_ID, endpoint_id: ENDPOINT_ID, ...fake.latestKey() },
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
            expect(fake.calls.at(-1)?.command).to.equal("camera_provide_ice_candidates");
            expect(fake.calls.at(-1)?.args.client_session_key).to.equal(fake.latestKey().client_session_key);
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
            const stopping = view.stop();
            const retry = view.start();
            await settle();
            // The stop by key cancels the start on the server; the start's own answer then settles it.
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);
            expect(fake.calls[1].args.client_session_key).to.equal(fake.calls[0].args.client_session_key);

            firstStart.resolve(startResult());
            await stopping;
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

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream", "camera_start_stream"]);
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

            // camera_session_ended carries every end of the session, so the webrtc_callback `end` is not read.
            fake.emitWebRtc({
                event_type: "end",
                webrtc_session_id: SESSION_ID,
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                fabric_index: 1,
                data: { reason: 2 },
            });
            await settle();
            expect(view.state).to.equal("connecting");

            fake.emitEnded({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                webrtc_session_id: SESSION_ID,
                cause: "peer",
                reason: 2,
            });
            await settle();

            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_release_stream"]);
            expect(view.state).to.equal("idle");
        });

        it("stops when another connection ended its session", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitEnded({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                webrtc_session_id: SESSION_ID,
                cause: "other_connection",
                client_session_key: "another-key",
            });
            await settle();
            expect(view.state).to.equal("connecting");

            fake.emitEnded({
                node_id: BigInt(NODE_ID),
                endpoint_id: ENDPOINT_ID,
                webrtc_session_id: SESSION_ID,
                cause: "other_connection",
            });
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
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);
        });

        it("stops by key when the start fails without an answer from the server", async () => {
            const fake = fakeClient({
                camera_start_stream: () => {
                    throw new Error("timed out");
                },
            });
            const view = createView(fake.client);

            await view.start();

            expect(view.state).to.equal("error");
            expect(fake.commands()).to.deep.equal(["camera_start_stream", "camera_stop_stream"]);
            expect(fake.calls[1].args.client_session_key).to.equal(fake.calls[0].args.client_session_key);
        });

        it("sends the stop again after a late start when the first stop failed", async () => {
            const firstStart = deferred<CameraStartStreamResult>();
            let stops = 0;
            const fake = fakeClient({
                camera_start_stream: () => firstStart.promise,
                camera_stop_stream: () => {
                    if (++stops === 1) throw new Error("connection lost");
                    return { ended: true };
                },
            });
            const view = createView(fake.client);

            const starting = view.start();
            await settle();
            await view.stop();
            firstStart.resolve(startResult());
            await starting;
            await settle();

            expect(fake.commands().filter(command => command === "camera_stop_stream")).to.have.length(2);
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

        it("drops signalling that follows the camera's end without ending the session again", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            await view.start();

            fake.emitEnded({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                webrtc_session_id: SESSION_ID,
                cause: "peer",
                reason: 2,
            });
            fake.emitWebRtc(answerEvent());
            await settle();

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

    describe("talkback", () => {
        class FakeTrack extends EventTarget {
            stopped = false;
            stop() {
                this.stopped = true;
            }
        }

        let getUserMediaCalls: unknown[];
        let getUserMedia: () => Promise<unknown>;
        let track: FakeTrack;
        let restoreGlobals: () => void;

        function setGlobal(name: string, value: unknown): () => void {
            const original = Object.getOwnPropertyDescriptor(globalThis, name);
            Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
            return () => {
                if (original) Object.defineProperty(globalThis, name, original);
                else Reflect.deleteProperty(globalThis, name);
            };
        }

        function media(captured: FakeTrack) {
            return { getAudioTracks: () => [captured], getTracks: () => [captured] };
        }

        beforeEach(() => {
            getUserMediaCalls = [];
            track = new FakeTrack();
            getUserMedia = async () => media(track);
            const restoreSecure = setGlobal("isSecureContext", true);
            const restoreNavigator = setGlobal("navigator", {
                mediaDevices: {
                    getUserMedia: (constraints: unknown) => {
                        getUserMediaCalls.push(constraints);
                        return getUserMedia();
                    },
                },
            });
            restoreGlobals = () => {
                restoreNavigator();
                restoreSecure();
            };
        });

        afterEach(() => restoreGlobals());

        function talkCapabilities(twoWayTalkSupport: string) {
            const caps = capabilities({ features: ["Audio", "Video", "Speaker"] });
            return { ...caps, audio: { ...caps.audio, two_way_talk_support: twoWayTalkSupport } };
        }

        function cameraSdp(videoDirection: string, audioDirection: string): string {
            return [
                "v=0",
                "m=video 9 UDP/TLS/RTP/SAVPF 96",
                "a=mid:0",
                `a=${videoDirection}`,
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "a=mid:1",
                `a=${audioDirection}`,
            ].join("\r\n");
        }

        function signalling(event_type: "answer" | "offer", sdp: string): WebRtcCallbackData {
            return {
                event_type,
                webrtc_session_id: SESSION_ID,
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                fabric_index: 1,
                data: { sdp },
            };
        }

        async function startTalkView(
            twoWayTalkSupport = "FullDuplex",
            {
                audioAnswer = "sendrecv",
                result = startResult({ talkback: true }),
            }: { audioAnswer?: string; result?: CameraStartStreamResult } = {},
        ) {
            FakePeerConnection.sdpFromTransceivers = true;
            const fake = fakeClient({ camera_start_stream: () => result });
            const view = createView(fake.client);
            view.capabilities = talkCapabilities(twoWayTalkSupport);
            const video = { muted: true, srcObject: null };
            Object.defineProperty(view, "_video", { value: video });
            await view.start();
            fake.emitWebRtc(signalling("answer", cameraSdp("sendonly", audioAnswer)));
            await settle();
            return { fake, view, video };
        }

        for (const audioAnswer of ["sendonly", "inactive"]) {
            it(`offers no talk when the camera answers the audio section ${audioAnswer}`, async () => {
                const { view } = await startTalkView("FullDuplex", { audioAnswer });

                expect(view.state).to.equal("streaming");
                expect(view.talkAvailable).to.equal(false);
                await expectRejection(view.setTalking(true), "Talking is not available for this stream");
                expect(getUserMediaCalls).to.deep.equal([]);
            });
        }

        it("talks when the camera answers the audio section sendrecv", async () => {
            await startTalkView();

            expect(lastPeer().audioTransceiver?.currentDirection).to.equal("sendrecv");
        });

        it("stops talking when a camera re-offer no longer takes audio", async () => {
            const { view, fake, video } = await startTalkView("HalfDuplex");
            view.setMuted(false);
            await view.setTalking(true);
            let talkChanges = 0;
            view.addEventListener("talkchange", () => talkChanges++);

            fake.emitWebRtc(signalling("offer", cameraSdp("sendonly", "sendonly")));
            await settle();

            expect(view.talkAvailable).to.equal(false);
            expect(view.talking).to.equal(false);
            expect(track.stopped).to.equal(true);
            expect(video.muted).to.equal(false);
            expect(talkChanges).to.equal(1);
            expect(lastPeer().replacedTracks).to.deep.equal([track, null]);
            expect(view.state).to.equal("streaming");
        });

        it("keeps talking and stays quiet when a camera re-offer still takes audio", async () => {
            const { view, fake } = await startTalkView();
            await view.setTalking(true);
            let talkChanges = 0;
            view.addEventListener("talkchange", () => talkChanges++);

            fake.emitWebRtc(signalling("offer", cameraSdp("sendonly", "sendrecv")));
            await settle();

            expect(view.talking).to.equal(true);
            expect(track.stopped).to.equal(false);
            expect(talkChanges).to.equal(0);
            expect(fake.commands()).to.include("camera_provide_answer");
        });

        it("asks for the microphone only once while talking", async () => {
            const { view } = await startTalkView();
            await view.setTalking(true);

            await view.setTalking(true);

            expect(getUserMediaCalls).to.have.length(1);
            expect(lastPeer().replacedTracks).to.deep.equal([track]);
        });

        it("offers a sendrecv audio section and asks for talkback when the camera can talk back", async () => {
            const { view, fake } = await startTalkView();

            expect(lastPeer().directions).to.deep.equal(["recvonly", "sendrecv"]);
            expect(fake.calls[0].args.talkback).to.equal(true);
            expect(view.talkAvailable).to.equal(true);
            expect(getUserMediaCalls).to.deep.equal([]);
        });

        it("offers recvonly audio and does not ask for talkback when the camera cannot talk back", async () => {
            const fake = fakeClient({ camera_start_stream: () => startResult() });
            const view = createView(fake.client);
            view.capabilities = talkCapabilities("NotSupported");

            await view.start();

            expect(lastPeer().directions).to.deep.equal(["recvonly", "recvonly"]);
            expect(fake.calls[0].args).to.not.have.property("talkback");
            expect(view.talkAvailable).to.equal(false);
            await expectRejection(view.setTalking(true), "Talking is not available for this stream");
        });

        it("offers no talk when the server reports no talkback for the session", async () => {
            const { view } = await startTalkView("FullDuplex", { result: startResult({ talkback: false }) });

            expect(lastPeer().audioTransceiver?.currentDirection).to.equal("sendrecv");
            expect(view.talkAvailable).to.equal(false);
            await expectRejection(view.setTalking(true), "Talking is not available for this stream");
            expect(getUserMediaCalls).to.deep.equal([]);
        });

        it("sends the microphone track and stops it again without renegotiating", async () => {
            const { view, fake } = await startTalkView();
            const offer = lastPeer().localDescription;
            const talkChanges = new Array<boolean>();
            view.addEventListener("talkchange", () => talkChanges.push(view.talking));

            await view.setTalking(true);
            expect(getUserMediaCalls).to.deep.equal([{ audio: true }]);
            expect(lastPeer().replacedTracks).to.deep.equal([track]);
            expect(view.talking).to.equal(true);
            expect(track.stopped).to.equal(false);

            await view.setTalking(false);
            expect(lastPeer().replacedTracks).to.deep.equal([track, null]);
            expect(track.stopped).to.equal(true);
            expect(view.talking).to.equal(false);
            expect(talkChanges).to.deep.equal([true, false]);
            expect(lastPeer().localDescription).to.equal(offer);
            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);
        });

        it("applies the user's mute choice to the playback", async () => {
            const { view, video } = await startTalkView();

            view.setMuted(false);
            expect(video.muted).to.equal(false);
            view.setMuted(true);
            expect(video.muted).to.equal(true);
        });

        it("mutes a half-duplex camera's audio while talking and restores the user's choice after", async () => {
            const { view, video } = await startTalkView("HalfDuplex");
            view.setMuted(false);

            await view.setTalking(true);
            expect(video.muted).to.equal(true);
            expect(view.muted).to.equal(false);

            await view.setTalking(false);
            expect(video.muted).to.equal(false);
        });

        it("restores a half-duplex camera's audio when the stream stops while talking", async () => {
            const { view, video } = await startTalkView("HalfDuplex");
            view.setMuted(false);
            await view.setTalking(true);

            await view.stop();

            expect(video.muted).to.equal(false);
        });

        it("leaves a full-duplex camera's audio as the user set it while talking", async () => {
            const { view, video } = await startTalkView("FullDuplex");
            view.setMuted(false);

            await view.setTalking(true);

            expect(video.muted).to.equal(false);
        });

        it("does not ask for the microphone outside a secure context", async () => {
            const { view } = await startTalkView();
            const restore = setGlobal("isSecureContext", false);
            try {
                await expectRejection(view.setTalking(true), MICROPHONE_NEEDS_SECURE_CONTEXT);
            } finally {
                restore();
            }

            expect(getUserMediaCalls).to.deep.equal([]);
            expect(view.talking).to.equal(false);
            expect(view.state).to.not.equal("error");
        });

        it("stays not talking and keeps the stream when the microphone is refused", async () => {
            const { view, fake } = await startTalkView();
            getUserMedia = async () => {
                throw new DOMException("Permission denied", "NotAllowedError");
            };

            await expectRejection(view.setTalking(true), "Permission denied");

            expect(view.talking).to.equal(false);
            expect(lastPeer().replacedTracks).to.deep.equal([]);
            expect(fake.commands()).to.deep.equal(["camera_start_stream"]);
        });

        it("stops the microphone when the peer connection refuses the track", async () => {
            const { view, video } = await startTalkView("HalfDuplex");
            view.setMuted(false);
            lastPeer().replaceTrackError = new Error("InvalidModificationError");
            const talkChanges = new Array<boolean>();
            view.addEventListener("talkchange", () => talkChanges.push(view.talking));

            await expectRejection(view.setTalking(true), "InvalidModificationError");

            expect(talkChanges).to.deep.equal([true, false]);
            expect(track.stopped).to.equal(true);
            expect(view.talking).to.equal(false);
            expect(video.muted).to.equal(false);
        });

        it("reports a missing microphone when the browser grants no audio track", async () => {
            const { view } = await startTalkView();
            getUserMedia = async () => ({ getAudioTracks: () => [], getTracks: () => [] });

            await expectRejection(view.setTalking(true), "No microphone found");

            expect(view.talking).to.equal(false);
        });

        it("stops the microphone when the stream stops", async () => {
            const { view } = await startTalkView();
            await view.setTalking(true);

            await view.stop();

            expect(track.stopped).to.equal(true);
            expect(view.talking).to.equal(false);
        });

        it("stops the microphone when the camera ends the session", async () => {
            const { view, fake, video } = await startTalkView("HalfDuplex");
            view.setMuted(false);
            await view.setTalking(true);

            fake.emitEnded({
                node_id: NODE_ID,
                endpoint_id: ENDPOINT_ID,
                webrtc_session_id: SESSION_ID,
                cause: "peer",
            });

            expect(track.stopped).to.equal(true);
            expect(view.talking).to.equal(false);
            expect(video.muted).to.equal(false);
        });

        it("stops a microphone granted after the stream stopped", async () => {
            const { view } = await startTalkView();
            const granted = deferred<unknown>();
            getUserMedia = () => granted.promise;

            const talking = view.setTalking(true);
            await view.stop();
            granted.resolve(media(track));
            await talking;

            expect(track.stopped).to.equal(true);
            expect(lastPeer().replacedTracks).to.deep.equal([]);
            expect(view.talking).to.equal(false);
        });

        it("stops talking when the microphone ends on its own", async () => {
            const { view, video } = await startTalkView("HalfDuplex");
            view.setMuted(false);
            await view.setTalking(true);
            const talkChanges = new Array<boolean>();
            view.addEventListener("talkchange", () => talkChanges.push(view.talking));

            track.dispatchEvent(new Event("ended"));
            await settle();

            expect(view.talking).to.equal(false);
            expect(talkChanges).to.deep.equal([false]);
            expect(video.muted).to.equal(false);
            expect(lastPeer().replacedTracks).to.deep.equal([track, null]);
        });

        it("ignores the end of a microphone that was already switched off", async () => {
            const { view } = await startTalkView();
            await view.setTalking(true);
            await view.setTalking(false);
            let talkChanges = 0;
            view.addEventListener("talkchange", () => talkChanges++);

            track.dispatchEvent(new Event("ended"));
            await settle();

            expect(talkChanges).to.equal(0);
            expect(lastPeer().replacedTracks).to.deep.equal([track, null]);
        });

        it("keeps talking when an earlier microphone ends after talking restarted", async () => {
            const { view } = await startTalkView();
            await view.setTalking(true);
            await view.setTalking(false);
            const first = track;
            track = new FakeTrack();
            await view.setTalking(true);

            first.dispatchEvent(new Event("ended"));
            await settle();

            expect(view.talking).to.equal(true);
            expect(track.stopped).to.equal(false);
        });

        it("drops a microphone refusal that arrives after the stream stopped", async () => {
            const { view } = await startTalkView();
            const granted = deferred<unknown>();
            getUserMedia = () => granted.promise;
            granted.promise.catch(() => undefined);

            const talking = view.setTalking(true);
            await view.stop();
            granted.reject(new Error("NotAllowedError"));
            await talking;

            expect(view.talking).to.equal(false);
        });

        it("stops a microphone granted after talking was switched off", async () => {
            const { view } = await startTalkView();
            const granted = deferred<unknown>();
            getUserMedia = () => granted.promise;

            const talking = view.setTalking(true);
            await view.setTalking(false);
            granted.resolve(media(track));
            await talking;

            expect(track.stopped).to.equal(true);
            expect(lastPeer().replacedTracks).to.deep.equal([]);
            expect(view.talking).to.equal(false);
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
