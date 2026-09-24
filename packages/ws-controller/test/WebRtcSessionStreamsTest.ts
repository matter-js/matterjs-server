/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { StreamUsage } from "@matter/main/types";
import {
    establishWebRtcProviderSession,
    isTrackableWebRtcSession,
    tracksSessionOf,
    resolveWebRtcSessionStreams,
    selectWebRtcStreamFields,
} from "../src/controller/webRtcSessionStreams.js";
import type { WebRtcProviderSessionArgs, WebRtcProviderSessionIo } from "../src/controller/webRtcSessionStreams.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { DEVICE_CLEANUP_BUDGET_MS } from "../src/util/deviceCleanupBudget.js";

describe("resolveWebRtcSessionStreams", () => {
    it("uses the requested rev-2 list verbatim", () => {
        expect(resolveWebRtcSessionStreams([3, 5], undefined, undefined)).to.deep.equal([3, 5]);
    });

    it("prefers the requested list over the deprecated scalar echoes", () => {
        expect(resolveWebRtcSessionStreams([3], 9, 9)).to.deep.equal([3]);
    });

    it("wraps an explicit rev-1 request id even when the response omits its echo", () => {
        expect(resolveWebRtcSessionStreams(undefined, 3, undefined)).to.deep.equal([3]);
    });

    it("keeps the explicit request id when the response echoes a different value", () => {
        expect(resolveWebRtcSessionStreams(undefined, 3, 7)).to.deep.equal([3]);
    });

    it("falls back to the response echo when the request asked for auto-selection", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, 7)).to.deep.equal([7]);
    });

    it("yields no stream when auto-selection is requested but the provider reports none", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, null)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, null, undefined)).to.equal(undefined);
    });

    it("yields no stream when the media kind is absent from the request", () => {
        expect(resolveWebRtcSessionStreams(undefined, undefined, undefined)).to.equal(undefined);
    });

    it("ignores an empty requested list and falls through to the scalar path", () => {
        expect(resolveWebRtcSessionStreams([], 3, undefined)).to.deep.equal([3]);
        expect(resolveWebRtcSessionStreams([], undefined, undefined)).to.equal(undefined);
    });

    it("keeps only numeric entries from a mixed request list", () => {
        expect(resolveWebRtcSessionStreams([3, "x", null, 5], undefined, undefined)).to.deep.equal([3, 5]);
    });

    it("falls through when a request list contains no numeric entries", () => {
        expect(resolveWebRtcSessionStreams(["x", null], 3, undefined)).to.deep.equal([3]);
        expect(resolveWebRtcSessionStreams(["x"], undefined, undefined)).to.equal(undefined);
    });

    it("treats a non-numeric, non-null request id as an omitted media kind", () => {
        expect(resolveWebRtcSessionStreams(undefined, "3", 7)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, undefined, 7)).to.equal(undefined);
    });

    it("yields no stream when auto-selection is requested but the echo is non-numeric", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, "7")).to.equal(undefined);
    });

    it("rejects non-integer, negative, and NaN ids from a list", () => {
        expect(resolveWebRtcSessionStreams([3, -1, 2.5, NaN, 5], undefined, undefined)).to.deep.equal([3, 5]);
        expect(resolveWebRtcSessionStreams([-1, 2.5, NaN], 4, undefined)).to.deep.equal([4]);
    });

    it("treats a non-integer/negative scalar request id as an omitted media kind", () => {
        expect(resolveWebRtcSessionStreams(undefined, 2.5, undefined)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, -1, undefined)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, NaN, undefined)).to.equal(undefined);
    });

    it("ignores a non-integer auto-select echo", () => {
        expect(resolveWebRtcSessionStreams(undefined, null, 2.5)).to.equal(undefined);
        expect(resolveWebRtcSessionStreams(undefined, null, -1)).to.equal(undefined);
    });

    it("accepts stream id 0", () => {
        expect(resolveWebRtcSessionStreams(undefined, 0, undefined)).to.deep.equal([0]);
    });
});

