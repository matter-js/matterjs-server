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
    trackedSessionOf,
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
        // Deprecated, not invalid, on revision 2; the null is an auto-select the list form cannot state.
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
        // The provider's INVALID_COMMAND check spans both media kinds; dropping the id would lose the audio.
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
        // The field takes 1 to 16 entries.
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
        // The conversion writes one media kind at a time, so a refusal must not leave it half-converted.
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
            offerSent: () => () => {},
            tracks: () => false,
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
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async () => {},
        };

        await establishWebRtcProviderSession(io, baseArgs());

        expect(invokedFields[0]?.originatingEndpointId).to.equal(ORIGINATING_ENDPOINT_ID);
    });

    it("establishes nothing when the request states both stream forms", async () => {
        const invoked = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invoked.push(command);
                return { webRtcSessionId: 9 };
            },
            offerSent: () => () => {},
            tracks: () => false,
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
            offerSent: () => () => {},
            tracks: () => false,
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
            offerSent: () => () => {},
            tracks: () => false,
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

    it("states the session id before the local requestor is given the session", async () => {
        // Once the requestor holds the session it answers the peer's End, so the caller needs the id first.
        const steps = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async () => ({ webRtcSessionId: 9 }),
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async () => {
                steps.push("upsert");
            },
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({
                commandName: "ProvideOffer",
                sessionEstablishing: webRtcSessionId => steps.push(`establishing:${webRtcSessionId}`),
            }),
        );

        expect(steps).to.deep.equal(["establishing:9", "upsert"]);
    });

    it("states a new session's offer before the local requestor is given the session", async () => {
        const steps = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async () => {
                steps.push("invoke");
                return { webRtcSessionId: 9 };
            },
            offerSent: (webRtcSessionId, sdp) => {
                steps.push(`offer:${webRtcSessionId}:${sdp}`);
                return () => steps.push(`withdraw:${webRtcSessionId}`);
            },
            tracks: () => false,
            upsertSession: async () => {
                steps.push("upsert");
            },
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({ commandName: "ProvideOffer", fields: { streamUsage: 3, videoStreams: [1], sdp: "v=0" } }),
        );

        expect(steps).to.deep.equal(["invoke", "offer:9:v=0", "upsert"]);
    });

    it("states a re-offer before it is sent, and withdraws it when the requestor does not hold the session", async () => {
        const steps = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async () => {
                steps.push("invoke");
                return { webRtcSessionId: 5 };
            },
            offerSent: (webRtcSessionId, sdp) => {
                steps.push(`offer:${webRtcSessionId}:${sdp}`);
                return () => steps.push(`withdraw:${webRtcSessionId}`);
            },
            tracks: () => false,
            upsertSession: async () => {
                steps.push("upsert");
            },
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({ commandName: "ProvideOffer", fields: { webRtcSessionId: 5, sdp: "v=0" } }),
        );

        expect(steps).to.deep.equal(["offer:5:v=0", "invoke", "withdraw:5"]);
    });

    it("tracks a trackable ProvideOffer session in the local requestor", async () => {
        const upserted = new Array<unknown>();
        const io: WebRtcProviderSessionIo = {
            invoke: async () => ({ webRtcSessionId: 9 }),
            offerSent: () => () => {},
            tracks: () => false,
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
            offerSent: () => () => {},
            tracks: () => false,
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

    it("tracks a ProvideOffer that asks for a new session with a null session id", async () => {
        const upserted = new Array<unknown>();
        const io: WebRtcProviderSessionIo = {
            invoke: async () => ({ webRtcSessionId: 9 }),
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async session => {
                upserted.push(session);
            },
        };

        await establishWebRtcProviderSession(
            io,
            baseArgs({ fields: { webRtcSessionId: null, sdp: "v=0", streamUsage: 3, videoStreams: [1] } }),
        );

        expect(upserted).to.have.length(1);
    });

    it("sends a re-offer without stream usage or streams and leaves the session it names alone", async () => {
        const invokedCommands = new Array<string>();
        const steps = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 7 };
            },
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async () => {
                steps.push("upsert");
            },
        };

        const response = await establishWebRtcProviderSession(
            io,
            baseArgs({
                fields: { webRtcSessionId: 7, sdp: "v=0" },
                sessionEstablishing: id => steps.push(`establishing:${id}`),
            }),
        );

        expect(response).to.deep.equal({ webRtcSessionId: 7 });
        expect(invokedCommands).to.deep.equal(["provideOffer"]);
        expect(steps).to.deep.equal([]);
    });

    it("tracks a re-offer that restates usage and streams only when no entry exists, without announcing it", async () => {
        const upserts = new Array<{ session: WebRtcTransportDefinitions.WebRtcSession; onlyIfAbsent?: boolean }>();
        const announced = new Array<number>();
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 7 };
            },
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async (session, options) => {
                upserts.push({ session, onlyIfAbsent: options?.onlyIfAbsent });
            },
        };

        const response = await establishWebRtcProviderSession(
            io,
            baseArgs({
                fields: { webRtcSessionId: 7, sdp: "v=0", streamUsage: 4, audioStreams: [2] },
                sessionEstablishing: id => announced.push(id),
            }),
        );

        expect(response).to.deep.equal({ webRtcSessionId: 7 });
        expect(invokedCommands).to.deep.equal(["provideOffer"]);
        expect(upserts).to.have.length(1);
        expect(upserts[0].onlyIfAbsent).to.equal(true);
        expect(upserts[0].session.id).to.equal(7);
        expect(upserts[0].session.audioStreams).to.deep.equal([2]);
        expect(announced).to.deep.equal([]);
    });

    it("returns a re-offer's response and ends nothing when the entry cannot be added", async () => {
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 7 };
            },
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async () => {
                throw new Error("requestor unavailable");
            },
        };

        const response = await establishWebRtcProviderSession(
            io,
            baseArgs({ fields: { webRtcSessionId: 7, sdp: "v=0", streamUsage: 4, audioStreams: [2] } }),
        );

        expect(response).to.deep.equal({ webRtcSessionId: 7 });
        expect(invokedCommands).to.deep.equal(["provideOffer"]);
    });

    it("passes a re-offer's NOT_FOUND through without ending any session", async () => {
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                throw new Error("NOT_FOUND");
            },
            offerSent: () => () => {},
            tracks: () => false,
            upsertSession: async () => {},
        };

        let thrown: unknown;
        try {
            await establishWebRtcProviderSession(io, baseArgs({ fields: { webRtcSessionId: 7, sdp: "v=0" } }));
        } catch (error) {
            thrown = error;
        }

        expect((thrown as Error).message).to.equal("NOT_FOUND");
        expect(invokedCommands).to.deep.equal(["provideOffer"]);
    });

    it("tears down the device session and throws when it cannot be tracked, without upserting it", async () => {
        const invokedCommands = new Array<string>();
        let upserted = false;
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 9 };
            },
            offerSent: () => () => {},
            tracks: () => false,
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
        // Only this call knows the id; a session left open pins its streams at ReferenceCount > 0.
        const invokedCommands = new Array<string>();
        const io: WebRtcProviderSessionIo = {
            invoke: async command => {
                invokedCommands.push(command);
                return { webRtcSessionId: 9 };
            },
            offerSent: () => () => {},
            tracks: () => false,
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
            offerSent: () => () => {},
            tracks: () => false,
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
                offerSent: () => () => {},
                tracks: () => false,
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
                offerSent: () => () => {},
                tracks: () => false,
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

    describe("recorded offers", () => {
        interface OfferRecording {
            io: WebRtcProviderSessionIo;
            steps: string[];
        }

        function recording(behaviour: {
            invoke?: (command: string) => Promise<unknown>;
            tracked?: boolean;
            upsert?: () => Promise<void>;
        }): OfferRecording {
            const steps = new Array<string>();
            const io: WebRtcProviderSessionIo = {
                invoke: async command => {
                    steps.push(command);
                    return behaviour.invoke === undefined ? { webRtcSessionId: 9 } : behaviour.invoke(command);
                },
                offerSent: (webRtcSessionId, sdp) => {
                    steps.push(`offer:${webRtcSessionId}:${sdp}`);
                    return () => steps.push(`withdraw:${webRtcSessionId}`);
                },
                tracks: () => behaviour.tracked ?? false,
                upsertSession: async () => {
                    steps.push("upsert");
                    await behaviour.upsert?.();
                },
            };
            return { io, steps };
        }

        async function failureOf(work: Promise<unknown>): Promise<unknown> {
            try {
                await work;
            } catch (error) {
                return error;
            }
            return undefined;
        }

        const NEW_OFFER = { streamUsage: 3, videoStreams: [1], sdp: "v=0" };
        const RE_OFFER = { webRtcSessionId: 9, sdp: "v=0" };

        it("withdraws a new session's offer when the local requestor refuses the session", async () => {
            const { io, steps } = recording({
                upsert: async () => {
                    throw new Error("requestor endpoint is gone");
                },
            });

            await failureOf(establishWebRtcProviderSession(io, baseArgs({ fields: NEW_OFFER })));

            expect(steps).to.deep.equal(["provideOffer", "offer:9:v=0", "upsert", "withdraw:9", "endSession"]);
        });

        it("keeps a new session's offer once the requestor holds the session", async () => {
            const { io, steps } = recording({ tracked: true });

            await establishWebRtcProviderSession(io, baseArgs({ fields: NEW_OFFER }));

            expect(steps).to.deep.equal(["provideOffer", "offer:9:v=0", "upsert"]);
        });

        it("records no offer for a new session it cannot track", async () => {
            const { io, steps } = recording({});

            await failureOf(establishWebRtcProviderSession(io, baseArgs({ fields: { sdp: "v=0" } })));

            expect(steps).to.deep.equal(["provideOffer", "endSession"]);
        });

        it("withdraws a re-offer the camera refused, although the requestor holds the session", async () => {
            const { io, steps } = recording({
                tracked: true,
                invoke: async () => {
                    throw new Error("busy");
                },
            });

            await failureOf(establishWebRtcProviderSession(io, baseArgs({ fields: RE_OFFER })));

            expect(steps).to.deep.equal(["offer:9:v=0", "provideOffer", "withdraw:9"]);
        });

        it("withdraws a re-offer whose response names no session", async () => {
            const { io, steps } = recording({ tracked: true, invoke: async () => ({}) });

            await failureOf(establishWebRtcProviderSession(io, baseArgs({ fields: RE_OFFER })));

            expect(steps).to.deep.equal(["offer:9:v=0", "provideOffer", "withdraw:9"]);
        });

        it("keeps an accepted re-offer of a session the requestor holds", async () => {
            const { io, steps } = recording({ tracked: true });

            await establishWebRtcProviderSession(io, baseArgs({ fields: RE_OFFER }));

            expect(steps).to.deep.equal(["offer:9:v=0", "provideOffer"]);
        });

        it("withdraws an accepted re-offer when tracking it failed and the requestor does not hold it", async () => {
            const { io, steps } = recording({
                upsert: async () => {
                    throw new Error("requestor endpoint is gone");
                },
            });

            await establishWebRtcProviderSession(
                io,
                baseArgs({ fields: { ...RE_OFFER, streamUsage: 3, videoStreams: [1] } }),
            );

            expect(steps).to.deep.equal(["offer:9:v=0", "provideOffer", "upsert", "withdraw:9"]);
        });
    });
});

