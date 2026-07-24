/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { matterNameToWireField, toChipName } from "@matter-server/ws-client";

describe("wire-naming", () => {
    describe("matterNameToWireField", () => {
        it("uppercases a trailing ID acronym", () => {
            expect(matterNameToWireField("VideoStreamId")).to.equal("videoStreamID");
            expect(matterNameToWireField("WebRtcSessionId")).to.equal("webRtcSessionID");
        });

        it("uppercases interior acronyms", () => {
            expect(matterNameToWireField("SetupPin")).to.equal("setupPIN");
            expect(matterNameToWireField("PakePasscodeVerifier")).to.equal("PAKEPasscodeVerifier");
            expect(matterNameToWireField("DstOffsetActive")).to.equal("DSTOffsetActive");
        });

        it("applies per-name overrides", () => {
            expect(matterNameToWireField("Id")).to.equal("id");
            expect(matterNameToWireField("NocsrElements")).to.equal("NOCSRElements");
            expect(matterNameToWireField("PanId")).to.equal("panId");
        });

        it("applies cluster-qualified overrides", () => {
            expect(matterNameToWireField("RmsVoltage", "DraftElectricalMeasurementCluster")).to.equal("rmsVoltage");
            expect(matterNameToWireField("RmsVoltage")).to.equal("RMSVoltage");
        });

        it("leaves acronym-free names as plain camelCase", () => {
            expect(matterNameToWireField("SoftwareVersion")).to.equal("softwareVersion");
            expect(matterNameToWireField("FabricIndex")).to.equal("fabricIndex");
        });
    });

    describe("toChipName", () => {
        it("preserves known acronyms at word boundaries", () => {
            expect(toChipName("AnnounceOtaProvider")).to.equal("AnnounceOTAProvider");
            expect(toChipName("VideoStreamId")).to.equal("VideoStreamID");
        });
    });
});
