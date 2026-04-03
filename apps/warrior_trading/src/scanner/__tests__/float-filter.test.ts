import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { filterByFloat } from "../float-filter.js";
import type { GapCandidate } from "../gap-scanner.js";
import type { Config } from "../../config.js";

const baseConfig = {
  alpaca: {
    keyId: "test-key",
    secretKey: "test-secret",
    paper: true,
  },
  scanner: {
    minGapPct: 5,
    prefGapPct: 20,
    minPrice: 1,
    maxPrice: 20,
    maxFloat: 20_000_000,
    minRelVolume: 5,
  },
} as Config;

function makeCandidate(symbol: string): GapCandidate {
  return {
    symbol,
    gapPct: 10,
    price: 8,
    volume: 500_000,
    prevClose: 7.27,
    relativeVolume: 0,
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Default mock — override per test as needed
  globalThis.fetch = mock(async (url: string) => {
    const symbol = (url as string).split("/").pop();
    const responses: Record<string, { symbol: string; shares_outstanding?: number }> = {
      LOWFLOAT: { symbol: "LOWFLOAT", shares_outstanding: 5_000_000 },
      HIGHFLOAT: { symbol: "HIGHFLOAT", shares_outstanding: 50_000_000 },
      NOFLOAT: { symbol: "NOFLOAT" },
    };
    const data = responses[symbol!];
    if (!data) {
      return new Response(null, { status: 404 });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("filterByFloat", () => {
  test("passes candidate with float below maxFloat (5M < 20M)", async () => {
    const candidates = [makeCandidate("LOWFLOAT")];

    const results = await filterByFloat(candidates, baseConfig);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe("LOWFLOAT");
  });

  test("excludes candidate with float above maxFloat (50M > 20M)", async () => {
    const candidates = [makeCandidate("HIGHFLOAT")];

    const results = await filterByFloat(candidates, baseConfig);

    expect(results).toHaveLength(0);
  });

  test("includes candidate with no float data and continues processing others", async () => {
    // NOFLOAT has no shares_outstanding → included anyway
    // LOWFLOAT has 5M → included
    // HIGHFLOAT has 50M → excluded
    // APIERR triggers a fetch error → fetchAssetDetails returns null → included
    globalThis.fetch = mock(async (url: string) => {
      const symbol = (url as string).split("/").pop();
      if (symbol === "APIERR") {
        throw new Error("Network failure");
      }
      const responses: Record<string, { symbol: string; shares_outstanding?: number }> = {
        NOFLOAT: { symbol: "NOFLOAT" },
        LOWFLOAT: { symbol: "LOWFLOAT", shares_outstanding: 5_000_000 },
        HIGHFLOAT: { symbol: "HIGHFLOAT", shares_outstanding: 50_000_000 },
      };
      const data = responses[symbol!];
      if (!data) return new Response(null, { status: 404 });
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    const candidates = [
      makeCandidate("NOFLOAT"),
      makeCandidate("LOWFLOAT"),
      makeCandidate("HIGHFLOAT"),
      makeCandidate("APIERR"),
    ];

    const results = await filterByFloat(candidates, baseConfig);

    const resultSymbols = results.map((r) => r.symbol);
    // NOFLOAT: no float data → included
    expect(resultSymbols).toContain("NOFLOAT");
    // LOWFLOAT: 5M < 20M → included
    expect(resultSymbols).toContain("LOWFLOAT");
    // HIGHFLOAT: 50M > 20M → excluded
    expect(resultSymbols).not.toContain("HIGHFLOAT");
    // APIERR: fetch threw → null → included
    expect(resultSymbols).toContain("APIERR");
    expect(results).toHaveLength(3);
  });
});