describe("selectWebRtcStreamFields", () => {
    it("sends the lists verbatim for a rev-2 provider", () => {
        const fields: Record<string, unknown> = { sdp: "v=0", videoStreams: [7], audioStreams: [9] };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ sdp: "v=0", videoStreams: [7], audioStreams: [9] });
    });

    it("keeps multiple streams for a rev-2 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [3, 5] };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ videoStreams: [3, 5] });
    });

    it("sends a legacy caller's singular ids unchanged to a rev-2 provider", () => {
        // They are deprecated, not invalid, on revision 2, and the null is an auto-select request
        // the list form cannot state at all.
        const fields: Record<string, unknown> = { videoStreamId: 5, audioStreamId: null };
        selectWebRtcStreamFields(fields, 3);
        expect(fields).to.deep.equal({ videoStreamId: 5, audioStreamId: null });
    });

    it("down-converts the lists to singular ids for a rev-1 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [7], audioStreams: [9] };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: 7, audioStreamId: 9 });
    });

    it("refuses a multi-stream list for a rev-1 provider rather than truncating it", () => {
        // Sending the first entry alone establishes a session with fewer streams than the caller
        // asked for, and answers success for it.
        expect(() => selectWebRtcStreamFields({ videoStreams: [3, 5] }, 1)).to.throw(/videoStreams names 2 streams/);
    });

    it("down-converts the lists when the provider revision is unknown", () => {
        const fields: Record<string, unknown> = { videoStreams: [7] };
        selectWebRtcStreamFields(fields, undefined);
        expect(fields).to.deep.equal({ videoStreamId: 7 });
    });

    it("leaves a rev-1 auto-select request untouched", () => {
        const fields: Record<string, unknown> = { videoStreamId: null };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: null });
    });

    it("preserves a legacy null auto-select request on a rev-2 provider when no list is sent", () => {
        const fields: Record<string, unknown> = { videoStreamId: null, audioStreamId: null };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ videoStreamId: null, audioStreamId: null });
    });

    it("refuses a list sent beside a null auto-select on the other media kind", () => {
        // The provider's INVALID_COMMAND test spans both media kinds, and dropping the id would
        // establish a video-only session for a caller that asked for auto-selected audio.
        expect(() => selectWebRtcStreamFields({ videoStreams: [5], audioStreamId: null }, 2)).to.throw(
            /videoStreams cannot be sent together with audioStreamId/,
        );
    });

    it("refuses a list sent beside the singular id of the same media kind", () => {
        expect(() => selectWebRtcStreamFields({ videoStreams: [5], videoStreamId: 7 }, 1)).to.throw(
            /videoStreams cannot be sent together with videoStreamId/,
        );
    });

    it("refuses an empty list whatever the provider's revision, rather than dropping it", () => {
        // The field takes 1 to 16 entries, so an empty list asks for nothing it can carry, and
        // dropping it on one revision while forwarding it on the other answers one input two ways.
        expect(() => selectWebRtcStreamFields({ videoStreams: [] }, 1)).to.throw(/videoStreams names no stream/);
        expect(() => selectWebRtcStreamFields({ videoStreams: [] }, 2)).to.throw(/videoStreams names no stream/);
    });

    it("says the revision is unread, not that the camera states revision 1, when it has not been read", () => {
        // The refusal is this server's own position, not a limitation the camera stated.
        expect(() => selectWebRtcStreamFields({ videoStreams: [3, 5] }, undefined)).to.throw(
            /has not read this camera's WebRTC Provider ClusterRevision/,
        );
        expect(() => selectWebRtcStreamFields({ videoStreams: [3, 5] }, 1)).to.throw(/states cluster revision 1/);
    });

    it("leaves the request untouched when the other media kind is refused", () => {
        // The conversion writes one media kind at a time, so a half-converted request would reach a
        // retry, or a second reader, in a form its caller never sent.
        const fields: Record<string, unknown> = { videoStreams: [7], audioStreams: [3, 5] };
        expect(() => selectWebRtcStreamFields(fields, 1)).to.throw(/audioStreams names 2 streams/);
        expect(fields).to.deep.equal({ videoStreams: [7], audioStreams: [3, 5] });
    });

    it("refuses a stream id past the uint16 its cluster field encodes it in", () => {
        expect(() => selectWebRtcStreamFields({ videoStreams: [65536] }, 2)).to.throw(
            /videoStreams\[0\] must be a stream id/,
        );
    });

    it("refuses a list entry that is not a stream id", () => {
        expect(() => selectWebRtcStreamFields({ videoStreams: [5, "7"] }, 2)).to.throw(
            /videoStreams\[1\] must be a stream id/,
        );
    });

    it("refuses a stream list that is not a list", () => {
        expect(() => selectWebRtcStreamFields({ videoStreams: 5 }, 2)).to.throw(
            /videoStreams must be an array of stream ids/,
        );
    });
});

