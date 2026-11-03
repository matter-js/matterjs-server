/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber } from "./attribute-shapes.js";
import { decodeSemanticTagList, type SemanticTagListEntry } from "./semantic-tags.js";

export const AMBIENT_CONTEXT_SENSING_CLUSTER_ID = 1073;

const ATTR_HUMAN_ACTIVITY_DETECTED = 0;
const ATTR_OBJECT_IDENTIFIED = 1;
const ATTR_AUDIO_CONTEXT_DETECTED = 2;
const ATTR_AMBIENT_CONTEXT_TYPE = 3;
const ATTR_AMBIENT_CONTEXT_TYPE_SUPPORTED = 4;
const ATTR_OBJECT_COUNT_THRESHOLD_REACHED = 5;
const ATTR_OBJECT_COUNT_CONFIG = 6;
const ATTR_OBJECT_COUNT = 7;
const ATTR_SIMULTANEOUS_DETECTION_LIMIT = 8;
const ATTR_HOLD_TIME = 9;
const ATTR_HOLD_TIME_LIMITS = 10;
const ATTR_PREDICTED_ACTIVITY = 11;
const ATTR_FEATURE_MAP = 0xfffc;

/** AmbientContextSensing FeatureMap bits per Matter 1.6.1 § 2.16.5. */
const FEATURE_BIT_HUMAN_ACTIVITY = 0b1;
const FEATURE_BIT_OBJECT_COUNTING = 0b10;
const FEATURE_BIT_OBJECT_IDENTIFICATION = 0b100;
const FEATURE_BIT_SOUND_IDENTIFICATION = 0b1000;
const FEATURE_BIT_PREDICTED_ACTIVITY = 0b10000;

export interface AmbientContextSensingFeatures {
    humanActivity: boolean;
    objectCounting: boolean;
    objectIdentification: boolean;
    soundIdentification: boolean;
    predictedActivity: boolean;
}

export interface ObjectCountConfigInfo {
    countingObject?: SemanticTagListEntry;
    objectCountThreshold?: number;
}

export interface HoldTimeLimitsInfo {
    holdTimeMin?: number;
    holdTimeMax?: number;
    holdTimeDefault?: number;
}

export interface AmbientContextTypeEntry {
    ambientContextSensed: SemanticTagListEntry[];
}

export interface PredictedActivityEntry {
    startTimestamp?: number;
    endTimestamp?: number;
    ambientContextType: SemanticTagListEntry[];
    crowdDetected?: boolean;
    crowdCount?: number;
    confidence?: number;
}

