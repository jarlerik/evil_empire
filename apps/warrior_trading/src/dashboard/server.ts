import type { ServerWebSocket } from "bun";
import { dashboardBus } from "./event-bus.js";
import type { InitEvent } from "./types.js";

const PORT = parseInt(Bun.env.DASHBOARD_PORT ?? "3939");

export function startDashboard(initPayload: InitEvent): void {
  const clients = new Set<ServerWebSocket<unknown>>();

  Bun.serve({
    port: PORT,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        server.upgrade(req);
        return;  // Bun requires returning undefined for upgrades
      }

      if (url.pathname === "/") {
        return new Response(Bun.file(new URL("./index.html", import.meta.url).pathname), {
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify(initPayload));
      },
      message(ws, msg) {
        try {
          const cmd = JSON.parse(msg as string);
          if (cmd.type === "playback") {
            dashboardBus.sendCommand(cmd);
          }
        } catch {}
      },
      close(ws) {
        clients.delete(ws);
      },
    },
  });

  dashboardBus.onEvent((event) => {
    const json = JSON.stringify(event);
    for (const ws of clients) {
      ws.send(json);
    }
  });

  console.log(`📊 Dashboard: http://localhost:${PORT}`);
}
