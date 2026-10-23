/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { Matter } from "@matter/main/model";
import { TlvAny, TlvOfModel } from "@matter/main/types";
import "../src/register.js";

function cluster(id: number) {
    const model = Matter.clusters.find(cluster => cluster.id === id);
    expect(model, `cluster 0x${id.toString(16)} is registered`).to.exist;
    return model!;
}

function attributes(id: number) {
    return [...cluster(id).attributes]
        .filter(attribute => !attribute.isGlobal)
        .map(attribute => [attribute.id, attribute.name, attribute.writable]);
}

function commands(id: number) {
    return [...cluster(id).commands].map(command => [
        command.id,
        command.name,
        command.isResponse,
        command.members.map(field => field.id),
    ]);
}

// The request as the device receives it: field tags and unsigned integers (the firmware's getters refuse signed ones)
function encoded(clusterId: number, name: string, value: unknown) {
    const command = cluster(clusterId).commands.find(model => model.name === name);
    expect(command, `command ${name}`).to.exist;
    return Bytes.toHex(TlvOfModel(command!).encode(value));
}

describe("Yeelight Cube Lite clusters", () => {
    it("registers the basic information and configuration clusters", () => {
        expect(attributes(0x1312fc00)).to.deep.equal([
            [0x13120000, "yeelightId", false],
            [0x13120001, "softwareVersion", false],
            [0x13120002, "softwareVersionString", false],
        ]);
        expect(attributes(0x1312fc01)).to.deep.equal([
            [0x13120001, "lanControl", true],
            [0x13120002, "micMusicOnOff", false],
            [0x13120003, "micMusicEffectId", false],
        ]);
        expect(commands(0x1312fc01)).to.deep.equal([[0x13120000, "setMicMusicMode", false, [0x0, 0x1, 0x2]]]);
    });

    it("registers the writable rotation of the cube control cluster", () => {
        expect(attributes(0x1312fc02)).to.deep.equal([
            [0x13120000, "cubeTopology", false],
            [0x13120001, "rotationAngle", true],
        ]);
        expect(commands(0x1312fc02)).to.deep.equal([[0x13120002, "updateTopology", false, [0x0]]]);
    });

    it("registers the effect commands with their responses", () => {
        expect(attributes(0x1312fc05)).to.deep.equal([
            [0x13120000, "effectId", false],
            [0x13120001, "customId", false],
        ]);
        expect(commands(0x1312fc05)).to.deep.equal([
            [0x13120000, "setEffect", false, [0x0, 0x1]],
            [0x13120002, "setRate", false, [0x0]],
            [0x13120006, "setMixer", false, [0x0]],
            [0x13120007, "setData", false, [0x0]],
            [0x13120008, "setDirection", false, [0x0]],
            [0x13120009, "resetEffect", false, []],
            [0x1312000a, "updatePersistEffectList", false, [0x0, 0x1]],
            [0x1312000b, "getPersistEffectList", false, []],
            [0x13120001, "getPersistEffectListResponse", true, [0x0]],
            [0x1312000d, "getCurrentEffect", false, []],
            [0x13120003, "getCurrentEffectResponse", true, [0x0]],
            [0x1312000e, "setPresetsEffect", false, [0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6]],
            [0x1312000f, "sendGifDataFragment", false, [0x0]],
            [0x13120004, "sendGifDataFragmentResponse", true, [0x0]],
        ]);
    });

    it("registers the firmware update state without its update command", () => {
        expect(attributes(0x1312fc11)).to.deep.equal([
            [0x13120000, "yeeUpdateState", false],
            [0x13120001, "progress", false],
        ]);
        expect(commands(0x1312fc11)).to.deep.equal([]);
    });

    it("types an effect as a struct with a list of effect configs", () => {
        const setEffect = cluster(0x1312fc05).commands.find(command => command.name === "setEffect");
        const effect = setEffect?.members.find(field => field.name === "effect");
        expect(effect?.members.map(field => field.name)).to.deep.equal(["effectId", "customId", "effectParams"]);
        const [config] = [...(effect?.members.find(field => field.name === "effectParams")?.members ?? [])];
        expect(config?.members.map(field => [field.id, field.name])).to.deep.equal([
            [0x0, "start"],
            [0x1, "end"],
            [0x2, "onoff"],
            [0x3, "mode"],
            [0x4, "intensity"],
            [0x5, "speed"],
            [0x6, "color"],
            [0x7, "data"],
            [0x8, "mixer"],
            [0x9, "direction"],
        ]);
    });

    it("refuses color lists the device's buffers cannot take, before sending them", () => {
        const colors = (count: number) => Array<number>(count).fill(0xffff0000);
        const requests: [number, string, (count: number) => unknown][] = [
            [0x1312fc05, "setPresetsEffect", count => ({ apply: 1, effectId: 42, color: colors(count) })],
            [
                0x1312fc05,
                "setEffect",
                count => ({ apply: 1, effect: { effectId: 42, effectParams: [{ mode: 42, color: colors(count) }] } }),
            ],
            [
                0x1312fc05,
                "updatePersistEffectList",
                count => ({ index: 0, effect: { effectId: 42, effectParams: [{ mode: 42, color: colors(count) }] } }),
            ],
        ];
        for (const [clusterId, name, request] of requests) {
            expect(() => encoded(clusterId, name, request(4)), `${name} with 4 colors`).not.to.throw();
            expect(() => encoded(clusterId, name, request(3)), `${name} with 3 colors`).to.throw(/too short/);
            expect(() => encoded(clusterId, name, request(5)), `${name} with 5 colors`).to.throw(/too long/);
        }
        // Colors stay optional.
        expect(() => encoded(0x1312fc05, "setPresetsEffect", { apply: 1, effectId: 42 })).not.to.throw();

        const music = (count: number) => ({ on: true, effectId: 85, palette: colors(count) });
        expect(() => encoded(0x1312fc01, "setMicMusicMode", music(16))).not.to.throw();
        expect(() => encoded(0x1312fc01, "setMicMusicMode", music(17))).to.throw(/too long/);
    });

    it("decodes a reply with any number of colors, as the controller does", () => {
        const reply = cluster(0x1312fc05).commands.find(model => model.name === "getCurrentEffectResponse");
        // {0: {0: 42, 2: [{3: 42, 6: [1, 2]}]}}: a reply with 2 colors
        const tlv = Bytes.fromHex("153500" + "24002a" + "360215" + "24032a" + "3606" + "04010402" + "1818181818");
        expect(TlvOfModel(reply!).decodeTlv(TlvAny.decode(tlv))).to.deep.equal({
            effect: { effectId: 42, effectParams: [{ mode: 42, color: [1, 2] }] },
        });
    });

    it("encodes requests as the device decodes them", () => {
        expect(encoded(0x1312fc05, "setPresetsEffect", { apply: 1, effectId: 39, rate: 200, direction: 2 })).to.equal(
            "152400012401272404c824060218",
        );
        expect(encoded(0x1312fc01, "setMicMusicMode", { on: true, effectId: 85 })).to.equal("15290024015518");
        expect(
            encoded(0x1312fc05, "setEffect", {
                apply: 1,
                effect: {
                    effectId: 36,
                    customId: 0,
                    effectParams: [{ mode: 36, speed: 50, color: [0xffff0000, 0, 0, 0], data: Bytes.fromHex("00") }],
                },
            }),
        ).to.equal("1524000135012400242401003602152403242405323606060000ffff0400040004001830070100" + "18181818");
    });
});
