import { createLogger } from "../utils/logger.js";
import { existsSync } from "fs";
import { rename } from "fs/promises";

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

function isValidState(s: unknown): s is PersistedRiskState {
  if (typeof s !== "object" || s === null) return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Number.isFinite(r.dailyPnL as number) &&
    Number.isFinite(r.consecutiveLosses as number) &&
    Number.isFinite(r.tradesCompleted as number) &&
    Number.isFinite(r.tradesWon as number) &&
    Number.isFinite(r.startingEquity as number) &&
    (r.startingEquity as number) > 0
  );
}

const MAX_CONSECUTIVE_SAVE_FAILURES = 3;
let consecutiveSaveFailures = 0;

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
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) {
      log.warn("Persisted state failed validation, starting fresh");
      return defaultState(startingEquity);
    }
    const state = parsed;

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
    await rename(tmpFile, STATE_FILE);

    consecutiveSaveFailures = 0;

    log.debug("Risk state persisted", {
      dailyPnL: state.dailyPnL,
      consecutiveLosses: state.consecutiveLosses,
    });
  } catch (err) {
    consecutiveSaveFailures++;
    log.error("Failed to persist risk state", {
      error: String(err),
      consecutiveFailures: consecutiveSaveFailures,
    });
    if (consecutiveSaveFailures >= MAX_CONSECUTIVE_SAVE_FAILURES) {
      throw new Error(
        `Risk state persistence failed ${consecutiveSaveFailures} consecutive times — halting trading`
      );
    }
  }
}
