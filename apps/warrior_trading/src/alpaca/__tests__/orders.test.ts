import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  placeBracketOrder,
  waitForFill,
  placeOrder,
  getOrder,
} from "../orders.js";

// Helper to create a raw Alpaca order response (snake_case)
function makeRawOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-123",
    client_order_id: "client-456",
    symbol: "AAPL",
    qty: "100",
    side: "buy",
    type: "market",
    status: "new",
    filled_qty: "0",
    filled_avg_price: null,
    created_at: "2026-04-02T10:00:00Z",
    ...overrides,
  };
}

// Mock client
function makeMockClient() {
  return {
    createOrder: mock(async (params: any) => makeRawOrder(params)),
    getOrder: mock(async (_params: any) => makeRawOrder()),
    cancelOrder: mock(async () => {}),
    closePosition: mock(async () => makeRawOrder({ status: "filled" })),
    closePositions: mock(async () => {}),
  };
}

// Save original Date so we can mock it for trading hours check
const OriginalDate = globalThis.Date;

// Track elapsed time for Date.now() so waitForFill's timeout logic works
let mockTimeOffset = 0;

function mockTradingHours(etHour: number) {
  mockTimeOffset = 0;

  const now = new OriginalDate();
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const currentETHour = Number(
    etFormatter.formatToParts(now).find((p) => p.type === "hour")!.value
  );
  const diffMs = (etHour - currentETHour) * 60 * 60 * 1000;
  const targetTime = new OriginalDate(now.getTime() + diffMs);

  globalThis.Date = class extends OriginalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(targetTime.getTime() + mockTimeOffset);
      } else {
        // @ts-ignore
        super(...args);
      }
    }
    static now() {
      return targetTime.getTime() + mockTimeOffset;
    }
  } as any;
}

// Mock Bun.sleep to be instant but advance mock time
const originalBunSleep = Bun.sleep;
Bun.sleep = (async (ms: number) => {
  mockTimeOffset += ms;
}) as any;

afterEach(() => {
  globalThis.Date = OriginalDate;
  mockTimeOffset = 0;
});

describe("orders", () => {
  test("placeBracketOrder sends correct bracket structure with take profit and stop loss", async () => {
    mockTradingHours(10); // 10 AM ET — within trading hours
    const client = makeMockClient();

    await placeBracketOrder(client as any, {
      symbol: "TSLA",
      qty: 50,
      side: "buy",
      type: "limit",
      timeInForce: "day",
      limitPrice: 150,
      takeProfitPrice: 165,
      stopLossPrice: 140,
    });

    expect(client.createOrder).toHaveBeenCalledTimes(1);
    const callArgs = client.createOrder.mock.calls[0][0];
    expect(callArgs.order_class).toBe("bracket");
    expect(callArgs.symbol).toBe("TSLA");
    expect(callArgs.qty).toBe(50);
    expect(callArgs.take_profit).toEqual({ limit_price: "165" });
    expect(callArgs.stop_loss).toEqual({ stop_price: "140" });
    expect(callArgs.limit_price).toBe(150);
  });

  test("waitForFill cancels order after timeout when status stays 'new'", async () => {
    mockTradingHours(10);
    const client = makeMockClient();

    // getOrder always returns "new" status — never fills
    client.getOrder = mock(async () => makeRawOrder({ status: "new" }));
    // After cancel, getOrder returns "canceled"
    let cancelled = false;
    client.cancelOrder = mock(async () => {
      cancelled = true;
    });
    // Once cancelled, return canceled status
    const originalGetOrder = client.getOrder;
    client.getOrder = mock(async (params: any) => {
      if (cancelled) return makeRawOrder({ status: "canceled" });
      return makeRawOrder({ status: "new" });
    });

    const result = await waitForFill(client as any, "order-123", 1000); // 1s timeout

    expect(client.cancelOrder).toHaveBeenCalled();
    expect(result.status).toBe("canceled");
  });

  test("assertTradingHours throws outside market hours", async () => {
    mockTradingHours(2); // 2 AM ET — outside trading hours (pre-market starts at 4 AM)
    const client = makeMockClient();

    await expect(
      placeOrder(client as any, {
        symbol: "AAPL",
        qty: 10,
        side: "buy",
        type: "market",
        timeInForce: "day",
      })
    ).rejects.toThrow("outside trading hours");
  });

  test("normalizeOrder maps snake_case to camelCase correctly", async () => {
    mockTradingHours(10);
    const client = makeMockClient();
    client.getOrder = mock(async () =>
      makeRawOrder({
        id: "ord-789",
        client_order_id: "cli-012",
        filled_qty: "50",
        filled_avg_price: "155.25",
        created_at: "2026-04-02T14:30:00Z",
        legs: [
          makeRawOrder({
            id: "leg-1",
            client_order_id: "cli-leg-1",
            type: "limit",
            status: "new",
          }),
        ],
      })
    );

    const result = await getOrder(client as any, "ord-789");

    expect(result.id).toBe("ord-789");
    expect(result.clientOrderId).toBe("cli-012");
    expect(result.filledQty).toBe("50");
    expect(result.filledAvgPrice).toBe("155.25");
    expect(result.createdAt).toBe("2026-04-02T14:30:00Z");
    expect(result.legs).toHaveLength(1);
    expect(result.legs![0].id).toBe("leg-1");
    expect(result.legs![0].clientOrderId).toBe("cli-leg-1");
  });
});
