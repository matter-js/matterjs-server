/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpServer, WebServerHandler } from "@matter-server/ws-controller";
import { spawn } from "node:child_process";
import { chmod, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { connect, createServer as createNetServer, type Server as NetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebServer } from "../src/server/WebServer.js";

class OkHandler implements WebServerHandler {
    async register(server: HttpServer) {
        server.on("request", (_req, res) => {
            res.end("ok");
        });
    }

    async unregister() {}
}

function getOverSocket(socketPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = httpRequest({ socketPath, path: "/", agent: false }, res => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", chunk => (body += chunk));
            res.on("end", () => resolve(body));
        });
        req.on("error", reject);
        req.end();
    });
}

async function exists(path: string): Promise<boolean> {
    try {
        await lstat(path);
        return true;
    } catch {
        return false;
    }
}

/** Leaves a socket file without a listener behind, like a server killed with SIGKILL. */
async function createStaleSocket(socketPath: string): Promise<void> {
    const child = spawn(
        process.execPath,
        ["-e", `require("node:net").createServer().listen(${JSON.stringify(socketPath)}, () => console.log("up"))`],
        { stdio: ["ignore", "pipe", "inherit"] },
    );
    await new Promise<void>((resolve, reject) => {
        child.stdout.once("data", () => resolve());
        child.once("error", reject);
        child.once("exit", code => reject(new Error(`Stale socket helper exited with code ${code}`)));
    });
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGKILL");
    await exited;
}

describe("WebServer", () => {
    let dir: string;
    let socketPath: string;
    let webServer: WebServer | undefined;
    let blocker: NetServer | undefined;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "mws-"));
        socketPath = join(dir, "ws.sock");
    });

    afterEach(async () => {
        await webServer?.stop();
        webServer = undefined;
        await new Promise<void>(resolve => (blocker ? blocker.close(() => resolve()) : resolve()));
        blocker = undefined;
        await rm(dir, { recursive: true, force: true });
    });

    function createWebServer() {
        webServer = new WebServer({ listenAddresses: [socketPath], port: 0 }, [new OkHandler()]);
        return webServer;
    }

    it("serves HTTP on a unix socket path and removes the socket file on stop", async () => {
        const server = createWebServer();
        await server.start();

        expect((await lstat(socketPath)).isSocket()).to.be.true;
        expect(await getOverSocket(socketPath)).to.equal("ok");

        await server.stop();
        webServer = undefined;
        expect(await exists(socketPath)).to.be.false;
    });

    it("replaces a stale socket file left by an unclean shutdown", async () => {
        await createStaleSocket(socketPath);
        expect((await lstat(socketPath)).isSocket()).to.be.true;

        await createWebServer().start();

        expect(await getOverSocket(socketPath)).to.equal("ok");
    });

    it("does not take over a socket that still accepts connections", async () => {
        blocker = createNetServer(socket => socket.destroy());
        await new Promise<void>(resolve => blocker!.listen(socketPath, resolve));

        await expect(createWebServer().start()).to.be.rejectedWith(/EADDRINUSE/);
        await new Promise<void>((resolve, reject) => {
            const probe = connect({ path: socketPath }, () => {
                probe.destroy();
                resolve();
            });
            probe.once("error", reject);
        });
    });

    it("fails with the probe error and keeps a stale socket it may not connect to", async function () {
        if (process.getuid?.() === 0) {
            this.skip();
        }
        await createStaleSocket(socketPath);
        await chmod(socketPath, 0o000);

        await expect(createWebServer().start()).to.be.rejectedWith(/EACCES/);
        expect((await lstat(socketPath)).isSocket()).to.be.true;
    });

    it("fails when the socket path cannot be inspected", async () => {
        const fileAsDirectory = join(dir, "file");
        await writeFile(fileAsDirectory, "");
        socketPath = join(fileAsDirectory, "ws.sock");

        await expect(createWebServer().start()).to.be.rejectedWith(/^listen ENOTDIR/);
    });

    it("does not remove a regular file at the socket path", async () => {
        await writeFile(socketPath, "keep me");

        await expect(createWebServer().start()).to.be.rejectedWith(/EADDRINUSE/);
        expect(await readFile(socketPath, "utf8")).to.equal("keep me");
    });
});