describe("isTrackableWebRtcSession", () => {
    it("accepts a session with a numeric usage and a video stream", () => {
        expect(isTrackableWebRtcSession(3, [3], undefined)).to.equal(true);
    });

    it("accepts a session with a numeric usage and an audio stream", () => {
        expect(isTrackableWebRtcSession(3, undefined, [1])).to.equal(true);
    });

    it("rejects a session with no video and no audio stream", () => {
        expect(isTrackableWebRtcSession(3, undefined, undefined)).to.equal(false);
    });

    it("rejects a session whose stream usage is missing or non-numeric", () => {
        expect(isTrackableWebRtcSession(undefined, [3], [1])).to.equal(false);
        expect(isTrackableWebRtcSession("3", [3], undefined)).to.equal(false);
        expect(isTrackableWebRtcSession(null, undefined, [1])).to.equal(false);
    });

    it("rejects a session whose stream usage is non-integer or negative", () => {
        expect(isTrackableWebRtcSession(2.5, [3], undefined)).to.equal(false);
        expect(isTrackableWebRtcSession(-1, [3], undefined)).to.equal(false);
        expect(isTrackableWebRtcSession(NaN, [3], undefined)).to.equal(false);
    });

    it("accepts stream usage 0", () => {
        expect(isTrackableWebRtcSession(0, [3], undefined)).to.equal(true);
    });
});