export interface AmbientContextSensingInfo {
    supported: boolean;
    features: AmbientContextSensingFeatures;
    humanActivityDetected?: boolean;
    objectIdentified?: boolean;
    audioContextDetected?: boolean;
    ambientContextType: AmbientContextTypeEntry[];
    ambientContextTypeSupported: SemanticTagListEntry[];
    objectCountThresholdReached?: boolean;
    objectCountConfig?: ObjectCountConfigInfo;
    objectCount?: number;
    simultaneousDetectionLimit?: number;
    holdTime?: number;
    holdTimeLimits?: HoldTimeLimitsInfo;
    predictedActivity: PredictedActivityEntry[];
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${AMBIENT_CONTEXT_SENSING_CLUSTER_ID}/${attributeId}`];
}

function toBool(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

/** A single SemanticTagStruct field, as opposed to a `semtag` list attribute. */
function decodeSingleSemtag(value: unknown): SemanticTagListEntry | undefined {
    if (value === undefined) return undefined;
    return decodeSemanticTagList([value])?.[0];
}

function decodeAmbientContextTypeList(value: unknown): AmbientContextTypeEntry[] {
    if (!Array.isArray(value)) return [];
    return value.map(entry => ({
        ambientContextSensed: decodeSemanticTagList(field(entry, 0)) ?? [],
    }));
}

function decodeObjectCountConfig(value: unknown): ObjectCountConfigInfo | undefined {
    if (value === undefined) return undefined;
    const countingObject = decodeSingleSemtag(field(value, 0));
    const objectCountThreshold = toNumber(field(value, 1));
    if (countingObject === undefined && objectCountThreshold === undefined) return undefined;
    return { countingObject, objectCountThreshold };
}

function decodeHoldTimeLimits(value: unknown): HoldTimeLimitsInfo | undefined {
    if (value === undefined) return undefined;
    const holdTimeMin = toNumber(field(value, 0));
    const holdTimeMax = toNumber(field(value, 1));
    const holdTimeDefault = toNumber(field(value, 2));
    if (holdTimeMin === undefined && holdTimeMax === undefined && holdTimeDefault === undefined) return undefined;
    return { holdTimeMin, holdTimeMax, holdTimeDefault };
}

function decodePredictedActivityList(value: unknown): PredictedActivityEntry[] {
    if (!Array.isArray(value)) return [];
    return value.map(entry => ({
        startTimestamp: toNumber(field(entry, 0)),
        endTimestamp: toNumber(field(entry, 1)),
        ambientContextType: decodeSemanticTagList(field(entry, 2)) ?? [],
        crowdDetected: toBool(field(entry, 3)),
        crowdCount: toNumber(field(entry, 4)),
        confidence: toNumber(field(entry, 5)),
    }));
}

export function ambientContextSensingInfo(
    attributes: Record<string, unknown>,
    endpoint: number,
): AmbientContextSensingInfo {
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP)) ?? 0;

    return {
        supported: attr(attributes, endpoint, ATTR_FEATURE_MAP) !== undefined,
        features: {
            humanActivity: (featureMap & FEATURE_BIT_HUMAN_ACTIVITY) !== 0,
            objectCounting: (featureMap & FEATURE_BIT_OBJECT_COUNTING) !== 0,
            objectIdentification: (featureMap & FEATURE_BIT_OBJECT_IDENTIFICATION) !== 0,
            soundIdentification: (featureMap & FEATURE_BIT_SOUND_IDENTIFICATION) !== 0,
            predictedActivity: (featureMap & FEATURE_BIT_PREDICTED_ACTIVITY) !== 0,
        },
        humanActivityDetected: toBool(attr(attributes, endpoint, ATTR_HUMAN_ACTIVITY_DETECTED)),
        objectIdentified: toBool(attr(attributes, endpoint, ATTR_OBJECT_IDENTIFIED)),
        audioContextDetected: toBool(attr(attributes, endpoint, ATTR_AUDIO_CONTEXT_DETECTED)),
        ambientContextType: decodeAmbientContextTypeList(attr(attributes, endpoint, ATTR_AMBIENT_CONTEXT_TYPE)),
        ambientContextTypeSupported:
            decodeSemanticTagList(attr(attributes, endpoint, ATTR_AMBIENT_CONTEXT_TYPE_SUPPORTED)) ?? [],
        objectCountThresholdReached: toBool(attr(attributes, endpoint, ATTR_OBJECT_COUNT_THRESHOLD_REACHED)),
        objectCountConfig: decodeObjectCountConfig(attr(attributes, endpoint, ATTR_OBJECT_COUNT_CONFIG)),
        objectCount: toNumber(attr(attributes, endpoint, ATTR_OBJECT_COUNT)),
        simultaneousDetectionLimit: toNumber(attr(attributes, endpoint, ATTR_SIMULTANEOUS_DETECTION_LIMIT)),
        holdTime: toNumber(attr(attributes, endpoint, ATTR_HOLD_TIME)),
        holdTimeLimits: decodeHoldTimeLimits(attr(attributes, endpoint, ATTR_HOLD_TIME_LIMITS)),
        predictedActivity: decodePredictedActivityList(attr(attributes, endpoint, ATTR_PREDICTED_ACTIVITY)),
    };
}
