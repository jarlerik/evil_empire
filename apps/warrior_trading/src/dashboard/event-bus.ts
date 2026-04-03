import { EventEmitter } from "events";
import type { DashboardEvent, PlaybackCommand } from "./types.js";

class DashboardEventBus extends EventEmitter {
  broadcast(event: DashboardEvent): void {
    this.emit("dashboard:event", event);
  }

  onEvent(handler: (event: DashboardEvent) => void): void {
    this.on("dashboard:event", handler);
  }

  sendCommand(cmd: PlaybackCommand): void {
    this.emit("playback:command", cmd);
  }

  onCommand(handler: (cmd: PlaybackCommand) => void): void {
    this.on("playback:command", handler);
  }
}

export const dashboardBus = new DashboardEventBus();
