import { mock } from "bun:test";

/**
 * Create a mock Alpaca client with canned responses.
 * Each method is a bun:test mock function that can be inspected or overridden.
 */
export function createMockAlpacaClient() {
  return {
    getAccount: mock(async () => ({
      id: "mock-account-id",
      account_number: "MOCK123",
      status: "ACTIVE",
      currency: "USD",
      buying_power: "50000",
      cash: "25000",
      portfolio_value: "25000",
      equity: "25000",
      last_equity: "25000",
      pattern_day_trader: false,
      trading_blocked: false,
      account_blocked: false,
    })),

    getAssets: mock(async () => [
      {
        id: "asset-1",
        class: "us_equity",
        exchange: "NASDAQ",
        symbol: "TEST",
        name: "Test Corp",
        status: "active",
        tradable: true,
        shortable: true,
        fractionable: false,
      },
    ]),

    getStocksBars: mock(async () => ({
      bars: {
        TEST: [
          {
            t: "2026-01-15T10:00:00Z",
            o: 10,
            h: 11,
            l: 9.5,
            c: 10.5,
            v: 100000,
            n: 500,
            vw: 10.2,
          },
        ],
      },
    })),

    getStocksSnapshots: mock(async () => ({
      TEST: {
        latestTrade: { p: 10.5, s: 100, t: "2026-01-15T10:00:00Z" },
        latestQuote: {
          bp: 10.49,
          bs: 200,
          ap: 10.51,
          as: 300,
          t: "2026-01-15T10:00:00Z",
        },
        minuteBar: {
          t: "2026-01-15T10:00:00Z",
          o: 10,
          h: 11,
          l: 9.5,
          c: 10.5,
          v: 100000,
          n: 500,
          vw: 10.2,
        },
        dailyBar: {
          t: "2026-01-15T00:00:00Z",
          o: 9,
          h: 11,
          l: 8.5,
          c: 10.5,
          v: 500000,
          n: 2500,
          vw: 10.0,
        },
        prevDailyBar: {
          t: "2026-01-14T00:00:00Z",
          o: 8.5,
          h: 9.5,
          l: 8,
          c: 9,
          v: 300000,
          n: 1500,
          vw: 8.8,
        },
      },
    })),

    createOrder: mock(async () => ({
      id: "order-1",
      client_order_id: "client-order-1",
      status: "accepted",
      symbol: "TEST",
      qty: "100",
      side: "buy",
      type: "limit",
      time_in_force: "day",
      limit_price: "10.50",
      filled_avg_price: null,
      filled_qty: "0",
      created_at: "2026-01-15T10:00:00Z",
    })),

    getOrder: mock(async () => ({
      id: "order-1",
      client_order_id: "client-order-1",
      status: "filled",
      symbol: "TEST",
      qty: "100",
      side: "buy",
      type: "limit",
      time_in_force: "day",
      limit_price: "10.50",
      filled_avg_price: "10.50",
      filled_qty: "100",
      created_at: "2026-01-15T10:00:00Z",
      filled_at: "2026-01-15T10:00:01Z",
    })),

    cancelOrder: mock(async () => ({})),

    closePosition: mock(async () => ({
      id: "order-2",
      status: "accepted",
      symbol: "TEST",
      qty: "100",
      side: "sell",
    })),

    closePositions: mock(async () => []),

    getNews: mock(async () => ({
      news: [
        {
          id: 1,
          headline: "Test Corp Announces Q4 Results",
          summary: "Test Corp reported earnings above expectations.",
          author: "Test Author",
          created_at: "2026-01-15T08:00:00Z",
          symbols: ["TEST"],
          source: "test-source",
          url: "https://example.com/news/1",
        },
      ],
    })),
  };
}
