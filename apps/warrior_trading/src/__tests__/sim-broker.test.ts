import { describe, test, expect } from "bun:test";
import { SimBroker, type PendingOrder } from "../backtest/sim-broker.js";
import type { Bar } from "../utils/bar.js";

function makeBar(overrides: Partial<Bar> = {}): Bar {
  return {
    timestamp: new Date("2026-03-15T10:00:00Z"),
    open: 10.0,
    high: 10.5,
    low: 9.5,
    close: 10.2,
    volume: 1000,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    symbol: "TEST",
    limitPrice: 10.0,
    stopPrice: 9.50,
    targetPrice: 11.0,
    shares: 100,
    submittedAt: new Date("2026-03-15T09:30:00Z"),
    ...overrides,
  };
}

describe("SimBroker", () => {
  describe("entry fills", () => {
    test("fills at limit + slippage when bar touches limit price", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0 }));

      // Bar opens below limit, dips through it during the bar
      const event = broker.onBar(
        makeBar({ open: 9.8, high: 10.5, low: 9.7, close: 10.3 })
      );

      expect(event.type).toBe("filled");
      if (event.type === "filled") {
        // limitPrice(10.0) + slippage(0.01)
        expect(event.position.entryPrice).toBeCloseTo(10.01, 2);
      }
    });

    test("fills at open + slippage on gap through limit", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0 }));

      // Bar opens above limit price (gap through)
      const event = broker.onBar(
        makeBar({ open: 10.3, high: 10.5, low: 10.1, close: 10.4 })
      );

      expect(event.type).toBe("filled");
      if (event.type === "filled") {
        // open(10.3) + slippage(0.01)
        expect(event.position.entryPrice).toBeCloseTo(10.31, 2);
      }
    });

    test("does not fill when bar does not reach limit", () => {
      const broker = new SimBroker(1, 0.005);
      // Limit price well above bar range — bar never touches it
      broker.submitOrder(makeOrder({ limitPrice: 12.0 }));

      const event = broker.onBar(
        makeBar({ open: 10.0, high: 10.5, low: 9.5, close: 10.2 })
      );

      expect(event.type).toBe("pending");
    });
  });

  describe("exit fills", () => {
    test("exits at target - slippage when target is hit", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0, targetPrice: 11.0, stopPrice: 9.5 }));

      // Fill the order first
      broker.onBar(makeBar({ open: 10.2, high: 10.5, low: 9.8, close: 10.3 }));
      expect(broker.hasPosition).toBe(true);

      // Target hit
      const event = broker.onBar(
        makeBar({ open: 10.5, high: 11.2, low: 10.3, close: 11.0 })
      );

      expect(event.type).toBe("exited");
      if (event.type === "exited") {
        expect(event.exit.exitReason).toBe("target");
        // target(11.0) - slippage(0.01)
        expect(event.exit.exitPrice).toBeCloseTo(10.99, 2);
      }
    });

    test("exits at stop - slippage when stop is hit", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0, stopPrice: 9.5, targetPrice: 11.0 }));

      // Fill
      broker.onBar(makeBar({ open: 10.2, high: 10.5, low: 9.8, close: 10.3 }));

      // Stop hit
      const event = broker.onBar(
        makeBar({ open: 10.0, high: 10.2, low: 9.3, close: 9.6 })
      );

      expect(event.type).toBe("exited");
      if (event.type === "exited") {
        expect(event.exit.exitReason).toBe("stop");
        // stop(9.5) - slippage(0.01)
        expect(event.exit.exitPrice).toBeCloseTo(9.49, 2);
      }
    });

    test("gap through stop exits at open - slippage", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0, stopPrice: 9.5, targetPrice: 11.0 }));

      // Fill
      broker.onBar(makeBar({ open: 10.2, high: 10.5, low: 9.8, close: 10.3 }));

      // Gap through stop
      const event = broker.onBar(
        makeBar({ open: 9.3, high: 9.8, low: 9.1, close: 9.4 })
      );

      expect(event.type).toBe("exited");
      if (event.type === "exited") {
        expect(event.exit.exitReason).toBe("stop");
        // open(9.3) - slippage(0.01)
        expect(event.exit.exitPrice).toBeCloseTo(9.29, 2);
      }
    });

    test("both stop and target in range — stop fills first (conservative)", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0, stopPrice: 9.5, targetPrice: 10.5 }));

      // Fill
      broker.onBar(makeBar({ open: 10.2, high: 10.4, low: 9.8, close: 10.1 }));

      // Both stop and target in range
      const event = broker.onBar(
        makeBar({ open: 10.0, high: 10.8, low: 9.2, close: 10.3 })
      );

      expect(event.type).toBe("exited");
      if (event.type === "exited") {
        expect(event.exit.exitReason).toBe("stop");
      }
    });
  });

  describe("force exit", () => {
    test("force exits at close - slippage for EOD flatten", () => {
      const broker = new SimBroker(2, 0.005); // 2 ticks slippage
      broker.submitOrder(makeOrder({ limitPrice: 10.0 }));

      // Fill
      broker.onBar(makeBar({ open: 10.2, high: 10.5, low: 9.8, close: 10.3 }));

      const exitTime = new Date("2026-03-15T15:45:00Z");
      const result = broker.forceExit(10.4, exitTime, "eod-flatten");

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe("eod-flatten");
      // close(10.4) - slippage(0.02)
      expect(result!.exitPrice).toBeCloseTo(10.38, 2);
      expect(broker.hasPosition).toBe(false);
    });
  });

  describe("commission", () => {
    test("calculates round-trip commission", () => {
      const broker = new SimBroker(1, 0.005);
      // 100 shares × 2 × $0.005 = $1.00
      expect(broker.getCommission(100)).toBeCloseTo(1.0, 2);
    });
  });

  describe("bars held tracking", () => {
    test("tracks bars held correctly", () => {
      const broker = new SimBroker(1, 0.005);
      broker.submitOrder(makeOrder({ limitPrice: 10.0, stopPrice: 8.0, targetPrice: 15.0 }));

      // Fill on bar 1
      broker.onBar(makeBar({ open: 10.2, high: 10.5, low: 9.8, close: 10.3 }));

      // 3 more bars
      broker.onBar(makeBar({ open: 10.3, high: 10.6, low: 10.0, close: 10.4 }));
      broker.onBar(makeBar({ open: 10.4, high: 10.7, low: 10.1, close: 10.5 }));
      broker.onBar(makeBar({ open: 10.5, high: 10.8, low: 10.2, close: 10.6 }));

      expect(broker.currentPosition).not.toBeNull();
      expect(broker.currentPosition!.barsHeld).toBe(3);
    });
  });
});
