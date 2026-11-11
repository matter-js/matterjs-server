/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterModel, Matter, ValueModel } from "@matter/main/model";
import "../src/register.js";

function cluster(id: number) {
    const model = Matter.children.find(child => child.tag === "cluster" && child.id === id);
    expect(model, `cluster 0x${id.toString(16)} is registered`).to.exist;
    return model as ClusterModel;
}

function names(model: { children: Iterable<{ name?: string }> } | null | undefined) {
    return [...(model?.children ?? [])].map(child => child.name);
}

describe("Aqara FP400 clusters", () => {
    it("models the configuration cluster from the ambient sensing extension", () => {
        const config = cluster(0x115ffc0a);

        expect(config.features.map(feature => [Number(feature.key), feature.name])).to.deep.equal([
            [0, "ZONE"],
            [1, "INSTALL"],
            [2, "Fall"],
            [3, "PIR"],
        ]);

        expect([...config.attributes].map(attribute => [attribute.id, attribute.name])).to.deep.include.members([
            [0x0000, "installModeSelection"],
            [0x0002, "sideInstallSelection"],
            [0x0004, "installHeightSetting"],
            [0x0007, "installStatus"],
            [0x0010, "zones"],
            [0x0011, "maxDetectionZones"],
            [0x0015, "interferenceSourceRecognitionReportingTimeout"],
            [0x0016, "aiSpaceBackgroundLearningReportingTimeout"],
            [0x0027, "enableActivityDetection"],
            [0x002f, "proximityDistanceLevelSetting"],
            [0x0030, "enableFallDetection"],
            [0x0040, "detectionRangeBitmask"],
            [0x0050, "sensingMode"],
        ]);

        expect(
            [...config.commands].filter(command => command.isRequest).map(command => [command.id, command.name]),
        ).to.deep.equal([
            [0x00, "subscribeAutoInterferenceSourceRecognitionData"],
            [0x01, "subscribeAutoEdgeRecognitionData"],
            [0x02, "subscribeAiEntryExitRegionData"],
            [0x03, "enableAiSpaceBackgroundLearning"],
            [0x04, "appendZone"],
            [0x06, "updateZone"],
            [0x08, "removeZone"],
            [0x0a, "setZones"],
            [0x0c, "subscribeDetectionRangeTargetPosition"],
        ]);

        expect([...config.events].map(event => [event.id, event.name])).to.deep.equal([
            [0x00, "autoInterferenceSourceRecognition"],
            [0x01, "autoEdgeRecognition"],
            [0x02, "aiEntryExitRegion"],
            [0x03, "aiSpaceBackgroundLearningComplete"],
            [0x04, "detectionRangeTargetPosition"],
        ]);
    });

    it("types a zone as ZoneID, ZoneType, a 40-byte bitmask and proximity enable", () => {
        const zones = [...cluster(0x115ffc0a).attributes].find(attribute => attribute.name === "zones");
        const entry = zones?.operationalBase?.children[0];

        expect(entry?.operationalBase?.name).to.equal("AqaraZoneInfoStruct");
        expect(names(entry?.operationalBase)).to.deep.equal([
            "zoneId",
            "zoneType",
            "zoneBitmask",
            "zoneProximityDetectionEnable",
        ]);
        expect(entry?.operationalBase?.children[1].operationalBase?.type).to.equal("enum16");
    });

    it("splits the union cluster into leader and child features", () => {
        const union = cluster(0x115ffc0b);

        expect(union.name).to.equal("AqaraAmbientSensingUnionCluster");
        expect(union.features.map(feature => [Number(feature.key), feature.name])).to.deep.equal([
            [0, "LEADER"],
            [1, "CHILD"],
        ]);

        const humanCount = [...union.attributes].find(attribute => attribute.id === 0x0002);
        expect(humanCount?.operationalBase?.name).to.equal("uint16");
        expect(humanCount?.effectiveQuality.nullable).to.equal(true);

        expect([...union.events].map(event => event.name)).to.deep.equal([
            "motionState",
            "visitCountDelta",
            "occupancyDurationDelta",
            "walkingDistanceDelta",
            "humanEntryCountDelta",
            "humanExitCountDelta",
        ]);

        const motion = [...union.events].find(event => event.name === "motionState");
        expect(names(motion?.operationalBase?.children[0]?.operationalBase)).to.deep.equal([
            "Enter",
            "Leave",
            "LeftIn",
            "RightOut",
            "RightIn",
            "LeftOut",
            "Approach",
            "Depart",
        ]);
    });

    it("reports a target as coordinates, velocity, type and posture", () => {
        const location = cluster(0x115ffc0c);
        const event = [...location.events].find(item => item.id === 0x00);
        const payload = event?.operationalBase?.children[0];
        const target = payload instanceof ValueModel ? payload.listEntry : undefined;

        expect(event?.name).to.equal("location");
        expect(names(target?.operationalBase)).to.deep.equal([
            "targetId",
            "targetXCoordinate",
            "targetYCoordinate",
            "targetZCoordinate",
            "targetVelocity",
            "targetSignalToNoiseRatio",
            "targetType",
            "targetPosture",
            "targetZoneId",
        ]);

        expect([...location.commands].filter(command => command.isRequest).map(command => command.name)).to.deep.equal([
            "subscribeLocationData",
            "removeDetectionTarget",
        ]);
        expect(
            [...location.attributes]
                .filter(attribute => attribute.id !== undefined && attribute.id < 0x1000)
                .map(attribute => attribute.name),
        ).to.deep.equal([
            "maxDetectionTargets",
            "walkingState",
            "sittingState",
            "standingState",
            "lyingState",
            "largeMotionState",
            "fallState",
            "activityState",
        ]);
    });
});
