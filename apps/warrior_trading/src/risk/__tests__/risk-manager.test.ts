import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm as rmdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { makeConfig, makeSignal } from "../../__tests__/helpers/fixtures.js";
import { RiskManager } from "../risk-manager.js";

describe("RiskManager", () => {
  const config = makeConfig();
  let manager: RiskManager;
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Use a temp dir so state-persistence file I/O is isolated
    originalCwd = process.cwd();
    tmpDir = await mkdtemp(join(tmpdir(), "risk-mgr-test-"));
    process.chdir(tmpDir);

    manager = new RiskManager(config);
    await manager.initialize(25_000);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rmdir(tmpDir, { recursive: true, force: true });
  });

  test("approves valid signal with R:R >= 2 and within limits", () => {
    // entry=10, stop=9, target=12 -> reward=2, risk=1, R:R=2.0
    const signal = makeSignal({
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 12,
    });

    const result = manager.evaluateSignal(signal, 25_000);

    expect(result.approved).toBe(true);
    expect(result.reason).toBe("Approved");
    expect(result.positionSize.shares).toBeGreaterThan(0);
  });

  test("rejects signal with R:R below minimum (1.5:1 < 2:1)", () => {
    // entry=10, stop=9, target=11.5 -> reward=1.5, risk=1, R:R=1.5
    const signal = makeSignal({
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 11.5,
    });

    const result = manager.evaluateSignal(signal, 25_000);

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("R:R ratio");
    expect(result.reason).toContain("below minimum");
  });

  test("rejects when daily loss limit is hit", async () => {
    // maxDailyLossPct=10%, equity=25000 -> max loss = $2500
    await manager.onTradeCompleted({
      symbol: "TEST",
      pnl: -2500,
      entryPrice: 10,
      exitPrice: 5,
      shares: 500,
    });

    const signal = makeSignal({
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 12,
    });

    const result = manager.evaluateSignal(signal, 25_000);

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Daily loss limit reached");
  });

  test("rejects after 3 consecutive losses", async () => {
    for (let i = 0; i < 3; i++) {
      manager.onPositionOpened();
      await manager.onTradeCompleted({
        symbol: "TEST",
        pnl: -50,
        entryPrice: 10,
        exitPrice: 9.5,
        shares: 100,
      });
    }

    const signal = makeSignal({
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 12,
    });

    const result = manager.evaluateSignal(signal, 25_000);

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("consecutive losses");
  });

  test("rejects when position is already open", () => {
    manager.onPositionOpened();

    const signal = makeSignal({
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 12,
    });

    const result = manager.evaluateSignal(signal, 25_000);

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("open position");
  });

  test("resets state on new trading day (fresh initialize)", async () => {
    // No state file in temp dir => loadRiskState returns fresh default
    const freshManager = new RiskManager(config);
    await freshManager.initialize(25_000);

    const signal = makeSignal({
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 12,
    });

    const result = freshManager.evaluateSignal(signal, 25_000);

    expect(result.approved).toBe(true);
    expect(freshManager.dailyPnL).toBe(0);
    expect(freshManager.consecutiveLosses).toBe(0);
    expect(freshManager.tradesCompleted).toBe(0);
  });

  test("onTradeCompleted updates win/loss tracking correctly", async () => {
    // Win
    manager.onPositionOpened();
    await manager.onTradeCompleted({
      symbol: "TEST",
      pnl: 200,
      entryPrice: 10,
      exitPrice: 12,
      shares: 100,
    });

    expect(manager.dailyPnL).toBe(200);
    expect(manager.tradesCompleted).toBe(1);
    expect(manager.winRate).toBe(1);
    expect(manager.consecutiveLosses).toBe(0);

    // Loss
    manager.onPositionOpened();
    await manager.onTradeCompleted({
      symbol: "TEST",
      pnl: -100,
      entryPrice: 10,
      exitPrice: 9,
      shares: 100,
    });

    expect(manager.dailyPnL).toBe(100);
    expect(manager.tradesCompleted).toBe(2);
    expect(manager.winRate).toBe(0.5);
    expect(manager.consecutiveLosses).toBe(1);

    // Another win resets consecutive losses
    manager.onPositionOpened();
    await manager.onTradeCompleted({
      symbol: "TEST",
      pnl: 150,
      entryPrice: 10,
      exitPrice: 11.5,
      shares: 100,
    });

    expect(manager.consecutiveLosses).toBe(0);
    expect(manager.tradesCompleted).toBe(3);
    expect(manager.winRate).toBeCloseTo(2 / 3);
  });
});
