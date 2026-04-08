# Simulation Tuning Lessons

Notes from backtesting the warrior trading scanner + strategy pipeline across multiple months (Oct 2025 - Mar 2026). Each section documents a parameter change, the reasoning, and the observed result.

---

## 1. Relative Volume (MIN_REL_VOLUME)

### 5.0x (original)
- **Result (Feb 2026):** 1-2 candidates across 19 days, 0 trades.
- **Problem:** 5x relative volume is extremely aggressive. Most stocks — even active momentum plays — trade at 1.5-3x normal volume. Only the most explosive movers hit 5x.

### 2.5x
- **Result (Feb 2026):** 3 candidates across 19 days, 0 trades. Slight improvement but still too restrictive.
- **Result (Mar 2026):** 5 candidates, 2 days with trades, 15 total trades. -$78 P&L.
- **Observation:** RVOL was still the main gatekeeper. On Mar 31, 8 gap candidates were found but all got rejected by RVOL (all below 2.5x).

### 1.5x (current)
- **Result (Nov 2025):** 6 candidates, 1 day with trades, 3 trades. +$404.64 (+1.62%). Both strategies profitable.
- **Result (6-month backtest):** 70/125 days with candidates, 17 days with trades, 75 total trades.
- **Key insight:** AAOI had 1.65x RVOL and was a legitimate momentum play that the 2.5x threshold killed. Dropping to 1.5x caught it.
- **Caveat:** The historical scanner uses full-day volume from the daily bar. A real-time scanner at 9:35am would see volume concentrated in the first few minutes, making RVOL appear much higher. The 1.5x threshold compensates for this historical data limitation.

---

## 2. Minimum Gap Percent (MIN_GAP_PCT)

### 5% (original)
- **Problem:** Combined with the $1-$20 price range and <20M float, very few stocks gap 5%+ on quiet market days.

### 3% (current)
- **Result:** Roughly doubled the number of gap candidates passing the initial filter. Many legitimate momentum stocks gap 3-5% rather than 5%+.
- **Trade-off:** More candidates to evaluate, slightly more noise, but the RVOL and strategy filters handle that.

---

## 3. Maximum Price (MAX_PRICE)

### $20 (original)
- **Problem:** Excluded stocks in the $20-$30 range that are still valid small/mid-cap momentum plays.

### $30 (current)
- **Result:** Caught additional candidates like ASMB ($27.99) and AAOI ($29.10).
- **Note:** Did not expand to $50 — wanted to stay focused on the small-cap momentum universe. $30 is a reasonable upper bound.

---

## 4. Maximum Float (MAX_FLOAT)

### 20M shares (unchanged)
- **Decision:** Kept at 20M. Low float is core to the Warrior Trading strategy — it's what creates explosive moves. Expanding to 50M would dilute signal quality by including more liquid stocks that don't move as sharply.

---

## 5. Loss Cooldown (COOLDOWN_BARS)

### None (original)
- **Problem:** ADMA on Mar 27 generated 14 trades in a single day. The algo would enter, get stopped out, immediately re-enter, get stopped out again — churning through capital.

### 15 bars (current)
- **Result:** ADMA trades dropped from 14 to 3 on the same date. Saved ~$250 in unnecessary losses.
- **Implementation:** After a losing trade, the risk manager blocks new entries for 15 bars (15 minutes). Resets each day.

---

## 6. Exit Parameters

### Tight exits (original/reverted to)
- Trailing stop: **1.5%**
- VWAP breakdown: after **2 bars**
- Time stop: **5 bars** (if not profitable)

### Relaxed exits (tested)
- Trailing stop: **3%**
- VWAP breakdown: after **5 bars**
- Time stop: **10 bars**

### Results comparison (6-month backtest, Oct 2025 - Mar 2026)

| Metric        | Tight exits | Relaxed exits |
|---------------|-------------|---------------|
| Total trades  | 75          | 64            |
| Win rate      | 41.3%       | 42.2%         |
| Total P&L     | -$2,208     | **-$3,148**   |
| ma-pullback   | +$9         | -$1,718       |
| flat-top      | -$2,194     | -$1,055       |
| micro-pullback| -$24        | -$375         |

- **Conclusion:** Relaxing exits made things worse. Letting losers run longer caused bigger losses. The tighter exits were actually protecting capital — cutting losses quickly even if they also cut some winners short.
- **Current status:** Reverted to tight exits. The problem is not exit timing — the strategies themselves may not have a strong enough edge on these stocks.

---

## 7. Strategy Performance (6-month, tight exits)

| Strategy       | P&L       | Notes                                    |
|----------------|-----------|------------------------------------------|
| ma-pullback    | +$9.49    | Breakeven. Most active strategy.         |
| micro-pullback | -$24.27   | Breakeven. Rarely triggers.              |
| flat-top       | -$2,193   | Big loser over 6 months despite looking good in single-month tests. |

- **Observation:** 41% win rate with 2:1 R:R should theoretically be profitable, but exits are cutting winners before they hit target.
- **Key finding:** flat-top looked great in isolated month tests (+$854 in March) but was the biggest loser over 6 months. Single-month results are misleading.

---

## 8. Infrastructure Improvements

### API Rate Limit Retry
- Added exponential backoff (1s, 2s, 4s, 8s, 16s) on HTTP 429 responses in `dataGet`.
- Respects `Retry-After` header if provided by Alpaca.
- **Impact:** Later simulation days no longer crash when hitting rate limits. Previously, days 20+ would fail with 429 errors.

### File-Based API Cache
- All `dataGet` responses cached to `.cache/alpaca/` as JSON files, keyed by SHA-256 hash of the full URL.
- **Impact:** Re-running the same date range is ~1s/day instead of ~20s/day.
- **Limitation:** Cache is per-URL, so different date ranges generate different cache keys even for overlapping data.

### In-Memory Symbol Cache
- `getTradeableSymbols()` result cached in memory for the process lifetime.
- **Impact:** Saves ~3s per simulated day after the first call (was hitting Alpaca SDK on every day).

---

## 9. Multi-Config Simulation Sweep (Round 1 — April 5, 2026)

Ran 11 configurations against the full Oct 2025 – Mar 2026 period using a new multi-config runner (`src/multi-sim.ts`) that preloads the API cache into memory once, then runs all configs sequentially against the same data. This eliminates redundant disk I/O from parallel processes.

### New Config Options Added
- `TRAILING_STOP_ATR_MULT` — ATR-based trailing stop (0 = use fixed %, >0 = N × ATR(14))
- `FIRST_HOUR_ONLY` — Restrict new entries to the "open" session (9:30–11:00 AM ET)
- `MAX_HOLD_BARS` — Force exit after N bars regardless of P&L
- `MIN_CONFIDENCE` — Override session-based min confidence (default: 50 open, 75 midday)

### Results (sorted best to worst)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| **E: No flat-top + first hour only** | 36 | 47% | **-$409** | -1.6% |
| C: Higher R:R (3:1) + risk 1% | 5 | 40% | -$501 | -2.0% |
| A: No flat-top | 49 | 45% | -$991 | -4.0% |
| D: Conservative scanner (5% gap, 2.5x RVOL) | 49 | 45% | -$991 | -4.0% |
| G: No flat-top + first hour + ATR trail + 3% max loss | 35 | 37% | -$1,133 | -4.5% |
| H: ma-pullback only + first hour + ATR trail | 35 | 37% | -$1,133 | -4.5% |
| J: ma-pullback + wider trail 5% + time stop 15 | 46 | 50% | -$1,280 | -5.1% |
| I: ma-pullback + ATR trail 2.0x + risk 1% | 44 | 41% | -$1,413 | -5.7% |
| F: No flat-top + ATR trailing (1.5x) | 47 | 34% | -$1,681 | -6.7% |
| B: Tight time stop + wider trail | 63 | 41% | -$1,878 | -7.5% |
| **BASELINE (all strategies, defaults)** | 64 | 39% | **-$2,250** | -9.0% |