describe("establishWebRtcProviderSession", () => {
    const NODE_ID = NodeId(5n);
    const ENDPOINT_ID = EndpointNumber(1);
    const ORIGINATING_ENDPOINT_ID = EndpointNumber(2);
    const FABRIC_INDEX = FabricIndex(1);

    function baseArgs(overrides: Partial<WebRtcProviderSessionArgs> = {}): WebRtcProviderSessionArgs {
        return {
            commandName: "ProvideOffer",
            fields: { streamUsage: 3, videoStreams: [1] },
            nodeId: NODE_ID,
            endpointId: ENDPOINT_ID,
            originatingEndpointId: ORIGINATING_ENDPOINT_ID,
            fabricIndex: FABRIC_INDEX,
            clusterRevision: 2,
            formatNode: id => `node-${id}`,
            ...overrides,
        };
    }

    it("throws when the device response carries no numeric webRtcSessionId", async () => {
        const io: WebRtcProviderSessionIo = {
            invoke: async () => ({}),
            upsertSession: async () => {},
        };

        let thrown: unknown;
        try {
            await establishWebRtcProviderSession(io, baseArgs());
        } catch (error) {
            thrown = error;
        }

        expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
    });

    it("injects originatingEndpointId into the fields sent to the device", async () => {
        const invokedFields = new Array<Record<string, unknown>>();
        const io: WebRtcProviderSessionIo = {
            invoke: async (_command, fields) => {
                invokedFields.push(fields);
                return { webRtcSessionId: 9 };
            },
            upsertSession: async () => {},
        };

        await establishWebRtcProviderSession(io, baseArgs());

        expect(invokedFields[0]?.originatingEndpointId).to.equal(ORIGINATING_ENDPOINT_ID);
    });

    it("establishes nothing when the request states both stream forms", async () => {
        // The refusal happens before the invoke, so the provider never creates a session this call
        // would then have to end.
        const invoked = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invoked.push(command);
                return { webRtcSessionId: 9 };
            },
            upsertSession: async () => {},
        };

        let thrown: unknown;
        try {
            await establishWebRtcProviderSession(
                io,
                baseArgs({
                    fields: { streamUsage: 3, videoStreams: [5], audioStreamId: null },
                    clusterRevision: 2,
                }),
            );
        } catch (error) {
            thrown = error;
        }
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        expect(invoked).to.deep.equal([]);
    });

    it("sends a legacy caller's singular stream id unchanged to a revision-2 provider", async () => {
        const invokedFields = new Array<Record<string, unknown>>();
        const io: WebRtcProviderSessionIo = {
            invoke: async (_command, fields) => {
                invokedFields.push(fields);
                return { webRtcSessionId: 9 };
            },
            upsertSession: async () => {},
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({ fields: { streamUsage: 3, videoStreamId: 4 }, clusterRevision: 2 }),
        );

        expect(invokedFields[0]?.videoStreamId).to.equal(4);
        expect("videoStreams" in (invokedFields[0] ?? {})).to.equal(false);
    });

    it("sends singular stream ids when the provider states no revision", async () => {
        const invokedFields = new Array<Record<string, unknown>>();
        const io: WebRtcProviderSessionIo = {
            invoke: async (_command, fields) => {
                invokedFields.push(fields);
                return { webRtcSessionId: 9 };
            },
            upsertSession: async () => {},
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({
                fields: { streamUsage: 3, videoStreams: [4], audioStreams: [8] },
                clusterRevision: undefined,
            }),
        );

        expect(invokedFields[0]?.videoStreamId).to.equal(4);
        expect(invokedFields[0]?.audioStreamId).to.equal(8);
        expect("videoStreams" in (invokedFields[0] ?? {})).to.equal(false);
        expect("audioStreams" in (invokedFields[0] ?? {})).to.equal(false);
    });

    it("tracks a trackable ProvideOffer session in the local requestor", async () => {
        const upserted = new Array<unknown>();
        const io: WebRtcProviderSessionIo = {
            invoke: async () => ({ webRtcSessionId: 9 }),
            upsertSession: async session => {
                upserted.push(session);
            },
        };

        await establishWebRtcProviderSession(io, baseArgs({ commandName: "ProvideOffer" }));

        expect(upserted).to.deep.equal([
            {
                id: 9,
                peerNodeId: NODE_ID,
                peerEndpointId: ENDPOINT_ID,
                streamUsage: 3,
                metadataEnabled: false,
                videoStreams: [1],
                audioStreams: undefined,
                fabricIndex: FABRIC_INDEX,
            },
        ]);
    });

    it("tracks a trackable SolicitOffer session in the local requestor", async () => {
        const upserted = new Array<unknown>();
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 11 };
            },
            upsertSession: async session => {
                upserted.push(session);
            },
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({ commandName: "SolicitOffer", fields: { streamUsage: 3, audioStreams: [2] } }),
        );

        expect(invokedCommands).to.deep.equal(["solicitOffer"]);
        expect(upserted).to.deep.equal([
            {
                id: 11,
                peerNodeId: NODE_ID,
                peerEndpointId: ENDPOINT_ID,
                streamUsage: 3,
                metadataEnabled: false,
                videoStreams: undefined,
                audioStreams: [2],
                fabricIndex: FABRIC_INDEX,
            },
        ]);
    });

    it("tears down the device session and throws when it cannot be tracked, without upserting it", async () => {
        const invokedCommands = new Array<string>();
        let upserted = false;
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 9 };
            },
            upsertSession: async () => {
                upserted = true;
            },
        };

        let thrown: unknown;
        try {
            // No streamUsage and no stream: nothing for the requestor to key signaling routing on.
            await establishWebRtcProviderSession(io, baseArgs({ fields: {} }));
        } catch (error) {
            thrown = error;
        }

        expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
        expect(invokedCommands).to.deep.equal(["provideOffer", "endSession"]);
        expect(upserted).to.equal(false);
    });

    it("ends the device session when the local requestor refuses to track it", async () => {
        // The device has the session and only this call knows its id. Returning without ending it
        // leaves the streams it references pinned at ReferenceCount > 0, with nothing able to name it.
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 9 };
            },
            upsertSession: async () => {
                throw new Error("requestor endpoint is gone");
            },
        };

        let thrown: unknown;
        try {
            await establishWebRtcProviderSession(io, baseArgs());
        } catch (error) {
            thrown = error;
        }

        expect((thrown as Error).message).to.equal("requestor endpoint is gone");
        expect(invokedCommands).to.deep.equal(["provideOffer", "endSession"]);
    });

    it("surfaces the untrackable-session error even when the EndSession cleanup itself fails", async () => {
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                if (command === "provideOffer") return { webRtcSessionId: 9 };
                throw new Error("device unreachable");
            },
            upsertSession: async () => {},
        };

        let thrown: unknown;
        try {
            // No streamUsage and no stream: nothing for the requestor to key signaling routing on.
            await establishWebRtcProviderSession(io, baseArgs({ fields: {} }));
        } catch (error) {
            thrown = error;
        }

        expect(invokedCommands).to.deep.equal(["provideOffer", "endSession"]);
        expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
        expect((thrown as ServerError).message).to.include("produced a session with no stream usage");
    });

    it("gives up on an EndSession the provider never answers and still reports the untrackable session", async () => {
        MockTime.reset();
        try {
            let entered = (): void => {};
            const endSessionEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            const io: WebRtcProviderSessionIo = {
                invoke: async command => {
                    if (command !== "endSession") return { webRtcSessionId: 9 };
                    entered();
                    return new Promise<never>(() => {});
                },
                upsertSession: async () => {},
            };

            const establishing = establishWebRtcProviderSession(io, baseArgs({ fields: {} })).then(
                () => undefined,
                (error: unknown) => error,
            );
            await endSessionEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);

            const thrown = await establishing;
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.SDKStackError);
            expect((thrown as ServerError).message).to.include("produced a session with no stream usage");
        } finally {
            MockTime.disable();
        }
    });

    it("gives up on an EndSession the provider never answers when the requestor refuses the session", async () => {
        MockTime.reset();
        try {
            let entered = (): void => {};
            const endSessionEntered = new Promise<void>(resolve => {
                entered = resolve;
            });
            const io: WebRtcProviderSessionIo = {
                invoke: async command => {
                    if (command !== "endSession") return { webRtcSessionId: 9 };
                    entered();
                    return new Promise<never>(() => {});
                },
                upsertSession: async () => {
                    throw new Error("requestor endpoint is gone");
                },
            };

            const establishing = establishWebRtcProviderSession(io, baseArgs()).then(
                () => undefined,
                (error: unknown) => error,
            );
            await endSessionEntered;
            await MockTime.advance(DEVICE_CLEANUP_BUDGET_MS);

            expect(((await establishing) as Error).message).to.equal("requestor endpoint is gone");
        } finally {
            MockTime.disable();
        }
    });
});

