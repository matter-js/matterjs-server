/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Integration test: DCL attestation enforcement without test certificate support.
 *
 * Verifies that commissioning a test device fails when the server is started
 * without --enable-test-net-dcl, confirming that production PAA attestation
 * is enforced by default.
 */

import { ServerErrorCode } from "@matter-server/ws-controller";
import { ChildProcess } from "child_process";
import {
    cleanupTempStorage,
    createTempStoragePaths,
    MANUAL_PAIRING_CODE,
    MatterTestClient,
    SERVER_PORT,
    SERVER_WS_URL,
    startServer,
    startTestDevice,
    waitForDeviceReady,
    waitForPort,
    killProcess,
} from "./helpers/index.js";

// Commissioning can take up to 2 minutes; add extra headroom since we expect a failure path.
const TEST_TIMEOUT = 150_000;

describe("DCL Attestation Enforcement", function () {
    this.timeout(TEST_TIMEOUT);

    let serverProcess: ChildProcess;
    let deviceProcess: ChildProcess;
    let client: MatterTestClient;
    let serverStoragePath: string;
    let deviceStoragePath: string;

    before(async function () {
        const paths = await createTempStoragePaths();
        serverStoragePath = paths.serverStoragePath;
        deviceStoragePath = paths.deviceStoragePath;

        console.log("Starting server without test DCL certificates...");
        serverProcess = startServer(serverStoragePath, undefined, "info", false);

        await waitForPort(SERVER_PORT);
        console.log("Server ready");

        console.log("Starting test device...");
        deviceProcess = startTestDevice(deviceStoragePath);
        await waitForDeviceReady(deviceProcess);

        // Allow mDNS to propagate
        await new Promise(r => setTimeout(r, 3000));

        client = new MatterTestClient(SERVER_WS_URL);
        await client.connectAndGetServerInfo();
    });

    after(async function () {
        if (client) {
            await client.close();
        }
        await killProcess(serverProcess);
        await killProcess(deviceProcess);
        await cleanupTempStorage(serverStoragePath, deviceStoragePath);
    });

    it("should reject commissioning with a test-net-DCL hint when test certs are not trusted", async function () {
        // The TestLightDevice uses a test PAA. Test PAAs are always seeded into the trust store, but
        // without --enable-test-net-dcl they are not trusted: attestation surfaces a
        // TrustedAsTestCertificate finding and onAttestationFailure rejects with a clear hint to
        // enable test-net DCL.
        const error = await client.sendCommandExpectError(
            "commission_with_code",
            { code: MANUAL_PAIRING_CODE, network_only: true },
            120_000,
        );

        expect(error.error_code).to.equal(ServerErrorCode.NodeCommissionFailed);
        expect(error.details).to.include("--enable-test-net-dcl");
    });
});