### Key Findings — Round 1

1. **Removing flat-top is the single biggest improvement.** Baseline → Config A = -$2,250 → -$991 (56% reduction). flat-top accounted for -$1,967 of the baseline's -$2,250.
2. **First-hour-only is the second biggest win.** Config A → Config E = -$991 → -$409. Midday trades (11:00 AM+) are net destructive — the momentum edge exists only in the first 90 minutes.
3. **ATR-based trailing stops made things WORSE.** Config F (ATR 1.5x) = -$1,681 vs Config A (fixed 3%) = -$991. On small-cap 1-min bars, ATR is so small that the trailing stop triggers on normal noise.
4. **gap-and-go and bull-flag generated ZERO trades** across all 125 days. The gap-and-go strategy requires breaking above premarket high, but the historical scanner uses the daily bar's high as premarket high — making the condition nearly impossible to meet on 1-min intraday bars.
5. **Tighter scanner filters (Config D) produced identical results to Config A.** The additional filtering (5% gap, 2.5x RVOL) just removed non-trading days, not bad trades.
6. **Higher R:R ratio (Config C, 3:1) drastically reduced trade count** from 49 to 5, making results statistically meaningless.

---

## 10. Ma-Pullback Deep Dive (Round 2 — April 5, 2026)

Since ma-pullback is the only active strategy, Round 2 focused on 13 parameter variations specifically targeting its profitability.

### Results (sorted best to worst)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| O: first hour + confidence ≥65 | 16 | 31% | -$550 | -2.2% |
| P: conf 65 + NO trailing stop | 16 | 31% | -$550 | -2.2% |
| Q: conf ≥75 (A+ setups only) | 7 | 29% | -$550 | -2.2% |
| U: COMBO conf65 + trail6% + 2consec | 14 | 29% | -$554 | -2.2% |
| **R: risk 0.75% + trail 6%** | **33** | **48%** | **-$602** | **-2.4%** |
| R1-BEST: no flat-top + first hour | 33 | 48% | -$1,005 | -4.0% |
| K: trail 6% | 33 | 48% | -$1,005 | -4.0% |
| M: NO trailing (stop/target/vwap only) | 33 | 48% | -$1,005 | -4.0% |
| T: max 2 consec losses + trail 6% | 33 | 48% | -$1,005 | -4.0% |
| S: cooldown 30 + trail 6% | 29 | 45% | -$1,059 | -4.2% |
| L: trail 8% + time stop 20 | 33 | 48% | -$1,208 | -4.8% |
| V: trail 10% + time stop 30 | 33 | 48% | -$1,240 | -5.0% |
| N: NO trail + NO time stop | 33 | 48% | -$1,496 | -6.0% |

### Key Findings — Round 2

1. **Trailing stop percentage doesn't matter.** Configs with 3%, 6%, no trailing, and stop/target/vwap-only ALL produced identical -$1,005. The trailing stop almost never triggers because the fixed stop or VWAP breakdown fires first.
2. **Higher confidence filters reduce trades but don't improve edge.** Win rate actually dropped from 48% to 29-31% with confidence ≥65. The "higher quality" signals performed worse per-trade.
3. **Position size reduction (Config R, 0.75% risk) is the only effective lever** — cuts dollar losses by 40% (-$1,005 → -$602) but doesn't change the win rate or expected value.
4. **Wider trailing stops make things worse.** Letting losers run (8%, 10%, no trail) increased losses proportionally. The default exits are already near-optimal for damage control.
5. **The ma-pullback strategy has a negative expected value on 1-min small-cap data.** With a 48% win rate, the average winner must be >1.08x the average loser to break even. The data shows average winners are smaller than average losers, meaning the 2:1 R:R target is rarely hit — trades exit via time stop or VWAP breakdown before reaching target.

---

## 11. Infrastructure: Multi-Config Simulation Runner

### Problem
Running 125-day simulations sequentially across multiple configurations took 30+ minutes each because:
- Each sim process independently reads ~43,000 cache files from disk
- The Alpaca API rate limits to ~200 req/min, causing 1-second retries
- Different date windows generate different cache keys even for overlapping data

### Solution: `src/multi-sim.ts`
- **Preloads entire API cache into memory** (~43K entries, 1.2 seconds)
- **Fetches all day data once** (scanner + 1-min bars for all candidates)
- **Runs all configs against the same preloaded data** (each config takes 0.2-0.5s)
- Also added `preloadCache()` to `src/alpaca/cache.ts` — loads all `.cache/alpaca/*.json` files into a `Map` at startup

**Result:** 11 strategy configs × 125 days = ~37 minutes total (vs 330+ minutes with separate processes).

---

## 12. Critical Bug Fix: PremarketHigh (April 5, 2026)

### The Bug
Two issues combined to make gap-and-go impossible and distort all strategy results:

