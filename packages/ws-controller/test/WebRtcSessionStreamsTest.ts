/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import {
    establishWebRtcProviderSession,
    isTrackableWebRtcSession,
    resolveWebRtcSessionStreams,
    selectWebRtcStreamFields,
} from "../src/controller/webRtcSessionStreams.js";
import type { WebRtcProviderSessionArgs, WebRtcProviderSessionIo } from "../src/controller/webRtcSessionStreams.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

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

    it("synthesises the lists from a legacy caller's singular ids for a rev-2 provider", () => {
        const fields: Record<string, unknown> = { videoStreamId: 5, audioStreamId: null };
        selectWebRtcStreamFields(fields, 3);
        expect(fields).to.deep.equal({ videoStreams: [5] });
    });

    it("down-converts the lists to singular ids for a rev-1 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [7], audioStreams: [9] };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: 7, audioStreamId: 9 });
    });

    it("truncates a multi-stream list to its first entry for a rev-1 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [3, 5] };
        selectWebRtcStreamFields(fields, 1);
        expect(fields).to.deep.equal({ videoStreamId: 3 });
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

    it("drops a null auto-select on the other media kind once any list is sent to a rev-2 provider", () => {
        const fields: Record<string, unknown> = { videoStreams: [5], audioStreamId: null };
        selectWebRtcStreamFields(fields, 2);
        expect(fields).to.deep.equal({ videoStreams: [5] });
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
});
