import { createLogger } from "../utils/logger.js";

const log = createLogger("engine:session");

export type SessionPhase =
  | "pre-market"   // 7:00 – 9:29 ET
  | "open"         // 9:30 – 11:00 ET
  | "midday"       // 11:00 – 15:45 ET
  | "close"        // 15:45 – 16:00 ET (flatten positions)
  | "after-hours"  // 16:00 – 20:00 ET
  | "closed";      // 20:00 – 7:00 ET

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

function getETHour(): { hour: number; minute: number } {
  const parts = etFormatter.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return { hour, minute };
}

function etMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function getCurrentSession(): SessionPhase {
  const { hour, minute } = getETHour();
  const mins = etMinutes(hour, minute);

  if (mins >= etMinutes(7, 0) && mins < etMinutes(9, 30)) return "pre-market";
  if (mins >= etMinutes(9, 30) && mins < etMinutes(11, 0)) return "open";
  if (mins >= etMinutes(11, 0) && mins < etMinutes(15, 45)) return "midday";
  if (mins >= etMinutes(15, 45) && mins < etMinutes(16, 0)) return "close";
  if (mins >= etMinutes(16, 0) && mins < etMinutes(20, 0)) return "after-hours";
  return "closed";
}

export function isMarketOpen(): boolean {
  const session = getCurrentSession();
  return session === "open" || session === "midday" || session === "close";
}

export function isTradingAllowed(): boolean {
  const session = getCurrentSession();
  return session === "open" || session === "midday";
}

export function shouldFlattenPositions(): boolean {
  return getCurrentSession() === "close";
}

export function isScanningTime(): boolean {
  return getCurrentSession() === "pre-market";
}

export function msUntilSession(target: SessionPhase): number {
  const sessionStartET: Record<SessionPhase, { h: number; m: number }> = {
    "pre-market": { h: 7, m: 0 },
    "open": { h: 9, m: 30 },
    "midday": { h: 11, m: 0 },
    "close": { h: 15, m: 45 },
    "after-hours": { h: 16, m: 0 },
    "closed": { h: 20, m: 0 },
  };

  const start = sessionStartET[target];
  const { hour, minute } = getETHour();
  const nowMins = etMinutes(hour, minute);
  const targetMins = etMinutes(start.h, start.m);

  let diff = targetMins - nowMins;
  if (diff <= 0) diff += 24 * 60; // next day

  return diff * 60 * 1000;
}

export class SessionTimer {
  private currentPhase: SessionPhase;
  private listeners = new Map<SessionPhase, Array<() => void | Promise<void>>>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.currentPhase = getCurrentSession();
  }

  start(checkIntervalMs = 10_000): void {
    log.info("Session timer started", { currentPhase: this.currentPhase });

    this.interval = setInterval(() => {
      const newPhase = getCurrentSession();
      if (newPhase !== this.currentPhase) {
        log.info("Session phase changed", {
          from: this.currentPhase,
          to: newPhase,
        });
        this.currentPhase = newPhase;
        this.emit(newPhase);
      }
    }, checkIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    log.info("Session timer stopped");
  }

  on(phase: SessionPhase, callback: () => void | Promise<void>): void {
    const list = this.listeners.get(phase) ?? [];
    list.push(callback);
    this.listeners.set(phase, list);
  }

  private async emit(phase: SessionPhase): Promise<void> {
    const callbacks = this.listeners.get(phase) ?? [];
    for (const cb of callbacks) {
      try {
        await cb();
      } catch (err) {
        log.error("Session listener error", { phase, error: String(err) });
      }
    }
  }

  get phase(): SessionPhase {
    return this.currentPhase;
  }
}