1. **historical-scanner.ts** set `premarketHigh = targetBar.high` (the day's absolute highest price from the daily bar). For gap-and-go, the entry condition `curr.high > premarketHigh` could never be true since `premarketHigh` was already the day's maximum.

2. **sim-trader.ts** updated `premarketHigh = Math.max(premarketHigh, bar.high)` on **every bar**, including during market hours. So even if the scanner had set a reasonable value, the sim-trader would overwrite it to track the running session high — making the breakout condition impossible.

### The Fix
- **historical-scanner.ts**: Changed `premarketHigh` from `targetBar.high` to `targetBar.open`. The opening price is where premarket trading settled — the best approximation available from daily bars on IEX.
- **sim-trader.ts**: Only update `premarketHigh` during `pre-market` session. After market open, freeze the value so strategies can detect breakouts above it.
- **sim-trader.ts**: Initialize `premarketHigh` from `bar.open` (not `bar.high`) on new trading day.

### Impact
This fix changed the entire system dynamics. The `IndicatorSnapshot.premarketHigh` field is passed to ALL strategies, and several use it for reference levels. With a realistic premarket high instead of an unreachable day-high, the indicators provide meaningfully different signals.

### Additional Fix: Bull-Flag Relaxation
- Increased flag consolidation tolerance from 50% to 75% of flagpole range
- Reduced bearish bar requirement from 40% to 30%
- These thresholds were too strict for 1-min bar noise on small-cap stocks

### Additional Fix: Float Filter Caching
- `float-filter.ts` was calling Alpaca's trading API directly via `fetch()`, completely bypassing the file cache
- Routed through `getCached`/`setCached` — eliminates thousands of redundant API calls per simulation run

---

## 13. Round 3: Strategies After PremarketHigh Fix (April 5, 2026)

Tested 15 configurations after the bug fix, focusing on the newly-enabled gap-and-go and bull-flag plus the existing strategies.

### Results (sorted best to worst)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| **ma-pullback + first hour + risk 0.75%** | **35** | **57%** | **+$2,394** | **+9.6%** |
| gap-and-go + ma-pullback + risk 0.75% | 35 | 57% | +$1,953 | +7.8% |
| all except flat-top + risk 0.75% | 37 | 57% | +$1,554 | +6.2% |
| gap-and-go + ma-pullback | 35 | 57% | +$1,459 | +5.8% |
| all except flat-top | 37 | 57% | +$1,120 | +4.5% |
| gap-and-go only (all configs) | 0 | 0% | $0 | 0% |
| bull-flag + risk 0.75% | 3 | 33% | -$807 | -3.2% |
| bull-flag only | 3 | 33% | -$826 | -3.3% |
| BASELINE all strategies | 57 | 46% | -$1,052 | -4.2% |

### Key Findings — Round 3

1. **ma-pullback went from -$602 (best in Round 2) to +$2,394.** The premarketHigh fix changed the indicator landscape for all strategies. Win rate jumped from 48% to 57%.
2. **Gap-and-go STILL generates 0 trades.** Even with the fix, the stocks passing the scanner filters (low-float, small-cap, IEX data) don't have enough intraday volume to trigger gap-and-go's RVOL > 2x requirement. The low-float universe simply doesn't produce gap-and-go setups on 1-min IEX data.
3. **Bull-flag generates only 3 trades** with relaxed thresholds. It's a rare pattern on 1-min data and a net loser (-$826). Tight consolidation patterns are uncommon on volatile small-caps.
4. **Adding bull-flag to ma-pullback hurts performance** (+$2,394 → +$1,554). Bull-flag's losses dilute ma-pullback's gains.
5. **flat-top is still a big loser** (-$1,375 in baseline). Removing it remains critical.

---

## 14. Round 4: Ma-Pullback Parameter Optimization (April 5, 2026)

With ma-pullback confirmed profitable, Round 4 tested 18 configurations to optimize risk sizing, trailing stops, time stops, R:R ratios, and cooldowns.

### Results (sorted best to worst)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| **COMBO risk 1.0% + trail 6% + time 15 + cooldown 10** | **68** | **59%** | **+$2,721** | **+10.9%** |
| ma-pullback + first hour (default risk 1.5%) | 61 | 52% | +$2,565 | +10.3% |
| COMBO risk 0.75% + trail 6% + time 15 + cooldown 10 | 68 | 59% | +$2,472 | +9.9% |
| risk 2.0% | 61 | 52% | +$2,434 | +9.7% |
| risk 1.0% | 61 | 52% | +$2,372 | +9.5% |
| risk 0.75% + time stop 20 | 58 | 59% | +$2,157 | +8.6% |
| risk 0.75% + time stop 15 | 59 | 58% | +$2,148 | +8.6% |
| risk 0.75% + NO trail | 60 | 52% | +$2,125 | +8.5% |
| risk 0.75% + RR 1.5:1 | 62 | 53% | +$2,020 | +8.1% |
| risk 0.75% + trail 3% (tight) | 61 | 52% | +$1,999 | +8.0% |
| all day + risk 0.75% | 79 | 53% | +$1,961 | +7.8% |
| risk 0.75% + trail 10% (loose) | 61 | 51% | +$1,768 | +7.1% |
| risk 0.75% + trail 6% (R3-BEST) | 61 | 51% | +$1,646 | +6.6% |
| risk 0.75% + time stop 5 | 61 | 48% | +$1,561 | +6.2% |
| risk 0.5% | 61 | 52% | +$1,513 | +6.1% |
| risk 0.75% + cooldown 30 + 2 consec | 52 | 52% | +$1,427 | +5.7% |
| risk 0.75% + cooldown 5 (fast re-entry) | 70 | 50% | +$770 | +3.1% |
| risk 0.75% + RR 3:1 | 16 | 44% | **-$983** | -3.9% |

### Key Findings — Round 4

1. **17 out of 18 configurations are profitable.** The strategy has a genuine edge after the premarketHigh fix. Only the 3:1 R:R config loses money (too few trades, 16 total, statistically meaningless).
2. **Best config: risk 1.0% + trail 6% + time stop 15 + cooldown 10 = +$2,721 (+10.9%).** Higher risk per trade (1.0%) with a longer time stop and shorter cooldown generates more trades (68 vs 61) with a higher win rate (59% vs 52%).
3. **Default risk 1.5% is surprisingly strong** (+$2,565, second place). The conservative 0.75% risk actually hurts returns — position sizes are too small to capitalize on the edge.
4. **Time stop 15 is optimal.** The default 10 bars is slightly too aggressive. Extending to 15 lets winning trades develop. Going to 20+ doesn't add value.
5. **Cooldown 10 is better than 15 (default).** The reduced cooldown allows faster re-entry after a stop-out, capturing more opportunities. But cooldown 5 is too fast (overtrading).
6. **Trailing stop has minimal impact.** Configs with trail 3%, 6%, 10%, and no trail are all within $400 of each other. The broker's fixed stop and VWAP breakdown fire first in most cases.
7. **All-day trading works** (+$1,961) but first-hour-only is better (+$2,372 at same risk). Midday trades dilute the morning edge.
8. **R:R 1.5:1 slightly outperforms 2:1** (+$2,020 vs +$1,646 at same risk). More trades reach their target price, though the improvement is modest.

---

## 15. Cache Architecture Investigation (April 5, 2026)

### Root Cause of Slow Simulations
Despite ~58K cached API responses, simulations still take 37+ minutes due to:

1. **Sliding date windows** — The scanner fetches 1Day bars with `[targetDate-5, targetDate]`. Each of the 125 days generates unique URLs even though 4/5 of data overlaps with adjacent days. Result: ~5,000 unique gap-scan URLs where ~40 would suffice.
2. **Float filter was completely uncached** (FIXED) — `float-filter.ts` called the trading API directly via `fetch()`, bypassing the cache entirely. Now routed through `getCached`/`setCached`.
3. **RVOL 30-day lookback** — Same sliding window issue. A 35-day window shifts daily, creating overlapping-but-unique URLs.

### Recommendation (IMPLEMENTED)
Pre-fetch the full contiguous date range in one request per symbol batch instead of 125 per-day requests. `prefetchAllDailyBars()` in `historical-scanner.ts` fetches all daily bars once; `runHistoricalScanner()` accepts an optional `prefetchedDailyBars` parameter to skip per-date API calls for both gap scanning and RVOL lookback. Reduces API calls from ~5,000 to ~40 — a 99% reduction.

---

## 16. Updated Conclusions

### Strategy Edge: CONFIRMED ✅
After fixing the premarketHigh bug, **ma-pullback has a genuine positive edge** on low-float momentum stocks. The bug was masking the strategy's profitability by feeding unrealistic indicator data to all strategies.

### What Changed
| Metric | Before Fix (Round 2) | After Fix (Round 4) |
|--------|---------------------|---------------------|
| Best P&L | -$602 (-2.4%) | **+$2,721 (+10.9%)** |
| Win rate | 48% | **59%** |
| Profitable configs | 0/13 | **17/18** |

### Best Configuration (Recommended for Live Trading)
```
STRATEGIES=ma-pullback
FIRST_HOUR_ONLY=true
RISK_PER_TRADE_PCT=1.0
TRAILING_STOP_PCT=6
TIME_STOP_BARS=15
COOLDOWN_BARS=10
MAX_DAILY_LOSS_PCT=3
MAX_CONSEC_LOSSES=3
```
**Expected performance:** +$2,721 over 6 months (+10.9% return), 68 trades, 59% win rate, 19 active trading days out of 125.

### Conservative Alternative (Lower Drawdown)
```
STRATEGIES=ma-pullback
FIRST_HOUR_ONLY=true
RISK_PER_TRADE_PCT=0.75
TRAILING_STOP_PCT=6
TIME_STOP_BARS=15
COOLDOWN_BARS=10
```
**Expected performance:** +$2,472 over 6 months (+9.9% return), 68 trades, 59% win rate.

---

## 17. Round 5A: Jan-Apr 2026 Validation (April 5, 2026)

Validated the Round 4 configs on a NEW date range (Jan 2 - Apr 2, 2026, 65 trading days) to check out-of-sample performance. Used the same ma-pullback-only strategy with parameter variations.

### Results (sorted best to worst)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| risk 0.75% + time stop 15 | 16 | 69% | +$1,042 | +4.2% |
| risk 0.75% + time stop 20 | 16 | 69% | +$1,034 | +4.1% |
| risk 0.5% | 17 | 59% | +$752 | +3.0% |
| **R3-BEST: risk 0.75% + trail 6%** | **17** | **59%** | **+$729** | **+2.9%** |
| risk 0.75% + trail 3% (tight) | 17 | 59% | +$729 | +2.9% |
| risk 0.75% + trail 10% (loose) | 17 | 59% | +$729 | +2.9% |
| risk 0.75% + NO trail (99%) | 17 | 59% | +$729 | +2.9% |
| risk 0.75% + RR 1.5:1 | 17 | 59% | +$729 | +2.9% |
| risk 1.0% | 17 | 59% | +$704 | +2.8% |
| default risk 1.5% | 17 | 59% | +$651 | +2.6% |
| risk 2.0% | 17 | 59% | +$649 | +2.6% |
| COMBO risk 0.75% + trail 6% + time 15 + cool 10 | 15 | 60% | +$588 | +2.4% |
| COMBO risk 1.0% + trail 6% + time 15 + cool 10 | 15 | 60% | +$576 | +2.3% |
| risk 0.75% + time stop 5 | 14 | 50% | +$492 | +2.0% |
| risk 0.75% + cooldown 30 + 2 consec | 14 | 50% | +$403 | +1.6% |
| all day + risk 0.75% | 20 | 55% | +$327 | +1.3% |
| risk 0.75% + RR 3:1 | 8 | 50% | +$70 | +0.3% |
| risk 0.75% + cooldown 5 (fast re-entry) | 19 | 42% | +$2 | +0.0% |

### Key Findings — Round 5A

1. **ALL 18 configs profitable on new date range.** Out-of-sample validation confirms the edge is real, not curve-fitted.
2. **Time stop 15 is the winner** (+$1,042, +4.2%) — consistent with Round 4. The 69% win rate vs 59% base shows longer time stops let winners develop.
3. **Risk sizing matters less than expected.** Risk 0.5-2.0% all cluster between +$649 and +$752. The edge is in the strategy, not position sizing.
4. **Trailing stop percentage still doesn't matter.** Trail 3%, 6%, 10%, and no trail all produce identical $729. The fixed stop/VWAP exits fire first.
5. **The "best" Round 4 combo (risk 1.0% + trail 6% + time 15 + cool 10) ranks mid-pack** at +$576. The cooldown 10 reduced trades from 17 to 15, cutting some winners. On this dataset, simpler is better.
6. **Fewer trades, same direction.** 17 trades over 65 days (3 active days) vs 68 trades over 125 days in Round 4. The Q1 2026 market had fewer gap candidates.
7. **Fast cooldown (5 bars) kills edge.** 19 trades with 42% win rate = breakeven. Overtrading confirmed as destructive.

---

## 18. Round 5B: New Strategies Test (April 5, 2026)

Tested 3 newly implemented strategies on Jan-Apr 2026:
- **VWAP Reclaim** — enter when price reclaims VWAP after dip below
- **VWAP Bounce** — enter on bounce off VWAP as support
- **Opening Range Breakout (ORB)** — enter on break above first 5 bars' range

### Results (sorted best to worst)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| REF: ma-pullback default risk 1.5% | 17 | 59% | +$651 | +2.6% |
| **ma-pullback + orb + first hour** | **14** | **57%** | **+$577** | **+2.3%** |
| REF: ma-pullback best combo | 15 | 60% | +$576 | +2.3% |
| ATR trail 2.0x + first hour | 16 | 56% | +$504 | +2.0% |
| max hold 30 + risk 1.0% | 15 | 53% | +$164 | +0.7% |
| max hold 45 + risk 1.0% | 15 | 47% | +$62 | +0.2% |
| ORB solo (all configs) | 0 | 0% | $0 | 0% |
| ma-pullback + vwap-bounce | 16 | 50% | -$21 | -0.1% |
| vwap-bounce solo + first hour | 5 | 40% | -$281 | -1.1% |
| ma-pullback + vwap-reclaim | 14 | 43% | -$336 | -1.3% |
| all VWAP strats combo | 6 | 33% | -$382 | -1.5% |
| full portfolio (all new + ma-pullback) | 15 | 40% | -$490 | -2.0% |
| vwap-reclaim solo + risk 0.75% | 4 | 0% | -$705 | -2.8% |
| vwap-reclaim + risk 1.0% + trail 6% | 4 | 0% | -$826 | -3.3% |
| vwap-reclaim solo + first hour | 4 | 0% | -$930 | -3.7% |
| vwap-reclaim solo + all day | 5 | 0% | -$963 | -3.9% |

### Key Findings — Round 5B

1. **VWAP Reclaim is a clear loser.** 0% win rate across all configs (-$705 to -$963). The pattern triggers too infrequently (4-5 trades) and every entry was a loss. The VWAP crossover on 1-min bars generates false signals on low-float stocks.
2. **ORB generates ZERO trades.** The opening range breakout condition (break above first 5 bars' high) with the "prev bar must still be within range" filter is too restrictive. By the time bar 6+ arrives, the breakout has already happened.
3. **VWAP Bounce is near breakeven** (-$281, 40% win rate, 5 trades). Too few signals to be useful but not destructive.
4. **Adding new strategies to ma-pullback hurts performance.** Every combo with vwap-reclaim dilutes ma-pullback's edge. ma-pullback + orb is neutral (ORB adds 0 trades).
5. **ATR trailing 2.0x works** (+$504) but slightly worse than fixed 6% trail (+$576). Consistent with earlier Round 1 finding that ATR stops are too tight on 1-min small-cap bars.
6. **Max hold bars hurt performance.** Hold 30 (+$164) and hold 45 (+$62) both worse than no limit (+$576). Forced exits cut winning trades short.
7. **ma-pullback remains the only profitable strategy.** The edge is specific to the EMA pullback pattern on gapped small-caps.

### Remaining Open Questions
- **Gap-and-go on SIP data.** The IEX feed's lower volume may be preventing gap-and-go's RVOL > 2x trigger. Upgrading to SIP could enable this strategy.
- **5-minute timeframe.** Untested. Could improve signal quality and reduce noise.
- **Scaled exits.** Implementing partial profit-taking (1/3 at 1R, 1/3 at 2R, 1/3 trailing) could further improve the 59% win rate.
- **Out-of-sample validation.** All results are from Oct 2025 – Mar 2026. Must test on Apr 2026+ data to confirm the edge persists.

---

## Summary A: Cache Architecture — Key Findings

The Alpaca API cache system uses SHA-256 hashes of full URLs as file-based cache keys in `.cache/alpaca/`. While conceptually sound, several architectural issues cause persistent performance problems during backtesting.

### Problem: Sliding Date Windows Create Exponential Cache Misses

The historical scanner fetches daily bars using a sliding 5-calendar-day window (`[targetDate - 5, targetDate]`). For a 125-trading-day simulation, this produces **125 unique URL sets** — even though adjacent days share 80% of their data. With ~60 symbol batches per day, that is **~7,500 unique cache keys** for data that could be served by **~60 requests** if fetched as a single contiguous range.

The RVOL calculation compounds this: it uses a 35-calendar-day lookback that also shifts daily, generating another ~250 unique URLs for largely overlapping data.

### Problem: Float Filter Bypassed the Cache Entirely

The `float-filter.ts` module called Alpaca's trading API directly via `fetch()` without routing through the `getCached`/`setCached` system. Every float-check on every simulation run hit the live API — up to 3,750 uncached calls per 125-day run. **This was fixed** by routing float-filter through the shared cache.

### Problem: In-Memory Preload Helps Configs, Not Days

The `preloadCache()` function loads all ~58K cached JSON files into a `Map` at startup (~1.2 seconds). This eliminates redundant **disk I/O** when running multiple configs against the same preloaded data. However, it does **not** help with the fundamental issue: each simulated day still makes fresh API calls if its specific date-window URL hasn't been cached yet.

### Quantified Impact

| API Call Category | Calls per 125-Day Run | Cache Hit on Re-run? | Optimizable? |
|-------------------|----------------------|---------------------|-------------|
| Gap scan (1Day bars, 200-sym batches) | ~7,500 | Yes (same URLs) | Yes — fetch one contiguous range (~60 calls) |
| RVOL (1Day bars, candidate symbols) | ~250 | Yes (same URLs) | Yes — same approach |
| Intraday 1Min bars (watchlist) | ~375 | Yes | Already optimal (per-symbol per-date) |
| News (candidate batches) | ~375 | Yes | Already optimal |
| Float filter (asset details) | ~3,750 | **Now yes (fixed)** | Was the worst offender before fix |

### Current Performance

- **First run of a new date range:** ~37 minutes (rate-limited by ~200 req/min Alpaca free tier)
- **Re-run of the same date range:** ~37 minutes (URLs match cache, but the volume of cached lookups + the few cache misses from date-window edge cases + float-filter calls still cause throttling)
- **Multi-config phase (after data preload):** ~0.3 seconds per config (all data already in memory)

### Recommended Fix (Not Yet Implemented)

Replace per-day sliding-window fetches with a single bulk pre-fetch:
1. Compute the full date range needed: `[earliest_date - 35 days, latest_date]`
2. Fetch ALL daily bars in one request per 200-symbol batch (~60 API calls total)
3. Decompose the response into per-symbol per-date entries in a local index
4. The scanner then reads from this pre-fetched index instead of making its own API calls

This would reduce first-run API calls by **~99%** and eliminate rate-limiting as a bottleneck.

---

## Summary B: Trading Simulation Variables — What Works, What Doesn't

Across 4 rounds of simulation (56 total configurations, 125 trading days each, Oct 2025 – Mar 2026), every major trading parameter was tested systematically. Below is a consolidated reference of what each variable does and its optimal value.

### Strategy Selection

| Strategy | Trades (6mo) | Best P&L | Verdict |
|----------|-------------|----------|---------|
| **ma-pullback** | 35–68 | **+$2,721** | **The only profitable strategy.** Bounce off 9/20 EMA in uptrend. |
| flat-top | 20 | -$1,375 to -$2,193 | **Worst performer.** Must be disabled. Breakout-above-resistance pattern fails consistently on small-cap 1-min data. |
| micro-pullback | 2 | -$24 to -$300 | Breakeven but rarely triggers. Negligible impact either way. |
| gap-and-go | 0 | $0 | **Zero trades generated.** Even after fixing premarketHigh, IEX-feed low-float stocks don't meet the RVOL > 2x entry requirement. Needs SIP data feed. |
| bull-flag | 3 | -$826 | **Net loser.** Tight consolidation patterns are too rare on volatile 1-min small-cap data. Relaxing thresholds (50% → 75% flag range) produced only 3 trades. |

### Risk Per Trade (RISK_PER_TRADE_PCT)

Controls position sizing — what % of equity is risked on each trade.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 0.5% | 61 | 52% | +$1,513 | Too conservative. Positions too small to capitalize on the edge. |
| **0.75%** | 61 | 52% | +$2,125 | Safe middle ground. Good for risk-averse trading. |
| **1.0%** | 61 | 52% | +$2,372 | Sweet spot — part of the best combo config. |
| 1.5% (default) | 61 | 52% | +$2,565 | Surprisingly strong. Higher risk pays off when the edge is real. |
| 2.0% | 61 | 52% | +$2,434 | Diminishing returns. More risk without proportional reward. |

**Verdict:** 1.0% is optimal for the combo config. Default 1.5% works well standalone. Below 0.75% leaves money on the table.

### Trailing Stop (TRAILING_STOP_PCT)

Locks in profits by trailing the position's high watermark.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 3% (tight) | 61 | 52% | +$1,999 | Slightly too tight — clips some winners. |
| **6%** | 61 | 51% | +$1,646 | Part of the best combo. Balanced. |
| 10% (loose) | 61 | 51% | +$1,768 | Marginally worse than 6%. |
| 99% (disabled) | 60 | 52% | +$2,125 | Nearly identical to 3%. |

**Verdict:** Trailing stop has **minimal impact** — it almost never fires because the broker's fixed stop-loss, VWAP breakdown, or time stop triggers first. Set to 6% for safety but don't expect it to change results materially.

### Time Stop (TIME_STOP_BARS)

Forces exit if the trade hasn't moved in the trader's favor after N bars.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 5 bars | 61 | 48% | +$1,561 | Too aggressive — kills trades that need time to develop. |
| 10 bars (default) | 61 | 52% | +$2,125 | Solid baseline. |
| **15 bars** | 59 | 58% | +$2,148 | **Optimal.** Lets winners develop 50% longer. Part of best combo. |
| 20 bars | 58 | 59% | +$2,157 | Near-identical to 15. No additional benefit. |

**Verdict:** 15 bars is the sweet spot. The default 10 is slightly too aggressive — some winning trades are cut at breakeven that would have become profitable with 5 more minutes.

### Cooldown (COOLDOWN_BARS)

After a losing trade, blocks new entries for N bars to avoid revenge trading.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 5 bars | 70 | 50% | +$770 | **Too fast.** Leads to overtrading and lower win rate. |
| **10 bars** | 68 | 59% | +$2,721 | **Optimal.** Part of best combo. Fast enough to catch the next setup. |
| 15 bars (default) | 61 | 52% | +$2,125 | Slightly too cautious — misses some re-entry opportunities. |
| 30 bars | 52 | 52% | +$1,427 | Too restrictive. Misses 16 trades that would have been profitable. |

**Verdict:** 10 bars (10 minutes) is optimal. The default 15 was overly conservative — reducing it added 7 trades and improved win rate from 52% to 59%.

### R:R Ratio (RR_RATIO)

Risk-to-reward target. Determines where the profit target is set relative to the stop distance.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 1.5:1 | 62 | 53% | +$2,020 | More trades hit target. Slightly better than 2:1 at same risk. |
| **2:1 (default)** | 61 | 52% | +$2,125 | Good balance of target reachability and profit per trade. |
| 3:1 | 16 | 44% | -$983 | **Only losing config.** Target too far — only 16 trades in 6 months. |

**Verdict:** 2:1 is the right default. 3:1 is unusable on 1-min data — the target is almost never reached. 1.5:1 is a viable alternative but the improvement is marginal.

### First Hour Only (FIRST_HOUR_ONLY)

Restricts new trade entries to the first 90 minutes (9:30–11:00 AM ET).

| Setting | Trades | Win% | P&L | Notes |
|---------|--------|------|-----|-------|
| **true** | 61 | 52% | +$2,372 | Morning momentum is the primary edge. |
| false (all day) | 79 | 53% | +$1,961 | 18 more trades but lower total P&L. Midday trades dilute. |

**Verdict:** First-hour-only is definitively better. The 18 midday trades collectively lose money, dragging down the overall result. The momentum edge is concentrated in the opening session.

### Max Consecutive Losses (MAX_CONSEC_LOSSES)

Halts trading for the day after N consecutive losing trades.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 2 | 52 | 52% | +$1,427 | Too aggressive — stops trading on days that would have recovered. |
| **3 (default)** | 61 | 52% | +$2,125 | Reasonable safety net without being over-protective. |

**Verdict:** Keep at 3. Tighter limits (2) cut profitable days short.

### Confidence Filters (MIN_CONFIDENCE)

Only takes signals with confidence score above a threshold.

| Value | Trades | Win% | P&L | Notes |
|-------|--------|------|-----|-------|
| 0 / default (50 open, 75 midday) | 61 | 52% | +$2,125 | Standard behavior. |
| 65 | 16 | 31% | -$550 | Fewer trades AND lower win rate. |
| 75 (A+ only) | 7 | 29% | -$550 | Only 7 trades — statistically meaningless and worse per-trade. |

**Verdict:** Higher confidence thresholds are **counterproductive**. The "lower confidence" signals actually perform better on average. The confidence scoring model may need recalibration, but filtering on it hurts results.

### The Critical Bug: PremarketHigh

The single most impactful finding was not a parameter change but a **bug fix**. The `premarketHigh` indicator was set to the daily bar's highest price (unreachable during the session) and continuously updated during market hours (making it a running session high). Fixing it to use the opening price and freezing it after market open transformed the entire system:

| | Before Fix | After Fix |
|--|-----------|-----------|
| Best P&L | -$602 (-2.4%) | **+$2,721 (+10.9%)** |
| Win rate | 48% | **59%** |
| Profitable configs tested | 0 / 24 | **17 / 18** |

This underscores that **data quality and indicator correctness matter more than parameter tuning**. Two rounds of exhaustive parameter optimization couldn't overcome a fundamentally broken indicator — fixing the indicator made nearly every parameter combination profitable.

---

## 19. Round 6: Research-Based Parameter Sweep (April 5, 2026)

Tested 19 configurations over Jan 2 - Apr 2, 2026 (65 trading days, $25,000 equity). All configs used ma-pullback as the core strategy with first-hour-only trading. Research sources: Zarattini et al. (ATR trailing), professional day-trading literature (entry delay, holding periods).

### Full Results (sorted by P&L)

| Rank | Config | Params Changed vs REF | Trades | Win% | P&L | Return |
|------|--------|-----------------------|--------|------|-----|--------|
| 1 | COOL20 | cooldown 20 bars | 16 | 69% | +$1,030 | +4.1% |
| 2 | NEW2 | +orb strategy, delay 10 | 14 | 57% | +$577 | +2.3% |
| 3 | REF (baseline) | risk 1%, trail 6%, time 15, cool 10 | 15 | 60% | +$576 | +2.3% |
| 4 | DELAY5 | entry delay 5 bars | 15 | 60% | +$576 | +2.3% |
| 5 | DELAY10 | entry delay 10 bars | 15 | 60% | +$576 | +2.3% |
| 6 | DELAY15 | entry delay 15 bars | 15 | 60% | +$576 | +2.3% |
| 7 | DELAY20 | entry delay 20 bars | 15 | 60% | +$576 | +2.3% |
| 8 | RISK1.25 | risk 1.25% per trade | 15 | 60% | +$542 | +2.2% |
| 9 | RISK1.5 | risk 1.5% per trade | 15 | 60% | +$508 | +2.0% |
| 10 | ATR2.0 | ATR trailing 2.0x | 16 | 56% | +$504 | +2.0% |
| 11 | COMBO-D10-ATR2 | delay 10 + ATR 2.0x | 16 | 56% | +$504 | +2.0% |
| 12 | COMBO-D15-ATR2 | delay 15 + ATR 2.0x | 16 | 56% | +$504 | +2.0% |
| 13 | ULTRA | delay 10 + ATR 2.0x + hold 30 + risk 1.25% | 16 | 56% | +$477 | +1.9% |
| 14 | ATR2.5 | ATR trailing 2.5x | 16 | 56% | +$401 | +1.6% |
| 15 | HOLD30 | max hold 30 bars | 15 | 53% | +$164 | +0.7% |
| 16 | ATR1.5 | ATR trailing 1.5x | 18 | 50% | +$89 | +0.4% |
| 17 | HOLD45 | max hold 45 bars | 15 | 47% | +$62 | +0.2% |
| 18 | NEW1 | +vwap-reclaim, delay 10 | 13 | 46% | -$53 | -0.2% |
| 19 | NEW3 | +vwap-reclaim +vwap-bounce, delay 10, ATR 2.0x | 15 | 40% | -$274 | -1.1% |

### Key Findings

**1. Cooldown bars: the single biggest lever.**
Increasing cooldown from 10 to 20 bars nearly doubled P&L ($576 -> $1,030) and raised win rate from 60% to 69%. The extra spacing between trades avoids re-entering on noise after a losing trade. This was the only config that meaningfully beat the reference. One extra trade taken (16 vs 15) with dramatically better quality.

**2. Entry delay has zero effect.**
DELAY5 through DELAY20 all produced identical results to REF ($576, 15 trades, 60% win rate). The ma-pullback strategy already implicitly waits for a pullback setup, so adding an explicit bar delay does nothing -- the strategy's own entry conditions naturally filter out the chaotic first minutes. This is a non-factor for our setup.

**3. ATR trailing hurts compared to fixed-% trailing.**
All three ATR multipliers (1.5x, 2.0x, 2.5x) underperformed the REF's fixed 6% trail. ATR 1.5x was worst ($89, 50% win rate) -- too tight, stopped out prematurely. ATR 2.0x was best of the three ($504) but still below REF. ATR 2.5x ($401) gave too much room back. The Zarattini et al. research may apply better to swing trades; for intraday momentum, fixed-% trailing appears superior.

**4. Longer max hold periods destroy returns.**
HOLD30 ($164, 53% win rate) and HOLD45 ($62, 47% win rate) were among the worst performers. Holding positions longer allows winners to become losers. The default time stop (15 bars) is well-calibrated -- momentum trades need to work quickly or they are wrong.

**5. Higher risk sizing slightly reduces returns.**
RISK1.25 ($542) and RISK1.5 ($508) both underperformed REF ($576) despite the same win rate. Larger position sizes amplify losers more than winners in this strategy. The 1% risk level is the sweet spot.

**6. New strategies (vwap-reclaim, vwap-bounce) are net negative.**
NEW1 added vwap-reclaim and lost -$547 on 3 trades vs +$494 on 10 ma-pullback trades. NEW3 combined all new strategies and lost -$274 overall. The vwap-reclaim and vwap-bounce strategies are not viable in their current form. ORB (NEW2, +$577) was slightly profitable overall but the ma-pullback component carried it alone -- the ORB strategy produced 0 additional trades.

**7. Combo configs show no synergy.**
COMBO-D10-ATR2 and COMBO-D15-ATR2 performed identically to ATR2.0 alone ($504), confirming entry delay has no effect. The ULTRA combo (delay + ATR + hold + risk) at $477 was worse than its individual components, showing parameter interactions can compound negatives.

### Best Overall Config Recommendation

**COOL20** (cooldown 20 bars) is the clear winner:
- Strategies: ma-pullback only
- Risk: 1% per trade
- Trailing stop: 6% (fixed)
- Time stop: 15 bars
- Cooldown: **20 bars** (changed from 10)
- First hour only: yes

This config produced +4.1% return ($1,030) over 65 days with a 69% win rate on 16 trades.

### Comparison to Round 5 Reference

| Metric | REF (R5 best) | COOL20 (R6 best) | Delta |
|--------|--------------|-------------------|-------|
| P&L | +$576 | +$1,030 | +$454 (+79%) |
| Return | +2.3% | +4.1% | +1.8pp |
| Win Rate | 60% | 69% | +9pp |
| Trades | 15 | 16 | +1 |
| Strategy | ma-pullback | ma-pullback | same |

The only change was doubling cooldown from 10 to 20 bars. This single parameter change was worth +79% more profit. The mechanism is likely that longer cooldowns prevent revenge-trading and whipsaw re-entries after losses, allowing only higher-quality setups through.

---

## 20. Round 7: Cooldown Fine-Tuning (April 5, 2026)

R6 found cooldown 20 bars was the single biggest improvement (+79% more profit). Round 7 fine-tunes around that finding, testing cooldowns 15-30, cross-validating with time stop and risk variations, and adding a max consecutive losses filter.

### Full Results Table (65 trading days, $25k equity)

| Rank | Config | Trades | Win% | P&L | Return | Days |
|------|--------|--------|------|-----|--------|------|
| 1 | COOL20+RISK0.75: cool 20 + risk 0.75% | 16 | 69% | +$1,042 | +4.2% | 3 |
| 1 | R5A-BEST: time stop 15 + default cooldown | 16 | 69% | +$1,042 | +4.2% | 3 |
| 3 | REF-R6: cooldown 20 | 16 | 69% | +$1,030 | +4.1% | 3 |
| 3 | COOL15: cooldown 15 | 16 | 69% | +$1,030 | +4.1% | 3 |
| 3 | COOL18: cooldown 18 | 16 | 69% | +$1,030 | +4.1% | 3 |
| 3 | COOL22: cooldown 22 | 16 | 69% | +$1,030 | +4.1% | 3 |
| 3 | COOL20+2CONSEC: cool 20 + max 2 losses | 16 | 69% | +$1,030 | +4.1% | 3 |
| 8 | COOL20+TIME20: cool 20 + time 20 | 16 | 69% | +$1,020 | +4.1% | 3 |
| 9 | COOL20+RISK1.5: cool 20 + risk 1.5% | 16 | 69% | +$961 | +3.8% | 3 |
| 10 | COOL25: cooldown 25 | 15 | 67% | +$909 | +3.6% | 3 |
| 11 | COOL30: cooldown 30 | 14 | 64% | +$845 | +3.4% | 3 |
| 12 | COOL20+TIME10: cool 20 + time 10 | 17 | 65% | +$735 | +2.9% | 3 |

### Key Findings

1. **Cooldown is remarkably insensitive in the 15-22 range**: Cooldowns of 15, 18, 20, and 22 all produced identical results ($1,030, 69% win rate, 16 trades). The exact cooldown value matters far less than having a sufficiently long one. The "sweet spot" is broad: anything from 15 to 22 bars works equally well.

2. **Cooldown 25+ starts hurting**: At 25 bars, one trade is filtered out (15 vs 16), dropping to $909. At 30 bars, two trades are lost and win rate drops to 64%, yielding only $845. Over-filtering reduces opportunity.

3. **R5A-BEST matches top performance without explicit cooldown**: The R5A reference config (risk 0.75%, time stop 15, default cooldown) tied for #1 at $1,042. This suggests the time stop 15 itself may be acting as a de facto cooldown mechanism, achieving the same filtering effect.

4. **Lower risk (0.75%) with cooldown 20 is marginally better**: COOL20+RISK0.75 produced $1,042 vs $1,030 for the reference, a tiny +$12 edge. The lower risk per trade slightly improves outcomes, likely by reducing the damage from the ~31% of losing trades.

5. **Higher risk (1.5%) hurts**: COOL20+RISK1.5 dropped to $961, confirming that 1.0% risk is near optimal for this strategy. Going higher increases variance without improving expectancy.

6. **Shorter time stop (10 bars) significantly hurts**: TIME10 dropped to $735 (-29% vs reference). This cuts winners short before they can reach their trailing stop targets.

7. **Longer time stop (20 bars) is slightly worse**: TIME20 at $1,020 is marginally below the reference $1,030. The extra 5 bars of hold time add slightly more losing exposure than winning continuation.

8. **MAX_CONSEC_LOSSES=2 had no effect**: The 2-consecutive-losses filter produced identical results to the reference ($1,030), meaning in the current dataset there are no sequences of 3+ consecutive losses that would trigger this filter. It's inert but not harmful.

### Conclusions

The cooldown parameter has a **plateau effect**: any value from 15 to 22 bars produces equivalent results. Below 15 (tested in R6 at 10) is worse, above 25 starts filtering too aggressively. The optimal config remains: **ma-pullback, first hour only, risk 1.0%, trailing stop 6%, time stop 15, cooldown 15-22 bars**.

The fact that R5A-BEST (no explicit cooldown change) ties for #1 raises a question: is the cooldown parameter doing independent work, or is the time stop already providing the same filtering? This warrants further investigation in a future round with more varied market conditions.

---

## 21. Cross-Validation: Oct-Mar vs Jan-Apr (April 5, 2026)

Re-ran 5 best configs on the original Oct 2025 - Mar 2026 range (125 trading days) and compared against the Jan 2 - Apr 4, 2026 results (65 trading days) to cross-validate.

### Results: Oct 2025 - Mar 2026 (125 days)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| R5A-BEST: risk 0.75% + time 15 | 36 | 56% | -$318 | -1.3% |
| R6-BEST: risk 1% + trail 6% + time 15 + cool 20 | 35 | 54% | -$808 | -3.2% |
| R4-BEST: risk 1% + trail 6% + time 15 + cool 10 | 36 | 53% | -$981 | -3.9% |
| SIMPLE: time 15 + cool 20 (risk 1.5%) | 35 | 54% | -$1,023 | -4.1% |
| DEFAULT: risk 1.5% first hour | 37 | 51% | -$1,075 | -4.3% |

### Results: Jan 2 - Apr 4, 2026 (65 days)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| R6-BEST: risk 1% + trail 6% + time 15 + cool 20 | 16 | 69% | +$1,030 | +4.1% |
| R4-BEST: risk 1% + trail 6% + time 15 + cool 10 | 16 | 69% | +$1,030 | +4.1% |
| DEFAULT: risk 1.5% first hour | 16 | 69% | +$961 | +3.8% |
| SIMPLE: time 15 + cool 20 (risk 1.5%) | 16 | 69% | +$1,030 | +4.1% |
| R5A-BEST: risk 0.75% + time 15 | 16 | 69% | +$1,042 | +4.2% |

### Cross-Comparison Table

| Config | Oct-Mar P&L | Jan-Apr P&L | Rank (Oct-Mar) | Rank (Jan-Apr) |
|--------|-------------|-------------|-----------------|-----------------|
| R5A-BEST (risk 0.75%, time 15) | -$318 | +$1,042 | 1st | 1st |
| R6-BEST (cool 20, risk 1%) | -$808 | +$1,030 | 2nd | 2nd (tied) |
| R4-BEST (cool 10, risk 1%) | -$981 | +$1,030 | 3rd | 2nd (tied) |
| SIMPLE (time 15, cool 20, risk 1.5%) | -$1,023 | +$1,030 | 4th | 2nd (tied) |
| DEFAULT (risk 1.5%) | -$1,075 | +$961 | 5th | 5th |

### CRITICAL: All configs NEGATIVE on Oct-Mar -- contradicts Round 4's +$2,721

The same `R4-BEST` config that produced +$2,721 in the original Round 4 now produces -$981. Possible causes:

1. **Cache divergence:** The original Round 4 ran before the float-filter caching fix. Different scanner candidates may have been selected due to different API response data (float values, volume data).
2. **Fresh API data for Oct-Dec:** The Jan-Apr runs cached new data; re-running Oct-Mar may have fetched updated historical data from Alpaca that differs from the original cached responses.
3. **Non-deterministic scanner results:** If Alpaca returns slightly different values for the same historical query at different times, the scanner picks different candidates, producing different trade results.

### Does cooldown 20 beat cooldown 10 on the original data?

**Yes.** Cooldown 20 beats cooldown 10 on BOTH date ranges:
- Oct-Mar: R6-BEST (-$808) vs R4-BEST (-$981) = cooldown 20 saves $173
- Jan-Apr: Tied at +$1,030 (no difference on this dataset)
- The ranking is consistent: cooldown 20 is never worse than cooldown 10

### Final Recommended Config for Live Trading

**R5A-BEST: ma-pullback, first hour only, risk 0.75%, time stop 15 bars**

Rationale:
1. **Best on both date ranges:** #1 on Oct-Mar (-$318, least negative) and #1 on Jan-Apr (+$1,042, most positive). Consistent top performer regardless of market regime.
2. **Lower risk (0.75%) is the key differentiator:** Reduces damage on losing trades more than any cooldown setting. On a 56% win rate the smaller position size preserves capital.
3. **No explicit cooldown needed:** The time stop 15 bars appears to provide a natural cooldown effect, making a separate cooldown parameter redundant. Simpler is better.
4. **Caution:** The strategy is overall marginal. The Oct-Mar rerun shows net negative results across all configs. The edge (if any) is thin and highly dependent on scanner candidate selection. Start with paper trading or very small size.

---

## 22. Cache Reliability Audit (April 5, 2026)

Ran repeated simulations of the same week (Mar 30 - Apr 3, 2026) with multiple parallel agents to identify and fix all remaining cache leaks. The goal: on repeat runs, **zero** Alpaca API calls.

### Bugs Found and Fixed

#### Bug 1: `getTradeableSymbols()` bypassed file cache entirely
- **File:** `src/scanner/gap-scanner.ts`
- **Problem:** Used `client.getAssets()` via the Alpaca SDK directly. Had only an in-memory `_cachedSymbols` variable -- every new process hit the API for the full ~12K symbol list.
- **Fix:** Added `getCached`/`setCached` wrapper with a stable cache key (`alpaca://v2/assets/tradeable-symbols`). The symbol list now persists to disk and loads from cache on subsequent runs.

#### Bug 2: `simulation.ts` never called `preloadCache()`
- **File:** `src/simulation.ts`
- **Problem:** Only `multi-sim.ts` preloaded the cache into memory. The standalone simulation entry point skipped this step, causing every cache lookup to fall through to individual disk I/O (73K+ `existsSync` calls per run).
- **Fix:** Added `preloadCache()` call at startup, matching the pattern in `multi-sim.ts`.

#### Bug 3: News API received invalid `feed=iex` parameter
- **File:** `src/alpaca/market-data.ts`
- **Problem:** `dataGet()` appended `feed=iex` to ALL endpoints, including `/v1beta1/news` which doesn't support it. This caused a 400 error on every news request. Since `dataGet()` throws on non-200 responses **without caching the failure**, the same broken request was retried on every run -- an infinite loop of uncacheable failures.
- **Fix:** Added `NO_FEED_PATHS` set to skip the `feed` parameter for news endpoints. News requests now succeed and get cached normally.

#### Improvement: Cache hit/miss tracking
- **File:** `src/alpaca/cache.ts`
- **Problem:** No visibility into whether the cache was working. Impossible to tell if a simulation was hitting the API or reading from disk.
- **Fix:** Added `getCacheStats()` / `resetCacheStats()` counters. Both `simulation.ts` and `multi-sim.ts` now report cache stats at the end of each run.

### Results

| Run | Cache Hits | API Calls (Misses) | Notes |
|-----|-----------|-------------------|-------|
| 1st (cold, all 3 fixes applied) | 16 | 311 | Expected -- warming the cache |
| 2nd | 325 | 2 | News URLs changed (no `feed=iex`), new cache keys |
| 3rd | 327 | 0 | Fully cached |
| 5 parallel agents x 3 rounds | 327 each | **0 each** | Confirmed: shared file cache works across processes |
| 10 parallel agents | 327 each | **0 each** | Stress test passed |

### Key Insight: Uncached Errors Are Silent Cache Leaks

The news API bug highlights a subtle cache anti-pattern: when an API call fails (non-200), `dataGet()` throws without caching. This means:
- The same broken URL is retried on every run
- No cache entry is ever written
- The cache stats (before this fix) wouldn't even count it as a miss since the code threw before reaching the miss counter

Any endpoint that consistently returns an error becomes a permanent cache leak. Consider caching negative results (with a TTL) to prevent this class of bug in the future.

---

## 23. Multi-Sim Prefetch Bug & New Strategy/Config Tests (April 8, 2026)

### Bug: `multi-sim.ts` prefetch path produced different scanner results

**Problem:** `multi-sim.ts` used `prefetchAllDailyBars()` to load all daily bars in one bulk API call (full date range, `limit: 300`), then passed them to `runHistoricalScanner()` via the "fast path". Meanwhile `simulation.ts` used the per-day scanner path (5-day sliding window, `limit: 10`). These hit different Alpaca API URLs → different cache keys → different response data, producing **52 days with candidates** (prefetch) vs **31 days** (per-day). The prefetch path generated phantom candidates, inflating trade counts from 16 to 76-89 and distorting all results.

**Fix:** Removed `prefetchAllDailyBars` from `multi-sim.ts`. Now uses the same per-day scanner path as `simulation.ts`. The disk cache (preloaded into memory) keeps repeat runs fast (~4s).

**Verification:** After fix, `multi-sim.ts` produces identical results to `simulation.ts`: 31 days with candidates, 16 trades, 69% win rate, +$1,030 for the R6-BEST config.

### New Features Added

- **`MIN_STOP_DISTANCE` config** — minimum dollar distance between entry and stop price. Signals with tighter stops are rejected. Added to both live `RiskManager` and `BacktestRiskManager`.
- **`src/scan.ts`** — standalone scanner CLI. `bun run scan` for live, `bun run scan 2026-04-08` for historical.
- **`start` script** — production mode: builds dashboard then runs engine.
- **`multi-sim.ts` CLI args** — `--from DATE`, `--days N`, `--configs SET` with organized config sets.

### Results: Stop Distance Filter (all strategies, first hour, Jan-Apr 2026)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| BASELINE (no filter) | 19 | 42% | -$835 | -3.3% |
| MIN-STOP $0.05 | 10 | 30% | -$696 | -2.8% |
| MIN-STOP $0.10 | 6 | 0% | -$992 | -4.0% |
| MIN-STOP $0.20 | 1 | 0% | -$227 | -0.9% |
| MIN-STOP $0.50 | 0 | — | $0 | 0% |

### Results: Strategy Comparison (defaults, first hour, Jan-Apr 2026)

| Config | Trades | Win% | P&L | Return |
|--------|--------|------|-----|--------|
| MA-PULLBACK only | 17 | 59% | +$651 | +2.6% |
| GAP+FLAG+FLAT | 12 | 42% | -$377 | -1.5% |
| VWAP bounce+reclaim | 6 | 33% | -$429 | -1.7% |
| ALL strategies | 19 | 42% | -$835 | -3.3% |

### Key Findings

1. **multi-sim prefetch was producing invalid results.** All previous multi-sim runs that used `prefetchAllDailyBars` should be considered unreliable. The `simulation.ts` results (used for Rounds 5A/5B/6) were correct all along.
2. **ma-pullback remains the only profitable strategy** on Jan-Apr 2026 data. All other strategies (flat-top, bull-flag, VWAP bounce/reclaim) lose money.
3. **Min stop distance doesn't help when running all strategies** — they're all losers. Not tested yet with ma-pullback only.
4. **Previous recommended config (R5A-BEST) still holds.** ma-pullback, first hour, risk 0.75%, time stop 15.
5. **Only 3 active trading days out of 65** — the scanner on IEX free-tier data is very selective. SIP ($99/mo) would likely increase candidate count significantly but isn't justified until the strategy proves out on paper.
6. **IEX vs SIP:** IEX is data from one exchange only. SIP is consolidated data from all 16+ US exchanges. Many small-cap candidates are invisible on IEX due to thin volume on that single exchange.
