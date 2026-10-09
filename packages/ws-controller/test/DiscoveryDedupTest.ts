/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { uniqueByLastAdvertisement } from "../src/controller/ControllerCommandHandler.js";

const a = { id: "peer1" };
const b = { id: "peer2" };
const c = { id: "peer3" };

describe("uniqueByLastAdvertisement", () => {
    it("keeps one entry per device", () => {
        expect(uniqueByLastAdvertisement([a, b, a, a, b])).to.deep.equal([a, b]);
    });

    it("orders by the advertisement a device was last seen in", () => {
        // peer1 advertises again after peer2, so it is the freshest find, not the oldest.
        expect(uniqueByLastAdvertisement([a, b, a])).to.deep.equal([b, a]);
    });

    it("keeps devices that advertise once in the order they arrived", () => {
        expect(uniqueByLastAdvertisement([a, b, c])).to.deep.equal([a, b, c]);
    });

    it("returns nothing for an empty discovery", () => {
        expect(uniqueByLastAdvertisement([])).to.deep.equal([]);
    });
});