describe("trackedSessionOf", () => {
    const CAMERA_A = NodeId(5n);
    const CAMERA_B = NodeId(6n);
    const ENDPOINT_1 = EndpointNumber(1);
    const ENDPOINT_2 = EndpointNumber(2);
    const FABRIC = FabricIndex(1);

    function session(
        id: number,
        peerNodeId: NodeId,
        peerEndpointId: EndpointNumber,
        fabricIndex = FABRIC,
    ): WebRtcTransportDefinitions.WebRtcSession {
        return {
            id,
            peerNodeId,
            peerEndpointId,
            streamUsage: StreamUsage.LiveView,
            videoStreams: [1],
            audioStreams: undefined,
            metadataEnabled: false,
            fabricIndex,
        };
    }

    const keyOfA = (id: number) => ({ id, fabricIndex: FABRIC, peerNodeId: CAMERA_A });

    it("names the session the given camera issued", () => {
        const sessions = [session(1, CAMERA_A, ENDPOINT_1)];
        expect(trackedSessionOf(sessions, keyOfA(1), ENDPOINT_1)).to.equal(sessions[0]);
    });

    it("names each camera's own session when two cameras issued the same id", () => {
        // WebRTCSessionID is allocated per provider, so two cameras both issuing id 1 is ordinary.
        const sessions = [session(1, CAMERA_B, ENDPOINT_1), session(1, CAMERA_A, ENDPOINT_1)];
        expect(trackedSessionOf(sessions, keyOfA(1), ENDPOINT_1)).to.equal(sessions[1]);
    });

    it("does not name another camera's session carrying the same id", () => {
        expect(trackedSessionOf([session(1, CAMERA_B, ENDPOINT_1)], keyOfA(1), ENDPOINT_1)).to.equal(undefined);
    });

    it("does not name the same camera's session on another fabric", () => {
        const sessions = [session(1, CAMERA_A, ENDPOINT_1, FabricIndex(2))];
        expect(trackedSessionOf(sessions, keyOfA(1), ENDPOINT_1)).to.equal(undefined);
    });

    it("does not name a session of another endpoint on the same node", () => {
        expect(trackedSessionOf([session(1, CAMERA_A, ENDPOINT_2)], keyOfA(1), ENDPOINT_1)).to.equal(undefined);
    });

    it("reports nothing for an id no entry carries", () => {
        expect(trackedSessionOf([session(2, CAMERA_A, ENDPOINT_1)], keyOfA(1), ENDPOINT_1)).to.equal(undefined);
    });
});
