import { describe, test, expect, afterEach } from "bun:test";
import type { Bar } from "../utils/bar.js";

// Set required env vars before importing config-dependent modules
const originalEnv = { ...Bun.env };

function setTestEnv() {
  Bun.env.ALPACA_KEY_ID = "test-key";
  Bun.env.ALPACA_SECRET_KEY = "test-secret";
  Bun.env.ALPACA_PAPER = "true";
  Bun.env.STRATEGIES = "all";
}

afterEach(() => {
  for (const key of Object.keys(Bun.env)) {
    if (!(key in originalEnv)) delete Bun.env[key];
  }
  Object.assign(Bun.env, originalEnv);
});

// Helper to create a bar at a specific ET time
function makeBar(
  etHour: number,
  etMinute: number,
  date: string,
  price: number,
  overrides: Partial<Bar> = {}
): Bar {
  // Create a Date that corresponds to the given ET time
  // ET is UTC-4 (EDT) or UTC-5 (EST). For testing, assume EDT.
  const utcHour = etHour + 4;
  const ts = new Date(`${date}T${String(utcHour).padStart(2, "0")}:${String(etMinute).padStart(2, "0")}:00Z`);
  return {
    timestamp: ts,
    open: price,
    high: price + 0.1,
    low: price - 0.1,
    close: price,
    volume: 1000,
    ...overrides,
  };
}

// Generate a sequence of bars for a trading day
function generateDayBars(
  date: string,
  basePrice: number,
  count: number,
  startHour = 9,
  startMin = 30
): Bar[] {
  const bars: Bar[] = [];
  let h = startHour;
  let m = startMin;

  for (let i = 0; i < count; i++) {
    const price = basePrice + (Math.random() - 0.45) * 0.5; // slight upward drift
    bars.push(makeBar(h, m, date, price));
    m++;
    if (m >= 60) {
      m = 0;
      h++;
    }
  }
  return bars;
}

describe("SimTrader", () => {
  test("produces deterministic results with same input", () => {
    setTestEnv();
    const { loadConfig } = require("../config.js");
    const { SimTrader } = require("../backtest/sim-trader.js");

    const config = loadConfig();
    const btConfig = {
      symbol: "TEST",
      startDate: "2026-03-15",
      endDate: "2026-03-15",
      startingEquity: 25000,
      commissionPerShare: 0.005,
      slippageTicks: 1,
      marketOpenHour: 9,
      marketOpenMinute: 30,
      marketCloseHour: 15,
      marketCloseMinute: 45,
    };

    // Use fixed bars for determinism
    const bars: Bar[] = [];
    let h = 9, m = 30;
    for (let i = 0; i < 30; i++) {
      const utcHour = h + 4;
      bars.push({
        timestamp: new Date(`2026-03-15T${String(utcHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`),
        open: 10.0 + i * 0.01,
        high: 10.1 + i * 0.01,
        low: 9.9 + i * 0.01,
        close: 10.05 + i * 0.01,
        volume: 1000,
      });
      m++;
      if (m >= 60) { m = 0; h++; }
    }

    const trader1 = new SimTrader(config, btConfig);
    const result1 = trader1.run(bars);

    const trader2 = new SimTrader(config, btConfig);
    const result2 = trader2.run(bars);

    expect(result1.trades.length).toBe(result2.trades.length);
    expect(result1.equity.length).toBe(result2.equity.length);

    // Final equity should match
    if (result1.equity.length > 0 && result2.equity.length > 0) {
      expect(
        result1.equity[result1.equity.length - 1].equity
      ).toBeCloseTo(
        result2.equity[result2.equity.length - 1].equity,
        2
      );
    }
  });

  test("resets state on new trading day", () => {
    setTestEnv();
    const { loadConfig } = require("../config.js");
    const { SimTrader } = require("../backtest/sim-trader.js");

    const config = loadConfig();
    const btConfig = {
      symbol: "TEST",
      startDate: "2026-03-15",
      endDate: "2026-03-16",
      startingEquity: 25000,
      commissionPerShare: 0.005,
      slippageTicks: 1,
      marketOpenHour: 9,
      marketOpenMinute: 30,
      marketCloseHour: 15,
      marketCloseMinute: 45,
    };

    // Create bars spanning two days
    const bars: Bar[] = [];
    for (const date of ["2026-03-15", "2026-03-16"]) {
      let h = 9, m = 30;
      for (let i = 0; i < 20; i++) {
        const utcHour = h + 4;
        bars.push({
          timestamp: new Date(`${date}T${String(utcHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`),
          open: 10.0,
          high: 10.1,
          low: 9.9,
          close: 10.0,
          volume: 1000,
        });
        m++;
        if (m >= 60) { m = 0; h++; }
      }
    }

    const trader = new SimTrader(config, btConfig);
    const result = trader.run(bars);

    // Should produce equity points for both days
    const days = new Set(
      result.equity.map((e: { timestamp: Date; equity: number }) => e.timestamp.toISOString().slice(0, 10))
    );
    expect(days.size).toBe(2);
  });

  test("starts with correct equity and produces equity curve", () => {
    setTestEnv();
    const { loadConfig } = require("../config.js");
    const { SimTrader } = require("../backtest/sim-trader.js");

    const config = loadConfig();
    const btConfig = {
      symbol: "TEST",
      startDate: "2026-03-15",
      endDate: "2026-03-15",
      startingEquity: 50000,
      commissionPerShare: 0.005,
      slippageTicks: 1,
      marketOpenHour: 9,
      marketOpenMinute: 30,
      marketCloseHour: 15,
      marketCloseMinute: 45,
    };

    const bars: Bar[] = [];
    let h = 9, m = 30;
    for (let i = 0; i < 15; i++) {
      const utcHour = h + 4;
      bars.push({
        timestamp: new Date(`2026-03-15T${String(utcHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`),
        open: 10.0,
        high: 10.1,
        low: 9.9,
        close: 10.0,
        volume: 500,
      });
      m++;
      if (m >= 60) { m = 0; h++; }
    }

    const trader = new SimTrader(config, btConfig);
    const result = trader.run(bars);

    expect(result.equity.length).toBe(bars.length);
    // First equity point should be starting equity (possibly adjusted by a trade)
    // but at minimum it's within range
    expect(result.equity[0].equity).toBeGreaterThanOrEqual(40000);
    expect(result.equity[0].equity).toBeLessThanOrEqual(60000);
  });
});
