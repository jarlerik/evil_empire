import { createLogger } from "../utils/logger.js";
import { existsSync } from "fs";

const log = createLogger("risk:state");

const STATE_FILE = "risk-state.json";

export interface PersistedRiskState {
  date: string; // YYYY-MM-DD — resets on new day
  dailyPnL: number;
  consecutiveLosses: number;
  tradesCompleted: number;
  tradesWon: number;
  startingEquity: number;
}

function defaultState(startingEquity: number): PersistedRiskState {
  return {
    date: new Date().toISOString().slice(0, 10),
    dailyPnL: 0,
    consecutiveLosses: 0,
    tradesCompleted: 0,
    tradesWon: 0,
    startingEquity,
  };
}

export async function loadRiskState(
  startingEquity: number
): Promise<PersistedRiskState> {
  try {
    if (!existsSync(STATE_FILE)) {
      log.info("No persisted state found, starting fresh");
      return defaultState(startingEquity);
    }

    const raw = await Bun.file(STATE_FILE).text();
    const state = JSON.parse(raw) as PersistedRiskState;

    // Reset if it's a new trading day
    const today = new Date().toISOString().slice(0, 10);
    if (state.date !== today) {
      log.info("New trading day, resetting state", {
        previousDate: state.date,
        today,
      });
      return defaultState(startingEquity);
    }

    log.info("Restored risk state", {
      dailyPnL: state.dailyPnL,
      consecutiveLosses: state.consecutiveLosses,
      tradesCompleted: state.tradesCompleted,
    });

    return state;
  } catch (err) {
    log.warn("Failed to load risk state, starting fresh", {
      error: String(err),
    });
    return defaultState(startingEquity);
  }
}

export async function saveRiskState(state: PersistedRiskState): Promise<void> {
  const tmpFile = `${STATE_FILE}.tmp`;
  try {
    // Atomic write: write to temp file, then rename
    await Bun.write(tmpFile, JSON.stringify(state, null, 2));
    await Bun.write(STATE_FILE, await Bun.file(tmpFile).text());

    // Clean up tmp
    try {
      const { unlink } = await import("fs/promises");
      await unlink(tmpFile);
    } catch {
      // ignore cleanup failure
    }

    log.debug("Risk state persisted", {
      dailyPnL: state.dailyPnL,
      consecutiveLosses: state.consecutiveLosses,
    });
  } catch (err) {
    log.error("Failed to persist risk state", { error: String(err) });
  }
}
