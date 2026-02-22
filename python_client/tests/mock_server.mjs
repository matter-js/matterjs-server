/**
 * Standalone mock server for Python client testing.
 * Wraps the existing MockMatterServer from ws-client tests.
 *
 * Usage: node mock_server.mjs [port]
 * Prints "READY:<port>" to stdout when ready.
 * Handles commands from stdin as JSON lines:
 *   {"action": "register_command", "command": "start_listening", "result": {...}}
 *   {"action": "send_event", "event": "node_added", "data": {...}}
 *   {"action": "stop"}
 */

import { MockMatterServer } from "../../packages/ws-client/test/MockMatterServer.ts";

const port = parseInt(process.argv[2] || "0", 10);
const server = new MockMatterServer({ port });

await server.start();
console.log(`READY:${server.actualPort}`);

// Default handlers
server.onCommand("start_listening", () => []);

// Read commands from stdin
process.stdin.setEncoding("utf-8");
let buffer = "";

process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const cmd = JSON.parse(line);
            handleStdinCommand(cmd);
        } catch (e) {
            console.error("Invalid command:", e.message);
        }
    }
});

function handleStdinCommand(cmd) {
    switch (cmd.action) {
        case "register_command":
            server.onCommand(cmd.command, () => cmd.result);
            console.log(`REGISTERED:${cmd.command}`);
            break;
        case "send_event":
            server.sendEvent(cmd.event, cmd.data);
            console.log(`EVENT_SENT:${cmd.event}`);
            break;
        case "stop":
            server.stop().then(() => process.exit(0));
            break;
        default:
            console.error(`Unknown action: ${cmd.action}`);
    }
}

process.on("SIGTERM", () => server.stop().then(() => process.exit(0)));
process.on("SIGINT", () => server.stop().then(() => process.exit(0)));
