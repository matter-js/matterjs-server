/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateClusterSource } from "../src/zap-xml/generate-source.js";
import { parseXml } from "../src/zap-xml/simple-xml.js";
import { extractClusters, mapZclType, toCamelCase, toPascalCase } from "../src/zap-xml/zap-cluster.js";
import { SAMPLE_MEI_CLUSTER_XML, WEATHER_STATION_CLUSTER_XML } from "./fixtures.js";

describe("generate-cluster-from-zap-xml", () => {
    describe("extractClusters", () => {
        it("parses the connectedhomeip sample MEI cluster", () => {
            const [cluster] = extractClusters(parseXml(SAMPLE_MEI_CLUSTER_XML));

            expect(cluster.name).to.equal("Sample MEI");
            expect(cluster.code).to.deep.equal({ value: 0xfff1fc20, digits: 8 });

            expect(cluster.attributes).to.have.length(1);
            const [flipFlop] = cluster.attributes;
            expect(flipFlop.propertyName).to.equal("flipFlop");
            expect(flipFlop.zclType).to.equal("boolean");
            expect(flipFlop.writable).to.equal(true);
            expect(flipFlop.mandatory).to.equal(true);

            // Ping has no response and no args -> translatable.
            expect(cluster.commands.map(c => c.name)).to.deep.equal(["Ping"]);

            // AddArguments has a response link -> not auto-generated.
            expect(cluster.commandsNeedingReview.map(c => c.name)).to.deep.equal(["AddArguments"]);

            // AddArgumentsResponse is a response shape only, referenced by AddArguments -> silently dropped.
            expect(cluster.skipped.some(s => s.name === "AddArgumentsResponse")).to.equal(false);

            expect(cluster.events.map(e => e.name)).to.deep.equal(["PingCountEvent"]);
        });

        it("maps ZCL types case-insensitively and camelCases space-separated attribute names", () => {
            const [cluster] = extractClusters(parseXml(WEATHER_STATION_CLUSTER_XML));

            expect(cluster.attributes.map(a => a.propertyName)).to.deep.equal([
                "windSpeed",
                "windDirection",
                "rainfall",
            ]);
            expect(cluster.attributes.map(a => a.zclType)).to.deep.equal(["SINGLE", "INT32U", "SINGLE"]);
            expect(cluster.attributes.map(a => mapZclType(a.zclType))).to.deep.equal(["single", "uint32", "single"]);
        });
    });

    describe("generateClusterSource", () => {
        it("renders a decorator-annotated class matching the hand-written clusters' style", () => {
            const [cluster] = extractClusters(parseXml(SAMPLE_MEI_CLUSTER_XML));
            const { source, notes } = generateClusterSource(cluster, "SampleMeiCluster");

            expect(notes).to.deep.equal([]);
            expect(source).to.include(
                'import { attribute, bool, cluster, command, mandatory, writable } from "@matter/main/model";',
            );
            expect(source).to.include("@cluster(0xfff1fc20)");
            expect(source).to.include("export class SampleMeiCluster {");
            expect(source).to.include("@attribute(0x0000, bool, writable, mandatory)");
            expect(source).to.include("flipFlop?: boolean;");
            expect(source).to.include("@command(0x00)");
            expect(source).to.include("ping(): void {}");

            // Response-linked commands and events are reported, not guessed at.
            expect(source).to.include('command "AddArguments" (0x02, response: AddArgumentsResponse)');
            expect(source).to.include('event "PingCountEvent" (0x0000)');
        });

        it("renders array attributes as listOf(...) and preserves attribute code width", () => {
            const [cluster] = extractClusters(
                parseXml(`<?xml version="1.0"?>
<configurator><cluster>
    <name>Array Test</name>
    <code>0xFFF10001</code>
    <attribute side="server" code="0x0000" type="array" entryType="int16u" optional="true">Values</attribute>
</cluster></configurator>`),
            );
            const { source } = generateClusterSource(cluster, "ArrayTestCluster");

            expect(source).to.include("import { attribute, cluster, listOf, uint16 } from");
            expect(source).to.include("@attribute(0x0000, listOf(uint16))");
            expect(source).to.include("values?: number[];");
        });

        it("reports unmapped datatypes instead of guessing", () => {
            const [cluster] = extractClusters(
                parseXml(`<?xml version="1.0"?>
<configurator><cluster>
    <name>Struct Test</name>
    <code>0xFFF10002</code>
    <attribute side="server" code="0x0000" type="MyCustomStruct" optional="true">Thing</attribute>
</cluster></configurator>`),
            );
            const { source, notes } = generateClusterSource(cluster, "StructTestCluster");

            expect(notes).to.deep.equal(['attribute "Thing": type "MyCustomStruct" has no known mapping']);
            expect(source).to.not.include("thing");
        });
    });

    describe("toCamelCase / toPascalCase", () => {
        it("camelCases PascalCase ZCL identifiers without losing word boundaries", () => {
            expect(toCamelCase("FlipFlop")).to.equal("flipFlop");
            expect(toCamelCase("CurrentSummationDelivered")).to.equal("currentSummationDelivered");
        });

        it("PascalCases multi-word, acronym-bearing cluster names", () => {
            expect(toPascalCase("Sample MEI")).to.equal("SampleMei");
            expect(toPascalCase("Weather Station")).to.equal("WeatherStation");
        });
    });
});
