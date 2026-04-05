import type { ServerWebSocket } from "bun";
import { dashboardBus } from "./event-bus.js";
import type { InitEvent } from "./types.js";

const PORT = parseInt(Bun.env.DASHBOARD_PORT ?? "3939");

export function startDashboard(initPayload: InitEvent): void {
  const clients = new Set<ServerWebSocket<unknown>>();

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