describe("tracksSessionOf", () => {
    const CAMERA_A = NodeId(5n);
    const CAMERA_B = NodeId(6n);
    const ENDPOINT_1 = EndpointNumber(1);
    const ENDPOINT_2 = EndpointNumber(2);

    function session(
        id: number,
        peerNodeId: NodeId,
        peerEndpointId: EndpointNumber,
    ): WebRtcTransportDefinitions.WebRtcSession {
        return {
            id,
            peerNodeId,
            peerEndpointId,
            streamUsage: StreamUsage.LiveView,
            videoStreams: [1],
            audioStreams: undefined,
            metadataEnabled: false,
            fabricIndex: FabricIndex(1),
        };
    }

    it("names the session the given camera issued", () => {
        const sessions = [session(1, CAMERA_A, ENDPOINT_1)];
        expect(tracksSessionOf(sessions, 1, CAMERA_A, ENDPOINT_1)).to.equal(true);
    });

    it("does not name another camera's session carrying the same id", () => {
        // WebRTCSessionID is allocated per provider, so two cameras both issuing id 1 is ordinary.
        const sessions = [session(1, CAMERA_B, ENDPOINT_1)];
        expect(tracksSessionOf(sessions, 1, CAMERA_A, ENDPOINT_1)).to.equal(false);
    });

    it("does not name a session of another endpoint on the same node", () => {
        const sessions = [session(1, CAMERA_A, ENDPOINT_2)];
        expect(tracksSessionOf(sessions, 1, CAMERA_A, ENDPOINT_1)).to.equal(false);
    });

    it("reports nothing for an id no entry carries", () => {
        expect(tracksSessionOf([session(2, CAMERA_A, ENDPOINT_1)], 1, CAMERA_A, ENDPOINT_1)).to.equal(false);
    });
});
