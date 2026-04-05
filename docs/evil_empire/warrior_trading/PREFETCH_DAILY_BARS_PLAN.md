# Pre-fetch Daily Bars for Full Date Range

## Context

In `multi-sim.ts`, each of 125 trading days calls `runHistoricalScanner`, which fetches daily bars with a sliding 5-day window. Each date produces unique cache URLs (different `start`/`end` params), so even with caching, the first run makes ~5,000 API calls (125 days x 40 symbol batches). Pre-fetching the full contiguous range reduces this to ~40 calls — a 99% reduction.

The same issue affects RVOL lookback bars (30-day sliding window), adding more redundant calls.

## Plan

### 1. Add `prefetchAllDailyBars()` to `historical-scanner.ts`

New exported function that fetches daily bars for ALL tradeable symbols across the entire date range in one pass:

```typescript
export async function prefetchAllDailyBars(
  client: AlpacaClient,
  config: Config,
  startDate: string,  // earliest date minus buffer (35 days for RVOL)
  endDate: string,    // latest date
): Promise<Map<string, Bar[]>>
```

- Calls `getTradeableSymbols()` once
- Fetches in 200-symbol batches (same as current)
- Uses `limit` large enough to cover the full range (~200 trading days)
- Returns `Map<symbol, Bar[]>` with all daily bars sorted by date

### 2. Add `prefetchedDailyBars` parameter to `runHistoricalScanner()`

```typescript
export async function runHistoricalScanner(
  client: AlpacaClient,
  config: Config,
  targetDate: string,
  prefetchedDailyBars?: Map<string, Bar[]>  // NEW optional param
): Promise<WatchlistEntry[]>
```

When provided:
- **Gap scan** (lines 64-128): Instead of fetching bars per date, filter the pre-fetched bars to find `targetDate` and previous day's bars per symbol. Skip the symbol-batch loop entirely.
- **RVOL** (lines 158-167): Instead of fetching RVOL bars, filter the pre-fetched bars to get the 30-day lookback window for each symbol.

When not provided: existing behavior (backward compatible).

### 3. Update `multi-sim.ts` to pre-fetch once

In the main block (line 384+), before the date loop:
- Calculate range: `start = shiftDate(dates[0], -35)`, `end = dates[dates.length-1]`
- Call `prefetchAllDailyBars(client, config, start, end)`
- Pass result to each `runHistoricalScanner()` call

## Files Modified

- `apps/warrior_trading/src/scanner/historical-scanner.ts` — add `prefetchAllDailyBars()`, modify `runHistoricalScanner()` to accept pre-fetched data
- `apps/warrior_trading/src/multi-sim.ts` — call pre-fetch before date loop, pass to scanner

## Verification

1. Run `bun run src/multi-sim.ts` with a warm cache — should report 0 API calls (same as before)
2. Clear cache, run again — cache misses should be ~40 (symbol batches) instead of ~5,000
3. Results (P&L, trades, win rates) must be identical to before the change
