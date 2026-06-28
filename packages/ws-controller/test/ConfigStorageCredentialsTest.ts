/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import { Environment, MockStorageService } from "@matter/general";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

describe("ConfigStorage credentials", () => {
    let config: ConfigStorage;
    beforeEach(async () => {
        config = await ConfigStorage.create(freshEnv());
    });

    it("synthesizes a default WiFi entry from the legacy keys", async () => {
        await config.setWifiCredentials("default", "MySsid", "secret");
        const list = config.listWifiCredentials();
        expect(list).to.deep.equal([{ id: "default", ssid: "MySsid", credentials: "secret" }]);
        // legacy getters still reflect the default (HA contract)
        expect(config.wifiSsid).to.equal("MySsid");
        expect(config.wifiCredentials).to.equal("secret");
    });

    it("stores additional WiFi entries separately, default first", async () => {
        await config.setWifiCredentials("default", "Home", "pw0");
        await config.setWifiCredentials("Garage", "GarageNet", "pw1");
        expect(config.listWifiCredentials().map(e => e.id)).to.deep.equal(["default", "Garage"]);
        expect(config.getWifiCredentials("Garage")).to.deep.equal({ ssid: "GarageNet", credentials: "pw1" });
    });

    it("keeps the existing WiFi secret when set with a blank credential on an existing id", async () => {
        await config.setWifiCredentials("Garage", "GarageNet", "pw1");
        await config.setWifiCredentials("Garage", "GarageNet2", "");
        expect(config.getWifiCredentials("Garage")).to.deep.equal({ ssid: "GarageNet2", credentials: "pw1" });
    });

    it("matches ids case-insensitively and rejects duplicates", async () => {
        await config.setWifiCredentials("Garage", "A", "x");
        let err: unknown;
        try {
            await config.setWifiCredentials("garage", "B", "y");
        } catch (e) {
            err = e;
        }
        expect(String(err)).to.contain("invalid-credential-id");
        expect(config.listWifiCredentials()).to.have.length(1); // only "Garage" — no default set
    });

    it("rejects reserved name 'delete' and empty ids", async () => {
        for (const bad of ["delete", "DELETE", "  ", ""]) {
            let err: unknown;
            try {
                await config.setThreadCredentials(bad, "00");
            } catch (e) {
                err = e;
            }
            expect(String(err), bad).to.contain("invalid-credential-id");
        }
    });

    it("clears the default but never removes it as a slot; removes additional entries", async () => {
        await config.setThreadCredentials("default", "0a");
        await config.setThreadCredentials("Extra", "0b");
        await config.removeThreadCredentials("default");
        expect(config.threadDataset).to.equal(undefined);
        expect(config.getThreadCredentials("default")).to.equal(undefined);
        await config.removeThreadCredentials("Extra");
        expect(config.listThreadCredentials()).to.deep.equal([]);
    });

    it("clears the default WiFi entry via the no-arg backward-compatible call", async () => {
        await config.setWifiCredentials("default", "Home", "pw");
        await config.setWifiCredentials("Office", "OfficeNet", "pw2");
        await config.removeWifiCredentials();
        expect(config.wifiSsid).to.equal(undefined);
        expect(config.wifiCredentials).to.equal(undefined);
        expect(config.listWifiCredentials().map(e => e.id)).to.deep.equal(["Office"]);
    });
});
