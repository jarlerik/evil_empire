import type { ServerWebSocket } from "bun";
import { dashboardBus } from "./event-bus.js";
import type { DashboardEvent, InitEvent } from "./types.js";

const PORT = parseInt(Bun.env.DASHBOARD_PORT ?? "3939");

export function startDashboard(initPayload: InitEvent): void {
  const clients = new Set<ServerWebSocket<unknown>>();

  // Cache latest event per type so late-connecting clients get current state
  const latestByType = new Map<string, DashboardEvent>();

  Bun.serve({
    port: PORT,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        server.upgrade(req);
        return;  // Bun requires returning undefined for upgrades
      }

      // Serve built dashboard assets from dist/dashboard
      const distDir = new URL("../../dist/dashboard", import.meta.url).pathname;
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(distDir + filePath);
      if (await file.exists()) {
        const ext = filePath.split(".").pop();
        const mimeTypes: Record<string, string> = {
          html: "text/html",
          js: "application/javascript",
          css: "text/css",
          json: "application/json",
          png: "image/png",
          svg: "image/svg+xml",
        };
        return new Response(file, {
          headers: { "Content-Type": mimeTypes[ext ?? ""] ?? "application/octet-stream" },
        });
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify(initPayload));
        // Replay cached state so late-connecting clients see current scanner/session/risk
        for (const event of latestByType.values()) {
          ws.send(JSON.stringify(event));
        }
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
    // Cache state events so late-connecting clients get current state
    if (event.type === "scanner" || event.type === "session" || event.type === "risk") {
      latestByType.set(event.type, event);
    }
    const json = JSON.stringify(event);
    for (const ws of clients) {
      ws.send(json);
    }
  });

  console.log(`📊 Dashboard: http://localhost:${PORT}`);
}
