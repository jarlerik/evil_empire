import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { Bar } from "../../utils/bar.js";
import type { AlpacaClient } from "../../alpaca/client.js";

// Mock the market-data module
const mockGetBars = mock(() => Promise.resolve(new Map<string, Bar[]>()));
mock.module("../../alpaca/market-data.js", () => ({
  getBars: mockGetBars,
  getSnapshots: mock(() => Promise.resolve(new Map())),
}));

// Import after mocking
const { computeRelativeVolume, computeRelativeVolumeBatch } = await import(
  "../relative-volume.js"
);

function makeBar(overrides: Partial<Bar> = {}): Bar {
  return {
    timestamp: new Date("2026-01-15T10:00:00Z"),
    open: 10,
    high: 11,
    low: 9.5,
    close: 10.5,
    volume: 100000,
    ...overrides,
  };
}

const fakeClient = {} as AlpacaClient;

describe("computeRelativeVolume", () => {
  beforeEach(() => {
    mockGetBars.mockReset();
  });

  test("current volume 2x average returns rvol = 2", async () => {
    const historicalBars = [
      makeBar({ volume: 1000 }),
      makeBar({ volume: 1000 }),
      makeBar({ volume: 1000 }),
    ];
    mockGetBars.mockResolvedValueOnce(new Map([["AAPL", historicalBars]]));

    const rvol = await computeRelativeVolume(fakeClient, "AAPL", 2000);
    expect(rvol).toBeCloseTo(2.0, 10);
  });

  test("no historical bars returns 0", async () => {
    mockGetBars.mockResolvedValueOnce(new Map());

    const rvol = await computeRelativeVolume(fakeClient, "AAPL", 5000);
    expect(rvol).toBe(0);
  });

  test("zero average volume returns 0", async () => {
    const historicalBars = [
      makeBar({ volume: 0 }),
      makeBar({ volume: 0 }),
    ];
    mockGetBars.mockResolvedValueOnce(new Map([["AAPL", historicalBars]]));

    const rvol = await computeRelativeVolume(fakeClient, "AAPL", 5000);
    expect(rvol).toBe(0);
  });
});

describe("computeRelativeVolumeBatch", () => {
  beforeEach(() => {
    mockGetBars.mockReset();
  });

  test("batch computes rvol for multiple symbols", async () => {
    const aaplBars = [makeBar({ volume: 1000 }), makeBar({ volume: 3000 })];
    const msftBars = [makeBar({ volume: 500 }), makeBar({ volume: 500 })];
    mockGetBars.mockResolvedValueOnce(
      new Map([
        ["AAPL", aaplBars],
        ["MSFT", msftBars],
      ])
    );

    const symbolVolumes = new Map([
      ["AAPL", 4000], // avg=2000, rvol=2
      ["MSFT", 250], // avg=500, rvol=0.5
    ]);

    const results = await computeRelativeVolumeBatch(fakeClient, symbolVolumes);

    expect(results.get("AAPL")).toBeCloseTo(2.0, 10);
    expect(results.get("MSFT")).toBeCloseTo(0.5, 10);
  });

  test("batch returns 0 for symbols with no historical data", async () => {
    mockGetBars.mockResolvedValueOnce(new Map([["AAPL", [makeBar({ volume: 1000 })]]]));

    const symbolVolumes = new Map([
      ["AAPL", 2000],
      ["TSLA", 5000], // no bars returned
    ]);

    const results = await computeRelativeVolumeBatch(fakeClient, symbolVolumes);
    expect(results.get("AAPL")).toBeCloseTo(2.0, 10);
    expect(results.get("TSLA")).toBe(0);
  });
});
