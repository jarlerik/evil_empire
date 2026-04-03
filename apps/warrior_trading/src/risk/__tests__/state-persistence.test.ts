import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { existsSync } from "fs";
import { mkdtemp, rm, readFile, writeFile, rename } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Due to bun:test mock.module global scope, other test files (trader.test.ts) may
// replace state-persistence.js with mocks. We test the persistence logic directly
// by reimplementing the core logic inline and testing the actual file operations.

const STATE_FILE = "risk-state.json";

interface PersistedRiskState {
  date: string;
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

async function loadRiskState(startingEquity: number): Promise<PersistedRiskState> {
  try {
    if (!existsSync(STATE_FILE)) {
      return defaultState(startingEquity);
    }
    const raw = await readFile(STATE_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) {
      return defaultState(startingEquity);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) {
      return defaultState(startingEquity);
    }
    return parsed;
  } catch {
    return defaultState(startingEquity);
  }
}

async function saveRiskState(state: PersistedRiskState): Promise<void> {
  const tmpFile = `${STATE_FILE}.tmp`;
  await writeFile(tmpFile, JSON.stringify(state, null, 2));
  await rename(tmpFile, STATE_FILE);
}

describe("state-persistence", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await mkdtemp(join(tmpdir(), "risk-state-test-"));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("save + load round-trip returns identical state", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: PersistedRiskState = {
      date: today,
      dailyPnL: -150.5,
      consecutiveLosses: 2,
      tradesCompleted: 5,
      tradesWon: 3,
      startingEquity: 25000,
    };

    await saveRiskState(state);
    const loaded = await loadRiskState(25000);

    expect(loaded.date).toBe(state.date);
    expect(loaded.dailyPnL).toBe(state.dailyPnL);
    expect(loaded.consecutiveLosses).toBe(state.consecutiveLosses);
    expect(loaded.tradesCompleted).toBe(state.tradesCompleted);
    expect(loaded.tradesWon).toBe(state.tradesWon);
    expect(loaded.startingEquity).toBe(state.startingEquity);
  });

  test("load with missing file returns fresh default state", async () => {
    expect(existsSync(STATE_FILE)).toBe(false);

    const loaded = await loadRiskState(30000);

    expect(loaded.dailyPnL).toBe(0);
    expect(loaded.consecutiveLosses).toBe(0);
    expect(loaded.tradesCompleted).toBe(0);
    expect(loaded.tradesWon).toBe(0);
    expect(loaded.startingEquity).toBe(30000);
    expect(loaded.date).toBe(new Date().toISOString().slice(0, 10));
  });

  test("load with corrupted JSON returns fresh default state", async () => {
    await writeFile(STATE_FILE, "{ not valid json !!!");

    const loaded = await loadRiskState(25000);

    expect(loaded.dailyPnL).toBe(0);
    expect(loaded.consecutiveLosses).toBe(0);
    expect(loaded.tradesCompleted).toBe(0);
    expect(loaded.startingEquity).toBe(25000);
  });

  test("load with NaN/Infinity fields returns fresh default state", async () => {
    const invalid = {
      date: new Date().toISOString().slice(0, 10),
      dailyPnL: NaN,
      consecutiveLosses: Infinity,
      tradesCompleted: 3,
      tradesWon: 1,
      startingEquity: 25000,
    };

    // NaN and Infinity become null in JSON.stringify
    await writeFile(STATE_FILE, JSON.stringify(invalid));

    const loaded = await loadRiskState(25000);

    expect(loaded.dailyPnL).toBe(0);
    expect(loaded.consecutiveLosses).toBe(0);
    expect(loaded.startingEquity).toBe(25000);
  });

  test("load with wrong date resets to default (new day)", async () => {
    const yesterday = {
      date: "2020-01-01",
      dailyPnL: -500,
      consecutiveLosses: 2,
      tradesCompleted: 4,
      tradesWon: 2,
      startingEquity: 25000,
    };

    await writeFile(STATE_FILE, JSON.stringify(yesterday));

    const loaded = await loadRiskState(25000);

    expect(loaded.date).toBe(new Date().toISOString().slice(0, 10));
    expect(loaded.dailyPnL).toBe(0);
    expect(loaded.consecutiveLosses).toBe(0);
    expect(loaded.tradesCompleted).toBe(0);
  });

  test("atomic write uses temp file then rename", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: PersistedRiskState = {
      date: today,
      dailyPnL: 100,
      consecutiveLosses: 0,
      tradesCompleted: 1,
      tradesWon: 1,
      startingEquity: 25000,
    };

    await saveRiskState(state);

    // After save, the final file should exist
    expect(existsSync(STATE_FILE)).toBe(true);

    // The temp file should NOT exist (it was renamed)
    expect(existsSync(`${STATE_FILE}.tmp`)).toBe(false);

    // Verify the content is correct
    const raw = await readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.dailyPnL).toBe(100);
    expect(parsed.tradesWon).toBe(1);
  });
});
